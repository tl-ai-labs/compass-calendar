import {
  type ViewAllDayDragCommitResult,
  type ViewAllDayDragTarget,
  type ViewAllDayResizeCommitResult,
  type ViewAllDayResizeTarget,
  type ViewInteractionAdapter,
  type ViewInteractionCommitResult,
  type ViewInteractionPointerOwnership,
  type ViewInteractionRuntime,
  type ViewInteractionTarget,
  type ViewInteractionVisual,
  type ViewResolvedEventTarget,
  type ViewTimedDragCommitResult,
  type ViewTimedDragTarget,
  type ViewTimedResizeCommitResult,
  type ViewTimedResizeTarget,
} from "@web/grid/interaction/adapter/view-interaction.adapter.types";
import { type AllDayDragVisual } from "@web/grid/interaction/types/all-day-drag.types";
import { type DateColumnKey } from "@web/grid/interaction/types/column-key.types";
import { type TimedDragVisual } from "@web/grid/interaction/types/timed-drag.types";
import { type InteractionEngineSchedulerOptions } from "@web/interaction/interaction.engine";
import { type WeekRegisteredEventTarget } from "../registry/week-event.registry";
import { type WeekLayoutCacheSources } from "./geometry/week-layout.cache";

/**
 * Week's adapter boundary: the shared `View*` types instantiated with Week's
 * branded registered target and its `DateColumnKey` columns, plus the members
 * that exist only in this view.
 */

export type WeekInteractionPointerOwnership = ViewInteractionPointerOwnership;

export interface WeekInteractionAdapterOptions {
  engineOptions?: InteractionEngineSchedulerOptions;
  getLayoutSources?: () => WeekLayoutCacheSources;
  runtime?: () => WeekInteractionRuntime;
}

/**
 * Week-only runtime members live here, not on `ViewInteractionRuntime`: the
 * week window's visible dates and its mid-drag week navigation have no Day
 * counterpart.
 */
export interface WeekInteractionRuntime
  extends ViewInteractionRuntime<WeekRegisteredEventTarget> {
  /**
   * Local YYYY-MM-DD dates of the rendered day columns, in window order.
   * Sourced from the same React render that painted the columns so drag
   * geometry and drop dates always agree with what is on screen.
   */
  getVisibleDays(): string[];
  onRequestWeekNavigation?: (direction: "next" | "prev") => void;
}

export type WeekAllDayDragCommitResult = ViewAllDayDragCommitResult;
export type WeekAllDayResizeCommitResult = ViewAllDayResizeCommitResult;
export type WeekTimedDragCommitResult = ViewTimedDragCommitResult;
export type WeekTimedResizeCommitResult = ViewTimedResizeCommitResult;

export type WeekAllDayDragTarget =
  ViewAllDayDragTarget<WeekRegisteredEventTarget>;
export type WeekAllDayResizeTarget =
  ViewAllDayResizeTarget<WeekRegisteredEventTarget>;
export type WeekTimedDragTarget =
  ViewTimedDragTarget<WeekRegisteredEventTarget>;
export type WeekTimedResizeTarget =
  ViewTimedResizeTarget<WeekRegisteredEventTarget>;

export type WeekInteractionTarget =
  ViewInteractionTarget<WeekRegisteredEventTarget>;

export type WeekInteractionVisual = ViewInteractionVisual<DateColumnKey>;

export type WeekInteractionCommitResult = ViewInteractionCommitResult;

/** Week-only: Day has no all-day <-> timed conversion and no edge navigation. */
export type WeekEdgeNavigableVisual =
  | AllDayDragVisual<DateColumnKey>
  | TimedDragVisual<DateColumnKey>;

export type WeekResolvedEventTarget =
  ViewResolvedEventTarget<WeekRegisteredEventTarget>;

/**
 * Week-only: `rebuildLayoutAfterNavigation` exists because the week window can
 * navigate mid-drag. Day cannot, so it is not on the shared adapter interface.
 */
export interface WeekInteractionAdapter extends ViewInteractionAdapter {
  rebuildLayoutAfterNavigation(): void;
}
