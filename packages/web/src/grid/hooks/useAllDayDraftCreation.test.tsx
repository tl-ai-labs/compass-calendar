import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { useEffect } from "react";
import { YEAR_MONTH_DAY_FORMAT } from "@core/constants/date.constants";
import dayjs from "@core/util/date/dayjs";
import { type GridEventDraft } from "@web/events/event-draft.types";
import { createGridEventDraft } from "@web/events/grid-event-draft.adapter";
import { draftActions, useDraftStore } from "@web/events/stores/draft.store";
import { useAllDayDraftCreation } from "./useAllDayDraftCreation";
import { afterEach, describe, expect, it, mock, spyOn } from "bun:test";

const existingDraft = createGridEventDraft({
  kind: "allDay",
  start: new Date("2026-05-20"),
  end: new Date("2026-05-21"),
});

const COLUMN_ZERO = "2026-05-18";
const COLUMN_WIDTH_PX = 100;
const LAST_COLUMN_INDEX = 6;
const PRESS_Y = 5;

/**
 * Models the real resolver closely enough to be worth trusting:
 * `getVisibleDateIndexByX` clamps to [0, N-1], and `getDateByXY` folds y into
 * the resolved date through an unbounded `getMinuteByY`. The y term is the
 * point — it means a live clientY WOULD roll the span into the next day, so
 * the vertical-drag case below fails if the hook ever stops pinning y.
 */
const getColumnDate = (clientX: number, clientY: number) =>
  dayjs(COLUMN_ZERO)
    .add(
      Math.max(
        0,
        Math.min(LAST_COLUMN_INDEX, Math.floor(clientX / COLUMN_WIDTH_PX)),
      ),
      "day",
    )
    .add(Math.max(0, clientY), "minutes")
    .format(YEAR_MONTH_DAY_FORMAT);

const renderHarness = ({
  draft = null,
  getStartDate = () => "2026-05-20",
  isMultiDayDragEnabled = false,
  onCreateGridDraft = mock(),
  onParentMouseDown = mock(),
}: {
  draft?: GridEventDraft | null;
  getStartDate?: (clientX: number, clientY: number) => string;
  isMultiDayDragEnabled?: boolean;
  onCreateGridDraft?: (draft: GridEventDraft) => void;
  onParentMouseDown?: () => void;
} = {}) => {
  if (draft) {
    draftActions.startGridDraft({ activity: "gridClick", draft });
  }

  const Harness = () => {
    const onMouseDown = useAllDayDraftCreation({
      getStartDate,
      isMultiDayDragEnabled,
      onCreateGridDraft,
    });

    useEffect(() => {
      document.addEventListener("mousedown", onParentMouseDown);
      return () => document.removeEventListener("mousedown", onParentMouseDown);
    }, []);

    return (
      <button onMouseDown={onMouseDown} type="button">
        Empty all-day space
      </button>
    );
  };

  const { unmount } = render(<Harness />);

  return { onCreateGridDraft, onParentMouseDown, unmount };
};

/** Collects the drafts handed to the terminal callback, typed and spy-free. */
const collectDrafts = () => {
  const drafts: GridEventDraft[] = [];
  const onCreateGridDraft = mock((draft: GridEventDraft) => {
    drafts.push(draft);
  });

  return { drafts, onCreateGridDraft };
};

const datesOf = (draft: GridEventDraft) => ({
  start: dayjs(draft.values.schedule.start).format(YEAR_MONTH_DAY_FORMAT),
  end: dayjs(draft.values.schedule.end).format(YEAR_MONTH_DAY_FORMAT),
});

const storedDraftDates = () => {
  const draft = useDraftStore.getState().gridDraft;

  return draft ? datesOf(draft) : null;
};

const allDaySurface = () =>
  screen.getByRole("button", { name: "Empty all-day space" });

const pressAt = (clientX: number, clientY: number = PRESS_Y) =>
  fireEvent.mouseDown(allDaySurface(), { button: 0, clientX, clientY });

// jsdom does not set `buttons` on synthetic mouse moves, and the gesture
// finishes when the primary button is no longer held — so every continuation
// move has to say so explicitly.
const moveTo = (clientX: number, clientY: number = PRESS_Y) =>
  fireEvent.mouseMove(window, { buttons: 1, clientX, clientY });

