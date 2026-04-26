import { AbsoluteFill, Audio, Sequence, interpolate, staticFile } from "remotion";
import { Act1Hook, FINALE_FRAMES, HookFinale } from "./acts/Act1Hook";
import { Act1Intro } from "./acts/Act1Intro";
import { Act2Context } from "./acts/Act2Context";
import { PixelTransition, TRANSITION_FRAMES } from "./PixelTransition";

export const FPS = 30;
// Temporarily over the 180s submission ceiling — Scene 02 is 7.5s,
// Scene 04 is 10.5s (cloud 9s + 1.5s rightward exit transition), Scene
// 06 (Models) is 12s of two end-state slides (06.1 pills + 06.2 cards,
// 6s each), and Scene 07 added a 2s "Kinn responds" beat (07.1) before
// the logo intro (07.2). Particles overlay the Each Input scene rather
// than running as a standalone bridge. Budget will be reconciled by
// trimming other acts before final render.
export const DURATION_SECONDS = 178;

const s = (seconds: number) => Math.round(seconds * FPS);

// Single source of truth for the storyboard timings.
// Tweak here, every scene stays in sync.
//
// Hook (the "Intro" composition, 49s currently — 7 sub-scenes, Scenes
// 02/04 expanded, Scene 04 includes a 1.5s rightward exit transition,
// Scene 05 has a particle overlay handling its handoff into Models,
// Scene 06 is two end-state slides (06.1 pills + 06.2 cards, 12s total),
// Scene 07 splits "Kinn responds" (07.1, 2s) and the logo intro (07.2, 8s)).
// Composition keys remain `hook` and `intro`; the user-visible "Intro"
// name lives inside Act1Hook as a Sequence label.
//
// Downstream scenes shifted; budget will be reconciled before final.
export const ACT_TIMINGS = {
  intro:   { from: 0,        duration: s(6)    },     // 0:00 - 0:06      Two text beats: Challenge + Solution (3s each, fast-stagger)
  hook:    { from: s(6),     duration: s(30)   },     // 0:06 - 0:36      6 sub-scenes; Kinn responds (07.1) extended +1s for read time
  context: { from: s(36),    duration: 4080     },    // 0:36 - 2:52      Tagline + model A.mp4 @ 1.3125× (178.5s ÷ 1.3125 = 136.0s)
  logo:    { from: s(36) + 4080, duration: FINALE_FRAMES }, // 2:52 - 2:57.7  Animated kinn logo @ 1.4× (8s ÷ 1.4 = 5.7s)
} as const;

// Soundtrack levels — bed music underneath the show, fully absent
// during Context so model-a's narration plays clean.
const MUSIC_NOMINAL_VOL = 0.6;
const MUSIC_FADE_FRAMES = 30; // 1s at 30fps — fade-in, fade-out windows

const TOTAL_FRAMES =
  ACT_TIMINGS.logo.from + ACT_TIMINGS.logo.duration; // last frame of the show
const CONTEXT_START = ACT_TIMINGS.context.from;
const CONTEXT_END = ACT_TIMINGS.context.from + ACT_TIMINGS.context.duration;

// Pre-Context music: fade-in at the open, fade-out into Context. Local
// frame is 0..PRE_CONTEXT_FRAMES.
const PRE_CONTEXT_FRAMES = CONTEXT_START;
const preContextVolume = (frame: number): number => {
  // Fade-in
  if (frame < MUSIC_FADE_FRAMES) {
    return interpolate(frame, [0, MUSIC_FADE_FRAMES], [0, MUSIC_NOMINAL_VOL]);
  }
  // Fade-out at the tail (mute-in to Context boundary).
  if (frame >= PRE_CONTEXT_FRAMES - MUSIC_FADE_FRAMES) {
    return interpolate(
      frame,
      [PRE_CONTEXT_FRAMES - MUSIC_FADE_FRAMES, PRE_CONTEXT_FRAMES],
      [MUSIC_NOMINAL_VOL, 0],
      { extrapolateRight: "clamp" }
    );
  }
  return MUSIC_NOMINAL_VOL;
};

