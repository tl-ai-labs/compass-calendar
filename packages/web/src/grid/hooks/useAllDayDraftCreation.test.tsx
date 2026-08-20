import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { useEffect } from "react";
import { type GridEventDraft } from "@web/events/event-draft.types";
import { createGridEventDraft } from "@web/events/grid-event-draft.adapter";
import { draftActions, useDraftStore } from "@web/events/stores/draft.store";
import { useAllDayDraftCreation } from "./useAllDayDraftCreation";
import { afterEach, describe, expect, it, mock } from "bun:test";

const existingDraft = createGridEventDraft({
  kind: "allDay",
  start: new Date("2026-05-20"),
  end: new Date("2026-05-21"),
});

const renderHarness = ({
  draft = null,
  onCreateGridDraft = mock(),
  onParentMouseDown = mock(),
}: {
  draft?: GridEventDraft | null;
  onCreateGridDraft?: (draft: GridEventDraft) => void;
  onParentMouseDown?: () => void;
} = {}) => {
  if (draft) {
    draftActions.startGridDraft({ activity: "gridClick", draft });
  }

  const Harness = () => {
    const onMouseDown = useAllDayDraftCreation({
      getStartDate: () => "2026-05-20",
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

  render(<Harness />);

  return { onCreateGridDraft, onParentMouseDown };
};

afterEach(cleanup);

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

const COLUMN_WIDTH_PX = 100;
const COLUMN_DATES = ["2026-05-20", "2026-05-21", "2026-05-22", "2026-05-23"];

// Stands in for getVisibleDateIndexByX: x picks a day column, clamped to the
// visible week exactly as the real resolver clamps it.
const dateAtX = (clientX: number): string => {
  const index = Math.max(
    0,
    Math.min(Math.floor(clientX / COLUMN_WIDTH_PX), COLUMN_DATES.length - 1),
  );
  const date = COLUMN_DATES[index];

  if (!date) {
    throw new Error(`No fixture column at index ${index}`);
  }

  return date;
};

// Local midnight, matching allDayGridSchedule's dayjs("YYYY-MM-DD").toDate().
// Built numerically so these expectations never depend on string-parsing rules.
const mayDay = (dayOfMonth: number) => new Date(2026, 4, dayOfMonth);

const renderDragHarness = () => {
  const commits: GridEventDraft[] = [];
  const onCreateGridDraft = mock((draft: GridEventDraft) => {
    commits.push(draft);
    draftActions.startGridDraft({ activity: "gridClick", draft });
  });

  // Stands in for useGridMouseUp, which opens the editor from a bubble-phase
  // "mouseup" on #root. Registered the same way renderHarness registers
  // onParentMouseDown.
  const onAncestorMouseUp = mock();

  const Harness = () => {
    const onMouseDown = useAllDayDraftCreation({
      getStartDate: (clientX: number) => dateAtX(clientX),
      onCreateGridDraft,
    });

    useEffect(() => {
      document.addEventListener("mouseup", onAncestorMouseUp);
      return () => document.removeEventListener("mouseup", onAncestorMouseUp);
    }, []);

    return (
      <button onMouseDown={onMouseDown} type="button">
        All-day drag surface
      </button>
    );
  };

  const { unmount } = render(<Harness />);

  return {
    commits,
    onAncestorMouseUp,
    onCreateGridDraft,
    surface: screen.getByRole("button", { name: "All-day drag surface" }),
    unmount,
  };
};

const pressAt = (surface: HTMLElement, clientX: number) =>
  fireEvent.mouseDown(surface, { button: 0, buttons: 1, clientX, clientY: 0 });

const moveTo = (clientX: number, buttons = 1) =>
  fireEvent.mouseMove(window, { buttons, clientX, clientY: 0 });

const releaseAt = (clientX: number) =>
  fireEvent.mouseUp(window, { clientX, clientY: 0 });

// Releases on the element itself so the event traverses the real propagation
// path. releaseAt targets window, where there is nothing below to propagate to,
// so it cannot observe whether the gesture swallows the event.
const releaseOnSurface = (surface: HTMLElement, clientX: number) =>
  fireEvent.mouseUp(surface, {
    bubbles: true,
    button: 0,
    clientX,
    clientY: 0,
  });

const lastSchedule = (commits: GridEventDraft[]) =>
  commits[commits.length - 1]?.values.schedule ?? null;

const storedSchedule = () =>
  useDraftStore.getState().gridDraft?.values.schedule ?? null;

const allDaySchedule = (startDay: number, endDay: number) => ({
  end: mayDay(endDay),
  kind: "allDay" as const,
  start: mayDay(startDay),
});

const GESTURE_LISTENERS = ["mousemove", "mouseup", "keydown", "blur"];

// Counts window add/removeEventListener calls, keyed by event type AND capture
// flag. Keying on the flag is the point: removeEventListener only detaches a
// listener whose capture flag matches, so a teardown that dropped the flag
// would balance to zero on type alone while the listener stayed attached
// forever. Nothing else can catch that — the gesture's terminal-state guards
// make a leaked listener behaviorally inert, so no amount of firing events
// afterwards would reveal it.
//
// Install AFTER render() so React's own listeners are never counted, and always
// restore() in a finally so a failing assertion cannot leak the wrappers into
// later tests in this file.
const trackWindowListeners = () => {
  const originalAdd = window.addEventListener;
  const originalRemove = window.removeEventListener;
  const balances = new Map<string, number>();

  const keyOf = (type: string, options: unknown) => {
    const isCapture =
      typeof options === "boolean"
        ? options
        : Boolean((options as { capture?: boolean } | null)?.capture);

    return `${type}#${isCapture ? "capture" : "bubble"}`;
  };

  const record = (key: string, delta: number) =>
    balances.set(key, (balances.get(key) ?? 0) + delta);

  window.addEventListener = ((
    type: string,
    listener: unknown,
    options?: unknown,
  ) => {
    record(keyOf(type, options), 1);
    (originalAdd as (...args: unknown[]) => void).call(
      window,
      type,
      listener,
      options,
    );
  }) as typeof window.addEventListener;

  window.removeEventListener = ((
    type: string,
    listener: unknown,
    options?: unknown,
  ) => {
    record(keyOf(type, options), -1);
    (originalRemove as (...args: unknown[]) => void).call(
      window,
      type,
      listener,
      options,
    );
  }) as typeof window.removeEventListener;

  return {
    // Reports every unbalanced gesture listener as "type#phase:balance", so a
    // failure names what leaked instead of reporting "expected 1 to be 0".
    outstanding: () =>
      [...balances.entries()]
        .filter(
          ([key, balance]) =>
            balance !== 0 &&
            GESTURE_LISTENERS.some((type) => key.startsWith(`${type}#`)),
        )
        .map(([key, balance]) => `${key}:${balance}`)
        .sort(),
    restore: () => {
      window.addEventListener = originalAdd;
      window.removeEventListener = originalRemove;
    },
  };
};

const expectNoLeakedListeners = (
  listeners: ReturnType<typeof trackWindowListeners>,
) => {
  expect(listeners.outstanding()).toEqual([]);
};

describe("useAllDayDraftCreation - drag to create", () => {
  it("commits a draft spanning the dragged day columns", () => {
    const { commits, onCreateGridDraft, surface } = renderDragHarness();

    pressAt(surface, 10);
    moveTo(150);
    moveTo(250);
    releaseAt(250);

    // Once on mousedown (today's click behavior, preserved), once on release
    // with the full span.
    expect(onCreateGridDraft).toHaveBeenCalledTimes(2);
    expect(lastSchedule(commits)).toEqual(allDaySchedule(20, 23));
  });

  it("normalizes a right-to-left drag", () => {
    const { commits, surface } = renderDragHarness();

    pressAt(surface, 250);
    moveTo(150);
    moveTo(10);
    releaseAt(10);

    expect(lastSchedule(commits)).toEqual(allDaySchedule(20, 23));
  });

  it("grows and shrinks the live preview on every qualifying move", () => {
    const { surface } = renderDragHarness();

    pressAt(surface, 10);

    moveTo(150);
    expect(useDraftStore.getState().status?.activity).toBe("creating");
    expect(storedSchedule()).toEqual(allDaySchedule(20, 22));

    moveTo(250);
    const statusAfterGrowing = useDraftStore.getState().status;
    expect(storedSchedule()).toEqual(allDaySchedule(20, 23));

    moveTo(150);
    expect(storedSchedule()).toEqual(allDaySchedule(20, 22));
    // Per-move writes must reuse the status object, or every subscriber
    // re-renders on a value that never changed.
    expect(useDraftStore.getState().status).toBe(statusAfterGrowing);
  });

  it("keeps the single-day result when the drag never leaves the anchor column", () => {
    const { commits, onCreateGridDraft, surface } = renderDragHarness();

    pressAt(surface, 10);
    moveTo(60);
    releaseAt(60);

    expect(onCreateGridDraft).toHaveBeenCalledTimes(1);
    expect(lastSchedule(commits)).toEqual(allDaySchedule(20, 21));
    expect(useDraftStore.getState().status?.activity).toBe("gridClick");
  });

  it("ignores movement below the move threshold", () => {
    const { commits, onCreateGridDraft, surface } = renderDragHarness();

    pressAt(surface, 10);
    moveTo(13);
    releaseAt(13);

    expect(onCreateGridDraft).toHaveBeenCalledTimes(1);
    expect(lastSchedule(commits)).toEqual(allDaySchedule(20, 21));
    expect(useDraftStore.getState().status?.activity).toBe("gridClick");
  });

  it("finishes the gesture when the primary button is released outside the window", () => {
    const { commits, onCreateGridDraft, surface } = renderDragHarness();

    pressAt(surface, 10);
    moveTo(250);
    moveTo(250, 0);

    expect(onCreateGridDraft).toHaveBeenCalledTimes(2);
    expect(lastSchedule(commits)).toEqual(allDaySchedule(20, 23));

    // The gesture is over; further motion must not resurrect it.
    moveTo(10);
    expect(onCreateGridDraft).toHaveBeenCalledTimes(2);
  });

  it("cancels on Escape mid-drag and leaves no draft in the store", () => {
    const { onCreateGridDraft, surface } = renderDragHarness();

    pressAt(surface, 10);
    moveTo(250);
    fireEvent.keyDown(window, { key: "Escape" });

    expect(useDraftStore.getState().gridDraft).toBeNull();

    releaseAt(250);
    expect(onCreateGridDraft).toHaveBeenCalledTimes(1);
  });

  it("cancels on window blur mid-drag and leaves no draft in the store", () => {
    const { onCreateGridDraft, surface } = renderDragHarness();

    pressAt(surface, 10);
    moveTo(250);
    fireEvent.blur(window);

    expect(useDraftStore.getState().gridDraft).toBeNull();

    releaseAt(250);
    expect(onCreateGridDraft).toHaveBeenCalledTimes(1);
  });

  it("leaves the click draft alone when Escape is pressed before the threshold", () => {
    const { surface } = renderDragHarness();

    pressAt(surface, 10);
    fireEvent.keyDown(window, { key: "Escape" });

    // The mousedown's draft is not this gesture's preview to discard.
    expect(storedSchedule()).toEqual(allDaySchedule(20, 21));
  });

  it("removes every window listener after a completed gesture", () => {
    const { surface } = renderDragHarness();
    const listeners = trackWindowListeners();

    try {
      pressAt(surface, 10);
      moveTo(150);
      moveTo(250);
      releaseAt(250);
    } finally {
      listeners.restore();
    }

    expectNoLeakedListeners(listeners);

    // A finished gesture must also be inert: even if a listener did survive,
    // neither Escape nor blur may take back the committed draft.
    fireEvent.keyDown(window, { key: "Escape" });
    fireEvent.blur(window);
    expect(storedSchedule()).toEqual(allDaySchedule(20, 23));
  });

  it("removes every window listener after a cancelled gesture", () => {
    const { surface } = renderDragHarness();
    const listeners = trackWindowListeners();

    try {
      pressAt(surface, 10);
      moveTo(250);
      fireEvent.keyDown(window, { key: "Escape" });
    } finally {
      listeners.restore();
    }

    expectNoLeakedListeners(listeners);
  });

  it("removes every window listener when the component unmounts mid-gesture", () => {
    const { onCreateGridDraft, surface, unmount } = renderDragHarness();
    const listeners = trackWindowListeners();

    try {
      pressAt(surface, 10);
      moveTo(150);
      moveTo(250);
      unmount();
    } finally {
      listeners.restore();
    }

    expectNoLeakedListeners(listeners);
    expect(useDraftStore.getState().gridDraft).toBeNull();

    // Behavioral proof that the mouse listeners are gone: an unmounted gesture
    // must not be able to commit.
    moveTo(150);
    releaseAt(150);
    expect(onCreateGridDraft).toHaveBeenCalledTimes(1);
  });

  // Guards the one decision in this hook that no other test can see. Week's
  // editor opens from useGridMouseUp, a bubble-phase "mouseup" listener on
  // #root (views/Week/components/Draft/grid/hooks/useGridMouseUp.ts). finish()
  // therefore calls preventDefault() but deliberately NOT stopPropagation(),
  // diverging from useTimedDraftCreation. Adding stopPropagation() here "for
  // symmetry" would stop the editor opening after every drag-create, and every
  // other test in this file releases on window — where there is nothing below
  // to propagate to — so only this one would notice.
  it("lets the finishing mouseup keep bubbling so useGridMouseUp can open the form", () => {
    const { commits, onAncestorMouseUp, onCreateGridDraft, surface } =
      renderDragHarness();

    pressAt(surface, 10);
    moveTo(150);
    moveTo(250);
    releaseOnSurface(surface, 250);

    expect(onCreateGridDraft).toHaveBeenCalledTimes(2);
    expect(lastSchedule(commits)).toEqual(allDaySchedule(20, 23));
    expect(onAncestorMouseUp).toHaveBeenCalledTimes(1);
  });
});
