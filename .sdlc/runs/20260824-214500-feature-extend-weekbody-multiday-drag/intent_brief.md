# Intent Brief — feature-extend — Multi-day drag-to-create in the Week all-day row

## Context

User's request, verbatim:

> add multi-day drag-to-select on WeekBody that creates a spanning event across the dragged day range

**There is no `WeekBody` component.** Discovery for this run re-confirmed it: the string appears in
zero source files — every hit lives inside `.sdlc/` artifacts, i.e. it is a name invented by earlier
discovery passes, not repo vocabulary. The Week body is composed by
`packages/web/src/views/Week/components/Grid/Grid.tsx`, which holds no grid markup itself and wires
`AllDayRow → MainGrid → EventGrid` through render props:

- **Timed grid body** — `views/Week/components/Grid/MainGrid/MainGrid.tsx` → shared `grid/components/TimedGrid.tsx`
- **All-day row** — `views/Week/components/Grid/AllDayRow/AllDayRow.tsx` → shared `grid/components/AllDayGridRow.tsx`
- **Day columns** — no per-day component exists. Columns are CSS grid tracks generated from a
  `visibleDates[]` prop; day identity is resolved from pointer-x by `grid/hooks/useGridCoordinates.ts`
  (wrapped by `views/Week/hooks/grid/useDateCalcs.ts`). `getDateByXY` already maps any x to the correct
  day, so **the geometry is not single-day-bound** — each region attaches a single `onMouseDown`
  spanning all columns.

Per the user's answer at interview time, "WeekBody" is re-anchored to the **all-day row**, the surface
where a spanning multi-day event is expressible. This matches all three prior arms of this study.

### The gap

`packages/web/src/grid/hooks/useAllDayDraftCreation.ts` is **click-only** — no `mousemove`, no
`mouseup`, no movement threshold — and hardcodes the span as `endDate = start + 1 day`. A drag across
day columns therefore produces exactly the same single-day draft as a click.

### The pattern to mirror

`packages/web/src/grid/hooks/useTimedDraftCreation.ts` already implements a full drag lifecycle
(window `mousemove`/`mouseup`/`blur`, movement threshold, store-backed live preview, commit on release).
It is deliberately single-day-bound at lines 104–117:

```ts
const isSameDayDrag = pointerDate.isSame(start, "day");
const isUpwardDrag = isSameDayDrag && pointerDate.isBefore(start);
if (isUpwardDrag) { … } else if (isSameDayDrag) { … }
```

Both branches gate on `isSameDayDrag`, so cross-day movement is silently discarded. **That guard stays
untouched in this run** — the timed grid is explicitly out of scope (see Non-goals).

### Assets that already exist

This feature is largely reuse, not invention:

- Multi-day **rendering** already works — `timedMultiDayToAllDayDates`, `shouldRenderTimedInAllDayRow`,
  `all-day-draft.position.ts`, and the `isTimedMultiDayDisplay` flag. `Grid.tsx` already pipes the live
  draft through this path, so widening the gesture should light up existing rendering cheaply.
- Multi-day **geometry** for move/resize of existing all-day events already exists —
  `grid/interaction/math/all-day.resize.ts` (`getNearestDayColumn`, `resizeFromStart`, `resizeFromEnd`),
  `all-day.drag.ts`, `cross-row.drag.ts`, `drag-column.ts`, `snap.ts`.
- The draft store needs no new state: `events/stores/draft.store.ts` already carries a `"creating"`
  activity in its `Activity_DraftEvent` union, and the store draft *is* the live preview.

### Blast radius

`useAllDayDraftCreation` is shared: consumed by the Week all-day row **and** by the Day view
(`views/Day/components/Calendar/DayCalendarGrid.tsx`). The Day view has a single column, so any
widening must collapse to a no-op there. Day-view suites run as proof of no regression.

### Run lineage

Fourth arm of a per-policy comparison on ticket CMP-101. The same job has been built three times, once
per policy, each on its own branch:

| Run | Policy / branch | Result |
| --- | --- | --- |
| `20260819-212923` | `CMP-101/opus-flash-v37` | 8 files, +26 tests, $4.26, committed `297baf95` |
| `20260820-004405` | `CMP-101/flash-agsdk-only` | 9 files, +29 tests, $4.07, accepted uncommitted |
| `20260820-091709` | `CMP-101/opus-only` | 11 files, +33 tests, $3.06, committed `7ff1dfb4` |

