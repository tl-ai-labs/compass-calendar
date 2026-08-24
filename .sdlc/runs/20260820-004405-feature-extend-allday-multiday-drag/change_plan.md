<!-- Run 20260820-004405-feature-extend-allday-multiday-drag · intent feature-extend · policy flash-agsdk-only
     Authored by gemini-3.7-flash (Antigravity SDK agent), packet tp_design_001.
     Integration note: the agent restarted its document part-way through the section 6 table and re-emitted
     it in full; this file is the complete second emission, unedited otherwise. Raw final message preserved
     at delegation/worker-usage-tp_design_001.json (.text). -->
# DELTA Change Plan: Multi-Day Drag-to-Select in Week All-Day Row

## 1. Summary

This plan extends the Week all-day row (`AllDayRow.tsx`) to support multi-day drag-to-select draft creation. Today, `useAllDayDraftCreation.ts` is click-only: on `mousedown`, it resolves one date, adds 1 day, and commits a 1-day draft immediately.

The target behavior mirrors the gesture lifecycle in `useTimedDraftCreation.ts`:
1. `mousedown` on an empty all-day slot anchors the gesture.
2. `mousemove` past `TIMED_DRAFT_CREATE_MOVE_THRESHOLD_PX` (4px) streams live multi-day previews to `useDraftStore`.
3. `mouseup` commits the spanning draft across the inclusive day range and opens the event creation form.
4. Sub-threshold clicks retain the single-day click-to-create fallback.
5. `Escape`, window `blur`, or pointer release cancels the gesture and cleans up listeners.

The gesture is opt-in via a `visibleBounds` option. Day view passes no bounds and retains its synchronous mousedown commit path verbatim.

---

## 2. Option-Shape Decision & Backwards Compatibility

### End-Date Exclusivity Convention
`allDayGridSchedule(start, end)` takes an **exclusive** end date (`[startDate, endDate)`). Today's single-day click path calculates `endDate = dayjs(startDate).add(1, "day").format(YEAR_MONTH_DAY_FORMAT)`. An inclusive N-day drag from `startDay` to `endDayInclusive` commits with `startDate = min(startDay, endDayInclusive)` and `endDate = dayjs(max(startDay, endDayInclusive)).add(1, "day").format(YEAR_MONTH_DAY_FORMAT)`. For example, a drag from `2026-05-18` (Mon) to `2026-05-20` (Wed) commits `{ startDate: "2026-05-18", endDate: "2026-05-21" }`.

### Day Invariant (Verbatim)
> Day view builds one column PER CALENDAR at the same date (useDayCalendarColumns.ts:34-39 -> {date: dateInView, key: calendar.id}), and its x-axis selects a CALENDAR, not a day (DayCalendarGrid.tsx:341-342 getCalendarAtX via getVisibleDateIndexByX; read at mousedown, line ~353). Therefore the invariant is NOT merely 'the date range collapses to one day' — it is: Day's all-day creation MUST still commit on MOUSEDOWN through the existing single-day path, with the calendar resolved at the same instant it is today. Any always-on threshold/preview/commit-on-mouseup path would change WHEN the draft opens and WHICH calendar is captured (anchor column vs release column).

### TypeScript Option & Return Types

```typescript
export interface AllDayVisibleBounds {
  minDate: string; // "YYYY-MM-DD"
  maxDate: string; // "YYYY-MM-DD"
}

export interface UseAllDayDraftCreationOptions {
  getStartDate: (clientX: number, clientY: number) => string;
  onCreateDraft?: (event: CompassEvent) => void;
  onCreateGridDraft?: (draft: GridEventDraft) => void;
  visibleBounds?: AllDayVisibleBounds;
}

export type AllDayDraftCreationHandler = (
  event: ReactMouseEvent<HTMLElement>,
  calendarId?: CalendarId | null,
) => void;
```

### ADR: Option Shape Decision
- **Options Considered:**
  1. *Unconditional gesture:* Run drag threshold/preview on all callers.
  2. *Separate hook:* Create `useAllDayDragDraftCreation` exclusively for Week.
  3. *Opt-in `visibleBounds` option (Chosen):* Pass optional `visibleBounds` in `UseAllDayDraftCreationOptions`.
