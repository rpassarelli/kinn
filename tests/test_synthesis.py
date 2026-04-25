from kinn3.synthesis import is_synthesis_ready, synthesis_close_output
from kinn3.models import VSMBeliefState, BlockResolution

def test_not_ready_with_some_low():
    b = VSMBeliefState()
    for i in range(1, 7):
        b.blocks[i] = BlockResolution(resolution="high" if i < 6 else "low", quotes=["x"] * 3)
    assert not is_synthesis_ready(b)

def test_ready_when_all_high():
    b = VSMBeliefState()
    for i in range(1, 7):
        b.blocks[i] = BlockResolution(resolution="high", quotes=["x"] * 3)
    assert is_synthesis_ready(b)

def test_synthesis_close_output_has_no_question():
    out = synthesis_close_output()
    assert "?" not in out.next_question or out.next_question.endswith("?")
    assert "thank" in out.heard[0].lower() or "wrap" in out.delta.lower() or "complete" in out.delta.lower()
