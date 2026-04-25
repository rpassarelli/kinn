import pytest
from kinn3.judge import score_session, _embedder
from kinn3.models import VSMBeliefState, BlockResolution
from kinn3.personas import load_persona


def test_score_session_returns_composite_between_0_and_1():
    persona = load_persona("dental-clinic")
    belief = VSMBeliefState(turn=10)
    belief.blocks[1] = BlockResolution(resolution="mid", quotes=["family dental clinic in Matosinhos"], updated_turn=2)
    belief.blocks[4] = BlockResolution(resolution="high",
        quotes=["I'm tired", "burnout for months", "I haven't slept right"], updated_turn=5)
    transcript = "turn 1: hello\nturn 10: yes"
    score = score_session(belief, transcript, persona)
    assert 0.0 <= score.composite <= 1.0
    assert score.coverage_at_low >= 2


def test_truth_convergence_rewards_semantic_match():
    """Embedding similarity should reward 'family dentistry' even when persona says 'family + pediatric dentistry'."""
    persona = load_persona("dental-clinic")
    high_match = VSMBeliefState()
    high_match.blocks[1] = BlockResolution(resolution="high",
        quotes=["family and pediatric dentistry serving working-class families in Matosinhos"])
    low_match = VSMBeliefState()
    low_match.blocks[1] = BlockResolution(resolution="high",
        quotes=["enterprise SaaS for fortune 500 companies"])

    s_high = score_session(high_match, "transcript", persona)
    s_low = score_session(low_match, "transcript", persona)
    assert s_high.truth_convergence > s_low.truth_convergence


def test_embedder_cached():
    """Embedder should be a singleton — loaded once."""
    e1 = _embedder()
    e2 = _embedder()
    assert e1 is e2
