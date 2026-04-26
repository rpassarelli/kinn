import { AbsoluteFill, Sequence, Video, interpolate, staticFile, useCurrentFrame } from "remotion";
import { colors, fonts, space, radii, shadows } from "../theme";

/**
 * ACT 1A — HOOK / ATTENTION GRABBER (0:00 – 0:12, 12s)
 *
 * Four sub-beats, 3s each (90 frames at 30fps). Each beat: a regular-weight
 * setup phrase fades in, then the highlighted phrase types in letter-by-letter
 * in the brand accent color (D4A373) at heavier weight.
 *
 *   Beat 1 (0:00–0:03)   Imagine an image denoiser  →  — but for business.
 *   Beat 2 (0:03–0:06)   Instead of 4K images, you get  →  high-accuracy models of your business.
 *   Beat 3 (0:06–0:09)   Each input signal is an image pass  →  to any business model.
 *   Beat 4 (0:09–0:12)   MEET  →  kinn  (wordmark reveal)
 *
 * Design system: warm canvas, Newsreader serif, charcoal for setup, accent
 * clay for highlighted reveals. Cursor blinks while typing, disappears on
 * completion.
 *
 * AUDIO: silence (or a single low percussive hit on Beat 1 frame 0)
 */

const BEAT_FRAMES = 90; // 3 seconds at 30fps
const ANIM_FRAMES = 90; // 3 seconds at 30fps — Animation 01 and 02
const BEAT_FONT_SIZE = 72; // tight enough that long highlights wrap gracefully

// ---------- typography helpers ----------

const beatLineStyle: React.CSSProperties = {
  fontFamily: fonts.display,
  fontSize: BEAT_FONT_SIZE,
  fontWeight: 400,
  letterSpacing: "-0.015em",
  lineHeight: 1.18,
};

// ---------- beat 1–3: setup + per-character emergence ----------
//
// Each character of the highlight emerges into place with four
// simultaneous transforms, eased on a cubic-out curve:
//   - translateY 28px → 0  (rises from below)
//   - opacity      0   → 1  (fades into existence)
//   - blur(px)    10   → 0  (sharpens from imagined to real)
//   - scale       0.94 → 1  (gentle settle)
//
// Characters stagger by 1.5 frames so the phrase resolves as a wave,
// not a typewriter. No cursor — the emergence is the motion.
//
// Spaces are rendered as bare text nodes so the layout can wrap
// naturally; non-space chars are inline-block to take transforms.

const easeOutCubic = (t: number): number => 1 - Math.pow(1 - t, 3);

// Ease-in-out cubic — slow start, fast middle, slow end. Used in Scene 02
// for the "easy in / settle out" feel on pill consume and particle travel.
const easeInOutCubic = (t: number): number =>
  t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

const HookBeat: React.FC<{ pre: string; highlight: string }> = ({ pre, highlight }) => {
  const frame = useCurrentFrame();

  const preOpacity = interpolate(frame, [0, 12], [0, 1], { extrapolateRight: "clamp" });

  const TYPE_START = 16;
  const CHAR_STAGGER = 1.5;
  const CHAR_ANIM_DURATION = 18;

  const beatOpacity = interpolate(
    frame,
    [BEAT_FRAMES - 12, BEAT_FRAMES],
    [1, 0],
    { extrapolateLeft: "clamp" }
  );

  return (
    <AbsoluteFill
      style={{
        backgroundColor: colors.canvas,
        alignItems: "center",
        justifyContent: "center",
        padding: space.s6,
        opacity: beatOpacity,
      }}
    >
      <div style={{ textAlign: "center", maxWidth: 1600 }}>
        <div style={{ ...beatLineStyle, color: colors.primaryText, opacity: preOpacity }}>
          {pre}
        </div>
        <div
          style={{
            ...beatLineStyle,
            marginTop: space.s2,
            minHeight: BEAT_FONT_SIZE * 1.3,
          }}
        >
          {highlight.split("").map((char, i) => {
            // Bare space — keeps line wrapping intact across long highlights.
            if (char === " ") return " ";

            const charStart = TYPE_START + i * CHAR_STAGGER;
            const t = Math.max(0, Math.min(1, (frame - charStart) / CHAR_ANIM_DURATION));
            const p = easeOutCubic(t);

            const y = (1 - p) * 28;
            const opacity = p;
            const blur = (1 - p) * 10;
            const scale = 0.94 + p * 0.06;

            return (
              <span
                key={i}
                style={{
                  display: "inline-block",
                  color: colors.accent,
                  fontWeight: 600,
                  transform: `translateY(${y}px) scale(${scale})`,
                  opacity,
                  filter: `blur(${blur}px)`,
                  transformOrigin: "center bottom",
                }}
              >
                {char}
              </span>
            );
          })}
        </div>
      </div>
    </AbsoluteFill>
  );
};

// ---------- top-anchored persistent title ----------
//
// Variant of HookBeat for use as a sticky title bar above another visual
// (e.g. 02.5 sits on top of the held ImageDenoiseLayout). Smaller type,
// pinned to the top of the frame, no fade-out — holds for the lifetime
// of its parent Sequence. Same character-emergence motion as HookBeat
// so the visual language stays consistent.

const TopTitleBeat: React.FC<{ pre: string; highlight: string }> = ({ pre, highlight }) => {
  const frame = useCurrentFrame();

  const preOpacity = interpolate(frame, [0, 12], [0, 1], { extrapolateRight: "clamp" });

  const TYPE_START = 16;
  const CHAR_STAGGER = 1.2;
  const CHAR_ANIM_DURATION = 16;

  const TITLE_FONT_SIZE = 51; // 38 × 1.35 — bumped per directive; may wrap to 2 lines

  const titleLineStyle: React.CSSProperties = {
    fontFamily: fonts.display,
    fontSize: TITLE_FONT_SIZE,
    fontWeight: 400,
    letterSpacing: "-0.01em",
    lineHeight: 1.25,
  };

  return (
    <AbsoluteFill
      style={{
        alignItems: "center",
        justifyContent: "flex-start",
        paddingTop: space.s5,
        pointerEvents: "none",
      }}
    >
      <div style={{ textAlign: "center", maxWidth: 1400 }}>
        <span style={{ ...titleLineStyle, color: colors.primaryText, opacity: preOpacity }}>
          {pre}
        </span>
        <span style={{ ...titleLineStyle, marginLeft: "0.4em" }}>
          {highlight.split("").map((char, i) => {
            if (char === " ") return " ";

            const charStart = TYPE_START + i * CHAR_STAGGER;
            const t = Math.max(0, Math.min(1, (frame - charStart) / CHAR_ANIM_DURATION));
            const p = easeOutCubic(t);

            const y = (1 - p) * 18;
            const opacity = p;
            const blur = (1 - p) * 6;
            const scale = 0.96 + p * 0.04;

            return (
              <span
                key={i}
                style={{
                  display: "inline-block",
                  color: colors.accent,
                  fontWeight: 600,
                  transform: `translateY(${y}px) scale(${scale})`,
                  opacity,
                  filter: `blur(${blur}px)`,
                  transformOrigin: "center bottom",
                }}
              >
                {char}
              </span>
            );
          })}
        </span>
      </div>
    </AbsoluteFill>
  );
};

// ---------- beat 4: brand reveal ----------
//
// Plays the animated logo (public/video/kinn-logo-intro.mp4) at native
// speed — Beat 4's duration is set to FINALE_FRAMES below to match the
// 8-second source. "MEET" caption rides on top: fades in early, holds
// while the brand emerges, fades out so the logo carries the final beat.

export const FINALE_FRAMES = 172; // 5.7s — kinn-logo-intro.mp4 played at 1.4× (240/1.4 = 171.4, +1 margin)

// Stack bullets shown beneath the logo on the finale slide. Each entry
// is one line of the model's underlying stack — keep terse so they read
// at a glance rather than inviting study.
const STACK_BULLETS = [
  "Claude Opus 4.7",
  "Bayesian Experimental Design",
  "Viable Systems Model",
  "Prompt caching · ~$0.06 / turn",
] as const;

export const HookFinale: React.FC = () => {
  const frame = useCurrentFrame();

  // Title fades in over frames 0→11 and then holds at full opacity for
  // the rest of the Sequence — no fade-out, the closing slide stays
  // loaded on screen through to the end of the show.
  const titleOpacity = interpolate(frame, [0, 11], [0, 1], { extrapolateRight: "clamp" });

  // Logo fades up over the first 18 frames so the open of the clip
  // breathes against the canvas instead of snap-cutting in.
  const logoOpacity = interpolate(frame, [4, 22], [0, 1], { extrapolateRight: "clamp" });

  // Bullets + QR + footer cascade in after the logo has settled
  // (35→55), then hold at full opacity until the show ends.
  const bulletsOpacity = interpolate(frame, [35, 55], [0, 1], { extrapolateRight: "clamp" });

  return (
    <AbsoluteFill
      style={{
        backgroundColor: colors.canvas,
        alignItems: "center",
        justifyContent: "flex-start",
        paddingTop: space.s7,
        paddingBottom: space.s6,
        gap: space.s5,
      }}
    >
      {/* Title — same Newsreader 72px hierarchy as Context's tagline. */}
      <div
        style={{
          fontFamily: fonts.display,
          fontSize: 72,
          fontWeight: 400,
          letterSpacing: "-0.02em",
          lineHeight: 1.15,
          color: colors.primaryText,
          textAlign: "center",
          opacity: titleOpacity,
        }}
      >
        Meet{" "}
        <span style={{ color: colors.accent, fontStyle: "italic", fontWeight: 500 }}>
          Kinn
        </span>
      </div>

      {/* Logo + GitHub-repo QR side-by-side. QR shares the bullets'
          fade-in schedule so it lands as part of the secondary content
          cascade rather than competing with the logo for attention. */}
      <div
        style={{
          display: "flex",
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
          gap: space.s5,
        }}
      >
        <div
          style={{
            width: 800,
            height: 450,
            opacity: logoOpacity,
            overflow: "hidden",
          }}
        >
          <Video
            src={staticFile("video/kinn-logo-intro.mp4")}
            muted
            playbackRate={1.4}
            style={{ width: "100%", height: "100%", objectFit: "contain" }}
          />
        </div>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: space.s2,
            opacity: bulletsOpacity,
          }}
        >
          <div
            style={{
              padding: space.s2,
              backgroundColor: colors.surface,
              borderRadius: radii.control,
              border: "1px solid rgba(0, 0, 0, 0.06)",
              boxShadow: shadows.card,
            }}
          >
            <img
              src={staticFile("images/qr-repo.png")}
              alt="GitHub repo QR"
              style={{ width: 220, height: 220, display: "block", imageRendering: "pixelated" }}
            />
          </div>
          <div
            style={{
              fontFamily: fonts.ui,
              fontSize: 13,
              fontWeight: 400,
              color: colors.secondaryText,
              letterSpacing: "0.16em",
              textTransform: "uppercase",
            }}
          >
            Scan · GitHub repo
          </div>
        </div>
      </div>

      {/* Stack bullets — terse, label-cased Inter, each prefixed with an
          accent dot. Cascades in once the logo has read. */}
      <ul
        style={{
          listStyle: "none",
          padding: 0,
          margin: 0,
          display: "flex",
          flexDirection: "column",
          gap: space.s2,
          opacity: bulletsOpacity,
        }}
      >
        {STACK_BULLETS.map((label) => (
          <li
            key={label}
            style={{
              fontFamily: fonts.ui,
              fontSize: 20,
              fontWeight: 400,
              color: colors.secondaryText,
              letterSpacing: "0.01em",
              display: "flex",
              alignItems: "center",
              gap: space.s2,
            }}
          >
            <span
              style={{
                width: 6,
                height: 6,
                borderRadius: "50%",
                backgroundColor: colors.accent,
                display: "inline-block",
                flexShrink: 0,
              }}
            />
            {label}
          </li>
        ))}
      </ul>

      {/* Hackathon attribution + contact — fine print under the stack
          list, sharing the bullets' fade-in schedule. */}
      <div
        style={{
          marginTop: "auto",
          textAlign: "center",
          opacity: bulletsOpacity,
          display: "flex",
          flexDirection: "column",
          gap: 4,
        }}
      >
        <div
          style={{
            fontFamily: fonts.ui,
            fontSize: 14,
            fontWeight: 400,
            color: colors.secondaryText,
            letterSpacing: "0.04em",
          }}
        >
          Developed with Claude Code for{" "}
          <span style={{ color: colors.primaryText, fontWeight: 500 }}>
            Built with Opus 4.7
          </span>
          {" — Cerebral Valley · Apr 21–28, 2026"}
        </div>
        <div
          style={{
            fontFamily: fonts.ui,
            fontSize: 14,
            fontWeight: 400,
            color: colors.secondaryText,
            letterSpacing: "0.04em",
          }}
        >
          Contact:{" "}
          <span style={{ color: colors.primaryText }}>info@rpassarelli.pt</span>
        </div>
      </div>
    </AbsoluteFill>
  );
};

// ---------- skeleton placeholders ----------
//
// All skeletons live on the surface color over the warm canvas so they
// read as "asset slots" without competing with the denoiser motion.
// Internal lines use rgba(0,0,0,N) so they tint cleanly against any
// future surface color change.

// ---------- scene 02: image denoise animation ----------
//
// Choreography (180 frames / 6s total):
//
//   0–30   ENTRY      — pill stack slides in from left, orb scales up,
//                       image box slides in from right
//   30–80  CYCLE 1    — pill 1 consumed → orb pulses → particle 1 travels → box pulses
//   80–130 CYCLE 2    — pill 2 consumed → orb pulses → particle 2 travels → box pulses
//  130–180 CYCLE 3    — pill 3 consumed → orb pulses → particle 3 travels → box pulses
//
// Per cycle (50 frames):
//    0–22   pill animates: shrink + translateX toward orb + fade out near end
//   22–34   orb pulses (pill consumed)
//   14–36   particle launches from orb edge, travels to image box, fades at box edge
//   36–48   image box pulses (particle arrived)
//   48–50   quiet gap before next cycle