const releaseAt = (clientX: number, clientY: number = PRESS_Y) =>
  fireEvent.mouseUp(window, { clientX, clientY });

interface ListenerSpy {
  mock: { calls: unknown[][] };
}

const GESTURE_EVENTS = ["mousemove", "mouseup", "blur"] as const;

/**
 * Identity, not arity. Counting calls per event type would let a listener
 * removed with the wrong capture flag look balanced while staying attached to
 * the window forever, which is precisely the leak this is here to catch.
 */
const listenerBindingsFor = (spy: ListenerSpy, type: string) =>
  spy.mock.calls
    .filter((call) => call[0] === type)
    .map((call) => ({ capture: call[2] ?? false, handler: call[1] }));

const listenerCountFor = (spy: ListenerSpy, type: string) =>
  listenerBindingsFor(spy, type).length;

const gestureListenerCount = (spy: ListenerSpy) =>
  GESTURE_EVENTS.reduce(
    (total, type) => total + listenerCountFor(spy, type),
    0,
  );

afterEach(cleanup);
afterEach(() => {
  draftActions.discard();
});

describe("useAllDayDraftCreation", () => {
  it("creates a one-day all-day draft and stops the opening press", async () => {
    const { onCreateGridDraft, onParentMouseDown } = renderHarness();

    const wasNotCancelled = fireEvent.mouseDown(
      screen.getByRole("button", { name: "Empty all-day space" }),
      { button: 0 },
    );

    expect(wasNotCancelled).toBe(false);
    expect(onParentMouseDown).not.toHaveBeenCalled();
    await waitFor(() => expect(onCreateGridDraft).toHaveBeenCalledTimes(1));
    expect(onCreateGridDraft).toHaveBeenCalledWith(
      expect.objectContaining({
        values: expect.objectContaining({
          schedule: {
            end: new Date("2026-05-21"),
            kind: "allDay",
            start: new Date("2026-05-20"),
          },
        }),
      }),
    );
  });

  it("ignores right-click presses", () => {
    const { onCreateGridDraft, onParentMouseDown } = renderHarness();

    fireEvent.mouseDown(
      screen.getByRole("button", { name: "Empty all-day space" }),
      { button: 2 },
    );

    expect(onCreateGridDraft).not.toHaveBeenCalled();
    expect(onParentMouseDown).toHaveBeenCalledTimes(1);
  });

  it("dismisses an existing draft without creating a replacement", async () => {
    const { onCreateGridDraft, onParentMouseDown } = renderHarness({
      draft: existingDraft,
    });

    fireEvent.mouseDown(
      screen.getByRole("button", { name: "Empty all-day space" }),
      { button: 0 },
    );

    await waitFor(() => expect(useDraftStore.getState().gridDraft).toBeNull());
    expect(onCreateGridDraft).not.toHaveBeenCalled();
    expect(onParentMouseDown).not.toHaveBeenCalled();
  });
});

