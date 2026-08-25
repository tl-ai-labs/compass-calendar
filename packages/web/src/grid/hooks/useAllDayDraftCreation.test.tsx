import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { useEffect } from "react";
import {
  type GridEventDraft,
  type GridScheduleDraft,
} from "@web/events/event-draft.types";
import { createGridEventDraft } from "@web/events/grid-event-draft.adapter";
import {
  draftActions,
  initialDraftState,
  useDraftStore,
} from "@web/events/stores/draft.store";
import { useAllDayDraftCreation } from "./useAllDayDraftCreation";
import { afterEach, describe, expect, it, mock, spyOn } from "bun:test";

const existingDraft = createGridEventDraft({
  kind: "allDay",
  start: new Date("2026-05-20"),
  end: new Date("2026-05-21"),
});

// x<100 -> 2026-05-20, <200 -> 05-21, <300 -> 05-22, else 05-23
const xToDate = (clientX: number) => {
  if (clientX < 100) return "2026-05-20";
  if (clientX < 200) return "2026-05-21";
  if (clientX < 300) return "2026-05-22";
  return "2026-05-23";
};

const GESTURE_LISTENERS = ["mousemove", "mouseup", "blur", "keydown"];

const armedGestureListeners = (
  spy: ReturnType<typeof spyOn<typeof window, "addEventListener">>,
) =>
  spy.mock.calls
    .map(([type]) => type)
    .filter((type) => GESTURE_LISTENERS.includes(type as string));

const removedGestureListeners = (
  spy: ReturnType<typeof spyOn<typeof window, "removeEventListener">>,
) =>
  spy.mock.calls
    .filter(([type]) => GESTURE_LISTENERS.includes(type as string))
    .map(([type, , capture]) => [type, capture] as const);

// Asserts the exact set of listeners cleanup() removes, capture flag
// included: a flipped or dropped capture flag leaves a leaked listener that
// isCancelled/isFinished renders inert, so the existing W7/W8/W9 assertions
// cannot see it — only checking the removeEventListener call args can.
const expectGestureTeardown = (
  removeEventListenerSpy: ReturnType<
    typeof spyOn<typeof window, "removeEventListener">
  >,
) => {
  const removed = removedGestureListeners(removeEventListenerSpy);
  const byType = new Map(removed);

  expect(removed).toHaveLength(4);
  expect(byType.get("mousemove")).toBe(true);
  expect(byType.get("mouseup")).toBe(true);
  expect(byType.get("keydown")).toBe(true);
  const blurCapture = byType.get("blur");
  expect(blurCapture === undefined || blurCapture === false).toBe(true);
};

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

const pressAllDay = (init: Record<string, unknown>) =>
  fireEvent.mouseDown(
    screen.getByRole("button", { name: "Empty all-day space" }),
    init,
  );

const oneDaySchedule: GridScheduleDraft = {
  end: new Date("2026-05-21"),
  kind: "allDay",
  start: new Date("2026-05-20"),
};

const fourDaySchedule: GridScheduleDraft = {
  end: new Date("2026-05-24"),
  kind: "allDay",
  start: new Date("2026-05-20"),
};

const expectCommitted = (
  onCreateGridDraft: (draft: GridEventDraft) => void,
  schedule: GridScheduleDraft,
) =>
  expect(onCreateGridDraft).toHaveBeenCalledWith(
    expect.objectContaining({
      values: expect.objectContaining({ schedule }),
    }),
  );

