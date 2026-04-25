import pytest
from unittest.mock import AsyncMock, MagicMock
from kinn3.client import KinnClient
from kinn3.models import Probe


@pytest.mark.asyncio
async def test_recompile_two_phase_calls_thinking_then_forced_tool():
    c = KinnClient(api_key="fake")
    c.thinking_text_call = AsyncMock(return_value="REASONING: target blocks 5, 2, 6 for next slate.")
    c.forced_tool_call = AsyncMock(return_value={"probes": [
        {"target_block": 5, "depth": "dimension", "draft": "Who owns the P&L?"},
        {"target_block": 2, "depth": "dimension", "draft": "What must you never do?"},
        {"target_block": 6, "depth": "dimension", "draft": "Biggest competitor worry?"},
    ]})
    probes = await c.recompile_probes_two_phase(
        belief_summary="all empty", transcript="turn 1 ...", next_order_start=200,
    )
    assert len(probes) == 3
    assert probes[0].order == 200
    assert probes[1].order == 201
    assert probes[2].order == 202
    assert probes[0].target_block == 5
    c.thinking_text_call.assert_awaited_once()
    c.forced_tool_call.assert_awaited_once()
    # Verify the forced_tool_call user_content includes the thinking output
    fc_kwargs = c.forced_tool_call.await_args.kwargs
    assert "REASONING" in fc_kwargs["user_content"]


@pytest.mark.asyncio
async def test_two_concurrent_recompiles_get_disjoint_order_slots(memory):
    """Validates the v3 race fix at the SOURCE: reserve-slot pattern gives each
    concurrent recompile a non-overlapping order range.
    """
    from kinn3.agent import KinnAgent
    from kinn3.probes import BOOTSTRAP_PROBES
    from kinn3.models import VSMBeliefState, Probe
    import asyncio

    captured_starts: list[int] = []

    async def capture_recompile(*, belief_summary, transcript, next_order_start, **kw):
        captured_starts.append(next_order_start)
        await asyncio.sleep(0.01)  # ensure both calls overlap
        return [
            Probe(order=next_order_start + i, target_block=(i % 6) + 1,
                  depth="dimension", draft=f"slot{next_order_start} probe{i}")
            for i in range(3)
        ]

    mock_client = AsyncMock()
    mock_client.sample_answers = AsyncMock(return_value=["x"])
    mock_client.predict_mutations = AsyncMock(return_value=[])
    mock_client.recompile_probes_two_phase = AsyncMock(side_effect=capture_recompile)

    agent = KinnAgent(client=mock_client, memory=memory, probes=list(BOOTSTRAP_PROBES))
    belief = VSMBeliefState.model_validate_json(memory.read("belief_state"))

    await asyncio.gather(
        agent._recompile_now(belief, list(BOOTSTRAP_PROBES)),
        agent._recompile_now(belief, list(BOOTSTRAP_PROBES)),
    )

    assert len(captured_starts) == 2, "Both recompiles should have been called"
    a, b = sorted(captured_starts)
    SLOT_SIZE = 10
    assert b - a >= SLOT_SIZE, (
        f"Race fix broken — concurrent recompiles got overlapping order ranges. "
        f"Starts: {captured_starts}. Expected gap >= {SLOT_SIZE}."
    )
    range_a = set(range(a, a + 3))
    range_b = set(range(b, b + 3))
    assert range_a.isdisjoint(range_b), (
        f"Per-call probe order ranges overlap: {range_a} vs {range_b}"
    )
