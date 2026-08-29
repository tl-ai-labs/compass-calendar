import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "bun:test";
import "@testing-library/jest-dom";

import { EventAttendeeBadge } from "./EventAttendeeBadge";
import { ATTENDEE_BADGE_MAX_VISIBLE } from "./attendee-badge.constants";
import {
  type Attendee,
  type AttendeeResponseStatus,
} from "@core/types/event-attendance.contracts";

const attendee = (
  displayName: string | null,
  email: string,
  responseStatus: AttendeeResponseStatus = "accepted",
): Attendee => ({ displayName, email, responseStatus });

// Mirrors the component's initials algorithm so overflow cases can reference a
// hidden attendee by index without hard-coding its two-letter monogram.
const initialsOf = (displayName: string): string =>
  displayName
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((word) => word[0] ?? "")
    .join("")
    .toUpperCase();

// Distinct two-word names with unique monograms (none collide with the ring
// case's "DN"), long enough to overflow ATTENDEE_BADGE_MAX_VISIBLE.
const NAME_POOL = [
  "Aa Zz",
  "Bb Zz",
  "Cc Zz",
  "Ee Zz",
  "Ff Zz",
  "Gg Zz",
  "Hh Zz",
  "Ii Zz",
  "Jj Zz",
  "Kk Zz",
] as const;

describe("EventAttendeeBadge", () => {
  it("renders nothing when attendees is undefined", () => {
    const { container } = render(
      <EventAttendeeBadge attendees={undefined} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("renders nothing when attendees is empty", () => {
    const { container } = render(<EventAttendeeBadge attendees={[]} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("shows the first two letters of a two-word display name", () => {
    render(
      <EventAttendeeBadge
        attendees={[attendee("Ada Lovelace", "ada@x.com")]}
      />,
    );
    expect(screen.getByText("AL")).toBeInTheDocument();
  });

  it("shows a single letter for a one-word display name", () => {
    render(
      <EventAttendeeBadge attendees={[attendee("Ada", "ada@x.com")]} />,
    );
    expect(screen.getByText("A")).toBeInTheDocument();
  });

  it("falls back to the email initial when display name is null", () => {
    render(
      <EventAttendeeBadge attendees={[attendee(null, "ada@x.com")]} />,
    );
    expect(screen.getByText("A")).toBeInTheDocument();
  });

  it("caps the monogram at two characters for long names", () => {
    render(
      <EventAttendeeBadge
        attendees={[attendee("Ada Byron King Lovelace", "ada@x.com")]}
      />,
    );
    expect(screen.getByText("AB")).toBeInTheDocument();
  });

  it("rings each avatar with its RSVP status token", () => {
    const { unmount } = render(
      <EventAttendeeBadge
        attendees={[
          attendee("Ada Lovelace", "ada@x.com", "accepted"),
          attendee("Bob Stone", "bob@x.com", "declined"),
          attendee("Cara Diaz", "cara@x.com", "tentative"),
        ]}
      />,
    );
    expect(screen.getByText("AL")).toHaveClass("ring-success");
    expect(screen.getByText("BS")).toHaveClass("ring-error");
    expect(screen.getByText("CD")).toHaveClass("ring-warning");
    unmount();

    // needsAction needs its own render: the three visible slots above are full,
    // so a fourth attendee collapses into the "+1" overflow chip and its
    // initials never reach the DOM.
    render(
      <EventAttendeeBadge
        attendees={[attendee("Dana Nolan", "dana@x.com", "needsAction")]}
      />,
    );
    expect(screen.getByText("DN")).toHaveClass("ring-text-subtle");
  });

  it("builds the exact accessible label for multiple guests", () => {
    render(
      <EventAttendeeBadge
        attendees={[
          attendee("Ada Lovelace", "ada@x.com", "accepted"),
          attendee("Bob Stone", "bob@x.com", "declined"),
          attendee("Cara Diaz", "cara@x.com", "tentative"),
        ]}
      />,
    );
    expect(
      screen.getByLabelText(
        "3 guests: Ada Lovelace, accepted; Bob Stone, declined; Cara Diaz, tentative",
      ),
    ).toBeInTheDocument();
  });

  it("uses singular wording for a single guest", () => {
    render(
      <EventAttendeeBadge
        attendees={[attendee("Ada Lovelace", "ada@x.com")]}
      />,
    );
    expect(screen.getByLabelText(/^1 guest: /)).toBeInTheDocument();
  });

  it("collapses attendees past the visible cap into a +N chip", () => {
    const attendees = NAME_POOL.slice(
      0,
      ATTENDEE_BADGE_MAX_VISIBLE + 3,
    ).map((name, i) => attendee(name, `overflow-${i}@x.com`));
    render(<EventAttendeeBadge attendees={attendees} />);

    expect(screen.getByText("+3")).toBeInTheDocument();
    // The first attendee past ATTENDEE_BADGE_MAX_VISIBLE is hidden by the chip.
    const hidden = NAME_POOL[ATTENDEE_BADGE_MAX_VISIBLE];
    expect(screen.queryByText(initialsOf(hidden))).toBeNull();
  });

  it("renders no chip when the count equals the visible cap exactly", () => {
    const attendees = NAME_POOL.slice(0, ATTENDEE_BADGE_MAX_VISIBLE).map(
      (name, i) => attendee(name, `exact-${i}@x.com`),
    );
    render(<EventAttendeeBadge attendees={attendees} />);
    expect(screen.queryByText(/^\+\d+$/)).toBeNull();
  });

  it("is pointer-transparent and holds no focusable node", () => {
    // jsdom implements no pointer-events hit testing, so a fireEvent.mouseDown
    // here would bubble to the card's drag handlers regardless of
    // `pointer-events-none` and prove nothing. The transparency contract is the
    // class plus the absence of any focusable node, so assert exactly that - do
    // not "fix" this into a behavioural mousedown test.
    const { container } = render(
      <EventAttendeeBadge
        attendees={[
          attendee("Ada Lovelace", "ada@x.com"),
          attendee("Bob Stone", "bob@x.com", "declined"),
        ]}
      />,
    );
    expect(screen.getByLabelText(/guests/)).toHaveClass("pointer-events-none");
    expect(container.querySelector("[tabindex]")).toBeNull();
  });
});
