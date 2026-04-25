"""Session event log — JSONL append-only, kinn2.1 parity."""
from __future__ import annotations
import json
from datetime import datetime
from pathlib import Path
from typing import Any


class EventLog:
    def __init__(self, path: Path):
        self.path = Path(path)
        self.path.parent.mkdir(parents=True, exist_ok=True)

    def emit(self, *, actor: str, event: str, **fields: Any) -> None:
        rec = {"ts": datetime.utcnow().isoformat(), "actor": actor, "event": event, **fields}
        with self.path.open("a") as f:
            f.write(json.dumps(rec) + "\n")
