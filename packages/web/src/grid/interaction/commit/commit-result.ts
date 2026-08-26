import { type GridEvent } from "@web/common/types/web.event.types";

/**
 * The unified drag/resize commit envelope, shared by the Week and Day views.
 *
 * WHY THIS LIVES HERE (ADR-1, change_plan.md §0/F2). It carries a `GridEvent`,
 * so it cannot live in `@web/interaction/` — that layer is generic over
 * `<TTarget, TVisual, TResult>` precisely so the engine never learns what an
 * event is, and coupling it to `web.event.types` is an explicit non-goal. The
 * grid substrate is already `GridEvent`-aware (`cross-row.commit.ts`,
 * `timed-moved.ts` sit beside this file), so it is the correct home.
 *
 * WHAT IS AND IS NOT UNIFIED. The envelope SHAPE is genuinely identical across
 * both views and is unified here. The mappers that populate `event` are NOT:
 * a Week column is a DATE and a Day column is a CALENDAR, so Week's all-day
 * drag shifts `startDate`/`endDate` by a day delta while Day's rewrites
 * `calendarId` and leaves dates alone. Those mappers stay in their own view
 * trees and are supplied here as the extension point.
 */

export type InteractionCommitType =
  | "allDayDragEnd"
  | "allDayResizeEnd"
  | "timedDragEnd"
  | "timedResizeEnd";

export interface InteractionCommitResultOf<
  TType extends InteractionCommitType,
> {
  event: GridEvent;
  eventId: string;
  hadFormOpenBeforeInteraction: boolean;
  hasMoved: boolean;
  type: TType;
}

export type AllDayDragCommitResult = InteractionCommitResultOf<"allDayDragEnd">;
export type AllDayResizeCommitResult =
  InteractionCommitResultOf<"allDayResizeEnd">;
export type TimedDragCommitResult = InteractionCommitResultOf<"timedDragEnd">;
export type TimedResizeCommitResult =
  InteractionCommitResultOf<"timedResizeEnd">;

export type InteractionCommitResult =
  | AllDayDragCommitResult
  | AllDayResizeCommitResult
  | TimedDragCommitResult
  | TimedResizeCommitResult;

/** The minimum a commit target must expose to build an envelope from it. */
export interface InteractionCommitTarget {
  event: GridEvent;
  hadFormOpenBeforeInteraction: boolean;
}

/**
 * Assigns `event` BY REFERENCE and never spreads it. Spreading would drop
 * mapper-set flags — Day's `isAllDay: true` on an all-day resize and
 * `isAllDay: false` on a timed drag — and the coordinator branches on
 * `result.event.isAllDay` to pick the schedule kind.
 */
export const buildInteractionCommitResult = <
  TType extends InteractionCommitType,
>(
  type: TType,
  target: InteractionCommitTarget,
  event: GridEvent,
  hasMoved: boolean,
): InteractionCommitResultOf<TType> => ({
  event,
  eventId: target.event._id!,
  hadFormOpenBeforeInteraction: target.hadFormOpenBeforeInteraction,
  hasMoved,
  type,
});

/**
 * Per-view commit strategy.
 *
 * `hasMoved` is REQUIRED and has NO DEFAULT, deliberately. Week forces
 * `hasMoved: true` on any cross-row drop even onto the same day, because the
 * event gains or loses a time of day. If a shared default ever computed it
 * from the plain `has*VisualMoved` predicate instead, a same-day cross-row
 * drop would report `false`, the coordinator would take its `!hasMoved` branch
 * and REOPEN the event rather than save the row change — silent, user-visible
 * data loss. Making it required turns that mistake into a type error.
 *
 * `toEvent` receives the computed `hasMoved` because the two views differ on
 * whether they use it: Day gates on it and returns `target.event` by identity
 * on a no-op, while Week's resize mappers ignore it and always re-map. Both
 * behaviors are pinned by `commit-characterization.test.ts` in each view.
 */
export interface InteractionCommitMapper<
  TTarget extends InteractionCommitTarget,
  TVisual,
> {
  hasMoved: (visual: TVisual) => boolean;
  toEvent: (target: TTarget, visual: TVisual, hasMoved: boolean) => GridEvent;
}

/**
 * Uncurried on purpose: every existing `commit*Interaction` keeps its exact
 * parameter list, including Day's third `visibleDate` argument, so neither
 * adapter's `commit()` switch needs an edit.
 */
export const commitWithMapper = <
  TType extends InteractionCommitType,
  TTarget extends InteractionCommitTarget,
  TVisual,
>(
  type: TType,
  target: TTarget,
  visual: TVisual,
  mapper: InteractionCommitMapper<TTarget, TVisual>,
): InteractionCommitResultOf<TType> => {
  const hasMoved = mapper.hasMoved(visual);

  return buildInteractionCommitResult(
    type,
    target,
    mapper.toEvent(target, visual, hasMoved),
    hasMoved,
  );
};
