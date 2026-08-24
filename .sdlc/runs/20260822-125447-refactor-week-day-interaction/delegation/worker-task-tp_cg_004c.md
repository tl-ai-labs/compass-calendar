## Task tp_cg_004c — codegen / existing_file_edit
Module: math
### Working directory
You are running as an agent inside `/home/sainadh/projects/compass-calendar/compass/compass-calendar`. You may list, read,
edit and create files there, and run commands there. That directory is the
only place you can act; nothing outside it is reachable.
### Instruction
EDIT packages/web/src/grid/interaction/math/cross-row.drag.ts in place, threading a `<TColumnKey = string>` generic (the default is REQUIRED) through everything that carries a column: (1) `interface CrossRowPlacement<TColumnKey = string>` so `column` becomes `DayColumnCache<TColumnKey> | null`; (2) `getDragRowLayouts<TColumnKey = string>` so its `layout` param is `GridLayoutCache<TColumnKey>` and its returned allDay/timed are `GridLayoutCache<TColumnKey> | null`; (3) `resolveDragRow<TColumnKey = string>` so its allDay/timed params are `GridLayoutCache<TColumnKey> | null`; (4) `getCrossRowTimedPlacement<TColumnKey = string>` and `getCrossRowAllDayPlacement<TColumnKey = string>` so `layout` is `GridLayoutCache<TColumnKey>` and the return types are `CrossRowPlacement<TColumnKey> & { startMinutes: number }` and `CrossRowPlacement<TColumnKey>` respectively. Change ZERO runtime logic: every function body, the scrollTop read, the clamp/snapToStep math, the transform arithmetic, MINUTES_PER_DAY, CROSS_ROW_TIMED_DURATION_MIN and every doc comment stay byte-identical. EFFICIENCY RULE: do NOT run the test suite, type-check, build or lint - verification happens outside this task and running it here wastes budget. Read, edit, finish. Touch NO other file. Do NOT run git, rm, mv, or any cleanup command.
### Provided excerpts
These are extracts, not whole files. The paths are real — open them in the
working directory when you need more than the excerpt shows.

#### packages/web/src/grid/interaction/math/cross-row.drag.ts
_Included because: Signatures to change. Open the file in the working directory for the full bodies - they must not change._

```
interface CrossRowPlacement {
  column: DayColumnCache | null;
  height: number;
  transform: VisualPoint;
  width: number;
}

export const getDragRowLayouts = (
  layout: GridLayoutCache,
  sourceRow: DragRow,
): { allDay: GridLayoutCache | null; timed: GridLayoutCache | null } => ...

export const resolveDragRow = ({ allDay, pointerY, sourceRow, timed }: {
  allDay: GridLayoutCache | null;
  pointerY: number;
  sourceRow: DragRow;
  timed: GridLayoutCache | null;
}): DragRow => ...

export const getCrossRowTimedPlacement = ({ layout, pointer, sourceRect }: {
  layout: GridLayoutCache;
  pointer: VisualPoint;
  sourceRect: VisualRect;
}): CrossRowPlacement & { startMinutes: number } => ...

export const getCrossRowAllDayPlacement = ({ layout, pointer, sourceRect }: {
  layout: GridLayoutCache;
  pointer: VisualPoint;
  sourceRect: VisualRect;
}): CrossRowPlacement => ...
```

#### packages/web/src/grid/interaction/layout.cache.ts
_Included because: The already-converted generics to line up with._

```
export interface DayColumnCache<TColumnKey = string> { date: TColumnKey; index: number; left: number; width: number; }
export interface GridLayoutCache<TColumnKey = string> {
  crossRow?: GridLayoutCache<TColumnKey>;
  dayColumns: DayColumnCache<TColumnKey>[];
  edgeNavigation: EdgeNavigationCache;
  pixelsPerMinute: number;
  snapMinutes: number;
  smartScroll?: SmartScrollCache;
}
export const getNearestDayColumn = <TColumnKey = string>(columns: DayColumnCache<TColumnKey>[], x: number): DayColumnCache<TColumnKey> | null => ...;
```
### Acceptance criteria
- CrossRowPlacement, getDragRowLayouts, resolveDragRow, getCrossRowTimedPlacement, getCrossRowAllDayPlacement are all generic over TColumnKey with a string default
- Returned column is DayColumnCache<TColumnKey> | null
- All function bodies, math and doc comments are byte-identical
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