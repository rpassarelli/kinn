"""Build a self-contained narrative HTML demo from a kinn3 session.

5-panel layout (top row: 01, 02, 03 · bottom row: 05, 04):

    ┌────────┬────────┬──────────────────────┐
    │ 01     │ 02     │ 03                   │
    │ Phone  │ Signal │ VSM (6 blocks)       │
    │ chat   │ extract│                      │
    ├────────┴────────┼──────────────────────┤
    │ 05              │ 04                   │
    │ Questioner      │ Router / animation   │
    │ + visual cues   │                      │
    └─────────────────┴──────────────────────┘

Per-turn flow (animated):
  01 → 02 (signals extracted)
  02 → 04 (signals routed)
  04 → 03 (mutations applied, block lights up)
  03 → 04 (lowest-coverage block becomes next objective)
  04 → 05 (objective + algedonic visual cue)
  05 → 01 (next question -> back into the chat)

Usage:
    uv run python scripts/build_demo_ui.py [SESSION_DIR] [-o OUT_FILE]
"""
from __future__ import annotations
import argparse
import json
import re
from pathlib import Path

DEFAULT_SESSION = Path("calibration-runs/benchmark/dental-clinic")
DEFAULT_OUT = Path("demo.html")

BLOCK_NAMES = {
    1: "Market",
    2: "Purpose",
    3: "Change",
    4: "Algedonic",
    5: "Coherence",
    6: "Operations",
}
BLOCK_FULL = {
    1: "Market — who do they serve",
    2: "Purpose — what they actually sell",
    3: "Change — survive / grow / pivot",
    4: "Algedonic — what's hurting",
    5: "Coherence — accountability flow",
    6: "Operations — capacity & shape",
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
                candidate = h[first + 1:last].strip()
                if not quote or len(candidate) > len(quote):
                    quote = candidate
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
        turn_n = int(m.group(1))
        body = m.group(2).strip()
        u = re.search(r"^USER:\s*(.*?)(?=\nAGENT:)", body, re.DOTALL)
        a = re.search(r"^AGENT:\s*(.+)$", body, re.MULTILINE | re.DOTALL)
        if not u or not a:
            continue
        try:
            agent = json.loads(a.group(1).strip())
        except json.JSONDecodeError:
            continue
        heard = agent.get("heard", [])
        turns.append({
            "turn": turn_n,
            "user": u.group(1).strip(),
            "signals": _extract_signals(heard),
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
            blk = m.get("block")
            new_res = m.get("new_resolution")
            quote = m.get("quote", "")
            if blk in state and new_res in RESOLUTION_RANK:
                old_rank = RESOLUTION_RANK[state[blk]["resolution"]]
                new_rank = RESOLUTION_RANK[new_res]
                if new_rank > old_rank:
                    promos.append({
                        "block": blk, "from": state[blk]["resolution"], "to": new_res,
                        "delta_rank": new_rank - old_rank, "quote": quote,
                    })
                if new_rank >= old_rank:
                    state[blk]["resolution"] = new_res
                if quote and quote not in state[blk]["quotes"]:
                    state[blk]["quotes"].append(quote)
        snaps.append({b: dict(s) for b, s in state.items()})
        proms.append(promos)
    return snaps, proms


def derive_goal_blocks(turns, promotions):
    """The block this turn's outgoing question is targeting.
    Inferred from NEXT turn's dominant mutation."""
    out = []
    for i in range(len(turns)):
        target = None
        if i + 1 < len(promotions) and promotions[i + 1]:
            top = max(promotions[i + 1], key=lambda p: (RESOLUTION_RANK[p["to"]], p["delta_rank"]))
            target = top["block"]
        out.append(target)
    return out


def derive_algedonic(snapshots):
    """Block 4 ('Algedonic — what's hurting') resolution per turn."""
    return [snap[4]["resolution"] if 4 in snap else "empty" for snap in snapshots]


def build_captions(turns, promotions):
    caps = []
    for i, t in enumerate(turns):
        promos = promotions[i]
        if not promos:
            caps.append("Listening — no image shift this turn.")
            continue
        top = max(promos, key=lambda p: (RESOLUTION_RANK[p["to"]], p["delta_rank"]))
        block_name = BLOCK_NAMES[top["block"]]
        cap = f"{BLOCK_ICONS[top['block']]} {block_name} → {top['to'].upper()}"
        if top["delta_rank"] > 1:
            cap += f"  (jumped {top['delta_rank']} levels)"
        if len(promos) > 1:
            cap += f"  · plus {len(promos)-1} more"
        caps.append(cap)
    return caps


HTML_TEMPLATE = r"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>kinn3 — diagnostic interview demo</title>
<style>
:root {
  --bg: #0a0d12; --panel: #141821; --panel-2: #1c2230;
  --border: #2a3142; --text: #f0f6fc; --text-dim: #8b96aa; --text-muted: #5d6679;
  --user: #58a6ff; --agent: #d2a8ff; --gold: #ffd33d;
  --empty: #2a3142; --low: #d29922; --mid: #58a6ff; --high: #3fb950;
  --signal: #58a6ff; --route: #ffd33d; --goal: #d2a8ff; --quest: #3fb950;
}
* { box-sizing: border-box; margin: 0; padding: 0; }
html, body {
  background: var(--bg); color: var(--text);
  font-family: -apple-system, BlinkMacSystemFont, "Inter", system-ui, sans-serif;
  height: 100%; overflow: hidden; -webkit-font-smoothing: antialiased;
}
body { display: flex; flex-direction: column; }

/* ── Header ─────────────────────────────────────── */
header {
  padding: 10px 20px; border-bottom: 1px solid var(--border);
  display: flex; align-items: center; justify-content: space-between;
  background: var(--panel); flex-shrink: 0;
}
header h1 { font-size: 16px; font-weight: 700; letter-spacing: -0.01em; }
header h1 .v { color: var(--text-dim); font-weight: 400; margin-left: 10px; font-size: 12px; }
header .meta {
  font-size: 11px; color: var(--text-dim);
  font-family: ui-monospace, "SF Mono", monospace;
}

/* ── 5-PANEL GRID ───────────────────────────────── */
main {
  flex: 1; display: grid;
  grid-template-columns: 1fr 1fr 2fr;
  grid-template-rows: 1fr 1fr;
  grid-template-areas:
    "p1 p2 p3"
    "p5 p5 p4";
  gap: 8px; padding: 8px;
  background: var(--bg);
  overflow: hidden;
  position: relative;
}
.panel {
  background: var(--panel); border: 1px solid var(--border);
  border-radius: 12px; padding: 14px 16px;
  display: flex; flex-direction: column;
  position: relative; overflow: hidden;
}
.panel-tag {
  position: absolute; top: 8px; right: 12px;
  font-family: ui-monospace, monospace;
  font-size: 24px; font-weight: 800; color: var(--text-muted);
  opacity: 0.35; letter-spacing: -0.02em;
}
.panel-title {
  font-size: 10px; text-transform: uppercase; letter-spacing: 0.18em;
  color: var(--text-dim); margin-bottom: 6px; font-family: ui-monospace, monospace;
  font-weight: 700;
}
.panel-sub {
  font-size: 11px; color: var(--text-muted); margin-bottom: 12px;
}
#panel-01 { grid-area: p1; }
#panel-02 { grid-area: p2; }
#panel-03 { grid-area: p3; }
#panel-04 { grid-area: p4; }
#panel-05 { grid-area: p5; }

/* ── 01: PHONE CHAT ─────────────────────────────── */
.phone-frame {
  flex: 1; margin: 4px auto 0; width: 100%; max-width: 240px;
  background: #1a1d24; border: 8px solid #0a0d12; border-radius: 36px;
  box-shadow: 0 0 0 2px #2a3142, 0 8px 30px rgba(0,0,0,0.5);
  display: flex; flex-direction: column; overflow: hidden;
  position: relative;
}
.phone-frame::before {
  content: ""; position: absolute; top: 8px; left: 50%; transform: translateX(-50%);
  width: 60px; height: 16px; background: #0a0d12; border-radius: 12px; z-index: 2;
}
.phone-screen {
  flex: 1; padding: 32px 12px 16px; overflow-y: auto;
  display: flex; flex-direction: column; gap: 10px;
  scroll-behavior: smooth;
}
.phone-screen::-webkit-scrollbar { width: 0; }
.bubble {
  max-width: 88%; padding: 9px 12px; border-radius: 14px;
  font-size: 12px; line-height: 1.4;
  opacity: 0; transform: translateY(6px);
  animation: bubble-in 0.4s ease forwards;
}
.bubble.user {
  background: var(--user); color: #06121f; align-self: flex-end;
  border-bottom-right-radius: 4px;
}
.bubble.agent {
  background: #2a3142; color: var(--text); align-self: flex-start;
  border-bottom-left-radius: 4px;
}
@keyframes bubble-in {
  to { opacity: 1; transform: translateY(0); }
}
.bubble.typing {
  background: #2a3142; color: var(--text-muted); padding: 8px 14px;
  align-self: flex-start; border-bottom-left-radius: 4px;
  display: inline-flex; gap: 3px; align-items: center;
}
.bubble.typing span {
  width: 5px; height: 5px; border-radius: 50%; background: var(--text-muted);
  animation: typing-dot 1.2s infinite ease-in-out;
}
.bubble.typing span:nth-child(2) { animation-delay: 0.15s; }
.bubble.typing span:nth-child(3) { animation-delay: 0.3s; }
@keyframes typing-dot {
  0%, 60%, 100% { opacity: 0.3; transform: translateY(0); }
  30% { opacity: 1; transform: translateY(-3px); }
}

/* ── 02: SIGNAL EXTRACTION ──────────────────────── */
.signals-list {
  list-style: none; padding: 0; margin: 8px 0 0;
  display: flex; flex-direction: column; gap: 8px;
}
.signals-list li {
  font-size: 12px; line-height: 1.4; padding: 8px 10px 8px 22px;
  background: rgba(88,166,255,0.08); border-left: 2px solid var(--signal);
  border-radius: 4px; position: relative;
  opacity: 0; transform: translateX(-6px);
  transition: opacity 0.4s ease, transform 0.4s ease;
}
.signals-list li.shown { opacity: 1; transform: translateX(0); }
.signals-list li::before {
  content: "›"; position: absolute; left: 8px; top: 6px;
  color: var(--signal); font-weight: 700;
}
.signals-empty {
  color: var(--text-muted); font-style: italic; font-size: 12px; padding: 8px 0;
}

/* ── 03: VSM (six blocks) ───────────────────────── */
.vsm-grid {
  display: grid; grid-template-columns: 1fr 1fr 1fr;
  gap: 10px; flex: 1; align-content: start;
}
.vsm-block {
  background: var(--panel-2); border: 2px solid var(--border); border-radius: 12px;
  padding: 12px 14px; transition: all 0.5s cubic-bezier(0.34, 1.56, 0.64, 1);
  display: flex; flex-direction: column; gap: 4px;
  position: relative; overflow: hidden;
  min-height: 92px;
}
.vsm-block .top { display: flex; align-items: center; gap: 8px; }
.vsm-block .icon { font-size: 20px; }
.vsm-block .name { font-size: 12px; font-weight: 700; }
.vsm-block .sub  { font-size: 10px; color: var(--text-muted); margin-top: 1px; line-height: 1.3; }
.vsm-block .pill {
  font-size: 9px; text-transform: uppercase; letter-spacing: 0.16em; font-weight: 800;
  padding: 3px 8px; border-radius: 10px; font-family: ui-monospace, monospace;
  align-self: flex-start; margin-top: 4px;
}
.vsm-block.empty { opacity: 0.45; border-style: dashed; }
.vsm-block.empty .pill { background: var(--empty); color: var(--text-muted); }
.vsm-block.low  { border-color: var(--low);  background: linear-gradient(135deg, rgba(210,153,34,0.08), var(--panel-2)); }
.vsm-block.low  .pill { background: rgba(210,153,34,0.25); color: var(--low); }
.vsm-block.mid  { border-color: var(--mid);  background: linear-gradient(135deg, rgba(88,166,255,0.10), var(--panel-2)); }
.vsm-block.mid  .pill { background: rgba(88,166,255,0.25); color: var(--mid); }
.vsm-block.high { border-color: var(--high); background: linear-gradient(135deg, rgba(63,185,80,0.13), var(--panel-2)); }
.vsm-block.high .pill { background: rgba(63,185,80,0.28); color: var(--high); }
.vsm-block.just-promoted { animation: vsm-pulse 1.3s ease; }
.vsm-block.is-goal {
  outline: 2px solid var(--goal); outline-offset: 2px;
  box-shadow: 0 0 18px rgba(210,168,255,0.4);
}
@keyframes vsm-pulse {
  0%   { transform: scale(1);    box-shadow: 0 0 0 0 rgba(255,211,61,0.7); }
  40%  { transform: scale(1.08); box-shadow: 0 0 0 14px rgba(255,211,61,0); }
  100% { transform: scale(1);    box-shadow: 0 0 0 0 rgba(255,211,61,0); }
}

/* ── 04: ROUTER / ANIMATION ─────────────────────── */
.router {
  flex: 1; display: grid;
  grid-template-columns: 1fr auto 1fr;
  align-items: center; gap: 14px;
  padding: 10px 4px;
}
.router-col {
  display: flex; flex-direction: column; gap: 8px;
  min-height: 0; overflow: hidden;
}
.router-col.in-col { align-items: flex-end; text-align: right; }
.router-col.out-col { align-items: flex-start; text-align: left; }
.router-col-label {
  font-size: 9px; text-transform: uppercase; letter-spacing: 0.18em;
  color: var(--text-muted); font-family: ui-monospace, monospace;
  margin-bottom: 4px;
}
.router-core {
  width: 64px; height: 64px; border-radius: 50%;
  background: radial-gradient(circle, rgba(255,211,61,0.25), rgba(255,211,61,0.05));
  border: 2px solid rgba(255,211,61,0.4);
  display: flex; align-items: center; justify-content: center;
  font-size: 28px;
  position: relative;
  transition: all 0.3s ease;
}
.router-core.active {
  background: radial-gradient(circle, rgba(255,211,61,0.55), rgba(255,211,61,0.1));
  border-color: var(--gold);
  box-shadow: 0 0 30px rgba(255,211,61,0.5);
  animation: router-spin 1.4s linear;
}
@keyframes router-spin {
  from { transform: rotate(0deg); }
  to   { transform: rotate(360deg); }
}
.router-chip {
  font-size: 11px; padding: 5px 9px; border-radius: 8px;
  font-family: ui-monospace, monospace; font-weight: 600;
  background: var(--panel-2); border: 1px solid var(--border);
  display: inline-flex; align-items: center; gap: 5px;
  opacity: 0; transform: translateY(4px);
  transition: opacity 0.35s ease, transform 0.35s ease;
  white-space: nowrap; max-width: 100%;
}
.router-chip.shown { opacity: 1; transform: translateY(0); }
.router-chip.signal { border-color: var(--signal); color: var(--signal); }
.router-chip.mutation {
  border-color: var(--gold); color: var(--gold);
  background: rgba(255,211,61,0.08);
}
.router-chip.mutation .to {
  font-size: 9px; padding: 1px 5px; border-radius: 6px;
  background: rgba(63,185,80,0.3); color: var(--high); margin-left: 4px;
}
.router-chip.objective {
  border-color: var(--goal); color: var(--goal);
  background: rgba(210,168,255,0.08);
  font-weight: 700;
}

/* ── 05: QUESTIONER ─────────────────────────────── */
.quest-cues {
  display: flex; gap: 12px; margin: 6px 0 14px;
  opacity: 0; transition: opacity 0.4s ease;
}
.quest-cues.shown { opacity: 1; }
.cue {
  flex: 1; background: var(--panel-2); border: 1px solid var(--border);
  border-radius: 10px; padding: 10px 12px;
  display: flex; flex-direction: column; gap: 4px;
}
.cue-label {
  font-size: 9px; text-transform: uppercase; letter-spacing: 0.16em;
  color: var(--text-muted); font-family: ui-monospace, monospace; font-weight: 700;
}
.cue-value {
  font-size: 14px; font-weight: 700; color: var(--text);
  display: flex; align-items: center; gap: 8px;
}
.cue-pill {
  font-size: 10px; padding: 3px 8px; border-radius: 8px;
  font-family: ui-monospace, monospace; font-weight: 800; letter-spacing: 0.14em;
  text-transform: uppercase;
}
.cue-pill.empty { background: var(--empty); color: var(--text-muted); }
.cue-pill.low   { background: rgba(210,153,34,0.25); color: var(--low); }
.cue-pill.mid   { background: rgba(88,166,255,0.25); color: var(--mid); }
.cue-pill.high  { background: rgba(63,185,80,0.28); color: var(--high); }
.next-q-box {
  flex: 1; display: flex; align-items: center;
  background: linear-gradient(135deg, rgba(63,185,80,0.10), rgba(63,185,80,0.04));
  border: 1px solid rgba(63,185,80,0.4); border-radius: 12px;
  padding: 18px 20px;
  opacity: 0; transform: translateY(8px);
  transition: opacity 0.5s ease, transform 0.5s ease;
}
.next-q-box.shown { opacity: 1; transform: translateY(0); }
.next-q-text {
  font-size: 18px; font-weight: 600; line-height: 1.4; color: var(--text);
}

/* ── ARROWS BETWEEN PANELS ──────────────────────── */
#arrow-svg {
  position: absolute; inset: 0; width: 100%; height: 100%;
  pointer-events: none; z-index: 50;
}
.arrow-path {
  fill: none; stroke-width: 2.5; opacity: 0;
  stroke-dasharray: 6 6;
  transition: opacity 0.25s ease;
}
.arrow-path.shown { opacity: 0.9; animation: dash-flow 1s linear infinite; }
.arrow-path.signal-color { stroke: var(--signal); }
.arrow-path.route-color  { stroke: var(--route); }
.arrow-path.goal-color   { stroke: var(--goal); }
.arrow-path.quest-color  { stroke: var(--quest); }
@keyframes dash-flow {
  to { stroke-dashoffset: -24; }
}

/* ── Footer ─────────────────────────────────────── */
footer {
  padding: 10px 20px; border-top: 1px solid var(--border); background: var(--panel);
  display: flex; align-items: center; justify-content: space-between; gap: 16px;
  font-family: ui-monospace, monospace; font-size: 11px; flex-shrink: 0;
}
.controls { display: flex; gap: 8px; align-items: center; }
.btn {
  background: var(--panel-2); color: var(--text); border: 1px solid var(--border);
  padding: 7px 13px; border-radius: 6px; cursor: pointer; font-family: inherit;
  font-size: 12px; font-weight: 600; letter-spacing: 0.04em;
}
.btn:hover:not(:disabled) { background: var(--border); }
.btn:disabled { opacity: 0.4; cursor: not-allowed; }
.btn.primary { background: var(--user); color: var(--bg); border-color: var(--user); }
.btn.demo {
  background: var(--gold); color: #1a1500; border-color: var(--gold); font-weight: 800;
}
.metrics { display: flex; gap: 14px; color: var(--text-dim); }
.metrics b { color: var(--text); margin-left: 4px; }
.progress { display: flex; gap: 3px; flex: 1; max-width: 200px; margin: 0 12px; }
.progress .dot {
  flex: 1; height: 5px; background: var(--empty); border-radius: 3px;
  transition: background 0.3s;
}
.progress .dot.done { background: var(--mid); }
.progress .dot.current { background: var(--gold); }
</style>
</head>
<body>
<header>
  <h1>kinn3 <span class="v">— Bayesian diagnostic interview engine</span></h1>
  <div class="meta">Opus 4.7 · BED-LLM · adaptive thinking · 11h hackathon build</div>
</header>
<main>
  <section class="panel" id="panel-01">
    <div class="panel-tag">01</div>
    <div class="panel-title">📱 Stakeholder · live chat</div>
    <div class="phone-frame"><div class="phone-screen" id="phone-screen"></div></div>
  </section>

  <section class="panel" id="panel-02">
    <div class="panel-tag">02</div>
    <div class="panel-title">🎧 Signals · what kinn3 heard</div>
    <ul class="signals-list" id="signals-list">
      <li class="signals-empty">— waiting for input —</li>
    </ul>
  </section>

  <section class="panel" id="panel-03">
    <div class="panel-tag">03</div>
    <div class="panel-title">🧠 VSM model · 6 cybernetic dimensions</div>
    <div class="vsm-grid" id="vsm-blocks"></div>
  </section>

  <section class="panel" id="panel-04">
    <div class="panel-tag">04</div>
    <div class="panel-title">⚙️ Router · process · update · pick goal</div>
    <div class="router">
      <div class="router-col in-col">
        <div class="router-col-label">in: signals</div>
        <div id="router-in"></div>
      </div>
      <div class="router-core" id="router-core">⚙️</div>
      <div class="router-col out-col">
        <div class="router-col-label">out: mutations · objective</div>
        <div id="router-out"></div>
      </div>
    </div>
  </section>

  <section class="panel" id="panel-05">
    <div class="panel-tag">05</div>
    <div class="panel-title">❓ Questioner · build the next probe</div>
    <div class="quest-cues" id="quest-cues">
      <div class="cue">
        <div class="cue-label">algedonic · is it hurting?</div>
        <div class="cue-value"><span id="alg-pill" class="cue-pill empty">empty</span></div>
      </div>
      <div class="cue">
        <div class="cue-label">goal · target block</div>
        <div class="cue-value"><span id="goal-icon">–</span><span id="goal-name">none</span></div>
      </div>
    </div>
    <div class="next-q-box" id="next-q-box">
      <div class="next-q-text" id="next-q-text">— waiting for objective —</div>
    </div>
  </section>

  <svg id="arrow-svg">
    <defs>
      <marker id="arr-signal" viewBox="0 0 10 10" refX="9" refY="5"
              markerWidth="6" markerHeight="6" orient="auto">
        <path d="M 0 0 L 10 5 L 0 10 z" fill="#58a6ff" />
      </marker>
      <marker id="arr-route" viewBox="0 0 10 10" refX="9" refY="5"
              markerWidth="6" markerHeight="6" orient="auto">
        <path d="M 0 0 L 10 5 L 0 10 z" fill="#ffd33d" />
      </marker>
      <marker id="arr-goal" viewBox="0 0 10 10" refX="9" refY="5"
              markerWidth="6" markerHeight="6" orient="auto">
        <path d="M 0 0 L 10 5 L 0 10 z" fill="#d2a8ff" />
      </marker>
      <marker id="arr-quest" viewBox="0 0 10 10" refX="9" refY="5"
              markerWidth="6" markerHeight="6" orient="auto">
        <path d="M 0 0 L 10 5 L 0 10 z" fill="#3fb950" />
      </marker>
    </defs>
  </svg>
</main>
<footer>
  <div class="controls">
    <button class="btn demo" id="demo">▶ Run demo</button>
    <button class="btn" id="prev">◀</button>
    <button class="btn primary" id="next">Step ▶</button>
    <button class="btn" id="reset">↺</button>
  </div>
  <div class="progress" id="progress"></div>
  <div class="metrics">
    <span>turn <b id="turn-num">0</b>/<span id="turn-total">0</span></span>
    <span>cost <b id="cost">$0.000</b></span>
    <span>cache hit <b id="cache">0</b>%</span>
    <span>blocks <b id="cov">0</b>/6</span>
  </div>
</footer>
<script>
const TURNS = __TURNS_JSON__;
const SNAPSHOTS = __SNAPSHOTS_JSON__;
const PROMOTIONS = __PROMOTIONS_JSON__;
const COSTS = __COSTS_JSON__;
const BLOCK_NAMES = __BLOCK_NAMES_JSON__;
const BLOCK_FULL = __BLOCK_FULL_JSON__;
const BLOCK_ICONS = __BLOCK_ICONS_JSON__;
const CAPTIONS = __CAPTIONS_JSON__;
const GOAL_BLOCKS = __GOAL_BLOCKS_JSON__;
const ALGEDONIC = __ALGEDONIC_JSON__;

// Per-turn choreography (ms). Sums to ~5800ms. With 5 demo turns, ~29s total.
const T = {
  user_in:        100,   // 01 user bubble appears
  signals_start:  900,   // 02 signal bullets begin appearing (250ms apart)
  arrow_02_04:   1700,   // arrow from 02 to 04 fires
  router_recv:   2000,   // 04 receives, signal chips appear in left col
  router_active: 2300,   // 04 core spins
  arrow_04_03:   2900,   // arrow from 04 to 03 fires (mutations)
  vsm_update:    3300,   // 03 block(s) light up + just-promoted pulse
  arrow_03_04:   4100,   // arrow from 03 to 04 (read goal)
  goal_appear:   4400,   // 04 emits objective chip in right col
  arrow_04_05:   4700,   // arrow from 04 to 05
  cues_appear:   5000,   // 05 algedonic + goal cues
  next_q:        5400,   // 05 question text
  arrow_05_01:   5800,   // arrow back to 01 (closes the loop)
  agent_bubble:  6100,   // agent bubble appears in 01 (next user reads it)
};

const DEMO_SEQ = [
  {turn: 1, dwell: 7000},
  {turn: 2, dwell: 7000},
  {turn: 3, dwell: 7000},
  {turn: 7, dwell: 7000},
  {turn: 10, dwell: 7000},
];

let currentTurn = 0;
let demoTimer = null;
let demoRunning = false;
let stepTimers = [];

function clearStepTimers() {
  stepTimers.forEach(t => clearTimeout(t));
  stepTimers = [];
}
function escapeHtml(s) {
  return (s || "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"})[c]);
}
function schedule(ms, fn) { stepTimers.push(setTimeout(fn, ms)); }

