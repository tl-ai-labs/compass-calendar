import { type GridEvent } from "@web/common/types/web.event.types";
import {
  type InteractionCancellationTargets,
  type InteractionEngineSchedulerOptions,
} from "@web/interaction/interaction.engine";
import {
  type AllDayDragCommitResult,
  type AllDayResizeCommitResult,
  type TimedDragCommitResult,
  type TimedResizeCommitResult,
} from "./commit/commit-result";
import { type GridLayoutCacheSources } from "./layout.cache";
import { type AllDayDragVisual } from "./types/all-day-drag.types";
import {
  type AllDayResizeEdge,
  type AllDayResizeVisual,
} from "./types/all-day-resize.types";
import { type TimedDragVisual } from "./types/timed-drag.types";
import {
  type TimedResizeEdge,
  type TimedResizeVisual,
} from "./types/timed-resize.types";
import { type ViewRegisteredEventTarget } from "./view-event-registry";

/**
 * The interaction-adapter contract shared by the Week and Day views.
 *
 * EXTENSION-POINT RULE — read before adding anything here. A member that
 * exists on only ONE view must NEVER be added to a base type, not even as
 * optional. It is added by interface extension on that view's own type.
 *
 * Concretely: `rebuildLayoutAfterNavigation()` is Week-only. Declaring it
 * `rebuildLayoutAfterNavigation?()` on `ViewInteractionAdapter` would make a
 * Day adapter structurally satisfy the `RebuildableAdapter` shape that
 * `useWeekInteractionLayoutSync` checks for, which is exactly the bug this
 * rule exists to prevent.
 *
 * The two views also disagree about WHERE their extras live, and that is
 * preserved rather than normalized: Week's `getVisibleDays()` and
 * `onRequestWeekNavigation()` are on its RUNTIME, while Day's
 * `getColumnKeys()` and `getVisibleDate()` are on its OPTIONS. Moving either
 * to the other object would be a behavior change.
 */

export interface ViewInteractionPointerOwnership {
  reason: string;
  shouldOwn: boolean;
}

export interface ViewAllDayDragTarget {
  event: GridEvent;
  hadFormOpenBeforeInteraction: boolean;
  registered: ViewRegisteredEventTarget;
  type: "allDayDrag";
}

export interface ViewAllDayResizeTarget {
  edge: AllDayResizeEdge;
  event: GridEvent;
  hadFormOpenBeforeInteraction: boolean;
  registered: ViewRegisteredEventTarget;
  type: "allDayResize";
}

export interface ViewTimedDragTarget {
  event: GridEvent;
  hadFormOpenBeforeInteraction: boolean;
  registered: ViewRegisteredEventTarget;
  type: "timedDrag";
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

export type ViewResolvedEventTarget = {
  event: GridEvent;
  hadFormOpenBeforeInteraction: boolean;
  registered: ViewRegisteredEventTarget;
};

/**
 * The runtime members both views supply. Week extends this with
 * `getVisibleDays()` and `onRequestWeekNavigation()`; Day adds nothing.
 */
export interface ViewInteractionRuntime {
  getAllDayEventById?: (eventId: string) => GridEvent | null;
  getTimedEventById(eventId: string): GridEvent | null;
  isFormOpen?: () => boolean;
  onClickAllDayEvent?: (event: GridEvent) => void;
  onClickTimedEvent: (event: GridEvent) => void;
  onCommitAllDayDrag?: (result: AllDayDragCommitResult) => void;
  onCommitAllDayResize?: (result: AllDayResizeCommitResult) => void;
  onCommitTimedDrag: (result: TimedDragCommitResult) => void;
  onCommitTimedResize?: (result: TimedResizeCommitResult) => void;
  onMotionActivation?: (target: ViewInteractionTarget) => void;
}

/**
 * The options both views accept. Day extends this with `getColumnKeys()` and
 * `getVisibleDate()`.
 */
export interface ViewInteractionAdapterOptions<
  TRuntime extends ViewInteractionRuntime,
> {
  engineOptions?: InteractionEngineSchedulerOptions;
  getLayoutSources?: () => GridLayoutCacheSources;
  runtime?: () => TRuntime;
}

/**
 * The pointer surface both adapters expose. Week extends this with
 * `rebuildLayoutAfterNavigation()` — see the extension-point rule above.
 */
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
