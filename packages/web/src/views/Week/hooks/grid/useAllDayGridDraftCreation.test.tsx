import { afterEach, describe, expect, it, mock } from "bun:test";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { YEAR_MONTH_DAY_FORMAT } from "@core/constants/date.constants";
import dayjs, { type Dayjs } from "@core/util/date/dayjs";
import {
  initialDraftState,
  selectDraftActivity,
  selectGridDraft,
  useDraftStore,
} from "@web/events/stores/draft.store";
import { type WeekProps } from "../useWeek";
import { useAllDayGridDraftCreation } from "./useAllDayGridDraftCreation";
import { type DateCalcs } from "./useDateCalcs";

const startOfView = dayjs("2026-05-18T00:00:00.000");
const weekDays = Array.from({ length: 7 }, (_, index) =>
  startOfView.add(index, "day"),
);

const createMockWeekProps = (customWeekDays: Dayjs[] = weekDays): WeekProps =>
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

const createMockDateCalcs = () => {
  const getDateStrByXY = mock(
    (clientX: number, _clientY: number, _start: Dayjs, format?: string) => {
      const dayIndex = Math.min(Math.max(Math.floor(clientX / 100), 0), 6);
      return startOfView.add(dayIndex, "day").format(format);
    },
  );

  return {
    dateCalcs: {
      getDateByXY: mock((_x: number, y: number) => startOfView.add(y, "minute")),
      getDateStrByXY,
      getMinuteByY: mock((y: number) => y),
      getYByDate: mock(() => 0),
    } as unknown as DateCalcs,
    getDateStrByXY,
  };
};

const renderHarness = ({
  customWeekDays,
  dateCalcs,
  weekProps,
}: {
  customWeekDays?: Dayjs[];
  dateCalcs?: DateCalcs;
  weekProps?: WeekProps;
} = {}) => {
  const mockCalcs = dateCalcs ?? createMockDateCalcs().dateCalcs;
  const mockProps =
    weekProps ??
    (customWeekDays !== undefined
      ? createMockWeekProps(customWeekDays)
      : createMockWeekProps());

  const Harness = () => {
    const onMouseDown = useAllDayGridDraftCreation({
      dateCalcs: mockCalcs,
      weekProps: mockProps,
    });

    return (
      <button onMouseDown={onMouseDown} type="button">
        All-day trigger
      </button>
    );
  };

  const utils = render(<Harness />);
  return { ...utils, dateCalcs: mockCalcs, weekProps: mockProps };
};

afterEach(() => {
  cleanup();
  useDraftStore.setState(initialDraftState);
});

describe("useAllDayGridDraftCreation", () => {
  it("derives visibleBounds from first and last weekDays and provides getStartDate using dateCalcs", () => {
    const { dateCalcs, getDateStrByXY } = createMockDateCalcs();
    const weekProps = createMockWeekProps();

    renderHarness({ dateCalcs, weekProps });

    const button = screen.getByRole("button", { name: "All-day trigger" });
    fireEvent.mouseDown(button, { button: 0, clientX: 100, clientY: 50 });

    expect(getDateStrByXY).toHaveBeenCalledWith(
      100,
      50,
      weekProps.query.startOfView,
      YEAR_MONTH_DAY_FORMAT,
    );
    expect(selectDraftActivity(useDraftStore.getState())).toBe("creating");
    expect(selectGridDraft(useDraftStore.getState())?.values.schedule).toEqual({
      end: new Date("2026-05-20"),
      kind: "allDay",
      start: new Date("2026-05-19"),
    });
  });

  it("supports multi-day drag and opens form with activity 'gridClick' on mouseup", () => {
    const { dateCalcs } = createMockDateCalcs();
    renderHarness({ dateCalcs });

    const button = screen.getByRole("button", { name: "All-day trigger" });
    fireEvent.mouseDown(button, { button: 0, clientX: 100, clientY: 50 });
    fireEvent.mouseMove(window, { buttons: 1, clientX: 300, clientY: 50 });

    expect(selectDraftActivity(useDraftStore.getState())).toBe("creating");
    expect(selectGridDraft(useDraftStore.getState())?.values.schedule).toEqual({
      end: new Date("2026-05-22"),
      kind: "allDay",
      start: new Date("2026-05-19"),
    });

    fireEvent.mouseUp(window, { button: 0, clientX: 300, clientY: 50 });

    expect(selectDraftActivity(useDraftStore.getState())).toBe("gridClick");
    expect(selectGridDraft(useDraftStore.getState())?.values.schedule).toEqual({
      end: new Date("2026-05-22"),
      kind: "allDay",
      start: new Date("2026-05-19"),
    });
  });

  it("falls back to click-only path when weekDays is empty (no visibleBounds)", () => {
    const { dateCalcs } = createMockDateCalcs();
    renderHarness({ customWeekDays: [], dateCalcs });

    const button = screen.getByRole("button", { name: "All-day trigger" });
    fireEvent.mouseDown(button, { button: 0, clientX: 100, clientY: 50 });

    expect(selectDraftActivity(useDraftStore.getState())).toBe("gridClick");
    expect(selectGridDraft(useDraftStore.getState())?.values.schedule).toEqual({
      end: new Date("2026-05-20"),
      kind: "allDay",
      start: new Date("2026-05-19"),
    });
  });

  it("discards the draft when Escape is pressed during drag", () => {
    const { dateCalcs } = createMockDateCalcs();
    renderHarness({ dateCalcs });

    const button = screen.getByRole("button", { name: "All-day trigger" });
    fireEvent.mouseDown(button, { button: 0, clientX: 100, clientY: 50 });
    fireEvent.mouseMove(window, { buttons: 1, clientX: 300, clientY: 50 });

    expect(selectGridDraft(useDraftStore.getState())).not.toBeNull();

    fireEvent.keyDown(window, { key: "Escape" });

    expect(selectGridDraft(useDraftStore.getState())).toBeNull();
  });
});
