import { type Dayjs } from "@core/util/date/dayjs";
import { type GridLayoutCache } from "@web/grid/interaction/layout.cache";
import {
  createAllDayResizeVisual,
  updateAllDayResizeVisual,
} from "@web/grid/interaction/math/all-day.resize";
import { type AllDayResizeVisual } from "@web/grid/interaction/types/all-day-resize.types";
import {
  type VisualPoint,
  type VisualRect,
} from "@web/grid/interaction/types/timed-drag.types";
import { type InteractionPoint } from "@web/interaction/interaction.types";
import {
  allDayVisualToDayGridEvent,
  hasDayAllDayResizeVisualChanged,
} from "../commit/all-day.commit";
import {
  type DayAllDayResizeCommitResult,
  type DayAllDayResizeTarget,
} from "../day-interaction.adapter.types";

export const createAllDayResizeInteractionVisual = ({
  pointerStart,
  sourceRect,
  target,
}: {
  pointerStart: InteractionPoint;
  sourceRect: VisualRect;
  target: DayAllDayResizeTarget;
}) =>
  // Day pins both indices to 0: there is exactly one all-day column, so unlike
  // Week there is no visible range to resolve the handles against.
  createAllDayResizeVisual({
    edge: target.edge,
    endDayIndex: 0,
    eventId: target.event._id!,
    pointerStart,
    sourceRect,
    startDayIndex: 0,
  });

export const updateAllDayResizeInteractionVisual = ({
  layout,
  pointer,
  visual,
}: {
  layout: GridLayoutCache;
  pointer: VisualPoint;
  visual: AllDayResizeVisual;
}) =>
  updateAllDayResizeVisual(visual, {
    layout,
    pointer,
  });

export const commitAllDayResizeInteraction = (
  target: DayAllDayResizeTarget,
  visual: AllDayResizeVisual,
  visibleDate: Dayjs,
): DayAllDayResizeCommitResult => {
  const hasMoved = hasDayAllDayResizeVisualChanged(visual);

  return {
    event: hasMoved
      ? allDayVisualToDayGridEvent(target.event, visibleDate)
      : target.event,
    eventId: target.event._id!,
    hadFormOpenBeforeInteraction: target.hadFormOpenBeforeInteraction,
    hasMoved,
    type: "allDayResizeEnd",
  };
};
