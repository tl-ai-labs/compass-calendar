# Change Plan (delta) — Multi-day drag-to-create in the Week all-day row

**Run:** `20260824-214500-feature-extend-weekbody-multiday-drag`
**Intent:** `feature-extend` · **Mode:** brownfield delta
**Stack:** React 18 + TypeScript + Zustand + bun test (`@testing-library/react`). No DI container, no
server-side surface — "module wiring" here means hook composition and render-prop plumbing.
**Gate 1 rulings honoured as fixed:** D-1 = (c) opt-in per consumer · D-2 = commit gate stays
`isRightClick`-only, plain-primary arms the drag only · D-3 = dedicated
`ALLDAY_DRAFT_CREATE_MOVE_THRESHOLD_PX = 4`.

No `## HALT REQUIRED`. No `## ALLOWLIST EXTENSION REQUESTED`. Every path below is already in
`.sdlc/local/write-contract.json`'s allowlist.

---

## 1. Files added

| Path | Purpose | Allowlisted |
|---|---|---|
| `packages/web/src/grid/interaction/math/all-day.create.ts` | Pure day-range math for all-day drag-create: normalizes anchor/pointer into `{ startDate, endDate }` with F-1's exclusive end. No React, no DOM, no layout cache. | ✅ via `grid/interaction/math/all-day.*.ts` |
| `packages/web/src/grid/interaction/math/all-day.create.test.ts` | Unit tests for the range math: forward, reverse, n=0 identity, exclusive-end conversion, month/year and DST boundaries, range equality. | ✅ via `grid/interaction/math/*.test.ts` |
| `packages/web/src/views/Week/components/Grid/AllDayRow/AllDayRow.test.tsx` | Week-surface proof that the all-day row opts in: down → move across columns → up produces a spanning store draft at activity `gridClick`. | ✅ (explicit entry) |

## 2. Files edited

| Path | Shape of change | Edit mode | Allowlisted |
|---|---|---|---|
| `packages/web/src/interaction/interaction.constants.ts` | Add `export const ALLDAY_DRAFT_CREATE_MOVE_THRESHOLD_PX = 4;` plus one sentence in the existing file-header doc comment explaining what it measures and why it is *not* unified with `TIMED_DRAFT_CREATE_MOVE_THRESHOLD_PX`. | `patch_apply` | ✅ |
| `packages/web/src/grid/hooks/useAllDayDraftCreation.ts` | The substantive change. Adds the optional `isMultiDayDragEnabled` option, extracts today's commit tail into a local `commitAllDayDraft`, and adds the net-new gesture lifecycle behind the flag. Return type and `getStartDate` signature unchanged. | `existing_file_edit` | ✅ |
| `packages/web/src/grid/hooks/useAllDayDraftCreation.test.tsx` | Additive only. The 3 existing tests stay byte-identical; the harness gains optional pass-through props; two new `describe` blocks cover the default-off path and the opt-in path. | `existing_file_edit` | ✅ |
| `packages/web/src/views/Week/components/Grid/AllDayRow/AllDayRow.tsx` | One line: add `isMultiDayDragEnabled: true` to the existing `useAllDayDraftCreation({ … })` call at lines 58-61. Nothing else in the file moves. | `patch_apply` | ✅ |

### Allowlisted files deliberately **not** touched

Calling these out because the intent brief listed several as "likely" and the delta is smaller than
the brief expected:

`AllDayGridRow.tsx` / `.test.tsx`, `AllDayEvents.tsx`, `Grid.tsx`, `Draft.tsx`,
`WeekView.render.test.tsx`, `grid-event-draft.adapter.ts` / `.test.ts`,
`grid/interaction/layout.cache.ts`, `grid/hooks/useGridCoordinates.ts`,
`views/Week/hooks/grid/**`.

Reasons, each verified by reading:

- **`layout.cache.ts` / `useGridCoordinates.ts`** — the hook never needs pixel geometry. `getStartDate`
  already resolves pointer-x to a day (§2 below). Building an all-day layout cache inside the hook
  would couple it to `ID_ALLDAY_COLUMNS` and a `visibleDates[]` prop that the Day consumer cannot
  supply, and would drag `getNearestDayColumn` into a code path that has no day columns.
- **`grid-event-draft.adapter.ts`** — `allDayGridSchedule(start, end)` and `createGridEventDraft`
  already accept an arbitrary span. Nothing to widen.
- **`Grid.tsx` / `Draft.tsx` / `AllDayEvents.tsx` / `AllDayGridRow.tsx`** — F-3 confirmed, see §6. The
  spanning preview needs zero new render code.
- **`views/Week/hooks/grid/useAllDayGridDraftCreation.ts`** — I considered a Week binding hook
  mirroring `useTimedGridDraftCreation.ts` and **rejected it**. That file exists because `MainGrid`
  needs the binding in two render branches *and* because the timed hook's `getStartDate` takes a
  `{x,y}` object requiring adaptation. `AllDayRow.tsx` already inlines both adapters
  (`getAllDayDraftStartDate`, `openAllDayDraft`) at a single call site and threads one
  `onMouseDown` into both branches. Adding an indirection layer would turn a one-line, fully
  auditable opt-in into a new file plus a new test, for zero behavioural gain. This is the one place
  this plan diverges from the independently-built arm's shape; the divergence is scope reduction,
  not disagreement — the seam is identical, it just lives at the existing call site.