This run regenerates the feature under `opus-plus-sonnet` on `CMP-101/opus-plus-sonnet`, cut fresh from
`main` at `4189de13`. Prior implementations are to be **ignored, not consulted** — discovery verified
`git rev-list --count main..HEAD` = 0 and an empty `git diff main...HEAD -- packages/`, so none of that
code is present here.

## Goal

In the Week view's all-day row, pressing the mouse on a day cell and dragging horizontally across day
columns selects a contiguous day range and, on release, creates a single **all-day event spanning that
range**, with a live preview bar that grows and shrinks during the drag.

Behavioral requirements:

1. **Mousedown** on an empty cell of the all-day row anchors a potential drag on that day.
2. **Mousemove** past the movement threshold resolves the pointer's current day column and updates a
   live preview of the spanning draft.
3. **Reverse drags** (right-to-left) normalize — the earlier day becomes start, the later day becomes
   end, so start ≤ end always.
4. **Mouseup** commits the draft through the existing path (`createGridEventDraft` +
   `allDayGridSchedule` → `draftActions.startGridDraft`) and opens the draft editor as it does today.
5. **Cancel paths** — releasing without passing the threshold, pressing Escape mid-drag, or a window
   `blur` cancels cleanly and leaves no orphaned draft state.
6. **Day view is a no-op** — its single column collapses any drag range to one day.

## Files in scope

Primary (expected to change):
- `packages/web/src/grid/hooks/useAllDayDraftCreation.ts`
- `packages/web/src/grid/hooks/useAllDayDraftCreation.test.tsx` (new or extended)
- `packages/web/src/views/Week/components/Grid/AllDayRow/AllDayRow.tsx`

Likely:
- `packages/web/src/grid/components/AllDayGridRow.tsx` (+ its test)
- `packages/web/src/interaction/interaction.constants.ts` (movement threshold constant)
- `packages/web/src/events/grid-event-draft.adapter.ts`
- `packages/web/src/grid/interaction/layout.cache.ts`

Possible:
- `packages/web/src/views/Week/components/Grid/Grid.tsx`
- `packages/web/src/views/Week/components/Draft/Draft.tsx`
- `packages/web/src/views/Week/components/Grid/AllDayRow/AllDayEvents.tsx`
- `packages/web/src/views/Week/WeekView.render.test.tsx`
- `packages/web/src/grid/interaction/math/all-day.*.ts` (day-range helpers, if extraction is warranted)
- `packages/web/src/views/Day/components/Calendar/DayCalendarGrid.tsx` (only if the shared hook's
  signature changes)

## Files off-limits

Project defaults plus every detected AI config (default OFF for all of them):

`.git/**`, `.claude/**`, `.codex/**`, `.cursor/**`, `.agents/**`, `AGENTS.md`, `.mcp.json`,
`compass.yaml`, `.playwright-compass.yaml`, `.env`, `.env.*`, `*.env*`, `node_modules/**`,
`build/**`, `buildcache/**`, `packages/*/build/**`, `packages/*/node_modules/**`, `bun.lock`,
`patches/**`, `playwright-report/**`, `test-results/**`, `blob-report/**`, `.github/workflows/**`,
`.sdlc/**` (written by the pipeline itself, not by codegen packets).

Note: `.claude/settings.json` currently has uncommitted modifications and is off-limits — it will not
be touched.

## Acceptance criteria

1. Dragging across N day columns in the Week all-day row creates one all-day event spanning exactly
   those N days, inclusive of both endpoints.
2. Reverse (right-to-left) drags produce the same range as the equivalent left-to-right drag.
3. A plain click, or a drag that never passes the movement threshold, produces **byte-identical**
   behaviour to today: a single-day draft with `endDate = start + 1 day`. Strict non-regression.
4. A live preview bar spans the current day range during the drag and updates as the pointer moves.
5. Escape mid-drag, and window `blur` mid-drag, both cancel with no residual draft state.
6. The Day view's drag-create behaviour is unchanged.
7. `bun test:web` passes with **0 failures** — the 2298 existing tests all still pass, plus new tests
   covering the day-range math and the pointer-down/move/up gesture across day columns.
8. No new runtime or dev dependencies; `bun.lock` unchanged.

## Non-goals

- **The timed grid is not touched.** `useTimedDraftCreation`'s `isSameDayDrag` guard stays exactly as
  it is; timed drag-create remains same-day-only. (The user explicitly chose all-day row only.)
- Timed events crossing midnight.
- Backfilling the missing `useTimedDraftCreation` test file — discovery found the hook has no test at
  all, which is worth a follow-up ticket but is out of scope here.
- Changing how drafts are edited or persisted after creation.
- Any change to Day view behaviour.
