"""Tool schemas for the Anthropic API — structured output by construction."""
from __future__ import annotations

EMIT_TURN_RESPONSE_TOOL = {
    "name": "emit_turn_response",
    "description": "Emit the Heard/Delta/Next response for this diagnostic turn plus any signal mutations. You MUST call this exactly once per turn.",
    "input_schema": {
        "type": "object",
        "required": ["heard", "delta", "next_question", "signal_mutations"],
        "additionalProperties": False,
        "properties": {
            "heard": {
                "type": "array",
                "items": {"type": "string", "minLength": 2},
                "minItems": 1, "maxItems": 5,
                "description": "3-5 short quote-backed observations from the stakeholder's message.",
            },
            "delta": {
                "type": "string",
                "description": "Image shift summary or exactly 'No image shift this turn.'",
            },
            "next_question": {
                "type": "string",
                "pattern": "^[^?]*\\?[^?]*$",  # exactly one ?
                "maxLength": 200,
                "description": "The probe. Exactly one '?'. ≤30 words.",
            },
            "signal_mutations": {
                "type": "array",
                "items": {
                    "type": "object",
                    "required": ["block", "new_resolution", "quote"],
                    "additionalProperties": False,
                    "properties": {
                        "block": {"type": "integer", "minimum": 1, "maximum": 6},
                        "new_resolution": {"enum": ["empty", "low", "mid", "high"]},
                        "quote": {"type": "string", "minLength": 3},
                    },
                },
            },
        },
    },
}
