import { type GridColumnKey } from "./column-key.types";

export interface VisualPoint {
  x: number;
  y: number;
}

export interface VisualRect {
  height: number;
  left: number;
  top: number;
  width: number;
}

/** Which of the calendar's two event rows a drag is over. */
export type DragRow = "allDay" | "timed";

/**
 * Ghost box for the row a drag is currently over. Non-null only while the drag
 * is over the *other* row, where the source card's own box is the wrong shape
 * for the event it is about to become (a 20px all-day chip over the timed grid,
 * or an hour-tall block over the all-day row).
 */
export type CrossRowSize = { height: number; width: number } | null;

/**
 * Day indices are window-relative (0..N-1 over the rendered columns) and stay
 * valid across mid-drag layout rebuilds because the visible day count is
 * frozen while an interaction is in motion. Day *dates* come from the layout
 * cache columns, so they track mid-drag week navigation automatically.
 */
export interface TimedDragVisual<TColumnKey extends GridColumnKey> {
  crossRowSize: CrossRowSize;
  /**
   * Key of the column currently under the drag, view-parameterized: Week
   * instantiates with `DateColumnKey`, Day with `DayColumnKey` (a calendar id,
   * or a date in the single-column fallback).
   *
   * WHAT THIS DOES GUARANTEE: a function that declares `DateColumnKey` will
   * reject a Day-produced visual (TS2345). That is what pins the three known
   * `dayjs`-parse sites — `commit/cross-row.commit.ts` (both directions) and
   * Week's `adapter/commit/all-day.commit.ts`.
   *
   * WHAT IT DOES NOT GUARANTEE: parsing is *not* structurally impossible.
   * `GridColumnKey` is a branded **string**, so it stays assignable to
   * `string`, and a new shared function generic over `TColumnKey` can call
   * `dayjs(visual.dayDate)` with no compiler error. A live sink already
   * exists: `grid/interaction/date.ts` `getLocalMinutes(date: string |
   * undefined)` accepts any column key silently.
   *
   * So the protection is per-site and by convention-plus-signature, not
   * structural. When adding a shared consumer that needs a real date, declare
   * `DateColumnKey` explicitly — do not assume the type stops you.
   */
  dayDate: TColumnKey;
  dayIndex: number;
  durationMinutes: number;
  endMinutes: number;
  eventId: string;
  /** Key of the source column at drag start, same kind as `dayDate`. */
  initialDayDate: TColumnKey;
  initialDayIndex: number;
  initialEndMinutes: number;
  initialStartMinutes: number;
  pointerStart: VisualPoint;
  /**
   * Row the pointer is over, re-resolved every frame. "allDay" means releasing
   * here converts the event to an all-day one and `startMinutes`/`endMinutes`
   * are ignored by the commit (they keep their last in-grid values).
   */
  row: DragRow;
  sourceRect: VisualRect;
  startMinutes: number;
  transform: VisualPoint;
  type: "timedDrag";
}
