import { AbsoluteFill, Video, interpolate, staticFile, useCurrentFrame } from "remotion";
import { fonts, space, radii } from "../theme";

/**
 * ACT 3 — DEMO BODY
 *
 * Placeholder duration intentionally pinned to the full length of
 * model-b.mp4 (233.4s) — to be retrimmed before final render.
 *
 * AUDIO: voiceover — public/audio/act3-narration.mp3
 *
 * NARRATION beats (light, lets the UI breathe):
 *   "Turn 1. A stakeholder describes a twelve-year family dental clinic.
 *   kinn extracts three signals, mutates three VSM blocks. Listen to
 *   what it asks back."
 *   [QUESTION ON SCREEN — 2s pause]
 *
 *   "Turn 2. Deeper. The trust block lights up. The change-moment block
 *   lights up. kinn isn't asking better questions because it's smart —
 *   it's asking better questions because every probe is the one that
 *   learns the most."
 *
 *   [Speed-cut through turns 3, 7, 10]
 *
 *   "Five personas. Fifty turns. Sixty cents an interview."
 */
export const Act3DemoBody: React.FC = () => {
  const frame = useCurrentFrame();
  const fade = interpolate(frame, [0, 30], [0, 1], { extrapolateRight: "clamp" });

  return (
    <AbsoluteFill
      style={{
        backgroundColor: "#0a0a0a",
        alignItems: "center",
        justifyContent: "flex-start",
        opacity: fade,
        padding: space.s6,
        gap: space.s5,
      }}
    >
      {/* TODO: <Audio src={staticFile('audio/act3-narration.mp3')} /> */}
      <div
        style={{
          fontFamily: fonts.display,
          fontSize: 72,
          fontWeight: 400,
          letterSpacing: "-0.02em",
          lineHeight: 1.15,
          color: "#F5F5F5",
          textAlign: "center",
          maxWidth: 1600,
        }}
      >
        the demo,{" "}
        <span style={{ color: "#D4A373", fontStyle: "italic", fontWeight: 500 }}>
          live
        </span>
        .
      </div>
      <div
        style={{
          fontFamily: fonts.ui,
          fontSize: 13,
          fontWeight: 400,
          color: "#9A9A9F",
          letterSpacing: "0.16em",
          textTransform: "uppercase",
        }}
      >
        5 personas · 50 turns · $0.60 / interview
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
            boxShadow: "0 12px 48px rgba(0, 0, 0, 0.5)",
            overflow: "hidden",
            border: `1px solid rgba(255, 255, 255, 0.08)`,
          }}
        >
          <Video
            src={staticFile("video/model-b.mp4")}
            style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
          />
        </div>
      </div>
    </AbsoluteFill>
  );
};
