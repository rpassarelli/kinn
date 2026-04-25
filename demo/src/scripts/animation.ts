/**
 * Per-turn choreography for the 5-panel demo, driven by GSAP.
 *
 * Flow per turn (one master timeline):
 *   01 user bubble → 02 signals (stagger) → arrow 02→04 (drawn)
 *   → 04 receives signal chips (stagger) → router core spins
 *   → arrow 04→03 (drawn) → 03 VSM updates + just-promoted block pulses
 *   → arrow 03→04 (drawn) → 04 emits objective chip
 *   → arrow 04→05 (drawn) → 05 cues + question slide-in
 *   → arrow 05→01 (drawn) → 01 agent bubble appears (closes the loop)
 */
import { gsap } from "gsap";
import type { SessionData, Resolution } from "./types";
import { BLOCK_ICONS, PANEL_ICONS } from "./icons";

declare global {
  interface Window {
    __SESSION__: SessionData;
    __SESSION_DATA__: SessionData;
    __DEMO__: DemoController;
  }
}

// Timeline labels (seconds). Adjust these to retune the entire turn.
const L = {
  start:        0,
  user_in:      0.10,
  signals:      0.90,
  arrow_a:      1.70,   // 02 → 04
  router_recv:  2.00,
  router_core:  2.30,
  arrow_b:      2.90,   // 04 → 03
  vsm_update:   3.30,
  arrow_c:      4.10,   // 03 → 04
  goal_emit:    4.40,
  arrow_d:      4.70,   // 04 → 05
  cues:         5.00,
  next_q:       5.40,
  arrow_e:      5.80,   // 05 → 01
  agent_in:     6.10,
  end:          6.50,
};

const DEMO_SEQ = [
  { turn: 1,  dwell: 7000 },
  { turn: 2,  dwell: 7000 },
  { turn: 3,  dwell: 7000 },
  { turn: 7,  dwell: 7000 },
  { turn: 10, dwell: 7000 },
];

const EMPTY_SNAP = (names: Record<string, string>) =>
  Object.fromEntries(Object.keys(names).map(k => [k, { resolution: "empty" as Resolution, quotes: [] }]));

class DemoController {
  data: SessionData;
  currentTurn = 0;
  demoTimer: number | null = null;
  demoRunning = false;
  vsmShowsCurrent = false;
  master: gsap.core.Timeline | null = null;
  coreSpin: gsap.core.Tween | null = null;

  constructor(data: SessionData) {
    this.data = data;
  }

  init() {
    this.bindControls();
    window.addEventListener("resize", () => this.ensureArrowSVG());
    this.ensureArrowSVG();
    this.startCoreIdle();
    this.render();
  }

  bindControls() {
    document.getElementById("btn-next")?.addEventListener("click", () => this.next());
    document.getElementById("btn-prev")?.addEventListener("click", () => this.prev());
    document.getElementById("btn-reset")?.addEventListener("click", () => this.reset());
    document.getElementById("btn-demo")?.addEventListener("click", () => this.runDemo());
    document.addEventListener("keydown", (e) => {
      if (e.key === "ArrowRight" || e.key === " ") { e.preventDefault(); this.next(); }
      if (e.key === "ArrowLeft") { e.preventDefault(); this.prev(); }
      if (e.key === "d") this.runDemo();
    });
  }

  next() { if (this.currentTurn < this.data.turns.length) { this.currentTurn++; this.render(); } }
  prev() { if (this.currentTurn > 0) { this.currentTurn--; this.render(); } }
  reset() {
    if (this.demoTimer) { clearTimeout(this.demoTimer); this.demoTimer = null; }
    this.demoRunning = false;
    this.killMaster();
    this.clearArrows();
    this.clearPhone(); this.clearSignals(); this.clearRouter(); this.clearQuestioner();
    this.currentTurn = 0; this.render();
  }
  runDemo() {
    if (this.demoRunning) return;
    this.reset();
    this.demoRunning = true;
    const btn = document.getElementById("btn-demo") as HTMLButtonElement | null;
    if (btn) { btn.textContent = "▶ Demo running…"; btn.disabled = true; }
    let i = 0;
    const playStep = () => {
      if (i >= DEMO_SEQ.length) {
        this.demoRunning = false;
        if (btn) { btn.textContent = "▶ Run demo"; btn.disabled = false; }
        return;
      }
      const step = DEMO_SEQ[i];
      this.currentTurn = step.turn;
      this.render();
      i++;
      this.demoTimer = window.setTimeout(playStep, step.dwell);
    };
    playStep();
  }

