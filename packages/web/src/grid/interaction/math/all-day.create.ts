import { YEAR_MONTH_DAY_FORMAT } from "@core/constants/date.constants";
import dayjs from "@core/util/date/dayjs";

export interface NormalizedDayRange {
  startDay: string; // "YYYY-MM-DD"
  endDay: string; // "YYYY-MM-DD" (inclusive)
}

export interface ClampedAllDayCreateRangeInput {
  anchorDate: string; // "YYYY-MM-DD"
  currentDate: string; // "YYYY-MM-DD"
  minDate: string; // "YYYY-MM-DD"
  maxDate: string; // "YYYY-MM-DD"
}

export interface AllDayScheduleDates {
  startDate: string; // "YYYY-MM-DD"
  endDate: string; // "YYYY-MM-DD" (exclusive: endDay + 1 day)
}

/**
 * Normalizes two YYYY-MM-DD date strings so startDay <= endDay lexicographically.
 */
export function normalizeDayRange(
  dateA: string,
  dateB: string,
): NormalizedDayRange {
  return dateA <= dateB
    ? { startDay: dateA, endDay: dateB }
    : { startDay: dateB, endDay: dateA };
}

/**
 * Clamps a YYYY-MM-DD date string within [minDate, maxDate].
 */
export function clampDayToVisibleBounds(
  date: string,
  minDate: string,
  maxDate: string,
): string {
  if (date < minDate) return minDate;
  if (date > maxDate) return maxDate;
  return date;
}

/**
 * Converts inclusive last day into an exclusive schedule endDate (+1 day).
 */
export function toExclusiveAllDayEndDate(lastInclusiveDate: string): string {
  return dayjs(lastInclusiveDate).add(1, "day").format(YEAR_MONTH_DAY_FORMAT);
}

/**
 * Resolves normalized, clamped start and exclusive end dates for all-day draft schedule.
 */
export function calculateAllDayCreateSchedule({
  anchorDate,
  currentDate,
  minDate,
  maxDate,
}: ClampedAllDayCreateRangeInput): AllDayScheduleDates {
  const clampedAnchor = clampDayToVisibleBounds(anchorDate, minDate, maxDate);
  const clampedCurrent = clampDayToVisibleBounds(currentDate, minDate, maxDate);
  const { startDay, endDay } = normalizeDayRange(clampedAnchor, clampedCurrent);
  return {
    startDate: startDay,
    endDate: toExclusiveAllDayEndDate(endDay),
  };
}
