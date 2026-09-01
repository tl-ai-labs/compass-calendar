import { type AttendeeResponseStatus } from "@core/types/event-attendance.contracts";

/**
 * Re-exported so grid consumers import RSVP vocabulary from one place. This
 * does not redeclare or widen the enum — it is @core's type, verbatim.
 */
export type { AttendeeResponseStatus };

/**
 * The minimum shape the RSVP helpers need. GridEvent's
 * `readonly Attendee[] | undefined` satisfies it structurally, so no cast and
 * no @core value import is required at the call site.
 */
export type AttendeeStatusLike = {
  readonly responseStatus: AttendeeResponseStatus;
};

/**
 * Semantic fill token per RSVP status. Shared by the event form's attendee
 * list and the grid cards' attendee badge so the two surfaces can never drift
 * into two different palettes for the same state.
 */
export const ATTENDEE_STATUS_DOT: Record<AttendeeResponseStatus, string> = {
  accepted: "bg-success",
  declined: "bg-error",
  tentative: "bg-warning",
  needsAction: "bg-text-subtle",
};

/** Human text for a single attendee's RSVP. */
export const attendeeStatusLabel = (status: AttendeeResponseStatus): string =>
  status === "needsAction" ? "hasn't responded" : status;

// Worst-case precedence: declined > needsAction > tentative > accepted. A
// non-response outranks a tentative because it is the bigger scheduling risk —
// the meeting may not happen at all, where a tentative is an answered maybe.
// Private: callers depend on the ordering through aggregateAttendeeStatus, not
// on the numbers.
const ATTENDEE_STATUS_SEVERITY: Record<AttendeeResponseStatus, number> = {
  declined: 3,
  needsAction: 2,
  tentative: 1,
  accepted: 0,
};

/**
 * The single RSVP status that represents a whole attendee list. Returns null
 * when there is nothing to summarize, which is what the cards gate their badge
 * on.
 *
 * Non-mutating and allocation-free — reduce, never sort — so a `readonly`
 * attendee array straight off a GridEvent is safe to pass.
 */
export function aggregateAttendeeStatus(
  attendees: readonly AttendeeStatusLike[] | undefined,
): AttendeeResponseStatus | null {
  if (!attendees || attendees.length === 0) return null;
  return attendees.reduce<AttendeeResponseStatus>(
    (worst, attendee) =>
      ATTENDEE_STATUS_SEVERITY[attendee.responseStatus] >
      ATTENDEE_STATUS_SEVERITY[worst]
        ? attendee.responseStatus
        : worst,
    "accepted",
  );
}

/**
 * Wording for an aggregate over 2+ attendees. Each phrase is exactly true
 * under the precedence above: `accepted` is the severity floor, so the
 * aggregate is `accepted` if and only if every attendee accepted, and any
 * other value means at least one attendee is in that state.
 *
 * Names and emails are deliberately absent. The grid is on screen all day and
 * lands in every screenshare and support screenshot, so a card carries the
 * count and the aggregate state only; the event form remains the deliberate
 * place where attendee identities are shown.
 */
export const ATTENDEE_AGGREGATE_LABEL: Record<AttendeeResponseStatus, string> =
  {
    accepted: "all accepted",
    declined: "at least one declined",
    needsAction: "at least one hasn't responded",
    tentative: "at least one tentative",
  };

/**
 * Accessible summary folded into each grid card's aria-label, and the badge's
 * mouse-only title. A single attendee gets the form's own wording, since "at
 * least one" is stilted when there is exactly one; 2+ get the aggregate
 * wording.
 *
 * `count` is `attendees.length` verbatim, so the card and the form can never
 * disagree about the guest count. Taking `(status, count)` rather than the
 * attendee objects is what makes this function structurally incapable of
 * emitting a name or an email.
 */
export function attendeeSummaryLabel(
  status: AttendeeResponseStatus,
  count: number,
): string {
  const statusText =
    count === 1
      ? attendeeStatusLabel(status)
      : ATTENDEE_AGGREGATE_LABEL[status];
  return `${count} ${count === 1 ? "guest" : "guests"}, ${statusText}`;
}

/**
 * Above this the badge shows "9+" instead of the digits, so its rendered width
 * is bounded at two glyphs and the title reserve in grid.constants.ts stays
 * correct. The aria-label always announces the true count.
 */
export const ATTENDEE_COUNT_DISPLAY_MAX = 9;

export function attendeeCountLabel(count: number): string {
  return count > ATTENDEE_COUNT_DISPLAY_MAX
    ? `${ATTENDEE_COUNT_DISPLAY_MAX}+`
    : `${count}`;
}
