import { type CalendarId } from "@core/types/domain-primitives";
import dayjs from "@core/util/date/dayjs";
import { type GridEvent } from "@web/common/types/web.event.types";
import { type AllDayDragVisual } from "@web/grid/interaction/types/all-day-drag.types";
import { type TimedDragVisual } from "@web/grid/interaction/types/timed-drag.types";
import { timedDragVisualToDayGridEvent } from "@web/views/Day/interaction/adapter/commit/timed.commit";
import { commitAllDayDragInteraction as commitDayAllDayDrag } from "@web/views/Day/interaction/adapter/interactions/all-day.drag";
import { allDayDragVisualToGridEvent } from "@web/views/Week/interaction/adapter/commit/all-day.commit";
import { timedDragVisualToGridEvent } from "@web/views/Week/interaction/adapter/commit/timed.commit";
import { describe, expect, it } from "bun:test";

/**
 * The four ways Week and Day deliberately disagree, asserted side by side.
 *
 * This file exists because the Week/Day interaction layers now share a
 * substrate, and the cheapest mistake to make while unifying them is to
 * "tidy" one view's commit semantics into the other's. Every assertion here
 * is a behaviour a user would notice: which day an event lands on, which
 * calendar it belongs to, and whether a multi-day event survives a drag.
 *
 * If a future change makes both views agree, this suite fails — and that
 * failure is the point, not a bug in the test.
 */

/** `calendarId` is a branded type, so literals need the brand to compare. */
const calendarId = (id: string) => id as CalendarId;

const allDayEvent = {
  _id: "all-day-1",
  calendarId: "cal-source",
  endDate: "2026-05-22",
  isAllDay: true,
  startDate: "2026-05-19",
  title: "Three-day all-day event",
} as unknown as GridEvent;

const timedEvent = {
  _id: "timed-1",
  calendarId: "cal-source",
  endDate: "2026-05-19T10:00:00.000",
  isAllDay: false,
  startDate: "2026-05-19T09:00:00.000",
  title: "Timed event",
} as unknown as GridEvent;

describe("Week vs Day — all-day drag semantics", () => {
  it("Week applies a DAY DELTA to the event's own dates", () => {
    // Week columns are dates. The initial column is the CLAMPED visible start,
    // which for a multi-day event need not be the event's own start, so the
    // move is expressed as a delta rather than an absolute date.
    const visual = {
      dayDate: "2026-05-21",
      initialDayDate: "2026-05-19",
    } as unknown as AllDayDragVisual;

    const moved = allDayDragVisualToGridEvent(allDayEvent, visual);

    expect(moved.startDate).toBe("2026-05-21");
    expect(moved.endDate).toBe("2026-05-24");
    // The three-day span survives the move.
    expect(dayjs(moved.endDate).diff(dayjs(moved.startDate), "day")).toBe(
      dayjs(allDayEvent.endDate).diff(dayjs(allDayEvent.startDate), "day"),
    );
  });

  it("Day KEEPS the event's dates and changes only the calendar", () => {
    // Day columns are calendars, all sharing one visible date. Rewriting the
    // dates to that visible date would truncate this three-day event to one.
    const visual = {
      dayDate: "cal-target",
      initialDayDate: "cal-source",
    } as unknown as AllDayDragVisual;

    const result = commitDayAllDayDrag(
      {
        event: allDayEvent,
        hadFormOpenBeforeInteraction: false,
        registered: { element: document.createElement("div") },
        type: "allDayDrag",
      } as never,
      visual,
    );

    expect(result.hasMoved).toBe(true);
    expect(result.event.calendarId).toBe(calendarId("cal-target"));
    expect(result.event.startDate).toBe(allDayEvent.startDate);
    expect(result.event.endDate).toBe(allDayEvent.endDate);
  });
});

describe("Week vs Day — timed drag semantics", () => {
  const visual = {
    dayDate: "2026-05-21",
    endMinutes: 660,
    initialDayDate: "2026-05-19",
    startMinutes: 600,
  } as unknown as TimedDragVisual;

  it("Week writes the column's date ABSOLUTELY and leaves the calendar alone", () => {
    const moved = timedDragVisualToGridEvent(timedEvent, visual);

    expect(dayjs(moved.startDate).format("YYYY-MM-DD")).toBe("2026-05-21");
    expect(dayjs(moved.startDate).hour()).toBe(10);
    expect(dayjs(moved.endDate).hour()).toBe(11);
    expect(moved.calendarId).toBe(calendarId("cal-source"));
  });

  it("Day writes the VISIBLE DATE and moves the event between calendars", () => {
    const dayVisual = {
      dayDate: "cal-target",
      endMinutes: 660,
      initialDayDate: "cal-source",
      startMinutes: 600,
    } as unknown as TimedDragVisual;

    const moved = timedDragVisualToDayGridEvent(
      timedEvent,
      dayVisual,
      dayjs("2026-05-25"),
    );

    // The date comes from the visible day, never from the column key — the
    // column key is a calendar id here.
    expect(dayjs(moved.startDate).format("YYYY-MM-DD")).toBe("2026-05-25");
    expect(dayjs(moved.startDate).hour()).toBe(10);
    expect(moved.calendarId).toBe(calendarId("cal-target"));
  });

  it("Day keeps the event's own calendar on a same-column drop", () => {
    const sameColumn = {
      dayDate: "cal-source",
      endMinutes: 660,
      initialDayDate: "cal-source",
      startMinutes: 600,
    } as unknown as TimedDragVisual;

    const moved = timedDragVisualToDayGridEvent(
      timedEvent,
      sameColumn,
      dayjs("2026-05-25"),
    );

    expect(moved.calendarId).toBe(calendarId("cal-source"));
  });
});
