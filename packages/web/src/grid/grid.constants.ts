export const DRAFT_DURATION_MIN = 30;
export const DRAFT_PADDING_BOTTOM = 3;
export const EVENT_ALLDAY_HEIGHT = 20;
export const EVENT_ALLDAY_GAP = 3;
export const EVENT_ALLDAY_ROW_HEIGHT = EVENT_ALLDAY_HEIGHT + EVENT_ALLDAY_GAP;
export const EVENT_PADDING_RIGHT = 10;
export const TIMED_EVENT_COLUMN_INSET = 5;
export const GRID_EVENT_TIME_LABEL_FONT_SIZE = "11px";
// Dims the time label relative to the title. Kept high enough that the label,
// composited over the event fill, still clears 4.5:1 with the dark title color.
export const GRID_EVENT_TIME_LABEL_OPACITY = "0.82";
// Line box the 11px time label occupies. The title's line clamp subtracts this
// so the label keeps its row instead of being pushed past the card's clipped edge.
export const GRID_EVENT_TIME_LABEL_LINE_HEIGHT = 13;
// Numeric line-height getLineClamp divides by to convert a card's remaining
// pixel height into a clamp line count. Only reflects the normal-height
// title; getLineClamp doesn't special-case the shorter compact line-height
// below, which predates this constant.
export const GRID_EVENT_TITLE_LINE_HEIGHT_PX = 16;
export const GRID_EVENT_TITLE_LINE_HEIGHT = `${GRID_EVENT_TITLE_LINE_HEIGHT_PX}px`;
export const GRID_EVENT_TITLE_FONT_SIZE = "13px";
// Vertical padding/slack getLineClamp reserves around the title text block.
export const GRID_EVENT_TITLE_VERTICAL_SLACK_PX = 7;
// Below this height the card only has room for a single cramped line.
export const COMPACT_EVENT_MAX_HEIGHT = 15;
export const GRID_EVENT_TITLE_COMPACT_FONT_SIZE = "10px";
export const GRID_EVENT_TITLE_COMPACT_LINE_HEIGHT = "1.1";
export const MIN_EVENT_HEIGHT_FOR_TIME_LABEL = 36;
export const MIN_EVENT_WIDTH_FOR_TIME_LABEL = 90;
// Attendee badge: 10px tall (an 8px `size-2` dot inside a `text-[10px]
// leading-none` line box), pinned to the card's top-right corner. 24 is where
// it stops colliding with the repeat glyph: the badge at top-0.5 occupies
// y 2..12, the 10px EventRepeatIcon at bottom-0.5 occupies y H-12..H-2, and
// both are anchored to right-1, so non-overlap needs H >= 24. Still above
// COMPACT_EVENT_MAX_HEIGHT so a 15-minute sliver never carries it (a sliver has
// room for one cramped title line and nothing else), and below the ~31px a
// 30-minute event renders at, so an ordinary half-hour meeting does.
export const MIN_EVENT_HEIGHT_FOR_ATTENDEE_BADGE = 24;
// The badge is ~22px wide plus a 4px right offset; below this the title has no
// usable room left. Lower than MIN_EVENT_WIDTH_FOR_TIME_LABEL on purpose — on a
// narrow card the attendee signal is worth more than the time label, which the
// user can infer from the card's vertical position.
export const MIN_EVENT_WIDTH_FOR_ATTENDEE_BADGE = 56;
// All-day strips are a fixed EVENT_ALLDAY_HEIGHT tall, so width is the only
// meaningful gate. Higher than the timed card's because the all-day badge is
// in-flow and takes its room directly out of a single-line truncating title.
export const MIN_ALLDAY_WIDTH_FOR_ATTENDEE_BADGE = 72;
// Horizontal room the timed title reserves for the badge: the badge (~22px)
// plus its right-1 offset (4px), rounded up to the 4px spacing step. Applied to
// the title span only — applying it to the content wrapper would inset the time
// label too and clip it at MIN_EVENT_WIDTH_FOR_TIME_LABEL.
export const ATTENDEE_BADGE_TITLE_RESERVE_PX = 28;
export const EVENT_WIDTH_MINIMUM = 80;
// Narrowest a day column can get before the week view drops a day instead;
// wider than EVENT_WIDTH_MINIMUM so titles/time labels stay legible.
export const DAY_COLUMN_MIN_USABLE_WIDTH = 140;
export const DECK_INDENT = 16;
export const DECK_RIGHT_RESERVE = 24;
export const DECK_MIN_WIDTH = 72;
export const TIMED_EVENT_WIDTH_RATIO = 0.6;
export const TIMED_EVENT_MIN_WIDTH = 280;
export const TIMED_EVENT_FAN_INDENT = 44;
export const TIMED_EVENT_FAN_GUTTER = 120;
export const GRID_PADDING_BOTTOM = 20;
export const GRID_MARGIN_LEFT = 50;
export const GRID_TIME_STEP = 15;
export const TIMED_VISIBLE_HOURS = 13;
