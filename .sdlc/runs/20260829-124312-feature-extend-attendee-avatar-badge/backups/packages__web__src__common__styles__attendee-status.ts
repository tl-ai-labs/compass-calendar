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
