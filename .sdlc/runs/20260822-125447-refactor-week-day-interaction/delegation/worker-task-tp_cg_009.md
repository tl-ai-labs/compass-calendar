## Task tp_cg_009 — codegen / existing_file_edit
Module: commit
### Working directory
You are running as an agent inside `/home/sainadh/projects/compass-calendar/compass/compass-calendar`. You may list, read,
edit and create files there, and run commands there. That directory is the
only place you can act; nothing outside it is reachable.
### Instruction
TYPE-ONLY EDIT to packages/web/src/views/Week/interaction/adapter/commit/all-day.commit.ts. Import `type DateColumnKey` from `@web/grid/interaction/types/column-key.types` and bind the two functions that take an AllDayDragVisual to it: `hasAllDayDragVisualMoved(visual: AllDayDragVisual<DateColumnKey>)` and `allDayDragVisualToGridEvent(event: GridEvent, visual: AllDayDragVisual<DateColumnKey>)`. Week columns are dates, so pinning (not genericizing) is correct here. Leave `hasAllDayResizeVisualChanged`, `allDayResizeVisualToGridEvent` and `getExclusiveEndDateBaseline` COMPLETELY UNTOUCHED - AllDayResizeVisual carries no column key. Change ZERO runtime logic: the dayDelta diff, every dayjs call, the exclusive-end baseline logic and every comment stay byte-identical. EFFICIENCY RULE: do NOT run tests, type-check, build or lint. Touch NO other file. Do NOT run git, rm, mv, or any cleanup command.
### Provided excerpts
These are extracts, not whole files. The paths are real — open them in the
working directory when you need more than the excerpt shows.

#### packages/web/src/views/Week/interaction/adapter/commit/all-day.commit.ts
_Included because: Only the two AllDayDragVisual signatures change._

```
import { YEAR_MONTH_DAY_FORMAT } from "@core/constants/date.constants";
import dayjs from "@core/util/date/dayjs";
import { type GridEvent } from "@web/common/types/web.event.types";
import { type AllDayDragVisual } from "@web/grid/interaction/types/all-day-drag.types";
import { type AllDayResizeVisual } from "@web/grid/interaction/types/all-day-resize.types";

export const hasAllDayDragVisualMoved = (visual: AllDayDragVisual) =>
  visual.dayDate !== visual.initialDayDate;

export const allDayDragVisualToGridEvent = (
  event: GridEvent,
  visual: AllDayDragVisual,
): GridEvent => {
  // Delta (not absolute) semantics: multi-day spans are clamped to the
  // rendered window, so the initial column date is the clamped visible start,
  // not necessarily the event's own start date. The date diff also absorbs
  // mid-drag week navigation of any shift size.
  const dayDelta = dayjs(visual.dayDate).diff(dayjs(visual.initialDayDate), "day");
  return { ...event, endDate: dayjs(event.endDate).add(dayDelta, "day").format(YEAR_MONTH_DAY_FORMAT), startDate: dayjs(event.startDate).add(dayDelta, "day").format(YEAR_MONTH_DAY_FORMAT) };
};

// BELOW THIS LINE: DO NOT TOUCH
export const hasAllDayResizeVisualChanged = (visual: AllDayResizeVisual) => ...;
export const allDayResizeVisualToGridEvent = (event: GridEvent, visual: AllDayResizeVisual): GridEvent => ...;
const getExclusiveEndDateBaseline = (event: GridEvent) => ...;
```
### Acceptance criteria
- hasAllDayDragVisualMoved and allDayDragVisualToGridEvent take AllDayDragVisual<DateColumnKey>
- DateColumnKey imported from @web/grid/interaction/types/column-key.types
- The three resize/baseline functions are byte-identical
- No runtime logic changed anywhere
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