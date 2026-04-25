"""Run calibration end-to-end on one persona with live LLM."""
from __future__ import annotations
import argparse
import asyncio
from pathlib import Path
from dotenv import load_dotenv
from kinn3.agent import KinnAgent
from kinn3.client import KinnClient
from kinn3.judge import score_session
from kinn3.memory import LocalMemory
from kinn3.models import VSMBeliefState
from kinn3.personas import load_persona
from kinn3.probes import BOOTSTRAP_PROBES
from kinn3.simulator import StakeholderSimulator


async def run_persona(persona_id: str, turns: int, out_dir: Path) -> dict:
    persona = load_persona(persona_id)
    client = KinnClient()
    memory = LocalMemory(root=out_dir / persona_id)
    agent = KinnAgent(
        client=client, memory=memory, probes=list(BOOTSTRAP_PROBES),
        # Task 26 will add: events_path=..., ledger_path=..., session_id=...
    )
    sim = StakeholderSimulator(client=client, persona=persona)

    # Turn 0 opener
    user_msg = await sim.respond(probe="Tell me about your business in one paragraph.", turn=0)

    for turn_n in range(1, turns + 1):
        output = await agent.turn(user_msg)
        print(f"[{persona_id}] turn {turn_n}: {output.next_question}")
        user_msg = await sim.respond(probe=output.next_question, turn=turn_n)

    belief = VSMBeliefState.model_validate_json(memory.read("belief_state"))
    transcript = memory.read("transcript") or ""
    score = score_session(belief, transcript, persona)
    print(f"[{persona_id}] composite: {score.composite:.3f}")
    return score.model_dump()


async def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--persona", default="dental-clinic")
    parser.add_argument("--turns", type=int, default=10)
    parser.add_argument("--out", default="calibration-runs/latest")
    args = parser.parse_args()
    load_dotenv()
    out = Path(args.out)
    out.mkdir(parents=True, exist_ok=True)
    result = await run_persona(args.persona, args.turns, out)
    print(result)


if __name__ == "__main__":
    asyncio.run(main())
