import {
  type InteractionCancellationTargets,
  type InteractionEngine,
} from "@web/interaction/interaction.engine";
import { isEligibleInteractionPointerDown } from "@web/interaction/interaction.pointer";
import { getSavedEventOwnershipReason } from "../adapter.helpers";
import { type ViewRegisteredEventTarget } from "../view-event-registry";
import {
  type ViewInteractionCommitResult,
  type ViewInteractionPointerOwnership,
  type ViewInteractionRuntime,
  type ViewInteractionTarget,
} from "./view-interaction.adapter.types";
import { isViewAllDayTarget } from "./view-target-resolution";

/**
 * The pointer surface both view adapters expose, assembled once.
 *
 * Week and Day carried the same seven handlers with the same control flow. The
 * only genuine differences are injected here:
 *
 * - the four ownership-refusal strings, which name the view;
 * - `onPointerDownOwned` / `onClickHandled`, which Week uses to drive its
 *   motion flag and Day leaves as no-ops.
 *
 * On the `runtime()` read in `handlePointerUp`: Week used to read it *inside*
 * the click branch and again after it, Day once before the branch. Those two
 * call sites in Week sat on mutually exclusive paths — the click branch
 * returns — so both views called `runtime()` exactly once per non-null result
 * and zero times when the engine returned nothing. The single read below is
 * therefore behaviour-preserving for both, including under a call-counting
 * spy, and no per-view strategy flag is needed.
 */

interface ViewPointerSessionOptions<TRegistered, TVisual> {
  engine: InteractionEngine<
    ViewInteractionTarget<TRegistered>,
    TVisual,
    ViewInteractionCommitResult
  >;
  getInteractionTarget: (
    event: PointerEvent,
  ) => ViewInteractionTarget<TRegistered> | null;
  /** e.g. "ineligible-week-pointer" */
  ineligibleReason: string;
  /** e.g. "no-week-interaction-target" */
  noTargetReason: string;
  /** Week: mark motion active. Day: nothing. */
  onPointerDownOwned?: () => void;
  /** Week: mark motion inactive after a click dispatch. Day: nothing. */
  onClickHandled?: () => void;
  runtime: () => ViewInteractionRuntime<TRegistered>;
}

export const createViewPointerSession = <
  TRegistered extends ViewRegisteredEventTarget<string>,
  TVisual,
>({
  engine,
  getInteractionTarget,
  ineligibleReason,
  noTargetReason,
  onPointerDownOwned = () => undefined,
  onClickHandled = () => undefined,
  runtime,
}: ViewPointerSessionOptions<TRegistered, TVisual>) => {
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
        reason: ineligibleReason,
        shouldOwn: false,
      };
    }

    const target = getInteractionTarget(event);

    if (!target) {
      return {
        reason: noTargetReason,
        shouldOwn: false,
      };
    }

    if (!engine.handlePointerDown(event)) {
      return {
        reason: "calendar-interaction-engine-busy",
        shouldOwn: false,
      };
    }

    // Fires only once the engine has accepted the pointer, never before.
    onPointerDownOwned();

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

      onClickHandled();

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
    cancel,
    connectCancellationEvents,
    handlePointerCancel,
    handlePointerDown,
    handlePointerMove,
    handlePointerUp,
    ownsPointer,
  };
};
