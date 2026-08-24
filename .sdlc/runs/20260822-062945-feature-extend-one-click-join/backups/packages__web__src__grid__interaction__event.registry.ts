/**
 * Marks a subtree of an event card as "not a drag/click target for the grid".
 *
 * The interaction engine resolves its target by walking up from the pointer's
 * `event.target` with `closest()`, so *any* descendant of a card — including a
 * real interactive control like the join button — otherwise resolves to the
 * card and opens a pending session, which pointerup turns into a synthetic
 * "click" that opens the event form.
 *
 * A descendant cannot opt out by stopping propagation on its own handlers:
 * `PointerCaptureBoundary` binds `onPointerDownCapture` on an *ancestor* and
 * calls `preventDefault()` + `stopPropagation()` during the capture phase, so
 * the descendant's handlers never run at all. This attribute is the only
 * available opt-out, and it is honored here — the single choke point both the
 * Week and Day registries funnel through.
 */
export const EVENT_INTERACTION_IGNORE_ATTRIBUTE =
  "data-calendar-event-interaction-ignore";

export interface RegisteredEventTarget<TType extends string> {
  element: HTMLElement;
  eventId: string;
  eventType: TType;
}

export interface EventRegistry<TType extends string> {
  clear(): void;
  register(registration: RegisteredEventTarget<TType>): () => void;
  resolve(eventId: string, eventType: TType): HTMLElement | null;
  resolveFromTarget(
    target: EventTarget | null,
  ): RegisteredEventTarget<TType> | null;
}

export interface EventRegistryOptions<TType extends string> {
  eventIdAttribute: string;
  eventTypeAttribute: string;
  isEventType: (value: string | null) => value is TType;
}

export const createEventRegistry = <TType extends string>({
  eventIdAttribute,
  eventTypeAttribute,
  isEventType,
}: EventRegistryOptions<TType>): EventRegistry<TType> => {
  const events = new Map<string, RegisteredEventTarget<TType>>();
  const getRegistryKey = (eventId: string, eventType: TType) =>
    `${eventType}:${eventId}`;

  const isRegistrationCurrent = ({
    element,
    eventId,
    eventType,
  }: RegisteredEventTarget<TType>) =>
    element.isConnected &&
    element.getAttribute(eventIdAttribute) === eventId &&
    element.getAttribute(eventTypeAttribute) === eventType;

  const resolve = (eventId: string, eventType: TType) => {
    const key = getRegistryKey(eventId, eventType);
    const registration = events.get(key);

    if (!registration) {
      return null;
    }

    if (!isRegistrationCurrent(registration)) {
      events.delete(key);
      return null;
    }

    return registration.element;
  };

  return {
    clear: () => events.clear(),
    register: ({ element, eventId, eventType }) => {
      element.setAttribute(eventIdAttribute, eventId);
      element.setAttribute(eventTypeAttribute, eventType);

      const key = getRegistryKey(eventId, eventType);

      events.set(key, {
        element,
        eventId,
        eventType,
      });

      return () => {
        const current = events.get(key);

        if (current?.element === element) {
          events.delete(key);
        }
      };
    },
    resolve,
    resolveFromTarget: (target) => {
      if (!(target instanceof Element)) {
        return null;
      }

      const element = target.closest<HTMLElement>(
        `[${eventIdAttribute}][${eventTypeAttribute}]`,
      );

      if (!element) {
        return null;
      }

      // Scoped to this card deliberately: an ignore marker somewhere else in
      // the ancestor chain (an unrelated wrapper above the card) must not
      // disable interaction for the card itself.
      const ignored = target.closest<HTMLElement>(
        `[${EVENT_INTERACTION_IGNORE_ATTRIBUTE}]`,
      );

      if (ignored && element.contains(ignored)) {
        return null;
      }

      const eventId = element.getAttribute(eventIdAttribute);
      const eventType = element.getAttribute(eventTypeAttribute);

      if (!eventId || !isEventType(eventType)) {
        return null;
      }

      const registeredElement = resolve(eventId, eventType);

      if (registeredElement !== element) {
        return null;
      }

      return {
        element: registeredElement,
        eventId,
        eventType,
      };
    },
  };
};
