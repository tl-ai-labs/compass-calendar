import { type GridEvent } from "@web/common/types/web.event.types";
import { type AllDayDragVisual } from "@web/grid/interaction/types/all-day-drag.types";
import {
  type AllDayResizeEdge,
  type AllDayResizeVisual,
} from "@web/grid/interaction/types/all-day-resize.types";
import { type TimedDragVisual } from "@web/grid/interaction/types/timed-drag.types";
import {
  type TimedResizeEdge,
  type TimedResizeVisual,
} from "@web/grid/interaction/types/timed-resize.types";
import { type ViewRegisteredEventTarget } from "@web/grid/interaction/view-event-registry";
import { type InteractionCancellationTargets } from "@web/interaction/interaction.engine";

/**
 * The interaction target, visual and commit-result shapes shared by every
 * calendar view. Week and Day declared these separately and character-for-
 * character identically; both views' `*RegisteredEventTarget` were already
 * aliases of the same `ViewRegisteredEventTarget`, so the two sets were the
 * same types under different names.
 *
 * What is deliberately NOT here, because it is genuinely per-view:
 * - how a column resolves (Week: `getVisibleDays()` -> dates;
 *   Day: `getColumnKeys()` -> calendar ids, plus `getVisibleDate()`),
 * - `rebuildLayoutAfterNavigation` and week navigation, which are Week-only,
 * - the layout-cache option shapes.
 */

export interface ViewInteractionPointerOwnership {
  reason: string;
  shouldOwn: boolean;
}

export interface ViewAllDayDragCommitResult {
  event: GridEvent;
  eventId: string;
  hadFormOpenBeforeInteraction: boolean;
  hasMoved: boolean;
  type: "allDayDragEnd";
}

export interface ViewAllDayDragTarget {
  event: GridEvent;
  hadFormOpenBeforeInteraction: boolean;
  registered: ViewRegisteredEventTarget;
  type: "allDayDrag";
}

export interface ViewAllDayResizeCommitResult {
  event: GridEvent;
  eventId: string;
  hadFormOpenBeforeInteraction: boolean;
  hasMoved: boolean;
  type: "allDayResizeEnd";
}

export interface ViewAllDayResizeTarget {
  edge: AllDayResizeEdge;
  event: GridEvent;
  hadFormOpenBeforeInteraction: boolean;
  registered: ViewRegisteredEventTarget;
  type: "allDayResize";
}

export interface ViewTimedDragCommitResult {
  event: GridEvent;
  eventId: string;
  hadFormOpenBeforeInteraction: boolean;
  hasMoved: boolean;
  type: "timedDragEnd";
}

export interface ViewTimedDragTarget {
  event: GridEvent;
  hadFormOpenBeforeInteraction: boolean;
  registered: ViewRegisteredEventTarget;
  type: "timedDrag";
}

export interface ViewTimedResizeCommitResult {
  event: GridEvent;
  eventId: string;
  hadFormOpenBeforeInteraction: boolean;
  hasMoved: boolean;
  type: "timedResizeEnd";
}

export interface ViewTimedResizeTarget {
  edge: TimedResizeEdge;
  event: GridEvent;
  hadFormOpenBeforeInteraction: boolean;
  registered: ViewRegisteredEventTarget;
  type: "timedResize";
}

export type ViewInteractionTarget =
  | ViewAllDayDragTarget
  | ViewAllDayResizeTarget
  | ViewTimedDragTarget
  | ViewTimedResizeTarget;

export type ViewInteractionVisual =
  | AllDayDragVisual
  | AllDayResizeVisual
  | TimedDragVisual
  | TimedResizeVisual;

export type ViewInteractionCommitResult =
  | ViewAllDayDragCommitResult
  | ViewAllDayResizeCommitResult
  | ViewTimedDragCommitResult
  | ViewTimedResizeCommitResult;

export type ViewResolvedEventTarget = {
  event: GridEvent;
  hadFormOpenBeforeInteraction: boolean;
  registered: ViewRegisteredEventTarget;
};

/**
 * The runtime members every view supplies. A view's own runtime interface
 * extends this and adds only its column-resolution members.
 */
export interface ViewInteractionRuntimeBase {
  getAllDayEventById?: (eventId: string) => GridEvent | null;
  getTimedEventById(eventId: string): GridEvent | null;
  isFormOpen?: () => boolean;
  onClickAllDayEvent?: (event: GridEvent) => void;
  onClickTimedEvent: (event: GridEvent) => void;
  onCommitAllDayDrag?: (result: ViewAllDayDragCommitResult) => void;
  onCommitAllDayResize?: (result: ViewAllDayResizeCommitResult) => void;
  onCommitTimedDrag: (result: ViewTimedDragCommitResult) => void;
  onCommitTimedResize?: (result: ViewTimedResizeCommitResult) => void;
  onMotionActivation?: (target: ViewInteractionTarget) => void;
}

/**
 * The adapter surface every view exposes. Note the absence of
 * `rebuildLayoutAfterNavigation`: it exists only on Week, and keeping it out
 * of the base is what stops Day acquiring edge navigation by inheritance.
 */
export interface ViewInteractionAdapterBase {
  cancel(): void;
  connectCancellationEvents(
    targets?: InteractionCancellationTargets,
  ): () => void;
  handlePointerCancel(event: PointerEvent): boolean;
  handlePointerDown(event: PointerEvent): ViewInteractionPointerOwnership;
  handlePointerMove(event: PointerEvent): boolean;
  handlePointerUp(event: PointerEvent): boolean;
  ownsPointer(event: Pick<PointerEvent, "pointerId">): boolean;
}
