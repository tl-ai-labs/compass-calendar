import { type Dayjs } from "@core/util/date/dayjs";
import { type GridEvent } from "@web/common/types/web.event.types";
import { type GridLayoutCacheSources } from "@web/grid/interaction/layout.cache";
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
import { type DayColumnKey } from "@web/grid/interaction/types/column-key.types";
import {
  type InteractionCancellationTargets,
  type InteractionEngineSchedulerOptions,
} from "@web/interaction/interaction.engine";
import { type DayRegisteredEventTarget } from "../registry/day-event.registry";

export type DayInteractionPointerOwnership = GridInteractionPointerOwnership;

export interface DayInteractionAdapterOptions {
  engineOptions?: InteractionEngineSchedulerOptions;
  /**
   * Ordered keys of the rendered per-calendar columns (calendar ids, one per
   * displayed calendar). Drags hit-test against these so an event can be
   * dropped on another calendar's column; empty means a single dateless
   * column (no calendar columns rendered), which disables cross-column
   * movement.
   */
  getColumnKeys?: () => string[];
  getLayoutSources?: () => GridLayoutCacheSources;
  getVisibleDate?: () => Dayjs;
  runtime?: () => DayInteractionRuntime;
}

export interface DayInteractionRuntime {
  getAllDayEventById?: (eventId: string) => GridEvent | null;
  getTimedEventById(eventId: string): GridEvent | null;
  isFormOpen?: () => boolean;
  onClickAllDayEvent?: (event: GridEvent) => void;
  onClickTimedEvent: (event: GridEvent) => void;
  onCommitAllDayDrag?: (result: DayAllDayDragCommitResult) => void;
  onCommitAllDayResize?: (result: DayAllDayResizeCommitResult) => void;
  onCommitTimedDrag: (result: DayTimedDragCommitResult) => void;
  onCommitTimedResize?: (result: DayTimedResizeCommitResult) => void;
  onMotionActivation?: (target: DayInteractionTarget) => void;
}

export type DayAllDayDragCommitResult = GridAllDayDragCommitResult;

export type DayAllDayDragTarget =
  GridAllDayDragTarget<DayRegisteredEventTarget>;

export type DayAllDayResizeCommitResult = GridAllDayResizeCommitResult;

export type DayAllDayResizeTarget =
  GridAllDayResizeTarget<DayRegisteredEventTarget>;

export type DayTimedDragCommitResult = GridTimedDragCommitResult;

export type DayTimedDragTarget = GridTimedDragTarget<DayRegisteredEventTarget>;

export type DayTimedResizeCommitResult = GridTimedResizeCommitResult;

export type DayTimedResizeTarget =
  GridTimedResizeTarget<DayRegisteredEventTarget>;

export type DayInteractionTarget =
  GridInteractionTarget<DayRegisteredEventTarget>;

export type DayInteractionVisual = GridInteractionVisual<DayColumnKey>;

export type DayInteractionCommitResult = GridInteractionCommitResult;

export type DayResolvedEventTarget =
  GridResolvedEventTarget<DayRegisteredEventTarget>;

export interface DayInteractionAdapter {
  cancel(): void;
  connectCancellationEvents(
    targets?: InteractionCancellationTargets,
  ): () => void;
  handlePointerCancel(event: PointerEvent): boolean;
  handlePointerDown(event: PointerEvent): DayInteractionPointerOwnership;
  handlePointerMove(event: PointerEvent): boolean;
  handlePointerUp(event: PointerEvent): boolean;
  ownsPointer(event: Pick<PointerEvent, "pointerId">): boolean;
}
