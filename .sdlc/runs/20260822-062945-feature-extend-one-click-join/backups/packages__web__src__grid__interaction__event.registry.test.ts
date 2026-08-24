import {
  createEventRegistry,
  EVENT_INTERACTION_IGNORE_ATTRIBUTE,
} from "./event.registry";
import { afterEach, describe, expect, it } from "bun:test";

const EVENT_ID_ATTRIBUTE = "data-event-id";
const EVENT_TYPE_ATTRIBUTE = "data-event-type";
type EventType = "all-day" | "timed";

const createRegistry = () =>
  createEventRegistry<EventType>({
    eventIdAttribute: EVENT_ID_ATTRIBUTE,
    eventTypeAttribute: EVENT_TYPE_ATTRIBUTE,
    isEventType: (value): value is EventType =>
      value === "all-day" || value === "timed",
  });

const addEvent = () => {
  const element = document.createElement("button");
  const child = document.createElement("span");
  element.append(child);
  document.body.append(element);

  return { child, element };
};

afterEach(() => {
  document.body.innerHTML = "";
});

describe("event registry", () => {
  it("resolves a registered event from one of its descendants", () => {
    const registry = createRegistry();
    const { child, element } = addEvent();

    registry.register({ element, eventId: "event-1", eventType: "timed" });

    expect(registry.resolveFromTarget(child)).toEqual({
      element,
      eventId: "event-1",
      eventType: "timed",
    });
  });

  it("drops registrations whose element left the document", () => {
    const registry = createRegistry();
    const { element } = addEvent();

    registry.register({ element, eventId: "event-1", eventType: "timed" });
    element.remove();

    expect(registry.resolve("event-1", "timed")).toBeNull();
  });

  it("does not resolve a descendant marked as an interaction-ignore subtree", () => {
    // Regression for the one-click-join blocker: an interactive control inside
    // a card must not resolve to the card, or a pointerdown on it opens a
    // pending session that pointerup turns into a synthetic "click" and the
    // event form opens on top of the action the control performed.
    const registry = createRegistry();
    const { child, element } = addEvent();

    child.setAttribute(EVENT_INTERACTION_IGNORE_ATTRIBUTE, "true");
    registry.register({ element, eventId: "event-1", eventType: "timed" });

    expect(registry.resolveFromTarget(child)).toBeNull();
  });

  it("does not resolve a deeper descendant of an interaction-ignore subtree", () => {
    // The pointer's target is usually the glyph inside the button, not the
    // button itself, so the check has to walk up rather than test the target.
    const registry = createRegistry();
    const { child, element } = addEvent();
    const grandchild = document.createElement("svg");

    child.setAttribute(EVENT_INTERACTION_IGNORE_ATTRIBUTE, "true");
    child.append(grandchild);
    registry.register({ element, eventId: "event-1", eventType: "timed" });

    expect(registry.resolveFromTarget(grandchild)).toBeNull();
  });

  it("still resolves a descendant whose interaction-ignore marker is \"false\"", () => {
    // The marker is matched by value, not presence. React stringifies every
    // `data-*` prop, so a caller spreading a falsy flag renders
    // `data-...="false"`; under a presence selector that would read as an
    // opt-out and silently make the control's whole card inert. Opting out has
    // to be spelled "true".
    const registry = createRegistry();
    const { child, element } = addEvent();

    child.setAttribute(EVENT_INTERACTION_IGNORE_ATTRIBUTE, "false");
    registry.register({ element, eventId: "event-1", eventType: "timed" });

    expect(registry.resolveFromTarget(child)).toEqual({
      element,
      eventId: "event-1",
      eventType: "timed",
    });
  });

  it("still resolves a card wrapped in an unrelated interaction-ignore ancestor", () => {
    // The marker only opts out subtrees *inside* the card. A marker above the
    // card must not disable the card itself, or one stray wrapper could
    // silently make a whole column undraggable.
    const registry = createRegistry();
    const { child, element } = addEvent();
    const wrapper = document.createElement("div");

    wrapper.setAttribute(EVENT_INTERACTION_IGNORE_ATTRIBUTE, "true");
    document.body.append(wrapper);
    wrapper.append(element);
    registry.register({ element, eventId: "event-1", eventType: "timed" });

    expect(registry.resolveFromTarget(child)).toEqual({
      element,
      eventId: "event-1",
      eventType: "timed",
    });
  });

  it("does not let an old cleanup remove a replacement registration", () => {
    const registry = createRegistry();
    const first = addEvent().element;
    const second = addEvent().element;
    const unregisterFirst = registry.register({
      element: first,
      eventId: "event-1",
      eventType: "timed",
    });

    registry.register({
      element: second,
      eventId: "event-1",
      eventType: "timed",
    });
    unregisterFirst();

    expect(registry.resolve("event-1", "timed")).toBe(second);
  });
});
