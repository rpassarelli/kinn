/**
 * Monochrome filled SVG icon set. Use `currentColor` so any container's
 * text color drives the icon's fill.
 *
 * Conventions:
 *   - viewBox 0 0 24 24
 *   - fill="currentColor"
 *   - sized by parent via width/height on the inline <svg>
 *
 * Two icon families:
 *   - PANEL_ICONS: headers for the 5 panels + objective + router core
 *   - BLOCK_ICONS: per-VSM-block (1..6)
 */

const I = (path: string, extra = "") =>
  `<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">${extra}${path}</svg>`;

export const PANEL_ICONS: Record<string, string> = {
  // 01 — chat bubble (rounded square + tail)
  chat: I(`<path d="M4 3h16a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2h-7l-4 4v-4H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2zm3 6a1 1 0 1 0 0 2 1 1 0 0 0 0-2zm5 0a1 1 0 1 0 0 2 1 1 0 0 0 0-2zm5 0a1 1 0 1 0 0 2 1 1 0 0 0 0-2z"/>`),

  // 02 — signal / radio waves (concentric arcs + dot)
  signal: I(`<path d="M12 14a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM7.05 11.05A6.97 6.97 0 0 1 12 9c1.93 0 3.68.78 4.95 2.05l-1.41 1.41A4.99 4.99 0 0 0 12 11c-1.38 0-2.63.56-3.54 1.46l-1.41-1.41zM4.22 8.22A10.97 10.97 0 0 1 12 5c3.04 0 5.79 1.23 7.78 3.22l-1.41 1.41A8.96 8.96 0 0 0 12 7c-2.49 0-4.74 1.01-6.37 2.63L4.22 8.22z"/>`),

  // 03 — grid 2x3 (the VSM matrix as an icon)
  grid: I(`<path d="M3 4h6v6H3V4zm0 10h6v6H3v-6zm8-10h6v6h-6V4zm0 10h6v6h-6v-6z"/><rect x="19" y="4" width="2" height="6" rx="1"/><rect x="19" y="14" width="2" height="6" rx="1"/>`),

  // 04 — solid cog (gear)
  cog: I(`<path d="M12 8a4 4 0 1 1 0 8 4 4 0 0 1 0-8zm9.4 3l-2-.4-.5-1.2 1.2-1.6a.5.5 0 0 0 0-.7l-1.5-1.5a.5.5 0 0 0-.7 0L16.3 7l-1.2-.5-.4-2a.5.5 0 0 0-.5-.4h-2.4a.5.5 0 0 0-.5.4l-.4 2-1.2.5-1.6-1.2a.5.5 0 0 0-.7 0L5.9 7.3a.5.5 0 0 0 0 .7L7.1 9.6 6.6 10.8l-2 .4a.5.5 0 0 0-.4.5v2.4c0 .25.18.46.4.5l2 .4.5 1.2-1.2 1.6a.5.5 0 0 0 0 .7l1.5 1.5c.2.2.5.2.7 0L9.7 17l1.2.5.4 2c.04.22.25.4.5.4h2.4c.25 0 .46-.18.5-.4l.4-2 1.2-.5 1.6 1.2c.2.2.5.2.7 0l1.5-1.5a.5.5 0 0 0 0-.7L18.9 14.4l.5-1.2 2-.4a.5.5 0 0 0 .4-.5V11.5a.5.5 0 0 0-.4-.5z"/>`),

  // 05 — solid circle with ? cutout
  question: I(`<path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm.05 14.5a1.2 1.2 0 1 1 0 2.4 1.2 1.2 0 0 1 0-2.4zm-1.5-3.4c0-1 .35-1.4 1.45-2.1.7-.45 1-.85 1-1.5 0-.85-.55-1.4-1.4-1.4-.85 0-1.4.5-1.55 1.4l-1.85-.3c.15-1.7 1.5-2.85 3.4-2.85 1.95 0 3.35 1.05 3.35 2.95 0 1.2-.5 1.95-1.6 2.65-.85.55-1.05.85-1.05 1.55v.4h-1.75v-.8z"/>`),

  // arrow pointing right — used in the next-objective chip
  target: I(`<path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm0 4a6 6 0 1 1 0 12 6 6 0 0 1 0-12zm0 3.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5z"/>`),
};

export const BLOCK_ICONS: Record<number, string> = {
  // 1 Market — target (concentric circles)
  1: I(`<path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm0 4a6 6 0 1 1 0 12 6 6 0 0 1 0-12zm0 3.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5z"/>`),

  // 2 Purpose — compass (rotated diamond inside circle)
  2: I(`<path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm3.5 5L13 13l-6.5 2.5L9 9l6.5-2z" /><circle cx="12" cy="12" r="1.4"/>`),

  // 3 Change — bold lightning bolt
  3: I(`<path d="M13 2L4 14h6l-1 8 9-12h-6l1-8z"/>`),

  // 4 Algedonic — solid alert triangle with dot
  4: I(`<path d="M12 2.5L1.5 21h21L12 2.5zm0 6.5a1.2 1.2 0 0 1 1.2 1.2v4.6a1.2 1.2 0 0 1-2.4 0v-4.6A1.2 1.2 0 0 1 12 9zm0 9.5a1.3 1.3 0 1 1 0-2.6 1.3 1.3 0 0 1 0 2.6z"/>`),

  // 5 Coherence — stacked layers (3 rectangles)
  5: I(`<path d="M12 2L2 7l10 5 10-5-10-5zm-7.7 8.3L2 11l10 5 10-5-2.3-.7L12 13.4 4.3 10.3zm0 4L2 15l10 5 10-5-2.3-.7L12 17.4 4.3 14.3z"/>`),

  // 6 Operations — solid cog (smaller variant matches header cog)
  6: I(`<path d="M12 8a4 4 0 1 1 0 8 4 4 0 0 1 0-8zm9.4 3l-2-.4-.5-1.2 1.2-1.6a.5.5 0 0 0 0-.7l-1.5-1.5a.5.5 0 0 0-.7 0L16.3 7l-1.2-.5-.4-2a.5.5 0 0 0-.5-.4h-2.4a.5.5 0 0 0-.5.4l-.4 2-1.2.5-1.6-1.2a.5.5 0 0 0-.7 0L5.9 7.3a.5.5 0 0 0 0 .7L7.1 9.6 6.6 10.8l-2 .4a.5.5 0 0 0-.4.5v2.4c0 .25.18.46.4.5l2 .4.5 1.2-1.2 1.6a.5.5 0 0 0 0 .7l1.5 1.5c.2.2.5.2.7 0L9.7 17l1.2.5.4 2c.04.22.25.4.5.4h2.4c.25 0 .46-.18.5-.4l.4-2 1.2-.5 1.6 1.2c.2.2.5.2.7 0l1.5-1.5a.5.5 0 0 0 0-.7L18.9 14.4l.5-1.2 2-.4a.5.5 0 0 0 .4-.5V11.5a.5.5 0 0 0-.4-.5z"/>`),
};
