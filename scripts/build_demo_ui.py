"""Build a self-contained HTML demo from a kinn3 session.

Reads a benchmark/calibration session directory (transcript.txt, costs.jsonl)
and emits a single HTML file with embedded data + JS for stepping through turns.

Usage:
    uv run python scripts/build_demo_ui.py [SESSION_DIR] [-o OUT_FILE]
    # default SESSION_DIR: calibration-runs/benchmark/dental-clinic
    # default OUT_FILE:    demo.html
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

RESOLUTION_RANK = {"empty": 0, "low": 1, "mid": 2, "high": 3}


def parse_transcript(path: Path) -> list[dict]:
    """Parse transcript.txt into a list of turn dicts."""
    text = path.read_text()
    turns = []
    # Each turn is "### Turn N\nUSER: ...\nAGENT: <json>"
    pattern = re.compile(r"### Turn (\d+)\n(.*?)(?=### Turn \d+|\Z)", re.DOTALL)
    for m in pattern.finditer(text):
        turn_n = int(m.group(1))
        body = m.group(2).strip()
        # Split USER / AGENT
        user_match = re.search(r"^USER:\s*(.*?)(?=\nAGENT:)", body, re.DOTALL)
        agent_match = re.search(r"^AGENT:\s*(.+)$", body, re.MULTILINE | re.DOTALL)
        if not user_match or not agent_match:
            continue
        user_msg = user_match.group(1).strip()
        agent_raw = agent_match.group(1).strip()
        try:
            agent = json.loads(agent_raw)
        except json.JSONDecodeError:
            continue
        turns.append({
            "turn": turn_n,
            "user": user_msg,
            "heard": agent.get("heard", []),
            "delta": agent.get("delta", ""),
            "next_question": agent.get("next_question", ""),
            "signal_mutations": agent.get("signal_mutations", []),
        })
    return turns


def parse_costs(path: Path) -> dict[int, dict]:
    """Parse costs.jsonl into a turn → metrics dict."""
    if not path.exists():
        return {}
    out = {}
    for line in path.read_text().splitlines():
        if not line.strip():
            continue
        rec = json.loads(line)
        out[rec["turn"]] = rec
    return out


def replay_belief(turns: list[dict]) -> list[dict]:
    """Replay signal_mutations to produce per-turn belief snapshots."""
    state = {i: {"resolution": "empty", "quotes": []} for i in range(1, 7)}
    snapshots = []
    for turn in turns:
        for m in turn["signal_mutations"]:
            blk = m.get("block")
            new_res = m.get("new_resolution")
            quote = m.get("quote", "")
            if blk in state and new_res in RESOLUTION_RANK:
                # Only promote (never demote) for the visualization
                if RESOLUTION_RANK[new_res] >= RESOLUTION_RANK[state[blk]["resolution"]]:
                    state[blk]["resolution"] = new_res
                if quote and quote not in state[blk]["quotes"]:
                    state[blk]["quotes"].append(quote)
        # Deep snapshot
        snapshot = {b: {"resolution": s["resolution"], "quotes": list(s["quotes"])}
                    for b, s in state.items()}
        snapshots.append(snapshot)
    return snapshots


HTML_TEMPLATE = r"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>kinn3 — diagnostic interview demo</title>
<style>
:root {
  --bg: #0e1116;
  --panel: #161b22;
  --panel-2: #1c2128;
  --border: #30363d;
  --text: #e6edf3;
  --text-dim: #8b949e;
  --user: #58a6ff;
  --agent: #d2a8ff;
  --empty: #30363d;
  --low: #d29922;
  --mid: #58a6ff;
  --high: #3fb950;
  --shadow: 0 4px 20px rgba(0,0,0,0.4);
}
* { box-sizing: border-box; margin: 0; padding: 0; }
html, body { background: var(--bg); color: var(--text); font-family: -apple-system, BlinkMacSystemFont, "SF Pro Display", "Segoe UI", system-ui, sans-serif; height: 100%; }
body { display: flex; flex-direction: column; overflow: hidden; }

header {
  padding: 16px 24px; border-bottom: 1px solid var(--border);
  display: flex; align-items: center; justify-content: space-between;
  background: var(--panel);
}
header h1 { font-size: 18px; font-weight: 600; letter-spacing: -0.01em; }
header h1 .v { color: var(--text-dim); font-weight: 400; margin-left: 8px; font-size: 14px; }
header .meta { font-size: 13px; color: var(--text-dim); font-family: ui-monospace, "SF Mono", Menlo, monospace; }

main { flex: 1; display: grid; grid-template-columns: 1fr 380px; gap: 0; overflow: hidden; }

#chat-pane {
  overflow-y: auto; padding: 24px; background: var(--bg);
}
#chat-pane .turn { margin-bottom: 28px; }
#chat-pane .turn-num {
  font-size: 11px; color: var(--text-dim); text-transform: uppercase; letter-spacing: 0.08em;
  margin-bottom: 8px; font-family: ui-monospace, monospace;
}
.bubble {
  padding: 14px 18px; border-radius: 12px; margin-bottom: 10px;
  border: 1px solid var(--border); line-height: 1.55; font-size: 15px;
  white-space: pre-wrap;
}
.user-bubble {
  background: rgba(88, 166, 255, 0.08); border-color: rgba(88, 166, 255, 0.3);
}
.user-bubble::before {
  content: "👤 STAKEHOLDER";
  display: block; font-size: 10px; font-weight: 600; letter-spacing: 0.1em;
  color: var(--user); margin-bottom: 6px; font-family: ui-monospace, monospace;
}
.agent-card {
  background: rgba(210, 168, 255, 0.06); border-color: rgba(210, 168, 255, 0.3);
}
.agent-card::before {
  content: "🤖 KINN3";
  display: block; font-size: 10px; font-weight: 600; letter-spacing: 0.1em;
  color: var(--agent); margin-bottom: 10px; font-family: ui-monospace, monospace;
}
.agent-card .section { margin-bottom: 12px; }
.agent-card .section:last-child { margin-bottom: 0; }
.agent-card .label {
  font-size: 10px; color: var(--text-dim); text-transform: uppercase;
  letter-spacing: 0.08em; margin-bottom: 4px; font-family: ui-monospace, monospace;
}
.agent-card .heard ul { list-style: none; padding-left: 0; }
.agent-card .heard li { padding: 3px 0 3px 12px; position: relative; font-size: 14px; }
.agent-card .heard li::before {
  content: "›"; position: absolute; left: 0; color: var(--agent);
}
.agent-card .delta { font-size: 13px; color: var(--text-dim); font-style: italic; }
.agent-card .next-q { font-size: 16px; font-weight: 500; color: var(--text); padding: 8px 0; }

#vsm-pane {
  border-left: 1px solid var(--border); background: var(--panel);
  overflow-y: auto; padding: 20px;
}
#vsm-pane h2 {
  font-size: 13px; text-transform: uppercase; letter-spacing: 0.08em;
  color: var(--text-dim); margin-bottom: 16px; font-family: ui-monospace, monospace;
}
.vsm-block {
  background: var(--panel-2); border: 1px solid var(--border); border-radius: 10px;
  padding: 12px 14px; margin-bottom: 10px; transition: all 0.4s ease;
}
.vsm-block.empty { opacity: 0.5; }
.vsm-block.low { border-left: 3px solid var(--low); }
.vsm-block.mid { border-left: 3px solid var(--mid); background: rgba(88, 166, 255, 0.04); }
.vsm-block.high { border-left: 3px solid var(--high); background: rgba(63, 185, 80, 0.05); }
.vsm-block.just-promoted { animation: pulse 1.2s ease; }
@keyframes pulse {
  0% { transform: scale(1); box-shadow: 0 0 0 0 rgba(63, 185, 80, 0.4); }
  50% { transform: scale(1.02); box-shadow: 0 0 0 8px rgba(63, 185, 80, 0); }
  100% { transform: scale(1); box-shadow: 0 0 0 0 rgba(63, 185, 80, 0); }
}
.vsm-block .header {
  display: flex; align-items: center; justify-content: space-between; margin-bottom: 6px;
}
.vsm-block .name { font-size: 13px; font-weight: 600; }
.vsm-block .res-pill {
  font-size: 9px; text-transform: uppercase; letter-spacing: 0.1em; font-weight: 600;
  padding: 2px 7px; border-radius: 10px; font-family: ui-monospace, monospace;
}
.vsm-block.empty .res-pill { background: var(--empty); color: var(--text-dim); }
.vsm-block.low .res-pill { background: rgba(210, 153, 34, 0.2); color: var(--low); }
.vsm-block.mid .res-pill { background: rgba(88, 166, 255, 0.2); color: var(--mid); }
.vsm-block.high .res-pill { background: rgba(63, 185, 80, 0.2); color: var(--high); }
.vsm-block .quotes {
  font-size: 12px; color: var(--text-dim); margin-top: 6px; font-style: italic;
  border-left: 2px solid var(--border); padding-left: 8px;
}
.vsm-block .quote-line { padding: 2px 0; }

footer {
  padding: 12px 24px; border-top: 1px solid var(--border); background: var(--panel);
  display: flex; align-items: center; justify-content: space-between; gap: 16px;
  font-family: ui-monospace, monospace; font-size: 12px;
}
.controls { display: flex; gap: 8px; align-items: center; }
.btn {
  background: var(--panel-2); color: var(--text); border: 1px solid var(--border);
  padding: 7px 14px; border-radius: 6px; cursor: pointer; font-family: inherit;
  font-size: 12px; font-weight: 600; letter-spacing: 0.04em;
}
.btn:hover:not(:disabled) { background: var(--border); }
.btn:disabled { opacity: 0.4; cursor: not-allowed; }
.btn.primary {
  background: var(--user); color: var(--bg); border-color: var(--user);
}
.btn.primary:hover:not(:disabled) { background: #79b8ff; }
.metrics { display: flex; gap: 24px; color: var(--text-dim); }
.metrics b { color: var(--text); margin-left: 4px; font-weight: 600; }
.progress {
  display: flex; gap: 3px; flex: 1; max-width: 250px; margin: 0 16px;
}
.progress .dot {
  flex: 1; height: 6px; background: var(--empty); border-radius: 3px; transition: background 0.3s;
}
.progress .dot.done { background: var(--mid); }
.progress .dot.current { background: var(--high); }
</style>
</head>
<body>
<header>
  <h1>kinn3 <span class="v">— BED-LLM diagnostic interview · dental-clinic persona</span></h1>
  <div class="meta">v0.1-pre-tuning · Opus 4.7 · adaptive thinking · prompt caching</div>
</header>
<main>
  <div id="chat-pane"></div>
  <div id="vsm-pane">
    <h2>VSM Image · 6 blocks</h2>
    <div id="vsm-blocks"></div>
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
    <span>cost <b id="cost">$0.00</b></span>
    <span>cache hit <b id="cache">0</b>%</span>
    <span>wall <b id="wall">0s</b></span>
    <span>blocks <b id="cov">0</b>/6</span>
  </div>
</footer>
<script>
const TURNS = __TURNS_JSON__;
const SNAPSHOTS = __SNAPSHOTS_JSON__;
const COSTS = __COSTS_JSON__;
const BLOCK_NAMES = __BLOCK_NAMES_JSON__;

let currentTurn = 0;  // 0 = nothing shown yet; 1..N = turn N visible
let autoplayTimer = null;

function escapeHtml(s) {
  return (s || "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"})[c]);
}

function renderChat() {
  const pane = document.getElementById("chat-pane");
  pane.innerHTML = "";
  for (let i = 0; i < currentTurn; i++) {
    const t = TURNS[i];
    const turnDiv = document.createElement("div");
    turnDiv.className = "turn";
    turnDiv.innerHTML = `
      <div class="turn-num">Turn ${t.turn}</div>
      <div class="bubble user-bubble">${escapeHtml(t.user)}</div>
      <div class="bubble agent-card">
        <div class="section heard">
          <div class="label">Heard</div>
          <ul>${t.heard.map(h => `<li>${escapeHtml(h)}</li>`).join("")}</ul>
        </div>
        <div class="section">
          <div class="label">Delta</div>
          <div class="delta">${escapeHtml(t.delta)}</div>
        </div>
        <div class="section">
          <div class="label">Next</div>
          <div class="next-q">${escapeHtml(t.next_question)}</div>
        </div>
      </div>
    `;
    pane.appendChild(turnDiv);
  }
  pane.scrollTop = pane.scrollHeight;
}

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
    const quotesHtml = s.quotes.length
      ? `<div class="quotes">${s.quotes.map(q => `<div class="quote-line">"${escapeHtml(q)}"</div>`).join("")}</div>`
      : "";
    div.innerHTML = `
      <div class="header">
        <div class="name">${bid}. ${escapeHtml(name)}</div>
        <div class="res-pill">${s.resolution}</div>
      </div>
      ${quotesHtml}
    `;
    blocksDiv.appendChild(div);
  }
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

  let totalCost = 0, totalIn = 0, totalCacheRead = 0, totalWall = 0;
  for (let i = 0; i < currentTurn; i++) {
    const c = COSTS[i + 1];
    if (c) {
      totalCost += c.cost_usd || 0;
      totalIn += (c.input_tokens || 0) + (c.cache_read_tokens || 0);
      totalCacheRead += c.cache_read_tokens || 0;
      totalWall += c.wall_s || 0;
    }
  }
  const cacheHit = totalIn > 0 ? Math.round(100 * totalCacheRead / totalIn) : 0;
  document.getElementById("cost").textContent = "$" + totalCost.toFixed(3);
  document.getElementById("cache").textContent = cacheHit;
  document.getElementById("wall").textContent = totalWall.toFixed(0) + "s";

  const snap = currentTurn === 0 ? null : SNAPSHOTS[currentTurn - 1];
  const cov = snap ? Object.values(snap).filter(b => b.resolution !== "empty").length : 0;
  document.getElementById("cov").textContent = cov;
}

function render() {
  renderChat();
  renderVSM();
  renderProgress();
  renderMetrics();
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
    autoplayTimer = setInterval(next, 4000);
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

    snapshots = replay_belief(turns)
    cost_data = parse_costs(costs)

    html = HTML_TEMPLATE
    html = html.replace("__TURNS_JSON__", json.dumps(turns))
    html = html.replace("__SNAPSHOTS_JSON__", json.dumps(snapshots))
    html = html.replace("__COSTS_JSON__", json.dumps(cost_data))
    html = html.replace("__BLOCK_NAMES_JSON__", json.dumps(BLOCK_NAMES))

    out = Path(args.out)
    out.write_text(html)
    print(f"Wrote {out} ({len(html):,} bytes, {len(turns)} turns)")
    print(f"Open with: file://{out.resolve()}")


if __name__ == "__main__":
    main()
