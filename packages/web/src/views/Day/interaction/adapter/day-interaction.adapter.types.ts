import { type Dayjs } from "@core/util/date/dayjs";
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
import { type GridLayoutCacheSources } from "@web/grid/interaction/layout.cache";
import { type CalendarColumnKey } from "@web/grid/interaction/types/column-key.types";
import { type InteractionEngineSchedulerOptions } from "@web/interaction/interaction.engine";
import { type DayRegisteredEventTarget } from "../registry/day-event.registry";

/**
 * Day's adapter boundary: the shared `View*` types instantiated with Day's
 * branded registered target and its `CalendarColumnKey` columns, plus the
 * members that exist only in this view.
 */

export type DayInteractionPointerOwnership = ViewInteractionPointerOwnership;

export interface DayInteractionAdapterOptions {
  engineOptions?: InteractionEngineSchedulerOptions;
  /**
   * Ordered keys of the rendered per-calendar columns (calendar ids, one per
   * displayed calendar). Drags hit-test against these so an event can be
   * dropped on another calendar's column; empty means a single dateless
   * column (no calendar columns rendered), which disables cross-column
   * movement.
   *
   * Stays a bare `string[]`: this is a boundary owned by the Day view's
   * caller. It is branded on the way in, at `asDayColumnKeys` in
   * `geometry/day-layout.cache.ts`.
   */
  getColumnKeys?: () => string[];
  getLayoutSources?: () => GridLayoutCacheSources;
  getVisibleDate?: () => Dayjs;
  runtime?: () => DayInteractionRuntime;
}

/**
 * Day adds nothing to the shared runtime. It is declared as an interface
 * rather than an alias so a future Day-only member has an obvious home that is
 * not the shared base.
 */
export interface DayInteractionRuntime
  extends ViewInteractionRuntime<DayRegisteredEventTarget> {}

export type DayAllDayDragCommitResult = ViewAllDayDragCommitResult;
export type DayAllDayResizeCommitResult = ViewAllDayResizeCommitResult;
export type DayTimedDragCommitResult = ViewTimedDragCommitResult;
export type DayTimedResizeCommitResult = ViewTimedResizeCommitResult;

export type DayAllDayDragTarget =
  ViewAllDayDragTarget<DayRegisteredEventTarget>;
export type DayAllDayResizeTarget =
  ViewAllDayResizeTarget<DayRegisteredEventTarget>;
export type DayTimedDragTarget = ViewTimedDragTarget<DayRegisteredEventTarget>;
export type DayTimedResizeTarget =
  ViewTimedResizeTarget<DayRegisteredEventTarget>;

export type DayInteractionTarget =
  ViewInteractionTarget<DayRegisteredEventTarget>;

export type DayInteractionVisual = ViewInteractionVisual<CalendarColumnKey>;

export type DayInteractionCommitResult = ViewInteractionCommitResult;

export type DayResolvedEventTarget =
  ViewResolvedEventTarget<DayRegisteredEventTarget>;

/**
 * Day has no `rebuildLayoutAfterNavigation`: its single date cannot change
 * mid-interaction the way the week window can.
 */
export interface DayInteractionAdapter extends ViewInteractionAdapter {}
