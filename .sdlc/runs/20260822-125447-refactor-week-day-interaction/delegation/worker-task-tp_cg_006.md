## Task tp_cg_006 — codegen / existing_file_edit
Module: math
### Working directory
You are running as an agent inside `/home/sainadh/projects/compass-calendar/compass/compass-calendar`. You may list, read,
edit and create files there, and run commands there. That directory is the
only place you can act; nothing outside it is reachable.
### Instruction
EDIT packages/web/src/grid/interaction/math/all-day.drag.ts in place. Open the file first. Thread a `<TColumnKey = string>` generic (default REQUIRED) through: `CreateAllDayDragVisualInput<TColumnKey = string>` (dayDate becomes TColumnKey); `UpdateAllDayDragVisualInput<TColumnKey = string>` (layout becomes GridLayoutCache<TColumnKey>); `createAllDayDragVisual<TColumnKey = string>` returning `AllDayDragVisual<TColumnKey>`; `updateAllDayDragVisual<TColumnKey = string>` taking `visual: AllDayDragVisual<TColumnKey>` plus `UpdateAllDayDragVisualInput<TColumnKey>` and returning `AllDayDragVisual<TColumnKey>`; and any internal helper in the file whose parameters mention GridLayoutCache or AllDayDragVisual. After this, both `dayDate: placement.column?.date ?? visual.dayDate` and `dayDate: nextColumn?.date ?? visual.dayDate` must type-check as TColumnKey - resolveDragColumn and the cross-row placement helpers are ALREADY generic, do not edit them. This mirrors exactly what was just done to the sibling file math/timed.drag.ts; follow that shape. Change ZERO runtime logic - every arithmetic expression and comment stays byte-identical. EFFICIENCY RULE: do NOT run tests, type-check, build or lint. Read, edit, finish. Touch NO other file. Do NOT run git, rm, mv, or any cleanup command.
### Provided excerpts
These are extracts, not whole files. The paths are real — open them in the
working directory when you need more than the excerpt shows.

#### packages/web/src/grid/interaction/math/all-day.drag.ts
_Included because: Signatures to change; open the file for the bodies._

```
interface CreateAllDayDragVisualInput { dayDate: string; dayIndex: number; eventId: string; pointerStart: VisualPoint; sourceRect: VisualRect; }
interface UpdateAllDayDragVisualInput { layout: GridLayoutCache; pointer: VisualPoint; }
export const createAllDayDragVisual = ({ dayDate, dayIndex, eventId, pointerStart, sourceRect }: CreateAllDayDragVisualInput): AllDayDragVisual => ({ ... initialDayDate: dayDate, ... type: "allDayDrag" });
export const updateAllDayDragVisual = (
  visual: AllDayDragVisual,
  { layout, pointer }: UpdateAllDayDragVisualInput,
): AllDayDragVisual => {
  const { allDay, timed } = getDragRowLayouts(layout, "allDay");
  const row = resolveDragRow({ allDay, pointerY: pointer.y, sourceRow: "allDay", timed });
  // ... later: dayDate: placement.column?.date ?? visual.dayDate
  // ... later: dayDate: nextColumn?.date ?? visual.dayDate
};
```

#### packages/web/src/grid/interaction/math/timed.drag.ts
_Included because: The sibling file just converted by tp_cg_005 - copy this exact shape._

```
interface CreateTimedDragVisualInput<TColumnKey = string> { dayDate: TColumnKey; /* ... */ }
interface UpdateTimedDragVisualInput<TColumnKey = string> { layout: GridLayoutCache<TColumnKey>; pointer: VisualPoint; scrollDeltaPx?: number; }

export const createTimedDragVisual = <TColumnKey = string>({
  dayDate, dayIndex, endMinutes, eventId, pointerStart, sourceRect, startMinutes,
}: CreateTimedDragVisualInput<TColumnKey>): TimedDragVisual<TColumnKey> => ({ /* unchanged body */ });

export const updateTimedDragVisual = <TColumnKey = string>(
  visual: TimedDragVisual<TColumnKey>,
  { layout, pointer, scrollDeltaPx = 0 }: UpdateTimedDragVisualInput<TColumnKey>,
): TimedDragVisual<TColumnKey> => { /* unchanged body */ };

const getBoundedVerticalPlacement = <TColumnKey = string>({ candidateStartMinutes, layout, scrollDeltaPx, visual }: {
  candidateStartMinutes: number;
  layout: GridLayoutCache<TColumnKey>;
  scrollDeltaPx: number;
  visual: TimedDragVisual<TColumnKey>;
}) => { /* unchanged body */ };
```
### Acceptance criteria
- CreateAllDayDragVisualInput, UpdateAllDayDragVisualInput, createAllDayDragVisual, updateAllDayDragVisual and any layout-taking internal helper are generic over TColumnKey with a string default
- Both dayDate assignments resolve to TColumnKey with no cast
- All arithmetic and comments byte-identical
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