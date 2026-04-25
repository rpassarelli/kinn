"""Reground trigger — detects stakeholder fatigue and emits 3-beat reground turn."""
from __future__ import annotations
import re
from .models import TurnOutput


_FATIGUE_PATTERNS = [
    # English
    r"\bi don'?t know\b", r"\.\.\.", r"\bcan'?t\b", r"\bi'?m tired\b",
    r"\bno idea\b", r"\bskip\b", r"\bi guess\b", r"\bwhatever\b",
    # Portuguese
    r"\bnão sei\b", r"\bnão consigo\b", r"\bestá tudo um caos\b",
    r"\bestou cansad[oa]\b", r"\bnem sei\b", r"\btanto faz\b",
]


def _last_user_messages(transcript: str, n: int = 3) -> list[str]:
    msgs = re.findall(r"USER: (.+)", transcript)
    return msgs[-n:]


def detect_fatigue(transcript: str) -> bool:
    last = _last_user_messages(transcript, n=3)
    if len(last) < 2:
        return False
    avg_len = sum(len(m) for m in last) / len(last)
    if avg_len > 60:
        return False
    joined = "\n".join(last).lower()
    return any(re.search(p, joined) for p in _FATIGUE_PATTERNS)


def reground_output() -> TurnOutput:
    return TurnOutput(
        heard=["I hear you — this is a lot to hold at once."],
        delta="No image shift this turn.",
        next_question="Want to step back and tell me what's actually weighing on you most right now?",
        signal_mutations=[],
    )