const SCENE2_ENTRY_END = 15;
// Compressed for the 30s Hook budget — cycle hold time trimmed.
// Cycles 1 + 2 run tight (30f) because the next cycle's pill consume
// visually masks the prior cycle's box-pulse tail. Cycle 3 has no
// successor to mask it, so it gets a longer window (50f) to let the
// box-pulse fully resolve before scene exit.
const SCENE2_CYCLE_DUR = 30;
const SCENE2_LAST_CYCLE_DUR = 50;

const PILL_CONSUME_DUR = 22;
const ORB_PULSE_DELAY = PILL_CONSUME_DUR;
const ORB_PULSE_DUR = 12;
const PARTICLE_LAUNCH_DELAY = 14;
const PARTICLE_TRAVEL_DUR = 22;
const BOX_PULSE_DELAY = PARTICLE_LAUNCH_DELAY + PARTICLE_TRAVEL_DUR;
const BOX_PULSE_DUR = 12;
// (Per cycle: 0–48 active animations, 48–65 hold/breathing room.)

type PillTone = "accent" | "warm" | "cool";

const PILL_TONES: Record<PillTone, { bg: string; dot: string }> = {
  accent: { bg: colors.surface, dot: colors.accent },
  warm: { bg: "#F4EFE9", dot: colors.primaryText },
  cool: { bg: "#EFF1F4", dot: colors.secondaryText },
};

// Pure visual primitive — no animation, no positioning. Reused by
// PromptPill (Scene 02) and CloudPill (Scene 04) so the pill aesthetic
// stays identical across the two scenes.
// `scale` lets a caller scale pill geometry uniformly (height, padding,
// dot, gap) without affecting font size. `textScale` does the same for
// type only. Both default to 1, so existing callers in Scenes 02/04 are
// unaffected.
const PillBase: React.FC<{
  width: number;
  tone: PillTone;
  text: string;
  scale?: number;
  textScale?: number;
}> = ({ width, tone, text, scale = 1, textScale = 1 }) => {
  const tones = PILL_TONES[tone];
  return (
    <div
      style={{
        width,
        height: 64 * scale,
        backgroundColor: tones.bg,
        border: "1px solid rgba(0,0,0,0.06)",
        borderRadius: 999,
        boxShadow: shadows.card,
        display: "flex",
        alignItems: "center",
        paddingLeft: 24 * scale,
        paddingRight: 24 * scale,
        gap: 14 * scale,
      }}
    >
      <div
        style={{
          width: 10 * scale,
          height: 10 * scale,
          borderRadius: 5 * scale,
          backgroundColor: tones.dot,
          flexShrink: 0,
        }}
      />
      <span
        style={{
          fontFamily: fonts.ui,
          fontSize: 18 * textScale,
          fontWeight: 500,
          color: colors.primaryText,
          letterSpacing: "-0.005em",
          whiteSpace: "nowrap",
        }}
      >
        {text}
      </span>
    </div>
  );
};

const PromptPill: React.FC<{
  width: number;
  tone: PillTone;
  cycleIndex: number;
  text: string;
}> = ({ width, tone, cycleIndex, text }) => {
  const frame = useCurrentFrame();

  // Entry: stack slides in from left and fades up over the first 30 frames.
  const entryX = interpolate(frame, [0, 30], [-60, 0], { extrapolateRight: "clamp" });
  const entryOpacity = interpolate(frame, [0, 30], [0, 1], { extrapolateRight: "clamp" });

  // Consume: pill shrinks + travels right into the orb, fades on impact.
  const cycleStart = SCENE2_ENTRY_END + cycleIndex * SCENE2_CYCLE_DUR;
  const local = frame - cycleStart;
  let consumeScale = 1;
  let consumeX = 0;
  let consumeOpacity = 1;
  if (local >= 0) {
    const t = Math.max(0, Math.min(1, local / PILL_CONSUME_DUR));
    const eased = easeInOutCubic(t);
    consumeScale = 1 - eased * 0.92;
    consumeX = eased * 420; // travel toward orb centre
    consumeOpacity = interpolate(t, [0.55, 1], [1, 0], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    });
  }

  return (
    <div
      style={{
        transform: `translateX(${entryX + consumeX}px) scale(${consumeScale})`,
        opacity: entryOpacity * consumeOpacity,
        transformOrigin: "left center",
      }}
    >
      <PillBase width={width} tone={tone} text={text} />
    </div>
  );
};

const PromptStack: React.FC = () => (
  <div style={{ display: "flex", flexDirection: "column", gap: 22, alignItems: "flex-start" }}>
    <PromptPill width={280} tone="accent" cycleIndex={0} text="Best AI Models" />
    <PromptPill width={320} tone="warm" cycleIndex={1} text="Best DEV Tools" />
    <PromptPill width={240} tone="cool" cycleIndex={2} text="Fun Hackathon" />
  </div>
);

// Glass orb recipe — five layered effects make it read as a luminous sphere:
//   1. Outer halo       — extended blurred accent, ambient light
//   2. Glass body       — translucent radial gradient + glass rim border
//   3. Specular sheen   — large bright highlight at upper-left, blurred
//   4. Inner shadow     — bottom-right rim picks up ambient occlusion
//   5. Label            — sits on top of all layers via z-index
//
// Entry + per-cycle pulse animation drive the outer transform.
const LatentSpace: React.FC = () => {
  const frame = useCurrentFrame();

  // Entry: scales in from 0.85 → 1 and fades over the first 30 frames.
  const entryScale = interpolate(frame, [0, 30], [0.82, 1], { extrapolateRight: "clamp" });
  const entryOpacity = interpolate(frame, [0, 30], [0, 1], { extrapolateRight: "clamp" });

  // Consume pulse: each time a pill is absorbed, orb expands ~6% then settles.
  let consumePulse = 1;
  for (let i = 0; i < 3; i++) {
    const pulseFrame = SCENE2_ENTRY_END + i * SCENE2_CYCLE_DUR + ORB_PULSE_DELAY;
    const local = frame - pulseFrame;
    if (local >= 0 && local < ORB_PULSE_DUR) {
      const t = local / ORB_PULSE_DUR;
      consumePulse = Math.max(consumePulse, 1 + Math.sin(t * Math.PI) * 0.06);
    }
  }

  return (
    <div
      style={{
        position: "relative",
        width: 320,
        height: 320,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        transform: `scale(${entryScale * consumePulse})`,
        opacity: entryOpacity,
      }}
    >
      <LatentOrbInner />
    </div>
  );
};

// Inner orb structure — split out so the wrapper handles only motion.
const LatentOrbInner: React.FC = () => (
  <div
    style={{
      position: "relative",
      width: 320,
      height: 320,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
    }}
  >
    {/* Outer halo glow */}
    <div
      style={{
        position: "absolute",
        inset: -60,
        borderRadius: "50%",
        background: `radial-gradient(circle, ${colors.accent}55 0%, ${colors.accent}18 50%, transparent 75%)`,
        filter: "blur(36px)",
      }}
    />
    {/* Glass orb body */}
    <div
      style={{
        position: "relative",
        width: 280,
        height: 280,
        borderRadius: "50%",
        background: `
          radial-gradient(circle at 32% 28%, rgba(255,255,255,0.85) 0%, rgba(255,255,255,0.25) 28%, transparent 50%),
          radial-gradient(circle at 50% 50%, ${colors.accent}22 0%, ${colors.accent}40 100%)
        `,
        backgroundColor: "rgba(255,255,255,0.16)",
        border: "1px solid rgba(255,255,255,0.55)",
        boxShadow: `
          inset 0 -22px 44px rgba(0,0,0,0.04),
          inset 0 22px 44px rgba(255,255,255,0.55),
          0 0 60px 12px ${colors.accent}30,
          0 12px 36px rgba(0, 0, 0, 0.10)
        `,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        overflow: "hidden",
      }}
    >
      {/* Specular sheen — large bright reflection at upper-left */}
      <div
        style={{
          position: "absolute",
          top: 18,
          left: 38,
          width: 110,
          height: 64,
          borderRadius: "50%",
          background:
            "radial-gradient(ellipse, rgba(255,255,255,0.85) 0%, rgba(255,255,255,0.30) 45%, transparent 75%)",
          filter: "blur(4px)",
          transform: "rotate(-22deg)",
        }}
      />
      {/* Label */}
      <div
        style={{
          position: "relative",
          textAlign: "center",
          color: colors.primaryText,
          fontFamily: fonts.ui,
          fontSize: 16,
          fontWeight: 500,
          letterSpacing: "0.18em",
          textTransform: "uppercase",
          lineHeight: 1.6,
          zIndex: 1,
        }}
      >
        Latent Space
        <br />+ Denoise
      </div>
    </div>
  </div>
);

// Solid accent orb with a rotating linear-gradient highlight band that
// sweeps across the sphere — the band gives the spin effect without
// the off-centre "bright spot" that read as anatomical at small sizes.
//
// Rotation phase is seeded from `size` so a field of particles doesn't
// rotate in lockstep — adjacent particles end up at different angles.
const Particle: React.FC<{ size: number; color?: string }> = ({ size, color = colors.accent }) => {
  const frame = useCurrentFrame();
  const phase = (size * 17) % 360;
  const rotation = (phase + frame * 5) % 360;

  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        background: color,
        boxShadow: `
          0 0 ${size * 0.6}px ${size * 0.2}px ${color}55,
          0 0 ${size * 1.2}px ${size * 0.4}px ${color}22
        `,
        position: "relative",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          position: "absolute",
          inset: 0,
          borderRadius: "50%",
          background: `linear-gradient(${rotation}deg, transparent 30%, rgba(255,255,255,0.32) 50%, transparent 70%)`,
        }}
      />
    </div>
  );
};

// Particle launches from the orb edge during its cycle and travels to
// the image box, fading at the destination.
const TravelingParticle: React.FC<{ cycleIndex: number; yOffset: number; size: number }> = ({
  cycleIndex,
  yOffset,
  size,
}) => {
  const frame = useCurrentFrame();
  const launchFrame = SCENE2_ENTRY_END + cycleIndex * SCENE2_CYCLE_DUR + PARTICLE_LAUNCH_DELAY;
  const local = frame - launchFrame;

  if (local < 0 || local > PARTICLE_TRAVEL_DUR + 6) return null;

  const t = Math.max(0, Math.min(1, local / PARTICLE_TRAVEL_DUR));
  const eased = easeInOutCubic(t);

  // x range: starts to the left of the field (overlapping orb), ends to the right (overlapping box).
  const x = -50 + eased * 240;
  const opacity = interpolate(t, [0, 0.18, 0.82, 1], [0, 1, 1, 0]);

  return (
    <div style={{ position: "absolute", left: x, top: yOffset, opacity }}>
      <Particle size={size} />
    </div>
  );
};

const ParticleField: React.FC = () => (
  <div style={{ position: "relative", width: 140, height: 240 }}>
    <TravelingParticle cycleIndex={0} yOffset={60} size={20} />
    <TravelingParticle cycleIndex={1} yOffset={114} size={22} />
    <TravelingParticle cycleIndex={2} yOffset={170} size={18} />
  </div>
);

// Sequence of images shown in the box — each pulse blurs and swaps to next.
const IMAGE_SEQUENCE = ["A.png", "B.png", "C.png", "D.png"] as const;

const ImageBox: React.FC = () => {
  const frame = useCurrentFrame();

  // Entry: slide in from the right, fade up.
  const entryX = interpolate(frame, [0, 30], [60, 0], { extrapolateRight: "clamp" });
  const entryOpacity = interpolate(frame, [0, 30], [0, 1], { extrapolateRight: "clamp" });

  // Per-cycle pulse on particle arrival: scale up + accent glow flash.
  // Blur peaks at the same midpoint, used to mask the image swap.
  let pulseScale = 1;
  let glowAlpha = 0;
  let imageBlur = 0;
  for (let i = 0; i < 3; i++) {
    const pulseFrame = SCENE2_ENTRY_END + i * SCENE2_CYCLE_DUR + BOX_PULSE_DELAY;
    const local = frame - pulseFrame;
    if (local >= 0 && local < BOX_PULSE_DUR) {
      const t = local / BOX_PULSE_DUR;
      const wave = Math.sin(t * Math.PI);
      pulseScale = Math.max(pulseScale, 1 + wave * 0.045);
      glowAlpha = Math.max(glowAlpha, wave);
      imageBlur = Math.max(imageBlur, wave * 22);
    }
  }

  // Image swap fires at the midpoint of each pulse — exactly when blur peaks,
  // hiding the cut.  A.png → B → C → D as cycles complete.
  let currentImage: (typeof IMAGE_SEQUENCE)[number] = IMAGE_SEQUENCE[0];
  for (let i = 0; i < 3; i++) {
    const pulseFrame = SCENE2_ENTRY_END + i * SCENE2_CYCLE_DUR + BOX_PULSE_DELAY;
    const swapFrame = pulseFrame + BOX_PULSE_DUR / 2;
    if (frame >= swapFrame) {
      currentImage = IMAGE_SEQUENCE[i + 1];
    }
  }

  const glowShadow =
    glowAlpha > 0 ? `, 0 0 ${50 * glowAlpha}px ${12 * glowAlpha}px ${colors.accent}66` : "";

  return (
    <div
      style={{
        width: 360,
        height: 360,
        backgroundColor: colors.surface,
        border: "2px solid rgba(0,0,0,0.18)",
        borderRadius: radii.container,
        boxShadow: `${shadows.elevated}${glowShadow}`,
        transform: `translateX(${entryX}px) scale(${pulseScale})`,
        opacity: entryOpacity,
        overflow: "hidden",
        position: "relative",
      }}
    >
      <div
        style={{
          position: "absolute",
          inset: 0,
          backgroundImage: `url(${staticFile(`images/${currentImage}`)})`,
          backgroundSize: "cover",
          backgroundPosition: "center",
          filter: `blur(${imageBlur}px)`,
        }}
      />
    </div>
  );
};

