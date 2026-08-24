## Task tp_cg_008b — tests / existing_file_edit
Module: commit
### Working directory
You are running as an agent inside `/home/sainadh/projects/compass-calendar/compass/compass-calendar`. You may list, read,
edit and create files there, and run commands there. That directory is the
only place you can act; nothing outside it is reachable.
### Instruction
TYPE-ONLY FIXTURE EDIT to packages/web/src/grid/interaction/commit/cross-row.commit.test.ts. Open the file. The two functions under test are now pinned to DateColumnKey, so the fixtures must produce branded keys. Make ONLY these changes: (1) import `asDateColumnKeys` and `type DateColumnKey` from `@web/grid/interaction/types/column-key.types`; (2) add one tiny local helper near the top of the fixtures, `const columnKey = (date: string): DateColumnKey => asDateColumnKeys([date])[0]!;`, with a one-line comment saying the Week-side cross-row commit takes date-keyed columns so test fixtures brand their dates the same way production does; (3) change the two fixture factories so they are typed at DateColumnKey - `allDayDragVisual` becomes `(overrides: Partial<AllDayDragVisual<DateColumnKey>> = {}): AllDayDragVisual<DateColumnKey>` and `timedDragVisual` likewise with TimedDragVisual - and wrap every `dayDate:` and `initialDayDate:` VALUE in the file (both in the factory defaults and in every `overrides` object passed at a call site) with `columnKey(...)`, e.g. `dayDate: columnKey("2026-05-15")`. ABSOLUTELY DO NOT change any `expect(...)` assertion, any `it(...)`/`describe(...)` title, any date literal VALUE, any GridEvent fixture, or any test's logic. The test must still assert exactly what it asserts today - this change makes the fixtures type-check against the tightened signature and nothing more. EFFICIENCY RULE: do NOT run tests, type-check, build or lint. Touch NO other file. Do NOT run git, rm, mv, or any cleanup command.
### Provided excerpts
These are extracts, not whole files. The paths are real — open them in the
working directory when you need more than the excerpt shows.

#### packages/web/src/grid/interaction/commit/cross-row.commit.test.ts
_Included because: Open the file. Errors are at lines 72, 86, 103, 115, 126, 136 - all fixture call sites._

```
import { type AllDayDragVisual } from "@web/grid/interaction/types/all-day-drag.types";
import { type TimedDragVisual } from "@web/grid/interaction/types/timed-drag.types";
import { allDayDragVisualToTimedGridEvent, timedDragVisualToAllDayGridEvent } from "./cross-row.commit";

const allDayDragVisual = (
  overrides: Partial<AllDayDragVisual> = {},
): AllDayDragVisual => ({
  crossRowSize: null,
  dayDate: "2026-05-13",
  dayIndex: 3,
  eventId: "all-day-event",
  initialDayDate: "2026-05-13",
  initialDayIndex: 3,
  pointerStart: { x: 0, y: 0 },
  row: "timed",
  sourceRect: { height: 20, left: 0, top: 0, width: 90 },
  timedStartMinutes: null,
  ...overrides,
});

// timedDragVisual factory is analogous, ending: type: "timedDrag", ...overrides

// Example call sites that currently fail:
//   allDayDragVisual({ dayDate: "2026-05-15", timedStartMinutes: 600 })
//   allDayDragVisual({ dayDate: "2026-05-16", initialDayDate: "2026-05-13", timedStartMinutes: 0 })
// Assertions like expect(result.startDate).toContain("2026-05-15") must remain EXACTLY as they are.
```

#### packages/web/src/grid/interaction/commit/cross-row.commit.ts
_Included because: The tightened signatures the fixtures must satisfy._

```
export const allDayDragVisualToTimedGridEvent = (event: GridEvent, visual: AllDayDragVisual<DateColumnKey>): GridEvent => ...;
export const timedDragVisualToAllDayGridEvent = (event: GridEvent, visual: TimedDragVisual<DateColumnKey>): GridEvent => ...;

// from types/column-key.types.ts:
export type DateColumnKey = DateOnly;
export const asDateColumnKeys = (keys: string[]): DateColumnKey[] => keys as DateColumnKey[];
```
### Acceptance criteria
- Both fixture factories are typed at DateColumnKey with Partial<...<DateColumnKey>> overrides
- Every dayDate and initialDayDate value is wrapped in the columnKey() helper
- Every expect(...) assertion, test title and date literal value is byte-identical
- No test logic changed
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