import {
  calendarEventIdElementSelector,
  calendarEventIdValueSelector,
  createViewInteractionRegistry,
  readCalendarEventIdFromElement,
  viewInteractionAttributeNames,
} from "./view-event-registry";
import { afterEach, describe, expect, it } from "bun:test";

afterEach(() => {
  document.body.innerHTML = "";
});

describe("calendar event id DOM helpers", () => {
  it("reads a day or week interaction id from an element or its ancestor", () => {
    const weekCard = document.createElement("div");
    weekCard.setAttribute("data-week-interaction-event-id", "week-event");
    const child = document.createElement("span");
    weekCard.append(child);
    document.body.append(weekCard);

    expect(readCalendarEventIdFromElement(child)).toBe("week-event");
    expect(calendarEventIdElementSelector()).toContain(
      "data-day-interaction-event-id",
    );
    expect(calendarEventIdValueSelector("week-event")).toContain(
      '[data-week-interaction-event-id="week-event"]',
    );
  });
});

describe("createViewInteractionRegistry", () => {
  it("namespaces the id/type attributes by view name", () => {
    const day = createViewInteractionRegistry("day");
    const week = createViewInteractionRegistry("week");

    expect(day.idAttribute).toBe("data-day-interaction-event-id");
    expect(day.typeAttribute).toBe("data-day-interaction-event-type");
    expect(week.idAttribute).toBe("data-week-interaction-event-id");
    expect(week.typeAttribute).toBe("data-week-interaction-event-type");
  });

  it("keeps each view's registry from resolving the other view's elements", () => {
    const day = createViewInteractionRegistry("day");
    const week = createViewInteractionRegistry("week");

    const dayEl = document.body.appendChild(document.createElement("div"));
    const weekEl = document.body.appendChild(document.createElement("div"));

    day.registry.register({
      element: dayEl,
      eventId: "shared-id",
      eventType: "timed",
    });
    week.registry.register({
      element: weekEl,
      eventId: "shared-id",
      eventType: "timed",
    });

    expect(day.registry.resolve("shared-id", "timed")).toBe(dayEl);
    expect(week.registry.resolve("shared-id", "timed")).toBe(weekEl);
    expect(dayEl.hasAttribute(week.idAttribute)).toBe(false);
    expect(weekEl.hasAttribute(day.idAttribute)).toBe(false);
  });

  it("getInteractionTargetAttributes returns nothing for an undefined eventId", () => {
    const day = createViewInteractionRegistry("day");

    expect(
      day.getInteractionTargetAttributes({
        eventId: undefined,
        eventType: "timed",
      }),
    ).toEqual({});
  });

  it("getInteractionTargetAttributes stamps both attributes for a defined eventId", () => {
    const day = createViewInteractionRegistry("day");

    expect(
      day.getInteractionTargetAttributes({
        eventId: "event-1",
        eventType: "all-day",
      }),
    ).toEqual({
      "data-day-interaction-event-id": "event-1",
      "data-day-interaction-event-type": "all-day",
    });
  });

  it("createRegistry produces a fresh, independent registry each call", () => {
    const day = createViewInteractionRegistry("day");
    const isolated = day.createRegistry();

    const el = document.body.appendChild(document.createElement("div"));
    isolated.register({ element: el, eventId: "isolated", eventType: "timed" });

    expect(isolated.resolve("isolated", "timed")).toBe(el);
    expect(day.registry.resolve("isolated", "timed")).toBeNull();
  });

  // INV-6. Context menus and undo focus-restore read event ids through this
  // resolver without knowing which view rendered the card. If resolution ever
  // became view-specific — or an attribute were renamed, or moved to a
  // different element — those features would break at runtime with no
  // compile error, so the view-agnostic contract is asserted directly here
  // for BOTH views rather than left implied by the Week-only cases above.
  // The attribute names are written out in full rather than derived from
  // `viewInteractionAttributeNames`. Deriving them would make this vacuous:
  // the selector under test is built from that same function, so a rename
  // would move both sides together and the assertion could never fail.
  it.each([
    ["week", "data-week-interaction-event-id"],
    ["day", "data-day-interaction-event-id"],
  ])("resolves an event id view-agnostically from the %s attribute scheme", (viewName, idAttribute) => {
    // Belt-and-braces: the literal above must also be what the generator
    // produces, so a rename fails here instead of silently passing.
    expect(viewInteractionAttributeNames(viewName).idAttribute).toBe(
      idAttribute,
    );
    const card = document.body.appendChild(document.createElement("div"));
    const descendant = card.appendChild(document.createElement("span"));

    card.setAttribute(idAttribute, "event-42");

    // Resolves from the element itself and from a nested descendant, since
    // real callers hand in whatever the pointer/focus landed on.
    expect(readCalendarEventIdFromElement(card)).toBe("event-42");
    expect(readCalendarEventIdFromElement(descendant)).toBe("event-42");
    expect(card.matches(calendarEventIdElementSelector())).toBe(true);
    expect(card.matches(calendarEventIdValueSelector("event-42"))).toBe(true);
  });
});
