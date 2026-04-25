from kinn3.prompts import build_system_prompt, TURN_PROMPT_VERSION

def test_system_prompt_contains_vsm_model():
    p = build_system_prompt()
    assert "Viable System Model" in p or "VSM" in p
    assert "S5" in p  # at least one block name
    assert "empty" in p and "high" in p  # resolution levels

def test_system_prompt_has_stable_version():
    # Used for cache_control invalidation
    assert TURN_PROMPT_VERSION == "v1"

def test_system_prompt_is_cacheable_size():
    # Anthropic requires ≥1024 tokens for caching. Check by char proxy.
    p = build_system_prompt()
    assert len(p) > 4000, "System prompt should be substantial enough to benefit from caching"
