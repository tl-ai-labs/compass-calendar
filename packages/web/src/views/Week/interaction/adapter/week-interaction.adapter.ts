import { createViewInteractionAdapter } from "@web/grid/interaction/adapter/create-view-interaction-adapter";
import { createViewEngineAdapter } from "@web/grid/interaction/adapter/view-engine-adapter";
import { createViewLayoutScrollState } from "@web/grid/interaction/adapter/view-layout-scroll.state";
import {
  isViewAllDayTarget,
  isViewDragTarget,
} from "@web/grid/interaction/adapter/view-target-resolution";
import { readElementRect } from "@web/grid/interaction/adapter.helpers";
import {
  hideDraftEventTimeLabel,
  updateDraftEventTimeLabel,
} from "@web/grid/interaction/dom";
import {
  getDragRowLayouts,
  resolveDragRow,
} from "@web/grid/interaction/math/cross-row.drag";
import {
  type CrossRowSize,
  type VisualPoint,
  type VisualRect,
} from "@web/grid/interaction/types/timed-drag.types";
import { calendarEventIdValueSelector } from "@web/grid/interaction/view-event-registry";
import { type InteractionAdapter } from "@web/interaction/interaction.adapter.types";
import {
  type WeekRegisteredEventTarget,
  weekEventRegistry,
} from "../registry/week-event.registry";
import {
  resetWeekInteractionEdgeNavigationState,
  setWeekInteractionEdgeNavigationState,
} from "../state/edge-navigation.state";
import { setWeekInteractionMotionActive } from "../state/motion.state";
import { createWeekEdgeNavigationController } from "./edge-navigation";
import {
  buildAllDayWeekLayoutCache,
  buildDragWeekLayoutCache,
  buildTimedWeekLayoutCache,
  type WeekLayoutCache,
  type WeekLayoutCacheInput,
} from "./geometry/week-layout.cache";
import {
  commitAllDayDragInteraction,
  createAllDayDragInteractionVisual,
  updateAllDayDragInteractionVisual,
} from "./interactions/all-day.drag";
import {
  commitAllDayResizeInteraction,
  createAllDayResizeInteractionVisual,
  updateAllDayResizeInteractionVisual,
} from "./interactions/all-day.resize";
import {
  commitTimedDragInteraction,
  createTimedDragInteractionVisual,
  updateTimedDragInteractionVisual,
} from "./interactions/timed.drag";
import {
  commitTimedResizeInteraction,
  createTimedResizeInteractionVisual,
  updateTimedResizeInteractionVisual,
} from "./interactions/timed.resize";
import {
  type WeekEdgeNavigableVisual,
  type WeekInteractionAdapter,
  type WeekInteractionAdapterOptions,
  type WeekInteractionCommitResult,
  type WeekInteractionRuntime,
  type WeekInteractionTarget,
  type WeekInteractionVisual,
} from "./week-interaction.adapter.types";

export type {
  WeekAllDayDragCommitResult,
  WeekAllDayResizeCommitResult,
  WeekInteractionAdapter,
  WeekInteractionRuntime,
  WeekTimedDragCommitResult,
  WeekTimedResizeCommitResult,
} from "./week-interaction.adapter.types";

const inertRuntime: WeekInteractionRuntime = {
  getTimedEventById: () => null,
  getVisibleDays: () => [],
  onClickTimedEvent: () => undefined,
  onCommitTimedDrag: () => undefined,
};

const activeEdgeNavigationIndicatorState = {
  currentEdge: null,
  isDragging: true,
  isTimerActive: false,
  progress: 0,
} as const;

