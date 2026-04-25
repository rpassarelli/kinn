"""KinnAgent — composes per-turn flow + async recompile + drain.

turn() — per-turn flow (NO extended thinking on tool path):
    1. Load belief + probes from memory
    2. If no pending probes → drain in-flight, then sync recompile
    3. BED-LLM: select argmax-EIG probe
    4. forced_tool_call(emit_turn_response); retry on ValidationError up to 2×
    5. Apply mutations + bump turn
    6. Mark probe answered
    7. Persist belief + transcript
    8. Every 3 turns: schedule async recompile (tracked, drainable)
    9. Return TurnOutput

drain() — await any in-flight background tasks; CLI calls before exit.
"""
from __future__ import annotations
import asyncio
import json
from pathlib import Path
from typing import Protocol
from pydantic import ValidationError
from .bed_llm import select_probe, update_belief, _belief_summary
from .memory import MemoryAdapter
from .models import Probe, TurnOutput, VSMBeliefState
from .probes import BOOTSTRAP_PROBES


MAX_VALIDATION_RETRIES = 2


class AgentClient(Protocol):
    async def sample_answers(self, **kw) -> list[str]: ...
    async def predict_mutations(self, **kw): ...
    async def run_turn_tool(
        self, *, system: str, belief_summary: str, probe: Probe,
        user_message: str, correction_hint: str = "",
    ) -> TurnOutput: ...
    async def recompile_probes_two_phase(
        self, *, belief_summary: str, transcript: str, next_order_start: int
    ) -> list[Probe]: ...


class KinnAgent:
    def __init__(
        self,
        client: AgentClient,
        memory: MemoryAdapter,
        *,
        probes: list[Probe] | None = None,
        events_path: Path | None = None,
        ledger_path: Path | None = None,
        session_id: str = "",
    ):
        self.client = client
        self.memory = memory
        self._pending_tasks: set[asyncio.Task] = set()
        from .events import EventLog
        from .metrics import SessionMetrics
        self.events = EventLog(events_path) if events_path else None
        self.metrics = SessionMetrics(ledger_path=ledger_path)
        self.session_id = session_id
        self._last_usage: dict | None = None
        self._init_state(probes or list(BOOTSTRAP_PROBES))

    def _init_state(self, probes: list[Probe]) -> None:
        if self.memory.read("belief_state") is None:
            self.memory.write("belief_state", VSMBeliefState().model_dump_json())
        if self.memory.read("probes") is None:
            self.memory.write("probes", _probes_to_json(probes))
        if self.memory.read("next_probe_order") is None:
            initial_max = max((p.order for p in probes), default=0)
            self.memory.write("next_probe_order", str(initial_max + 1))

    async def turn(self, user_message: str) -> TurnOutput:
        import time
        _turn_start = time.time()
        belief = VSMBeliefState.model_validate_json(self.memory.read("belief_state"))
        probes = _probes_from_json(self.memory.read("probes"))

        # If no pending probes, drain in-flight then sync-recompile.
        if not any(p.delivery_status == "pending" for p in probes):
            await self.drain()
            probes = _probes_from_json(self.memory.read("probes"))
            if not any(p.delivery_status == "pending" for p in probes):
                await self._recompile_now(belief, probes)
                probes = _probes_from_json(self.memory.read("probes"))

        # 1. Pick the highest-EIG pending probe
        probe = await select_probe(self.client, probes, belief)

        # 2. Forced-tool call with retry on ValidationError
        from .prompts import build_system_prompt
        sys_prompt = build_system_prompt()
        belief_summary = _belief_summary(belief)
        out = await self._run_turn_with_retry(
            sys_prompt=sys_prompt, belief_summary=belief_summary,
            probe=probe, user_message=user_message,
        )

        # 3. Apply mutations + bump turn
        new_turn = belief.turn + 1
        new_belief = update_belief(belief, out.signal_mutations, turn=new_turn)

        # 4. Mark probe answered
        for p in probes:
            if p.order == probe.order:
                p.delivery_status = "answered"
                p.delivered_at_turn = new_turn
                p.answered_at_turn = new_turn

        # 5. Persist
        self.memory.write("belief_state", new_belief.model_dump_json())
        self.memory.write("probes", _probes_to_json(probes))
        self.memory.append("transcript",
            f"### Turn {new_turn}\nUSER: {user_message}\nAGENT: {out.model_dump_json()}")

        # 6. Every 3 turns, schedule background recompile (drainable)
        if new_turn % 3 == 0:
            task = asyncio.create_task(self._recompile_now(new_belief, probes))
            self._pending_tasks.add(task)
            task.add_done_callback(self._pending_tasks.discard)

        # Record metrics (Task 26)
        self.metrics.record(
            turn_n=new_turn,
            wall_clock_s=time.time() - _turn_start,
            usage=self._last_usage or {},
            session_id=self.session_id,
        )
        self._last_usage = None

        return out

    async def _run_turn_with_retry(
        self, *, sys_prompt: str, belief_summary: str, probe: Probe, user_message: str,
    ) -> TurnOutput:
        hint = ""
        last_err: Exception | None = None
        for attempt in range(MAX_VALIDATION_RETRIES + 1):
            try:
                out, usage = await self.client.run_turn_tool(
                    system=sys_prompt,
                    belief_summary=belief_summary,
                    probe=probe,
                    user_message=user_message,
                    correction_hint=hint,
                    return_usage=True,
                )
                self._last_usage = usage
                return out
            except ValidationError as e:
                last_err = e
                hint = f"Previous attempt failed validation: {str(e)[:200]}. Fix exactly-one-'?' and ≤30 word rules."
        raise RuntimeError(f"run_turn_tool failed validation {MAX_VALIDATION_RETRIES + 1} times: {last_err}")

    async def _recompile_now(self, belief: VSMBeliefState, current_probes: list[Probe]) -> None:
        # Reserve a contiguous block of orders BEFORE the LLM call so two concurrent
        # recompiles can't claim overlapping ranges. We reserve a slot of 10.
        # Note: read-modify-write is atomic in asyncio (no await between). Do not insert awaits here.
        next_order = int(self.memory.read("next_probe_order") or "1")
        slot_size = 10
        self.memory.write("next_probe_order", str(next_order + slot_size))

        transcript = self.memory.read("transcript") or ""
        new_probes = await self.client.recompile_probes_two_phase(
            belief_summary=_belief_summary(belief),
            transcript=transcript,
            next_order_start=next_order,
        )
        # Keep answered/skipped history; add new pending probes.
        kept = [p for p in current_probes if p.delivery_status in ("answered", "skipped")]
        merged = kept + new_probes
        self.memory.write("probes", _probes_to_json(merged))

    async def drain(self) -> None:
        """Await any in-flight background tasks. Call from CLI before exit."""
        if not self._pending_tasks:
            return
        await asyncio.wait_for(asyncio.gather(*self._pending_tasks, return_exceptions=True), timeout=120)


def _probes_to_json(probes: list[Probe]) -> str:
    return json.dumps([p.model_dump() for p in probes])


def _probes_from_json(raw: str) -> list[Probe]:
    return [Probe(**x) for x in json.loads(raw)]