  render() {
    this.killMaster();
    this.clearArrows();
    this.vsmShowsCurrent = false;
    this.renderVSM();
    this.playTurn();
    this.renderProgress();
    this.renderMetrics();
    (document.getElementById("btn-prev") as HTMLButtonElement | null)?.toggleAttribute("disabled", this.currentTurn === 0);
    (document.getElementById("btn-next") as HTMLButtonElement | null)?.toggleAttribute("disabled", this.currentTurn >= this.data.turns.length);
  }

  killMaster() { if (this.master) { this.master.kill(); this.master = null; } }

  // ───── per-turn master timeline ─────
  playTurn() {
    if (this.currentTurn === 0) return;
    const t = this.data.turns[this.currentTurn - 1];
    const promos = this.data.promotions[this.currentTurn - 1] ?? [];
    const goal = this.data.goal_blocks[this.currentTurn - 1];
    const alg = this.data.algedonic[this.currentTurn - 1];

    // Reset all surfaces (instant — not on the timeline)
    this.clearPhone(); this.clearSignals(); this.clearRouter(); this.clearQuestioner();

    // Carry prior agent question as context bubble (no animation needed)
    if (this.currentTurn > 1) {
      const prev = this.data.turns[this.currentTurn - 2];
      this.appendBubble(this.truncate(prev.next_question, 140), "agent", false);
    }

    const tl = gsap.timeline({ defaults: { ease: "power2.out" } });
    this.master = tl;

    tl.add(() => this.appendBubble(this.truncate(t.user, 160), "user"), L.user_in);
    tl.add(() => this.spawnSignals(t.signals ?? []),                      L.signals);
    tl.add(() => this.drawArrow("panel-02","right","panel-04","left","arr-signal","var(--signal)",0.75), L.arrow_a);
    tl.add(() => this.spawnRouterIn(t.signals ?? []),                     L.router_recv);
    tl.add(() => this.routerBurst(),                                      L.router_core);
    tl.add(() => this.drawArrow("panel-04","top","panel-03","bottom","arr-route","var(--route)",0.7),    L.arrow_b);
    tl.add(() => { this.flipVSMToCurrent(); this.spawnRouterMutations(promos); }, L.vsm_update);
    tl.add(() => this.drawArrow("panel-03","bottom","panel-04","top","arr-goal","var(--goal)",0.55),     L.arrow_c);
    tl.add(() => this.spawnRouterObjective(goal),                         L.goal_emit);
    tl.add(() => this.drawArrow("panel-04","left","panel-05","right","arr-goal","var(--goal)",0.7),      L.arrow_d);
    tl.add(() => this.showCues(alg, goal),                                L.cues);
    tl.add(() => this.showNextQ(t.next_question),                         L.next_q);
    tl.add(() => this.drawArrow("panel-05","left","panel-01","bottom","arr-quest","var(--quest)",0.7),   L.arrow_e);
    tl.add(() => this.appendBubble(this.truncate(t.next_question, 160), "agent"), L.agent_in);
  }

  // ───── 01 phone ─────
  appendBubble(text: string, kind: "user" | "agent", animated = true) {
    const screen = document.getElementById("phone-screen");
    if (!screen) return;
    const div = document.createElement("div");
    div.className = "bubble " + kind;
    div.textContent = text;
    screen.appendChild(div);
    screen.scrollTop = screen.scrollHeight;
    if (animated) {
      gsap.fromTo(div,
        { y: 10, scale: 0.92, opacity: 0 },
        { y: 0, scale: 1, opacity: 1, duration: 0.45, ease: "back.out(1.7)" });
    } else {
      gsap.set(div, { opacity: 1 });
    }
  }
  clearPhone() { const s = document.getElementById("phone-screen"); if (s) s.innerHTML = ""; }
  truncate(s: string, n: number) { return s && s.length > n ? s.slice(0, n - 1).trimEnd() + "…" : s; }

