# Change Plan — Multi-day drag-to-select in the week all-day row

- **Run:** `20260819-212923-feature-extend-weekbody-multiday-drag`
- **Mode:** brownfield · **Intent:** feature-extend
- **Baseline:** git `4189de13`, `bun test:web` = 2298 pass / 0 fail / 302 files
- **Stack:** React 18 + TypeScript + Zustand + bun test, `packages/web` only

No `## BLOCKER — file outside allowlist` section. Everything this plan needs is inside the
13-path write contract, and only 8 of the 13 are actually written.

---

## 1. Summary of the delta

Extend `useAllDayDraftCreation` from a click-only `mousedown` handler into an **escalating**
gesture: the mousedown still commits today's one-day draft synchronously (non-negotiable — the
existing test fires `mousedown` with no `mouseup`), and if the pointer later crosses a 4px
threshold **and resolves to a different day**, the hook writes a live `"creating"` preview and
re-commits the spanning draft through the same callback on `mouseup`. New pure module
`all-day.create.ts` owns the day-range math; new week binding `useAllDayGridDraftCreation.ts`
absorbs `AllDayRow.tsx`'s inline option object.
Deliberately unchanged: the hook's bare-function return type, `DayCalendarGrid.tsx`,
`AllDayEvents.tsx`, `all-day-draft.position.ts`, the draft store, and every rendering path.

---

## 2. Verification of the zero-rendering-change finding

**The finding holds. `AllDayEvents.tsx` and `grid/layout/all-day-draft.position.ts` need zero
changes.** Evidence chain, end to end:

| Link | File:line | What it proves |
|---|---|---|
| Preview activity already exists | `events/stores/draft.store.ts:9-10` | `"creating"` is a member of `Activity_DraftEvent`, documented as "a drag-create gesture is live and `gridDraft` is its running preview". |
| `setGridDraft` is identity-preserving per move | `draft.store.ts:104-127` | `isUnchanged` branch reuses the same `status` object when `isDrafting && eventType` match — satisfies NFR-7 with no new code. |
| Week draft portal renders from the store, not from form state | `Week/components/Draft/Draft.tsx:30-31,69-85` | `Draft` renders `GridDraft` whenever `state.draft` is non-null. `useDraftState.ts:106` sources `draft` from `useDraftStore(selectGridDraft)`. `isFormOpen` gates nothing here. |
| Portal host is the all-day row's own div | `common/utils/draft/draft.util.ts:108-111` → `all-day-draft.position.ts:14-22` → `AllDayEvents.tsx:89-92` | `getDraftContainer` routes any `isDraftRenderedInAllDayRow` draft into `getElemById(ID_GRID_EVENTS_ALLDAY)`, which is exactly the `<div id={ID_GRID_EVENTS_ALLDAY}>` `AllDayEvents.tsx` already renders. `AllDayEvents` is the **host**, not a participant — it needs no prop, no branch, no change. |
| `"creating"` is already a first-class render mode | `GridDraft.tsx:59,90` | `const isCreating = useDraftStore(selectDraftActivity) === "creating"` and `motionMode = isResizing \|\| isCreating ? "resizing" : ...`. Already written for drag-create. |
| All-day routing already branches on schedule kind | `GridDraft.tsx:92,103-104,143-163` | `rendersInAllDayRow` → renders `AllDayEventMemo` with `weekDays={weekProps.component.weekDays}`. |
| Multi-day geometry is proven, not hypothetical | `AllDayEvent.tsx:44-52` → `grid/layout/event.position.ts:117-131` | `getAllDayEventPosition` computes `startIndex`/`endIndex` from the event's date span and sums `colWidths` between them (`sumWidthsBetween`, lines 195-207). A 3-day draft over `colWidths: [100 × 7]` yields `left = 200`, `width = 290`. The existing `GridDraft.test.tsx:133-150` pins the 1-day case (`left: "200px"`, `width: "90px"`) against the identical code path. |
| Draft row assignment already handles the draft | `all-day-draft.position.ts:45-86` | `positionAllDayDraftEvent` inserts/updates the draft into the row-assignment pass; called from `Draft.tsx:39-46` on every `draft` change. Reacts to a growing span for free. |

Two secondary confirmations:

- The draft is built with `clientId: undefined` today (`useAllDayDraftCreation.ts:53-57`), so
  `getGridDraftId` → `undefined` and `AllDayEvents.tsx:62-63`'s `draftId` filter is inert. **This
  plan keeps `clientId` undefined** (does *not* copy `useTimedDraftCreation`'s
  `createObjectIdString()`), precisely so no filter/keying behavior in `AllDayEvents.tsx` shifts.
- `AllDayEvents.tsx:93` gates the list on `!isLoadingWeekView`; the portal'd draft is outside that
  list and unaffected by query state.

### Contingency trigger — the only thing that would force an edit

Touch `AllDayEvents.tsx` / `all-day-draft.position.ts` **only if** a rendered multi-day preview
comes out at `width: 0` / `left: 0` in a real week render. That has exactly one cause:
`getVisibleAllDaySpan` (`event.position.ts:146-171`) returning `null`, which happens when the
draft's `startDate`/`endDate` strings do not match a `visibleDates[].date` day. The guard against
it is FR-5: build every date through `dayjs(str)` + `YEAR_MONTH_DAY_FORMAT`, never
`new Date("YYYY-MM-DD")`. If codegen honors FR-5, this trigger cannot fire.
**If it fires, stop and raise it — do not silently patch the layout module.**

---

## 3. Per-file plan

### 3.1 `packages/web/src/interaction/interaction.constants.ts` — **EDIT** (`patch_apply`)

Extend the file-header doc comment and append one constant. Do not reorder or retype anything else.

Doc comment: after the existing sentence ending `they measure different products of the gesture.`,
add a paragraph:

> `ALLDAY_DRAFT_CREATE_MOVE_THRESHOLD_PX` (4) is the all-day row's analogue of the timed value and
> is deliberately a *separate* constant even though the numbers currently match: the timed gate
> measures duration intent along the vertical minute axis, this one measures day-span intent along
> the horizontal column axis. They will move independently. Do not unify them.

