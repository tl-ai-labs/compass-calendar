## Task tp_cg_013 — codegen / existing_file_edit
Module: adapter
### Working directory
You are running as an agent inside `/home/sainadh/projects/compass-calendar/compass/compass-calendar`. You may list, read,
edit and create files there, and run commands there. That directory is the
only place you can act; nothing outside it is reachable.
### Instruction
EDIT packages/web/src/views/Day/interaction/adapter/day-interaction.adapter.ts. Open the file. Make exactly THREE changes and nothing else. (1) Add imports: `asDayColumnKeys` and `type DayColumnKey` from `@web/grid/interaction/types/column-key.types`, and `type DayLayoutCache` from `./geometry/day-layout.cache` (adjust the relative path to match the file's existing import of buildDayLayoutCacheForTarget). (2) At roughly line 95, change the mutable layout declaration `let layout: GridLayoutCache | null = null;` to `let layout: DayLayoutCache | null = null;` - this is the root cause of the reported errors, because the adapter was still holding a string-keyed cache. Remove the now-unused GridLayoutCache import ONLY if nothing else in the file uses it. (3) At the columnKeys construction (~line 260), wrap the result in the branding helper so the layout is built from branded keys: change `const columnKeys = eventColumnIndex >= 0 ? calendarColumnKeys : [visibleDateKey];` to `const columnKeys: DayColumnKey[] = asDayColumnKeys(eventColumnIndex >= 0 ? calendarColumnKeys : [visibleDateKey]);` and add a short comment above it noting this is the Day branding boundary and that the fallback branch's single key is a DATE, not a calendar id, which is exactly why DayColumnKey is a union. CRITICAL: the ternary's runtime behavior must be IDENTICAL - do not reorder it, do not add a guard, do not change eventColumnIndex or initialColumnIndex or initialColumnKey. Do NOT decompose this adapter into per-interaction modules and do NOT extract any shared lifecycle helper - both are explicitly out of scope for this run. EFFICIENCY RULE: do NOT run tests, type-check, build or lint. Touch NO other file. Do NOT run git, rm, mv, or any cleanup command.
### Provided excerpts
These are extracts, not whole files. The paths are real — open them in the
working directory when you need more than the excerpt shows.

#### packages/web/src/views/Day/interaction/adapter/day-interaction.adapter.ts
_Included because: The three edit sites. Open the file for full context; it is 607 lines and everything else must stay byte-identical._

```
// line ~95:
  let layout: GridLayoutCache | null = null;

// lines ~254-268, inside createVisual:
        const calendarColumnKeys = isDayDragTarget(target)
          ? getColumnKeys()
          : [];
        const eventColumnIndex = calendarColumnKeys.indexOf(
          target.event.calendarId ?? "",
        );
        const columnKeys =
          eventColumnIndex >= 0 ? calendarColumnKeys : [visibleDateKey];
        const initialColumnIndex = Math.max(0, eventColumnIndex);
        const initialColumnKey = columnKeys[initialColumnIndex]!;
        const nextLayout = buildDayLayoutCacheForTarget(
          target,
          getLayoutSources(),
          columnKeys,
        );

// later, createVisual returns e.g.:
//   createAllDayDragVisual({ dayDate: initialColumnKey, ... })
//   createTimedDragVisual({ dayDate: initialColumnKey, ... })
// once columnKeys is DayColumnKey[], initialColumnKey is DayColumnKey and these infer correctly.
```

#### DEPENDENCIES-already-landed.md
_Included because: These are already converted; line up with them._

```
// views/Day/interaction/adapter/geometry/day-layout.cache.ts
export type DayLayoutCache = GridLayoutCache<DayColumnKey>;
export const buildDayLayoutCacheForTarget = (
  target: DayInteractionTarget,
  sources: GridLayoutCacheSources,
  columnKeys: DayColumnKey[],
): DayLayoutCache | null => ...;

// grid/interaction/types/column-key.types.ts
export type DayColumnKey = CalendarId | DateOnly;
export const asDayColumnKeys = (keys: string[]): DayColumnKey[] => keys as DayColumnKey[];

// views/Day/interaction/adapter/day-interaction.adapter.types.ts
export type DayInteractionVisual = GridInteractionVisual<DayColumnKey>;

// views/Day/interaction/adapter/commit/timed.commit.ts
export const commitTimedDragInteraction = (target: DayTimedDragTarget, visual: TimedDragVisual<DayColumnKey>, visibleDate: Dayjs): DayTimedDragCommitResult => ...;
```
### Acceptance criteria
- layout is declared DayLayoutCache | null
- columnKeys is DayColumnKey[] via asDayColumnKeys, with the ternary's runtime behavior unchanged
- A comment marks the Day branding boundary and notes the fallback key is a date
- No decomposition into interactions/* and no lifecycle-helper extraction
- Everything else in the 607-line file is byte-identical
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