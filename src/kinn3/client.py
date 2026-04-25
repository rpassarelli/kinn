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


class _SamplerMixin:
    """Holds higher-level methods. Populated by Tasks 14, 17, 18 via direct edits to this file."""
    pass


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
