## Task tp_cg_007 — codegen / existing_file_edit
Module: commit
### Working directory
You are running as an agent inside `/home/sainadh/projects/compass-calendar/compass/compass-calendar`. You may list, read,
edit and create files there, and run commands there. That directory is the
only place you can act; nothing outside it is reachable.
### Instruction
EDIT packages/web/src/grid/interaction/commit/timed-moved.ts in place. Make ONLY `hasTimedDragVisualMoved` generic: `export const hasTimedDragVisualMoved = <TColumnKey = string>(visual: TimedDragVisual<TColumnKey>) => ...` with the body byte-identical (it just compares keys and minutes for equality). Leave `hasTimedResizeVisualMoved` COMPLETELY UNCHANGED - TimedResizeVisual carries no column key. Do not rename anything; there is no symbol called hasTimedVisualMoved. Keep both imports. EFFICIENCY RULE: do NOT run tests, type-check, build or lint. Touch NO other file. Do NOT run git, rm, mv, or any cleanup command.
### Provided excerpts
These are extracts, not whole files. The paths are real — open them in the
working directory when you need more than the excerpt shows.

#### packages/web/src/grid/interaction/commit/timed-moved.ts
_Included because: The whole file - 11 lines._

```
import { type TimedDragVisual } from "@web/grid/interaction/types/timed-drag.types";
import { type TimedResizeVisual } from "@web/grid/interaction/types/timed-resize.types";

export const hasTimedDragVisualMoved = (visual: TimedDragVisual) =>
  visual.dayDate !== visual.initialDayDate ||
  visual.startMinutes !== visual.initialStartMinutes ||
  visual.endMinutes !== visual.initialEndMinutes;

export const hasTimedResizeVisualMoved = (visual: TimedResizeVisual) =>
  visual.startMinutes !== visual.initialStartMinutes ||
  visual.endMinutes !== visual.initialEndMinutes;
```
### Acceptance criteria
- hasTimedDragVisualMoved is generic over TColumnKey with a string default and takes TimedDragVisual<TColumnKey>
- hasTimedResizeVisualMoved is byte-identical to before
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