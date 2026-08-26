import dayjs from "@core/util/date/dayjs";
import { type GridEvent } from "@web/common/types/web.event.types";
import { commitWithMapper } from "@web/grid/interaction/commit/commit-result";
import { timedDragVisualToAllDayGridEvent } from "@web/grid/interaction/commit/cross-row.commit";
import {
  hasTimedDragVisualMoved,
  hasTimedResizeVisualMoved,
} from "@web/grid/interaction/commit/timed-moved";
import { type TimedDragVisual } from "@web/grid/interaction/types/timed-drag.types";
import { type TimedResizeVisual } from "@web/grid/interaction/types/timed-resize.types";
import {
  type WeekTimedDragCommitResult,
  type WeekTimedDragTarget,
  type WeekTimedResizeCommitResult,
  type WeekTimedResizeTarget,
} from "../week-interaction.adapter.types";

export { hasTimedDragVisualMoved, hasTimedResizeVisualMoved };

export const timedDragVisualToGridEvent = (
  event: GridEvent,
  visual: TimedDragVisual,
): GridEvent => {
  // The column under the drag knows its own date, so the target day is
  // assigned absolutely; time-of-day rides on the visual's minutes.
  const movedDay = dayjs(visual.dayDate).startOf("day");

  return {
    ...event,
    endDate: movedDay.add(visual.endMinutes, "minutes").format(),
    startDate: movedDay.add(visual.startMinutes, "minutes").format(),
  };
};

export const timedResizeVisualToGridEvent = (
  event: GridEvent,
  visual: TimedResizeVisual,
): GridEvent => {
  const resizedDay = dayjs(event.startDate).startOf("day");

  return {
    ...event,
    endDate: resizedDay.add(visual.endMinutes, "minutes").format(),
    startDate: resizedDay.add(visual.startMinutes, "minutes").format(),
  };
};

/**
 * A drop in the all-day row is ALWAYS a change, even onto the same day: the
 * event loses its time of day. See the sibling comment in `all-day.commit.ts`
 * for why the `isCrossRow ||` forcing must never be replaced by the bare
 * `hasTimedDragVisualMoved` predicate.
 */
export const commitTimedDragInteraction = (
  target: WeekTimedDragTarget,
  visual: TimedDragVisual,
): WeekTimedDragCommitResult =>
  commitWithMapper("timedDragEnd", target, visual, {
    hasMoved: (v) => v.row === "allDay" || hasTimedDragVisualMoved(v),
    toEvent: (t, v) =>
      v.row === "allDay"
        ? timedDragVisualToAllDayGridEvent(t.event, v)
        : timedDragVisualToGridEvent(t.event, v),
  });

/**
 * `toEvent` IGNORES `hasMoved` deliberately: Week re-maps even on a no-op
 * resize, so the coordinator receives a freshly-built event rather than the
 * original object. Day's equivalent gates on `hasMoved` and returns
 * `target.event` by identity. Converging the two would change what
 * `openTimedEvent` receives and what `fastDeepEqual` compares downstream.
 * Both sides are pinned by `commit-characterization.test.ts`.
 */
export const commitTimedResizeInteraction = (
  target: WeekTimedResizeTarget,
  visual: TimedResizeVisual,
): WeekTimedResizeCommitResult =>
  commitWithMapper("timedResizeEnd", target, visual, {
    hasMoved: hasTimedResizeVisualMoved,
    toEvent: (t, v) => timedResizeVisualToGridEvent(t.event, v),
  });
