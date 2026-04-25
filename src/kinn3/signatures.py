"""DSPy signatures — typed pydantic outputs."""
from __future__ import annotations
import dspy
from pydantic import BaseModel, Field
from typing import Literal
from .models import SignalMutation


class ProbeProposal(BaseModel):
    """Slim probe proposal for DSPy output (full Probe model adds runtime fields).
    DSPy v3+ accepts plain pydantic BaseModels as typed output fields.
    """
    target_block: int = Field(ge=1, le=6)
    depth: Literal["identity", "dimension", "facet", "gap"]
    draft: str = Field(min_length=10, max_length=200)


class DiagnoseTurn(dspy.Signature):
    """Given belief state, pinned probe, and stakeholder message, emit Heard/Delta/Next plus quote-backed signal mutations."""
    belief_summary: str = dspy.InputField()
    probe_draft: str = dspy.InputField()
    user_message: str = dspy.InputField()
    heard: list[str] = dspy.OutputField(desc="3-5 quote-backed observations from stakeholder message")
    delta: str = dspy.OutputField(desc="'-> Block N: X -> Y' or 'No image shift this turn.'")
    next_question: str = dspy.OutputField(desc="Exactly one '?'. <=30 words.")
    signal_mutations: list[SignalMutation] = dspy.OutputField(
        desc="Quote-backed mutations: each has {block: 1-6, new_resolution: empty|low|mid|high, quote: str}"
    )


class RecompileProbes(dspy.Signature):
    """Given belief and transcript, propose 3-5 probes that maximize next-turn information gain."""
    belief_summary: str = dspy.InputField()
    transcript: str = dspy.InputField()
    probes: list[ProbeProposal] = dspy.OutputField(
        desc="3-5 probes, each {target_block: 1-6, depth: identity|dimension|facet|gap, draft: str (10-200 chars)}"
    )
