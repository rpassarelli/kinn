"""Scrape the most recent kinn2 calibration metrics for the 5-persona baseline.

HISTORICAL: this script generated the committed baseline at
`calibration-runs/kinn2-baseline/baseline.json` from the kinn2 predecessor
iteration's run output. It is preserved for reproducibility but does NOT need
to run on a fresh clone — the baseline JSON is already in the repo.

Re-running requires the kinn2 calibration runs on disk. Set KINN2_ROOT to point
at the kinn2 monorepo root (e.g. `KINN2_ROOT=/path/to/kinn2 uv run python
scripts/kinn2_baseline.py`).

Schema notes: kinn2 writes the aggregate to `calibration/runs/<ts>/metrics.yml`
at the RUN ROOT. The metrics.yml has shape:
    iter_0:
      per_persona_composite: {dental-clinic: ..., ...}
      baseline_composite_mean: ...
We use iter_0's per_persona_composite as the baseline (the unmutated kinn2 system).
"""
from __future__ import annotations
import argparse
import json
import os
import statistics
import sys
import time
from datetime import datetime
from pathlib import Path

import yaml

# KINN2_ROOT defaults to two levels above this file (which assumes the historical
# layout where this script lived inside `kinn2/kinn3/scripts/`). Override via env
# var when running on a fresh clone outside the original monorepo.
SCRIPT_DIR = Path(__file__).resolve().parent
KINN2_ROOT = Path(os.environ.get("KINN2_ROOT", SCRIPT_DIR.parent.parent))
RUNS_DIR = KINN2_ROOT / "calibration" / "runs"
OUT_DIR = SCRIPT_DIR.parent / "calibration-runs" / "kinn2-baseline"
PERSONAS = ["dental-clinic", "shinpads-ecommerce", "family-manufacturing", "solo-agency", "racks-reseller"]


def fresh_metrics(max_age_hours: float) -> list[Path]:
    """Find run-root metrics.yml files within max_age_hours. Most recent first."""
    if not RUNS_DIR.exists():
        return []
    cutoff = time.time() - (max_age_hours * 3600)
    candidates = list(RUNS_DIR.glob("*/metrics.yml"))
    fresh = [p for p in candidates if p.stat().st_mtime >= cutoff]
    return sorted(fresh, key=lambda p: p.stat().st_mtime, reverse=True)


def all_metrics() -> list[Path]:
    if not RUNS_DIR.exists():
        return []
    return sorted(RUNS_DIR.glob("*/metrics.yml"), reverse=True)


def main():
    parser = argparse.ArgumentParser(description="Scrape kinn2.1 calibration baseline")
    parser.add_argument("--hours", type=float, default=48.0,
                        help="Only include metrics.yml from the last N hours (default 48). "
                             "Set 9999 to include all historical runs.")
    args = parser.parse_args()

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    metrics_files = fresh_metrics(args.hours)
    if not metrics_files:
        all_count = len(all_metrics())
        print(
            f"FATAL: no fresh kinn2.1 metrics.yml within last {args.hours}h.\n"
            f"({all_count} historical metrics file(s) exist but were filtered out.)\n"
            "Run /calibrate 1 in your Claude Code session first, "
            f"or re-run with --hours 9999 to include historical runs.",
            file=sys.stderr,
        )
        sys.exit(2)

    # Collect each persona's score across all eligible runs (uses iter_0 = unmutated baseline)
    samples: dict[str, list[float]] = {pid: [] for pid in PERSONAS}
    sources: list[str] = []
    for mp in metrics_files:
        data = yaml.safe_load(mp.read_text())
        iter_0 = data.get("iter_0") or {}
        composites = iter_0.get("per_persona_composite", {})
        if not composites:
            continue
        sources.append(str(mp))
        for pid in PERSONAS:
            if pid in composites:
                samples[pid].append(float(composites[pid]))

    # Compute per-persona mean ± stddev
    per_persona = {}
    for pid in PERSONAS:
        scores = samples[pid]
        if not scores:
            per_persona[pid] = None
            continue
        per_persona[pid] = {
            "n_runs": len(scores),
            "mean": round(statistics.mean(scores), 4),
            "stddev": round(statistics.stdev(scores), 4) if len(scores) >= 2 else None,
            "min": round(min(scores), 4),
            "max": round(max(scores), 4),
            "samples": scores,
        }

    valid_means = [r["mean"] for r in per_persona.values() if r is not None]
    mean_composite = round(statistics.mean(valid_means), 4) if valid_means else 0.0
    n_runs_total = len(sources)

    payload = {
        "ran_at": datetime.utcnow().isoformat(),
        "n_metrics_scraped": n_runs_total,
        "noise_floor_warning": (
            f"Only {n_runs_total} metrics.yml found — stddev unavailable. "
            "Run /calibrate 1 again 1-2 more times to capture noise floor."
            if n_runs_total < 2 else None
        ),
        "sources": sources,
        "per_persona": per_persona,
        "mean_composite": mean_composite,
        "n_personas_with_data": len(valid_means),
        "missing_personas": [pid for pid in PERSONAS if per_persona[pid] is None],
        "iter_used": "iter_0 (unmutated baseline)",
    }
    out_path = OUT_DIR / "baseline.json"
    out_path.write_text(json.dumps(payload, indent=2))
    print(f"Wrote {out_path}")
    print(f"kinn2.1 mean composite: {mean_composite:.4f} ({len(valid_means)}/{len(PERSONAS)} personas, {n_runs_total} run(s))")
    if n_runs_total < 2:
        print("WARNING: only 1 calibration run scraped — re-run /calibrate 1-2 more times for noise floor.")


if __name__ == "__main__":
    main()
