## Task tp_cg_002 — codegen / react_component
Module: grid-allday-gesture
### Working directory
You are running as an agent inside `/home/sainadh/projects/compass-calendar/compass/compass-calendar`. You may list, read,
edit and create files there, and run commands there. That directory is the
only place you can act; nothing outside it is reachable.
### Instruction
Modify FOUR files in the Compass Calendar repo (bun + TypeScript + React, biome-formatted). A previous packet has ALREADY created packages/web/src/grid/interaction/math/all-day.create.ts (exporting resolveAllDayDayRange, isSameAllDayDayRange, hasExceededAllDayDragThreshold, type AllDayDayRange) and ALREADY added ALLDAY_DRAFT_CREATE_MOVE_THRESHOLD_PX = 8 to packages/web/src/interaction/interaction.constants.ts. READ those two files first and import from them. Do NOT recreate or modify either of them.

1. MODIFY packages/web/src/grid/hooks/useAllDayDraftCreation.ts - add the optional multiDayDrag option and the press-drag-release ESCALATION. Follow the CONTROL FLOW spec input below step by step; it is authoritative.

2. MODIFY packages/web/src/grid/hooks/useAllDayDraftCreation.test.tsx - APPEND ONLY. The three existing tests and the existing renderHarness MUST remain byte-identical; add a new renderDragHarness and the new it() blocks from the TEST TABLE input.

3. MODIFY packages/web/src/views/Week/components/Grid/AllDayRow/AllDayRow.tsx - pass multiDayDrag into useAllDayDraftCreation, sourcing the window from weekProps.component.weekDays.

4. MODIFY docs/frontend/week-drag-interaction.md - APPEND a new section documenting this gesture.

CRITICAL: the press path must still call onCreateGridDraft SYNCHRONOUSLY on mousedown before any listener is armed - an existing test fires mouseDown with NO mouseUp and asserts it was called exactly once. In the new tests every fireEvent.mouseMove MUST pass { buttons: 1 } or the gesture finishes on the first move. Write ONLY these four files.
### Provided excerpts
These are extracts, not whole files. The paths are real — open them in the
working directory when you need more than the excerpt shows.

#### packages/web/src/grid/hooks/useAllDayDraftCreation.ts
_Included because: FILE TO MODIFY - full current contents (66 lines)._

```
import { type MouseEvent as ReactMouseEvent } from "react";
import { YEAR_MONTH_DAY_FORMAT } from "@core/constants/date.constants";
import { type CompassEvent } from "@core/types/compass-event.contracts";
import { type CalendarId } from "@core/types/domain-primitives";
import dayjs from "@core/util/date/dayjs";
import { isRightClick } from "@web/common/utils/mouse/mouse.util";
import { type GridEventDraft } from "@web/events/event-draft.types";
import {
  allDayGridSchedule,
  createGridEventDraft,
  gridEventDraftToSchemaEvent,
} from "@web/events/grid-event-draft.adapter";
import {
  draftActions,
  selectIsDrafting,
  useDraftStore,
} from "@web/events/stores/draft.store";

interface UseAllDayDraftCreationOptions {
  getStartDate: (clientX: number, clientY: number) => string;
  onCreateDraft?: (event: CompassEvent) => void;
  onCreateGridDraft?: (draft: GridEventDraft) => void;
}

export const useAllDayDraftCreation = ({
  getStartDate,
  onCreateDraft,
  onCreateGridDraft,
}: UseAllDayDraftCreationOptions) => {
  const isDrafting = useDraftStore(selectIsDrafting);

  return (
    event: ReactMouseEvent<HTMLElement>,
    calendarId: CalendarId | null = null,
  ) => {
    if (isRightClick(event)) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();

    if (isDrafting) {
      draftActions.discard();
      return;
    }

    const startDate = getStartDate(event.clientX, event.clientY);
    const endDate = dayjs(startDate)
      .add(1, "day")
      .format(YEAR_MONTH_DAY_FORMAT);

    const draft = createGridEventDraft(
      allDayGridSchedule(startDate, endDate),
      undefined,
      calendarId,
    );

    if (onCreateGridDraft) {
      onCreateGridDraft(draft);
      return;
    }

    onCreateDraft?.(gridEventDraftToSchemaEvent(draft));
  };
};

```

#### SPEC/useAllDayDraftCreation.ts control flow (AUTHORITATIVE)
_Included because: Implement EXACTLY this. Step 10's early return is what keeps the existing tests on today's code path._

