import pytest
from unittest.mock import AsyncMock
from kinn3.agent import KinnAgent
from kinn3.simulator import StakeholderSimulator
from kinn3.judge import score_session
from kinn3.personas import load_persona
from kinn3.probes import BOOTSTRAP_PROBES
from kinn3.models import VSMBeliefState, SignalMutation, TurnOutput


@pytest.mark.asyncio
async def test_end_to_end_one_persona_smoke(memory):
    # Deterministic mocks
    mc = AsyncMock()
    mc.sample_answers = AsyncMock(return_value=["x", "y", "z"])
    mc.predict_mutations = AsyncMock(return_value=[])
    mc.simulate_answer = AsyncMock(return_value="We're a family dental clinic. I'm tired.")
    mc.run_turn_tool = AsyncMock(side_effect=lambda **kw: (TurnOutput(
        heard=["tired"], delta="", next_question="What keeps you up at night?",
        signal_mutations=[SignalMutation(block=4, new_resolution="low", quote="I'm tired.")],
    ), {"input_tokens": 100, "cache_read_input_tokens": 50, "cache_creation_input_tokens": 0, "output_tokens": 30}))
    mc.recompile_probes_two_phase = AsyncMock(return_value=list(BOOTSTRAP_PROBES))

    persona = load_persona("dental-clinic")
    agent = KinnAgent(client=mc, memory=memory, probes=list(BOOTSTRAP_PROBES))
    sim = StakeholderSimulator(client=mc, persona=persona)

    for turn_n in range(1, 6):
        user_msg = await sim.respond(probe="bootstrap", turn=turn_n)
        await agent.turn(user_msg)

    belief = VSMBeliefState.model_validate_json(memory.read("belief_state"))
    transcript = memory.read("transcript")
    score = score_session(belief, transcript, persona)
    assert 0.0 <= score.composite <= 1.0
