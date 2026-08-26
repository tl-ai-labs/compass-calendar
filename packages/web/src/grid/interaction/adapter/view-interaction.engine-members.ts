import { getSavedEventInteractionCursor } from "@web/grid/interaction/adapter.helpers";
import { createDraftEventMount } from "@web/grid/interaction/dom";
import {
  type FloatingDraftEventMount,
  type SourceElementDraftEventMode,
} from "@web/interaction/interaction.adapter.types";
import { isViewDragTarget } from "./view-interaction.targets";
import { type ViewInteractionTarget } from "./view-interaction.types";

/**
 * The three engine-adapter members that were byte-identical in both views.
 *
 * Exported as standalone named functions rather than as one spreadable object
 * on purpose: each view's engine-adapter object literal keeps its own
 * alphabetical key order, so Biome's formatting of those literals is unchanged
 * and the repo's format-after-edit hooks have nothing to rewrite.
 */

export const viewInteractionDraftEventMount = ({
  sourceElement,
  target,
}: {
  sourceElement: HTMLElement;
  target: ViewInteractionTarget;
}): FloatingDraftEventMount =>
  createDraftEventMount({
    cursor: getSavedEventInteractionCursor(target.type),
    source: sourceElement,
  });

export const getViewInteractionSourceElement = (
  target: ViewInteractionTarget,
): HTMLElement => target.registered.element;

export const getViewInteractionDraftEventMode = (
  target: ViewInteractionTarget,
): SourceElementDraftEventMode =>
  isViewDragTarget(target) ? "dim-source" : "hide-source";
