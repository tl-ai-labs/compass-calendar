import { type Dayjs } from "@core/util/date/dayjs";
import {
  type AllDayDragCommitResult,
  type AllDayResizeCommitResult,
  type InteractionCommitResult,
  type TimedDragCommitResult,
  type TimedResizeCommitResult,
} from "@web/grid/interaction/commit/commit-result";
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
 * Day's view of the shared interaction contract. Everything structurally
 * common with Week now aliases `view-adapter.types.ts`; only genuinely
 * Day-specific members are declared here.
 *
 * Every name this file exported before the refactor still exists, so
 * `day-interaction.adapter.ts` and `DayInteractionCoordinator.tsx` needed no
 * change to their type references.
 */

export type DayInteractionPointerOwnership = ViewInteractionPointerOwnership;

/** Day adds nothing to the shared runtime — its extras live on options. */
export type DayInteractionRuntime = ViewInteractionRuntime;

/**
 * DAY-SPECIFIC. `getColumnKeys` and `getVisibleDate` live on the OPTIONS here,
 * whereas Week's extras (`getVisibleDays`, `onRequestWeekNavigation`) live on
 * its RUNTIME. That split is deliberate and is not normalized.
 */
export interface DayInteractionAdapterOptions
  extends ViewInteractionAdapterOptions<DayInteractionRuntime> {
  /**
   * Ordered keys of the rendered per-calendar columns (calendar ids, one per
   * displayed calendar). Drags hit-test against these so an event can be
   * dropped on another calendar's column; empty means a single dateless
   * column (no calendar columns rendered), which disables cross-column
   * movement.
   */
  getColumnKeys?: () => string[];
  getVisibleDate?: () => Dayjs;
}

export type DayAllDayDragCommitResult = AllDayDragCommitResult;
export type DayAllDayResizeCommitResult = AllDayResizeCommitResult;
export type DayTimedDragCommitResult = TimedDragCommitResult;
export type DayTimedResizeCommitResult = TimedResizeCommitResult;

export type DayAllDayDragTarget = ViewAllDayDragTarget;
export type DayAllDayResizeTarget = ViewAllDayResizeTarget;
export type DayTimedDragTarget = ViewTimedDragTarget;
export type DayTimedResizeTarget = ViewTimedResizeTarget;

export type DayInteractionTarget = ViewInteractionTarget;
export type DayInteractionVisual = ViewInteractionVisual;
export type DayInteractionCommitResult = InteractionCommitResult;
export type DayResolvedEventTarget = ViewResolvedEventTarget;

/**
 * Deliberately does NOT gain `rebuildLayoutAfterNavigation` — that is Week's
 * edge-navigation concern and Day has no equivalent.
 */
export type DayInteractionAdapter = ViewInteractionAdapter;
