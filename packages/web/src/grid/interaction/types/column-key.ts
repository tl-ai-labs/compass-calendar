import { YEAR_MONTH_DAY_FORMAT } from "@core/constants/date.constants";
import {
  CalendarIdSchema,
  DateOnlySchema,
} from "@core/types/domain-primitives";
import { type Dayjs } from "@core/util/date/dayjs";
import { type CalendarColumnKey, type DateColumnKey } from "./column-key.types";

/**
 * Formats a Dayjs date into a branded DateColumnKey.
 *
 * Taking a Dayjs rather than a string removes the untrusted-shape problem: a
 * *valid* Dayjs formatted with YEAR_MONTH_DAY_FORMAT is date-only by
 * construction.
 *
 * THROWS on an INVALID Dayjs — `dayjs("nonsense").format(...)` yields
 * "Invalid Date", which fails the schema refine. This is deliberate (a
 * malformed date must not become a column key) but it means callers must hand
 * in a Dayjs that is already known-valid. Both current call sites satisfy
 * that: the Week render path and the Day pointerdown path are both downstream
 * of `routers/loaders.ts`, which validates the route's date param in
 * `beforeLoad` and redirects on failure. That is a cross-module invariant and
 * is not visible from here — a third call site must re-establish it, or use
 * `parseDateColumnKey` instead.
 */
export const toDateColumnKey = (date: Dayjs): DateColumnKey => {
  return DateOnlySchema.parse(date.format(YEAR_MONTH_DAY_FORMAT));
};

/**
 * Parses a raw string into a branded DateColumnKey, or returns null if invalid.
 * For keys that genuinely arrive as strings (DOM dataset, URL, storage).
 * Total function: never throws, never casts.
 */
export const parseDateColumnKey = (raw: string): DateColumnKey | null => {
  const result = DateOnlySchema.safeParse(raw);
  return result.success ? result.data : null;
};

/**
 * Type guard checking if a key string is a branded CalendarColumnKey.
 * CalendarIdSchema is a 24-hex-character ObjectId string regex, so a
 * YYYY-MM-DD date key correctly returns false.
 */
export const isCalendarColumnKey = (key: string): key is CalendarColumnKey => {
  return CalendarIdSchema.safeParse(key).success;
};
