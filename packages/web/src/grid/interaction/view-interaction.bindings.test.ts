import { dayInteractionBindings } from "@web/views/Day/interaction/day-interaction.bindings";
import { weekInteractionBindings } from "@web/views/Week/interaction/week-interaction.bindings";
import { afterEach, describe, expect, it } from "bun:test";

/**
 * Table-driven replacement for the two identical per-view targeting test files
 * (`week-event.targeting.test.ts` and `day-event.targeting.test.ts`), which
 * differed only by week/day renames.
 *
 * All 8 original cases survive — 4 per view — with byte-identical
 * expectations. Nothing was merged, reworded or weakened; the collapse is
 * file-level only.
 *
 * These run against the real per-view bindings rather than a fresh factory
 * call, which keeps them honest about the production wiring.
 *
 * They do NOT, however, guard the one-registry-per-view invariant (R6), as an
 * earlier version of this comment claimed. Registry and targeting are handed
 * out by the same `createViewInteractionBindings` object, so within one
 * bindings instance they agree by construction and cannot disagree no matter
 * how many instances exist. The real guards against a split are the
 * pre-existing hook tests that register through
 * `use{Week,Day}EventRegistrationRef` and then resolve through the shims —
 * `MainGrid.test.tsx` and `useDayEventNudgeShortcuts.test.tsx`.
 */

describe.each([
  { bindings: weekInteractionBindings, name: "week" },
  { bindings: dayInteractionBindings, name: "day" },
])("$name grid event targeting", ({ bindings }) => {
  afterEach(() => {
    bindings.registry.clear();
    document.body.innerHTML = "";
  });

  const addEventButton = ({
    eventId,
    eventType = "timed",
    isVisible = true,
  }: {
    eventId?: string;
    eventType?: "all-day" | "timed";
    isVisible?: boolean;
  }) => {
    const button = document.createElement("button");
    if (isVisible) {
      Object.defineProperty(button, "offsetParent", {
        configurable: true,
        get: () => document.body,
      });
    }
    document.body.appendChild(button);

    if (eventId) {
      bindings.registry.register({
        element: button,
        eventId,
        eventType,
      });
    }

    return button;
  };

  it("prefers the focused calendar event", () => {
    addEventButton({ eventId: "first" });
    const focused = addEventButton({
      eventId: "focused",
      eventType: "all-day",
    });
    focused.focus();

    expect(bindings.getFocusedGridEventTarget()).toMatchObject({
      element: focused,
      eventId: "focused",
      eventType: "all-day",
    });
  });

  it("falls back to the first visible registered event", () => {
    addEventButton({});
    addEventButton({ eventId: "hidden", isVisible: false });
    const firstVisible = addEventButton({ eventId: "visible" });

    expect(bindings.getFirstVisibleGridEventTarget()).toMatchObject({
      element: firstVisible,
      eventId: "visible",
      eventType: "timed",
    });
  });

  it("focuses a returned calendar target", () => {
    const button = addEventButton({ eventId: "target" });
    const target = bindings.getFirstVisibleGridEventTarget();

    if (!target) throw new Error("expected target");
    bindings.focusGridEventTarget(target);

    expect(document.activeElement).toBe(button);
  });

  it("lists every visible registered event", () => {
    addEventButton({ eventId: "hidden", isVisible: false });
    const first = addEventButton({ eventId: "first" });
    const second = addEventButton({ eventId: "second" });

    expect(bindings.listVisibleGridEventTargets()).toEqual([
      expect.objectContaining({ element: first, eventId: "first" }),
      expect.objectContaining({ element: second, eventId: "second" }),
    ]);
  });
});
