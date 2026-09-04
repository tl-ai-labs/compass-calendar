import { fireEvent, render, screen } from "@testing-library/react";
import { getEventPalette } from "@web/common/styles/theme.util";
import { type GridEvent } from "@web/common/types/web.event.types";
import {
  COMPACT_EVENT_MAX_HEIGHT,
  GRID_EVENT_TITLE_COMPACT_FONT_SIZE,
  GRID_EVENT_TITLE_COMPACT_LINE_HEIGHT,
  GRID_EVENT_TITLE_FONT_SIZE,
} from "@web/grid/grid.constants";
import {
  initialEdgeFocusState,
  useEdgeFocusStore,
} from "@web/grid/shortcuts/edge-focus.store";
import { afterEach, describe, expect, it, mock } from "bun:test";
import "@testing-library/jest-dom";

import { AllDayEventCard } from "./AllDayEventCard";
import { ATTENDEE_BADGE_ATTRIBUTE } from "./AttendeeBadge";
import { TimedEventCard } from "./TimedEventCard";

const createEvent = (overrides: Partial<GridEvent> = {}): GridEvent =>
  ({
    _id: "event-1",
    endDate: "2024-01-15T10:00:00.000Z",
    isAllDay: false,
    position: {
      dragOffset: { x: 0, y: 0 },
      horizontalOrder: 0,
      initialX: null,
      initialY: null,
      isOverlapping: false,
      totalEventsInGroup: 1,
      widthMultiplier: 1,
    },
    recurrence: undefined,
    startDate: "2024-01-15T09:00:00.000Z",
    title: "Planning block",
    ...overrides,
  }) as GridEvent;

const position = {
  height: 60,
  left: 10,
  top: 20,
  width: 140,
};

