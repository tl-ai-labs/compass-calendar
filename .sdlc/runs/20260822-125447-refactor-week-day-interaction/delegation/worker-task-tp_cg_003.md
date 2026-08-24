## Task tp_cg_003 — codegen / existing_file_edit
Module: types
### Working directory
You are running as an agent inside `/home/sainadh/projects/compass-calendar/compass/compass-calendar`. You may list, read,
edit and create files there, and run commands there. That directory is the
only place you can act; nothing outside it is reachable.
### Instruction
EDIT the existing file packages/web/src/grid/interaction/types/all-day-drag.types.ts in place. Open it first and preserve everything you are not told to change. Make exactly one change: give `AllDayDragVisual` a generic parameter `<TColumnKey = string>` and change the two fields `dayDate` and `initialDayDate` from `string` to `TColumnKey`. The `= string` default is REQUIRED so existing unparameterized references keep compiling. Note `dayDate` currently carries TWO stacked doc comments: KEEP the first one verbatim (it explains delta-vs-absolute commit semantics and is load-bearing), and REPLACE only the second one (the one starting 'Column key semantics match TimedDragVisual.dayDate') with a note that the key is now view-parameterized - Week uses DateColumnKey, Day uses DayColumnKey. For `initialDayDate`, change its comment to say it is the key of the (window-clamped) source column at drag start. Do NOT change the imports, the interface's other fields, or the file's top doc comment. Touch NO other file. Do NOT run git, rm, mv, or any cleanup command.
### Provided excerpts
These are extracts, not whole files. The paths are real — open them in the
working directory when you need more than the excerpt shows.

#### packages/web/src/grid/interaction/types/all-day-drag.types.ts
_Included because: The file to edit, in full._

```
import {
  type CrossRowSize,
  type DragRow,
  type VisualPoint,
  type VisualRect,
} from "./timed-drag.types";

/**
 * Day indices are window-relative (0..N-1 over the rendered columns) and stay
 * valid across mid-drag layout rebuilds because the visible day count is
 * frozen while an interaction is in motion. Day *dates* come from the layout
 * cache columns, so they track mid-drag week navigation automatically.
 */
export interface AllDayDragVisual {
  crossRowSize: CrossRowSize;
  /**
   * Local YYYY-MM-DD date of the column the ghost is snapped to. How the commit
   * reads it depends on `row`: an all-day drop applies it as a *delta* from
   * `initialDayDate` (the span may be window-clamped, so the initial column is
   * not necessarily the event's own start), while a timed drop applies it
   * absolutely, because the converted block lands on the column it was dropped
   * on and has no meaningful offset from where the span started.
   */
  /**
   * Column key semantics match TimedDragVisual.dayDate: a date in the Week
   * view, a calendar id in the Day view.
   */
  dayDate: string;
  dayIndex: number;
  eventId: string;
  /** Local YYYY-MM-DD date of the (window-clamped) source column at drag start. */
  initialDayDate: string;
  initialDayIndex: number;
  pointerStart: VisualPoint;
  /**
   * Row the pointer is over, re-resolved every frame. "timed" means releasing
   * here converts the event to a timed one.
   */
  row: DragRow;
  sourceRect: VisualRect;
  /** Snapped start-of-day minutes for the converted block; null unless `row` is "timed". */
  timedStartMinutes: number | null;
  transform: VisualPoint;
  type: "allDayDrag";
}
```

#### packages/web/src/grid/interaction/types/timed-drag.types.ts
_Included because: The sibling file already converted by the previous packet - match its style exactly._

```
export interface TimedDragVisual<TColumnKey = string> {
  crossRowSize: CrossRowSize;
  /**
   * Key of the column currently under the drag, view-parameterized (Week uses
   * DateColumnKey, Day uses DayColumnKey).
   */
  dayDate: TColumnKey;
  dayIndex: number;
  /** Key of the source column at drag start. */
  initialDayDate: TColumnKey;
  type: "timedDrag";
}
```
### Acceptance criteria
- AllDayDragVisual<TColumnKey = string> with dayDate and initialDayDate typed TColumnKey
- The first (delta-vs-absolute) doc comment on dayDate is preserved verbatim
- Imports and all other fields are byte-identical
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