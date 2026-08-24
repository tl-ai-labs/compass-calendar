import { type CalendarId, type DateOnly } from "@core/types/domain-primitives";

/**
 * A column identified by the calendar date it renders: every Week column,
 * and Day's fallback column when no calendar columns are present.
 */
export type DateColumnKey = DateOnly;

/**
 * A column identified by the calendar it renders: Day's calendar columns.
 */
export type CalendarColumnKey = CalendarId;

/**
 * The constraint for column-key type parameters across grid views.
 * Bare `string` is deliberately not assignable to this union, which is the
 * entire enforcement mechanism preventing unbranded string column keys.
 */
export type GridColumnKey = DateColumnKey | CalendarColumnKey;

/**
 * Column key type for Day view interactions.
 *
 * This is structurally identical to `GridColumnKey` today because Day is the only
 * view with more than one kind of column. It is kept for documentation and as a
 * single future edit point; a reader must not assume it constrains anything
 * more than `GridColumnKey` does.
 *
 * The union is genuine because `day-interaction.adapter.ts` picks the calendar keys
 * when the event's calendar is among the rendered columns and falls back to a
 * single date key when it is not.
 */
export type DayColumnKey = CalendarColumnKey | DateColumnKey;
