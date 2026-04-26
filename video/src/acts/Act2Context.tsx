import { AbsoluteFill, Video, interpolate, staticFile, useCurrentFrame } from "remotion";
import { colors, fonts, type, space, radii, shadows } from "../theme";

/**
 * ACT 2 — CONTEXT (0:29 – 1:05, 36s)
 *
 * Hook Beat 4 has already revealed the kinn wordmark, so Context drops
 * the wordmark and instead settles the metaphor with an editorial
 * tagline statement, leaving the closing wordmark for the final frame.
 *
 * AUDIO: voiceover — public/audio/act2-narration.mp3 (~36s, tightened)
 *
 * NARRATION (target ~36s):
 *   "Twenty years of consulting taught me what the diagnostic interview
 *   should be. This week I built it. Each turn, kinn samples how a
 *   stakeholder might answer each candidate question, predicts what
 *   each answer would teach the model, then asks the question that
 *   learns the most. Bayesian Experimental Design over a Viable
 *   Systems Model belief state. Twenty-two Opus 4.7 calls per turn,
 *   under prompt caching, six cents per turn."
 *
 * VISUAL: serif tagline on canvas. Last word "denoised" in accent
 *         italic for the only chromatic note in the scene.
 */
export const Act2Context: React.FC = () => {
  const frame = useCurrentFrame();
  const fade = interpolate(frame, [0, 30], [0, 1], { extrapolateRight: "clamp" });

  return (
    <AbsoluteFill
      style={{
        backgroundColor: colors.canvas,
        alignItems: "center",
        justifyContent: "flex-start",
        opacity: fade,
        padding: space.s6,
        gap: space.s5,
      }}
    >
      {/* TODO: <Audio src={staticFile('audio/act2-narration.mp3')} /> */}
      <div
        style={{
          fontFamily: fonts.display,
          fontSize: 72,
          fontWeight: 400,
          letterSpacing: "-0.02em",
          lineHeight: 1.15,
          color: colors.primaryText,
          textAlign: "center",
          maxWidth: 1600,
        }}
      >
        the diagnostic interview,{" "}
        <span style={{ color: colors.accent, fontStyle: "italic", fontWeight: 500 }}>
          denoised
        </span>
        .
      </div>
      <div style={type.caption}>
        Bayesian Experimental Design · Viable Systems Model · 22 calls / turn · $0.06
      </div>
      {/* 16:9 screen frame — matches composition aspect, fills remaining space */}
      <div
        style={{
          flex: 1,
          width: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          minHeight: 0,
        }}
      >
        <div
          style={{
            aspectRatio: "16 / 9",
            maxHeight: "100%",
            maxWidth: "100%",
            backgroundColor: "#000",
            borderRadius: radii.container,
            boxShadow: shadows.elevated,
            overflow: "hidden",
            border: `1px solid rgba(0, 0, 0, 0.08)`,
          }}
        >
          <Video
            src={staticFile("video/model-a.mp4")}
            style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
            playbackRate={1.3125}
          />
        </div>
      </div>
    </AbsoluteFill>
  );
};
