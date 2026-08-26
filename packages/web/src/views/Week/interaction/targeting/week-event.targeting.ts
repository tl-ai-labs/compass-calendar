import { type GridEventTarget as SharedGridEventTarget } from "@web/grid/interaction/event.targeting";
import { VIEW_INTERACTION_MODULES } from "@web/grid/interaction/view-interaction.module";
import { type WeekInteractionEventType } from "@web/views/Week/interaction/registry/week-event.registry";

export type WeekGridEventTargetType = WeekInteractionEventType;

export type WeekGridEventTarget =
  SharedGridEventTarget<WeekGridEventTargetType>;

const weekGridEventTargeting = VIEW_INTERACTION_MODULES.week.targeting;

export const getFocusedWeekGridEventTarget =
  weekGridEventTargeting.getFocusedGridEventTarget;

export const getFirstVisibleWeekGridEventTarget =
  weekGridEventTargeting.getFirstVisibleGridEventTarget;

export const listVisibleWeekGridEventTargets =
  weekGridEventTargeting.listVisibleGridEventTargets;

export const focusWeekGridEventTarget =
  weekGridEventTargeting.focusGridEventTarget;
