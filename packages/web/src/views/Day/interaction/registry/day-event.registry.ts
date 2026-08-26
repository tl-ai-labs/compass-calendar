import {
  type ViewEventRegistry,
  type ViewInteractionEventType,
  type ViewRegisteredEventTarget,
} from "@web/grid/interaction/view-event-registry";
import { VIEW_INTERACTION_MODULES } from "@web/grid/interaction/view-interaction.module";

const day = VIEW_INTERACTION_MODULES.day;

export const DAY_INTERACTION_EVENT_ID_ATTRIBUTE = day.idAttribute;
export const DAY_INTERACTION_EVENT_TYPE_ATTRIBUTE = day.typeAttribute;

export type DayInteractionEventType = ViewInteractionEventType;
export type DayRegisteredEventTarget = ViewRegisteredEventTarget;
export type DayEventRegistry = ViewEventRegistry;

export const getDayInteractionTargetAttributes =
  day.getInteractionTargetAttributes;

export const createDayEventRegistry = day.createRegistry;

export const dayEventRegistry = day.registry;

export const useDayEventRegistrationRef = day.useRegistrationRef;
