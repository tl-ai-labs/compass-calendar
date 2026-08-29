// Grid-card attendee badge geometry gates. These live here rather than in
// @web/grid/grid.constants.ts so the badge's tuning stays next to the component
// it tunes; grid.constants.ts holds layout math consumed by the positioning
// engine, not presentational chrome thresholds.

/**
 * Circles rendered before the +N chip takes over. Deliberately NOT the form's
 * MAX_VISIBLE_ATTENDEES (6): a grid card is a fraction of the form panel's
 * width, and the form can expand its list on click while the card cannot.
 */
export const ATTENDEE_BADGE_MAX_VISIBLE = 3;

/**
 * Rendered height of one badge row (a size-3.5 circle). The timed card's title
 * line clamp subtracts this the same way it subtracts the time label's line box,
 * so a wrapping title cannot push the badge past the card's clipped edge.
 */
export const ATTENDEE_BADGE_ROW_HEIGHT = 14;

/**
 * Below this width the badge is suppressed. Matches
 * MIN_EVENT_WIDTH_FOR_TIME_LABEL (90) by value, so a card either carries its
 * secondary chrome or carries none of it - it is deliberately a separate
 * constant rather than an import, because the all-day card has no time label
 * and must not inherit a timed-label threshold by coupling.
 * Budget at 90px: 3px calendar accent + 5px pl-1.25 + 34px of overlapping
 * circles (14 + 10 + 10) + 20px +N chip + 3px pr-0.75 = 75px, leaving ~15px of
 * title before the badge crowds it.
 */
export const ATTENDEE_BADGE_MIN_WIDTH = 90;

/**
 * Below this height the timed card suppresses the badge. Budget: 16px title line
 * (GRID_EVENT_TITLE_LINE_HEIGHT_PX) + 13px time-label line box
 * (GRID_EVENT_TIME_LABEL_LINE_HEIGHT) + 14px badge row + 7px vertical slack
 * (GRID_EVENT_TITLE_VERTICAL_SLACK_PX) = 50; rounded to 52. Comfortably above
 * MIN_EVENT_HEIGHT_FOR_TIME_LABEL (36) so the badge never appears on a card
 * already too short for its own time label, and ~3.5x COMPACT_EVENT_MAX_HEIGHT
 * (15) so no compact card ever shows it. The all-day card does NOT use this
 * gate - see AllDayEventCard.
 */
export const ATTENDEE_BADGE_MIN_HEIGHT = 52;
