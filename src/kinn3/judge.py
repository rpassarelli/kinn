"""Calibration scoring — semantic-similarity rubric.

Uses sentence-transformers/all-MiniLM-L6-v2 (80MB, lazy-loaded) for:
- _soft_checks: cosine similarity between transcript voice and persona voice baseline
- _truth_convergence: cosine similarity between belief quotes and persona ground truth
"""
from __future__ import annotations
from functools import lru_cache
import numpy as np
from pydantic import BaseModel
from .models import VSMBeliefState
from .personas import Persona


class SessionScore(BaseModel):
    composite: float
    hard_mean: float
    soft_mean: float
    truth_convergence: float
    coverage_gain: float
    coverage_at_low: int
    coverage_at_mid: int


@lru_cache(maxsize=1)
def _embedder():
    """Lazy-loaded embedding model. ~80MB download on first call."""
    from sentence_transformers import SentenceTransformer
    return SentenceTransformer("sentence-transformers/all-MiniLM-L6-v2")


def _cosine(a: np.ndarray, b: np.ndarray) -> float:
    na = np.linalg.norm(a)
    nb = np.linalg.norm(b)
    if na == 0 or nb == 0:
        return 0.0
    return float(np.dot(a, b) / (na * nb))


def _embed(text: str) -> np.ndarray:
    return _embedder().encode(text, convert_to_numpy=True, normalize_embeddings=True)


def score_session(
    belief: VSMBeliefState, transcript: str, persona: Persona
) -> SessionScore:
    hard = _hard_checks(belief, transcript)
    soft = _soft_checks(transcript, persona)
    truth = _truth_convergence(belief, persona)
    cov_low = sum(1 for b in belief.blocks.values() if b.resolution in ("low", "mid", "high"))
    cov_mid = sum(1 for b in belief.blocks.values() if b.resolution in ("mid", "high"))
    coverage_gain = cov_low / 6.0

    composite = 0.40 * hard + 0.20 * soft + 0.25 * truth + 0.15 * coverage_gain
    return SessionScore(
        composite=composite, hard_mean=hard, soft_mean=soft,
        truth_convergence=truth, coverage_gain=coverage_gain,
        coverage_at_low=cov_low, coverage_at_mid=cov_mid,
    )


def _hard_checks(belief: VSMBeliefState, transcript: str) -> float:
    """Every non-empty block must have at least one quote."""
    checks = [1.0 if (b.resolution == "empty" or b.quotes) else 0.0
              for b in belief.blocks.values()]
    return sum(checks) / len(checks) if checks else 0.0


def _soft_checks(transcript: str, persona: Persona) -> float:
    """Cosine similarity between transcript voice and persona's described baseline voice."""
    if not transcript.strip():
        return 0.0
    snippet = transcript[-3000:]
    persona_voice_signal = persona.raw_markdown[:2000]
    sim = _cosine(_embed(snippet), _embed(persona_voice_signal))
    return max(0.0, (sim + 1) / 2)


def _truth_convergence(belief: VSMBeliefState, persona: Persona) -> float:
    """Cosine similarity between aggregated belief quotes and persona ground truth."""
    parts = []
    if persona.ground_truth_primary_service:
        b1_text = " ".join(belief.blocks[1].quotes) or "(empty)"
        parts.append(_cosine(_embed(b1_text), _embed(persona.ground_truth_primary_service)))
    if persona.ground_truth_market:
        b1_text = " ".join(belief.blocks[1].quotes) or "(empty)"
        parts.append(_cosine(_embed(b1_text), _embed(persona.ground_truth_market)))
    if persona.ground_truth_change_moment:
        b3_text = " ".join(belief.blocks[3].quotes) or "(empty)"
        parts.append(_cosine(_embed(b3_text), _embed(persona.ground_truth_change_moment)))
    if not parts:
        return 0.0
    avg = sum(parts) / len(parts)
    return max(0.0, (avg + 1) / 2)
