## Task tp_cg_019 — codegen / existing_file_edit
Module: geometry
### Working directory
You are running as an agent inside `/home/sainadh/projects/compass-calendar/compass/compass-calendar`. You may list, read,
edit and create files there, and run commands there. That directory is the
only place you can act; nothing outside it is reachable.
### Instruction
EDIT packages/web/src/views/Day/interaction/adapter/geometry/day-layout.cache.ts. Import `type DayColumnKey` from `@web/grid/interaction/types/column-key.types`, then: (1) change `export type DayLayoutCache = GridLayoutCache;` to `export type DayLayoutCache = GridLayoutCache<DayColumnKey>;` (leave `DayLayoutCacheSources = GridLayoutCacheSources` alone - sources carry no key); (2) change the `visibleDates: string[]` parameter of `buildDayTimedLayoutCache`, `buildDayAllDayLayoutCache` and `buildDayLayoutCacheForTarget` to `columnKeys: DayColumnKey[]` - rename the parameter to columnKeys since in Day these are calendar ids (or the single date fallback), NOT dates, and pass it through as the shared builders' `visibleDates` option; (3) give those three functions the return type `DayLayoutCache | null` where they are annotated. Keep `isAllDayTarget` and `isDayDragTarget` exactly as they are, keep `edgeThresholdPx: 0` on the all-day builder, keep INTERACTION_EDGE_THRESHOLD_PX on the timed builder, and keep every constant import (ID_GRID_MAIN, ID_ALLDAY_COLUMNS, ID_GRID_COLUMNS_TIMED, GRID_TIME_STEP, TIMED_VISIBLE_HOURS, the smart-scroll insets). Change ZERO runtime logic. EFFICIENCY RULE: do NOT run tests, type-check, build or lint. Touch NO other file. Do NOT run git, rm, mv, or any cleanup command.
### Provided excerpts
These are extracts, not whole files. The paths are real — open them in the
working directory when you need more than the excerpt shows.

#### packages/web/src/views/Day/interaction/adapter/geometry/day-layout.cache.ts
_Included because: The whole file - 76 lines._

```
import { ID_ALLDAY_COLUMNS, ID_GRID_COLUMNS_TIMED, ID_GRID_MAIN } from "@web/common/constants/web.constants";
import { GRID_TIME_STEP, TIMED_VISIBLE_HOURS } from "@web/grid/grid.constants";
import { SMART_SCROLL_BOTTOM_INSET_PX, SMART_SCROLL_SPEED_PX } from "@web/grid/interaction/adapter.helpers";
import { buildAllDayGridLayoutCache, buildTimedGridLayoutCache, type GridLayoutCache, type GridLayoutCacheSources } from "@web/grid/interaction/layout.cache";
import { INTERACTION_EDGE_THRESHOLD_PX } from "@web/interaction/interaction.constants";
import { type DayAllDayDragTarget, type DayAllDayResizeTarget, type DayInteractionTarget, type DayTimedDragTarget } from "../day-interaction.adapter.types";

export type DayLayoutCache = GridLayoutCache;
export type DayLayoutCacheSources = GridLayoutCacheSources;

export const buildDayTimedLayoutCache = (
  sources: GridLayoutCacheSources,
  visibleDates: string[],
) =>
  buildTimedGridLayoutCache({
    ...sources,
    edgeThresholdPx: INTERACTION_EDGE_THRESHOLD_PX,
    mainGridElementId: ID_GRID_MAIN,
    smartScroll: { bottomInsetPx: SMART_SCROLL_BOTTOM_INSET_PX, speedPx: SMART_SCROLL_SPEED_PX },
    snapMinutes: GRID_TIME_STEP,
    timedColumnsElementId: ID_GRID_COLUMNS_TIMED,
    timedVisibleHours: TIMED_VISIBLE_HOURS,
    visibleDates,
  });

export const buildDayAllDayLayoutCache = (
  sources: GridLayoutCacheSources,
  visibleDates: string[],
) =>
  buildAllDayGridLayoutCache({
    ...sources,
    allDayColumnsElementId: ID_ALLDAY_COLUMNS,
    edgeThresholdPx: 0,
    snapMinutes: GRID_TIME_STEP,
    timedVisibleHours: TIMED_VISIBLE_HOURS,
    visibleDates,
  });

const isAllDayTarget = (target: DayInteractionTarget): target is DayAllDayDragTarget | DayAllDayResizeTarget =>
  target.type === "allDayDrag" || target.type === "allDayResize";

export const buildDayLayoutCacheForTarget = (
  target: DayInteractionTarget,
  sources: GridLayoutCacheSources,
  visibleDates: string[],
) =>
  isAllDayTarget(target)
    ? buildDayAllDayLayoutCache(sources, visibleDates)
    : buildDayTimedLayoutCache(sources, visibleDates);

export const isDayDragTarget = (target: DayInteractionTarget): target is DayAllDayDragTarget | DayTimedDragTarget =>
  target.type === "allDayDrag" || target.type === "timedDrag";
```

#### packages/web/src/views/Week/interaction/adapter/geometry/week-layout.cache.ts
_Included because: The Week sibling, already converted - mirror this approach (Week brands inside the file; Day receives already-branded keys from the adapter, which owns the calendar-id-vs-date-fallback decision)._

```
export type WeekLayoutCache = GridLayoutCache<DateColumnKey>;

const weekLayoutCacheOptions = (
  sources: WeekLayoutCacheInput,
): GridLayoutCacheOptions<DateColumnKey> & WeekLayoutCacheSources => ({
  ...sources,
  // Branding boundary: the runtime supplies plain strings and they are
  // branded once here rather than validated per-frame on the drag path.
  visibleDates: asDateColumnKeys(sources.visibleDays),
});
```
### Acceptance criteria
- DayLayoutCache is GridLayoutCache<DayColumnKey>
- The three builder functions take columnKeys: DayColumnKey[]
- isAllDayTarget, isDayDragTarget, edgeThresholdPx: 0 and all constant imports preserved
- No runtime logic changed
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