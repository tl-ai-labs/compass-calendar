## Task tp_cg_011 — codegen / existing_file_edit
Module: commit
### Working directory
You are running as an agent inside `/home/sainadh/projects/compass-calendar/compass/compass-calendar`. You may list, read,
edit and create files there, and run commands there. That directory is the
only place you can act; nothing outside it is reachable.
### Instruction
TYPE-ONLY EDIT to packages/web/src/views/Day/interaction/adapter/commit/timed.commit.ts. Open the file first. Import `type DayColumnKey` from `@web/grid/interaction/types/column-key.types` and bind every TimedDragVisual occurrence in this file to it: `commitTimedDragInteraction(target, visual: TimedDragVisual<DayColumnKey>, visibleDate)`, `timedDragVisualToDayGridEvent(event, visual: TimedDragVisual<DayColumnKey>, visibleDate)`, and `columnMoveCalendarId(visual: Pick<TimedDragVisual<DayColumnKey>, "dayDate" | "initialDayDate">, event)`. Day columns are calendar ids EXCEPT in the single-column fallback where the one key is a date, which is exactly why DayColumnKey is the union CalendarId | DateOnly. CRITICAL: KEEP the existing `(visual.dayDate as CalendarId)` cast and KEEP its doc comment verbatim. The cast is narrowed by this change, not eliminated - it still rests on the runtime invariant that the fallback has exactly one key so `visual.dayDate !== visual.initialDayDate` can never be true there. Do NOT try to remove the cast, do NOT add a runtime guard, do NOT change the comment. Leave commitTimedResizeInteraction, timedResizeVisualToDayGridEvent and all TimedResizeVisual signatures untouched. Change ZERO runtime logic. EFFICIENCY RULE: do NOT run tests, type-check, build or lint. Touch NO other file. Do NOT run git, rm, mv, or any cleanup command.
### Provided excerpts
These are extracts, not whole files. The paths are real — open them in the
working directory when you need more than the excerpt shows.

#### packages/web/src/views/Day/interaction/adapter/commit/timed.commit.ts
_Included because: The signatures to change. Open the file for the rest; the cast at the end is load-bearing and must survive verbatim._

```
import { type CalendarId } from "@core/types/domain-primitives";
// ...
export const commitTimedDragInteraction = (
  target: DayTimedDragTarget,
  visual: TimedDragVisual,
  visibleDate: Dayjs,
): DayTimedDragCommitResult => { ... };

export const timedDragVisualToDayGridEvent = (
  event: GridEvent,
  visual: TimedDragVisual,
  visibleDate: Dayjs,
): GridEvent => ({ ...event, calendarId: columnMoveCalendarId(visual, event), isAllDay: false, ... });

/**
 * Day-view drag column keys are calendar ids (see createVisual), so a drop
 * on a different column is a cross-calendar move. Same-column drops (and the
 * single-column fallback, whose one key is a date string that never changes)
 * keep the event's own calendarId.
 */
export const columnMoveCalendarId = (
  visual: Pick<TimedDragVisual, "dayDate" | "initialDayDate">,
  event: GridEvent,
): CalendarId | undefined =>
  visual.dayDate !== visual.initialDayDate
    ? (visual.dayDate as CalendarId)
    : event.calendarId;

// UNTOUCHED: commitTimedResizeInteraction, timedResizeVisualToDayGridEvent
```

#### packages/web/src/grid/interaction/types/column-key.types.ts
_Included because: The union type to bind to._

```
export type DateColumnKey = DateOnly;
/** Day grid columns are calendar ids, except the single-column fallback whose one key is a date. */
export type DayColumnKey = CalendarId | DateOnly;
```
### Acceptance criteria
- Every TimedDragVisual in the file is parameterized with DayColumnKey
- columnMoveCalendarId takes Pick<TimedDragVisual<DayColumnKey>, 'dayDate' | 'initialDayDate'>
- The (visual.dayDate as CalendarId) cast and its doc comment survive verbatim
- TimedResizeVisual signatures and all runtime logic unchanged
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