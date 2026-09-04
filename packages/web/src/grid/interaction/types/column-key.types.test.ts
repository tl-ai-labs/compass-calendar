import { type GridLayoutCache } from "../layout.cache";
import { type CalendarColumnKey, type DateColumnKey } from "./column-key.types";
import { type TimedDragVisual } from "./timed-drag.types";
import { describe, expect, it } from "bun:test";

const dateVisual = null as unknown as TimedDragVisual<DateColumnKey>;
const calendarVisual = null as unknown as TimedDragVisual<CalendarColumnKey>;
const dateCache = null as unknown as GridLayoutCache<DateColumnKey>;
const bareString: string = "test";

describe("column-key discriminant", () => {
  it("proves column key discriminant unassignability at compile time", () => {
    // @ts-expect-error
    const _calendarVisual: TimedDragVisual<CalendarColumnKey> = dateVisual;

    // @ts-expect-error
    const _dateVisual: TimedDragVisual<DateColumnKey> = calendarVisual;

    // @ts-expect-error
    const _calendarCache: GridLayoutCache<CalendarColumnKey> = dateCache;

    // @ts-expect-error
    const _dateKey: DateColumnKey = bareString;
    // @ts-expect-error
    const _calendarKey: CalendarColumnKey = bareString;
  });

  it("asserts the brand has zero runtime footprint", () => {
    const rawLiteral = "2026-09-03";
    const dateKey = rawLiteral as DateColumnKey;

    expect(typeof dateKey).toBe("string");
    expect(dateKey as string).toBe(rawLiteral);
  });
});