// ───────── 01 PHONE ─────────
function appendPhoneBubble(html, cls) {
  const screen = document.getElementById("phone-screen");
  const div = document.createElement("div");
  div.className = "bubble " + cls;
  div.innerHTML = html;
  screen.appendChild(div);
  screen.scrollTop = screen.scrollHeight;
  return div;
}
function clearPhone() { document.getElementById("phone-screen").innerHTML = ""; }

// ───────── 02 SIGNALS ─────────
function clearSignals() {
  const list = document.getElementById("signals-list");
  list.innerHTML = '<li class="signals-empty">— processing —</li>';
}
function showSignals(signals) {
  const list = document.getElementById("signals-list");
  list.innerHTML = "";
  signals.forEach((s, i) => {
    const li = document.createElement("li");
    li.textContent = s;
    list.appendChild(li);
    schedule(i * 250, () => li.classList.add("shown"));
  });
}

// ───────── 04 ROUTER ─────────
function clearRouter() {
  document.getElementById("router-in").innerHTML = "";
  document.getElementById("router-out").innerHTML = "";
  document.getElementById("router-core").classList.remove("active");
}
function routerReceiveSignals(signals) {
  const inDiv = document.getElementById("router-in");
  inDiv.innerHTML = "";
  signals.forEach((s, i) => {
    const c = document.createElement("div");
    c.className = "router-chip signal";
    c.textContent = s.length > 36 ? s.slice(0, 33) + "…" : s;
    inDiv.appendChild(c);
    schedule(i * 150, () => c.classList.add("shown"));
  });
}
function routerActivate() {
  document.getElementById("router-core").classList.add("active");
}
function routerEmitMutations(promos) {
  const out = document.getElementById("router-out");
  out.innerHTML = "";
  if (!promos.length) {
    const c = document.createElement("div");
    c.className = "router-chip"; c.textContent = "(no mutation)";
    out.appendChild(c);
    schedule(0, () => c.classList.add("shown"));
    return;
  }
  promos.forEach((p, i) => {
    const c = document.createElement("div");
    c.className = "router-chip mutation";
    c.innerHTML = `${BLOCK_ICONS[p.block]} ${escapeHtml(BLOCK_NAMES[p.block])} <span class="to">${p.to}</span>`;
    out.appendChild(c);
    schedule(i * 150, () => c.classList.add("shown"));
  });
}
function routerEmitObjective(goalBlock) {
  if (!goalBlock) return;
  const out = document.getElementById("router-out");
  const c = document.createElement("div");
  c.className = "router-chip objective";
  c.innerHTML = `🎯 next: ${BLOCK_ICONS[goalBlock]} ${escapeHtml(BLOCK_NAMES[goalBlock])}`;
  out.appendChild(c);
  schedule(0, () => c.classList.add("shown"));
}

