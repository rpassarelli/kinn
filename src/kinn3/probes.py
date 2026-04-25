"""Canonical probe library — seeded from kinn2/design/vsm.md."""
from __future__ import annotations
from .models import Probe


BOOTSTRAP_PROBES: list[Probe] = [
    Probe(order=1, target_block=4, depth="identity",
          draft="What's been hurting most in the last month?"),
    Probe(order=2, target_block=1, depth="identity",
          draft="What does your business do, in one line?"),
    Probe(order=3, target_block=3, depth="identity",
          draft="Are you fighting to survive, to grow, or to pivot?"),
]


_CANONICAL = {
    1: [  # Market
        "Who are your customers — one line each?",
        "What would a customer never confuse you with?",
    ],
    2: [  # Purpose / S5
        "What is the one thing this organization must never do, even if profitable?",
        "If you were acquired tomorrow, what would have to stop for you to say 'that's not us'?",
    ],
    3: [  # Change Moment
        "What changed in the last 90 days that made today feel different?",
        "If nothing changes in the next 6 months, what breaks first?",
    ],
    4: [  # Algedonic
        "What keeps you up at night, specifically?",
        "Who is carrying a load right now that shouldn't be theirs?",
    ],
    5: [  # Vertical coherence
        "Where does the strategy say one thing and the calendar say another?",
        "Who knows the numbers? Who should?",
    ],
    6: [  # Horizontal viability
        "Which competitor worries you most and why?",
        "What outside signal would change your plan tomorrow?",
    ],
}


def canonical_probes_for_block(block: int, start_order: int = 100) -> list[Probe]:
    return [
        Probe(order=start_order + i, target_block=block, depth="dimension", draft=q)
        for i, q in enumerate(_CANONICAL[block])
    ]
