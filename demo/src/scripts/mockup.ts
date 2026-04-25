/**
 * MockupController — playground command API for the /mockup page.
 *
 * Exposes commands on window.M so you can prototype presentation cues
 * from the browser console:
 *
 *   M.highlight("p1")           // pulse glow
 *   M.dim("p2")                 // fade to 40%
 *   M.spotlight("p3")           // center + scale up
 *   M.arrow("p1", "p2")         // draw an arrow between panels
 *   M.particles("p2", "p4", 6)  // 6 particles flying p2 → p4
 *   M.caption("step 1: hearing")
 *   M.clear()                   // reset everything
 *   M.help()                    // print available commands
 *
 * Panel IDs are p1..p5 (matching the layout positions, not the kinn3
 * semantics — keep this neutral so the vocabulary stays portable).
 */
import { gsap } from "gsap";

declare global {
  interface Window { M: MockupController; }
}

type PanelId = "p1" | "p2" | "p3" | "p4" | "p5";

interface ArrowOpts { color?: string; width?: number; durSec?: number; }
interface ParticleOpts { color?: string; n?: number; size?: number; }
interface HighlightOpts { color?: string; cycles?: number; duration?: number; }

export class MockupController {
  /** Pulse a glowing ring around a panel. */
  highlight(id: PanelId, opts: HighlightOpts = {}) {
    const el = this.$(id); if (!el) return;
    const color = opts.color ?? "rgba(255,211,61,0.55)";
    const cycles = opts.cycles ?? 3;
    const duration = opts.duration ?? 0.55;
    gsap.fromTo(el,
      { boxShadow: `0 0 0 0 ${color}` },
      { boxShadow: `0 0 0 16px ${color.replace(/[\d.]+\)$/, "0)")}`,
        duration, ease: "sine.out", repeat: cycles, yoyo: false,
        onComplete: () => gsap.set(el, { clearProps: "boxShadow" }) });
  }

  /** Quick single-flash (e.g. mention/bling). */
  flash(id: PanelId, color = "rgba(255,211,61,0.6)") {
    const el = this.$(id); if (!el) return;
    gsap.fromTo(el,
      { backgroundColor: color, scale: 1.0 },
      { backgroundColor: this.cssVar("--panel"), scale: 1.0, duration: 0.7, ease: "power2.out" });
  }

  /** Fade a panel to 40% opacity (de-emphasize). */
  dim(id: PanelId, opacity = 0.35) {
    const el = this.$(id); if (!el) return;
    gsap.to(el, { opacity, duration: 0.4, ease: "power2.out" });
  }

  /** Restore opacity. */
  undim(id: PanelId | "all" = "all") {
    if (id === "all") {
      gsap.to(".mock-panel", { opacity: 1, duration: 0.4 });
    } else {
      const el = this.$(id); if (!el) return;
      gsap.to(el, { opacity: 1, duration: 0.4 });
    }
  }

  /** Wiggle (gets attention). */
  shake(id: PanelId) {
    const el = this.$(id); if (!el) return;
    gsap.timeline()
      .to(el, { x: -8, duration: 0.06 })
      .to(el, { x: 8, duration: 0.08 })
      .to(el, { x: -6, duration: 0.08 })
      .to(el, { x: 6, duration: 0.08 })
      .to(el, { x: 0, duration: 0.08, clearProps: "transform" });
  }

  /** Move + scale a panel to center stage; dim the others. */
  spotlight(id: PanelId, scale?: number) {
    const el = this.$(id); if (!el) return;
    const main = document.querySelector("main") as HTMLElement | null;
    if (!main) return;
    gsap.set(el, { clearProps: "transform" });
    const r = el.getBoundingClientRect();
    const m = main.getBoundingClientRect();
    const cx = r.left - m.left + r.width / 2;
    const cy = r.top - m.top + r.height / 2;
    const targetCx = m.width / 2;
    const targetCy = m.height / 2;
    const dx = targetCx - cx;
    const dy = targetCy - cy;
    const autoScale = Math.min(m.width * 0.6 / r.width, m.height * 0.7 / r.height, 2.4);
    const s = scale ?? autoScale;
    // Dim others
    document.querySelectorAll<HTMLElement>(".mock-panel").forEach(p => {
      if (p !== el) gsap.to(p, { opacity: 0.15, duration: 0.5 });
    });
    el.style.zIndex = "100";
    gsap.to(el, { x: dx, y: dy, scale: s, duration: 0.8, ease: "power3.inOut" });
  }

