from kinn3.invariants import load_invariants, check_turn_output
from kinn3.models import TurnOutput, SignalMutation

def test_load_invariants_returns_eleven():
    invs = load_invariants()
    assert len(invs) >= 11
    assert any(i["id"] == "role_separation" for i in invs)

def test_check_turn_output_rejects_multiple_question_marks():
    # Pydantic catches at construction; we verify it raises
    import pytest
    from pydantic import ValidationError
    with pytest.raises(ValidationError):
        TurnOutput(heard=["x"], delta="y", next_question="Why? How?")

def test_check_turn_output_accepts_valid():
    out = TurnOutput(
        heard=["burnout noted", "8 staff"],
        delta="→ Block 4 empty → low",
        next_question="What's been hurting most in the last month?",
        signal_mutations=[SignalMutation(block=4, new_resolution="low", quote="I'm tired.")],
    )
    errors = check_turn_output(out)
    assert errors == []