- **Choice:** Option 3.
- **Why & Structural Impossibility of Day Regression:**
  Inside `useAllDayDraftCreation.ts`, an explicit guard checks `visibleBounds`:
  ```typescript
  if (!visibleBounds) {
    const startDate = getStartDate(event.clientX, event.clientY);
    const endDate = dayjs(startDate).add(1, "day").format(YEAR_MONTH_DAY_FORMAT);
    const draft = createGridEventDraft(allDayGridSchedule(startDate, endDate), undefined, calendarId);
    if (onCreateGridDraft) { onCreateGridDraft(draft); return; }
    onCreateDraft?.(gridEventDraftToSchemaEvent(draft));
    return;
  }
  ```
  `DayCalendarGrid.tsx` passes `{ getStartDate, onCreateGridDraft }` without `visibleBounds`. It never registers window listeners, never enters threshold detection, and never delays execution to mouseup. The calendar is captured and committed synchronously on `mousedown` exactly as it is today.

---

## 3. Pure Math Module

Path: `packages/web/src/grid/interaction/math/all-day.create.ts`

```typescript
export interface NormalizedDayRange {
  startDay: string; // "YYYY-MM-DD"
  endDay: string;   // "YYYY-MM-DD" (inclusive)
}

export interface ClampedAllDayCreateRangeInput {
  anchorDate: string;  // "YYYY-MM-DD"
  currentDate: string; // "YYYY-MM-DD"
  minDate: string;     // "YYYY-MM-DD"
  maxDate: string;     // "YYYY-MM-DD"
}

export interface AllDayScheduleDates {
  startDate: string; // "YYYY-MM-DD"
  endDate: string;   // "YYYY-MM-DD" (exclusive: endDay + 1 day)
}

/**
 * Normalizes two YYYY-MM-DD date strings so startDay <= endDay lexicographically.
 */
export function normalizeDayRange(dateA: string, dateB: string): NormalizedDayRange {
  return dateA <= dateB
    ? { startDay: dateA, endDay: dateB }
    : { startDay: dateB, endDay: dateA };
}

/**
 * Clamps a YYYY-MM-DD date string within [minDate, maxDate].
 */
export function clampDayToVisibleBounds(
  date: string,
  minDate: string,
  maxDate: string,
): string {
  if (date < minDate) return minDate;
  if (date > maxDate) return maxDate;
  return date;
}

/**
 * Converts inclusive last day into an exclusive schedule endDate (+1 day).
 */
export function toExclusiveAllDayEndDate(lastInclusiveDate: string): string {
  return dayjs(lastInclusiveDate).add(1, "day").format(YEAR_MONTH_DAY_FORMAT);
}

/**
 * Resolves normalized, clamped start and exclusive end dates for all-day draft schedule.
 */
export function calculateAllDayCreateSchedule({
  anchorDate,
  currentDate,
  minDate,
  maxDate,
}: ClampedAllDayCreateRangeInput): AllDayScheduleDates {
  const clampedAnchor = clampDayToVisibleBounds(anchorDate, minDate, maxDate);
  const clampedCurrent = clampDayToVisibleBounds(currentDate, minDate, maxDate);
  const { startDay, endDay } = normalizeDayRange(clampedAnchor, clampedCurrent);
  return {
    startDate: startDay,
    endDate: toExclusiveAllDayEndDate(endDay),
  };
}
```

---

## 4. Gesture Lifecycle

### State Machine
- **`mousedown`**:
  - Validates `!isRightClick(event)` and `isEligibleInteractionPointerDown(event)`.
  - If already drafting, discards draft and exits.
  - If `!visibleBounds`, runs synchronous 1-day commit and exits.
  - If `visibleBounds` provided: records `pointerStart = { x: clientX, y: clientY }`, `anchorDate`, sets `hasMoved = false`, `isFinished = false`, `isCancelled = false`, `isPreviewStarted = false`, attaches window listeners, and records `gestureRef.current = { cancel }`.
- **`mousemove` (window capture)**:
  - If `mouseEvent.buttons !== 1`, calls `finish(mouseEvent)`.
  - If `!hasMoved`: checks `hasExceededInteractionMoveThreshold(point, pointerStart, TIMED_DRAFT_CREATE_MOVE_THRESHOLD_PX)`. Returns early if below 4px.
  - Once exceeded, sets `hasMoved = true`.
  - Calculates `currentDate`, derives `{ startDate, endDate }` via `calculateAllDayCreateSchedule`.
  - Updates preview: on first move calls `draftActions.startGridDraft({ activity: "creating", draft })`; on subsequent moves calls `draftActions.setGridDraft(nextDraft)`.
- **`mouseup` (window capture)**:
  - Invokes `finish(mouseEvent)`: cleans up listeners.
  - If `!hasMoved`: commits single-day draft for `anchorDate`.
  - If `hasMoved`: commits spanning draft for `{ startDate, endDate }`.
  - Dispatches to `onCreateGridDraft` (or `onCreateDraft`).
