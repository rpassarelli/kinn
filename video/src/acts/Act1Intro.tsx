import { AbsoluteFill, Sequence, interpolate, useCurrentFrame } from "remotion";
import { colors, fonts, space } from "../theme";

/**
 * 01 · LOOP — two text beats in the Hook "Imagine" style
 *
 *   Beat 1 (0:00–0:04)   The Challenge   →  Help managers manage their business with LMM
 *   Beat 2 (0:04–0:08)   The Solution    →  Translate my experience of 20+ years as consultant to a model
 *
 * Same character-emergence motion as Act1Hook's HookBeat (rise + blur +
 * scale, 1.5-frame stagger, ease-out-cubic). Local copy of the helper
 * so this scene can size its own duration independently of Hook's 90f
 * beat constant.
 */

const BEAT_FRAMES = 90; // 3 seconds at 30fps — Loop slot is 6s, two beats
const BEAT_FONT_SIZE = 72;

const beatLineStyle: React.CSSProperties = {
  fontFamily: fonts.display,
  fontSize: BEAT_FONT_SIZE,
  fontWeight: 400,
  letterSpacing: "-0.015em",
  lineHeight: 1.18,
};

const easeOutCubic = (t: number): number => 1 - Math.pow(1 - t, 3);

const LoopBeat: React.FC<{ pre: string; highlight: string }> = ({ pre, highlight }) => {
  const frame = useCurrentFrame();

  const preOpacity = interpolate(frame, [0, 12], [0, 1], { extrapolateRight: "clamp" });

  const TYPE_START = 12;
  const CHAR_STAGGER = 0.5;
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
            // text-wrap: balance evenly distributes characters across
            // wrap lines so long highlights (e.g. the Solution beat at
            // 62 chars) split into balanced halves rather than an
            // awkward last-word orphan.
            textWrap: "balance",
          }}
        >
          {highlight.split("").map((char, i) => {
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

export const Act1Intro: React.FC = () => {
  return (
    <AbsoluteFill style={{ backgroundColor: colors.canvas }}>
      <Sequence from={0} durationInFrames={BEAT_FRAMES} name="01.1 · The Challenge">
        <LoopBeat
          pre="The Challenge"
          highlight="Help managers manage their business with an LLM"
        />
      </Sequence>
      <Sequence from={BEAT_FRAMES} durationInFrames={BEAT_FRAMES} name="01.2 · The Solution">
        <LoopBeat
          pre="The Solution"
          highlight="Translate my experience of 20+ years as a consultant to a model"
        />
      </Sequence>
    </AbsoluteFill>
  );
};