  /** Drop all spotlit panels back into the grid + restore opacities. */
  gridReset() {
    document.querySelectorAll<HTMLElement>(".mock-panel").forEach(p => {
      gsap.to(p, { x: 0, y: 0, scale: 1, opacity: 1, duration: 0.7, ease: "back.inOut(1.1)",
        clearProps: "transform,zIndex" });
    });
  }

  /** Draw an arrow between two panels (curves slightly outward). */
  arrow(fromId: PanelId, toId: PanelId, opts: ArrowOpts = {}) {
    const a = this.$(fromId), b = this.$(toId);
    if (!a || !b) return;
    const main = document.querySelector("main") as HTMLElement | null;
    const svg = document.getElementById("mock-arrows");
    if (!main || !svg) return;
    const m = main.getBoundingClientRect();
    const ar = a.getBoundingClientRect();
    const br = b.getBoundingClientRect();
    const ax = ar.left - m.left + ar.width / 2;
    const ay = ar.top - m.top + ar.height / 2;
    const bx = br.left - m.left + br.width / 2;
    const by = br.top - m.top + br.height / 2;
    const cx = (ax + bx) / 2 + 30;
    const cy = (ay + by) / 2 - 30;
    const color = opts.color ?? "var(--gold)";
    const width = opts.width ?? 3;
    const durSec = opts.durSec ?? 0.9;
    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    path.setAttribute("d", `M ${ax} ${ay} Q ${cx} ${cy} ${bx} ${by}`);
    path.setAttribute("class", "mock-arrow-path");
    path.setAttribute("stroke", color);
    path.setAttribute("stroke-width", String(width));
    path.setAttribute("fill", "none");
    path.setAttribute("stroke-linecap", "round");
    path.setAttribute("marker-end", "url(#mock-arrowhead)");
    svg.appendChild(path);
    const len = (path as SVGPathElement).getTotalLength();
    gsap.set(path, { strokeDasharray: len, strokeDashoffset: len, opacity: 1 });
    gsap.to(path, { strokeDashoffset: 0, duration: durSec, ease: "power2.inOut",
      onComplete: () => gsap.to(path, { opacity: 0, duration: 0.5, delay: 1.2,
        onComplete: () => path.remove() }) });
  }

  /** Spawn N particles flying from one panel to another. */
  particles(fromId: PanelId, toId: PanelId, opts: ParticleOpts | number = {}) {
    const cfg: ParticleOpts = typeof opts === "number" ? { n: opts } : opts;
    const a = this.$(fromId), b = this.$(toId);
    if (!a || !b) return;
    const main = document.querySelector("main") as HTMLElement | null;
    if (!main) return;
    const m = main.getBoundingClientRect();
    const ar = a.getBoundingClientRect();
    const br = b.getBoundingClientRect();
    const color = cfg.color ?? "var(--gold)";
    const n = cfg.n ?? 5;
    const size = cfg.size ?? 8;
    for (let i = 0; i < n; i++) {
      const dot = document.createElement("div");
      dot.className = "mock-particle";
      const startX = ar.left - m.left + ar.width / 2 - size / 2 + (Math.random() - 0.5) * 28;
      const startY = ar.top - m.top + ar.height / 2 - size / 2 + (Math.random() - 0.5) * 28;
      const endX = br.left - m.left + br.width / 2 - size / 2 + (Math.random() - 0.5) * 28;
      const endY = br.top - m.top + br.height / 2 - size / 2 + (Math.random() - 0.5) * 28;
      Object.assign(dot.style, {
        position: "absolute",
        left: `${startX}px`, top: `${startY}px`,
        width: `${size}px`, height: `${size}px`,
        borderRadius: "50%",
        background: color,
        boxShadow: `0 0 12px ${color}`,
        zIndex: "150",
        pointerEvents: "none",
        opacity: "0",
      });
      main.appendChild(dot);
      gsap.to(dot, {
        x: endX - startX, y: endY - startY,
        opacity: 1,
        duration: 1.0 + Math.random() * 0.3,
        delay: 0.05 + i * 0.1,
        ease: "power2.inOut",
        onComplete: () => gsap.to(dot, { opacity: 0, scale: 0.5, duration: 0.3,
          onComplete: () => dot.remove() }),
      });
    }
  }

  /** Big centered caption at bottom. Pass "" to clear. */
  caption(text: string, label = "") {
    const cap = document.getElementById("mock-caption");
    const lbl = document.getElementById("mock-caption-label");
    const txt = document.getElementById("mock-caption-text");
    if (!cap || !txt || !lbl) return;
    if (!text) { gsap.to(cap, { opacity: 0, duration: 0.3 }); return; }
    lbl.textContent = label;
    txt.innerHTML = text;
    lbl.style.display = label ? "block" : "none";
    gsap.fromTo(cap, { opacity: 0, y: 14 }, { opacity: 1, y: 0, duration: 0.5, ease: "power2.out" });
  }

