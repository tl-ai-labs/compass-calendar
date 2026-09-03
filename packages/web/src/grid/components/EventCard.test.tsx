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

  it("renders the join link when a timed event has a conference", () => {
    render(
      <TimedEventCard
        displayMode="saved"
        event={createEvent({
          conference: {
            label: "Google Meet",
            url: "https://meet.example.com/x",
          },
        })}
        motionMode="idle"
        position={position}
      />,
    );

    expect(
      screen.getByRole("link", { name: "Join Planning block" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Planning block/ }),
    ).toBeInTheDocument();
  });

  it("does not render the join link when a timed event has no conference", () => {
    render(
      <TimedEventCard
        displayMode="saved"
        event={createEvent()}
        motionMode="idle"
        position={position}
      />,
    );

    expect(screen.queryByRole("link")).toBeNull();
  });

  it("hides the timed join link when displayMode is placeholder", () => {
    render(
      <TimedEventCard
        displayMode="placeholder"
        event={createEvent({
          conference: {
            label: "Google Meet",
            url: "https://meet.example.com/x",
          },
        })}
        motionMode="idle"
        position={position}
      />,
    );

    expect(screen.queryByRole("link")).toBeNull();
  });

  it("hides the timed join link when motionMode is dragging", () => {
    render(
      <TimedEventCard
        displayMode="saved"
        event={createEvent({
          conference: {
            label: "Google Meet",
            url: "https://meet.example.com/x",
          },
        })}
        motionMode="dragging"
        position={position}
      />,
    );

    expect(screen.queryByRole("link")).toBeNull();
  });

  it("hides the timed join link when position width is below threshold", () => {
    render(
      <TimedEventCard
        displayMode="saved"
        event={createEvent({
          conference: {
            label: "Google Meet",
            url: "https://meet.example.com/x",
          },
        })}
        motionMode="idle"
        position={{ ...position, width: 30 }}
      />,
    );

    expect(screen.queryByRole("link")).toBeNull();
  });

  it("hides the timed join link on a 15-minute event", () => {
    render(
      <TimedEventCard
        displayMode="saved"
        event={createEvent({
          conference: {
            label: "Google Meet",
            url: "https://meet.example.com/x",
          },
          endDate: "2024-01-15T09:15:00.000Z",
          startDate: "2024-01-15T09:00:00.000Z",
        })}
        motionMode="idle"
        position={position}
      />,
    );

    expect(screen.queryByRole("link")).toBeNull();
  });

  it("renders the timed join link when displayMode is draft", () => {
    render(
      <TimedEventCard
        displayMode="draft"
        event={createEvent({
          conference: {
            label: "Google Meet",
            url: "https://meet.example.com/x",
          },
        })}
        motionMode="idle"
        position={position}
      />,
    );

    expect(
      screen.getByRole("link", { name: "Join Planning block" }),
    ).toBeInTheDocument();
  });

  it("hides the timed join link when conference url uses javascript scheme", () => {
    render(
      <TimedEventCard
        displayMode="saved"
        event={createEvent({
          conference: {
            label: "Google Meet",
            url: "javascript:alert(1)",
          },
        })}
        motionMode="idle"
        position={position}
      />,
    );

    expect(screen.queryByRole("link")).toBeNull();
  });

  it("keeps the repeat icon visible when both repeat and join icons show on a timed event", () => {
    const { container } = render(
      <TimedEventCard
        displayMode="saved"
        event={createEvent({
          conference: {
            label: "Google Meet",
            url: "https://meet.example.com/x",
          },
          recurrence: { eventId: "series-1", rule: ["RRULE:FREQ=WEEKLY"] },
        })}
        motionMode="idle"
        position={position}
      />,
    );

    expect(
      screen.getByRole("link", { name: "Join Planning block" }),
    ).toBeInTheDocument();
    expect(container.querySelector('svg[class*="right-1"]')).not.toBeNull();
  });

  it("renders all-day join link when conference exists and omits it without conference", () => {
    const { rerender } = render(
      <AllDayEventCard
        event={createEvent({
          conference: {
            label: "Google Meet",
            url: "https://meet.example.com/x",
          },
          isAllDay: true,
          title: "Conference",
        })}
        isPlaceholder={false}
        position={position}
      />,
    );

    expect(
      screen.getByRole("link", { name: "Join Conference" }),
    ).toBeInTheDocument();

    rerender(
      <AllDayEventCard
        event={createEvent({
          isAllDay: true,
          title: "Conference",
        })}
        isPlaceholder={false}
        position={position}
      />,
    );

    expect(screen.queryByRole("link")).toBeNull();
  });

  it("hides the all-day join link when isPlaceholder is true", () => {
    render(
      <AllDayEventCard
        event={createEvent({
          conference: {
            label: "Google Meet",
            url: "https://meet.example.com/x",
          },
          isAllDay: true,
          title: "Conference",
        })}
        isPlaceholder={true}
        position={position}
      />,
    );

    expect(screen.queryByRole("link")).toBeNull();
  });

  it("hides the all-day join link when width is below threshold", () => {
    render(
      <AllDayEventCard
        event={createEvent({
          conference: {
            label: "Google Meet",
            url: "https://meet.example.com/x",
          },
          isAllDay: true,
          title: "Conference",
        })}
        isPlaceholder={false}
        position={{ ...position, width: 30 }}
      />,
    );

    expect(screen.queryByRole("link")).toBeNull();
  });

  it("adds pr-10 class to all-day title row when both repeat and join icons show", () => {
    render(
      <AllDayEventCard
        event={createEvent({
          conference: {
            label: "Google Meet",
            url: "https://meet.example.com/x",
          },
          isAllDay: true,
          recurrence: { eventId: "series-1", rule: ["RRULE:FREQ=WEEKLY"] },
          title: "Conference",
        })}
        isPlaceholder={false}
        position={position}
      />,
    );

    expect(
      screen.getByRole("link", { name: "Join Conference" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Conference").parentElement).toHaveClass("pr-10");
  });

  // The central invariant of this change, and the one thing that would silently
  // regress if someone later "tidied" the fragment back into the card: the join
  // control must NOT be a descendant of the role="button" root. The button role
  // declares its children presentational, so a focusable descendant is an axe
  // nested-interactive violation and a screen reader in browse mode may not
  // expose the control at all. Every other join assertion in this file passes
  // just as happily with the anchor nested.
  it("renders the timed join control as a sibling of the card, not a child", () => {
    render(
      <TimedEventCard
        displayMode="saved"
        event={createEvent({
          conference: {
            label: "Google Meet",
            url: "https://meet.example.com/x",
          },
        })}
        motionMode="idle"
        position={position}
      />,
    );

    const card = screen.getByRole("button");
    const link = screen.getByRole("link", { name: "Join Planning block" });

    expect(card.contains(link)).toBe(false);
  });

  it("renders the all-day join control as a sibling of the card, not a child", () => {
    render(
      <AllDayEventCard
        event={createEvent({
          conference: {
            label: "Google Meet",
            url: "https://meet.example.com/x",
          },
          isAllDay: true,
          title: "Conference",
        })}
        isPlaceholder={false}
        position={position}
      />,
    );

    const card = screen.getByRole("button");
    const link = screen.getByRole("link", { name: "Join Conference" });

    expect(card.contains(link)).toBe(false);
  });

  it("renders the timed join control at exactly the width gate and hides it one pixel below", () => {
    const event = createEvent({
      conference: { label: "Google Meet", url: "https://meet.example.com/x" },
    });

    const { rerender } = render(
      <TimedEventCard
        displayMode="saved"
        event={event}
        motionMode="idle"
        position={{ ...position, width: 60 }}
      />,
    );

    expect(
      screen.getByRole("link", { name: "Join Planning block" }),
    ).toBeInTheDocument();

    rerender(
      <TimedEventCard
        displayMode="saved"
        event={event}
        motionMode="idle"
        position={{ ...position, width: 59 }}
      />,
    );

    expect(screen.queryByRole("link")).toBeNull();
  });

  it("renders the timed join control on an exactly-30-minute event", () => {
    // The gate is `>= 30` and must stay inclusive: the demo seed's only
    // conference-bearing event ("Morning standup") is exactly 30 minutes, and it
    // is what gives the e2e accessibility scan a join control to look at.
    render(
      <TimedEventCard
        displayMode="saved"
        event={createEvent({
          conference: {
            label: "Google Meet",
            url: "https://meet.example.com/x",
          },
          endDate: "2024-01-15T09:30:00.000Z",
          startDate: "2024-01-15T09:00:00.000Z",
        })}
        motionMode="idle"
        position={position}
      />,
    );

    expect(
      screen.getByRole("link", { name: "Join Planning block" }),
    ).toBeInTheDocument();
  });

  it("insets the join control to clear the repeat glyph only when that glyph shows", () => {
    // Pins the rightInsetPx wiring. Without it the control would sit on top of
    // the repeat icon and nothing else in this file would notice.
    const conference = {
      label: "Google Meet",
      url: "https://meet.example.com/x",
    };

    const { rerender } = render(
      <TimedEventCard
        displayMode="saved"
        event={createEvent({ conference })}
        motionMode="idle"
        position={position}
      />,
    );

    // left = 10 + 140 - 2 - 24
    expect(screen.getByRole("link").style.left).toBe("124px");

    rerender(
      <TimedEventCard
        displayMode="saved"
        event={createEvent({
          conference,
          recurrence: { eventId: "series-1", rule: ["RRULE:FREQ=WEEKLY"] },
        })}
        motionMode="idle"
        position={position}
      />,
    );

    // left = 10 + 140 - 16 - 24
    expect(screen.getByRole("link").style.left).toBe("110px");
  });
});