```
HOOK BODY:
  useAllDayDraftCreation({ getStartDate, multiDayDrag, onCreateDraft, onCreateGridDraft })
    isDrafting = useDraftStore(selectIsDrafting)          // unchanged
    gestureRef = useRef<{ cancel(opts: { revert: boolean }): void } | null>(null)
    useEffect(() => () => gestureRef.current?.cancel({ revert: false }), [])
    return (event, calendarId = null) => { ...handler... }

OPTIONS TYPE gains:
  /** Opt in to multi-day drag. Omit for press-only behaviour (Day view). */
  multiDayDrag?: { getVisibleDates: () => readonly string[] };

HANDLER (mousedown):
 1. if (isRightClick(event)) return;                     // UNCHANGED, still before preventDefault
 2. gestureRef.current?.cancel({ revert: false });       // a new press supersedes a stale gesture
 3. event.preventDefault(); event.stopPropagation();     // UNCHANGED lines
 4. if (isDrafting) { draftActions.discard(); return; }  // UNCHANGED
 5. const anchorDate = getStartDate(event.clientX, event.clientY);
 6. const visibleDates = multiDayDrag?.getVisibleDates();
 7. const pressRange = resolveAllDayDayRange({ anchorDate, pointerDate: anchorDate, visibleDates });
 8. const pressDraft = createGridEventDraft(allDayGridSchedule(pressRange.start, pressRange.end), undefined, calendarId);
    // keep the `undefined` second arg verbatim so clientId generation is unchanged
 9. EMIT SYNCHRONOUSLY, exactly as today, but as if/else (no early return):
    if (onCreateGridDraft) { onCreateGridDraft(pressDraft); }
    else { onCreateDraft?.(gridEventDraftToSchemaEvent(pressDraft)); }
10. if (!multiDayDrag) return;    // <== Day's exit; the existing tests take this path
11. Escalation eligibility ONLY (applied AFTER the press commit, deliberately):
    if (!isEligibleInteractionPointerDown({ altKey: event.altKey, button: event.button,
        ctrlKey: event.ctrlKey, isPrimary: true, metaKey: event.metaKey,
        shiftKey: event.shiftKey })) return;
    // import from @web/interaction/interaction.pointer
12. ARM: pointerStart = { x: event.clientX, y: event.clientY };
    gesture-local: hasMoved=false, isFinished=false, isCancelled=false, lastRange=pressRange;
    window.addEventListener mousemove/mouseup with capture=true, plus blur;
    gestureRef.current = { cancel };

GESTURE-LOCAL HELPERS:
  resolveRangeForPointer(mouseEvent) => resolveAllDayDayRange({
    anchorDate,
    pointerDate: getStartDate(mouseEvent.clientX, pointerStart.y),  // PRESS y, not live y
    visibleDates,
  })
  draftForRange(range) => replaceGridDraftSchedule(pressDraft, allDayGridSchedule(range.start, range.end))
    // import replaceGridDraftSchedule from @web/events/grid-event-draft.adapter
  cleanup() => removeEventListener x3 with matching capture flags; gestureRef.current = null

MOUSEMOVE:
 1. if (isFinished || isCancelled) return;
 2. if (mouseEvent.buttons !== 1) { finish(mouseEvent); return; }
 3. if (!hasMoved && !hasExceededAllDayDragThreshold(mouseEvent.clientX, pointerStart.x, ALLDAY_DRAFT_CREATE_MOVE_THRESHOLD_PX)) return;
 4. hasMoved = true;
 5. const nextRange = resolveRangeForPointer(mouseEvent);
 6. if (isSameAllDayDayRange(nextRange, lastRange)) return;   // dedup within a column
 7. lastRange = nextRange;
 8. draftActions.setGridDraft(draftForRange(nextRange));      // setGridDraft ONLY, never startGridDraft

MOUSEUP -> finish(mouseEvent):
  if (isFinished || isCancelled) return
  isFinished = true
  cleanup()
  if (!hasMoved) return          // <== THE GUARD: a plain click emits NOTHING extra
  mouseEvent.preventDefault(); mouseEvent.stopPropagation();   // only when hasMoved
  const finalRange = resolveRangeForPointer(mouseEvent)
  const finalDraft = draftForRange(finalRange)
  if (onCreateGridDraft) onCreateGridDraft(finalDraft)
  else onCreateDraft?.(gridEventDraftToSchemaEvent(finalDraft))

BLUR -> cancel({ revert: true })
UNMOUNT -> cancel({ revert: false })

cancel({ revert }):
  if (isFinished || isCancelled) return
  isCancelled = true
  cleanup()
  if (revert && hasMoved) draftActions.setGridDraft(pressDraft)   // REVERT, never discard

WHY setGridDraft and not startGridDraft mid-gesture: the press already put a draft in the store via
the consumer's onCreateGridDraft. startGridDraft would rewrite activity to 'creating' and hard-reset
isFormOpen:false, yanking the form shut under the user. setGridDraft carries activity and isFormOpen
through untouched.
WHY revert and not discard on blur: the press is an independently completed user action (in the Day
view it has already opened a form the user may be typing into). Discarding on alt-tab would destroy a
draft the gesture did not create.

Note: dayjs and YEAR_MONTH_DAY_FORMAT may become unused imports in this file once the +1 day
arithmetic moves into resolveAllDayDayRange. Remove any import that is genuinely no longer used.
```

