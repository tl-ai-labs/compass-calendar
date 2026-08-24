## Task tp_cg_004b — codegen / existing_file_edit
Module: math
### Working directory
You are running as an agent inside `/home/sainadh/projects/compass-calendar/compass/compass-calendar`. You may list, read,
edit and create files there, and run commands there. That directory is the
only place you can act; nothing outside it is reachable.
### Instruction
EDIT packages/web/src/grid/interaction/math/drag-column.ts in place. Make `resolveDragColumn` generic over `<TColumnKey = string>` (the default is REQUIRED): the `layout` field of its input object becomes `GridLayoutCache<TColumnKey>`, so the returned `nextColumn` is `DayColumnCache<TColumnKey> | null`. Everything else stays byte-identical: the deltaX/initialDayIndex/sourceRect fields, the entire function body, the transformX computation, and the doc comment. Do not add or remove imports beyond what the generic needs. IMPORTANT EFFICIENCY RULE: do NOT run the test suite, do NOT run type-check, do NOT run any build or lint command - verification is handled outside this task and running it here wastes budget. Just read the file, make the edit, and finish. Touch NO other file. Do NOT run git, rm, mv, or any cleanup command.
### Provided excerpts
These are extracts, not whole files. The paths are real — open them in the
working directory when you need more than the excerpt shows.

#### packages/web/src/grid/interaction/math/drag-column.ts
_Included because: The whole file - it is only 41 lines._

```
import {
  type GridLayoutCache,
  getNearestDayColumn,
} from "@web/grid/interaction/layout.cache";
import { type VisualRect } from "../types/timed-drag.types";

/**
 * Resolves which day column a horizontal drag is over, relative to the
 * dragged event's own column: the initial column is looked up by its
 * window-relative index (stable across mid-drag layout rebuilds), and the
 * next column is whichever is nearest to the source center shifted by the
 * pointer's horizontal delta.
 */
export const resolveDragColumn = ({
  deltaX,
  initialDayIndex,
  layout,
  sourceRect,
}: {
  deltaX: number;
  initialDayIndex: number;
  layout: GridLayoutCache;
  sourceRect: VisualRect;
}) => {
  const initialColumn = layout.dayColumns.find(
    (column) => column.index === initialDayIndex,
  );
  const initialColumnLeft = initialColumn?.left ?? sourceRect.left;
  const sourceCenterX =
    initialColumnLeft + (initialColumn?.width ?? sourceRect.width) / 2;
  const nextColumn = getNearestDayColumn(
    layout.dayColumns,
    sourceCenterX + deltaX,
  );

  return {
    nextColumn,
    transformX: (nextColumn?.left ?? initialColumnLeft) - initialColumnLeft,
  };
};
```

#### packages/web/src/grid/interaction/layout.cache.ts
_Included because: The already-converted generic signatures this file must line up with._

```
export interface DayColumnCache<TColumnKey = string> {
  date: TColumnKey;
  index: number;
  left: number;
  width: number;
}

export interface GridLayoutCache<TColumnKey = string> {
  crossRow?: GridLayoutCache<TColumnKey>;
  dayColumns: DayColumnCache<TColumnKey>[];
  edgeNavigation: EdgeNavigationCache;
  pixelsPerMinute: number;
  snapMinutes: number;
  smartScroll?: SmartScrollCache;
}

export const getNearestDayColumn = <TColumnKey = string>(
  columns: DayColumnCache<TColumnKey>[],
  x: number,
): DayColumnCache<TColumnKey> | null => { /* ... */ };
```
### Acceptance criteria
- resolveDragColumn is generic over TColumnKey with a string default
- layout is GridLayoutCache<TColumnKey> and nextColumn is DayColumnCache<TColumnKey> | null
- Function body, transformX computation and doc comment are byte-identical
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