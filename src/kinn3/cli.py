"""kinn3 CLI — new-session, turn, resume."""
from __future__ import annotations
import argparse
import asyncio
import sys
from pathlib import Path
from dotenv import load_dotenv
from .agent import KinnAgent
from .client import KinnClient
from .memory import LocalMemory
from .probes import BOOTSTRAP_PROBES

SESSIONS_ROOT = Path(__file__).resolve().parents[2] / "sessions"


def _print_turn(out) -> None:
    print("Heard:\n" + "\n".join(f"- {h}" for h in out.heard))
    print(f"\nDelta: {out.delta}")
    print(f"\nNext: {out.next_question}")


async def cmd_new_session(name: str, first_message: str) -> None:
    session_dir = SESSIONS_ROOT / name
    if session_dir.exists():
        print(f"Session {name} already exists. Use resume.", file=sys.stderr)
        sys.exit(1)
    memory = LocalMemory(root=session_dir)
    agent = KinnAgent(
        client=KinnClient(), memory=memory,
        probes=list(BOOTSTRAP_PROBES),
        events_path=session_dir / "events.jsonl",
        ledger_path=session_dir / "costs.jsonl",
        session_id=name,
    )
    try:
        out = await agent.turn(first_message)
        _print_turn(out)
    finally:
        await agent.drain()


async def cmd_turn(name: str, message: str) -> None:
    session_dir = SESSIONS_ROOT / name
    memory = LocalMemory(root=session_dir)
    agent = KinnAgent(
        client=KinnClient(), memory=memory,
        events_path=session_dir / "events.jsonl",
        ledger_path=session_dir / "costs.jsonl",
        session_id=name,
    )
    try:
        out = await agent.turn(message)
        _print_turn(out)
    finally:
        await agent.drain()


def main():
    load_dotenv()
    parser = argparse.ArgumentParser(prog="kinn3")
    sub = parser.add_subparsers(dest="cmd", required=True)
    p_new = sub.add_parser("new-session")
    p_new.add_argument("name")
    p_new.add_argument("message")
    p_turn = sub.add_parser("turn")
    p_turn.add_argument("name")
    p_turn.add_argument("message")
    args = parser.parse_args()
    if args.cmd == "new-session":
        asyncio.run(cmd_new_session(args.name, args.message))
    elif args.cmd == "turn":
        asyncio.run(cmd_turn(args.name, args.message))


if __name__ == "__main__":
    main()
