import { YEAR_MONTH_DAY_FORMAT } from "@core/constants/date.constants";
import dayjs from "@core/util/date/dayjs";

export interface AllDayDayRange {
  /** Inclusive first day, YYYY-MM-DD. */
  start: string;
  /** EXCLUSIVE last day, YYYY-MM-DD - feeds allDayGridSchedule directly. */
  end: string;
}

export interface ResolveAllDayDayRangeInput {
  /** The day the press landed on, YYYY-MM-DD. */
  anchorDate: string;
  /** The day under the pointer right now, YYYY-MM-DD. */
  pointerDate: string;
  /**
   * The rendered window, ascending YYYY-MM-DD. When supplied, both anchor and
   * pointer are clamped into [first, last] before normalisation. Omit to skip
   * clamping.
   */
  visibleDates?: readonly string[];
}

export const resolveAllDayDayRange = (
  input: ResolveAllDayDayRangeInput,
): AllDayDayRange => {
  const { anchorDate, pointerDate, visibleDates } = input;
  let clampedAnchor = anchorDate;
  let clampedPointer = pointerDate;

  if (visibleDates && visibleDates.length > 0) {
    const windowStart = visibleDates[0];
    const windowEnd = visibleDates[visibleDates.length - 1];
    if (clampedAnchor < windowStart) clampedAnchor = windowStart;
    else if (clampedAnchor > windowEnd) clampedAnchor = windowEnd;

    if (clampedPointer < windowStart) clampedPointer = windowStart;
    else if (clampedPointer > windowEnd) clampedPointer = windowEnd;
  }

  const start =
    clampedAnchor <= clampedPointer ? clampedAnchor : clampedPointer;
  const last = clampedAnchor >= clampedPointer ? clampedAnchor : clampedPointer;

  return {
    start,
    end: dayjs(last).add(1, "day").format(YEAR_MONTH_DAY_FORMAT),
  };
};

export const isSameAllDayDayRange = (
  a: AllDayDayRange,
  b: AllDayDayRange,
): boolean => a.start === b.start && a.end === b.end;

/** X-AXIS-ONLY move threshold test. Strict greater-than. Symmetric (use Math.abs). */
export const hasExceededAllDayDragThreshold = (
  currentX: number,
  initialX: number,
  thresholdPx: number,
): boolean => Math.abs(currentX - initialX) > thresholdPx;