// ───────── 03 VSM ─────────
let vsmShowsCurrent = false;
function renderVSM() {
  const blocksDiv = document.getElementById("vsm-blocks");
  blocksDiv.innerHTML = "";
  let snapshot, prevSnapshot = null;
  const emptySnap = Object.fromEntries(Object.keys(BLOCK_NAMES).map(k => [k, {resolution: "empty", quotes: []}]));
  if (currentTurn === 0) {
    snapshot = emptySnap;
  } else if (vsmShowsCurrent) {
    snapshot = SNAPSHOTS[currentTurn - 1];
    prevSnapshot = currentTurn > 1 ? SNAPSHOTS[currentTurn - 2] : emptySnap;
  } else {
    snapshot = currentTurn > 1 ? SNAPSHOTS[currentTurn - 2] : emptySnap;
  }
  const goalBlock = currentTurn > 0 ? GOAL_BLOCKS[currentTurn - 1] : null;
  const showGoal = vsmShowsCurrent && goalBlock;
  for (const [bid, name] of Object.entries(BLOCK_NAMES)) {
    const s = snapshot[bid];
    const justPromoted = vsmShowsCurrent && prevSnapshot && prevSnapshot[bid].resolution !== s.resolution;
    const isGoal = showGoal && Number(bid) === goalBlock;
    const div = document.createElement("div");
    div.className = `vsm-block ${s.resolution}${justPromoted ? " just-promoted" : ""}${isGoal ? " is-goal" : ""}`;
    div.dataset.block = bid;
    div.innerHTML = `
      <div class="top">
        <span class="icon">${BLOCK_ICONS[bid]}</span>
        <div>
          <div class="name">${escapeHtml(name)}</div>
          <div class="sub">${escapeHtml(BLOCK_FULL[bid].split(' — ')[1] || '')}</div>
        </div>
      </div>
      <span class="pill">${s.resolution}</span>
    `;
    blocksDiv.appendChild(div);
  }
}
function flipVSMToCurrent() {
  vsmShowsCurrent = true;
  renderVSM();
}

