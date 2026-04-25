"""Pin the order of operations in KinnAgent.turn(). Failing this test means
a Phase 11 modification was inserted at the wrong spot — re-read Task 37."""
from __future__ import annotations
import pytest
import asyncio
from unittest.mock import AsyncMock, MagicMock
from kinn3.agent import KinnAgent
from kinn3.models import TurnOutput, SignalMutation, VSMBeliefState, BlockResolution
from kinn3.probes import BOOTSTRAP_PROBES


def _u(): return {"input_tokens": 100, "cache_read_input_tokens": 50, "cache_creation_input_tokens": 0, "output_tokens": 30}


@pytest.mark.asyncio
async def test_turn_order_of_operations(memory):
    """Track every side effect; assert order matches Task 37 spec."""
    call_log: list[str] = []

    mock_client = AsyncMock()
    mock_client.sample_answers = AsyncMock(side_effect=lambda **kw: (call_log.append("sample_answers"), ["x"])[1])
    mock_client.predict_mutations = AsyncMock(side_effect=lambda **kw: (call_log.append("predict_mutations"), [])[1])
    mock_client.run_turn_tool = AsyncMock(side_effect=lambda **kw: (
        call_log.append("run_turn_tool"),
        (TurnOutput(heard=["x"], delta="", next_question="What's next here?", signal_mutations=[]), _u()),
    )[1])

    agent = KinnAgent(client=mock_client, memory=memory, probes=list(BOOTSTRAP_PROBES))
    await agent.turn("normal stakeholder message — not fatigued")

    sample_idx = call_log.index("sample_answers")
    run_idx = call_log.index("run_turn_tool")
    assert sample_idx < run_idx, f"BED-LLM must precede tool call. Got: {call_log}"


@pytest.mark.asyncio
async def test_turn_order_reground_short_circuits(memory):
    """Reground must fire BEFORE probe selection (early return)."""
    memory.write("transcript", "USER: I don't know.\nUSER: I don't know.\nUSER: ...")

    mock_client = AsyncMock()
    mock_client.sample_answers = AsyncMock(return_value=["x"])
    mock_client.predict_mutations = AsyncMock(return_value=[])
    mock_client.run_turn_tool = AsyncMock()

    agent = KinnAgent(client=mock_client, memory=memory, probes=list(BOOTSTRAP_PROBES))
    out = await agent.turn("...")

    mock_client.run_turn_tool.assert_not_awaited()
    mock_client.sample_answers.assert_not_awaited()
    assert "I hear you" in out.heard[0]


@pytest.mark.asyncio
async def test_turn_order_synthesis_overrides_after_mutations(memory):
    """Synthesis-close must check AFTER mutations applied, not before."""
    near_done = VSMBeliefState(turn=9)
    for i in range(1, 6):
        near_done.blocks[i] = BlockResolution(resolution="high", quotes=["q"]*3, updated_turn=8)
    near_done.blocks[6] = BlockResolution(resolution="mid", quotes=["a", "b"], updated_turn=7)
    memory.write("belief_state", near_done.model_dump_json())

    mock_client = AsyncMock()
    mock_client.sample_answers = AsyncMock(return_value=["x"])
    mock_client.predict_mutations = AsyncMock(return_value=[])
    mock_client.run_turn_tool = AsyncMock(return_value=(TurnOutput(
        heard=["clear"], delta="→ Block 6: mid → high",
        next_question="What else?",
        signal_mutations=[SignalMutation(block=6, new_resolution="high",
                                         quote="competitor entered last quarter cleared things up")],
    ), _u()))
    agent = KinnAgent(client=mock_client, memory=memory, probes=list(BOOTSTRAP_PROBES))
    out = await agent.turn("competitor entered last quarter")

    assert "synthesis ready" in out.delta.lower() or "all blocks at high" in out.delta.lower()
