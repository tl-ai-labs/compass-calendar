import { afterEach, describe, expect, it, mock, spyOn } from "bun:test";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { useEffect } from "react";
import { type CompassEvent } from "@core/types/compass-event.contracts";
import { type GridEventDraft } from "@web/events/event-draft.types";
import { createGridEventDraft } from "@web/events/grid-event-draft.adapter";
import {
  draftActions,
  selectDraftActivity,
  selectGridDraft,
  useDraftStore,
} from "@web/events/stores/draft.store";
import {
  type AllDayVisibleBounds,
  useAllDayDraftCreation,
} from "./useAllDayDraftCreation";

const existingDraft = createGridEventDraft({
  kind: "allDay",
  start: new Date("2026-05-20"),
  end: new Date("2026-05-21"),
});

const defaultVisibleBounds: AllDayVisibleBounds = {
  minDate: "2026-05-18",
  maxDate: "2026-05-24",
};

const getDateByX = (clientX: number) => {
  if (clientX <= 100) return "2026-05-18";
  if (clientX <= 200) return "2026-05-19";
  if (clientX <= 300) return "2026-05-20";
  if (clientX <= 400) return "2026-05-21";
  if (clientX <= 500) return "2026-05-22";
  if (clientX <= 600) return "2026-05-23";
  return "2026-05-24";
};

