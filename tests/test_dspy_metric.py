from kinn3.dspy_metric import calibration_metric
from kinn3.models import VSMBeliefState, BlockResolution
from kinn3.personas import load_persona


def test_metric_returns_composite_float():
    persona = load_persona("dental-clinic")
    belief = VSMBeliefState(turn=10)
    belief.blocks[1] = BlockResolution(resolution="mid", quotes=["dental clinic"], updated_turn=1)
    example = type("Ex", (), {"persona": persona})()
    pred = type("Pred", (), {"belief": belief, "transcript": "ok"})()
    score = calibration_metric(example, pred)
    assert 0.0 <= score <= 1.0
