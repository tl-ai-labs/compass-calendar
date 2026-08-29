import cn from "classnames";
import { type Attendee } from "@core/types/event-attendance.contracts";
import {
  ATTENDEE_STATUS_RING,
  attendeeStatusLabel,
} from "@web/common/styles/attendee-status.styles";
import { type GridEvent } from "@web/common/types/web.event.types";
import { ATTENDEE_BADGE_MAX_VISIBLE } from "@web/grid/components/attendee-badge.constants";

interface Props {
  attendees: GridEvent["attendees"];
  /** Extra classes for the badge root; used by AllDayEventCard for its
   * single-row left margin. Kept as a prop so the timed card's stacked layout
   * does not inherit spacing it does not want. */
  className?: string;
}

const attendeeInitials = ({ displayName, email }: Attendee): string => {
  const name = displayName?.trim();
  if (name) {
    return name
      .split(/\s+/)
      .slice(0, 2)
      .map((word) => word[0] ?? "")
      .join("")
      .toUpperCase();
  }
  return (email[0] ?? "?").toUpperCase();
};

const attendeeBadgeLabel = (
  total: number,
  visible: readonly Attendee[],
  overflowCount: number,
): string => {
  const parts = visible.map(
    (attendee) =>
      `${attendee.displayName ?? attendee.email}, ${attendeeStatusLabel(attendee.responseStatus)}`,
  );
  if (overflowCount > 0) parts.push(`${overflowCount} more`);
  return `${total} ${total === 1 ? "guest" : "guests"}: ${parts.join("; ")}`;
};

/**
 * Stacked attendee avatar circles for the grid event cards, ringed by RSVP
 * status. Purely presentational and pointer-transparent so the card's drag and
 * resize handlers keep every event that lands on it.
 *
 * Returns null - not an empty wrapper - when there are no attendees, so the
 * majority of cards (Compass-native and busy-projection events carry no
 * attendees) render byte-identical DOM to before this component existed.
 */
export const EventAttendeeBadge = ({ attendees, className }: Props) => {
  if (!attendees || attendees.length === 0) return null;

  const visible = attendees.slice(0, ATTENDEE_BADGE_MAX_VISIBLE);
  const overflowCount = attendees.length - visible.length;

  return (
    <div
      aria-label={attendeeBadgeLabel(attendees.length, visible, overflowCount)}
      className={cn(
        "-space-x-1 pointer-events-none flex shrink-0 items-center",
        className,
      )}
    >
      {visible.map((attendee) => (
        <span
          key={attendee.email}
          aria-hidden="true"
          className={cn(
            "flex size-3.5 shrink-0 items-center justify-center rounded-full bg-surface-raised text-text text-xs leading-none ring-2",
            ATTENDEE_STATUS_RING[attendee.responseStatus],
          )}
        >
          {attendeeInitials(attendee)}
        </span>
      ))}
      {overflowCount > 0 && (
        <span
          aria-hidden="true"
          className="flex h-3.5 shrink-0 items-center justify-center rounded-full bg-surface-raised px-1 text-text-muted text-xs leading-none ring-2 ring-border-strong"
        >
          +{overflowCount}
        </span>
      )}
    </div>
  );
};
