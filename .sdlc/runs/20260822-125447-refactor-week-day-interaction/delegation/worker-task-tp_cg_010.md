## Task tp_cg_010 — codegen / existing_file_edit
Module: commit
### Working directory
You are running as an agent inside `/home/sainadh/projects/compass-calendar/compass/compass-calendar`. You may list, read,
edit and create files there, and run commands there. That directory is the
only place you can act; nothing outside it is reachable.
### Instruction
TYPE-ONLY EDIT to packages/web/src/views/Week/interaction/adapter/commit/timed.commit.ts. Import `type DateColumnKey` from `@web/grid/interaction/types/column-key.types` and bind `timedDragVisualToGridEvent(event: GridEvent, visual: TimedDragVisual<DateColumnKey>)`. Week columns are dates, so pin rather than genericize. Leave `timedResizeVisualToGridEvent` UNTOUCHED (TimedResizeVisual has no column key), and leave the `export { hasTimedDragVisualMoved, hasTimedResizeVisualMoved };` re-export line exactly as it is. Change ZERO runtime logic: the movedDay/resizedDay dayjs calls and every comment stay byte-identical. EFFICIENCY RULE: do NOT run tests, type-check, build or lint. Touch NO other file. Do NOT run git, rm, mv, or any cleanup command.
### Provided excerpts
These are extracts, not whole files. The paths are real — open them in the
working directory when you need more than the excerpt shows.

#### packages/web/src/views/Week/interaction/adapter/commit/timed.commit.ts
_Included because: The whole file - only one signature changes._

```
import dayjs from "@core/util/date/dayjs";
import { type GridEvent } from "@web/common/types/web.event.types";
import {
  hasTimedDragVisualMoved,
  hasTimedResizeVisualMoved,
} from "@web/grid/interaction/commit/timed-moved";
import { type TimedDragVisual } from "@web/grid/interaction/types/timed-drag.types";
import { type TimedResizeVisual } from "@web/grid/interaction/types/timed-resize.types";

export { hasTimedDragVisualMoved, hasTimedResizeVisualMoved };

export const timedDragVisualToGridEvent = (
  event: GridEvent,
  visual: TimedDragVisual,
): GridEvent => {
  // The column under the drag knows its own date, so the target day is
  // assigned absolutely; time-of-day rides on the visual's minutes.
  const movedDay = dayjs(visual.dayDate).startOf("day");

  return {
    ...event,
    endDate: movedDay.add(visual.endMinutes, "minutes").format(),
    startDate: movedDay.add(visual.startMinutes, "minutes").format(),
  };
};

export const timedResizeVisualToGridEvent = (
  event: GridEvent,
  visual: TimedResizeVisual,
): GridEvent => {
  const resizedDay = dayjs(event.startDate).startOf("day");

  return {
    ...event,
    endDate: resizedDay.add(visual.endMinutes, "minutes").format(),
    startDate: resizedDay.add(visual.startMinutes, "minutes").format(),
  };
};
```
### Acceptance criteria
- timedDragVisualToGridEvent takes TimedDragVisual<DateColumnKey>
- timedResizeVisualToGridEvent and the re-export line are byte-identical
- No runtime logic changed
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