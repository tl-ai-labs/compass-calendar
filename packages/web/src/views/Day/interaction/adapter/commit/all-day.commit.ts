import { YEAR_MONTH_DAY_FORMAT } from "@core/constants/date.constants";
import { type Dayjs } from "@core/util/date/dayjs";
import { type GridEvent } from "@web/common/types/web.event.types";
import { commitWithMapper } from "@web/grid/interaction/commit/commit-result";
import { type AllDayDragVisual } from "@web/grid/interaction/types/all-day-drag.types";
import { type AllDayResizeVisual } from "@web/grid/interaction/types/all-day-resize.types";
import {
  type DayAllDayDragCommitResult,
  type DayAllDayDragTarget,
  type DayAllDayResizeCommitResult,
  type DayAllDayResizeTarget,
} from "../day-interaction.adapter.types";
import { columnMoveCalendarId } from "./timed.commit";

/**
 * In the Day view every column shares the visible date, so an all-day drag
 * that "moved" can only have changed COLUMN, i.e. calendar. Keep the event's
 * own dates: rewriting them to the visible date would truncate a multi-day
 * all-day event to a single day.
 *
 * This is the sharpest Week/Day divergence in the commit layer — Week's
 * all-day drag shifts `startDate`/`endDate` by a day delta and never touches
 * `calendarId`. The two mappers must not be unified.
 */
export const commitAllDayDragInteraction = (
  target: DayAllDayDragTarget,
  visual: AllDayDragVisual,
): DayAllDayDragCommitResult =>
  commitWithMapper("allDayDragEnd", target, visual, {
    hasMoved: (v) => ("dayDate" in v ? v.dayDate !== v.initialDayDate : false),
    toEvent: (t, v, hasMoved) =>
      hasMoved
        ? {
            ...t.event,
            calendarId: columnMoveCalendarId(v, t.event),
          }
        : t.event,
  });

/**
 * Note the mapper ignores `visual` entirely — Day's all-day resize collapses
 * the event onto the visible date regardless of which edge moved. Preserved
 * verbatim from the pre-refactor implementation.
 */
export const commitAllDayResizeInteraction = (
  target: DayAllDayResizeTarget,
  visual: AllDayResizeVisual,
  visibleDate: Dayjs,
): DayAllDayResizeCommitResult =>
  commitWithMapper("allDayResizeEnd", target, visual, {
    hasMoved: (v) =>
      v.startDayIndex !== v.initialStartDayIndex ||
      v.endDayIndex !== v.initialEndDayIndex,
    toEvent: (t, _v, hasMoved) =>
      hasMoved ? allDayVisualToDayGridEvent(t.event, visibleDate) : t.event,
  });

const allDayVisualToDayGridEvent = (
  event: GridEvent,
  visibleDate: Dayjs,
): GridEvent => ({
  ...event,
  isAllDay: true,
  endDate: visibleDate.add(1, "day").format(YEAR_MONTH_DAY_FORMAT),
  startDate: visibleDate.format(YEAR_MONTH_DAY_FORMAT),
});
