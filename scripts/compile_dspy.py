"""Run GEPA optimizer on the DiagnoseTurn signature against the 5-persona harness."""
from __future__ import annotations
import argparse
import asyncio
from pathlib import Path
import dspy
from dotenv import load_dotenv
from kinn3.dspy_metric import calibration_metric
from kinn3.personas import list_personas, load_persona
from kinn3.signatures import DiagnoseTurn
from scripts.run_calibration import run_persona


async def build_trainset(turns: int, out_dir: Path) -> list:
    """Run each persona once; each becomes a training example."""
    examples = []
    for pid in list_personas():
        result = await run_persona(pid, turns, out_dir)
        examples.append(dspy.Example(
            persona=load_persona(pid), composite=result["composite"],
        ).with_inputs("persona"))
    return examples


async def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--turns", type=int, default=10)
    parser.add_argument("--out", default="calibration-runs/gepa")
    args = parser.parse_args()
    load_dotenv()
    out = Path(args.out); out.mkdir(parents=True, exist_ok=True)

    dspy.configure(lm=dspy.LM(model="anthropic/claude-opus-4-7"))
    trainset = await build_trainset(args.turns, out)

    program = dspy.ChainOfThought(DiagnoseTurn)
    optimizer = dspy.GEPA(metric=calibration_metric, auto="light")
    compiled = optimizer.compile(program, trainset=trainset)
    compiled.save(out / "compiled.json")
    print(f"Saved compiled program to {out / 'compiled.json'}")


if __name__ == "__main__":
    asyncio.run(main())
