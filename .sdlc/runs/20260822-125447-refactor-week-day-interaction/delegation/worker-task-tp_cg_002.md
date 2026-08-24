## Task tp_cg_002 — codegen / existing_file_edit
Module: types
### Working directory
You are running as an agent inside `/home/sainadh/projects/compass-calendar/compass/compass-calendar`. You may list, read,
edit and create files there, and run commands there. That directory is the
only place you can act; nothing outside it is reachable.
### Instruction
EDIT the existing file packages/web/src/grid/interaction/types/timed-drag.types.ts in place. Open it first and preserve everything you are not explicitly told to change. Make exactly one change: give `TimedDragVisual` a generic parameter `<TColumnKey = string>` and change the two fields `dayDate` and `initialDayDate` from `string` to `TColumnKey`. The `= string` default is REQUIRED so every existing unparameterized reference keeps compiling. Also update those two fields' doc comments: `dayDate` should now say it is the key of the column currently under the drag, view-parameterized (Week uses DateColumnKey, Day uses DayColumnKey), replacing the old warning about not dayjs-parsing it; `initialDayDate` should say it is the key of the source column at drag start. Do NOT change VisualPoint, VisualRect, DragRow, CrossRowSize, the interface's other fields, or the file's top doc comment. Touch NO other file. Do NOT run git, rm, mv, or any cleanup command.
### Provided excerpts
These are extracts, not whole files. The paths are real — open them in the
working directory when you need more than the excerpt shows.

#### packages/web/src/grid/interaction/types/timed-drag.types.ts
_Included because: The file to edit, in full. Preserve every part not named in the instruction._

```
export interface VisualPoint {
  x: number;
  y: number;
}

export interface VisualRect {
  height: number;
  left: number;
  top: number;
  width: number;
}

/** Which of the calendar's two event rows a drag is over. */
export type DragRow = "allDay" | "timed";

/**
 * Ghost box for the row a drag is currently over. Non-null only while the drag
 * is over the *other* row, where the source card's own box is the wrong shape
 * for the event it is about to become (a 20px all-day chip over the timed grid,
 * or an hour-tall block over the all-day row).
 */
export type CrossRowSize = { height: number; width: number } | null;

/**
 * Day indices are window-relative (0..N-1 over the rendered columns) and stay
 * valid across mid-drag layout rebuilds because the visible day count is
 * frozen while an interaction is in motion. Day *dates* come from the layout
 * cache columns, so they track mid-drag week navigation automatically.
 */
export interface TimedDragVisual {
  crossRowSize: CrossRowSize;
  /**
   * Key of the column currently under the drag. Week view columns are
   * local YYYY-MM-DD dates; Day view columns are CALENDAR IDS (all columns
   * share the visible date there) - do not dayjs-parse this without knowing
   * which view produced it.
   */
  dayDate: string;
  dayIndex: number;
  durationMinutes: number;
  endMinutes: number;
  eventId: string;
  /** Local YYYY-MM-DD date of the source column at drag start. */
  initialDayDate: string;
  initialDayIndex: number;
  initialEndMinutes: number;
  initialStartMinutes: number;
  pointerStart: VisualPoint;
  /**
   * Row the pointer is over, re-resolved every frame. "allDay" means releasing
   * here converts the event to an all-day one and `startMinutes`/`endMinutes`
   * are ignored by the commit (they keep their last in-grid values).
   */
  row: DragRow;
  sourceRect: VisualRect;
  startMinutes: number;
  transform: VisualPoint;
  type: "timedDrag";
}
```
### Acceptance criteria
- TimedDragVisual<TColumnKey = string> with dayDate and initialDayDate typed TColumnKey
- The = string default is present so unparameterized references still compile
- VisualPoint, VisualRect, DragRow, CrossRowSize and all other fields are byte-identical
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