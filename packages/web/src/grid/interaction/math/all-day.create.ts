import { YEAR_MONTH_DAY_FORMAT } from "@core/constants/date.constants";
import dayjs from "@core/util/date/dayjs";

/**
 * Day-range math for all-day drag-to-create.
 *
 * `endDate` is **exclusive** — the day after the inclusive last day of the
 * span, matching the convention `event-nudge.util.ts` documents and
 * `getVisibleAllDaySpan` implements. A single-day span is therefore
 * `start → start + 1 day`, which is exactly what a click produced before this
 * module existed: the click is the n = 0 case of the general formula, not a
 * special case, so there is deliberately no click branch below.
 */
export interface AllDayCreateRange {
  /** Inclusive first day of the span. Passed through verbatim from getStartDate. */
  startDate: string;
  /** EXCLUSIVE end — the day after the inclusive last day. Always YYYY-MM-DD. */
  endDate: string;
}

export const resolveAllDayCreateRange = (
  anchorDate: string,
  pointerDate?: string | null,
): AllDayCreateRange => {
  const pointer = pointerDate ?? anchorDate;
  // Day-granularity so a consumer passing datetimes still normalizes on
  // calendar days rather than clock time.
  const isReverse = dayjs(pointer).isBefore(anchorDate, "day");
  // Passed through verbatim, never re-formatted: a consumer whose getStartDate
  // returns something other than YYYY-MM-DD must see its own value survive.
  const startDate = isReverse ? pointer : anchorDate;
  const inclusiveEnd = isReverse ? anchorDate : pointer;

  return {
    startDate,
    endDate: dayjs(inclusiveEnd).add(1, "day").format(YEAR_MONTH_DAY_FORMAT),
  };
};

/** Suppresses redundant store writes while the pointer moves inside one column. */
export const isSameAllDayCreateRange = (
  a: AllDayCreateRange | null,
  b: AllDayCreateRange,
): boolean => {
  if (a === null) return false;

  return a.startDate === b.startDate && a.endDate === b.endDate;
};
