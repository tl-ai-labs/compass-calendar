## Task tp_cg_016c — codegen / existing_file_edit
Module: adapter
### Working directory
You are running as an agent inside `/home/sainadh/projects/compass-calendar/compass/compass-calendar`. You may list, read,
edit and create files there, and run commands there. That directory is the
only place you can act; nothing outside it is reachable.
### Instruction
TYPE-ONLY EDIT to packages/web/src/views/Week/interaction/adapter/interactions/timed.drag.ts. Open the file. Import `type DateColumnKey` from `@web/grid/interaction/types/column-key.types` and replace EVERY bare `TimedDragVisual` type annotation in this file with `TimedDragVisual<DateColumnKey>` - in the update function's `visual` parameter and in the commit function's `visual` parameter, plus any other annotated occurrence. Week columns are dates, so pinning is correct. This resolves the three type errors currently reported at lines 88, 101 and 102, where these visuals flow into the DateColumnKey-pinned `timedDragVisualToAllDayGridEvent` (cross-row) and `timedDragVisualToGridEvent` / `hasTimedDragVisualMoved` (Week timed commit). This is the exact same change just made to the sibling module interactions/all-day.drag.ts. Change ZERO runtime logic - no body, no comment. EFFICIENCY RULE: do NOT run tests, type-check, build or lint. Touch NO other file. Do NOT run git, rm, mv, or any cleanup command.
### Provided excerpts
These are extracts, not whole files. The paths are real — open them in the
working directory when you need more than the excerpt shows.

#### packages/web/src/views/Week/interaction/adapter/interactions/timed.drag.ts
_Included because: Open the file; replace the TimedDragVisual annotations._

```
// ~111 lines. Imports include:
//   import { timedDragVisualToAllDayGridEvent } from "@web/grid/interaction/commit/cross-row.commit";
//   import { getNearestDayColumn } from "...";
//   import { type TimedDragVisual } from "@web/grid/interaction/types/timed-drag.types";
//   import { type WeekLayoutCache } from "../geometry/week-layout.cache";
// Around line 46: getNearestDayColumn(layout.dayColumns, sourceRect.left + 1)
// Around line 53: createTimedDragVisual({ dayDate: sourceColumn.date, ... })
// Around lines 88, 101, 102: the update and commit functions take `visual: TimedDragVisual`
// and pass it to timedDragVisualToAllDayGridEvent / timedDragVisualToGridEvent / hasTimedDragVisualMoved.
```

#### CONTEXT-already-pinned.md
_Included because: Why the errors occur._

```
// grid/interaction/commit/cross-row.commit.ts - PINNED:
export const timedDragVisualToAllDayGridEvent = (event: GridEvent, visual: TimedDragVisual<DateColumnKey>): GridEvent => ...;
// views/Week/.../commit/timed.commit.ts - PINNED:
export const timedDragVisualToGridEvent = (event: GridEvent, visual: TimedDragVisual<DateColumnKey>): GridEvent => ...;
// views/Week/.../geometry/week-layout.cache.ts - branding boundary:
export type WeekLayoutCache = GridLayoutCache<DateColumnKey>;

// The sibling module was just fixed like this:
export const commitAllDayDragInteraction = (
  target: WeekAllDayDragTarget,
  visual: AllDayDragVisual<DateColumnKey>,
): WeekAllDayDragCommitResult => { /* unchanged */ };
```
### Acceptance criteria
- Every TimedDragVisual annotation in the file is TimedDragVisual<DateColumnKey>
- DateColumnKey imported from @web/grid/interaction/types/column-key.types
- No runtime logic or comment changed
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