import dayjs from "@core/util/date/dayjs";
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
import { readElementRect } from "@web/grid/interaction/adapter.helpers";
import { updateDraftEventTimeLabel } from "@web/grid/interaction/dom";
import { dayEventRegistry } from "../registry/day-event.registry";
import {
  type DayInteractionAdapter,
  type DayInteractionAdapterOptions,
  type DayInteractionCommitResult,
  type DayInteractionRuntime,
  type DayInteractionTarget,
} from "./day-interaction.adapter.types";
import { resolveDayColumns } from "./geometry/day-columns";
import { buildDayLayoutCacheForTarget } from "./geometry/day-layout.cache";
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

export type {
  DayAllDayDragCommitResult,
  DayAllDayResizeCommitResult,
  DayInteractionAdapter,
  DayInteractionRuntime,
  DayTimedDragCommitResult,
  DayTimedResizeCommitResult,
} from "./day-interaction.adapter.types";

const inertRuntime: DayInteractionRuntime = {
  getTimedEventById: () => null,
  onClickTimedEvent: () => undefined,
  onCommitTimedDrag: () => undefined,
};

export const createDayInteractionAdapter = ({
  engineOptions,
  getColumnKeys = () => [],
  getLayoutSources = () => ({}),
  getVisibleDate = () => dayjs(),
  runtime = () => inertRuntime,
}: DayInteractionAdapterOptions = {}): DayInteractionAdapter => {
  const layoutState = createViewInteractionLayoutState();

  const core = createViewInteractionAdapterCore({
    createEngineAdapter,
    engineOptions,
    // Day passes neither pointer hook: it has no motion flag. Adding one here
    // would be the quiet way to grant Day a Week-only behaviour.
    ownershipReasons: {
      ineligiblePointer: "ineligible-day-pointer",
      noTarget: "no-day-interaction-target",
    },
    registry: dayEventRegistry,
    runtime,
  });

  function createEngineAdapter({
    getInteractionTarget,
  }: {
    getInteractionTarget: (event: PointerEvent) => DayInteractionTarget | null;
  }): ViewEngineAdapter {
    return {
      cancel: () => {
        layoutState.clear();
      },
      commit: ({ target, visual }) => {
        let result: DayInteractionCommitResult;
        const visibleDate = getVisibleDate();

        if (visual.type === "allDayDrag" && target.type === "allDayDrag") {
          result = commitAllDayDragInteraction(target, visual);
        } else if (
          visual.type === "allDayResize" &&
          target.type === "allDayResize"
        ) {
          result = commitAllDayResizeInteraction(target, visual, visibleDate);
        } else if (
          visual.type === "timedResize" &&
          target.type === "timedResize"
        ) {
          result = commitTimedResizeInteraction(target, visual, visibleDate);
        } else if (visual.type === "timedDrag" && target.type === "timedDrag") {
          result = commitTimedDragInteraction(target, visual, visibleDate);
        } else {
          throw new Error("Mismatched Day interaction target");
        }

        layoutState.clear();

        return result;
      },
      createVisual: ({ pointerStart, sourceElement, target }) => {
        const { columnKeys, initialColumnIndex, initialColumnKey } =
          resolveDayColumns({
            getColumnKeys,
            target,
            visibleDate: getVisibleDate(),
          });
        const nextLayout = buildDayLayoutCacheForTarget(
          target,
          getLayoutSources(),
          columnKeys,
        );

        if (!nextLayout) {
          return null;
        }

        const sourceRect = readElementRect(sourceElement);

        layoutState.setLayout(nextLayout);
        runtime().onMotionActivation?.(target);

        if (target.type === "allDayDrag") {
          return createAllDayDragInteractionVisual({
            initialColumnIndex,
            initialColumnKey,
            pointerStart,
            sourceRect,
            target,
          });
        }

        if (target.type === "allDayResize") {
          return createAllDayResizeInteractionVisual({
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
          initialColumnIndex,
          initialColumnKey,
          pointerStart,
          sourceRect,
          target,
        });
      },
      getDraftEventMount: viewInteractionDraftEventMount,
      getSourceElement: getViewInteractionSourceElement,
      getSourceElementDraftEventMode: getViewInteractionDraftEventMode,
      getTarget: (event) => getInteractionTarget(event),
      updateVisual: ({ pointer, target, visual }) => {
        const layout = layoutState.getLayout();

        if (!layout) {
          return {
            draftEvent: null,
            visual,
          };
        }

        if (visual.type === "allDayDrag") {
          const nextVisual = updateAllDayDragInteractionVisual({
            layout,
            pointer,
            visual,
          });

          return {
            draftEvent: {
              transform: nextVisual.transform,
            },
            visual: nextVisual,
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
            throw new Error("Mismatched Day interaction target");
          }

          const smartScroll = layoutState.applySmartScroll(pointer);
          const next = updateTimedResizeInteractionVisual({
            layout,
            pointer,
            scrollDeltaPx: smartScroll.scrollDeltaPx,
            target,
            visibleDate: getVisibleDate(),
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
          throw new Error("Mismatched Day interaction target");
        }

        const smartScroll = layoutState.applySmartScroll(pointer);
        const next = updateTimedDragInteractionVisual({
          layout,
          pointer,
          scrollDeltaPx: smartScroll.scrollDeltaPx,
          target,
          visibleDate: getVisibleDate(),
          visual,
        });

        return {
          draftEvent: {
            mutate: (node) => updateDraftEventTimeLabel(node, next.event),
            transform: next.visual.transform,
          },
          shouldContinue: smartScroll.isScrolling,
          visual: next.visual,
        };
      },
    };
  }

  return core.adapter;
};
