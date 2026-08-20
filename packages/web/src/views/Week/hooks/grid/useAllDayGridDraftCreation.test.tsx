import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { YEAR_MONTH_DAY_FORMAT } from "@core/constants/date.constants";
import dayjs from "@core/util/date/dayjs";
import { draftActions, useDraftStore } from "@web/events/stores/draft.store";
import { type WeekProps } from "../useWeek";
import { useAllDayGridDraftCreation } from "./useAllDayGridDraftCreation";
import { type DateCalcs } from "./useDateCalcs";
import { afterEach, describe, expect, it, mock } from "bun:test";

const COLUMN_WIDTH_PX = 100;
const COLUMN_DATES = ["2026-05-24", "2026-05-25", "2026-05-26", "2026-05-27"];

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
const mayDay = (dayOfMonth: number) => new Date(2026, 4, dayOfMonth);

const allDaySchedule = (startDay: number, endDay: number) => ({
  end: mayDay(endDay),
  kind: "allDay" as const,
  start: mayDay(startDay),
});

const createWeekProps = (): WeekProps =>
  ({
    component: {
      endOfView: dayjs("2026-05-30T23:59:59.999"),
      startOfView: dayjs("2026-05-24T00:00:00.000"),
      weekDays: [...Array(7)].map((_, index) =>
        dayjs("2026-05-24T00:00:00.000").add(index, "day"),
      ),
    },
    query: {
      endOfView: dayjs("2026-05-30T23:59:59.999"),
      startOfView: dayjs("2026-05-24T00:00:00.000"),
    },
  }) as WeekProps;

const renderHarness = () => {
  const getDateStrByXY = mock((clientX: number) => dateAtX(clientX));
  const dateCalcs = {
    getDateByXY: mock(),
    getDateStrByXY,
    getMinuteByY: mock(() => 0),
    getYByDate: mock(() => 0),
  } as unknown as DateCalcs;
  const weekProps = createWeekProps();

  const Harness = () => {
    const onMouseDown = useAllDayGridDraftCreation({ dateCalcs, weekProps });

    return (
      <button onMouseDown={onMouseDown} type="button">
        Week all-day row
      </button>
    );
  };

  render(<Harness />);

  return {
    getDateStrByXY,
    surface: screen.getByRole("button", { name: "Week all-day row" }),
    weekProps,
  };
};

const pressAt = (surface: HTMLElement, clientX: number) =>
  fireEvent.mouseDown(surface, { button: 0, buttons: 1, clientX, clientY: 0 });

const moveTo = (clientX: number) =>
  fireEvent.mouseMove(window, { buttons: 1, clientX, clientY: 0 });

const releaseAt = (clientX: number) =>
  fireEvent.mouseUp(window, { clientX, clientY: 0 });

const storedSchedule = () =>
  useDraftStore.getState().gridDraft?.values.schedule ?? null;

afterEach(cleanup);
afterEach(() => {
  draftActions.discard();
});

describe("useAllDayGridDraftCreation", () => {
  it("asks the week's date calcs for a YYYY-MM-DD day", () => {
    const { getDateStrByXY, surface, weekProps } = renderHarness();

    pressAt(surface, 10);

    expect(getDateStrByXY).toHaveBeenCalledWith(
      10,
      0,
      weekProps.component.startOfView,
      YEAR_MONTH_DAY_FORMAT,
    );
  });

  it("starts a one-day gridClick draft on a plain press", () => {
    const { surface } = renderHarness();

    pressAt(surface, 10);
    releaseAt(10);

    expect(storedSchedule()).toEqual(allDaySchedule(24, 25));
    expect(useDraftStore.getState().status?.activity).toBe("gridClick");
    expect(useDraftStore.getState().status?.isFormOpen).toBe(false);
  });

  it("commits the dragged span to the store on release", () => {
    const { surface } = renderHarness();

    pressAt(surface, 10);
    moveTo(150);
    moveTo(250);
    releaseAt(250);

    expect(storedSchedule()).toEqual(allDaySchedule(24, 27));
  });

  it("leaves the store activity at gridClick, never stranded at creating", () => {
    const { surface } = renderHarness();

    pressAt(surface, 10);
    moveTo(150);
    moveTo(250);
    releaseAt(250);

    expect(useDraftStore.getState().status?.activity).toBe("gridClick");
  });

  it("discards the preview when the gesture is cancelled with Escape", () => {
    const { surface } = renderHarness();

    pressAt(surface, 10);
    moveTo(250);
    fireEvent.keyDown(window, { key: "Escape" });

    expect(useDraftStore.getState().gridDraft).toBeNull();
  });
});
