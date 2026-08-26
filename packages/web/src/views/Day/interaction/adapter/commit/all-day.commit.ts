import { YEAR_MONTH_DAY_FORMAT } from "@core/constants/date.constants";
import { type Dayjs } from "@core/util/date/dayjs";
import { type GridEvent } from "@web/common/types/web.event.types";
import { type AllDayDragVisual } from "@web/grid/interaction/types/all-day-drag.types";
import { type AllDayResizeVisual } from "@web/grid/interaction/types/all-day-resize.types";

export { columnMoveCalendarId } from "./timed.commit";

export const hasDayAllDayDragVisualMoved = (visual: AllDayDragVisual) =>
  // Day's all-day visual is not guaranteed to carry a dayDate, so the guard is
  // a property check rather than a comparison. Preserved verbatim.
  "dayDate" in visual ? visual.dayDate !== visual.initialDayDate : false;

export const hasDayAllDayResizeVisualChanged = (visual: AllDayResizeVisual) =>
  visual.startDayIndex !== visual.initialStartDayIndex ||
  visual.endDayIndex !== visual.initialEndDayIndex;

/**
 * Note the asymmetry with the all-day DRAG path, which deliberately keeps the
 * event's own dates. A resize is an explicit request to change the span, so
 * rewriting to the visible date is intended here and truncation is the point.
 * Whether that is the right product behaviour is a separate question; it is
 * preserved exactly as it was.
 */
export const allDayVisualToDayGridEvent = (
  event: GridEvent,
  visibleDate: Dayjs,
): GridEvent => ({
  ...event,
  isAllDay: true,
  endDate: visibleDate.add(1, "day").format(YEAR_MONTH_DAY_FORMAT),
  startDate: visibleDate.format(YEAR_MONTH_DAY_FORMAT),
});
