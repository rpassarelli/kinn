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
