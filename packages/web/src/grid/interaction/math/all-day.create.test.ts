import {
  isSameAllDayCreateRange,
  resolveAllDayCreateRange,
} from "./all-day.create";
import { describe, expect, it } from "bun:test";

describe("resolveAllDayCreateRange", () => {
  it("resolves a forward drag across 4 columns", () => {
    expect(resolveAllDayCreateRange("2026-05-20", "2026-05-23")).toEqual({
      startDate: "2026-05-20",
      endDate: "2026-05-24",
    });
  });

  it("resolves a reverse drag across the same 4 columns to the identical range", () => {
    expect(resolveAllDayCreateRange("2026-05-23", "2026-05-20")).toEqual(
      resolveAllDayCreateRange("2026-05-20", "2026-05-23"),
    );
  });

  it("resolves n = 0 when the pointer equals the anchor", () => {
    expect(resolveAllDayCreateRange("2026-05-20", "2026-05-20")).toEqual({
      startDate: "2026-05-20",
      endDate: "2026-05-21",
    });
  });

  it("resolves n = 0 identically when the pointer is omitted", () => {
    expect(resolveAllDayCreateRange("2026-05-20")).toEqual({
      startDate: "2026-05-20",
      endDate: "2026-05-21",
    });
  });

  it("resolves n = 0 identically when the pointer is null", () => {
    expect(resolveAllDayCreateRange("2026-05-20", null)).toEqual({
      startDate: "2026-05-20",
      endDate: "2026-05-21",
    });
  });

  // The click path is the n = 0 case of the same formula, so this must equal
  // the exact span useAllDayDraftCreation.test.tsx already asserts for a click.
  it("matches the one-day span the existing hook click test asserts", () => {
    const range = resolveAllDayCreateRange("2026-05-20");

    expect(new Date(range.startDate)).toEqual(new Date("2026-05-20"));
    expect(new Date(range.endDate)).toEqual(new Date("2026-05-21"));
  });

  // Guards the property that lets any consumer's getStartDate shape survive:
  // the start is never re-formatted, only the end is derived.
  it("passes the anchor through verbatim when it carries a time component", () => {
    const result = resolveAllDayCreateRange("2026-05-20T09:30:00");

    expect(result.startDate).toBe("2026-05-20T09:30:00");
    expect(result.endDate).toBe("2026-05-21");
  });

  it("normalizes a reverse drag on calendar days, ignoring clock time", () => {
    expect(
      resolveAllDayCreateRange("2026-05-23T01:00:00", "2026-05-20T23:00:00"),
    ).toEqual({
      startDate: "2026-05-20T23:00:00",
      endDate: "2026-05-24",
    });
  });

  it("rolls the end date over a month and year boundary", () => {
    expect(resolveAllDayCreateRange("2026-12-30", "2027-01-01")).toEqual({
      startDate: "2026-12-30",
      endDate: "2027-01-02",
    });
  });

  it("adds a calendar day, not 24 hours, across the DST boundary", () => {
    expect(resolveAllDayCreateRange("2026-03-08", "2026-03-08")).toEqual({
      startDate: "2026-03-08",
      endDate: "2026-03-09",
    });
  });
});

describe("isSameAllDayCreateRange", () => {
  it("returns true for equal ranges", () => {
    const a = { startDate: "2026-05-20", endDate: "2026-05-21" };
    const b = { startDate: "2026-05-20", endDate: "2026-05-21" };

    expect(isSameAllDayCreateRange(a, b)).toBe(true);
  });

  it("returns false when startDate differs", () => {
    const a = { startDate: "2026-05-19", endDate: "2026-05-21" };
    const b = { startDate: "2026-05-20", endDate: "2026-05-21" };

    expect(isSameAllDayCreateRange(a, b)).toBe(false);
  });

  it("returns false when endDate differs", () => {
    const a = { startDate: "2026-05-20", endDate: "2026-05-22" };
    const b = { startDate: "2026-05-20", endDate: "2026-05-21" };

    expect(isSameAllDayCreateRange(a, b)).toBe(false);
  });

  it("returns false when a is null", () => {
    expect(
      isSameAllDayCreateRange(null, {
        startDate: "2026-05-20",
        endDate: "2026-05-21",
      }),
    ).toBe(false);
  });
});
