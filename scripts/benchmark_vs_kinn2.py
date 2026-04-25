"""Run kinn3 on all 5 personas; gate against recorded kinn2.1 baseline.

DUAL GATE:
  - kinn3(dental-clinic) >= 0.903   (matches kinn2.1's published gate)
  - kinn3 mean composite >= kinn2.1 mean composite (from baseline.json)
"""
from __future__ import annotations
import asyncio
import json
import sys
from pathlib import Path
from dotenv import load_dotenv

from kinn3.personas import list_personas
from scripts.run_calibration import run_persona

BASELINE_PATH = Path("calibration-runs/kinn2-baseline/baseline.json")
DENTAL_GATE = 0.903


async def main():
    load_dotenv()
    if not BASELINE_PATH.exists():
        print(f"FATAL: {BASELINE_PATH} missing. Run scripts/kinn2_baseline.py first (Task 27a).",
              file=sys.stderr)
        sys.exit(2)
    baseline = json.loads(BASELINE_PATH.read_text())
    kinn2_overall_mean = baseline["mean_composite"]

    out = Path("calibration-runs/benchmark")
    out.mkdir(parents=True, exist_ok=True)
    results: dict[str, dict] = {}
    for pid in list_personas():
        results[pid] = await run_persona(pid, turns=10, out_dir=out)

    composites = {pid: r["composite"] for pid, r in results.items()}
    mean_c = sum(composites.values()) / len(composites)
    dental = composites.get("dental-clinic", 0.0)

    print("\n=== benchmark summary ===")
    for pid, c in composites.items():
        kinn2_record = baseline["per_persona"].get(pid) or {}
        kinn2_persona_mean = kinn2_record.get("mean")
        kinn2_std = kinn2_record.get("stddev")
        delta = (c - kinn2_persona_mean) if kinn2_persona_mean is not None else None
        delta_s = f"{delta:+.3f}" if delta is not None else "n/a"
        sig_marker = ""
        if delta is not None and kinn2_std is not None and abs(delta) <= kinn2_std:
            sig_marker = " [within 1-sigma noise -- inconclusive]"
        print(f"  {pid}: kinn3={c:.3f}  kinn2.1={kinn2_persona_mean}  delta={delta_s}{sig_marker}")

    print(f"\nkinn3 mean: {mean_c:.3f}   kinn2.1 mean: {kinn2_overall_mean:.3f}")
    print(f"kinn3 dental-clinic: {dental:.3f}   gate: {DENTAL_GATE}")

    gate1 = dental >= DENTAL_GATE
    gate2 = mean_c >= kinn2_overall_mean
    print(f"\nGATE 1 (dental >= {DENTAL_GATE}): {'PASS' if gate1 else 'FAIL'}")
    print(f"GATE 2 (mean >= kinn2.1 mean):    {'PASS' if gate2 else 'FAIL'}")
    print(f"OVERALL: {'PASS' if gate1 and gate2 else 'FAIL'}")
    (out / "summary.json").write_text(json.dumps({
        "kinn3": composites, "kinn2_baseline": baseline, "kinn3_mean": mean_c,
        "gate_dental_pass": gate1, "gate_mean_pass": gate2,
    }, indent=2))
    sys.exit(0 if (gate1 and gate2) else 1)


if __name__ == "__main__":
    asyncio.run(main())
