# kinn demo

5-panel narrative UI for the "Built with Opus 4.7" hackathon submission.

## For hackathon judges — what you can run

You have **three** paths, depending on how much time you want to spend:

### Option 0 — zero install (recommended for judges)

**[https://kinn-demo.netlify.app](https://kinn-demo.netlify.app)** — opens the 5-panel narrative UI in your browser, plays the recorded dental-clinic session immediately. No clone, no install, no API key.

Deployed from this repo's `demo/` directory via Netlify (production deploy on every README update). Build pipeline: `astro build` produces a fully static `dist/`; Netlify serves it from CDN at `*.netlify.app`. To redeploy a new build: `cd demo && npm run build && netlify deploy --prod --dir=dist --site=kinn-demo`.

### A. 30-second playback (cloned, no API key needed)

Watch the recorded **dental-clinic** session animate through the full
5-panel UI. This uses a pre-recorded `session.json` shipped in the repo
— no LLM calls, no API key, no Python.

```bash
git clone https://github.com/rpassarelli/kinn.git
cd kinn/demo
npm install
npm run dev          # opens on http://localhost:4321
```

The animation loops through turns 1, 2, 3, 7, 10 of the dental-clinic
calibration run — same content the submission video is built around.

### B. 5-minute live run against the dental-clinic persona

Spin up the actual BED-LLM engine and have it interview a simulated
stakeholder driven by [`calibration/personas/dental-clinic.md`](../calibration/personas/dental-clinic.md). This
runs the real Opus 4.7 loop end-to-end (~10 turns, ~$1–2 of API usage).

Requirements: [`uv`](https://docs.astral.sh/uv/) installed and your
own `ANTHROPIC_API_KEY`.

```bash
cd <repo>/kinn3
uv sync --all-extras
cp .env.example .env
# edit .env: paste your key into ANTHROPIC_API_KEY
uv run python scripts/run_calibration.py --persona dental-clinic --turns 10
```

Output goes to `calibration-runs/latest/dental-clinic/`. To rebuild
the playback UI from your live run:

```bash
cd ../demo
npm run data -- ../calibration-runs/latest/dental-clinic
npm run dev
```

Other personas: `family-manufacturing`, `racks-reseller`,
`shinpads-ecommerce`, `solo-agency` (see
`calibration/personas/*.md`).

### What you cannot do

The demo UI is a *playback* of recorded sessions, not an interactive
chat. There's no input box wired to the engine. To get a fresh
conversation, use path B above and rebuild `session.json`.

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