afterEach(cleanup);
afterEach(() => {
  useDraftStore.setState(initialDraftState, true);
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

describe("useAllDayDraftCreation — default path (drag disabled)", () => {
  it("D1: commits during the mousedown, and a later drag adds nothing", async () => {
    const { onCreateGridDraft } = renderHarness();

    pressAllDay({ button: 0, buttons: 1, clientX: 50 });

    // Committed synchronously on press — this is the behaviour the Day view
    // depends on and the reason the drag is opt-in rather than universal.
    expect(onCreateGridDraft).toHaveBeenCalledTimes(1);
    expectCommitted(onCreateGridDraft, oneDaySchedule);

    fireEvent.mouseMove(window, { buttons: 1, clientX: 350 });
    fireEvent.mouseUp(window, { clientX: 350 });

    expect(onCreateGridDraft).toHaveBeenCalledTimes(1);
  });

  it("D2: arms no gesture listeners on mousedown", () => {
    const addEventListenerSpy = spyOn(window, "addEventListener");

    try {
      renderHarness();
      pressAllDay({ button: 0, buttons: 1, clientX: 50 });

      expect(armedGestureListeners(addEventListenerSpy)).toEqual([]);
    } finally {
      addEventListenerSpy.mockRestore();
    }
  });
});

describe("useAllDayDraftCreation — multi-day drag (opt-in)", () => {
  const renderDraggable = (
    overrides: Parameters<typeof renderHarness>[0] = {},
  ) =>
    renderHarness({
      getStartDate: xToDate,
      isMultiDayDragEnabled: true,
      ...overrides,
    });

  it("W1: mousedown alone commits nothing and writes no draft", () => {
    const { onCreateGridDraft } = renderDraggable();

    pressAllDay({ button: 0, buttons: 1, clientX: 50 });

    expect(onCreateGridDraft).not.toHaveBeenCalled();
    expect(useDraftStore.getState().gridDraft).toBeNull();
  });

  it("W2: crossing columns previews a spanning draft under the creating activity", () => {
    renderDraggable();

    pressAllDay({ button: 0, buttons: 1, clientX: 50 });
    fireEvent.mouseMove(window, { buttons: 1, clientX: 350 });

    const { gridDraft, status } = useDraftStore.getState();

    expect(gridDraft?.values.schedule).toEqual(fourDaySchedule);
    expect(status?.activity).toBe("creating");
    expect(status?.isFormOpen).toBe(false);
  });

  it("W3: releasing commits the previewed range exactly once", async () => {
    const { onCreateGridDraft } = renderDraggable();

    pressAllDay({ button: 0, buttons: 1, clientX: 50 });
    fireEvent.mouseMove(window, { buttons: 1, clientX: 350 });
    fireEvent.mouseUp(window, { clientX: 350 });

    await waitFor(() => expect(onCreateGridDraft).toHaveBeenCalledTimes(1));
    expectCommitted(onCreateGridDraft, fourDaySchedule);
  });

  it("W4: a reverse drag normalizes to the same range as the forward drag", async () => {
    const { onCreateGridDraft } = renderDraggable();

    pressAllDay({ button: 0, buttons: 1, clientX: 350 });
    fireEvent.mouseMove(window, { buttons: 1, clientX: 50 });
    fireEvent.mouseUp(window, { clientX: 50 });

    await waitFor(() => expect(onCreateGridDraft).toHaveBeenCalledTimes(1));
    expectCommitted(onCreateGridDraft, fourDaySchedule);
  });

  it("W5: a sub-threshold drag never previews and commits the one-day draft", async () => {
    const startGridDraftSpy = spyOn(draftActions, "startGridDraft");

    try {
      const { onCreateGridDraft } = renderDraggable();

      pressAllDay({ button: 0, buttons: 1, clientX: 50 });
      fireEvent.mouseMove(window, { buttons: 1, clientX: 52 });
      fireEvent.mouseUp(window, { clientX: 52 });

      await waitFor(() => expect(onCreateGridDraft).toHaveBeenCalledTimes(1));
      expectCommitted(onCreateGridDraft, oneDaySchedule);
      expect(startGridDraftSpy).not.toHaveBeenCalledWith(
        expect.objectContaining({ activity: "creating" }),
      );
    } finally {
      startGridDraftSpy.mockRestore();
    }
  });

  it("W6: press and release with no movement commits the one-day draft", async () => {
    const { onCreateGridDraft } = renderDraggable();

    pressAllDay({ button: 0, buttons: 1, clientX: 50 });
    fireEvent.mouseUp(window, { clientX: 50 });

    await waitFor(() => expect(onCreateGridDraft).toHaveBeenCalledTimes(1));
    expectCommitted(onCreateGridDraft, oneDaySchedule);
  });

  it("W7: Escape mid-drag discards the preview and blocks the pending commit", () => {
    const { onCreateGridDraft } = renderDraggable();

    pressAllDay({ button: 0, buttons: 1, clientX: 50 });
    fireEvent.mouseMove(window, { buttons: 1, clientX: 350 });
    expect(useDraftStore.getState().gridDraft).not.toBeNull();

    fireEvent.keyDown(window, { key: "Escape" });

    expect(useDraftStore.getState().gridDraft).toBeNull();

    fireEvent.mouseUp(window, { clientX: 350 });

    expect(onCreateGridDraft).not.toHaveBeenCalled();
    expect(useDraftStore.getState().gridDraft).toBeNull();
  });

  it("W8: window blur mid-drag discards the preview and blocks the commit", () => {
    const { onCreateGridDraft } = renderDraggable();

    pressAllDay({ button: 0, buttons: 1, clientX: 50 });
    fireEvent.mouseMove(window, { buttons: 1, clientX: 350 });
    fireEvent.blur(window);

    expect(useDraftStore.getState().gridDraft).toBeNull();

    fireEvent.mouseUp(window, { clientX: 350 });

    expect(onCreateGridDraft).not.toHaveBeenCalled();
  });

  it("W9: unmounting mid-drag cancels it and leaves the window inert", () => {
    const { onCreateGridDraft, unmount } = renderDraggable();

    pressAllDay({ button: 0, buttons: 1, clientX: 50 });
    fireEvent.mouseMove(window, { buttons: 1, clientX: 350 });

    unmount();

    expect(useDraftStore.getState().gridDraft).toBeNull();

    fireEvent.mouseMove(window, { buttons: 1, clientX: 50 });
    fireEvent.mouseUp(window, { clientX: 50 });

    expect(onCreateGridDraft).not.toHaveBeenCalled();
    expect(useDraftStore.getState().gridDraft).toBeNull();
  });

  it("W10: a move reporting no held button commits, covering release outside the window", async () => {
    const { onCreateGridDraft } = renderDraggable();

    pressAllDay({ button: 0, buttons: 1, clientX: 50 });
    fireEvent.mouseMove(window, { buttons: 0, clientX: 350 });

    await waitFor(() => expect(onCreateGridDraft).toHaveBeenCalledTimes(1));
  });

  it("W11: moving within one column does not rewrite the store", () => {
    const setGridDraftSpy = spyOn(draftActions, "setGridDraft");

    try {
      renderDraggable();

      pressAllDay({ button: 0, buttons: 1, clientX: 50 });
      fireEvent.mouseMove(window, { buttons: 1, clientX: 350 });
      fireEvent.mouseMove(window, { buttons: 1, clientX: 360 });

      expect(setGridDraftSpy).not.toHaveBeenCalled();
      expect(useDraftStore.getState().gridDraft?.values.schedule).toEqual(
        fourDaySchedule,
      );
    } finally {
      setGridDraftSpy.mockRestore();
    }
  });

  it("W12: shift+primary still commits on mousedown and arms no gesture", async () => {
    const addEventListenerSpy = spyOn(window, "addEventListener");

    try {
      const { onCreateGridDraft } = renderDraggable();

      pressAllDay({ button: 0, buttons: 1, clientX: 50, shiftKey: true });

      expect(onCreateGridDraft).toHaveBeenCalledTimes(1);
      expectCommitted(onCreateGridDraft, oneDaySchedule);
      expect(armedGestureListeners(addEventListenerSpy)).toEqual([]);
    } finally {
      addEventListenerSpy.mockRestore();
    }
  });

  it("W13: right-click is still ignored with the drag enabled", () => {
    const { onCreateGridDraft, onParentMouseDown } = renderDraggable();

    pressAllDay({ button: 2, clientX: 50 });

    expect(onCreateGridDraft).not.toHaveBeenCalled();
    expect(onParentMouseDown).toHaveBeenCalledTimes(1);
  });

  it("W14: re-pressing over an open draft dismisses it without a replacement", async () => {
    const { onCreateGridDraft, onParentMouseDown } = renderDraggable({
      draft: existingDraft,
    });

    pressAllDay({ button: 0, buttons: 1, clientX: 50 });

    await waitFor(() => expect(useDraftStore.getState().gridDraft).toBeNull());
    expect(onCreateGridDraft).not.toHaveBeenCalled();
    expect(onParentMouseDown).not.toHaveBeenCalled();
  });

  describe("useAllDayDraftCreation — gesture teardown listeners", () => {
    it("R1: releasing with mouseup removes all four gesture listeners with the correct capture flags", () => {
      const removeEventListenerSpy = spyOn(window, "removeEventListener");

      try {
        renderDraggable();

        pressAllDay({ button: 0, buttons: 1, clientX: 50 });
        fireEvent.mouseUp(window, { clientX: 50 });

        expectGestureTeardown(removeEventListenerSpy);
      } finally {
        removeEventListenerSpy.mockRestore();
      }
    });

    it("R2: a mousemove reporting no held button removes all four gesture listeners with the correct capture flags", () => {
      const removeEventListenerSpy = spyOn(window, "removeEventListener");

      try {
        renderDraggable();

        pressAllDay({ button: 0, buttons: 1, clientX: 50 });
        fireEvent.mouseMove(window, { buttons: 0, clientX: 350 });

        expectGestureTeardown(removeEventListenerSpy);
      } finally {
        removeEventListenerSpy.mockRestore();
      }
    });

    it("R3: Escape removes all four gesture listeners with the correct capture flags", () => {
      const removeEventListenerSpy = spyOn(window, "removeEventListener");

      try {
        renderDraggable();

        pressAllDay({ button: 0, buttons: 1, clientX: 50 });
        fireEvent.mouseMove(window, { buttons: 1, clientX: 350 });
        fireEvent.keyDown(window, { key: "Escape" });

        expectGestureTeardown(removeEventListenerSpy);
      } finally {
        removeEventListenerSpy.mockRestore();
      }
    });

    it("R4: window blur removes all four gesture listeners with the correct capture flags", () => {
      const removeEventListenerSpy = spyOn(window, "removeEventListener");

      try {
        renderDraggable();

        pressAllDay({ button: 0, buttons: 1, clientX: 50 });
        fireEvent.mouseMove(window, { buttons: 1, clientX: 350 });
        fireEvent.blur(window);

        expectGestureTeardown(removeEventListenerSpy);
      } finally {
        removeEventListenerSpy.mockRestore();
      }
    });

    it("R5: unmounting removes all four gesture listeners with the correct capture flags", () => {
      const removeEventListenerSpy = spyOn(window, "removeEventListener");

      try {
        const { unmount } = renderDraggable();

        pressAllDay({ button: 0, buttons: 1, clientX: 50 });
        fireEvent.mouseMove(window, { buttons: 1, clientX: 350 });
        unmount();

        expectGestureTeardown(removeEventListenerSpy);
      } finally {
        removeEventListenerSpy.mockRestore();
      }
    });

    it("R6: re-pressing over a live preview removes all four gesture listeners with the correct capture flags", () => {
      const removeEventListenerSpy = spyOn(window, "removeEventListener");

      try {
        renderDraggable();

        pressAllDay({ button: 0, buttons: 1, clientX: 50 });
        fireEvent.mouseMove(window, { buttons: 1, clientX: 350 });
        expect(useDraftStore.getState().gridDraft).not.toBeNull();

        pressAllDay({ button: 0, buttons: 1, clientX: 150 });

        expectGestureTeardown(removeEventListenerSpy);
      } finally {
        removeEventListenerSpy.mockRestore();
      }
    });

    it("R7: a second mousedown before any move cancels the first gesture, and the eventual mouseup commits exactly once", async () => {
      const { onCreateGridDraft } = renderDraggable();

      pressAllDay({ button: 0, buttons: 1, clientX: 50 });
      pressAllDay({ button: 0, buttons: 1, clientX: 150 });
      fireEvent.mouseUp(window, { clientX: 150 });

      await waitFor(() => expect(onCreateGridDraft).toHaveBeenCalledTimes(1));
      expect(onCreateGridDraft).toHaveBeenCalledTimes(1);
    });
  });
});