- **`blur` / pointer leave**:
  - Calls `cancel()`: cleans up listeners. If `isPreviewStarted`, calls `draftActions.discard()`.
- **`Escape` (window capture)**:
  - Handled via `keydown` listener on `window` during gesture. Calls `cancel()` and prevents default.

### Target Listeners
- Container element: `onMouseDown`.
- Attached to `window` during drag gesture: `mousemove` (capture), `mouseup` (capture), `blur`, `keydown` (capture).

### Threshold Constant
- **Choice:** Reuse `TIMED_DRAFT_CREATE_MOVE_THRESHOLD_PX` (4px) from `packages/web/src/interaction/interaction.constants.ts`.
- **Justification:** Distinguishes click-to-create from drag-creation on empty grid cells across all grid surfaces.

### Escape Handling: Timed Hook vs All-Day Hook
- `useTimedDraftCreation.ts` does **not** handle Escape (only listens to `mousemove`, `mouseup`, and `blur`).
- `useAllDayDraftCreation.ts` adds a `keydown` listener during active drag:
  ```typescript
  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      cancel();
    }
  };
  ```

### Teardown
- Cleanup removes all 4 window listeners and clears `gestureRef.current`.
- Unmount effect `useEffect(() => () => gestureRef.current?.cancel(), [])` guarantees clean teardown on component unmount.

---

## 5. Preview + Commit

### Bounds & Integration
- `weekProps.component.weekDays` provides the ordered visible columns:
  - `minDate = weekDays[0].format(YEAR_MONTH_DAY_FORMAT)`
  - `maxDate = weekDays[weekDays.length - 1].format(YEAR_MONTH_DAY_FORMAT)`
- `useAllDayGridDraftCreation.ts` wraps `useAllDayDraftCreation` with `getStartDate` and `visibleBounds: { minDate, maxDate }`.

### Preview Actions
- First move past 4px: `draftActions.startGridDraft({ activity: "creating", draft })`.
- Subsequent moves: `draftActions.setGridDraft(replaceGridDraftSchedule(draft, allDayGridSchedule(startDate, endDate)))`.
- `AllDayEvents.tsx` renders `positionAllDayDraftEvent` reactively from the draft store.

### Commit Action
- Mouseup invokes `onCreateGridDraft(finalDraft)`, triggering `draftActions.startGridDraft({ activity: "gridClick", draft: finalDraft })`, which opens the event details form.

---

## 6. File-by-File Change Table

| Path | New / Edit | Summary of Changes | Satisfied Requirements |
|---|---|---|---|
| `packages/web/src/grid/interaction/math/all-day.create.ts` | **New** | Pure functions: `normalizeDayRange`, `clampDayToVisibleBounds`, `toExclusiveAllDayEndDate`, `calculateAllDayCreateSchedule`. | FR-1 |
| `packages/web/src/grid/interaction/math/all-day.create.test.ts` | **New** | Pure math unit tests (LTR, RTL, clamping, single-day, exclusive conversion). | FR-1 |
| `packages/web/src/grid/hooks/useAllDayDraftCreation.ts` | **Edit** | Add `visibleBounds` to options; implement drag lifecycle (threshold, mousemove preview, mouseup commit, blur/escape cancel); preserve synchronous path when `visibleBounds` is omitted. | FR-2, FR-3, FR-4, FR-5, FR-6, NFR-1, NFR-2, NFR-4 |
| `packages/web/src/grid/hooks/useAllDayDraftCreation.test.tsx` | **Edit** | Unit tests for hook: LTR drag, RTL drag, sub-threshold click, Escape/blur cancel, and synchronous Day path. | FR-2, FR-4, FR-5, FR-6, NFR-1 |
| `packages/web/src/views/Week/hooks/grid/useAllDayGridDraftCreation.ts` | **New** | Week binding hook composing `useAllDayDraftCreation` with `dateCalcs` and `weekDays` bounds. | FR-7 |
| `packages/web/src/views/Week/hooks/grid/useAllDayGridDraftCreation.test.tsx` | **New** | Unit tests for Week all-day draft creation hook binding. | FR-7 |
| `packages/web/src/views/Week/components/Grid/AllDayRow/AllDayRow.tsx` | **Edit** | Use `useAllDayGridDraftCreation` to wire drag creation to `AllDayGridRow`. | FR-4, FR-7 |
| `packages/web/src/views/Week/components/Grid/AllDayRow/AllDayRow.test.tsx` | **New** | Component integration test for Week all-day row drag creation. | FR-7 |
| `docs/frontend/week-drag-interaction.md` | **Edit** | Document multi-day all-day drag-to-select gesture, coordinate resolution, and lifecycle. | FR-7 |

