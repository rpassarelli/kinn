import os
import pytest
from kinn3.client import KinnClient
from kinn3.models import VSMBeliefState

pytestmark = pytest.mark.skipif(
    not (os.getenv("ANTHROPIC_API_KEY") and os.getenv("RUN_LIVE")),
    reason="live test — set ANTHROPIC_API_KEY and RUN_LIVE=1 to enable",
)

@pytest.mark.asyncio
async def test_sample_answers_returns_strings():
    c = KinnClient()
    answers = await c.sample_answers(
        probe_draft="What does your business do in one line?",
        belief_summary="Turn 0: all blocks empty",
        n=3,
    )
    assert len(answers) == 3
    assert all(isinstance(a, str) and len(a) > 0 for a in answers)