export const createWeekInteractionAdapter = ({
  engineOptions,
  getLayoutSources = () => ({}),
  runtime = () => inertRuntime,
}: WeekInteractionAdapterOptions = {}): WeekInteractionAdapter => {
  const edgeNavigation = createWeekEdgeNavigationController();
  const layoutState = createViewLayoutScrollState<WeekLayoutCache>();
  let isLayoutRebuildPending = false;

  const { engine, ...pointerSession } = createViewInteractionAdapter<
    "week",
    WeekInteractionVisual
  >({
    buildEngineAdapter: ({ getTarget }) => createEngineAdapter(getTarget),
    engineOptions,
    ineligibleReason: "ineligible-week-pointer",
    noTargetReason: "no-week-interaction-target",
    // Week-only motion flag. Injected as opaque callbacks so the shared
    // session module never names motion.state.
    onPointerDownOwned: () => setWeekInteractionMotionActive(true),
    onClickHandled: () => setWeekInteractionMotionActive(false),
    registry: weekEventRegistry,
    runtime: () => runtime(),
  });

  function rebuildLayoutAfterNavigation() {
    const session = engine.getSession();

    if (session.phase === "idle") {
      return;
    }

    rebuildLayoutIfNeeded(session.target);

    // Edge-nav remounts event cards; re-dim/hide the source on the new node
    // so the placeholder style survives dragging across weeks.
    if (session.phase === "pending" || session.phase === "motion") {
      const { eventId, eventType } = session.target.registered;
      const nextElement =
        weekEventRegistry.resolve(eventId, eventType) ??
        document.querySelector<HTMLElement>(
          calendarEventIdValueSelector(eventId),
        );
      if (nextElement) {
        engine.rebindPreparedSource(nextElement);
      }
    }
  }

  function createEngineAdapter(
    getTarget: (event: PointerEvent) => WeekInteractionTarget | null,
  ): InteractionAdapter<
    WeekInteractionTarget,
    WeekInteractionVisual,
    WeekInteractionCommitResult
  > {
    return createViewEngineAdapter<
      WeekRegisteredEventTarget,
      WeekInteractionVisual,
      WeekInteractionCommitResult
    >({
      clearLayoutState: clearInteractionState,
      // Week additionally parks its edge-navigation indicator and clears the
      // motion flag. Passed as an opaque callback so the shared layer never
      // names either store.
      onInteractionSettled: () => {
        resetWeekInteractionEdgeNavigationState();
        setWeekInteractionMotionActive(false);
      },
      getTarget,
      commitDispatch: ({ target, visual }) => {
        if (visual.type === "allDayDrag" && target.type === "allDayDrag") {
          return commitAllDayDragInteraction(target, visual);
        }

        if (visual.type === "allDayResize" && target.type === "allDayResize") {
          return commitAllDayResizeInteraction(target, visual);
        }

        if (visual.type === "timedResize" && target.type === "timedResize") {
          return commitTimedResizeInteraction(target, visual);
        }

        if (visual.type === "timedDrag" && target.type === "timedDrag") {
          return commitTimedDragInteraction(target, visual);
        }

        throw new Error("Mismatched Week interaction target");
      },
      createVisual: ({ pointerStart, sourceElement, target }) => {
        const layout = buildWeekLayoutCacheForTarget(target, getLayoutInput());

        if (!layout) {
          return null;
        }

        const sourceRect = readElementRect(sourceElement);
        layoutState.set(layout);
        if (isViewDragTarget(target)) {
          setWeekInteractionEdgeNavigationState(
            activeEdgeNavigationIndicatorState,
          );
        } else {
          resetWeekInteractionEdgeNavigationState();
        }
        runtime().onMotionActivation?.(target);

        if (target.type === "allDayDrag") {
          return createAllDayDragInteractionVisual({
            layout,
            pointerStart,
            sourceRect,
            target,
          });
        }

        if (target.type === "allDayResize") {
          return createAllDayResizeInteractionVisual({
            layout,
            pointerStart,
            sourceRect,
            target,
          });
        }

        if (target.type === "timedResize") {
          return createTimedResizeInteractionVisual({
            pointerStart,
            sourceRect,
            target,
          });
        }

        return createTimedDragInteractionVisual({
          layout,
          pointerStart,
          sourceRect,
          target,
        });
      },
      updateVisual: ({ pointer, target, timestamp, visual }) => {
        rebuildLayoutIfNeeded(target);

        const layout = layoutState.get();

        if (!layout || layoutState.getScrollTop() === null) {
          if (visual.type !== "allDayDrag" && visual.type !== "allDayResize") {
            return {
              draftEvent: null,
              visual,
            };
          }
        }

        if (!layout) {
          return {
            draftEvent: null,
            visual,
          };
        }

        if (visual.type === "allDayDrag") {
          if (target.type !== "allDayDrag") {
            throw new Error("Mismatched Week interaction target");
          }

          const nextEdgeNavigation = updateEdgeNavigation(
            visual,
            pointer,
            timestamp,
          );
          const next = updateAllDayDragInteractionVisual({
            layout,
            pointer,
            target,
            visual: nextEdgeNavigation.visual,
          });

          return {
            draftEvent: {
              ...getDraftEventSize(next.visual),
              mutate: (node) =>
                next.event
                  ? updateDraftEventTimeLabel(node, next.event)
                  : undefined,
              transform: next.visual.transform,
            },
            shouldContinue: nextEdgeNavigation.isDwellActive,
            visual: next.visual,
          };
        }

        if (visual.type === "allDayResize") {
          const nextVisual = updateAllDayResizeInteractionVisual({
            layout,
            pointer,
            visual,
          });

          return {
            draftEvent: {
              height: nextVisual.sourceRect.height,
              transform: nextVisual.transform,
              width: nextVisual.width,
            },
            visual: nextVisual,
          };
        }

        if (visual.type === "timedResize") {
          if (target.type !== "timedResize") {
            throw new Error("Mismatched Week interaction target");
          }

          const smartScroll = layoutState.applySmartScroll(pointer);
          const next = updateTimedResizeInteractionVisual({
            layout,
            pointer,
            scrollDeltaPx: smartScroll.scrollDeltaPx,
            target,
            visual,
          });

          return {
            draftEvent: {
              height: next.visual.height,
              mutate: (node) => updateDraftEventTimeLabel(node, next.event),
              transform: next.visual.transform,
            },
            shouldContinue: smartScroll.isScrolling,
            visual: next.visual,
          };
        }

        if (target.type !== "timedDrag") {
          throw new Error("Mismatched Week interaction target");
        }

        // Suppressed while the pointer is over the all-day row: the timed grid
        // isn't the drop target any more, so nudging its scroll would just yank
        // the view around behind the ghost.
        const smartScroll = isPointerOverAllDayRow(pointer)
          ? { isScrolling: false, scrollDeltaPx: 0 }
          : layoutState.applySmartScroll(pointer);
        const nextEdgeNavigation = updateEdgeNavigation(
          visual,
          pointer,
          timestamp,
        );
        const next = updateTimedDragInteractionVisual({
          layout,
          pointer,
          scrollDeltaPx: smartScroll.scrollDeltaPx,
          target,
          visual: nextEdgeNavigation.visual,
        });

        return {
          draftEvent: {
            ...getDraftEventSize(next.visual),
            mutate: (node) =>
              next.event
                ? updateDraftEventTimeLabel(node, next.event)
                : hideDraftEventTimeLabel(node),
            transform: next.visual.transform,
          },
          shouldContinue:
            smartScroll.isScrolling || nextEdgeNavigation.isDwellActive,
          visual: next.visual,
        };
      },
    });
  }

  function isPointerOverAllDayRow(pointer: VisualPoint) {
    const layout = layoutState.get();

    if (!layout) {
      return false;
    }

    const { allDay, timed } = getDragRowLayouts(layout, "timed");

    return (
      resolveDragRow({
        allDay,
        pointerY: pointer.y,
        sourceRow: "timed",
        timed,
      }) === "allDay"
    );
  }

  function updateEdgeNavigation<TVisual extends WeekEdgeNavigableVisual>(
    visual: TVisual,
    pointer: VisualPoint,
    timestamp: number,
  ): { isDwellActive: boolean; visual: TVisual } {
    const layout = layoutState.get();

    if (!layout) {
      resetEdgeNavigation();
      setWeekInteractionEdgeNavigationState(activeEdgeNavigationIndicatorState);
      return { isDwellActive: false, visual };
    }

    const update = edgeNavigation.update({
      bounds: layout.edgeNavigation,
      pointer,
      timestamp,
    });

    setWeekInteractionEdgeNavigationState(update.state);

    if (update.requestedSide) {
      // No day bookkeeping: the pending layout rebuild carries the new column
      // dates, and the visual re-resolves its dayDate against them.
      isLayoutRebuildPending = true;
      runtime().onRequestWeekNavigation?.(update.requestedSide);

      return {
        isDwellActive: false,
        visual,
      };
    }

    return {
      isDwellActive: update.isDwellActive,
      visual,
    };
  }

  function getLayoutInput(): WeekLayoutCacheInput {
    return {
      ...getLayoutSources(),
      visibleDays: runtime().getVisibleDays(),
    };
  }

  function rebuildLayoutIfNeeded(target: WeekInteractionTarget) {
    if (!isLayoutRebuildPending) {
      return;
    }

    const nextLayout = buildWeekLayoutCacheForTarget(target, getLayoutInput());

    if (!nextLayout) {
      return;
    }

    layoutState.set(nextLayout);
    isLayoutRebuildPending = false;
  }

  function resetEdgeNavigation() {
    edgeNavigation.reset();
  }

  function clearInteractionState() {
    layoutState.clear();
    resetEdgeNavigation();
    isLayoutRebuildPending = false;
  }

  // Week's public surface is the shared pointer session plus the one method
  // Day does not have.
  return {
    ...pointerSession,
    rebuildLayoutAfterNavigation,
  };
};

// Drags cache both rows so they can be dropped across them; resizes stay within
// one row and only need their own.
const buildWeekLayoutCacheForTarget = (
  target: WeekInteractionTarget,
  input: WeekLayoutCacheInput,
) => {
  if (isViewDragTarget(target)) {
    return buildDragWeekLayoutCache(
      input,
      target.type === "allDayDrag" ? "allDay" : "timed",
    );
  }

  return isViewAllDayTarget(target)
    ? buildAllDayWeekLayoutCache(input)
    : buildTimedWeekLayoutCache(input);
};

// Always explicit for drags: the clone keeps whatever size it was last given,
// so returning to the drag's own row has to actively restore the source card's
// box rather than just stop overriding it.
const getDraftEventSize = (visual: {
  crossRowSize: CrossRowSize;
  sourceRect: VisualRect;
}) =>
  visual.crossRowSize ?? {
    height: visual.sourceRect.height,
    width: visual.sourceRect.width,
  };