// 3-column grid: side columns share remaining slack equally, the orb's
// auto-sized middle column lands at exact frame centre regardless of
// asymmetric content widths on either side.
//
//   |  1fr (prompts, right-aligned)  | auto (orb) |  1fr (particles + box)  |
const ImageDenoiseLayout: React.FC = () => (
  <AbsoluteFill
    style={{
      backgroundColor: colors.canvas,
      display: "grid",
      gridTemplateColumns: "1fr auto 1fr",
      alignItems: "center",
      paddingLeft: 140,
      paddingRight: 140,
      paddingTop: 80,
      paddingBottom: 80,
      columnGap: 80,
    }}
  >
    {/* Left column: prompts, anchored to the right edge then nudged 30%
        of their own width back to the left for breathing room. */}
    <div style={{ justifySelf: "end", transform: "translateX(-30%)" }}>
      <PromptStack />
    </div>

    {/* Centre: the orb (auto-sized column lands at frame centre) */}
    <LatentSpace />

    {/* Right column: particle field at the left edge, image box at the right */}
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        width: "100%",
      }}
    >
      <ParticleField />
      <ImageBox />
    </div>
  </AbsoluteFill>
);

// ---------- 06.2 detailed model cards ----------

type RowStatus = "Validated" | "Inferred" | "Spike Detected" | "High Entropy" | "Targeting Next Probe";

// Status tint palette — calm, muted enough to coexist with the brand
// canvas + clay accent. Each status drives the progress-bar fill and the
// status-label text color.
const STATUS_COLORS: Record<RowStatus, string> = {
  "Validated":            "#22A06B", // forest green (calmer than emerald)
  "Inferred":             colors.accent, // brand clay
  "Spike Detected":       "#E07B3F", // warm coral (alert without alarming)
  "High Entropy":         "#9CA3AF", // cool grey
  "Targeting Next Probe": colors.secondaryText, // muted, "to be done"
};

type ModelRowItem = {
  label: string;
  value: number;       // 0..100
  valueLabel: string;  // preserves "08%" leading-zero formatting verbatim
  status: RowStatus;
  bracketed?: boolean; // wraps the status in [] (for Targeting Next Probe)
};

type ModelFramework = {
  title: string;
  rows: ModelRowItem[];
};

const MODEL_FRAMEWORKS: ModelFramework[] = [
  {
    title: "Business Model Canvas",
    rows: [
      { label: "Value Proposition",   value: 94, valueLabel: "94%", status: "Validated" },
      { label: "Customer Segments",   value: 88, valueLabel: "88%", status: "Validated" },
      { label: "Revenue Streams",     value: 65, valueLabel: "65%", status: "Inferred" },
      { label: "Key Activities",      value: 52, valueLabel: "52%", status: "Inferred" },
      { label: "Cost Structure",      value: 38, valueLabel: "38%", status: "High Entropy" },
      { label: "Channels / GTM",      value: 21, valueLabel: "21%", status: "High Entropy" },
      { label: "Key Partnerships",    value: 12, valueLabel: "12%", status: "Targeting Next Probe", bracketed: true },
    ],
  },
  {
    title: "Viable System Model",
    rows: [
      { label: "System 1 (Primary Operations)",     value: 91, valueLabel: "91%", status: "Validated" },
      { label: "System 5 (Identity & Purpose)",     value: 84, valueLabel: "84%", status: "Validated" },
      { label: "Algedonic Alerts (Pain Points)",    value: 72, valueLabel: "72%", status: "Spike Detected" },
      { label: "System 2 (Coordination)",           value: 56, valueLabel: "56%", status: "Inferred" },
      { label: "System 3 (Control & Audit)",        value: 34, valueLabel: "34%", status: "High Entropy" },
      { label: "System 4 (Strategic Intel)",        value: 18, valueLabel: "18%", status: "High Entropy" },
      { label: "Environmental Variety",             value:  8, valueLabel: "08%", status: "Targeting Next Probe", bracketed: true },
    ],
  },
  {
    title: "Wardley Map",
    rows: [
      { label: "Anchor (User Need)",               value: 96, valueLabel: "96%", status: "Validated" },
      { label: "Custom-Built Components",          value: 82, valueLabel: "82%", status: "Validated" },
      { label: "Product / Vendor Layer",           value: 68, valueLabel: "68%", status: "Inferred" },
      { label: "Commodity Dependencies",           value: 51, valueLabel: "51%", status: "Inferred" },
      { label: "Climatic Market Shifts",           value: 37, valueLabel: "37%", status: "High Entropy" },
      { label: "Component Inertia (Tech Debt)",    value: 24, valueLabel: "24%", status: "High Entropy" },
      { label: "Evolution Trajectory",             value: 11, valueLabel: "11%", status: "Targeting Next Probe", bracketed: true },
    ],
  },
];

// A delta segment that has been "added" to a row by a prior particle
// impact. Persists once applied — the bar visibly grows over time.
type PersistentDelta = {
  color: string;
  widthPct: number;     // % of bar width
  growthAlpha: number;  // 0..1 — animates 0 → 1 right after impact, then sticks at 1
};

// One row of a detailed framework card: label on the left, status on the
// right (no percentage — the bar already encodes value), thin progress
// bar underneath tinted by status. When `activeColor` + `activeAlpha`
// are set (06.2.2 particle hit), the row pulses + tints. `persistentDeltas`
// renders permanent colored segments tacked onto the bar — the bar grows
// over time as inputs land. `effectiveStatus` overrides the row's
// baseline status (used when a row gets "promoted" by a hit).
const ModelCardRow: React.FC<{
  row: ModelRowItem;
  scale: number;
  activeColor?: string;
  activeAlpha?: number;
  persistentDeltas?: PersistentDelta[];
  effectiveStatus?: RowStatus;
  effectiveBracketed?: boolean;
}> = ({
  row,
  scale,
  activeColor,
  activeAlpha = 0,
  persistentDeltas = [],
  effectiveStatus,
  effectiveBracketed,
}) => {
  const status = effectiveStatus ?? row.status;
  const bracketed = effectiveBracketed ?? row.bracketed ?? false;
  const statusColor = STATUS_COLORS[status];
  const statusText = bracketed ? `[${status}]` : `(${status})`;

  // Row pulse: 1 → 1.03 at peak alpha → 1 (driven by activeAlpha).
  const rowScale = 1 + 0.03 * activeAlpha;
  // Row background tint: subtle wash in particle color.
  const rowTintAlpha = 0.10 * activeAlpha;

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 4 * scale,
        padding: `${4 * scale}px ${6 * scale}px`,
        margin: `0 ${-6 * scale}px`,
        borderRadius: 4 * scale,
        backgroundColor: activeColor && rowTintAlpha > 0 ? `${activeColor}${alphaHex(rowTintAlpha)}` : "transparent",
        transform: `scale(${rowScale})`,
        transformOrigin: "left center",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          justifyContent: "space-between",
          gap: 8 * scale,
        }}
      >
        <span
          style={{
            fontFamily: fonts.ui,
            fontSize: 11 * scale,
            fontWeight: 500,
            color: colors.primaryText,
            lineHeight: 1.25,
            whiteSpace: "nowrap",
            flex: "1 1 auto",
            minWidth: 0,
          }}
        >
          {row.label}
        </span>
        <span
          style={{
            fontFamily: fonts.ui,
            fontSize: 10 * scale,
            fontWeight: 600,
            color: statusColor,
            whiteSpace: "nowrap",
            flex: "0 0 auto",
          }}
        >
          {statusText}
        </span>
      </div>
      <div
        style={{
          position: "relative",
          height: 4 * scale,
          width: "100%",
          backgroundColor: "rgba(0,0,0,0.06)",
          borderRadius: 2 * scale,
          overflow: "hidden",
        }}
      >
        {/* Base fill — its color reflects the *current* (effective) status,
            so a promoted row's existing knowledge gets re-tinted along
            with the new deltas. */}
        <div
          style={{
            position: "absolute",
            left: 0,
            top: 0,
            height: "100%",
            width: `${row.value}%`,
            backgroundColor: statusColor,
            borderRadius: 2 * scale,
          }}
        />
        {/* Persistent delta segments — each prior impact stacks a chunk
            in its source color to the right of the current cumulative
            width. growthAlpha animates the segment in. */}
        {(() => {
          let cursor = row.value;
          return persistentDeltas.map((d, i) => {
            const w = d.widthPct * d.growthAlpha;
            const seg = (
              <div
                key={i}
                style={{
                  position: "absolute",
                  left: `${cursor}%`,
                  top: 0,
                  height: "100%",
                  width: `${w}%`,
                  backgroundColor: d.color,
                  borderRadius: 2 * scale,
                }}
              />
            );
            cursor += w;
            return seg;
          });
        })()}
      </div>
    </div>
  );
};

// Per-row activation: which color is currently lighting this row, and
// at what intensity (0..1). One entry per row index. Empty/missing entries
// = row not lit.
type RowActivation = { color: string; alpha: number };

// Per-row state that 06.2.2 LitModelRow computes from accumulated impacts.
type RowState = {
  ephemeral?: RowActivation;          // current pulse glow (fades after impact)
  persistentDeltas: PersistentDelta[]; // permanent colored segments stacked on the bar
  effectiveStatus?: RowStatus;         // promoted status if a hit changed the trust level
  effectiveBracketed?: boolean;
};

// Detailed framework card used by Scene 06.2. Same outer geometry as the
// skeleton card so they swap cleanly, but interior is title + 7 rows.
// `glowColor` and `glowAlpha` paint a brief outer glow ring when a 06.2.2
// particle strikes. `rowStates[i]` holds everything that has happened to
// row i up to the current frame: an ephemeral pulse, a list of persistent
// deltas, and an optional promoted status.
const ModelCardDetailed: React.FC<{
  framework: ModelFramework;
  scale?: number;
  textScale?: number;
  glowColor?: string;
  glowAlpha?: number;
  rowStates?: (RowState | undefined)[];
}> = ({
  framework,
  scale = 1,
  textScale = 1,
  glowColor,
  glowAlpha = 0,
  rowStates,
}) => (
  <div
    style={{
      width: 330 * scale,
      height: 420 * scale,
      backgroundColor: colors.surface,
      border: "1px solid rgba(0,0,0,0.08)",
      borderRadius: radii.container,
      // Stack the brand elevation shadow with the glow so we don't lose
      // the card's normal depth when the glow fires.
      boxShadow:
        glowAlpha > 0 && glowColor
          ? `${shadows.elevated}, 0 0 ${72 * glowAlpha}px ${20 * glowAlpha}px ${glowColor}${alphaHex(glowAlpha * 0.6)}`
          : shadows.elevated,
      padding: space.s3 * scale,
      display: "flex",
      flexDirection: "column",
      gap: space.s2 * scale,
    }}
  >
    <div style={{ height: 4 * scale, width: 36 * scale, backgroundColor: colors.accent, borderRadius: 2 * scale }} />
    <div
      style={{
        fontFamily: fonts.display,
        fontSize: 22 * textScale,
        fontWeight: 500,
        letterSpacing: "-0.01em",
        lineHeight: 1.18,
        color: colors.primaryText,
        marginBottom: space.s1 * scale,
      }}
    >
      {framework.title}
    </div>
    <div style={{ display: "flex", flexDirection: "column", gap: 10 * scale }}>
      {framework.rows.map((row, i) => {
        const state = rowStates?.[i];
        return (
          <ModelCardRow
            key={i}
            row={row}
            scale={scale}
            activeColor={state?.ephemeral?.color}
            activeAlpha={state?.ephemeral?.alpha ?? 0}
            persistentDeltas={state?.persistentDeltas}
            effectiveStatus={state?.effectiveStatus}
            effectiveBracketed={state?.effectiveBracketed}
          />
        );
      })}
    </div>
  </div>
);

// Helper — convert 0..1 alpha to two-char hex for color suffixes (e.g.
// "#E6B800" + alphaHex(0.6) → "#E6B80099").
function alphaHex(alpha: number): string {
  const v = Math.round(Math.max(0, Math.min(1, alpha)) * 255);
  return v.toString(16).padStart(2, "0");
}

// ---------- the denoiser transition (optionally with caption) ----------
//
// Two layers crossfade through a high-blur middle phase. Optionally a
// caption appears at the bottom as the output crystallizes — used when
// the animation is paired with a beat ("anim1 + beat2", "anim2 + new").
//
//   frame:       0 ────── 6 ──── 38 ──── 56 ──── 80 ──── 90
//   input:       fade in → crisp → blur out → gone
//   output:                 → fade in blurry → sharpen → crisp
//   caption:                            → fades in as output resolves

type Caption = { pre: string; highlight: string };

