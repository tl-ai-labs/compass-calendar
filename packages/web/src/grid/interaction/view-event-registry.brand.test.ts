import { createEventRegistry } from "@web/grid/interaction/event.registry";
import { type ViewInteractionEventType } from "@web/grid/interaction/view-event-registry";
import { type DayRegisteredEventTarget } from "@web/views/Day/interaction/registry/day-event.registry";
import { type WeekRegisteredEventTarget } from "@web/views/Week/interaction/registry/week-event.registry";
import { describe, expect, it } from "bun:test";

const weekTarget = null as unknown as WeekRegisteredEventTarget;
const dayTarget = null as unknown as DayRegisteredEventTarget;

const raw = {
  element: null as unknown as HTMLElement,
  eventId: "e1",
  eventType: "timed" as ViewInteractionEventType,
};

const _asWeek: WeekRegisteredEventTarget = raw;
const _asDay: DayRegisteredEventTarget = raw;

describe("phantom view brand on ViewRegisteredEventTarget", () => {
  it("proves Week and Day brands are not assignable to each other", () => {
    // @ts-expect-error
    const _dayFromWeek: DayRegisteredEventTarget = weekTarget;

    // @ts-expect-error
    const _weekFromDay: WeekRegisteredEventTarget = dayTarget;
  });

  it("creates an event registry instance", () => {
    const registry = createEventRegistry<ViewInteractionEventType>({
      eventIdAttribute: "data-test-id",
      eventTypeAttribute: "data-test-type",
      isEventType: (value: string | null): value is ViewInteractionEventType =>
        value === "all-day" || value === "timed",
    });

    expect(typeof registry.resolveFromTarget).toBe("function");
    expect(typeof registry.register).toBe("function");
    expect(typeof registry.resolve).toBe("function");
    expect(typeof registry.clear).toBe("function");
  });
});
