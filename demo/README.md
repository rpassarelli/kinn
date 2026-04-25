# kinn3 demo

5-panel narrative UI for the "Built with Opus 4.7" hackathon submission.

## Layout

```
┌────────┬────────┬──────────────────────┐
│ 01     │ 02     │ 03                   │
│ Phone  │ Signal │ VSM (6 blocks)       │
│ chat   │ extract│                      │
├────────┴────────┼──────────────────────┤
│ 05              │ 04                   │
│ Questioner      │ Router / animation   │
│ + visual cues   │                      │
└─────────────────┴──────────────────────┘
```

Per-turn flow:
- 01 → 02 (signals extracted)
- 02 → 04 (signals routed)
- 04 → 03 (mutations applied, block lights up)
- 03 → 04 (lowest-coverage block becomes next objective)
- 04 → 05 (objective + algedonic visual cue)
- 05 → 01 (next question -> back into the chat)

## Stack

- Astro 5 (static, no SSR) — components per panel
- Plain CSS — Astro's `is:global` for cross-component styles
- TypeScript — animation choreography in one class
- Playwright — visual smoke tests + screenshots

## Run

```bash
npm install
npm run data    # rebuild src/data/session.json from a kinn3 session
npm run dev     # dev server on :4321
npm run build   # static build → dist/
npm run preview # serve dist/
```

## Test

```bash
npm run test:install  # one-time: install Chromium
npm test              # run visual smoke tests, write screenshots to tests/screenshots/
```

## Iterate

- **Edit a panel**: touch one `src/components/Panel0X*.astro` file. Style stays scoped (or `is:global` for cross-panel styles).
- **Edit choreography**: `src/scripts/animation.ts` — adjust `T` (timing) constants or `playTurn()` order.
- **Change which turns demo plays**: `DEMO_SEQ` in `animation.ts`.
- **Use a different session**: `npm run data -- ../calibration-runs/benchmark/family-manufacturing` (or any session dir).