// ───────── 05 QUESTIONER ─────────
function clearQuestioner() {
  document.getElementById("quest-cues").classList.remove("shown");
  document.getElementById("next-q-box").classList.remove("shown");
  document.getElementById("alg-pill").className = "cue-pill empty";
  document.getElementById("alg-pill").textContent = "empty";
  document.getElementById("goal-icon").textContent = "–";
  document.getElementById("goal-name").textContent = "none";
  document.getElementById("next-q-text").textContent = "— waiting for objective —";
}
function showCues(algedonicLevel, goalBlock) {
  const algPill = document.getElementById("alg-pill");
  algPill.className = "cue-pill " + algedonicLevel;
  algPill.textContent = algedonicLevel;
  document.getElementById("goal-icon").textContent = goalBlock ? BLOCK_ICONS[goalBlock] : "–";
  document.getElementById("goal-name").textContent = goalBlock ? BLOCK_NAMES[goalBlock] : "none";
  document.getElementById("quest-cues").classList.add("shown");
}
function showNextQ(text) {
  document.getElementById("next-q-text").textContent = text;
  document.getElementById("next-q-box").classList.add("shown");
}

// ───────── ARROWS BETWEEN PANELS ─────────
function panelCenter(id, edge) {
  const el = document.getElementById(id);
  const main = document.querySelector("main");
  if (!el || !main) return null;
  const r = el.getBoundingClientRect();
  const m = main.getBoundingClientRect();
  const cx = r.left + r.width/2 - m.left;
  const cy = r.top + r.height/2 - m.top;
  if (edge === "right")  return {x: r.right - m.left,  y: cy};
  if (edge === "left")   return {x: r.left  - m.left,  y: cy};
  if (edge === "top")    return {x: cx,                y: r.top    - m.top};
  if (edge === "bottom") return {x: cx,                y: r.bottom - m.top};
  return {x: cx, y: cy};
}
function ensureArrowSVGSized() {
  const main = document.querySelector("main");
  const svg = document.getElementById("arrow-svg");
  const m = main.getBoundingClientRect();
  svg.setAttribute("viewBox", `0 0 ${m.width} ${m.height}`);
  svg.setAttribute("width", m.width);
  svg.setAttribute("height", m.height);
}
function clearArrows() {
  document.querySelectorAll(".arrow-path").forEach(p => p.remove());
}
function drawArrow(fromId, fromEdge, toId, toEdge, colorClass, markerId, durMs) {
  ensureArrowSVGSized();
  const a = panelCenter(fromId, fromEdge);
  const b = panelCenter(toId, toEdge);
  if (!a || !b) return;
  // Curve via control point: bow outward
  const dx = b.x - a.x, dy = b.y - a.y;
  const cx = (a.x + b.x) / 2 + (dy > 0 ? 30 : -30);
  const cy = (a.y + b.y) / 2 - 20;
  const svgNS = "http://www.w3.org/2000/svg";
  const path = document.createElementNS(svgNS, "path");
  path.setAttribute("d", `M ${a.x} ${a.y} Q ${cx} ${cy} ${b.x} ${b.y}`);
  path.setAttribute("class", "arrow-path " + colorClass);
  path.setAttribute("marker-end", `url(#${markerId})`);
  document.getElementById("arrow-svg").appendChild(path);
  requestAnimationFrame(() => path.classList.add("shown"));
  setTimeout(() => {
    path.style.opacity = "0";
    setTimeout(() => path.remove(), 300);
  }, durMs);
}

