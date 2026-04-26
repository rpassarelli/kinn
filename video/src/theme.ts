/**
 * kinn design system — single source of truth for video composition.
 *
 * Principles
 * ----------
 *   1. Clarity over chrome — interface recedes, data and model are the heroes.
 *   2. Progressive disclosure — information unfolds as the viewer "zooms in."
 *   3. Tactile intelligence — depth, shadow, blur to distinguish noisy raw data
 *      from focused, denoised insights.
 *
 * The dark, monospace, electric Astro demo (Acts Intro + Demo body) is
 * intentionally NOT in this system — it's the engine view. Everything else
 * (Hook, Context, Closing, interact surface) lives here.
 */

import { loadFont as loadNewsreader } from "@remotion/google-fonts/Newsreader";
import { loadFont as loadInter } from "@remotion/google-fonts/Inter";

const { fontFamily: newsreaderFamily } = loadNewsreader("normal", {
  weights: ["400", "500", "600"],
});
const { fontFamily: interFamily } = loadInter("normal", {
  weights: ["400", "500", "600", "700"],
});

export const fonts = {
  display: `${newsreaderFamily}, Charter, Georgia, "Times New Roman", serif`,
  ui: `${interFamily}, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`,
} as const;

export const colors = {
  canvas: "#F9F9F8",        // warm off-white — base background
  surface: "#FFFFFF",        // pure white — elevated cards
  primaryText: "#1A1A1A",    // deep charcoal — soft on the eyes
  secondaryText: "#6E6E73",  // warm gray — metadata, noisy data
  accent: "#D4A373",         // muted clay/sand — primary actions, key insights
  systemBlue: "#0A84FF",     // interactive text, active UI states
} as const;

// 8pt grid
export const space = {
  s1: 8,
  s2: 16,
  s3: 24,
  s4: 32,
  s5: 48,
  s6: 64,
  s7: 96,
} as const;

// Squircle radii — continuous curves at the call site via SVG/CSS where needed
export const radii = {
  control: 8,    // buttons, inputs
  container: 16, // cards, modals, dashboards
} as const;

export const shadows = {
  card: "0 4px 24px rgba(0, 0, 0, 0.04)",
  elevated: "0 8px 40px rgba(0, 0, 0, 0.06)",
} as const;

// Type scale
export const type = {
  hookDisplay: { fontFamily: fonts.display, fontSize: 88, fontWeight: 400, letterSpacing: "-0.02em", lineHeight: 1.15 },
  wordmark:    { fontFamily: fonts.display, fontSize: 240, fontWeight: 500, letterSpacing: "-0.05em", lineHeight: 1 },
  h1Insight:   { fontFamily: fonts.display, fontSize: 32, fontWeight: 400, letterSpacing: "-0.01em", lineHeight: 1.25 },
  h2Section:   { fontFamily: fonts.ui,      fontSize: 20, fontWeight: 500, letterSpacing: "0.01em" },
  body:        { fontFamily: fonts.ui,      fontSize: 15, fontWeight: 400, lineHeight: 1.5 },
  caption:     { fontFamily: fonts.ui,      fontSize: 13, fontWeight: 400, color: colors.secondaryText, letterSpacing: "0.16em", textTransform: "uppercase" as const },
  url:         { fontFamily: fonts.ui,      fontSize: 18, fontWeight: 400, color: colors.secondaryText },
} as const;
