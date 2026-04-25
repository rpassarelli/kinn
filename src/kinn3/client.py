"""Anthropic client wrapper — two primitives plus a method-extension mixin.

Architecture rationale:
- Anthropic rejects forced tool_choice + extended thinking together.
- So we expose TWO primitives:
    * forced_tool_call: tool_choice forced, NO thinking. <1s target. Per-turn path.
    * thinking_text_call: extended thinking, NO tools, returns text. Async recompile phase 1.
- Both primitives wrap LLM calls in `_with_retries` for transient failure handling.
- Higher-level methods (sample_answers, predict_mutations, run_turn_tool,
  recompile_probes_two_phase) are added to _SamplerMixin in later tasks.
- _SamplerMixin holds method definitions; KinnClient(_SamplerMixin) is the single class.
"""
from __future__ import annotations
import asyncio
import os
import random
from typing import Any, Awaitable, Callable, TypeVar
from anthropic import (
    AsyncAnthropic,
    APITimeoutError,
    APIConnectionError,
    RateLimitError,
    InternalServerError,
    AuthenticationError,
    PermissionDeniedError,
)
from .models import SignalMutation as _SignalMutation

T = TypeVar("T")


async def _with_retries(call: Callable[[], Awaitable[T]]) -> T:
    """Wrap an async LLM call with the kinn3 retry policy.

    Policy table:
      RateLimitError (429): exp backoff 1s, 2s, 4s, 8s — max 4 retries
      InternalServerError (5xx) / overloaded: jittered backoff 0.5-1.5s, 1-3s, 2-6s — max 3 retries
      APITimeoutError / APIConnectionError: retry once with 30s timeout
      AuthenticationError / PermissionDeniedError: fail loud, no retry

    Note: pydantic.ValidationError is raised by callers (caught by agent's _run_turn_with_retry).
    """
    rate_delays = [1.0, 2.0, 4.0, 8.0]
    server_delay_ranges = [(0.5, 1.5), (1.0, 3.0), (2.0, 6.0)]
    timeout_retries_left = 1

    while True:
        try:
            return await call()
        except (AuthenticationError, PermissionDeniedError):
            raise  # never retry auth failures
        except RateLimitError:
            if not rate_delays:
                raise
            await asyncio.sleep(rate_delays.pop(0))
        except InternalServerError:
            if not server_delay_ranges:
                raise
            lo, hi = server_delay_ranges.pop(0)
            await asyncio.sleep(random.uniform(lo, hi))
        except (APITimeoutError, APIConnectionError):
            if timeout_retries_left <= 0:
                raise
            timeout_retries_left -= 1
            await asyncio.sleep(2.0)


_SAMPLE_ANSWERS_TOOL = {
    "name": "propose_answers",
    "description": "Propose N plausible stakeholder answers to the given probe.",
    "input_schema": {
        "type": "object",
        "required": ["answers"],
        "properties": {
            "answers": {"type": "array", "items": {"type": "string"}, "minItems": 1},
        },
    },
}

_RECOMPILE_SLATE_TOOL = {
    "name": "propose_probe_slate",
    "description": "Emit the next 3-5 probes as structured slate.",
    "input_schema": {
        "type": "object",
        "required": ["probes"],
        "properties": {
            "probes": {
                "type": "array",
                "minItems": 3, "maxItems": 5,
                "items": {
                    "type": "object",
                    "required": ["target_block", "depth", "draft"],
                    "properties": {
                        "target_block": {"type": "integer", "minimum": 1, "maximum": 6},
                        "depth": {"enum": ["identity", "dimension", "facet", "gap"]},
                        "draft": {"type": "string", "minLength": 10, "maxLength": 200},
                    },
                },
            },
        },
    },
}

_PREDICT_MUTATIONS_TOOL = {
    "name": "propose_mutations",
    "description": "Propose signal mutations that would result from this answer.",
    "input_schema": {
        "type": "object",
        "required": ["mutations"],
        "properties": {
            "mutations": {
                "type": "array",
                "items": {
                    "type": "object",
                    "required": ["block", "new_resolution", "quote"],
                    "properties": {
                        "block": {"type": "integer", "minimum": 1, "maximum": 6},
                        "new_resolution": {"enum": ["empty", "low", "mid", "high"]},
                        "quote": {"type": "string"},
                    },
                },
            },
        },
    },
}


