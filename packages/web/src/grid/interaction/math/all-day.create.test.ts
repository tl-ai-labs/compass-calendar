import { YEAR_MONTH_DAY_FORMAT } from "@core/constants/date.constants";
import dayjs from "@core/util/date/dayjs";
import {
  isSameAllDayCreateRange,
  resolveAllDayCreateRange,
} from "./all-day.create";
import { describe, expect, it } from "bun:test";

describe("resolveAllDayCreateRange", () => {
  it("spans from the press day to the pointer day with an exclusive end", () => {
    expect(resolveAllDayCreateRange("2026-05-18", "2026-05-21")).toEqual({
      startDate: "2026-05-18",
      endDate: "2026-05-22",
    });
  });

  it("normalises a right-to-left drag to the same range as left-to-right", () => {
    expect(resolveAllDayCreateRange("2026-05-21", "2026-05-18")).toEqual(
      resolveAllDayCreateRange("2026-05-18", "2026-05-21"),
    );
  });

  it("keeps a same-day press as the one-day draft the click path produces", () => {
    const startDate = "2026-05-20";
    const expectedEnd = dayjs(startDate)
      .add(1, "day")
      .format(YEAR_MONTH_DAY_FORMAT);

    expect(resolveAllDayCreateRange(startDate, startDate)).toEqual({
      startDate,
      endDate: expectedEnd,
    });
  });

  it("produces N days of difference for an N-column drag", () => {
    const anchor = "2026-05-18";

    for (let inclusiveDays = 1; inclusiveDays <= 7; inclusiveDays++) {
      const pointer = dayjs(anchor)
        .add(inclusiveDays - 1, "day")
        .format(YEAR_MONTH_DAY_FORMAT);
      const range = resolveAllDayCreateRange(anchor, pointer);

      expect(dayjs(range.endDate).diff(range.startDate, "day")).toBe(
        inclusiveDays,
      );
    }
  });

  it("carries the exclusive end across a month boundary", () => {
    expect(resolveAllDayCreateRange("2026-05-31", "2026-06-02")).toEqual({
      startDate: "2026-05-31",
      endDate: "2026-06-03",
    });
  });

  it("is idempotent and never branches on its own output", () => {
    const first = resolveAllDayCreateRange("2026-05-18", "2026-05-21");
    const second = resolveAllDayCreateRange("2026-05-18", "2026-05-21");

    expect(second).toEqual(first);

    // A reverse drag re-resolved against its own normalised start must still
    // describe the reverse drag, not collapse toward the anchor.
    const reverse = resolveAllDayCreateRange("2026-05-21", "2026-05-18");
    expect(resolveAllDayCreateRange("2026-05-21", reverse.startDate)).toEqual(
      reverse,
    );
  });
});

describe("isSameAllDayCreateRange", () => {
  const range = { startDate: "2026-05-18", endDate: "2026-05-22" };

  it("treats a null previous range as never equal, so the first move writes", () => {
    expect(isSameAllDayCreateRange(null, range)).toBe(false);
  });

  it("matches ranges with identical values", () => {
    expect(isSameAllDayCreateRange({ ...range }, range)).toBe(true);
  });

  it("does not match when the end differs", () => {
    expect(
      isSameAllDayCreateRange({ ...range, endDate: "2026-05-23" }, range),
    ).toBe(false);
  });

  it("does not match when the start differs", () => {
    expect(
      isSameAllDayCreateRange({ ...range, startDate: "2026-05-17" }, range),
    ).toBe(false);
  });
});
