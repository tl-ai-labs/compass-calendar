import {
  ATTENDEE_STATUS_DOT,
  type AttendeeResponseStatus,
  type AttendeeStatusLike,
  aggregateAttendeeStatus,
  attendeeCountLabel,
  attendeeStatusLabel,
  attendeeSummaryLabel,
} from "./attendee-status.util";
import { describe, expect, it } from "bun:test";

const guest = (responseStatus: AttendeeResponseStatus): AttendeeStatusLike => ({
  responseStatus,
});

describe("ATTENDEE_STATUS_DOT", () => {
  it("maps every RSVP status to its semantic fill token", () => {
    expect(ATTENDEE_STATUS_DOT).toEqual({
      accepted: "bg-success",
      declined: "bg-error",
      tentative: "bg-warning",
      needsAction: "bg-text-subtle",
    });
  });
});

describe("attendeeStatusLabel", () => {
  it("spells out the unanswered state", () => {
    expect(attendeeStatusLabel("needsAction")).toBe("hasn't responded");
  });

  it("passes answered statuses through verbatim", () => {
    expect(attendeeStatusLabel("accepted")).toBe("accepted");
    expect(attendeeStatusLabel("declined")).toBe("declined");
    expect(attendeeStatusLabel("tentative")).toBe("tentative");
  });
});

describe("aggregateAttendeeStatus", () => {
  it("has nothing to summarize for a missing attendee list", () => {
    expect(aggregateAttendeeStatus(undefined)).toBeNull();
  });

  it("has nothing to summarize for an empty attendee list", () => {
    expect(aggregateAttendeeStatus([])).toBeNull();
  });

  it("returns the only attendee's status", () => {
    expect(aggregateAttendeeStatus([guest("accepted")])).toBe("accepted");
    expect(aggregateAttendeeStatus([guest("declined")])).toBe("declined");
    expect(aggregateAttendeeStatus([guest("tentative")])).toBe("tentative");
    expect(aggregateAttendeeStatus([guest("needsAction")])).toBe("needsAction");
  });

  it("ranks a decline above every other response", () => {
    expect(
      aggregateAttendeeStatus([
        guest("accepted"),
        guest("tentative"),
        guest("needsAction"),
        guest("declined"),
      ]),
    ).toBe("declined");
    expect(
      aggregateAttendeeStatus([guest("declined"), guest("accepted")]),
    ).toBe("declined");
  });

  it("ranks a missing response above a tentative one", () => {
    expect(
      aggregateAttendeeStatus([
        guest("accepted"),
        guest("tentative"),
        guest("needsAction"),
      ]),
    ).toBe("needsAction");
  });

  it("ranks a tentative response above an acceptance", () => {
    expect(
      aggregateAttendeeStatus([
        guest("accepted"),
        guest("tentative"),
        guest("accepted"),
      ]),
    ).toBe("tentative");
  });

  it("reports acceptance only when every attendee accepted", () => {
    expect(
      aggregateAttendeeStatus([
        guest("accepted"),
        guest("accepted"),
        guest("accepted"),
      ]),
    ).toBe("accepted");
  });

  it("is order-independent for ties", () => {
    expect(
      aggregateAttendeeStatus([guest("declined"), guest("declined")]),
    ).toBe("declined");
    expect(
      aggregateAttendeeStatus([guest("declined"), guest("needsAction")]),
    ).toBe("declined");
    expect(
      aggregateAttendeeStatus([guest("needsAction"), guest("declined")]),
    ).toBe("declined");
  });

  it("does not mutate or reorder the caller's array", () => {
    const list = [guest("accepted"), guest("declined")];
    const snapshot = [...list];

    aggregateAttendeeStatus(list);

    expect(list).toEqual(snapshot);
    expect(list[0]?.responseStatus).toBe("accepted");
  });

  it("clamps an off-contract status onto the enum", () => {
    // The web layer never runs GridEventSchema.parse(), so the enum has no
    // runtime teeth here — this reduce IS the clamp. For an unknown status the
    // severity lookup is undefined and `undefined > n` is false, so the reduce
    // can only ever return the "accepted" seed or a real enum member. That
    // matters because attendeeStatusLabel echoes its input verbatim into the
    // card's aria-label, so an unclamped value would reach the DOM. A
    // sort-based or Math.max-based rewrite would silently break this.
    expect(
      aggregateAttendeeStatus([
        { responseStatus: "<script>alert(1)</script>" as never },
      ]),
    ).toBe("accepted");
    expect(
      aggregateAttendeeStatus([
        { responseStatus: "bogus" as never },
        guest("declined"),
      ]),
    ).toBe("declined");
  });

  it("accepts a readonly attendee array", () => {
    const list: readonly AttendeeStatusLike[] = [
      guest("accepted"),
      guest("tentative"),
    ] as const;

    expect(aggregateAttendeeStatus(list)).toBe("tentative");
  });
});

describe("attendeeSummaryLabel", () => {
  it("uses the form's own wording for a single guest", () => {
    expect(attendeeSummaryLabel("accepted", 1)).toBe("1 guest, accepted");
    expect(attendeeSummaryLabel("needsAction", 1)).toBe(
      "1 guest, hasn't responded",
    );
  });

  it("uses aggregate wording for multiple guests", () => {
    expect(attendeeSummaryLabel("declined", 3)).toBe(
      "3 guests, at least one declined",
    );
    expect(attendeeSummaryLabel("accepted", 2)).toBe("2 guests, all accepted");
    expect(attendeeSummaryLabel("needsAction", 4)).toBe(
      "4 guests, at least one hasn't responded",
    );
    expect(attendeeSummaryLabel("tentative", 2)).toBe(
      "2 guests, at least one tentative",
    );
  });

  it("never contains an attendee name or email", () => {
    const statuses: AttendeeResponseStatus[] = [
      "accepted",
      "declined",
      "tentative",
      "needsAction",
    ];

    for (const status of statuses) {
      expect(attendeeSummaryLabel(status, 1)).not.toMatch(/@/);
      expect(attendeeSummaryLabel(status, 5)).not.toMatch(/@/);
    }
  });
});

describe("attendeeCountLabel", () => {
  it("renders small counts as digits", () => {
    expect(attendeeCountLabel(1)).toBe("1");
    expect(attendeeCountLabel(9)).toBe("9");
  });

  it("caps large counts so the badge stays two glyphs wide", () => {
    expect(attendeeCountLabel(10)).toBe("9+");
    expect(attendeeCountLabel(42)).toBe("9+");
  });
});
