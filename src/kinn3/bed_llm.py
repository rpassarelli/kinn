"""BED-LLM: Bayesian Experimental Design over candidate probes.

Reference: BED-LLM (arxiv 2508.21184) — pick probe that maximizes expected
information gain (EIG) about the latent belief state.
"""
from __future__ import annotations
from typing import Protocol
from .models import Probe, VSMBeliefState


class AnswerSampler(Protocol):
    async def sample_answers(
        self, *, probe_draft: str, belief_summary: str, n: int
    ) -> list[str]: ...


async def sample_plausible_answers(
    client: AnswerSampler,
    probe: Probe,
    belief: VSMBeliefState,
    n: int = 6,
) -> list[str]:
    """Ask the LLM to predict N plausible stakeholder answers."""
    summary = _belief_summary(belief)
    return await client.sample_answers(
        probe_draft=probe.draft, belief_summary=summary, n=n
    )


def _belief_summary(b: VSMBeliefState) -> str:
    lines = [f"Turn {b.turn}:"]
    for block_id, block in sorted(b.blocks.items()):
        q = "; ".join(block.quotes[:2]) if block.quotes else "(no quotes)"
        lines.append(f"  Block {block_id}: {block.resolution} — {q}")
    return "\n".join(lines)


from .models import SignalMutation


def update_belief(
    belief: VSMBeliefState,
    mutations: list[SignalMutation],
    turn: int,
) -> VSMBeliefState:
    """Apply mutations to produce a new belief state. Pure function."""
    new = belief.model_copy(deep=True)
    new.turn = turn
    for m in mutations:
        block = new.blocks[m.block]
        block.resolution = m.new_resolution
        if m.quote and m.quote not in block.quotes:
            block.quotes.append(m.quote)
        block.updated_turn = turn
    return new
