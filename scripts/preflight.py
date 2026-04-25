"""kinn3 preflight: validate four load-bearing API assumptions before building.

Assumptions checked:
  A1: tool_choice={"type":"tool",...} + thinking=enabled → API rejects (HTTP 400).
  A2: cache_control={"type":"ephemeral"} on system block → counters appear on call 1 + read on call 2.
  A3: claude-opus-4-7 model ID resolves (no 404).
  A4: thinking=enabled (no tools) → response includes a text block.

Exit 0 = all assumptions hold. Exit non-zero = abort plan, fix assumptions first.
Cost: ~$0.05.
"""
from __future__ import annotations
import asyncio
import os
import sys
from dotenv import load_dotenv
from anthropic import AsyncAnthropic, BadRequestError, NotFoundError


MODEL = os.environ.get("KINN3_MODEL", "claude-opus-4-7")


async def assertion_A1_tool_choice_thinking_rejected(client: AsyncAnthropic) -> str:
    """Forced tool_choice + thinking should 400. If accepted, our two-primitive design is over-engineered."""
    try:
        await client.messages.create(
            model=MODEL,
            max_tokens=128,
            thinking={"type": "enabled", "budget_tokens": 1024},
            tools=[{
                "name": "noop", "description": "noop",
                "input_schema": {"type": "object", "properties": {}},
            }],
            tool_choice={"type": "tool", "name": "noop"},
            messages=[{"role": "user", "content": "test"}],
        )
        return "FAIL: API accepted forced tool_choice + thinking — Tasks 8/17/18 may be over-engineered"
    except BadRequestError as e:
        msg = str(e)
        if "thinking" in msg.lower() or "tool_choice" in msg.lower():
            return "PASS"
        return f"AMBIGUOUS: 400 returned but message unclear: {msg[:200]}"


async def assertion_A2_cache_control_accepted(client: AsyncAnthropic) -> str:
    """cache_control: ephemeral on system block must be accepted AND produce cache counters.

    Without observable cache_creation/cache_read counters, the API is silently ignoring our
    cache_control marker — caching is broken and cost story is invalid. We do TWO calls to
    force a cache write on the first and a cache read on the second.
    """
    long_text = "kinn3 preflight system block validation. " * 400  # >1024 tokens
    system = [{"type": "text", "text": long_text, "cache_control": {"type": "ephemeral"}}]
    try:
        msg1 = await client.messages.create(
            model=MODEL, max_tokens=32,
            system=system,
            messages=[{"role": "user", "content": "say 'ok'"}],
        )
        msg2 = await client.messages.create(
            model=MODEL, max_tokens=32,
            system=system,
            messages=[{"role": "user", "content": "say 'ok' again"}],
        )
    except BadRequestError as e:
        return f"FAIL: cache_control rejected: {str(e)[:200]}"

    write1 = getattr(msg1.usage, "cache_creation_input_tokens", 0) or 0
    read2 = getattr(msg2.usage, "cache_read_input_tokens", 0) or 0
    if write1 > 0 and read2 > 0:
        return f"PASS (write={write1} read2={read2})"
    return (f"FAIL: cache markers absent (write1={write1}, read2={read2}) — "
            f"prompt may be too short, or API is silently ignoring cache_control")


async def assertion_A3_model_id_resolves(client: AsyncAnthropic) -> str:
    """claude-opus-4-7 should resolve. If 404, model has been renamed/retired."""
    try:
        await client.messages.create(
            model=MODEL, max_tokens=16,
            messages=[{"role": "user", "content": "ok"}],
        )
        return "PASS"
    except NotFoundError as e:
        return f"FAIL: model {MODEL} not found: {str(e)[:200]}"


async def assertion_A4_thinking_returns_text(client: AsyncAnthropic) -> str:
    """thinking + no tools should return at least one text block."""
    msg = await client.messages.create(
        model=MODEL, max_tokens=512,
        thinking={"type": "enabled", "budget_tokens": 1024},
        messages=[{"role": "user", "content": "What is 2+2? Answer in one sentence."}],
    )
    text_blocks = [b for b in msg.content if getattr(b, "type", None) == "text"]
    if not text_blocks or not any(b.text.strip() for b in text_blocks):
        return "FAIL: thinking-enabled response had no usable text block"
    return "PASS"


async def main() -> int:
    load_dotenv()
    api_key = os.environ.get("ANTHROPIC_API_KEY")
    if not api_key or not api_key.startswith("sk-ant-"):
        print("FATAL: ANTHROPIC_API_KEY missing or malformed in .env", file=sys.stderr)
        return 2
    client = AsyncAnthropic(api_key=api_key)
    checks = [
        ("A1 (tool_choice + thinking rejected)", assertion_A1_tool_choice_thinking_rejected),
        ("A2 (cache_control: ephemeral)", assertion_A2_cache_control_accepted),
        ("A3 (model ID resolves)", assertion_A3_model_id_resolves),
        ("A4 (thinking returns text)", assertion_A4_thinking_returns_text),
    ]
    failed = 0
    for name, fn in checks:
        result = await fn(client)
        marker = "PASS" if result.startswith("PASS") else "FAIL"
        print(f"  [{marker}] {name}: {result}")
        if not result.startswith("PASS"):
            failed += 1
    print(f"\n{4 - failed}/4 assumptions hold.")
    if failed:
        print("ABORT plan: rewrite affected tasks before continuing.", file=sys.stderr)
        return 1
    print("OK to proceed with Task 2.")
    return 0


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
