from kinn3.models import StakeholderState


def test_stakeholder_state_defaults_calm():
    s = StakeholderState()
    assert s.fatigue == "low"
    assert s.register == "neutral"
    assert s.algedonic_personal_moments == []


def test_stakeholder_state_can_record_algedonic_moment():
    s = StakeholderState()
    s.algedonic_personal_moments.append({"turn": 3, "quote": "I'm exhausted"})
    assert len(s.algedonic_personal_moments) == 1
