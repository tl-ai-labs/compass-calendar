import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { getEventPalette } from "@web/common/styles/theme.util";
import { type GridEvent } from "@web/common/types/web.event.types";
import {
  COMPACT_EVENT_MAX_HEIGHT,
  GRID_EVENT_TITLE_COMPACT_FONT_SIZE,
  GRID_EVENT_TITLE_COMPACT_LINE_HEIGHT,
  GRID_EVENT_TITLE_FONT_SIZE,
} from "@web/grid/grid.constants";
import {
  createEventRegistry,
  EVENT_INTERACTION_IGNORE_ATTRIBUTE,
} from "@web/grid/interaction/event.registry";
import {
  initialEdgeFocusState,
  useEdgeFocusStore,
} from "@web/grid/shortcuts/edge-focus.store";
import {
  type PointerCaptureAdapter,
  PointerCaptureBoundary,
} from "@web/interaction/react/PointerCaptureBoundary";
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

const CONFERENCE = {
  label: "Google Meet",
  url: "https://meet.google.com/abc-defg-hij",
};

// Captured before any test replaces it; restored in afterEach per the repo's
// convention of putting a replaced global back in teardown.
const originalWindowOpen = window.open;

// The parameters are declared (and unused) purely so `open.mock.calls[n]` is
// typed as window.open's argument tuple. A bare `mock(() => null)` infers an
// empty tuple, which makes every calls[0]?.[i] assertion below a TS2493 even
// though it works at runtime — and those assertions are what pin NFR-4.
const stubWindowOpen = () => {
  const open = mock(
    (_url?: string | URL, _target?: string, _features?: string) => null,
  );
  window.open = open as unknown as typeof window.open;
  return open;
};

