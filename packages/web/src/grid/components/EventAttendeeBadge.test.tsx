import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "bun:test";
import "@testing-library/jest-dom";

import {
  type Attendee,
  type AttendeeResponseStatus,
} from "@core/types/event-attendance.contracts";
import { ATTENDEE_BADGE_MAX_VISIBLE } from "./attendee-badge.constants";
import { EventAttendeeBadge } from "./EventAttendeeBadge";

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
    const { container } = render(<EventAttendeeBadge attendees={undefined} />);
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
    render(<EventAttendeeBadge attendees={[attendee("Ada", "ada@x.com")]} />);
    expect(screen.getByText("A")).toBeInTheDocument();
  });

  it("falls back to the email initial when display name is null", () => {
    render(<EventAttendeeBadge attendees={[attendee(null, "ada@x.com")]} />);
    // A bare initial is non-identifying, so the visible circle may derive from
    // the email. The accessible label may not - see the next two tests.
    expect(screen.getByText("A")).toBeInTheDocument();
  });

  it("never puts an attendee email in the accessible label (security F-1)", () => {
    render(<EventAttendeeBadge attendees={[attendee(null, "ada@x.com")]} />);

    expect(
      screen.getByLabelText("1 guest: Guest, accepted"),
    ).toBeInTheDocument();
    // Assert the raw address is absent from the whole subtree, not just the
    // label, so a future change that reintroduces it anywhere fails here.
    expect(screen.queryByText(/ada@x\.com/)).toBeNull();
    expect(screen.queryByLabelText(/@/)).toBeNull();
  });

  it("degrades a blank display name to the same placeholder (F-3)", () => {
    // `""` cannot survive AttendeeSchema (displayName is .min(1).nullable()), so
    // this only guards the structurally-constructed path - which this file's own
    // helper uses. Without the trim the label would read ", accepted".
    render(<EventAttendeeBadge attendees={[attendee("   ", "ada@x.com")]} />);

    expect(
      screen.getByLabelText("1 guest: Guest, accepted"),
    ).toBeInTheDocument();
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

  // CAVEAT on every getByLabelText assertion below: RTL matches the aria-label
  // *attribute*, regardless of whether the element's role supports it. The badge
  // root is a role-less <div> (implicit role `generic`), which does NOT support
  // aria-label, and all its children are aria-hidden - so this label is NOT
  // announced by any screen reader. These assertions pin the attribute's exact
  // wording; they are not evidence that FR-B7 is met at the assistive-technology
  // level. ADR-4 in change_plan.md records that gap and the follow-up ticket.
  // Do not read a passing test here as "the badge is accessible".
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
    const attendees = NAME_POOL.slice(0, ATTENDEE_BADGE_MAX_VISIBLE + 3).map(
      (name, i) => attendee(name, `overflow-${i}@x.com`),
    );
    render(<EventAttendeeBadge attendees={attendees} />);

    expect(screen.getByText("+3")).toBeInTheDocument();
    // AC-4 has two halves. The chip text alone would still pass if the component
    // rendered 2 circles instead of 3, so pin the visible count as well: every
    // monogram up to the cap present, and the first one past it absent.
    for (const name of NAME_POOL.slice(0, ATTENDEE_BADGE_MAX_VISIBLE)) {
      expect(screen.getByText(initialsOf(name))).toBeInTheDocument();
    }
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
    render(
      <EventAttendeeBadge
        attendees={[
          attendee("Ada Lovelace", "ada@x.com"),
          attendee("Bob Stone", "bob@x.com", "declined"),
        ]}
      />,
    );
    const badge = screen.getByLabelText(/guests/);
    expect(badge).toHaveClass("pointer-events-none");
    // AGENTS.md bars CSS-selector locators, so assert focusability semantically
    // (no interactive role anywhere in the badge) plus the root attribute.
    expect(screen.queryAllByRole("button")).toHaveLength(0);
    expect(screen.queryAllByRole("link")).toHaveLength(0);
    expect(badge).not.toHaveAttribute("tabindex");
  });
});
