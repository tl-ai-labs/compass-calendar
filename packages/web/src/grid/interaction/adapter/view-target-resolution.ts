import { getResizeHandleEdge } from "../dom";
import {
  type ViewEventRegistry,
  type ViewInteractionEventType,
  type ViewRegisteredEventTarget,
} from "../view-event-registry";
import {
  type ViewAllDayDragTarget,
  type ViewAllDayResizeTarget,
  type ViewInteractionRuntime,
  type ViewInteractionTarget,
  type ViewResolvedEventTarget,
  type ViewTimedDragTarget,
  type ViewTimedResizeTarget,
} from "./view-interaction.adapter.types";

/**
 * Pointer-to-target resolution, shared by the Week and Day adapters.
 *
 * Both views carried byte-identical copies of these nine members, differing
 * only in which registry singleton they consulted and which type alias they
 * named. The probe order below is the part that matters most: it is what makes
 * a pointerdown on a resize handle start a resize rather than a drag, and it
 * is reproduced here exactly as both views had it.
 */

export const isViewAllDayTarget = <
  TRegistered extends ViewRegisteredEventTarget,
>(
  target: ViewInteractionTarget<TRegistered>,
): target is
  | ViewAllDayDragTarget<TRegistered>
  | ViewAllDayResizeTarget<TRegistered> =>
  target.type === "allDayDrag" || target.type === "allDayResize";

export const isViewDragTarget = <TRegistered extends ViewRegisteredEventTarget>(
  target: ViewInteractionTarget<TRegistered>,
): target is
  | ViewAllDayDragTarget<TRegistered>
  | ViewTimedDragTarget<TRegistered> =>
  target.type === "allDayDrag" || target.type === "timedDrag";

/**
 * `TView` parameterises the registry and the registered target together, so a
 * view's resolver cannot be built from another view's registry. Splitting them
 * into independent parameters would let `registry: dayEventRegistry` sit under
 * a Week target type and let the cast below launder the mistake.
 */
export const createViewTargetResolver = <TView extends string>({
  registry,
  runtime,
}: {
  registry: ViewEventRegistry<TView>;
  runtime: () => ViewInteractionRuntime<ViewRegisteredEventTarget<TView>>;
}) => {
  type TRegistered = ViewRegisteredEventTarget<TView>;

  /**
   * The four probes are mutually exclusive, so the ORDER below is not what
   * makes this correct — the guards inside each probe are.
   *
   * Both resize probes require `getResizeHandleEdge(event)` to be truthy, and
   * both drag probes bail out immediately when it is. Within each pair, the
   * two probes filter the same single registration on opposite `eventType`
   * values, and `resolveFromTarget` resolves at most one element. At most one
   * probe can return non-null for any pointer event.
   *
   * The load-bearing part is therefore the handle guard in
   * `getAllDayDragTarget` / `getTimedDragTarget`: delete either and grabbing a
   * resize handle starts a drag. This hoist collapsed four copies of that
   * guard (two per view) into these two, so it is worth keeping tested.
   */
  function getInteractionTarget(
    event: PointerEvent,
  ): ViewInteractionTarget<TRegistered> | null {
    const allDayResizeTarget = getAllDayResizeTarget(event);

    if (allDayResizeTarget) {
      return allDayResizeTarget;
    }

    const resizeTarget = getTimedResizeTarget(event);

    if (resizeTarget) {
      return resizeTarget;
    }

    const timedDragTarget = getTimedDragTarget(event);

    if (timedDragTarget) {
      return timedDragTarget;
    }

    return getAllDayDragTarget(event);
  }

  function getAllDayDragTarget(
    event: PointerEvent,
  ): ViewAllDayDragTarget<TRegistered> | null {
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
  ): ViewAllDayResizeTarget<TRegistered> | null {
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

  function getTimedDragTarget(
    event: PointerEvent,
  ): ViewTimedDragTarget<TRegistered> | null {
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
  ): ViewTimedResizeTarget<TRegistered> | null {
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

  function resolveAllDayEventTarget(
    event: PointerEvent,
  ): ViewResolvedEventTarget<TRegistered> | null {
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
  ): ViewResolvedEventTarget<TRegistered> | null {
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

  function getRegisteredTarget(
    event: PointerEvent,
    eventType: ViewInteractionEventType,
  ) {
    const registered = registry.resolveFromTarget(event.target);

    // The single widening point for the phantom view brand. Each registry is
    // namespaced by its own `data-${view}-interaction-event-*` attributes, so
    // anything it resolves demonstrably belongs to this view — but the raw
    // registration carries no brand, and this is the one place a registration
    // enters the branded world. Every downstream consumer is brand-correct
    // without a further cast.
    return registered?.eventType === eventType
      ? (registered as TRegistered)
      : null;
  }

  return { getInteractionTarget };
};
