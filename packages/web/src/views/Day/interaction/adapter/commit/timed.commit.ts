import { type CalendarId } from "@core/types/domain-primitives";
import { type Dayjs } from "@core/util/date/dayjs";
import { type GridEvent } from "@web/common/types/web.event.types";
import {
  hasTimedDragVisualMoved,
  hasTimedResizeVisualMoved,
} from "@web/grid/interaction/commit/timed-moved";
import { type CalendarColumnKey } from "@web/grid/interaction/types/column-key.types";
import { type TimedDragVisual } from "@web/grid/interaction/types/timed-drag.types";
import { type TimedResizeVisual } from "@web/grid/interaction/types/timed-resize.types";
import {
  type DayTimedDragCommitResult,
  type DayTimedDragTarget,
  type DayTimedResizeCommitResult,
  type DayTimedResizeTarget,
} from "../day-interaction.adapter.types";

export const commitTimedDragInteraction = (
  target: DayTimedDragTarget,
  visual: TimedDragVisual<CalendarColumnKey>,
  visibleDate: Dayjs,
): DayTimedDragCommitResult => {
  const hasMoved = hasTimedDragVisualMoved(visual);

  return {
    event: hasMoved
      ? timedDragVisualToDayGridEvent(target.event, visual, visibleDate)
      : target.event,
    eventId: target.event._id!,
    hadFormOpenBeforeInteraction: target.hadFormOpenBeforeInteraction,
    hasMoved,
    type: "timedDragEnd",
  };
};

export const commitTimedResizeInteraction = (
  target: DayTimedResizeTarget,
  visual: TimedResizeVisual,
  visibleDate: Dayjs,
): DayTimedResizeCommitResult => {
  const hasMoved = hasTimedResizeVisualMoved(visual);

  return {
    event: hasMoved
      ? timedResizeVisualToDayGridEvent(target.event, visual, visibleDate)
      : target.event,
    eventId: target.event._id!,
    hadFormOpenBeforeInteraction: target.hadFormOpenBeforeInteraction,
    hasMoved,
    type: "timedResizeEnd",
  };
};

export const timedDragVisualToDayGridEvent = (
  event: GridEvent,
  visual: TimedDragVisual<CalendarColumnKey>,
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
  visual: Pick<
    TimedDragVisual<CalendarColumnKey>,
    "dayDate" | "initialDayDate"
  >,
  event: GridEvent,
): CalendarId | undefined =>
  visual.dayDate !== visual.initialDayDate
    ? columnKeyAsCalendarId(visual.dayDate)
    : event.calendarId;

/**
 * The one deliberate crossing from a Day column key to a calendar id.
 *
 * Reached only when `dayDate !== initialDayDate`, which by the comment above is
 * unreachable in the single-column fallback (that array holds one key and it
 * never changes). So at this point the key is provably a rendered calendar
 * column's id rather than the fallback date.
 *
 * `as unknown as` is required because `CalendarColumnKey` and `CalendarId` are
 * disjoint brands. The double cast is the signal that this is a deliberate,
 * reasoned crossing — which is the improvement over the bare `as CalendarId`
 * this replaced, where nothing marked it as load-bearing.
 */
const columnKeyAsCalendarId = (key: CalendarColumnKey): CalendarId =>
  key as unknown as CalendarId;

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
