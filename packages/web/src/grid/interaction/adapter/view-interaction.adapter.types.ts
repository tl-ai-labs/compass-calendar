import { type GridEvent } from "@web/common/types/web.event.types";
import { type InteractionCancellationTargets } from "@web/interaction/interaction.engine";
import { type AllDayDragVisual } from "../types/all-day-drag.types";
import {
  type AllDayResizeEdge,
  type AllDayResizeVisual,
} from "../types/all-day-resize.types";
import { type TimedDragVisual } from "../types/timed-drag.types";
import {
  type TimedResizeEdge,
  type TimedResizeVisual,
} from "../types/timed-resize.types";

/**
 * The adapter boundary shared by the Week and Day interaction views.
 *
 * Week and Day previously declared sixteen structurally identical interfaces
 * apiece. They are parameterised here on the two things that genuinely differ:
 *
 * - `TRegistered` — the view's registered DOM target, branded per view (see
 *   `ViewRegisteredEventTarget`), so a Week target handed to a Day-instantiated
 *   member is a compile error rather than a silent cross-view bug.
 * - `TColumnKey` — the view's column-key kind (`DateColumnKey` for Week,
 *   `CalendarColumnKey` for Day), likewise mutually unassignable.
 *
 * Nothing view-specific belongs in this file. Week-only members
 * (`rebuildLayoutAfterNavigation`, `getVisibleDays`, `onRequestWeekNavigation`)
 * and Day-only members (`getColumnKeys`, `getVisibleDate`) stay on the view's
 * own types, extended from these bases — never added here as optional fields.
 * An optional member on a shared type is how one view comes to *look* capable
 * of another's behaviour while nothing populates it.
 */

export interface ViewInteractionPointerOwnership {
  reason: string;
  shouldOwn: boolean;
}

export type ViewResolvedEventTarget<TRegistered> = {
  event: GridEvent;
  hadFormOpenBeforeInteraction: boolean;
  registered: TRegistered;
};

export interface ViewAllDayDragTarget<TRegistered> {
  event: GridEvent;
  hadFormOpenBeforeInteraction: boolean;
  registered: TRegistered;
  type: "allDayDrag";
}

export interface ViewAllDayResizeTarget<TRegistered> {
  edge: AllDayResizeEdge;
  event: GridEvent;
  hadFormOpenBeforeInteraction: boolean;
  registered: TRegistered;
  type: "allDayResize";
}

export interface ViewTimedDragTarget<TRegistered> {
  event: GridEvent;
  hadFormOpenBeforeInteraction: boolean;
  registered: TRegistered;
  type: "timedDrag";
}

export interface ViewTimedResizeTarget<TRegistered> {
  edge: TimedResizeEdge;
  event: GridEvent;
  hadFormOpenBeforeInteraction: boolean;
  registered: TRegistered;
  type: "timedResize";
}

export type ViewInteractionTarget<TRegistered> =
  | ViewAllDayDragTarget<TRegistered>
  | ViewAllDayResizeTarget<TRegistered>
  | ViewTimedDragTarget<TRegistered>
  | ViewTimedResizeTarget<TRegistered>;

export interface ViewAllDayDragCommitResult {
  event: GridEvent;
  eventId: string;
  hadFormOpenBeforeInteraction: boolean;
  hasMoved: boolean;
  type: "allDayDragEnd";
}

export interface ViewAllDayResizeCommitResult {
  event: GridEvent;
  eventId: string;
  hadFormOpenBeforeInteraction: boolean;
  hasMoved: boolean;
  type: "allDayResizeEnd";
}

export interface ViewTimedDragCommitResult {
  event: GridEvent;
  eventId: string;
  hadFormOpenBeforeInteraction: boolean;
  hasMoved: boolean;
  type: "timedDragEnd";
}

export interface ViewTimedResizeCommitResult {
  event: GridEvent;
  eventId: string;
  hadFormOpenBeforeInteraction: boolean;
  hasMoved: boolean;
  type: "timedResizeEnd";
}

export type ViewInteractionCommitResult =
  | ViewAllDayDragCommitResult
  | ViewAllDayResizeCommitResult
  | ViewTimedDragCommitResult
  | ViewTimedResizeCommitResult;

export type ViewInteractionVisual<TColumnKey extends string> =
  | AllDayDragVisual<TColumnKey>
  | AllDayResizeVisual
  | TimedDragVisual<TColumnKey>
  | TimedResizeVisual;

/**
 * The runtime callbacks every view's adapter needs. Views extend this with
 * their own extras rather than widening it.
 */
export interface ViewInteractionRuntime<TRegistered> {
  getAllDayEventById?: (eventId: string) => GridEvent | null;
  getTimedEventById(eventId: string): GridEvent | null;
  isFormOpen?: () => boolean;
  onClickAllDayEvent?: (event: GridEvent) => void;
  onClickTimedEvent: (event: GridEvent) => void;
  onCommitAllDayDrag?: (result: ViewAllDayDragCommitResult) => void;
  onCommitAllDayResize?: (result: ViewAllDayResizeCommitResult) => void;
  onCommitTimedDrag: (result: ViewTimedDragCommitResult) => void;
  onCommitTimedResize?: (result: ViewTimedResizeCommitResult) => void;
  onMotionActivation?: (target: ViewInteractionTarget<TRegistered>) => void;
}

/** The pointer surface every view adapter exposes. */
export interface ViewInteractionAdapter {
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
