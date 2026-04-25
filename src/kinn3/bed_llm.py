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


from typing import Protocol as _Protocol


class EIGClient(_Protocol):
    async def sample_answers(
        self, *, probe_draft: str, belief_summary: str, n: int
    ) -> list[str]: ...
    async def predict_mutations(
        self, *, probe_draft: str, answer: str, belief_summary: str
    ) -> list[SignalMutation]: ...


async def expected_information_gain(
    client: EIGClient,
    probe: Probe,
    belief: VSMBeliefState,
    n_samples: int = 6,
) -> float:
    """EIG(p) = H(B) - E_answer[H(B') | p]."""
    prior_h = belief.uncertainty_score()
    summary = _belief_summary(belief)
    answers = await client.sample_answers(
        probe_draft=probe.draft, belief_summary=summary, n=n_samples
    )
    if not answers:
        return 0.0
    posterior_entropies = []
    for ans in answers:
        muts = await client.predict_mutations(
            probe_draft=probe.draft, answer=ans, belief_summary=summary
        )
        new_b = update_belief(belief, muts, turn=belief.turn + 1)
        posterior_entropies.append(new_b.uncertainty_score())
    expected_posterior = sum(posterior_entropies) / len(posterior_entropies)
    return prior_h - expected_posterior


async def select_probe(
    client: EIGClient,
    probes: list[Probe],
    belief: VSMBeliefState,
    n_samples: int = 6,
) -> Probe:
    """argmax_p EIG(p) across pending probes."""
    pending = [p for p in probes if p.delivery_status == "pending"]
    if not pending:
        raise ValueError("no pending probes")
    scores = {}
    for p in pending:
        scores[p.order] = await expected_information_gain(
            client, p, belief, n_samples=n_samples
        )
    best_order = max(scores, key=scores.get)
    return next(p for p in pending if p.order == best_order)