const renderHarness = ({
  draft = null,
  getStartDate = () => "2026-05-20",
  onCreateDraft,
  onCreateGridDraft = mock(),
  onParentMouseDown = mock(),
  visibleBounds,
}: {
  draft?: GridEventDraft | null;
  getStartDate?: (clientX: number, clientY: number) => string;
  onCreateDraft?: (event: CompassEvent) => void;
  onCreateGridDraft?: (draft: GridEventDraft) => void;
  onParentMouseDown?: () => void;
  visibleBounds?: AllDayVisibleBounds;
} = {}) => {
  if (draft) {
    draftActions.startGridDraft({ activity: "gridClick", draft });
  }

  const Harness = () => {
    const onMouseDown = useAllDayDraftCreation({
      getStartDate,
      onCreateDraft,
      onCreateGridDraft,
      visibleBounds,
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

  const utils = render(<Harness />);

  return { ...utils, onCreateDraft, onCreateGridDraft, onParentMouseDown };
};

afterEach(() => {
  cleanup();
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

  it("yields the single-day draft on sub-threshold click (opt-in)", async () => {
    const { onCreateGridDraft } = renderHarness({
      getStartDate: getDateByX,
      visibleBounds: defaultVisibleBounds,
    });

    const button = screen.getByRole("button", { name: "Empty all-day space" });
    fireEvent.mouseDown(button, { button: 0, clientX: 300, clientY: 100 });
    fireEvent.mouseMove(window, { buttons: 1, clientX: 302, clientY: 100 });
    fireEvent.mouseUp(window, { button: 0, clientX: 302, clientY: 100 });

    expect(onCreateGridDraft).toHaveBeenCalledTimes(1);
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

  it("commits the spanning range on left-to-right drag across days", () => {
    const { onCreateGridDraft } = renderHarness({
      getStartDate: getDateByX,
      visibleBounds: defaultVisibleBounds,
    });

    const button = screen.getByRole("button", { name: "Empty all-day space" });
    fireEvent.mouseDown(button, { button: 0, clientX: 100, clientY: 100 });
    fireEvent.mouseMove(window, { buttons: 1, clientX: 300, clientY: 100 });

    expect(selectGridDraft(useDraftStore.getState())?.values.schedule).toEqual({
      end: new Date("2026-05-21"),
      kind: "allDay",
      start: new Date("2026-05-18"),
    });

    fireEvent.mouseUp(window, { button: 0, clientX: 300, clientY: 100 });

    expect(onCreateGridDraft).toHaveBeenCalledTimes(1);
    expect(onCreateGridDraft).toHaveBeenCalledWith(
      expect.objectContaining({
        values: expect.objectContaining({
          schedule: {
            end: new Date("2026-05-21"),
            kind: "allDay",
            start: new Date("2026-05-18"),
          },
        }),
      }),
    );
  });

  it("normalizes a right-to-left drag to the same span as the equivalent left-to-right drag", () => {
    const { onCreateGridDraft } = renderHarness({
      getStartDate: getDateByX,
      visibleBounds: defaultVisibleBounds,
    });

    const button = screen.getByRole("button", { name: "Empty all-day space" });
    fireEvent.mouseDown(button, { button: 0, clientX: 300, clientY: 100 });
    fireEvent.mouseMove(window, { buttons: 1, clientX: 100, clientY: 100 });

    expect(selectGridDraft(useDraftStore.getState())?.values.schedule).toEqual({
      end: new Date("2026-05-21"),
      kind: "allDay",
      start: new Date("2026-05-18"),
    });

    fireEvent.mouseUp(window, { button: 0, clientX: 100, clientY: 100 });

    expect(onCreateGridDraft).toHaveBeenCalledTimes(1);
    expect(onCreateGridDraft).toHaveBeenCalledWith(
      expect.objectContaining({
        values: expect.objectContaining({
          schedule: {
            end: new Date("2026-05-21"),
            kind: "allDay",
            start: new Date("2026-05-18"),
          },
        }),
      }),
    );
  });

  it("discards draft on Escape mid-drag and never calls onCreateGridDraft", () => {
    const { onCreateGridDraft } = renderHarness({
      getStartDate: getDateByX,
      visibleBounds: defaultVisibleBounds,
    });

    const button = screen.getByRole("button", { name: "Empty all-day space" });
    fireEvent.mouseDown(button, { button: 0, clientX: 100, clientY: 100 });
    fireEvent.mouseMove(window, { buttons: 1, clientX: 300, clientY: 100 });

    expect(selectGridDraft(useDraftStore.getState())).not.toBeNull();

    fireEvent.keyDown(window, { key: "Escape" });

    expect(selectGridDraft(useDraftStore.getState())).toBeNull();
    expect(onCreateGridDraft).not.toHaveBeenCalled();

    fireEvent.mouseUp(window, { button: 0, clientX: 300, clientY: 100 });

    expect(onCreateGridDraft).not.toHaveBeenCalled();
  });

  it("discards draft on window blur mid-drag and never calls onCreateGridDraft", () => {
    const { onCreateGridDraft } = renderHarness({
      getStartDate: getDateByX,
      visibleBounds: defaultVisibleBounds,
    });

    const button = screen.getByRole("button", { name: "Empty all-day space" });
    fireEvent.mouseDown(button, { button: 0, clientX: 100, clientY: 100 });
    fireEvent.mouseMove(window, { buttons: 1, clientX: 300, clientY: 100 });

    expect(selectGridDraft(useDraftStore.getState())).not.toBeNull();

    fireEvent.blur(window);

    expect(selectGridDraft(useDraftStore.getState())).toBeNull();
    expect(onCreateGridDraft).not.toHaveBeenCalled();

    fireEvent.mouseUp(window, { button: 0, clientX: 300, clientY: 100 });

    expect(onCreateGridDraft).not.toHaveBeenCalled();
  });

  it("clamps to minDate/maxDate when dragging past the visible bounds", () => {
    const getOutOfBoundsDateByX = (clientX: number) => {
      if (clientX < 100) return "2026-05-10";
      if (clientX > 700) return "2026-05-30";
      return "2026-05-20";
    };

    const { onCreateGridDraft } = renderHarness({
      getStartDate: getOutOfBoundsDateByX,
      visibleBounds: defaultVisibleBounds,
    });

    const button = screen.getByRole("button", { name: "Empty all-day space" });
    fireEvent.mouseDown(button, { button: 0, clientX: 50, clientY: 100 });
    fireEvent.mouseMove(window, { buttons: 1, clientX: 800, clientY: 100 });
    fireEvent.mouseUp(window, { button: 0, clientX: 800, clientY: 100 });

    expect(onCreateGridDraft).toHaveBeenCalledTimes(1);
    expect(onCreateGridDraft).toHaveBeenCalledWith(
      expect.objectContaining({
        values: expect.objectContaining({
          schedule: {
            end: new Date("2026-05-25"),
            kind: "allDay",
            start: new Date("2026-05-18"),
          },
        }),
      }),
    );
  });

  it("commits on mousedown and attaches no window listeners in opt-out path (no visibleBounds)", () => {
    const addEventListenerSpy = spyOn(window, "addEventListener");

    const { onCreateGridDraft } = renderHarness({
      getStartDate: () => "2026-05-20",
      visibleBounds: undefined,
    });

    const button = screen.getByRole("button", { name: "Empty all-day space" });
    fireEvent.mouseDown(button, { button: 0, clientX: 300, clientY: 100 });

    expect(onCreateGridDraft).toHaveBeenCalledTimes(1);

    const windowListenersAdded = addEventListenerSpy.mock.calls.map(
      (call) => call[0],
    );
    expect(windowListenersAdded).not.toContain("mousemove");
    expect(windowListenersAdded).not.toContain("mouseup");
    expect(windowListenersAdded).not.toContain("blur");
    expect(windowListenersAdded).not.toContain("keydown");

    addEventListenerSpy.mockRestore();
  });

  it("leaves store draft at activity 'creating' on opted-in mousedown with NO mouseup, then fires onCreateGridDraft exactly once on mouseup", () => {
    const { onCreateGridDraft } = renderHarness({
      getStartDate: getDateByX,
      visibleBounds: defaultVisibleBounds,
    });

    const button = screen.getByRole("button", { name: "Empty all-day space" });
    fireEvent.mouseDown(button, { button: 0, clientX: 300, clientY: 100 });

    expect(selectDraftActivity(useDraftStore.getState())).toBe("creating");
    expect(selectGridDraft(useDraftStore.getState())?.values.schedule).toEqual({
      end: new Date("2026-05-21"),
      kind: "allDay",
      start: new Date("2026-05-20"),
    });
    expect(onCreateGridDraft).not.toHaveBeenCalled();

    fireEvent.mouseUp(window, { button: 0, clientX: 300, clientY: 100 });

    expect(onCreateGridDraft).toHaveBeenCalledTimes(1);
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
});
