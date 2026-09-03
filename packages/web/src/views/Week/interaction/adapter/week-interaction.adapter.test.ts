import { Origin } from "@core/constants/core.constants";
import {
  ID_GRID_COLUMNS_TIMED,
  ID_GRID_MAIN,
} from "@web/common/constants/web.constants";
import { type GridEvent } from "@web/common/types/web.event.types";
import { gridEventDefaultPosition } from "@web/common/utils/event/event.util";
import { weekEventRegistry } from "@web/views/Week/interaction/registry/week-event.registry";
import { createWeekInteractionAdapter } from "./week-interaction.adapter";
import { afterEach, describe, expect, it } from "bun:test";

const pointerEvent = () =>
  new PointerEvent("pointerdown", {
    button: 0,
    isPrimary: true,
    pointerId: 1,
  });

describe("WeekInteractionAdapter", () => {
  it("refuses pointer ownership when no Week event target is registered", () => {
    const adapter = createWeekInteractionAdapter();

    expect(adapter.handlePointerDown(pointerEvent())).toEqual({
      reason: "no-week-interaction-target",
      shouldOwn: false,
    });
  });
});

// AC-3 layer 1: the pointer path.
//
// The join control is an anchor rendered as a sibling of the card. It can only
// receive its own click if this adapter declines to own the pointerdown --
// PointerCaptureBoundary subscribes onPointerDownCapture on an ANCESTOR of the
// cards and calls preventDefault() + stopPropagation() the moment the adapter
// claims the pointer, and capture on an ancestor always precedes the target
// phase, so the anchor cannot defend itself downstream.
//
// These assert the differential deliberately: an adapter that declined every
// pointer would also satisfy a bare "join control is not owned" assertion, so
// each block pairs the bail with a card-body pointerdown that must still be
// owned.
describe("WeekInteractionAdapter join control (AC-3)", () => {
  const timedEvent = {
    _id: "timed-event",
    endDate: "2026-05-19T10:00:00.000",
    isAllDay: false,
    origin: Origin.COMPASS,
    position: gridEventDefaultPosition,
    startDate: "2026-05-19T09:00:00.000",
    title: "Timed event",
    user: "user-1",
  } as GridEvent;

  const setRect = (
    element: HTMLElement,
    rect: Pick<DOMRect, "height" | "left" | "top" | "width">,
  ) => {
    element.getBoundingClientRect = () =>
      ({
        ...rect,
        bottom: rect.top + rect.height,
        right: rect.left + rect.width,
        toJSON: () => ({}),
        x: rect.left,
        y: rect.top,
      }) as DOMRect;
  };

  const makePointerEvent = (target: EventTarget) => {
    const event = new PointerEvent("pointerdown", {
      button: 0,
      clientX: 345,
      clientY: 1050,
      isPrimary: true,
      pointerId: 1,
    });

    Object.defineProperty(event, "target", { value: target });

    return event;
  };

  // The adapter resolves a timed drag target against the live grid, so the
  // ID_GRID_MAIN / ID_GRID_COLUMNS_TIMED elements have to exist with rects.
  // Without them even a card-body pointerdown is unowned, and the differential
  // this suite depends on would be vacuous.
  const registerWithJoinControl = () => {
    const mainGrid = document.createElement("div");
    const columns = document.createElement("div");
    const source = document.createElement("div");
    const cardBody = document.createElement("span");
    const joinControl = document.createElement("a");
    const joinGlyph = document.createElement("span");

    mainGrid.id = ID_GRID_MAIN;
    columns.id = ID_GRID_COLUMNS_TIMED;
    source.style.visibility = "visible";
    joinControl.setAttribute("data-calendar-event-join-control", "true");

    joinControl.append(joinGlyph);
    source.append(cardBody, joinControl);
    mainGrid.append(columns, source);
    document.body.append(mainGrid);

    Object.defineProperty(mainGrid, "clientHeight", { value: 1300 });
    Object.defineProperty(mainGrid, "scrollHeight", { value: 2600 });

    setRect(mainGrid, { height: 1300, left: 50, top: 100, width: 750 });
    setRect(columns, { height: 2400, left: 100, top: 100, width: 700 });
    setRect(source, { height: 100, left: 300, top: 1000, width: 90 });

    weekEventRegistry.register({
      element: source,
      eventId: timedEvent._id!,
      eventType: "timed",
    });

    return { cardBody, joinControl, joinGlyph };
  };

  // The default adapter runtime is inert (getTimedEventById returns null), so a
  // card-body pointerdown would be unowned no matter what getInteractionTarget
  // did — which would make the differential below vacuous.
  const createAdapter = () =>
    createWeekInteractionAdapter({
      runtime: () => ({
        getTimedEventById: (eventId) =>
          eventId === timedEvent._id ? timedEvent : null,
        getVisibleDays: () => ["2026-05-19"],
        onClickTimedEvent: () => undefined,
        onCommitTimedDrag: () => undefined,
      }),
    });

  afterEach(() => {
    document.body.innerHTML = "";
    weekEventRegistry.clear();
  });

  it("declines pointer ownership on a join control, but keeps it on the card body", () => {
    const { cardBody, joinControl } = registerWithJoinControl();
    const adapter = createAdapter();

    expect(adapter.handlePointerDown(makePointerEvent(joinControl))).toEqual({
      reason: "no-week-interaction-target",
      shouldOwn: false,
    });

    expect(
      adapter.handlePointerDown(makePointerEvent(cardBody)).shouldOwn,
    ).toBe(true);
  });

  it("declines ownership when the pointer lands on the glyph inside the join control", () => {
    // The real pointer target is the child SVG, never the anchor itself, so the
    // adapter has to find the attribute via closest() rather than on the target.
    const { joinGlyph } = registerWithJoinControl();
    const adapter = createAdapter();

    expect(adapter.handlePointerDown(makePointerEvent(joinGlyph))).toEqual({
      reason: "no-week-interaction-target",
      shouldOwn: false,
    });
  });
});
