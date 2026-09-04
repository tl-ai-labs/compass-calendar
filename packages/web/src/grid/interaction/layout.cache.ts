import { type DragRow } from "./types/timed-drag.types";

/**
 * The column-key parameter below defaults to `string`, not to `AnyColumnKey`.
 *
 * `string` is what the view boundaries actually hand in — Week's
 * `getVisibleDays(): string[]` and Day's `getColumnKeys(): string[]` are both
 * frozen signatures owned outside this layer — so a `string` default lets an
 * un-branded caller keep compiling and lets each refactor step land on its own.
 * Branding happens at exactly one entry point per view, which is where the
 * key type is named explicitly.
 *
 * The default is not the discriminant. `GridLayoutCache<DateColumnKey>` and
 * `GridLayoutCache<CalendarColumnKey>` are mutually unassignable regardless of
 * what the default is; the guard against a *bare*, accidentally-widened
 * reference in shared code is the G-3 grep, not this default.
 */

export interface GridLayoutCacheSources {
  allDayColumnsElement?: HTMLElement | null;
  mainGridElement?: HTMLElement | null;
  timedColumnsElement?: HTMLElement | null;
}

export interface GridLayoutCacheOptions<TKey extends string = string> {
  allDayColumnsElementId?: string;
  edgeThresholdPx: number;
  mainGridElementId?: string;
  snapMinutes: number;
  smartScroll?: {
    bottomInsetPx: number;
    speedPx: number;
  };
  timedColumnsElementId?: string;
  timedVisibleHours: number;
  /**
   * Keys of the rendered columns, in window order. Week passes local
   * YYYY-MM-DD dates, Day passes calendar ids — see `ColumnKey`.
   */
  visibleDates: TKey[];
}

export interface DayColumnCache<TKey extends string = string> {
  /** Key this column renders — a date in Week, a calendar id in Day. */
  date: TKey;
  index: number;
  left: number;
  width: number;
}

export interface EdgeNavigationCache {
  bottom: number;
  edgeThresholdPx: number;
  left: number;
  right: number;
  top: number;
}

export interface SmartScrollCache {
  bottom: number;
  edgeThresholdPx: number;
  element: HTMLElement;
  initialScrollTop: number;
  maxScrollTop: number;
  speedPx: number;
  top: number;
}

export interface GridLayoutCache<TKey extends string = string> {
  /**
   * The *other* row's geometry, so a drag can hit-test the pointer against both
   * rows every frame and drop across them. Built for drags only (see
   * buildDragGridLayoutCache); resizes stay within one row and leave it
   * unset, as do layouts where the other row isn't on screen.
   */
  crossRow?: GridLayoutCache<TKey>;
  dayColumns: DayColumnCache<TKey>[];
  edgeNavigation: EdgeNavigationCache;
  pixelsPerMinute: number;
  snapMinutes: number;
  smartScroll?: SmartScrollCache;
}

interface BuildDayColumnsInput<TKey extends string = string> {
  left: number;
  visibleDates: TKey[];
  width: number;
}

export const buildTimedGridLayoutCache = <TKey extends string = string>({
  edgeThresholdPx,
  mainGridElement,
  mainGridElementId,
  smartScroll,
  snapMinutes,
  timedColumnsElement,
  timedColumnsElementId,
  timedVisibleHours,
  visibleDates,
}: GridLayoutCacheOptions<TKey> &
  GridLayoutCacheSources): GridLayoutCache<TKey> | null => {
  const mainGrid = mainGridElement ?? getElementById(mainGridElementId);

  if (!mainGrid || visibleDates.length === 0) {
    return null;
  }

  const rect = mainGrid.getBoundingClientRect();
  const columnsRect =
    getElementRect(timedColumnsElement) ??
    getElementRect(getElementById(timedColumnsElementId)) ??
    rect;

  return {
    dayColumns: buildDayColumns(columnsRect, visibleDates),
    edgeNavigation: {
      bottom: rect.bottom,
      edgeThresholdPx,
      left: columnsRect.left,
      right: columnsRect.right,
      top: rect.top,
    },
    pixelsPerMinute: rect.height / (timedVisibleHours * 60),
    snapMinutes,
    smartScroll: smartScroll
      ? {
          bottom: rect.bottom - smartScroll.bottomInsetPx,
          edgeThresholdPx,
          element: mainGrid,
          initialScrollTop: mainGrid.scrollTop,
          maxScrollTop: Math.max(
            0,
            mainGrid.scrollHeight - mainGrid.clientHeight,
          ),
          speedPx: smartScroll.speedPx,
          top: rect.top,
        }
      : undefined,
  };
};

