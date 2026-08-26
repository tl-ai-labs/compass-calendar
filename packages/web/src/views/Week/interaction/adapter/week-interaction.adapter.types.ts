import {
  type ViewAllDayDragCommitResult,
  type ViewAllDayDragTarget,
  type ViewAllDayResizeCommitResult,
  type ViewAllDayResizeTarget,
  type ViewInteractionAdapterBase,
  type ViewInteractionCommitResult,
  type ViewInteractionPointerOwnership,
  type ViewInteractionRuntimeBase,
  type ViewInteractionTarget,
  type ViewInteractionVisual,
  type ViewResolvedEventTarget,
  type ViewTimedDragCommitResult,
  type ViewTimedDragTarget,
  type ViewTimedResizeCommitResult,
  type ViewTimedResizeTarget,
} from "@web/grid/interaction/adapter/view-interaction.types";
import { type AllDayDragVisual } from "@web/grid/interaction/types/all-day-drag.types";
import { type TimedDragVisual } from "@web/grid/interaction/types/timed-drag.types";
import { type InteractionEngineSchedulerOptions } from "@web/interaction/interaction.engine";
import { type WeekLayoutCacheSources } from "./geometry/week-layout.cache";

export type WeekInteractionPointerOwnership = ViewInteractionPointerOwnership;

export interface WeekInteractionAdapterOptions {
  engineOptions?: InteractionEngineSchedulerOptions;
  getLayoutSources?: () => WeekLayoutCacheSources;
  runtime?: () => WeekInteractionRuntime;
}

export interface WeekInteractionRuntime extends ViewInteractionRuntimeBase {
  /**
   * Local YYYY-MM-DD dates of the rendered day columns, in window order.
   * Sourced from the same React render that painted the columns so drag
   * geometry and drop dates always agree with what is on screen.
   */
  getVisibleDays(): string[];
  onRequestWeekNavigation?: (direction: "next" | "prev") => void;
}

export type WeekAllDayDragCommitResult = ViewAllDayDragCommitResult;

export type WeekAllDayDragTarget = ViewAllDayDragTarget;

export type WeekAllDayResizeCommitResult = ViewAllDayResizeCommitResult;

export type WeekAllDayResizeTarget = ViewAllDayResizeTarget;

export type WeekTimedDragCommitResult = ViewTimedDragCommitResult;

export type WeekTimedDragTarget = ViewTimedDragTarget;

export type WeekTimedResizeCommitResult = ViewTimedResizeCommitResult;

export type WeekTimedResizeTarget = ViewTimedResizeTarget;

export type WeekInteractionTarget = ViewInteractionTarget;

export type WeekInteractionVisual = ViewInteractionVisual;

export type WeekInteractionCommitResult = ViewInteractionCommitResult;

export type WeekEdgeNavigableVisual = AllDayDragVisual | TimedDragVisual;

export type WeekResolvedEventTarget = ViewResolvedEventTarget;

export interface WeekInteractionAdapter extends ViewInteractionAdapterBase {
  rebuildLayoutAfterNavigation(): void;
}
