import { type GridEvent } from "@web/common/types/web.event.types";
import { type AllDayDragVisual } from "@web/grid/interaction/types/all-day-drag.types";
import { type TimedDragVisual } from "@web/grid/interaction/types/timed-drag.types";
import { type TimedResizeVisual } from "@web/grid/interaction/types/timed-resize.types";
import { commitAllDayDragInteraction } from "./interactions/all-day.drag";
import { commitTimedDragInteraction } from "./interactions/timed.drag";
import { commitTimedResizeInteraction } from "./interactions/timed.resize";
import {
  type WeekAllDayDragTarget,
  type WeekTimedDragTarget,
  type WeekTimedResizeTarget,
} from "./week-interaction.adapter.types";
import { describe, expect, it } from "bun:test";

/**
 * CHARACTERIZATION TESTS — pin CURRENT Week commit behavior.
 *
 * These exist because `change_plan.md` §6 rates R1 and R10 the highest-risk
 * items in the Week/Day interaction refactor, and NO existing test covered
 * either. They must pass against unmodified HEAD *before* the commit layer is
 * touched; a characterization test that only goes green after a refactor
 * documents the change instead of guarding against it.
 *
 * R1 — cross-row drops force `hasMoved: true` even onto the same day. If a
 * shared `hasMoved` predicate ever replaces the `isCrossRow || …` forcing,
 * the coordinator takes its `!hasMoved` branch and REOPENS the event instead
 * of saving the row change. That is user-visible data loss.
 *
 * R10 — Week's timed resize calls its mapper UNCONDITIONALLY, so a no-op
 * resize still yields a freshly-built event object. Day's equivalent is gated
 * and returns `target.event` by identity. Converging the two changes what
 * `openTimedEvent` receives and what `fastDeepEqual` compares downstream.
 */

const createEvent = (overrides: Partial<GridEvent> = {}): GridEvent =>
  ({
    _id: "evt-1",
    endDate: "2026-05-13T10:00:00.000",
    isAllDay: false,
    startDate: "2026-05-13T09:00:00.000",
    title: "Event",
    ...overrides,
  }) as GridEvent;

const createRegistered = (eventType: "all-day" | "timed") => ({
  element: document.createElement("div"),
  eventId: "evt-1",
  eventType,
});

describe("commitAllDayDragInteraction", () => {
  it("forces hasMoved and converts to a timed event on a same-day drop into the timed row", () => {
    const target: WeekAllDayDragTarget = {
      event: createEvent({ isAllDay: true }),
      hadFormOpenBeforeInteraction: false,
      registered: createRegistered("all-day"),
      type: "allDayDrag",
    };
    const visual: AllDayDragVisual = {
      crossRowSize: { height: 40, width: 100 },
      dayDate: "2026-05-13",
      dayIndex: 3,
      eventId: "evt-1",
      initialDayDate: "2026-05-13",
      initialDayIndex: 3,
      pointerStart: { x: 0, y: 0 },
      row: "timed",
      sourceRect: { height: 20, left: 400, top: 25, width: 100 },
      timedStartMinutes: 300,
      transform: { x: 0, y: 575 },
      type: "allDayDrag",
    };

    const result = commitAllDayDragInteraction(target, visual);

    expect(result.hasMoved).toBe(true);
    expect(result.event.isAllDay).toBe(false);
  });

  it("does not force hasMoved for a same-day in-row all-day drag", () => {
    const target: WeekAllDayDragTarget = {
      event: createEvent({ isAllDay: true }),
      hadFormOpenBeforeInteraction: false,
      registered: createRegistered("all-day"),
      type: "allDayDrag",
    };
    const visual: AllDayDragVisual = {
      crossRowSize: null,
      dayDate: "2026-05-13",
      dayIndex: 3,
      eventId: "evt-1",
      initialDayDate: "2026-05-13",
      initialDayIndex: 3,
      pointerStart: { x: 0, y: 0 },
      row: "allDay",
      sourceRect: { height: 20, left: 400, top: 25, width: 100 },
      timedStartMinutes: null,
      transform: { x: 0, y: 0 },
      type: "allDayDrag",
    };

    const result = commitAllDayDragInteraction(target, visual);

    expect(result.hasMoved).toBe(false);
  });
});

describe("commitTimedDragInteraction", () => {
  it("forces hasMoved and converts to an all-day event on a same-day drop into the all-day row, even with unchanged minutes", () => {
    const target: WeekTimedDragTarget = {
      event: createEvent(),
      hadFormOpenBeforeInteraction: false,
      registered: createRegistered("timed"),
      type: "timedDrag",
    };
    const visual: TimedDragVisual = {
      crossRowSize: { height: 20, width: 100 },
      dayDate: "2026-05-13",
      dayIndex: 3,
      durationMinutes: 60,
      endMinutes: 600,
      eventId: "evt-1",
      initialDayDate: "2026-05-13",
      initialDayIndex: 3,
      initialEndMinutes: 600,
      initialStartMinutes: 540,
      pointerStart: { x: 0, y: 0 },
      row: "allDay",
      sourceRect: { height: 100, left: 400, top: 600, width: 100 },
      startMinutes: 540,
      transform: { x: 0, y: -580 },
      type: "timedDrag",
    };

    const result = commitTimedDragInteraction(target, visual);

    expect(result.hasMoved).toBe(true);
    expect(result.event.isAllDay).toBe(true);
  });
});

describe("commitTimedResizeInteraction", () => {
  it("still returns a freshly-built event object for a no-op resize", () => {
    const target: WeekTimedResizeTarget = {
      edge: "endDate",
      event: createEvent(),
      hadFormOpenBeforeInteraction: false,
      registered: createRegistered("timed"),
      type: "timedResize",
    };
    const visual: TimedResizeVisual = {
      edge: "endDate",
      endMinutes: 600,
      eventId: "evt-1",
      height: 60,
      initialEdge: "endDate",
      initialEndMinutes: 600,
      initialStartMinutes: 540,
      pointerStart: { x: 0, y: 0 },
      sourceRect: { height: 60, left: 400, top: 600, width: 100 },
      startMinutes: 540,
      transform: { x: 0, y: 0 },
      type: "timedResize",
    };

    const result = commitTimedResizeInteraction(target, visual);

    expect(result.hasMoved).toBe(false);
    expect(result.event).not.toBe(target.event);
  });
});
