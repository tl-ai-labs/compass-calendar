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
import { timedResizeVisualToGridEvent } from "../commit/timed.commit";
import { type WeekTimedResizeTarget } from "../week-interaction.adapter.types";

export const createTimedResizeInteractionVisual = ({
  pointerStart,
  sourceRect,
  target,
}: {
  pointerStart: InteractionPoint;
  sourceRect: VisualRect;
  target: WeekTimedResizeTarget;
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
  visual,
}: {
  layout: GridLayoutCache;
  pointer: VisualPoint;
  scrollDeltaPx?: number;
  target: WeekTimedResizeTarget;
  visual: TimedResizeVisual;
}) => {
  const nextVisual = updateTimedResizeVisual(visual, {
    layout,
    pointer,
    scrollDeltaPx,
  });

  return {
    event: timedResizeVisualToGridEvent(target.event, nextVisual),
    visual: nextVisual,
  };
};
