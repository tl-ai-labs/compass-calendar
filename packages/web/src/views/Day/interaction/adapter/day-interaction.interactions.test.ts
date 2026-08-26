import { type CalendarId } from "@core/types/domain-primitives";
import dayjs from "@core/util/date/dayjs";
import { type GridEvent } from "@web/common/types/web.event.types";
import { type AllDayDragVisual } from "@web/grid/interaction/types/all-day-drag.types";
import { type AllDayResizeVisual } from "@web/grid/interaction/types/all-day-resize.types";
import {
  hasDayAllDayDragVisualMoved,
  hasDayAllDayResizeVisualChanged,
} from "./commit/all-day.commit";
import { columnMoveCalendarId } from "./commit/timed.commit";
import { resolveDayColumns } from "./geometry/day-columns";
import { commitAllDayResizeInteraction } from "./interactions/all-day.resize";
import { describe, expect, it } from "bun:test";

/**
 * Direct coverage of the modules extracted out of `day-interaction.adapter.ts`
 * when Day was lifted to Week's one-module-per-interaction shape.
 *
 * Strictly additive: `day-interaction.adapter.test.ts` is untouched, so Day's
 * pre-existing 14 tests still guard the adapter end to end and this file only
 * raises the floor.
 */

/** `calendarId` is a branded type, so literals need the brand to compare. */
const calendarId = (id: string) => id as CalendarId;

const timedEvent = {
  _id: "timed-1",
  calendarId: "cal-b",
  endDate: "2026-05-19T10:00:00.000",
  isAllDay: false,
  startDate: "2026-05-19T09:00:00.000",
} as unknown as GridEvent;

const dragTarget = (event: GridEvent) =>
  ({
    event,
    hadFormOpenBeforeInteraction: false,
    registered: { element: document.createElement("div") },
    type: "timedDrag",
  }) as never;

const resizeTarget = (event: GridEvent) =>
  ({
    event,
    hadFormOpenBeforeInteraction: false,
    registered: { element: document.createElement("div") },
    type: "allDayResize",
  }) as never;

describe("resolveDayColumns", () => {
  const visibleDate = dayjs("2026-05-19");

  it("uses the rendered calendar columns when the event's calendar is among them", () => {
    const resolved = resolveDayColumns({
      getColumnKeys: () => ["cal-a", "cal-b", "cal-c"],
      target: dragTarget(timedEvent),
      visibleDate,
    });

    expect(resolved.columnKeys).toEqual(["cal-a", "cal-b", "cal-c"]);
    expect(resolved.initialColumnIndex).toBe(1);
    expect(resolved.initialColumnKey).toBe("cal-b");
  });

  it("falls back to a single dateless column when the event's calendar is not rendered", () => {
    // Columns and events momentarily out of sync. Anchoring to column 0 would
    // make a purely vertical drag commit a calendar move the user never made.
    const resolved = resolveDayColumns({
      getColumnKeys: () => ["cal-x", "cal-y"],
      target: dragTarget(timedEvent),
      visibleDate,
    });

    expect(resolved.columnKeys).toEqual(["2026-05-19"]);
    expect(resolved.initialColumnIndex).toBe(0);
    expect(resolved.initialColumnKey).toBe("2026-05-19");
  });

  it("keeps resizes in the single-column layout even when calendars are rendered", () => {
    const resolved = resolveDayColumns({
      getColumnKeys: () => ["cal-a", "cal-b"],
      target: resizeTarget(timedEvent),
      visibleDate,
    });

    expect(resolved.columnKeys).toEqual(["2026-05-19"]);
  });

  it("falls back when no calendar columns are rendered at all", () => {
    const resolved = resolveDayColumns({
      getColumnKeys: () => [],
      target: dragTarget(timedEvent),
      visibleDate,
    });

    expect(resolved.columnKeys).toEqual(["2026-05-19"]);
  });
});

describe("columnMoveCalendarId", () => {
  it("treats a cross-column drop as a calendar move", () => {
    expect(
      columnMoveCalendarId(
        { dayDate: "cal-target", initialDayDate: "cal-b" },
        timedEvent,
      ),
    ).toBe(calendarId("cal-target"));
  });

  it("keeps the event's own calendar on a same-column drop", () => {
    expect(
      columnMoveCalendarId(
        { dayDate: "cal-b", initialDayDate: "cal-b" },
        timedEvent,
      ),
    ).toBe(calendarId("cal-b"));
  });

  it("keeps the event's own calendar in the single-column fallback", () => {
    // The one key is a date string that never changes, so this can't be read
    // as a calendar move.
    expect(
      columnMoveCalendarId(
        { dayDate: "2026-05-19", initialDayDate: "2026-05-19" },
        timedEvent,
      ),
    ).toBe(calendarId("cal-b"));
  });
});

describe("Day all-day predicates", () => {
  it("guards the drag predicate with a property check, not a comparison", () => {
    // Day's all-day visual is not guaranteed to carry a dayDate.
    expect(hasDayAllDayDragVisualMoved({} as unknown as AllDayDragVisual)).toBe(
      false,
    );
    expect(
      hasDayAllDayDragVisualMoved({
        dayDate: "cal-a",
        initialDayDate: "cal-a",
      } as unknown as AllDayDragVisual),
    ).toBe(false);
    expect(
      hasDayAllDayDragVisualMoved({
        dayDate: "cal-b",
        initialDayDate: "cal-a",
      } as unknown as AllDayDragVisual),
    ).toBe(true);
  });

  it("detects a resize on either edge", () => {
    const unchanged = {
      endDayIndex: 1,
      initialEndDayIndex: 1,
      initialStartDayIndex: 0,
      startDayIndex: 0,
    } as unknown as AllDayResizeVisual;

    expect(hasDayAllDayResizeVisualChanged(unchanged)).toBe(false);
    expect(
      hasDayAllDayResizeVisualChanged({
        ...unchanged,
        startDayIndex: 1,
      } as unknown as AllDayResizeVisual),
    ).toBe(true);
    expect(
      hasDayAllDayResizeVisualChanged({
        ...unchanged,
        endDayIndex: 2,
      } as unknown as AllDayResizeVisual),
    ).toBe(true);
  });
});

describe("Day all-day resize commit", () => {
  const allDayEvent = {
    _id: "all-day-1",
    calendarId: "cal-b",
    endDate: "2026-05-22",
    isAllDay: true,
    startDate: "2026-05-19",
  } as unknown as GridEvent;

  it("rewrites to the visible date when the span changed", () => {
    // Deliberately asymmetric with Day's all-day DRAG, which keeps the event's
    // own dates. Preserved as-is; see the note in commit/all-day.commit.ts.
    const result = commitAllDayResizeInteraction(
      resizeTarget(allDayEvent),
      {
        endDayIndex: 2,
        initialEndDayIndex: 1,
        initialStartDayIndex: 0,
        startDayIndex: 0,
      } as unknown as AllDayResizeVisual,
      dayjs("2026-06-01"),
    );

    expect(result.hasMoved).toBe(true);
    expect(result.event.startDate).toBe("2026-06-01");
    expect(result.event.endDate).toBe("2026-06-02");
  });

  it("returns the event untouched when nothing changed", () => {
    const result = commitAllDayResizeInteraction(
      resizeTarget(allDayEvent),
      {
        endDayIndex: 1,
        initialEndDayIndex: 1,
        initialStartDayIndex: 0,
        startDayIndex: 0,
      } as unknown as AllDayResizeVisual,
      dayjs("2026-06-01"),
    );

    expect(result.hasMoved).toBe(false);
    expect(result.event).toBe(allDayEvent);
  });
});
