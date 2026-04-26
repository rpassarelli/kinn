import {
  AbsoluteFill,
  Sequence,
  interpolate,
  useCurrentFrame,
  spring,
  useVideoConfig,
} from "remotion";
import { colors, fonts, space, shadows } from "../theme";

/**
 * Act 2 — The kinn process pipeline.
 *
 * Three movements over 24 seconds at 30fps (720 frames total):
 *
 *   M1 · Stage reveals          0–6s    (180f)   four cards introduce themselves
 *   M2 · Pipeline assembles +
 *        first turn (Fitted Q)  6–18s   (360f)   particle traverses, takes Fitted Q
 *   M3 · Reground exception     18–24s  (180f)   second particle diverts to reground
 *
 * Standalone composition — slot into Root.tsx as KinnPipeline.
 *
 * Stage geometry (assembled view): 4 cards at 12% / 32% / 60% / 84% of 1920px,
 * vertically centered around y=540. The Denoiser is the largest and sits in
 * the centre. The Questioner branches to two output routes at 96%.
 */

export const PIPELINE_FPS = 30;
export const PIPELINE_DURATION_FRAMES = 840; // 28s — extended so P2 has room to traverse the full data path through the cache before reaching Reground.

const W = 1920;
const H = 1080;

// Master x positions (absolute pixels), tuned for 1920×1080.
// Spacing tightened on the left half + extra room on the right to fit
// the "Next Probe →" handoff pill between Denoiser and Questioner without
// crowding either card.
const STAGE_X = {
  input: 0.08 * W,
  triage: 0.27 * W,
  denoiser: 0.51 * W,
  questioner: 0.79 * W,
  routeFork: 0.93 * W,
};
const STAGE_Y = 0.50 * H;

// Movement boundaries (frames)
const M1_END = 180;
const M2_END = 540;
// M3_END = 720 (composition end)

// Easings
const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);
const easeInOutCubic = (t: number) =>
  t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

// ─────────────────────────────────────────────────────────────────────
// MOVEMENT 1 — Stage reveals (0–6s, 180f)
// Each card slides up from below over ~30f, holds, fades to assembled
// position when M1 ends.
// ─────────────────────────────────────────────────────────────────────

// Stage reveals: each card slides in, holds for `showFor` frames at centre,
// fades out as the next slides in. Last card collapses into track at M1 end.
// Timing: card 1 (0-42), card 2 (36-84), card 3 (78-126), card 4 (120-180).
// 6f overlap between consecutive cards for smooth handoff.
//
// Each card has 3 bullets that reveal one by one beneath it. Bullet reveal
// frames are absolute (relative to composition start). When scrubbing the
// timeline by hand during voiceover, snap to these frames to land on each
// bullet's appearance.
// Each bullet is split into three parts so the centre `bold` segment
// can render as the punchline emphasis. `pre` and `post` are plain text.
type BulletParts = { pre: string; bold: string; post: string };

const M1_REVEALS: {
  name: string;
  tagline: string;
  from: number;
  showFor: number;
  bullets: BulletParts[];
  bulletFrames: [number, number, number];
}[] = [
  {
    name: "User Input",
    tagline: "stakeholder message",
    from: 0,
    showFor: 42,
    bullets: [
      { pre: "Feels ",    bold: "natural",          post: " like any chat" },
      { pre: "Captures their ", bold: "vocabulary", post: "" },
      { pre: "Sets the ", bold: "cognitive budget", post: " for the turn" },
    ],
    bulletFrames: [12, 22, 32],
  },
  {
    name: "Signals Triage",
    tagline: "facts · co-alg · user-alg",
    from: 36,
    showFor: 48,
    bullets: [
      { pre: "", bold: "Facts",             post: " → sharpen the business model" },
      { pre: "", bold: "Company algedonic", post: " → org pleasure / pain" },
      { pre: "", bold: "User algedonic",    post: " → stakeholder fatigue & rapport" },
    ],
    bulletFrames: [48, 58, 68],
  },
  {
    name: "Denoiser",
    tagline: "read · pick · denoise · update",
    from: 78,
    showFor: 48,
    bullets: [
      { pre: "Reads the ",  bold: "current belief",         post: ", applies new mutations" },
      { pre: "Picks the next probe by ", bold: "expected information gain", post: "" },
      { pre: "Hands the ",  bold: "picked probe",           post: " to the Questioner" },
    ],
    bulletFrames: [90, 100, 110],
  },
  {
    name: "Questioner",
    tagline: "fitted Q · reground",
    from: 120,
    showFor: 60,
    bullets: [
      { pre: "Shapes the probe to the user's ", bold: "voice & register", post: "" },
      { pre: "Enforces ",                       bold: "≤ 30 words, exactly one ?", post: "" },
      { pre: "Diverts to ",                     bold: "reground",         post: " when the user-alg cache fills" },
    ],
    bulletFrames: [132, 144, 156],
  },
];

const StageReveal: React.FC<{
  name: string;
  tagline: string;
  index: number;
  from: number;
  showFor: number; // how many frames this card is visible at center
  m1End: number;
  finalX: number;
  finalY: number;
  bullets: BulletParts[];
  bulletFrames: [number, number, number]; // absolute frames each bullet appears
}> = ({ name, tagline, index, from, showFor, m1End, finalX, finalY, bullets, bulletFrames }) => {
  const frame = useCurrentFrame();
  const local = frame - from;

  // Reveal in: slide up from below + fade in over first 18f
  const inT = Math.max(0, Math.min(1, local / 18));
  const inEased = easeOutCubic(inT);

  // Reveal out: fade out + slight fall over the last 14f of showFor
  // (unless this is the last card, which collapses into the track instead).
  const isLast = index === M1_REVEALS.length - 1;
  const outStart = showFor - 14;
  const outT = Math.max(0, Math.min(1, (local - outStart) / 14));
  const outEased = easeInOutCubic(outT);

  // For the last card, collapse to the track position at end of M1.
  const collapseStart = m1End - 24;
  const collapseT = Math.max(
    0,
    Math.min(1, (frame - collapseStart) / 24)
  );
  const collapseEased = easeInOutCubic(collapseT);

  const holdX = W / 2;
  const holdY = H / 2;

  // Position
  let x = holdX;
  let y = holdY;
  if (isLast) {
    x = holdX + (finalX - holdX) * collapseEased;
    y = holdY + (finalY - holdY) * collapseEased;
  }

  // Y offset for slide-in
  const startYOffset = 80;
  const yOffsetIn = (1 - inEased) * startYOffset;
  const yOffsetOut = isLast ? 0 : outEased * 30; // gently fall for non-last cards

  // Opacity
  let opacity = inEased * (1 - (isLast ? 0 : outEased));

  // Visibility window: render only between [from, from + showFor]
  // Last card also stays through collapse phase.
  if (local < 0) return null;
  if (!isLast && local > showFor) return null;
  if (isLast && frame >= m1End) return null;

  // Scale: last card shrinks as it collapses into track; others stay 1
  const scale = isLast ? 1 - 0.35 * collapseEased : 1;

  // Bullet visibility — each bullet appears at its assigned absolute frame
  // and stays visible until the card itself fades out.
  const bulletsVisible = bullets.map((_, i) => frame >= bulletFrames[i]);

  return (
    <div
      style={{
        position: "absolute",
        left: x,
        top: y + yOffsetIn + yOffsetOut,
        transform: `translate(-50%, -50%) scale(${scale})`,
        opacity,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 24,
      }}
    >
      <StageCard name={name} tagline={tagline} index={index} />
      <BulletList bullets={bullets} visible={bulletsVisible} />
    </div>
  );
};