  /** Replace a panel's label text temporarily. */
  label(id: PanelId, text: string) {
    const el = this.$(id);
    const lbl = el?.querySelector(".mock-panel-label") as HTMLElement | null;
    if (lbl) lbl.textContent = text;
  }

  /** Reset everything: clear arrows, particles, caption, restore opacities + grid. */
  clear() {
    document.querySelectorAll(".mock-arrow-path").forEach(p => p.remove());
    document.querySelectorAll(".mock-particle").forEach(p => p.remove());
    this.caption("");
    this.gridReset();
  }

  /** Print available commands to the console. */
  help() {
    const cmds = [
      ["highlight(id, {color, cycles, duration})", "pulse a glowing ring around a panel"],
      ["flash(id, color?)", "quick single flash"],
      ["dim(id, opacity?)", "fade panel (default 0.35)"],
      ["undim(id|'all')", "restore opacity"],
      ["shake(id)", "wiggle"],
      ["spotlight(id, scale?)", "center + scale up; dim the rest"],
      ["gridReset()", "drop all panels back to grid"],
      ["arrow(from, to, {color, width, durSec})", "draw a curved arrow"],
      ["particles(from, to, n?)", "fly N particles between panels"],
      ["caption(text, label?)", "show centered caption (empty text to hide)"],
      ["label(id, text)", "rename a panel"],
      ["clear()", "reset everything"],
    ];
    console.log("%cmockup commands:", "color:#ffd33d; font-weight:bold");
    cmds.forEach(([sig, desc]) => console.log(`  M.${sig.padEnd(50)} %c${desc}`, "color:#8b96aa"));
    console.log("%cpanel ids: p1, p2, p3, p4, p5", "color:#58a6ff");
  }

  // ── internals ──
  private $(id: PanelId): HTMLElement | null {
    return document.getElementById(`mock-${id}`);
  }
  private cssVar(name: string): string {
    return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || "transparent";
  }
}

export function startMockup() {
  const m = new MockupController();
  window.M = m;
  // Friendly first-touch hint in the console
  console.log("%c⚡ Mockup ready. Type M.help() to see commands.",
    "color:#3fb950; font-weight:bold; font-size:14px");
}

/** Wire the floating control panel buttons to the M.* command API. */
export function bindMockupControls() {
  const M = window.M;
  if (!M) return;

  // Three slots: target (single-panel ops), from / to (relational ops).
  const state = { target: "p1" as PanelId, from: "p1" as PanelId, to: "p2" as PanelId };

  // Default-select the initial chips so the first click works without setup
  document.querySelector<HTMLButtonElement>('.chip-row[data-role="target"] [data-pid="p1"]')?.classList.add("active");
  document.querySelector<HTMLButtonElement>('.chip-row[data-role="from"] [data-pid="p1"]')?.classList.add("active");
  document.querySelector<HTMLButtonElement>('.chip-row[data-role="to"] [data-pid="p2"]')?.classList.add("active");

  // Chip selection: only one chip active per row
  document.querySelectorAll<HTMLDivElement>(".chip-row").forEach(row => {
    const role = row.dataset.role as "target" | "from" | "to";
    row.addEventListener("click", e => {
      const btn = (e.target as HTMLElement).closest<HTMLButtonElement>(".chip");
      if (!btn) return;
      row.querySelectorAll(".chip").forEach(c => c.classList.remove("active"));
      btn.classList.add("active");
      const pid = btn.dataset.pid as PanelId;
      state[role] = pid;
    });
  });

  // Command buttons
  document.querySelectorAll<HTMLButtonElement>("[data-cmd]").forEach(btn => {
    btn.addEventListener("click", () => {
      const cmd = btn.dataset.cmd!;
      switch (cmd) {
        case "highlight":   M.highlight(state.target); break;
        case "flash":       M.flash(state.target); break;
        case "shake":       M.shake(state.target); break;
        case "spotlight":   M.spotlight(state.target); break;
        case "dim":         M.dim(state.target); break;
        case "undim-all":   M.undim("all"); break;
        case "arrow":       M.arrow(state.from, state.to); break;
        case "particles":   M.particles(state.from, state.to, 6); break;
        case "caption-show": {
          const t = (document.getElementById("cap-text") as HTMLInputElement | null)?.value ?? "";
          const l = (document.getElementById("cap-label") as HTMLInputElement | null)?.value ?? "";
          M.caption(t, l);
          break;
        }
        case "caption-clear": M.caption(""); break;
        case "grid-reset":    M.gridReset(); break;
        case "clear-all":     M.clear(); break;
      }
    });
  });
}