describe("EventCard", () => {
  afterEach(() => {
    useEdgeFocusStore.setState(initialEdgeFocusState, true);
    window.open = originalWindowOpen;
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

  it("renders a join control on a timed event with a conference link", () => {
    render(
      <TimedEventCard
        displayMode="saved"
        event={createEvent({ conference: CONFERENCE })}
        motionMode="idle"
        position={position}
      />,
    );

    expect(
      screen.getByRole("button", {
        name: "Join Google Meet (meet.google.com)",
      }),
    ).toBeInTheDocument();
  });

  it("renders no join control on a timed event without a conference link", () => {
    render(
      <TimedEventCard
        displayMode="saved"
        event={createEvent()}
        motionMode="idle"
        position={position}
      />,
    );

    expect(screen.queryByRole("button", { name: /join/i })).toBeNull();
  });

  it("renders a join control on an all-day event with a conference link", () => {
    render(
      <AllDayEventCard
        event={createEvent({ conference: CONFERENCE, isAllDay: true })}
        isPlaceholder={false}
        position={position}
      />,
    );

    expect(
      screen.getByRole("button", {
        name: "Join Google Meet (meet.google.com)",
      }),
    ).toBeInTheDocument();
  });

  it("renders no join control on an all-day event without a conference link", () => {
    render(
      <AllDayEventCard
        event={createEvent({ isAllDay: true })}
        isPlaceholder={false}
        position={position}
      />,
    );

    expect(screen.queryByRole("button", { name: /join/i })).toBeNull();
  });

  it("opens the conference link in a new tab with noopener and noreferrer", () => {
    const open = stubWindowOpen();

    render(
      <TimedEventCard
        displayMode="saved"
        event={createEvent({ conference: CONFERENCE })}
        motionMode="idle"
        position={position}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /join/i }));

    expect(open).toHaveBeenCalledTimes(1);
    expect(open.mock.calls[0]?.[0]).toBe(CONFERENCE.url);
    expect(open.mock.calls[0]?.[1]).toBe("_blank");
    // Both are load-bearing: the button has no rel attribute to fall back on,
    // so this string is the only thing keeping window.opener away from the
    // opened page (NFR-4). Never weaken to a partial match.
    expect(open.mock.calls[0]?.[2]).toContain("noopener");
    expect(open.mock.calls[0]?.[2]).toContain("noreferrer");
  });

  it("does not start a timed card interaction when the join control is clicked", () => {
    stubWindowOpen();
    const onEventMouseDown = mock();

    render(
      <TimedEventCard
        displayMode="saved"
        event={createEvent({ conference: CONFERENCE })}
        motionMode="idle"
        onEventMouseDown={onEventMouseDown}
        position={position}
      />,
    );

    const joinButton = screen.getByRole("button", { name: /join/i });
    fireEvent.mouseDown(joinButton);
    fireEvent.click(joinButton);

    expect(onEventMouseDown).not.toHaveBeenCalled();
  });

  it("does not start an all-day card interaction when the join control is clicked", () => {
    stubWindowOpen();
    const onEventMouseDown = mock();

    render(
      <AllDayEventCard
        event={createEvent({ conference: CONFERENCE, isAllDay: true })}
        isPlaceholder={false}
        onEventMouseDown={onEventMouseDown}
        position={position}
      />,
    );

    const joinButton = screen.getByRole("button", { name: /join/i });
    fireEvent.mouseDown(joinButton);
    fireEvent.click(joinButton);

    expect(onEventMouseDown).not.toHaveBeenCalled();
  });

  it("keeps join keyboard activation off the timed card's key handler", () => {
    stubWindowOpen();
    const onEventKeyDown = mock();

    render(
      <TimedEventCard
        displayMode="saved"
        event={createEvent({ conference: CONFERENCE })}
        motionMode="idle"
        onEventKeyDown={onEventKeyDown}
        position={position}
      />,
    );

    const joinButton = screen.getByRole("button", { name: /join/i });
    fireEvent.keyDown(joinButton, { key: "Enter" });
    fireEvent.keyDown(joinButton, { key: " " });

    expect(onEventKeyDown).not.toHaveBeenCalled();
  });

  it("keeps join keyboard activation off the all-day card's key handler", () => {
    stubWindowOpen();
    const onEventKeyDown = mock();

    render(
      <AllDayEventCard
        event={createEvent({ conference: CONFERENCE, isAllDay: true })}
        isPlaceholder={false}
        onEventKeyDown={onEventKeyDown}
        position={position}
      />,
    );

    const joinButton = screen.getByRole("button", { name: /join/i });
    fireEvent.keyDown(joinButton, { key: "Enter" });
    fireEvent.keyDown(joinButton, { key: " " });

    expect(onEventKeyDown).not.toHaveBeenCalled();
  });

  it("does not reach a parent shortcut listener from the join control", () => {
    stubWindowOpen();
    const onParentKeyDown = mock();

    render(
      // biome-ignore lint/a11y/noStaticElementInteractions: test wrapper simulates a parent shortcut listener.
      <div onKeyDown={onParentKeyDown}>
        <TimedEventCard
          displayMode="saved"
          event={createEvent({ conference: CONFERENCE })}
          motionMode="idle"
          position={position}
        />
      </div>,
    );

    fireEvent.keyDown(screen.getByRole("button", { name: /join/i }), {
      key: "Enter",
    });

    expect(onParentKeyDown).not.toHaveBeenCalled();
  });

  it("activates the join control with Enter from the keyboard", async () => {
    const open = stubWindowOpen();
    const user = userEvent.setup();

    render(
      <TimedEventCard
        displayMode="saved"
        event={createEvent({ conference: CONFERENCE })}
        motionMode="idle"
        position={position}
      />,
    );

    // fireEvent.keyDown would not prove this: only a real keydown->click
    // sequence shows that stopPropagation did not also cancel activation.
    screen.getByRole("button", { name: /join/i }).focus();
    await user.keyboard("{Enter}");

    expect(open).toHaveBeenCalledTimes(1);
    expect(open.mock.calls[0]?.[0]).toBe(CONFERENCE.url);
  });

  it("renders no join control on a timed placeholder", () => {
    render(
      <TimedEventCard
        displayMode="placeholder"
        event={createEvent({ conference: CONFERENCE })}
        motionMode="idle"
        position={position}
      />,
    );

    expect(screen.queryByRole("button", { name: /join/i })).toBeNull();
  });

  it("renders no join control on an all-day placeholder", () => {
    render(
      <AllDayEventCard
        event={createEvent({ conference: CONFERENCE, isAllDay: true })}
        isPlaceholder={true}
        position={position}
      />,
    );

    expect(screen.queryByRole("button", { name: /join/i })).toBeNull();
  });

  it("renders no join control for a non-http conference link", () => {
    // A cached row from an older schema, a hand-seeded demo event, or a future
    // contract relaxation could carry any of these; none may become clickable.
    const unsafeUrls = [
      "javascript:alert(1)",
      "  javascript:alert(1)  ",
      "data:text/html,<h1>x</h1>",
    ];

    for (const url of unsafeUrls) {
      const { unmount } = render(
        <TimedEventCard
          displayMode="saved"
          event={createEvent({ conference: { label: "Google Meet", url } })}
          motionMode="idle"
          position={position}
        />,
      );

      expect(screen.queryByRole("button", { name: /join/i })).toBeNull();
      unmount();
    }
  });

  it("falls back to a generic join name without a provider label", () => {
    render(
      <TimedEventCard
        displayMode="saved"
        event={createEvent({
          conference: { label: null, url: CONFERENCE.url },
        })}
        motionMode="idle"
        position={position}
      />,
    );

    expect(
      screen.getByRole("button", { name: "Join video call (meet.google.com)" }),
    ).toBeInTheDocument();
  });

  it("does not put a URL-shaped conference label in the accessible name", () => {
    render(
      <TimedEventCard
        displayMode="saved"
        event={createEvent({
          conference: {
            label: "meet.google.com/abc-defg-hij",
            url: CONFERENCE.url,
          },
        })}
        motionMode="idle"
        position={position}
      />,
    );

    expect(
      screen.getByRole("button", { name: "Join video call (meet.google.com)" }),
    ).toBeInTheDocument();
  });

  it("discloses the conference host, but never the meeting token, on the join control", () => {
    // ADR-1 renders a <button> rather than an <a href>, which keeps the URL out
    // of the DOM but also removes the browser's own pre-navigation disclosure
    // (hover status bar, copy-link-address). The host is restored so the user
    // can tell where a provider-supplied link goes before clicking it; the path
    // is the capability token and must stay out of both the a11y tree and the
    // tooltip.
    render(
      <TimedEventCard
        displayMode="saved"
        event={createEvent({ conference: CONFERENCE })}
        motionMode="idle"
        position={position}
      />,
    );

    const joinButton = screen.getByRole("button", { name: /join/i });
    const accessibleName = joinButton.getAttribute("aria-label") ?? "";

    expect(accessibleName).toContain("meet.google.com");
    expect(accessibleName).not.toContain("abc-defg-hij");

    // The sighted-hover affordance discloses exactly what the screen reader
    // announces — no more, no less.
    expect(joinButton.getAttribute("title")).toBe(accessibleName);
    expect(document.body.innerHTML).not.toContain("abc-defg-hij");
  });

  it("shifts the join control left when the repeat icon shares the corner", () => {
    const withRepeat = render(
      <TimedEventCard
        displayMode="saved"
        event={createEvent({
          conference: CONFERENCE,
          recurrence: { eventId: "series-1", rule: ["RRULE:FREQ=WEEKLY"] },
        })}
        motionMode="idle"
        position={position}
      />,
    );

    expect(screen.getByRole("button", { name: /join/i }).className).toContain(
      "right-4",
    );
    withRepeat.unmount();

    render(
      <TimedEventCard
        displayMode="saved"
        event={createEvent({ conference: CONFERENCE })}
        motionMode="idle"
        position={position}
      />,
    );

    const soloClass = screen.getByRole("button", { name: /join/i }).className;
    expect(soloClass).toContain("right-1");
    expect(soloClass).not.toContain("right-4");
  });

  it("hides the join control on a card too narrow for it", () => {
    const narrowTimed = render(
      <TimedEventCard
        displayMode="saved"
        event={createEvent({ conference: CONFERENCE })}
        motionMode="idle"
        position={{ ...position, width: 30 }}
      />,
    );

    expect(screen.queryByRole("button", { name: /join/i })).toBeNull();
    narrowTimed.unmount();

    // 50 clears the join-alone gate (40) but not the both-icons gate (64), so
    // the repeat glyph stays and the join control drops out.
    const withRepeat = render(
      <TimedEventCard
        displayMode="saved"
        event={createEvent({
          conference: CONFERENCE,
          recurrence: { eventId: "series-1", rule: ["RRULE:FREQ=WEEKLY"] },
        })}
        motionMode="idle"
        position={{ ...position, width: 50 }}
      />,
    );

    expect(
      withRepeat.container.querySelector('svg[class*="right-1"]'),
    ).not.toBeNull();
    expect(screen.queryByRole("button", { name: /join/i })).toBeNull();
    withRepeat.unmount();

    render(
      <AllDayEventCard
        event={createEvent({ conference: CONFERENCE, isAllDay: true })}
        isPlaceholder={false}
        position={{ ...position, width: 50 }}
      />,
    );

    expect(screen.queryByRole("button", { name: /join/i })).toBeNull();
  });

  it("steps the all-day title reserve up as icons are added", () => {
    const renderAllDay = (overrides: Partial<GridEvent> = {}) =>
      render(
        <AllDayEventCard
          event={createEvent({
            isAllDay: true,
            title: "Conference",
            ...overrides,
          })}
          isPlaceholder={false}
          position={position}
        />,
      );
    const titleRowClass = () =>
      screen.getByText("Conference").parentElement?.className;
    const recurrence = { eventId: "series-1", rule: ["RRULE:FREQ=WEEKLY"] };

    // No icons: no reserve at all, so a plain event is byte-identical to today.
    const plain = renderAllDay();
    expect(titleRowClass()).toBe("flex min-w-0 items-center");
    plain.unmount();

    const repeatOnly = renderAllDay({ recurrence });
    expect(titleRowClass()).toContain("pr-3.5");
    repeatOnly.unmount();

    const joinOnly = renderAllDay({ conference: CONFERENCE });
    expect(titleRowClass()).toContain("pr-4");
    joinOnly.unmount();

    renderAllDay({ conference: CONFERENCE, recurrence });
    expect(titleRowClass()).toContain("pr-7");
  });

  it("keeps the conference URL out of the DOM and out of autocapture", () => {
    const { container } = render(
      <TimedEventCard
        displayMode="saved"
        event={createEvent({ conference: CONFERENCE })}
        motionMode="idle"
        position={position}
      />,
    );

    // The URL reaches window.open only; it is never an href, a data-* copy, or
    // any other attribute autocapture could serialise.
    expect(screen.getByRole("button", { name: /join/i })).toHaveClass(
      "ph-no-capture",
    );
    expect(container.innerHTML).not.toContain(CONFERENCE.url);
  });

  it("protects busy events by contract rather than by an isBusy guard", () => {
    // The role matrix (requirements §6) rules join "not possible" for busy
    // events because the contract never populates `conference` on them, and
    // explicitly declines to add a redundant isBusy guard. Asserting only the
    // first half would duplicate the no-conference case and pin nothing, so
    // this pins both halves — including the absence of the guard.
    const busy = createEvent({ isBusy: true });
    expect(busy.conference).toBeUndefined();

    const contractual = render(
      <TimedEventCard
        displayMode="saved"
        event={busy}
        motionMode="idle"
        position={position}
      />,
    );

    expect(screen.queryByRole("button", { name: /join/i })).toBeNull();
    contractual.unmount();

    // There is no isBusy guard: if an upstream change ever did attach a
    // conference to a busy event, the join control WOULD render. If you are
    // reading this because the assertion failed, someone added that guard —
    // which is a fine thing to do, but the role matrix must be updated to
    // match instead of leaving two sources of truth.
    render(
      <TimedEventCard
        displayMode="saved"
        event={createEvent({ conference: CONFERENCE, isBusy: true })}
        motionMode="idle"
        position={position}
      />,
    );

    expect(screen.queryByRole("button", { name: /join/i })).not.toBeNull();
  });

  it("marks the join control as an interaction-ignore subtree", () => {
    render(
      <TimedEventCard
        displayMode="saved"
        event={createEvent({ conference: CONFERENCE })}
        motionMode="idle"
        position={position}
      />,
    );

    expect(screen.getByRole("button", { name: /join/i })).toHaveAttribute(
      EVENT_INTERACTION_IGNORE_ATTRIBUTE,
      "true",
    );
  });

  it("does not let the grid claim a pointerdown that lands on the join control", () => {
    // The regression test for the one-click-join blocker, and the reason the
    // design's "this path cannot be automated" note was wrong:
    // PointerCaptureBoundary is mountable and fireEvent.pointerDown reaches
    // it. Stopping propagation on the button cannot help here — the boundary
    // binds onPointerDownCapture on an ancestor and consumes the event in the
    // capture phase, before any descendant handler runs. Only the registry
    // declining to resolve the card keeps the grid off this button.
    stubWindowOpen();

    const registry = createEventRegistry<"all-day" | "timed">({
      eventIdAttribute: "data-week-interaction-event-id",
      eventTypeAttribute: "data-week-interaction-event-type",
      isEventType: (value): value is "all-day" | "timed" =>
        value === "all-day" || value === "timed",
    });
    const owned: string[] = [];
    const adapter: PointerCaptureAdapter = {
      cancel: () => undefined,
      connectCancellationEvents: () => () => undefined,
      handlePointerCancel: () => false,
      handlePointerDown: (event) => {
        const resolved = registry.resolveFromTarget(event.target);

        if (!resolved) {
          return { reason: "no-event-target", shouldOwn: false };
        }

        owned.push(resolved.eventId);
        return { reason: "event-target", shouldOwn: true };
      },
      handlePointerMove: () => false,
      handlePointerUp: () => false,
    };

    render(
      <PointerCaptureBoundary adapter={adapter}>
        <TimedEventCard
          displayMode="saved"
          event={createEvent({ conference: CONFERENCE })}
          motionMode="idle"
          position={position}
        />
      </PointerCaptureBoundary>,
    );

    const card = screen.getByRole("button", {
      name: "Timed event: Planning block, 9 - 10 AM",
    });
    registry.register({
      element: card,
      eventId: "event-1",
      eventType: "timed",
    });

    // The card body still starts an interaction — the fix must not make the
    // whole card undraggable.
    fireEvent.pointerDown(screen.getByText("Planning block"));
    expect(owned).toEqual(["event-1"]);

    // The join control does not.
    fireEvent.pointerDown(screen.getByRole("button", { name: /join/i }));
    expect(owned).toEqual(["event-1"]);
  });
});
