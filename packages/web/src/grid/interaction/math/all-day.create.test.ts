import { YEAR_MONTH_DAY_FORMAT } from "@core/constants/date.constants";
import dayjs from "@core/util/date/dayjs";
import { getAllDayCreateRange } from "./all-day.create";
import { describe, expect, it } from "bun:test";

// Mirrors getVisibleDateIndexByX's clamp so the edge cases exercise the
// composed behavior without adding a second clamp inside the math module.
//
// The clamp under test lives in useGridCoordinates, NOT in this module —
// getAllDayCreateRange deliberately does none. These cases prove the range math
// handles an already-clamped edge day correctly; they are not clamp coverage.
const WEEK = [
  "2026-05-18",
  "2026-05-19",
  "2026-05-20",
  "2026-05-21",
  "2026-05-22",
  "2026-05-23",
  "2026-05-24",
];
const resolveDay = (rawIndex: number): string => {
  const index = Math.max(0, Math.min(rawIndex, WEEK.length - 1));
  const day = WEEK[index];

  if (!day) {
    throw new Error(`No fixture day at index ${index}`);
  }

  return day;
};

describe("getAllDayCreateRange", () => {
  it("spans anchor through pointer with an exclusive end on a forward drag", () => {
    expect(getAllDayCreateRange("2026-05-20", "2026-05-22")).toEqual({
      startDate: "2026-05-20",
      endDate: "2026-05-23",
    });
  });

  it("normalizes a reverse drag so the earlier day is the start", () => {
    expect(getAllDayCreateRange("2026-05-22", "2026-05-20")).toEqual({
      startDate: "2026-05-20",
      endDate: "2026-05-23",
    });
  });

  it("returns the click-path single-day range when the pointer stays on the anchor day", () => {
    expect(getAllDayCreateRange("2026-05-20", "2026-05-20")).toEqual({
      startDate: "2026-05-20",
      endDate: "2026-05-21",
    });
  });

  it("matches the click path exactly for every day of a week", () => {
    for (const day of WEEK) {
      expect(getAllDayCreateRange(day, day)).toEqual({
        startDate: day,
        endDate: dayjs(day).add(1, "day").format(YEAR_MONTH_DAY_FORMAT),
      });
    }
  });

  it("keeps a left-edge-clamped pointer day intact", () => {
    expect(getAllDayCreateRange("2026-05-20", resolveDay(-4))).toEqual({
      startDate: "2026-05-18",
      endDate: "2026-05-21",
    });
  });

  it("keeps a right-edge-clamped pointer day intact", () => {
    expect(getAllDayCreateRange("2026-05-20", resolveDay(99))).toEqual({
      startDate: "2026-05-20",
      endDate: "2026-05-25",
    });
  });

  it("crosses a month boundary without shifting the day", () => {
    expect(getAllDayCreateRange("2026-05-31", "2026-06-02")).toEqual({
      startDate: "2026-05-31",
      endDate: "2026-06-03",
    });
  });

  it("crosses a spring-forward DST boundary without shifting the day", () => {
    expect(getAllDayCreateRange("2026-03-07", "2026-03-09")).toEqual({
      startDate: "2026-03-07",
      endDate: "2026-03-10",
    });
  });
});
