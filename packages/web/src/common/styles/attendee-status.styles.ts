import { type AttendeeResponseStatus } from "@core/types/event-attendance.contracts";

/**
 * Single source of truth for the RSVP status -> semantic color relationship,
 * shared by the event form's attendee dots and the grid cards' attendee badge.
 *
 * Tailwind v4 scans source text for whole class names, so BOTH variants are
 * written out as complete literals here. Never build one of these with a
 * template literal (`ring-${status}`) at a call site - the class would not be
 * emitted into the stylesheet and the ring would silently render transparent.
 *
 * Typed as a total Record over AttendeeResponseStatus so a new enum member in
 * @core/types/event-attendance.contracts is a compile error here rather than an
 * `undefined` className at runtime.
 */
export const ATTENDEE_STATUS_CLASSES: Record<
  AttendeeResponseStatus,
  { bg: string; ring: string }
> = {
  accepted: { bg: "bg-success", ring: "ring-success" },
  declined: { bg: "bg-error", ring: "ring-error" },
  tentative: { bg: "bg-warning", ring: "ring-warning" },
  needsAction: { bg: "bg-text-subtle", ring: "ring-text-subtle" },
};

// Computed once at module load, not per render. The cast is the one place the
// projection loses Record totality; ATTENDEE_STATUS_CLASSES above is where
// exhaustiveness is actually enforced.
const projectVariant = (
  variant: "bg" | "ring",
): Record<AttendeeResponseStatus, string> =>
  Object.fromEntries(
    Object.entries(ATTENDEE_STATUS_CLASSES).map(([status, classes]) => [
      status,
      classes[variant],
    ]),
  ) as Record<AttendeeResponseStatus, string>;

/** Background fill for the form's attendee status dot. */
export const ATTENDEE_STATUS_DOT: Record<AttendeeResponseStatus, string> =
  projectVariant("bg");

/** Ring color for the grid cards' attendee avatar circles. */
export const ATTENDEE_STATUS_RING: Record<AttendeeResponseStatus, string> =
  projectVariant("ring");

/**
 * Human-readable RSVP status for accessible text. Lifted here alongside the
 * color map (FR-A3) because color alone must never be the only signal, and both
 * the form rows and the grid badge need the same wording.
 */
export const attendeeStatusLabel = (status: AttendeeResponseStatus): string =>
  status === "needsAction" ? "hasn't responded" : status;