export const buildAllDayGridLayoutCache = <TKey extends string = string>({
  allDayColumnsElement,
  allDayColumnsElementId,
  edgeThresholdPx,
  snapMinutes,
  visibleDates,
}: GridLayoutCacheOptions<TKey> &
  GridLayoutCacheSources): GridLayoutCache<TKey> | null => {
  const rect = getElementRect(
    allDayColumnsElement ?? getElementById(allDayColumnsElementId),
  );

  if (!rect || visibleDates.length === 0) {
    return null;
  }

  return {
    dayColumns: buildDayColumns(rect, visibleDates),
    edgeNavigation: {
      bottom: rect.bottom,
      edgeThresholdPx,
      left: rect.left,
      right: rect.right,
      top: rect.top,
    },
    pixelsPerMinute: 1,
    snapMinutes,
  };
};

/**
 * Pairs the drag's own row geometry (primary, so every existing same-row
 * consumer reads it unchanged) with the other row's on `crossRow`. Returns null
 * only when the drag's own row is missing — a missing *other* row just leaves
 * `crossRow` unset, which keeps the drag on its same-row path.
 */
export const buildDragGridLayoutCache = <TKey extends string = string>(
  options: GridLayoutCacheOptions<TKey> & GridLayoutCacheSources,
  sourceRow: DragRow,
): GridLayoutCache<TKey> | null => {
  const allDay = buildAllDayGridLayoutCache(options);
  const timed = buildTimedGridLayoutCache(options);
  const [primary, crossRow] =
    sourceRow === "allDay" ? [allDay, timed] : [timed, allDay];

  return primary ? { ...primary, crossRow: crossRow ?? undefined } : null;
};

export function buildDayColumns<TKey extends string = string>(
  input: BuildDayColumnsInput<TKey>,
): DayColumnCache<TKey>[];
export function buildDayColumns<TKey extends string = string>(
  input: Pick<DOMRect, "left" | "width">,
  visibleDates: TKey[],
): DayColumnCache<TKey>[];
export function buildDayColumns<TKey extends string = string>(
  input: BuildDayColumnsInput<TKey> | Pick<DOMRect, "left" | "width">,
  visibleDates?: TKey[],
): DayColumnCache<TKey>[] {
  const dates =
    visibleDates ?? (input as BuildDayColumnsInput<TKey>).visibleDates;

  if (dates.length === 0) {
    return [];
  }

  const columnWidth = input.width / dates.length;

  return dates.map((date, index) => ({
    date,
    index,
    left: input.left + columnWidth * index,
    width: columnWidth,
  }));
}

export const getNearestDayColumn = <TKey extends string = string>(
  columns: DayColumnCache<TKey>[],
  x: number,
) => {
  let nearest: DayColumnCache<TKey> | null = null;
  let nearestDistance = Number.POSITIVE_INFINITY;

  for (const column of columns) {
    const center = column.left + column.width / 2;
    const distance = Math.abs(center - x);

    if (distance < nearestDistance) {
      nearest = column;
      nearestDistance = distance;
    }
  }

  return nearest;
};

const getElementById = (id: string | undefined) =>
  id ? document.getElementById(id) : null;

const getElementRect = (element: HTMLElement | null | undefined) => {
  const rect = element?.getBoundingClientRect();

  return rect && rect.width > 0 ? rect : null;
};
