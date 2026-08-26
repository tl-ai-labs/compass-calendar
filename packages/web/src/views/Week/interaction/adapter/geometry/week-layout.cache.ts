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
  buildDragGridLayoutCache,
  buildTimedGridLayoutCache,
  type GridLayoutCache,
  type GridLayoutCacheOptions,
  type GridLayoutCacheSources,
} from "@web/grid/interaction/layout.cache";
import { type DragRow } from "@web/grid/interaction/types/timed-drag.types";
import { WEEK_EDGE_NAVIGATION_THRESHOLD_PX } from "../edge-navigation";

/**
 * The week renders a dynamic window of 1-7 day columns. The columns' dates
 * come from the same React render that painted them (weekProps weekDays via
 * the interaction runtime), so drag geometry and drop dates always agree
 * with what is on screen.
 *
 * This interface is KEPT (unlike the deleted `WeekLayoutCacheSources` /
 * `WeekLayoutCache` / `SmartScrollCache` / `getNearestDayColumn` re-exports)
 * because it carries real structure: the `visibleDays` field. Day has no
 * equivalent — it passes `visibleDates` positionally instead — and that
 * difference is deliberate.
 */
export interface WeekLayoutCacheInput extends GridLayoutCacheSources {
  /** Local YYYY-MM-DD dates of the rendered day columns, in window order. */
  visibleDays: string[];
}

/**
 * ONE options object feeds BOTH rows, so the all-day row also receives
 * `edgeThresholdPx: WEEK_EDGE_NAVIGATION_THRESHOLD_PX` (50) and a
 * `smartScroll` block that `buildAllDayGridLayoutCache` discards. Day's
 * all-day builder hard-codes `edgeThresholdPx: 0` instead. Do NOT merge the
 * two builder families — one view's edge behavior would silently flip.
 */
const weekLayoutCacheOptions = (
  sources: WeekLayoutCacheInput,
): GridLayoutCacheOptions & GridLayoutCacheSources => ({
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
): GridLayoutCache | null =>
  buildTimedGridLayoutCache(weekLayoutCacheOptions(sources));

export const buildAllDayWeekLayoutCache = (
  sources: WeekLayoutCacheInput,
): GridLayoutCache | null =>
  buildAllDayGridLayoutCache(weekLayoutCacheOptions(sources));

/** Both rows at once, so a drag can be dropped across them. */
export const buildDragWeekLayoutCache = (
  sources: WeekLayoutCacheInput,
  sourceRow: DragRow,
): GridLayoutCache | null =>
  buildDragGridLayoutCache(weekLayoutCacheOptions(sources), sourceRow);
