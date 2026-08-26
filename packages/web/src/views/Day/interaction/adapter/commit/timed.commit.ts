import { type CalendarId } from "@core/types/domain-primitives";
import { type Dayjs } from "@core/util/date/dayjs";
import { type GridEvent } from "@web/common/types/web.event.types";
import {
  hasTimedDragVisualMoved,
  hasTimedResizeVisualMoved,
} from "@web/grid/interaction/commit/timed-moved";
import { type TimedDragVisual } from "@web/grid/interaction/types/timed-drag.types";
import { type TimedResizeVisual } from "@web/grid/interaction/types/timed-resize.types";

export { hasTimedDragVisualMoved, hasTimedResizeVisualMoved };

export const timedDragVisualToDayGridEvent = (
  event: GridEvent,
  visual: TimedDragVisual,
  visibleDate: Dayjs,
): GridEvent => ({
  ...event,
  calendarId: columnMoveCalendarId(visual, event),
  isAllDay: false,
  endDate: visibleDate
    .startOf("day")
    .add(visual.endMinutes, "minutes")
    .format(),
  startDate: visibleDate
    .startOf("day")
    .add(visual.startMinutes, "minutes")
    .format(),
});

/**
 * Day-view drag column keys are calendar ids (see createVisual), so a drop
 * on a different column is a cross-calendar move. Same-column drops (and the
 * single-column fallback, whose one key is a date string that never changes)
 * keep the event's own calendarId.
 */
export const columnMoveCalendarId = (
  visual: Pick<TimedDragVisual, "dayDate" | "initialDayDate">,
  event: GridEvent,
): CalendarId | undefined =>
  visual.dayDate !== visual.initialDayDate
    ? (visual.dayDate as CalendarId)
    : event.calendarId;

export const timedResizeVisualToDayGridEvent = (
  event: GridEvent,
  visual: TimedResizeVisual,
  visibleDate: Dayjs,
): GridEvent => ({
  ...event,
  isAllDay: false,
  endDate: visibleDate
    .startOf("day")
    .add(visual.endMinutes, "minutes")
    .format(),
  startDate: visibleDate
    .startOf("day")
    .add(visual.startMinutes, "minutes")
    .format(),
});