const Denoiser: React.FC<{
  input?: React.ReactNode;
  output: React.ReactNode;
  caption?: Caption;
  header?: string;
  footer?: string;
  // When true, skip the input/crossfade phase and render the output crisp
  // from frame 0. Header/footer still rise on their normal schedule, so
  // the cards land first and the framing language fades in over them.
  outputOnly?: boolean;
  // Total frames the sub-scene holds. The crossfade and reveal animations
  // are anchored to fixed frame counts at the start; the rest is hold.
  // Defaults to ANIM_FRAMES (90f / 3s) so existing usages stay correct.
  durationInFrames?: number;
  // Scales header + footer text by this multiplier (1 = baseline). Used by
  // Scene 06 end-state slides where the framing language sits next to
  // upscaled output elements and needs to match their hierarchy.
  textScale?: number;
  // Skip the canvas-colored background so siblings rendered before this
  // Denoiser (e.g. a particle layer) show through. The parent (Act1Hook)
  // already paints colors.canvas, so disabling this here is safe.
  transparentBg?: boolean;
}> = ({
  input,
  output,
  caption,
  header,
  footer,
  outputOnly,
  durationInFrames,
  textScale = 1,
  transparentBg,
}) => {
  const frame = useCurrentFrame();
  // Crossfade window stays anchored to ANIM_FRAMES so the input→output
  // resolve always feels the same regardless of total scene length.
  const D = ANIM_FRAMES;
  const total = durationInFrames ?? D;

  const inputOpacity = outputOnly
    ? 0
    : interpolate(
        frame,
        [0, 6, D * 0.42, D * 0.62],
        [0, 1, 1, 0],
        { extrapolateRight: "clamp" }
      );
  const inputBlur = outputOnly
    ? 0
    : interpolate(
        frame,
        [0, 6, D * 0.32, D * 0.62],
        [14, 0, 6, 30],
        { extrapolateRight: "clamp" }
      );

  const outputOpacity = outputOnly
    ? 1
    : interpolate(
        frame,
        [D * 0.42, D * 0.66, D * 0.88, D],
        [0, 0.55, 1, 1],
        { extrapolateRight: "clamp" }
      );
  const outputBlur = outputOnly
    ? 0
    : interpolate(
        frame,
        [D * 0.42, D * 0.66, D * 0.88, D],
        [30, 12, 0, 0],
        { extrapolateRight: "clamp" }
      );

  // Caption rises in as the output resolves crisp, holds through the
  // full sub-scene, then fades out in the last 4 frames. Clamped so the
  // range stays strictly monotonic when total is shorter than 78f (e.g.
  // Scene 06 sub-slots in the compressed 30s Hook).
  const capHoldEnd = Math.max(79, total - 4);
  const capFadeEnd = Math.max(80, total);
  const captionOpacity = interpolate(
    frame,
    [60, 78, capHoldEnd, capFadeEnd],
    [0, 1, 1, 0],
    { extrapolateRight: "clamp" }
  );

  // Header / footer reveal early. For end-state slides (outputOnly), the
  // cards are already crisp at frame 0, so the reveal kicks in nearly
  // immediately (header 0→18, footer 10→28). For crossfade slides, they
  // wait for the output to resolve (header 60→78, footer 70→88). Both
  // hold through the rest of the sub-scene.
  const headerStart = outputOnly ? 0 : 60;
  const headerEnd = outputOnly ? 18 : 78;
  const footerStart = outputOnly ? 10 : 70;
  const footerEnd = outputOnly ? 28 : 88;

  const headerOpacity = interpolate(
    frame,
    [headerStart, headerEnd, total],
    [0, 1, 1],
    { extrapolateRight: "clamp" }
  );
  const footerOpacity = interpolate(
    frame,
    [footerStart, footerEnd, total],
    [0, 1, 1],
    { extrapolateRight: "clamp" }
  );

  // When header/footer are present, reserve vertical room around the cards.
  // Slightly tighter when textScale > 1 because the upscaled output already
  // dominates the frame and we just need clearance, not breathing room.
  const verticalPad = header || footer ? (textScale > 1 ? 140 : 220) : caption ? 200 : 0;

  return (
    <AbsoluteFill style={{ backgroundColor: transparentBg ? "transparent" : colors.canvas }}>
      {header && (
        <div
          style={{
            position: "absolute",
            top: textScale > 1 ? 50 : 90,
            left: 0,
            right: 0,
            textAlign: "center",
            padding: `0 ${space.s6}px`,
            opacity: headerOpacity,
            fontFamily: fonts.display,
            fontSize: 44 * textScale,
            fontWeight: 400,
            letterSpacing: "-0.015em",
            lineHeight: 1.18,
            color: colors.primaryText,
          }}
        >
          {header}
        </div>
      )}

      {/* Animation layer — shifted to leave room for header/footer/caption. */}
      <AbsoluteFill
        style={{
          display: "grid",
          placeItems: "center",
          paddingBottom: caption ? 200 : footer ? verticalPad : 0,
          paddingTop: header ? verticalPad : 0,
        }}
      >
        {!outputOnly && input && (
          <div style={{ gridArea: "1 / 1", opacity: inputOpacity, filter: `blur(${inputBlur}px)` }}>
            {input}
          </div>
        )}
        <div style={{ gridArea: "1 / 1", opacity: outputOpacity, filter: `blur(${outputBlur}px)` }}>
          {output}
        </div>
      </AbsoluteFill>

      {caption && (
        <div
          style={{
            position: "absolute",
            bottom: 110,
            left: 0,
            right: 0,
            textAlign: "center",
            padding: `0 ${space.s6}px`,
            opacity: captionOpacity,
            fontFamily: fonts.display,
            fontSize: 44,
            fontWeight: 400,
            letterSpacing: "-0.015em",
            lineHeight: 1.18,
          }}
        >
          <span style={{ color: colors.primaryText }}>{caption.pre}</span>{" "}
          <span style={{ color: colors.accent, fontWeight: 600 }}>{caption.highlight}</span>
        </div>
      )}

      {footer && (
        <div
          style={{
            position: "absolute",
            bottom: textScale > 1 ? 60 : 110,
            left: 0,
            right: 0,
            textAlign: "center",
            padding: `0 ${space.s6}px`,
            opacity: footerOpacity,
            fontFamily: fonts.ui,
            fontSize: 28 * textScale,
            fontWeight: 500,
            letterSpacing: "0.01em",
            color: colors.accent,
          }}
        >
          {footer}
        </div>
      )}
    </AbsoluteFill>
  );
};

// ---------- skeleton compositions for the two anims ----------

const ModelRow: React.FC = () => (
  <div style={{ display: "flex", gap: 72 }}>
    {MODEL_FRAMEWORKS.map((fw, i) => (
      <ModelCardDetailed key={i} framework={fw} scale={1.7} textScale={1.4} />
    ))}
  </div>
);

// ---------- 06.2.2 — particles passing across the cards ----------
//
// Three colors (yellow / blue / purple — same channels as 06.1) at three
// depth layers (close + crisp / mid / far + blurred) streak left → right
// across the row of cards. When a particle hits its target card it adds
// a brief glow in that color: each card lights up in sequence as the
// inputs land.

type ParticleColor = "yellow" | "blue" | "purple";
const PARTICLE_COLORS: Record<ParticleColor, string> = {
  yellow: "#E6B800",
  blue:   "#3B82F6",
  purple: "#9333EA",
};

// Card center y as % of frame height. Cards (714px tall) sit centered
// vertically with the Denoiser's 140px top + 140px bottom pads:
// available = 1080 - 280 = 800, so card top ≈ 140 + (800-714)/2 = 183
// and card center ≈ 540 → 50%. Particles target Y centerlines that
// correspond to the row of cards.
const CARD_ROW_Y_PCT = 50;

// Card center x (% of 1920) — used for impact targeting.
const CARD_X_PCT = [17, 50, 83] as const;

type CardImpact = {
  cardIdx: 0 | 1 | 2;
  color: ParticleColor;
  impactFrame: number;
};

type S622ParticleData = {
  color: ParticleColor;
  size: number;
  blur: number;        // depth blur (0 = foreground)
  yPct: number;        // path centerline as % of frame height
  enterStart: number;  // frame this particle enters from the left
  travelDur: number;   // frames to traverse left → right
  // If set, this particle "strikes" the card at this index — a card
  // glow ring fires when xPct passes through the card's center x.
  // If not set, the particle is atmosphere (no card lighting).
  cardIdx?: 0 | 1 | 2;
};

// 06.2.2 choreography (90 frames / 3s). Mix of card-impactful particles
// (12 hits, ~3 per card) and atmosphere particles (depth + variety).
//
// Impact particles fire at frame X and reach their target card's center
// (50% / 17% / 83% horizontally) at impactFrame. enterStart is computed
// so impact lands on time; we use the relation:
//   xPct(impactFrame) = -8 + ((impactFrame - enterStart) / travelDur) * 116 = targetX
// Solving for enterStart given travelDur=40, targetX={17,50,83}:
//   enterStart = impactFrame - travelDur * (targetX + 8) / 116
const SCENE622_PARTICLES: S622ParticleData[] = [
  // ── Foreground (close, crisp, large) — main beats per card ──
  // Card 1 (BMC, x=17): yellow @ frame 14
  { color: "yellow", size: 32, blur: 0, yPct: 48, enterStart: 14 - 40 * 25/116, travelDur: 40, cardIdx: 0 },
  // Card 2 (VSM, x=50): blue @ frame 30
  { color: "blue",   size: 36, blur: 0, yPct: 50, enterStart: 30 - 40 * 58/116, travelDur: 40, cardIdx: 1 },
  // Card 3 (Wardley, x=83): purple @ frame 46
  { color: "purple", size: 32, blur: 0, yPct: 52, enterStart: 46 - 40 * 91/116, travelDur: 40, cardIdx: 2 },

  // ── Midground (mid size, light blur) — second-pass colors ──
  // Card 1 second hit: blue @ 22
  { color: "blue",   size: 20, blur: 3, yPct: 44, enterStart: 22 - 50 * 25/116, travelDur: 50, cardIdx: 0 },
  // Card 2 second hit: purple @ 36
  { color: "purple", size: 22, blur: 3, yPct: 56, enterStart: 36 - 50 * 58/116, travelDur: 50, cardIdx: 1 },
  // Card 3 second hit: yellow @ 54
  { color: "yellow", size: 20, blur: 3, yPct: 46, enterStart: 54 - 50 * 91/116, travelDur: 50, cardIdx: 2 },

  // ── Third pass — completes the trio per card ──
  // Card 1 third hit: purple @ 56
  { color: "purple", size: 24, blur: 2, yPct: 53, enterStart: 56 - 45 * 25/116, travelDur: 45, cardIdx: 0 },
  // Card 2 third hit: yellow @ 64
  { color: "yellow", size: 26, blur: 2, yPct: 47, enterStart: 64 - 45 * 58/116, travelDur: 45, cardIdx: 1 },
  // Card 3 third hit: blue @ 74
  { color: "blue",   size: 26, blur: 2, yPct: 54, enterStart: 74 - 45 * 91/116, travelDur: 45, cardIdx: 2 },

  // ── Background (small, heavy blur) — atmosphere, no card light ──
  { color: "yellow", size: 12, blur: 6, yPct: 38, enterStart:  0,  travelDur: 70 },
  { color: "blue",   size: 14, blur: 6, yPct: 62, enterStart:  8,  travelDur: 65 },
  { color: "purple", size: 10, blur: 7, yPct: 35, enterStart: 18,  travelDur: 75 },
  { color: "yellow", size: 11, blur: 7, yPct: 65, enterStart: 28,  travelDur: 70 },
  { color: "blue",   size: 12, blur: 6, yPct: 41, enterStart: 38,  travelDur: 60 },
  { color: "purple", size: 13, blur: 6, yPct: 60, enterStart: 50,  travelDur: 65 },
];

// Derive card impact events from the choreography — these drive the
// per-card glow timing inside LitModelRow.
const CARD_IMPACTS: CardImpact[] = SCENE622_PARTICLES
  .filter((p): p is S622ParticleData & { cardIdx: 0 | 1 | 2 } => p.cardIdx !== undefined)
  .map((p) => ({
    cardIdx: p.cardIdx,
    color: p.color,
    // Impact frame = enterStart + travelDur * (targetX + 8) / 116, where
    // targetX is the card's x %. For the cardIdx i, that's CARD_X_PCT[i].
    impactFrame: Math.round(p.enterStart + p.travelDur * (CARD_X_PCT[p.cardIdx] + 8) / 116),
  }));

const Scene622Particle: React.FC<S622ParticleData> = ({
  color,
  size,
  blur,
  yPct,
  enterStart,
  travelDur,
}) => {
  const frame = useCurrentFrame();
  const local = frame - enterStart;
  if (local < 0 || local > travelDur + 4) return null;

  const t = Math.min(1, local / travelDur);
  // Linear traversal — particles read as steady streams rather than
  // accelerating projectiles. Constant velocity at depth.
  const xPct = -8 + t * 116; // -8% (off-screen left) → 108% (off-screen right)
  const opacity = interpolate(t, [0, 0.08, 0.92, 1], [0, 1, 1, 0], { extrapolateRight: "clamp" });
  // Speed-based motion blur scales with size (depth blur is separate).
  const motionBlur = (size / 36) * 4;

  return (
    <div
      style={{
        position: "absolute",
        left: `${xPct}%`,
        top: `${yPct}%`,
        transform: "translate(-50%, -50%)",
        opacity,
        filter: `blur(${blur + motionBlur}px)`,
      }}
    >
      <Particle size={size} color={PARTICLE_COLORS[color]} />
    </div>
  );
};

const Scene622ParticleOverlay: React.FC = () => (
  <AbsoluteFill style={{ pointerEvents: "none" }}>
    {SCENE622_PARTICLES.map((p, i) => (
      <Scene622Particle key={i} {...p} />
    ))}
  </AbsoluteFill>
);

// What happens to a single row when a (card, color) particle hits:
//   - delta: % added to the bar (varies — small for high-confidence rows,
//     big for low-confidence rows that just got their first signal)
//   - newStatus: optional promotion up the trust ladder
//     (Targeting Next Probe → High Entropy → Inferred → Validated)
type RowHit = {
  rowIdx: number;
  delta: number;             // % of bar width
  newStatus?: RowStatus;
  newBracketed?: boolean;
};