// Three bullets laid out as a 3-column row beneath each StageCard. Narrower
// columns force the text to wrap into 2-3 lines, which slows reading and
// makes each bullet feel deliberate. The middle bold span carries the
// punchline of the bullet.
const BulletList: React.FC<{
  bullets: BulletParts[];
  visible: boolean[];
}> = ({ bullets, visible }) => (
  <div
    style={{
      display: "grid",
      gridTemplateColumns: "repeat(3, 320px)",
      justifyContent: "center",
      columnGap: 80,
      paddingTop: 12,
    }}
  >
    {bullets.map((b, i) => (
      <div
        key={i}
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          textAlign: "center",
          gap: 18,
          opacity: visible[i] ? 1 : 0,
          transform: visible[i] ? "translateY(0)" : "translateY(12px)",
          transition: "opacity 280ms ease-out, transform 280ms ease-out",
        }}
      >
        <div
          style={{
            width: 22,
            height: 22,
            borderRadius: "50%",
            background: `radial-gradient(circle at 30% 30%, #F4D5A8 0%, ${colors.accent} 50%, #B98654 100%)`,
            boxShadow: `0 0 14px rgba(212,163,115,0.55), 0 0 32px rgba(212,163,115,0.35), 0 0 56px rgba(212,163,115,0.15)`,
            flexShrink: 0,
          }}
        />
        <div
          style={{
            fontFamily: fonts.ui,
            fontSize: 24,
            fontWeight: 400,
            color: colors.primaryText,
            lineHeight: 1.35,
            letterSpacing: "-0.01em",
            maxWidth: 320,
          }}
        >
          {b.pre}
          <span style={{ fontWeight: 700, color: colors.primaryText }}>
            {b.bold}
          </span>
          {b.post}
        </div>
      </div>
    ))}
  </div>
);

const StageCard: React.FC<{ name: string; tagline: string; index: number }> = ({
  name,
  tagline,
  index,
}) => (
  <div
    style={{
      width: 360,
      padding: "28px 32px",
      background: colors.surface,
      border: `1px solid rgba(0,0,0,0.08)`,
      borderRadius: 20,
      boxShadow: shadows.elevated,
      textAlign: "center",
    }}
  >
    <div
      style={{
        fontFamily: fonts.ui,
        fontSize: 13,
        fontWeight: 600,
        letterSpacing: "0.22em",
        textTransform: "uppercase",
        color: colors.accent,
        marginBottom: 12,
      }}
    >
      {String(index + 1).padStart(2, "0")}
    </div>
    <div
      style={{
        fontFamily: fonts.display,
        fontSize: 42,
        fontWeight: 500,
        letterSpacing: "-0.015em",
        color: colors.primaryText,
        marginBottom: 12,
        lineHeight: 1.1,
      }}
    >
      {name}
    </div>
    <div
      style={{
        fontFamily: fonts.ui,
        fontSize: 13,
        letterSpacing: "0.18em",
        textTransform: "uppercase",
        color: colors.secondaryText,
      }}
    >
      {tagline}
    </div>
  </div>
);

// ─────────────────────────────────────────────────────────────────────
// MOVEMENT 2 + 3 — Assembled pipeline view
// Static layout that's visible from M1_END onward. The outer particle
// traverses it (M2), then a second particle diverts to reground (M3).
// ─────────────────────────────────────────────────────────────────────

