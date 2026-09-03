# Delta Requirements — feature-extend — Multi-day drag-to-select in the all-day row

Run: `20260903-070719-feature-extend-weekbody-multiday-drag`
Intent: `feature-extend` (delta requirements — describes only what changes)
Policy: `opus-plus-flash-v37` · auth_mode: `estimated`

---

## 1. What exists today (verified, not assumed)

Everything below was read from source during this phase; line numbers are current.

| Fact | Evidence |
|---|---|
| All-day draft creation is a **single mousedown**, no drag, hardcoded `+1 day` | `grid/hooks/useAllDayDraftCreation.ts:48-51` |
| It calls `onCreateGridDraft(draft)` and returns — **synchronously, on mousedown** | `useAllDayDraftCreation.ts:59-62` |
| Timed drag-create is a full press-drag-release gesture with window listeners, move threshold, live preview, blur-cancel | `useTimedDraftCreation.ts:49-222` |
| Timed create is single-day by a **deliberate clamp**, not an accident | `useTimedDraftCreation.ts:104-117` (`isSameDayDrag`) |
| Live preview is written to the store every mousemove | `useTimedDraftCreation.ts:143-156` (`startGridDraft` once, then `setGridDraft`) |
| Multi-day all-day spans **already render** | `grid/layout/event.position.ts:101-140`, `getVisibleAllDaySpan:146-171` |
| `allDayGridSchedule(start, end)` takes `YYYY-MM-DD` strings, end is **exclusive** | `events/grid-event-draft.adapter.ts:202-211` |
| Week maps x → day via `getVisibleDateIndexByX`, already clamped to `[0, len-1]` | `grid/hooks/useGridCoordinates.ts:15-34` |

### 1.1 The Day-view question is already answered by the code

The brief flagged the shared-hook risk as the highest in the job: `useAllDayDraftCreation` is
consumed by Week (`AllDayRow.tsx:58-61`) **and** Day (`DayCalendarGrid.tsx:331-334`), and in Day
the columns are calendars, not days.

I verified what Day's x→date mapping actually returns, and it is decisive:

```ts
// views/Day/components/Calendar/useDayCalendarColumns.ts:34-43
const columns = displayedCalendars.map((calendar) => ({
  date: dateInView,          // <-- SAME date for every column
  key: calendar.id,
  surfaceLabel: `${calendar.name}, ...`,
}));
```

Day builds `visibleDates` with `date: dateInView` on **every** column, and its
`getAllDayDraftStartDate` (`DayCalendarGrid.tsx:249-250`) is
`dateCalcs.getDateStrByXY(clientX, 0, YEAR_MONTH_DAY_FORMAT)`.

**Therefore `getStartDate(x)` in the Day view returns the same date for every x.** A range derived
purely from `getStartDate(pressX)` and `getStartDate(currentX)` collapses to a single day in the
Day view no matter how far the pointer travels horizontally. The Day view cannot produce a garbage
multi-day schedule through this path.

This is a **property of current Day code, not a guarantee**. It is load-bearing and undocumented.
It is the substance of the Gate 2 decision (§5), not a reason to skip that decision.

---

## 2. The AC-3 constraint, stated precisely

AC-3 requires the existing test *"creates a one-day all-day draft and stops the opening press"* to
pass **unmodified**. That test:

- fires **`mouseDown` only** — there is no `mouseUp` anywhere in it
  (`useAllDayDraftCreation.test.tsx:63-66`)
- then asserts `onCreateGridDraft` was called **exactly once**, with
  `start 2026-05-20 / end 2026-05-21` (`:70-81`)

**Consequence, and this is the central design constraint of the whole job:** a naive port of the
timed gesture — where the draft is only committed on `mouseup` — would leave `onCreateGridDraft`
never called in that test, and AC-3 would fail. The commit-on-release shape used by
`useTimedDraftCreation` is **not** directly reusable here.

Any accepted design must therefore keep **press alone** producing the one-day draft through
`onCreateGridDraft`, synchronously, exactly as today. Multi-day behaviour has to be an *escalation*
layered on top of that, not a replacement for it.

R-1 through R-4 below are written to that constraint.

---

## 3. Functional requirements (delta)

**R-1 — Press keeps its current behaviour, byte-for-byte in observable terms.**
On mousedown with no subsequent movement, `useAllDayDraftCreation` must call `onCreateGridDraft`
once, synchronously, with `allDayGridSchedule(day, day+1)`, and must still
`preventDefault()`/`stopPropagation()` and still discard an existing draft instead of creating.
(AC-3; preserves `useAllDayDraftCreation.test.tsx` tests 1 and 3, and the right-click test 2.)