describe("EventCard", () => {
  afterEach(() => {
    useEdgeFocusStore.setState(initialEdgeFocusState, true);
  });

  it("renders timed event details, interaction attributes, and resize handles", () => {
    const onEventMouseDown = mock();
    const onScalerMouseDown = mock();

    render(
      <TimedEventCard
        displayMode="saved"
        event={createEvent({
          startDate: "2099-01-15T09:00:00.000Z",
          endDate: "2099-01-15T10:00:00.000Z",
        })}
        interactionAttributes={{
          "data-week-interaction-event-id": "event-1",
          "data-week-interaction-event-type": "timed",
        }}
        motionMode="idle"
        onEventMouseDown={onEventMouseDown}
        onScalerMouseDown={onScalerMouseDown}
        position={position}
      />,
    );

    const card = screen.getByRole("button", {
      name: "Timed event: Planning block, 9 - 10 AM",
    });
    expect(card).not.toHaveAttribute("aria-disabled");
    expect(card).toHaveAttribute("data-week-interaction-event-id", "event-1");
    expect(screen.getByText("Planning block")).toBeInTheDocument();

    const timeLabel = screen.getByText("9 - 10 AM");
    expect(timeLabel).toHaveAttribute("data-calendar-event-time-label", "true");

    const handles = document.querySelectorAll(
      "[data-calendar-event-resize-handle]",
    );
    expect(handles).toHaveLength(2);

    fireEvent.mouseDown(handles[0]);
    fireEvent.mouseDown(handles[1]);

    expect(onScalerMouseDown).toHaveBeenCalledTimes(2);
    expect(onScalerMouseDown.mock.calls[0]?.[2]).toBe("startDate");
    expect(onScalerMouseDown.mock.calls[1]?.[2]).toBe("endDate");

    fireEvent.mouseDown(card);
    expect(onEventMouseDown).toHaveBeenCalledTimes(1);
  });

  it("wraps a long timed event title at word boundaries and clamps with an ellipsis", () => {
    render(
      <TimedEventCard
        displayMode="saved"
        event={createEvent({
          startDate: "2099-01-15T09:00:00.000Z",
          endDate: "2099-01-15T10:00:00.000Z",
          title:
            "Journaling-Flow-Experiment with James: Part 2/2: The Miner's Sifting Pan",
        })}
        motionMode="idle"
        position={position}
      />,
    );

    const title = screen.getByText(
      "Journaling-Flow-Experiment with James: Part 2/2: The Miner's Sifting Pan",
    );

    // Word-boundary wrapping with a mid-word fallback for unbreakable tokens,
    // not the old wordBreak: "break-all" that split every word.
    expect(title.style.overflowWrap).toBe("anywhere");
    expect(title.style.wordBreak).toBe("");
    expect(title.style.fontSize).toBe(GRID_EVENT_TITLE_FONT_SIZE);

    // -webkit-line-clamp renders the trailing ellipsis itself once the title
    // overflows its clamped line count.
    expect(title.style.display).toBe("-webkit-box");
    expect(title.style.webkitLineClamp).toBe("3");
  });

  it("renders a compact single-line title for a very short event", () => {
    render(
      <TimedEventCard
        displayMode="saved"
        event={createEvent({
          startDate: "2099-01-15T09:00:00.000Z",
          endDate: "2099-01-15T09:15:00.000Z",
        })}
        motionMode="idle"
        position={{ ...position, height: 15 }}
      />,
    );

    const title = screen.getByText("Planning block");
    expect(title.style.fontSize).toBe(GRID_EVENT_TITLE_COMPACT_FONT_SIZE);
    expect(title.style.lineHeight).toBe(GRID_EVENT_TITLE_COMPACT_LINE_HEIGHT);
    expect(title.style.webkitLineClamp).toBe("1");
  });

  it("keeps the timed selected state on the flat event color", () => {
    render(
      <TimedEventCard
        displayMode="saved"
        event={createEvent({
          startDate: "2099-01-15T09:00:00.000Z",
          endDate: "2099-01-15T10:00:00.000Z",
        })}
        isSelected={true}
        motionMode="idle"
        position={position}
      />,
    );

    const card = screen.getByRole("button", {
      name: "Timed event: Planning block, 9 - 10 AM",
    });

    expect(card).toHaveClass("bg-(--event-bg)");
    expect(card).not.toHaveClass("bg-event-selected");
    expect(card.style.getPropertyValue("--event-bg")).toBe(
      getEventPalette().base,
    );
    expect(card.style.boxShadow).toContain(
      "0 0 0 1px var(--background), 0 0 0 3px color-mix(in srgb, var(--text) 70%, transparent)",
    );
  });

  it("paints a timed event with its content color slot fill", () => {
    render(
      <TimedEventCard
        displayMode="saved"
        event={createEvent({
          color: "blue",
          startDate: "2099-01-15T09:00:00.000Z",
          endDate: "2099-01-15T10:00:00.000Z",
        })}
        motionMode="idle"
        position={position}
      />,
    );

    const card = screen.getByRole("button", {
      name: "Timed event: Planning block, 9 - 10 AM",
    });
    expect(card.style.getPropertyValue("--event-bg")).toBe(
      getEventPalette("blue").base,
    );
  });

  it("paints a timed draft with the same slot fill as the saved card", () => {
    render(
      <TimedEventCard
        displayMode="draft"
        event={createEvent({
          color: "red",
          startDate: "2099-01-15T09:00:00.000Z",
          endDate: "2099-01-15T10:00:00.000Z",
        })}
        motionMode="idle"
        position={position}
      />,
    );

    const card = screen.getByRole("button", {
      name: "Timed event: Planning block, 9 - 10 AM",
    });
    expect(card.style.getPropertyValue("--event-bg")).toBe(
      getEventPalette("red").base,
    );
    expect(card.style.filter).toBe("drop-shadow(0 1px 2px rgb(0 0 0 / 0.28))");
  });

  it("keeps timed event keyboard activation from reaching parent shortcuts", () => {
    const onEventKeyDown = mock();
    const onParentKeyDown = mock();

    render(
      // biome-ignore lint/a11y/noStaticElementInteractions: test wrapper simulates a parent shortcut listener.
      <div onKeyDown={onParentKeyDown}>
        <TimedEventCard
          displayMode="saved"
          event={createEvent()}
          motionMode="idle"
          onEventKeyDown={onEventKeyDown}
          position={position}
        />
      </div>,
    );

    fireEvent.keyDown(screen.getByRole("button"), { key: "Enter" });

    expect(onEventKeyDown).toHaveBeenCalledTimes(1);
    expect(onParentKeyDown).not.toHaveBeenCalled();
  });

  it("announces recurring timed events", () => {
    render(
      <TimedEventCard
        displayMode="saved"
        event={createEvent({
          recurrence: {
            eventId: "series-1",
            rule: ["RRULE:FREQ=WEEKLY"],
          },
        })}
        motionMode="idle"
        position={position}
      />,
    );

    expect(
      screen.getByRole("button", {
        name: "Recurring Timed event: Planning block, 9 - 10 AM",
      }),
    ).toBeInTheDocument();
  });

  it("places the repeat indicator bottom-right", () => {
    const { container } = render(
      <TimedEventCard
        displayMode="saved"
        event={createEvent({
          recurrence: { eventId: "series-1", rule: ["RRULE:FREQ=WEEKLY"] },
        })}
        motionMode="idle"
        position={position}
      />,
    );
    const icon = container.querySelector('svg[class*="right-1"]');

    // Positioned bottom-right (not the old bottom-left), and no longer the
    // hardcoded white fg color.
    expect(icon).not.toBeNull();
    const iconClass = icon?.getAttribute("class") ?? "";
    expect(iconClass).not.toContain("left-1");
    expect(iconClass).not.toContain("text-muted");
  });

  it("shows the repeat indicator on a 15-minute recurring event despite its small rendered height", () => {
    // A true 15-minute event lays out shorter than a taller one resized down to
    // 15 minutes; the icon used to be gated on rendered pixel height, so the two
    // disagreed. Gating on duration makes any 15-minute recurring event qualify.
    const { container } = render(
      <TimedEventCard
        displayMode="saved"
        event={createEvent({
          endDate: "2024-01-15T09:15:00.000Z",
          recurrence: { eventId: "series-1", rule: ["RRULE:FREQ=WEEKLY"] },
          startDate: "2024-01-15T09:00:00.000Z",
        })}
        motionMode="idle"
        // A short height that fell below the old pixel-height threshold.
        position={{ ...position, height: 18 }}
      />,
    );

    expect(container.querySelector('svg[class*="right-1"]')).not.toBeNull();
  });

  it("shows the repeat indicator on a recurring draft preview", () => {
    // The draft preview should reflect the future reality: once a draft has a
    // recurrence rule, its card renders the repeat icon immediately (drafts are
    // not placeholders, so they are not excluded from the indicator).
    const { container } = render(
      <TimedEventCard
        displayMode="draft"
        event={createEvent({
          _id: undefined,
          recurrence: { rule: ["RRULE:FREQ=WEEKLY"] },
        })}
        motionMode="idle"
        position={position}
      />,
    );

    expect(container.querySelector('svg[class*="right-1"]')).not.toBeNull();
  });

  it("hides the repeat indicator on a too-narrow event", () => {
    const { container } = render(
      <TimedEventCard
        displayMode="saved"
        event={createEvent({
          recurrence: { eventId: "series-1", rule: ["RRULE:FREQ=WEEKLY"] },
        })}
        motionMode="idle"
        // Below the width gate: too cramped to place the icon without crowding.
        position={{ ...position, width: 30 }}
      />,
    );

    expect(container.querySelector('svg[class*="right-1"]')).toBeNull();
  });

  it("renders all-day event details, interaction attributes, acknowledgement animation, and resize handles", () => {
    const onEventMouseDown = mock();
    const onScalerMouseDown = mock();

    render(
      <AllDayEventCard
        event={createEvent({
          isAllDay: true,
          title: "Conference",
        })}
        interactionAttributes={{
          "data-week-interaction-event-id": "event-2",
          "data-week-interaction-event-type": "all-day",
        }}
        isPlaceholder={false}
        onEventMouseDown={onEventMouseDown}
        onScalerMouseDown={onScalerMouseDown}
        position={position}
      />,
    );

    const card = screen.getByRole("button", {
      name: "All-day event: Conference",
    });
    expect(card).not.toHaveAttribute("aria-disabled");
    expect(card).toHaveAttribute("data-week-interaction-event-id", "event-2");
    expect(card).toHaveAttribute("data-week-interaction-event-type", "all-day");
    expect(screen.getByText("Conference")).toBeInTheDocument();

    const handles = document.querySelectorAll(
      "[data-calendar-event-resize-handle]",
    );
    expect(handles[0]).toHaveAttribute(
      "data-calendar-event-resize-handle",
      "startDate",
    );
    expect(handles[1]).toHaveAttribute(
      "data-calendar-event-resize-handle",
      "endDate",
    );

    fireEvent.mouseDown(handles[0]);
    fireEvent.mouseDown(handles[1]);
    fireEvent.mouseDown(card);

    expect(onScalerMouseDown).toHaveBeenCalledTimes(2);
    expect(onEventMouseDown).toHaveBeenCalledTimes(1);
  });

  it("keeps all-day event keyboard activation from reaching parent shortcuts", () => {
    const onEventKeyDown = mock();
    const onParentKeyDown = mock();

    render(
      // biome-ignore lint/a11y/noStaticElementInteractions: test wrapper simulates a parent shortcut listener.
      <div onKeyDown={onParentKeyDown}>
        <AllDayEventCard
          event={createEvent({
            isAllDay: true,
            title: "Conference",
          })}
          isPlaceholder={false}
          onEventKeyDown={onEventKeyDown}
          position={position}
        />
      </div>,
    );

    fireEvent.keyDown(screen.getByRole("button"), { key: "Enter" });

    expect(onEventKeyDown).toHaveBeenCalledTimes(1);
    expect(onParentKeyDown).not.toHaveBeenCalled();
  });

  it("places the all-day repeat indicator bottom-right", () => {
    const { container } = render(
      <AllDayEventCard
        event={createEvent({
          isAllDay: true,
          recurrence: { eventId: "series-1", rule: ["RRULE:FREQ=WEEKLY"] },
        })}
        isPlaceholder={false}
        position={position}
      />,
    );
    const icon = container.querySelector('svg[class*="right-1"]');

    // Matches the timed card: bottom-right, and no longer the fixed white fg
    // color on the left.
    expect(icon).not.toBeNull();
    const iconClass = icon?.getAttribute("class") ?? "";
    expect(iconClass).toContain("bottom-0.5");
    expect(iconClass).not.toContain("text-muted");
  });

  it("announces recurring all-day events", () => {
    render(
      <AllDayEventCard
        event={createEvent({
          isAllDay: true,
          recurrence: {
            eventId: "series-1",
            rule: ["RRULE:FREQ=WEEKLY"],
          },
        })}
        isPlaceholder={false}
        position={position}
      />,
    );

    expect(
      screen.getByRole("button", {
        name: "Recurring All-day event: Planning block",
      }),
    ).toBeInTheDocument();
  });

  it("uses calendar-colored focus chrome instead of the theme accent ring", () => {
    render(
      <TimedEventCard
        displayMode="saved"
        event={createEvent({
          startDate: "2099-01-15T09:00:00.000Z",
          endDate: "2099-01-15T10:00:00.000Z",
        })}
        focusColor="#616161"
        motionMode="idle"
        position={position}
      />,
    );

    const card = screen.getByRole("button", {
      name: "Timed event: Planning block, 9 - 10 AM",
    });
    expect(card.style.getPropertyValue("--event-focus-color")).toBe("#616161");
    expect(card.className).not.toContain("ring-accent");
    expect(card.className).toContain(
      "focus-visible:outline-(--event-focus-color)",
    );
    expect(card.className).toContain("focus-visible:outline-2");
  });

  it("paints start/end edge focus outside the card with the calendar color", () => {
    const event = createEvent({
      startDate: "2099-01-15T09:00:00.000Z",
      endDate: "2099-01-15T10:00:00.000Z",
    });
    useEdgeFocusStore.setState({
      eventId: event._id!,
      edge: "startDate",
      announcement: "Editing start time",
    });

    render(
      <TimedEventCard
        displayMode="saved"
        event={event}
        focusColor="#616161"
        motionMode="idle"
        position={position}
      />,
    );

    const card = screen.getByRole("button", {
      name: /editing start time/,
    });
    expect(card).toHaveAttribute("data-edge-focus", "startDate");
    expect(card.style.boxShadow).toContain("0 -3px 0 0 #616161");
    expect(card.className).toContain("focus-visible:outline-none");
    expect(card.className).not.toContain("ring-accent");
    expect(card.className).not.toContain("bg-accent");
  });

  it("keeps a short timed title readable while an edge is focused", () => {
    const event = createEvent({
      startDate: "2099-01-15T09:00:00.000Z",
      endDate: "2099-01-15T09:15:00.000Z",
      title: "Do drops",
    });
    useEdgeFocusStore.setState({
      eventId: event._id!,
      edge: "startDate",
      announcement: "Editing start time",
    });

    render(
      <TimedEventCard
        displayMode="saved"
        event={event}
        focusColor="#616161"
        motionMode="idle"
        position={{ ...position, height: COMPACT_EVENT_MAX_HEIGHT }}
      />,
    );

    expect(screen.getByText("Do drops")).toBeInTheDocument();
    const card = screen.getByRole("button", { name: /Do drops/ });
    expect(card).toHaveAttribute("data-edge-focus", "startDate");
    // Outside shadow, not an inset accent bar covering the title.
    expect(card.style.boxShadow).toContain("0 -3px 0 0 #616161");
    expect(card.querySelector("[data-edge-focus]")).toBeNull();
  });

  it("paints all-day edge focus with the calendar color on the left/right", () => {
    const event = createEvent({
      isAllDay: true,
      title: "Conference",
    });
    useEdgeFocusStore.setState({
      eventId: event._id!,
      edge: "endDate",
      announcement: "Editing end time",
    });

    render(
      <AllDayEventCard
        event={event}
        focusColor="#3b82f6"
        isPlaceholder={false}
        position={position}
      />,
    );

    const card = screen.getByRole("button", {
      name: /editing end date/,
    });
    expect(card).toHaveAttribute("data-edge-focus", "endDate");
    expect(card.style.boxShadow).toContain("3px 0 0 0 #3b82f6");
    expect(card.className).not.toContain("ring-accent");
  });

  const attendee = (
    email: string,
    responseStatus: "accepted" | "declined" | "needsAction" | "tentative",
    displayName: string | null = null,
  ) => ({ displayName, email, responseStatus });

  const futureEvent = (overrides: Partial<GridEvent> = {}) =>
    createEvent({
      startDate: "2099-01-15T09:00:00.000Z",
      endDate: "2099-01-15T10:00:00.000Z",
      ...overrides,
    });

  const badgeDescriptionOf = (card: HTMLElement) => {
    const id = card.getAttribute("aria-describedby");
    return id === null
      ? null
      : (document.getElementById(id)?.textContent ?? null);
  };

  const badgePosition = { ...position, width: 190 };

  it("C-1: timed card, 1 accepted attendee, position (140x60)", () => {
    render(
      <TimedEventCard
        displayMode="saved"
        event={futureEvent({
          attendees: [attendee("alice@example.com", "accepted")],
        })}
        motionMode="idle"
        position={badgePosition}
      />,
    );

    const card = screen.getByRole("button", {
      name: "Timed event: Planning block, 9 - 10 AM",
    });
    expect(card.querySelector(`[${ATTENDEE_BADGE_ATTRIBUTE}]`)).not.toBeNull();
  });

  it("C-2: all-day card, 1 accepted attendee", () => {
    render(
      <AllDayEventCard
        event={futureEvent({
          isAllDay: true,
          title: "Conference",
          attendees: [attendee("alice@example.com", "accepted")],
        })}
        isPlaceholder={false}
        position={position}
      />,
    );

    const card = screen.getByRole("button", {
      name: "All-day event: Conference",
    });
    expect(card.querySelector(`[${ATTENDEE_BADGE_ATTRIBUTE}]`)).not.toBeNull();
  });

  it("C-3: timed card, 2 accepted + 1 needsAction", () => {
    render(
      <TimedEventCard
        displayMode="saved"
        event={futureEvent({
          attendees: [
            attendee("a@example.com", "accepted"),
            attendee("b@example.com", "accepted"),
            attendee("c@example.com", "needsAction"),
          ],
        })}
        motionMode="idle"
        position={badgePosition}
      />,
    );

    const card = screen.getByRole("button", {
      name: "Timed event: Planning block, 9 - 10 AM",
    });
    expect(badgeDescriptionOf(card)).toBe(
      "3 guests: 2 accepted, 1 hasn't responded",
    );
  });

  it("C-4: card name unchanged with a badge present", () => {
    render(
      <TimedEventCard
        displayMode="saved"
        event={futureEvent({
          attendees: [attendee("alice@example.com", "accepted")],
        })}
        motionMode="idle"
        position={position}
      />,
    );

    const card = screen.getByRole("button", {
      name: "Timed event: Planning block, 9 - 10 AM",
    });
    expect(card).toBeInTheDocument();
    expect(card.getAttribute("aria-label")).toBe(
      "Timed event: Planning block, 9 - 10 AM",
    );
  });

  it("C-5: all-day name unchanged with a badge present", () => {
    render(
      <AllDayEventCard
        event={futureEvent({
          isAllDay: true,
          title: "Conference",
          attendees: [attendee("alice@example.com", "accepted")],
        })}
        isPlaceholder={false}
        position={position}
      />,
    );

    const card = screen.getByRole("button", {
      name: "All-day event: Conference",
    });
    expect(card).toBeInTheDocument();
    expect(card.getAttribute("aria-label")).toBe("All-day event: Conference");
  });

  it("C-6: timed attendees: undefined and attendees: []", () => {
    const { unmount } = render(
      <TimedEventCard
        displayMode="saved"
        event={futureEvent({ attendees: undefined })}
        motionMode="idle"
        position={position}
      />,
    );

    let card = screen.getByRole("button", {
      name: "Timed event: Planning block, 9 - 10 AM",
    });
    expect(card.querySelector(`[${ATTENDEE_BADGE_ATTRIBUTE}]`)).toBeNull();
    expect(card).not.toHaveAttribute("aria-describedby");

    unmount();

    render(
      <TimedEventCard
        displayMode="saved"
        event={futureEvent({ attendees: [] })}
        motionMode="idle"
        position={position}
      />,
    );

    card = screen.getByRole("button", {
      name: "Timed event: Planning block, 9 - 10 AM",
    });
    expect(card.querySelector(`[${ATTENDEE_BADGE_ATTRIBUTE}]`)).toBeNull();
    expect(card).not.toHaveAttribute("aria-describedby");
  });

  it("C-7: all-day attendees: undefined and []", () => {
    const { unmount } = render(
      <AllDayEventCard
        event={futureEvent({
          isAllDay: true,
          title: "Conference",
          attendees: undefined,
        })}
        isPlaceholder={false}
        position={position}
      />,
    );

    let card = screen.getByRole("button", {
      name: "All-day event: Conference",
    });
    expect(card.querySelector(`[${ATTENDEE_BADGE_ATTRIBUTE}]`)).toBeNull();
    expect(card).not.toHaveAttribute("aria-describedby");

    unmount();

    render(
      <AllDayEventCard
        event={futureEvent({
          isAllDay: true,
          title: "Conference",
          attendees: [],
        })}
        isPlaceholder={false}
        position={position}
      />,
    );

    card = screen.getByRole("button", {
      name: "All-day event: Conference",
    });
    expect(card.querySelector(`[${ATTENDEE_BADGE_ATTRIBUTE}]`)).toBeNull();
    expect(card).not.toHaveAttribute("aria-describedby");
  });

  it("C-8: resize handles survive a badge on timed card", () => {
    const onScalerMouseDown = mock();

    render(
      <TimedEventCard
        displayMode="saved"
        event={futureEvent({
          attendees: [attendee("alice@example.com", "accepted")],
        })}
        motionMode="idle"
        onScalerMouseDown={onScalerMouseDown}
        position={position}
      />,
    );

    const handles = document.querySelectorAll(
      "[data-calendar-event-resize-handle]",
    );
    expect(handles).toHaveLength(2);

    fireEvent.mouseDown(handles[0]);
    fireEvent.mouseDown(handles[1]);

    expect(onScalerMouseDown).toHaveBeenCalledTimes(2);
    expect(onScalerMouseDown.mock.calls[0]?.[2]).toBe("startDate");
    expect(onScalerMouseDown.mock.calls[1]?.[2]).toBe("endDate");
  });

  it("C-9: all-day resize handles survive a badge", () => {
    const onScalerMouseDown = mock();

    render(
      <AllDayEventCard
        event={futureEvent({
          isAllDay: true,
          title: "Conference",
          attendees: [attendee("alice@example.com", "accepted")],
        })}
        isPlaceholder={false}
        onScalerMouseDown={onScalerMouseDown}
        position={position}
      />,
    );

    const handles = document.querySelectorAll(
      "[data-calendar-event-resize-handle]",
    );
    expect(handles).toHaveLength(2);
    expect(handles[0]).toHaveAttribute(
      "data-calendar-event-resize-handle",
      "startDate",
    );
    expect(handles[1]).toHaveAttribute(
      "data-calendar-event-resize-handle",
      "endDate",
    );

    fireEvent.mouseDown(handles[0]);
    fireEvent.mouseDown(handles[1]);

    expect(onScalerMouseDown).toHaveBeenCalledTimes(2);
    expect(onScalerMouseDown.mock.calls[0]?.[2]).toBe("startDate");
    expect(onScalerMouseDown.mock.calls[1]?.[2]).toBe("endDate");
  });

  it("C-10: no email in card DOM", () => {
    render(
      <TimedEventCard
        displayMode="saved"
        event={futureEvent({
          attendees: [
            attendee("secret@example.com", "accepted", "Ada Lovelace"),
          ],
        })}
        motionMode="idle"
        position={position}
      />,
    );

    const card = screen.getByRole("button", {
      name: "Timed event: Planning block, 9 - 10 AM",
    });
    expect(card.outerHTML).not.toContain("secret@example.com");
    expect(card.outerHTML).not.toContain("Ada Lovelace");
  });

  it("C-11: badge does not displace the repeat icon", () => {
    const { container } = render(
      <TimedEventCard
        displayMode="saved"
        event={futureEvent({
          recurrence: { eventId: "series-1", rule: ["RRULE:FREQ=WEEKLY"] },
          attendees: [attendee("alice@example.com", "accepted")],
        })}
        motionMode="idle"
        position={badgePosition}
      />,
    );

    const repeatIcon = container.querySelector('svg[class*="right-1"]');
    expect(repeatIcon).not.toBeNull();

    const badge = container.querySelector(`[${ATTENDEE_BADGE_ATTRIBUTE}]`);
    expect(badge).not.toBeNull();
    expect(badge?.getAttribute("class")).toContain("right-4");
  });

  it("C-12: compact timed card suppresses the badge", () => {
    render(
      <TimedEventCard
        displayMode="saved"
        event={futureEvent({
          attendees: [attendee("alice@example.com", "accepted")],
        })}
        motionMode="idle"
        position={{ ...position, height: COMPACT_EVENT_MAX_HEIGHT }}
      />,
    );

    const card = screen.getByRole("button");
    expect(card.querySelector(`[${ATTENDEE_BADGE_ATTRIBUTE}]`)).toBeNull();
    expect(card).not.toHaveAttribute("aria-describedby");
  });

  it("C-13: narrow card suppresses the badge", () => {
    const { unmount } = render(
      <TimedEventCard
        displayMode="saved"
        event={futureEvent({
          attendees: [attendee("alice@example.com", "accepted")],
        })}
        motionMode="idle"
        position={{ ...position, width: 90 }}
      />,
    );

    let card = screen.getByRole("button");
    expect(card.querySelector(`[${ATTENDEE_BADGE_ATTRIBUTE}]`)).toBeNull();

    unmount();

    render(
      <AllDayEventCard
        event={futureEvent({
          isAllDay: true,
          title: "Conference",
          attendees: [attendee("alice@example.com", "accepted")],
        })}
        isPlaceholder={false}
        position={{ ...position, width: 90 }}
      />,
    );

    card = screen.getByRole("button");
    expect(card.querySelector(`[${ATTENDEE_BADGE_ATTRIBUTE}]`)).toBeNull();
  });

  it("C-14: frozen attendees on a card", () => {
    const attendees = Object.freeze([
      attendee("alice@example.com", "accepted"),
      attendee("bob@example.com", "declined"),
    ]);

    const { unmount } = render(
      <TimedEventCard
        displayMode="saved"
        event={futureEvent({ attendees })}
        motionMode="idle"
        position={position}
      />,
    );

    expect(
      screen.getByRole("button", {
        name: "Timed event: Planning block, 9 - 10 AM",
      }),
    ).toBeInTheDocument();

    unmount();

    render(
      <AllDayEventCard
        event={futureEvent({
          isAllDay: true,
          title: "Conference",
          attendees,
        })}
        isPlaceholder={false}
        position={position}
      />,
    );

    expect(
      screen.getByRole("button", {
        name: "All-day event: Conference",
      }),
    ).toBeInTheDocument();
  });

  it("C-15: overflow cap on a card", () => {
    const attendees = [
      ...Array.from({ length: 7 }, (_, i) =>
        attendee(`accepted${i}@example.com`, "accepted"),
      ),
      ...Array.from({ length: 5 }, (_, i) =>
        attendee(`needs${i}@example.com`, "needsAction"),
      ),
    ];

    render(
      <TimedEventCard
        displayMode="saved"
        event={futureEvent({ attendees })}
        motionMode="idle"
        position={badgePosition}
      />,
    );

    const card = screen.getByRole("button", {
      name: "Timed event: Planning block, 9 - 10 AM",
    });
    const dots = card.querySelectorAll('[class*="rounded-full"]');
    expect(dots).toHaveLength(3);
    expect(screen.getByText("+9")).toBeInTheDocument();
    expect(badgeDescriptionOf(card)).toBe(
      "12 guests: 7 accepted, 5 hasn't responded",
    );
  });

  it("C-16: byte-identity guard, timed", () => {
    // 1. Renders the card with no attendees key at all, captures container.innerHTML as baseline, and unmount()s.
    const { container: baselineContainer, unmount: unmount1 } = render(
      <TimedEventCard
        displayMode="saved"
        event={futureEvent()}
        motionMode="idle"
        position={badgePosition}
      />,
    );
    const baseline = baselineContainer.innerHTML;
    // 4. Asserts the no-attendee card root's attribute-name set is exactly ["aria-label", "class", "role", "style", "tabindex"] (sorted).
    const card = baselineContainer.querySelector(
      '[role="button"]',
    ) as HTMLElement;
    expect(card.getAttributeNames().sort()).toEqual([
      "aria-label",
      "class",
      "role",
      "style",
      "tabindex",
    ]);
    // 5. Asserts the content wrapper's class attribute is exactly the pre-change string — "flex flex-col flex-wrap items-start".
    const contentWrapper = baselineContainer.querySelector(
      "[data-calendar-event-content]",
    );
    expect(contentWrapper?.getAttribute("class")).toBe(
      "flex flex-col flex-wrap items-start",
    );
    // 6. Asserts baseline does not contain the substrings data-attendee-badge, aria-describedby or sr-only.
    expect(baseline).not.toContain("data-attendee-badge");
    expect(baseline).not.toContain("aria-describedby");
    expect(baseline).not.toContain("sr-only");
    unmount1();

    // 2. Renders the same card with attendees: undefined, asserts container.innerHTML === baseline, unmounts.
    const { container: undefinedContainer, unmount: unmount2 } = render(
      <TimedEventCard
        displayMode="saved"
        event={futureEvent({ attendees: undefined })}
        motionMode="idle"
        position={badgePosition}
      />,
    );
    expect(undefinedContainer.innerHTML).toBe(baseline);
    unmount2();

    // 3. Renders the same card with attendees: [], asserts container.innerHTML === baseline, unmounts.
    const { container: emptyContainer, unmount: unmount3 } = render(
      <TimedEventCard
        displayMode="saved"
        event={futureEvent({ attendees: [] })}
        motionMode="idle"
        position={badgePosition}
      />,
    );
    expect(emptyContainer.innerHTML).toBe(baseline);
    unmount3();

    // 7. Sensitivity control: renders the same card with one attendee and asserts container.innerHTML !== baseline.
    const { container: attendeeContainer, unmount: unmount4 } = render(
      <TimedEventCard
        displayMode="saved"
        event={futureEvent({
          attendees: [attendee("alice@example.com", "accepted")],
        })}
        motionMode="idle"
        position={badgePosition}
      />,
    );
    expect(attendeeContainer.innerHTML).not.toBe(baseline);
    unmount4();
  });

  it("C-17: byte-identity guard, all-day", () => {
    // 1. Renders the card with no attendees key at all, captures container.innerHTML as baseline, and unmount()s.
    const { container: baselineContainer, unmount: unmount1 } = render(
      <AllDayEventCard
        event={futureEvent({ isAllDay: true, title: "Conference" })}
        isPlaceholder={false}
        position={position}
      />,
    );
    const baseline = baselineContainer.innerHTML;
    // 4. Asserts the no-attendee card root's attribute-name set is exactly ["aria-label", "class", "role", "style", "tabindex"] (sorted).
    const card = baselineContainer.querySelector(
      '[role="button"]',
    ) as HTMLElement;
    expect(card.getAttributeNames().sort()).toEqual([
      "aria-label",
      "class",
      "role",
      "style",
      "tabindex",
    ]);
    // 5. Asserts the content wrapper's class attribute is exactly the pre-change string — "flex min-w-0 items-center".
    const contentWrapper = card.querySelector(".min-w-0");
    expect(contentWrapper?.getAttribute("class")).toBe(
      "flex min-w-0 items-center",
    );
    // 6. Asserts baseline does not contain the substrings data-attendee-badge, aria-describedby or sr-only.
    expect(baseline).not.toContain("data-attendee-badge");
    expect(baseline).not.toContain("aria-describedby");
    expect(baseline).not.toContain("sr-only");
    unmount1();

    // 2. Renders the same card with attendees: undefined, asserts container.innerHTML === baseline, unmounts.
    const { container: undefinedContainer, unmount: unmount2 } = render(
      <AllDayEventCard
        event={futureEvent({
          isAllDay: true,
          title: "Conference",
          attendees: undefined,
        })}
        isPlaceholder={false}
        position={position}
      />,
    );
    expect(undefinedContainer.innerHTML).toBe(baseline);
    unmount2();

    // 3. Renders the same card with attendees: [], asserts container.innerHTML === baseline, unmounts.
    const { container: emptyContainer, unmount: unmount3 } = render(
      <AllDayEventCard
        event={futureEvent({
          isAllDay: true,
          title: "Conference",
          attendees: [],
        })}
        isPlaceholder={false}
        position={position}
      />,
    );
    expect(emptyContainer.innerHTML).toBe(baseline);
    unmount3();

    // 7. Sensitivity control: renders the same card with one attendee and asserts container.innerHTML !== baseline.
    const { container: attendeeContainer, unmount: unmount4 } = render(
      <AllDayEventCard
        event={futureEvent({
          isAllDay: true,
          title: "Conference",
          attendees: [attendee("alice@example.com", "accepted")],
        })}
        isPlaceholder={false}
        position={position}
      />,
    );
    expect(attendeeContainer.innerHTML).not.toBe(baseline);
    unmount4();
  });

  it("C-18: time-label regression band — badge yields (D-7)", () => {
    const { container } = render(
      <TimedEventCard
        displayMode="saved"
        event={futureEvent({
          startDate: "2099-01-15T11:30:00.000Z",
          endDate: "2099-01-15T12:45:00.000Z",
          attendees: [attendee("alice@example.com", "accepted")],
        })}
        motionMode="idle"
        position={{ ...position, width: 150, height: 60 }}
      />,
    );

    const card = screen.getByRole("button");
    // (a) card.querySelector("[data-attendee-badge]") is null
    expect(card.querySelector(`[${ATTENDEE_BADGE_ATTRIBUTE}]`)).toBeNull();

    // (b) the time label element [data-calendar-event-time-label] is present and its textContent is the full "11:30 AM - 12:45 PM"
    const timeLabel = card.querySelector("[data-calendar-event-time-label]");
    expect(timeLabel).not.toBeNull();
    expect(timeLabel?.textContent).toBe("11:30 AM - 12:45 PM");

    // (c) the content wrapper's class attribute is exactly "flex flex-col flex-wrap items-start" — i.e. neither pr-10 nor pr-14 was applied
    const contentWrapper = container.querySelector(
      "[data-calendar-event-content]",
    );
    expect(contentWrapper?.getAttribute("class")).toBe(
      "flex flex-col flex-wrap items-start",
    );
  });

  it("C-19: above the threshold they coexist (D-7)", () => {
    render(
      <TimedEventCard
        displayMode="saved"
        event={futureEvent({
          startDate: "2099-01-15T11:30:00.000Z",
          endDate: "2099-01-15T12:45:00.000Z",
          attendees: [attendee("alice@example.com", "accepted")],
        })}
        motionMode="idle"
        position={{ ...position, width: 170, height: 60 }}
      />,
    );

    const card = screen.getByRole("button");
    expect(card.querySelector(`[${ATTENDEE_BADGE_ATTRIBUTE}]`)).not.toBeNull();
    const timeLabel = card.querySelector("[data-calendar-event-time-label]");
    expect(timeLabel).not.toBeNull();
    expect(timeLabel?.textContent).toBe("11:30 AM - 12:45 PM");
  });

  it("C-20: the gate is a conjunction, not a raised floor (D-7)", () => {
    render(
      <TimedEventCard
        displayMode="saved"
        event={futureEvent({
          attendees: [attendee("alice@example.com", "accepted")],
        })}
        motionMode="idle"
        position={{ ...position, width: 150, height: 30 }}
      />,
    );

    const card = screen.getByRole("button");
    expect(card.querySelector(`[${ATTENDEE_BADGE_ATTRIBUTE}]`)).not.toBeNull();
  });
});
