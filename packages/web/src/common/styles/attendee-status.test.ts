import { AttendeeResponseStatusSchema } from "@core/types/event-attendance.contracts";
import {
  ATTENDEE_STATUS_COUNT_NOUN,
  ATTENDEE_STATUS_DISPLAY_ORDER,
  ATTENDEE_STATUS_DOT,
  attendeeStatusLabel,
} from "./attendee-status";
import { describe, expect, it } from "bun:test";

describe("attendee-status", () => {
  it("maps every response status to its semantic token", () => {
    expect(ATTENDEE_STATUS_DOT.accepted).toBe("bg-success");
    expect(ATTENDEE_STATUS_DOT.declined).toBe("bg-error");
    expect(ATTENDEE_STATUS_DOT.tentative).toBe("bg-warning");
    expect(ATTENDEE_STATUS_DOT.needsAction).toBe("bg-text-subtle");
  });

  it("is exhaustive over AttendeeResponseStatusSchema", () => {
    for (const status of AttendeeResponseStatusSchema.options) {
      expect(ATTENDEE_STATUS_DOT[status]).toBeDefined();
      expect(typeof attendeeStatusLabel(status)).toBe("string");
    }

    // Catches both a missing key after an enum addition and a stale key after a removal
    expect(Object.keys(ATTENDEE_STATUS_DOT).length).toBe(
      AttendeeResponseStatusSchema.options.length,
    );
  });

  it("gives needsAction readable prose and passes other statuses through", () => {
    expect(attendeeStatusLabel("needsAction")).toBe("hasn't responded");
    expect(attendeeStatusLabel("accepted")).toBe("accepted");
    expect(attendeeStatusLabel("declined")).toBe("declined");
    expect(attendeeStatusLabel("tentative")).toBe("tentative");
  });

  it("gives every status an aggregate noun that reads correctly after a count", () => {
    // "no response" is what makes "4 guests: 4 no response" grammatical.
    // attendeeStatusLabel would have produced "4 hasn't responded".
    expect(ATTENDEE_STATUS_COUNT_NOUN.accepted).toBe("accepted");
    expect(ATTENDEE_STATUS_COUNT_NOUN.declined).toBe("declined");
    expect(ATTENDEE_STATUS_COUNT_NOUN.tentative).toBe("tentative");
    expect(ATTENDEE_STATUS_COUNT_NOUN.needsAction).toBe("no response");
  });

  it("is exhaustive over AttendeeResponseStatusSchema for aggregate nouns", () => {
    for (const status of AttendeeResponseStatusSchema.options) {
      expect(typeof ATTENDEE_STATUS_COUNT_NOUN[status]).toBe("string");
      expect(ATTENDEE_STATUS_COUNT_NOUN[status].length).toBeGreaterThan(0);
    }
    expect(Object.keys(ATTENDEE_STATUS_COUNT_NOUN).length).toBe(
      AttendeeResponseStatusSchema.options.length,
    );
  });

  it("orders the display sequence most-actionable first, not enum order", () => {
    expect(ATTENDEE_STATUS_DISPLAY_ORDER).toEqual([
      "accepted",
      "declined",
      "tentative",
      "needsAction",
    ]);
    // The enum itself starts with needsAction; the badge must not.
    expect(ATTENDEE_STATUS_DISPLAY_ORDER).not.toEqual(
      AttendeeResponseStatusSchema.options,
    );
    for (const status of AttendeeResponseStatusSchema.options) {
      expect(ATTENDEE_STATUS_DISPLAY_ORDER).toContain(status);
    }
  });
});
