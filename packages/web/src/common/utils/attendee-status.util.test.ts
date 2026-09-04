import { type Attendee } from "@core/types/event-attendance.contracts";
import {
  ATTENDEE_STATUS_DOT,
  attendeeStatusLabel,
  attendeeStatusSummary,
} from "./attendee-status.util";
import { describe, expect, it } from "bun:test";

describe("attendee-status.util", () => {
  it("U-1: maps RSVP status to semantic color tokens", () => {
    expect(ATTENDEE_STATUS_DOT).toEqual({
      accepted: "bg-success",
      declined: "bg-error",
      tentative: "bg-warning",
      needsAction: "bg-text-subtle",
    });
  });

  it('U-2: formats needsAction as "hasn\'t responded"', () => {
    expect(attendeeStatusLabel("needsAction")).toBe("hasn't responded");
  });

  it("U-3: returns the status string itself for accepted, declined, and tentative", () => {
    expect(attendeeStatusLabel("accepted")).toBe("accepted");
    expect(attendeeStatusLabel("declined")).toBe("declined");
    expect(attendeeStatusLabel("tentative")).toBe("tentative");
  });

  it("U-4: returns empty string for empty attendee list", () => {
    expect(attendeeStatusSummary([])).toBe("");
  });

  it("U-5: formats one accepted attendee with singular guest noun", () => {
    const attendees: Attendee[] = [
      {
        displayName: "Ada Lovelace",
        email: "ada@example.com",
        responseStatus: "accepted",
      },
    ];
    expect(attendeeStatusSummary(attendees)).toBe("1 guest: 1 accepted");
  });

  it("U-6: formats multiple attendees with plural guests noun", () => {
    const attendees: Attendee[] = [
      {
        displayName: "Ada Lovelace",
        email: "ada@example.com",
        responseStatus: "accepted",
      },
      {
        displayName: "Charles Babbage",
        email: "charles@example.com",
        responseStatus: "accepted",
      },
      {
        displayName: "Grace Hopper",
        email: "grace@example.com",
        responseStatus: "needsAction",
      },
    ];
    expect(attendeeStatusSummary(attendees)).toBe(
      "3 guests: 2 accepted, 1 hasn't responded",
    );
  });

  it("U-7: fixes reporting order when statuses are supplied in reverse order", () => {
    const reverseOrderAttendees: Attendee[] = [
      {
        displayName: "Grace Hopper",
        email: "grace@example.com",
        responseStatus: "needsAction",
      },
      {
        displayName: "Margaret Hamilton",
        email: "margaret@example.com",
        responseStatus: "tentative",
      },
      {
        displayName: "Charles Babbage",
        email: "charles@example.com",
        responseStatus: "declined",
      },
      {
        displayName: "Ada Lovelace",
        email: "ada@example.com",
        responseStatus: "accepted",
      },
    ];
    expect(attendeeStatusSummary(reverseOrderAttendees)).toBe(
      "4 guests: 1 accepted, 1 declined, 1 tentative, 1 hasn't responded",
    );
  });

  it("U-8: handles frozen array input without throwing and returns expected string", () => {
    const frozenAttendees = Object.freeze([
      {
        displayName: "Ada Lovelace",
        email: "ada@example.com",
        responseStatus: "accepted" as const,
      },
      {
        displayName: "Charles Babbage",
        email: "charles@example.com",
        responseStatus: "declined" as const,
      },
    ]);
    expect(() => attendeeStatusSummary(frozenAttendees)).not.toThrow();
    expect(attendeeStatusSummary(frozenAttendees)).toBe(
      "2 guests: 1 accepted, 1 declined",
    );
  });

  it("U-9: contains no PII in the summary", () => {
    const attendees: Attendee[] = [
      {
        displayName: "Ada Lovelace",
        email: "ada@example.com",
        responseStatus: "accepted",
      },
      {
        displayName: "Grace Hopper",
        email: "grace@example.com",
        responseStatus: "needsAction",
      },
    ];
    const summary = attendeeStatusSummary(attendees);
    expect(summary).not.toContain("@");
    expect(summary).not.toContain("ada@example.com");
    expect(summary).not.toContain("Ada");
    expect(summary).not.toContain("Ada Lovelace");
    expect(summary).not.toContain("grace@example.com");
    expect(summary).not.toContain("Grace");
    expect(summary).not.toContain("Grace Hopper");
  });
});
