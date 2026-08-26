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
import { type WeekAllDayResizeTarget } from "../week-interaction.adapter.types";
import { getVisibleAllDayRange } from "./all-day.visible-range";

export const createAllDayResizeInteractionVisual = ({
  layout,
  pointerStart,
  sourceRect,
  target,
}: {
  layout: GridLayoutCache;
  pointerStart: InteractionPoint;
  sourceRect: VisualRect;
  target: WeekAllDayResizeTarget;
}) => {
  const visibleRange = getVisibleAllDayRange(layout, sourceRect);

  return createAllDayResizeVisual({
    edge: target.edge,
    endDayIndex: visibleRange.endDayIndex,
    eventId: target.event._id!,
    pointerStart,
    sourceRect,
    startDayIndex: visibleRange.startDayIndex,
  });
};

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
