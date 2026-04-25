from kinn3.signatures import DiagnoseTurn, RecompileProbes


def test_diagnose_turn_signature_has_required_fields():
    sig = DiagnoseTurn
    assert "belief_summary" in sig.input_fields
    assert "next_question" in sig.output_fields


def test_recompile_signature_has_probe_slate_output():
    sig = RecompileProbes
    assert "probes" in sig.output_fields