// ───────── PER-TURN CHOREOGRAPHY ─────────
function playTurn() {
  clearStepTimers();
  clearArrows();
  if (currentTurn === 0) return;
  const t = TURNS[currentTurn - 1];
  const promos = PROMOTIONS[currentTurn - 1] || [];
  const goal = GOAL_BLOCKS[currentTurn - 1];
  const alg = ALGEDONIC[currentTurn - 1];

  // 01: user bubble (carry over prior agent question if turn > 1)
  if (currentTurn === 1) clearPhone();
  schedule(T.user_in, () => appendPhoneBubble(escapeHtml(t.user), "user"));

  // 02: signals begin appearing
  clearSignals();
  schedule(T.signals_start, () => showSignals(t.signals || []));

  // arrow 02 → 04
  schedule(T.arrow_02_04, () => drawArrow("panel-02", "right", "panel-04", "left", "signal-color", "arr-signal", 1100));

  // 04: receive signals
  clearRouter();
  schedule(T.router_recv,   () => routerReceiveSignals(t.signals || []));
  schedule(T.router_active, () => routerActivate());

  // arrow 04 → 03 (carries mutations)
  schedule(T.arrow_04_03, () => drawArrow("panel-04", "top", "panel-03", "bottom", "route-color", "arr-route", 900));

  // 03: VSM updates (with pulse) + emit mutation chips on 04 right col
  schedule(T.vsm_update, () => { flipVSMToCurrent(); routerEmitMutations(promos); });

  // arrow 03 → 04 (read next goal)
  schedule(T.arrow_03_04, () => drawArrow("panel-03", "bottom", "panel-04", "top", "goal-color", "arr-goal", 700));

  // 04: emit objective chip
  schedule(T.goal_appear, () => routerEmitObjective(goal));

  // arrow 04 → 05
  schedule(T.arrow_04_05, () => drawArrow("panel-04", "left", "panel-05", "right", "goal-color", "arr-goal", 900));

  // 05: cues + next question
  clearQuestioner();
  schedule(T.cues_appear, () => showCues(alg, goal));
  schedule(T.next_q,      () => showNextQ(t.next_question));

  // arrow 05 → 01 (close the loop)
  schedule(T.arrow_05_01, () => drawArrow("panel-05", "left", "panel-01", "bottom", "quest-color", "arr-quest", 900));

  // agent bubble appears in 01
  schedule(T.agent_bubble, () => appendPhoneBubble(escapeHtml(t.next_question), "agent"));
}

