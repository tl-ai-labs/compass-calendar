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
    expect(resolveAllDayCreateRange("2026-05-23", "2026-05-20")).toEqual({
      startDate: "2026-05-20",
      endDate: "2026-05-24",
    });
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

  it("matches the n = 0 identity asserted by the existing hook test", () => {
    expect(resolveAllDayCreateRange("2026-05-20")).toEqual({
      startDate: "2026-05-20",
      endDate: "2026-05-21",
    });
  });

  it("passes the anchor date through verbatim without re-formatting", () => {
    const result = resolveAllDayCreateRange("2026-5-1");

    expect(result.startDate).toBe("2026-5-1");
    expect(result.endDate).toBe("2026-05-02");
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