#### packages/web/src/grid/hooks/useAllDayDraftCreation.test.tsx
_Included because: FILE TO MODIFY - APPEND ONLY. Everything shown here must remain BYTE-IDENTICAL; add new code below it. The three existing it() bodies are elided here for brevity but MUST NOT be edited in the real file._

```
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { useEffect } from "react";
import { type GridEventDraft } from "@web/events/event-draft.types";
import { createGridEventDraft } from "@web/events/grid-event-draft.adapter";
import { draftActions, useDraftStore } from "@web/events/stores/draft.store";
import { useAllDayDraftCreation } from "./useAllDayDraftCreation";
import { afterEach, describe, expect, it, mock } from "bun:test";

const existingDraft = createGridEventDraft({
  kind: "allDay",
  start: new Date("2026-05-20"),
  end: new Date("2026-05-21"),
});

const renderHarness = ({
  draft = null,
  onCreateGridDraft = mock(),
  onParentMouseDown = mock(),
}: {
  draft?: GridEventDraft | null;
  onCreateGridDraft?: (draft: GridEventDraft) => void;
  onParentMouseDown?: () => void;
} = {}) => {
  if (draft) {
    draftActions.startGridDraft({ activity: "gridClick", draft });
  }

  const Harness = () => {
    const onMouseDown = useAllDayDraftCreation({
      getStartDate: () => "2026-05-20",
      onCreateGridDraft,
    });

    useEffect(() => {
      document.addEventListener("mousedown", onParentMouseDown);
      return () => document.removeEventListener("mousedown", onParentMouseDown);
    }, []);

    return (
      <button onMouseDown={onMouseDown} type="button">
        Empty all-day space
      </button>
    );
  };

  render(<Harness />);

  return { onCreateGridDraft, onParentMouseDown };
};

afterEach(cleanup);

describe("useAllDayDraftCreation", () => {
  it("creates a one-day all-day draft and stops the opening press", async () => {
    /* EXISTING TEST 1 BODY - DO NOT TOUCH */
  });

  it("ignores right-click presses", () => {
    /* EXISTING TEST 2 BODY - DO NOT TOUCH */
  });

  it("dismisses an existing draft without creating a replacement", async () => {
    /* EXISTING TEST 3 BODY - DO NOT TOUCH */
  });
});
```

#### SPEC/useAllDayDraftCreation.test.tsx additions
_Included because: The new harness and the exact test table to append. Every mouseMove needs { buttons: 1 }._

