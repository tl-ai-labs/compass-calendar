# Intent Brief — refactor — Unify Week/Day interaction adapter, commit-boundary types, and coordinators

## Context

`packages/web/src/views/Week/interaction` and `packages/web/src/views/Day/interaction` each
implement their own `InteractionAdapter` on top of the shared, already-generic
`interaction.engine.ts`. Discovery confirms two of the four originally-suspected duplicated
layers are already unified (the event registry and event targeting are thin shims over shared
`grid/interaction/` factories) — the real, still-duplicated surface is narrower and more specific
than the original ticket description assumed:

- `week-interaction.adapter.ts` (795 LOC) vs `day-interaction.adapter.ts` (607 LOC) — the bulk of
  the duplication, though a meaningful share is Week-only functionality rather than divergent
  copies of the same logic.
- `week-interaction.adapter.types.ts` vs `day-interaction.adapter.types.ts` (149/149 LOC, only 24
  differing lines) — the best first merge target.
- `geometry/week-layout.cache.ts` vs `geometry/day-layout.cache.ts` (73/76 LOC) — both wrap the
  same shared builders and constants.
- `WeekInteractionCoordinator.tsx` (217 LOC) vs `DayInteractionCoordinator.tsx` (133 LOC) — Week
  carries extra edge-navigation/layout-sync wiring Day doesn't have.

The commit layer (`commit/*.commit.ts`) is **not** duplication — Week columns are days, Day
columns are calendars, and the two commit modules encode genuinely different semantics (Day's
all-day drag deliberately never rewrites dates, only `calendarId`). It is out of scope to merge,
though a narrow type-only edit inside it may be needed for the prerequisite below.

Week's decomposed shape (`adapter/interactions/*` — five per-interaction modules, plus
`edge-navigation.ts` and dedicated state modules) is the better target to unify toward; Day's
monolithic adapter should move toward that shape, not the reverse.

**Prerequisite, not a nice-to-have:** `TimedDragVisual.dayDate` is `string`-typed but overloaded —
a `YYYY-MM-DD` date in Week, a `CalendarId` in Day (see `columnMoveCalendarId` in Day's commit
code, which casts `visual.dayDate as CalendarId`). No type error currently catches misuse. This
must be given a branded or parameterized type (e.g. a `TColumnKey` generic, or a branded
`DateColumnKey | CalendarColumnKey` union) before any adapter/types merge proceeds — discovery
flagged this as the single highest-risk item in the whole run. This is a type-level change only;
it introduces no runtime behavior difference and is compatible with the full-behavior-identical
guarantee below.

`interaction.engine.ts` itself needs no change — it is already a generic
`createInteractionEngine<TTarget, TVisual, TResult>` and both views already implement
`InteractionAdapter`. The gap is that `grid/interaction/` (the already-shared layer) stops short
of the adapter/commit boundary; the fix widens that layer rather than pushing view-specific logic
up into `src/interaction/`.

## Goal

Reduce the real duplication between Week's and Day's interaction adapters, adapter-types,
geometry layout caches, and coordinators by widening the shared `grid/interaction/` layer to
cover the adapter/commit boundary — starting with the adapter-types merge — while giving
`TimedDragVisual.dayDate` a type that statically distinguishes Week's date usage from Day's
`CalendarId` usage. No behavior change for either view.

## Files in scope

- `packages/web/src/grid/interaction/**` (the shared layer being widened)
- `packages/web/src/views/Week/interaction/**`
- `packages/web/src/views/Day/interaction/**`
- `packages/web/src/interaction/interaction.adapter.types.ts` (only if the branded/parameterized
  column-key type requires touching the shared `InteractionAdapter` contract — likely, not
  certain, until the type design is finalized in codegen)
- Matching/co-located test files for all of the above (e.g. `*.test.ts`, `*.test.tsx`,
  `contextMenuLayering.test.tsx` since it imports both views' interaction modules)
- `.gitignore` (to add `.sdlc/backups/**` per discovery's coexistence-risk note, so this run's own
  bookkeeping doesn't create diff noise)

## Files off-limits

```
.env  .env.*  .mcp.json
.cursor/**  .claude/**
.sdlc/**  .git/**  .hook-logs/**
node_modules/**  dist/**  build/**
packages/backend/**  packages/sync/**  packages/scripts/**  packages/core/**
```

The refactor is confined to `packages/web`. `packages/core/src/types/event.contracts.ts` and
sibling core types are explicitly off-limits — no cross-package type changes in this run.

## Acceptance criteria

- `bun run test:web` stays green at the current baseline count (2298 pass / 0 fail) plus any new
  tests added for the merge — zero regressions. Interaction-only subset (159/159) green too.
- `bun run type-check` and `bun run lint` both exit 0.
- `week-interaction.adapter.types.ts` / `day-interaction.adapter.types.ts` duplication reduced —
  first and primary merge target.
- `TimedDragVisual.dayDate`'s overloaded `string` type replaced with a branded or
  view-parameterized type that makes Week's date usage and Day's `CalendarId` usage statically
  distinct; existing casts (e.g. `columnMoveCalendarId`) updated to the new type without changing
  behavior.
- No change to drag/resize/keyboard-navigation/commit *behavior* for either view — this is a
  structural refactor only.
- Already-unified registry/targeting shims (`week-event.registry.ts`, `day-event.registry.ts`,
  `week-event.targeting.ts`, `day-event.targeting.ts`) are left alone — collapsing them further
  was evaluated by discovery and rejected as low-value (saves ~120 LOC, costs view-specific
  naming at ~19+6 call sites).

## Non-goals

- Do not merge `commit/*.commit.ts` logic — Week (day columns) and Day (calendar columns) encode
  genuinely different semantics by design, not accidental duplication.
- Do not further collapse the already-unified event-registry/event-targeting shims.
- Do not touch `packages/backend`, `packages/sync`, `packages/scripts`, or `packages/core`.
- Do not "fix" the pre-existing `act(...)` warning noise from `SettingsModal` in
  `DayInteractionCoordinator.test.tsx` — unrelated, not a failure.
- No new features, no user-visible behavior change, no unrelated cleanup.
