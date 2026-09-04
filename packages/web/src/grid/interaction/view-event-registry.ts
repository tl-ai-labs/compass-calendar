import {
  createEventRegistry,
  type EventRegistry,
  type RegisteredEventTarget,
} from "@web/grid/interaction/event.registry";
import { useEventRegistrationRef } from "@web/grid/interaction/use-event-registration-ref";

export type ViewInteractionEventType = "all-day" | "timed";

const isViewInteractionEventType = (
  value: string | null,
): value is ViewInteractionEventType =>
  value === "all-day" || value === "timed";

declare const VIEW_BRAND: unique symbol;

/**
 * A DOM node resolved by one view's interaction registry.
 *
 * The `TView` parameter is a **phantom** tag: it is never written, never read,
 * and erases at compile time. It exists because Week and Day targets were
 * previously bare aliases of one shared type, which meant a shared adapter
 * method instantiated for Day would silently accept a Week target — the very
 * cross-view mistake the shared layer is supposed to make impossible.
 * `{[VIEW_BRAND]?: "week"}` is not assignable to `{[VIEW_BRAND]?: "day"}` in
 * either direction, so that mistake is now a compile error.
 *
 * Note this is the *inverse* of an optional field that makes one view look
 * capable of another's behaviour: it carries no behaviour at all, and its only
 * effect is to keep the two views apart.
 *
 * The property is optional so the raw `createEventRegistry` output — a plain
 * object that has no such key — stays assignable to both instantiations. That
 * is the single widening point; see `getRegisteredTarget` in the shared
 * target-resolution module for the one cast that uses it.
 */
export type ViewRegisteredEventTarget<TView extends string = string> =
  RegisteredEventTarget<ViewInteractionEventType> & {
    readonly [VIEW_BRAND]?: TView;
  };

/**
 * A view's interaction registry, carrying the same phantom view tag as its
 * registered targets.
 *
 * The tag exists so that a registry and a registered-target type cannot be
 * paired across views. Without it `weekEventRegistry` and `dayEventRegistry`
 * are the same type, and the shared adapter root would happily accept Day's
 * registry while branding everything it resolves as Week.
 */
export type ViewEventRegistry<TView extends string = string> =
  EventRegistry<ViewInteractionEventType> & {
    readonly [VIEW_BRAND]?: TView;
  };

/**
 * The `data-${viewName}-interaction-event-*` attribute names alone, with no
 * registry attached - for call sites (like stripping these attributes off a
 * cloned draft-event node) that need the naming scheme but have no reason to
 * instantiate a registry.
 */
export const viewInteractionAttributeNames = (viewName: string) => ({
  idAttribute: `data-${viewName}-interaction-event-id`,
  typeAttribute: `data-${viewName}-interaction-event-type`,
});

/**
 * Day and Week are sibling routes and never co-mounted, so a DOM query can
 * safely accept either view's id attribute. Used by context menus, undo
 * focus-restore, and other callers that need an event id without knowing
 * which view rendered the card.
 */
export const CALENDAR_VIEW_INTERACTION_ID_ATTRIBUTES = [
  viewInteractionAttributeNames("day").idAttribute,
  viewInteractionAttributeNames("week").idAttribute,
] as const;

export const calendarEventIdElementSelector = () =>
  CALENDAR_VIEW_INTERACTION_ID_ATTRIBUTES.map((attr) => `[${attr}]`).join(", ");

export const calendarEventIdValueSelector = (eventId: string) =>
  CALENDAR_VIEW_INTERACTION_ID_ATTRIBUTES.map(
    (attr) => `[${attr}="${eventId}"]`,
  ).join(", ");

export const readCalendarEventIdFromElement = (
  element: HTMLElement,
): string | null => {
  const eventElement = element.closest(calendarEventIdElementSelector());
  if (!eventElement) {
    return null;
  }

  for (const attr of CALENDAR_VIEW_INTERACTION_ID_ATTRIBUTES) {
    const eventId = eventElement.getAttribute(attr);
    if (eventId) {
      return eventId;
    }
  }

  return null;
};

/**
 * One interaction registry per calendar view (Day, Week), namespaced by
 * `data-${viewName}-interaction-event-*` attributes so a view only ever
 * resolves its own DOM nodes. Day and Week previously hand-rolled identical
 * copies of this wiring; this factory is the single source of it.
 */
export const createViewInteractionRegistry = <TView extends string>(
  viewName: TView,
) => {
  const { idAttribute, typeAttribute } =
    viewInteractionAttributeNames(viewName);

  const createRegistry = (): ViewEventRegistry<TView> =>
    createEventRegistry<ViewInteractionEventType>({
      eventIdAttribute: idAttribute,
      eventTypeAttribute: typeAttribute,
      isEventType: isViewInteractionEventType,
    });

  const getInteractionTargetAttributes = ({
    eventId,
    eventType,
  }: {
    eventId: string | undefined;
    eventType: ViewInteractionEventType;
  }) => {
    if (!eventId) {
      return {};
    }

    return {
      [idAttribute]: eventId,
      [typeAttribute]: eventType,
    };
  };

  const registry = createRegistry();

  const useRegistrationRef = ({
    eventId,
    eventType,
    isEnabled,
  }: {
    eventId: string | undefined;
    eventType: ViewInteractionEventType;
    isEnabled: boolean;
  }) =>
    useEventRegistrationRef({
      eventId,
      eventType,
      isEnabled,
      registry,
    });

  return {
    idAttribute,
    typeAttribute,
    createRegistry,
    registry,
    getInteractionTargetAttributes,
    useRegistrationRef,
  };
};