class _SamplerMixin:
    """Higher-level methods composed from forced_tool_call + thinking_text_call.
    Methods are added across Tasks 14, 17, 18.
    """

    async def sample_answers(
        self, *, probe_draft: str, belief_summary: str, n: int = 6
    ) -> list[str]:
        result = await self.forced_tool_call(
            system="You predict how a stakeholder in a business diagnostic interview would plausibly answer.",
            user_content=(
                f"Belief so far:\n{belief_summary}\n\n"
                f"Probe: {probe_draft}\n\n"
                f"Propose {n} plausible, varied stakeholder answers (10-40 words each)."
            ),
            tool=_SAMPLE_ANSWERS_TOOL,
            max_tokens=512,
        )
        if not result:
            return []
        return list(result.get("answers", []))[:n]

    async def predict_mutations(
        self, *, probe_draft: str, answer: str, belief_summary: str
    ) -> list[_SignalMutation]:
        result = await self.forced_tool_call(
            system="You predict the VSM signal mutations caused by a stakeholder answer.",
            user_content=(
                f"Belief so far:\n{belief_summary}\n\n"
                f"Probe: {probe_draft}\nAnswer: {answer}\n\n"
                "Propose only quote-backed mutations. 0-3 mutations typical."
            ),
            tool=_PREDICT_MUTATIONS_TOOL,
            max_tokens=512,
        )
        out: list[_SignalMutation] = []
        if not result:
            return out
        for raw in result.get("mutations", []):
            try:
                out.append(_SignalMutation(**raw))
            except Exception:
                pass
        return out

    async def run_turn_tool(
        self,
        *,
        system: str,
        belief_summary: str,
        probe,
        user_message: str,
        correction_hint: str = "",
    ):
        """Execute one turn via emit_turn_response tool. NO thinking (forced tool).
        Raises pydantic.ValidationError if model output violates schema; agent retries.
        """
        from .tools import EMIT_TURN_RESPONSE_TOOL
        from .models import TurnOutput
        user_content = (
            f"# Belief\n{belief_summary}\n\n"
            f"# Pinned probe (order={probe.order}, block={probe.target_block}, depth={probe.depth})\n"
            f"{probe.draft}\n\n"
            f"# Stakeholder message\n{user_message}\n\n"
            "Emit the emit_turn_response tool call. The next_question MUST contain exactly one '?' "
            "and be ≤30 words. Heard MUST contain 1-5 quote-backed observations."
        )
        if correction_hint:
            user_content += f"\n\n# CORRECTION HINT (retry)\n{correction_hint}"
        result = await self.forced_tool_call(
            system=system,
            user_content=user_content,
            tool=EMIT_TURN_RESPONSE_TOOL,
            max_tokens=2048,
        )
        if not result:
            raise RuntimeError("emit_turn_response tool was not called")
        return TurnOutput(**result)  # raises ValidationError on schema failure

    async def recompile_probes_two_phase(
        self,
        *,
        belief_summary: str,
        transcript: str,
        next_order_start: int,
        thinking_budget: int = 24000,
    ):
        """Two-phase recompile (avoids thinking + forced-tool incompatibility).

        Phase 1: extended-thinking text call → reasoning about target blocks.
        Phase 2: forced-tool call (no thinking) → structured probe slate, fed Phase 1's text.
        Probe orders are monotonic from `next_order_start` (no cross-recompile collisions).
        """
        from .models import Probe

        # Phase 1 — deep reasoning about which blocks to target next.
        reasoning = await self.thinking_text_call(
            system=(
                "You are kinn3's probe planner. Reason carefully about which 3-5 VSM blocks "
                "the next probes should target to maximize information gain. Consider what's "
                "still empty/low, what just shifted, and what dependencies exist. Output your "
                "plan as plain text — a downstream tool call will turn it into structured probes."
            ),
            user_content=(
                f"# Current belief\n{belief_summary}\n\n"
                f"# Transcript so far\n{transcript[-4000:]}\n\n"
                "Reason about: (1) which 3-5 blocks deserve the next probes; (2) what depth "
                "(identity/dimension/facet/gap) for each; (3) the exact wording for each probe."
            ),
            thinking_budget=thinking_budget,
            max_tokens=4096,
        )

        # Phase 2 — structured emission via forced tool, NO thinking.
        result = await self.forced_tool_call(
            system="You convert a probe-planning rationale into a structured probe slate via propose_probe_slate.",
            user_content=(
                f"# Plan\n{reasoning}\n\n"
                "Emit propose_probe_slate with 3-5 probes that match the plan."
            ),
            tool=_RECOMPILE_SLATE_TOOL,
            max_tokens=2048,
        )
        if not result:
            return []
        out: list[Probe] = []
        for i, raw in enumerate(result.get("probes", [])):
            try:
                out.append(Probe(order=next_order_start + i, **raw))
            except Exception:
                pass
        return out

    async def simulate_answer(
        self, *, persona_markdown: str, probe: str, transcript: str, turn: int
    ) -> str:
        """Stakeholder simulator — uses cheaper model (Haiku) since it's not on the user-visible path."""
        import os
        assert self.raw is not None
        sim_model = os.environ.get("KINN3_SIMULATOR_MODEL", "claude-haiku-4-5-20251001")
        msg = await self.raw.messages.create(
            model=sim_model,
            max_tokens=400,
            system=(
                "You play a stakeholder in a business diagnostic interview. "
                "Answer in the voice described by the persona. Stay consistent with prior answers. "
                "Use fatigue rules from the persona. Do not break character."
            ),
            messages=[{"role": "user", "content": (
                f"# Persona\n{persona_markdown}\n\n"
                f"# Transcript so far\n{transcript}\n\n"
                f"# Turn {turn}. Interviewer asks:\n{probe}\n\n"
                "Respond in one paragraph."
            )}],
        )
        for block in msg.content:
            if block.type == "text":
                return block.text.strip()
        return ""


