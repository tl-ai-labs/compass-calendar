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

  describe("join affordance", () => {
    const conferenceUrl = "https://meet.google.com/abc-defg-hij";

    it("renders a link with correct href and aria-label on both cards for a valid https url (AC-1)", () => {
      const event = createEvent({
        conference: { label: null, url: conferenceUrl },
        title: "Team Standup",
      });

      const { unmount } = render(
        <TimedEventCard
          displayMode="saved"
          event={event}
          motionMode="idle"
          position={position}
        />,
      );

      const timedLink = screen.getByRole("link", {
        name: "Join meeting: Team Standup",
      });
      expect(timedLink).toHaveAttribute("href", conferenceUrl);

      unmount();

      render(
        <AllDayEventCard
          event={{ ...event, isAllDay: true }}
          isPlaceholder={false}
          position={position}
        />,
      );

      const allDayLink = screen.getByRole("link", {
        name: "Join meeting: Team Standup",
      });
      expect(allDayLink).toHaveAttribute("href", conferenceUrl);
    });

    it("renders no link for hostile schemes with an https positive control (AC-2)", () => {
      const hostileSchemes = [
        "javascript:alert(1)",
        "data:text/html,<b>hi</b>",
        "vbscript:msgbox(1)",
        "file:///etc/passwd",
      ];

      for (const schemeUrl of hostileSchemes) {
        const { unmount: unmountTimed } = render(
          <TimedEventCard
            displayMode="saved"
            event={createEvent({
              conference: { label: null, url: schemeUrl as unknown as string },
            })}
            motionMode="idle"
            position={position}
          />,
        );
        expect(screen.queryByRole("link")).toBeNull();
        unmountTimed();

        const { unmount: unmountAllDay } = render(
          <AllDayEventCard
            event={createEvent({
              conference: { label: null, url: schemeUrl as unknown as string },
              isAllDay: true,
            })}
            isPlaceholder={false}
            position={position}
          />,
        );
        expect(screen.queryByRole("link")).toBeNull();
        unmountAllDay();
      }

      // Positive control under identical props
      const { unmount: unmountTimedControl } = render(
        <TimedEventCard
          displayMode="saved"
          event={createEvent({
            conference: { label: null, url: conferenceUrl },
          })}
          motionMode="idle"
          position={position}
        />,
      );
      expect(screen.getByRole("link")).toHaveAttribute("href", conferenceUrl);
      unmountTimedControl();

      render(
        <AllDayEventCard
          event={createEvent({
            conference: { label: null, url: conferenceUrl },
            isAllDay: true,
          })}
          isPlaceholder={false}
          position={position}
        />,
      );
      expect(screen.getByRole("link")).toHaveAttribute("href", conferenceUrl);
    });

    it("renders no link when conference is undefined, null, or url is empty string (AC-3)", () => {
      const cases = [
        undefined,
        null,
        { label: null, url: "" },
        { label: null, url: "   " },
      ];

      for (const conference of cases) {
        const { unmount: unmountTimed } = render(
          <TimedEventCard
            displayMode="saved"
            event={createEvent({ conference })}
            motionMode="idle"
            position={position}
          />,
        );
        expect(screen.queryByRole("link")).toBeNull();
        unmountTimed();

        const { unmount: unmountAllDay } = render(
          <AllDayEventCard
            event={createEvent({ conference, isAllDay: true })}
            isPlaceholder={false}
            position={position}
          />,
        );
        expect(screen.queryByRole("link")).toBeNull();
        unmountAllDay();
      }
    });

    it("timed card hides the link when duration < 15 minutes (AC-4)", () => {
      const { unmount } = render(
        <TimedEventCard
          displayMode="saved"
          event={createEvent({
            conference: { label: null, url: conferenceUrl },
            startDate: "2024-01-15T09:00:00.000Z",
            endDate: "2024-01-15T09:14:00.000Z",
          })}
          motionMode="idle"
          position={position}
        />,
      );
      expect(screen.queryByRole("link")).toBeNull();
      unmount();

      render(
        <TimedEventCard
          displayMode="saved"
          event={createEvent({
            conference: { label: null, url: conferenceUrl },
            startDate: "2024-01-15T09:00:00.000Z",
            endDate: "2024-01-15T09:15:00.000Z",
          })}
          motionMode="idle"
          position={position}
        />,
      );
      expect(screen.getByRole("link")).toBeInTheDocument();
    });

    it("timed card hides the link when position.width < 40 (AC-5)", () => {
      const { unmount } = render(
        <TimedEventCard
          displayMode="saved"
          event={createEvent({
            conference: { label: null, url: conferenceUrl },
          })}
          motionMode="idle"
          position={{ ...position, width: 39 }}
        />,
      );
      expect(screen.queryByRole("link")).toBeNull();
      unmount();

      render(
        <TimedEventCard
          displayMode="saved"
          event={createEvent({
            conference: { label: null, url: conferenceUrl },
          })}
          motionMode="idle"
          position={{ ...position, width: 40 }}
        />,
      );
      expect(screen.getByRole("link")).toBeInTheDocument();
    });

    it("recurring timed event with a conference renders both icons, join at right-4.5 (AC-6)", () => {
      const { container } = render(
        <TimedEventCard
          displayMode="saved"
          event={createEvent({
            conference: { label: null, url: conferenceUrl },
            recurrence: { eventId: "series-1", rule: ["RRULE:FREQ=WEEKLY"] },
          })}
          motionMode="idle"
          position={position}
        />,
      );

      const repeatIcon = container.querySelector('svg[class*="right-1"]');
      const joinLink = screen.getByRole("link");

      expect(repeatIcon).not.toBeNull();
      expect(joinLink).toHaveClass("right-4.5");
      expect(joinLink).not.toHaveClass("right-1");
    });

    it("all-day title container padding across all four permutations (AC-7)", () => {
      // 1. Neither: repeat=no, join=no
      const { container: c1, unmount: u1 } = render(
        <AllDayEventCard
          event={createEvent({
            isAllDay: true,
            title: "Test Event",
          })}
          isPlaceholder={false}
          position={position}
        />,
      );
      const titleWrapper1 = screen.getByText("Test Event").parentElement;
      expect(titleWrapper1).not.toHaveClass("pr-7");
      expect(titleWrapper1).not.toHaveClass("pr-3.5");
      expect(c1.querySelector('svg[class*="right-1"]')).toBeNull();
      expect(screen.queryByRole("link")).toBeNull();
      u1();

      // 2. Repeat only: repeat=yes, join=no
      const { container: c2, unmount: u2 } = render(
        <AllDayEventCard
          event={createEvent({
            isAllDay: true,
            recurrence: { eventId: "series-1", rule: ["RRULE:FREQ=WEEKLY"] },
            title: "Test Event",
          })}
          isPlaceholder={false}
          position={position}
        />,
      );
      const titleWrapper2 = screen.getByText("Test Event").parentElement;
      expect(titleWrapper2).toHaveClass("pr-3.5");
      expect(titleWrapper2).not.toHaveClass("pr-7");
      expect(c2.querySelector('svg[class*="right-1"]')).not.toBeNull();
      expect(screen.queryByRole("link")).toBeNull();
      u2();

      // 3. Join only: repeat=no, join=yes
      const { container: c3, unmount: u3 } = render(
        <AllDayEventCard
          event={createEvent({
            conference: { label: null, url: conferenceUrl },
            isAllDay: true,
            title: "Test Event",
          })}
          isPlaceholder={false}
          position={position}
        />,
      );
      const titleWrapper3 = screen.getByText("Test Event").parentElement;
      expect(titleWrapper3).toHaveClass("pr-3.5");
      expect(titleWrapper3).not.toHaveClass("pr-7");
      expect(c3.querySelector('svg[class*="right-1"]')).toBeNull();
      expect(screen.getByRole("link")).toBeInTheDocument();
      u3();

      // 4. Both: repeat=yes, join=yes
      const { container: c4 } = render(
        <AllDayEventCard
          event={createEvent({
            conference: { label: null, url: conferenceUrl },
            isAllDay: true,
            recurrence: { eventId: "series-1", rule: ["RRULE:FREQ=WEEKLY"] },
            title: "Test Event",
          })}
          isPlaceholder={false}
          position={position}
        />,
      );
      const titleWrapper4 = screen.getByText("Test Event").parentElement;
      expect(titleWrapper4).toHaveClass("pr-7");
      expect(titleWrapper4).not.toHaveClass("pr-3.5");
      expect(c4.querySelector('svg[class*="right-1"]')).not.toBeNull();
      expect(screen.getByRole("link")).toBeInTheDocument();
    });

    it("fireEvent.mouseDown and .click on the link do not invoke onEventMouseDown or onScalerMouseDown (AC-8)", () => {
      const onEventMouseDownTimed = mock();
      const onScalerMouseDownTimed = mock();
      const onEventMouseDownAllDay = mock();
      const onScalerMouseDownAllDay = mock();

      const { unmount } = render(
        <TimedEventCard
          displayMode="saved"
          event={createEvent({
            conference: { label: null, url: conferenceUrl },
          })}
          motionMode="idle"
          onEventMouseDown={onEventMouseDownTimed}
          onScalerMouseDown={onScalerMouseDownTimed}
          position={position}
        />,
      );

      const timedLink = screen.getByRole("link");
      fireEvent.mouseDown(timedLink);
      fireEvent.click(timedLink);

      expect(onEventMouseDownTimed).not.toHaveBeenCalled();
      expect(onScalerMouseDownTimed).not.toHaveBeenCalled();
      unmount();

      render(
        <AllDayEventCard
          event={createEvent({
            conference: { label: null, url: conferenceUrl },
            isAllDay: true,
          })}
          isPlaceholder={false}
          onEventMouseDown={onEventMouseDownAllDay}
          onScalerMouseDown={onScalerMouseDownAllDay}
          position={position}
        />,
      );

      const allDayLink = screen.getByRole("link");
      fireEvent.mouseDown(allDayLink);
      fireEvent.click(allDayLink);

      expect(onEventMouseDownAllDay).not.toHaveBeenCalled();
      expect(onScalerMouseDownAllDay).not.toHaveBeenCalled();
    });

    it("keyDown Enter and Space on the link do not invoke onEventKeyDown (AC-9)", () => {
      const onEventKeyDownTimed = mock();
      const onEventKeyDownAllDay = mock();

      const { unmount } = render(
        <TimedEventCard
          displayMode="saved"
          event={createEvent({
            conference: { label: null, url: conferenceUrl },
          })}
          motionMode="idle"
          onEventKeyDown={onEventKeyDownTimed}
          position={position}
        />,
      );

      const timedLink = screen.getByRole("link");
      fireEvent.keyDown(timedLink, { key: "Enter" });
      fireEvent.keyDown(timedLink, { key: " " });

      expect(onEventKeyDownTimed).not.toHaveBeenCalled();
      unmount();

      render(
        <AllDayEventCard
          event={createEvent({
            conference: { label: null, url: conferenceUrl },
            isAllDay: true,
          })}
          isPlaceholder={false}
          onEventKeyDown={onEventKeyDownAllDay}
          position={position}
        />,
      );

      const allDayLink = screen.getByRole("link");
      fireEvent.keyDown(allDayLink, { key: "Enter" });
      fireEvent.keyDown(allDayLink, { key: " " });

      expect(onEventKeyDownAllDay).not.toHaveBeenCalled();
    });

    it("link has target=_blank, rel='noopener noreferrer' and class ph-no-capture (AC-10)", () => {
      const { unmount } = render(
        <TimedEventCard
          displayMode="saved"
          event={createEvent({
            conference: { label: null, url: conferenceUrl },
          })}
          motionMode="idle"
          position={position}
        />,
      );

      const timedLink = screen.getByRole("link");
      expect(timedLink).toHaveAttribute("target", "_blank");
      expect(timedLink).toHaveAttribute("rel", "noopener noreferrer");
      expect(timedLink).toHaveClass("ph-no-capture");
      unmount();

      render(
        <AllDayEventCard
          event={createEvent({
            conference: { label: null, url: conferenceUrl },
            isAllDay: true,
          })}
          isPlaceholder={false}
          position={position}
        />,
      );

      const allDayLink = screen.getByRole("link");
      expect(allDayLink).toHaveAttribute("target", "_blank");
      expect(allDayLink).toHaveAttribute("rel", "noopener noreferrer");
      expect(allDayLink).toHaveClass("ph-no-capture");
    });

    it("accessible name includes the event title (AC-11)", () => {
      const { unmount } = render(
        <TimedEventCard
          displayMode="saved"
          event={createEvent({
            conference: { label: null, url: conferenceUrl },
            title: "Sprint Retro",
          })}
          motionMode="idle"
          position={position}
        />,
      );

      expect(
        screen.getByRole("link", { name: "Join meeting: Sprint Retro" }),
      ).toBeInTheDocument();
      unmount();

      render(
        <TimedEventCard
          displayMode="saved"
          event={createEvent({
            conference: { label: null, url: conferenceUrl },
            title: "",
          })}
          motionMode="idle"
          position={position}
        />,
      );

      expect(
        screen.getByRole("link", { name: "Join meeting" }),
      ).toBeInTheDocument();
    });
  });
});
