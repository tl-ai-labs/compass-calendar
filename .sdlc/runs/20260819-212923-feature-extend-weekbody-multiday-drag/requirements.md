# Delta Requirements — Multi-day drag-to-select in the week all-day row

- **Run:** `20260819-212923-feature-extend-weekbody-multiday-drag`
- **Mode:** brownfield · **Intent:** feature-extend
- **Baseline:** git `4189de1389d8a4644ae20d9c5a907f1d161b5496`, `bun test:web` = 2298 pass / 0 fail / 302 files
- **Scope:** `packages/web` only

This is a *delta* requirements document. It states only what changes relative to the current
behavior of the repository at the baseline commit. Everything not listed here is required to stay
exactly as it is.

---

## 1. Current behavior (the thing being extended)

`packages/web/src/grid/hooks/useAllDayDraftCreation.ts` (66 lines) returns a single
`mousedown` handler. On a left press it:

1. guards on `isRightClick`,
2. `preventDefault()` + `stopPropagation()`,
3. discards an in-flight draft and returns if `selectIsDrafting` is true,
4. reads **one** date via `getStartDate(clientX, clientY)`,
5. hardcodes `endDate = dayjs(startDate).add(1, "day")`,
6. builds the draft with `createGridEventDraft(allDayGridSchedule(start, end), undefined, calendarId)`,
7. hands it to `onCreateGridDraft` (both current call sites supply this) or falls back to
   `onCreateDraft(gridEventDraftToSchemaEvent(draft))`.

There is no `mousemove`, no `mouseup`, no window listener and no move threshold, so dragging
across day columns produces the same single-day draft as a click.

Two call sites consume the hook:

| Call site | `getStartDate` | `onCreateGridDraft` |
|---|---|---|
| `views/Week/components/Grid/AllDayRow/AllDayRow.tsx` | `dateCalcs.getDateStrByXY(x, y, startOfView, YEAR_MONTH_DAY_FORMAT)` | `draftActions.startGridDraft({ activity: "gridClick", draft })` |
| `views/Day/components/Calendar/DayCalendarGrid.tsx` | `dateCalcs.getDateStrByXY(clientX, 0, YEAR_MONTH_DAY_FORMAT)` | `openGridDraftForm` (starts draft **and** opens the form) |

The Day call site additionally wraps the handler in `createOnCalendarSurface`, which resolves the
calendar under `clientX` and refuses the gesture on an unwritable calendar before delegating.

## 2. Reference implementation to mirror

`grid/hooks/useTimedDraftCreation.ts` (238 lines) already implements the full gesture for the
timed grid and is the shape this change copies:

- returns `{ startTimedDraftCreation }` rather than a bare handler,
- keeps a `gestureRef` cancelled by a `useEffect` unmount cleanup,
- installs `mousemove` / `mouseup` on `window` in **capture** phase plus a bubbling `blur`,
- gates the first preview on `hasExceededInteractionMoveThreshold(..., TIMED_DRAFT_CREATE_MOVE_THRESHOLD_PX)`,
- writes the live preview into the draft store via
  `draftActions.startGridDraft({ activity: "creating", draft })` then `draftActions.setGridDraft(...)`,
- has `isFinished` / `isCancelled` / `isPreviewStarted` flags, a single `cleanup()` that removes all
  three listeners and nulls `gestureRef`, and a `finish` that calls `onFinish(draft)`.

Its week binding is the 20-line `views/Week/hooks/grid/useTimedGridDraftCreation.ts`.

## 3. Confirmed pre-existing capability — no new rendering work

The live preview needs **no new rendering code**. `views/Week/components/Draft/grid/GridDraft.tsx`
already reads `selectDraftActivity === "creating"` (line 59), already routes all-day drafts through
`isDraftRenderedInAllDayRow` / `draftToAllDayRowGridEvent`
(`grid/layout/all-day-draft.position.ts`), and already renders a multi-day all-day bar via
`AllDayEventMemo` across `weekDays`. Multi-day all-day geometry is proven by the existing
move/resize gestures.

**Consequence:** `AllDayEvents.tsx` and `all-day-draft.position.ts` are expected to require **zero
changes**. They remain in the allowlist as contingency only; if the implementation touches them the
change plan must justify it.

---

## 4. Functional requirements

### Module: `grid/interaction/math/all-day.create.ts` (new, pure)

- **FR-1** Export a pure day-range derivation that takes an anchor day and a pointer day (both
  `YYYY-MM-DD` strings) and returns `{ startDate, endDate }` where `startDate` is the earlier of the
  two and `endDate` is the **exclusive** end — i.e. `later + 1 day` — matching the existing
  `allDayGridSchedule(start, end)` half-open convention that today produces `start + 1 day` for a
  single day.
- **FR-2** Reverse (right-to-left) drags normalize: anchor `2026-05-22`, pointer `2026-05-20` →
  `{ startDate: "2026-05-20", endDate: "2026-05-23" }`.
