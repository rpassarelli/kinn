"""Tests for BED-LLM probe selection (arxiv 2508.21184)."""
from __future__ import annotations
import pytest
from unittest.mock import AsyncMock
from kinn3.bed_llm import sample_plausible_answers, update_belief
from kinn3.models import Probe, VSMBeliefState, SignalMutation


@pytest.mark.asyncio
async def test_sample_plausible_answers_returns_n_strings(empty_belief):
    mock_client = AsyncMock()
    mock_client.sample_answers = AsyncMock(return_value=[
        "We run a dental clinic.",
        "Family dental practice in Porto.",
        "Dental clinic, 8 staff.",
    ])
    probe = Probe(order=1, target_block=1, depth="identity",
                  draft="What does your business do in one line?")

    answers = await sample_plausible_answers(mock_client, probe, empty_belief, n=3)
    assert len(answers) == 3
    assert all(isinstance(a, str) for a in answers)


def test_update_belief_applies_mutation(empty_belief):
    muts = [SignalMutation(block=4, new_resolution="low", quote="I'm exhausted.")]
    new_belief = update_belief(empty_belief, muts, turn=1)
    assert new_belief.blocks[4].resolution == "low"
    assert "I'm exhausted." in new_belief.blocks[4].quotes
    assert new_belief.blocks[4].updated_turn == 1


def test_update_belief_preserves_untouched_blocks(partial_belief):
    muts = [SignalMutation(block=4, new_resolution="mid", quote="It's been months.")]
    new_belief = update_belief(partial_belief, muts, turn=4)
    assert new_belief.blocks[1].resolution == "mid"  # untouched
    assert new_belief.blocks[4].resolution == "mid"


def test_update_belief_uncertainty_decreases_on_promotion(empty_belief):
    prior = empty_belief.uncertainty_score()
    muts = [SignalMutation(block=1, new_resolution="low", quote="Family dental clinic.")]
    posterior = update_belief(empty_belief, muts, turn=1).uncertainty_score()
    assert posterior < prior


from kinn3.bed_llm import expected_information_gain, select_probe


@pytest.mark.asyncio
async def test_eig_is_nonneg(empty_belief, bootstrap_probes):
    mock = AsyncMock()
    mock.sample_answers = AsyncMock(return_value=[
        "Dental clinic.", "Manufacturing.", "E-commerce.",
    ])
    mock.predict_mutations = AsyncMock(side_effect=[
        [SignalMutation(block=1, new_resolution="low", quote="Dental clinic.")],
        [SignalMutation(block=1, new_resolution="low", quote="Manufacturing.")],
        [SignalMutation(block=1, new_resolution="low", quote="E-commerce.")],
    ])
    eig = await expected_information_gain(
        mock, bootstrap_probes[1], empty_belief, n_samples=3
    )
    assert eig >= 0


@pytest.mark.asyncio
async def test_select_probe_picks_highest_eig(empty_belief, bootstrap_probes):
    mock = AsyncMock()
    def sample_for(probe_draft, **kw):
        if "hurting" in probe_draft:
            return ["burnout", "tired", "overwhelmed"]
        return ["dental", "dental", "dental"]
    mock.sample_answers = AsyncMock(side_effect=lambda **kw: sample_for(**kw))

    def mutations_for(answer, **kw):
        if answer in ("burnout", "tired", "overwhelmed"):
            return [SignalMutation(block=4, new_resolution="mid", quote=answer)]
        return [SignalMutation(block=1, new_resolution="low", quote=answer)]
    mock.predict_mutations = AsyncMock(side_effect=lambda **kw: mutations_for(**kw))

    chosen = await select_probe(mock, bootstrap_probes, empty_belief, n_samples=3)
    assert chosen.target_block == 4  # higher EIG
