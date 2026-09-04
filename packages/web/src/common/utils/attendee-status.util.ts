import {
  type Attendee,
  type AttendeeResponseStatus,
} from "@core/types/event-attendance.contracts";

/**
 * Single source of truth for the RSVP status -> semantic color token map,
 * shared by the event form's attendee list and the grid card's AttendeeBadge.
 * Values are semantic tokens (index.css), never raw palette utilities.
 */
export const ATTENDEE_STATUS_DOT: Record<AttendeeResponseStatus, string> = {
  accepted: "bg-success",
  declined: "bg-error",
  tentative: "bg-warning",
  needsAction: "bg-text-subtle",
};

export const attendeeStatusLabel = (status: AttendeeResponseStatus): string =>
  status === "needsAction" ? "hasn't responded" : status;

// Fixed reporting order so the summary sentence is deterministic regardless of
// the provider's attendee ordering. Not a precedence rule - every non-zero
// status is reported, this only fixes the sequence.
const ATTENDEE_STATUS_SUMMARY_ORDER: readonly AttendeeResponseStatus[] = [
  "accepted",
  "declined",
  "tentative",
  "needsAction",
];

/**
 * Names-free accessible summary of an attendee list, e.g.
 * "3 guests: 2 accepted, 1 hasn't responded".
 *
 * Deliberately carries counts and status words only - no displayName, no
 * email. This text lands in the card's accessible description and therefore
 * in every DOM snapshot; a grid is a shoulder-surfable surface, so no personal
 * identifier goes into it (PII-1 / PII-2).
 *
 * Reads the array without sorting, splicing or reversing it; `attendees` is
 * `readonly` and may be frozen (NFR-6).
 */
export const attendeeStatusSummary = (
  attendees: readonly Attendee[],
): string => {
  if (attendees.length === 0) return "";

  const counts: Partial<Record<AttendeeResponseStatus, number>> = {};
  for (const attendee of attendees) {
    counts[attendee.responseStatus] =
      (counts[attendee.responseStatus] ?? 0) + 1;
  }

  const parts = ATTENDEE_STATUS_SUMMARY_ORDER.filter(
    (status) => (counts[status] ?? 0) > 0,
  ).map((status) => `${counts[status]} ${attendeeStatusLabel(status)}`);

  const noun = attendees.length === 1 ? "guest" : "guests";

  return `${attendees.length} ${noun}: ${parts.join(", ")}`;
};
