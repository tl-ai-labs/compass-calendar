import { cleanup, render, screen } from "@testing-library/react";
import {
  type Attendee,
  AttendeeResponseStatusSchema,
} from "@core/types/event-attendance.contracts";
import { afterEach, describe, expect, it } from "bun:test";
import "@testing-library/jest-dom";
import { ATTENDEE_STATUS_DOT } from "@web/common/styles/attendee-status";
import { EventAttendeeBadge } from "./EventAttendeeBadge";

const attendee = (overrides: Partial<Attendee> = {}): Attendee => ({
  email: "a@example.com",
  displayName: "Ada",
  responseStatus: "needsAction",
  ...overrides,
});

describe("EventAttendeeBadge", () => {
  afterEach(cleanup);

  it("renders nothing without attendees", () => {
    render(<EventAttendeeBadge attendees={undefined} baseColor="#82A0B2" />);
    expect(screen.queryByTestId("event-attendee-badge")).toBeNull();
    cleanup();

    render(<EventAttendeeBadge attendees={[]} baseColor="#82A0B2" />);
    expect(screen.queryByTestId("event-attendee-badge")).toBeNull();
  });

  it("renders one avatar per attendee up to the cap", () => {
    for (const count of [1, 2, 3]) {
      const attendees = Array.from({ length: count }, (_, i) =>
        attendee({ email: `a${i}@example.com`, displayName: `User ${i}` }),
      );
      render(<EventAttendeeBadge attendees={attendees} baseColor="#82A0B2" />);
      expect(screen.getAllByTestId("event-attendee-avatar")).toHaveLength(
        count,
      );
      expect(screen.queryByTestId("event-attendee-overflow")).toBeNull();
      cleanup();
    }
  });

  it("replaces the third avatar with an overflow chip past the cap", () => {
    const cases: [number, string][] = [
      [4, "+2"],
      [6, "+4"],
      [50, "+48"],
    ];
    for (const [count, chip] of cases) {
      const attendees = Array.from({ length: count }, (_, i) =>
        attendee({ email: `a${i}@example.com`, displayName: `User ${i}` }),
      );
      render(<EventAttendeeBadge attendees={attendees} baseColor="#82A0B2" />);
      expect(screen.getAllByTestId("event-attendee-avatar")).toHaveLength(2);
      expect(screen.getByTestId("event-attendee-overflow")).toHaveTextContent(
        chip,
      );
      cleanup();
    }
  });

  it("never renders an @ anywhere when every displayName is null", () => {
    const attendees = [
      attendee({ email: "user1@example.com", displayName: null }),
      attendee({ email: "user2@example.com", displayName: null }),
      attendee({ email: "user3@example.com", displayName: null }),
    ];
    const { container } = render(
      <EventAttendeeBadge attendees={attendees} baseColor="#82A0B2" />,
    );
    expect(container.textContent).not.toContain("@");
    const titledOrLabelled = container.querySelectorAll(
      "[title], [aria-label]",
    );
    for (const el of titledOrLabelled) {
      const title = el.getAttribute("title");
      const ariaLabel = el.getAttribute("aria-label");
      if (title !== null) {
        expect(title).not.toContain("@");
      }
      if (ariaLabel !== null) {
        expect(ariaLabel).not.toContain("@");
      }
    }
  });

  it("renders the neutral glyph and no text for an attendee with no display name", () => {
    const attendees = [
      attendee({
        email: "guest@example.com",
        displayName: null,
        responseStatus: "needsAction",
      }),
    ];
    render(<EventAttendeeBadge attendees={attendees} baseColor="#82A0B2" />);
    const avatar = screen.getByTestId("event-attendee-avatar");
    expect(avatar).toBeInTheDocument();
    expect(avatar.querySelector("svg")).not.toBeNull();
    expect(avatar.textContent).toBe("");
    // "Guest" is no longer a rendered string anywhere (RF-01 removed the
    // per-avatar title); identity placeholders are group-level only.
    expect(
      screen.getByRole("img", { name: "1 guest: 1 hasn't responded" }),
    ).toBeInTheDocument();
  });

  it("summarises the group without naming anyone", () => {
    const attendees = [
      attendee({
        email: "a@example.com",
        displayName: "Ada",
        responseStatus: "accepted",
      }),
      attendee({
        email: "b@example.com",
        displayName: "Bob",
        responseStatus: "accepted",
      }),
      attendee({
        email: "c@example.com",
        displayName: "Cy",
        responseStatus: "needsAction",
      }),
    ];
    render(<EventAttendeeBadge attendees={attendees} baseColor="#82A0B2" />);
    const badge = screen.getByRole("img", {
      name: "3 guests: 2 accepted, 1 hasn't responded",
    });
    expect(badge).toBeInTheDocument();
    const accessibleName = badge.getAttribute("aria-label") ?? "";
    expect(accessibleName).not.toContain("Ada");
    expect(accessibleName).not.toContain("Bob");
    expect(accessibleName).not.toContain("Cy");
  });

  it("uses the display name initial and falls back to the glyph for non-letter names", () => {
    render(
      <EventAttendeeBadge
        attendees={[attendee({ email: "ada@example.com", displayName: "ada" })]}
        baseColor="#82A0B2"
      />,
    );
    expect(screen.getByTestId("event-attendee-avatar")).toHaveTextContent("A");
    cleanup();

    render(
      <EventAttendeeBadge
        attendees={[
          attendee({ email: "alice@example.com", displayName: "@lice" }),
        ]}
        baseColor="#82A0B2"
      />,
    );
    const symbolAvatar = screen.getByTestId("event-attendee-avatar");
    expect(symbolAvatar.textContent).toBe("");
    expect(symbolAvatar.querySelector("svg")).not.toBeNull();
  });

  it("applies the shared status token class to each avatar", () => {
    for (const status of AttendeeResponseStatusSchema.options) {
      const attendees = [
        attendee({
          email: "test@example.com",
          displayName: "Test User",
          responseStatus: status,
        }),
      ];
      render(<EventAttendeeBadge attendees={attendees} baseColor="#82A0B2" />);
      expect(screen.getByTestId("event-attendee-avatar").className).toContain(
        ATTENDEE_STATUS_DOT[status],
      );
      cleanup();
    }
  });

  it("keeps @ out of the DOM when a display name looks like an email", () => {
    const attendees = [
      attendee({
        email: "victim@corp.com",
        displayName: "victim@corp.com",
        responseStatus: "accepted",
      }),
    ];
    const { container } = render(
      <EventAttendeeBadge attendees={attendees} baseColor="#82A0B2" />,
    );
    expect(container.textContent).not.toContain("@");
    for (const el of container.querySelectorAll("*")) {
      for (const attr of el.getAttributeNames()) {
        expect(el.getAttribute(attr)).not.toContain("@");
      }
    }
  });
});