function renderProgress() {
  const p = document.getElementById("progress");
  p.innerHTML = "";
  for (let i = 1; i <= TURNS.length; i++) {
    const d = document.createElement("div");
    d.className = "dot" + (i < currentTurn ? " done" : i === currentTurn ? " current" : "");
    p.appendChild(d);
  }
}
function renderMetrics() {
  document.getElementById("turn-num").textContent = currentTurn;
  document.getElementById("turn-total").textContent = TURNS.length;
  let totalCost = 0, totalIn = 0, totalCacheRead = 0;
  for (let i = 0; i < currentTurn; i++) {
    const c = COSTS[i + 1];
    if (c) {
      totalCost += c.cost_usd || 0;
      totalIn += (c.input_tokens || 0) + (c.cache_read_tokens || 0);
      totalCacheRead += c.cache_read_tokens || 0;
    }
  }
  const cacheHit = totalIn > 0 ? Math.round(100 * totalCacheRead / totalIn) : 0;
  document.getElementById("cost").textContent = "$" + totalCost.toFixed(3);
  document.getElementById("cache").textContent = cacheHit;
  const snap = currentTurn === 0 ? null : SNAPSHOTS[currentTurn - 1];
  const cov = snap ? Object.values(snap).filter(b => b.resolution !== "empty").length : 0;
  document.getElementById("cov").textContent = cov;
}

