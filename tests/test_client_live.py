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


@pytest.mark.asyncio
async def test_prompt_cache_hits_after_first_call():
    """Three sequential calls with same large system prompt → cache write on call 1, reads on 2-3.
    Uses a UUID-prefixed prompt so call 1 is always a cold-write regardless of prior runs (5-min TTL).
    """
    import uuid
    c = KinnClient()
    # UUID prefix guarantees this prompt has never been cached before.
    unique = uuid.uuid4().hex
    long_system = f"kinn3 cache test {unique}. " + ("system prompt body. " * 400)  # >1024 tokens
    tool = {
        "name": "echo",
        "description": "echo a value",
        "input_schema": {
            "type": "object", "required": ["value"],
            "properties": {"value": {"type": "string"}},
        },
    }

    cache_writes = []
    cache_reads = []
    for i in range(3):
        msg = await c.raw.messages.create(
            model=c.model,
            max_tokens=64,
            system=c._cached_system(long_system),
            tools=[tool],
            tool_choice={"type": "tool", "name": "echo"},
            messages=[{"role": "user", "content": f"Call number {i}, echo 'ok'"}],
        )
        cache_writes.append(getattr(msg.usage, "cache_creation_input_tokens", 0) or 0)
        cache_reads.append(getattr(msg.usage, "cache_read_input_tokens", 0) or 0)

    # Call 1: cache WRITE (large), no read. Calls 2-3: cache READ (large).
    assert cache_writes[0] > 0, f"Call 1 expected cache write, got writes={cache_writes}"
    assert cache_reads[1] > 0, f"Call 2 expected cache hit, got reads={cache_reads}"
    assert cache_reads[2] > 0, f"Call 3 expected cache hit, got reads={cache_reads}"
