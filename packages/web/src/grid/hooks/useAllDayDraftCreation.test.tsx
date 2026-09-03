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

const defaultXToDate = (clientX: number) => {
  if (clientX < 100) return "2026-05-20";
  if (clientX < 200) return "2026-05-21";
  if (clientX < 300) return "2026-05-22";
  return "2026-05-23";
};

const defaultVisibleDates = [
  "2026-05-20",
  "2026-05-21",
  "2026-05-22",
  "2026-05-23",
];

const renderDragHarness = (
  options: {
    getStartDate?: (clientX: number, clientY: number) => string;
    multiDayDrag?: { getVisibleDates: () => readonly string[] } | undefined;
    onCreateGridDraft?: ReturnType<
      typeof mock<(draft: GridEventDraft) => void>
    >;
  } = {},
) => {
  draftActions.discard();

  const getStartDate = options.getStartDate ?? defaultXToDate;
  const multiDayDrag =
    "multiDayDrag" in options
      ? options.multiDayDrag
      : { getVisibleDates: () => defaultVisibleDates };
  const onCreateGridDraft =
    options.onCreateGridDraft ??
    mock((draft: GridEventDraft) => {
      draftActions.startGridDraft({ activity: "gridClick", draft });
    });

  const Harness = () => {
    const onMouseDown = useAllDayDraftCreation({
      getStartDate,
      multiDayDrag,
      onCreateGridDraft,
    });

    return (
      <button onMouseDown={onMouseDown} type="button">
        Empty all-day space
      </button>
    );
  };

  render(<Harness />);

  return { onCreateGridDraft };
};

