"""Build a self-contained narrative HTML demo from a kinn3 session.

Designed for a 30-second presentation window. Three panels only:
    - LEFT:   Conversation (one stakeholder reply, one kinn3 question)
    - RIGHT:  Model (VSM 6-block picture forming live)
    - BOTTOM: Caption (explicit narration of what just happened)

Plus a curated DEMO MODE that auto-plays the 4 most dramatic turns with
timed captions so a judge can grasp the story in 30s without context.

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
    """Extract the 3 most stakeholder-y signals from a `heard` list.

    Each `heard` entry usually has shape `'<quote>' — <interpretation>`. The quote
    itself often contains contractions ("I'm tired", "can't hire") that confuse
    a non-greedy regex on apostrophes.

    Heuristic: find the FIRST opening quote and the LAST matching closing quote
    in the string — everything between is the stakeholder's words. The
    interpretation tail rarely uses quote characters, so this is robust.
    """
    out = []
    for h in heard[:max_signals]:
        quote = None
        # Try each quote-pair shape, prefer the one with the longest span.
        for opener, closer in [("'", "'"), ('"', '"'), ("‘", "’"), ("“", "”")]:
            first = h.find(opener)
            last = h.rfind(closer)
            if first != -1 and last > first:
                candidate = h[first + 1:last].strip()
                if not quote or len(candidate) > len(quote):
                    quote = candidate
        if not quote:
            # Fallback: strip the dash-separated interpretation tail.
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
            "user": u.group(1).strip(),         # full text (kept for archival, unused in UI)
            "signals": _extract_signals(heard), # 3 bullet points for stakeholder bubble
            "thinking": agent.get("delta", ""), # kinn3's reasoning summary
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
    """Snapshots + per-turn promotions."""
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


def build_captions(turns, promotions):
    """One human-readable caption per turn explaining the dominant promotion."""
    caps = []
    for i, t in enumerate(turns):
        promos = promotions[i]
        if not promos:
            caps.append("Listening — no image shift this turn.")
            continue
        # Pick the highest-rank promotion as the headline
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
  padding: 12px 24px; border-bottom: 1px solid var(--border);
  display: flex; align-items: center; justify-content: space-between;
  background: var(--panel); flex-shrink: 0;
}
header h1 { font-size: 17px; font-weight: 700; letter-spacing: -0.01em; }
header h1 .v { color: var(--text-dim); font-weight: 400; margin-left: 10px; font-size: 13px; }
header .meta {
  font-size: 11px; color: var(--text-dim);
  font-family: ui-monospace, "SF Mono", monospace;
}

/* ── Main grid: chat + model ────────────────────── */
main {
  flex: 1; display: grid; grid-template-columns: 1fr 1fr; gap: 1px;
  background: var(--border); overflow: hidden;
}
#chat-pane  { background: var(--bg);    overflow-y: auto; padding: 32px 36px; display: flex; flex-direction: column; gap: 28px; }
#model-pane { background: var(--panel); padding: 28px 32px; display: flex; flex-direction: column; }

/* ── CHAT (vertical flow diagram) ───────────────── */
.empty-chat {
  margin: auto; text-align: center; color: var(--text-muted); font-style: italic;
  font-size: 16px;
}
.flow {
  display: flex; flex-direction: column; align-items: stretch; gap: 0;
}
.flow .turn-tag {
  font-size: 10px; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.2em;
  font-family: ui-monospace, monospace; text-align: center; margin-bottom: 16px;
}
.step {
  border: 1px solid var(--border); border-radius: 14px;
  padding: 18px 22px; opacity: 0; transform: translateY(8px);
  transition: opacity 0.5s ease, transform 0.5s ease;
}
.step.shown { opacity: 1; transform: translateY(0); }
.step .step-label {
  font-size: 10px; font-weight: 700; letter-spacing: 0.18em;
  margin-bottom: 12px; font-family: ui-monospace, monospace;
}
.connector {
  text-align: center; color: var(--border); font-size: 22px;
  margin: 6px 0; opacity: 0; transition: opacity 0.4s ease;
}
.connector.shown { opacity: 1; }

/* ① INPUT — stakeholder signals */
.step.input  { background: rgba(88,166,255,0.06); border-color: rgba(88,166,255,0.3); }
.step.input  .step-label { color: var(--user); }
.signals { list-style: none; padding: 0; margin: 0; }
.signals li {
  font-size: 16px; font-weight: 500; line-height: 1.45;
  padding: 5px 0 5px 22px; position: relative;
}
.signals li::before {
  content: "›"; position: absolute; left: 4px; top: 2px;
  color: var(--user); font-weight: 700; font-size: 18px;
}

/* ② UNDERSTOOD + DELTA */
.step.understand { background: rgba(210,168,255,0.06); border-color: rgba(210,168,255,0.35); }
.step.understand .step-label { color: var(--agent); }
.thinking-text {
  font-size: 13px; line-height: 1.5; color: var(--text-dim);
  font-family: ui-monospace, "SF Mono", monospace;
  background: rgba(0,0,0,0.25); padding: 10px 14px; border-radius: 8px;
  border-left: 3px solid var(--agent); margin-bottom: 14px;
}
.delta-chips {
  display: flex; flex-wrap: wrap; gap: 8px; align-items: center;
}
.delta-chip {
  display: inline-flex; align-items: center; gap: 6px;
  background: linear-gradient(135deg, rgba(255,211,61,0.18), rgba(63,185,80,0.12));
  border: 1px solid rgba(255,211,61,0.5); border-radius: 22px;
  padding: 6px 12px; font-size: 13px; font-weight: 700;
  font-family: ui-monospace, monospace; color: var(--text);
  position: relative;
}
.delta-chip .arrow { color: var(--text-muted); margin: 0 2px; }
.delta-chip .to {
  font-size: 10px; padding: 2px 6px; border-radius: 8px;
  background: rgba(63,185,80,0.3); color: var(--high); letter-spacing: 0.1em;
}
.delta-chip.flying { opacity: 0; }
.delta-empty {
  color: var(--text-muted); font-size: 12px; font-style: italic;
}

/* ③ OUTPUT — next question */
.step.output  { background: rgba(63,185,80,0.06); border-color: rgba(63,185,80,0.4); }
.step.output  .step-label { color: var(--high); }
.next-q-text {
  font-size: 22px; font-weight: 600; line-height: 1.35; color: var(--text);
  padding: 4px 0;
}

/* ── Flying particles (delta → VSM block) ───────── */
.particle {
  position: fixed; z-index: 1000; pointer-events: none;
  background: linear-gradient(135deg, var(--gold), var(--high));
  color: #1a1500; font-weight: 800; font-size: 11px;
  font-family: ui-monospace, monospace;
  padding: 5px 10px; border-radius: 12px;
  box-shadow: 0 4px 20px rgba(255,211,61,0.6);
  transition: transform 1.0s cubic-bezier(0.4, 0.0, 0.2, 1), opacity 0.3s ease;
}

/* ── MODEL (big VSM) ────────────────────────────── */
#model-pane .pane-title {
  font-size: 11px; text-transform: uppercase; letter-spacing: 0.2em;
  color: var(--text-dim); margin-bottom: 4px; font-family: ui-monospace, monospace; font-weight: 600;
}
#model-pane .pane-sub {
  font-size: 13px; color: var(--text-muted); margin-bottom: 20px;
}
.vsm-grid {
  display: grid; grid-template-columns: 1fr 1fr;
  gap: 14px; flex: 1;
}
.vsm-block {
  background: var(--panel-2); border: 2px solid var(--border); border-radius: 14px;
  padding: 18px 20px; transition: all 0.5s cubic-bezier(0.34, 1.56, 0.64, 1);
  display: flex; flex-direction: column; justify-content: space-between;
  position: relative; overflow: hidden;
}
.vsm-block .block-num {
  position: absolute; top: 12px; right: 16px;
  font-family: ui-monospace, monospace; font-size: 11px; color: var(--text-muted);
  letter-spacing: 0.05em;
}
.vsm-block .top { display: flex; align-items: center; gap: 10px; }
.vsm-block .icon { font-size: 26px; }
.vsm-block .name { font-size: 16px; font-weight: 700; }
.vsm-block .sub  { font-size: 11px; color: var(--text-muted); margin-top: 2px; }
.vsm-block .pill {
  font-size: 10px; text-transform: uppercase; letter-spacing: 0.18em; font-weight: 800;
  padding: 4px 10px; border-radius: 14px; font-family: ui-monospace, monospace;
  display: inline-block; align-self: flex-start; margin-top: 12px;
}
.vsm-block.empty { opacity: 0.4; border-style: dashed; }
.vsm-block.empty .pill { background: var(--empty); color: var(--text-muted); }
.vsm-block.low  { border-color: var(--low);  background: linear-gradient(135deg, rgba(210,153,34,0.08), var(--panel-2)); }
.vsm-block.low  .pill { background: rgba(210,153,34,0.25); color: var(--low); }
.vsm-block.mid  { border-color: var(--mid);  background: linear-gradient(135deg, rgba(88,166,255,0.10), var(--panel-2)); }
.vsm-block.mid  .pill { background: rgba(88,166,255,0.25); color: var(--mid); }
.vsm-block.high { border-color: var(--high); background: linear-gradient(135deg, rgba(63,185,80,0.13), var(--panel-2)); }
.vsm-block.high .pill { background: rgba(63,185,80,0.28); color: var(--high); }
.vsm-block.just-promoted {
  animation: vsm-pulse 1.6s ease;
}
@keyframes vsm-pulse {
  0%   { transform: scale(1);    box-shadow: 0 0 0 0 rgba(255,211,61,0.7); }
  40%  { transform: scale(1.06); box-shadow: 0 0 0 16px rgba(255,211,61,0); }
  100% { transform: scale(1);    box-shadow: 0 0 0 0 rgba(255,211,61,0); }
}

/* ── CAPTION (the narrative bar) ────────────────── */
#caption-bar {
  flex-shrink: 0; padding: 18px 32px;
  background: linear-gradient(180deg, rgba(255,211,61,0.08), rgba(255,211,61,0.03));
  border-top: 2px solid rgba(255,211,61,0.4);
  font-size: 22px; font-weight: 700; color: var(--text);
  display: flex; align-items: center; justify-content: space-between; gap: 24px;
  min-height: 64px;
}
#caption-bar .what {
  font-size: 13px; color: var(--text-muted); text-transform: uppercase;
  letter-spacing: 0.16em; font-weight: 700; font-family: ui-monospace, monospace;
  margin-right: 20px;
}
#caption-bar .text {
  flex: 1; font-size: 22px; font-weight: 600; line-height: 1.3;
  animation: caption-pop 0.7s ease;
}
@keyframes caption-pop {
  from { opacity: 0; transform: translateY(8px); }
  to   { opacity: 1; transform: translateY(0); }
}
#caption-bar .meta-stat {
  font-family: ui-monospace, monospace; font-size: 12px; color: var(--text-dim);
  text-align: right; line-height: 1.4;
}
#caption-bar .meta-stat b { color: var(--gold); font-weight: 700; }

/* ── Footer (controls + stats) ──────────────────── */
footer {
  padding: 12px 24px; border-top: 1px solid var(--border); background: var(--panel);
  display: flex; align-items: center; justify-content: space-between; gap: 16px;
  font-family: ui-monospace, monospace; font-size: 11px; flex-shrink: 0;
}
.controls { display: flex; gap: 8px; align-items: center; }
.btn {
  background: var(--panel-2); color: var(--text); border: 1px solid var(--border);
  padding: 8px 14px; border-radius: 6px; cursor: pointer; font-family: inherit;
  font-size: 12px; font-weight: 600; letter-spacing: 0.04em;
}
.btn:hover:not(:disabled) { background: var(--border); }
.btn:disabled { opacity: 0.4; cursor: not-allowed; }
.btn.primary { background: var(--user); color: var(--bg); border-color: var(--user); }
.btn.primary:hover:not(:disabled) { background: #79b8ff; }
.btn.demo {
  background: var(--gold); color: #1a1500; border-color: var(--gold); font-weight: 800;
}
.btn.demo:hover:not(:disabled) { background: #ffe066; }
.metrics { display: flex; gap: 16px; color: var(--text-dim); }
.metrics b { color: var(--text); margin-left: 4px; }
.progress { display: flex; gap: 3px; flex: 1; max-width: 220px; margin: 0 12px; }
.progress .dot {
  flex: 1; height: 5px; background: var(--empty); border-radius: 3px; transition: background 0.3s;
}
.progress .dot.done { background: var(--mid); }
.progress .dot.current { background: var(--gold); }
</style>
</head>
<body>
<header>
  <h1>kinn3 <span class="v">— a Bayesian diagnostic interview engine for businesses</span></h1>
  <div class="meta">Opus 4.7 · BED-LLM · adaptive thinking · 11h hackathon build</div>
</header>
<main>
  <div id="chat-pane">
    <div class="empty-chat">Press <b>▶ Run 30s Demo</b> to watch a dental-clinic owner's interview unfold.</div>
  </div>
  <div id="model-pane">
    <div class="pane-title">🧠 The Model's Picture of the Business</div>
    <div class="pane-sub">6 cybernetic dimensions · empty → low → mid → high as evidence accumulates</div>
    <div class="vsm-grid" id="vsm-blocks"></div>
  </div>
</main>
<div id="caption-bar">
  <span class="what">Now</span>
  <span class="text" id="caption-text">Press <b>Run 30s Demo</b>.</span>
  <span class="meta-stat" id="meta-stat">— · — · —</span>
</div>
<footer>
  <div class="controls">
    <button class="btn demo" id="demo">▶ Run 30s Demo</button>
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

// 30-second curated demo: turn → (dwell ms, opening caption override, closing caption?)
// dwells sum to ~30s. Hand-picked turns with the most dramatic VSM transitions.
const DEMO_SEQ = [
  // turn, dwellMs, captionOverride (null = use auto)
  {turn: 1, dwell: 6000, cap: "Owner names the chaos. The model picks up Algedonic + Operations + Market signals all at once."},
  {turn: 2, dwell: 6500, cap: "“Back to sleeping. Back to remembering my kids' names.” Algedonic → HIGH. Personal pain isn't a metric — it's the whole signal."},
  {turn: 3, dwell: 7000, cap: "“It's not about the teeth. It's the continuity.” Purpose → HIGH. The business they thought they ran isn't the one they actually run."},
  {turn: 7, dwell: 6500, cap: "“There was no one whose job it was to notice.” Coherence breaks open — accountability gap surfaces."},
  {turn: 10, dwell: 4000, cap: "10 turns. 5 of 6 blocks at HIGH. Total cost: $0.62. Built in 11 hours."},
];

let currentTurn = 0;
let demoTimer = null;
let demoRunning = false;

function escapeHtml(s) {
  return (s || "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"})[c]);
}

// Choreographed timeline per turn (ms)
const TIMING = {
  inputAppear:    100,   // ① INPUT step fades in
  understandAppear: 700, // ② UNDERSTOOD step fades in (with delta chips visible)
  particlesFly:   1300,  // particles spawn & start flying toward VSM blocks
  vsmUpdate:      2300,  // particles arrive → VSM upgrades + pulses
  outputAppear:   2600,  // ③ OUTPUT step (next question) fades in
};

let stepTimers = [];
function clearStepTimers() {
  stepTimers.forEach(t => clearTimeout(t));
  stepTimers = [];
}

function renderChat() {
  const pane = document.getElementById("chat-pane");
  clearStepTimers();
  // Remove any in-flight particles from prior renders
  document.querySelectorAll(".particle").forEach(p => p.remove());
  if (currentTurn === 0) {
    pane.innerHTML = '<div class="empty-chat">Press <b>▶ Run 30s Demo</b> to watch a dental-clinic owner\'s interview unfold.</div>';
    return;
  }
  const t = TURNS[currentTurn - 1];
  const promos = PROMOTIONS[currentTurn - 1] || [];

  const signals = (t.signals || []).map(s => `<li>${escapeHtml(s)}</li>`).join("");
  const deltaChipsHtml = promos.length
    ? promos.map(p => `
        <div class="delta-chip" data-block="${p.block}">
          <span>${BLOCK_ICONS[p.block]}</span>
          <span>Block ${p.block}</span>
          <span class="arrow">→</span>
          <span class="to">${p.to}</span>
        </div>`).join("")
    : '<div class="delta-empty">No image shift this turn.</div>';

  pane.innerHTML = `
    <div class="flow">
      <div class="turn-tag">Turn ${t.turn} of ${TURNS.length}</div>
      <div class="step input" id="step-input">
        <div class="step-label">① INPUT · stakeholder signals</div>
        <ul class="signals">${signals}</ul>
      </div>
      <div class="connector" id="conn-1">▼</div>
      <div class="step understand" id="step-understand">
        <div class="step-label">② UNDERSTOOD · image shift (Δ)</div>
        <div class="thinking-text">${escapeHtml(t.thinking || "(no shift)")}</div>
        <div class="delta-chips" id="delta-chips">${deltaChipsHtml}</div>
      </div>
      <div class="connector" id="conn-2">▼</div>
      <div class="step output" id="step-output">
        <div class="step-label">③ OUTPUT · next question</div>
        <div class="next-q-text">${escapeHtml(t.next_question)}</div>
      </div>
    </div>
  `;
  pane.scrollTop = 0;

  // Choreograph
  stepTimers.push(setTimeout(() => {
    document.getElementById("step-input")?.classList.add("shown");
  }, TIMING.inputAppear));

  stepTimers.push(setTimeout(() => {
    document.getElementById("conn-1")?.classList.add("shown");
    document.getElementById("step-understand")?.classList.add("shown");
  }, TIMING.understandAppear));

  if (promos.length) {
    stepTimers.push(setTimeout(launchParticles, TIMING.particlesFly));
  }

  stepTimers.push(setTimeout(renderVSMUpgrade, TIMING.vsmUpdate));

  stepTimers.push(setTimeout(() => {
    document.getElementById("conn-2")?.classList.add("shown");
    document.getElementById("step-output")?.classList.add("shown");
  }, TIMING.outputAppear));
}

function launchParticles() {
  const promos = PROMOTIONS[currentTurn - 1] || [];
  const chips = document.querySelectorAll(".delta-chip");
  chips.forEach((chip, idx) => {
    const promo = promos[idx];
    if (!promo) return;
    const targetEl = document.querySelector(`.vsm-block[data-block="${promo.block}"]`);
    if (!targetEl) return;
    const c = chip.getBoundingClientRect();
    const t = targetEl.getBoundingClientRect();
    // Particle starts at chip center
    const p = document.createElement("div");
    p.className = "particle";
    p.style.left = c.left + "px";
    p.style.top  = c.top + "px";
    p.style.opacity = "0";
    p.innerHTML = `${BLOCK_ICONS[promo.block]} +${promo.delta_rank}`;
    document.body.appendChild(p);
    // Hide source chip
    chip.classList.add("flying");
    // Compute delta
    const dx = (t.left + t.width/2) - c.left - p.offsetWidth/2;
    const dy = (t.top  + t.height/2) - c.top  - p.offsetHeight/2;
    // Small stagger per particle
    setTimeout(() => {
      p.style.opacity = "1";
      requestAnimationFrame(() => {
        p.style.transform = `translate(${dx}px, ${dy}px) scale(1.15)`;
      });
    }, idx * 120);
    // Cleanup after arrival
    setTimeout(() => {
      p.style.opacity = "0";
      setTimeout(() => p.remove(), 400);
    }, 1100 + idx * 120);
  });
}

// Two-phase VSM: at turn-advance show PRIOR snapshot (no change yet);
// then renderVSMUpgrade() flips to current snapshot (pulses fire).
let vsmShowsCurrent = false;

function renderVSMUpgrade() {
  vsmShowsCurrent = true;
  renderVSM();
}

function renderVSM() {
  const blocksDiv = document.getElementById("vsm-blocks");
  blocksDiv.innerHTML = "";
  // Two-phase rendering: show prior snapshot until particles arrive.
  // - currentTurn = 0  → all empty
  // - vsmShowsCurrent  → SNAPSHOTS[currentTurn - 1]
  // - else             → SNAPSHOTS[currentTurn - 2] (or empty if turn 1)
  let snapshot;
  let prevSnapshot = null;
  if (currentTurn === 0) {
    snapshot = Object.fromEntries(Object.keys(BLOCK_NAMES).map(k => [k, {resolution: "empty", quotes: []}]));
  } else if (vsmShowsCurrent) {
    snapshot = SNAPSHOTS[currentTurn - 1];
    prevSnapshot = currentTurn > 1 ? SNAPSHOTS[currentTurn - 2] : Object.fromEntries(
      Object.keys(BLOCK_NAMES).map(k => [k, {resolution: "empty", quotes: []}]));
  } else {
    // Show prior snapshot (no change yet; particles haven't arrived)
    snapshot = currentTurn > 1 ? SNAPSHOTS[currentTurn - 2] : Object.fromEntries(
      Object.keys(BLOCK_NAMES).map(k => [k, {resolution: "empty", quotes: []}]));
  }

  for (const [bid, name] of Object.entries(BLOCK_NAMES)) {
    const s = snapshot[bid];
    const justPromoted = prevSnapshot && prevSnapshot[bid].resolution !== s.resolution;
    const div = document.createElement("div");
    div.className = `vsm-block ${s.resolution}${justPromoted ? " just-promoted" : ""}`;
    div.dataset.block = bid;
    div.innerHTML = `
      <div class="block-num">B${bid}</div>
      <div>
        <div class="top">
          <span class="icon">${BLOCK_ICONS[bid]}</span>
          <div>
            <div class="name">${escapeHtml(name)}</div>
            <div class="sub">${escapeHtml(BLOCK_FULL[bid].split(' — ')[1] || '')}</div>
          </div>
        </div>
      </div>
      <span class="pill">${s.resolution}</span>
    `;
    blocksDiv.appendChild(div);
  }
}

function renderCaption(overrideText = null) {
  const txt = document.getElementById("caption-text");
  const what = document.querySelector("#caption-bar .what");
  if (currentTurn === 0) {
    what.textContent = "Now";
    txt.innerHTML = "Press <b>Run 30s Demo</b>.";
    return;
  }
  what.textContent = `Turn ${currentTurn}`;
  // Re-trigger animation by replacing the node
  const cap = overrideText || CAPTIONS[currentTurn - 1];
  txt.innerHTML = "";
  const span = document.createElement("span");
  span.textContent = cap;
  txt.appendChild(span);
  // Force animation restart
  void span.offsetWidth;
  span.style.animation = "caption-pop 0.7s ease";
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
  // Caption-bar meta-stat
  document.getElementById("meta-stat").innerHTML = currentTurn === 0
    ? "— · — · —"
    : `cost <b>$${totalCost.toFixed(2)}</b> · cache <b>${cacheHit}%</b> · blocks <b>${cov}/6</b>`;
}

function render(captionOverride = null) {
  // Reset VSM "before" state — flips to "current" via renderVSMUpgrade()
  // after particles arrive (see TIMING.vsmUpdate).
  vsmShowsCurrent = false;
  renderVSM();      // shows PRIOR snapshot
  renderChat();     // schedules particles + flip
  renderCaption(captionOverride);
  renderProgress();
  renderMetrics();
  document.getElementById("prev").disabled = currentTurn === 0;
  document.getElementById("next").disabled = currentTurn >= TURNS.length;
  document.getElementById("demo").disabled = demoRunning;
}

function next() {
  if (currentTurn < TURNS.length) { currentTurn++; render(); }
}
function prev() {
  if (currentTurn > 0) { currentTurn--; render(); }
}
function reset() {
  if (demoTimer) { clearTimeout(demoTimer); demoTimer = null; demoRunning = false; }
  currentTurn = 0;
  render();
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
      document.getElementById("demo").textContent = "▶ Run 30s Demo";
      document.getElementById("demo").disabled = false;
      return;
    }
    const step = DEMO_SEQ[i];
    currentTurn = step.turn;
    render(step.cap);
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

    html = HTML_TEMPLATE
    html = html.replace("__TURNS_JSON__",        json.dumps(turns))
    html = html.replace("__SNAPSHOTS_JSON__",    json.dumps(snapshots))
    html = html.replace("__PROMOTIONS_JSON__",   json.dumps(promotions))
    html = html.replace("__COSTS_JSON__",        json.dumps(cost_data))
    html = html.replace("__BLOCK_NAMES_JSON__",  json.dumps(BLOCK_NAMES))
    html = html.replace("__BLOCK_FULL_JSON__",   json.dumps(BLOCK_FULL))
    html = html.replace("__BLOCK_ICONS_JSON__",  json.dumps(BLOCK_ICONS))
    html = html.replace("__CAPTIONS_JSON__",     json.dumps(captions))

    out = Path(args.out)
    out.write_text(html)
    print(f"Wrote {out} ({len(html):,} bytes, {len(turns)} turns)")
    print(f"Open: file://{out.resolve()}")


if __name__ == "__main__":
    main()
