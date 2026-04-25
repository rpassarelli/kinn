# kinn3

BED-LLM reframe of kinn2's diagnostic interview engine. Single Opus 4.7 agent, extended thinking budgets, Memory tool state, DSPy-compiled prompts.

## Quickstart

```bash
cd /root/kinn2/kinn3
uv sync --all-extras
cp .env.example .env  # fill in ANTHROPIC_API_KEY
uv run pytest
uv run python -m kinn3.cli new-session "dental clinic in Porto"
```

See `docs/superpowers/plans/2026-04-24-kinn3-bed-llm-architecture.md` for the architecture.
