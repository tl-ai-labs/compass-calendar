# Intent Brief — refactor — Unify the Week/Day interaction adapter layer on the shared engine

## Context

`packages/web` carries two parallel per-view interaction stacks sitting on an already-generic
engine in `src/interaction/` and a partially-shared layer in `src/grid/interaction/`. The engine
needs no change; the gap is that `grid/interaction/` stops short of the adapter boundary, so each
view re-implements it.

Discovery re-derived the shape live at HEAD `2d81253a` (LOC fingerprint verified: 795 / 607 /
149 / 149). The four layers named in the job description are **not** equally duplicated:

| Layer | Verdict | Evidence |
|---|---|---|
| `registry` | Already a shared shim | 24 LOC each, pure instantiations of `createViewInteractionRegistry` (128 LOC, shared). Re-exports `idAttribute`, `typeAttribute`, `getInteractionTargetAttributes`, `createRegistry`, `registry`, `useRegistrationRef`. Zero logic. |
| `targeting` | Already a shared shim | 35 LOC each, pure instantiations of `createGridEventTargeting` (62 LOC, shared). Four identical re-exported members; the only difference is cosmetic type-alias placement. |
| `commit` | Divergent by design | Week 38+65 LOC (date-column / delta semantics) vs Day 100+67 (calendar-column semantics; deliberately never rewrites all-day dates). Both source files carry comments explaining why. Merging re-introduces the multi-day truncation bug Day defends against. |
| `adapter` | **Genuinely duplicated — the actual prize** | 795 vs 607 LOC, isomorphic factories exposing the same 8 methods in the same order. Four are byte-identical; `commit` is the same 4-branch dispatch ending in the same `throw`. |

Collapsing the two shims would touch **16 files outside `*/interaction/`** (12 Week consumers,
4 Day), reaching into `Forms/` and `ContextMenu/`, for **zero** duplication removed. That is the
trap in this ticket.

**This run is a deliberate policy A/B.** The same ticket has run four times on other branches
under `flash-agsdk-only`, `opus-plus-flash-v37` (completion door), `opus-plus-sonnet`, and
`opus-only-v5`. This branch was cut from `main` and contains none of those commits — verified:
`git merge-base --is-ancestor 62162a95 HEAD` => false, and the pre-refactor LOC fingerprint is
intact. Discovery for this run was explicitly forbidden from reading any prior run's artifacts and
re-derived the table above from the working tree alone. The arm under test is
`opus-plus-flash-v37` with the mechanical tier on the **Antigravity SDK door**
(`flash-agsdk-worker`), not the completion door the 2026-08-24 arm used.

## Goal

Widen `grid/interaction/` to cover the adapter boundary, and collapse the genuinely duplicated
Week/Day adapter layer onto it — with zero runtime behavior change.

**Sequencing constraint (hard).** Introduce a compiler-enforceable column-key discriminant
*before* any adapter method that reads it is hoisted. `dayDate` on both `TimedDragVisual` and
`AllDayDragVisual` is a bare `string` that is an untagged union of a `YYYY-MM-DD` date (Week) and
a `CalendarId` (Day). The source itself warns not to `dayjs`-parse it without knowing which view
produced it, and `columnMoveCalendarId` already performs an unchecked `visual.dayDate as
CalendarId`. Today the hazard is contained inside each view's own commit module; hoisting shared
adapter code puts both meanings on one path.

**Do not lean on `type-check` to catch cross-view mistakes.** The two 149-LOC types files declare
16 structurally identical interfaces, and both `*RegisteredEventTarget` aliases resolve to the
same shared type. TypeScript will accept a Week value where a Day value belongs.

## Files in scope

- `packages/web/src/grid/interaction/**` — the shared layer to widen
- `packages/web/src/views/Week/interaction/**`
- `packages/web/src/views/Day/interaction/**`

Deliberately **not** in the allowlist: `packages/web/src/interaction/**` (the engine). Discovery
confirmed it is already a generic `InteractionAdapter<TTarget, TVisual, TResult>` /
`InteractionEngine<TTarget, TVisual, TResult>` with five prose mentions of Week/Day and zero
imports of either. Widen the grid layer; do not push view logic down into the engine. Leaving it
out of the allowlist makes that a hard guardrail rather than a guideline, and keeps 604 LOC and
31 tests untouched.