function render() {
  vsmShowsCurrent = false;
  renderVSM();         // PRIOR snapshot
  playTurn();          // schedules everything
  renderProgress();
  renderMetrics();
  document.getElementById("prev").disabled = currentTurn === 0;
  document.getElementById("next").disabled = currentTurn >= TURNS.length;
  document.getElementById("demo").disabled = demoRunning;
}

function next()  { if (currentTurn < TURNS.length) { currentTurn++; render(); } }
function prev()  { if (currentTurn > 0)            { currentTurn--; render(); } }
function reset() {
  if (demoTimer) { clearTimeout(demoTimer); demoTimer = null; demoRunning = false; }
  clearStepTimers(); clearArrows();
  clearPhone(); clearSignals(); clearRouter(); clearQuestioner();
  currentTurn = 0; render();
}
function runDemo() {
  if (demoRunning) return;
  reset();
  demoRunning = true;
  document.getElementById("demo").textContent = "▶ Demo running…";
  document.getElementById("demo").disabled = true;
  let i = 0;
  const playStep = () => {
    if (i >= DEMO_SEQ.length) {
      demoRunning = false;
      document.getElementById("demo").textContent = "▶ Run demo";
      document.getElementById("demo").disabled = false;
      return;
    }
    const step = DEMO_SEQ[i];
    currentTurn = step.turn;
    render();
    i++;
    demoTimer = setTimeout(playStep, step.dwell);
  };
  playStep();
}

