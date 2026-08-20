import {
  calculateAllDayCreateSchedule,
  clampDayToVisibleBounds,
  normalizeDayRange,
  toExclusiveAllDayEndDate,
} from "./all-day.create";
import { describe, expect, it } from "bun:test";

describe("all-day creation math", () => {
  describe("normalizeDayRange", () => {
    it("produces identical normalized ranges for left-to-right and right-to-left drags", () => {
      const ltr = normalizeDayRange("2026-05-18", "2026-05-20");
      const rtl = normalizeDayRange("2026-05-20", "2026-05-18");

      expect(ltr).toEqual({ startDay: "2026-05-18", endDay: "2026-05-20" });
      expect(rtl).toEqual({ startDay: "2026-05-18", endDay: "2026-05-20" });
      expect(ltr).toEqual(rtl);
    });

    it("handles same-day range", () => {
      expect(normalizeDayRange("2026-05-18", "2026-05-18")).toEqual({
        startDay: "2026-05-18",
        endDay: "2026-05-18",
      });
    });
  });

  describe("clampDayToVisibleBounds", () => {
    const minDate = "2026-05-17";
    const maxDate = "2026-05-23";

    it("clamps dates below minDate", () => {
      expect(clampDayToVisibleBounds("2026-05-10", minDate, maxDate)).toBe(
        minDate,
      );
    });

    it("clamps dates above maxDate", () => {
      expect(clampDayToVisibleBounds("2026-05-30", minDate, maxDate)).toBe(
        maxDate,
      );
    });

    it("returns date unchanged when within bounds", () => {
      expect(clampDayToVisibleBounds("2026-05-20", minDate, maxDate)).toBe(
        "2026-05-20",
      );
    });

    it("returns boundary dates unchanged", () => {
      expect(clampDayToVisibleBounds(minDate, minDate, maxDate)).toBe(minDate);
      expect(clampDayToVisibleBounds(maxDate, minDate, maxDate)).toBe(maxDate);
    });
  });

  describe("toExclusiveAllDayEndDate", () => {
    it("returns the next day as exclusive end date", () => {
      expect(toExclusiveAllDayEndDate("2026-05-20")).toBe("2026-05-21");
      expect(toExclusiveAllDayEndDate("2026-12-31")).toBe("2027-01-01");
      expect(toExclusiveAllDayEndDate("2026-02-28")).toBe("2026-03-01");
    });
  });

  describe("calculateAllDayCreateSchedule", () => {
    const minDate = "2026-05-17";
    const maxDate = "2026-05-23";

    it("produces a 1-day exclusive span for single-day selection (anchor === current)", () => {
      const schedule = calculateAllDayCreateSchedule({
        anchorDate: "2026-05-18",
        currentDate: "2026-05-18",
        minDate,
        maxDate,
      });

      expect(schedule).toEqual({
        startDate: "2026-05-18",
        endDate: "2026-05-19",
      });
    });

    it("calculates accurate schedule for multi-day left-to-right drag", () => {
      const schedule = calculateAllDayCreateSchedule({
        anchorDate: "2026-05-18",
        currentDate: "2026-05-20",
        minDate,
        maxDate,
      });

      expect(schedule).toEqual({
        startDate: "2026-05-18",
        endDate: "2026-05-21",
      });
    });

    it("calculates accurate schedule for multi-day right-to-left drag", () => {
      const schedule = calculateAllDayCreateSchedule({
        anchorDate: "2026-05-20",
        currentDate: "2026-05-18",
        minDate,
        maxDate,
      });

      expect(schedule).toEqual({
        startDate: "2026-05-18",
        endDate: "2026-05-21",
      });
    });

    it("clamps drag bounds when dragging beyond visible grid limits", () => {
      const schedule = calculateAllDayCreateSchedule({
        anchorDate: "2026-05-19",
        currentDate: "2026-05-30",
        minDate,
        maxDate,
      });

      expect(schedule).toEqual({
        startDate: "2026-05-19",
        endDate: "2026-05-24",
      });

      const scheduleBelow = calculateAllDayCreateSchedule({
        anchorDate: "2026-05-10",
        currentDate: "2026-05-20",
        minDate,
        maxDate,
      });

      expect(scheduleBelow).toEqual({
        startDate: "2026-05-17",
        endDate: "2026-05-21",
      });
    });
  });
});
