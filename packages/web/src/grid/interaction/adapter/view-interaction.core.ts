import { getSavedEventOwnershipReason } from "@web/grid/interaction/adapter.helpers";
import { type ViewEventRegistry } from "@web/grid/interaction/view-event-registry";
import { type InteractionAdapter } from "@web/interaction/interaction.adapter.types";
import {
  createInteractionEngine,
  type InteractionCancellationTargets,
  type InteractionEngine,
  type InteractionEngineSchedulerOptions,
} from "@web/interaction/interaction.engine";
import { isEligibleInteractionPointerDown } from "@web/interaction/interaction.pointer";
import {
  createViewInteractionTargetResolver,
  isViewAllDayTarget,
} from "./view-interaction.targets";
import {
  type ViewInteractionAdapterBase,
  type ViewInteractionCommitResult,
  type ViewInteractionPointerOwnership,
  type ViewInteractionRuntimeBase,
  type ViewInteractionTarget,
  type ViewInteractionVisual,
} from "./view-interaction.types";

export type ViewInteractionEngine = InteractionEngine<
  ViewInteractionTarget,
  ViewInteractionVisual,
  ViewInteractionCommitResult
>;

export type ViewEngineAdapter = InteractionAdapter<
  ViewInteractionTarget,
  ViewInteractionVisual,
  ViewInteractionCommitResult
>;

/**
 * The ownership reason strings a view reports from `handlePointerDown` when it
 * declines a pointer. They are supplied per view rather than derived from a
 * view name so they stay greppable string literals in each view's own module.
 */
export interface ViewInteractionOwnershipReasons {
  ineligiblePointer: string;
  noTarget: string;
}

/**
 * The engine construction and the seven pointer-plumbing methods that Week and
 * Day implemented identically.
 *
 * Two optional hooks carry the only behavioural difference between the two
 * views in this layer, and their optionality is load-bearing: Week passes both
 * to drive `window.__weekInteractionMotionActive`, and Day passes neither
 * because Day has no motion flag. A view cannot acquire the flag by accident —
 * it has to ask for it at this call site. The same reasoning applies to the
 * returned `engine` handle, which Week uses to build
 * `rebuildLayoutAfterNavigation` and Day never reads.
 */
export const createViewInteractionAdapterCore = ({
  createEngineAdapter,
  engineOptions,
  onPointerDownAccepted,
  onPointerClickSettled,
  ownershipReasons,
  registry,
  runtime,
}: {
  createEngineAdapter: (deps: {
    getInteractionTarget: (event: PointerEvent) => ViewInteractionTarget | null;
  }) => ViewEngineAdapter;
  engineOptions?: InteractionEngineSchedulerOptions;
  onPointerDownAccepted?: () => void;
  onPointerClickSettled?: () => void;
  ownershipReasons: ViewInteractionOwnershipReasons;
  registry: ViewEventRegistry;
  runtime: () => ViewInteractionRuntimeBase;
}): {
  adapter: ViewInteractionAdapterBase;
  engine: ViewInteractionEngine;
  getInteractionTarget: (event: PointerEvent) => ViewInteractionTarget | null;
} => {
  const { getInteractionTarget } = createViewInteractionTargetResolver({
    registry,
    runtime,
  });

  const engine: ViewInteractionEngine = createInteractionEngine({
    adapter: createEngineAdapter({ getInteractionTarget }),
    ...engineOptions,
  });

  function ownsPointer(event: Pick<PointerEvent, "pointerId">) {
    return engine.ownsPointer(event);
  }

  function connectCancellationEvents(targets?: InteractionCancellationTargets) {
    return engine.connectCancellationEvents(targets);
  }

  function handlePointerDown(
    event: PointerEvent,
  ): ViewInteractionPointerOwnership {
    if (!isEligibleInteractionPointerDown(event)) {
      return {
        reason: ownershipReasons.ineligiblePointer,
        shouldOwn: false,
      };
    }

    const target = getInteractionTarget(event);

    if (!target) {
      return {
        reason: ownershipReasons.noTarget,
        shouldOwn: false,
      };
    }

    if (!engine.handlePointerDown(event)) {
      return {
        reason: "calendar-interaction-engine-busy",
        shouldOwn: false,
      };
    }

    onPointerDownAccepted?.();

    return {
      reason: getSavedEventOwnershipReason(target.type),
      shouldOwn: true,
    };
  }

  function handlePointerMove(event: PointerEvent) {
    const isOwnedPointer = ownsPointer(event);

    engine.handlePointerMove(event);

    return isOwnedPointer;
  }

  function handlePointerUp(event: PointerEvent) {
    const isOwnedPointer = ownsPointer(event);
    const result = engine.handlePointerUp(event);

    if (!result) {
      return isOwnedPointer;
    }

    const currentRuntime = runtime();

    if (result.type === "click") {
      if (isViewAllDayTarget(result.target)) {
        currentRuntime.onClickAllDayEvent?.(result.target.event);
      } else {
        currentRuntime.onClickTimedEvent(result.target.event);
      }

      onPointerClickSettled?.();

      return isOwnedPointer;
    }

    if (result.result.type === "allDayDragEnd") {
      currentRuntime.onCommitAllDayDrag?.(result.result);
      return isOwnedPointer;
    }

    if (result.result.type === "allDayResizeEnd") {
      currentRuntime.onCommitAllDayResize?.(result.result);
      return isOwnedPointer;
    }

    if (result.result.type === "timedDragEnd") {
      currentRuntime.onCommitTimedDrag(result.result);
      return isOwnedPointer;
    }

    currentRuntime.onCommitTimedResize?.(result.result);

    return isOwnedPointer;
  }

  function handlePointerCancel(event: PointerEvent) {
    const isOwnedPointer = ownsPointer(event);

    engine.handlePointerCancel(event);

    return isOwnedPointer;
  }

  function cancel() {
    engine.cancel();
  }

  return {
    adapter: {
      cancel,
      connectCancellationEvents,
      handlePointerCancel,
      handlePointerDown,
      handlePointerMove,
      handlePointerUp,
      ownsPointer,
    },
    engine,
    getInteractionTarget,
  };
};
