## Task tp_cg_005 — codegen / existing_file_edit
Module: math
### Working directory
You are running as an agent inside `/home/sainadh/projects/compass-calendar/compass/compass-calendar`. You may list, read,
edit and create files there, and run commands there. That directory is the
only place you can act; nothing outside it is reachable.
### Instruction
EDIT packages/web/src/grid/interaction/math/timed.drag.ts in place. Open the file first. Thread a `<TColumnKey = string>` generic (default REQUIRED) through every declaration that carries a column key: `CreateTimedDragVisualInput<TColumnKey = string>` (dayDate becomes TColumnKey); `UpdateTimedDragVisualInput<TColumnKey = string>` (layout becomes GridLayoutCache<TColumnKey>); `createTimedDragVisual<TColumnKey = string>` returning `TimedDragVisual<TColumnKey>`; `updateTimedDragVisual<TColumnKey = string>` taking `visual: TimedDragVisual<TColumnKey>` and `UpdateTimedDragVisualInput<TColumnKey>` and returning `TimedDragVisual<TColumnKey>`; the internal `getBoundedVerticalPlacement` helper (its `layout: GridLayoutCache` and `visual: TimedDragVisual` become the generic forms); and `getCurrentScrollTop` (its `layout` becomes `GridLayoutCache<TColumnKey>`). After this the two assignments `dayDate: placement.column?.date ?? visual.dayDate` and `dayDate: nextColumn?.date ?? visual.dayDate` must type-check as TColumnKey, because resolveDragColumn and the cross-row placement helpers are ALREADY generic (do not edit those files). Change ZERO runtime logic: MINUTES_PER_DAY, every arithmetic expression, clamp/snapToStep calls, transform math and all comments stay byte-identical. EFFICIENCY RULE: do NOT run tests, type-check, build or lint - verification happens outside this task. Read, edit, finish. Touch NO other file. Do NOT run git, rm, mv, or any cleanup command.
### Provided excerpts
These are extracts, not whole files. The paths are real — open them in the
working directory when you need more than the excerpt shows.

#### packages/web/src/grid/interaction/math/timed.drag.ts
_Included because: Signatures to change; open the file for the bodies, which must not change._

```
interface CreateTimedDragVisualInput { dayDate: string; dayIndex: number; endMinutes: number; eventId: string; pointerStart: VisualPoint; sourceRect: VisualRect; startMinutes: number; }
interface UpdateTimedDragVisualInput { layout: GridLayoutCache; pointer: VisualPoint; scrollDeltaPx?: number; }
export const createTimedDragVisual = ({...}: CreateTimedDragVisualInput): TimedDragVisual => ({...});
export const updateTimedDragVisual = (
  visual: TimedDragVisual,
  { layout, pointer, scrollDeltaPx = 0 }: UpdateTimedDragVisualInput,
): TimedDragVisual => { ... };
// internal helper, destructured object param:
//   { candidateStartMinutes: number; layout: GridLayoutCache; scrollDeltaPx: number; visual: TimedDragVisual; }
const getCurrentScrollTop = (layout: GridLayoutCache, scrollDeltaPx: number) =>
  (layout.smartScroll?.initialScrollTop ?? 0) + scrollDeltaPx;
```

#### ALREADY-GENERIC-DEPENDENCIES.md
_Included because: These four files were converted by earlier packets. Line up with them; do NOT edit them._

```
// grid/interaction/layout.cache.ts
export interface DayColumnCache<TColumnKey = string> { date: TColumnKey; index: number; left: number; width: number; }
export interface GridLayoutCache<TColumnKey = string> { crossRow?: GridLayoutCache<TColumnKey>; dayColumns: DayColumnCache<TColumnKey>[]; edgeNavigation: EdgeNavigationCache; pixelsPerMinute: number; snapMinutes: number; smartScroll?: SmartScrollCache; }

// grid/interaction/types/timed-drag.types.ts
export interface TimedDragVisual<TColumnKey = string> { dayDate: TColumnKey; initialDayDate: TColumnKey; /* ...unchanged fields... */ }

// grid/interaction/math/drag-column.ts
export const resolveDragColumn = <TColumnKey = string>({ deltaX, initialDayIndex, layout, sourceRect }: { deltaX: number; initialDayIndex: number; layout: GridLayoutCache<TColumnKey>; sourceRect: VisualRect; }) => ({ nextColumn /* DayColumnCache<TColumnKey> | null */, transformX });

// grid/interaction/math/cross-row.drag.ts
export const getDragRowLayouts = <TColumnKey = string>(layout: GridLayoutCache<TColumnKey>, sourceRow: DragRow): { allDay: GridLayoutCache<TColumnKey> | null; timed: GridLayoutCache<TColumnKey> | null } => ...;
export const resolveDragRow = <TColumnKey = string>({ allDay, pointerY, sourceRow, timed }: { allDay: GridLayoutCache<TColumnKey> | null; pointerY: number; sourceRow: DragRow; timed: GridLayoutCache<TColumnKey> | null; }): DragRow => ...;
export const getCrossRowAllDayPlacement = <TColumnKey = string>({ layout, pointer, sourceRect }: { layout: GridLayoutCache<TColumnKey>; ... }): CrossRowPlacement<TColumnKey> => ...;  // .column is DayColumnCache<TColumnKey> | null
```
### Acceptance criteria
- CreateTimedDragVisualInput, UpdateTimedDragVisualInput, createTimedDragVisual, updateTimedDragVisual, getBoundedVerticalPlacement and getCurrentScrollTop are generic over TColumnKey with a string default
- Both dayDate assignments resolve to TColumnKey with no cast
- All arithmetic, clamping and comments byte-identical
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