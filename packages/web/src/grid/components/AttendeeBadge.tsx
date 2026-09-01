import cn from "classnames";
import { type CSSProperties } from "react";
import {
  ATTENDEE_STATUS_DOT,
  type AttendeeResponseStatus,
  attendeeCountLabel,
  attendeeSummaryLabel,
} from "@web/grid/components/attendee-status.util";

/**
 * Stable DOM hook for tests, in the same shape as
 * EVENT_RESIZE_HANDLE_ATTRIBUTE / EVENT_TIME_LABEL_ATTRIBUTE. It lives here
 * rather than in grid/interaction/dom.ts because the badge is
 * pointer-events-none and is not an interaction target.
 */
export const ATTENDEE_BADGE_ATTRIBUTE = "data-attendee-badge";

interface Props {
  /**
   * Placement classes supplied by the host card. The two cards mount the badge
   * differently — absolute on the timed card, in-flow on the all-day strip —
   * because their content wrappers are a column and a row respectively.
   */
  className?: string;
  /** attendees.length, verbatim. Rendered capped at 9+. */
  count: number;
  status: AttendeeResponseStatus;
  /** The host card's already-computed contrast text color. */
  style?: CSSProperties;
}

/**
 * The attendee indicator shared by the timed and all-day grid cards: one dot
 * colored by the worst-case aggregate RSVP status, plus the guest count.
 * Decorative in full — the RSVP state is announced through each card's
 * aria-label, so the whole badge is aria-hidden and `title` is a mouse-only
 * affordance mirroring the event form's attendee dot. Carries no attendee name
 * or email by design.
 */
export const AttendeeBadge = ({ className, count, status, style }: Props) => (
  <span
    aria-hidden="true"
    {...{ [ATTENDEE_BADGE_ATTRIBUTE]: "true" }}
    className={cn(
      "pointer-events-none flex shrink-0 items-center gap-0.5 text-[10px] leading-none",
      className,
    )}
    style={style}
    title={attendeeSummaryLabel(status, count)}
  >
    <span
      className={`size-2 shrink-0 rounded-full ${ATTENDEE_STATUS_DOT[status]}`}
    />
    {attendeeCountLabel(count)}
  </span>
);