document.getElementById("next").addEventListener("click", next);
document.getElementById("prev").addEventListener("click", prev);
document.getElementById("reset").addEventListener("click", reset);
document.getElementById("demo").addEventListener("click", runDemo);
document.addEventListener("keydown", (e) => {
  if (e.key === "ArrowRight" || e.key === " ") { e.preventDefault(); next(); }
  if (e.key === "ArrowLeft") { e.preventDefault(); prev(); }
  if (e.key === "d") { runDemo(); }
});
window.addEventListener("resize", ensureArrowSVGSized);

ensureArrowSVGSized();
render();
</script>
</body>
</html>
"""


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("session", nargs="?", default=str(DEFAULT_SESSION))
    parser.add_argument("-o", "--out", default=str(DEFAULT_OUT))
    args = parser.parse_args()

    session = Path(args.session)
    if not session.exists():
        raise SystemExit(f"Session dir not found: {session}")

    turns = parse_transcript(session / "transcript.txt")
    if not turns:
        raise SystemExit("No turns parsed")
    snapshots, promotions = replay(turns)
    captions = build_captions(turns, promotions)
    cost_data = parse_costs(session / "costs.jsonl")
    goal_blocks = derive_goal_blocks(turns, promotions)
    algedonic = derive_algedonic(snapshots)

    html = HTML_TEMPLATE
    html = html.replace("__TURNS_JSON__",        json.dumps(turns))
    html = html.replace("__SNAPSHOTS_JSON__",    json.dumps(snapshots))
    html = html.replace("__PROMOTIONS_JSON__",   json.dumps(promotions))
    html = html.replace("__COSTS_JSON__",        json.dumps(cost_data))
    html = html.replace("__BLOCK_NAMES_JSON__",  json.dumps(BLOCK_NAMES))
    html = html.replace("__BLOCK_FULL_JSON__",   json.dumps(BLOCK_FULL))
    html = html.replace("__BLOCK_ICONS_JSON__",  json.dumps(BLOCK_ICONS))
    html = html.replace("__CAPTIONS_JSON__",     json.dumps(captions))
    html = html.replace("__GOAL_BLOCKS_JSON__",  json.dumps(goal_blocks))
    html = html.replace("__ALGEDONIC_JSON__",    json.dumps(algedonic))

    out = Path(args.out)
    out.write_text(html)
    print(f"Wrote {out} ({len(html):,} bytes, {len(turns)} turns)")
    print(f"Open: file://{out.resolve()}")


if __name__ == "__main__":
    main()