- **FR-3** A pointer that resolves to the same day as the anchor yields the identical result the
  click path produces today: `{ startDate: anchor, endDate: anchor + 1 day }`.
- **FR-4** The function performs no clamping of its own. Column clamping is already the
  responsibility of `useGridCoordinates.getVisibleDateIndexByX`, which clamps the index into
  `[0, visibleDates.length - 1]`; a pointer dragged past the week's first or last column therefore
  arrives already resolved to the first/last visible day. Tests must prove the composed behavior at
  both edges via the injected date resolver, not by adding a second clamp.
- **FR-5** All dates are formatted with `YEAR_MONTH_DAY_FORMAT` from `@core/constants/date.constants`
  and produced through `dayjs` from `@core/util/date/dayjs`. No `new Date("YYYY-MM-DD")` — that
  parses as UTC midnight and reads as the previous local day west of UTC (documented in
  `grid-event-draft.adapter.ts`).

### Module: `grid/hooks/useAllDayDraftCreation.ts` (extended)

- **FR-6** A press that never exceeds the move threshold behaves **exactly as today**: one
  `onCreateGridDraft` (or `onCreateDraft`) call with `endDate = start + 1 day`, and no draft is
  written to the store before that call. This is a strict non-regression — the three existing tests
  in `useAllDayDraftCreation.test.tsx` must pass unmodified.
- **FR-7** Once the pointer exceeds the threshold, the draft spans the day under mousedown through
  the day under the current pointer, inclusive, per FR-1 to FR-3.
- **FR-8** Threshold: a new `ALLDAY_DRAFT_CREATE_MOVE_THRESHOLD_PX` in
  `interaction/interaction.constants.ts`. It is a distinct constant from
  `TIMED_DRAFT_CREATE_MOVE_THRESHOLD_PX`, per the file's own standing instruction not to unify
  thresholds that measure different products of a gesture. The all-day axis is horizontal and a day
  column is far wider than a 15-minute row, so the value must be `>= 4`; the change plan fixes the
  number and justifies it.
- **FR-9** During the drag, each qualifying `mousemove` writes the running draft to the store —
  `startGridDraft({ activity: "creating", draft })` on the first preview, `setGridDraft(draft)`
  thereafter. No new store state, no new activity value.
- **FR-10** On `mouseup` past the threshold the gesture finishes by calling the **same**
  `onCreateGridDraft` / `onCreateDraft` callback with the final draft, so both call sites keep their
  current commit semantics (Week: `startGridDraft({ activity: "gridClick" })`; Day:
  `openGridDraftForm`, which also opens the form). The finish must leave the store's activity as the
  callback sets it, never stranded at `"creating"`.
- **FR-11** Cancellation paths, each leaving **no** draft in the store and **no** window listeners
  attached:
  - `Escape` pressed mid-drag,
  - window `blur`,
  - component unmount mid-gesture.
  Cancellation only discards the store draft if this gesture started a preview; a press that never
  passed the threshold must not call `draftActions.discard()` and clobber unrelated state.
- **FR-12** `isRightClick(event)` remains the first guard and returns before `preventDefault()` /
  `stopPropagation()`, preserving the existing "right-click reaches the parent" test.
- **FR-13** The pre-existing "an open draft is dismissed rather than replaced" branch
  (`isDrafting → draftActions.discard(); return;`) is preserved ahead of any gesture start.
- **FR-14** `mousemove` with `buttons !== 1` (button released outside the window) finishes the
  gesture, mirroring `useTimedDraftCreation`'s `finishWhenPrimaryButtonReleased` behavior.
- **FR-15** Escape is handled with a window `keydown` listener installed and removed by the same
  `cleanup()` as the mouse listeners. `useTimedDraftCreation` does not install one; this hook adds
  it because acceptance criterion 5 requires it. It must not leak.

### Module: call sites

- **FR-16** `AllDayRow.tsx` binds whatever handler shape the extended hook exposes. If the hook's
  return type changes from a bare function to an object, `AllDayRow.tsx` and `DayCalendarGrid.tsx`
  are both updated in the same change; the two must not diverge.
- **FR-17** `DayCalendarGrid.tsx` keeps `createOnCalendarSurface`'s writable-calendar guard in front
  of the gesture, and keeps passing the resolved `calendarId` as the handler's second argument.
- **FR-18** In the Day view there is a column per *calendar*, not per day, and `getStartDate` ignores
  `clientY` and returns the single date in view. A horizontal drag there therefore resolves anchor
  and pointer to the same date and, by FR-3, yields the unchanged single-day result. No behavioral
  change in the Day view is permitted.
- **FR-19** A week binding hook `views/Week/hooks/grid/useAllDayGridDraftCreation.ts` is created only
  if the extended hook's option shape makes `AllDayRow.tsx` meaningfully more complex. Mirroring
  `useTimedGridDraftCreation.ts` is optional, not mandatory; the change plan decides and states why.

## 5. Non-functional requirements