Appended export:

```ts
export const ALLDAY_DRAFT_CREATE_MOVE_THRESHOLD_PX = 4;
```

**Why 4** (resolves OQ-1 per the Gate-1 decision): the day-resolution step collapses any sub-column
movement to the single-day result, and §3.4's preview gate additionally requires the *resolved day*
to change, so an eager pixel threshold costs nothing visible. 4 is the smallest value that still
rejects click jitter.

### 3.2 `packages/web/src/grid/interaction/math/all-day.create.ts` — **NEW**

Pure, no React, no DOM. Matches the folder's house style (named `const` arrow exports, exported
input/output interfaces, no default export — see `all-day.drag.ts`, `snap.ts`).

```ts
import { YEAR_MONTH_DAY_FORMAT } from "@core/constants/date.constants";
import dayjs from "@core/util/date/dayjs";

export interface AllDayCreateRange {
  /** Inclusive first day, `YYYY-MM-DD`. */
  startDate: string;
  /** Exclusive end day, `YYYY-MM-DD` — matches allDayGridSchedule's half-open convention. */
  endDate: string;
}

export const getAllDayCreateRange = (
  anchorDate: string,
  pointerDate: string,
): AllDayCreateRange;
```

Implementation contract:

1. `const anchor = dayjs(anchorDate); const pointer = dayjs(pointerDate);`
2. `const isForward = !pointer.isBefore(anchor, "day");`
3. `const start = isForward ? anchor : pointer;` / `const end = isForward ? pointer : anchor;`
4. return `{ startDate: start.format(YEAR_MONTH_DAY_FORMAT), endDate: end.add(1, "day").format(YEAR_MONTH_DAY_FORMAT) }`

No clamping (FR-4) — `useGridCoordinates.getVisibleDateIndexByX` (`useGridCoordinates.ts:33`)
already clamps the column index into `[0, visibleDates.length - 1]`, so the injected resolver hands
this function an already-clamped day. No `new Date(...)` anywhere (FR-5). Same-day input returns
`{ anchor, anchor + 1 day }`, byte-identical to the current click path (FR-3).

### 3.3 `packages/web/src/grid/interaction/math/all-day.create.test.ts` — **NEW**

See §7.1.

### 3.4 `packages/web/src/grid/hooks/useAllDayDraftCreation.ts` — **EDIT** (`existing_file_edit`)

**Exported surface is unchanged** (see §5):

```ts
interface UseAllDayDraftCreationOptions {
  getStartDate: (clientX: number, clientY: number) => string;
  onCreateDraft?: (event: CompassEvent) => void;
  onCreateGridDraft?: (draft: GridEventDraft) => void;
}

export const useAllDayDraftCreation: (
  options: UseAllDayDraftCreationOptions,
) => (event: ReactMouseEvent<HTMLElement>, calendarId?: CalendarId | null) => void;
```

New imports: `useEffect`, `useRef` (from `react`), `getAllDayCreateRange` from
`@web/grid/interaction/math/all-day.create`, `ALLDAY_DRAFT_CREATE_MOVE_THRESHOLD_PX` from
`@web/interaction/interaction.constants`, `hasExceededInteractionMoveThreshold` from
`@web/interaction/interaction.pointer`. Drop the now-unused direct `dayjs` /
`YEAR_MONTH_DAY_FORMAT` imports (the math module owns that). `replaceGridDraftSchedule` is **not**
used — each preview frame builds a fresh draft via `createGridEventDraft`, because the all-day
draft carries no `clientId` to preserve.

Module-private type, mirroring `useTimedDraftCreation.ts:23-25`:

```ts
interface AllDayDraftCreationGesture {
  cancel(): void;
}
```

Hook body, in order:

```ts
const isDrafting = useDraftStore(selectIsDrafting);
const gestureRef = useRef<AllDayDraftCreationGesture | null>(null);

useEffect(() => {
  return () => {
    gestureRef.current?.cancel();
  };
}, []);
```

