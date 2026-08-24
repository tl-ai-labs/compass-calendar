import { type GridEvent } from "@web/common/types/web.event.types";
import {
  type GridAllDayDragCommitResult,
  type GridAllDayDragTarget,
  type GridAllDayResizeCommitResult,
  type GridAllDayResizeTarget,
  type GridInteractionCommitResult,
  type GridInteractionPointerOwnership,
  type GridInteractionTarget,
  type GridInteractionVisual,
  type GridResolvedEventTarget,
  type GridTimedDragCommitResult,
  type GridTimedDragTarget,
  type GridTimedResizeCommitResult,
  type GridTimedResizeTarget,
} from "@web/grid/interaction/types/adapter.types";
import { type AllDayDragVisual } from "@web/grid/interaction/types/all-day-drag.types";
import { type DateColumnKey } from "@web/grid/interaction/types/column-key.types";
import { type TimedDragVisual } from "@web/grid/interaction/types/timed-drag.types";
import {
  type InteractionCancellationTargets,
  type InteractionEngineSchedulerOptions,
} from "@web/interaction/interaction.engine";
import { type WeekRegisteredEventTarget } from "../registry/week-event.registry";
import { type WeekLayoutCacheSources } from "./geometry/week-layout.cache";

export type WeekInteractionPointerOwnership = GridInteractionPointerOwnership;

export interface WeekInteractionAdapterOptions {
  engineOptions?: InteractionEngineSchedulerOptions;
  getLayoutSources?: () => WeekLayoutCacheSources;
  runtime?: () => WeekInteractionRuntime;
}

export interface WeekInteractionRuntime {
  getAllDayEventById?: (eventId: string) => GridEvent | null;
  getTimedEventById(eventId: string): GridEvent | null;
  /**
   * Local YYYY-MM-DD dates of the rendered day columns, in window order.
   * Sourced from the same React render that painted the columns so drag
   * geometry and drop dates always agree with what is on screen.
   */
  getVisibleDays(): string[];
  isFormOpen?: () => boolean;
  onClickAllDayEvent?: (event: GridEvent) => void;
  onClickTimedEvent: (event: GridEvent) => void;
  onCommitAllDayDrag?: (result: WeekAllDayDragCommitResult) => void;
  onCommitAllDayResize?: (result: WeekAllDayResizeCommitResult) => void;
  onCommitTimedDrag: (result: WeekTimedDragCommitResult) => void;
  onCommitTimedResize?: (result: WeekTimedResizeCommitResult) => void;
  onMotionActivation?: (target: WeekInteractionTarget) => void;
  onRequestWeekNavigation?: (direction: "next" | "prev") => void;
}

export type WeekAllDayDragCommitResult = GridAllDayDragCommitResult;

export type WeekAllDayDragTarget =
  GridAllDayDragTarget<WeekRegisteredEventTarget>;

export type WeekAllDayResizeCommitResult = GridAllDayResizeCommitResult;

export type WeekAllDayResizeTarget =
  GridAllDayResizeTarget<WeekRegisteredEventTarget>;

export type WeekTimedDragCommitResult = GridTimedDragCommitResult;

export type WeekTimedDragTarget = GridTimedDragTarget<WeekRegisteredEventTarget>;

export type WeekTimedResizeCommitResult = GridTimedResizeCommitResult;

export type WeekTimedResizeTarget =
  GridTimedResizeTarget<WeekRegisteredEventTarget>;

export type WeekInteractionTarget =
  GridInteractionTarget<WeekRegisteredEventTarget>;

export type WeekInteractionVisual = GridInteractionVisual<DateColumnKey>;

export type WeekInteractionCommitResult = GridInteractionCommitResult;

export type WeekEdgeNavigableVisual =
  | AllDayDragVisual<DateColumnKey>
  | TimedDragVisual<DateColumnKey>;

export type WeekResolvedEventTarget =
  GridResolvedEventTarget<WeekRegisteredEventTarget>;

export interface WeekInteractionAdapter {
  cancel(): void;
  connectCancellationEvents(
    targets?: InteractionCancellationTargets,
  ): () => void;
  handlePointerCancel(event: PointerEvent): boolean;
  handlePointerDown(event: PointerEvent): WeekInteractionPointerOwnership;
  handlePointerMove(event: PointerEvent): boolean;
  handlePointerUp(event: PointerEvent): boolean;
  ownsPointer(event: Pick<PointerEvent, "pointerId">): boolean;
  rebuildLayoutAfterNavigation(): void;
}
