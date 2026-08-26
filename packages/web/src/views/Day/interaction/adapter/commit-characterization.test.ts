import dayjs from "@core/util/date/dayjs";
import { type GridEvent } from "@web/common/types/web.event.types";
import { type AllDayDragVisual } from "@web/grid/interaction/types/all-day-drag.types";
import { type AllDayResizeVisual } from "@web/grid/interaction/types/all-day-resize.types";
import { type TimedResizeVisual } from "@web/grid/interaction/types/timed-resize.types";
import {
  commitAllDayDragInteraction,
  commitAllDayResizeInteraction,
} from "./commit/all-day.commit";
import { commitTimedResizeInteraction } from "./commit/timed.commit";
import {
  type DayAllDayDragTarget,
  type DayAllDayResizeTarget,
  type DayTimedResizeTarget,
} from "./day-interaction.adapter.types";
import { describe, expect, it } from "bun:test";

/**
 * CHARACTERIZATION TESTS — pin CURRENT Day commit behavior.
 *
 * CT-2 — Day's timed and all-day resize commits are GATED: a no-op resize
 * (start/end unchanged) returns `target.event` by reference, unlike Week's
 * unconditional mapper. Identity is the point — it is what makes the
 * Week/Day asymmetry impossible to "tidy away".
 *
 * PB-1 — Day's all-day drag rewrites `calendarId` only. Day columns are
 * calendars sharing one visible date, not distinct dates, so the event's own
 * `startDate`/`endDate` must stay untouched even when the drag "moved".
 * Rewriting them to the visible date would truncate a multi-day all-day event.
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
  element: null as unknown as HTMLElement,
  eventId: "evt-1",
  eventType,
});

describe("commitTimedResizeInteraction", () => {
  it("returns target.event by reference for a no-op resize", () => {
    const target: DayTimedResizeTarget = {
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

    const result = commitTimedResizeInteraction(
      target,
      visual,
      dayjs("2026-05-13"),
    );

    expect(result.hasMoved).toBe(false);
    expect(result.event).toBe(target.event);
  });
});

describe("commitAllDayResizeInteraction", () => {
  it("returns target.event by reference for a no-op resize", () => {
    const target: DayAllDayResizeTarget = {
      edge: "endDate",
      event: createEvent({ isAllDay: true }),
      hadFormOpenBeforeInteraction: false,
      registered: createRegistered("all-day"),
      type: "allDayResize",
    };
    const visual: AllDayResizeVisual = {
      endDayIndex: 2,
      eventId: "evt-1",
      initialEdge: "endDate",
      initialEndDayIndex: 2,
      initialStartDayIndex: 1,
      pointerStart: { x: 0, y: 0 },
      sourceRect: { height: 20, left: 400, top: 25, width: 100 },
      startDayIndex: 1,
      transform: { x: 0, y: 0 },
      type: "allDayResize",
      width: 100,
    };

    const result = commitAllDayResizeInteraction(
      target,
      visual,
      dayjs("2026-05-13"),
    );

    expect(result.hasMoved).toBe(false);
    expect(result.event).toBe(target.event);
  });
});

describe("commitAllDayDragInteraction", () => {
  it("rewrites calendarId on a cross-column drag but leaves start/end dates untouched", () => {
    const target: DayAllDayDragTarget = {
      event: createEvent({ isAllDay: true }),
      hadFormOpenBeforeInteraction: false,
      registered: createRegistered("all-day"),
      type: "allDayDrag",
    };
    const visual: AllDayDragVisual = {
      crossRowSize: null,
      dayDate: "cal-2",
      dayIndex: 1,
      eventId: "evt-1",
      initialDayDate: "cal-1",
      initialDayIndex: 0,
      pointerStart: { x: 0, y: 0 },
      row: "allDay",
      sourceRect: { height: 20, left: 400, top: 25, width: 100 },
      timedStartMinutes: null,
      transform: { x: 0, y: 0 },
      type: "allDayDrag",
    };

    const result = commitAllDayDragInteraction(target, visual);

    expect(result.hasMoved).toBe(true);
    // `calendarId` is a branded CalendarId; the visual's column key is a plain
    // string, so widen for the comparison rather than fake a brand.
    expect(result.event.calendarId as string | undefined).toBe(visual.dayDate);
    expect(result.event.startDate).toBe(target.event.startDate);
    expect(result.event.endDate).toBe(target.event.endDate);
  });
});
