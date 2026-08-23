import { type CalendarId, type DateOnly } from "@core/types/domain-primitives";

/**
 * Week grid columns are dates.
 */
export type DateColumnKey = DateOnly;

/**
 * Day grid columns are calendar ids, except the single-column fallback whose
 * one key is a date.
 */
export type DayColumnKey = CalendarId | DateOnly;

/**
 * DELIBERATELY UNCHECKED casts: the callers have already established these
 * are the rendered column keys, and running a validating parse here would put
 * Zod on the mid-drag hot path and throw on input that is silently tolerated
 * today, which would be a behavior change.
 */
export const asDateColumnKeys = (keys: string[]): DateColumnKey[] =>
  keys as DateColumnKey[];

export const asDayColumnKeys = (keys: string[]): DayColumnKey[] =>
  keys as DayColumnKey[];
