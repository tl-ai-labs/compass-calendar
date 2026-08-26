import { type GridLayoutCache } from "@web/grid/interaction/layout.cache";
import {
  createAllDayDragVisual,
  updateAllDayDragVisual,
} from "@web/grid/interaction/math/all-day.drag";
import { type AllDayDragVisual } from "@web/grid/interaction/types/all-day-drag.types";
import {
  type VisualPoint,
  type VisualRect,
} from "@web/grid/interaction/types/timed-drag.types";
import { type InteractionPoint } from "@web/interaction/interaction.types";
import {
  columnMoveCalendarId,
  hasDayAllDayDragVisualMoved,
} from "../commit/all-day.commit";
import {
  type DayAllDayDragCommitResult,
  type DayAllDayDragTarget,
} from "../day-interaction.adapter.types";

export const createAllDayDragInteractionVisual = ({
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
  target: DayAllDayDragTarget;
}) =>
  createAllDayDragVisual({
    dayDate: initialColumnKey,
    dayIndex: initialColumnIndex,
    eventId: target.event._id!,
    pointerStart,
    sourceRect,
  });

export const updateAllDayDragInteractionVisual = ({
  layout,
  pointer,
  visual,
}: {
  layout: GridLayoutCache;
  pointer: VisualPoint;
  visual: AllDayDragVisual;
}) =>
  // Returns the bare next visual, mirroring Week's own
  // `updateAllDayResizeInteractionVisual`. Week's all-day DRAG returns
  // `{ event, visual }` because a cross-row drop needs a time preview on the
  // ghost; Day has no cross-row drop and no ghost label, so an `event` here
  // would be dead code that implied Day had a cross-row concept.
  updateAllDayDragVisual(visual, {
    layout,
    pointer,
  });

export const commitAllDayDragInteraction = (
  target: DayAllDayDragTarget,
  visual: AllDayDragVisual,
): DayAllDayDragCommitResult => {
  const hasMoved = hasDayAllDayDragVisualMoved(visual);

  // In the Day view every column shares the visible date, so an all-day drag
  // that "moved" can only have changed COLUMN, i.e. calendar. Keep the
  // event's own dates: rewriting them to the visible date would truncate a
  // multi-day all-day event to a single day.
  return {
    event: hasMoved
      ? {
          ...target.event,
          calendarId: columnMoveCalendarId(visual, target.event),
        }
      : target.event,
    eventId: target.event._id!,
    hadFormOpenBeforeInteraction: target.hadFormOpenBeforeInteraction,
    hasMoved,
    type: "allDayDragEnd",
  };
};
