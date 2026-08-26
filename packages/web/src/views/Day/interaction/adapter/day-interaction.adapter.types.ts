import { type Dayjs } from "@core/util/date/dayjs";
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
import { type GridLayoutCacheSources } from "@web/grid/interaction/layout.cache";
import { type InteractionEngineSchedulerOptions } from "@web/interaction/interaction.engine";

export type DayInteractionPointerOwnership = ViewInteractionPointerOwnership;

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

/**
 * Day adds nothing to the shared runtime. Its column semantics arrive through
 * `DayInteractionAdapterOptions.getColumnKeys` / `getVisibleDate` instead of
 * through the runtime, which is where Week puts `getVisibleDays()`.
 */
export type DayInteractionRuntime = ViewInteractionRuntimeBase;

export type DayAllDayDragCommitResult = ViewAllDayDragCommitResult;

export type DayAllDayDragTarget = ViewAllDayDragTarget;

export type DayAllDayResizeCommitResult = ViewAllDayResizeCommitResult;

export type DayAllDayResizeTarget = ViewAllDayResizeTarget;

export type DayTimedDragCommitResult = ViewTimedDragCommitResult;

export type DayTimedDragTarget = ViewTimedDragTarget;

export type DayTimedResizeCommitResult = ViewTimedResizeCommitResult;

export type DayTimedResizeTarget = ViewTimedResizeTarget;

export type DayInteractionTarget = ViewInteractionTarget;

export type DayInteractionVisual = ViewInteractionVisual;

export type DayInteractionCommitResult = ViewInteractionCommitResult;

export type DayResolvedEventTarget = ViewResolvedEventTarget;

/**
 * Deliberately the bare shared surface: no `rebuildLayoutAfterNavigation`.
 * Day has no edge navigation, and adding one here would be the quiet way to
 * grant it some.
 */
export type DayInteractionAdapter = ViewInteractionAdapterBase;
