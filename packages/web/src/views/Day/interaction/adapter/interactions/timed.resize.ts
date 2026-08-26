import { type Dayjs } from "@core/util/date/dayjs";
import { getLocalMinutes } from "@web/grid/interaction/date";
import { type GridLayoutCache } from "@web/grid/interaction/layout.cache";
import {
  createTimedResizeVisual,
  updateTimedResizeVisual,
} from "@web/grid/interaction/math/timed.resize";
import {
  type VisualPoint,
  type VisualRect,
} from "@web/grid/interaction/types/timed-drag.types";
import { type TimedResizeVisual } from "@web/grid/interaction/types/timed-resize.types";
import { type InteractionPoint } from "@web/interaction/interaction.types";
import {
  hasTimedResizeVisualMoved,
  timedResizeVisualToDayGridEvent,
} from "../commit/timed.commit";
import {
  type DayTimedResizeCommitResult,
  type DayTimedResizeTarget,
} from "../day-interaction.adapter.types";

export const createTimedResizeInteractionVisual = ({
  pointerStart,
  sourceRect,
  target,
}: {
  pointerStart: InteractionPoint;
  sourceRect: VisualRect;
  target: DayTimedResizeTarget;
}) =>
  createTimedResizeVisual({
    edge: target.edge,
    endMinutes: getLocalMinutes(target.event.endDate),
    eventId: target.event._id!,
    pointerStart,
    sourceRect,
    startMinutes: getLocalMinutes(target.event.startDate),
  });

export const updateTimedResizeInteractionVisual = ({
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
  target: DayTimedResizeTarget;
  visibleDate: Dayjs;
  visual: TimedResizeVisual;
}) => {
  const nextVisual = updateTimedResizeVisual(visual, {
    layout,
    pointer,
    scrollDeltaPx,
  });

  return {
    event: timedResizeVisualToDayGridEvent(
      target.event,
      nextVisual,
      visibleDate,
    ),
    visual: nextVisual,
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
