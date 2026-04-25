"""Per-session metrics: tokens, cost, wall-clock latency.
Persists per-call records to a costs.jsonl ledger for cross-session aggregation.
"""
from __future__ import annotations
import json
import time
from dataclasses import dataclass, field
from datetime import datetime
from pathlib import Path

# Pricing per 1M tokens (Opus 4.7).
_PRICING = {
    "input_per_M": 15.0,
    "cache_read_per_M": 1.5,        # 0.1x base
    "cache_write_per_M": 18.75,     # 1.25x base
    "output_per_M": 75.0,
}


@dataclass
class TurnMetrics:
    turn_n: int
    wall_clock_s: float
    input_tokens: int = 0
    cached_input_tokens: int = 0       # cache READ tokens
    cache_creation_tokens: int = 0     # cache WRITE tokens
    output_tokens: int = 0

    @property
    def cost_usd(self) -> float:
        # Anthropic's `input_tokens` ALREADY EXCLUDES cached portions — don't double-subtract.
        # The four token categories are mutually exclusive; sum them at their respective prices.
        return (
            self.input_tokens * _PRICING["input_per_M"] / 1_000_000
            + self.cached_input_tokens * _PRICING["cache_read_per_M"] / 1_000_000
            + self.cache_creation_tokens * _PRICING["cache_write_per_M"] / 1_000_000
            + self.output_tokens * _PRICING["output_per_M"] / 1_000_000
        )


@dataclass
class SessionMetrics:
    turns: list[TurnMetrics] = field(default_factory=list)
    ledger_path: Path | None = None

    def record(self, turn_n: int, wall_clock_s: float, usage: dict, session_id: str = "") -> None:
        m = TurnMetrics(
            turn_n=turn_n,
            wall_clock_s=wall_clock_s,
            input_tokens=usage.get("input_tokens", 0),
            cached_input_tokens=usage.get("cache_read_input_tokens", 0),
            cache_creation_tokens=usage.get("cache_creation_input_tokens", 0),
            output_tokens=usage.get("output_tokens", 0),
        )
        self.turns.append(m)
        if self.ledger_path:
            self._append_ledger(m, session_id)

    def _append_ledger(self, m: TurnMetrics, session_id: str) -> None:
        self.ledger_path.parent.mkdir(parents=True, exist_ok=True)
        rec = {
            "ts": datetime.utcnow().isoformat(),
            "session_id": session_id,
            "turn": m.turn_n,
            "wall_s": round(m.wall_clock_s, 3),
            "input_tokens": m.input_tokens,
            "cache_read_tokens": m.cached_input_tokens,
            "cache_create_tokens": m.cache_creation_tokens,
            "output_tokens": m.output_tokens,
            "cost_usd": round(m.cost_usd, 6),
        }
        with self.ledger_path.open("a") as f:
            f.write(json.dumps(rec) + "\n")

    @property
    def total_cost_usd(self) -> float:
        return sum(t.cost_usd for t in self.turns)

    @property
    def mean_latency_s(self) -> float:
        if not self.turns:
            return 0.0
        return sum(t.wall_clock_s for t in self.turns) / len(self.turns)


def aggregate_ledger(ledger_path: Path) -> dict:
    """Sum costs across all sessions in a costs.jsonl file."""
    if not ledger_path.exists():
        return {"total_usd": 0.0, "n_calls": 0, "n_sessions": 0}
    sessions: set[str] = set()
    total = 0.0
    n_calls = 0
    with ledger_path.open() as f:
        for line in f:
            rec = json.loads(line)
            total += rec["cost_usd"]
            n_calls += 1
            if rec.get("session_id"):
                sessions.add(rec["session_id"])
    return {"total_usd": round(total, 4), "n_calls": n_calls, "n_sessions": len(sessions)}
