import { render, screen } from "@testing-library/react";
import { type Attendee } from "@core/types/event-attendance.contracts";
import { attendeeStatusSummary } from "@web/common/utils/attendee-status.util";
import { describe, expect, it } from "bun:test";
import "@testing-library/jest-dom";

import {
  ATTENDEE_BADGE_ATTRIBUTE,
  AttendeeBadge,
  MAX_VISIBLE_ATTENDEE_DOTS,
} from "./AttendeeBadge";

describe("AttendeeBadge", () => {
  it("B-1: renders null when attendees is undefined", () => {
    const { container } = render(
      <AttendeeBadge
        attendees={undefined}
        baseColor="#3b82f6"
        descriptionId="desc-1"
      />,
    );
    expect(container.firstChild).toBeNull();
  });

  it("B-2: renders null when attendees is empty", () => {
    const { container } = render(
      <AttendeeBadge
        attendees={[]}
        baseColor="#3b82f6"
        descriptionId="desc-1"
      />,
    );
    expect(container.firstChild).toBeNull();
  });

  it("B-3: renders exactly 2 dots and no overflow counter for 2 attendees", () => {
    const attendees: Attendee[] = [
      {
        displayName: "User One",
        email: "user1@example.com",
        responseStatus: "accepted",
      },
      {
        displayName: "User Two",
        email: "user2@example.com",
        responseStatus: "declined",
      },
    ];
    const { container } = render(
      <AttendeeBadge
        attendees={attendees}
        baseColor="#3b82f6"
        descriptionId="desc-1"
      />,
    );
    const dots = container.querySelectorAll('[class*="rounded-full"]');
    expect(dots).toHaveLength(2);
    expect(container.textContent).not.toContain("+");
  });

  it("B-4: renders dot elements with semantic color classes matching status", () => {
    const attendees: Attendee[] = [
      {
        displayName: "User One",
        email: "user1@example.com",
        responseStatus: "accepted",
      },
      {
        displayName: "User Two",
        email: "user2@example.com",
        responseStatus: "declined",
      },
    ];
    const { container } = render(
      <AttendeeBadge
        attendees={attendees}
        baseColor="#3b82f6"
        descriptionId="desc-1"
      />,
    );
    const dots = container.querySelectorAll('[class*="rounded-full"]');
    expect(dots[0].className).toContain("bg-success");
    expect(dots[1].className).toContain("bg-error");
  });

  it("B-5: renders capped dots and overflow counter for 5 attendees", () => {
    const attendees: Attendee[] = [
      {
        displayName: "User 1",
        email: "user1@example.com",
        responseStatus: "accepted",
      },
      {
        displayName: "User 2",
        email: "user2@example.com",
        responseStatus: "declined",
      },
      {
        displayName: "User 3",
        email: "user3@example.com",
        responseStatus: "tentative",
      },
      {
        displayName: "User 4",
        email: "user4@example.com",
        responseStatus: "needsAction",
      },
      {
        displayName: "User 5",
        email: "user5@example.com",
        responseStatus: "accepted",
      },
    ];
    const { container } = render(
      <AttendeeBadge
        attendees={attendees}
        baseColor="#3b82f6"
        descriptionId="desc-1"
      />,
    );
    const dots = container.querySelectorAll('[class*="rounded-full"]');
    expect(dots).toHaveLength(MAX_VISIBLE_ATTENDEE_DOTS);
    expect(screen.getByText("+2")).toBeInTheDocument();
  });

  it("B-6: renders accessible description summarizing all attendees, not just visible ones", () => {
    const attendees: Attendee[] = [
      {
        displayName: "User 1",
        email: "user1@example.com",
        responseStatus: "accepted",
      },
      {
        displayName: "User 2",
        email: "user2@example.com",
        responseStatus: "accepted",
      },
      {
        displayName: "User 3",
        email: "user3@example.com",
        responseStatus: "declined",
      },
      {
        displayName: "User 4",
        email: "user4@example.com",
        responseStatus: "tentative",
      },
      {
        displayName: "User 5",
        email: "user5@example.com",
        responseStatus: "needsAction",
      },
    ];
    const descriptionId = "desc-b6";
    render(
      <AttendeeBadge
        attendees={attendees}
        baseColor="#3b82f6"
        descriptionId={descriptionId}
      />,
    );
    const descriptionEl = document.getElementById(descriptionId);
    expect(descriptionEl?.textContent).toBe(attendeeStatusSummary(attendees));
    expect(descriptionEl?.textContent).toBe(
      "5 guests: 2 accepted, 1 declined, 1 tentative, 1 hasn't responded",
    );
  });

  it("B-7: renders frozen attendee array without throwing", () => {
    const frozenAttendees = Object.freeze([
      Object.freeze({
        displayName: "User 1",
        email: "user1@example.com",
        responseStatus: "accepted" as const,
      }),
      Object.freeze({
        displayName: "User 2",
        email: "user2@example.com",
        responseStatus: "declined" as const,
      }),
    ]);
    expect(() => {
      render(
        <AttendeeBadge
          attendees={frozenAttendees}
          baseColor="#3b82f6"
          descriptionId="desc-1"
        />,
      );
    }).not.toThrow();
  });

  it("B-8: does not mutate the input attendees array", () => {
    const attendees: Attendee[] = [
      {
        displayName: "User 1",
        email: "user1@example.com",
        responseStatus: "accepted",
      },
      {
        displayName: "User 2",
        email: "user2@example.com",
        responseStatus: "declined",
      },
      {
        displayName: "User 3",
        email: "user3@example.com",
        responseStatus: "tentative",
      },
      {
        displayName: "User 4",
        email: "user4@example.com",
        responseStatus: "needsAction",
      },
    ];
    const originalCopy = attendees.map((attendee) => ({ ...attendee }));
    render(
      <AttendeeBadge
        attendees={attendees}
        baseColor="#3b82f6"
        descriptionId="desc-1"
      />,
    );
    expect(attendees).toEqual(originalCopy);
  });

  it("B-9: includes pointer-events-none class on root element", () => {
    const attendees: Attendee[] = [
      {
        displayName: "User 1",
        email: "user1@example.com",
        responseStatus: "accepted",
      },
    ];
    const { container } = render(
      <AttendeeBadge
        attendees={attendees}
        baseColor="#3b82f6"
        className="custom-class"
        descriptionId="desc-1"
      />,
    );
    const root = container.querySelector(`[${ATTENDEE_BADGE_ATTRIBUTE}]`);
    expect(root?.className).toContain("pointer-events-none");
    expect(root?.className).toContain("custom-class");
  });

  it("B-10: does not expose PII in rendered DOM", () => {
    const attendees: Attendee[] = [
      {
        displayName: "Ada",
        email: "secret@example.com",
        responseStatus: "accepted",
      },
    ];
    const { container } = render(
      <AttendeeBadge
        attendees={attendees}
        baseColor="#3b82f6"
        descriptionId="desc-1"
      />,
    );
    expect(container.innerHTML).not.toContain("secret@example.com");
    expect(container.innerHTML).not.toContain("Ada");
  });

  it("B-11: sets marker attribute and no other data attributes on root", () => {
    const attendees: Attendee[] = [
      {
        displayName: "User 1",
        email: "user1@example.com",
        responseStatus: "accepted",
      },
    ];
    const { container } = render(
      <AttendeeBadge
        attendees={attendees}
        baseColor="#3b82f6"
        descriptionId="desc-1"
      />,
    );
    const root = container.querySelector(`[${ATTENDEE_BADGE_ATTRIBUTE}]`);
    expect(root).toHaveAttribute(ATTENDEE_BADGE_ATTRIBUTE, "true");
    const dataAttributes = Array.from(root?.attributes ?? [])
      .map((attr) => attr.name)
      .filter((name) => name.startsWith("data-"));
    expect(dataAttributes).toEqual([ATTENDEE_BADGE_ATTRIBUTE]);
  });
});
