import { AttendeeResponseStatusSchema } from "@core/types/event-attendance.contracts";
import { ATTENDEE_STATUS_DOT, attendeeStatusLabel } from "./attendee-status";
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
});
