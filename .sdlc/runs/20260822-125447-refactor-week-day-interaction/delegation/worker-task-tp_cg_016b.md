## Task tp_cg_016b — codegen / existing_file_edit
Module: adapter
### Working directory
You are running as an agent inside `/home/sainadh/projects/compass-calendar/compass/compass-calendar`. You may list, read,
edit and create files there, and run commands there. That directory is the
only place you can act; nothing outside it is reachable.
### Instruction
TYPE-ONLY EDIT to packages/web/src/views/Week/interaction/adapter/interactions/all-day.drag.ts. Open the file. Import `type DateColumnKey` from `@web/grid/interaction/types/column-key.types` and replace EVERY bare `AllDayDragVisual` type annotation in this file with `AllDayDragVisual<DateColumnKey>` - in the create function's return type if annotated, in the update function's `visual` parameter, and in `commitAllDayDragInteraction(target, visual: AllDayDragVisual<DateColumnKey>)`. Week columns are dates, so pinning is correct. This resolves the four type errors currently reported at lines 71, 85, 86 and 92, where these visuals are passed into the DateColumnKey-pinned cross-row commit and the Week all-day commit. Change ZERO runtime logic - no body, no comment, no import ordering beyond adding the one import. EFFICIENCY RULE: do NOT run tests, type-check, build or lint. Touch NO other file. Do NOT run git, rm, mv, or any cleanup command.
### Provided excerpts
These are extracts, not whole files. The paths are real — open them in the
working directory when you need more than the excerpt shows.

#### packages/web/src/views/Week/interaction/adapter/interactions/all-day.drag.ts
_Included because: The annotations to change. Open the file for full context._

```
import { allDayDragVisualToTimedGridEvent } from "@web/grid/interaction/commit/cross-row.commit";
import { createAllDayDragVisual, updateAllDayDragVisual } from "@web/grid/interaction/math/all-day.drag";
import { type AllDayDragVisual } from "@web/grid/interaction/types/all-day-drag.types";
import { type VisualPoint, type VisualRect } from "@web/grid/interaction/types/timed-drag.types";
import { type InteractionPoint } from "@web/interaction/interaction.types";
import { allDayDragVisualToGridEvent, hasAllDayDragVisualMoved } from "../commit/all-day.commit";
import { type WeekLayoutCache } from "../geometry/week-layout.cache";
import { type WeekAllDayDragCommitResult, type WeekAllDayDragTarget } from "../week-interaction.adapter.types";

// createAllDayDragVisual({ dayDate: sourceColumn.date, ... })

export const updateAllDayDragInteractionVisual = ({ /* ...visual: AllDayDragVisual... */ }) => {
  const nextVisual = updateAllDayDragVisual(visual, { layout, pointer });
  return {
    event: nextVisual.row === "timed" ? allDayDragVisualToTimedGridEvent(target.event, nextVisual) : null,
    visual: nextVisual,
  };
};

export const commitAllDayDragInteraction = (
  target: WeekAllDayDragTarget,
  visual: AllDayDragVisual,
): WeekAllDayDragCommitResult => {
  const isCrossRow = visual.row === "timed";
  const movedEvent = isCrossRow
    ? allDayDragVisualToTimedGridEvent(target.event, visual)
    : allDayDragVisualToGridEvent(target.event, visual);
  return { event: movedEvent, eventId: target.event._id!, hadFormOpenBeforeInteraction: target.hadFormOpenBeforeInteraction, hasMoved: isCrossRow || hasAllDayDragVisualMoved(visual), type: "allDayDragEnd" };
};
```

#### CONTEXT-already-pinned.md
_Included because: Why the errors occur: these consumers are already pinned to DateColumnKey by earlier packets._

```
// grid/interaction/commit/cross-row.commit.ts - PINNED, not generic:
export const allDayDragVisualToTimedGridEvent = (event: GridEvent, visual: AllDayDragVisual<DateColumnKey>): GridEvent => ...;

// views/Week/interaction/adapter/commit/all-day.commit.ts - PINNED:
export const hasAllDayDragVisualMoved = (visual: AllDayDragVisual<DateColumnKey>) => ...;
export const allDayDragVisualToGridEvent = (event: GridEvent, visual: AllDayDragVisual<DateColumnKey>): GridEvent => ...;

// views/Week/.../geometry/week-layout.cache.ts - the branding boundary:
export type WeekLayoutCache = GridLayoutCache<DateColumnKey>;
// so layout.dayColumns[n].date is already DateColumnKey
```
### Acceptance criteria
- Every AllDayDragVisual annotation in the file is AllDayDragVisual<DateColumnKey>
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