// Per-card-per-color hits. Each color owns distinct rows per card. Lower
// rows (high entropy / probe targets) get bigger deltas + status climbs
// because they're the ones with the most uncertainty to resolve. Higher
// rows (already validated) get small marginal deltas — confirmation.
//
// Status promotion ladder (lowest → highest trust):
//   Targeting Next Probe → High Entropy → Inferred → Spike Detected*
//   → Validated     (* Spike Detected is its own thing, used for VSM
//                      Algedonic Alerts when it gets bigger signal)
const ROW_HITS_BY_HIT: Record<ParticleColor, RowHit[]>[] = [
  // ── Card 0 — Business Model Canvas ──
  {
    yellow: [
      { rowIdx: 1, delta: 4 }, // Customer Segments (88% Validated): tiny confirm
      { rowIdx: 5, delta: 22, newStatus: "Inferred" }, // Channels / GTM: 21% → 43%, promoted
    ],
    blue: [
      { rowIdx: 0, delta: 3 }, // Value Proposition (94% Validated): nudge
      { rowIdx: 2, delta: 12 }, // Revenue Streams (65% Inferred): solidify
      { rowIdx: 4, delta: 18, newStatus: "Inferred" }, // Cost Structure: 38% → 56%, promoted
    ],
    purple: [
      { rowIdx: 3, delta: 14 }, // Key Activities (52% Inferred): grow
      { rowIdx: 6, delta: 28, newStatus: "High Entropy", newBracketed: false }, // Key Partnerships: 12% → 40%, big leap from probe target → entropy
    ],
  },
  // ── Card 1 — Viable System Model ──
  {
    yellow: [
      { rowIdx: 1, delta: 5 }, // Identity & Purpose (84% Validated): confirm
      { rowIdx: 2, delta: 16 }, // Algedonic Alerts (72% Spike): heavier (alerts feed on emotions)
    ],
    blue: [
      { rowIdx: 0, delta: 4 }, // Primary Operations (91% Validated): tiny
      { rowIdx: 3, delta: 20, newStatus: "Inferred" }, // Coordination 56% → 76%, stays Inferred but climbs
    ],
    purple: [
      { rowIdx: 4, delta: 24, newStatus: "Inferred" }, // Control & Audit: 34% → 58%, promoted
      { rowIdx: 5, delta: 18, newStatus: "Inferred" }, // Strategic Intel: 18% → 36% (kept HE) — actually promote
      { rowIdx: 6, delta: 26, newStatus: "High Entropy", newBracketed: false }, // Environmental: 8% → 34%, probe → entropy
    ],
  },
  // ── Card 2 — Wardley Map ──
  {
    yellow: [
      { rowIdx: 0, delta: 3 }, // Anchor (96% Validated): nudge
      { rowIdx: 5, delta: 20, newStatus: "Inferred" }, // Component Inertia: 24% → 44%, promoted
    ],
    blue: [
      { rowIdx: 2, delta: 10 }, // Product/Vendor (68% Inferred): grow
      { rowIdx: 3, delta: 14 }, // Commodity Deps (51% Inferred): grow
    ],
    purple: [
      { rowIdx: 1, delta: 6 }, // Custom-Built (82% Validated): confirm
      { rowIdx: 4, delta: 22, newStatus: "Inferred" }, // Climatic Shifts: 37% → 59%, promoted
      { rowIdx: 6, delta: 30, newStatus: "High Entropy", newBracketed: false }, // Evolution: 11% → 41%, probe → entropy
    ],
  },
];

const LitModelRow: React.FC = () => {
  const frame = useCurrentFrame();
  return (
    <div style={{ display: "flex", gap: 72 }}>
      {MODEL_FRAMEWORKS.map((fw, cardIdx) => {
        let glowAlpha = 0;
        let glowColor: string | undefined;

        // Sort impacts for this card by frame so we apply them in order
        // — status promotions need to compose chronologically.
        const cardImpacts = CARD_IMPACTS
          .filter((h) => h.cardIdx === cardIdx)
          .sort((a, b) => a.impactFrame - b.impactFrame);

        const rowStates: (RowState | undefined)[] = fw.rows.map(() => ({
          persistentDeltas: [],
        }));

        for (const hit of cardImpacts) {
          const local = frame - hit.impactFrame;
          if (local < 0) continue; // not yet fired

          // Card glow: 0 → 1 over 4f, fades back to 0 over next 16f.
          const cardA = interpolate(local, [0, 4, 20], [0, 1, 0], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          });
          if (cardA > glowAlpha) {
            glowAlpha = cardA;
            glowColor = PARTICLE_COLORS[hit.color];
          }

          const hits = ROW_HITS_BY_HIT[cardIdx][hit.color];
          const partColor = PARTICLE_COLORS[hit.color];

          for (const rh of hits) {
            const state = rowStates[rh.rowIdx]!;

            // Persistent delta: width animates 0 → full over 6f after
            // impact, then sticks. Once applied, it never disappears.
            const growthAlpha = interpolate(local, [0, 6], [0, 1], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            });
            state.persistentDeltas.push({
              color: partColor,
              widthPct: rh.delta,
              growthAlpha,
            });

            // Status promotion: applied as soon as the impact fires (no
            // animation — the new label just appears with the delta).
            if (rh.newStatus) {
              state.effectiveStatus = rh.newStatus;
              state.effectiveBracketed = rh.newBracketed;
            }

            // Ephemeral pulse: 0 → 1 over 5f, fades over next 19f.
            const ephA = interpolate(local, [0, 5, 24], [0, 1, 0], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            });
            if (ephA > 0) {
              const existing = state.ephemeral;
              if (!existing || ephA > existing.alpha) {
                state.ephemeral = { color: partColor, alpha: ephA };
              }
            }
          }
        }

        return (
          <ModelCardDetailed
            key={cardIdx}
            framework={fw}
            scale={1.7}
            textScale={1.4}
            glowColor={glowColor}
            glowAlpha={glowAlpha}
            rowStates={rowStates}
          />
        );
      })}
    </div>
  );
};

// Scene 06 sub-slot durations — lifted to module scope so the 06.2
// switching output (below) can reference them. Act1Hook re-uses the
// same names locally for backwards compatibility with existing call sites.
const SCENE6_SUBSCENE_PILLS = 140; // 06.1 — last pill thump at 120 + 18f decay + small hold
const SCENE6_SUBSCENE_HALF = 30;   // 06.2.1 static cards (no animation)
const SCENE6_SUBSCENE_LIT = 120;   // 06.2.2 last impact at 74 + 45f trailing exits
const SCENE6_SUBSCENE_CARDS = SCENE6_SUBSCENE_HALF + SCENE6_SUBSCENE_LIT; // 150f
const SCENE6_FRAMES = SCENE6_SUBSCENE_PILLS + SCENE6_SUBSCENE_CARDS; // 290f / ~9.7s

// 06.2 output that switches from static cards to lit cards + particles
// at the half-mark. Lives inside a single Denoiser instance hoisted to
// 06.2's level so the framing language (header/footer) doesn't re-fade
// between halves. The lit half wraps in an inner Sequence so LitModelRow
// and Scene622ParticleOverlay see frame 0 when they mount — keeping
// their relative-frame choreography intact.
const Scene62SwitchingOutputInner: React.FC = () => {
  const frame = useCurrentFrame();
  const lit = frame >= SCENE6_SUBSCENE_HALF;
  return (
    <div style={{ position: "relative" }}>
      {!lit && <ModelRow />}
      {lit && (
        <Sequence
          from={SCENE6_SUBSCENE_HALF}
          durationInFrames={SCENE6_SUBSCENE_LIT}
          layout="none"
        >
          <Scene622ParticleOverlay />
          <LitModelRow />
        </Sequence>
      )}
    </div>
  );
};

const Scene62SwitchingOutput: React.FC = () => (
  <Denoiser
    outputOnly
    transparentBg
    durationInFrames={SCENE6_SUBSCENE_CARDS}
    textScale={1.4}
    output={<Scene62SwitchingOutputInner />}
    header="Those signals improve the accuracy of trained models"
    footer="The same signal can feed multiple frameworks"
  />
);

// Stack of three labeled pills used as the output of Scene 06.1. Same
// pill primitive as Scenes 02/04 (PillBase) but stacked vertically with
// generous width and elements scaled +70% / text +40% so the labels
// read at the same hierarchy as the model cards in 06.2.

// ---------- 07.1 — kinn responds (chat bubble + fast multi-color hits) ----------
//
// After 06.2's deltas-and-promotions arc, kinn "speaks": a chat bubble
// drops in, multi-colored particles streak through fast, the bubble
// thumps with each impact. Reads as the synthesized voice of the system
// after all that input. 60 frames / 2s.

const SCENE71_FRAMES = 90; // 3s — extended +1s of dwell on the "Great, now next question!" phase
const SCENE71_BUBBLE_PULSE_PEAK = 0.08; // 1 → 1.08 at peak (more energetic than 06.1's 0.06)

// Chat bubble: kinn warm tone, asymmetric border-radius (sharp top-left
// corner is the "tail anchor"), Newsreader for the speaker label, Inter
// for the body. Visually distinct from PillBase to read as "dialogue,
// not category."
// Single thinking dot. Pulses opacity + scale on a 30-frame cycle,
// offset per index so the three dots form a continuous wave (one peaks,
// next is mid-rise, last is dim).
const ThinkingDot: React.FC<{ index: number; size: number }> = ({ index, size }) => {
  const frame = useCurrentFrame();
  const cycle = 30;
  const stagger = 8;
  const local = ((frame - index * stagger) % cycle + cycle) % cycle;
  const t = local / cycle;
  const wave = 1 - Math.abs(t - 0.5) * 2;
  const eased = wave * wave;
  const opacity = 0.25 + eased * 0.65;
  const scaleDot = 0.85 + eased * 0.25;
  return (
    <div
      style={{
        width: size,
        height: size,
        minWidth: size,
        minHeight: size,
        flexShrink: 0,
        flexGrow: 0,
        borderRadius: "50%",
        backgroundColor: colors.primaryText,
        opacity,
        transform: `scale(${scaleDot})`,
        display: "inline-block",
      }}
    />
  );
};

const KinnChatBubble: React.FC<{
  pulseScale?: number;
  glowColor?: string;
  glowAlpha?: number;
  // "dots" → three thinking dots; string → that string as the bubble's body
  // text (Newsreader, accent-tinted). Used by 07.1 to swap dots → answer.
  content?: "dots" | string;
  // Opacity of the body content (for entry fades on the text phase). 1 = fully visible.
  contentOpacity?: number;
}> = ({
  pulseScale = 1,
  glowColor,
  glowAlpha = 0,
  content = "dots",
  contentOpacity = 1,
}) => (
  <div
    style={{
      backgroundColor: "#F4EFE9", // PILL_TONES.warm bg — keeps the family
      border: "1px solid rgba(0,0,0,0.06)",
      borderRadius: "8px 32px 32px 32px", // sharp top-left tail
      boxShadow:
        glowAlpha > 0 && glowColor
          ? `${shadows.elevated}, 0 0 ${64 * glowAlpha}px ${16 * glowAlpha}px ${glowColor}${alphaHex(glowAlpha * 0.55)}`
          : shadows.elevated,
      padding: `${space.s4}px ${space.s5}px`,
      display: "inline-flex",
      flexDirection: "column",
      gap: space.s3,
      transform: `scale(${pulseScale})`,
      transformOrigin: "center center",
    }}
  >
    <div
      style={{
        fontFamily: fonts.display,
        fontSize: 32,
        fontWeight: 500,
        letterSpacing: "-0.01em",
        color: colors.accent,
        lineHeight: 1,
      }}
    >
      Kinn:
    </div>
    {content === "dots" ? (
      // Thinking indicator: three staggered dots laid horizontally.
      // Explicit row direction + nowrap to defeat any inherited column.
      <div
        style={{
          display: "flex",
          flexDirection: "row",
          flexWrap: "nowrap",
          alignItems: "center",
          gap: 14,
          opacity: contentOpacity,
        }}
      >
        <ThinkingDot index={0} size={14} />
        <ThinkingDot index={1} size={14} />
        <ThinkingDot index={2} size={14} />
      </div>
    ) : (
      // Answer phase: the bubble has "spoken" — replace dots with the
      // synthesized response. Newsreader serif, charcoal, sized to read
      // comfortably alongside the "Kinn:" speaker label above.
      <div
        style={{
          fontFamily: fonts.display,
          fontSize: 32,
          fontWeight: 400,
          letterSpacing: "-0.01em",
          lineHeight: 1.2,
          color: colors.primaryText,
          opacity: contentOpacity,
        }}
      >
        {content}
      </div>
    )}
  </div>
);

// Particle hits for 07.1 — fast, multi-color, all targeting bubble center.
// No category ownership — colors mix freely (yellow/blue/purple all fire
// the synthesized response). Each entry: enterStart, color, size, blur.
type S71Particle = {
  enterStart: number;
  color: ParticleColor;
  size: number;
  blur: number;
  yPct: number;
  travelDur: number; // fast — 18-26f traversal
};

// Bubble center is at frame center (50% / 50%). Impact for each particle
// happens when xPct=50, mid-traversal. Choreography: 12 hits across 60f,
// staggered ~4-6f apart for a percussive rhythm.
const SCENE71_PARTICLES: S71Particle[] = [
  // Foreground (close, crisp, larger)
  { enterStart:  0, color: "yellow", size: 30, blur: 0, yPct: 50, travelDur: 22 },
  { enterStart:  6, color: "blue",   size: 28, blur: 0, yPct: 48, travelDur: 20 },
  { enterStart: 12, color: "purple", size: 32, blur: 0, yPct: 52, travelDur: 22 },
  { enterStart: 18, color: "yellow", size: 26, blur: 0, yPct: 50, travelDur: 18 },
  { enterStart: 24, color: "blue",   size: 30, blur: 0, yPct: 49, travelDur: 22 },
  { enterStart: 30, color: "purple", size: 28, blur: 0, yPct: 51, travelDur: 20 },
  { enterStart: 36, color: "yellow", size: 30, blur: 0, yPct: 50, travelDur: 22 },
  { enterStart: 42, color: "blue",   size: 26, blur: 0, yPct: 48, travelDur: 18 },

  // Midground (smaller, light blur, off-axis y for variety)
  { enterStart:  3, color: "purple", size: 16, blur: 3, yPct: 42, travelDur: 26 },
  { enterStart: 15, color: "yellow", size: 14, blur: 3, yPct: 58, travelDur: 24 },
  { enterStart: 27, color: "blue",   size: 18, blur: 3, yPct: 44, travelDur: 26 },
  { enterStart: 39, color: "purple", size: 16, blur: 3, yPct: 56, travelDur: 24 },

  // Background atmosphere (small, heavy blur)
  { enterStart:  0, color: "yellow", size: 10, blur: 6, yPct: 38, travelDur: 40 },
  { enterStart: 10, color: "blue",   size: 12, blur: 6, yPct: 62, travelDur: 38 },
  { enterStart: 22, color: "purple", size: 10, blur: 7, yPct: 36, travelDur: 42 },
  { enterStart: 34, color: "yellow", size: 11, blur: 6, yPct: 64, travelDur: 38 },
];

