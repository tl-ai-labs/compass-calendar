import { type GridEventTarget as SharedGridEventTarget } from "@web/grid/interaction/event.targeting";
import { type ViewInteractionEventType } from "@web/grid/interaction/view-interaction.bindings";
import { dayInteractionBindings } from "@web/views/Day/interaction/day-interaction.bindings";

/**
 * Day-prefixed view of the shared targeting bindings. Path and export names
 * unchanged — two files import from here, `useDayEventNudgeShortcuts.ts` and
 * `day-event.focus.ts`, and neither needed an edit. See the Week counterpart
 * for why this imports the bindings module rather than the registry shim.
 */

export type DayGridEventTargetType = ViewInteractionEventType;

export type DayGridEventTarget = SharedGridEventTarget<DayGridEventTargetType>;

export const getFocusedDayGridEventTarget =
  dayInteractionBindings.getFocusedGridEventTarget;

export const getFirstVisibleDayGridEventTarget =
  dayInteractionBindings.getFirstVisibleGridEventTarget;

export const listVisibleDayGridEventTargets =
  dayInteractionBindings.listVisibleGridEventTargets;

export const focusDayGridEventTarget =
  dayInteractionBindings.focusGridEventTarget;