## 3. Files removed

None.

---

## 4. Data-layer changes

**None.** There is no schema, no migration, no ORM model.

- `events/stores/draft.store.ts` is **not in the allowlist** and needs no change: its
  `Activity_DraftEvent` union already carries `"creating"` (documented in-file as *"A drag-create
  gesture is live and `gridDraft` is its running preview"*), and `startGridDraft` / `setGridDraft` /
  `discard` are exactly the three actions the gesture needs.
- The persisted payload shape is unchanged. The only difference on the wire is that an all-day
  create draft's `endDate` may now be more than one day after `startDate` — a value the create path
  already produces today via all-day resize, and which `parseGridEventDraft` already accepts.

---

## 5. API contract changes

No HTTP surface. The contracts that change are the TypeScript exports.

### 5.1 New module — `grid/interaction/math/all-day.create.ts`

```ts
export interface AllDayCreateRange {
  /** Inclusive first day of the span. Passed through verbatim from getStartDate. */
  startDate: string;
  /** EXCLUSIVE end — the day after the inclusive last day. Always YYYY-MM-DD. */
  endDate: string;
}

export const resolveAllDayCreateRange = (
  anchorDate: string,
  pointerDate?: string | null,
): AllDayCreateRange;

export const isSameAllDayCreateRange = (
  a: AllDayCreateRange | null,
  b: AllDayCreateRange,
): boolean;
```

**Input type: `string`, not `Dayjs` and not a day index.** Justification, from the code rather than
from taste:

- `getStartDate` is the *only* day source the hook has, and it is typed
  `(clientX: number, clientY: number) => string`. Week supplies
  `dateCalcs.getDateStrByXY(clientX, clientY, startOfView, YEAR_MONTH_DAY_FORMAT)` → `"YYYY-MM-DD"`.
  Day supplies a 1-arg `(clientX) => string`. Taking a string is the only choice that needs no
  signature change, and F-2 forbids a signature change.
- **A day index is not available.** `DayColumnCache.index` comes from `buildDayColumns`, which needs
  a `DOMRect` plus a `visibleDates: string[]`. The hook has neither, and in the Day view the columns
  are *calendars on one day*, so an index would not even mean "day" there.
- Taking `Dayjs` would force the hook to parse before calling and re-format after, which breaks the
  verbatim-passthrough property that FR-6 depends on (see below).

**Semantics.**

```ts
const pointer = pointerDate ?? anchorDate;
const isReverse = dayjs(pointer).isBefore(anchorDate, "day");
const startDate     = isReverse ? pointer     : anchorDate;
const inclusiveEnd  = isReverse ? anchorDate  : pointer;
return { startDate, endDate: dayjs(inclusiveEnd).add(1, "day").format(YEAR_MONTH_DAY_FORMAT) };
```

- **Forward drag** `D₀ → Dₙ` (n > 0): `isReverse` false → `startDate = D₀`, `inclusiveEnd = Dₙ`,
  `endDate = Dₙ + 1 day`. Inclusive of both endpoints, exclusive end. Satisfies AC-1.
- **Reverse drag** `Dₙ → D₀`: `isReverse` true → `startDate = D₀`, `inclusiveEnd = Dₙ`. Byte-identical
  output to the forward drag. `start ≤ end` holds unconditionally. Satisfies FR-3 / AC-2.
- **n = 0 identity.** With `pointerDate` omitted, or equal to the anchor, or merely on the same
  calendar day: `isReverse` is false (`isBefore(..., "day")` is false for same-day), so
  `startDate === anchorDate` **as the same string object** and
  `endDate === dayjs(anchorDate).add(1, "day").format(YEAR_MONTH_DAY_FORMAT)` — which is *character
  for character* the expression at today's `useAllDayDraftCreation.ts:49-51`. FR-6 holds by
  construction, not by a special case. There is **no click branch** in the range math; F-1's "the
  existing behaviour is the n = 0 case of the new formula" is implemented literally.
- **Verbatim start passthrough matters.** Today `startDate` is fed straight into
  `allDayGridSchedule(startDate, endDate)` → `dayjs(startDate).toDate()`. If the helper re-formatted
  the start, a consumer whose `getStartDate` returned a datetime (rather than `YYYY-MM-DD`) would
  see its schedule `start` change. Week returns `YYYY-MM-DD` so it makes no difference there — but
  keeping it verbatim makes the non-regression argument hold for *any* consumer, present or future.
- **Day-granularity comparison** (`isBefore(anchorDate, "day")`, not bare `isBefore`) so a consumer
  passing datetimes still normalizes on calendar days.
- `isSameAllDayCreateRange` is a plain two-field string equality. It exists only to suppress
  redundant store writes while the pointer moves inside one column (see §"Store interaction").

### 5.2 Changed hook contract — `useAllDayDraftCreation`

```ts
interface UseAllDayDraftCreationOptions {
  getStartDate: (clientX: number, clientY: number) => string;   // unchanged
  /**
   * Off by default. When false the hook is click-only exactly as it is today and
   * registers no window listeners. Week's all-day row opts in; the Day view does not.
   */
  isMultiDayDragEnabled?: boolean;                               // NEW, default false
  onCreateDraft?: (event: CompassEvent) => void;                 // unchanged
  onCreateGridDraft?: (draft: GridEventDraft) => void;           // unchanged
}
```

**Return type is unchanged:** still a bare callable
`(event: ReactMouseEvent<HTMLElement>, calendarId?: CalendarId | null) => void`. Not an object. F-2
is satisfied structurally.

### 5.3 New constant

`ALLDAY_DRAFT_CREATE_MOVE_THRESHOLD_PX = 4` in `interaction/interaction.constants.ts`. Value 4 to
match the timed feel; a separate name so the two can diverge, per D-3 and the file's own warning.

**`interaction/interaction.pointer.ts` is NOT in the allowlist and is NOT edited.** Both helpers are
consumed as-is: `isEligibleInteractionPointerDown` (arming gate) and
`hasExceededInteractionMoveThreshold` (threshold). The latter is any-axis (`|Δx| > t || |Δy| > t`),
which is fine here: a vertical-only wiggle arms the drag but resolves to the anchor column, so the
release still emits the identical one-day draft. Adding an x-only predicate would require editing a
non-allowlisted file for no behavioural difference.

---

## 6. Framework-owned wiring (paired-packet edits)

There is no DI container, no `urls.py`, no `include_router`. The equivalent is React hook
composition, and it is a **single line**:

| Packet | File | Edit |
|---|---|---|
| Hook packet | `grid/hooks/useAllDayDraftCreation.ts` | Add the `isMultiDayDragEnabled` option and the gesture behind it. Inert on its own (default off). |
| Wiring packet | `views/Week/components/Grid/AllDayRow/AllDayRow.tsx` | Add `isMultiDayDragEnabled: true` to the existing call. Dead code without the hook packet. |

The render-prop chain (`Grid.tsx` → `AllDayRow` render prop → `EventGrid` → `AllDayGridRow`'s
`<section onMouseDown>`) carries `onAllDayMouseDown` as a
`MouseEventHandler<HTMLElement>` and is **untouched**, because the hook's return type does not
change. That is the whole reason F-2's "keep returning a bare callable" constraint is load-bearing.

The two packets must appear in that order in the packet plan. They may be merged into one packet;
they may not be reversed.

---

## 7. Config schema — env variables added

**None.** No environment variable, feature flag, or runtime configuration is read by any code in
this delta. The opt-in is a compile-time prop, not a flag.

---

## 8. Design detail (the part the codegen instantiates)

### 8.1 The gesture state machine

States: `idle` → `armed` → `dragging` → (`committed` | `cancelled`).

**Arming (mousedown, drag enabled, plain primary button).** Registers four window listeners and
stores a `{ cancel }` handle on `gestureRef`:

| Listener | Target | Capture | Mirrored from timed hook? |
|---|---|---|---|
| `mousemove` | `window` | `true` | mirrored |
| `mouseup` | `window` | `true` | mirrored |
| `blur` | `window` | `false` | mirrored |
| `keydown` | `window` | `true` | **net-new** (F-5: the timed hook has no Escape handling) |

Closure flags, all mirrored from `useTimedDraftCreation`: `hasMoved`, `isCancelled`, `isFinished`,
`isPreviewStarted`. Net-new: `lastRange: AllDayCreateRange | null`, used only for write suppression.
`pointerStart = { x: event.clientX, y: event.clientY }` and `anchorDate = getStartDate(clientX,
clientY)` are captured once at mousedown and never recomputed — FR-1's "anchor day".

**`handleMouseMove(e)`** (mirrored, minus the timed hook's `finishWhenPrimaryButtonReleased` option,
which this hook does not expose):
1. `if (isFinished || isCancelled) return;`
2. `if (e.buttons !== 1) { finish(e); return; }` — covers a release that happened outside the window.
3. `if (!hasMoved && !hasExceededInteractionMoveThreshold({x,y}, pointerStart, ALLDAY_DRAFT_CREATE_MOVE_THRESHOLD_PX)) return;`
4. `hasMoved = true; previewDraft(e);`

The `hasMoved` latch is one-way: once true it stays true for the rest of the gesture, so a drag that
crosses the threshold and returns to the anchor column still commits through the drag path (and
still yields the one-day range, because the range math says so).

**`previewDraft(e)`** — FR-2 / FR-4:
1. `const range = resolveAllDayCreateRange(anchorDate, getStartDate(e.clientX, e.clientY));`
2. `if (isCancelled || isFinished) return;` (re-checked after the `getStartDate` call, mirroring the
   timed hook's ordering — `getStartDate` is consumer code and can in principle re-enter).
3. `if (isPreviewStarted && isSameAllDayCreateRange(lastRange, range)) return;`
4. `lastRange = range;` build `createGridEventDraft(allDayGridSchedule(range.startDate,
   range.endDate), undefined, calendarId)`.
5. `isPreviewStarted ? draftActions.setGridDraft(draft) : (isPreviewStarted = true,
   draftActions.startGridDraft({ activity: "creating", draft }))`.

**`finish(e)`** — FR-5:
1. `if (isFinished || isCancelled) return;`
2. `isFinished = true; cleanup();`
3. `e.preventDefault(); e.stopPropagation();` (mirrored)
4. `const range = hasMoved ? resolveAllDayCreateRange(anchorDate, getStartDate(e.clientX, e.clientY))
   : resolveAllDayCreateRange(anchorDate);`
5. `commitAllDayDraft(range, calendarId);` — **the same function the click path calls.** FR-6's "same
   callback, same activity" is guaranteed structurally, not by duplicated logic.

**`cancel()`** — FR-7 / FR-8 / FR-9:
1. `if (isFinished || isCancelled) return;`
2. `isCancelled = true; cleanup();`
3. `if (isPreviewStarted) draftActions.discard();` — never discards a draft this gesture did not
   create.

**`handleKeyDown(e)`** — net-new: `if (e.key !== "Escape") return; e.preventDefault();
e.stopPropagation(); cancel();`. Capture-phase and scoped to the live gesture, so a global Escape
handler cannot also act on a draft that is being torn down in the same tick.

**`handleWindowBlur()`** → `cancel()`.

**`cleanup()`** removes all four listeners with matching capture flags and sets `gestureRef.current =
null`.

**Teardown paths, complete list:**

| Path | Trigger | Result |
|---|---|---|
| Commit | window `mouseup` (capture) | `finish` → listeners removed → `commitAllDayDraft` |
| Commit | `mousemove` with `buttons !== 1` | `finish` (same) |
| Cancel | `Escape` keydown | `cancel` → listeners removed → `discard()` if a preview exists |
| Cancel | window `blur` | `cancel` (same) |
| Cancel | unmount | `useEffect(() => () => gestureRef.current?.cancel(), [])` — mirrored verbatim from the timed hook |
| Cancel | re-press mid-gesture | `gestureRef.current?.cancel()` inside the `isDrafting` branch (see below) |

### 8.2 The opt-in seam

Option: `isMultiDayDragEnabled?: boolean`, destructured as `isMultiDayDragEnabled = false`.

The returned callable becomes:

```ts
return (event, calendarId = null) => {
  if (isRightClick(event)) return;                       // unchanged, NR-4
  event.preventDefault();                                // unchanged, NR-5
  event.stopPropagation();                               // unchanged, NR-5
  if (isDrafting) {
    gestureRef.current?.cancel();                        // NEW — provably a no-op when off
    draftActions.discard();                              // unchanged, NR-3
    return;
  }
  if (isMultiDayDragEnabled && isEligibleInteractionPointerDown({ … })) {
    startMultiDayGesture(event, calendarId);             // NEW
    return;
  }
  commitAllDayDraft(resolveAllDayCreateRange(getStartDate(event.clientX, event.clientY)), calendarId);
};
```

**Line-by-line defence of "when off, behaviour is identical to today":**

| Today | With the flag off | Identical? |
|---|---|---|
| `if (isRightClick(event)) return;` | same statement, same position | yes |
| `preventDefault(); stopPropagation();` | same statements, same order | yes |
| `if (isDrafting) { discard(); return; }` | `gestureRef.current?.cancel();` inserted first | **yes, behaviourally.** `gestureRef.current` is assigned *only* inside `startMultiDayGesture`, which is unreachable when the flag is off. It is therefore always `null`, and `null?.cancel()` evaluates to `undefined` with no side effect. |
| `const startDate = getStartDate(clientX, clientY);` | same call, same arguments, same position in the sequence | yes |
| `const endDate = dayjs(startDate).add(1,"day").format(YEAR_MONTH_DAY_FORMAT);` | now inside `resolveAllDayCreateRange`, same expression, same `dayjs` import, same format constant | yes — same value, one extra stack frame |
| `createGridEventDraft(allDayGridSchedule(startDate,endDate), undefined, calendarId)` | moved verbatim into `commitAllDayDraft` | yes |
| `if (onCreateGridDraft) { onCreateGridDraft(draft); return; } onCreateDraft?.(gridEventDraftToSchemaEvent(draft));` | moved verbatim into `commitAllDayDraft` | yes |

The new `if` short-circuits on `isMultiDayDragEnabled` **before** evaluating
`isEligibleInteractionPointerDown`, so with the flag off that helper is never even called. No window
listener is registered on any path. The only added runtime cost is the always-null `gestureRef` and
its unmount effect, whose cleanup is a no-op.

**D-2 is honoured exactly.** The commit gate is still `isRightClick`-only. `isEligibleInteractionPointerDown`
gates *arming only*. Consequences, all deliberate:
- Shift/Alt/Ctrl/Meta + primary click, even in Week: falls through to `commitAllDayDraft` on
  **mousedown**, producing today's one-day draft with today's timing. No regression (F-6).
- Middle click (`button === 1`): not a right click, not eligible → same fall-through → today's
  behaviour.
- Right click: returns before `preventDefault`, so the parent mousedown still propagates (NR-4).

### 8.3 Store interaction, and why the `isDrafting` guard does not fight the gesture's own preview

`draft.store.ts` read and confirmed:

- **`startGridDraft` cleanly replaces an existing draft.** It is
  `useDraftStore.setState(fn, /* replace */ false, …)` where `fn` returns `{ gridDraft: draft, status:
  { …carried, activity, eventType, isDrafting: true, isFormOpen: false } }`. All four status fields
  are overwritten unconditionally, and `gridDraft` is replaced outright. Committing
  `startGridDraft({ activity: "gridClick", draft })` over a live `"creating"` preview leaves no
  residue of the preview. **No pre-discard is needed and none is added** — inserting a `discard()`
  before the commit would blank `gridDraft` for one render and flash the preview bar out.
- **The `if (isDrafting) { discard(); return; }` guard cannot fire against this gesture's own
  preview.** `isDrafting` is `useDraftStore(selectIsDrafting)` — a *render-time* value captured in
  the closure of the returned callable. When `previewDraft` writes the store, the component
  re-renders and produces a **new** callable closing over `isDrafting === true`; but the running
  gesture's four window listeners are closures created during the *previous* invocation and never
  read `isDrafting` again. The guard is only ever evaluated on a **subsequent mousedown**, by which
  point the gesture has normally already ended at `mouseup`.
- **The one case where a second mousedown lands mid-gesture** (user presses a second mouse button
  without releasing the first) is handled by the added `gestureRef.current?.cancel()` inside the
  guard, ordered **before** `draftActions.discard()`. `cancel()` tears down the listeners and (since
  `isPreviewStarted` is true) discards; the following `discard()` is idempotent
  (`setState(initialDraftState, true)`). Without that line the orphaned gesture would survive and
  commit a draft on its own release, after the user had explicitly dismissed one.
- **Form-open sequencing verified end to end.** `useDraftActions.handleChange` opens the form only
  for `keyboardEdit | createShortcut | gridClick`, with an explicit in-file comment that `"creating"`
  is intentionally excluded. `useDraftEffects` runs `useEffect(() => { handleChange(); },
  [handleChange])`, and `handleChange` is a `useCallback` keyed on `[isDrafting, activity,
  setIsFormOpen]`. So the `"creating"` → `"gridClick"` activity transition at commit changes
  `handleChange`'s identity, re-runs the effect, and opens the editor — while every preview write
  under `"creating"` leaves the form closed. This is the same path the timed drag-create already
  relies on (`useTimedGridDraftCreation.onFinish` → `startGridDraft({ activity: "gridClick" })`).
- **`finish()`'s `stopPropagation()` suppresses `useGridMouseUp`'s `#root` mouseup listener** for
  that release. Checked: today that listener runs `commitOnMouseUp(ALLDAY)` which, for a `kind:
  "create"` draft, resolves `shouldOpenForm = isNew = true` → `setFormOpen(true)` — redundant with
  `handleChange`, which has already opened it. Suppressing it is a no-op in effect, and matches how
  the timed hook already behaves.
- **`useGridMouseMove` cannot interfere**: it acts only when the Week-local `isDragging` /
  `isResizing` state is true, and this gesture sets neither.

Write-volume control: `isSameAllDayCreateRange` suppresses `setGridDraft` while the pointer moves
within one column, so the store is written once per *column change* rather than once per mousemove.
The suppression is bypassed for the first preview (`isPreviewStarted === false`), so the bar always
appears the instant the threshold is crossed, even inside the anchor column.

---

## 9. Preview verification — F-3 **CONFIRMED**, with caveats enumerated

Read the whole render path. F-3 holds: **no new layout code is required.**

1. `isDraftRenderedInAllDayRow` (`grid/layout/all-day-draft.position.ts:14`) returns true for any
   `schedule.kind === "allDay"`, regardless of span. ✅
2. `draftToAllDayRowGridEvent` routes `allDay` straight through `gridEventDraftToGridEvent`, which
   emits `startDate` / `endDate` as `YYYY-MM-DD` via `toDateOnlyString`. ✅
3. `positionAllDayDraftEvent` appends the draft to `allDayEvents` and runs `assignEventsToRow`. ✅
4. `Draft.tsx:39-46` computes `activeAllDayDraftEvent` from the live store draft and portals
   `GridDraft` into `#ID_GRID_EVENTS_ALLDAY` via `getDraftContainer`. ✅
5. `GridDraft` takes the `rendersInAllDayRow` branch and renders `AllDayEventMemo`. It already
   handles `activity === "creating"` explicitly (`const isCreating = useDraftStore(selectDraftActivity)
   === "creating"`). ✅
6. **The actual spanning math already exists.** `getAllDayEventPosition` →
   `getVisibleAllDaySpan` (`grid/layout/event.position.ts:146-171`) reads the event's `endDate` as
   **exclusive** — `const eventEnd = exclusiveEnd.isAfter(eventStart) ? exclusiveEnd.subtract(1,
   "day") : eventStart;` — clamps to the visible window, and sizes the bar with
   `sumWidthsBetween(colWidths, startIndex, endIndex)`. A 4-day draft renders as a 4-column bar with
   zero new code. **This is independent corroboration of F-1**: the exclusive-end convention is not
   just a comment in `event-nudge.util.ts`, it is what the layout arithmetic implements.

**Things that could have stopped the bar rendering, each checked and cleared:**

- **`getGridDraftId` returns `undefined` for these drafts.** `createGridEventDraft(schedule,
  undefined, calendarId)` leaves `clientId` unset, so `getGridDraftId(draft)` is `undefined` and
  `gridEventDraftToGridEvent` produces `_id: undefined`. This is **already true of today's click
  draft**, and every consumer tolerates it: `positionAllDayDraftEvent` falls into the
  `existingIndex === -1` branch and appends (`activeDraftEvent = positionedEvents[length-1]`);
  `GridDraft`'s `key={`draft-${_id}`}` becomes the stable string `"draft-undefined"`; and
  `draftInteractionAttributes` is left `undefined` by the existing `draftAsGridEvent._id ? … :
  undefined` ternary. Nothing new. **Do not add a `clientId` to fix this** — doing so would change
  `selectDraftId` from `undefined` to a real id and activate the filter below.
- **`AllDayEvents.tsx:55-66` draft-id filtering.** `draftId = useDraftStore(selectDraftId)` is
  `undefined` here, and every saved `GridEvent._id` is a non-empty string, so
  `event._id === draftId` is never true and no saved card is spuriously hidden. Independently, the
  preview bar is **not** in `allDayEvents` at all — it is portalled from `Draft.tsx` — so this
  filter cannot suppress it.
- **Row assignment.** `assignEventsToRow` places the multi-day draft on a row that avoids overlap,
  and `allDayEventTop(event.row)` positions it. Already exercised by saved multi-day all-day events.
- **Chip clicks do not start the gesture.** `AllDayEvent.handleEventMouseDown` calls
  `e.stopPropagation()` unconditionally before anything else, so a press on an existing chip never
  reaches `AllDayGridRow`'s `<section onMouseDown>`. FR-1's "empty space" restriction survives with
  no change.
- **`Grid.tsx:84-89` column tinting** pipes the same live draft through `positionAllDayDraftEvent`
  for `withAllDayColumnTints`. A multi-day draft will now tint every column it spans during the
  drag. That is a *desirable* side effect and needs no code change; flagged so it is not mistaken
  for a bug in review.

---

## 10. Day-view no-op proof

Concrete, at the call site (`views/Day/components/Calendar/DayCalendarGrid.tsx`, **off-limits, read
only**):

```ts
// line 331
const onAllDayMouseDown = useAllDayDraftCreation({
  getStartDate: getAllDayDraftStartDate,
  onCreateGridDraft: openGridDraftForm,
});
…
// line 363, inside createOnCalendarSurface
createDraft(event, calendar?.id ?? null);
```

1. **The options object is unchanged.** Day passes exactly two properties. `isMultiDayDragEnabled` is
   optional and defaults to `false`, so this object still type-checks and Day takes the click-only
   path described in §8.2 — no listeners, no gesture, commit on mousedown, same draft.
2. **The return type is unchanged.** `onAllDayMouseDown` is consumed at line 363 as a bare
   two-positional-argument function `(event, calendarId)`. The hook still returns exactly that.
   Nothing about `handleAllDayMouseDown`'s `useCallback` or its dependency array changes; the hook
   returns a fresh arrow per render today and continues to.
3. **`getStartDate` keeps its positional signature.** Day supplies a 1-arg `(clientX) => string`,
   which remains assignable to `(clientX: number, clientY: number) => string`. Unchanged.
4. **FR-10 is satisfied structurally, not by range collapse.** The requirements doc reasons that
   Day's single column makes every x resolve to the same date. That is true, but it is *not* the
   argument this design relies on — and it would be a weak one, because Day's columns are
   **calendars on one day** (`getCalendarAtX` → `displayedCalendars[getVisibleDateIndexByX(clientX)]`),
   so a horizontal drag there crosses calendars, not days. Under D-1(c) the question never arises:
   Day never arms a drag, because it never sets the flag. NR-2 is met by construction, and the Day
   view's `views/Day/**` tree is not opened.

---

## 11. Testing surface

### Existing tests affected

- **`packages/web/src/grid/hooks/useAllDayDraftCreation.test.tsx` — the 3 existing tests must pass
  UNCHANGED.** They render the harness without `isMultiDayDragEnabled`, so they exercise the
  default-off path exclusively. The harness itself gains optional props (an `isMultiDayDragEnabled`
  pass-through and an optional `getStartDate` stub) with defaults that preserve today's call — the
  three `it(...)` bodies are not edited.
- **`packages/web/src/grid/components/AllDayGridRow.test.tsx`** — read; it only asserts column tint
  styling with a no-op `onMouseDown`. Unaffected, not edited.
- **`packages/web/src/views/Week/WeekView.render.test.tsx`** — read; it is a 22-line scroll test.
  Unaffected, not edited.
- **All Day-view suites** — run unmodified as the NR-2 / AC-6 proof.

### New tests

**`grid/interaction/math/all-day.create.test.ts`** (FR-3, FR-6, F-1 / AC-1, AC-2, AC-3)

| Case | Assertion |
|---|---|
| forward, 4 columns | `resolveAllDayCreateRange("2026-05-20","2026-05-23")` → `{ startDate:"2026-05-20", endDate:"2026-05-24" }` |
| reverse, same 4 columns | `resolveAllDayCreateRange("2026-05-23","2026-05-20")` → identical object |
| n = 0, pointer equals anchor | → `{ "2026-05-20", "2026-05-21" }` |
| n = 0, pointer omitted | → identical to the row above |
| n = 0 identity with today | equals the literal `{ start:"2026-05-20", end:"2026-05-21" }` the first existing hook test already asserts |
| anchor passthrough | `startDate` is the exact input string, not re-formatted |
| month/year rollover | `("2026-12-30","2027-01-01")` → `endDate "2027-01-02"` |
| DST boundary | `("2026-03-08","2026-03-08")` → `endDate "2026-03-09"` (calendar-day add, not 24h) |
| `isSameAllDayCreateRange` | true for equal pairs; false when either field differs; false when `a` is null |

**`grid/hooks/useAllDayDraftCreation.test.tsx`** — two new `describe` blocks. Harness stubs
`getStartDate` as an x→date map (`x < 100 → "2026-05-20"`, `< 200 → "2026-05-21"`, …) so column
identity is deterministic without layout.

*Default path (flag absent):*

| # | Case | Requirement |
|---|---|---|
| D1 | mousedown, then a 300px window mousemove, then mouseup → `onCreateGridDraft` called exactly once, with `2026-05-20 → 2026-05-21`, and called during the **mousedown** | FR-6, NR-5, D-1(c) |
| D2 | no window `mousemove`/`mouseup`/`keydown`/`blur` listener is added on mousedown (spy on `window.addEventListener`) | opt-in seam |

*Opt-in path (`isMultiDayDragEnabled: true`):*

| # | Case | Requirement |
|---|---|---|
| W1 | mousedown alone → `onCreateGridDraft` not called; `gridDraft` still null | FR-1 |
| W2 | down @x=50, move @x=350 → `gridDraft.values.schedule` is `allDay 05-20 → 05-24`; `status.activity === "creating"`; `status.isFormOpen === false` | FR-2, FR-4 |
| W3 | …then mouseup → `onCreateGridDraft` called once with `05-20 → 05-24`; listeners removed | FR-5, AC-1 |
| W4 | down @x=350, move @x=50, up → same `05-20 → 05-24` | FR-3, AC-2 |
| W5 | down, move 2px, up → `onCreateGridDraft` with `05-20 → 05-21`; store never held a `"creating"` draft | FR-6, AC-3 |
| W6 | down, up with no move at all → `05-20 → 05-21` | FR-6 |
| W7 | down, move across columns, `keydown Escape` → `gridDraft` null; a subsequent mouseup calls nothing | FR-7, AC-5 |
| W8 | down, move, `window blur` → `gridDraft` null; subsequent mouseup calls nothing | FR-8, AC-5 |
| W9 | down, move, `unmount()` → `gridDraft` null; subsequent mousemove/mouseup are inert | FR-9 |
| W10 | move with `buttons: 0` → commits (release-outside-window) | FR-5 |
| W11 | two moves inside the same column after the first preview → `setGridDraft` write count does not grow | write suppression |
| W12 | shift+primary mousedown → commits `05-20 → 05-21` on **mousedown**, arms nothing | D-2, F-6 |
| W13 | `button: 2` → nothing created, `onParentMouseDown` still fires | NR-4 |
| W14 | re-press while a committed draft exists → `gridDraft` null, no replacement, parent mousedown not called | NR-3 |

**`views/Week/components/Grid/AllDayRow/AllDayRow.test.tsx`** — Week-surface opt-in proof. Mocks
`@web/events/queries/useWeekEventsQuery` (`useWeekEventViewModel`) and renders `AllDayRow` through
its **`children` render-prop branch**, whose render prop attaches `onAllDayMouseDown` to a plain
`<div>`. That branch only calls `useWeekEventViewModel`; `useAllDayEventsLayer` merely *constructs*
the `<AllDayEvents/>` element inside a `useMemo` and the test's render prop never renders it, so the
heavy calendar/overlay hook tree is not mounted. `dateCalcs` is a stub whose `getDateStrByXY` maps
x→date.

| # | Case | Requirement |
|---|---|---|
| A1 | down @col0 → move @col3 → up ⇒ `gridDraft` is `allDay 05-20 → 05-24` with `status.activity === "gridClick"` | AC-1, AC-4, FR-5, opt-in wiring |
| A2 | down → up with no move ⇒ `gridDraft` is `05-20 → 05-21` with `status.activity === "gridClick"` | AC-3 |

### Not covered by a new test (documented, deliberate)

- **NR-1 / NR-2 / NR-6** — enforced by the write contract, not by assertions.
- **NR-7** — the full `bun test:web` run (baseline 2298 pass / 0 fail).
- **The `"creating"` → `"gridClick"` → form-open link** is proven by reading (§8.3) plus the
  identical, already-shipped timed drag-create path; no new test mounts `DraftProvider`. See risk
  R-2.

---

## 12. Off-limits reminders

The intent lands adjacent to three off-limits surfaces. None is touched.

- **`grid/hooks/useTimedDraftCreation.ts`** — read as a template only. Its `isSameDayDrag` guard
  (lines 104-117) is not modified; timed drag-create stays same-day-only. The gesture shape is
  **re-implemented locally** in the all-day hook rather than extracted into a shared module, exactly
  as F-4 requires — extraction would mean editing this file.
- **`views/Day/**`** — read at `DayCalendarGrid.tsx:331` and `:363` for the signature proof in §10.
  Not edited. If review finds any reason a Day file must change, that is a HALT, not a workaround.
- **`package.json` / `packages/*/package.json` / `bun.lock`** — no new dependency. Everything used
  (`dayjs`, `zustand`, existing `@web/interaction` helpers) is already imported elsewhere in these
  same directories.

Additionally, three files this design *could* plausibly have wanted are **not in the allowlist** and
are correspondingly **not required**:

| File | Why it stays untouched |
|---|---|
| `events/stores/draft.store.ts` | `"creating"` activity and all three needed actions already exist (§4). |
| `interaction/interaction.pointer.ts` | Both helpers are consumed as-is; the any-axis threshold is acceptable (§5.3). |
| `grid/layout/all-day-draft.position.ts`, `grid/layout/event.position.ts` | F-3 confirmed — the spanning render already works (§9). |

---

## 13. Cross-cutting sequencing

Packets must execute in this order. Steps 1 and 2 are independent of each other and may be merged.

| Order | Packet | Depends on | Note |
|---|---|---|---|
| 1 | `interaction.constants.ts` — add `ALLDAY_DRAFT_CREATE_MOVE_THRESHOLD_PX` + doc comment | — | Trivial, isolated. |
| 2 | `grid/interaction/math/all-day.create.ts` + `all-day.create.test.ts` | — | Pure module; its tests are green before any hook change exists. Land the test in the same packet. |
| 3 | `grid/hooks/useAllDayDraftCreation.ts` | 1, 2 | The substantive edit. Inert until step 5. |
| 4 | `grid/hooks/useAllDayDraftCreation.test.tsx` | 3 | Must land with or immediately after 3 — it asserts the new option. |
| 5 | `views/Week/components/Grid/AllDayRow/AllDayRow.tsx` | 3 | The one-line opt-in. Dead code before 3. |
| 6 | `views/Week/components/Grid/AllDayRow/AllDayRow.test.tsx` | 5 | Fails before 5 lands. |

Full-suite verification (`bun test:web` from repo root, expect ≥ 2298 pass / 0 fail) runs after 6.

---

## 14. Risks and open questions — gate these before codegen

**R-1 (highest) — an existing test elsewhere may fire only `mouseDown` on the Week all-day row.**
D-1(c) moves the Week commit from mousedown to mouseup. Any pre-existing test that presses the Week
all-day row with `fireEvent.mouseDown(...)` alone and then asserts a draft or an open form will now
fail. I read the two candidate suites I could reach (`WeekView.render.test.tsx` — a 22-line scroll
test; `AllDayGridRow.test.tsx` — tint styling only) and neither is affected, but I could not grep the
full `packages/web` tree from this phase. **If codegen's suite run surfaces such a failure in a file
outside the allowlist, the correct action is a HALT and a re-gate, not a silent design change** —
the fix (adding a `fireEvent.mouseUp`) would require an allowlist extension. Cheap pre-check for the
orchestrator: `rg -n "mouseDown" packages/web/src/views/Week packages/web/src/grid --glob '*.test.tsx'`.

**R-2 — the form-open link is proven by reading, not by a test.** §8.3 establishes that
`useDraftEffects` re-runs `handleChange` when `activity` flips `"creating"` → `"gridClick"`, opening
the editor. No new test mounts `DraftProvider` to assert it. Mitigating factors: the timed
drag-create already depends on this exact transition and ships working; and `AllDayRow.test.tsx` A1
does assert `status.activity === "gridClick"`, which is the input to that effect. Accept, or ask for
a `Draft`-level integration test as a follow-up ticket.

**R-3 — Escape `stopPropagation` scope.** The gesture's capture-phase keydown swallows Escape while a
drag is live. If a global Escape handler exists that must also run mid-drag (e.g. closing a modal
layered over the grid), this pre-empts it. Judgement: correct as specified — a live drag should own
Escape — but flagging it because it is net-new behaviour with no prior art in the codebase (F-5).
The handler is removed by `cleanup()` on every teardown path, so it can never swallow Escape outside
a gesture.

**R-4 — accepted, already ruled at Gate 1.** A Week user who presses and holds on the all-day row
without moving no longer sees the editor open until release. This is the sole user-visible change to
existing Week click behaviour and is consistent with the timed grid. Recorded here so it is not
re-discovered as a regression during review.

**R-5 — column tinting now follows the live multi-day preview.** `Grid.tsx:84-89` pipes the store
draft through `positionAllDayDraftEvent` for `withAllDayColumnTints`, so every spanned column tints
during the drag. No code change, no test change; noted so reviewers read it as intended behaviour.
