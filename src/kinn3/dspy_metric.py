"""DSPy-compatible metric for GEPA optimization."""
from __future__ import annotations
from .judge import score_session


def calibration_metric(example, pred, trace=None) -> float:
    """example.persona, pred.belief, pred.transcript -> composite score."""
    return score_session(pred.belief, pred.transcript, example.persona).composite
