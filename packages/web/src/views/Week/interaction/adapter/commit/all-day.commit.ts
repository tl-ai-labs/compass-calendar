import { YEAR_MONTH_DAY_FORMAT } from "@core/constants/date.constants";
import dayjs from "@core/util/date/dayjs";
import { type GridEvent } from "@web/common/types/web.event.types";
import { commitWithMapper } from "@web/grid/interaction/commit/commit-result";
import { allDayDragVisualToTimedGridEvent } from "@web/grid/interaction/commit/cross-row.commit";
import { type AllDayDragVisual } from "@web/grid/interaction/types/all-day-drag.types";
import { type AllDayResizeVisual } from "@web/grid/interaction/types/all-day-resize.types";
import {
  type WeekAllDayDragCommitResult,
  type WeekAllDayDragTarget,
  type WeekAllDayResizeCommitResult,
  type WeekAllDayResizeTarget,
} from "../week-interaction.adapter.types";

export const hasAllDayDragVisualMoved = (visual: AllDayDragVisual) =>
  visual.dayDate !== visual.initialDayDate;

export const allDayDragVisualToGridEvent = (
  event: GridEvent,
  visual: AllDayDragVisual,
): GridEvent => {
  // Delta (not absolute) semantics: multi-day spans are clamped to the
  // rendered window, so the initial column date is the clamped visible start,
  // not necessarily the event's own start date. The date diff also absorbs
  // mid-drag week navigation of any shift size.
  const dayDelta = dayjs(visual.dayDate).diff(
    dayjs(visual.initialDayDate),
    "day",
  );

  return {
    ...event,
    endDate: dayjs(event.endDate)
      .add(dayDelta, "day")
      .format(YEAR_MONTH_DAY_FORMAT),
    startDate: dayjs(event.startDate)
      .add(dayDelta, "day")
      .format(YEAR_MONTH_DAY_FORMAT),
  };
};

export const hasAllDayResizeVisualChanged = (visual: AllDayResizeVisual) =>
  visual.startDayIndex !== visual.initialStartDayIndex ||
  visual.endDayIndex !== visual.initialEndDayIndex;

export const allDayResizeVisualToGridEvent = (
  event: GridEvent,
  visual: AllDayResizeVisual,
): GridEvent => {
  if (!hasAllDayResizeVisualChanged(visual)) {
    return event;
  }

  const startDayDelta = visual.startDayIndex - visual.initialStartDayIndex;
  const endDayDelta = visual.endDayIndex - visual.initialEndDayIndex;
  const startDate = dayjs(event.startDate).add(startDayDelta, "day");
  const baseEndDate = getExclusiveEndDateBaseline(event);

  return {
    ...event,
    endDate: baseEndDate.add(endDayDelta, "day").format(YEAR_MONTH_DAY_FORMAT),
    startDate: startDate.format(YEAR_MONTH_DAY_FORMAT),
  };
};

/**
 * WEEK-ONLY and deliberately NOT exported. All-day dates have an exclusive
 * end, so a same-day event's end baseline is start + 1 day. Hoisting this to
 * the shared commit layer would put a Week-only rule one import away from
 * Day's all-day resize, which must instead collapse the event to a single day
 * at the visible date.
 */
const getExclusiveEndDateBaseline = (event: GridEvent) => {
  const startDate = dayjs(event.startDate).startOf("day");
  const endDate = dayjs(event.endDate).startOf("day");

  return endDate.diff(startDate, "day") <= 0
    ? startDate.add(1, "day")
    : endDate;
};

/**
 * A drop in the timed grid is ALWAYS a change, even onto the same day: the
 * event gains a time of day it never had. That forcing is the `isCrossRow ||`
 * term below — if it were ever replaced by the bare `hasAllDayDragVisualMoved`
 * predicate, a same-day cross-row drop would report `hasMoved: false`, the
 * coordinator would take its `!hasMoved` branch, and the row change would be
 * REOPENED rather than saved. Pinned by `commit-characterization.test.ts`.
 */
export const commitAllDayDragInteraction = (
  target: WeekAllDayDragTarget,
  visual: AllDayDragVisual,
): WeekAllDayDragCommitResult =>
  commitWithMapper("allDayDragEnd", target, visual, {
    hasMoved: (v) => v.row === "timed" || hasAllDayDragVisualMoved(v),
    toEvent: (t, v) =>
      v.row === "timed"
        ? allDayDragVisualToTimedGridEvent(t.event, v)
        : allDayDragVisualToGridEvent(t.event, v),
  });

/**
 * `toEvent` ignores `hasMoved` on purpose: Week maps unconditionally here and
 * `allDayResizeVisualToGridEvent` does its own no-change short-circuit
 * internally. Day's equivalent gates on `hasMoved` instead. Do not converge.
 */
export const commitAllDayResizeInteraction = (
  target: WeekAllDayResizeTarget,
  visual: AllDayResizeVisual,
): WeekAllDayResizeCommitResult =>
  commitWithMapper("allDayResizeEnd", target, visual, {
    hasMoved: hasAllDayResizeVisualChanged,
    toEvent: (t, v) => allDayResizeVisualToGridEvent(t.event, v),
  });
