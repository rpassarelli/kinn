"""Load kinn2 calibration personas from parent repo."""
from __future__ import annotations
from pathlib import Path
import re
import yaml
from pydantic import BaseModel

_PERSONAS_DIR = Path(__file__).resolve().parents[3] / "calibration" / "personas"


class Persona(BaseModel):
    id: str
    name: str
    industry: str
    raw_markdown: str
    ground_truth_primary_service: str = ""
    ground_truth_market: str = ""
    ground_truth_change_moment: str = ""


def list_personas() -> list[str]:
    return sorted(p.stem for p in _PERSONAS_DIR.glob("*.md"))


def load_persona(persona_id: str) -> Persona:
    path = _PERSONAS_DIR / f"{persona_id}.md"
    text = path.read_text()

    # Frontmatter YAML
    match = re.match(r"---\n(.*?)\n---\n(.*)", text, re.DOTALL)
    if not match:
        raise ValueError(f"Persona {persona_id} missing frontmatter")
    fm = yaml.safe_load(match.group(1))
    body = match.group(2)

    # Parse ground truth lines (optional, best-effort)
    gt_service = _grep_after(body, r"Primary service:\s*(.+)")
    gt_market = _grep_after(body, r"Market:\s*(.+)")
    gt_change = _grep_after(body, r"Change Moment \(true\):\s*\*?(.+?)\*?\s*$")

    return Persona(
        id=fm["id"],
        name=fm.get("name", ""),
        industry=fm.get("industry", ""),
        raw_markdown=text,
        ground_truth_primary_service=gt_service,
        ground_truth_market=gt_market,
        ground_truth_change_moment=gt_change,
    )


def _grep_after(body: str, pattern: str) -> str:
    m = re.search(pattern, body, re.MULTILINE)
    return m.group(1).strip() if m else ""