Returned handler, in order (the first five steps are byte-for-byte today's behavior — FR-12, FR-13):

```
1. if (isRightClick(event)) return;                       // before preventDefault (FR-12)
2. event.preventDefault(); event.stopPropagation();
3. if (isDrafting) { draftActions.discard(); return; }    // (FR-13) — no listeners installed
4. gestureRef.current?.cancel();                          // supersede any stale gesture
5. const anchorPoint = { x: event.clientX, y: event.clientY };
   const anchorDate  = getStartDate(event.clientX, event.clientY);
6. let hasMoved = false, isCancelled = false, isFinished = false, isPreviewStarted = false;
7. …closures (below)…
8. install listeners, set gestureRef.current = { cancel }
9. commit(buildDraft(anchorDate));                        // LAST statement — today's click commit
```

Closures:

| Name | Body |
|---|---|
| `buildDraft(pointerDate: string): GridEventDraft` | `const { startDate, endDate } = getAllDayCreateRange(anchorDate, pointerDate);` → `createGridEventDraft(allDayGridSchedule(startDate, endDate), undefined, calendarId)` |
| `commit(draft: GridEventDraft): void` | `if (onCreateGridDraft) { onCreateGridDraft(draft); return; } onCreateDraft?.(gridEventDraftToSchemaEvent(draft));` — the *existing* branch, lifted verbatim |
| `resolvePointerDate(mouseEvent: MouseEvent): string` | `getStartDate(mouseEvent.clientX, anchorPoint.y)` — **live X, frozen Y**. See note below. |
| `cleanup(): void` | removes all four window listeners with matching capture flags, then `gestureRef.current = null` |
| `previewDraft(mouseEvent)` | `const pointerDate = resolvePointerDate(mouseEvent); if (!isPreviewStarted && pointerDate === anchorDate) return; const next = buildDraft(pointerDate); if (isPreviewStarted) { draftActions.setGridDraft(next); return; } isPreviewStarted = true; draftActions.startGridDraft({ activity: "creating", draft: next });` |
| `finish(mouseEvent)` (fn decl) | `if (isFinished \|\| isCancelled) return; isFinished = true; cleanup(); if (!isPreviewStarted) return; mouseEvent.preventDefault(); commit(buildDraft(resolvePointerDate(mouseEvent)));` |
| `cancel()` (fn decl) | `if (isFinished \|\| isCancelled) return; isCancelled = true; cleanup(); if (isPreviewStarted) draftActions.discard();` |
| `handleMouseMove(mouseEvent)` (fn decl) | `if (isFinished \|\| isCancelled) return; if (mouseEvent.buttons !== 1) { finish(mouseEvent); return; } if (!hasMoved && !hasExceededInteractionMoveThreshold({ x: mouseEvent.clientX, y: mouseEvent.clientY }, anchorPoint, ALLDAY_DRAFT_CREATE_MOVE_THRESHOLD_PX)) return; hasMoved = true; previewDraft(mouseEvent);` |
| `handleMouseUp(mouseEvent)` (fn decl) | `finish(mouseEvent);` |
| `handleKeyDown(keyboardEvent: KeyboardEvent)` (fn decl) | `if (keyboardEvent.key !== "Escape") return; if (isPreviewStarted) { keyboardEvent.preventDefault(); keyboardEvent.stopPropagation(); } cancel();` |
| `handleWindowBlur()` (fn decl) | `cancel();` |

Listener registration (flags must match `cleanup()` exactly — AC-6 pair-counts them):

```ts
window.addEventListener("mousemove", handleMouseMove, true);
window.addEventListener("mouseup", handleMouseUp, true);
window.addEventListener("keydown", handleKeyDown, true);   // FR-15 — divergence from timed
window.addEventListener("blur", handleWindowBlur);         // no capture flag, mirrors timed
```

Three decisions embedded above that a codegen model must not "fix":

1. **The mousedown commit stays.** `useTimedDraftCreation` commits only on `mouseup`. This hook
   cannot: `useAllDayDraftCreation.test.tsx:63-70` fires `mousedown` with no `mouseup` and
   `waitFor`s a commit. AC-4 requires that test unmodified, so the click commit is load-bearing.
   A drag *supersedes* it with a second `commit()` on release; a click never produces a second call.
2. **`finish()` calls `preventDefault()` but NOT `stopPropagation()`.** `useTimedDraftCreation.ts:166`
   calls both. Diverging here is required: Week's form is opened by `useGridMouseUp`
   (`Week/components/Draft/grid/hooks/useGridMouseUp.ts:88`, a bubble-phase listener on `#root`),
   and a `stopPropagation()` at window-capture would swallow it — the editor would never open after
   a drag-create, contradicting intent-brief behavior #5. `useEventListener.ts:15-23` keeps the
   handler in a ref, but React 18 has not flushed the re-render yet when the same native dispatch
   reaches `#root`, so that handler still sees `draft` non-null / `isDrafting` true and calls
   `setFormOpen(true)` against the *already-committed final* draft. Verified against
   `useGridMouseUp.ts:20-40`: `isNew` → `shouldOpenForm` → `setFormOpen(true)`.
3. **The preview gate is a resolved-day change, not just a pixel threshold.** Pixels alone would
   make the Day view (one date, N calendar columns — `DayCalendarGrid.tsx:249-250` ignores `clientY`
   and returns `dateInView`) start a `"creating"` preview on any 5px wobble; `startGridDraft` sets
   `isFormOpen: false` (`draft.store.ts:92`), so the Day form would flash closed then reopen.
   Gating on `pointerDate !== anchorDate` makes the Day view provably identical to today
   (FR-18): the range can never change there, so `isPreviewStarted` never flips, no store write
   happens, and `finish()` returns before the second commit.

**Frozen-Y note (`resolvePointerDate`):** the move handler passes `anchorPoint.y`, not
`mouseEvent.clientY`. Reason: `useGridCoordinates.getDateByXY` (`useGridCoordinates.ts:47-51`) adds
`getMinuteByY(y)` minutes to the column's date. A pointer dragged down out of the all-day strip into
a scrolled timed grid can accumulate ≥ 1440 minutes and silently resolve to the *next* day. Freezing
Y at the mousedown value locks the gesture to the horizontal axis (which is the whole feature) and
costs nothing: the all-day row sits above `mainGrid.top`, so `getMinuteByY` already clamps to 0
there (`useGridCoordinates.ts:45`). The threshold check still uses the live `clientY` so a purely
vertical nudge sets `hasMoved` — it just resolves to the same day and starts no preview.

### 3.5 `packages/web/src/grid/hooks/useAllDayDraftCreation.test.tsx` — **EDIT** (additive only)

Strictly append. Lines 1-110 stay byte-identical (AC-4). See §7.2.

### 3.6 `packages/web/src/views/Week/hooks/grid/useAllDayGridDraftCreation.ts` — **NEW**

Resolves OQ-2 = **add it**. Justification: `AllDayRow.tsx` currently carries the option object
inline (lines 48-61), and the timed pair sets the house pattern
(`useTimedGridDraftCreation.ts`, 20 lines). Extracting it also gives the week binding its own test
surface, which is the cheapest place to assert FR-10's "never stranded at `creating`" without
mounting the whole `AllDayRow` provider stack.

Mirrors `useTimedGridDraftCreation.ts` exactly, including its sibling-relative type imports:

```ts
import { YEAR_MONTH_DAY_FORMAT } from "@core/constants/date.constants";
import { type GridEventDraft } from "@web/events/event-draft.types";
import { draftActions } from "@web/events/stores/draft.store";
import { useAllDayDraftCreation } from "@web/grid/hooks/useAllDayDraftCreation";
import { type WeekProps } from "../useWeek";
import { type DateCalcs } from "./useDateCalcs";

export const useAllDayGridDraftCreation = ({
  dateCalcs,
  weekProps,
}: {
  dateCalcs: DateCalcs;
  weekProps: WeekProps;
}) =>
  useAllDayDraftCreation({
    getStartDate: (clientX: number, clientY: number) =>
      dateCalcs.getDateStrByXY(
        clientX,
        clientY,
        weekProps.component.startOfView,
        YEAR_MONTH_DAY_FORMAT,
      ),
    onCreateGridDraft: (draft: GridEventDraft) => {
      draftActions.startGridDraft({ activity: "gridClick", draft });
    },
  });
```

Return type: `(event: ReactMouseEvent<HTMLElement>, calendarId?: CalendarId | null) => void` —
the bare function, inherited.

Note on `startOfView`: `AllDayRow.tsx` passes `weekProps.query.startOfView` today; this hook passes
`weekProps.component.startOfView` to mirror `useTimedGridDraftCreation.ts:16`. Behaviorally
identical — `useDateCalcs.getDateStrByXY` names the parameter `_firstDayInView` and never reads it
(`useDateCalcs.ts:25-32`).

### 3.7 `packages/web/src/views/Week/hooks/grid/useAllDayGridDraftCreation.test.tsx` — **NEW**

See §7.3.

### 3.8 `packages/web/src/views/Week/components/Grid/AllDayRow/AllDayRow.tsx` — **EDIT** (`patch_apply`)

Framework-owned wiring — the paired packet for §3.6. Surgical:

- **Remove** lines 48-61: `getAllDayDraftStartDate`, `openAllDayDraft`, and the
  `useAllDayDraftCreation({...})` call.
- **Insert** in their place:
  ```ts
  const onMouseDown = useAllDayGridDraftCreation({ dateCalcs, weekProps });
  ```
- **Remove** imports that become unused: `type GridEventDraft` (line 9), `draftActions` (line 11),
  `useAllDayDraftCreation` (line 13).
- **Add** import: `import { useAllDayGridDraftCreation } from "@web/views/Week/hooks/grid/useAllDayGridDraftCreation";`
- **Keep** `YEAR_MONTH_DAY_FORMAT` (still used at line 146) and the
  `const { endOfView, startOfView } = weekProps.query;` destructure (still used at lines 44-47).
- Nothing else changes. `AllDayRowRenderProps.onAllDayMouseDown`, `AllDayRowChildren`,
  `AllDayRowCalendar`, and `useAllDayEventsLayer` are untouched; the prop type
  `(event: MouseEvent<HTMLElement>) => void` still accepts the hook's return value (an extra
  optional parameter is assignable), exactly as today.

