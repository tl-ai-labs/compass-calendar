// Shared by the event form's attendee list and the grid attendee badge, so there is one source of truth.

import { type AttendeeResponseStatus } from "@core/types/event-attendance.contracts";

export const ATTENDEE_STATUS_DOT: Record<AttendeeResponseStatus, string> = {
  accepted: "bg-success",
  declined: "bg-error",
  tentative: "bg-warning",
  needsAction: "bg-text-subtle",
};

export const attendeeStatusLabel = (status: AttendeeResponseStatus): string =>
  status === "needsAction" ? "hasn't responded" : status;
