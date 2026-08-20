import { afterEach, describe, expect, it, mock } from "bun:test";
import { QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { type PropsWithChildren, useState } from "react";
import dayjs, { type Dayjs } from "@core/util/date/dayjs";
import { createCompassQueryClient } from "@web/api/query-client";
import { createGridEventDraft } from "@web/events/grid-event-draft.adapter";
import {
  draftActions,
  initialDraftState,
  selectDraftActivity,
  selectGridDraft,
  useDraftStore,
} from "@web/events/stores/draft.store";
import { type Measurements_Grid } from "@web/views/Week/hooks/grid/useGridLayout";
import { type WeekProps } from "@web/views/Week/hooks/useWeek";
import { AllDayRow } from "./AllDayRow";

const startOfView = dayjs("2026-05-18T00:00:00.000");
const weekDays = Array.from({ length: 7 }, (_, index) =>
  startOfView.add(index, "day"),
);

const measurements: Measurements_Grid = {
  allDayRow: null,
  colWidths: [100, 100, 100, 100, 100, 100, 100],
  hourHeight: 60,
  mainGrid: {
    bottom: 780,
    height: 780,
    left: 0,
    right: 700,
    top: 0,
    width: 700,
    x: 0,
    y: 0,
  },
};

const createDateCalcs = () => ({
  getDateByXY: mock((_x: number, y: number) => startOfView.add(y, "minute")),
  getDateStrByXY: mock(
    (clientX: number, _clientY: number, _start: Dayjs, format?: string) => {
      const dayIndex = Math.min(Math.max(Math.floor(clientX / 100), 0), 6);
      return startOfView.add(dayIndex, "day").format(format);
    },
  ),
  getMinuteByY: mock((y: number) => y),
  getYByDate: mock(() => 0),
});

const createWeekProps = (customWeekDays: Dayjs[] = weekDays): WeekProps =>
  ({
    component: {
      category: "current" as const,
      endOfView: startOfView.add(6, "day").endOf("day"),
      isCurrentWeek: true,
      startOfView,
      week: startOfView.week(),
      weekDays: customWeekDays,
    },
    query: {
      endOfView: startOfView.add(7, "day").startOf("day"),
      startOfView,
    },
    state: { goToDate: mock() },
    util: {
      decrementWeek: mock(),
      getLastNavigationSource: mock(() => "manual" as const),
      goToToday: mock(),
      incrementWeek: mock(),
      shiftViewByDay: mock(),
    },
  }) as unknown as WeekProps;

function TestProvider({ children }: PropsWithChildren) {
  const [queryClient] = useState(() => createCompassQueryClient());
  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

const renderAllDayRow = (
  props: Partial<Parameters<typeof AllDayRow>[0]> = {},
) => {
  const dateCalcs = createDateCalcs();
  const weekProps = createWeekProps();
  const allDayRef = mock();
  const allDayRowRef = mock();

  const utils = render(
    <TestProvider>
      <AllDayRow
        allDayRef={allDayRef}
        allDayRowRef={allDayRowRef}
        dateCalcs={dateCalcs}
        measurements={measurements}
        weekProps={weekProps}
        {...props}
      />
    </TestProvider>,
  );

  return { ...utils, allDayRef, allDayRowRef, dateCalcs, weekProps };
};

afterEach(() => {
  cleanup();
  useDraftStore.setState(initialDraftState);
});

describe("AllDayRow", () => {
  it("creates a single-day draft on click, publishing 'creating' on mousedown and 'gridClick' on mouseup", () => {
    renderAllDayRow();

    const allDayRegion = screen.getByRole("region", { name: "All-day events" });
    fireEvent.mouseDown(allDayRegion, { button: 0, clientX: 100, clientY: 10 });

    expect(selectDraftActivity(useDraftStore.getState())).toBe("creating");
    expect(selectGridDraft(useDraftStore.getState())?.values.schedule).toEqual({
      end: new Date("2026-05-20"),
      kind: "allDay",
      start: new Date("2026-05-19"),
    });

    fireEvent.mouseUp(window, { button: 0, clientX: 100, clientY: 10 });

    expect(selectDraftActivity(useDraftStore.getState())).toBe("gridClick");
    expect(selectGridDraft(useDraftStore.getState())?.values.schedule).toEqual({
      end: new Date("2026-05-20"),
      kind: "allDay",
      start: new Date("2026-05-19"),
    });
  });

  it("creates a spanning multi-day draft on left-to-right drag across columns", () => {
    renderAllDayRow();

    const allDayRegion = screen.getByRole("region", { name: "All-day events" });
    fireEvent.mouseDown(allDayRegion, { button: 0, clientX: 50, clientY: 10 });
    fireEvent.mouseMove(window, { buttons: 1, clientX: 250, clientY: 10 });

    expect(selectDraftActivity(useDraftStore.getState())).toBe("creating");
    expect(selectGridDraft(useDraftStore.getState())?.values.schedule).toEqual({
      end: new Date("2026-05-21"),
      kind: "allDay",
      start: new Date("2026-05-18"),
    });

    fireEvent.mouseUp(window, { button: 0, clientX: 250, clientY: 10 });

    expect(selectDraftActivity(useDraftStore.getState())).toBe("gridClick");
    expect(selectGridDraft(useDraftStore.getState())?.values.schedule).toEqual({
      end: new Date("2026-05-21"),
      kind: "allDay",
      start: new Date("2026-05-18"),
    });
  });

  it("normalizes a right-to-left drag to the spanning date range", () => {
    renderAllDayRow();

    const allDayRegion = screen.getByRole("region", { name: "All-day events" });
    fireEvent.mouseDown(allDayRegion, { button: 0, clientX: 350, clientY: 10 });
    fireEvent.mouseMove(window, { buttons: 1, clientX: 150, clientY: 10 });

    expect(selectGridDraft(useDraftStore.getState())?.values.schedule).toEqual({
      end: new Date("2026-05-22"),
      kind: "allDay",
      start: new Date("2026-05-19"),
    });

    fireEvent.mouseUp(window, { button: 0, clientX: 150, clientY: 10 });

    expect(selectDraftActivity(useDraftStore.getState())).toBe("gridClick");
    expect(selectGridDraft(useDraftStore.getState())?.values.schedule).toEqual({
      end: new Date("2026-05-22"),
      kind: "allDay",
      start: new Date("2026-05-19"),
    });
  });

  it("discards draft on Escape during drag gesture", () => {
    renderAllDayRow();

    const allDayRegion = screen.getByRole("region", { name: "All-day events" });
    fireEvent.mouseDown(allDayRegion, { button: 0, clientX: 50, clientY: 10 });
    fireEvent.mouseMove(window, { buttons: 1, clientX: 250, clientY: 10 });

    expect(selectGridDraft(useDraftStore.getState())).not.toBeNull();

    fireEvent.keyDown(window, { key: "Escape" });

    expect(selectGridDraft(useDraftStore.getState())).toBeNull();
  });

  it("dismisses an existing draft when mousedown occurs on all-day row", () => {
    const existingDraft = createGridEventDraft({
      kind: "allDay",
      start: new Date("2026-05-20"),
      end: new Date("2026-05-21"),
    });
    draftActions.startGridDraft({ activity: "gridClick", draft: existingDraft });

    renderAllDayRow();

    const allDayRegion = screen.getByRole("region", { name: "All-day events" });
    fireEvent.mouseDown(allDayRegion, { button: 0, clientX: 50, clientY: 10 });

    expect(selectGridDraft(useDraftStore.getState())).toBeNull();
  });

  it("renders children branch when children render prop is supplied", () => {
    const childrenMock = mock(({ onAllDayMouseDown }) => (
      <button onMouseDown={onAllDayMouseDown} type="button">
        Custom all-day child
      </button>
    ));

    renderAllDayRow({ children: childrenMock });

    expect(childrenMock).toHaveBeenCalledWith(
      expect.objectContaining({
        allDayEventsLayer: expect.anything(),
        allDayRowsCount: expect.any(Number),
        onAllDayMouseDown: expect.any(Function),
      }),
    );

    const button = screen.getByRole("button", { name: "Custom all-day child" });
    fireEvent.mouseDown(button, { button: 0, clientX: 100, clientY: 10 });

    expect(selectDraftActivity(useDraftStore.getState())).toBe("creating");
  });
});