### 3.9 Allowlisted but **intentionally not written** (5 files)

| Path | Why not |
|---|---|
| `views/Week/components/Grid/AllDayRow/AllDayEvents.tsx` | §2. It is the portal *host*; the preview mounts into its `<div id={ID_GRID_EVENTS_ALLDAY}>` with no prop or branch. |
| `grid/layout/all-day-draft.position.ts` | §2. `positionAllDayDraftEvent` / `isDraftRenderedInAllDayRow` already handle a growing all-day span. |
| `grid/layout/all-day-draft.position.test.ts` | Module unchanged; adding tests to it would only re-assert existing behavior. |
| `views/Week/components/Grid/AllDayRow/AllDayRow.test.tsx` | The one-line binding is already covered by `useAllDayGridDraftCreation.test.tsx`. A real `AllDayRow` render pulls `useWeekEventViewModel` (react-query), `useCalendarLookup`, and `useWeekEventRegistrationRef` — a large provider harness whose only new assertion is "the hook is called". Net risk to the 2298 baseline exceeds its value. |
| `views/Day/components/Calendar/DayCalendarGrid.tsx` | Zero change required — see §5. |

---

## 4. Gesture state machine

**Flags** (all closure-local per gesture, never React state, never store state):

| Flag | Meaning | Set by |
|---|---|---|
| `hasMoved` | pixel threshold crossed at least once | `handleMouseMove` |
| `isPreviewStarted` | a `"creating"` draft has been written to the store by *this* gesture | `previewDraft` |
| `isFinished` | terminal, committed | `finish` |
| `isCancelled` | terminal, aborted | `cancel` |

**Listener set** (installed together at mousedown, removed together by the single `cleanup()`):
`mousemove`@window/capture, `mouseup`@window/capture, `keydown`@window/capture, `blur`@window/bubble.
Plus `gestureRef.current` nulled by the same `cleanup()`, and the `useEffect` unmount cleanup that
calls `gestureRef.current?.cancel()`.

