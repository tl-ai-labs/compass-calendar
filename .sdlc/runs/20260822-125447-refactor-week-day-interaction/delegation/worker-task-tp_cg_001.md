## Task tp_cg_001 — codegen / new_file_add
Module: types
### Working directory
You are running as an agent inside `/home/sainadh/projects/compass-calendar/compass/compass-calendar`. You may list, read,
edit and create files there, and run commands there. That directory is the
only place you can act; nothing outside it is reachable.
### Instruction
CREATE the file packages/web/src/grid/interaction/types/column-key.types.ts. Write it to disk yourself. It must contain ONLY: (1) a type-only import of CalendarId and DateOnly from @core/types/domain-primitives; (2) `export type DateColumnKey = DateOnly;` with a doc comment saying Week grid columns are dates; (3) `export type DayColumnKey = CalendarId | DateOnly;` with a doc comment saying Day grid columns are calendar ids, except the single-column fallback whose one key is a date; (4) `export const asDateColumnKeys = (keys: string[]): DateColumnKey[] => keys as DateColumnKey[];` and `export const asDayColumnKeys = (keys: string[]): DayColumnKey[] => keys as DayColumnKey[];`, both preceded by a comment explaining they are DELIBERATELY UNCHECKED casts: the callers have already established these are the rendered column keys, and running a validating parse here would put Zod on the mid-drag hot path and throw on input that is silently tolerated today, which would be a behavior change. Do NOT call DateOnlySchema.parse or CalendarIdSchema.parse. Match the repo's Biome formatting: double quotes, semicolons, 2-space indent, trailing commas where multiline. Touch NO other file. Do NOT run git, rm, mv, or any cleanup command.
### Provided excerpts
These are extracts, not whole files. The paths are real — open them in the
working directory when you need more than the excerpt shows.

#### packages/core/src/types/domain-primitives.ts
_Included because: The branded primitives to import. Read-only - packages/core is off-limits for edits._

```
export const CalendarIdSchema = ObjectIdStringSchema.brand<"CalendarId">();
export type CalendarId = z.infer<typeof CalendarIdSchema>;

export const DateOnlySchema = zYearMonthDayString.brand<"DateOnly">();
export type DateOnly = z.infer<typeof DateOnlySchema>;
```

#### packages/web/src/grid/interaction/types/timed-drag.types.ts
_Included because: A sibling file in the same directory, to match import style and formatting conventions._

```
export interface VisualPoint {
  x: number;
  y: number;
}

/** Which of the calendar's two event rows a drag is over. */
export type DragRow = "allDay" | "timed";

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
  type: "timedDrag";
}
```
### Acceptance criteria
- File exists at packages/web/src/grid/interaction/types/column-key.types.ts
- Exports DateColumnKey = DateOnly and DayColumnKey = CalendarId | DateOnly
- Exports asDateColumnKeys and asDayColumnKeys as unchecked cast helpers with the explanatory comment
- Imports are type-only; no runtime zod dependency and no parse call
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