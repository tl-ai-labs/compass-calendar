# Requirements (delta) — Multi-day drag-to-select in the Week all-day row

- Run: `20260820-004405-feature-extend-allday-multiday-drag`  ·  Intent: `feature-extend`  ·  Mode: brownfield
- Policy: `flash-agsdk-only` — authored by `gemini-3.7-flash` (Antigravity SDK agent), packet `tp_req_001`
- Source of scope: `.sdlc/runs/20260820-004405-feature-extend-allday-multiday-drag/intent_brief.md`
- Baseline: `bun test:web` = 2298 pass / 0 fail / 302 files at `4189de1`

> Integration note: the dispatched agent restarted its document part-way through FR-5 and re-emitted it in
> full. This file is the complete second emission, with absolute `file://` links collapsed to their labels
> and LaTeX math notation replaced with plain text. No requirement content was added, removed or reworded
> by the orchestrator. The raw final message is preserved verbatim at
> `delegation/worker-usage-tp_req_001.json` (`.text`).

---
## In scope

1. **Pure Day-Range Mathematics**: Pure utility functions for calculating, normalizing (start <= end for right-to-left drags), clamping to visible week boundaries, and outputting inclusive day spans for all-day drafts.
2. **Gesture Lifecycle in All-Day Draft Creation Hook**: Extend `useAllDayDraftCreation.ts` to support the full pointer gesture lifecycle (pointer down -> threshold detection -> live drag preview -> release commit, with cancellation on Escape/blur/window leave).
3. **Live Spanning Preview**: Update the draft store during active pointer drag motion so that `AllDayEvents.tsx` renders a live multi-day spanning preview following the pointer.
4. **Sub-Threshold Click-to-Create Fallback**: Preserve existing single-day draft creation when pointer movement stays below the gesture threshold.
5. **Week View Gesture Integration**: Wire the extended drag gesture in `AllDayRow.tsx` / `useAllDayGridDraftCreation.ts` and `AllDayGridRow.tsx`.
6. **Documentation**: Update `docs/frontend/week-drag-interaction.md` with the new multi-day drag gesture mechanics.
7. **Unit & Regression Testing**: Add unit test coverage for pure math, hook gesture lifecycle, and Week integration while verifying zero regression across test suites (`bun test:web`).

---

## Out of scope

1. Cross-day dragging in the timed grid — the `isSameDayDrag` guard in `useTimedDraftCreation.ts` remains unchanged.
2. Adding multi-day drag creation to Day view, or modifying any file under `packages/web/src/views/Day/`.
3. Multi-day drag on surfaces other than the Week all-day row (e.g. Month view, mini-calendar, sidebar).
4. Dragging or resizing *existing* all-day events — `all-day.drag.ts` and `all-day.resize.ts` remain untouched.
5. Backend, sync, core, or persistence changes — client-side draft interaction only.
6. Porting or consulting the prior `CMP-101/opus-flash-v37` implementation.
7. Authoring E2E tests (`e2e/allday/event-smoke.spec.ts`) unless mandated by a future phase.

---

## Current behavior

The all-day draft creation flow is currently click-only:

- **Hook Implementation** (`packages/web/src/grid/hooks/useAllDayDraftCreation.ts:L25-L66`):
  - The hook returns a single mousedown callback `(event, calendarId?) => void` (`useAllDayDraftCreation.ts:L32-L35`).
  - On `mousedown`, it ignores right clicks (`useAllDayDraftCreation.ts:L36-L38`), calls `event.preventDefault()` / `stopPropagation()`, and discards any active draft (`useAllDayDraftCreation.ts:L40-L46`).
  - It resolves a single start date via `getStartDate(event.clientX, event.clientY)` (`useAllDayDraftCreation.ts:L48`) and hardcodes a 1-day span: `endDate = dayjs(startDate).add(1, "day").format(YEAR_MONTH_DAY_FORMAT)` (`useAllDayDraftCreation.ts:L49-L51`).
  - It immediately builds `createGridEventDraft(allDayGridSchedule(startDate, endDate), ...)` and synchronously triggers `onCreateGridDraft` / `onCreateDraft` (`useAllDayDraftCreation.ts:L53-L65`).
  - There are no `mousemove`/`mouseup`/`blur` listeners, no drag threshold checks, and no live preview streaming.
- **Week View Consumer** (`packages/web/src/views/Week/components/Grid/AllDayRow/AllDayRow.tsx:L48-L62`):
  - Passes `getStartDate: (clientX, clientY) => dateCalcs.getDateStrByXY(clientX, clientY, startOfView, YEAR_MONTH_DAY_FORMAT)` and `onCreateGridDraft: (draft) => draftActions.startGridDraft({ activity: "gridClick", draft })`.
  - Attaches the returned handler directly to `onMouseDown` on `AllDayGridRow`.
