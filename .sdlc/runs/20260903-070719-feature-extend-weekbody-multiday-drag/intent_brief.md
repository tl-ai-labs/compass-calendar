# Intent Brief — feature-extend — Multi-day drag-to-select creating a spanning all-day event

## Context

The user's words for this job:

> "add multi-day drag-to-select on WeekBody that creates a spanning event across the dragged day range"

**Naming correction, confirmed twice.** There is no `WeekBody` component in this repository — zero
references in any `.ts`/`.tsx` source. The name was aspirational in the prior arms too (commit
`7ff1dfb4`'s subject says "WeekBody" while no such component exists). The week body is a
composition, and the day-column DOM does not live under `views/Week/` at all:

- `views/Week/**` — behaviour containers (`Grid.tsx:105-155` composes `AllDayRow > MainGrid > EventGrid`)
- `packages/web/src/grid/**` — shared presentation, also consumed by the Day view
- `grid/components/AllDayGridRow.tsx:55-125` — the actual all-day day-column DOM
- `grid/hooks/useGridCoordinates.ts:15-34` — `getVisibleDateIndexByX`, the x→day mapping

**The decisive finding.** Single-day drag-to-create already exists for *timed* events and is
single-day by an explicit clamp — `useTimedDraftCreation.ts:104-117`,
`isSameDayDrag = pointerDate.isSame(start, "day")`; cross-day movement is deliberately swallowed.
The *all-day* row has no gesture at all:

```ts
// packages/web/src/grid/hooks/useAllDayDraftCreation.ts:48-51
const startDate = getStartDate(event.clientX, event.clientY);
const endDate = dayjs(startDate).add(1, "day").format(YEAR_MONTH_DAY_FORMAT);
```

One mousedown, hardcoded `+1 day`, immediate open. Its existing test is named
*"creates a one-day all-day draft and stops the opening press"*.

So `useTimedDraftCreation.ts` is the **gesture template** and `useAllDayDraftCreation.ts` is the
file that **changes**.

**No rendering work is required.** Multi-day spans already render: `GridScheduleDraft`
`kind:"allDay"` with an exclusive end (`events/grid-event-draft.adapter.ts:202-211`), positioned by
`grid/layout/event.position.ts:101-140` with `getVisibleAllDaySpan` (`:146-171`) converting
exclusive→inclusive and clamping to the window. Put a >1-day allDay schedule in the store and the
spanning bar draws itself. **This job is gesture + day-range math only.**

State layer: Zustand `events/stores/draft.store.ts` — `startGridDraft` (`:66-97`), `setGridDraft`
(`:104-127`, the per-mousemove preview write), `discard` (`:63-64`), `setFormOpen` (`:132-145`),
activity `"creating"` (`:9-10`).

## Goal

Extend the all-day row's draft creation from a single hardcoded one-day draft to a real
press-drag-release gesture that creates an all-day event spanning the full dragged day range,
mirroring the interaction shape already proven in `useTimedDraftCreation.ts`.

## Files in scope

1. `packages/web/src/grid/hooks/useAllDayDraftCreation.ts`
2. `packages/web/src/grid/hooks/useAllDayDraftCreation.test.tsx`
3. `packages/web/src/grid/interaction/math/all-day.create.ts` *(new)*
4. `packages/web/src/grid/interaction/math/all-day.create.test.ts` *(new)*
5. `packages/web/src/interaction/interaction.constants.ts`
6. `packages/web/src/views/Week/components/Grid/AllDayRow/AllDayRow.tsx`
7. `packages/web/src/views/Week/components/Grid/AllDayRow/AllDayRow.test.tsx` *(new)*
8. `packages/web/src/views/Week/hooks/grid/useAllDayGridDraftCreation.ts` *(new, optional wrapper mirroring `useTimedGridDraftCreation.ts`)*
9. `packages/web/src/views/Week/hooks/grid/useAllDayGridDraftCreation.test.tsx` *(new, optional)*
10. `packages/web/src/views/Week/components/Grid/MainGrid/MainGrid.test.tsx` (harness touch-up — both prior arms needed it)
11. `docs/frontend/week-drag-interaction.md`

Stretch, only on explicit Gate 0 approval: `views/Day/components/Calendar/DayCalendarGrid.tsx`,
`grid/layout/event.position.ts`, `events/grid-event-draft.adapter.ts`, `.gitignore`.

## Files off-limits

`.git/**`, `.sdlc/**`, `.claude/**`, `.codex/**`, `.cursor/**`, `.agents/**`, `AGENTS.md`,
`.mcp.json`, `compass.yaml`, `compass.example.yaml`, `self-host/**`, `*.env*`, `node_modules/**`,
`build/**`, `buildcache/**`, `packages/*/build/**`, `bun.lock`, `package.json`,
`packages/*/package.json`, `patches/**`, `biome.json`, `.github/**`, `playwright-report/**`,
`test-results/**`, `blob-report/**`.

Intent-scoped off-limits: `packages/backend/**`, `packages/sync/**`, `packages/scripts/**`,
`packages/core/**`, `e2e/**`.

## Acceptance criteria

- **AC-1** Pressing on the all-day row and dragging horizontally across N day columns creates a
  single all-day draft spanning exactly those N days, previewed live during the drag.
- **AC-2** Releasing the pointer opens the draft form for the spanning range, preserving the
  existing post-release behaviour.
- **AC-3** Strict non-regression: a plain click with no drag still yields the current one-day
  all-day draft, and the existing test *"creates a one-day all-day draft and stops the opening
  press"* continues to pass unmodified.
- **AC-4** Dragging right-to-left produces the same normalised range as left-to-right.
- **AC-5** The range is clamped to the visible week window; dragging past either edge does not
  produce out-of-window dates.
- **AC-6** The Day view, which shares `useAllDayDraftCreation` via
  `DayCalendarGrid.tsx:331-334`, is not regressed — see the Gate 2 decision under Non-goals.
- **AC-7** `bun run test:web` passes with no new failures; new behaviour is covered by tests.

## Non-goals

- No changes to how multi-day spans are **rendered** — the layout arithmetic already handles them.
- No changes to timed (non-all-day) drag behaviour, including its deliberate same-day clamp.
- No Playwright/`e2e/**` work; `e2e/allday/` is explicitly not covered by this run.
- No backend, sync, or core package changes.
- **Deferred to Gate 2, not decided in codegen:** whether multi-day drag is enabled in the Day
  view. `useAllDayDraftCreation` is shared, and in the Day view the columns are *calendars on one
  date*, not days — a horizontal multi-day drag there would produce garbage schedules. The change
  must be opt-in per consumer. This is the highest-risk decision in the job.
