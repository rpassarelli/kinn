# kinn-video

Remotion composition for the kinn hackathon submission. 180-second demo,
mapped to a four-act storyboard. All act timings live in
`src/KinnDemo.tsx` (`ACT_TIMINGS`).

## Quickstart

```bash
npm install
npm run studio   # opens Remotion Studio at http://localhost:3000
npm run build    # renders out/kinn.mp4
```

## Storyboard

| Scene | Time | File | Audio | Video |
|---|---|---|---|---|
| Intro | 0:00 – 0:23 | `src/acts/Act1Hook.tsx` | silence | 6 sub-scenes: text / anim / text / anim / text / logo (8s) |
| Loop | 0:23 – 0:31 | `src/acts/Act1Intro.tsx` | silence | Astro demo Turn 1, BED-LLM loop |
| Context | 0:31 – 1:05 | `src/acts/Act2Context.tsx` | narration (~34s) | serif tagline + key facts |
| Demo body | 1:05 – 2:25 | `src/acts/Act3DemoBody.tsx` | narration (~80s) | Astro demo DEMO_SEQ |
| Closing | 2:25 – 3:00 | `src/acts/Act4Closing.tsx` | narration (~25s) | interact surface + end card |

The Hook is composed of four 3-second sub-sequences — each beat fades a
setup phrase in, then types the highlighted phrase letter-by-letter in
the brand accent. Beat 4 reveals the kinn wordmark.

Each scene file contains the narration verbatim and the asset spec inline.

## Design system

Tokens, fonts, and type scale live in `src/theme.ts`. Three principles:

1. **Clarity over chrome** — the interface recedes; data and model are heroes.
2. **Progressive disclosure** — information unfolds as the viewer zooms in.
3. **Tactile intelligence** — depth, shadow, blur distinguish raw from denoised.

| Token | Value | Where |
|---|---|---|
| Canvas | `#F9F9F8` | Hook, Context, Closing backgrounds |
| Surface | `#FFFFFF` | Cards (interact surface) |
| Primary text | `#1A1A1A` | Headings, body |
| Secondary text | `#6E6E73` | Captions, metadata |
| Accent | `#D4A373` | Primary actions, key insights |
| Display | Newsreader (serif) | Hook line, wordmark |
| UI | Inter (sans) | Captions, body, chat |

The dark, monospace **Astro demo** (Intro + Demo body) is intentionally
outside this system — it's the engine view. The contrast is the
point: the wrapper is the calm consulting product, the demo body
is the powerful machine inside.

## Assets to record

| File | Length | Source |
|---|---|---|
| `public/video/hook-denoiser.mp4` *(optional)* | 8s | Hook concept A asset |
| `public/video/intro-loop.mp4` | 7s native / 17s slowed | Astro demo Turn 1, no audio |
| `public/audio/act2-narration.mp3` | ~40s | Voiceover, Context lines |
| `public/video/act3-demobody.mp4` | 80s | Astro demo DEMO_SEQ |
| `public/audio/act3-narration.mp3` | ~80s | Voiceover, Demo body lines |
| `public/video/act4-interact.mp4` | ~25s | business.md + Claude chat |
| `public/audio/act4-narration.mp3` | ~25s | Voiceover, Closing lines |

## Recording the Astro demo

The 5-panel demo lives in `../demo/`. Run it on `:4321`, then capture
either via Playwright (already a dep in `../demo/`) or OBS.
