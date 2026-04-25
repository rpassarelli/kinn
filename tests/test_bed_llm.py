"""Tests for BED-LLM probe selection (arxiv 2508.21184)."""
from __future__ import annotations
import pytest
from unittest.mock import AsyncMock
from kinn3.bed_llm import sample_plausible_answers
from kinn3.models import Probe, VSMBeliefState


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
