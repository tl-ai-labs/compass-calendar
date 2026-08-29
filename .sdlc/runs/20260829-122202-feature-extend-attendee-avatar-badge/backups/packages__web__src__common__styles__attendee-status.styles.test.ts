import { describe, expect, it } from "bun:test";

import { AttendeeResponseStatusSchema } from "@core/types/event-attendance.contracts";

import {
  ATTENDEE_STATUS_CLASSES,
  ATTENDEE_STATUS_DOT,
  ATTENDEE_STATUS_RING,
  attendeeStatusLabel,
} from "./attendee-status.styles";

// zod/v4 exposes the enum members as `.options` (a readonly tuple of the
// literal values); indexing the maps below with these type-checks directly.
const STATUSES = AttendeeResponseStatusSchema.options;

describe("attendee-status.styles", () => {
  it("gives every status a non-empty bg- and ring- variant", () => {
    for (const s of STATUSES) {
      const classes = ATTENDEE_STATUS_CLASSES[s];
      expect(classes.bg.startsWith("bg-")).toBe(true);
      expect(classes.bg.length).toBeGreaterThan("bg-".length);
      expect(classes.ring.startsWith("ring-")).toBe(true);
      expect(classes.ring.length).toBeGreaterThan("ring-".length);
    }
  });

  it("keeps bg and ring from drifting apart", () => {
    // Anti-typo guard: each ring class must be a mechanical `bg-` -> `ring-`
    // rewrite of its bg class. A hand-mistyped `ring-*` literal is one Tailwind
    // would never emit, so any drift renders a silently transparent ring.
    for (const s of STATUSES) {
      expect(ATTENDEE_STATUS_CLASSES[s].ring).toBe(
        ATTENDEE_STATUS_CLASSES[s].bg.replace("bg-", "ring-"),
      );
    }
  });

  it("preserves the inherited dot tokens", () => {
    expect(ATTENDEE_STATUS_DOT).toEqual({
      accepted: "bg-success",
      declined: "bg-error",
      tentative: "bg-warning",
      needsAction: "bg-text-subtle",
    });
  });

  it("projects the ring map straight from the source classes", () => {
    for (const s of STATUSES) {
      expect(ATTENDEE_STATUS_RING[s]).toBe(ATTENDEE_STATUS_CLASSES[s].ring);
    }
  });

  it("has no status missing from either projection", () => {
    const members = [...STATUSES].sort();
    expect(Object.keys(ATTENDEE_STATUS_DOT).sort()).toEqual(members);
    expect(Object.keys(ATTENDEE_STATUS_RING).sort()).toEqual(members);
  });

  it("labels needsAction as prose and round-trips the rest", () => {
    expect(attendeeStatusLabel("needsAction")).toBe("hasn't responded");
    expect(attendeeStatusLabel("accepted")).toBe("accepted");
    expect(attendeeStatusLabel("declined")).toBe("declined");
    expect(attendeeStatusLabel("tentative")).toBe("tentative");
  });
});