```
NEW HARNESS renderDragHarness({ multiDayDrag, onCreateGridDraft, getStartDate }) - same button DOM
as the existing harness, but with an x->date map as the default getStartDate:
  x < 100        -> '2026-05-20'
  100 <= x < 200 -> '2026-05-21'
  200 <= x < 300 -> '2026-05-22'
  x >= 300       -> '2026-05-23'
and a default multiDayDrag of
  { getVisibleDates: () => ['2026-05-20','2026-05-21','2026-05-22','2026-05-23'] }
Allow a caller to pass multiDayDrag: undefined explicitly to get the opt-out (Day) wiring.
Move/up events are dispatched on window:
  fireEvent.mouseMove(window, { clientX, buttons: 1 })
  fireEvent.mouseUp(window, { clientX })

TEST TABLE - add each as its own it() block, INSIDE the existing describe or a new one:
| live multi-day preview | press x=50, mouseMove clientX=250 buttons:1 => store gridDraft.values.schedule is {kind:'allDay', start: new Date('2026-05-20'), end: new Date('2026-05-23')} AND onCreateGridDraft still called ONCE (the preview must not re-commit) |
| release commits the span | press x=50, move to 250, then mouseUp clientX=250 => onCreateGridDraft called TWICE; the 2nd arg has start 2026-05-20 / end 2026-05-23; the 2nd draft's clientId EQUALS the 1st's (proves replace, not duplicate) |
| direction-agnostic at hook level | press x=250, move to x=50, release => identical final range to the test above |
| clamp at the window edge | press x=50, move to x=9999, release => end 2026-05-24 (last visible + 1), never beyond |
| click with no move emits nothing extra | press, then mouseUp with NO mouseMove => toHaveBeenCalledTimes(1); store draft still one-day |
| sub-threshold jitter does not escalate | press x=50, mouseMove x=53 buttons:1, release => toHaveBeenCalledTimes(1) |
| blur reverts, does not discard | press x=50, move to x=250, fireEvent.blur(window) => gridDraft is NOT null and is back to 2026-05-20 / 2026-05-21; onCreateGridDraft still 1; a following mouseUp emits nothing |
| unmount mid-gesture is inert | press, then cleanup(), then mouseMove => no throw, store unchanged |
| OPT-OUT PIN (Day wiring) | harness with NO multiDayDrag: press x=50, move to x=350, release => toHaveBeenCalledTimes(1), store draft one-day |
| CONSTANT-COLUMN PIN (Day model) | harness WITH multiDayDrag but getStartDate: () => '2026-05-20' and getVisibleDates: () => ['2026-05-20']: a 300px drag => any commit is still 2026-05-20 / 2026-05-21; the store never holds a multi-day span |

The last two are REQUIRED scope (an accepted design ruling), not optional.
Note all-day schedule dates are Date objects at local midnight: allDayGridSchedule does
dayjs(str).toDate(). Assert with new Date('2026-05-20') style values, matching existing test 1.
If the draft store leaks between tests, add a reset INSIDE the new harness - do NOT modify the
existing `afterEach(cleanup)` line.
```

#### packages/web/src/views/Week/components/Grid/AllDayRow/AllDayRow.tsx (excerpt lines 1-62, plus line 133 context)
_Included because: FILE TO MODIFY - pass multiDayDrag here. weekProps.component.weekDays is an array of Dayjs objects._

```
import {
  type FC,
  type MouseEvent,
  type ReactNode,
  type RefCallback,
  useMemo,
} from "react";
import { YEAR_MONTH_DAY_FORMAT } from "@core/constants/date.constants";
import { type GridEventDraft } from "@web/events/event-draft.types";
import { useWeekEventViewModel } from "@web/events/queries/useWeekEventsQuery";
import { draftActions } from "@web/events/stores/draft.store";
import { AllDayGridRow } from "@web/grid/components/AllDayGridRow";
import { useAllDayDraftCreation } from "@web/grid/hooks/useAllDayDraftCreation";
// ... other imports ...

export const AllDayRow: FC<Props> = ({
  allDayRef,
  allDayRowRef,
  children,
  dateCalcs,
  measurements,
  weekProps,
}) => {
  const { endOfView, startOfView } = weekProps.query;
  const { rowCount: rowsCount } = useWeekEventViewModel({
    startOfView,
    endOfView,
  });
  const getAllDayDraftStartDate = (clientX: number, clientY: number) =>
    dateCalcs.getDateStrByXY(
      clientX,
      clientY,
      startOfView,
      YEAR_MONTH_DAY_FORMAT,
    );
  const openAllDayDraft = (draft: GridEventDraft) => {
    draftActions.startGridDraft({ activity: "gridClick", draft });
  };
  const onMouseDown = useAllDayDraftCreation({
    getStartDate: getAllDayDraftStartDate,
    onCreateGridDraft: openAllDayDraft,
  });

// ---- elsewhere in the same file, showing weekDays is in scope: ----
// const { weekDays } = weekProps.component;      (line 133, inside AllDayRowCalendar)
// visibleDates={weekDays.map((date) => ({ date, key: date.format(YEAR_MONTH_DAY_FORMAT) }))}

REQUIRED CHANGE: add to the useAllDayDraftCreation call
  multiDayDrag: { getVisibleDates },
where getVisibleDates is a useCallback returning
  weekProps.component.weekDays.map((date) => date.format(YEAR_MONTH_DAY_FORMAT))
memoised on [weekProps.component.weekDays]. YEAR_MONTH_DAY_FORMAT is already imported.
Add useCallback to the existing 'react' import (useMemo is already imported).
Keep the object identity stable if convenient (useMemo on the multiDayDrag object), but correctness
first: the hook reads getVisibleDates lazily at mousedown, so identity is not critical.
```