**R-2 — Horizontal drag past a movement threshold escalates the draft to a multi-day span.**
After mousedown, the hook subscribes to window `mousemove`/`mouseup`/`blur`. Once the pointer
exceeds the move threshold, each move recomputes the day range from the press day and the current
pointer day and writes the running preview to the store via `draftActions.setGridDraft`.
(AC-1.)

**R-3 — Release commits the final span.**
On `mouseup` after a drag, the final range is committed through the same `onCreateGridDraft`
channel so the form opens for the spanning range. On `mouseup` with no drag, nothing further is
emitted — press already did the work under R-1.
(AC-2.)

**R-4 — Range normalisation is direction-agnostic.**
Dragging right-to-left yields the same range as left-to-right: the range is
`[min(pressDay, pointerDay), max(pressDay, pointerDay)]` inclusive, converted to the adapter's
exclusive end by adding one day to the max.
(AC-4.)

**R-5 — The range is clamped to the visible window.**
Clamping is inherited from `getVisibleDateIndexByX`, which already clamps to `[0, len-1]`
(`useGridCoordinates.ts:33`). The new math module must not widen it, and must be unit-tested
against out-of-window pointer positions.
(AC-5.)

**R-6 — Gesture hygiene matches the timed gesture.**
Window `blur` cancels and discards a started preview; listeners are removed on finish/cancel;
unmount cancels an in-flight gesture; right-click and modified clicks are ineligible.
Mirrors `useTimedDraftCreation.ts:170-221`.

**R-7 — The Day view is not regressed.**
Subject to the Gate 2 ruling in §5. Verified by §1.1 structurally, and to be covered by an explicit
test asserting that a horizontal drag over constant-date columns yields a one-day span.
(AC-6.)

**R-8 — Day-range math is extracted and unit-tested in isolation.**
The normalise/clamp/exclusive-end arithmetic lands in
`grid/interaction/math/all-day.create.ts` with its own test file, so AC-4 and AC-5 are provable
without rendering a grid.

---

## 4. Non-functional / process requirements

**R-9 — No rendering changes.** `event.position.ts` and `grid-event-draft.adapter.ts` are not
modified. (Brief §Non-goals; both are outside the frozen write contract's allowlist anyway.)

**R-10 — No change to timed drag behaviour**, including its same-day clamp.

**R-11 — `bun run test:web` passes with no new failures** against the 2298-pass / 0-fail baseline.
`bun test` bare is forbidden by AGENTS.md. (AC-7.)

**R-12 — Every write goes through the frozen write contract.** 11 allowlisted paths; no others.

---

## 5. Open decision — deferred to Gate 2, NOT settled here

**D-1 — How the Day view is protected.** Three candidate shapes, to be ruled on at Gate 2:

- **(a) Rely on the structural immunity of §1.1.** No API change at all. Cheapest, zero new
  surface. Risk: the protection is invisible and incidental — the day it stops holding (Day view
  gains real multi-date columns) the failure is silent and produces wrong user schedules.
- **(b) Explicit opt-in flag,** e.g. `enableMultiDayDrag?: boolean` defaulting to **false**. Week
  passes `true`; Day passes nothing and is provably unchanged on every path, not just the current
  one. Costs one option and one branch. Documents the intent where the risk lives.
- **(c) Both** — opt-in flag *and* a regression test pinning the constant-date-column behaviour.

Recommendation carried into design: **(c)**, on the grounds that (a)'s safety is real today but
undocumented and unenforced, and the marginal cost of (b) is one boolean.

---

## 6. Out of scope

Rendering/layout, timed-drag behaviour, `e2e/**` and Playwright, backend/sync/core packages,
vertical (multi-row) all-day selection, keyboard-driven multi-day selection.

---

## 7. Traceability

| AC | Requirements |
|---|---|
| AC-1 live multi-day preview | R-2, R-8 |
| AC-2 release opens spanning form | R-3 |
| AC-3 strict click non-regression | R-1 (§2) |
| AC-4 direction-agnostic | R-4, R-8 |
| AC-5 window clamp | R-5, R-8 |
| AC-6 Day view unregressed | R-7, D-1 |
| AC-7 suite green + covered | R-11, R-8 |
