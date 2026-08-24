# Intent Brief — feature-extend — Multi-day drag-to-select creates an all-day spanning event

## Context

User's request, verbatim:

> add multi-day drag-to-select on WeekBody that creates a spanning event across the dragged day range

Discovery correction: **there is no `WeekBody` component in this repo.** `grep -rn "WeekBody"`
returns zero hits. The week body is composed in `packages/web/src/views/Week/components/Grid/Grid.tsx`
via a render-prop chain `AllDayRow → MainGrid → EventGrid`. The gesture surface the request
describes is the all-day row: `views/Week/components/Grid/AllDayRow/AllDayRow.tsx`, which binds
`grid/hooks/useAllDayDraftCreation.ts`.

Current state of that hook (66 lines): **click-only.** A single `mousedown` handler reads one
date via `getStartDate(clientX, clientY)` and hardcodes `endDate = start + 1 day`. There is no
`mousemove`, no `mouseup`, and no move threshold — so a drag across day columns produces the same
single-day draft as a click.

The reference implementation already exists for the timed grid: `grid/hooks/useTimedDraftCreation.ts`
(238 lines) implements the full gesture — window-level `mousemove`/`mouseup`/`blur` listeners in a
`useEffect`, a `TIMED_DRAFT_CREATE_MOVE_THRESHOLD_PX` move threshold, a live-resizing preview, and
a finish handler — bound to the week view by the 20-line `views/Week/hooks/grid/useTimedGridDraftCreation.ts`.
This feature mirrors that pair for the all-day axis.

Multi-day *geometry* is likewise already solved for moving and resizing existing all-day events
(`grid/interaction/math/all-day.drag.ts`, `all-day.resize.ts`, `cross-row.drag.ts`, `drag-column.ts`,
`snap.ts`). Only the *creation* gesture is missing.

The draft store needs no new state: `events/stores/draft.store.ts` already carries a `"creating"`
activity in its `Activity_DraftEvent` union, documented as "a drag-create gesture is live and
`gridDraft` is its running preview".

## Goal

In the week view's all-day row, pressing the mouse on a day cell and dragging horizontally across
day columns selects a contiguous day range and, on release, creates a single **all-day event
spanning that range**, with a live preview bar that grows and shrinks during the drag.

Decisions confirmed with the user before Gate 0:

- **Event kind:** all-day spanning event (one all-day event covering the whole day range, rendered
  as a bar in the all-day row). Not a timed event crossing midnight.
- **Drag surface:** the all-day row of the week view only. The timed grid keeps its existing
  same-day drag-create behavior unchanged.
- **Verification:** unit tests for the day-range math, component/interaction tests that simulate
  pointer down/move/up across day columns, and no regressions in the existing suite.

Behavioral requirements:

1. A plain click (no movement past the threshold) keeps today's behavior exactly — a single-day
   draft, `endDate = start + 1 day`. This is a strict non-regression.
2. A drag past the move threshold selects from the day under mousedown to the day under the
   current pointer, inclusive.
3. Reverse drags (right-to-left) normalize: the earlier day is the start, the later day is the end.
4. During the drag, the all-day row shows a live preview spanning the current day range.
5. On `mouseup`, the draft is committed via the existing draft path
   (`createGridEventDraft` + `allDayGridSchedule` → `draftActions.startGridDraft`) and the draft
   editor opens as it does today.
6. Releasing without passing the threshold, pressing Escape mid-drag, or a window `blur` cancels
   cleanly and leaves no orphaned draft or dangling window listeners.
7. Right-click is ignored (existing `isRightClick` guard preserved).
8. `useAllDayDraftCreation` is also consumed by the Day view
   (`views/Day/components/Calendar/DayCalendarGrid.tsx`). That call site must keep working; with a
   single day column a horizontal drag resolves to the same single-day result.

## Files in scope

Proposed allowlist (writable this run):

- `packages/web/src/grid/hooks/useAllDayDraftCreation.ts` — extend click-only handler into a full
  drag gesture, mirroring `useTimedDraftCreation.ts`
