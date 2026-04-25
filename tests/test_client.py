from unittest.mock import AsyncMock, MagicMock, patch
import pytest
from kinn3.client import KinnClient


def test_client_builds_cached_system_blocks():
    c = KinnClient(api_key="fake")
    blocks = c._cached_system("You are a diagnostic agent.")
    assert blocks[0]["type"] == "text"
    assert blocks[0]["cache_control"] == {"type": "ephemeral"}
    assert blocks[0]["text"].startswith("You are a diagnostic agent.")


def test_client_thinking_opts_shape():
    c = KinnClient(api_key="fake")
    # opus-4-7 uses adaptive thinking; budget arg is accepted for API compat but ignored.
    # (See plan v9 changelog — API drift discovered in Task 1.5 preflight.)
    assert c._thinking_opts(2000) == {"type": "adaptive"}


@pytest.mark.asyncio
async def test_forced_tool_call_does_not_pass_thinking_param():
    """Critical: forced tool_choice + thinking is rejected by API. Our wrapper must omit thinking."""
    c = KinnClient(api_key="fake")
    c.raw = AsyncMock()
    fake_block = MagicMock(type="tool_use", name="my_tool", input={"x": 1})
    fake_msg = MagicMock(content=[fake_block])
    c.raw.messages.create = AsyncMock(return_value=fake_msg)

    await c.forced_tool_call(
        system="sys", user_content="hi",
        tool={"name": "my_tool", "input_schema": {"type": "object"}},
    )
    kwargs = c.raw.messages.create.await_args.kwargs
    assert "thinking" not in kwargs, "forced_tool_call must NOT include thinking parameter"
    assert kwargs["tool_choice"] == {"type": "tool", "name": "my_tool"}


@pytest.mark.asyncio
async def test_thinking_text_call_passes_thinking_no_tools():
    c = KinnClient(api_key="fake")
    c.raw = AsyncMock()
    fake_block = MagicMock(type="text", text="reasoning here")
    fake_msg = MagicMock(content=[fake_block])
    c.raw.messages.create = AsyncMock(return_value=fake_msg)

    text = await c.thinking_text_call(system="sys", user_content="ponder", thinking_budget=24000)
    kwargs = c.raw.messages.create.await_args.kwargs
    assert kwargs["thinking"] == {"type": "adaptive"}  # opus-4-7 API; budget arg deferred to v0.1
    assert "tools" not in kwargs or kwargs["tools"] in (None, [])
    assert "reasoning" in text


import asyncio
from unittest.mock import AsyncMock, MagicMock
from anthropic import RateLimitError, AuthenticationError, InternalServerError, APITimeoutError
from kinn3.client import _with_retries


def _make_rate_limit():
    return RateLimitError(message="rate limited", response=MagicMock(status_code=429), body=None)


def _make_server_error():
    return InternalServerError(message="server error", response=MagicMock(status_code=500), body=None)


def _make_auth_error():
    return AuthenticationError(message="bad key", response=MagicMock(status_code=401), body=None)


@pytest.mark.asyncio
async def test_with_retries_succeeds_after_one_429(monkeypatch):
    monkeypatch.setattr(asyncio, "sleep", AsyncMock())  # speed up
    call = AsyncMock(side_effect=[_make_rate_limit(), "ok"])
    result = await _with_retries(call)
    assert result == "ok"
    assert call.await_count == 2


@pytest.mark.asyncio
async def test_with_retries_fails_loud_on_auth(monkeypatch):
    monkeypatch.setattr(asyncio, "sleep", AsyncMock())
    call = AsyncMock(side_effect=_make_auth_error())
    with pytest.raises(AuthenticationError):
        await _with_retries(call)
    assert call.await_count == 1  # no retry


@pytest.mark.asyncio
async def test_with_retries_exhausts_5xx_after_3(monkeypatch):
    monkeypatch.setattr(asyncio, "sleep", AsyncMock())
    call = AsyncMock(side_effect=[_make_server_error()] * 5)
    with pytest.raises(InternalServerError):
        await _with_retries(call)
    assert call.await_count == 4  # 1 initial + 3 retries


def _make_overloaded():
    """Construct OverloadedError (529). It inherits APIStatusError directly,
    NOT InternalServerError — separate retry bucket per kinn3 retry policy."""
    from anthropic._exceptions import OverloadedError
    return OverloadedError(message="overloaded", response=MagicMock(status_code=529), body=None)


@pytest.mark.asyncio
async def test_with_retries_recovers_after_one_529(monkeypatch):
    """OverloadedError (529) should be caught and retried (5 retries with longer backoff)."""
    monkeypatch.setattr(asyncio, "sleep", AsyncMock())
    call = AsyncMock(side_effect=[_make_overloaded(), "ok"])
    result = await _with_retries(call)
    assert result == "ok"
    assert call.await_count == 2


@pytest.mark.asyncio
async def test_with_retries_exhausts_529_after_5(monkeypatch):
    """After 5 consecutive 529s, raise — Anthropic isn't recovering, fail loud."""
    monkeypatch.setattr(asyncio, "sleep", AsyncMock())
    from anthropic import APIStatusError
    call = AsyncMock(side_effect=[_make_overloaded()] * 8)
    with pytest.raises(APIStatusError) as exc_info:
        await _with_retries(call)
    assert exc_info.value.status_code == 529
    assert call.await_count == 6  # 1 initial + 5 retries
