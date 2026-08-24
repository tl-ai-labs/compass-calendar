## Task tp_cg_018 — codegen / existing_file_edit
Module: geometry
### Working directory
You are running as an agent inside `/home/sainadh/projects/compass-calendar/compass/compass-calendar`. You may list, read,
edit and create files there, and run commands there. That directory is the
only place you can act; nothing outside it is reachable.
### Instruction
EDIT packages/web/src/views/Week/interaction/adapter/geometry/week-layout.cache.ts. This file is the BRANDING BOUNDARY for the Week view - the single place where plain strings become branded column keys. Make three changes and nothing else: (1) import `asDateColumnKeys` and `type DateColumnKey` from `@web/grid/interaction/types/column-key.types`; (2) change `export type WeekLayoutCache = GridLayoutCache;` to `export type WeekLayoutCache = GridLayoutCache<DateColumnKey>;`; (3) in `weekLayoutCacheOptions`, change its return type to `GridLayoutCacheOptions<DateColumnKey> & WeekLayoutCacheSources` and change the line `visibleDates: sources.visibleDays,` to `visibleDates: asDateColumnKeys(sources.visibleDays),`. Add a short comment above that line noting this is the branding boundary: the runtime supplies plain strings and they are branded once here rather than validated per-frame on the drag path. KEEP `WeekLayoutCacheInput.visibleDays` as `string[]` - the runtime that supplies it is deliberately left unbranded and outside this refactor's scope. Keep every other export, import and constant byte-identical, including WEEK_EDGE_NAVIGATION_THRESHOLD_PX, the getNearestDayColumn re-export and the doc comments. EFFICIENCY RULE: do NOT run tests, type-check, build or lint. Touch NO other file. Do NOT run git, rm, mv, or any cleanup command.
### Provided excerpts
These are extracts, not whole files. The paths are real — open them in the
working directory when you need more than the excerpt shows.

#### packages/web/src/views/Week/interaction/adapter/geometry/week-layout.cache.ts
_Included because: The whole file - 73 lines._

```
import { ID_ALLDAY_COLUMNS, ID_GRID_COLUMNS_TIMED, ID_GRID_MAIN } from "@web/common/constants/web.constants";
import { GRID_TIME_STEP, TIMED_VISIBLE_HOURS } from "@web/grid/grid.constants";
import { SMART_SCROLL_BOTTOM_INSET_PX, SMART_SCROLL_SPEED_PX } from "@web/grid/interaction/adapter.helpers";
import {
  buildAllDayGridLayoutCache,
  buildDragGridLayoutCache,
  buildTimedGridLayoutCache,
  type GridLayoutCache,
  type GridLayoutCacheOptions,
  type GridLayoutCacheSources,
  getNearestDayColumn,
  type SmartScrollCache,
} from "@web/grid/interaction/layout.cache";
import { type DragRow } from "@web/grid/interaction/types/timed-drag.types";
import { WEEK_EDGE_NAVIGATION_THRESHOLD_PX } from "../edge-navigation";

export type WeekLayoutCacheSources = GridLayoutCacheSources;

/**
 * The week renders a dynamic window of 1-7 day columns. The columns' dates
 * come from the same React render that painted them (weekProps weekDays via
 * the interaction runtime), so drag geometry and drop dates always agree
 * with what is on screen.
 */
export interface WeekLayoutCacheInput extends GridLayoutCacheSources {
  /** Local YYYY-MM-DD dates of the rendered day columns, in window order. */
  visibleDays: string[];
}

export type WeekLayoutCache = GridLayoutCache;
export type { SmartScrollCache };
export { getNearestDayColumn };

const weekLayoutCacheOptions = (
  sources: WeekLayoutCacheInput,
): GridLayoutCacheOptions & WeekLayoutCacheSources => ({
  ...sources,
  allDayColumnsElementId: ID_ALLDAY_COLUMNS,
  edgeThresholdPx: WEEK_EDGE_NAVIGATION_THRESHOLD_PX,
  mainGridElementId: ID_GRID_MAIN,
  smartScroll: {
    bottomInsetPx: SMART_SCROLL_BOTTOM_INSET_PX,
    speedPx: SMART_SCROLL_SPEED_PX,
  },
  snapMinutes: GRID_TIME_STEP,
  timedColumnsElementId: ID_GRID_COLUMNS_TIMED,
  timedVisibleHours: TIMED_VISIBLE_HOURS,
  visibleDates: sources.visibleDays,
});

export const buildTimedWeekLayoutCache = (
  sources: WeekLayoutCacheInput,
): WeekLayoutCache | null =>
  buildTimedGridLayoutCache(weekLayoutCacheOptions(sources));

export const buildAllDayWeekLayoutCache = (
  sources: WeekLayoutCacheInput,
): WeekLayoutCache | null =>
  buildAllDayGridLayoutCache(weekLayoutCacheOptions(sources));

/** Both rows at once, so a drag can be dropped across them. */
export const buildDragWeekLayoutCache = (
  sources: WeekLayoutCacheInput,
  sourceRow: DragRow,
): WeekLayoutCache | null =>
  buildDragGridLayoutCache(weekLayoutCacheOptions(sources), sourceRow);
```

#### packages/web/src/grid/interaction/types/column-key.types.ts
_Included because: The helpers to import._

```
export type DateColumnKey = DateOnly;
export const asDateColumnKeys = (keys: string[]): DateColumnKey[] => keys as DateColumnKey[];
export const asDayColumnKeys = (keys: string[]): DayColumnKey[] => keys as DayColumnKey[];
```
### Acceptance criteria
- WeekLayoutCache is GridLayoutCache<DateColumnKey>
- weekLayoutCacheOptions returns GridLayoutCacheOptions<DateColumnKey> & WeekLayoutCacheSources and brands via asDateColumnKeys
- WeekLayoutCacheInput.visibleDays stays string[]
- A comment marks this as the branding boundary
- Every other export, import and constant is byte-identical
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