- **Day View Consumer** (`packages/web/src/views/Day/components/Calendar/DayCalendarGrid.tsx:L249-L251,L331-L334`):
  - Passes `getStartDate: (clientX) => dateCalcs.getDateStrByXY(clientX, 0, YEAR_MONTH_DAY_FORMAT)` and `onCreateGridDraft: openGridDraftForm`.
  - Attaches the returned handler to `onAllDayMouseDown` in `DayCalendarGrid`.

---

## Functional requirements

### FR-1: Pure Day-Range Calculations & Boundary Clamping
- **Statement**: Provide pure functions to compute normalized, inclusive-span all-day dates from anchor and current pointer coordinates/dates, clamped to `[startOfView, endOfView]`. When dragging right-to-left, the output range must normalize so `startDate` is the earlier date and `endDate` is the exclusive upper boundary (one day after the later date) for `allDayGridSchedule`.
- **Affected File(s)**:
  - `packages/web/src/grid/interaction/math/all-day.create.ts` *(new)*
  - `packages/web/src/grid/interaction/math/all-day.create.test.ts` *(new)*
- **Observable Acceptance**: A drag from Day A to Day B produces the exact same normalized date range as a drag from Day B to Day A. Drags beyond view bounds clamp to visible week limits without throwing errors or inverting dates.

### FR-2: All-Day Drag-to-Create Gesture Lifecycle
- **Statement**: Extend `useAllDayDraftCreation.ts` to manage the full pointer gesture lifecycle mirroring `useTimedDraftCreation.ts`:
  - Check pointer eligibility on `mousedown` (`isEligibleInteractionPointerDown`).
  - Attach window `mousemove`, `mouseup`, and `blur` listeners during the active gesture.
  - Track pointer displacement against `TIMED_DRAFT_CREATE_MOVE_THRESHOLD_PX` (4px).
  - Clean up all event listeners on gesture completion, blur, unmount, or cancellation.
- **Affected File(s)**:
  - `packages/web/src/grid/hooks/useAllDayDraftCreation.ts`
  - `packages/web/src/grid/hooks/useAllDayDraftCreation.test.tsx`
- **Observable Acceptance**: Primary button drag past 4px transitions the hook into dragging state. Secondary clicks or clicks with modifier keys do not initiate gesture listeners. Window listeners are cleanly removed upon release or blur.

### FR-3: Live Spanning Draft Preview During Drag
- **Statement**: When pointer motion exceeds the movement threshold, resolve the target day column under the pointer and update the draft store (`draftActions.startGridDraft({ activity: "creating", draft })` on first move; `draftActions.setGridDraft(draft)` on subsequent moves) so that `AllDayEvents.tsx` renders a live multi-day preview spanning across columns.
- **Affected File(s)**:
  - `packages/web/src/grid/hooks/useAllDayDraftCreation.ts`
  - `packages/web/src/grid/layout/all-day-draft.position.ts`
  - `packages/web/src/views/Week/components/Grid/AllDayRow/AllDayEvents.tsx`
- **Observable Acceptance**: During drag across N day columns, the all-day draft preview visually spans all N columns in real time prior to mouse release.

### FR-4: Multi-Day Commit on Mouse Up
- **Statement**: On `mouseup` after exceeding the movement threshold, commit the spanning draft covering the inclusive dragged day range and invoke `onCreateGridDraft` (or `onFinish` / `onCreateDraft`), opening the event form for the multi-day event.
- **Affected File(s)**:
  - `packages/web/src/grid/hooks/useAllDayDraftCreation.ts`
  - `packages/web/src/views/Week/hooks/grid/useAllDayGridDraftCreation.ts` *(new)*
  - `packages/web/src/views/Week/components/Grid/AllDayRow/AllDayRow.tsx`
- **Observable Acceptance**: Dragging across N columns and releasing creates a single draft spanning all N days and opens the event creation form.

### FR-5: Sub-Threshold Click-to-Create Fallback
- **Statement**: When a mousedown and mouseup occur without exceeding the movement threshold, generate a single-day draft on the clicked day, matching current click-to-create behavior.
- **Affected File(s)**:
  - `packages/web/src/grid/hooks/useAllDayDraftCreation.ts`
  - `packages/web/src/grid/hooks/useAllDayDraftCreation.test.tsx`
- **Observable Acceptance**: Plain click without dragging creates a 1-day draft on the clicked column.

### FR-6: Gesture Cancellation on Escape, Blur, and Pointer Leave
- **Statement**: When Escape key is pressed, window loses focus (`blur`), or pointer leaves the browser window during an in-flight drag, cancel the gesture, clean up window listeners, and discard the draft via `draftActions.discard()`. No draft event is committed and no event form opens.
- **Affected File(s)**:
  - `packages/web/src/grid/hooks/useAllDayDraftCreation.ts`
  - `packages/web/src/grid/hooks/useAllDayDraftCreation.test.tsx`
- **Observable Acceptance**: Pressing Escape or blurring window during drag discards the preview draft without creating an event.