// Compute when each particle visually crosses 50% x (impact frame).
// Linear traversal: xPct(f) = -8 + ((f - enterStart)/travelDur) * 116
// Solve for xPct=50: f = enterStart + travelDur * 58/116 = enterStart + travelDur/2
const SCENE71_IMPACTS = SCENE71_PARTICLES.map((p) => ({
  impactFrame: Math.round(p.enterStart + p.travelDur / 2),
  color: p.color,
  size: p.size,
}));

const Scene71Particle: React.FC<S71Particle> = ({
  enterStart,
  color,
  size,
  blur,
  yPct,
  travelDur,
}) => {
  const frame = useCurrentFrame();
  const local = frame - enterStart;
  if (local < 0 || local > travelDur + 4) return null;

  const t = Math.min(1, local / travelDur);
  const xPct = -8 + t * 116;
  const opacity = interpolate(t, [0, 0.1, 0.9, 1], [0, 1, 1, 0], { extrapolateRight: "clamp" });
  const motionBlur = (size / 36) * 5; // a touch more blur than 06.2.2 — these are FAST

  return (
    <div
      style={{
        position: "absolute",
        left: `${xPct}%`,
        top: `${yPct}%`,
        transform: "translate(-50%, -50%)",
        opacity,
        filter: `blur(${blur + motionBlur}px)`,
      }}
    >
      <Particle size={size} color={PARTICLE_COLORS[color]} />
    </div>
  );
};

const Scene71ParticleOverlay: React.FC = () => (
  <AbsoluteFill style={{ pointerEvents: "none" }}>
    {SCENE71_PARTICLES.map((p, i) => (
      <Scene71Particle key={i} {...p} />
    ))}
  </AbsoluteFill>
);