describe("useAllDayDraftCreation multi-day drag", () => {
  it("provides live multi-day preview during drag without re-committing", () => {
    const { onCreateGridDraft } = renderDragHarness();
    const button = screen.getByRole("button", { name: "Empty all-day space" });

    fireEvent.mouseDown(button, { button: 0, clientX: 50, clientY: 0 });
    fireEvent.mouseMove(window, { clientX: 250, buttons: 1 });

    expect(useDraftStore.getState().gridDraft?.values.schedule).toEqual({
      end: new Date("2026-05-23"),
      kind: "allDay",
      start: new Date("2026-05-20"),
    });
    expect(onCreateGridDraft).toHaveBeenCalledTimes(1);
  });

  it("commits the span on release with replaced schedule", () => {
    const { onCreateGridDraft } = renderDragHarness();
    const button = screen.getByRole("button", { name: "Empty all-day space" });

    fireEvent.mouseDown(button, { button: 0, clientX: 50, clientY: 0 });
    fireEvent.mouseMove(window, { clientX: 250, buttons: 1 });
    fireEvent.mouseUp(window, { clientX: 250 });

    expect(onCreateGridDraft).toHaveBeenCalledTimes(2);
    const firstDraft = onCreateGridDraft.mock.calls[0][0];
    const secondDraft = onCreateGridDraft.mock.calls[1][0];
    expect(secondDraft).toEqual({
      ...firstDraft,
      values: {
        ...firstDraft.values,
        schedule: {
          end: new Date("2026-05-23"),
          kind: "allDay",
          start: new Date("2026-05-20"),
        },
      },
    });
  });

  it("is direction-agnostic at hook level", () => {
    const { onCreateGridDraft } = renderDragHarness();
    const button = screen.getByRole("button", { name: "Empty all-day space" });

    fireEvent.mouseDown(button, { button: 0, clientX: 250, clientY: 0 });
    fireEvent.mouseMove(window, { clientX: 50, buttons: 1 });
    fireEvent.mouseUp(window, { clientX: 50 });

    expect(onCreateGridDraft).toHaveBeenCalledTimes(2);
    const secondDraft = onCreateGridDraft.mock.calls[1][0];
    expect(secondDraft.values.schedule).toEqual({
      end: new Date("2026-05-23"),
      kind: "allDay",
      start: new Date("2026-05-20"),
    });
  });

  it("pins exclusive-end arithmetic", () => {
    const { onCreateGridDraft } = renderDragHarness();
    const button = screen.getByRole("button", { name: "Empty all-day space" });

    fireEvent.mouseDown(button, { button: 0, clientX: 50, clientY: 0 });
    fireEvent.mouseMove(window, { clientX: 9999, buttons: 1 });
    fireEvent.mouseUp(window, { clientX: 9999 });

    expect(onCreateGridDraft).toHaveBeenCalledTimes(2);
    const secondDraft = onCreateGridDraft.mock.calls[1][0];
    expect(secondDraft.values.schedule).toEqual({
      end: new Date("2026-05-24"),
      kind: "allDay",
      start: new Date("2026-05-20"),
    });
  });

  it("clamps at the window edge", () => {
    const { onCreateGridDraft } = renderDragHarness({
      getStartDate: (clientX: number) =>
        clientX > 1000 ? "2026-06-15" : defaultXToDate(clientX),
    });
    const button = screen.getByRole("button", { name: "Empty all-day space" });

    fireEvent.mouseDown(button, { button: 0, clientX: 50, clientY: 0 });
    fireEvent.mouseMove(window, { clientX: 9999, buttons: 1 });
    fireEvent.mouseUp(window, { clientX: 9999 });

    expect(onCreateGridDraft).toHaveBeenCalledTimes(2);
    const secondDraft = onCreateGridDraft.mock.calls[1][0];
    expect(secondDraft.values.schedule).toEqual({
      end: new Date("2026-05-24"),
      kind: "allDay",
      start: new Date("2026-05-20"),
    });
  });

  it("emits nothing extra on click with no move", () => {
    const { onCreateGridDraft } = renderDragHarness();
    const button = screen.getByRole("button", { name: "Empty all-day space" });

    fireEvent.mouseDown(button, { button: 0, clientX: 50, clientY: 0 });
    fireEvent.mouseUp(window, { clientX: 50 });

    expect(onCreateGridDraft).toHaveBeenCalledTimes(1);
    expect(useDraftStore.getState().gridDraft?.values.schedule).toEqual({
      end: new Date("2026-05-21"),
      kind: "allDay",
      start: new Date("2026-05-20"),
    });
  });

  it("does not escalate on sub-threshold jitter", () => {
    const { onCreateGridDraft } = renderDragHarness();
    const button = screen.getByRole("button", { name: "Empty all-day space" });

    fireEvent.mouseDown(button, { button: 0, clientX: 50, clientY: 0 });
    fireEvent.mouseMove(window, { clientX: 53, buttons: 1 });
    fireEvent.mouseUp(window, { clientX: 53 });

    expect(onCreateGridDraft).toHaveBeenCalledTimes(1);
  });

  it("reverts on blur and does not discard", () => {
    const { onCreateGridDraft } = renderDragHarness();
    const button = screen.getByRole("button", { name: "Empty all-day space" });

    fireEvent.mouseDown(button, { button: 0, clientX: 50, clientY: 0 });
    fireEvent.mouseMove(window, { clientX: 250, buttons: 1 });
    fireEvent.blur(window);

    expect(useDraftStore.getState().gridDraft).not.toBeNull();
    expect(useDraftStore.getState().gridDraft?.values.schedule).toEqual({
      end: new Date("2026-05-21"),
      kind: "allDay",
      start: new Date("2026-05-20"),
    });
    expect(onCreateGridDraft).toHaveBeenCalledTimes(1);

    fireEvent.mouseUp(window, { clientX: 250 });
    expect(onCreateGridDraft).toHaveBeenCalledTimes(1);
  });

  it("unmount mid-gesture is inert", () => {
    renderDragHarness();
    const button = screen.getByRole("button", { name: "Empty all-day space" });

    fireEvent.mouseDown(button, { button: 0, clientX: 50, clientY: 0 });
    const storeBefore = useDraftStore.getState().gridDraft;

    cleanup();

    expect(() => {
      fireEvent.mouseMove(window, { clientX: 250, buttons: 1 });
    }).not.toThrow();
    expect(useDraftStore.getState().gridDraft).toEqual(storeBefore);
  });

  it("opts out when multiDayDrag is omitted (Day wiring)", () => {
    const { onCreateGridDraft } = renderDragHarness({
      multiDayDrag: undefined,
    });
    const button = screen.getByRole("button", { name: "Empty all-day space" });

    fireEvent.mouseDown(button, { button: 0, clientX: 50, clientY: 0 });
    fireEvent.mouseMove(window, { clientX: 350, buttons: 1 });
    fireEvent.mouseUp(window, { clientX: 350 });

    expect(onCreateGridDraft).toHaveBeenCalledTimes(1);
    expect(useDraftStore.getState().gridDraft?.values.schedule).toEqual({
      end: new Date("2026-05-21"),
      kind: "allDay",
      start: new Date("2026-05-20"),
    });
  });

  it("pins constant-column Day model to single-day span", () => {
    const { onCreateGridDraft } = renderDragHarness({
      getStartDate: () => "2026-05-20",
      multiDayDrag: { getVisibleDates: () => ["2026-05-20"] },
    });
    const button = screen.getByRole("button", { name: "Empty all-day space" });

    fireEvent.mouseDown(button, { button: 0, clientX: 50, clientY: 0 });
    fireEvent.mouseMove(window, { clientX: 350, buttons: 1 });

    expect(useDraftStore.getState().gridDraft?.values.schedule).toEqual({
      end: new Date("2026-05-21"),
      kind: "allDay",
      start: new Date("2026-05-20"),
    });

    fireEvent.mouseUp(window, { clientX: 350 });

    expect(onCreateGridDraft).toHaveBeenCalledTimes(1);
    const latestDraft =
      onCreateGridDraft.mock.calls[onCreateGridDraft.mock.calls.length - 1][0];
    expect(latestDraft.values.schedule).toEqual({
      end: new Date("2026-05-21"),
      kind: "allDay",
      start: new Date("2026-05-20"),
    });
    expect(useDraftStore.getState().gridDraft?.values.schedule).toEqual({
      end: new Date("2026-05-21"),
      kind: "allDay",
      start: new Date("2026-05-20"),
    });
  });
});
