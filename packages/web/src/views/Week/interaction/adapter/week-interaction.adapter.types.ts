import {
  type AllDayDragCommitResult,
  type AllDayResizeCommitResult,
  type InteractionCommitResult,
  type TimedDragCommitResult,
  type TimedResizeCommitResult,
} from "@web/grid/interaction/commit/commit-result";
import { type AllDayDragVisual } from "@web/grid/interaction/types/all-day-drag.types";
import { type TimedDragVisual } from "@web/grid/interaction/types/timed-drag.types";
import {
  type ViewAllDayDragTarget,
  type ViewAllDayResizeTarget,
  type ViewInteractionAdapter,
  type ViewInteractionAdapterOptions,
  type ViewInteractionPointerOwnership,
  type ViewInteractionRuntime,
  type ViewInteractionTarget,
  type ViewInteractionVisual,
  type ViewResolvedEventTarget,
  type ViewTimedDragTarget,
  type ViewTimedResizeTarget,
} from "@web/grid/interaction/view-adapter.types";

/**
 * Week's view of the shared interaction contract. Everything structurally
 * common with Day now aliases `view-adapter.types.ts`; only genuinely
 * Week-specific members are declared here.
 *
 * Every name this file exported before the refactor still exists, so
 * `week-interaction.adapter.ts` and `WeekInteractionCoordinator.tsx` needed no
 * change to their type references.
 */

export type WeekInteractionPointerOwnership = ViewInteractionPointerOwnership;

/**
 * WEEK-SPECIFIC. `getVisibleDays` and `onRequestWeekNavigation` live on the
 * RUNTIME here, whereas Day's extras (`getColumnKeys`, `getVisibleDate`) live
 * on its OPTIONS. That split is deliberate and is not normalized: moving
 * either to the other object would change when the value is read.
 */
export interface WeekInteractionRuntime extends ViewInteractionRuntime {
  /**
   * Local YYYY-MM-DD dates of the rendered day columns, in window order.
   * Sourced from the same React render that painted the columns so drag
   * geometry and drop dates always agree with what is on screen.
   */
  getVisibleDays(): string[];
  onRequestWeekNavigation?: (direction: "next" | "prev") => void;
}

export type WeekInteractionAdapterOptions =
  ViewInteractionAdapterOptions<WeekInteractionRuntime>;

export type WeekAllDayDragCommitResult = AllDayDragCommitResult;
export type WeekAllDayResizeCommitResult = AllDayResizeCommitResult;
export type WeekTimedDragCommitResult = TimedDragCommitResult;
export type WeekTimedResizeCommitResult = TimedResizeCommitResult;

export type WeekAllDayDragTarget = ViewAllDayDragTarget;
export type WeekAllDayResizeTarget = ViewAllDayResizeTarget;
export type WeekTimedDragTarget = ViewTimedDragTarget;
export type WeekTimedResizeTarget = ViewTimedResizeTarget;

export type WeekInteractionTarget = ViewInteractionTarget;
export type WeekInteractionVisual = ViewInteractionVisual;
export type WeekInteractionCommitResult = InteractionCommitResult;
export type WeekResolvedEventTarget = ViewResolvedEventTarget;

/** WEEK-SPECIFIC. Day has no cross-row navigation, so no equivalent. */
export type WeekEdgeNavigableVisual = AllDayDragVisual | TimedDragVisual;

/**
 * WEEK-SPECIFIC. `rebuildLayoutAfterNavigation` is added by extension, never
 * as an optional member of `ViewInteractionAdapter` — an optional on the base
 * would let a Day adapter structurally satisfy the `RebuildableAdapter` shape
 * that `useWeekInteractionLayoutSync` checks for.
 */
export interface WeekInteractionAdapter extends ViewInteractionAdapter {
  rebuildLayoutAfterNavigation(): void;
}
