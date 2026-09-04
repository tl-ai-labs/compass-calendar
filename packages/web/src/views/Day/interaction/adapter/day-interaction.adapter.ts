import { YEAR_MONTH_DAY_FORMAT } from "@core/constants/date.constants";
import dayjs from "@core/util/date/dayjs";
import { createViewInteractionAdapter } from "@web/grid/interaction/adapter/create-view-interaction-adapter";
import { createViewEngineAdapter } from "@web/grid/interaction/adapter/view-engine-adapter";
import { createViewLayoutScrollState } from "@web/grid/interaction/adapter/view-layout-scroll.state";
import { readElementRect } from "@web/grid/interaction/adapter.helpers";
import { getLocalMinutes } from "@web/grid/interaction/date";
import { updateDraftEventTimeLabel } from "@web/grid/interaction/dom";
import {
  createAllDayDragVisual,
  updateAllDayDragVisual,
} from "@web/grid/interaction/math/all-day.drag";
import {
  createAllDayResizeVisual,
  updateAllDayResizeVisual,
} from "@web/grid/interaction/math/all-day.resize";
import {
  createTimedDragVisual,
  updateTimedDragVisual,
} from "@web/grid/interaction/math/timed.drag";
import {
  createTimedResizeVisual,
  updateTimedResizeVisual,
} from "@web/grid/interaction/math/timed.resize";
import { type InteractionAdapter } from "@web/interaction/interaction.adapter.types";
import {
  type DayRegisteredEventTarget,
  dayEventRegistry,
} from "../registry/day-event.registry";
import {
  commitAllDayDragInteraction,
  commitAllDayResizeInteraction,
} from "./commit/all-day.commit";
import {
  commitTimedDragInteraction,
  commitTimedResizeInteraction,
  timedDragVisualToDayGridEvent,
  timedResizeVisualToDayGridEvent,
} from "./commit/timed.commit";
import {
  type DayInteractionAdapter,
  type DayInteractionAdapterOptions,
  type DayInteractionCommitResult,
  type DayInteractionRuntime,
  type DayInteractionTarget,
  type DayInteractionVisual,
} from "./day-interaction.adapter.types";
import {
  asDayColumnKeys,
  buildDayLayoutCacheForTarget,
  type DayLayoutCache,
  isDayDragTarget,
} from "./geometry/day-layout.cache";

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
  const layoutState = createViewLayoutScrollState<DayLayoutCache>();

  const { engine: _engine, ...pointerSession } = createViewInteractionAdapter<
    "day",
    DayInteractionVisual
  >({
    buildEngineAdapter: ({ getTarget }) => createEngineAdapter(getTarget),
    engineOptions,
    ineligibleReason: "ineligible-day-pointer",
    noTargetReason: "no-day-interaction-target",
    registry: dayEventRegistry,
    runtime: () => runtime(),
  });

  function createEngineAdapter(
    getTarget: (event: PointerEvent) => DayInteractionTarget | null,
  ): InteractionAdapter<
    DayInteractionTarget,
    DayInteractionVisual,
    DayInteractionCommitResult
  > {
    return createViewEngineAdapter<
      DayRegisteredEventTarget,
      DayInteractionVisual,
      DayInteractionCommitResult
    >({
      clearLayoutState: () => layoutState.clear(),
      // Day unwinds nothing beyond the layout cache: it has no motion flag and
      // no edge-navigation indicator.
      onInteractionSettled: () => undefined,
      getTarget,
      commitDispatch: ({ target, visual }) => {
        // Read before the branch, so getVisibleDate() is still called on the
        // throw path exactly as it was before this dispatch was extracted.
        const visibleDate = getVisibleDate();

        if (visual.type === "allDayDrag" && target.type === "allDayDrag") {
          return commitAllDayDragInteraction(target, visual);
        }

        if (visual.type === "allDayResize" && target.type === "allDayResize") {
          return commitAllDayResizeInteraction(target, visual, visibleDate);
        }

        if (visual.type === "timedResize" && target.type === "timedResize") {
          return commitTimedResizeInteraction(target, visual, visibleDate);
        }

        if (visual.type === "timedDrag" && target.type === "timedDrag") {
          return commitTimedDragInteraction(target, visual, visibleDate);
        }

        throw new Error("Mismatched Day interaction target");
      },
      createVisual: ({ pointerStart, sourceElement, target }) => {
        const visibleDateKey = getVisibleDate().format(YEAR_MONTH_DAY_FORMAT);
        // The Day view renders one column per calendar, all sharing one date,
        // so drag column keys are CALENDAR IDS (not dates like the Week
        // view) — a column change is a cross-calendar move. Resizes stay
        // within the event's own column and keep the single-column layout.
        // An event whose calendar isn't among the rendered columns (columns
        // and events momentarily out of sync) also falls back to the single
        // column: anchoring it to column 0 would make a purely vertical drag
        // commit a calendar move the user never made.
        const calendarColumnKeys = isDayDragTarget(target)
          ? getColumnKeys()
          : [];
        const eventColumnIndex = calendarColumnKeys.indexOf(
          target.event.calendarId ?? "",
        );
        const columnKeys = asDayColumnKeys(
          eventColumnIndex >= 0 ? calendarColumnKeys : [visibleDateKey],
        );
        const initialColumnIndex = Math.max(0, eventColumnIndex);
        const initialColumnKey = columnKeys[initialColumnIndex]!;
        const nextLayout = buildDayLayoutCacheForTarget(
          target,
          getLayoutSources(),
          columnKeys,
        );

        if (!nextLayout) {
          return null;
        }

        const sourceRect = readElementRect(sourceElement);

        layoutState.set(nextLayout);
        runtime().onMotionActivation?.(target);

        if (target.type === "allDayDrag") {
          return createAllDayDragVisual({
            dayDate: initialColumnKey,
            dayIndex: initialColumnIndex,
            eventId: target.event._id!,
            pointerStart,
            sourceRect,
          });
        }

        if (target.type === "allDayResize") {
          return createAllDayResizeVisual({
            edge: target.edge,
            endDayIndex: 0,
            eventId: target.event._id!,
            pointerStart,
            sourceRect,
            startDayIndex: 0,
          });
        }

        if (target.type === "timedResize") {
          return createTimedResizeVisual({
            edge: target.edge,
            endMinutes: getLocalMinutes(target.event.endDate),
            eventId: target.event._id!,
            pointerStart,
            sourceRect,
            startMinutes: getLocalMinutes(target.event.startDate),
          });
        }

        return createTimedDragVisual({
          dayDate: initialColumnKey,
          dayIndex: initialColumnIndex,
          endMinutes: getLocalMinutes(target.event.endDate),
          eventId: target.event._id!,
          pointerStart,
          sourceRect,
          startMinutes: getLocalMinutes(target.event.startDate),
        });
      },
      updateVisual: ({ pointer, target, visual }) => {
        const layout = layoutState.get();

        if (!layout) {
          return {
            draftEvent: null,
            visual,
          };
        }

        if (visual.type === "allDayDrag") {
          const nextVisual = updateAllDayDragVisual(visual, {
            layout,
            pointer,
          });

          return {
            draftEvent: {
              transform: nextVisual.transform,
            },
            visual: nextVisual,
          };
        }

        if (visual.type === "allDayResize") {
          const nextVisual = updateAllDayResizeVisual(visual, {
            layout,
            pointer,
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
          const nextVisual = updateTimedResizeVisual(visual, {
            layout,
            pointer,
            scrollDeltaPx: smartScroll.scrollDeltaPx,
          });
          const nextEvent = timedResizeVisualToDayGridEvent(
            target.event,
            nextVisual,
            getVisibleDate(),
          );

          return {
            draftEvent: {
              height: nextVisual.height,
              mutate: (node) => updateDraftEventTimeLabel(node, nextEvent),
              transform: nextVisual.transform,
            },
            shouldContinue: smartScroll.isScrolling,
            visual: nextVisual,
          };
        }

        if (target.type !== "timedDrag") {
          throw new Error("Mismatched Day interaction target");
        }

        const smartScroll = layoutState.applySmartScroll(pointer);
        const nextVisual = updateTimedDragVisual(visual, {
          layout,
          pointer,
          scrollDeltaPx: smartScroll.scrollDeltaPx,
        });
        const nextEvent = timedDragVisualToDayGridEvent(
          target.event,
          nextVisual,
          getVisibleDate(),
        );

        return {
          draftEvent: {
            mutate: (node) => updateDraftEventTimeLabel(node, nextEvent),
            transform: nextVisual.transform,
          },
          shouldContinue: smartScroll.isScrolling,
          visual: nextVisual,
        };
      },
    });
  }

  return pointerSession;
};