---

## 7. Test Plan per Test File

1. `packages/web/src/grid/interaction/math/all-day.create.test.ts`:
   - `normalizeDayRange`: LTR (`2026-05-18` to `2026-05-20`) and RTL (`2026-05-20` to `2026-05-18`) produce identical `{ startDay: "2026-05-18", endDay: "2026-05-20" }`.
   - `clampDayToVisibleBounds`: Dates before `minDate` clamp to `minDate`; dates after `maxDate` clamp to `maxDate`.
   - `toExclusiveAllDayEndDate`: Returns `2026-05-21` for `2026-05-20`.
   - `calculateAllDayCreateSchedule`: Single-day produces 1-day exclusive span; multi-day clamped span produces accurate `{ startDate, endDate }`.

2. `packages/web/src/grid/hooks/useAllDayDraftCreation.test.tsx`:
   - **Sub-threshold click:** `mousedown` + `mouseup` with displacement < 4px creates a 1-day draft.
   - **Multi-day LTR drag:** `mousedown` at Day 1, `mousemove` past 4px to Day 3, `mouseup` commits 3-day draft.
   - **Multi-day RTL drag:** `mousedown` at Day 4, `mousemove` to Day 2, `mouseup` commits normalized 3-day draft (`Day 2` to `Day 5` exclusive).
   - **Escape cancellation:** `keydown` `Escape` mid-drag discards draft; `onCreateGridDraft` is not called.
   - **Blur cancellation:** Window `blur` mid-drag discards draft without commit.
   - **Day view no-op proof:** When `visibleBounds` is undefined, `mousedown` commits immediately on mousedown without attaching window listeners.

3. `packages/web/src/views/Week/hooks/grid/useAllDayGridDraftCreation.test.tsx`:
   - Verifies `visibleBounds` derived from `weekDays[0]` and `weekDays[weekDays.length - 1]`.
   - Verifies `getStartDate` passes correct `clientX`/`clientY` to `dateCalcs.getDateStrByXY`.

4. `packages/web/src/views/Week/components/Grid/AllDayRow/AllDayRow.test.tsx`:
   - Mounts `AllDayRow` within test harness and verifies drag gesture triggers `draftActions.startGridDraft`.

5. **Regression Verification:**
   - Run `bun test:web` and verify 100% pass (>= 2298 tests passing, 0 failing).
   - Verify `packages/web/src/views/Day/components/Calendar/DayCalendarGrid.test.tsx` passes untouched.

---

## 8. Risks and Rejected Alternatives

- **Risk: Day View Calendar Selection Corruption:**
  - *Mitigation:* Prevented structurally by the `visibleBounds` opt-in gate. Day view executes synchronously on `mousedown` before any pointer movement can occur.
- **Risk: Left-of-Grid / Right-of-Grid Overshoot:**
  - *Mitigation:* `clampDayToVisibleBounds` prevents out-of-range dates from entering the draft store.
- **Rejected Alternative 1: Pointer Capture on Target Element:**
  - Standard DOM pointer capture can fail if child elements rerender during live preview. Window capture listeners (`mousemove`/`mouseup`) provide consistent drag tracking.
- **Rejected Alternative 2: Mutating Existing Events Math:**
  - Reusing `all-day.resize.ts` was rejected to avoid coupling event-resizing rules with brand-new draft creation.

---

## 9. Sequencing

1. **Phase 1 (Pure Math):**
   - Create `packages/web/src/grid/interaction/math/all-day.create.ts` and `packages/web/src/grid/interaction/math/all-day.create.test.ts`.
2. **Phase 2 (Core Hook Extension):**
   - Update `packages/web/src/grid/hooks/useAllDayDraftCreation.ts`.
   - Update `packages/web/src/grid/hooks/useAllDayDraftCreation.test.tsx`.
3. **Phase 3 (Week View Wiring):**
   - Create `packages/web/src/views/Week/hooks/grid/useAllDayGridDraftCreation.ts` and test.
   - Update `packages/web/src/views/Week/components/Grid/AllDayRow/AllDayRow.tsx` and test.
4. **Phase 4 (Documentation & Validation):**
   - Update `docs/frontend/week-drag-interaction.md`.
   - Run full test suite: `bun test:web`.

*Parallel Safety:* Phase 1 (Pure math) and Phase 3 hook boilerplate can be authored concurrently before integrating into `useAllDayDraftCreation.ts`.

---

## 10. Orchestrator addendum — commit timing correction (NOT authored by the Flash agent)

