import {
  type ViewEventRegistry,
  type ViewInteractionEventType,
  type ViewRegisteredEventTarget,
} from "@web/grid/interaction/view-interaction.bindings";
import { weekInteractionBindings } from "@web/views/Week/interaction/week-interaction.bindings";

/**
 * Week-prefixed view of the shared interaction bindings. Every export name and
 * this file's path are unchanged: **17 files** import from here — across
 * `views/Week/**`, `components/ContextMenu/`, `views/Forms/` and
 * `common/utils/event/` — and none of them needed an edit for the
 * shared-bindings refactor. That reach is the reason this shim exists.
 *
 * The attribute VALUES are unchanged too — they still come from
 * `viewInteractionAttributeNames("week")` — which matters because they are
 * rendered onto every event card and asserted by `MainGrid.test.tsx`.
 */

export const WEEK_INTERACTION_EVENT_ID_ATTRIBUTE =
  weekInteractionBindings.idAttribute;
export const WEEK_INTERACTION_EVENT_TYPE_ATTRIBUTE =
  weekInteractionBindings.typeAttribute;

export type WeekInteractionEventType = ViewInteractionEventType;
export type WeekRegisteredEventTarget = ViewRegisteredEventTarget;
export type WeekEventRegistry = ViewEventRegistry;

export const getWeekInteractionTargetAttributes =
  weekInteractionBindings.getInteractionTargetAttributes;

export const createWeekEventRegistry = weekInteractionBindings.createRegistry;

export const weekEventRegistry = weekInteractionBindings.registry;

export const useWeekEventRegistrationRef =
  weekInteractionBindings.useRegistrationRef;
