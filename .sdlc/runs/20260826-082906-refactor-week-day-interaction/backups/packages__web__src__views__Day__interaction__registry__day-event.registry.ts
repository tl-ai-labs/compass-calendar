import {
  type ViewEventRegistry,
  type ViewInteractionEventType,
  type ViewRegisteredEventTarget,
} from "@web/grid/interaction/view-interaction.bindings";
import { dayInteractionBindings } from "@web/views/Day/interaction/day-interaction.bindings";

/**
 * Day-prefixed view of the shared interaction bindings. Every export name and
 * this file's path are unchanged; see the Week counterpart for the rationale.
 */

export const DAY_INTERACTION_EVENT_ID_ATTRIBUTE =
  dayInteractionBindings.idAttribute;
export const DAY_INTERACTION_EVENT_TYPE_ATTRIBUTE =
  dayInteractionBindings.typeAttribute;

export type DayInteractionEventType = ViewInteractionEventType;
export type DayRegisteredEventTarget = ViewRegisteredEventTarget;
export type DayEventRegistry = ViewEventRegistry;

export const getDayInteractionTargetAttributes =
  dayInteractionBindings.getInteractionTargetAttributes;

export const createDayEventRegistry = dayInteractionBindings.createRegistry;

export const dayEventRegistry = dayInteractionBindings.registry;

export const useDayEventRegistrationRef =
  dayInteractionBindings.useRegistrationRef;