*Added by the orchestrator after reviewing the plan against the existing Week suites. This section
overrides section 4's mouseup-commit-only lifecycle for the sub-threshold case. It is flagged at
Gate 2 for approval; codegen packets must implement the corrected shape below.*

### The defect

Section 4 moves ALL commit work to `mouseup` once `visibleBounds` is supplied. Week opts in, so
Week's click-to-create would move from mousedown to mouseup. An existing Week test asserts the
opposite:

`packages/web/src/views/Week/components/Grid/MainGrid/MainGrid.test.tsx:519-534` —
*"creates a one-day draft from empty all-day space"* — mounts the real `AllDayRow` via
`renderGridRegions()` (line 261), fires **`mouseDown` only, with no `mouseUp`**, and then asserts
that `selectGridDraft(useDraftStore.getState())` already holds
`{ kind: "allDay", start: 2024-01-14, end: 2024-01-15 }`.

Under section 4 as written that draft does not exist until mouseup, so this test fails. That is a
new failure against the Gate 0 baseline (2298 pass / 0 fail), breaking acceptance criterion 8, and
it is the literal form of the Gate 0 constraint that click-to-create stays unregressed (AC-3).

### The corrected lifecycle (Week / opt-in path only)

The store draft must appear on **mousedown**, exactly as today, and the drag then refines it:

1. **`mousedown`** — resolve the anchor day, build the single-day draft
   (`start = anchor`, `end = anchor + 1 day`, exclusive) and publish it immediately:
   `draftActions.startGridDraft({ activity: "creating", draft })`. Attach the window listeners.
   Do **not** call `onCreateGridDraft` yet.
2. **`mousemove` past the 4px threshold** — recompute the clamped, normalized span and
   `draftActions.setGridDraft(...)`, per section 5.
3. **`mouseup`** — call `onCreateGridDraft(finalDraft)`, which the Week binding turns into
   `startGridDraft({ activity: "gridClick", draft })` and opens the form. Below threshold the final
   draft is the same single-day draft published at step 1, so the committed value is byte-identical
   to today's click result.
4. **escape / blur** — `draftActions.discard()`, unchanged from section 4.

### Why this satisfies both constraints at once

- The mousedown-only assertion passes: the store holds the correct single-day schedule before any
  mouseup, because step 1 publishes it. The test asserts on store contents, not on the
  `onCreateGridDraft` callback or the form, so `activity: "creating"` at that instant is sufficient.
- The form still opens once per gesture, on release, for both click and drag — one draft, one form.
- Day view is untouched by all of this: without `visibleBounds` it never reaches step 1.

### Consequence for the test plan

Section 7's `useAllDayDraftCreation.test.tsx` case list gains one case:
**"publishes the single-day draft to the store on mousedown, before any mouseup"** (opt-in path),
which is the unit-level guard for the MainGrid assertion above. `MainGrid.test.tsx` is NOT in the
run allowlist and must not be edited — it is regression proof and must pass unmodified.

---

## 11. Approved consequence of section 10 — the click path opens the form on release

*Orchestrator-authored; surfaced at Gate 2 and approved by the user with this visible. Binding on
codegen, docs and the final report.*

Today `packages/web/src/views/Week/components/Grid/AllDayRow/AllDayRow.tsx:55-61` opens the form on
**mousedown**: `onCreateGridDraft` runs immediately and the Week binding calls
`startGridDraft({ activity: "gridClick", draft })`.

Under section 10, a Week click publishes `activity: "creating"` on mousedown and only reaches
`"gridClick"` — the state that opens the form — on mouseup. This is a real timing change to the
click path that Gate 0 constraint #1 protects, and it is unavoidable: a gesture cannot be classified
as a click until the pointer is released. The committed draft VALUE is unchanged; only the instant
the form opens moves, by the duration of the press.

A sweep of the suite found nothing asserting the intermediate state:
`eventReadOnlyInteraction.test.tsx:264,288` is the existing-event-card path (not empty all-day
space), `EventGrid.test.tsx` touches the all-day region for layout only, and the remaining
`gridClick` references seed the store directly. The suite is expected to stay green.

Three obligations follow, all required:

1. **Unit case** in `packages/web/src/grid/hooks/useAllDayDraftCreation.test.tsx`, opted-in path:
   after `mouseDown` with no `mouseUp`, the store draft carries `activity: "creating"`; then on
   `mouseUp`, `onCreateGridDraft` fires **exactly once**. This pins the behavior instead of leaving
   it implicit.
2. **Docs** — `docs/frontend/week-drag-interaction.md` states it as a deliberate consequence of
   supporting drag on this surface.
3. **Gate 4 report** — reported under the click-to-create constraint, so it reads as approved
   design, not drift.
