import json
import jsonschema
from kinn3.tools import EMIT_TURN_RESPONSE_TOOL

def test_emit_turn_response_schema_validates_sample():
    sample = {
        "heard": ["burnout", "8 staff"],
        "delta": "→ Block 4: empty → low",
        "next_question": "What does a typical week look like for you right now?",
        "signal_mutations": [
            {"block": 4, "new_resolution": "low", "quote": "I'm tired."}
        ],
    }
    jsonschema.validate(sample, EMIT_TURN_RESPONSE_TOOL["input_schema"])

def test_emit_turn_response_rejects_multiple_question_marks():
    import pytest
    bad = {
        "heard": ["x"], "delta": "y",
        "next_question": "Why? How?",
        "signal_mutations": [],
    }
    with pytest.raises(jsonschema.ValidationError):
        jsonschema.validate(bad, EMIT_TURN_RESPONSE_TOOL["input_schema"])
