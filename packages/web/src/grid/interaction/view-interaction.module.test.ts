import { dayEventRegistry } from "@web/views/Day/interaction/registry/day-event.registry";
import { weekEventRegistry } from "@web/views/Week/interaction/registry/week-event.registry";
import { VIEW_INTERACTION_MODULES } from "./view-interaction.module";
import { afterEach, describe, expect, it } from "bun:test";

afterEach(() => {
  // These suites register into the process-wide shared instances, so the
  // registries must be cleared as well as the DOM or state leaks across files.
  document.body.innerHTML = "";
  VIEW_INTERACTION_MODULES.week.registry.clear();
  VIEW_INTERACTION_MODULES.day.registry.clear();
});

describe("VIEW_INTERACTION_MODULES", () => {
  it("routes the view shells' exports to the same instance the module holds", () => {
    // The invariant that matters is not "the property is stable" — that is a
    // frozen data property and cannot vary. It is that the registry the event
    // cards register into (re-exported as `weekEventRegistry`) is the same
    // object targeting resolves out of. If the shells ever call
    // `createViewInteractionRegistry` again, or the module hands out a fresh
    // registry, this fails and focus/keyboard targeting breaks at runtime.
    expect(weekEventRegistry).toBe(VIEW_INTERACTION_MODULES.week.registry);
    expect(dayEventRegistry).toBe(VIEW_INTERACTION_MODULES.day.registry);
  });

  it("keeps the two views' registries separate", () => {
    expect(VIEW_INTERACTION_MODULES.week.registry).not.toBe(
      VIEW_INTERACTION_MODULES.day.registry,
    );
  });

  it("does not let a registration in one view resolve in the other", () => {
    const element = document.createElement("div");
    document.body.append(element);
    VIEW_INTERACTION_MODULES.week.registry.register({
      element,
      eventId: "event-1",
      eventType: "timed",
    });

    expect(
      VIEW_INTERACTION_MODULES.week.registry.resolve("event-1", "timed"),
    ).toBeTruthy();
    expect(
      VIEW_INTERACTION_MODULES.day.registry.resolve("event-1", "timed"),
    ).toBeNull();
  });

  it("emits the exact DOM attribute names the e2e specs match on", () => {
    // Written as literals on purpose. Deriving them from the module under test
    // would make this assertion tautological, and these four strings are a
    // published contract: e2e/timed/move-event-reduced-days.spec.ts and
    // e2e/calendars/calendar-experience.spec.ts hard-code them, and
    // `bun test:web` does not run those specs.
    expect(VIEW_INTERACTION_MODULES.week.idAttribute).toBe(
      "data-week-interaction-event-id",
    );
    expect(VIEW_INTERACTION_MODULES.week.typeAttribute).toBe(
      "data-week-interaction-event-type",
    );
    expect(VIEW_INTERACTION_MODULES.day.idAttribute).toBe(
      "data-day-interaction-event-id",
    );
    expect(VIEW_INTERACTION_MODULES.day.typeAttribute).toBe(
      "data-day-interaction-event-type",
    );
  });

  it("builds each view's target selector from that view's own attributes", () => {
    expect(VIEW_INTERACTION_MODULES.week.targetSelector).toBe(
      "[data-week-interaction-event-id][data-week-interaction-event-type]",
    );
    expect(VIEW_INTERACTION_MODULES.day.targetSelector).toBe(
      "[data-day-interaction-event-id][data-day-interaction-event-type]",
    );
  });

  it("resolves through targeting against the shared registry instance", () => {
    // The end-to-end version of the identity invariant: register via the
    // module's registry, then find it via the module's targeting helpers.
    // These fail if targeting were ever bound to a different instance.
    const element = document.createElement("div");
    element.setAttribute("data-week-interaction-event-id", "event-1");
    element.setAttribute("data-week-interaction-event-type", "timed");
    element.getClientRects = () =>
      [{ height: 10, width: 10 }] as unknown as DOMRectList;
    document.body.append(element);
    VIEW_INTERACTION_MODULES.week.registry.register({
      element,
      eventId: "event-1",
      eventType: "timed",
    });

    const targets =
      VIEW_INTERACTION_MODULES.week.targeting.listVisibleGridEventTargets();

    expect(targets).toHaveLength(1);
    expect(targets[0]?.eventId).toBe("event-1");
  });

  it("mints an isolated registry via createRegistry without touching the shared one", () => {
    // createWeekEventRegistry() is re-exported from this and used by tests to
    // get a registry that is not the shared instance. That is allowed; what is
    // not allowed is a second *module*.
    const isolated = VIEW_INTERACTION_MODULES.week.createRegistry();

    expect(isolated).not.toBe(VIEW_INTERACTION_MODULES.week.registry);
  });
});