## Files off-limits

Project defaults (`.env`, `.env.*`, `.mcp.json`, `.cursor/rules/**`,
`.claude/settings.local.json`, `node_modules/**`, `dist/**`, `build/**`, `.next/**`, `.git/**`),
plus every competing AI-tool config discovery found — `.claude/`, `.cursor/`, `.codex/`,
`.agents/skills/`, `AGENTS.md` — and everything in the repo outside the three in-scope globs,
including `packages/backend`, `packages/sync`, `packages/core`, `packages/scripts`, and `e2e`.

## Acceptance criteria

- `bun run test:web` shows **no new failures beyond the one already failing on a clean tree**.
  Measured baseline at `2d81253a`: **2297 pass / 1 fail / 1 error** across 302 files, exit 1. The
  known failure is `RecurrenceSection > keeps the event's own date selectable when the event ends
  after midnight` (date rot, unrelated to interaction code). The "2298 pass / 0 fail" bar asserted
  by the four prior arms' briefs is no longer achievable and must not be used.
- The interaction-scoped subset holds at **159 pass / 0 fail** (24 files, 497 expects).
- `bun run type-check` clean; `bun run lint` exit 0 with no new warnings in the delta.
- No runtime behavior change in drag, resize, or targeting for either view.
- The `dayDate` / `initialDayDate` overload is closed by a discriminant the compiler can enforce,
  landed before any adapter method that consumes it is hoisted.
- `view-event-registry.ts`'s `data-${view}-interaction-event-*` attribute scheme is preserved, so
  `readCalendarEventIdFromElement` and friends keep resolving event ids view-agnostically for
  context menus and undo focus-restore.
- Week's edge-navigation module-level singleton state is de-globalised if and only if a shared
  factory could be instantiated twice; otherwise it is left alone and the risk is recorded.

## Non-goals

- **The `registry` and `targeting` layers.** Named in the job description, dropped after
  discovery: both are already pure re-export shims over shared factories with zero logic.
  Collapsing them touches 16 files outside `*/interaction/` and removes no duplication.
- **Merging the `commit` layer.** Divergent by design — in Week a column is a *day*, in Day a
  column is a *calendar*, and Day's all-day drag deliberately never rewrites dates (only
  `calendarId`). Do not merge `commit/*.commit.ts`.
- **Adding cross-row drag to Day.** `commit/cross-row.commit.ts` and `math/cross-row.drag.ts` sit
  in the shared directory but are imported only by Week; Day has no all-day↔timed conversion at
  all. That is a capability gap and a separate ticket. Related hazard to avoid: `row`,
  `crossRowSize` and `timedStartMinutes` live on the *shared* visual types but only Week drives
  them, so a naive unification makes Day *look* like it supports cross-row drops (the fields
  typecheck) while nothing populates them.
- **The per-view layout-cache wrappers.** They hold genuinely different constants (Day's all-day
  cache uses `edgeThresholdPx: 0`).
- Fixing the pre-existing React `act(...)` warnings in `DayInteractionCoordinator.test.tsx` —
  known noise, not failures.
- Fixing the pre-existing `RecurrenceSection` date-rot failure.
- Any change to `packages/backend`, `packages/sync`, `packages/core`, `packages/scripts`, or `e2e`.

## Known risks carried into the run

- **Day is materially less protected.** Week has 63 interaction tests across 8 files; Day has 27
  across 4. Regressions are likelier to land silently on the Day side.
- **`.cursor/` runs a format-on-edit hook** that can reformat plugin writes underneath the run.
- **`.gitignore` is aggressive** — blanket `*.mjs`, `*.env*`, `.mcp.json`. `.sdlc/` is tracked on
  this branch but exposed to `git add -A`.
- **`packages/web/test-results.xml` is stale** (2026-08-19) and unparseable; no repo-wide count
  should be read from it.
