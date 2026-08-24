## Task tp_cg_011b — codegen / existing_file_edit
Module: commit
### Working directory
You are running as an agent inside `/home/sainadh/projects/compass-calendar/compass/compass-calendar`. You may list, read,
edit and create files there, and run commands there. That directory is the
only place you can act; nothing outside it is reachable.
### Instruction
TYPE-ONLY EDIT to packages/web/src/views/Day/interaction/adapter/commit/all-day.commit.ts. Open the file. Import `type DayColumnKey` from `@web/grid/interaction/types/column-key.types` and replace every bare `AllDayDragVisual` annotation with `AllDayDragVisual<DayColumnKey>` - notably in `commitAllDayDragInteraction(target, visual: AllDayDragVisual<DayColumnKey>)`. This resolves the error at line 29 where the visual is handed to `columnMoveCalendarId`, which now takes a `Pick<TimedDragVisual<DayColumnKey>, "dayDate" | "initialDayDate">` - the call is structural and works once the key types agree. CRITICAL: preserve verbatim the `"dayDate" in visual ? ... : false` hasMoved expression and the load-bearing comment explaining that Day all-day drags must NOT rewrite dates ('rewriting them to the visible date would truncate a multi-day all-day event to a single day'). That behavior is invariant INV-6 and must not change. Leave commitAllDayResizeInteraction and any AllDayResizeVisual signature untouched. Change ZERO runtime logic. EFFICIENCY RULE: do NOT run tests, type-check, build or lint. Touch NO other file. Do NOT run git, rm, mv, or any cleanup command.
### Provided excerpts
These are extracts, not whole files. The paths are real — open them in the
working directory when you need more than the excerpt shows.

#### packages/web/src/views/Day/interaction/adapter/commit/all-day.commit.ts
_Included because: The annotations to change; the comment and hasMoved expression are invariant-critical._

```
import { columnMoveCalendarId } from "./timed.commit";
// ...
export const commitAllDayDragInteraction = (
  target: DayAllDayDragTarget,
  visual: AllDayDragVisual,
): DayAllDayDragCommitResult => {
  const hasMoved =
    "dayDate" in visual ? visual.dayDate !== visual.initialDayDate : false;

  // In the Day view every column shares the visible date, so an all-day drag
  // that "moved" can only have changed COLUMN, i.e. calendar. Keep the
  // event's own dates: rewriting them to the visible date would truncate a
  // multi-day all-day event to a single day.
  return {
    event: hasMoved
      ? { ...target.event, calendarId: columnMoveCalendarId(visual, target.event) }
      : target.event,
    eventId: target.event._id!,
    hadFormOpenBeforeInteraction: target.hadFormOpenBeforeInteraction,
    hasMoved,
    type: "allDayDragEnd",
  };
};

export const commitAllDayResizeInteraction = (target: DayAllDayResizeTarget, ...) => ...;  // DO NOT TOUCH
```

#### packages/web/src/views/Day/interaction/adapter/commit/timed.commit.ts
_Included because: columnMoveCalendarId's new signature, already landed._

```
export const columnMoveCalendarId = (
  visual: Pick<TimedDragVisual<DayColumnKey>, "dayDate" | "initialDayDate">,
  event: GridEvent,
): CalendarId | undefined =>
  visual.dayDate !== visual.initialDayDate
    ? (visual.dayDate as CalendarId)
    : event.calendarId;
```
### Acceptance criteria
- Every AllDayDragVisual annotation is AllDayDragVisual<DayColumnKey>
- The hasMoved expression and the multi-day truncation comment are byte-identical
- commitAllDayResizeInteraction untouched
- No other file is created or modified
### Your final message
Your final message must be a single JSON object and nothing else — no
prose before it, no summary after it, no ``` fence around it. It must
conform to this schema:

```json
{
  "type": "object",
  "properties": {
    "file_written": {
      "type": "string"
    },
    "content": {
      "type": "string"
    }
  },
  "required": [
    "file_written",
    "content"
  ]
}
```