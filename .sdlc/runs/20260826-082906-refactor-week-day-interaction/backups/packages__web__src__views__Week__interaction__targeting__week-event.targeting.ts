import { type GridEventTarget as SharedGridEventTarget } from "@web/grid/interaction/event.targeting";
import { type ViewInteractionEventType } from "@web/grid/interaction/view-interaction.bindings";
import { weekInteractionBindings } from "@web/views/Week/interaction/week-interaction.bindings";

/**
 * Week-prefixed view of the shared targeting bindings. Path and export names
 * unchanged — `useWeekShortcutOwner.ts` imports four of these and needed no
 * edit.
 *
 * Imports from `week-interaction.bindings` directly, NOT from the registry
 * shim: both shims are leaves off the same bindings module, so neither can
 * see a half-initialised sibling at module-eval time.
 */

export type WeekGridEventTargetType = ViewInteractionEventType;

export type WeekGridEventTarget =
  SharedGridEventTarget<WeekGridEventTargetType>;

export const getFocusedWeekGridEventTarget =
  weekInteractionBindings.getFocusedGridEventTarget;

export const getFirstVisibleWeekGridEventTarget =
  weekInteractionBindings.getFirstVisibleGridEventTarget;

export const listVisibleWeekGridEventTargets =
  weekInteractionBindings.listVisibleGridEventTargets;

export const focusWeekGridEventTarget =
  weekInteractionBindings.focusGridEventTarget;