// Track line — a faint horizontal rule connecting all stages.
const TrackLine: React.FC<{ visibleFrom: number }> = ({ visibleFrom }) => {
  const frame = useCurrentFrame();
  const opacity = interpolate(
    frame,
    [visibleFrom, visibleFrom + 18],
    [0, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );
  return (
    <div
      style={{
        position: "absolute",
        left: STAGE_X.input,
        right: W - STAGE_X.routeFork,
        top: STAGE_Y,
        height: 2,
        background: `linear-gradient(to right, transparent, rgba(0,0,0,0.10) 8%, rgba(0,0,0,0.10) 92%, transparent)`,
        opacity,
      }}
    />
  );
};

// A small assembled stage tile — the 4 stages in their pipeline positions.
type AssembledTile = {
  x: number;
  label: string;
  sub: string;
  width: number;
  height: number;
};

const AssembledStage: React.FC<{
  tile: AssembledTile;
  active: boolean;
  visibleFrom: number;
}> = ({ tile, active, visibleFrom }) => {
  const frame = useCurrentFrame();
  const opacity = interpolate(
    frame,
    [visibleFrom, visibleFrom + 24],
    [0, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );

  // Active pulse: scale 1.05 + warm glow when particle is here.
  const activeScale = active ? 1.05 : 1;
  const activeShadow = active
    ? `0 12px 40px rgba(212,163,115,0.45), 0 0 0 2px ${colors.accent}`
    : shadows.elevated;

  return (
    <div
      style={{
        position: "absolute",
        left: tile.x,
        top: STAGE_Y,
        transform: `translate(-50%, -50%) scale(${activeScale})`,
        width: tile.width,
        height: tile.height,
        background: colors.surface,
        border: active
          ? `2px solid ${colors.accent}`
          : `1px solid rgba(0,0,0,0.08)`,
        borderRadius: 18,
        boxShadow: activeShadow,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
        opacity,
        transition: "all 200ms",
      }}
    >
      <div
        style={{
          fontFamily: fonts.display,
          fontSize: 26,
          fontWeight: 500,
          letterSpacing: "-0.01em",
          color: colors.primaryText,
        }}
      >
        {tile.label}
      </div>
      <div
        style={{
          fontFamily: fonts.ui,
          fontSize: 11,
          letterSpacing: "0.18em",
          textTransform: "uppercase",
          color: colors.secondaryText,
          textAlign: "center",
        }}
      >
        {tile.sub}
      </div>
    </div>
  );
};

// The Triage card includes 3 colored streams stacked inside.
const STREAM_COLORS = {
  facts: "#6B8E7F",
  coAlg: colors.accent,
  userAlg: "#9C7DAB",
};

const TriageCard: React.FC<{
  active: boolean;
  visibleFrom: number;
  // Highlights: which stream is firing this beat (-1 = none)
  highlightStream: number;
  // When user-alg flares red (M3 reground trigger)
  fatigueFrame: number | null;
}> = ({ active, visibleFrom, highlightStream, fatigueFrame }) => {
  const frame = useCurrentFrame();
  const opacity = interpolate(
    frame,
    [visibleFrom, visibleFrom + 24],
    [0, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );

  const fatigueLocal = fatigueFrame !== null ? frame - fatigueFrame : -1000;
  const fatigueActive = fatigueLocal >= 0 && fatigueLocal < 60;
  const fatigueT = fatigueActive
    ? Math.max(0, Math.min(1, fatigueLocal / 30))
    : 0;

  const activeScale = active ? 1.05 : 1;
  const activeShadow = active
    ? `0 12px 40px rgba(212,163,115,0.45), 0 0 0 2px ${colors.accent}`
    : shadows.elevated;

  return (
    <div
      style={{
        position: "absolute",
        left: STAGE_X.triage,
        top: STAGE_Y,
        transform: `translate(-50%, -50%) scale(${activeScale})`,
        width: 240,
        background: colors.surface,
        border: active
          ? `2px solid ${colors.accent}`
          : `1px solid rgba(0,0,0,0.08)`,
        borderRadius: 18,
        boxShadow: activeShadow,
        padding: "22px 22px",
        display: "flex",
        flexDirection: "column",
        gap: 12,
        opacity,
      }}
    >
      <div
        style={{
          fontFamily: fonts.display,
          fontSize: 22,
          fontWeight: 500,
          letterSpacing: "-0.01em",
          color: colors.primaryText,
          textAlign: "center",
          marginBottom: 4,
        }}
      >
        Signals Triage
      </div>
      <Stream
        label="facts"
        color={STREAM_COLORS.facts}
        highlight={highlightStream === 0}
      />
      <Stream
        label="company alg."
        color={STREAM_COLORS.coAlg}
        highlight={highlightStream === 1}
      />
      <Stream
        label="user alg."
        color={
          fatigueActive
            ? `rgba(220,90,90,${0.5 + fatigueT * 0.5})`
            : STREAM_COLORS.userAlg
        }
        highlight={highlightStream === 2 || fatigueActive}
        flash={fatigueActive}
      />
    </div>
  );
};

const Stream: React.FC<{
  label: string;
  color: string;
  highlight: boolean;
  flash?: boolean;
}> = ({ label, color, highlight, flash }) => (
  <div
    style={{
      display: "flex",
      alignItems: "center",
      gap: 10,
      padding: "10px 14px",
      borderRadius: 10,
      background: highlight ? "rgba(212,163,115,0.12)" : "rgba(0,0,0,0.03)",
      transform: highlight ? "translateX(6px)" : "translateX(0)",
      transition: "transform 200ms, background 200ms",
    }}
  >
    <div
      style={{
        width: 12,
        height: 12,
        borderRadius: 6,
        background: color,
        boxShadow: flash
          ? `0 0 12px ${color}, 0 0 24px ${color}`
          : highlight
          ? `0 0 8px ${color}`
          : "none",
      }}
    />
    <div
      style={{
        fontFamily: fonts.ui,
        fontSize: 13,
        fontWeight: 600,
        letterSpacing: "0.14em",
        textTransform: "uppercase",
        color: colors.primaryText,
      }}
    >
      {label}
    </div>
  </div>
);

// Denoiser card with inner ring (Read top, Pick right, Update bottom, Denoise left)
const DenoiserCard: React.FC<{
  active: boolean;
  visibleFrom: number;
  // 0=read, 1=pick, 2=update, 3=denoise; -1 = idle
  innerStep: number;
}> = ({ active, visibleFrom, innerStep }) => {
  const frame = useCurrentFrame();
  const opacity = interpolate(
    frame,
    [visibleFrom, visibleFrom + 24],
    [0, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );

  const activeScale = active ? 1.04 : 1;
  const activeShadow = active
    ? `0 14px 48px rgba(212,163,115,0.45), 0 0 0 2px ${colors.accent}`
    : shadows.elevated;

  // Ring order matches the codebase per-turn flow (agent.py:78-187):
  //   Read   → load belief + probes from memory
  //   Pick   → BED-LLM argmax EIG over pending probes
  //   Denoise → forced-tool LLM call extracts signal mutations from answer
  //   Update → apply mutations to belief, persist
  // Clockwise from top: top, right, bottom, left.
  const ringR = 110;
  const nodes = [
    { label: "Read",    angle: -Math.PI / 2 }, // top
    { label: "Pick",    angle: 0 },             // right
    { label: "Denoise", angle: Math.PI / 2 },  // bottom
    { label: "Update",  angle: Math.PI },      // left
  ];

  return (
    <div
      style={{
        position: "absolute",
        left: STAGE_X.denoiser,
        top: STAGE_Y,
        transform: `translate(-50%, -50%) scale(${activeScale})`,
        width: 360,
        height: 360,
        background: colors.surface,
        border: active
          ? `2px solid ${colors.accent}`
          : `1px solid rgba(0,0,0,0.08)`,
        borderRadius: 24,
        boxShadow: activeShadow,
        opacity,
      }}
    >
      {/* Title — anchored to top of card, doesn't disrupt the centered ring layout */}
      <div
        style={{
          position: "absolute",
          top: 18,
          left: 0,
          right: 0,
          textAlign: "center",
          fontFamily: fonts.display,
          fontSize: 22,
          fontWeight: 500,
          letterSpacing: "-0.01em",
          color: colors.primaryText,
          zIndex: 2,
        }}
      >
        Denoiser
      </div>
      <div
        style={{
          position: "relative",
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {/* Dashed ring */}
        <div
          style={{
            position: "absolute",
            top: "50%",
            left: "50%",
            width: ringR * 2,
            height: ringR * 2,
            transform: "translate(-50%, -50%)",
            border: `1px dashed rgba(0,0,0,0.12)`,
            borderRadius: "50%",
          }}
        />

        {/* Centre VSM mini-grid */}
        {/* VSM cell promotion fires on Update step (index 3) — that's when
            mutations are applied to the belief, sharpening the image. */}
        <VSMMiniGrid promote={innerStep === 3} />

        {/* 4 nodes */}
        {nodes.map((n, i) => {
          const x = Math.cos(n.angle) * ringR;
          const y = Math.sin(n.angle) * ringR;
          const isActive = innerStep === i;
          return (
            <div
              key={n.label}
              style={{
                position: "absolute",
                top: "50%",
                left: "50%",
                width: 64,
                height: 64,
                transform: `translate(calc(-50% + ${x}px), calc(-50% + ${y}px)) scale(${isActive ? 1.15 : 1})`,
                background: colors.surface,
                border: isActive
                  ? `2px solid ${colors.accent}`
                  : "1px solid rgba(0,0,0,0.08)",
                borderRadius: "50%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                boxShadow: isActive
                  ? `0 0 0 4px rgba(212,163,115,0.18), 0 6px 20px rgba(212,163,115,0.30)`
                  : "0 2px 8px rgba(0,0,0,0.04)",
                fontFamily: fonts.ui,
                fontSize: 12,
                fontWeight: 600,
                color: isActive ? colors.accent : colors.primaryText,
                letterSpacing: "0.04em",
                transition: "all 180ms",
              }}
            >
              {n.label}
            </div>
          );
        })}

        {/* Inner orbiter — circles the ring while Denoiser is active */}
        {active && <InnerOrbiter ringR={ringR} />}
      </div>

      {/* "Next probe →" handoff label, anchored to the right edge of the
          card. Lights up on the Update step (innerStep === 3) — that's
          when the cycle finishes and the picked probe is ready to be
          handed to the Questioner. */}
      <NextProbeHandoff handoffActive={innerStep === 3} />
    </div>
  );
};

const NextProbeHandoff: React.FC<{ handoffActive: boolean }> = ({
  handoffActive,
}) => {
  return (
    <div
      style={{
        position: "absolute",
        right: -16,
        top: "50%",
        transform: `translate(100%, -50%) scale(${handoffActive ? 1.06 : 1})`,
        display: "flex",
        alignItems: "center",
        gap: 8,
        padding: "8px 14px",
        background: handoffActive ? colors.accent : colors.surface,
        color: handoffActive ? "#fff" : colors.accent,
        border: `1.5px solid ${colors.accent}`,
        borderRadius: 999,
        fontFamily: fonts.ui,
        fontSize: 11,
        fontWeight: 700,
        letterSpacing: "0.16em",
        textTransform: "uppercase",
        whiteSpace: "nowrap",
        boxShadow: handoffActive
          ? `0 6px 18px rgba(212,163,115,0.45)`
          : `0 2px 8px rgba(0,0,0,0.04)`,
        opacity: handoffActive ? 1 : 0.6,
        transition: "all 220ms",
      }}
    >
      <span>Next Probe</span>
      <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true">
        <path
          fill="currentColor"
          d="M13.5 4.5l1.4-1.4L24 12l-9.1 8.9-1.4-1.4 6.6-6.5H0v-2h20.1z"
        />
      </svg>
    </div>
  );
};

const VSMMiniGrid: React.FC<{ promote: boolean }> = ({ promote }) => {
  // 6 rows × 4 columns. 2nd row col 3 (mid) is the cell that promotes.
  const cells: { level: number; promote?: boolean }[] = [
    { level: 0 }, { level: 1 }, { level: 2 }, { level: -1 },
    { level: 0 }, { level: 1 }, { level: 2, promote: true }, { level: -1 },
    { level: 0 }, { level: 1 }, { level: 2 }, { level: 3 },
    { level: 0 }, { level: -1 }, { level: -1 }, { level: -1 },
    { level: 0 }, { level: 1 }, { level: -1 }, { level: -1 },
    { level: 0 }, { level: 1 }, { level: 2 }, { level: -1 },
  ];

  const levelColor = (level: number, isPromoting: boolean) => {
    if (isPromoting) return colors.accent;
    if (level === -1) return "rgba(0,0,0,0.06)";
    if (level === 0) return "rgba(212,163,115,0.18)";
    if (level === 1) return "rgba(212,163,115,0.40)";
    if (level === 2) return "rgba(212,163,115,0.65)";
    return colors.accent;
  };

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(4, 14px)",
        gridAutoRows: "9px",
        gap: 3,
        zIndex: 1,
      }}
    >
      {cells.map((c, i) => {
        const isPromoting = c.promote && promote;
        return (
          <div
            key={i}
            style={{
              borderRadius: 2,
              background: levelColor(c.level, !!isPromoting),
              transform: isPromoting ? "scale(1.5)" : "scale(1)",
              boxShadow: isPromoting
                ? `0 0 8px rgba(212,163,115,0.7)`
                : "none",
              transition: "all 200ms",
            }}
          />
        );
      })}
    </div>
  );
};

const InnerOrbiter: React.FC<{ ringR: number }> = ({ ringR }) => {
  const frame = useCurrentFrame();
  // 90 frames per inner cycle (3s at 30fps). Loops continuously while active.
  const cycle = (frame % 90) / 90;
  const angle = cycle * Math.PI * 2 - Math.PI / 2;
  const x = Math.cos(angle) * ringR;
  const y = Math.sin(angle) * ringR;
  return (
    <div
      style={{
        position: "absolute",
        top: "50%",
        left: "50%",
        width: 14,
        height: 14,
        transform: `translate(calc(-50% + ${x}px), calc(-50% + ${y}px))`,
        background: colors.accent,
        borderRadius: "50%",
        boxShadow: `0 0 12px rgba(212,163,115,0.7), 0 0 24px rgba(212,163,115,0.45)`,
      }}
    />
  );
};

// Two output route pills + connecting lines from Questioner.
const OutputRoutes: React.FC<{
  visibleFrom: number;
  activeRoute: "fitted" | "reground" | null;
}> = ({ visibleFrom, activeRoute }) => {
  const frame = useCurrentFrame();
  const opacity = interpolate(
    frame,
    [visibleFrom, visibleFrom + 24],
    [0, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );

  const fittedActive = activeRoute === "fitted";
  const regroundActive = activeRoute === "reground";

  return (
    <>
      {/* Next Question route — top (the default fitted output) */}
      <div
        style={{
          position: "absolute",
          left: STAGE_X.routeFork,
          top: STAGE_Y - 70,
          transform: `translate(-50%, -50%) scale(${fittedActive ? 1.08 : 1})`,
          padding: "12px 22px",
          background: fittedActive ? `${colors.accent}` : colors.surface,
          color: fittedActive ? "#fff" : colors.accent,
          border: `2px solid ${colors.accent}`,
          borderRadius: 999,
          fontFamily: fonts.ui,
          fontSize: 13,
          fontWeight: 700,
          letterSpacing: "0.16em",
          textTransform: "uppercase",
          whiteSpace: "nowrap",
          boxShadow: fittedActive
            ? `0 8px 28px rgba(212,163,115,0.45)`
            : shadows.card,
          opacity,
          transition: "all 220ms",
        }}
      >
        Next Question
      </div>

      {/* Reground User route — bottom (safety branch on fatigue spike) */}
      <div
        style={{
          position: "absolute",
          left: STAGE_X.routeFork,
          top: STAGE_Y + 70,
          transform: `translate(-50%, -50%) scale(${regroundActive ? 1.08 : 1})`,
          padding: "12px 22px",
          background: regroundActive ? "#9C7DAB" : colors.surface,
          color: regroundActive ? "#fff" : "#9C7DAB",
          border: `2px solid #9C7DAB`,
          borderRadius: 999,
          fontFamily: fonts.ui,
          fontSize: 13,
          fontWeight: 700,
          letterSpacing: "0.16em",
          textTransform: "uppercase",
          whiteSpace: "nowrap",
          boxShadow: regroundActive
            ? `0 8px 28px rgba(156,125,171,0.45)`
            : shadows.card,
          opacity,
          transition: "all 220ms",
        }}
      >
        Reground User
      </div>

      {/* Lines from Questioner to each route */}
      <svg
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          width: W,
          height: H,
          pointerEvents: "none",
          opacity,
        }}
      >
        <line
          x1={STAGE_X.questioner + 110}
          y1={STAGE_Y}
          x2={STAGE_X.routeFork - 110}
          y2={STAGE_Y - 70}
          stroke={colors.accent}
          strokeWidth={fittedActive ? 3 : 1.5}
          opacity={fittedActive ? 1 : 0.4}
        />
        <line
          x1={STAGE_X.questioner + 110}
          y1={STAGE_Y}
          x2={STAGE_X.routeFork - 110}
          y2={STAGE_Y + 70}
          stroke="#9C7DAB"
          strokeWidth={regroundActive ? 3 : 1.5}
          opacity={regroundActive ? 1 : 0.4}
          strokeDasharray="6 6"
        />
      </svg>
    </>
  );
};

// The traveling particle that runs the per-turn cycle.
type ParticleStop = { x: number; y: number; arriveFrame: number; dwellFrames: number };

const Particle: React.FC<{
  stops: ParticleStop[];
  fadeIn: number;
  fadeOut: number;
  // After last stop, where does the particle exit to?
  exitTo?: { x: number; y: number; durationFrames: number };
}> = ({ stops, fadeIn, fadeOut, exitTo }) => {
  const frame = useCurrentFrame();
  if (frame < fadeIn) return null;

  // Determine where particle is at this frame.
  let x: number, y: number;
  let opacity = 1;

  // Fade-in window
  const fadeInT = Math.min(1, (frame - fadeIn) / 12);

  // Find current segment
  if (frame < stops[0].arriveFrame) {
    // Pre-first-stop: travel from off-frame-left to first stop
    const t = Math.max(
      0,
      Math.min(1, (frame - fadeIn) / (stops[0].arriveFrame - fadeIn))
    );
    const eased = easeInOutCubic(t);
    x = -50 + (stops[0].x - (-50)) * eased;
    y = stops[0].y;
  } else {
    // Walk through segments
    let placed = false;
    for (let i = 0; i < stops.length; i++) {
      const s = stops[i];
      const dwellEnd = s.arriveFrame + s.dwellFrames;
      if (frame >= s.arriveFrame && frame <= dwellEnd) {
        x = s.x;
        y = s.y;
        placed = true;
        break;
      }
      // Between this dwell-end and next arrival
      if (i + 1 < stops.length) {
        const next = stops[i + 1];
        if (frame > dwellEnd && frame < next.arriveFrame) {
          const t = (frame - dwellEnd) / (next.arriveFrame - dwellEnd);
          const eased = easeInOutCubic(t);
          x = s.x + (next.x - s.x) * eased;
          y = s.y + (next.y - s.y) * eased;
          placed = true;
          break;
        }
      }
    }
    if (!placed) {
      // Past last stop — exit
      const last = stops[stops.length - 1];
      const dwellEnd = last.arriveFrame + last.dwellFrames;
      if (exitTo) {
        const t = Math.max(
          0,
          Math.min(1, (frame - dwellEnd) / exitTo.durationFrames)
        );
        const eased = easeInOutCubic(t);
        x = last.x + (exitTo.x - last.x) * eased;
        y = last.y + (exitTo.y - last.y) * eased;
        opacity = 1 - t * 0.7;
        if (frame > fadeOut) opacity = 0;
      } else {
        x = last.x;
        y = last.y;
      }
    }
  }

  // @ts-ignore — x/y are guaranteed assigned above
  const px = x;
  // @ts-ignore
  const py = y;

  return (
    <div
      style={{
        position: "absolute",
        left: px,
        top: py,
        transform: "translate(-50%, -50%)",
        width: 22,
        height: 22,
        borderRadius: "50%",
        background: `radial-gradient(circle at 30% 30%, #F4D5A8 0%, ${colors.accent} 50%, #B98654 100%)`,
        boxShadow: `0 0 14px rgba(212,163,115,0.55), 0 0 32px rgba(212,163,115,0.35), 0 0 56px rgba(212,163,115,0.15)`,
        opacity: opacity * fadeInT,
        zIndex: 50,
      }}
    >
      {/* Trailing wake — points "back" along the implied path */}
      <div
        style={{
          position: "absolute",
          right: "100%",
          top: "50%",
          transform: "translateY(-50%)",
          width: 80,
          height: 6,
          background: `linear-gradient(to left, rgba(212,163,115,0.55), transparent)`,
          filter: "blur(4px)",
          opacity: 0.7,
        }}
      />
    </div>
  );
};

// Header strip — stage names that light when active.
const HeaderStrip: React.FC<{
  visibleFrom: number;
  activeIndex: number; // -1 = none
}> = ({ visibleFrom, activeIndex }) => {
  const frame = useCurrentFrame();
  const opacity = interpolate(
    frame,
    [visibleFrom, visibleFrom + 18],
    [0, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );
  const labels = ["User Input", "Signals Triage", "Denoiser", "Questioner"];
  return (
    <div
      style={{
        position: "absolute",
        top: 70,
        left: 0,
        right: 0,
        display: "flex",
        justifyContent: "center",
        gap: 32,
        opacity,
      }}
    >
      {labels.map((l, i) => {
        const isActive = i === activeIndex;
        return (
          <div
            key={l}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              padding: "10px 18px",
              borderRadius: 999,
              background: isActive ? "rgba(212,163,115,0.16)" : "transparent",
              transition: "all 220ms",
            }}
          >
            <span
              style={{
                fontFamily: fonts.ui,
                fontSize: 12,
                fontWeight: 600,
                color: isActive ? "#B98654" : colors.secondaryText,
                opacity: 0.7,
              }}
            >
              {String(i + 1).padStart(2, "0")}
            </span>
            <span
              style={{
                fontFamily: fonts.ui,
                fontSize: 13,
                fontWeight: 700,
                letterSpacing: "0.18em",
                textTransform: "uppercase",
                color: isActive ? "#B98654" : colors.secondaryText,
              }}
            >
              {l}
            </span>
          </div>
        );
      })}
    </div>
  );
};

// Footer captions — always visible after M1.
const FooterCaptions: React.FC<{ visibleFrom: number }> = ({ visibleFrom }) => {
  const frame = useCurrentFrame();
  const opacity = interpolate(
    frame,
    [visibleFrom, visibleFrom + 18],
    [0, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );
  return (
    <div
      style={{
        position: "absolute",
        bottom: 80,
        left: 0,
        right: 0,
        display: "flex",
        justifyContent: "space-between",
        padding: "0 120px",
        opacity,
      }}
    >
      <Caption label="in" text="stakeholder answer" emphasis={false} />
      <Caption label="loop" text="cycles 1–3× per turn" emphasis={false} />
      <Caption label="out" text="fitted question · sharpened belief" emphasis />
    </div>
  );
};

// User-Algedonic Cache — sits below the Questioner card. Tracks accumulated
// stakeholder fatigue across turns: each user-alg activation in Triage adds
// one segment (left→right). Once all 4 segments are full, the Questioner
// is informed and the Reground User route fires.
//
// Color: red (saturated fatigue tone). Matches the user-alg flare hue but
// stronger since this is a persistent UI element.
const USER_ALG_PURPLE = "#D55A5A"; // (variable name kept for diff hygiene)

const UserAlgCache: React.FC<{
  visibleFrom: number;
  filledSegments: number; // 0..4
  cacheFull: boolean;
}> = ({ visibleFrom, filledSegments, cacheFull }) => {
  const frame = useCurrentFrame();
  const opacity = interpolate(
    frame,
    [visibleFrom, visibleFrom + 24],
    [0, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );

  const segments = 4;
  const cacheY = STAGE_Y + 280; // pushed lower so the bus runs below the pipeline rule

  // Pulse the cache border when it just became full
  const fullPulse = cacheFull
    ? `0 0 0 4px rgba(156,125,171,0.20), 0 8px 28px rgba(156,125,171,0.45)`
    : `0 4px 16px rgba(0,0,0,0.04)`;

  return (
    <div
      style={{
        position: "absolute",
        left: STAGE_X.questioner,
        top: cacheY,
        transform: "translate(-50%, -50%)",
        background: colors.surface,
        border: cacheFull
          ? `2px solid ${USER_ALG_PURPLE}`
          : `1px solid rgba(0,0,0,0.08)`,
        borderRadius: 16,
        padding: "14px 18px",
        boxShadow: fullPulse,
        opacity,
        display: "flex",
        flexDirection: "column",
        gap: 8,
        alignItems: "center",
        transition: "all 220ms",
      }}
    >
      <div
        style={{
          fontFamily: fonts.ui,
          fontSize: 10,
          fontWeight: 700,
          letterSpacing: "0.18em",
          textTransform: "uppercase",
          color: cacheFull ? USER_ALG_PURPLE : colors.secondaryText,
        }}
      >
        User-Alg Cache
      </div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: `repeat(${segments}, 1fr)`,
          gap: 4,
          width: 200,
        }}
      >
        {Array.from({ length: segments }).map((_, i) => {
          const isFilled = i < filledSegments;
          const justFilled = i === filledSegments - 1 && cacheFull;
          return (
            <div
              key={i}
              style={{
                height: 16,
                borderRadius: 4,
                background: isFilled ? USER_ALG_PURPLE : "rgba(156,125,171,0.10)",
                boxShadow: justFilled
                  ? `0 0 12px ${USER_ALG_PURPLE}`
                  : "none",
                transition: "background 200ms, box-shadow 200ms",
              }}
            />
          );
        })}
      </div>
    </div>
  );
};

// Side-bus connector: short stub down from Triage's user-alg row, then a
// horizontal line under the pipeline to the cache. Lights up purple when
// the user-alg signal is active in Triage.
const UserAlgBus: React.FC<{
  visibleFrom: number;
  active: boolean;
  cacheFull: boolean;
}> = ({ visibleFrom, active, cacheFull }) => {
  const frame = useCurrentFrame();
  const opacity = interpolate(
    frame,
    [visibleFrom, visibleFrom + 24],
    [0, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );

  // Triage's user-alg row is the bottom row inside the Triage card.
  // Bus runs lower than before so it sits below the main pipeline rule
  // and doesn't visually compete with the central horizontal flow.
  const busOriginX = STAGE_X.triage;
  const busOriginY = STAGE_Y + 100;    // exit point below the Triage card
  const busBendY = STAGE_Y + 280;      // pushed lower
  const busTargetX = STAGE_X.questioner;

  const stroke = active || cacheFull ? USER_ALG_PURPLE : "rgba(156,125,171,0.30)";
  const strokeWidth = active || cacheFull ? 2.5 : 1.5;
  const dasharray = active || cacheFull ? "0" : "6 6";

  return (
    <svg
      style={{
        position: "absolute",
        left: 0,
        top: 0,
        width: W,
        height: H,
        pointerEvents: "none",
        opacity,
      }}
    >
      {/* down-stub from Triage → bend point */}
      <line
        x1={busOriginX}
        y1={busOriginY}
        x2={busOriginX}
        y2={busBendY}
        stroke={stroke}
        strokeWidth={strokeWidth}
        strokeDasharray={dasharray}
      />
      {/* horizontal run → cache */}
      <line
        x1={busOriginX}
        y1={busBendY}
        x2={busTargetX}
        y2={busBendY}
        stroke={stroke}
        strokeWidth={strokeWidth}
        strokeDasharray={dasharray}
      />
      {/* small arrow head into cache */}
      {(active || cacheFull) && (
        <polygon
          points={`${busTargetX - 8},${busBendY - 4} ${busTargetX},${busBendY} ${busTargetX - 8},${busBendY + 4}`}
          fill={stroke}
        />
      )}
    </svg>
  );
};

// Bus particle — a small red orb that travels the side-bus path from the
// Triage user-alg row to the cache. One particle per fill event. It's a
// dedicated channel so the main outer particle stays on the pipeline.
//
// Path is a 2-segment polyline:
//   1. (originX, originY) → (originX, bendY)        [vertical drop]
//   2. (originX, bendY)   → (targetX, bendY)        [horizontal run]
//
// Total path animated linearly over `durationFrames`. After arrival, the
// particle expands briefly then fades — the cache segment fill animation
// takes over the visual emphasis.
const BusParticle: React.FC<{
  startFrame: number;
  durationFrames: number;
}> = ({ startFrame, durationFrames }) => {
  const frame = useCurrentFrame();
  const local = frame - startFrame;

  if (local < 0 || local > durationFrames + 12) return null;

  const originX = STAGE_X.triage;
  const originY = STAGE_Y + 100;
  const bendX = STAGE_X.triage;
  const bendY = STAGE_Y + 280;
  const targetX = STAGE_X.questioner;
  const targetY = STAGE_Y + 280;

  // First segment is the vertical drop, second is horizontal. Allocate
  // ~30% of duration to the drop and ~70% to the horizontal run since
  // the horizontal distance is longer.
  const segSplit = 0.30;
  const segADur = durationFrames * segSplit;
  const segBDur = durationFrames * (1 - segSplit);

  let x: number, y: number;
  let arriveT = 1;
  if (local < segADur) {
    const t = local / segADur;
    const eased = easeInOutCubic(t);
    x = originX;
    y = originY + (bendY - originY) * eased;
    arriveT = 0;
  } else if (local < durationFrames) {
    const t = (local - segADur) / segBDur;
    const eased = easeInOutCubic(t);
    x = bendX + (targetX - bendX) * eased;
    y = bendY;
    arriveT = t;
  } else {
    // Arrived — particle expands and fades over 12f
    x = targetX;
    y = targetY;
    arriveT = 1;
  }

  // Opacity: fade in fast, hold, then fade out after arrival
  const t = local / durationFrames;
  const fadeIn = Math.min(1, local / 6);
  const fadeOut = local > durationFrames
    ? Math.max(0, 1 - (local - durationFrames) / 12)
    : 1;
  const opacity = fadeIn * fadeOut;

  // Scale: subtle pop on arrival
  const scale =
    local > durationFrames
      ? 1 + Math.min(1, (local - durationFrames) / 6) * 0.6
      : 1;

  return (
    <div
      style={{
        position: "absolute",
        left: x,
        top: y,
        transform: `translate(-50%, -50%) scale(${scale})`,
        width: 14,
        height: 14,
        borderRadius: "50%",
        background: USER_ALG_PURPLE,
        boxShadow: `0 0 12px ${USER_ALG_PURPLE}, 0 0 24px ${USER_ALG_PURPLE}`,
        opacity,
        zIndex: 30,
      }}
    >
      {/* trailing wake — only visible during the horizontal run */}
      {local >= segADur && local < durationFrames && (
        <div
          style={{
            position: "absolute",
            right: "100%",
            top: "50%",
            transform: "translateY(-50%)",
            width: 60,
            height: 4,
            background: `linear-gradient(to left, ${USER_ALG_PURPLE}, transparent)`,
            filter: "blur(3px)",
            opacity: 0.7,
          }}
        />
      )}
    </div>
  );
};

// Cache → Questioner arrow: when the cache is full, draws a short upward
// line from the cache into the Questioner card. The Questioner is the one
// that decides to fire the Reground User route — the cache informs it,
// not the route directly. This is closer to the real architecture:
// stakeholder_state.fatigue is read by the questioner skill, which then
// emits a reground turn.
const CacheToQuestionerLink: React.FC<{
  visibleFrom: number;
  cacheFull: boolean;
}> = ({ visibleFrom, cacheFull }) => {
  const frame = useCurrentFrame();
  const baseOpacity = interpolate(
    frame,
    [visibleFrom, visibleFrom + 24],
    [0, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );
  // Only fully visible when cache is full
  const opacity = baseOpacity * (cacheFull ? 1 : 0);

  // Cache top edge ≈ STAGE_Y + 280 - 28 (cache half-height ~28).
  // Questioner card bottom edge ≈ STAGE_Y + 70.
  const cacheTopY = STAGE_Y + 280 - 32;
  const questionerBottomY = STAGE_Y + 70;
  const x = STAGE_X.questioner;

  return (
    <svg
      style={{
        position: "absolute",
        left: 0,
        top: 0,
        width: W,
        height: H,
        pointerEvents: "none",
        opacity,
      }}
    >
      <line
        x1={x}
        y1={cacheTopY}
        x2={x}
        y2={questionerBottomY}
        stroke={USER_ALG_PURPLE}
        strokeWidth={2.5}
      />
      {/* arrow head pointing up into Questioner */}
      <polygon
        points={`${x - 6},${questionerBottomY + 8} ${x + 6},${questionerBottomY + 8} ${x},${questionerBottomY}`}
        fill={USER_ALG_PURPLE}
      />
    </svg>
  );
};

const Caption: React.FC<{ label: string; text: string; emphasis: boolean }> = ({
  label,
  text,
  emphasis,
}) => (
  <div style={{ display: "flex", alignItems: "baseline", gap: 14 }}>
    <span
      style={{
        fontFamily: fonts.ui,
        fontSize: 11,
        fontWeight: 600,
        letterSpacing: "0.22em",
        textTransform: "uppercase",
        color: colors.secondaryText,
      }}
    >
      {label}
    </span>
    <span
      style={{
        fontFamily: fonts.display,
        fontSize: 20,
        fontWeight: emphasis ? 500 : 400,
        color: emphasis ? "#B98654" : colors.primaryText,
        letterSpacing: "-0.01em",
      }}
    >
      {text}
    </span>
  </div>
);

// ─────────────────────────────────────────────────────────────────────
// MAIN — Act2Pipeline composition
// ─────────────────────────────────────────────────────────────────────

export const Act2Pipeline: React.FC = () => {
  const frame = useCurrentFrame();

  // ── M2 timeline ─────────────────────────────────────────────────
  // Particle 1 enters at M1_END+30. Reaches each stage with deliberate dwells.
  const P1_FADE_IN = M1_END + 18;     // 198
  const P1_INPUT     = { arrive: M1_END + 60,  dwell: 36 }; // 240..276
  const P1_TRIAGE    = { arrive: M1_END + 132, dwell: 60 }; // 312..372
  const P1_DENOISER  = { arrive: M1_END + 222, dwell: 90 }; // 402..492 (3s — full inner cycle)
  const P1_QUESTIONER= { arrive: M1_END + 342, dwell: 36 }; // 522..558  (capped by M2_END=540 so trim)
  // Actually M2_END is 540. Particle exits via Fitted Q before then.
  // Tighter timing:
  const P1_INPUT_A   = M1_END + 30;  // 210
  const P1_INPUT_D   = 30;
  const P1_TRIAGE_A  = M1_END + 90;  // 270
  const P1_TRIAGE_D  = 60;
  const P1_DENOISER_A= M1_END + 180; // 360
  const P1_DENOISER_D= 90;
  const P1_QUESTIONER_A = M1_END + 300; // 480
  const P1_QUESTIONER_D = 30;

  // Inner step indexing for Denoiser (only while particle 1 is dwelling).
  let innerStep = -1;
  const dStart = P1_DENOISER_A;
  const dEnd = P1_DENOISER_A + P1_DENOISER_D;
  if (frame >= dStart && frame < dEnd) {
    const local = frame - dStart;
    innerStep = Math.min(3, Math.floor(local / 22)); // 4 steps × 22f
  }

  // ── M3 timeline ─────────────────────────────────────────────────
  // Second particle enters, Triage user-alg flares, particle diverts to reground.
  const P2_FADE_IN = M2_END + 12;
  const P2_INPUT_A    = M2_END + 30;  // 570
  const P2_INPUT_D    = 24;
  const P2_TRIAGE_A   = M2_END + 84;  // 624
  const P2_TRIAGE_D   = 54;
  // Fatigue flares 18f into triage dwell; particle exits Triage early to reground.
  const P2_FATIGUE_FRAME = P2_TRIAGE_A + 18; // 642
  const P2_REGROUND_A = M2_END + 168; // 708 — particle arrives reground pill
  const P2_REGROUND_D = 12;

  // ── Active stage indexing (header + cards) ─────────────────────
  let activeIndex = -1;
  if (frame < M1_END) activeIndex = -1;
  else if (frame < P1_INPUT_A) activeIndex = -1;
  else if (frame < P1_INPUT_A + P1_INPUT_D) activeIndex = 0;
  else if (frame < P1_TRIAGE_A) activeIndex = -1;
  else if (frame < P1_TRIAGE_A + P1_TRIAGE_D) activeIndex = 1;
  else if (frame < P1_DENOISER_A) activeIndex = -1;
  else if (frame < P1_DENOISER_A + P1_DENOISER_D) activeIndex = 2;
  else if (frame < P1_QUESTIONER_A) activeIndex = -1;
  else if (frame < P1_QUESTIONER_A + P1_QUESTIONER_D) activeIndex = 3;
  else if (frame < M2_END) activeIndex = -1;
  // M3 second pass
  else if (frame < P2_INPUT_A) activeIndex = -1;
  else if (frame < P2_INPUT_A + P2_INPUT_D) activeIndex = 0;
  else if (frame < P2_TRIAGE_A) activeIndex = -1;
  else if (frame < P2_TRIAGE_A + P2_TRIAGE_D) activeIndex = 1;
  else activeIndex = -1; // jumps to reground after triage

  // ── Triage stream highlights (sequential during Triage dwell) ────
  let triageStream = -1;
  // Particle 1 triage
  if (frame >= P1_TRIAGE_A && frame < P1_TRIAGE_A + P1_TRIAGE_D) {
    const t = frame - P1_TRIAGE_A;
    if (t < 20) triageStream = 0;
    else if (t < 40) triageStream = 1;
    else triageStream = 2;
  }
  // Particle 2 triage — sequence interrupted by user-alg flare
  if (frame >= P2_TRIAGE_A && frame < P2_TRIAGE_A + P2_TRIAGE_D) {
    const t = frame - P2_TRIAGE_A;
    if (t < 12) triageStream = 0;
    else triageStream = 2; // jumps straight to user-alg (the flare)
  }

  // ── User-Algedonic Cache state ─────────────────────────────────────
  // The cache fills incrementally as user-alg signals are detected. By the
  // end of M2 it has 1 segment (mild fatigue from turn 1). During M3's
  // fatigue flare the remaining 3 segments fill rapidly → cache full →
  // unlocks the Reground User route.
  //
  //   Frame thresholds for fill events (each one bumps fill by 1):
  //     280  — P1 user-alg signal in Triage (mild)              → 1
  //     642  — P2 fatigue flare starts                          → 2
  //     654  — flare deepening                                  → 3
  //     666  — flare peaks, cache full                          → 4
  let filledSegments = 0;
  if (frame >= 280) filledSegments = 1;
  if (frame >= 642) filledSegments = 2;
  if (frame >= 654) filledSegments = 3;
  if (frame >= 666) filledSegments = 4;
  const cacheFull = filledSegments >= 4;
  // user-alg bus is "active" whenever the user-alg stream is highlighted in
  // Triage — same condition as triageStream === 2.
  const userAlgBusActive = triageStream === 2;

  // ── Active output route ─────────────────────────────────────────
  let activeRoute: "fitted" | "reground" | null = null;
  // Fitted Q lights when particle 1 leaves Questioner toward route fork
  if (
    frame >= P1_QUESTIONER_A + P1_QUESTIONER_D - 6 &&
    frame < P1_QUESTIONER_A + P1_QUESTIONER_D + 36
  ) {
    activeRoute = "fitted";
  }
  // Reground lights when particle 2 arrives at the Reground pill
  // (after traversing bus → cache → Questioner → pill).
  const P2_REGROUND_PILL_ARRIVE = M2_END + 228; // 768
  if (frame >= P2_REGROUND_PILL_ARRIVE - 12 && frame < P2_REGROUND_PILL_ARRIVE + 60) {
    activeRoute = "reground";
  }

  // ── Particle 1 stops (Fitted Q route) ───────────────────────────
  const p1Stops: ParticleStop[] = [
    { x: STAGE_X.input,      y: STAGE_Y, arriveFrame: P1_INPUT_A,      dwellFrames: P1_INPUT_D },
    { x: STAGE_X.triage,     y: STAGE_Y, arriveFrame: P1_TRIAGE_A,     dwellFrames: P1_TRIAGE_D },
    { x: STAGE_X.denoiser,   y: STAGE_Y, arriveFrame: P1_DENOISER_A,   dwellFrames: P1_DENOISER_D },
    { x: STAGE_X.questioner, y: STAGE_Y, arriveFrame: P1_QUESTIONER_A, dwellFrames: P1_QUESTIONER_D },
  ];
  const p1Exit = { x: STAGE_X.routeFork, y: STAGE_Y - 70, durationFrames: 24 };

  // ── Particle 2 stops (Reground route, following the data path) ──
  // Instead of skipping straight to the Reground pill from Triage, the
  // particle physically traverses the side-bus: Triage → drop down →
  // bus → cache → up into Questioner → out to Reground pill. This makes
  // the architecture honest: the cache informs the Questioner, which
  // emits reground.
  //
  // Path stops (after Triage at 624..678):
  //   1. Bus origin (below Triage)        @ 690    dwell 4
  //   2. Cache (after horizontal run)     @ 720    dwell 12
  //   3. Questioner card (after up arrow) @ 744    dwell 12
  //   4. Reground pill                    @ 768
  const P2_BUS_ORIGIN_A   = M2_END + 150; // 690 — particle drops to bus origin
  const P2_BUS_ORIGIN_D   = 4;
  const P2_CACHE_A        = M2_END + 180; // 720 — arrives at cache
  const P2_CACHE_D        = 12;
  const P2_QUESTIONER_A   = M2_END + 204; // 744 — arrives back up at Questioner
  const P2_QUESTIONER_D   = 12;
  const P2_REGROUND_PILL_A = M2_END + 228; // 768 — arrives at Reground pill
  const P2_REGROUND_PILL_D = 12;

  const p2Stops: ParticleStop[] = [
    { x: STAGE_X.input,      y: STAGE_Y,            arriveFrame: P2_INPUT_A,         dwellFrames: P2_INPUT_D },
    { x: STAGE_X.triage,     y: STAGE_Y,            arriveFrame: P2_TRIAGE_A,        dwellFrames: P2_TRIAGE_D },
    { x: STAGE_X.triage,     y: STAGE_Y + 280,      arriveFrame: P2_BUS_ORIGIN_A,    dwellFrames: P2_BUS_ORIGIN_D },
    { x: STAGE_X.questioner, y: STAGE_Y + 280,      arriveFrame: P2_CACHE_A,         dwellFrames: P2_CACHE_D },
    { x: STAGE_X.questioner, y: STAGE_Y,            arriveFrame: P2_QUESTIONER_A,    dwellFrames: P2_QUESTIONER_D },
    { x: STAGE_X.routeFork,  y: STAGE_Y + 70,       arriveFrame: P2_REGROUND_PILL_A, dwellFrames: P2_REGROUND_PILL_D },
  ];
  const p2Exit = { x: STAGE_X.routeFork + 100, y: STAGE_Y + 70, durationFrames: 30 };

  return (
    <AbsoluteFill style={{ backgroundColor: colors.canvas }}>
      {/* Movement 1 — Stage reveals (centered, sequential) */}
      {frame < M1_END && (
        <>
          {M1_REVEALS.map((r, i) => {
            const finalX = [
              STAGE_X.input,
              STAGE_X.triage,
              STAGE_X.denoiser,
              STAGE_X.questioner,
            ][i];
            return (
              <StageReveal
                key={r.name}
                name={r.name}
                tagline={r.tagline}
                index={i}
                from={r.from}
                showFor={r.showFor}
                m1End={M1_END}
                finalX={finalX}
                finalY={STAGE_Y}
                bullets={r.bullets}
                bulletFrames={r.bulletFrames}
              />
            );
          })}
          {/* Hero line at top during reveals */}
          <div
            style={{
              position: "absolute",
              top: 100,
              left: 0,
              right: 0,
              textAlign: "center",
              fontFamily: fonts.display,
              fontSize: 36,
              fontWeight: 400,
              color: colors.secondaryText,
              letterSpacing: "-0.015em",
              opacity: interpolate(frame, [0, 18, M1_END - 30, M1_END], [0, 1, 1, 0], {
                extrapolateLeft: "clamp",
                extrapolateRight: "clamp",
              }),
            }}
          >
            <span>One answer.</span>{" "}
            <span style={{ color: colors.primaryText, fontWeight: 500 }}>
              Four transformations.
            </span>{" "}
            <span>The image sharpens.</span>
          </div>
        </>
      )}

      {/* Movements 2 + 3 — Assembled pipeline */}
      {frame >= M1_END - 24 && (
        <>
          <HeaderStrip visibleFrom={M1_END - 18} activeIndex={activeIndex} />

          <TrackLine visibleFrom={M1_END - 18} />

          <AssembledStage
            tile={{
              x: STAGE_X.input,
              label: "User Input",
              sub: "stakeholder message",
              width: 220,
              height: 140,
            }}
            active={activeIndex === 0}
            visibleFrom={M1_END - 18}
          />

          <TriageCard
            active={activeIndex === 1}
            visibleFrom={M1_END - 18}
            highlightStream={triageStream}
            fatigueFrame={P2_FATIGUE_FRAME}
          />

          <DenoiserCard
            active={activeIndex === 2}
            visibleFrom={M1_END - 18}
            innerStep={innerStep}
          />

          <AssembledStage
            tile={{
              x: STAGE_X.questioner,
              label: "Questioner",
              sub: "register · ≤30w · 1 ?",
              width: 220,
              height: 140,
            }}
            active={activeIndex === 3}
            visibleFrom={M1_END - 18}
          />

          {/* Side-bus from Triage user-alg row down to the cache */}
          <UserAlgBus
            visibleFrom={M1_END - 18}
            active={userAlgBusActive}
            cacheFull={cacheFull}
          />

          {/* Bus particles — one per cache fill event. Each launches early
              enough to arrive at the cache exactly when its segment fills.
              Fill frames: 280 (seg 1), 642 (seg 2), 654 (seg 3), 666 (seg 4).
              Travel time = 22f, so launch = fillFrame - 22. */}
          <BusParticle startFrame={280 - 22} durationFrames={22} />
          <BusParticle startFrame={642 - 22} durationFrames={22} />
          <BusParticle startFrame={654 - 22} durationFrames={22} />
          <BusParticle startFrame={666 - 22} durationFrames={22} />

          {/* User-Algedonic Cache (below Questioner) */}
          <UserAlgCache
            visibleFrom={M1_END - 18}
            filledSegments={filledSegments}
            cacheFull={cacheFull}
          />

          {/* Cache → Questioner unlock link (only visible once cache fills) */}
          <CacheToQuestionerLink
            visibleFrom={M1_END - 18}
            cacheFull={cacheFull}
          />

          <OutputRoutes
            visibleFrom={M1_END - 18}
            activeRoute={activeRoute}
          />

          <FooterCaptions visibleFrom={M1_END - 18} />

          {/* Particle 1 — Fitted Q route */}
          <Particle
            stops={p1Stops}
            fadeIn={P1_FADE_IN}
            fadeOut={P1_QUESTIONER_A + P1_QUESTIONER_D + 30}
            exitTo={p1Exit}
          />

          {/* Particle 2 — Reground route */}
          {frame >= P2_FADE_IN && (
            <Particle
              stops={p2Stops}
              fadeIn={P2_FADE_IN}
              fadeOut={PIPELINE_DURATION_FRAMES}
              exitTo={p2Exit}
            />
          )}
        </>
      )}

      {/*
        Timeline track labels — 8 named sub-scenes that show as bars in
        Remotion Studio's timeline panel. These are pure markers (children
        are empty <span />) so they don't affect rendering at all; they
        only document the scene structure for navigation/scrubbing.

        4 stage reveals + 4 particle stops. The Reground exception is
        bundled into stop 4 since that's where the second particle exits.
      */}
      {/* Bullet sub-scenes are wide (10f each) so they're easy to click in
          the timeline. Inner `from` values are still relative to the parent
          card's reveal start, and `from` matches the bullet's reveal frame
          (12 / 22 / 32 inside cards 1-3; 12 / 24 / 36 inside card 4). The
          duration just controls clickable width — bullets stay visible
          until the parent card fades, so the bar length is purely cosmetic. */}
      <Sequence from={0}   durationInFrames={42}  name="01 · Reveal — User Input">
        <Sequence from={12} durationInFrames={10} name="• 01.1 — bullet 1"><span /></Sequence>
        <Sequence from={22} durationInFrames={10} name="• 01.2 — bullet 2"><span /></Sequence>
        <Sequence from={32} durationInFrames={10} name="• 01.3 — bullet 3"><span /></Sequence>
      </Sequence>
      <Sequence from={36}  durationInFrames={48}  name="02 · Reveal — Signals Triage">
        <Sequence from={12} durationInFrames={10} name="• 02.1 — bullet 1"><span /></Sequence>
        <Sequence from={22} durationInFrames={10} name="• 02.2 — bullet 2"><span /></Sequence>
        <Sequence from={32} durationInFrames={10} name="• 02.3 — bullet 3"><span /></Sequence>
      </Sequence>
      <Sequence from={78}  durationInFrames={48}  name="03 · Reveal — Denoiser">
        <Sequence from={12} durationInFrames={10} name="• 03.1 — bullet 1"><span /></Sequence>
        <Sequence from={22} durationInFrames={10} name="• 03.2 — bullet 2"><span /></Sequence>
        <Sequence from={32} durationInFrames={10} name="• 03.3 — bullet 3"><span /></Sequence>
      </Sequence>
      <Sequence from={120} durationInFrames={60}  name="04 · Reveal — Questioner + Assemble">
        <Sequence from={12} durationInFrames={12} name="• 04.1 — bullet 1"><span /></Sequence>
        <Sequence from={24} durationInFrames={12} name="• 04.2 — bullet 2"><span /></Sequence>
        <Sequence from={36} durationInFrames={12} name="• 04.3 — bullet 3"><span /></Sequence>
      </Sequence>

      {/* Particle stops grouped under one parent Sequence so they nest
          in the timeline. Inner Sequence `from` values are RELATIVE to
          the parent's start (180), not absolute frames. */}
      <Sequence from={180} durationInFrames={660} name="Flow">
        <Sequence from={0}   durationInFrames={90}  name="05 · Stop — User Input">
          <span />
        </Sequence>
        <Sequence from={90}  durationInFrames={90}  name="06 · Stop — Signals Triage (3 streams)">
          <span />
        </Sequence>
        <Sequence from={180} durationInFrames={120} name="07 · Stop — Denoiser (Read · Pick · Denoise · Update)">
          <span />
        </Sequence>
        <Sequence from={300} durationInFrames={240} name="08 · Stop — Questioner → Fitted Q">
          <span />
        </Sequence>
        <Sequence from={540} durationInFrames={120} name="09 · Reground exception (bus → cache → Questioner)">
          <span />
        </Sequence>
      </Sequence>
    </AbsoluteFill>
  );
};