class KinnClient(_SamplerMixin):
    """Thin wrapper around AsyncAnthropic with our defaults."""

    def __init__(self, api_key: str | None = None, model: str | None = None):
        self.api_key = api_key or os.environ.get("ANTHROPIC_API_KEY", "")
        self.model = model or os.environ.get("KINN3_MODEL", "claude-opus-4-7")
        self.raw = AsyncAnthropic(api_key=self.api_key) if self.api_key else None

    # -- helpers --------------------------------------------------------------

    def _cached_system(self, text: str) -> list[dict[str, Any]]:
        """Wrap a system prompt in a cache_control ephemeral block."""
        return [{
            "type": "text",
            "text": text,
            "cache_control": {"type": "ephemeral"},
        }]

    def _thinking_opts(self, budget_tokens: int) -> dict[str, Any]:
        # opus-4-7 dropped budget_tokens in favor of `output_config.effort`.
        # We accept a budget_tokens arg for v0 API compat (callers don't have to change),
        # but it's ignored. Map to output_config.effort in v0.1 if budget control matters.
        # (Discovered in Task 1.5 preflight — see plan v9 changelog.)
        return {"type": "adaptive"}

    # -- primitive 1: forced tool, no thinking --------------------------------

    async def forced_tool_call(
        self,
        *,
        system: str,
        user_content: str,
        tool: dict[str, Any],
        max_tokens: int = 2048,
    ) -> dict[str, Any] | None:
        """Force a specific tool call. NO thinking (API incompatibility).
        Wrapped in _with_retries for 429 / 5xx / timeout handling.
        """
        assert self.raw is not None, "No API key set"

        async def call():
            return await self.raw.messages.create(
                model=self.model,
                max_tokens=max_tokens,
                system=self._cached_system(system),
                tools=[tool],
                tool_choice={"type": "tool", "name": tool["name"]},
                messages=[{"role": "user", "content": user_content}],
            )

        msg = await _with_retries(call)
        for block in msg.content:
            if getattr(block, "type", None) == "tool_use" and block.name == tool["name"]:
                return dict(block.input)
        return None

    # -- primitive 2: extended thinking, text output, no tools ----------------

    async def thinking_text_call(
        self,
        *,
        system: str,
        user_content: str,
        thinking_budget: int = 24000,
        max_tokens: int = 4096,
    ) -> str:
        """Extended thinking, returns text. NO tools. Wrapped in _with_retries."""
        assert self.raw is not None, "No API key set"

        async def call():
            return await self.raw.messages.create(
                model=self.model,
                max_tokens=max_tokens,
                system=self._cached_system(system),
                thinking=self._thinking_opts(thinking_budget),
                messages=[{"role": "user", "content": user_content}],
            )

        msg = await _with_retries(call)
        out = []
        for block in msg.content:
            if getattr(block, "type", None) == "text":
                out.append(block.text)
        return "\n".join(out)
