import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { colors, type, space } from "../theme";

/**
 * ACT 4 — CLOSING BEAT (2:25 – 3:00, 35s)
 *
 * AUDIO: voiceover — public/audio/act4-narration.mp3
 *
 * NARRATION (~30s + 5s end-card hold):
 *   "What you walk out with is this."
 *   [business.md appears on the interact surface]
 *
 *   "An SME hands it to any LLM and starts making decisions."
 *   [User types: 'Which block is most fragile right now? What should I
 *    do tomorrow?']
 *   [Claude streams a 2-sentence answer against the business.md]
 *
 *   "This is the first turn. Tomorrow: live data instead of one
 *   stakeholder. Any framework instead of just VSM. Outputs ranging
 *   from this markdown file all the way to enterprise simulations
 *   that train other models. kinn is what the next twenty years
 *   look like."
 *
 *   [End card: kinn wordmark + GitHub URL + tagline]
 *
 * VISUAL:
 *   0:00 – 0:25 — public/video/act4-interact.mp4 (interact surface
 *                  recording — business.md on left, live Claude chat on
 *                  right, both rendered in the design system below)
 *   0:25 – 0:35 — end card (this component as fallback / overlay)
 *
 * BUILD PREREQUISITE:
 *   The interact surface must exist before recording. Spec lives in
 *   docs/superpowers/specs/<date>-kinn-presentation.md § Section 3.
 *   Surface should adopt the same design system: canvas background,
 *   white surface for the business.md card, Newsreader for headings,
 *   Inter for chat UI, accent #D4A373 for the send button.
 */
export const Act4Closing: React.FC = () => {
  const frame = useCurrentFrame();
  const fade = interpolate(frame, [0, 24], [0, 1], { extrapolateRight: "clamp" });

  return (
    <AbsoluteFill
      style={{
        backgroundColor: colors.canvas,
        alignItems: "center",
        justifyContent: "center",
        opacity: fade,
      }}
    >
      {/* TODO: <Video src={staticFile('video/act4-interact.mp4')} /> */}
      {/* TODO: <Audio src={staticFile('audio/act4-narration.mp3')} /> */}
      <div style={{ textAlign: "center" }}>
        <div style={{ ...type.wordmark, color: colors.primaryText }}>kinn</div>
        <div style={{ ...type.caption, marginTop: space.s4 }}>
          the diagnostic interview, denoised
        </div>
        <div style={{ ...type.url, marginTop: space.s7 }}>
          github.com/&lt;username&gt;/kinn
        </div>
      </div>
    </AbsoluteFill>
  );
};
