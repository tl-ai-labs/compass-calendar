## Task tp_cg_008 — codegen / existing_file_edit
Module: commit
### Working directory
You are running as an agent inside `/home/sainadh/projects/compass-calendar/compass/compass-calendar`. You may list, read,
edit and create files there, and run commands there. That directory is the
only place you can act; nothing outside it is reachable.
### Instruction
EDIT packages/web/src/grid/interaction/commit/cross-row.commit.ts in place. This is the containment step of the refactor. Import `type DateColumnKey` from `../types/column-key.types` and PIN both exported functions to it - NOT generic, deliberately fixed: `allDayDragVisualToTimedGridEvent(event: GridEvent, visual: AllDayDragVisual<DateColumnKey>): GridEvent` and `timedDragVisualToAllDayGridEvent(event: GridEvent, visual: TimedDragVisual<DateColumnKey>): GridEvent`. That pinning is the whole point: these two functions call dayjs(visual.dayDate), which is only meaningful for date-keyed columns, so a calendar-keyed Day visual must become a compile error here. Do NOT make them generic and do NOT widen them. Keep both function bodies, both long doc comments, the YEAR_MONTH_DAY_FORMAT and CROSS_ROW_TIMED_DURATION_MIN imports, and every other import byte-identical. EFFICIENCY RULE: do NOT run tests, type-check, build or lint. Touch NO other file. Do NOT run git, rm, mv, or any cleanup command.
### Provided excerpts
These are extracts, not whole files. The paths are real — open them in the
working directory when you need more than the excerpt shows.

#### packages/web/src/grid/interaction/commit/cross-row.commit.ts
_Included because: Only the two signatures change; the bodies and doc comments must not._

```
import { YEAR_MONTH_DAY_FORMAT } from "@core/constants/date.constants";
import dayjs from "@core/util/date/dayjs";
import { type GridEvent } from "@web/common/types/web.event.types";
import { CROSS_ROW_TIMED_DURATION_MIN } from "../math/cross-row.drag";
import { type AllDayDragVisual } from "../types/all-day-drag.types";
import { type TimedDragVisual } from "../types/timed-drag.types";

/** <long doc comment - keep verbatim> */
export const allDayDragVisualToTimedGridEvent = (
  event: GridEvent,
  visual: AllDayDragVisual,
): GridEvent => {
  const day = dayjs(visual.dayDate).startOf("day");
  const startMinutes = visual.timedStartMinutes ?? 0;
  return { ...event, endDate: day.add(startMinutes + CROSS_ROW_TIMED_DURATION_MIN, "minutes").format(), isAllDay: false, startDate: day.add(startMinutes, "minutes").format() };
};

/** <long doc comment - keep verbatim> */
export const timedDragVisualToAllDayGridEvent = (
  event: GridEvent,
  visual: TimedDragVisual,
): GridEvent => {
  const day = dayjs(visual.dayDate);
  return { ...event, endDate: day.add(1, "day").format(YEAR_MONTH_DAY_FORMAT), isAllDay: true, startDate: day.format(YEAR_MONTH_DAY_FORMAT) };
};
```

#### packages/web/src/grid/interaction/types/column-key.types.ts
_Included because: The type to import and pin to._

```
import { type CalendarId, type DateOnly } from "@core/types/domain-primitives";

/** Week grid columns are dates. */
export type DateColumnKey = DateOnly;

/** Day grid columns are calendar ids, except the single-column fallback whose one key is a date. */
export type DayColumnKey = CalendarId | DateOnly;
```
### Acceptance criteria
- Both exports take DateColumnKey-parameterized visuals and are NOT generic
- DateColumnKey is imported from ../types/column-key.types
- Both function bodies and both doc comments are byte-identical
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