- **NFR-1** No new dependencies. No changes to `package.json` or `bun.lock` (off-limits).
- **NFR-2** Mouse events only. No `PointerEvent`, no touch, no keyboard range selection.
- **NFR-3** Imports use the mandatory `@web/*` and `@core/*` aliases (AGENTS.md). Relative imports
  only where the surrounding file already uses them for a sibling (e.g. `./AllDayEvents`).
- **NFR-4** Formatting is Biome-hook-owned; no hand-formatting, no lint-disable comments.
- **NFR-5** Only `.ts` / `.tsx` files are emitted into source (`.gitignore` has a `*.mjs` glob).
- **NFR-6** Per-move work stays O(1): the move handler resolves one date and writes one store
  update. It must not re-derive the week's event layout.
- **NFR-7** The store write on each move must not churn `status` — rely on the existing
  `setGridDraft` identity-preserving branch rather than re-calling `startGridDraft` per move.
- **NFR-8** Files stay within the 13-path allowlist in `.sdlc/local/write-contract.json`. Any file
  outside it stops the run and becomes a gate question.

## 6. PII inventory

No new PII surface. The gesture derives calendar dates from pointer coordinates and writes them to
an in-memory Zustand draft. No new persistence, no network call, no logging of user content, no new
field on any event payload. The draft's `title` / `description` / `location` remain empty strings
until the user types into the existing form.

## 7. Role matrix

| Actor | Resource | Action | Change |
|---|---|---|---|
| Signed-in user | own calendar (writable) | drag-create multi-day all-day draft | **new** |
| Signed-in user | read-only / unwritable calendar (Day view) | drag-create | blocked — existing `canCreateDraftOnCalendar` guard unchanged (FR-17) |
| Signed-in user | any calendar | click-create single-day all-day draft | unchanged (FR-6) |

No new authorization surface: nothing is written to the server by this gesture. Persistence
authorization stays where it already lives, on the draft form's submit path.

## 8. Acceptance criteria

Mapped from the intent brief; every one is executable.

- **AC-1** `bun test:web` passes with **no new failures** against the recorded baseline of
  2298 pass / 0 fail across 302 files.
- **AC-2** `all-day.create.test.ts` covers day-range derivation: forward drag, reverse drag,
  single-day drag, drag that stays within one column, and drag clamped at the week's first and last
  visible day.
- **AC-3** `useAllDayDraftCreation.test.tsx` simulates `mousedown` → `mousemove` across ≥ 2 day
  columns → `mouseup` and asserts the committed draft's `schedule.start` / `schedule.end` span the
  dragged range.
- **AC-4** The three existing tests in `useAllDayDraftCreation.test.tsx` pass **unmodified** — in
  particular "creates a one-day all-day draft and stops the opening press".
- **AC-5** A test asserts Escape mid-drag leaves `useDraftStore.getState().gridDraft === null`, and
  a second test asserts the same for window `blur`.
- **AC-6** A test asserts window `mousemove` / `mouseup` / `keydown` / `blur` listeners are removed
  after a completed gesture, after a cancelled gesture, and on unmount — asserted by spying on
  `window.addEventListener` / `removeEventListener` (pair counting), not by inspection.
- **AC-7** `bun type-check` and `bun lint` are clean.
- **AC-8** The Day view's all-day click-to-create still works — covered by AC-4's shared-hook tests
  plus any existing `DayCalendarGrid` suite, which must not need editing.

## 9. Out of scope (non-goals, restated as hard constraints)

1. No multi-day drag-create in the timed grid; no timed events spanning midnight.
2. No change to moving or resizing *existing* all-day events.
3. No touch or pointer-event support.
4. No keyboard-driven multi-day range selection.
5. No changes to `packages/sync`, `packages/backend`, `packages/core`, `packages/scripts`.
6. No new draft-store state or new `Activity_DraftEvent` member.
7. No changes to the month view or to the Day view's gesture behavior.
8. No commit and no branch — changes are left in the working tree.

## 10. Open questions for HITL

- **OQ-1** (`FR-8`) Threshold value. The timed grid uses 4px. The all-day axis measures a *day
  column* crossing rather than a 15-minute row, so 4px will start a preview very eagerly on a small
  hand tremor — but a value that is too high makes a deliberate short drag into a click. Proposed:
  **4px, same as timed**, on the grounds that the day-resolution step (FR-3) already collapses any
  sub-column movement to the single-day result, so an eager threshold costs nothing visible.
  Confirm or name a different value.
- **OQ-2** (`FR-19`) Whether to add `useAllDayGridDraftCreation.ts` for symmetry with the timed pair
  even if `AllDayRow.tsx` does not need it. Proposed: **add it**, because the two call sites
  otherwise duplicate the option object and the timed pair sets the house pattern. Answering
  "skip it" removes two files from the plan.
- **OQ-3** (`FR-10`) On finish, the Week call site invokes `startGridDraft({ activity: "gridClick" })`,
  which sets `isFormOpen: false` — the form is opened by something downstream of that. If the
  drag-create must open the editor *immediately* rather than following the existing week path,
  say so; the proposal is to change nothing here and inherit today's behavior exactly.