// Bubble that pulses + glows on every particle impact (any color). Pulse
// magnitude scales with particle size; max-not-sum on overlapping hits.
// Uses the same percussion idea as 06.1's PulsingPillStack but applied
// to a single target.
const PulsingChatBubble: React.FC = () => {
  const frame = useCurrentFrame();

  let pulseBump = 0;
  let glow = 0;
  let glowColor: string | undefined;

  for (const hit of SCENE71_IMPACTS) {
    const local = frame - hit.impactFrame;
    const sizeFactor = hit.size / 30; // 30 = main foreground size, ~1.0
    const localBump = interpolate(
      local,
      [0, 4, 16],
      [0, SCENE71_BUBBLE_PULSE_PEAK * sizeFactor, 0],
      { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
    );
    const localGlow = interpolate(
      local,
      [0, 3, 16],
      [0, sizeFactor, 0],
      { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
    );
    if (localBump > pulseBump) pulseBump = localBump;
    if (localGlow > glow) {
      glow = localGlow;
      glowColor = PARTICLE_COLORS[hit.color];
    }
  }

  // Bubble entry: scale + fade in over first 8f. Exit: scale-down + fade
  // over last 6f for a clean handoff to the logo.
  const entryFade = interpolate(frame, [0, 8], [0, 1], { extrapolateRight: "clamp" });
  const entryScale = interpolate(frame, [0, 12], [0.92, 1], { extrapolateRight: "clamp" });
  const exitFade = interpolate(frame, [SCENE71_FRAMES - 6, SCENE71_FRAMES], [1, 0], { extrapolateLeft: "clamp" });
  const exitScale = interpolate(frame, [SCENE71_FRAMES - 6, SCENE71_FRAMES], [1, 0.96], { extrapolateLeft: "clamp" });

  const finalScale = entryScale * exitScale * (1 + pulseBump);
  const finalOpacity = entryFade * exitFade;

  // Phase swap: dots run for the first 30 frames (1s); from frame 30 the
  // bubble shows the synthesized answer. Cross-fade over 8 frames so the
  // swap feels like the bubble "settled" rather than snap-cutting.
  const SWAP_FRAME = 30;
  const SWAP_FADE = 8;
  const isAnswerPhase = frame >= SWAP_FRAME;
  const dotsOpacity = interpolate(
    frame,
    [SWAP_FRAME - SWAP_FADE, SWAP_FRAME],
    [1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );
  const answerOpacity = interpolate(
    frame,
    [SWAP_FRAME, SWAP_FRAME + SWAP_FADE],
    [0, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );

  return (
    <AbsoluteFill style={{ display: "grid", placeItems: "center", opacity: finalOpacity }}>
      <KinnChatBubble
        pulseScale={finalScale}
        glowColor={glowColor}
        glowAlpha={glow}
        content={isAnswerPhase ? "Great, now next question!" : "dots"}
        contentOpacity={isAnswerPhase ? answerOpacity : dotsOpacity}
      />
    </AbsoluteFill>
  );
};

// ---------- 06.1 choreography constants (shared by stack + particles) ----------
//
// One particle wave per pill: enters left, strikes the pill (pulse), exits
// right in that pill's category color. 45-frame stagger between pills,
// last exit completes by ~155f, leaving ~25f hold time before the cut.
const SCENE6_PILL_GEOMETRY = {
  width: 884,
  scale: 1.7,
  textScale: 1.4,
  gap: 48,
  height: 64 * 1.7, // 108.8 — matches PillBase height when scale=1.7
} as const;

type PillCategory = {
  text: string;
  tone: PillTone;
  exitColor: string; // color of the particle as it exits
  impactFrame: number; // frame the particle strikes this pill
};

const SCENE6_PILLS: PillCategory[] = [
  { text: "User Emotions",           tone: "accent", exitColor: "#E6B800", impactFrame: 30  }, // yellow
  { text: "Valuable Business Facts", tone: "warm",   exitColor: "#3B82F6", impactFrame: 75  }, // blue
  { text: "Business Moment",         tone: "cool",   exitColor: "#9333EA", impactFrame: 120 }, // purple
];

// Pulsing version for 06.1: every particle that strikes a pill triggers
// a pulse — the row thumps multiple times during its window so the
// process feels lively. Pulse magnitude scales with particle size, so
// big particles thump and small satellites flutter.
const PulsingPillStack: React.FC = () => {
  const frame = useCurrentFrame();
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: SCENE6_PILL_GEOMETRY.gap, alignItems: "center" }}>
      {SCENE6_PILLS.map((p, i) => {
        // Sum / max contributions from every particle hitting this row.
        // Each impact: scale bump up to (1 + sizeFactor * 0.06) over 6f,
        // then back to 1 over next 12f. Glow flashes for 18f.
        let pulseBump = 0; // additive on top of base 1.0
        let glow = 0;      // 0..1 brightness of the ring

        for (const sat of SCENE6_FLOCKS[i]) {
          const impact = p.impactFrame + sat.frameOffset;
          const local = frame - impact;
          const sizeFactor = sat.size / 36; // main = 1.0, satellites scale around it
          const localBump = interpolate(
            local,
            [0, 6, 18],
            [0, 0.06 * sizeFactor, 0],
            { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
          );
          const localGlow = interpolate(
            local,
            [0, 4, 18],
            [0, sizeFactor, 0],
            { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
          );
          // Take the strongest active hit rather than summing — multiple
          // overlapping pulses shouldn't compound into a giant bounce.
          if (localBump > pulseBump) pulseBump = localBump;
          if (localGlow > glow) glow = localGlow;
        }

        const pulseScale = 1 + pulseBump;
        return (
          <div
            key={i}
            style={{
              transform: `scale(${pulseScale})`,
              boxShadow: glow > 0 ? `0 0 ${48 * glow}px ${12 * glow}px ${p.exitColor}66` : undefined,
              borderRadius: 999,
            }}
          >
            <PillBase
              width={SCENE6_PILL_GEOMETRY.width}
              tone={p.tone}
              text={p.text}
              scale={SCENE6_PILL_GEOMETRY.scale}
              textScale={SCENE6_PILL_GEOMETRY.textScale}
            />
          </div>
        );
      })}
    </div>
  );
};

// One particle that streaks through a row: enters left in accent (raw),
// crosses to xPct=50 at its own impact frame, exits right in the row's
// category color. `size`, `enterDur`, `exitDur`, and `yPct` are tunable
// per-instance so a row can host a varied flock rather than a metronome.
type Scene6ParticleProps = {
  pill: PillCategory;
  yPct: number;
  size: number;
  enterDur: number;
  exitDur: number;
  // Frame this particle strikes the row. Defaults to pill.impactFrame
  // (the "main" particle that drives the pulse). Satellites pass through
  // at offset frames so the row feels populated, not metronomic.
  impactFrame?: number;
};

const Scene6Particle: React.FC<Scene6ParticleProps> = ({
  pill,
  yPct,
  size,
  enterDur,
  exitDur,
  impactFrame,
}) => {
  const frame = useCurrentFrame();
  const impact = impactFrame ?? pill.impactFrame;
  const enterStart = impact - enterDur;
  const exitEnd = impact + exitDur;

  if (frame < enterStart || frame > exitEnd + 4) return null;

  const isEntering = frame < impact;
  let xPct: number;
  let opacity: number;
  let color: string;

  if (isEntering) {
    const t = (frame - enterStart) / enterDur;
    const eased = t * t; // accelerate toward impact
    xPct = -8 + eased * 58; // -8% (off-screen left) → 50% (at pill)
    opacity = interpolate(t, [0, 0.2, 1], [0, 1, 1], { extrapolateRight: "clamp" });
    color = colors.accent;
  } else {
    const t = Math.min(1, (frame - impact) / exitDur);
    const eased = 1 - (1 - t) * (1 - t); // ease-out
    xPct = 50 + eased * 60; // 50% → 110% (off-screen right)
    opacity = interpolate(t, [0, 0.85, 1], [1, 1, 0], { extrapolateRight: "clamp" });
    color = pill.exitColor;
  }

  // Motion blur scales with size (small particles get less blur — keeps
  // them readable as discrete dots rather than smears).
  const blurScale = size / 36;
  const speedBlur = isEntering
    ? interpolate(frame - enterStart, [0, enterDur], [0, 6 * blurScale], { extrapolateRight: "clamp" })
    : interpolate(frame - impact, [0, 8, exitDur], [0, 8 * blurScale, 4 * blurScale], { extrapolateRight: "clamp" });

  return (
    <div
      style={{
        position: "absolute",
        left: `${xPct}%`,
        top: `${yPct}%`,
        transform: "translate(-50%, -50%)",
        opacity,
        filter: `blur(${speedBlur}px)`,
      }}
    >
      <Particle size={size} color={color} />
    </div>
  );
};

// Vertical positions of each pill within the 06.1 frame, expressed as
// % of frame height. Derived from the layout: 3 pills, height 109px each,
// gap 48, total stack height = 109*3 + 48*2 = 423px, centered between the
// header pad (140) and footer pad (140) in a 1080-frame.
//
// Stack vertical center ≈ 540, top of pill 1 ≈ 540 - 423/2 ≈ 329.
//   Pill 1 center: 329 + 54 = 383 → 35.5% of 1080
//   Pill 2 center: 329 + 109 + 48 + 54 = 540 → 50%
//   Pill 3 center: 329 + 2*(109+48) + 54 = 697 → 64.5%
const SCENE6_PILL_Y_PCT = [35.5, 50, 64.5] as const;

// Per-row particle flocks. Each entry is one streaking particle. The
// "main" particle (offset 0) strikes on the pill's impactFrame and drives
// the pulse; satellites streak at offset frames with varied size and
// speed for visual variety.
//
// Row 1 (Emotions / yellow): 3 particles — small + main + tiny tail
// Row 2 (Facts / blue):      5 particles — facts come noisy and fast
// Row 3 (Moment / purple):   2 particles — moments are rarer
type Satellite = {
  size: number;
  enterDur: number;
  exitDur: number;
  yJitter: number;     // ± % offset from row centerline
  frameOffset: number; // frames before/after the row's main impact
};

const SCENE6_FLOCKS: Satellite[][] = [
  // Row 1 — User Emotions (yellow)
  [
    { size: 18, enterDur: 22, exitDur: 28, yJitter: -2.2, frameOffset: -10 },
    { size: 36, enterDur: 25, exitDur: 32, yJitter:  0,   frameOffset:   0 }, // main
    { size: 12, enterDur: 18, exitDur: 22, yJitter:  2.5, frameOffset:  16 },
  ],
  // Row 2 — Valuable Business Facts (blue) — densest, fastest
  [
    { size: 14, enterDur: 16, exitDur: 20, yJitter: -2.8, frameOffset: -18 },
    { size: 22, enterDur: 20, exitDur: 26, yJitter: -1.0, frameOffset:  -8 },
    { size: 42, enterDur: 25, exitDur: 32, yJitter:  0,   frameOffset:   0 }, // main
    { size: 16, enterDur: 18, exitDur: 22, yJitter:  1.4, frameOffset:  10 },
    { size: 10, enterDur: 14, exitDur: 18, yJitter:  2.6, frameOffset:  20 },
  ],
  // Row 3 — Business Moment (purple) — sparse, deliberate
  [
    { size: 30, enterDur: 25, exitDur: 32, yJitter:  0,   frameOffset:   0 }, // main
    { size: 14, enterDur: 22, exitDur: 28, yJitter:  2.0, frameOffset:  14 },
  ],
];

const Scene6ParticleOverlay: React.FC = () => (
  // Layered behind the pill stack via JSX sibling order at the call site
  // (this component renders first, the Denoiser/PulsingPillStack second).
  <AbsoluteFill style={{ pointerEvents: "none" }}>
    {SCENE6_PILLS.map((pill, rowIdx) =>
      SCENE6_FLOCKS[rowIdx].map((sat, satIdx) => (
        <Scene6Particle
          key={`${rowIdx}-${satIdx}`}
          pill={pill}
          yPct={SCENE6_PILL_Y_PCT[rowIdx] + sat.yJitter}
          size={sat.size}
          enterDur={sat.enterDur}
          exitDur={sat.exitDur}
          impactFrame={pill.impactFrame + sat.frameOffset}
        />
      ))
    )}
  </AbsoluteFill>
);

// ---------- scene 04: business inputs cloud ----------
//
// A cloud of input pills rises from below the frame, growing and
// unblurring as they reach their destinations. Three depth layers:
//
//   - foreground (4 pills): wide, crisp, large
//   - midground  (8 pills): medium width, light blur
//   - background (12 pills): small, heavy blur (perspective recede)
//
// Each pill rises from below + grows + unblurs over the cloud-fill
// window (first ~110 frames), staggered by `delay` so the screen
// progressively fills. The final `endDepth` controls how far back each
// pill stays at rest (0 = fully crisp foreground, 1 = stays blurred).
//
// Choreography (315 frames / 10.5s total):
//
//   0–110    CLOUD FILL  — 24 pills rise, grow, settle into depth layers
//   110–135  HOLD        — cloud at rest (~25 frames breathing room)
//   135–270  HERO        — one stakeholder-voice pill zooms toward camera
//   270–315  EXIT        — pills accelerate right at staggered moments
//                          (foreground leads, background trails) for parallax
//                          dynamism. Each pill has its own exitDelay + exitDur,
//                          but no pill's (delay + dur) exceeds the 45f window.

const SCENE4_CORE_FRAMES = 75; // 2.5s — cloud fill + hero approach (compressed from 270)
const SCENE4_EXIT_WINDOW = 30; // 1.0s — exit phase (compressed from 45)
const SCENE4_EXIT_START = SCENE4_CORE_FRAMES; // 75
const SCENE4_FRAMES = SCENE4_CORE_FRAMES + SCENE4_EXIT_WINDOW; // 105 — total scene length
const CLOUD_FILL_DURATION = 40;
const HERO_START = SCENE4_CORE_FRAMES / 2; // 135 — half of CORE, not FRAMES

const CLOUD_TEXTS = ["Cash flow is tight", "My team is burning out", "Sales pipeline is dry"] as const;
const CLOUD_TONES: PillTone[] = ["accent", "warm", "cool"];

type CloudPillData = {
  textIndex: 0 | 1 | 2;
  toneIndex: 0 | 1 | 2;
  width: number;
  finalX: number; // % of frame width (left edge)
  finalY: number; // % of frame height
  startY: number; // % — initial off-screen position (>100)
  delay: number;
  endDepth: number; // 0 = crisp foreground, 1 = stays blurred far away
  exitDelay: number; // frames after SCENE4_EXIT_START before this pill bolts
  exitDur: number;   // frames this pill takes to clear the frame
};

// Exit choreography: foreground pills lead the wave (early + fast),
// midground stagger through the middle, background trails (late +
// slower for parallax). Per-pill exitDelay+exitDur stays under
// SCENE4_EXIT_WINDOW (45f) so every pill clears the frame in time.
const CLOUD_PILLS_DATA: CloudPillData[] = [
  // Foreground (4 — large, crisp): exit first, fast (delay 0–6, dur ~28)
  { textIndex: 0, toneIndex: 0, width: 320, finalX: 22, finalY: 38, startY: 110, delay: 0,  endDepth: 0.0,  exitDelay: 0,  exitDur: 26 },
  { textIndex: 1, toneIndex: 1, width: 340, finalX: 55, finalY: 28, startY: 115, delay: 4,  endDepth: 0.05, exitDelay: 4,  exitDur: 28 },
  { textIndex: 2, toneIndex: 2, width: 280, finalX: 64, finalY: 60, startY: 108, delay: 8,  endDepth: 0.08, exitDelay: 2,  exitDur: 30 },
  { textIndex: 0, toneIndex: 1, width: 300, finalX: 30, finalY: 70, startY: 120, delay: 12, endDepth: 0.05, exitDelay: 6,  exitDur: 27 },

  // Midground (8 — medium, light blur): mid stagger (delay 8–18, dur ~32)
  { textIndex: 1, toneIndex: 0, width: 220, finalX: 6,  finalY: 18, startY: 105, delay: 2,  endDepth: 0.30, exitDelay: 8,  exitDur: 32 },
  { textIndex: 2, toneIndex: 1, width: 200, finalX: 78, finalY: 12, startY: 102, delay: 6,  endDepth: 0.35, exitDelay: 10, exitDur: 33 },
  { textIndex: 0, toneIndex: 2, width: 240, finalX: 8,  finalY: 50, startY: 110, delay: 10, endDepth: 0.30, exitDelay: 12, exitDur: 31 },
  { textIndex: 1, toneIndex: 2, width: 230, finalX: 80, finalY: 45, startY: 108, delay: 14, endDepth: 0.32, exitDelay: 9,  exitDur: 33 },
  { textIndex: 2, toneIndex: 0, width: 210, finalX: 42, finalY: 12, startY: 103, delay: 16, endDepth: 0.35, exitDelay: 14, exitDur: 30 },
  { textIndex: 0, toneIndex: 1, width: 220, finalX: 60, finalY: 80, startY: 112, delay: 18, endDepth: 0.30, exitDelay: 11, exitDur: 32 },
  { textIndex: 1, toneIndex: 2, width: 200, finalX: 12, finalY: 78, startY: 115, delay: 20, endDepth: 0.40, exitDelay: 16, exitDur: 29 },
  { textIndex: 2, toneIndex: 0, width: 230, finalX: 84, finalY: 75, startY: 110, delay: 22, endDepth: 0.38, exitDelay: 13, exitDur: 31 },

  // Background (12 — small, heavy blur): trail (delay 14–26, dur 19–28)
  // Constraint: exitDelay + exitDur <= 45 (the SCENE4_EXIT_WINDOW).
  { textIndex: 0, toneIndex: 0, width: 150, finalX: 4,  finalY: 5,  startY: 100, delay: 8,  endDepth: 0.70, exitDelay: 14, exitDur: 28 },
  { textIndex: 1, toneIndex: 1, width: 140, finalX: 92, finalY: 8,  startY: 98,  delay: 10, endDepth: 0.75, exitDelay: 18, exitDur: 25 },
  { textIndex: 2, toneIndex: 2, width: 160, finalX: 50, finalY: 4,  startY: 102, delay: 14, endDepth: 0.70, exitDelay: 16, exitDur: 27 },
  { textIndex: 0, toneIndex: 1, width: 130, finalX: 26, finalY: 88, startY: 110, delay: 18, endDepth: 0.78, exitDelay: 20, exitDur: 23 },
  { textIndex: 1, toneIndex: 2, width: 145, finalX: 68, finalY: 92, startY: 108, delay: 22, endDepth: 0.72, exitDelay: 15, exitDur: 28 },
  { textIndex: 2, toneIndex: 0, width: 150, finalX: 45, finalY: 90, startY: 105, delay: 26, endDepth: 0.75, exitDelay: 22, exitDur: 21 },
  { textIndex: 0, toneIndex: 2, width: 135, finalX: 6,  finalY: 32, startY: 100, delay: 28, endDepth: 0.78, exitDelay: 24, exitDur: 19 },
  { textIndex: 1, toneIndex: 0, width: 145, finalX: 90, finalY: 35, startY: 102, delay: 30, endDepth: 0.75, exitDelay: 17, exitDur: 26 },
  { textIndex: 2, toneIndex: 1, width: 130, finalX: 38, finalY: 22, startY: 100, delay: 32, endDepth: 0.80, exitDelay: 26, exitDur: 19 },
  { textIndex: 0, toneIndex: 0, width: 140, finalX: 74, finalY: 22, startY: 105, delay: 34, endDepth: 0.78, exitDelay: 19, exitDur: 25 },
  { textIndex: 1, toneIndex: 1, width: 160, finalX: 26, finalY: 60, startY: 110, delay: 36, endDepth: 0.70, exitDelay: 21, exitDur: 23 },
  { textIndex: 2, toneIndex: 2, width: 155, finalX: 70, finalY: 65, startY: 108, delay: 38, endDepth: 0.75, exitDelay: 23, exitDur: 22 },
];

const CloudPill: React.FC<CloudPillData> = ({
  textIndex,
  toneIndex,
  width,
  finalX,
  finalY,
  startY,
  delay,
  endDepth,
  exitDelay,
  exitDur,
}) => {
  const frame = useCurrentFrame();
  const local = Math.max(0, frame - delay);
  const animDur = Math.max(1, CLOUD_FILL_DURATION - delay);
  const t = Math.min(1, local / animDur);
  const eased = easeInOutCubic(t);

  const y = startY + (finalY - startY) * eased;
  const depth = 1 - (1 - endDepth) * eased; // 1 → endDepth
  const scale = 0.4 + (1 - depth) * 0.8; // small + far → larger + close
  const baseBlur = depth * 16;
  const opacity = interpolate(t, [0, 0.06, 1], [0, 1, 1], {
    extrapolateRight: "clamp",
  });

  // Exit phase: each pill bolts right at its own moment + speed. Foreground
  // leads with shorter delays + shorter durs (whip out fast); midground
  // staggers; background trails with later delays + tighter durs (less
  // perceived travel because they're already small/blurred).
  const exitLocal = Math.max(0, frame - SCENE4_EXIT_START - exitDelay);
  const exitT = Math.min(1, exitLocal / exitDur);
  const exitEased = exitT * exitT; // ease-in: accelerating
  const exitOffset = exitEased * 110;
  const exitBlur = exitEased * 8;

  return (
    <div
      style={{
        position: "absolute",
        left: `${finalX + exitOffset}%`,
        top: `${y}%`,
        transform: `scale(${scale})`,
        transformOrigin: "left top",
        filter: `blur(${baseBlur + exitBlur}px)`,
        opacity,
      }}
    >
      <PillBase
        width={width}
        tone={CLOUD_TONES[toneIndex]}
        text={CLOUD_TEXTS[textIndex]}
      />
    </div>
  );
};

// The hero pill — a stakeholder utterance that zooms toward the camera
// during the hero half of the scene, then accelerates right with the
// rest of the cloud during the exit transition.
const HeroPill: React.FC = () => {
  const frame = useCurrentFrame();

  // Don't render until the hero phase begins.
  if (frame < HERO_START) return null;

  // Approach phase: hero animates from far/blurred to close/crisp,
  // ending at frame SCENE4_CORE_FRAMES (270).
  const local = Math.max(0, frame - HERO_START);
  const animDur = Math.max(1, SCENE4_CORE_FRAMES - HERO_START);
  const t = Math.min(1, local / animDur);
  const eased = easeInOutCubic(t);

  const scale = 0.5 + eased * 2.9; // 0.5 (far) → 3.4 (close)
  const approachBlur = (1 - eased) * 14;
  const xApproach = 38 + eased * 12; // 38% → 50% (drifts toward centre)
  const opacity = interpolate(t, [0, 0.05, 1], [0, 1, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Exit phase: hero leaves last in the foreground wave — short delay to
  // hold its moment, then a sharp 28f bolt right (faster than midground,
  // matching its close-to-camera presence).
  const HERO_EXIT_DELAY = 12;
  const HERO_EXIT_DUR = 28;
  const exitLocal = Math.max(0, frame - SCENE4_EXIT_START - HERO_EXIT_DELAY);
  const exitT = Math.min(1, exitLocal / HERO_EXIT_DUR);
  const exitEased = exitT * exitT;
  const exitOffset = exitEased * 110;
  const exitBlur = exitEased * 8;

  return (
    <div
      style={{
        position: "absolute",
        left: `${xApproach + exitOffset}%`,
        top: "50%",
        transform: `translate(-50%, -50%) scale(${scale})`,
        transformOrigin: "center center",
        filter: `blur(${approachBlur + exitBlur}px)`,
        opacity,
        zIndex: 10,
      }}
    >
      <PillBase
        width={400}
        tone="accent"
        text="I need to improve my business..."
      />
    </div>
  );
};

const BusinessInputsCloud: React.FC = () => (
  <AbsoluteFill style={{ backgroundColor: colors.canvas, overflow: "hidden" }}>
    {CLOUD_PILLS_DATA.map((data, i) => (
      <CloudPill key={i} {...data} />
    ))}
    <HeroPill />
  </AbsoluteFill>
);

// ---------- scene 05: each input — typography + particle overlay ----------
//
// Particle layer overlays the 90-frame typography scene. Two phases:
//
//   0–60   READING       — sparse particles, mostly background (slow, heavy
//                          blur). Text remains the foreground attention.
//   60–90  TRANSITION    — particle density spikes (foreground + crisp +
//                          fast). Layer-level blur ramps up to bridge into
//                          the next scene with a kinetic + visual handoff.

type TransitionParticleData = {
  start: number; // frame this particle enters
  yPct: number; // vertical position (0–100%)
  size: number; // particle diameter in px
  blur: number; // per-particle depth blur
  speed: number; // travel duration in frames (lower = faster)
};

const INPUT_OVERLAY_PARTICLES: TransitionParticleData[] = [
  // Reading phase (0–50): sparse, mostly background — text-friendly
  { start: 0,  yPct: 15, size: 10, blur: 13, speed: 70 },
  { start: 8,  yPct: 80, size: 11, blur: 12, speed: 65 },
  { start: 16, yPct: 35, size: 9,  blur: 14, speed: 70 },
  { start: 22, yPct: 90, size: 12, blur: 12, speed: 60 },
  { start: 30, yPct: 8,  size: 10, blur: 13, speed: 65 },
  { start: 36, yPct: 60, size: 13, blur: 10, speed: 55 },
  { start: 42, yPct: 25, size: 11, blur: 12, speed: 60 },

  // Transition phase (50–85): density spikes, foreground takes over
  { start: 50, yPct: 50, size: 16, blur: 6, speed: 40 },
  { start: 54, yPct: 20, size: 18, blur: 5, speed: 38 },
  { start: 56, yPct: 75, size: 22, blur: 0, speed: 28 },
  { start: 58, yPct: 35, size: 16, blur: 6, speed: 38 },
  { start: 60, yPct: 65, size: 24, blur: 0, speed: 26 },
  { start: 62, yPct: 15, size: 18, blur: 5, speed: 36 },
  { start: 64, yPct: 50, size: 26, blur: 0, speed: 24 },
  { start: 66, yPct: 85, size: 20, blur: 4, speed: 32 },
  { start: 68, yPct: 25, size: 24, blur: 0, speed: 26 },
  { start: 70, yPct: 60, size: 28, blur: 0, speed: 22 },
  { start: 72, yPct: 40, size: 22, blur: 2, speed: 28 },
  { start: 74, yPct: 10, size: 26, blur: 0, speed: 24 },
  { start: 76, yPct: 75, size: 28, blur: 0, speed: 22 },
  { start: 78, yPct: 45, size: 30, blur: 0, speed: 20 },
  { start: 80, yPct: 30, size: 26, blur: 0, speed: 22 },
];

const TransitionParticle: React.FC<TransitionParticleData> = ({
  start,
  yPct,
  size,
  blur,
  speed,
}) => {
  const frame = useCurrentFrame();
  const local = frame - start;

  if (local < 0 || local > speed + 4) return null;

  const t = Math.max(0, Math.min(1, local / speed));
  const x = -5 + t * 115; // travel from -5% to 110%
  const opacity = interpolate(t, [0, 0.1, 0.9, 1], [0, 1, 1, 0]);

  return (
    <div
      style={{
        position: "absolute",
        left: `${x}%`,
        top: `${yPct}%`,
        filter: blur > 0 ? `blur(${blur}px)` : undefined,
        opacity,
      }}
    >
      <Particle size={size} />
    </div>
  );
};

// Hero particles — four large orbs at different depths streak left-to-right
// across the frame during the transition window, each with motion blur.
// They don't stop or grow; they just pass through. The depth variation
// (different sizes + blurs + Y positions) creates parallax dynamism.
//
// Each particle traverses from x=-30% to x=130% so they're fully off-frame
// at start and end of their lifetime — entries and exits never snap-cut.
type HeroParticleData = {
  start: number; // frame to spawn
  size: number; // pixel diameter (larger = closer to camera)
  yPct: number; // vertical position
  speed: number; // travel duration in frames (lower = faster)
  blur: number; // motion + depth blur combined
};

const HERO_PARTICLES: HeroParticleData[] = [
  // Closest, biggest, fastest — dominant foreground streak
  { start: 60, size: 1400, yPct: 55, speed: 30, blur: 8 },
  // Large midground
  { start: 65, size: 700, yPct: 25, speed: 26, blur: 5 },
  // Medium foreground (still big relative to streaming particles)
  { start: 70, size: 420, yPct: 75, speed: 24, blur: 4 },
  // Big background — heavily blurred (depth + motion)
  { start: 74, size: 250, yPct: 35, speed: 22, blur: 10 },
];

const HeroParticle: React.FC<HeroParticleData> = ({
  start,
  size,
  yPct,
  speed,
  blur,
}) => {
  const frame = useCurrentFrame();
  const local = frame - start;

  if (local < 0 || local > speed + 4) return null;

  const t = Math.max(0, Math.min(1, local / speed));
  const xPercent = -30 + t * 160; // off-left → off-right
  const opacity = interpolate(t, [0, 0.05, 0.95, 1], [0, 1, 1, 0]);

  return (
    <div
      style={{
        position: "absolute",
        left: `${xPercent}%`,
        top: `${yPct}%`,
        transform: "translate(-50%, -50%)",
        filter: `blur(${blur}px)`,
        opacity,
        zIndex: 5,
      }}
    >
      <Particle size={size} />
    </div>
  );
};

// Particle overlay for Each Input — transparent background so the
// typography below remains visible. Two layers nested so the layer blur
// only affects the streaming particles, not the hero.
const InputOverlay: React.FC = () => {
  const frame = useCurrentFrame();

  const layerBlur = interpolate(frame, [60, 90], [0, 8], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      {/* Streaming particles — layer blur ramps as the transition begins */}
      <AbsoluteFill
        style={{
          overflow: "hidden",
          filter: layerBlur > 0 ? `blur(${layerBlur}px)` : undefined,
        }}
      >
        {INPUT_OVERLAY_PARTICLES.map((p, i) => (
          <TransitionParticle key={i} {...p} />
        ))}
      </AbsoluteFill>
      {/* Hero particles — 4 large orbs streaking past at different depths */}
      {HERO_PARTICLES.map((p, i) => (
        <HeroParticle key={i} {...p} />
      ))}
    </AbsoluteFill>
  );
};

// ---------- entry point ----------

export const Act1Hook: React.FC = () => {
  // Seven sub-scenes wrapped in a named "Intro" group for the Studio sidebar.
  //   01 · Imagine Text              (typography)
  //   02 · Image Denoise Animation   (visual)
  //   03 · Instead of 4K             (typography)
  //   04 · Business Inputs Cloud     (visual — many pills, hero zoom)
  //   05 · Each Input                (typography + particle overlay sub-scene)
  //   06 · Models                    (two end-state slides, 12s total)
  //                                    06.1 labeled pills (6s)
  //                                    06.2 labeled cards (6s)
  //   07 · Kinn responds + Logo       (07.1 chat bubble + particles 2s,
  //                                    07.2 animated logo 8s — 10s total)
  // Scene 02 = entry + cycles 1+2 + cycle 3 (longer hold). Currently
  // 15 + 30*2 + 50 = 125 frames (~4.2s).
  const SCENE2_FRAMES = SCENE2_ENTRY_END + SCENE2_CYCLE_DUR * 2 + SCENE2_LAST_CYCLE_DUR;
  // Beat 03 ("But Instead of 4K → high-accuracy models") is overlaid on
  // top of the held cycle-3 image rather than playing as a separate
  // scene. The parent Sequence runs SCENE2_FRAMES + BEAT_FRAMES so the
  // ImageDenoiseLayout keeps painting through the overlay window.
  const SCENE2_TOTAL_FRAMES = SCENE2_FRAMES + BEAT_FRAMES;
  // Scene 06 = two back-to-back end-state slides (06.1 + 06.2). Each
  // holds for 6s (180f) so the eye has time to read header + 3 labels +
  // footer without rushing. 06.2 is internally split in half: 3s static
  // cards (06.2.1), then 3s lit-up cards with passing particles (06.2.2).
  // SCENE6_* sub-slot durations are defined at module scope (above)
  // so the 06.2 switching output can reference them.
  // Scene 07 = 07.1 only (chat bubble + fast multi-color particles, 2s).
  // 07.2 (animated logo) was lifted out to play at the very end of the
  // composition after Context — see ACT_TIMINGS.logo in KinnDemo.tsx.
  const SCENE7_FRAMES = SCENE71_FRAMES;

  const S1 = 0;
  const S2 = S1 + BEAT_FRAMES;
  // S4 starts where Scene 02's combined block ends (cycle 3 hold + Beat 03 overlay).
  const S4 = S2 + SCENE2_TOTAL_FRAMES;
  const S5 = S4 + SCENE4_FRAMES;
  const S6 = S5 + BEAT_FRAMES;
  const S7 = S6 + SCENE6_FRAMES;
  const INTRO_FRAMES = S7 + SCENE7_FRAMES;

  return (
    <AbsoluteFill style={{ backgroundColor: colors.canvas }}>
      <Sequence name="Intro" durationInFrames={INTRO_FRAMES}>
        <Sequence from={S1} durationInFrames={BEAT_FRAMES} name="01 · Imagine Text">
          <HookBeat pre="Imagine an image denoiser" highlight="— but for business." />
        </Sequence>
        <Sequence from={S2} durationInFrames={SCENE2_TOTAL_FRAMES} name="02 · Image Denoise Animation">
          {/* Held layout — paints continuously through cycles 1–3 and the
              Beat 03 overlay window. Cycle 3's box settles by frame ~123
              and the layout has no exit, so it just holds. */}
          <ImageDenoiseLayout />
          {/* Citable sub-scenes — pure timeline markers, no visual side-effects.
              Children are an empty span so Studio registers the Sequence. */}
          <Sequence from={0} durationInFrames={SCENE2_ENTRY_END} name="02.1 · Entry">
            <span />
          </Sequence>
          <Sequence
            from={SCENE2_ENTRY_END}
            durationInFrames={SCENE2_CYCLE_DUR}
            name="02.2 · Cycle 1 — pill 1 → image"
          >
            <span />
          </Sequence>
          <Sequence
            from={SCENE2_ENTRY_END + SCENE2_CYCLE_DUR}
            durationInFrames={SCENE2_CYCLE_DUR}
            name="02.3 · Cycle 2 — pill 2 → image"
          >
            <span />
          </Sequence>
          <Sequence
            from={SCENE2_ENTRY_END + SCENE2_CYCLE_DUR * 2}
            durationInFrames={SCENE2_LAST_CYCLE_DUR}
            name="02.4 · Cycle 3 — pill 3 → image"
          >
            <span />
          </Sequence>
          {/* 02.5 — persistent top-anchored title. Renders last so it
              z-stacks above the layout. Spans the full scene so the title
              is visible from frame 0 through to scene exit. */}
          <Sequence
            from={0}
            durationInFrames={SCENE2_TOTAL_FRAMES}
            name="02.5 · Instead of 4K (top title)"
          >
            <TopTitleBeat
              pre="But instead of 4K images, you get"
              highlight="high-accuracy models"
            />
          </Sequence>
        </Sequence>
        <Sequence from={S4} durationInFrames={SCENE4_FRAMES} name="04 · Business Inputs Cloud">
          <BusinessInputsCloud />
        </Sequence>
        <Sequence from={S5} durationInFrames={BEAT_FRAMES} name="05 · Each Input">
          {/* Base: typography */}
          <HookBeat
            pre="Each input signal as an image pass,"
            highlight="fit to any framework."
          />
          {/* Top layer: particle overlay (sub-scene of Each Input) */}
          <InputOverlay />
          {/* Citable phase markers — pure timeline labels */}
          <Sequence from={0} durationInFrames={60} name="05.1 · Reading">
            <span />
          </Sequence>
          <Sequence from={60} durationInFrames={30} name="05.2 · Particle Transition">
            <span />
          </Sequence>
        </Sequence>
        <Sequence from={S6} durationInFrames={SCENE6_FRAMES} name="06 · Models">
          <Sequence from={0} durationInFrames={SCENE6_SUBSCENE_PILLS} name="06.1 · Pills + Particles">
            {/* Behind layer: particles enter left, exit right in each
                pill's category color (yellow / blue / purple). Rendered
                first so the pill stack (and the pulse glow ring) paints
                on top — particles thread *behind* the pills. */}
            <Scene6ParticleOverlay />
            {/* Foreground: pulsing pill stack with header/footer.
                transparentBg lets the particles below show through; the
                Act1Hook parent already paints colors.canvas. */}
            <Denoiser
              outputOnly
              transparentBg
              durationInFrames={SCENE6_SUBSCENE_PILLS}
              textScale={1.4}
              output={<PulsingPillStack />}
              header="The model filters Emotions, Business Moment, and Facts"
              footer="Using each to Question better and keep the user Engaged"
            />
          </Sequence>
          {/* 06.2 — cards land static (06.2.1), then colored particles streak
              through and light up each card on impact (06.2.2). Single
              Denoiser instance with persistent header/footer; the output
              swaps from ModelRow → LitModelRow at the half-mark and the
              particle overlay only renders during the lit half. This keeps
              the framing language stable across the cut (no re-fade flash). */}
          <Sequence
            from={SCENE6_SUBSCENE_PILLS}
            durationInFrames={SCENE6_SUBSCENE_CARDS}
            name="06.2 · Cards"
          >
            <Scene62SwitchingOutput />
            {/* Citable phase markers — pure timeline labels, no visual side-effects. */}
            <Sequence from={0} durationInFrames={SCENE6_SUBSCENE_HALF} name="06.2.1 · Cards (static)">
              <span />
            </Sequence>
            <Sequence
              from={SCENE6_SUBSCENE_HALF}
              durationInFrames={SCENE6_SUBSCENE_LIT}
              name="06.2.2 · Cards + Particles"
            >
              <span />
            </Sequence>
          </Sequence>
        </Sequence>
        <Sequence from={S7} durationInFrames={SCENE7_FRAMES} name="07 · Kinn responds">
          <Sequence from={0} durationInFrames={SCENE71_FRAMES} name="07.1 · Kinn responds (bubble + particles)">
            {/* Behind: fast multi-color particles streaking through the
                bubble's vertical band. */}
            <Scene71ParticleOverlay />
            {/* Foreground: chat bubble that pulses on every impact. */}
            <PulsingChatBubble />
          </Sequence>
        </Sequence>
      </Sequence>
    </AbsoluteFill>
  );
};
