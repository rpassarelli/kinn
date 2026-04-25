import asyncio
import pytest
from unittest.mock import AsyncMock, MagicMock
from pydantic import ValidationError
from kinn3.agent import KinnAgent
from kinn3.models import Probe, SignalMutation, TurnOutput
from kinn3.probes import BOOTSTRAP_PROBES


@pytest.mark.asyncio
async def test_turn_updates_memory(memory, empty_belief):
    mock_client = AsyncMock()
    mock_client.sample_answers = AsyncMock(return_value=["x", "y", "z"])
    mock_client.predict_mutations = AsyncMock(return_value=[
        SignalMutation(block=4, new_resolution="low", quote="tired"),
    ])
    mock_client.run_turn_tool = AsyncMock(return_value=(TurnOutput(
        heard=["burnout noted"], delta="→ Block 4: empty → low",
        next_question="What keeps you up at night?",
        signal_mutations=[SignalMutation(block=4, new_resolution="low", quote="I'm exhausted")],
    ), {"input_tokens": 100, "cache_read_input_tokens": 50, "cache_creation_input_tokens": 0, "output_tokens": 30}))

    agent = KinnAgent(client=mock_client, memory=memory, probes=list(BOOTSTRAP_PROBES))
    out = await agent.turn(user_message="I'm exhausted. I don't know what to do.")

    assert isinstance(out, TurnOutput)
    assert memory.read("belief_state") is not None
    assert memory.read("transcript") is not None


def _make_real_validation_error():
    """Construct a real ValidationError by attempting an invalid TurnOutput.
    (`from_exception_data("TurnOutput", [])` may not raise cleanly across pydantic versions.)
    """
    try:
        TurnOutput(heard=[], delta="", next_question="why? how?", signal_mutations=[])
    except ValidationError as e:
        return e
    raise RuntimeError("expected ValidationError")


@pytest.mark.asyncio
async def test_turn_retries_on_validation_error(memory):
    """If the LLM returns invalid output (multi ?, etc), retry up to 2× with corrective hint."""
    mock_client = AsyncMock()
    mock_client.sample_answers = AsyncMock(return_value=["x"])
    mock_client.predict_mutations = AsyncMock(return_value=[])
    valid = TurnOutput(heard=["ok"], delta="", next_question="What now?", signal_mutations=[])
    usage = {"input_tokens": 100, "cache_read_input_tokens": 50, "cache_creation_input_tokens": 0, "output_tokens": 30}
    err = _make_real_validation_error()
    # First two calls raise ValidationError, third succeeds
    mock_client.run_turn_tool = AsyncMock(side_effect=[err, err, (valid, usage)])
    agent = KinnAgent(client=mock_client, memory=memory, probes=list(BOOTSTRAP_PROBES))
    out = await agent.turn("hi")
    assert out.next_question == "What now?"
    assert mock_client.run_turn_tool.await_count == 3


@pytest.mark.asyncio
async def test_turn_triggers_immediate_recompile_when_no_pending(memory):
    """If all probes are answered, agent must recompile before selecting."""
    mock_client = AsyncMock()
    mock_client.sample_answers = AsyncMock(return_value=["x"])
    mock_client.predict_mutations = AsyncMock(return_value=[])
    mock_client.run_turn_tool = AsyncMock(return_value=(TurnOutput(
        heard=["ok"], delta="", next_question="What's next?", signal_mutations=[],
    ), {"input_tokens": 100, "cache_read_input_tokens": 50, "cache_creation_input_tokens": 0, "output_tokens": 30}))
    mock_client.recompile_probes_two_phase = AsyncMock(return_value=[
        Probe(order=200, target_block=2, depth="dimension", draft="What must you never do?"),
    ])
    # Seed all probes as answered
    answered_probes = [
        p.model_copy(update={"delivery_status": "answered"}) for p in BOOTSTRAP_PROBES
    ]
    agent = KinnAgent(client=mock_client, memory=memory, probes=answered_probes)
    await agent.turn("hi")
    mock_client.recompile_probes_two_phase.assert_awaited()


