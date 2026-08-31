import cn from "classnames";
import { type Attendee } from "@core/types/event-attendance.contracts";
import {
  ATTENDEE_STATUS_DOT,
  attendeeStatusLabel,
} from "@web/common/styles/attendee-status";

const MAX_BADGE_ATTENDEES = 3;

export interface AttendeeBadgeProps {
  attendees?: readonly Attendee[] | null;
  className?: string;
}

/**
 * Summarises RSVP state on grid cards and shares its colour mapping with the
 * event form's attendee list.
 */
export const AttendeeBadge = ({ attendees, className }: AttendeeBadgeProps) => {
  if (!attendees || attendees.length === 0) {
    return null;
  }

  const visibleAttendees = attendees.slice(0, MAX_BADGE_ATTENDEES);
  const overflowCount = attendees.length - visibleAttendees.length;
  const summaryLabel = `Attendees: ${attendees
    .map(
      (a) =>
        `${a.displayName ?? a.email} (${attendeeStatusLabel(a.responseStatus)})`,
    )
    .join(", ")}`;

  return (
    <div
      role="group"
      aria-label={summaryLabel}
      className={cn(
        "inline-flex shrink-0 select-none items-center gap-0.5",
        className,
      )}
    >
      {visibleAttendees.map((attendee) => {
        const name = attendee.displayName ?? attendee.email;
        const statusText = attendeeStatusLabel(attendee.responseStatus);
        return (
          <span
            key={attendee.email}
            aria-hidden="true"
            title={`${name}: ${statusText}`}
            className={cn(
              "size-1.5 shrink-0 rounded-full ring-1 ring-background/60",
              ATTENDEE_STATUS_DOT[attendee.responseStatus],
            )}
          />
        );
      })}
      {overflowCount > 0 && (
        <span
          aria-hidden="true"
          className="pl-0.5 font-medium text-[9px] leading-none opacity-80"
        >
          +{overflowCount}
        </span>
      )}
    </div>
  );
};
