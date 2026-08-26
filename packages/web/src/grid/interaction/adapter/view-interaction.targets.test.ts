import { type GridEvent } from "@web/common/types/web.event.types";
import { EVENT_RESIZE_HANDLE_ATTRIBUTE } from "@web/grid/interaction/dom";
import { createViewInteractionRegistry } from "@web/grid/interaction/view-event-registry";
import {
  createViewInteractionTargetResolver,
  isViewAllDayTarget,
  isViewDragTarget,
} from "./view-interaction.targets";
import { type ViewInteractionRuntimeBase } from "./view-interaction.types";
import { afterEach, describe, expect, it } from "bun:test";

const { createRegistry, idAttribute, typeAttribute } =
  createViewInteractionRegistry("week");

const timedEvent = {
  _id: "timed-1",
  calendarId: "cal-1",
  endDate: "2026-08-26T11:00:00",
  isAllDay: false,
  startDate: "2026-08-26T10:00:00",
  title: "Timed",
} as unknown as GridEvent;

const allDayEvent = {
  _id: "all-day-1",
  calendarId: "cal-1",
  endDate: "2026-08-27",
  isAllDay: true,
  startDate: "2026-08-26",
  title: "All day",
} as unknown as GridEvent;

const mountCard = (eventId: string, eventType: "all-day" | "timed") => {
  const element = document.createElement("div");
  element.setAttribute(idAttribute, eventId);
  element.setAttribute(typeAttribute, eventType);
  document.body.append(element);
  return element;
};

const pointerEventOn = (
  element: HTMLElement,
  resizeEdge?: "endDate" | "startDate",
) => {
  const target = resizeEdge
    ? (() => {
        const handle = document.createElement("div");
        handle.setAttribute(EVENT_RESIZE_HANDLE_ATTRIBUTE, resizeEdge);
        element.append(handle);
        return handle;
      })()
    : element;

  return { target } as unknown as PointerEvent;
};

const baseRuntime: ViewInteractionRuntimeBase = {
  getAllDayEventById: () => allDayEvent,
  getTimedEventById: () => timedEvent,
  onClickTimedEvent: () => undefined,
  onCommitTimedDrag: () => undefined,
};

const buildResolver = (runtime: () => ViewInteractionRuntimeBase) => {
  const registry = createRegistry();
  const resolver = createViewInteractionTargetResolver({ registry, runtime });
  return { registry, ...resolver };
};

afterEach(() => {
  document.body.innerHTML = "";
});

describe("createViewInteractionTargetResolver", () => {
  it("prefers a resize handle over a drag on the same card", () => {
    const { getInteractionTarget, registry } = buildResolver(() => baseRuntime);
    const element = mountCard("timed-1", "timed");
    registry.register({ element, eventId: "timed-1", eventType: "timed" });

    expect(getInteractionTarget(pointerEventOn(element))?.type).toBe(
      "timedDrag",
    );
    expect(getInteractionTarget(pointerEventOn(element, "endDate"))?.type).toBe(
      "timedResize",
    );
  });

  it("rejects a card whose event disagrees with the registered event type", () => {
    // A card registered as all-day whose event says isAllDay: false is a
    // render/registry desync. Resolving it would drag a timed event with
    // all-day geometry.
    const { getInteractionTarget, registry } = buildResolver(() => ({
      ...baseRuntime,
      getAllDayEventById: () => timedEvent,
    }));
    const element = mountCard("timed-1", "all-day");
    registry.register({ element, eventId: "timed-1", eventType: "all-day" });

    expect(getInteractionTarget(pointerEventOn(element))).toBeNull();
  });

  it("rejects a timed card whose event is all-day", () => {
    const { getInteractionTarget, registry } = buildResolver(() => ({
      ...baseRuntime,
      getTimedEventById: () => allDayEvent,
    }));
    const element = mountCard("all-day-1", "timed");
    registry.register({ element, eventId: "all-day-1", eventType: "timed" });

    expect(getInteractionTarget(pointerEventOn(element))).toBeNull();
  });

  it("defaults hadFormOpenBeforeInteraction to false when isFormOpen is absent", () => {
    const { getInteractionTarget, registry } = buildResolver(() => baseRuntime);
    const element = mountCard("timed-1", "timed");
    registry.register({ element, eventId: "timed-1", eventType: "timed" });

    expect(
      getInteractionTarget(pointerEventOn(element))
        ?.hadFormOpenBeforeInteraction,
    ).toBe(false);
  });

  it("carries isFormOpen through when the runtime supplies it", () => {
    const { getInteractionTarget, registry } = buildResolver(() => ({
      ...baseRuntime,
      isFormOpen: () => true,
    }));
    const element = mountCard("timed-1", "timed");
    registry.register({ element, eventId: "timed-1", eventType: "timed" });

    expect(
      getInteractionTarget(pointerEventOn(element))
        ?.hadFormOpenBeforeInteraction,
    ).toBe(true);
  });

  it("re-reads the runtime on every call rather than capturing it", () => {
    // The runtime is backed by a React render; capturing it once would resolve
    // later pointer events against a stale event list.
    let calls = 0;
    const { getInteractionTarget, registry } = buildResolver(() => {
      calls += 1;
      return baseRuntime;
    });
    const element = mountCard("timed-1", "timed");
    registry.register({ element, eventId: "timed-1", eventType: "timed" });

    getInteractionTarget(pointerEventOn(element));
    const afterFirst = calls;
    getInteractionTarget(pointerEventOn(element));

    expect(afterFirst).toBeGreaterThan(0);
    expect(calls).toBeGreaterThan(afterFirst);
  });

  it("returns null when the pointer is not on a registered card", () => {
    const { getInteractionTarget } = buildResolver(() => baseRuntime);
    const stray = document.createElement("div");
    document.body.append(stray);

    expect(getInteractionTarget(pointerEventOn(stray))).toBeNull();
  });

  it("resolves an all-day card to an all-day drag", () => {
    const { getInteractionTarget, registry } = buildResolver(() => baseRuntime);
    const element = mountCard("all-day-1", "all-day");
    registry.register({ element, eventId: "all-day-1", eventType: "all-day" });

    expect(getInteractionTarget(pointerEventOn(element))?.type).toBe(
      "allDayDrag",
    );
    expect(
      getInteractionTarget(pointerEventOn(element, "startDate"))?.type,
    ).toBe("allDayResize");
  });
});

describe("view interaction target predicates", () => {
  it("classifies all-day targets", () => {
    expect(isViewAllDayTarget({ type: "allDayDrag" } as never)).toBe(true);
    expect(isViewAllDayTarget({ type: "allDayResize" } as never)).toBe(true);
    expect(isViewAllDayTarget({ type: "timedDrag" } as never)).toBe(false);
  });

  it("classifies drag targets", () => {
    expect(isViewDragTarget({ type: "allDayDrag" } as never)).toBe(true);
    expect(isViewDragTarget({ type: "timedDrag" } as never)).toBe(true);
    expect(isViewDragTarget({ type: "timedResize" } as never)).toBe(false);
  });
});
