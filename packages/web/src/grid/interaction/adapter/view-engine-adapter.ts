import { type InteractionAdapter } from "@web/interaction/interaction.adapter.types";
import { getSavedEventInteractionCursor } from "../adapter.helpers";
import { createDraftEventMount } from "../dom";
import { type ViewRegisteredEventTarget } from "../view-event-registry";
import { type ViewInteractionTarget } from "./view-interaction.adapter.types";
import { isViewDragTarget } from "./view-target-resolution";

/**
 * The engine-facing adapter, assembled once for both views.
 *
 * Six of the eight members were byte-identical across Week and Day. The two
 * that genuinely differ — `createVisual` and `updateVisual` — are injected as
 * opaque closures and are NOT merged: Week routes through a cross-row layout
 * cache with edge navigation and all-day-row scroll suppression, while Day
 * computes calendar column keys and calls the grid math directly. Merging them
 * would be the mistake this refactor exists to avoid.
 */

interface ViewEngineAdapterHooks<TTarget, TVisual, TResult> {
  /**
   * Runs the view's own four-branch target/visual dispatch and throws the
   * view's own error message on a mismatched pair.
   */
  commitDispatch: (input: { target: TTarget; visual: TVisual }) => TResult;
  createVisual: InteractionAdapter<TTarget, TVisual, TResult>["createVisual"];
  /** Drops the cached layout and scroll offset. */
  clearLayoutState: () => void;
  /**
   * Anything else the view unwinds when an interaction ends — Week clears its
   * motion flag and resets the edge-navigation indicator; Day has neither and
   * passes a no-op. Declared as an opaque callback on purpose: it is what keeps
   * this module from ever naming Week's edge-navigation store, and therefore
   * what structurally guarantees the shared layer adds no writer to it.
   */
  onInteractionSettled: () => void;
  getTarget: InteractionAdapter<TTarget, TVisual, TResult>["getTarget"];
  updateVisual: InteractionAdapter<TTarget, TVisual, TResult>["updateVisual"];
}

export const createViewEngineAdapter = <
  TRegistered extends ViewRegisteredEventTarget,
  TVisual,
  TResult,
>({
  commitDispatch,
  createVisual,
  clearLayoutState,
  onInteractionSettled,
  getTarget,
  updateVisual,
}: ViewEngineAdapterHooks<
  ViewInteractionTarget<TRegistered>,
  TVisual,
  TResult
>): InteractionAdapter<
  ViewInteractionTarget<TRegistered>,
  TVisual,
  TResult
> => ({
  cancel: () => {
    clearLayoutState();
    onInteractionSettled();
  },
  commit: ({ target, visual }) => {
    // Ordering is deliberate and load-bearing: the dispatch runs FIRST, so a
    // mismatched target/visual pair throws before any cleanup happens. Both
    // views behaved this way before the hoist, leaving the session state
    // intact for the caller to inspect rather than silently unwinding it.
    //
    // The throw is defensive: the engine builds each visual from its session's
    // own target and commits that same pair, so a mismatch is unreachable
    // through the public API. That is precisely why nothing tests it, and why
    // the ordering has to be protected by reading rather than by a test.
    const result = commitDispatch({ target, visual });

    clearLayoutState();
    onInteractionSettled();

    return result;
  },
  createVisual,
  getDraftEventMount: ({ sourceElement, target }) =>
    createDraftEventMount({
      cursor: getSavedEventInteractionCursor(target.type),
      source: sourceElement,
    }),
  getSourceElement: (target) => target.registered.element,
  getSourceElementDraftEventMode: (target) =>
    isViewDragTarget(target) ? "dim-source" : "hide-source",
  getTarget,
  updateVisual,
});
