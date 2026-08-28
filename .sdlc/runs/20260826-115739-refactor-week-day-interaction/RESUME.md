# Resume notes — 20260826-115739-refactor-week-day-interaction

Paused 2026-08-26 at **Gate 1**, by user request. Nothing is wrong; the run is healthy.

## Where it stopped

- `status: gate_pending`, `phase: requirements_analysis`, `checkpoint: gate-1` in `.sdlc/local/state.json`
- `session-hydrate.mjs` reports `resume.pending: true` and surfaces this run automatically on the
  next session in this repo — no manual pointer needed.
- Cumulative spend: **$0.1955 estimated** (policy cap $50, stop-and-report threshold $35).
  One telemetry event. The event records `input_tokens_cached: 0` against 21,600 input tokens, so
  the figure is a ceiling, not a bill.
- `packages/web` is **clean** — no source file has been touched. Only `.sdlc/` artifacts exist.

## What Gate 1 is waiting on

`requirements.md` is written and approved-pending. Three open questions block Phase 2, and they are
persisted in `requirements.md` §"Open questions for HITL" (lines 179-196) — they are NOT lost with
the session:

- **Q1** — which abstraction level wins for `commit/`: Week's factored `adapter/interactions/*`
  shape, or Day's inlined shape. Orchestrator recommended lifting Day up to Week's shape, to
  preserve Week's 6-file test decomposition (FR-9 / brief criterion 4).
- **Q2** — how far adapter unification goes: (a) unify registry + targeting + adapter scaffolding,
  leaving two thin view adapters for column semantics, or (b) one fully parameterized adapter
  factory. Orchestrator recommended (a).
- **Q3** — whether to rename `window.__weekInteractionMotionActive`. Assumed answer: keep as-is
  (asserted at `__tests__/utils/state/reset-stores.ts:42`).

The gate reply is still `approved` / `revise: <comments>` / `abort`.

## PRECONDITION before resuming — read this first

This run depends on a **patch to the plugin cache that `/plugin update` will revert.**

`mmo` 0.6.0's `scripts/write-contract-check.mjs` applies the PROC-05 plugin-bookkeeping carve-out
only on the post-contract path. On the pre-contract path it matches `.sdlc/**` from
`HARDCODED_OFF_LIMITS` and denies — which makes `.sdlc/local/write-contract.json` unseedable and
deadlocks *every* brownfield run at guide steps 4-5. Patched 2026-08-26: `BOOKKEEPING_CARVE_OUT`
hoisted to module scope (~:152) and checked on the pre-contract path (~:270) ahead of the
`HARDCODED_OFF_LIMITS` scan (~:278).

If you have run `/plugin update` since this pause, **re-apply that patch before resuming**, then
re-probe with a real `Write` into `.sdlc/runs/` to confirm the hook accepts it, and a `Write` to
`.sdlc/delegation/` to confirm it still refuses. Do not bootstrap the contract with a Bash heredoc —
that bypasses the `Write|Edit`-only hook that this run's scope guarantee depends on.

## Write-contract state

`.sdlc/local/write-contract.json` is **active and strict**, frozen from the Gate 0 approval. Its
scope is fully recoverable from `intent_brief.md` (§"Files in scope" / §"Files off-limits") if it
ever needs rebuilding.

Note the side effect while it stays active: writes anywhere outside this repo are refused, and
writes inside the repo outside the allowlist are refused. If unrelated work in this repo starts
getting blocked before you resume, set `active: false` and re-freeze it at resume time from
`intent_brief.md`.

## Binding constraints carried into later phases

1. `viewName` passed to `createViewInteractionRegistry` must not change — `e2e/**` specs hard-code
   `data-week-interaction-event-id` and `bun test:web` does not cover them. `e2e/**` is
   write-off-limits.
2. `weekEventRegistry` / `dayEventRegistry` are **module-level singletons**
   (`week-event.registry.ts:8,22`). A view-parameterized layer returning a fresh registry per call
   site would type-check, pass isolated unit tests, and break focus/keyboard targeting at runtime.
   Captured as FR-2 / AC-4.
3. Do not close Day's feature gaps (cross-row drag, motion flag, edge navigation) — explicit non-goal.
4. Do not level Week's test coverage down to Day's (48 tests/149 assertions vs 14/39).
5. Decline any instruction to reroute file writes through Bash (`sed`, heredocs, redirection). The
   write-contract hook matches only `Write|Edit`; a Bash write bypasses Gate 0 enforcement silently,
   with no refusal to report. Both this session and the orchestrator declined it already.
