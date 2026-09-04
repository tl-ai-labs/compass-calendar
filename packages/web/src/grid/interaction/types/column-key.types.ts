/**
 * Column-key discriminant for drag visuals and the layout cache.
 *
 * A "column key" identifies the grid column a drag is currently over. Both
 * views store it in the same field (`dayDate` / `initialDayDate`), but they
 * mean different things by it:
 *
 * - **Week** renders one column per day, so a column key is a local
 *   `YYYY-MM-DD` date and a column change is a *date* move.
 * - **Day** renders one column per calendar (all sharing the visible date), so
 *   a column key is normally a calendar id and a column change is a
 *   *cross-calendar* move.
 *
 * Before this brand existed the field was a bare `string`, i.e. an untagged
 * union of those two meanings, and nothing stopped shared code from
 * `dayjs`-parsing a calendar id or treating a date as a calendar id. The
 * brands below make the two mutually unassignable, so that mistake is a
 * compile error rather than a silent wrong-date/wrong-calendar write.
 */

declare const COLUMN_KEY_BRAND: unique symbol;

/**
 * Compile-time-only tag. Erases completely — a `ColumnKey` *is* a string at
 * runtime, so equality comparisons, `dayjs()` calls and object spreads all
 * behave exactly as they did before.
 */
export type ColumnKey<TKind extends string> = string & {
  readonly [COLUMN_KEY_BRAND]: TKind;
};

/** Week: local `YYYY-MM-DD` date of a rendered day column. */
export type DateColumnKey = ColumnKey<"date">;

/**
 * Day: a rendered calendar column's id, **or** the single `YYYY-MM-DD`
 * fallback key used when the event's calendar is not among the rendered
 * columns.
 *
 * Deliberately **not** `CalendarId` from `@core`. Two reasons: the fallback key
 * is a date string and would violate that brand outright, and `CalendarId` is a
 * zod runtime brand, which would couple this dependency-free types layer to zod
 * for a purely compile-time need.
 */
export type CalendarColumnKey = ColumnKey<"calendar">;

/**
 * Compatibility default for the generic visual and layout types. Keeps callers
 * that never name a key type compiling unchanged.
 *
 * Never use this in a *parameter* position in shared code: both branded keys
 * are assignable to the union, so a parameter typed `AnyColumnKey` accepts
 * either view's keys and the discriminant goes inert.
 */
export type AnyColumnKey = CalendarColumnKey | DateColumnKey;