  // ───── 02 signals ─────
  clearSignals() {
    const list = document.getElementById("signals-list");
    if (list) list.innerHTML = '<li class="signals-empty">— processing —</li>';
  }
  spawnSignals(signals: string[]) {
    const list = document.getElementById("signals-list");
    if (!list) return;
    list.innerHTML = "";
    const items: HTMLLIElement[] = [];
    signals.forEach(s => {
      const li = document.createElement("li");
      li.textContent = s;
      list.appendChild(li);
      items.push(li);
    });
    gsap.fromTo(items,
      { x: -16, opacity: 0 },
      { x: 0, opacity: 1, duration: 0.45, stagger: 0.12, ease: "power2.out" });
  }

  // ───── 04 router ─────
  clearRouter() {
    const i = document.getElementById("router-in");
    const o = document.getElementById("router-out");
    if (i) i.innerHTML = ""; if (o) o.innerHTML = "";
    gsap.set("#router-core", { boxShadow: "none", scale: 1 });
  }
  startCoreIdle() {
    // Slow continuous rotation so the gear feels alive even at rest.
    if (this.coreSpin) this.coreSpin.kill();
    this.coreSpin = gsap.to("#router-core", { rotation: 360, duration: 12, ease: "none", repeat: -1, transformOrigin: "50% 50%" });
  }
  routerBurst() {
    const core = document.getElementById("router-core");
    if (!core) return;
    gsap.timeline()
      .to(core, { scale: 1.2, duration: 0.18, ease: "power2.out" })
      .to(core, { boxShadow: "0 0 40px rgba(255,211,61,0.7)", duration: 0.2 }, 0)
      .to(core, { scale: 1, duration: 0.5, ease: "elastic.out(1, 0.4)" })
      .to(core, { boxShadow: "0 0 0 rgba(255,211,61,0)", duration: 0.6 }, ">-0.4");
  }
  spawnRouterIn(signals: string[]) {
    const inDiv = document.getElementById("router-in");
    if (!inDiv) return;
    inDiv.innerHTML = "";
    const chips: HTMLDivElement[] = [];
    signals.forEach(s => {
      const c = document.createElement("div");
      c.className = "router-chip signal";
      c.textContent = s.length > 36 ? s.slice(0, 33) + "…" : s;
      inDiv.appendChild(c);
      chips.push(c);
    });
    gsap.fromTo(chips,
      { x: -20, opacity: 0, scale: 0.85 },
      { x: 0, opacity: 1, scale: 1, duration: 0.4, stagger: 0.1, ease: "back.out(1.6)" });
  }
  spawnRouterMutations(promos: Array<{ block: number; to: Resolution }>) {
    const out = document.getElementById("router-out");
    if (!out) return;
    out.innerHTML = "";
    const chips: HTMLDivElement[] = [];
    if (!promos.length) {
      const c = document.createElement("div");
      c.className = "router-chip"; c.textContent = "(no mutation)";
      out.appendChild(c); chips.push(c);
    } else {
      promos.forEach(p => {
        const c = document.createElement("div");
        c.className = "router-chip mutation";
        c.innerHTML = `${BLOCK_ICONS[p.block]} ${this.data.block_names[String(p.block)]} <span class="to">${p.to}</span>`;
        out.appendChild(c); chips.push(c);
      });
    }
    gsap.fromTo(chips,
      { x: 20, opacity: 0, scale: 0.85 },
      { x: 0, opacity: 1, scale: 1, duration: 0.4, stagger: 0.1, ease: "back.out(1.6)" });
  }
  spawnRouterObjective(goal: number | null) {
    if (!goal) return;
    const out = document.getElementById("router-out");
    if (!out) return;
    const c = document.createElement("div");
    c.className = "router-chip objective";
    c.innerHTML = `${PANEL_ICONS.target} next: ${BLOCK_ICONS[goal]} ${this.data.block_names[String(goal)]}`;
    out.appendChild(c);
    gsap.fromTo(c,
      { y: 8, opacity: 0, scale: 0.9 },
      { y: 0, opacity: 1, scale: 1, duration: 0.5, ease: "back.out(1.8)" });
  }

