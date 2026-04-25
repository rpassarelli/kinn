"""Extract a kinn3 session into JSON consumed by the Astro demo.

Writes:  demo/src/data/session.json

Run from demo/ root:
    uv run python scripts/build_data.py [SESSION_DIR]
"""
from __future__ import annotations
import argparse
import json
import re
from pathlib import Path

DEFAULT_SESSION = Path("../calibration-runs/benchmark/dental-clinic")
DEFAULT_OUT = Path("src/data/session.json")

BLOCK_NAMES = {
    1: "Market", 2: "Purpose", 3: "Change",
    4: "Algedonic", 5: "Coherence", 6: "Operations",
}
BLOCK_FULL = {
    1: "who do they serve", 2: "what they actually sell",
    3: "survive / grow / pivot", 4: "what's hurting",
    5: "accountability flow", 6: "capacity & shape",
}
BLOCK_ICONS = {1: "🎯", 2: "🧭", 3: "⚡", 4: "💢", 5: "🪜", 6: "⚙️"}
RESOLUTION_RANK = {"empty": 0, "low": 1, "mid": 2, "high": 3}


def _extract_signals(heard: list[str], max_signals: int = 3) -> list[str]:
    out = []
    for h in heard[:max_signals]:
        quote = None
        for opener, closer in [("'", "'"), ('"', '"'), ("‘", "’"), ("“", "”")]:
            first = h.find(opener)
            last = h.rfind(closer)
            if first != -1 and last > first:
                cand = h[first + 1:last].strip()
                if not quote or len(cand) > len(quote):
                    quote = cand
        if not quote:
            quote = h.split(" — ")[0].split(" - ")[0].strip()
        if len(quote) > 110:
            quote = quote[:107].rstrip() + "…"
        out.append(quote)
    return out


def parse_transcript(path: Path) -> list[dict]:
    text = path.read_text()
    turns = []
    pattern = re.compile(r"### Turn (\d+)\n(.*?)(?=### Turn \d+|\Z)", re.DOTALL)
    for m in pattern.finditer(text):
        n = int(m.group(1)); body = m.group(2).strip()
        u = re.search(r"^USER:\s*(.*?)(?=\nAGENT:)", body, re.DOTALL)
        a = re.search(r"^AGENT:\s*(.+)$", body, re.MULTILINE | re.DOTALL)
        if not u or not a:
            continue
        try:
            agent = json.loads(a.group(1).strip())
        except json.JSONDecodeError:
            continue
        turns.append({
            "turn": n,
            "user": u.group(1).strip(),
            "signals": _extract_signals(agent.get("heard", [])),
            "thinking": agent.get("delta", ""),
            "next_question": agent.get("next_question", ""),
            "signal_mutations": agent.get("signal_mutations", []),
        })
    return turns


def parse_costs(path: Path) -> dict[int, dict]:
    if not path.exists():
        return {}
    out = {}
    for line in path.read_text().splitlines():
        if line.strip():
            rec = json.loads(line)
            out[rec["turn"]] = rec
    return out


def replay(turns: list[dict]):
    state = {i: {"resolution": "empty", "quotes": []} for i in range(1, 7)}
    snaps, proms = [], []
    for turn in turns:
        promos = []
        for m in turn["signal_mutations"]:
            blk = m.get("block"); new_res = m.get("new_resolution")
            quote = m.get("quote", "")
            if blk in state and new_res in RESOLUTION_RANK:
                old = RESOLUTION_RANK[state[blk]["resolution"]]
                new = RESOLUTION_RANK[new_res]
                if new > old:
                    promos.append({
                        "block": blk, "from": state[blk]["resolution"], "to": new_res,
                        "delta_rank": new - old, "quote": quote,
                    })
                if new >= old:
                    state[blk]["resolution"] = new_res
                if quote and quote not in state[blk]["quotes"]:
                    state[blk]["quotes"].append(quote)
        snaps.append({b: dict(s) for b, s in state.items()})
        proms.append(promos)
    return snaps, proms


def derive_goal_blocks(turns, promotions):
    out = []
    for i in range(len(turns)):
        target = None
        if i + 1 < len(promotions) and promotions[i + 1]:
            top = max(promotions[i + 1], key=lambda p: (RESOLUTION_RANK[p["to"]], p["delta_rank"]))
            target = top["block"]
        out.append(target)
    return out


def derive_algedonic(snapshots):
    return [snap[4]["resolution"] if 4 in snap else "empty" for snap in snapshots]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("session", nargs="?", default=str(DEFAULT_SESSION))
    ap.add_argument("-o", "--out", default=str(DEFAULT_OUT))
    args = ap.parse_args()

    session = Path(args.session)
    if not session.exists():
        raise SystemExit(f"Session dir not found: {session}")

    turns = parse_transcript(session / "transcript.txt")
    if not turns:
        raise SystemExit("No turns parsed")
    snapshots, promotions = replay(turns)
    cost_data = parse_costs(session / "costs.jsonl")
    goal_blocks = derive_goal_blocks(turns, promotions)
    algedonic = derive_algedonic(snapshots)

    payload = {
        "turns": turns,
        "snapshots": snapshots,
        "promotions": promotions,
        "costs": cost_data,
        "goal_blocks": goal_blocks,
        "algedonic": algedonic,
        "block_names": BLOCK_NAMES,
        "block_full": BLOCK_FULL,
        "block_icons": BLOCK_ICONS,
    }
    out = Path(args.out)
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(payload, indent=2))
    print(f"Wrote {out} ({out.stat().st_size:,} bytes, {len(turns)} turns)")


if __name__ == "__main__":
    main()
