import {
  createViewInteractionAdapterCore,
  type ViewEngineAdapter,
} from "@web/grid/interaction/adapter/view-interaction.core";
import {
  getViewInteractionDraftEventMode,
  getViewInteractionSourceElement,
  viewInteractionDraftEventMount,
} from "@web/grid/interaction/adapter/view-interaction.engine-members";
import { createViewInteractionLayoutState } from "@web/grid/interaction/adapter/view-interaction.layout-state";
import { isViewDragTarget } from "@web/grid/interaction/adapter/view-interaction.targets";
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
import { weekEventRegistry } from "../registry/week-event.registry";
import {
  resetWeekInteractionEdgeNavigationState,
  setWeekInteractionEdgeNavigationState,
} from "../state/edge-navigation.state";
import { setWeekInteractionMotionActive } from "../state/motion.state";
import { createWeekEdgeNavigationController } from "./edge-navigation";
import {
  buildWeekLayoutCacheForTarget,
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
  const layoutState = createViewInteractionLayoutState();
  let isLayoutRebuildPending = false;

  const core = createViewInteractionAdapterCore({
    createEngineAdapter,
    engineOptions,
    onPointerClickSettled: () => setWeekInteractionMotionActive(false),
    onPointerDownAccepted: () => setWeekInteractionMotionActive(true),
    ownershipReasons: {
      ineligiblePointer: "ineligible-week-pointer",
      noTarget: "no-week-interaction-target",
    },
    registry: weekEventRegistry,
    runtime,
  });

  function rebuildLayoutAfterNavigation() {
    const session = core.engine.getSession();

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
        core.engine.rebindPreparedSource(nextElement);
      }
    }
  }

  function createEngineAdapter({
    getInteractionTarget,
  }: {
    getInteractionTarget: (event: PointerEvent) => WeekInteractionTarget | null;
  }): ViewEngineAdapter {
    return {
      cancel: () => {
        clearInteractionState();
        resetWeekInteractionEdgeNavigationState();
        setWeekInteractionMotionActive(false);
      },
      commit: ({ target, visual }) => {
        let result: WeekInteractionCommitResult;

        if (visual.type === "allDayDrag" && target.type === "allDayDrag") {
          result = commitAllDayDragInteraction(target, visual);
        } else if (
          visual.type === "allDayResize" &&
          target.type === "allDayResize"
        ) {
          result = commitAllDayResizeInteraction(target, visual);
        } else if (
          visual.type === "timedResize" &&
          target.type === "timedResize"
        ) {
          result = commitTimedResizeInteraction(target, visual);
        } else if (visual.type === "timedDrag" && target.type === "timedDrag") {
          result = commitTimedDragInteraction(target, visual);
        } else {
          throw new Error("Mismatched Week interaction target");
        }

        clearInteractionState();
        resetWeekInteractionEdgeNavigationState();
        setWeekInteractionMotionActive(false);

        return result;
      },
      createVisual: ({ pointerStart, sourceElement, target }) => {
        const layout = buildWeekLayoutCacheForTarget(target, getLayoutInput());

        if (!layout) {
          return null;
        }

        const sourceRect = readElementRect(sourceElement);
        layoutState.setLayout(layout);
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
      getDraftEventMount: viewInteractionDraftEventMount,
      getSourceElement: getViewInteractionSourceElement,
      getSourceElementDraftEventMode: getViewInteractionDraftEventMode,
      getTarget: (event) => getInteractionTarget(event),
      updateVisual: ({ pointer, target, timestamp, visual }) => {
        rebuildLayoutIfNeeded(target);

        const layout = layoutState.getLayout();

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
    };
  }

  function isPointerOverAllDayRow(pointer: VisualPoint) {
    const layout = layoutState.getLayout();

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
    const layout = layoutState.getLayout();

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

    layoutState.setLayout(nextLayout);
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

  return {
    ...core.adapter,
    rebuildLayoutAfterNavigation,
  };
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
