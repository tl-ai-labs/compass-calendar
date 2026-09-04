import {
  ID_ALLDAY_COLUMNS,
  ID_GRID_COLUMNS_TIMED,
  ID_GRID_MAIN,
} from "@web/common/constants/web.constants";
import { GRID_TIME_STEP, TIMED_VISIBLE_HOURS } from "@web/grid/grid.constants";
import {
  SMART_SCROLL_BOTTOM_INSET_PX,
  SMART_SCROLL_SPEED_PX,
} from "@web/grid/interaction/adapter.helpers";
import {
  buildAllDayGridLayoutCache,
  buildTimedGridLayoutCache,
  type GridLayoutCache,
  type GridLayoutCacheSources,
} from "@web/grid/interaction/layout.cache";
import { type CalendarColumnKey } from "@web/grid/interaction/types/column-key.types";
import { INTERACTION_EDGE_THRESHOLD_PX } from "@web/interaction/interaction.constants";
import {
  type DayAllDayDragTarget,
  type DayAllDayResizeTarget,
  type DayInteractionTarget,
  type DayTimedDragTarget,
} from "../day-interaction.adapter.types";

export type DayLayoutCache = GridLayoutCache<CalendarColumnKey>;
export type DayLayoutCacheSources = GridLayoutCacheSources;

/**
 * The one place Day column keys enter the branded world.
 *
 * Keys arrive as a bare `string[]`: normally the rendered calendar ids from
 * `DayInteractionAdapterOptions.getColumnKeys()` (a frozen signature owned
 * outside this layer), and in the single-column fallback one locally-built
 * `YYYY-MM-DD` date. `CalendarColumnKey` covers both on purpose — it brands the
 * column-key *role*, not the value format, which is why it is deliberately not
 * `CalendarId`.
 */
export const asDayColumnKeys = (keys: string[]): CalendarColumnKey[] =>
  keys as CalendarColumnKey[];

export const buildDayTimedLayoutCache = (
  sources: GridLayoutCacheSources,
  visibleDates: CalendarColumnKey[],
) =>
  buildTimedGridLayoutCache({
    ...sources,
    edgeThresholdPx: INTERACTION_EDGE_THRESHOLD_PX,
    mainGridElementId: ID_GRID_MAIN,
    smartScroll: {
      bottomInsetPx: SMART_SCROLL_BOTTOM_INSET_PX,
      speedPx: SMART_SCROLL_SPEED_PX,
    },
    snapMinutes: GRID_TIME_STEP,
    timedColumnsElementId: ID_GRID_COLUMNS_TIMED,
    timedVisibleHours: TIMED_VISIBLE_HOURS,
    visibleDates,
  });

export const buildDayAllDayLayoutCache = (
  sources: GridLayoutCacheSources,
  visibleDates: CalendarColumnKey[],
) =>
  buildAllDayGridLayoutCache({
    ...sources,
    allDayColumnsElementId: ID_ALLDAY_COLUMNS,
    edgeThresholdPx: 0,
    snapMinutes: GRID_TIME_STEP,
    timedVisibleHours: TIMED_VISIBLE_HOURS,
    visibleDates,
  });

const isAllDayTarget = (
  target: DayInteractionTarget,
): target is DayAllDayDragTarget | DayAllDayResizeTarget =>
  target.type === "allDayDrag" || target.type === "allDayResize";

export const buildDayLayoutCacheForTarget = (
  target: DayInteractionTarget,
  sources: GridLayoutCacheSources,
  visibleDates: CalendarColumnKey[],
) =>
  isAllDayTarget(target)
    ? buildDayAllDayLayoutCache(sources, visibleDates)
    : buildDayTimedLayoutCache(sources, visibleDates);

export const isDayDragTarget = (
  target: DayInteractionTarget,
): target is DayAllDayDragTarget | DayTimedDragTarget =>
  target.type === "allDayDrag" || target.type === "timedDrag";
