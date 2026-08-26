import { getResizeHandleEdge } from "@web/grid/interaction/dom";
import {
  type ViewEventRegistry,
  type ViewInteractionEventType,
} from "@web/grid/interaction/view-event-registry";
import {
  type ViewAllDayDragTarget,
  type ViewAllDayResizeTarget,
  type ViewInteractionRuntimeBase,
  type ViewInteractionTarget,
  type ViewResolvedEventTarget,
  type ViewTimedDragTarget,
  type ViewTimedResizeTarget,
} from "./view-interaction.types";

export const isViewAllDayTarget = (
  target: ViewInteractionTarget,
): target is ViewAllDayDragTarget | ViewAllDayResizeTarget =>
  target.type === "allDayDrag" || target.type === "allDayResize";

export const isViewDragTarget = (
  target: ViewInteractionTarget,
): target is ViewAllDayDragTarget | ViewTimedDragTarget =>
  target.type === "allDayDrag" || target.type === "timedDrag";

/**
 * Resolves a pointer event to the interaction target it landed on. Week and
 * Day carried token-identical copies of this; the only thing that differed was
 * which registry instance the lookup went through.
 *
 * The resolution order is a behavioural contract, not an implementation
 * detail: all-day resize, then timed resize, then timed drag, then all-day
 * drag. Resizes come first because a pointer down on a resize handle sits
 * inside the event card, so a drag check would match it too.
 *
 * `runtime` is re-read on every call, never captured. The runtime is backed by
 * a React render and the event lists it exposes change between pointer events;
 * capturing it once would resolve drags against a stale set of events.
 */
export const createViewInteractionTargetResolver = ({
  registry,
  runtime,
}: {
  registry: ViewEventRegistry;
  runtime: () => ViewInteractionRuntimeBase;
}) => {
  function getRegisteredTarget(
    event: PointerEvent,
    eventType: ViewInteractionEventType,
  ) {
    const registered = registry.resolveFromTarget(event.target);

    return registered?.eventType === eventType ? registered : null;
  }

  function resolveAllDayEventTarget(
    event: PointerEvent,
  ): ViewResolvedEventTarget | null {
    const registered = getRegisteredTarget(event, "all-day");

    if (!registered) {
      return null;
    }

    const currentRuntime = runtime();
    const allDayEvent = currentRuntime.getAllDayEventById?.(registered.eventId);

    if (!allDayEvent?._id || !allDayEvent.isAllDay) {
      return null;
    }

    return {
      event: allDayEvent,
      hadFormOpenBeforeInteraction: currentRuntime.isFormOpen?.() ?? false,
      registered,
    };
  }

  function resolveTimedEventTarget(
    event: PointerEvent,
  ): ViewResolvedEventTarget | null {
    const registered = getRegisteredTarget(event, "timed");

    if (!registered) {
      return null;
    }

    const currentRuntime = runtime();
    const timedEvent = currentRuntime.getTimedEventById(registered.eventId);

    if (!timedEvent?._id || timedEvent.isAllDay) {
      return null;
    }

    return {
      event: timedEvent,
      hadFormOpenBeforeInteraction: currentRuntime.isFormOpen?.() ?? false,
      registered,
    };
  }

  function getAllDayDragTarget(
    event: PointerEvent,
  ): ViewAllDayDragTarget | null {
    if (getResizeHandleEdge(event)) {
      return null;
    }

    const target = resolveAllDayEventTarget(event);

    if (!target) {
      return null;
    }

    return {
      ...target,
      type: "allDayDrag",
    };
  }

  function getAllDayResizeTarget(
    event: PointerEvent,
  ): ViewAllDayResizeTarget | null {
    const edge = getResizeHandleEdge(event);

    if (!edge) {
      return null;
    }

    const target = resolveAllDayEventTarget(event);

    if (!target) {
      return null;
    }

    return {
      edge,
      ...target,
      type: "allDayResize",
    };
  }

  function getTimedDragTarget(event: PointerEvent): ViewTimedDragTarget | null {
    if (getResizeHandleEdge(event)) {
      return null;
    }

    const target = resolveTimedEventTarget(event);

    if (!target) {
      return null;
    }

    return {
      ...target,
      type: "timedDrag",
    };
  }

  function getTimedResizeTarget(
    event: PointerEvent,
  ): ViewTimedResizeTarget | null {
    const edge = getResizeHandleEdge(event);

    if (!edge) {
      return null;
    }

    const target = resolveTimedEventTarget(event);

    if (!target) {
      return null;
    }

    return {
      edge,
      ...target,
      type: "timedResize",
    };
  }

  function getInteractionTarget(
    event: PointerEvent,
  ): ViewInteractionTarget | null {
    const allDayResizeTarget = getAllDayResizeTarget(event);

    if (allDayResizeTarget) {
      return allDayResizeTarget;
    }

    const timedResizeTarget = getTimedResizeTarget(event);

    if (timedResizeTarget) {
      return timedResizeTarget;
    }

    const timedDragTarget = getTimedDragTarget(event);

    if (timedDragTarget) {
      return timedDragTarget;
    }

    return getAllDayDragTarget(event);
  }

  return { getInteractionTarget };
};