#### SPEC/docs/frontend/week-drag-interaction.md addition
_Included because: APPEND a new section to the END of this existing 112-line document. Match its voice: short prose, concrete file references, a Pitfall-style warning. Do not alter existing content._

```
The existing document covers dragging SAVED events (layout cache, dayDate, mid-drag navigation,
updateVisual idempotence). It says NOTHING about drag-to-CREATE. Append a section titled
'## All-day drag-to-create' covering:

- The shape: mousedown emits a one-day draft SYNCHRONOUSLY (unchanged legacy behaviour), and a
  horizontal drag past ALLDAY_DRAFT_CREATE_MOVE_THRESHOLD_PX (8px, x-axis only) escalates it to a
  multi-day span previewed live and committed again on release.
- Why the press commit stays: an existing test fires mousedown with no mouseup and asserts a single
  one-day commit. Commit-on-release, the shape useTimedDraftCreation uses, would break it. The
  gesture is an ESCALATION layered on top, never a replacement.
- The accepted DOUBLE COMMIT: a real drag calls onCreateGridDraft twice (press one-day, release
  span). Both drafts are built with replaceGridDraftSchedule from the same press draft, so clientId
  and calendarId match and the second commit replaces rather than duplicates. Consequence: the Week
  form is live during the drag and its dates update as the pointer moves.
- Preview writes use draftActions.setGridDraft, NEVER startGridDraft - the latter hard-resets
  isFormOpen:false and would yank the form shut mid-gesture.
- Blur REVERTS to the one-day press draft rather than discarding, because the press is an
  independently completed user action. This deliberately differs from useTimedDraftCreation, which
  discards on blur because there the gesture created the draft.
- The Day view OPTS OUT: multiDayDrag is optional and Day omits it. Day's columns are calendars on
  one date (useDayCalendarColumns.ts:34-38 stamps date: dateInView on every column), so a horizontal
  drag there carries no day information.
- Thresholds table: INTERACTION_MOVE_THRESHOLD_PX 25 (move an existing card),
  TIMED_DRAFT_CREATE_MOVE_THRESHOLD_PX 4 (vertical duration drag),
  ALLDAY_DRAFT_CREATE_MOVE_THRESHOLD_PX 8 (horizontal day-column intent). Do not unify.
- A Pitfall note: the threshold is X-AXIS ONLY on purpose. hasExceededInteractionMoveThreshold ORs
  both axes; using it here would let a purely vertical twitch toward the timed grid escalate the
  gesture and fire a spurious second commit for zero user intent.
```
### Acceptance criteria
- useAllDayDraftCreation.ts gains an optional multiDayDrag?: { getVisibleDates: () => readonly string[] } and still compiles for callers that omit it
- On mousedown the hook still calls onCreateGridDraft synchronously with the one-day range, before any window listener is added
- When multiDayDrag is omitted the hook returns immediately after the press commit and adds no listeners
- A drag past the 8px x-axis threshold writes previews via draftActions.setGridDraft and never calls draftActions.startGridDraft
- mouseup with hasMoved false emits nothing extra and does not call preventDefault
- window blur mid-drag reverts the store to the one-day press draft and does not discard it
- The three existing tests and the existing renderHarness in useAllDayDraftCreation.test.tsx are byte-identical to before
- The new tests include the opt-out pin and the constant-column pin
- Every fireEvent.mouseMove in the new tests passes { buttons: 1 }
- AllDayRow.tsx passes multiDayDrag sourced from weekProps.component.weekDays formatted as YYYY-MM-DD
- docs/frontend/week-drag-interaction.md gains an appended All-day drag-to-create section; existing content is unchanged
- No file outside these four paths is created or modified; in particular no file under views/Day/ and not interaction.pointer.ts
### Your final message
Your final message must be a single JSON object and nothing else — no
prose before it, no summary after it, no ``` fence around it. It must
conform to this schema:

```json
{
  "type": "object",
  "properties": {
    "files_written": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "path": {
            "type": "string"
          },
          "summary": {
            "type": "string"
          }
        },
        "required": [
          "path",
          "summary"
        ]
      }
    },
    "existing_tests_untouched": {
      "type": "boolean"
    },
    "notes": {
      "type": "string"
    }
  },
  "required": [
    "files_written",
    "existing_tests_untouched"
  ]
}
```