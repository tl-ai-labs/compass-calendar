import cn from "classnames";
import { type Attendee } from "@core/types/event-attendance.contracts";
import { darken } from "@web/common/styles/color.utils";
import {
  ATTENDEE_STATUS_DOT,
  attendeeStatusSummary,
} from "@web/common/utils/attendee-status.util";

// Three is what fits. A grid card is 140px wide at the badge's own width gate;
// after the card's pl-1.25 (5px), its pr-0.75 (3px) and the 14px EventRepeatIcon
// reserve (right-1 + size 10), the badge's own column is 35px at most: three
// 6px dots (`size-1.5`) + two 2px gaps = 22px, plus a 2px gap and an ~11px
// "+9" counter. A fourth dot pushes that to 43px and eats the all-day card's
// title budget below a readable width. EventDetailsSection's
// MAX_VISIBLE_ATTENDEES = 6 is sized for a 320px form column, not for this.
export const MAX_VISIBLE_ATTENDEE_DOTS = 3;

// Deliberately stricter than the 90px MIN_EVENT_WIDTH_FOR_TIME_LABEL gate: the
// badge costs the timed card up to 56px of reserved right padding, which is
// unaffordable on a very narrow card.
//
// This is NOT DAY_COLUMN_MIN_USABLE_WIDTH (grid.constants.ts:33), which also
// happens to be 140. That constant is the minimum width of a whole day COLUMN
// and is used by week-window.util.ts to decide how many columns fit the track.
// A card is not a column: overlapping events divide a column by
// position.widthMultiplier, so a card is routinely half a column wide. The two
// numbers coincide today by accident, and tying the badge's legibility gate to
// the week's column-count arithmetic would couple two unrelated things - a
// later change to how many columns fit a screen would silently change which
// cards show a badge. Kept local and deliberate, not drift.
export const MIN_EVENT_WIDTH_FOR_ATTENDEE_BADGE = 140;

// Second, higher gate: the width below which the badge YIELDS TO THE TIME
// LABEL rather than coexisting with it. Applies only when the time label is
// actually showing (see the predicate in TimedEventCard).
//
// Derived from the COMMON label, not the worst case. `_cleanStartMeridiem`
// (web.date.util.ts) drops the start meridiem whenever both ends share one, so
// the overwhelming majority of labels are same-meridiem and short:
//   "9 - 10 AM"          ~48px
//   "10:30 - 11 AM"      ~69px
//   "10:30 - 11:45 AM"   ~85px   <- same-meridiem worst case, the design point
//   "11:30 AM - 12:45 PM" ~108px <- cross-meridiem outlier, deliberately NOT
//                                   the design point (see below)
//
// Sizing against the same-meridiem worst case at 11px:
//   pl-1.25 left padding                                         5px
//   "10:30 - 11:45 AM": 8 digits @ ~6.1 + 2 letters @ ~8.3
//     + 2 colons/3 spaces @ ~3.1 + 1 hyphen @ ~3.6         ~=   85px
//   pr-14 worst-case reserve (badge + repeat icon)               56px
//                                                         -----------
//                                                              146px
// Rounded up to 150 for margin against font-metric variance.
//
// This was 170 until the R-6 review finding. 170 was derived from the
// cross-meridiem outlier, and the consequence was that a full-width timed card
// in the Week view never cleared it on a typical 1440px laptop (column width is
// pinned to the 140-170 band by computeVisibleDayCount), so a 30-minute event
// showed a badge while the 60-minute event below it did not - the label gate
// only binds on cards >= 36px tall. That inconsistency was worse than the
// clipping it prevented.
//
// ACCEPTED TRADE: between 140 and 168 a cross-meridiem range like
// "11:30 AM - 12:45 PM" (~108px) still overflows the content column and is
// clipped by the card's overflow-hidden. Same-meridiem labels - the common case
// - fit from 146px up, and every label fits from 169px up.
//
// Single constant rather than one per reserve size: on a non-recurring card the
// reserve is pr-10 (40px) and the true threshold would be 130px, below the
// floor. Cards between 140 and 150 are therefore suppressed slightly more
// eagerly than strictly necessary. Deliberate - two width gates that differ by
// whether a repeat icon happens to be visible is worse to reason about than
// 10px of caution.
export const MIN_EVENT_WIDTH_FOR_BADGE_WITH_TIME_LABEL = 150;

// Carries no attendee data - the literal string "true" only (PII-3).
export const ATTENDEE_BADGE_ATTRIBUTE = "data-attendee-badge";

export const hasAttendeesToShow = (
  attendees: readonly Attendee[] | undefined,
): attendees is readonly Attendee[] => (attendees?.length ?? 0) > 0;

export interface AttendeeBadgeProps {
  attendees: readonly Attendee[] | undefined;
  baseColor: string;
  className?: string;
  descriptionId: string;
}

/**
 * Compact RSVP indicator for a grid event card: up to
 * MAX_VISIBLE_ATTENDEE_DOTS status dots plus a "+N" counter.
 *
 * The dots are `aria-hidden` - color alone is not an accessible signal (the
 * rule documented at EventDetailsSection.tsx:72-75). The accessible equivalent
 * is the `sr-only` span below, which the host card references with
 * `aria-describedby`. It is referenced rather than nested-with-a-name because
 * the card is `role="button"`, whose descendants are children-presentational
 * and are pruned from the accessibility tree; an IDREF description is computed
 * from the referenced subtree regardless, and it does not touch the card's
 * accessible NAME.
 *
 * `pointer-events-none` on the root: the badge overlaps the cards' invisible
 * 4.5px resize handles and must stay out of `elementFromPoint` (FR-11 / AC-10).
 */
export const AttendeeBadge = ({
  attendees,
  baseColor,
  className,
  descriptionId,
}: AttendeeBadgeProps) => {
  if (!hasAttendeesToShow(attendees)) return null;

  // slice() copies; the source array is readonly and may be frozen (NFR-6).
  // Provider order is preserved - ranking statuses would invent product
  // semantics, and the sr-only summary reports every attendee anyway.
  const visibleAttendees = attendees.slice(0, MAX_VISIBLE_ATTENDEE_DOTS);
  const overflowCount = attendees.length - visibleAttendees.length;

  return (
    <span
      {...{ [ATTENDEE_BADGE_ATTRIBUTE]: "true" }}
      className={cn(
        "pointer-events-none inline-flex items-center gap-0.5",
        className,
      )}
    >
      <span aria-hidden="true" className="inline-flex items-center gap-0.5">
        {visibleAttendees.map((attendee) => (
          <span
            key={attendee.email}
            className={`size-1.5 shrink-0 rounded-full ${ATTENDEE_STATUS_DOT[attendee.responseStatus]}`}
          />
        ))}
        {overflowCount > 0 && (
          <span
            className="shrink-0 text-[8px] leading-none"
            style={{ color: darken(baseColor, 30) }}
          >
            +{overflowCount}
          </span>
        )}
      </span>
      <span className="sr-only" id={descriptionId}>
        {attendeeStatusSummary(attendees)}
      </span>
    </span>
  );
};
