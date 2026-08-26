import { YEAR_MONTH_DAY_FORMAT } from "@core/constants/date.constants";
import dayjs from "@core/util/date/dayjs";
import { getLocalMinutes } from "@web/grid/interaction/date";
import {
  type GridLayoutCache,
  getNearestDayColumn,
} from "@web/grid/interaction/layout.cache";
import {
  createTimedDragVisual,
  updateTimedDragVisual,
} from "@web/grid/interaction/math/timed.drag";
import {
  type TimedDragVisual,
  type VisualPoint,
  type VisualRect,
} from "@web/grid/interaction/types/timed-drag.types";
import { type InteractionPoint } from "@web/interaction/interaction.types";
import { timedDragVisualToGridEvent } from "../commit/timed.commit";
import { type WeekTimedDragTarget } from "../week-interaction.adapter.types";

export const createTimedDragInteractionVisual = ({
  layout,
  pointerStart,
  sourceRect,
  target,
}: {
  layout: GridLayoutCache;
  pointerStart: InteractionPoint;
  sourceRect: VisualRect;
  target: WeekTimedDragTarget;
}) => {
  // Timed events render in the column of their start date, so the date lookup
  // is exact; the geometric nearest-column fallback is belt-and-braces.
  const startDateKey = dayjs(target.event.startDate).format(
    YEAR_MONTH_DAY_FORMAT,
  );
  const sourceColumn =
    layout.dayColumns.find((column) => column.date === startDateKey) ??
    getNearestDayColumn(layout.dayColumns, sourceRect.left + 1);

  if (!sourceColumn) {
    return null;
  }

  return createTimedDragVisual({
    dayDate: sourceColumn.date,
    dayIndex: sourceColumn.index,
    endMinutes: getLocalMinutes(target.event.endDate),
    eventId: target.event._id!,
    pointerStart,
    sourceRect,
    startMinutes: getLocalMinutes(target.event.startDate),
  });
};

export const updateTimedDragInteractionVisual = ({
  layout,
  pointer,
  scrollDeltaPx,
  target,
  visual,
}: {
  layout: GridLayoutCache;
  pointer: VisualPoint;
  scrollDeltaPx: number;
  target: WeekTimedDragTarget;
  visual: TimedDragVisual;
}) => {
  const nextVisual = updateTimedDragVisual(visual, {
    layout,
    pointer,
    scrollDeltaPx,
  });

  return {
    // Null over the all-day row: the ghost is about to lose its times, so there
    // is nothing to preview.
    event:
      nextVisual.row === "allDay"
        ? null
        : timedDragVisualToGridEvent(target.event, nextVisual),
    visual: nextVisual,
  };
};
