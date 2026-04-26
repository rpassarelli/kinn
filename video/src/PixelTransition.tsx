import { AbsoluteFill, useCurrentFrame } from "remotion";
import { colors } from "./theme";

// Pixelated wipe transition between sequences. A grid of canvas-colored
// squares cover the screen in a randomized stagger, then uncover in a
// different stagger to reveal the next scene. The randomization makes
// each transition feel like a "denoise" rather than a clean wipe — fits
// the show's blur/sharpening visual language.
//
// Usage: place a Sequence whose duration is TRANSITION_FRAMES centered
// on each cut (TRANSITION_FRAMES/2 frames before and after). The overlay
// renders on top of whichever sequence is showing through.

export const TRANSITION_FRAMES = 24; // 0.8s — quick enough not to drag

const COLS = 24;
const ROWS = 14; // ~80px squares on a 1920×1080 canvas

// Deterministic pseudo-random ordering for the cells. Each cell is
// assigned a number in [0,1) based on its index — the order in which
// it appears (cover phase) and disappears (uncover phase) is driven by
// these values. Using a hash rather than Math.random() so the order is
// stable across renders.
const cellOrder = (i: number, j: number): number => {
  const seed = (i * 73856093) ^ (j * 19349663);
  // mulberry32-style mix → number in [0,1)
  let t = (seed + 0x6D2B79F5) | 0;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

const HALF = TRANSITION_FRAMES / 2;

export const PixelTransition: React.FC = () => {
  const frame = useCurrentFrame();
  const isCoverPhase = frame < HALF;
  // 0 → 1 across the half-window we're in.
  const phaseT = isCoverPhase ? frame / HALF : (frame - HALF) / HALF;

  const cells: React.ReactNode[] = [];
  for (let i = 0; i < COLS; i++) {
    for (let j = 0; j < ROWS; j++) {
      const order = cellOrder(i, j); // 0..1
      // During cover: cells with low `order` appear first.
      //   visible when phaseT > order, plus a small stagger window so
      //   transitions don't snap on/off.
      // During uncover: same value but inverted (cells with high `order`
      //   stay visible longest, low `order` disappear first).
      let opacity: number;
      if (isCoverPhase) {
        // smoothstep over a 0.18-wide window centered at `order`
        const t = (phaseT - order) / 0.18 + 0.5;
        opacity = Math.max(0, Math.min(1, t));
      } else {
        const t = (phaseT - (1 - order)) / 0.18 + 0.5;
        opacity = Math.max(0, Math.min(1, 1 - t));
      }
      if (opacity <= 0) continue;
      cells.push(
        <div
          key={`${i}-${j}`}
          style={{
            position: "absolute",
            left: `${(i / COLS) * 100}%`,
            top: `${(j / ROWS) * 100}%`,
            width: `${100 / COLS}%`,
            height: `${100 / ROWS}%`,
            backgroundColor: colors.canvas,
            opacity,
          }}
        />
      );
    }
  }

  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      {cells}
    </AbsoluteFill>
  );
};