- `packages/web/src/grid/hooks/useAllDayDraftCreation.test.tsx` — extend existing 110-line test file
- `packages/web/src/grid/interaction/math/all-day.create.ts` *(new)* — day-range derivation from
  drag start/end, with reverse-drag normalization
- `packages/web/src/grid/interaction/math/all-day.create.test.ts` *(new)* — unit tests for the above
- `packages/web/src/views/Week/hooks/grid/useAllDayGridDraftCreation.ts` *(new, if needed)* — week
  binding hook mirroring `useTimedGridDraftCreation.ts`
- `packages/web/src/views/Week/components/Grid/AllDayRow/AllDayRow.tsx` — bind the gesture handlers
  and render the live preview
- `packages/web/src/views/Week/components/Grid/AllDayRow/AllDayEvents.tsx` — live preview rendering,
  only if the preview cannot reuse the existing draft layer
- `packages/web/src/grid/layout/all-day-draft.position.ts` — multi-column preview positioning, only
  if the existing helper cannot already span columns
- `packages/web/src/interaction/interaction.constants.ts` — add an all-day move-threshold constant
  alongside `TIMED_DRAFT_CREATE_MOVE_THRESHOLD_PX`
- `packages/web/src/views/Day/components/Calendar/DayCalendarGrid.tsx` — touch only if the shared
  hook's signature change requires it

Read-only but in context: `grid/hooks/useTimedDraftCreation.ts`,
`views/Week/hooks/grid/useTimedGridDraftCreation.ts`, `events/grid-event-draft.adapter.ts`,
`events/stores/draft.store.ts`, `grid/interaction/math/all-day.drag.ts`,
`views/Week/hooks/grid/useDateCalcs.ts`.

## Files off-limits

Project defaults from `.sdlc/project.json.off_limits_default` (`.env*`, `.mcp.json`,
`node_modules/**`, `.cursor/rules/**`, `.claude/settings.local.json`, `dist/**`, `build/**`,
`.next/**`, `.sdlc/**`, `.git/**`) plus every AI config discovery found:

- `.claude/**` (`settings.json`, `launch.json`)
- `.cursor/**` (4 `rules/*.mdc`, `hooks.json`, `hooks/format-after-edit.ts`)
- `.codex/**` (`config.toml`, `hooks.json`)
- `.agents/**` (9 skills, `chaos/agents/openai.yaml`)
- `AGENTS.md`
- `.github/workflows/**`
- `bun.lock`, `patches/**`, `compass.yaml`, `.playwright-compass.yaml`
- `buildcache/**`, `packages/*/build/**`, `playwright-report/**`, `test-results/**`, `blob-report/**`
- The backend, core, sync and scripts packages — this change is confined to `packages/web`

## Acceptance criteria

1. `bun test:web` passes with no new failures against the pre-run baseline.
2. New unit tests cover day-range derivation: forward drag, reverse drag, single-day drag,
   drag that stays within one column, and drag clamped at the week's first/last visible day.
3. New component/interaction tests simulate `mousedown` → `mousemove` across ≥2 day columns →
   `mouseup` and assert the resulting draft's `startDate`/`endDate` span the dragged range.
4. An existing test proving click-only single-day creation still passes unmodified.
5. Escape mid-drag and window `blur` both cancel with no draft left in the store.
6. Window-level `mousemove`/`mouseup` listeners are removed on unmount and after every gesture —
   asserted in test, not just by inspection.
7. `bun type-check` and `bun lint` are clean.
8. The Day view's all-day click-to-create still works.

## Non-goals

- No multi-day drag-create in the **timed** grid; no timed events spanning midnight.
- No change to moving or resizing *existing* all-day events — that geometry already works.
- No touch or pointer-event support; mouse events only, matching the timed reference.
- No keyboard-driven multi-day range selection.
- No changes to the sync, backend, or core packages; no Google Calendar round-trip work.
- No new draft-store state — reuse the existing `"creating"` activity.
- No changes to the month view or the Day view's gesture behavior.
