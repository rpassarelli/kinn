"""Synthesis close: end-of-session summary when all 6 blocks reach high resolution."""
from __future__ import annotations
from .models import VSMBeliefState, TurnOutput


def is_synthesis_ready(belief: VSMBeliefState) -> bool:
    return all(b.resolution == "high" for b in belief.blocks.values())


def synthesis_close_output() -> TurnOutput:
    return TurnOutput(
        heard=["Thank you — I've got a clear picture across all six blocks now."],
        delta="All blocks at high resolution — synthesis ready.",
        next_question="Anything I missed before we wrap?",
        signal_mutations=[],
    )
