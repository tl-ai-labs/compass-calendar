import { type Dayjs } from "@core/util/date/dayjs";
import { getLocalMinutes } from "@web/grid/interaction/date";
import { type GridLayoutCache } from "@web/grid/interaction/layout.cache";
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
import {
  hasTimedDragVisualMoved,
  timedDragVisualToDayGridEvent,
} from "../commit/timed.commit";
import {
  type DayTimedDragCommitResult,
  type DayTimedDragTarget,
} from "../day-interaction.adapter.types";

export const createTimedDragInteractionVisual = ({
  initialColumnIndex,
  initialColumnKey,
  pointerStart,
  sourceRect,
  target,
}: {
  initialColumnIndex: number;
  initialColumnKey: string;
  pointerStart: InteractionPoint;
  sourceRect: VisualRect;
  target: DayTimedDragTarget;
}) =>
  createTimedDragVisual({
    dayDate: initialColumnKey,
    dayIndex: initialColumnIndex,
    endMinutes: getLocalMinutes(target.event.endDate),
    eventId: target.event._id!,
    pointerStart,
    sourceRect,
    startMinutes: getLocalMinutes(target.event.startDate),
  });

export const updateTimedDragInteractionVisual = ({
  layout,
  pointer,
  scrollDeltaPx,
  target,
  visibleDate,
  visual,
}: {
  layout: GridLayoutCache;
  pointer: VisualPoint;
  scrollDeltaPx: number;
  target: DayTimedDragTarget;
  visibleDate: Dayjs;
  visual: TimedDragVisual;
}) => {
  const nextVisual = updateTimedDragVisual(visual, {
    layout,
    pointer,
    scrollDeltaPx,
  });

  return {
    event: timedDragVisualToDayGridEvent(target.event, nextVisual, visibleDate),
    visual: nextVisual,
  };
};

export const commitTimedDragInteraction = (
  target: DayTimedDragTarget,
  visual: TimedDragVisual,
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