describe("useAllDayDraftCreation — multi-day drag", () => {
  const renderDragHarness = (
    overrides: Parameters<typeof renderHarness>[0] = {},
  ) => {
    const { drafts, onCreateGridDraft } = collectDrafts();
    const harness = renderHarness({
      getStartDate: getColumnDate,
      isMultiDayDragEnabled: true,
      onCreateGridDraft,
      ...overrides,
    });

    return { ...harness, drafts };
  };

  it("spans every column the pointer crossed", () => {
    const { drafts } = renderDragHarness();

    pressAt(50);
    moveTo(350);
    releaseAt(350);

    expect(drafts).toHaveLength(1);
    expect(datesOf(drafts[0])).toEqual({
      start: "2026-05-18",
      end: "2026-05-22",
    });
  });

  it("normalises a right-to-left drag to the same span", () => {
    const { drafts } = renderDragHarness();

    pressAt(350);
    moveTo(50);
    releaseAt(50);

    expect(datesOf(drafts[0])).toEqual({
      start: "2026-05-18",
      end: "2026-05-22",
    });
  });

  it("keeps a drag inside one column as a one-day draft", () => {
    const { drafts } = renderDragHarness();

    pressAt(20);
    moveTo(90);
    releaseAt(90);

    expect(drafts).toHaveLength(1);
    expect(datesOf(drafts[0])).toEqual({
      start: "2026-05-18",
      end: "2026-05-19",
    });
  });

  it("still creates the one-day draft for a press and release with no move", () => {
    const { drafts } = renderDragHarness();

    pressAt(50);
    releaseAt(50);

    expect(drafts).toHaveLength(1);
    expect(datesOf(drafts[0])).toEqual({
      start: "2026-05-18",
      end: "2026-05-19",
    });
  });

  it("previews the running span in the store before the pointer is released", () => {
    const { drafts } = renderDragHarness();

    pressAt(50);
    moveTo(250);

    expect(useDraftStore.getState().status?.activity).toBe("creating");
    expect(storedDraftDates()).toEqual({
      start: "2026-05-18",
      end: "2026-05-21",
    });
    expect(drafts).toHaveLength(0);

    moveTo(350);

    expect(storedDraftDates()).toEqual({
      start: "2026-05-18",
      end: "2026-05-22",
    });
    expect(drafts).toHaveLength(0);
  });

  it("does not rewrite the store while the resolved span is unchanged", () => {
    const setGridDraft = spyOn(draftActions, "setGridDraft");

    try {
      renderDragHarness();

      pressAt(50);
      // Both land in column 2, so the span is identical and the second move
      // must not reach the store.
      moveTo(250);
      moveTo(280);

      expect(setGridDraft).not.toHaveBeenCalled();

      // A move that genuinely changes the span still writes.
      moveTo(350);

      expect(setGridDraft).toHaveBeenCalledTimes(1);
    } finally {
      setGridDraft.mockRestore();
    }
  });

  it("ignores right-click presses without registering listeners", () => {
    const addEventListener = spyOn(window, "addEventListener");

    try {
      const { drafts, onParentMouseDown } = renderDragHarness();

      fireEvent.mouseDown(allDaySurface(), { button: 2 });

      expect(drafts).toHaveLength(0);
      expect(onParentMouseDown).toHaveBeenCalledTimes(1);
      expect(gestureListenerCount(addEventListener)).toBe(0);
    } finally {
      addEventListener.mockRestore();
    }
  });

  it("dismisses an in-flight draft without starting a gesture", async () => {
    const addEventListener = spyOn(window, "addEventListener");

    try {
      const { drafts } = renderDragHarness({ draft: existingDraft });

      pressAt(50);

      await waitFor(() =>
        expect(useDraftStore.getState().gridDraft).toBeNull(),
      );
      expect(drafts).toHaveLength(0);
      expect(gestureListenerCount(addEventListener)).toBe(0);
    } finally {
      addEventListener.mockRestore();
    }
  });

  it("discards the preview and stops listening when the window blurs", () => {
    const { drafts } = renderDragHarness();

    pressAt(50);
    moveTo(350);
    expect(useDraftStore.getState().gridDraft).not.toBeNull();

    fireEvent.blur(window);

    expect(useDraftStore.getState().gridDraft).toBeNull();

    releaseAt(350);

    expect(drafts).toHaveLength(0);
  });

  it("leaves the store untouched when a blur arrives below the threshold", () => {
    const discard = spyOn(draftActions, "discard");

    try {
      const { drafts } = renderDragHarness();

      pressAt(50);
      fireEvent.blur(window);

      // Asserting gridDraft is null proves little here — it was null before
      // the blur too. The real guarantee is that cancel() skipped discard()
      // entirely because no preview had started.
      expect(discard).not.toHaveBeenCalled();
      expect(useDraftStore.getState().gridDraft).toBeNull();
      expect(useDraftStore.getState().status?.activity ?? null).toBeNull();
      expect(drafts).toHaveLength(0);
    } finally {
      discard.mockRestore();
    }
  });

  it("discards the preview when the component unmounts mid-drag", () => {
    const { drafts, unmount } = renderDragHarness();

    pressAt(50);
    moveTo(350);
    expect(useDraftStore.getState().gridDraft).not.toBeNull();

    unmount();

    expect(useDraftStore.getState().gridDraft).toBeNull();
    expect(drafts).toHaveLength(0);
  });

  it("removes every listener it added once the drag completes", () => {
    const addEventListener = spyOn(window, "addEventListener");
    const removeEventListener = spyOn(window, "removeEventListener");

    try {
      renderDragHarness();

      pressAt(50);
      moveTo(350);
      releaseAt(350);

      for (const type of GESTURE_EVENTS) {
        const added = listenerBindingsFor(addEventListener, type);
        const removed = listenerBindingsFor(removeEventListener, type);

        expect(added.length).toBeGreaterThan(0);
        expect(removed.length).toBe(added.length);

        // Every binding must be undone with the same handler AND the same
        // capture flag — a mismatched flag leaves the listener attached.
        for (const binding of added) {
          expect(
            removed.some(
              (candidate) =>
                candidate.handler === binding.handler &&
                candidate.capture === binding.capture,
            ),
          ).toBe(true);
        }
      }
    } finally {
      addEventListener.mockRestore();
      removeEventListener.mockRestore();
    }
  });

  it("keeps a purely vertical drag on the pressed column", () => {
    const { drafts } = renderDragHarness();

    // This case guards the x-only THRESHOLD (not the resolver pin): with no
    // horizontal travel the gesture must never reach `hasMoved`, so the store
    // is never written. Feeding a live y into the threshold check would let
    // 2000px of vertical travel start a preview.
    pressAt(50, PRESS_Y);
    moveTo(50, 2000);

    expect(useDraftStore.getState().gridDraft).toBeNull();
    expect(useDraftStore.getState().status?.activity ?? null).toBeNull();

    releaseAt(50, 2000);

    expect(drafts).toHaveLength(1);
    expect(datesOf(drafts[0])).toEqual({
      start: "2026-05-18",
      end: "2026-05-19",
    });
  });

  it("resolves a diagonal drag from clientX alone, ignoring the live y", () => {
    const { drafts } = renderDragHarness();

    // Horizontal travel crosses the threshold, so `hasMoved` is set and the
    // resolver IS consulted — which makes this the case that guards the pin
    // itself. The fixture folds y into the date the way getDateByXY does, so
    // a live clientY of 2000 would report 2026-05-21 for column 2 and push
    // the end out to 2026-05-22.
    pressAt(50, PRESS_Y);
    moveTo(250, 2000);
    releaseAt(250, 2000);

    expect(drafts).toHaveLength(1);
    expect(datesOf(drafts[0])).toEqual({
      start: "2026-05-18",
      end: "2026-05-21",
    });
  });

  it("hands off exactly one draft when a second press pre-empts the first", () => {
    const { drafts } = renderDragHarness();

    pressAt(50);
    pressAt(50);
    releaseAt(50);

    expect(drafts).toHaveLength(1);
  });

  it("clamps a drag past either edge to the outermost column", () => {
    const first = renderDragHarness();

    pressAt(350);
    moveTo(-500);
    releaseAt(-500);

    expect(datesOf(first.drafts[0])).toEqual({
      start: "2026-05-18",
      end: "2026-05-22",
    });

    cleanup();
    draftActions.discard();

    const second = renderDragHarness();

    pressAt(350);
    moveTo(5000);
    releaseAt(5000);

    expect(datesOf(second.drafts[0])).toEqual({
      start: "2026-05-21",
      end: "2026-05-25",
    });
  });

  it("finishes the gesture when the button is released outside the window", () => {
    const { drafts } = renderDragHarness();

    pressAt(50);
    // No `buttons`, so the primary button reads as released.
    fireEvent.mouseMove(window, { clientX: 350 });

    expect(drafts).toHaveLength(1);
    expect(datesOf(drafts[0])).toEqual({
      start: "2026-05-18",
      end: "2026-05-19",
    });

    releaseAt(350);

    expect(drafts).toHaveLength(1);
  });

  it("behaves exactly as before for a Day-shaped call with no opt-in", () => {
    const addEventListener = spyOn(window, "addEventListener");

    try {
      const { drafts, onCreateGridDraft } = collectDrafts();
      renderHarness({
        // Day passes a one-argument resolver and never opts in.
        getStartDate: (clientX: number) => getColumnDate(clientX, 0),
        onCreateGridDraft,
      });

      pressAt(50);

      expect(drafts).toHaveLength(1);
      expect(datesOf(drafts[0])).toEqual({
        start: "2026-05-18",
        end: "2026-05-19",
      });
      expect(gestureListenerCount(addEventListener)).toBe(0);

      moveTo(350);
      releaseAt(350);

      expect(drafts).toHaveLength(1);
    } finally {
      addEventListener.mockRestore();
    }
  });
});
