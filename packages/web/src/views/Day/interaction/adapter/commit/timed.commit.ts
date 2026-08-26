import { type CalendarId } from "@core/types/domain-primitives";
import { type Dayjs } from "@core/util/date/dayjs";
import { type GridEvent } from "@web/common/types/web.event.types";
import { commitWithMapper } from "@web/grid/interaction/commit/commit-result";
import {
  hasTimedDragVisualMoved,
  hasTimedResizeVisualMoved,
} from "@web/grid/interaction/commit/timed-moved";
import { type TimedDragVisual } from "@web/grid/interaction/types/timed-drag.types";
import { type TimedResizeVisual } from "@web/grid/interaction/types/timed-resize.types";
import {
  type DayTimedDragCommitResult,
  type DayTimedDragTarget,
  type DayTimedResizeCommitResult,
  type DayTimedResizeTarget,
} from "../day-interaction.adapter.types";

/**
 * Day's commits are GATED: on a no-op they return `target.event` by reference
 * identity, unlike Week's timed resize which re-maps unconditionally. That
 * asymmetry is pinned by `commit-characterization.test.ts` in both views.
 */

export const commitTimedDragInteraction = (
  target: DayTimedDragTarget,
  visual: TimedDragVisual,
  visibleDate: Dayjs,
): DayTimedDragCommitResult =>
  commitWithMapper("timedDragEnd", target, visual, {
    hasMoved: hasTimedDragVisualMoved,
    toEvent: (t, v, hasMoved) =>
      hasMoved
        ? timedDragVisualToDayGridEvent(t.event, v, visibleDate)
        : t.event,
  });

export const commitTimedResizeInteraction = (
  target: DayTimedResizeTarget,
  visual: TimedResizeVisual,
  visibleDate: Dayjs,
): DayTimedResizeCommitResult =>
  commitWithMapper("timedResizeEnd", target, visual, {
    hasMoved: hasTimedResizeVisualMoved,
    toEvent: (t, v, hasMoved) =>
      hasMoved
        ? timedResizeVisualToDayGridEvent(t.event, v, visibleDate)
        : t.event,
  });

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
 *
 * DAY-ONLY. Must stay in this file and out of the shared commit layer:
 * hoisting it would put a calendarId rewrite one import away from Week's
 * drags, where a column key is a DATE, not a calendar.
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