### FR-7: Week View All-Day Hook Binding
- **Statement**: Introduce `useAllDayGridDraftCreation.ts` mirroring `useTimedGridDraftCreation.ts`, binding Week-specific coordinate calculations and date views to `AllDayRow.tsx`.
- **Affected File(s)**:
  - `packages/web/src/views/Week/hooks/grid/useAllDayGridDraftCreation.ts` *(new)*
  - `packages/web/src/views/Week/hooks/grid/useAllDayGridDraftCreation.test.tsx` *(new)*
  - `packages/web/src/views/Week/components/Grid/AllDayRow/AllDayRow.tsx`
- **Observable Acceptance**: `AllDayRow.tsx` delegates drag coordination seamlessly, and all Week interaction test suites pass.

---

## Non-functional requirements

- **NFR-1: Backwards Compatibility of Shared Hook Signatures**:
  - The public signature of `useAllDayDraftCreation` must remain compatible with existing option shapes (`getStartDate`, `onCreateGridDraft`, `onCreateDraft`) and return an `onMouseDown` handler function `(event: ReactMouseEvent<HTMLElement>, calendarId?: CalendarId | null) => void` (or an object providing this handler).
  - Existing consumers (`AllDayRow.tsx` and `DayCalendarGrid.tsx`) must continue to compile and function without breaking changes.
- **NFR-2: Day-View Behavioral No-Op**:
  - In Day view (`DayCalendarGrid.tsx`), which has a single day column, drag operations collapse to the single active date, ensuring zero functional or visual regression.
  - All existing Day-view test suites must pass without any modifications to `packages/web/src/views/Day/**`.
- **NFR-3: Performance and Frame Budget**:
  - Pointer movement during drag preview must update via lightweight store actions (`draftActions.setGridDraft`) without triggering full grid re-renders or unthrottled DOM measurements.
- **NFR-4: Clean Teardown**:
  - All event listeners on `window` (`mousemove`, `mouseup`, `blur`) must be cleaned up in `useEffect` unmount hooks or upon gesture termination, preventing listener leaks.

---

## Invariants that must not regress

1. **Gate-0 Constraint 1 — Click-to-create unregressed**: Sub-threshold clicks on an empty all-day slot continue to create a single-day draft event as they do today.
2. **Gate-0 Constraint 2 — Day View files off-limits**: Files under `packages/web/src/views/Day/**` must never be modified; Day view behavior must be proven unchanged solely through test runs.
3. **Gate-0 Constraint 3 — `isSameDayDrag` guard preserved**: The `isSameDayDrag` guard in `packages/web/src/grid/hooks/useTimedDraftCreation.ts` and the timed-grid path must remain intact.
4. **Gate-0 Constraint 4 — Infrastructure and non-web isolation**: No changes to `packages/backend/**`, `packages/sync/**`, `packages/core/**`, or `packages/scripts/**`.
5. **Existing all-day interaction preserved**: Dragging and resizing existing all-day events via `all-day.drag.ts` and `all-day.resize.ts` must continue to function without alteration.
6. **Test Suite Green**: `bun test:web` must maintain >= 2298 passing tests with 0 failures.

---

## Acceptance criteria

| # | Acceptance Criterion (from `intent_brief.md`) | Satisfying FR / NFR |
|---|---|---|
| 1 | Press-drag-release across N day columns in the Week all-day row opens exactly one draft event whose span is the inclusive dragged day range (N days), not 1 day. | **FR-1, FR-2, FR-4, FR-7** |
| 2 | Dragging right-to-left produces the same normalized range as the equivalent left-to-right drag. | **FR-1, FR-3** |
| 3 | A drag that stays under the movement threshold still produces today's single-day draft — the existing click-to-create behavior is unregressed. | **FR-2, FR-5, NFR-1** |
| 4 | A live preview of the spanning draft is visible during the drag and follows the pointer across columns. | **FR-3, NFR-3** |
| 5 | Escape / blur / pointer-leave during the drag discards the draft; no event is created and no form opens. | **FR-6, NFR-4** |
| 6 | A drag extending past the rendered week clamps to the first/last visible day; no out-of-range or inverted span reaches the draft store. | **FR-1, FR-3** |
| 7 | Day-range math is unit-tested as a pure function (normalize, clamp, inclusive span), including the single-day case. | **FR-1** |
| 8 | `bun test:web` passes with no new failures against the baseline recorded at Gate 0 (2298 pass / 0 fail). | **FR-1, FR-2, FR-7, NFR-1, NFR-2** |
| 9 | Day-view all-day behavior is unchanged, demonstrated by its existing suites passing untouched. | **NFR-1, NFR-2** |
| 10 | `docs/frontend/week-drag-interaction.md` documents the new gesture alongside the existing ones. | **FR-7, Documentation scope** |

---

## Open questions for HITL

None. All gesture boundaries, thresholds, and architectural integration points are fully specified by `intent_brief.md` and existing patterns in `useTimedDraftCreation.ts`.
