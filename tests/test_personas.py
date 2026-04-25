from kinn3.personas import list_personas, load_persona

def test_list_personas_finds_five():
    ids = list_personas()
    assert set(ids) == {
        "dental-clinic", "shinpads-ecommerce",
        "family-manufacturing", "solo-agency", "racks-reseller",
    }

def test_load_dental_clinic_has_ground_truth():
    p = load_persona("dental-clinic")
    assert p.id == "dental-clinic"
    assert "Matosinhos" in p.raw_markdown
    assert p.ground_truth_primary_service  # parsed out
