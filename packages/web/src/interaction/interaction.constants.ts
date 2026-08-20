/**
 * Shared gesture timings for grid interaction.
 *
 * `INTERACTION_MOVE_THRESHOLD_PX` (25) gates motion on an existing event/draft —
 * the pointer must clearly intend a drag before the card moves.
 * `TIMED_DRAFT_CREATE_MOVE_THRESHOLD_PX` (4) is intentionally tighter: on empty
 * grid it distinguishes a click-to-create from a drag-to-resize-duration. Do
 * not unify these values; they measure different products of the gesture.
 *
 * `ALLDAY_DRAFT_CREATE_MOVE_THRESHOLD_PX` (4) is the all-day row's analogue of
 * the timed value and is deliberately a separate constant even though the
 * numbers currently match: the timed gate measures duration intent along the
 * vertical minute axis, this one measures day-span intent along the horizontal
 * column axis. They will move independently. Do not unify them.
 *
 * `INTERACTION_EDGE_THRESHOLD_PX` is the shared proximity band for Day/Week
 * smart-scroll and Week edge-navigation — same distance, different axes.
 */
export const INTERACTION_HOLD_DELAY_MS = 750;
export const INTERACTION_MOVE_THRESHOLD_PX = 25;
// Safety net while rAF waits for committed geometry. 500ms covers dense-week /
// series-projection commits that used to flash when the old 250ms deadline
// won the race; no-op commits may linger this long before the clone drops.
export const INTERACTION_COMMIT_TEARDOWN_DEADLINE_MS = 500;
export const INTERACTION_EDGE_THRESHOLD_PX = 50;
export const TIMED_DRAFT_CREATE_MOVE_THRESHOLD_PX = 4;
export const ALLDAY_DRAFT_CREATE_MOVE_THRESHOLD_PX = 4;