  // ───── 03 VSM ─────
  renderVSM() {
    const blocksDiv = document.getElementById("vsm-blocks");
    if (!blocksDiv) return;
    blocksDiv.innerHTML = "";
    let snapshot: any, prev: any = null;
    const empty = EMPTY_SNAP(this.data.block_names);
    if (this.currentTurn === 0) {
      snapshot = empty;
    } else if (this.vsmShowsCurrent) {
      snapshot = this.data.snapshots[this.currentTurn - 1];
      prev = this.currentTurn > 1 ? this.data.snapshots[this.currentTurn - 2] : empty;
    } else {
      snapshot = this.currentTurn > 1 ? this.data.snapshots[this.currentTurn - 2] : empty;
    }
    const goalBlock = this.currentTurn > 0 ? this.data.goal_blocks[this.currentTurn - 1] : null;
    const showGoal = this.vsmShowsCurrent && goalBlock != null;
    const promotedIds: string[] = [];
    for (const [bid, name] of Object.entries(this.data.block_names)) {
      const s = snapshot[bid];
      const justPromoted = this.vsmShowsCurrent && prev && prev[bid].resolution !== s.resolution;
      const isGoal = showGoal && Number(bid) === goalBlock;
      const div = document.createElement("div");
      div.className = `vsm-block ${s.resolution}${isGoal ? " is-goal" : ""}`;
      div.dataset.block = bid;
      div.innerHTML = `
        <div class="top">
          <span class="icon">${BLOCK_ICONS[Number(bid)]}</span>
          <div>
            <div class="name">${name}</div>
            <div class="sub">${this.data.block_full[bid]}</div>
          </div>
        </div>
        <span class="pill pill-${s.resolution}">${s.resolution}</span>
      `;
      blocksDiv.appendChild(div);
      if (justPromoted) promotedIds.push(bid);
    }
    // Pulse the just-promoted blocks (GSAP — not CSS keyframes)
    if (promotedIds.length) {
      const els = promotedIds.map(id => document.querySelector(`.vsm-block[data-block="${id}"]`)).filter(Boolean) as Element[];
      gsap.fromTo(els,
        { scale: 1, boxShadow: "0 0 0 0 rgba(255,211,61,0.0)" },
        { scale: 1.08, boxShadow: "0 0 0 16px rgba(255,211,61,0.0)", duration: 0.7, ease: "power2.out", stagger: 0.08, yoyo: true, repeat: 1 });
      // Inner flash
      gsap.fromTo(els,
        { backgroundColor: "rgba(255,211,61,0.35)" },
        { backgroundColor: "rgba(0,0,0,0)", duration: 1.0, ease: "power2.out", stagger: 0.08 });
    }
    // Goal outline pulses while waiting for next turn
    if (showGoal) {
      const goalEl = document.querySelector(`.vsm-block[data-block="${goalBlock}"]`);
      if (goalEl) {
        gsap.to(goalEl, { boxShadow: "0 0 24px rgba(210,168,255,0.6)", duration: 1.0, ease: "sine.inOut", yoyo: true, repeat: -1 });
      }
    }
  }
  flipVSMToCurrent() { this.vsmShowsCurrent = true; this.renderVSM(); }

  // ───── 05 questioner ─────
  clearQuestioner() {
    gsap.set("#quest-cues", { opacity: 0 });
    gsap.set("#next-q-box", { opacity: 0, y: 8 });
    const algPill = document.getElementById("alg-pill");
    if (algPill) { algPill.className = "cue-pill pill-empty"; algPill.textContent = "empty"; }
    const gi = document.getElementById("goal-icon"); if (gi) gi.innerHTML = "";
    const gn = document.getElementById("goal-name"); if (gn) gn.textContent = "none";
    const nq = document.getElementById("next-q-text"); if (nq) nq.textContent = "— waiting for objective —";
  }
  showCues(alg: Resolution, goal: number | null) {
    const algPill = document.getElementById("alg-pill");
    if (algPill) { algPill.className = `cue-pill pill-${alg}`; algPill.textContent = alg; }
    const gi = document.getElementById("goal-icon");
    const gn = document.getElementById("goal-name");
    if (gi) gi.innerHTML = goal ? BLOCK_ICONS[goal] : "";
    if (gn) gn.textContent = goal ? this.data.block_names[String(goal)] : "none";
    gsap.to("#quest-cues", { opacity: 1, duration: 0.4, ease: "power2.out" });
    if (algPill) gsap.fromTo(algPill, { scale: 0.7 }, { scale: 1, duration: 0.5, ease: "back.out(2)" });
  }
  showNextQ(text: string) {
    const nq = document.getElementById("next-q-text");
    if (nq) nq.textContent = text;
    gsap.to("#next-q-box", { opacity: 1, y: 0, duration: 0.55, ease: "power3.out" });
  }

