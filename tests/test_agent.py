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
    mock_client.run_turn_tool = AsyncMock(return_value=TurnOutput(
        heard=["burnout noted"], delta="→ Block 4: empty → low",
        next_question="What keeps you up at night?",
        signal_mutations=[SignalMutation(block=4, new_resolution="low", quote="I'm exhausted")],
    ))

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
    err = _make_real_validation_error()
    # First two calls raise ValidationError, third succeeds
    mock_client.run_turn_tool = AsyncMock(side_effect=[err, err, valid])
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
    mock_client.run_turn_tool = AsyncMock(return_value=TurnOutput(
        heard=["ok"], delta="", next_question="What's next?", signal_mutations=[],
    ))
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
