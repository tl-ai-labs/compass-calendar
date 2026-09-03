import {
  type AllDayDayRange,
  hasExceededAllDayDragThreshold,
  isSameAllDayDayRange,
  resolveAllDayDayRange,
} from "./all-day.create";
import { describe, expect, it } from "bun:test";

const visibleDates = [
  "2026-05-18",
  "2026-05-19",
  "2026-05-20",
  "2026-05-21",
  "2026-05-22",
  "2026-05-23",
  "2026-05-24",
] as const;

describe("all-day create math", () => {
  it("one-day identity", () => {
    expect(
      resolveAllDayDayRange({
        anchorDate: "2026-05-20",
        pointerDate: "2026-05-20",
      }),
    ).toEqual({
      start: "2026-05-20",
      end: "2026-05-21",
    });
  });

  it("left-to-right", () => {
    expect(
      resolveAllDayDayRange({
        anchorDate: "2026-05-20",
        pointerDate: "2026-05-22",
      }),
    ).toEqual({
      start: "2026-05-20",
      end: "2026-05-23",
    });
  });

  it("right-to-left is identical", () => {
    const ltr = resolveAllDayDayRange({
      anchorDate: "2026-05-20",
      pointerDate: "2026-05-22",
    });
    const rtl = resolveAllDayDayRange({
      anchorDate: "2026-05-22",
      pointerDate: "2026-05-20",
    });
    expect(rtl).toEqual(ltr);
  });

  it("clamp past right edge", () => {
    const range = resolveAllDayDayRange({
      anchorDate: "2026-05-20",
      pointerDate: "2026-06-02",
      visibleDates,
    });
    expect(range.end).toBe("2026-05-25");
  });

  it("clamp past left edge", () => {
    const range = resolveAllDayDayRange({
      anchorDate: "2026-05-20",
      pointerDate: "2026-04-01",
      visibleDates,
    });
    expect(range.start).toBe("2026-05-18");
  });

  it("out-of-window anchor clamps too", () => {
    const range = resolveAllDayDayRange({
      anchorDate: "2026-05-01",
      pointerDate: "2026-05-20",
      visibleDates,
    });
    expect(range.start).toBe("2026-05-18");
  });

  it("exclusive end is NOT clamped", () => {
    const range = resolveAllDayDayRange({
      anchorDate: "2026-05-24",
      pointerDate: "2026-05-24",
      visibleDates,
    });
    expect(range.end).toBe("2026-05-25");
    expect(range.end).not.toBe("2026-05-24");
  });

  it("month boundary", () => {
    expect(
      resolveAllDayDayRange({
        anchorDate: "2026-05-31",
        pointerDate: "2026-06-02",
      }),
    ).toEqual({
      start: "2026-05-31",
      end: "2026-06-03",
    });
  });

  it("no window supplied", () => {
    expect(
      resolveAllDayDayRange({
        anchorDate: "2026-05-20",
        pointerDate: "2026-06-02",
      }),
    ).toEqual({
      start: "2026-05-20",
      end: "2026-06-03",
    });

    expect(
      resolveAllDayDayRange({
        anchorDate: "2026-05-20",
        pointerDate: "2026-06-02",
        visibleDates: [],
      }),
    ).toEqual({
      start: "2026-05-20",
      end: "2026-06-03",
    });
  });

  it("hasExceededAllDayDragThreshold", () => {
    expect(hasExceededAllDayDragThreshold(120, 100, 8)).toBe(true);
    expect(hasExceededAllDayDragThreshold(104, 100, 8)).toBe(false);
    expect(hasExceededAllDayDragThreshold(80, 100, 8)).toBe(true);
    expect(hasExceededAllDayDragThreshold(91, 100, 8)).toBe(true);
    expect(hasExceededAllDayDragThreshold(108, 100, 8)).toBe(false);
  });

  it("isSameAllDayDayRange", () => {
    const rangeA: AllDayDayRange = { start: "2026-05-20", end: "2026-05-21" };
    const rangeB: AllDayDayRange = { start: "2026-05-20", end: "2026-05-21" };
    const rangeC: AllDayDayRange = { start: "2026-05-20", end: "2026-05-22" };

    expect(isSameAllDayDayRange(rangeA, rangeB)).toBe(true);
    expect(isSameAllDayDayRange(rangeA, rangeC)).toBe(false);
  });
});
