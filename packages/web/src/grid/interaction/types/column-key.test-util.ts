import {
  CalendarIdSchema,
  DateOnlySchema,
} from "@core/types/domain-primitives";
import { type CalendarColumnKey, type DateColumnKey } from "./column-key.types";

/**
 * Test-fixture constructors for branded column keys.
 *
 * Tests declare their columns as plain literals for readability; these turn
 * those literals into branded keys the same way production code does — by
 * validating through the `@core` schemas, never by casting. They throw on a
 * malformed fixture, which is the behaviour you want in a test: a fixture that
 * could not occur at runtime should fail loudly rather than be silently
 * coerced.
 */
export const asDateColumnKey = (date: string): DateColumnKey =>
  DateOnlySchema.parse(date);

export const asCalendarColumnKey = (id: string): CalendarColumnKey =>
  CalendarIdSchema.parse(id);

export const asDateColumnKeys = (dates: string[]): DateColumnKey[] =>
  dates.map(asDateColumnKey);

export const asCalendarColumnKeys = (ids: string[]): CalendarColumnKey[] =>
  ids.map(asCalendarColumnKey);
