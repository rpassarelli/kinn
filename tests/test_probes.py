from kinn3.probes import BOOTSTRAP_PROBES, canonical_probes_for_block

def test_bootstrap_covers_three_identity_blocks():
    assert len(BOOTSTRAP_PROBES) == 3
    assert {p.target_block for p in BOOTSTRAP_PROBES} == {1, 3, 4}
    assert all(p.depth == "identity" for p in BOOTSTRAP_PROBES)

def test_canonical_probes_per_block_nonempty():
    for b in range(1, 7):
        probes = canonical_probes_for_block(b)
        assert len(probes) >= 2
