"""kinn3 data model — belief state, probes, outputs.

Note on uncertainty: `uncertainty_score()` is a resolution-level PROXY,
not a true Shannon entropy over hypothesis distributions. It maps each
block's discrete resolution (empty/low/mid/high) to a fixed scalar.
Use it as an ordinal signal for BED-LLM probe ranking, not as a
calibrated probability quantity.
"""
from __future__ import annotations
import math
from typing import Literal
from pydantic import BaseModel, Field, field_validator

Resolution = Literal["empty", "low", "mid", "high"]
Depth = Literal["identity", "dimension", "facet", "gap"]

# Per-resolution uncertainty weights. Higher = more uncertain.
# Chosen so that "empty" dominates and "high" contributes nothing.
_RESOLUTION_UNCERTAINTY = {"empty": math.log(4), "low": math.log(3), "mid": math.log(2), "high": 0.0}


class BlockResolution(BaseModel):
    """State of one VSM block."""
    resolution: Resolution = "empty"
    quotes: list[str] = Field(default_factory=list)
    updated_turn: int = 0


class VSMBeliefState(BaseModel):
    """Full 6-block VSM belief state."""
    blocks: dict[int, BlockResolution] = Field(
        default_factory=lambda: {i: BlockResolution() for i in range(1, 7)}
    )
    turn: int = 0

    def uncertainty_score(self) -> float:
        """Sum of per-block uncertainty proxy. Zero = fully resolved."""
        return sum(_RESOLUTION_UNCERTAINTY[b.resolution] for b in self.blocks.values())


class Probe(BaseModel):
    """A candidate question for the stakeholder."""
    order: int
    target_block: int = Field(ge=1, le=6)
    depth: Depth
    draft: str
    dependencies: list[int] = Field(default_factory=list)
    delivery_status: Literal["pending", "delivered", "answered", "skipped"] = "pending"
    delivered_at_turn: int | None = None
    answered_at_turn: int | None = None


class SignalMutation(BaseModel):
    """A proposed change to a block's resolution, backed by a quote."""
    block: int = Field(ge=1, le=6)
    new_resolution: Resolution
    quote: str


class TurnOutput(BaseModel):
    """Structured output from the agent for a single turn."""
    heard: list[str] = Field(max_length=5)
    delta: str
    next_question: str
    signal_mutations: list[SignalMutation] = Field(default_factory=list)

    @field_validator("next_question")
    @classmethod
    def exactly_one_question_mark(cls, v: str) -> str:
        if v.count("?") != 1:
            raise ValueError(f"next_question must have exactly one '?', got {v.count('?')}")
        if len(v.split()) > 30:
            raise ValueError(f"next_question must be ≤30 words, got {len(v.split())}")
        return v


class StakeholderState(BaseModel):
    """Stakeholder-as-system state (separate from Block 4 = org algedonic)."""
    fatigue: Literal["low", "medium", "heavy"] = "low"
    register: Literal["neutral", "guarded", "open", "overwhelmed"] = "neutral"
    rapport: Literal["cold", "warming", "warm"] = "cold"
    algedonic_personal_moments: list[dict] = Field(default_factory=list)
