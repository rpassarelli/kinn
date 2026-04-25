"""Load kinn2 invariants and run post-hoc checks on turn output."""
from __future__ import annotations
from pathlib import Path
import yaml
from .models import TurnOutput

_INVARIANTS_PATH = Path(__file__).resolve().parents[3] / "calibration" / "invariants.yml"


def load_invariants() -> list[dict]:
    data = yaml.safe_load(_INVARIANTS_PATH.read_text())
    return data["invariants"]


def check_turn_output(out: TurnOutput) -> list[str]:
    """Return list of invariant-violation descriptions. Empty = clean."""
    errs: list[str] = []
    # Gate 1 (one ?) and Gate 2 (≤30 words) enforced by pydantic validator.
    # Remaining runtime checks:
    if not out.heard:
        errs.append("heard must contain at least 1 item")
    if any(m.new_resolution == "high" and len(m.quote) < 10 for m in out.signal_mutations):
        errs.append("high-resolution promotion requires a substantive quote")
    return errs