  // ───── arrows (animated path drawing) ─────
  ensureArrowSVG() {
    const main = document.querySelector("main");
    const svg = document.getElementById("arrow-svg");
    if (!main || !svg) return;
    const m = main.getBoundingClientRect();
    svg.setAttribute("viewBox", `0 0 ${m.width} ${m.height}`);
    svg.setAttribute("width", String(m.width));
    svg.setAttribute("height", String(m.height));
  }
  clearArrows() { document.querySelectorAll(".arrow-path").forEach(p => p.remove()); }
  panelEdge(id: string, edge: "top" | "bottom" | "left" | "right") {
    const el = document.getElementById(id);
    const main = document.querySelector("main");
    if (!el || !main) return null;
    const r = el.getBoundingClientRect();
    const m = main.getBoundingClientRect();
    const cx = r.left + r.width / 2 - m.left;
    const cy = r.top + r.height / 2 - m.top;
    if (edge === "right")  return { x: r.right - m.left,  y: cy };
    if (edge === "left")   return { x: r.left  - m.left,  y: cy };
    if (edge === "top")    return { x: cx,                y: r.top    - m.top };
    return { x: cx, y: r.bottom - m.top };
  }
  drawArrow(fromId: string, fromEdge: any, toId: string, toEdge: any, markerId: string, color: string, durSec: number) {
    this.ensureArrowSVG();
    const a = this.panelEdge(fromId, fromEdge);
    const b = this.panelEdge(toId, toEdge);
    if (!a || !b) return;
    const dx = b.x - a.x, dy = b.y - a.y;
    const cx = (a.x + b.x) / 2 + (dy > 0 ? 30 : -30);
    const cy = (a.y + b.y) / 2 - 20;
    const svgNS = "http://www.w3.org/2000/svg";
    const path = document.createElementNS(svgNS, "path");
    path.setAttribute("d", `M ${a.x} ${a.y} Q ${cx} ${cy} ${b.x} ${b.y}`);
    path.setAttribute("class", "arrow-path");
    path.setAttribute("stroke", color);
    path.setAttribute("marker-end", `url(#${markerId})`);
    document.getElementById("arrow-svg")?.appendChild(path);
    // Animate path drawing via stroke-dashoffset
    const len = (path as SVGPathElement).getTotalLength();
    gsap.set(path, { strokeDasharray: len, strokeDashoffset: len, opacity: 1 });
    gsap.to(path, { strokeDashoffset: 0, duration: durSec, ease: "power2.inOut",
      onComplete: () => {
        gsap.to(path, { opacity: 0, duration: 0.4, delay: 0.3, onComplete: () => path.remove() });
      } });
  }

  // ───── progress + metrics ─────
  renderProgress() {
    const p = document.getElementById("progress");
    if (!p) return;
    p.innerHTML = "";
    for (let i = 1; i <= this.data.turns.length; i++) {
      const d = document.createElement("div");
      d.className = "dot" + (i < this.currentTurn ? " done" : i === this.currentTurn ? " current" : "");
      p.appendChild(d);
    }
  }
  renderMetrics() {
    const tn = document.getElementById("turn-num"); if (tn) tn.textContent = String(this.currentTurn);
    const tt = document.getElementById("turn-total"); if (tt) tt.textContent = String(this.data.turns.length);
    let cost = 0, totalIn = 0, cacheRead = 0;
    for (let i = 0; i < this.currentTurn; i++) {
      const c = this.data.costs[String(i + 1)];
      if (c) { cost += c.cost_usd ?? 0; totalIn += (c.input_tokens ?? 0) + (c.cache_read_tokens ?? 0); cacheRead += c.cache_read_tokens ?? 0; }
    }
    const hit = totalIn > 0 ? Math.round(100 * cacheRead / totalIn) : 0;
    const cs = document.getElementById("cost"); if (cs) cs.textContent = "$" + cost.toFixed(3);
    const ch = document.getElementById("cache"); if (ch) ch.textContent = String(hit);
    const snap = this.currentTurn === 0 ? null : this.data.snapshots[this.currentTurn - 1];
    const cov = snap ? Object.values(snap).filter(b => b.resolution !== "empty").length : 0;
    const cv = document.getElementById("cov"); if (cv) cv.textContent = String(cov);
  }
}

export function startDemo(data: SessionData) {
  const c = new DemoController(data);
  window.__SESSION__ = data;
  window.__DEMO__ = c;
  c.init();
}
