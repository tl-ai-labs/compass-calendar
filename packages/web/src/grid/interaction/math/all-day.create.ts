/**
 * Day-range math for all-day drag-to-create in calendar grids.
 *
 * Normalizes reverse drags (pointer before anchor) so `startDate` is always the
 * earlier day, and returns an *exclusive* `endDate` (later day + 1) to match the
 * half-open convention `allDayGridSchedule` already uses — a single-day range is
 * `{ start: D, end: D + 1 }`, which is exactly what the click path produces.
 *
 * Deliberately does no clamping: `useGridCoordinates.getVisibleDateIndexByX`
 * already clamps the column index into the visible week, so both arguments
 * arrive pre-clamped.
 */
import { YEAR_MONTH_DAY_FORMAT } from "@core/constants/date.constants";
import dayjs from "@core/util/date/dayjs";

export interface AllDayCreateRange {
  /** Inclusive first day, `YYYY-MM-DD`. */
  startDate: string;
  /** Exclusive end day, `YYYY-MM-DD` — matches allDayGridSchedule's half-open convention. */
  endDate: string;
}

export const getAllDayCreateRange = (
  anchorDate: string,
  pointerDate: string,
): AllDayCreateRange => {
  const anchor = dayjs(anchorDate);
  const pointer = dayjs(pointerDate);
  const isForward = !pointer.isBefore(anchor, "day");
  const start = isForward ? anchor : pointer;
  const end = isForward ? pointer : anchor;

  return {
    startDate: start.format(YEAR_MONTH_DAY_FORMAT),
    endDate: end.add(1, "day").format(YEAR_MONTH_DAY_FORMAT),
  };
};
