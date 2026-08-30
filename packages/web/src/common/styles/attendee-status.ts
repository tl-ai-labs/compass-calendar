import { type AttendeeResponseStatus } from "@core/types/event-attendance.contracts";

/**
 * Canonical RSVP-status to semantic-token mapping shared by the form's attendee dots
 * and the grid card's badge. Typed as a total Record so adding a member to the core enum
 * is a compile error here rather than an undefined class at runtime.
 */
export const ATTENDEE_STATUS_DOT: Record<AttendeeResponseStatus, string> = {
  accepted: "bg-success",
  declined: "bg-error",
  tentative: "bg-warning",
  needsAction: "bg-text-subtle",
};

/**
 * Helper supplying prose for attendee RSVP status so colour is not the only signal.
 */
export const attendeeStatusLabel = (status: AttendeeResponseStatus): string =>
  status === "needsAction" ? "hasn't responded" : status;

/**
 * Aggregate noun phrase used after a count in the grid badge's group label.
 * Deliberately separate from attendeeStatusLabel, which is per-attendee prose:
 * reusing that after a count yields the ungrammatical "4 hasn't responded".
 * The explicit Record annotation makes a future addition to the core enum a
 * compile error here rather than a silently missing entry in the label.
 */
export const ATTENDEE_STATUS_COUNT_NOUN: Record<
  AttendeeResponseStatus,
  string
> = {
  accepted: "accepted",
  declined: "declined",
  tentative: "tentative",
  needsAction: "no response",
};

/**
 * The badge lists statuses in this order, most-actionable first. That is
 * deliberately NOT the order of AttendeeResponseStatusSchema.options, which
 * starts with needsAction and would put "no response" ahead of "accepted".
 * Order is taken from the Record's own insertion order, which the language
 * guarantees for non-numeric string keys, so the Record above is the single
 * source of both exhaustiveness and ordering. The one narrow cast is needed
 * only because Object.keys is typed as string[].
 */
export const ATTENDEE_STATUS_DISPLAY_ORDER = Object.keys(
  ATTENDEE_STATUS_COUNT_NOUN,
) as AttendeeResponseStatus[];
