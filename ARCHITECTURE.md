# kinn3 Architecture

kinn3 is a single-agent rewrite of the kinn2.1 diagnostic interview engine.
It removes the orchestrator + Haiku/Opus split, the 10-file protocol, and the
five hand-tuned gates, and replaces them with one Opus 4.7 agent driven by
Bayesian Experimental Design (BED-LLM) probe selection over an explicit VSM
belief state.

## Topology

One `KinnAgent` (single Opus 4.7 instance) talks to a `KinnClient` that wraps
`AsyncAnthropic`. Persistent state is held by a `LocalMemory` adapter that
satisfies the `MemoryAdapter` protocol — durable JSON in
`sessions/<name>/memory/` plus an append-only event log and cost ledger.

The agent uses **two LLM call shapes** (no other shapes exist):

1. `forced_tool_call` — `tool_choice` forced, **no extended thinking**.
   Sub-second target. Used on the per-turn user-visible path
   (`emit_turn_response`, `propose_answers`, `propose_mutations`,
   `propose_probe_slate`).
2. `thinking_text_call` — extended thinking on, **no tools**, returns text.
   Used only by Phase 1 of `recompile_probes_two_phase` (probe planner).

Why the split: Anthropic rejects `tool_choice=tool` together with
`thinking={...}`. Two-phase recompile gives us deep reasoning *and*
structured emission without touching that incompatibility.

## Per-turn flow (`KinnAgent.turn`)

1. Load `belief_state` and `probes` from memory.
2. If no probes are pending: drain in-flight background recompiles, then
   sync-recompile.
3. **BED-LLM probe selection** — for each pending probe, sample N hypothetical
   stakeholder answers, predict the resulting signal mutations, and score the
   probe by expected information gain (EIG) over the VSM belief. Pick argmax.
   See arXiv:2508.21184.
4. `client.run_turn_tool` (forced `emit_turn_response`). On
   `pydantic.ValidationError` retry up to 2× with a corrective hint
   (exactly-one-`?`, ≤30 words rules).
5. Apply `signal_mutations` to belief; bump `turn`.
6. Mark probe answered.
7. Persist `belief_state`, `probes`, append `transcript`.
8. Every 3 turns: schedule async recompile (tracked, drainable).
9. Record per-turn metrics (tokens / cost / wall clock) to `costs.jsonl`.

`drain()` awaits any in-flight background task; CLI calls it before exit.

## What was removed vs kinn2.1

| kinn2.1 | kinn3 | Why |
|---|---|---|
| Orchestrator LLM | gone | The agent picks its own probes via EIG; no second model needed. |
| Haiku/Opus split (Haiku denoise, Opus question) | one Opus 4.7 | Tool calls are cheap with prompt caching; the simulator still uses Haiku since it's off the user-visible path. |
| 10-file `state/` protocol | `LocalMemory` keys | Smaller, typed, easy to inspect. |
| 5 hand-tuned gates | dual gate (dental ≥ 0.903; mean ≥ kinn2.1 mean) | Forced into a single, externally-recorded baseline. |

## Memory keys (`LocalMemory`)

| Key | Type | Written by |
|---|---|---|
| `belief_state` | JSON `VSMBeliefState` | per turn (after mutations) |
| `probes` | JSON `list[Probe]` | per turn + recompile |
| `next_probe_order` | int (string) | recompile (atomic R-M-W) |
| `transcript` | append text | per turn |
| `question_hashes` | JSON set | invariants check (Phase 11) |
| `stakeholder_state` | JSON | simulator (calibration only) |
| `events.jsonl` | JSONL | session event log |
| `costs.jsonl` | JSONL | per-call cost ledger |

## Cost / latency budget

- **Per turn**: roughly $0.005 with prompt caching warm
  (system prompt is wrapped in a `cache_control: ephemeral` block).
- **Recompile**: ~30s, fired in the background every 3 turns;
  `drain()` blocks on exit so nothing escapes the session boundary.
- Pricing is centralised in `metrics._PRICING` (Opus 4.7: $15/$1.5/$18.75/$75
  per 1M input/cache-read/cache-write/output tokens).

## How to run

```bash
# Preflight (one-shot, verifies API + thinking + cache work)
cd /root/kinn2/kinn3
uv run pytest -k "live" -q                  # 2 live tests

# Calibration on one persona
uv run python scripts/run_calibration.py --persona dental-clinic --turns 10

# Dual-gate benchmark vs recorded kinn2.1 baseline
uv run python scripts/benchmark_vs_kinn2.py
```

The CLI lives at `kinn3.cli` (entry point `kinn3`):

```bash
uv run kinn3 new-session my-session "Tell me about your business."
uv run kinn3 turn my-session "We sell B2B SaaS to small dental clinics."
```

## Migration path from kinn2.1

The 5 personas, the 6 VSM blocks, and the invariants are reused unchanged
from `/root/kinn2/calibration/`. Concretely:

- Personas live in `/root/kinn2/calibration/personas/` and are loaded by
  `kinn3.personas.load_persona`.
- The recorded kinn2.1 baseline lives at
  `kinn3/calibration-runs/kinn2-baseline/baseline.json` (Task 27a).
- Invariants (exactly-one-`?`, ≤30 words, no banned phrases) are enforced by
  pydantic validation on `TurnOutput` plus the `kinn3.invariants` module.

Phase 11 (Tasks 32–36) wires event emission into `turn()`; Task 37 freezes the
canonical body. This file describes the v0 shape after Tasks 26–31.
