# Intent Brief — refactor — Unify Week/Day interaction layers on the shared engine

## Context

`packages/web` carries two parallel interaction stacks, one per calendar view, sitting on a
already-generic engine in `src/interaction/` and a partially-shared layer in `grid/interaction/`.
The engine needs no change; the gap is that `grid/interaction/` stops short of the adapter
boundary, so each view re-implements it.

Current shape on this branch (verified live by discovery at HEAD `4189de13`, not carried over
from notes):

- `week-interaction.adapter.ts` 795 LOC vs `day-interaction.adapter.ts` 607 LOC
- `week-interaction.adapter.types.ts` / `day-interaction.adapter.types.ts` — 149/149 LOC, only
  ~23 lines genuinely differ. Best first merge target.
- `WeekInteractionCoordinator.tsx` 217 LOC vs `DayInteractionCoordinator.tsx` 133 LOC
- `week-layout.cache.ts` / `day-layout.cache.ts` — share dependencies, not structure

**This run is a deliberate policy A/B.** The same ticket ran on 2026-08-22 under
`flash-agsdk-only` (run `20260822-125447-refactor-week-day-interaction`, $4.942951, 30 dispatches)
and shipped commit `62162a95` on branch `CMP-104/flash-agsdk-only`. This branch was cut from
`main` and deliberately does **not** contain that commit — discovery confirmed
`git merge-base --is-ancestor 62162a95 HEAD => false` and re-verified the pre-refactor LOC
fingerprint. The duplication is fully present. The point is a clean-start comparison under
`opus-plus-flash-v37`, so this run must reach its own scoping conclusions rather than replay the
prior run's.

## Goal

Widen `grid/interaction/` to cover the adapter boundary, and collapse the genuinely duplicated
Week/Day layers onto it — with zero runtime behavior change.

**Sequencing constraint (hard).** The shared visual types carry a type hazard that must be fixed
*before* any adapter or commit merge. `dayDate` and `initialDayDate` on both `TimedDragVisual`
and `AllDayDragVisual` are bare `string` but semantically overloaded — a `YYYY-MM-DD` date in
Week, a `CalendarId` in Day. The shared factories at `math/timed.drag.ts:48` and
`math/all-day.drag.ts:35` propagate the overload via `initialDayDate: dayDate`. A concrete unsafe
consumer exists today: `Week/adapter/commit/all-day.commit.ts:19` computes
`dayjs(visual.dayDate).diff(dayjs(visual.initialDayDate), "day")`, which given a Day visual
yields `Invalid Date` → `NaN` → silently corrupted event dates, with no compiler help. Brand or
parameterize the column-key type first.

## Files in scope

- `packages/web/src/grid/interaction/**` — the shared layer to widen
- `packages/web/src/views/Week/interaction/**`
- `packages/web/src/views/Day/interaction/**`
- `packages/web/src/components/ContextMenu/contextMenuLayering.test.tsx` — imports both views
- `.gitignore` — add `.sdlc/` and `.hook-logs/` (see Repo-state risks)

Deliberately **not** in scope: `packages/web/src/interaction/**` (the engine). Discovery confirmed
it is already a generic `createInteractionEngine<TTarget, TVisual, TResult>` and both views
already implement `InteractionAdapter`. Widen the grid layer; do not push view logic down into the
engine. Leaving it out of the allowlist makes that a hard guardrail, not a guideline.

## Acceptance criteria

- `bun run test:web` holds at the baseline **2298 pass / 0 fail** across 302 files
- Interaction-scoped suite holds at **159 pass / 0 fail**
- `bun run type-check` clean; `bun run lint` exit 0 (10 pre-existing warnings tolerated, none new
  in the delta)
- No runtime behavior change in drag, resize, or targeting for either view
- The `dayDate` / `initialDayDate` overload is closed by a type the compiler can enforce
- `view-event-registry.ts`'s `data-${view}-interaction-event-*` attribute scheme is preserved —
  `readCalendarEventIdFromElement` and friends resolve event ids view-agnostically for context
  menus and undo focus-restore

## Non-goals

- **Targeting and registry layers.** Already unified — `{week,day}-event.registry.ts` and
  `{week,day}-event.targeting.ts` are pure re-export shims over
  `createViewInteractionRegistry` / `createGridEventTargeting`, verified line by line with zero
  logic in either. Named in the original job description, dropped after discovery.
- **The commit layer.** Divergent by design, not duplication: in Week a column is a *day*, in Day
  a column is a *calendar*, and Day's all-day drag deliberately never rewrites dates (only
  `calendarId`). Do not merge `commit/*.commit.ts`.
- **Adding cross-row drag to Day.** Day has none today — its adapter never touches `visual.row`
  and `cross-row.commit.ts` is imported only by Week. That is a capability gap and a separate
  ticket. Note the related hazard: `row`, `crossRowSize` and `timedStartMinutes` live on the
  *shared* visual types but only Week drives them, so a naive unification makes Day *look* like it
  supports cross-row drops (the fields typecheck) while nothing populates them.
- Fixing the pre-existing React `act(...)` warnings from `SettingsModal` in
  `DayInteractionCoordinator.test.tsx` — known noise, not failures.
- Any change to `packages/backend`, `packages/sync`, `packages/core`, `packages/scripts`, or `e2e`.