// Post-Context music: fade-in after Context ends, fade-out at end of
// show. Local frame is 0..POST_CONTEXT_FRAMES.
const POST_CONTEXT_FRAMES = TOTAL_FRAMES - CONTEXT_END;
const postContextVolume = (frame: number): number => {
  // Fade-in (mute-out from Context boundary into the Logo finale).
  if (frame < MUSIC_FADE_FRAMES) {
    return interpolate(frame, [0, MUSIC_FADE_FRAMES], [0, MUSIC_NOMINAL_VOL]);
  }
  // Fade-out across the last MUSIC_FADE_FRAMES frames of the show.
  if (frame >= POST_CONTEXT_FRAMES - MUSIC_FADE_FRAMES) {
    return interpolate(
      frame,
      [POST_CONTEXT_FRAMES - MUSIC_FADE_FRAMES, POST_CONTEXT_FRAMES],
      [MUSIC_NOMINAL_VOL, 0],
      { extrapolateRight: "clamp" }
    );
  }
  return MUSIC_NOMINAL_VOL;
};

export const KinnDemo: React.FC = () => {
  return (
    <AbsoluteFill style={{ backgroundColor: "#0a0a0a" }}>
      {/* Bed music — split into two Sequences bracketing Context so
          there's no audio rendered during model-a's narration. The two
          halves each fade in/out independently. Looped because the track
          (132s) is shorter than the pre-Context window (36s — no loop
          needed) and the post-Context window (5s — no loop needed); but
          loop kept on the pre half in case timings shift. */}
      <Sequence from={0} durationInFrames={PRE_CONTEXT_FRAMES} name="🎵 Music · pre-Context">
        <Audio
          src={staticFile("audio/feel-the-beat.mp3")}
          loop
          volume={preContextVolume}
        />
      </Sequence>
      <Sequence
        from={CONTEXT_END}
        durationInFrames={POST_CONTEXT_FRAMES}
        name="🎵 Music · post-Context"
      >
        <Audio
          src={staticFile("audio/feel-the-beat.mp3")}
          loop
          volume={postContextVolume}
        />
      </Sequence>
      <Sequence
        from={ACT_TIMINGS.intro.from}
        durationInFrames={ACT_TIMINGS.intro.duration}
        name="01 · Loop"
      >
        <Act1Intro />
      </Sequence>
      <Sequence
        from={ACT_TIMINGS.hook.from}
        durationInFrames={ACT_TIMINGS.hook.duration}
        name="02 · Hook"
      >
        <Act1Hook />
      </Sequence>
      <Sequence
        from={ACT_TIMINGS.context.from}
        durationInFrames={ACT_TIMINGS.context.duration}
        name="03 · Context"
      >
        <Act2Context />
      </Sequence>
      <Sequence
        from={ACT_TIMINGS.logo.from}
        durationInFrames={ACT_TIMINGS.logo.duration}
        name="04 · Logo"
      >
        <HookFinale />
      </Sequence>

      {/* Pixelated wipe transitions — centered on each scene cut. Rendered
          after the act Sequences so they z-stack on top during the cut. */}
      <Sequence
        from={ACT_TIMINGS.hook.from - TRANSITION_FRAMES / 2}
        durationInFrames={TRANSITION_FRAMES}
        name="↳ Loop → Hook"
      >
        <PixelTransition />
      </Sequence>
      <Sequence
        from={ACT_TIMINGS.context.from - TRANSITION_FRAMES / 2}
        durationInFrames={TRANSITION_FRAMES}
        name="↳ Hook → Context"
      >
        <PixelTransition />
      </Sequence>
      <Sequence
        from={ACT_TIMINGS.logo.from - TRANSITION_FRAMES / 2}
        durationInFrames={TRANSITION_FRAMES}
        name="↳ Context → Logo"
      >
        <PixelTransition />
      </Sequence>
    </AbsoluteFill>
  );
};
