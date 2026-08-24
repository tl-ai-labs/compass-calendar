import { type GridEvent } from "@web/common/types/web.event.types";
import { allDayDragVisualToTimedGridEvent } from "@web/grid/interaction/commit/cross-row.commit";
import { type AllDayDragVisual } from "./all-day-drag.types";
import { isCalendarColumnKey } from "./column-key";
import { asCalendarColumnKey, asDateColumnKey } from "./column-key.test-util";
import {
  type DateColumnKey,
  type DayColumnKey,
  type GridColumnKey,
} from "./column-key.types";
import { type TimedDragVisual } from "./timed-drag.types";
import { describe, expect, it } from "bun:test";

/**
 * Compile-time regression guard for the column-key type parameter.
 *
 * The safety property of CMP-104 rests entirely on `TColumnKey` having NO
 * DEFAULT. Re-adding `= string` is a three-character edit that would leave
 * type-check green, lint green and the whole suite green while silently
 * restoring the original `Invalid Date -> NaN` corruption path. Nothing else
 * in the tree pins that.
 *
 * This file is the pin, and it is SELF-INVALIDATING: `@ts-expect-error` fails
 * the build when the error it expects STOPS occurring (TS2578, "Unused
 * '@ts-expect-error' directive"). So if anyone reintroduces a default, or
 * widens the `GridColumnKey` constraint enough to admit bare `string`, these
 * directives go unused and the build breaks here — which is exactly the
 * regression worth catching. A guard that could quietly stop guarding would be
 * worthless; that is the failure mode this shape avoids.
 *
 * Do not "fix" a failure in this file by deleting a directive. A failure here
 * means the type contract changed.
 */

// --- Omitting the type argument must be a hard error (TS2314) -------------

// @ts-expect-error TS2314: Generic type requires 1 type argument(s).
type _BareTimedDragVisual = TimedDragVisual;

// @ts-expect-error TS2314: Generic type requires 1 type argument(s).
type _BareAllDayDragVisual = AllDayDragVisual;

// --- Bare `string` must not satisfy the constraint (TS2344) ---------------

// @ts-expect-error TS2344: 'string' does not satisfy the constraint 'GridColumnKey'.
type _StringKeyedTimed = TimedDragVisual<string>;

// @ts-expect-error TS2344: 'string' does not satisfy the constraint 'GridColumnKey'.
type _StringKeyedAllDay = AllDayDragVisual<string>;

// --- A raw literal must not be assignable to a branded key (TS2322) -------

// @ts-expect-error TS2322: 'string' is not assignable to 'DateColumnKey'.
const _rawDateLiteral: DateColumnKey = "2026-08-24";

// @ts-expect-error TS2322: 'string' is not assignable to 'GridColumnKey'.
const _rawKeyLiteral: GridColumnKey = "anything";

/**
 * The FR-2 guarantee: a Day-produced visual must not reach the shared
 * cross-row commit, which `dayjs`-parses the column key. Before FR-1 this was
 * enforced only by import topology — nothing stopped a future Day caller. Now
 * it is a type error.
 *
 * `declare const` emits no runtime code, and the function is never called —
 * only type-checked. It is referenced by the `void` statement below so
 * `noUnusedVariables` stays quiet without a lint suppression, and it is not
 * exported because `noExportsInTest` forbids exports from a test file.
 */
declare const someGridEvent: GridEvent;
declare const dayProducedVisual: AllDayDragVisual<DayColumnKey>;
declare const weekProducedVisual: AllDayDragVisual<DateColumnKey>;

function _crossRowKeyNarrowingGuards() {
  // @ts-expect-error TS2345: AllDayDragVisual<DayColumnKey> is not assignable
  // to AllDayDragVisual<DateColumnKey> — a Day key could be a CalendarId,
  // which dayjs cannot parse.
  allDayDragVisualToTimedGridEvent(someGridEvent, dayProducedVisual);

  // The Week-produced visual is the supported case and must still compile.
  // No @ts-expect-error here on purpose: if this line ever started failing,
  // Week's own cross-row drag would be broken.
  allDayDragVisualToTimedGridEvent(someGridEvent, weekProducedVisual);
}

// Referenced, never invoked: the guards above are type-level assertions, and
// calling them would dereference `declare const` bindings that do not exist at
// runtime.
void _crossRowKeyNarrowingGuards;

// --- Runtime companion ----------------------------------------------------

describe("column key brands", () => {
  // The two brands must stay disjoint, otherwise isCalendarColumnKey could
  // misclassify a Week date column as a calendar id and turn a same-day drag
  // into a cross-calendar move. DateOnly is a 10-char YYYY-MM-DD; CalendarId
  // is a 24-hex ObjectId string, so they cannot collide.
  it("never classifies a date column key as a calendar column key", () => {
    expect(isCalendarColumnKey(asDateColumnKey("2026-08-24"))).toBe(false);
  });

  it("classifies a calendar column key as a calendar column key", () => {
    expect(
      isCalendarColumnKey(asCalendarColumnKey("aaaaaaaaaaaaaaaaaaaaaaaa")),
    ).toBe(true);
  });

  it("rejects a malformed date rather than branding it", () => {
    expect(() => asDateColumnKey("Invalid Date")).toThrow();
  });
});
