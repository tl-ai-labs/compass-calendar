import { UserIcon } from "@phosphor-icons/react";
import cn from "classnames";
import {
  type Attendee,
  type AttendeeResponseStatus,
} from "@core/types/event-attendance.contracts";
import {
  ATTENDEE_STATUS_COUNT_NOUN,
  ATTENDEE_STATUS_DISPLAY_ORDER,
  ATTENDEE_STATUS_DOT,
} from "@web/common/styles/attendee-status";
import { darken } from "@web/common/styles/color.utils";
import { theme } from "@web/common/styles/theme";

/** Grid cards are far narrower than the form panel (which shows 6), so three
 *  elements is the most that reads as a row rather than a smear. */
export const MAX_VISIBLE_ATTENDEES = 3;

/** Rendered height of the badge row, in px. TimedEventCard subtracts this from
 *  the height it hands getLineClamp, the same way it already subtracts
 *  GRID_EVENT_TIME_LABEL_LINE_HEIGHT, so the badge takes its row from the
 *  title's clamp instead of pushing the card past its clipped edge. Must equal
 *  the avatar box size (size-4 = 16px); the row has no extra leading. */
export const ATTENDEE_BADGE_LINE_HEIGHT = 16;

/** One title line (16) + the time label (13) + the badge row (16) + the slack
 *  getLineClamp reserves (7) = 52. Below this the badge would eat the last
 *  title line, so it is suppressed instead. Comfortably above
 *  COMPACT_EVENT_MAX_HEIGHT (15), so a compact card never shows a badge. */
export const MIN_EVENT_HEIGHT_FOR_ATTENDEE_BADGE = 52;

/** At this width the content box is 90 - 5 (pl-1.25) - 3 (pr-0.75) = 82px. A
 *  full badge is 3 * 16 + 2 * 2 (gap-0.5) = 52px and EventRepeatIcon reserves
 *  ~14px at the right edge; 52 + 14 = 66 < 82, so the two can never collide. */
export const MIN_EVENT_WIDTH_FOR_ATTENDEE_BADGE = 90;

/** Wider than the timed gate: the all-day badge shares one horizontal row with
 *  the title, so it has to leave the title something to truncate into. */
export const MIN_ALLDAY_WIDTH_FOR_ATTENDEE_BADGE = 120;

/** A monogram is a single letter or digit. Anything else - punctuation, an
 *  emoji, whitespace-only, or null - falls back to the person glyph. The
 *  precise invariant: exactly one attendee-supplied character can reach the
 *  DOM - the uppercased first code point - and only when it matches \p{L} or
 *  \p{N}. So no attendee-supplied string longer than one character, and no
 *  "@", can reach the rendered monogram or any label. The per-avatar title
 *  attribute was removed, so no other attendee-supplied text reaches the DOM.
 *  Do not restate this as "no attendee-supplied text reaches the DOM": the
 *  monogram is attendee-supplied, and that overclaim was a review finding. */
const MONOGRAM_CHARACTER = /^[\p{L}\p{N}]$/u;

const monogramFor = (displayName: string | null): string | null => {
  const trimmed = displayName?.trim() ?? "";
  // Destructuring a string uses the string iterator, which yields a whole code
  // point - charAt(0) would split a surrogate pair into a lone half.
  const [first = ""] = trimmed;
  return MONOGRAM_CHARACTER.test(first) ? first.toUpperCase() : null;
};

/** Walks the full list once with a plain integer accumulator per status.
 *  Deliberately not a per-status .filter(...).length - that would allocate one
 *  intermediate array per status on the grid's hot path. Do not "optimize" this
 *  into filters. */
const countByStatus = (
  attendees: readonly Attendee[],
): Record<AttendeeResponseStatus, number> => {
  const counts: Record<AttendeeResponseStatus, number> = {
    accepted: 0,
    declined: 0,
    tentative: 0,
    needsAction: 0,
  };
  for (const attendee of attendees) {
    counts[attendee.responseStatus] += 1;
  }
  return counts;
};

interface EventAttendeeBadgeProps {
  /** Exactly GridEvent["attendees"]: z.array(AttendeeSchema).readonly()
   *  .optional() infers `readonly Attendee[] | undefined`. Declared as a
   *  required key that accepts undefined so exactOptionalPropertyTypes cannot
   *  bite at the call site. No cast anywhere. */
  attendees: readonly Attendee[] | undefined;
  /** The card's resolved fill, passed in the way EventRepeatIcon takes it, so
   *  the badge never calls useEventPalette itself and cannot disagree with the
   *  card about what state (past / hover / draft) the fill is in. */
  baseColor: string;
  className?: string;
}

/**
 * The grid card's compact attendee row: up to three status-ringed avatar discs
 * and a +N overflow chip. Decorative and pointer-inert so it cannot interfere
 * with the card's drag, resize and select handling.
 *
 * The status ring is decorative for sighted users - hue is the only visual
 * status cue, which is an accepted trade-off at this size (see design.md
 * section 8). The accessible status channel is the group label on the root,
 * which carries the full breakdown ("3 guests: 2 accepted, 1 declined") and
 * omits zero-count statuses. Individual identities are never announced, and no
 * attendee-supplied string is written to the DOM beyond the single whitelisted
 * monogram character; attendee email is used only as a React key.
 */
export const EventAttendeeBadge = ({
  attendees,
  baseColor,
  className,
}: EventAttendeeBadgeProps) => {
  if (!attendees || attendees.length === 0) return null;

  const avatarCount =
    attendees.length > MAX_VISIBLE_ATTENDEES
      ? MAX_VISIBLE_ATTENDEES - 1
      : attendees.length;
  const overflowCount = attendees.length - avatarCount; // 0 when nothing hidden
  const visible = attendees.slice(0, avatarCount);

  const counts = countByStatus(attendees);
  const countDetails = ATTENDEE_STATUS_DISPLAY_ORDER.filter(
    (status) => counts[status] > 0,
  )
    .map((status) => `${counts[status]} ${ATTENDEE_STATUS_COUNT_NOUN[status]}`)
    .join(", ");
  const groupLabel = `${attendees.length} ${
    attendees.length === 1 ? "guest" : "guests"
  }: ${countDetails}`;

  const discColor = darken(baseColor, 30);
  const discTextColor = theme.getContrastText(discColor);

  return (
    <span
      aria-label={groupLabel}
      className={cn(
        "pointer-events-none flex h-4 shrink-0 select-none items-center gap-0.5",
        className,
      )}
      data-testid="event-attendee-badge"
      role="img"
    >
      {visible.map((attendee) => {
        const monogram = monogramFor(attendee.displayName);
        return (
          <span
            key={attendee.email}
            className={cn(
              "flex size-4 shrink-0 items-center justify-center rounded-full p-0.5",
              ATTENDEE_STATUS_DOT[attendee.responseStatus],
            )}
            data-testid="event-attendee-avatar"
          >
            <span
              className="flex size-full items-center justify-center rounded-full text-[8px] leading-none"
              style={{ backgroundColor: discColor, color: discTextColor }}
            >
              {monogram ?? (
                <UserIcon aria-hidden="true" size={8} weight="fill" />
              )}
            </span>
          </span>
        );
      })}
      {overflowCount > 0 && (
        <span
          className="flex size-4 shrink-0 items-center justify-center rounded-full text-[8px] leading-none"
          data-testid="event-attendee-overflow"
          style={{ backgroundColor: discColor, color: discTextColor }}
        >
          {`+${overflowCount}`}
        </span>
      )}
    </span>
  );
};
