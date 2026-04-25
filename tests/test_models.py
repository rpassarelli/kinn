import pytest
from kinn3.models import VSMBeliefState, BlockResolution, Probe, Depth, SignalMutation

def test_belief_state_default_all_empty():
    belief = VSMBeliefState()
    for block_id in range(1, 7):
        assert belief.blocks[block_id].resolution == "empty"
        assert belief.blocks[block_id].quotes == []

def test_belief_state_uncertainty_all_empty_is_max():
    # 6 blocks × log(4) — note: this is a resolution-level proxy, NOT true Shannon entropy.
    import math
    belief = VSMBeliefState()
    assert abs(belief.uncertainty_score() - 6 * math.log(4)) < 1e-6

def test_belief_state_uncertainty_all_high_is_zero():
    belief = VSMBeliefState()
    for b in belief.blocks.values():
        b.resolution = "high"
        b.quotes = ["q1", "q2", "q3"]
    assert belief.uncertainty_score() == 0.0

def test_probe_fields_required():
    p = Probe(order=1, target_block=4, depth="identity", draft="What hurts most?")
    assert p.order == 1
    assert p.target_block == 4

def test_signal_mutation_validates_block_range():
    with pytest.raises(ValueError):
        SignalMutation(block=7, new_resolution="low", quote="x")
