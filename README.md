# kinn — a Bayesian diagnostic interview engine

> **Built with Opus 4.7 hackathon submission · Apr 21–28, 2026**
> Authored entirely within the hackathon window. Earliest commit on the kinn lineage: `b81880a` at **2026-04-22 10:16 +0100** (24 hours after the hackathon opened). The published repo's earliest commit is `32feb49` at **2026-04-25 01:06 +0100**. Full git history is the start-date proof. **Solo human author: Rodrigo Passarelli.** Claude Opus 4.7 used as AI assistant throughout (`Co-Authored-By` in commits — that's the whole point of this hackathon).

> **Naming.** The internal Python package is `kinn3` because this is the third hackathon-week iteration: kinn → kinn2 → kinn3, all built within the Apr 21–28 window. The "3" is iteration depth, not "version 3 of pre-existing software." See [Iteration story](#iteration-story).

**The problem.** Every consultant, founder, and product team starts client work the same way: a fuzzy 60-minute discovery call where they ask whatever comes to mind, write notes, and hope the gaps surface later. The expensive failure mode is asking the wrong next question — the one that locks in a wrong assumption. Real diagnostic interviewing is a skill that takes years; most people never get it.

**What kinn is.** A real-time interviewing engine that, after every answer, computes the **Expected Information Gain (EIG)** of every candidate next question against a Bayesian belief over the stakeholder's actual situation — and asks the one that reduces uncertainty the most. The frame is **BED-LLM** (Bayesian Experimental Design with LLM samplers): Opus 4.7 acts as both the *answer-distribution sampler* (predicting how a stakeholder might respond) and the *belief updater* (revising priors after each real answer). DSPy/GEPA compiles the prompts offline against simulated personas; runtime is a forced-tool-call loop on Anthropic's API with prompt caching.

## TL;DR for judges

| Criterion (weight) | Where to look |
|---|---|
| **Impact (30%)** | [Impact](#impact-30) — diagnostic interviewing is a billion-dollar consulting bottleneck; this collapses it from weeks of post-call synthesis to a single live session. |
| **Demo (25%)** | [`./demo`](./demo) — Astro 5 + GSAP narrative UI. Run `npm run dev` (no API key needed; plays a recorded session). 3-min video: see [SUBMISSION.md](./SUBMISSION.md). |
| **Opus 4.7 Use (25%)** | [Opus 4.7 Use](#opus-47-use-25) — forced-tool-call structured output, prompt caching for system-prompt + persona + history, two-phase recompile during long sessions, dual-algedonic state separation. Not a wrapper — Opus 4.7 IS the inference engine for both the answer sampler and the belief updater. |
| **Depth & Execution (20%)** | [Depth](#depth--execution-20) — 24 test files, dual-gate benchmark vs kinn2 baseline (mean 0.852 vs 0.920 — fail honestly recorded in [`RETROSPECTIVE.md`](./RETROSPECTIVE.md)), GEPA compilation pipeline, 5 calibration personas, retry policy with `OverloadedError` handling. |

## Quick start (30 seconds, no API key)

```bash
git clone https://github.com/rpassarelli/kinn.git
cd kinn/demo
npm install
npm run dev          # http://localhost:4321
```

Plays a recorded **dental-clinic** session through the 5-panel narrative UI.

## Run it live (5 minutes, your API key)

```bash
cd kinn
uv sync --all-extras
cp .env.example .env       # paste ANTHROPIC_API_KEY
uv run python scripts/run_calibration.py --persona dental-clinic --turns 10
```

Output goes to `calibration-runs/latest/dental-clinic/`. To rebuild the demo UI from your live run:

```bash
cd demo
npm run data -- ../calibration-runs/latest/dental-clinic
npm run dev
```

## Repository tour

| Path | What it is |
|---|---|
| [`src/kinn3/`](./src/kinn3/) | Engine: BED-LLM core, Bayesian belief, EIG selection, agent loop, Anthropic client, prompt cache. |
| [`tests/`](./tests/) | 24 test files including live API tests, cache-hit verification, concurrent-recompile contracts, order-of-operations gates. |
| [`scripts/`](./scripts/) | CLI entrypoints: `run_calibration.py`, `compile_dspy.py`, `benchmark_vs_kinn2.py`, `preflight.py`. |
| [`demo/`](./demo/) | Astro 5 + GSAP demo UI. 5-panel narrative: phone → signals → VSM → router → questioner. |
| [`video/`](./video/) | Remotion 4 source for the 3-min submission video. |
| [`calibration-runs/kinn2-baseline/`](./calibration-runs/kinn2-baseline/) | Frozen baseline scores from the predecessor iteration, used by `benchmark_vs_kinn2.py`. |
| [`ARCHITECTURE.md`](./ARCHITECTURE.md) | Full architecture write-up. |
| [`RETROSPECTIVE.md`](./RETROSPECTIVE.md) | Honest postmortem — including the gate that FAILED (mean 0.852 vs 0.920 target). |
| [`SUBMISSION.md`](./SUBMISSION.md) | 100–200 word submission summary + video link. |

## Iteration story

This submission is the **third iteration** of the same idea, all built within the Apr 21–28 hackathon week:

| Iteration | Started | What it was |
|---|---|---|
| **kinn** | 2026-04-22 10:16 | Denoise loop with managed agents, web UI in Astro, role-play harness. *24 hours after the hackathon opened.* |
| **kinn2** | 2026-04-24 18:13 | Compiler/runtime split — Opus batch compiler + Haiku runtime executor, calibration harness with 5 personas, 11 invariants. |
| **kinn3** *(this repo)* | 2026-04-25 01:06 | BED-LLM rewrite — Bayesian belief, EIG-based probe selection, DSPy/GEPA prompt compilation, dual-gate benchmark. |

The "3" is iteration depth within a single hackathon week, not a v3 of pre-existing software. Every line of code in every iteration was authored after the hackathon opened. The Python package is named `kinn3` because we don't rewrite the package name on iteration; renaming `src/kinn3/` to `src/kinn/` would have eaten an hour of test-fixture migration with zero feature gain.

## Author

**Sole human author: Rodrigo Passarelli.** Solo build (team size 1, well within the hackathon's max-2 limit).

**Co-author: Claude Opus 4.7** — used as the AI assistant throughout (this hackathon's whole premise is "Built with Opus 4.7"). Claude appears as `Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>` on the commits where it contributed substantially.

**Author identity note.** Some early commits are authored as `kinn2 <kinn2@local>` — that's Rodrigo's sandboxed dev-environment git identity, same human, different shell config. All subsequent commits use `Rodrigo Passarelli <rpassarelli@users.noreply.github.com>`.

## Impact (30%)

The diagnostic-interview problem is everywhere — discovery calls, doctor intakes, due diligence, sales qualification, intake triage in healthcare and law. The expensive failure isn't a bad answer; it's a bad **next question**, because the wrong next question makes the rest of the call useless. Today the only fix is "hire someone with 15 years of experience." kinn makes the EIG-optimal next question available to anyone with an API key — a fractional senior consultant, in a single live session, every time. The demo runs the engine against a `dental-clinic` persona because it's the most boring possible business — proving the loop works on a small SMB intake, not just a Fortune-500 use case.

## Opus 4.7 Use (25%)

Opus 4.7 isn't a feature — it's the inference engine for **both** sides of the BED-LLM loop:

1. **Answer-distribution sampler** — given the running belief and a candidate question, Opus samples plausible stakeholder responses. This is what makes EIG computable: without an answer distribution there is no information gain to estimate.
2. **Belief updater** — after every real answer, Opus refines the posterior over the stakeholder's actual situation, surfacing what's now more vs. less likely.

Specific Opus 4.7 capabilities exercised:

- **Forced tool calls** for structured output (`emit_turn_response`) — no thinking, validation raises on schema violation.
- **Prompt caching** of the system prompt + persona + transcript prefix — verified by live test ([`tests/test_client_live.py`](./tests/test_client_live.py)) measuring cache-hit latency on calls 2–3.
- **Two-phase recompile** — when the running belief diverges, a background recompile rebuilds the prompt while the foreground keeps interviewing; `drain()` joins the in-flight rebuild before the next turn.
- **Dual-algedonic state separation** — stakeholder fatigue is tracked separately from the diagnostic blocks, so the engine can bridge or close gracefully (synthesis at all-blocks-high; bridge on validation exhaustion; reground on stakeholder fatigue).
- **Question-hash dedup with retry-on-duplicate** — if Opus regenerates a previously-asked question, the agent retries until the question hash is novel.

## Depth & Execution (20%)

- **24 test files** including live-API tests, cache-hit verification, concurrent-recompile contracts, order-of-operations gates.
- **5 calibration personas** (dental-clinic, shinpads-ecommerce, family-manufacturing, solo-agency, racks-reseller) — see persona specs that ship as fixtures.
- **Dual-gate benchmark** — every change is scored against the frozen kinn2 baseline (mean=0.9203 across 5 personas). The current kinn3 mean is **0.852** — a measurable regression. We document this in [`RETROSPECTIVE.md`](./RETROSPECTIVE.md) rather than ship a hidden failure.
- **GEPA compilation** — DSPy signatures + custom metric, compiled offline via `scripts/compile_dspy.py`.
- **Retry policy** — handles `OverloadedError (529)` after a real GEPA failure during the build; covered by test.

## Honest limitations

- The dual-gate benchmark FAILS at this submission point: mean is 0.852 vs the 0.920 target inherited from the kinn2 baseline. The retrospective explains why and what would close the gap. We chose to ship the honest result, not a cherry-picked one.
- Demo UI animates a recorded session by default. Live runs work but cost ~$1–2 of API per persona at 10 turns.
- ~24-hour build window for kinn3 — there are corners that would benefit from a second pass (composition of the recompile path, denser test coverage on the synthesis branch).

## Licenses, assets & authorship

**Project license.** This repo is released under the [MIT License](./LICENSE) — every file authored for this submission.

**Dependencies (all OSS-compatible):**

| Dependency | License | Notes |
|---|---|---|
| `anthropic` (Python SDK) | MIT | Standard Anthropic Python SDK |
| `dspy-ai` | MIT | DSPy framework + GEPA optimizer |
| `pydantic`, `numpy`, `pyyaml`, `python-dotenv` | MIT / BSD | Standard Python deps |
| `sentence-transformers` | Apache-2.0 | Used by the judge for similarity scoring |
| `astro` | MIT | Demo UI framework |
| `gsap` | **GreenSock Standard "no-charge" license** ([link](https://gsap.com/standard-license)) | **Disclosure**: GSAP went free-to-use in 2024 after Webflow's acquisition. The license is permissive (no charge for any use, including commercial), but it is *not* on the OSI-approved list. We use GSAP only as a runtime animation library in the demo; the kinn source code itself ships under MIT. |
| `@playwright/test` | Apache-2.0 | Demo UI testing |
| `remotion`, `@remotion/cli` | Mostly MIT (no commercial restrictions for solo / ≤3-seat use) | Used to render the submission video |
| `@remotion/google-fonts` (Newsreader, Inter) | SIL OFL 1.1 / Apache-2.0 | Both fonts are open-source via Google Fonts |

**Video assets.** All video segments (`video/public/video/kinn-logo-intro.mp4`, `model-a.mp4`, `model-b.mp4`) are **original recordings authored by Rodrigo Passarelli** for this submission. No stock footage, no third-party content.

**Methodology references.** The system uses concepts from the **Viable System Model** (Stafford Beer, 1972) and the **APQC Cross-Industry Process Classification Framework** as interpretive lenses. Both are referenced as concepts (frameworks, not copyrighted code); the implementation files are paraphrased compressions with explicit attribution. APQC PCF is freely licensed for use.

**No banned dependencies.** Verified absence of `axios` per workspace policy (March 2026 supply-chain RAT incident). All HTTP uses native `fetch` or the Anthropic SDK.

---

License: [MIT](./LICENSE) · Repo: [github.com/rpassarelli/kinn](https://github.com/rpassarelli/kinn)