| # | Event | Guard | Action | Listener teardown |
|---|---|---|---|---|
| 1 | `mousedown`, right button | `isRightClick(event)` | `return` **before** `preventDefault`/`stopPropagation` — event reaches the parent | none installed |
| 2 | `mousedown`, a draft is already open | `isDrafting` (after `preventDefault`+`stopPropagation`) | `draftActions.discard(); return` — no replacement draft | none installed |
| 3 | `mousedown`, left button, no open draft | — | `preventDefault`, `stopPropagation`, cancel stale gesture, install 4 listeners, `commit(buildDraft(anchorDate))` | — (installed) |
| 4 | `mousemove`, below threshold | `!hasMoved && !hasExceededInteractionMoveThreshold(...)` | `return` — nothing written | none |
| 5 | `mousemove`, threshold crossed, same resolved day | `!isPreviewStarted && pointerDate === anchorDate` | `hasMoved = true`; `return` from `previewDraft` — **no store write** | none |
| 6 | `mousemove`, threshold crossed, new resolved day, first time | `!isPreviewStarted` | `isPreviewStarted = true`; `draftActions.startGridDraft({ activity: "creating", draft })` | none |
| 7 | `mousemove`, threshold crossed, preview live | `isPreviewStarted` | `draftActions.setGridDraft(draft)` (identity-preserving `status`, NFR-7) | none |
| 8 | `mousemove`, `buttons !== 1` | any | `finish(mouseEvent)` → rows 9 or 10 | **all 4 removed** |
| 9 | `mouseup`, threshold never met (or never left the anchor day) | `!isPreviewStarted` | `isFinished = true`; `cleanup()`; **return** — no second commit, no `preventDefault`, no `stopPropagation` → the mouseup bubbles to `#root` and Week's `useGridMouseUp` opens the form exactly as today | **all 4 removed** |
| 10 | `mouseup`, preview live | `isPreviewStarted` | `isFinished = true`; `cleanup()`; `preventDefault()`; `commit(buildDraft(pointerDate))` → callback sets the final activity (`"gridClick"` / `openGridDraftForm`), never stranded at `"creating"` | **all 4 removed** |
| 11 | `keydown` `Escape`, preview live | `isPreviewStarted` | `preventDefault()`, `stopPropagation()`, `isCancelled = true`, `cleanup()`, `draftActions.discard()` → `gridDraft === null` | **all 4 removed** |
| 12 | `keydown` `Escape`, no preview | `!isPreviewStarted` | `isCancelled = true`, `cleanup()`, **no** `discard()` (FR-11: must not clobber the click's draft), no `preventDefault` — other Escape handlers still see it | **all 4 removed** |
| 13 | `keydown`, any other key | `key !== "Escape"` | `return` | none |
| 14 | window `blur`, preview live | `isPreviewStarted` | `cancel()` → `cleanup()` + `discard()` | **all 4 removed** |
| 15 | window `blur`, no preview | `!isPreviewStarted` | `cancel()` → `cleanup()` only | **all 4 removed** |
| 16 | component unmount mid-gesture | `gestureRef.current !== null` | `useEffect` teardown → `gestureRef.current.cancel()` → same as rows 14/15 | **all 4 removed** |
| 17 | any handler after a terminal state | `isFinished \|\| isCancelled` | `return` — `finish`/`cancel`/`handleMouseMove` all short-circuit; `cleanup()` can never run twice | already removed |

`cleanup()` is idempotent by construction (`removeEventListener` on an absent listener is a no-op),
and rows 9-16 each pass through exactly one of `finish`/`cancel`, both of which are guarded by
row 17. Net add/remove balance per listener type is therefore always 0.

---

## 5. Hook return-type decision

**Decision: keep the bare function `(event: ReactMouseEvent<HTMLElement>, calendarId?: CalendarId | null) => void`. Do not move to `useTimedDraftCreation`'s `{ startTimedDraftCreation }` object shape.**

**Rationale — this is forced, not preferred.** `useAllDayDraftCreation.test.tsx:35-46` does:

```tsx
const onMouseDown = useAllDayDraftCreation({ getStartDate: () => "2026-05-20", onCreateGridDraft });
…
<button onMouseDown={onMouseDown} type="button">
```

An object return would require editing that harness, which all three existing tests share.
**AC-4 requires those three tests to pass unmodified.** Symmetry with the timed hook loses to a
hard acceptance criterion.

**Tradeoff accepted:** the all-day hook and the timed hook now have different return shapes.
Mitigation: the asymmetry is documented in the hook's own header comment, and the *binding* hooks
(`useTimedGridDraftCreation` / `useAllDayGridDraftCreation`) are structurally identical, which is
where readers actually look.

**Consequence per call site — both stay consistent because neither changes its binding style:**

| Call site | Today | After | Delta |
|---|---|---|---|
| `AllDayRow.tsx:58-68,143` | `const onMouseDown = useAllDayDraftCreation({...})` then `onMouseDown={onAllDayMouseDown}` | `const onMouseDown = useAllDayGridDraftCreation({ dateCalcs, weekProps })`, same binding | option object moves into the binding hook; **the shape passed to `onMouseDown` is unchanged** |
| `DayCalendarGrid.tsx:331-334,367-372` | `const onAllDayMouseDown = useAllDayDraftCreation({...})`; `createOnCalendarSurface(event, onAllDayMouseDown)` where the param is typed `(event, calendarId: CalendarId \| null) => void` | identical | **zero edits.** The bare function is still directly assignable to `createOnCalendarSurface`'s second parameter, so `handleAllDayMouseDown`'s `useCallback` deps (line 371) and the writable-calendar guard (FR-17) are untouched. |

Had the object shape been chosen, `DayCalendarGrid.tsx:331` would have become
`const { startAllDayDraftCreation } = useAllDayDraftCreation({...})` and line 369 would have had to
pass `startAllDayDraftCreation` — plus the existing test harness rewrite. Both call sites would have
churned for zero behavioral gain.

---

## 6. Data flow for one drag

Week view, pointer pressed in the Wed column and released in the Fri column.

| Step | Call | Store effect |
|---|---|---|
| 1 | `AllDayGridRow` `onMouseDown` → `AllDayRow`'s `onMouseDown` → the closure returned by `useAllDayDraftCreation` | — |
| 2 | `isRightClick(event)` → false; `preventDefault()`; `stopPropagation()` | — |
| 3 | `useDraftStore(selectIsDrafting)` → false, so no `discard()` | — |
| 4 | `getStartDate(clientX, clientY)` → `useAllDayGridDraftCreation`'s lambda → `dateCalcs.getDateStrByXY(x, y, startOfView, YEAR_MONTH_DAY_FORMAT)` → `useGridCoordinates.getDateByXY` → **`anchorDate = "2026-05-20"`** | — |
| 5 | 4 window listeners installed; `gestureRef.current = { cancel }` | — |
| 6 | `commit(buildDraft("2026-05-20"))` → `getAllDayCreateRange("2026-05-20","2026-05-20")` → `{start:"2026-05-20", end:"2026-05-21"}` → `allDayGridSchedule` → `createGridEventDraft(schedule, undefined, null)` → `onCreateGridDraft` → `draftActions.startGridDraft({ activity: "gridClick", draft })` | `gridDraft` = 1-day; `status.activity = "gridClick"`; `isFormOpen: false` |
| 7 | move #1, `Δx = 3px` → `hasExceededInteractionMoveThreshold` false → return | unchanged |
| 8 | move #2, `Δx = 60px` → `hasMoved = true`; `resolvePointerDate` (live X, frozen Y) → `"2026-05-21"` ≠ anchor → `buildDraft` → `{start:"2026-05-20", end:"2026-05-22"}` → `draftActions.startGridDraft({ activity: "creating", draft })` | `gridDraft` = 2-day; `activity = "creating"` |
| 9 | React re-render → `useDraftState` `selectGridDraft` → `Draft.tsx` `positionAllDayDraftEvent` → `createPortal(<GridDraft/>, getElemById(ID_GRID_EVENTS_ALLDAY))` → `AllDayEventMemo` → `getAllDayEventPosition` → 2-column bar | — |
| 10 | move #3..#N, `"2026-05-22"` → `draftActions.setGridDraft(buildDraft("2026-05-22"))` → `{start:"2026-05-20", end:"2026-05-23"}`; `status` object reused via the `isUnchanged` branch | `gridDraft` = 3-day; `status` **same reference** |
| 11 | `mouseup` @ window capture → `handleMouseUp` → `finish` → `isFinished = true` → `cleanup()` removes `mousemove`/`mouseup`/`keydown`/`blur` and nulls `gestureRef` | — |
| 12 | `isPreviewStarted` true → `mouseEvent.preventDefault()` (no `stopPropagation`) → `commit(buildDraft("2026-05-22"))` → `draftActions.startGridDraft({ activity: "gridClick", draft })` | `gridDraft` = final 3-day; `activity = "gridClick"` |
| 13 | same native dispatch bubbles to `#root` → `useGridMouseUp.onGridMouseUp` (pre-flush closure: `draft` non-null, `isDrafting` true) → `commitOnMouseUp(ALLDAY)` → `isNew` → `draftActions.setFormOpen(true)` | `isFormOpen: true` — editor opens on the final range |

---

## 7. Test plan

Idiom for all three files: `import { describe, expect, it } from "bun:test";` (add `mock`,
`afterEach`, `beforeEach` as used) placed **after** the value imports, matching
`useAllDayDraftCreation.test.tsx:13`. `@testing-library/react` for rendering; no CSS or `data-*`
locators; dates via `dayjs` / `YEAR_MONTH_DAY_FORMAT`, never `new Date("YYYY-MM-DD")` in new code.

### 7.1 `grid/interaction/math/all-day.create.test.ts` — NEW (AC-2)

Pure unit tests, no React. A local `resolveDay` helper reproduces
`getVisibleDateIndexByX`'s clamp over a fixed 7-day week
(`["2026-05-18" … "2026-05-24"]`, index = `Math.max(0, Math.min(raw, 6))`) so the
"clamped at the edges" cases exercise the *composed* behavior without adding a second clamp (FR-4).

| `it(...)` | Asserts |
|---|---|
| `"spans anchor through pointer with an exclusive end on a forward drag"` | `getAllDayCreateRange("2026-05-20","2026-05-22")` → `{ startDate: "2026-05-20", endDate: "2026-05-23" }` |
| `"normalizes a reverse drag so the earlier day is the start"` | `getAllDayCreateRange("2026-05-22","2026-05-20")` → `{ startDate: "2026-05-20", endDate: "2026-05-23" }` (FR-2) |
| `"returns the click-path single-day range when the pointer stays on the anchor day"` | `getAllDayCreateRange("2026-05-20","2026-05-20")` → `{ startDate: "2026-05-20", endDate: "2026-05-21" }` (FR-3) |
| `"matches the click path exactly for every day of a week"` | loops the 7 fixture days; each same-day call equals `dayjs(day).add(1,"day").format(YEAR_MONTH_DAY_FORMAT)` as the end |
| `"clamps to the first visible day when the pointer is dragged past the week's left edge"` | `getAllDayCreateRange("2026-05-20", resolveDay(-4))` → `{ startDate: "2026-05-18", endDate: "2026-05-21" }` (FR-4) |
| `"clamps to the last visible day when the pointer is dragged past the week's right edge"` | `getAllDayCreateRange("2026-05-20", resolveDay(99))` → `{ startDate: "2026-05-20", endDate: "2026-05-25" }` (FR-4) |
| `"crosses a month boundary without shifting the day"` | `getAllDayCreateRange("2026-05-31","2026-06-02")` → `{ startDate: "2026-05-31", endDate: "2026-06-03" }` |
| `"crosses a spring-forward DST boundary without shifting the day"` | `getAllDayCreateRange("2026-03-07","2026-03-09")` → `{ startDate: "2026-03-07", endDate: "2026-03-10" }` (FR-5 — proves no UTC-midnight drift) |

### 7.2 `grid/hooks/useAllDayDraftCreation.test.tsx` — EDIT, append only (AC-3, AC-4, AC-5, AC-6)

**Lines 1-110 unchanged.** Appended below line 110:

- `afterEach(() => { draftActions.discard(); });` — a *second* `afterEach`, registered after the
  existing `afterEach(cleanup)`. Both run. Required because the new tests write to the store; the
  existing three never do (their `onCreateGridDraft` is a bare `mock()`).
- `const COLUMN_DATES = ["2026-05-20", "2026-05-21", "2026-05-22", "2026-05-23"];` and
  `const dateAtX = (clientX: number) => COLUMN_DATES[Math.max(0, Math.min(Math.floor(clientX / 100), COLUMN_DATES.length - 1))];`
  — a fake resolver whose clamp mirrors `getVisibleDateIndexByX`.
- `renderDragHarness({ onCreateGridDraft = writes to the store via draftActions.startGridDraft({ activity: "gridClick", draft }) })`
  — a **new** harness (the existing `renderHarness` is untouched). Same `<button>` shape,
  `getStartDate: (clientX) => dateAtX(clientX)`. Returns `{ onCreateGridDraft, unmount }`.
- `trackWindowListeners()` — swaps `window.addEventListener` / `window.removeEventListener` for
  counting wrappers that delegate to the originals, keyed by event type; exposes
  `balanceOf(type)` and `restore()`. **Installed after `render()`, restored in the test body** so
  RTL/React's own listeners are never counted.
- All new cases live in a **sibling** `describe("useAllDayDraftCreation — drag to create", ...)`.

| `it(...)` | Simulation | Asserts | AC |
|---|---|---|---|
| `"commits a draft spanning the dragged day columns"` | `mouseDown` x=10 → `mouseMove` window x=150 → x=250 → `mouseUp` x=250 | `onCreateGridDraft` called **twice**; `toHaveBeenLastCalledWith` a schedule of `{ kind:"allDay", start: dayjs("2026-05-20").toDate(), end: dayjs("2026-05-23").toDate() }` | AC-3 |
| `"normalizes a right-to-left drag"` | `mouseDown` x=250 → moves x=150, x=10 → `mouseUp` x=10 | last commit spans `2026-05-20` → `2026-05-23` | AC-3 |
| `"grows and shrinks the live preview on every qualifying move"` | `mouseDown` x=10 → move x=150 → move x=250 → move x=150 | after move 1: `status.activity === "creating"` and `gridDraft` end = `2026-05-22`; after move 2 end = `2026-05-23`; after move 3 end = `2026-05-22`; the `status` object captured after move 2 `toBe` the one after move 3 (NFR-7) | FR-9 |
| `"keeps the single-day result when the drag never leaves the anchor column"` | `mouseDown` x=10 → move x=60 (>4px, same column) → `mouseUp` x=60 | `onCreateGridDraft` called **once**; `status?.activity` never `"creating"`; the one call carries end `2026-05-21` | FR-3 |
| `"ignores movement below the move threshold"` | `mouseDown` x=10 → move x=13 → `mouseUp` x=13 | `onCreateGridDraft` called once; `useDraftStore.getState().status?.activity === "gridClick"` (never `"creating"`) | FR-8 |
| `"finishes the gesture when the primary button is released outside the window"` | `mouseDown` x=10 → move x=250 → move x=250 with `buttons: 0` | `onCreateGridDraft` called twice, last spanning to `2026-05-23`; no further move has any effect | FR-14 |
| `"cancels on Escape mid-drag and leaves no draft in the store"` | `mouseDown` x=10 → move x=250 → `fireEvent.keyDown(window, { key: "Escape" })` | `useDraftStore.getState().gridDraft` is `null`; a subsequent `mouseUp` leaves `onCreateGridDraft` at 1 call | AC-5 |
| `"cancels on window blur mid-drag and leaves no draft in the store"` | `mouseDown` x=10 → move x=250 → `fireEvent.blur(window)` | `gridDraft` is `null`; subsequent `mouseUp` adds no call | AC-5 |
| `"leaves the click draft alone when Escape is pressed before the threshold"` | `mouseDown` x=10 → `keyDown` Escape | `gridDraft` is **not** null (still the 1-day click draft) — proves FR-11's "must not clobber unrelated state" | FR-11 |
| `"removes every window listener after a completed gesture"` | full drag + `mouseUp` | `balanceOf("mousemove") === 0`, `"mouseup" === 0`, `"keydown" === 0`, `"blur" === 0` | AC-6 |
| `"removes every window listener after a cancelled gesture"` | drag + Escape | same four balances are 0 | AC-6 |
| `"removes every window listener when the component unmounts mid-gesture"` | `mouseDown` → 2 moves → `unmount()` | same four balances are 0 **and** `gridDraft` is `null` (the live preview was discarded) | AC-6, FR-11 |

### 7.3 `views/Week/hooks/grid/useAllDayGridDraftCreation.test.tsx` — NEW (AC-3, FR-10)

Component harness in the style of `useAllDayDraftCreation.test.tsx` (no `renderHook`).
`dateCalcs` is a hand-built stub matching `DateCalcs`:
`{ getDateByXY: mock(), getDateStrByXY: mock((x) => dateAtX(x)), getMinuteByY: mock(() => 0), getYByDate: mock(() => 0) } as unknown as DateCalcs`.
`weekProps` is a `{ component: { startOfView, endOfView, weekDays }, query: { startOfView, endOfView } } as WeekProps`
literal built from `dayjs("2026-05-18")`, matching `GridDraft.test.tsx:67-80`.
`afterEach(cleanup)` + `afterEach(() => draftActions.discard())`.

| `it(...)` | Asserts |
|---|---|
| `"asks the week's date calcs for a YYYY-MM-DD day"` | after a `mousedown`, `getDateStrByXY` was called with `(clientX, clientY, weekProps.component.startOfView, YEAR_MONTH_DAY_FORMAT)` |
| `"starts a one-day gridClick draft on a plain press"` | `useDraftStore.getState().gridDraft.values.schedule` is `{ kind:"allDay", start: 2026-05-20, end: 2026-05-21 }`; `status.activity === "gridClick"`; `status.isFormOpen === false` |
| `"commits the dragged span to the store on release"` | after `mousedown` x=10 → moves → `mouseup` x=250: `gridDraft` schedule spans `2026-05-20` → `2026-05-23` |
| `"leaves the store activity at gridClick, never stranded at creating"` | same drag; afterwards `useDraftStore.getState().status?.activity === "gridClick"` (FR-10) |
| `"discards the preview when the gesture is cancelled with Escape"` | drag then Escape → `gridDraft` is `null` |

---

## 8. Packet decomposition hint

| # | Packet | Files | Tier | Depends on |
|---|---|---|---|---|
| P1 | Add the all-day move-threshold constant + extend the standing doc comment | `interaction/interaction.constants.ts` | `mechanical` | — |
| P2 | Pure day-range math + its unit tests | `grid/interaction/math/all-day.create.ts`, `all-day.create.test.ts` | `mechanical` | — |
| P3 | Extend the shared hook into the escalating gesture | `grid/hooks/useAllDayDraftCreation.ts` | **`premium`** | P1, P2 |
| P4 | Append the drag/cancel/teardown suites without touching lines 1-110 | `grid/hooks/useAllDayDraftCreation.test.tsx` | **`premium`** | P3 |
| P5 | Week binding hook | `views/Week/hooks/grid/useAllDayGridDraftCreation.ts` | `mechanical` | P3 |
| P6 | Week binding hook tests | `views/Week/hooks/grid/useAllDayGridDraftCreation.test.tsx` | `mechanical` | P5 |
| P7 | Rewire the week call site (framework-owned wiring, paired with P5) | `views/Week/components/Grid/AllDayRow/AllDayRow.tsx` | `mechanical` | P5 |

Dependency edges: `P1 → P3`, `P2 → P3`, `P3 → P4`, `P3 → P5`, `P5 → P6`, `P5 → P7`.
P1 and P2 are independent and can run in parallel. P6 and P7 are independent of each other.
**P5 and P7 must land in the same run** — P7 deletes the `useAllDayDraftCreation` import that P5's
hook replaces; shipping P7 without P5 leaves `AllDayRow.tsx` referencing a non-existent module.

Why P3 and P4 are `premium`: P3 is the only file where the design diverges from its reference in
three non-obvious ways (mousedown commit retained, no `stopPropagation` on the finish path,
resolved-day preview gate) and where the closure/hoisting order and listener-flag symmetry are
load-bearing. P4 must extend a file while proving three of its lines are untouched, and must get
the listener-spy install/restore window exactly right.

Verification after each packet: `bun type-check`; after P4, P6, P7: `bun test:web`; before
finishing: `bun lint`.

---

## 9. Risks and non-regression watchlist

**The three tests that must pass unmodified** (`grid/hooks/useAllDayDraftCreation.test.tsx`):

| Test (line) | What could break it | Guard in this plan |
|---|---|---|
| `"creates a one-day all-day draft and stops the opening press"` (60) | It fires only `mousedown` and `waitFor`s a commit. **A mouseup-only commit fails it.** Also asserts `fireEvent.mouseDown(...) === false` (needs `preventDefault`) and that a `document` mousedown listener never fires (needs `stopPropagation`). | §3.4 step 9 commits at mousedown; steps 1-2 preserve the guard order verbatim. |
| `"ignores right-click presses"` (84) | Any guard reordering that calls `preventDefault` before `isRightClick`. | §3.4 step 1, FR-12. |
| `"dismisses an existing draft without creating a replacement"` (96) | Moving the `isDrafting` branch after listener installation, or discarding asynchronously. | §3.4 step 3 returns before any listener is installed. |

**Day-view call site (`DayCalendarGrid.tsx`) — zero edits, but three things to watch:**

1. `getAllDayDraftStartDate` (line 249) ignores `clientY` and returns `dateInView`, so
   `pointerDate === anchorDate` always → `isPreviewStarted` never flips → no store preview, no
   second commit, no `preventDefault` on mouseup. Day behavior is bit-identical (FR-18, AC-8).
2. `createOnCalendarSurface` (line 345) resolves the calendar at *mousedown* and the resolved
   `calendarId` is captured in the gesture closure — the writable guard runs before anything else,
   unchanged (FR-17).
3. `handleAllDayMouseDown`'s `useCallback` deps include `onAllDayMouseDown` (line 371), which is a
   fresh closure every render — already true today, so no new re-render churn.

**Other watchlist items:**

- **`useGridMouseUp` interaction (Week).** `Week/components/Draft/grid/hooks/useGridMouseUp.ts:88`
  listens for `mouseup` on `#root` in the bubble phase and is what opens the form. This plan
  deliberately does **not** `stopPropagation()` in `finish()` (§3.4 note 2). If a codegen model
  "restores symmetry" with `useTimedDraftCreation.ts:166` and adds `stopPropagation()`, the editor
  will silently stop opening after a drag-create. No unit test catches this — it is a manual-check
  item and the single most likely regression in this change.
- **Form-open timing after a drag.** Per OQ-3, nothing new opens the form; it opens via the same
  `#root` mouseup path a click uses. If the mouseup lands outside `#root` (pointer released off the
  viewport), the form will not open and the draft stays on the grid. Accepted, matches the timed
  grid.
- **Two `onCreateGridDraft` calls per drag.** Inherent to the mousedown-commit + mouseup-recommit
  design. Harmless for both current callbacks (`startGridDraft` and `openGridDraftForm` are both
  idempotent overwrites), but any *future* callback with side effects (analytics, network) must be
  aware. Documented in the hook's header comment.
- **Vertical pointer travel.** Mitigated inside the hook by freezing Y at the mousedown value
  (§3.4). Do **not** attempt to fix this in `useGridCoordinates.ts` or `useDateCalcs.ts` — both are
  outside the write contract and would turn this into a blocked run.
- **Listener-spy hygiene.** `trackWindowListeners()` must wrap/restore around a single gesture only.
  A leaked wrapper (missing `restore()` on a failing assertion) would corrupt later tests in the
  same file and could perturb the 2298 baseline. Install after `render()`, restore before the last
  assertion or in a `try/finally`.
- **`GridDraft.test.tsx` (5 tests) is not in the allowlist and must not need editing.** This plan
  touches nothing it renders — confirmed in §2.
- **No new draft-store state, no new `Activity_DraftEvent` member, no `package.json`/`bun.lock`
  change, no `.mjs` emitted.** NFR-1, NFR-5, out-of-scope items 5 and 6.

---

## 10. Off-limits reminders

`AGENTS.md`, `bun.lock`, `.sdlc/**`, `.claude/**`, `.cursor/**`, `.codex/**`, `.agents/**`,
`.github/workflows/**`, and the `backend` / `core` / `sync` / `scripts` packages are off-limits.
Two places where this change gets close:

- **`@core/constants/date.constants` and `@core/util/date/dayjs` are imported, never edited.**
  `YEAR_MONTH_DAY_FORMAT` and `dayjs` are consumed as-is (FR-5).
- **`useGridCoordinates.ts` / `useDateCalcs.ts` are read-only context**, not in the write contract.
  FR-4 explicitly forbids adding a second clamp there, and the frozen-Y mitigation (§3.4) exists
  precisely so no edit to those files is ever tempting.

Formatting is Biome-hook-owned (NFR-4): write idiomatic code and let the hook format it. No
`biome-ignore` / `eslint-disable` comments anywhere in this change.
