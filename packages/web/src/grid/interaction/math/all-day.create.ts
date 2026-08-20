import { YEAR_MONTH_DAY_FORMAT } from "@core/constants/date.constants";
import dayjs from "@core/util/date/dayjs";

/** A normalised all-day creation span. Both fields are YEAR_MONTH_DAY_FORMAT. */
export interface AllDayCreateRange {
  /** Inclusive first day of the span. */
  startDate: string;
  /** Exclusive end: the last dragged day plus one, per the all-day convention. */
  endDate: string;
}

/**
 * Normalises a press day and a pointer day into an exclusive-end all-day span.
 *
 * Pure and stateless: it branches only on its two arguments, and `anchorDate`
 * is captured at press time and never rewritten, so repeated application with
 * an unchanged pointer returns an identical range.
 *
 * A drag from Thursday back to Monday and a drag from Monday out to Thursday
 * produce the same range — the min/max normalisation is what makes the gesture
 * direction-agnostic.
 */
export const resolveAllDayCreateRange = (
  anchorDate: string,
  pointerDate: string,
): AllDayCreateRange => {
  const anchor = dayjs(anchorDate);
  const pointer = dayjs(pointerDate);
  const isPointerBeforeAnchor = pointer.isBefore(anchor, "day");

  const firstDay = isPointerBeforeAnchor ? pointer : anchor;
  const lastDay = isPointerBeforeAnchor ? anchor : pointer;

  return {
    startDate: firstDay.format(YEAR_MONTH_DAY_FORMAT),
    endDate: lastDay.add(1, "day").format(YEAR_MONTH_DAY_FORMAT),
  };
};

/**
 * Store-write dedupe for the drag preview: the gesture only writes the draft
 * when the resolved span actually changes, so sub-column pointer jitter does
 * not churn the store. A null `a` is never equal, so the first move always
 * writes.
 */
export const isSameAllDayCreateRange = (
  a: AllDayCreateRange | null,
  b: AllDayCreateRange,
): boolean =>
  a !== null && a.startDate === b.startDate && a.endDate === b.endDate;
