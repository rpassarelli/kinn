"""Build a self-contained HTML demo from a kinn3 session.

Reads a benchmark/calibration session directory (transcript.txt, costs.jsonl)
and emits a single HTML file with embedded data + JS for stepping through turns.

Layout (per user sketch):
    ┌────────────────────────┬───────────────────┐
    │                        │   MODEL (VSM)     │
    │                        ├──────┬────────────┤
    │   CHAT (Q&A, big)      │DELTAS│ NEXT MOVE  │
    │                        │ (RPG)│            │
    │                        ├──────┴────────────┤
    │                        │  ARCHITECTURE     │
    │                        │  (pipeline anim)  │
    └────────────────────────┴───────────────────┘

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
    2: "Purpose / S5",
    3: "Change Moment",
    4: "Algedonic",
    5: "Vertical Coherence",
    6: "Horizontal Viability",
}

BLOCK_ICONS = {
    1: "🎯",  # Market
    2: "🧭",  # Purpose
    3: "⚡",  # Change Moment
    4: "💢",  # Algedonic (pain)
    5: "🪜",  # Vertical Coherence
    6: "⚙️",  # Horizontal Viability (ops)
}

RESOLUTION_RANK = {"empty": 0, "low": 1, "mid": 2, "high": 3}


def parse_transcript(path: Path) -> list[dict]:
    """Parse transcript.txt into a list of turn dicts."""
    text = path.read_text()
    turns = []
    pattern = re.compile(r"### Turn (\d+)\n(.*?)(?=### Turn \d+|\Z)", re.DOTALL)
    for m in pattern.finditer(text):
        turn_n = int(m.group(1))
        body = m.group(2).strip()
        user_match = re.search(r"^USER:\s*(.*?)(?=\nAGENT:)", body, re.DOTALL)
        agent_match = re.search(r"^AGENT:\s*(.+)$", body, re.MULTILINE | re.DOTALL)
        if not user_match or not agent_match:
            continue
        try:
            agent = json.loads(agent_match.group(1).strip())
        except json.JSONDecodeError:
            continue
        turns.append({
            "turn": turn_n,
            "user": user_match.group(1).strip(),
            "heard": agent.get("heard", []),
            "delta": agent.get("delta", ""),
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


def replay_belief(turns: list[dict]) -> list[dict]:
    """Replay signal_mutations to produce per-turn belief snapshots + per-turn promotions."""
    state = {i: {"resolution": "empty", "quotes": []} for i in range(1, 7)}
    snapshots = []
    promotions_per_turn = []  # list of [{block, from, to, delta_rank, quote}]
    for turn in turns:
        prior = {b: s["resolution"] for b, s in state.items()}
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
                        "block": blk,
                        "from": state[blk]["resolution"],
                        "to": new_res,
                        "delta_rank": new_rank - old_rank,
                        "quote": quote,
                    })
                if new_rank >= old_rank:
                    state[blk]["resolution"] = new_res
                if quote and quote not in state[blk]["quotes"]:
                    state[blk]["quotes"].append(quote)
        snapshots.append({b: {"resolution": s["resolution"], "quotes": list(s["quotes"])}
                          for b, s in state.items()})
        promotions_per_turn.append(promos)
    return snapshots, promotions_per_turn


HTML_TEMPLATE = r"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>kinn3 — diagnostic interview demo</title>
<style>
:root {
  --bg: #0b0e13;
  --panel: #161b22;
  --panel-2: #1c2128;
  --panel-3: #21262d;
  --border: #30363d;
  --border-strong: #484f58;
  --text: #e6edf3;
  --text-dim: #8b949e;
  --text-muted: #6e7681;
  --user: #58a6ff;
  --agent: #d2a8ff;
  --gold: #ffd33d;
  --empty: #30363d;
  --low: #d29922;
  --mid: #58a6ff;
  --high: #3fb950;
  --pipe-active: #ffd33d;
  --pipe-done: #3fb950;
}
* { box-sizing: border-box; margin: 0; padding: 0; }
html, body {
  background: var(--bg); color: var(--text);
  font-family: -apple-system, BlinkMacSystemFont, "Inter", "Segoe UI", system-ui, sans-serif;
  height: 100%; overflow: hidden;
}
body { display: flex; flex-direction: column; }

/* ── Header ─────────────────────────────────────── */
header {
  padding: 14px 24px; border-bottom: 1px solid var(--border);
  display: flex; align-items: center; justify-content: space-between;
  background: var(--panel); flex-shrink: 0;
}
header h1 {
  font-size: 18px; font-weight: 700; letter-spacing: -0.01em;
}
header h1 .v {
  color: var(--text-dim); font-weight: 400; margin-left: 10px; font-size: 13px;
}
header .meta {
  font-size: 12px; color: var(--text-dim);
  font-family: ui-monospace, "SF Mono", Menlo, monospace;
}

/* ── Layout grid (sketch) ───────────────────────── */
main {
  flex: 1; display: grid;
  grid-template-columns: 1.4fr 1fr;
  grid-template-rows: 1fr 1fr 1fr;
  grid-template-areas:
    "chat model"
    "chat deltas-next"
    "chat architecture";
  gap: 1px; background: var(--border); overflow: hidden;
}
#chat-pane    { grid-area: chat;          background: var(--bg);       overflow-y: auto; padding: 32px; }
#model-pane   { grid-area: model;         background: var(--panel);    overflow-y: auto; padding: 16px; }
#deltas-next  { grid-area: deltas-next;   background: var(--panel);    display: grid;   grid-template-columns: 1fr 1fr; gap: 1px; }
#deltas-pane  { background: var(--panel); overflow-y: auto; padding: 16px; }
#next-pane    { background: var(--panel); overflow-y: auto; padding: 16px; }
#arch-pane    { grid-area: architecture;  background: var(--panel-2);  padding: 16px; overflow: hidden; }

/* ── Pane titles ────────────────────────────────── */
.pane-title {
  font-size: 10px; text-transform: uppercase; letter-spacing: 0.14em;
  color: var(--text-dim); margin-bottom: 12px; font-family: ui-monospace, monospace;
  font-weight: 600;
}

/* ── CHAT ───────────────────────────────────────── */
#chat-pane .turn-marker {
  font-size: 11px; color: var(--text-muted); text-transform: uppercase;
  letter-spacing: 0.15em; font-family: ui-monospace, monospace;
  text-align: center; margin: 24px 0 16px; position: relative;
}
#chat-pane .turn-marker::before, #chat-pane .turn-marker::after {
  content: ""; position: absolute; top: 50%; width: 35%; height: 1px; background: var(--border);
}
#chat-pane .turn-marker::before { left: 0; }
#chat-pane .turn-marker::after { right: 0; }

#chat-pane .msg {
  margin: 16px 0; padding: 18px 22px; border-radius: 14px;
  border: 1px solid var(--border); line-height: 1.6;
  white-space: pre-wrap;
}
#chat-pane .msg.user {
  background: rgba(88, 166, 255, 0.07); border-color: rgba(88, 166, 255, 0.25);
  font-size: 17px; font-weight: 400;
  margin-right: 8%;
}
#chat-pane .msg.user::before {
  content: "👤 STAKEHOLDER";
  display: block; font-size: 10px; font-weight: 700; letter-spacing: 0.12em;
  color: var(--user); margin-bottom: 10px; font-family: ui-monospace, monospace;
}
#chat-pane .msg.agent {
  background: rgba(210, 168, 255, 0.06); border-color: rgba(210, 168, 255, 0.3);
  font-size: 19px; font-weight: 500; color: var(--text);
  margin-left: 8%;
}
#chat-pane .msg.agent::before {
  content: "🤖 KINN3 ASKS";
  display: block; font-size: 10px; font-weight: 700; letter-spacing: 0.12em;
  color: var(--agent); margin-bottom: 10px; font-family: ui-monospace, monospace;
}
#chat-pane .empty-state {
  text-align: center; padding: 40px; color: var(--text-muted);
  font-style: italic;
}

/* ── MODEL (VSM blocks, badges only) ────────────── */
.vsm-grid {
  display: grid; grid-template-columns: 1fr 1fr; gap: 8px;
}
.vsm-block {
  background: var(--panel-2); border: 1px solid var(--border); border-radius: 8px;
  padding: 10px 12px; transition: all 0.4s ease; position: relative;
}
.vsm-block.empty { opacity: 0.45; }
.vsm-block.low  { border-left: 3px solid var(--low);  background: rgba(210,153,34,0.06); }
.vsm-block.mid  { border-left: 3px solid var(--mid);  background: rgba(88,166,255,0.07); }
.vsm-block.high { border-left: 3px solid var(--high); background: rgba(63,185,80,0.08); }
.vsm-block.just-promoted {
  animation: vsm-pulse 1.4s ease;
}
@keyframes vsm-pulse {
  0%   { transform: scale(1);    box-shadow: 0 0 0 0 rgba(63,185,80,0.7); }
  50%  { transform: scale(1.04); box-shadow: 0 0 0 12px rgba(63,185,80,0); }
  100% { transform: scale(1);    box-shadow: 0 0 0 0 rgba(63,185,80,0); }
}
.vsm-block .header {
  display: flex; align-items: center; gap: 6px; margin-bottom: 4px;
}
.vsm-block .icon { font-size: 16px; }
.vsm-block .name { font-size: 12px; font-weight: 600; }
.vsm-block .pill {
  font-size: 9px; text-transform: uppercase; letter-spacing: 0.1em; font-weight: 700;
  padding: 2px 6px; border-radius: 8px; font-family: ui-monospace, monospace;
  display: inline-block;
}
.vsm-block.empty .pill { background: var(--empty);                     color: var(--text-muted); }
.vsm-block.low   .pill { background: rgba(210,153,34,0.25);            color: var(--low); }
.vsm-block.mid   .pill { background: rgba(88,166,255,0.25);            color: var(--mid); }
.vsm-block.high  .pill { background: rgba(63,185,80,0.25);             color: var(--high); }
.vsm-block .meter {
  height: 4px; background: var(--border); border-radius: 2px; overflow: hidden;
  margin-top: 8px;
}
.vsm-block .meter-fill {
  height: 100%; transition: width 0.6s ease, background 0.4s ease;
  border-radius: 2px;
}
.vsm-block.empty .meter-fill { width: 0%;   background: var(--empty); }
.vsm-block.low   .meter-fill { width: 33%;  background: var(--low); }
.vsm-block.mid   .meter-fill { width: 66%;  background: var(--mid); }
.vsm-block.high  .meter-fill { width: 100%; background: var(--high); }

/* ── DELTAS (RPG-style promotions) ──────────────── */
#deltas-pane .delta-empty {
  color: var(--text-muted); font-size: 12px; padding: 12px;
  font-style: italic; text-align: center;
}
.delta-card {
  background: linear-gradient(135deg, rgba(255,211,61,0.08), rgba(63,185,80,0.05));
  border: 1px solid rgba(255,211,61,0.25); border-radius: 8px;
  padding: 10px 12px; margin-bottom: 8px;
  animation: delta-pop 0.6s cubic-bezier(0.34, 1.56, 0.64, 1);
}
@keyframes delta-pop {
  0%   { opacity: 0; transform: translateX(20px) scale(0.85); }
  60%  { opacity: 1; transform: translateX(0) scale(1.05); }
  100% { opacity: 1; transform: translateX(0) scale(1); }
}
.delta-card .top {
  display: flex; align-items: center; justify-content: space-between; gap: 8px;
  margin-bottom: 4px;
}
.delta-card .label {
  font-size: 12px; font-weight: 700; display: flex; align-items: center; gap: 4px;
}
.delta-card .gain {
  font-size: 11px; font-weight: 800; color: var(--gold); font-family: ui-monospace, monospace;
}
.delta-card .arrow {
  font-size: 11px; font-family: ui-monospace, monospace;
  display: flex; gap: 6px; align-items: center; margin-bottom: 6px;
}
.delta-card .from-pill, .delta-card .to-pill {
  padding: 2px 6px; border-radius: 6px; font-weight: 700; text-transform: uppercase;
  letter-spacing: 0.1em; font-size: 9px;
}
.delta-card .from-pill { background: var(--empty); color: var(--text-muted); }
.delta-card .to-pill   { background: rgba(63,185,80,0.25); color: var(--high); }
.delta-card .quote {
  font-size: 11px; font-style: italic; color: var(--text-dim);
  border-left: 2px solid rgba(255,211,61,0.4); padding-left: 8px;
  margin-top: 4px; line-height: 1.4;
}

/* ── NEXT MOVE ──────────────────────────────────── */
#next-pane .next-card {
  background: linear-gradient(135deg, rgba(210,168,255,0.07), rgba(88,166,255,0.04));
  border: 1px solid rgba(210,168,255,0.3); border-radius: 8px;
  padding: 12px;
}
#next-pane .next-line {
  font-size: 10px; color: var(--text-dim); text-transform: uppercase;
  letter-spacing: 0.1em; font-family: ui-monospace, monospace; margin-bottom: 8px;
}
#next-pane .next-q {
  font-size: 14px; font-weight: 600; line-height: 1.4; color: var(--text);
  padding: 8px 0; border-top: 1px solid rgba(210,168,255,0.15);
  border-bottom: 1px solid rgba(210,168,255,0.15); margin: 8px 0;
}
#next-pane .strategy {
  font-size: 11px; color: var(--text-dim); display: flex; flex-wrap: wrap; gap: 4px 12px;
  font-family: ui-monospace, monospace; margin-top: 6px;
}
#next-pane .strategy span b { color: var(--agent); margin-left: 3px; }
#next-pane .empty-next {
  color: var(--text-muted); font-size: 12px; padding: 12px;
  font-style: italic; text-align: center;
}

/* ── ARCHITECTURE pipeline ──────────────────────── */
#arch-pane { display: flex; flex-direction: column; }
.pipeline {
  display: grid; grid-template-columns: repeat(7, 1fr); gap: 4px;
  align-items: stretch; flex: 1; padding-top: 4px;
}
.pipe-step {
  background: var(--panel-3); border: 1px solid var(--border); border-radius: 6px;
  padding: 8px 6px; text-align: center; position: relative;
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  transition: all 0.5s ease;
}
.pipe-step .pipe-icon { font-size: 18px; margin-bottom: 4px; }
.pipe-step .pipe-name {
  font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.04em;
  color: var(--text-dim);
}
.pipe-step .pipe-meta {
  font-size: 9px; color: var(--text-muted); margin-top: 2px;
  font-family: ui-monospace, monospace;
}
.pipe-step.active {
  background: rgba(255,211,61,0.15); border-color: var(--pipe-active);
  box-shadow: 0 0 18px rgba(255,211,61,0.4);
  transform: scale(1.06);
}
.pipe-step.active .pipe-name { color: var(--pipe-active); }
.pipe-step.done {
  border-color: rgba(63,185,80,0.5); background: rgba(63,185,80,0.06);
}
.pipe-step.done .pipe-name { color: var(--high); }
.pipe-arrow {
  align-self: center; color: var(--border-strong); font-size: 16px;
}

/* ── Footer ─────────────────────────────────────── */
footer {
  padding: 12px 24px; border-top: 1px solid var(--border); background: var(--panel);
  display: flex; align-items: center; justify-content: space-between; gap: 16px;
  font-family: ui-monospace, monospace; font-size: 12px; flex-shrink: 0;
}
.controls { display: flex; gap: 8px; align-items: center; }
.btn {
  background: var(--panel-2); color: var(--text); border: 1px solid var(--border);
  padding: 7px 14px; border-radius: 6px; cursor: pointer; font-family: inherit;
  font-size: 12px; font-weight: 600; letter-spacing: 0.04em;
}
.btn:hover:not(:disabled) { background: var(--border); }
.btn:disabled { opacity: 0.4; cursor: not-allowed; }
.btn.primary { background: var(--user); color: var(--bg); border-color: var(--user); }
.btn.primary:hover:not(:disabled) { background: #79b8ff; }
.metrics { display: flex; gap: 18px; color: var(--text-dim); }
.metrics b { color: var(--text); margin-left: 4px; font-weight: 600; }
.progress { display: flex; gap: 3px; flex: 1; max-width: 240px; margin: 0 16px; }
.progress .dot {
  flex: 1; height: 6px; background: var(--empty); border-radius: 3px; transition: background 0.3s;
}
.progress .dot.done { background: var(--mid); }
.progress .dot.current { background: var(--gold); }
</style>
</head>
<body>
<header>
  <h1>kinn3 <span class="v">— BED-LLM diagnostic interview · dental-clinic</span></h1>
  <div class="meta">v0.1 · Opus 4.7 · adaptive thinking · prompt caching</div>
</header>
<main>
  <div id="chat-pane">
    <div class="empty-state">Press <b>Next Turn ▶</b> to begin the interview.</div>
  </div>

  <div id="model-pane">
    <div class="pane-title">VSM Image · 6 Blocks</div>
    <div class="vsm-grid" id="vsm-blocks"></div>
  </div>

  <div id="deltas-next">
    <div id="deltas-pane">
      <div class="pane-title">⚡ Image Shifts (Δ)</div>
      <div id="deltas-list"><div class="delta-empty">Waiting for first turn…</div></div>
    </div>
    <div id="next-pane">
      <div class="pane-title">🎯 Kinn3's Next Move</div>
      <div id="next-content"><div class="empty-next">Awaiting probe selection…</div></div>
    </div>
  </div>

  <div id="arch-pane">
    <div class="pane-title">⚙️ Architecture · Per-turn pipeline</div>
    <div class="pipeline" id="pipeline"></div>
  </div>
</main>
<footer>
  <div class="controls">
    <button class="btn" id="prev">◀ Prev</button>
    <button class="btn primary" id="next">Next Turn ▶</button>
    <button class="btn" id="play">▶ Auto-play</button>
    <button class="btn" id="reset">↺ Reset</button>
  </div>
  <div class="progress" id="progress"></div>
  <div class="metrics">
    <span>turn <b id="turn-num">0</b>/<span id="turn-total">0</span></span>
    <span>cost <b id="cost">$0.000</b></span>
    <span>cache <b id="cache">0</b>%</span>
    <span>blocks <b id="cov">0</b>/6</span>
  </div>
</footer>
<script>
const TURNS = __TURNS_JSON__;
const SNAPSHOTS = __SNAPSHOTS_JSON__;
const PROMOTIONS = __PROMOTIONS_JSON__;
const COSTS = __COSTS_JSON__;
const BLOCK_NAMES = __BLOCK_NAMES_JSON__;
const BLOCK_ICONS = __BLOCK_ICONS_JSON__;

let currentTurn = 0;        // 0 = nothing shown; 1..N = turn N visible
let autoplayTimer = null;
let archAnimTimer = null;

function escapeHtml(s) {
  return (s || "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"})[c]);
}

// ── CHAT ───────────────────────────────────────────────
function renderChat() {
  const pane = document.getElementById("chat-pane");
  if (currentTurn === 0) {
    pane.innerHTML = '<div class="empty-state">Press <b>Next Turn ▶</b> to begin the interview.</div>';
    return;
  }
  pane.innerHTML = "";
  for (let i = 0; i < currentTurn; i++) {
    const t = TURNS[i];
    const turnEl = document.createElement("div");
    turnEl.innerHTML = `
      <div class="turn-marker">Turn ${t.turn}</div>
      <div class="msg user">${escapeHtml(t.user)}</div>
      <div class="msg agent">${escapeHtml(t.next_question)}</div>
    `;
    pane.appendChild(turnEl);
  }
  pane.scrollTop = pane.scrollHeight;
}

// ── MODEL (VSM blocks) ────────────────────────────────
function renderVSM() {
  const blocksDiv = document.getElementById("vsm-blocks");
  blocksDiv.innerHTML = "";
  const snapshot = currentTurn === 0
    ? Object.fromEntries(Object.keys(BLOCK_NAMES).map(k => [k, {resolution: "empty", quotes: []}]))
    : SNAPSHOTS[currentTurn - 1];
  const prevSnapshot = currentTurn > 1 ? SNAPSHOTS[currentTurn - 2] : null;

  for (const [bid, name] of Object.entries(BLOCK_NAMES)) {
    const s = snapshot[bid];
    const justPromoted = prevSnapshot && prevSnapshot[bid].resolution !== s.resolution;
    const div = document.createElement("div");
    div.className = `vsm-block ${s.resolution}${justPromoted ? " just-promoted" : ""}`;
    div.innerHTML = `
      <div class="header">
        <span class="icon">${BLOCK_ICONS[bid]}</span>
        <span class="name">${bid}. ${escapeHtml(name)}</span>
      </div>
      <span class="pill">${s.resolution}</span>
      <div class="meter"><div class="meter-fill"></div></div>
    `;
    blocksDiv.appendChild(div);
  }
}

// ── DELTAS (RPG-style promotions of THIS turn) ────────
function renderDeltas() {
  const list = document.getElementById("deltas-list");
  if (currentTurn === 0) {
    list.innerHTML = '<div class="delta-empty">Waiting for first turn…</div>';
    return;
  }
  const promos = PROMOTIONS[currentTurn - 1];
  if (!promos.length) {
    list.innerHTML = '<div class="delta-empty">No image shift this turn.</div>';
    return;
  }
  list.innerHTML = "";
  for (const p of promos) {
    const card = document.createElement("div");
    card.className = "delta-card";
    card.innerHTML = `
      <div class="top">
        <div class="label">${BLOCK_ICONS[p.block]} Block ${p.block} — ${escapeHtml(BLOCK_NAMES[p.block])}</div>
        <div class="gain">+${p.delta_rank}</div>
      </div>
      <div class="arrow">
        <span class="from-pill">${p.from}</span>
        <span>→</span>
        <span class="to-pill">${p.to}</span>
      </div>
      ${p.quote ? `<div class="quote">"${escapeHtml(p.quote)}"</div>` : ""}
    `;
    list.appendChild(card);
  }
}

// ── NEXT MOVE ─────────────────────────────────────────
function renderNext() {
  const div = document.getElementById("next-content");
  if (currentTurn === 0 || currentTurn > TURNS.length) {
    div.innerHTML = '<div class="empty-next">Awaiting probe selection…</div>';
    return;
  }
  const t = TURNS[currentTurn - 1];
  // Heuristic for target block: the block last promoted in this turn,
  // or block 1 if none. (Real next-probe logic happens BED-LLM-side.)
  let targetBlock = "?", strategy = "explore";
  if (t.signal_mutations && t.signal_mutations.length) {
    targetBlock = t.signal_mutations[t.signal_mutations.length - 1].block;
    const tb = parseInt(targetBlock);
    if (SNAPSHOTS[currentTurn - 1][tb]?.resolution === "high") {
      strategy = "advance · open new block";
    } else {
      strategy = "deepen · refine block " + tb;
    }
  }
  div.innerHTML = `
    <div class="next-card">
      <div class="next-line">After processing this turn, kinn3 will ask:</div>
      <div class="next-q">${escapeHtml(t.next_question)}</div>
      <div class="strategy">
        <span>target<b>Block ${targetBlock}</b></span>
        <span>strategy<b>${strategy}</b></span>
        <span>turn<b>${t.turn + 1}</b></span>
      </div>
    </div>
  `;
}

// ── ARCHITECTURE pipeline ─────────────────────────────
const PIPELINE_STEPS = [
  {key: "user",     icon: "👤", name: "Stakeholder",    meta: "user msg"},
  {key: "reground", icon: "🛟", name: "Reground?",      meta: "fatigue check"},
  {key: "bed",      icon: "🧮", name: "BED-LLM",        meta: "EIG · argmax"},
  {key: "tool",     icon: "🔧", name: "Forced Tool",    meta: "no thinking"},
  {key: "validate", icon: "✅", name: "Pydantic",       meta: "schema gate"},
  {key: "mutate",   icon: "🧬", name: "Mutate Belief",  meta: "apply Δ"},
  {key: "next",     icon: "🎯", name: "Next Probe",     meta: "queue"},
];

function renderPipeline(activeIdx = -1, doneCount = 0) {
  const p = document.getElementById("pipeline");
  p.innerHTML = "";
  PIPELINE_STEPS.forEach((step, i) => {
    const isActive = i === activeIdx;
    const isDone   = i < doneCount && !isActive;
    const div = document.createElement("div");
    div.className = `pipe-step${isActive ? " active" : ""}${isDone ? " done" : ""}`;
    div.innerHTML = `
      <div class="pipe-icon">${step.icon}</div>
      <div class="pipe-name">${step.name}</div>
      <div class="pipe-meta">${step.meta}</div>
    `;
    p.appendChild(div);
    if (i < PIPELINE_STEPS.length - 1) {
      const arrow = document.createElement("div");
      arrow.className = "pipe-arrow";
      arrow.textContent = "›";
      // Spans an extra grid track? Cheaper: append inside the next slot using order
      // For simplicity, omit the arrow here; the spacing already gives flow.
    }
  });
}

function animatePipeline() {
  if (archAnimTimer) clearTimeout(archAnimTimer);
  if (currentTurn === 0) { renderPipeline(); return; }
  let step = 0;
  const tick = () => {
    renderPipeline(step, step);
    step++;
    if (step < PIPELINE_STEPS.length) {
      archAnimTimer = setTimeout(tick, 380);
    } else {
      // All done
      renderPipeline(-1, PIPELINE_STEPS.length);
    }
  };
  tick();
}

// ── PROGRESS + METRICS ─────────────────────────────────
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
  renderChat();
  renderVSM();
  renderDeltas();
  renderNext();
  renderProgress();
  renderMetrics();
  animatePipeline();
  document.getElementById("prev").disabled = currentTurn === 0;
  document.getElementById("next").disabled = currentTurn >= TURNS.length;
}

function next() {
  if (currentTurn < TURNS.length) {
    currentTurn++;
    render();
  } else {
    stopAutoplay();
  }
}
function prev() {
  if (currentTurn > 0) {
    currentTurn--;
    render();
  }
}
function reset() {
  stopAutoplay();
  currentTurn = 0;
  render();
}
function toggleAutoplay() {
  if (autoplayTimer) {
    stopAutoplay();
  } else {
    document.getElementById("play").textContent = "⏸ Pause";
    autoplayTimer = setInterval(next, 5000);
    next();
  }
}
function stopAutoplay() {
  if (autoplayTimer) clearInterval(autoplayTimer);
  autoplayTimer = null;
  document.getElementById("play").textContent = "▶ Auto-play";
}

document.getElementById("next").addEventListener("click", next);
document.getElementById("prev").addEventListener("click", prev);
document.getElementById("play").addEventListener("click", toggleAutoplay);
document.getElementById("reset").addEventListener("click", reset);
document.addEventListener("keydown", (e) => {
  if (e.key === "ArrowRight" || e.key === " ") { e.preventDefault(); next(); }
  if (e.key === "ArrowLeft") { e.preventDefault(); prev(); }
});

render();
</script>
</body>
</html>
"""


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("session", nargs="?", default=str(DEFAULT_SESSION),
                        help="Session directory (default: calibration-runs/benchmark/dental-clinic)")
    parser.add_argument("-o", "--out", default=str(DEFAULT_OUT),
                        help="Output HTML file (default: demo.html)")
    args = parser.parse_args()

    session = Path(args.session)
    if not session.exists():
        raise SystemExit(f"Session dir not found: {session}")

    transcript = session / "transcript.txt"
    costs = session / "costs.jsonl"

    turns = parse_transcript(transcript)
    if not turns:
        raise SystemExit(f"No turns parsed from {transcript}")

    snapshots, promotions = replay_belief(turns)
    cost_data = parse_costs(costs)

    html = HTML_TEMPLATE
    html = html.replace("__TURNS_JSON__", json.dumps(turns))
    html = html.replace("__SNAPSHOTS_JSON__", json.dumps(snapshots))
    html = html.replace("__PROMOTIONS_JSON__", json.dumps(promotions))
    html = html.replace("__COSTS_JSON__", json.dumps(cost_data))
    html = html.replace("__BLOCK_NAMES_JSON__", json.dumps(BLOCK_NAMES))
    html = html.replace("__BLOCK_ICONS_JSON__", json.dumps(BLOCK_ICONS))

    out = Path(args.out)
    out.write_text(html)
    print(f"Wrote {out} ({len(html):,} bytes, {len(turns)} turns)")
    print(f"Open with: file://{out.resolve()}")


if __name__ == "__main__":
    main()
