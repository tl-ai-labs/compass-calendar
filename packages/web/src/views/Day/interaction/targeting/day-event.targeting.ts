import { type GridEventTarget as SharedGridEventTarget } from "@web/grid/interaction/event.targeting";
import { VIEW_INTERACTION_MODULES } from "@web/grid/interaction/view-interaction.module";
import { type DayInteractionEventType } from "@web/views/Day/interaction/registry/day-event.registry";

export type DayGridEventTargetType = DayInteractionEventType;

export type DayGridEventTarget = SharedGridEventTarget<DayGridEventTargetType>;

const dayGridEventTargeting = VIEW_INTERACTION_MODULES.day.targeting;

export const getFocusedDayGridEventTarget =
  dayGridEventTargeting.getFocusedGridEventTarget;

export const getFirstVisibleDayGridEventTarget =
  dayGridEventTargeting.getFirstVisibleGridEventTarget;

export const listVisibleDayGridEventTargets =
  dayGridEventTargeting.listVisibleGridEventTargets;

export const focusDayGridEventTarget =
  dayGridEventTargeting.focusGridEventTarget;