@pytest.mark.asyncio
async def test_drain_awaits_background_recompile(memory):
    """After turn 3, agent schedules a background recompile. drain() must await it."""
    from kinn3.models import VSMBeliefState
    import asyncio
    # Seed belief at turn 2 so next turn (3) triggers recompile
    memory.write("belief_state", VSMBeliefState(turn=2).model_dump_json())

    recompile_started = asyncio.Event()
    recompile_done = asyncio.Event()

    async def slow_recompile(**kw):
        recompile_started.set()
        await asyncio.sleep(0.05)
        recompile_done.set()
        return [Probe(order=kw["next_order_start"], target_block=5,
                      depth="dimension", draft="Who owns the P&L?")]

    mock_client = AsyncMock()
    mock_client.sample_answers = AsyncMock(return_value=["x"])
    mock_client.predict_mutations = AsyncMock(return_value=[])
    mock_client.run_turn_tool = AsyncMock(return_value=(TurnOutput(
        heard=["x"], delta="", next_question="what now?", signal_mutations=[],
    ), {"input_tokens": 100, "cache_read_input_tokens": 50, "cache_creation_input_tokens": 0, "output_tokens": 30}))
    mock_client.recompile_probes_two_phase = AsyncMock(side_effect=slow_recompile)

    agent = KinnAgent(client=mock_client, memory=memory, probes=list(BOOTSTRAP_PROBES))
    await agent.turn("test")
    # Recompile is scheduled but not yet awaited
    await asyncio.wait_for(recompile_started.wait(), timeout=1)
    assert not recompile_done.is_set()
    # drain() must await it
    await agent.drain()
    assert recompile_done.is_set()


@pytest.mark.asyncio
async def test_turn_emits_bridge_when_all_retries_exhausted(memory):
    """If validation retries fail 3×, agent emits a bridge turn instead of crashing."""
    from pydantic import ValidationError

    def _real_validation_error():
        try:
            TurnOutput(heard=[], delta="", next_question="why? how?", signal_mutations=[])
        except ValidationError as e:
            return e
        raise RuntimeError("expected ValidationError to be raised")

    err = _real_validation_error()
    mock_client = AsyncMock()
    mock_client.sample_answers = AsyncMock(return_value=["x"])
    mock_client.predict_mutations = AsyncMock(return_value=[])
    mock_client.run_turn_tool = AsyncMock(side_effect=err)

    agent = KinnAgent(client=mock_client, memory=memory, probes=list(BOOTSTRAP_PROBES))
    out = await agent.turn("hi")
    assert "?" in out.next_question
    assert out.delta == "No image shift this turn."
    assert "tell me more" in out.next_question.lower() or "pressing" in out.next_question.lower()
    assert mock_client.run_turn_tool.await_count == 3  # MAX_VALIDATION_RETRIES + 1


@pytest.mark.asyncio
async def test_turn_rejects_duplicate_question(memory):
    """If next_question hashes to same as a prior question, retry once."""
    def _u(): return {"input_tokens": 100, "cache_read_input_tokens": 50, "cache_creation_input_tokens": 0, "output_tokens": 30}
    mock_client = AsyncMock()
    mock_client.sample_answers = AsyncMock(return_value=["x"])
    mock_client.predict_mutations = AsyncMock(return_value=[])
    mock_client.run_turn_tool = AsyncMock(side_effect=[
        (TurnOutput(heard=["x"], delta="", next_question="What hurts most?", signal_mutations=[]), _u()),
        (TurnOutput(heard=["x"], delta="", next_question="What hurts most?", signal_mutations=[]), _u()),  # dup
        (TurnOutput(heard=["x"], delta="", next_question="Who feels overloaded?", signal_mutations=[]), _u()),
    ])
    agent = KinnAgent(client=mock_client, memory=memory, probes=list(BOOTSTRAP_PROBES))
    out1 = await agent.turn("hi")
    out2 = await agent.turn("more")  # should retry away from "What hurts most?"
    assert out2.next_question != out1.next_question
