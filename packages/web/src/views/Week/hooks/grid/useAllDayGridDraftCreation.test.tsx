import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { YEAR_MONTH_DAY_FORMAT } from "@core/constants/date.constants";
import dayjs, { type Dayjs } from "@core/util/date/dayjs";
import { draftActions, useDraftStore } from "@web/events/stores/draft.store";
import { useAllDayGridDraftCreation } from "./useAllDayGridDraftCreation";
import { type DateCalcs } from "./useDateCalcs";
import { afterEach, describe, expect, it } from "bun:test";

const COLUMN_ZERO = "2026-05-18";
const COLUMN_WIDTH_PX = 100;
const LAST_COLUMN_INDEX = 6;
const PRESS_Y = 7;

const startOfView = dayjs(COLUMN_ZERO);

interface RecordedCall {
  x: number;
  y: number;
  firstDayInView: Dayjs;
  format?: string;
}

/**
 * A DateCalcs-shaped stub. The real one needs Measurements_Grid, a scrollable
 * grid ref and a week of Dayjs; none of that is what this hook is responsible
 * for, so the stub models the mapping and records what it was asked.
 */
const createDateCalcsStub = () => {
  const calls: RecordedCall[] = [];

  const columnDate = (x: number, y: number) =>
    dayjs(COLUMN_ZERO)
      .add(
        Math.max(
          0,
          Math.min(LAST_COLUMN_INDEX, Math.floor(x / COLUMN_WIDTH_PX)),
        ),
        "day",
      )
      // Mirrors the real getDateByXY folding y in through an unbounded
      // getMinuteByY, so a live y would roll the resolved day.
      .add(Math.max(0, y), "minutes");

  const dateCalcs: DateCalcs = {
    getDateByXY: (x: number, y: number, firstDayInView: Dayjs) => {
      calls.push({ x, y, firstDayInView });
      return columnDate(x, y);
    },
    getDateStrByXY: (
      x: number,
      y: number,
      firstDayInView: Dayjs,
      format?: string,
    ) => {
      calls.push({ x, y, firstDayInView, format });
      return columnDate(x, y).format(format);
    },
    getMinuteByY: (y: number) => Math.max(0, y),
    getYByDate: () => 0,
  };

  return { calls, dateCalcs };
};

const renderHarness = () => {
  const { calls, dateCalcs } = createDateCalcsStub();

  const Harness = () => {
    const onMouseDown = useAllDayGridDraftCreation({ dateCalcs, startOfView });

    return (
      <button onMouseDown={onMouseDown} type="button">
        Week all-day row
      </button>
    );
  };

  render(<Harness />);

  return { calls };
};

const surface = () => screen.getByRole("button", { name: "Week all-day row" });

const pressAt = (clientX: number, clientY: number = PRESS_Y) =>
  fireEvent.mouseDown(surface(), { button: 0, clientX, clientY });

// jsdom omits `buttons`, and the gesture finishes without it.
const moveTo = (clientX: number, clientY: number = PRESS_Y) =>
  fireEvent.mouseMove(window, { buttons: 1, clientX, clientY });

const releaseAt = (clientX: number, clientY: number = PRESS_Y) =>
  fireEvent.mouseUp(window, { clientX, clientY });

const storedDates = () => {
  const draft = useDraftStore.getState().gridDraft;

  if (!draft) {
    return null;
  }

  return {
    start: dayjs(draft.values.schedule.start).format(YEAR_MONTH_DAY_FORMAT),
    end: dayjs(draft.values.schedule.end).format(YEAR_MONTH_DAY_FORMAT),
  };
};

afterEach(cleanup);
afterEach(() => {
  draftActions.discard();
});

describe("useAllDayGridDraftCreation", () => {
  it("opts the Week all-day row into multi-day drag", () => {
    renderHarness();

    pressAt(50);
    moveTo(350);
    releaseAt(350);

    expect(storedDates()).toEqual({
      start: "2026-05-18",
      end: "2026-05-22",
    });
  });

  it("hands the finished drag to the existing gridClick flow", () => {
    renderHarness();

    pressAt(50);
    moveTo(350);
    releaseAt(350);

    expect(useDraftStore.getState().status?.activity).toBe("gridClick");
    expect(storedDates()).toEqual({
      start: "2026-05-18",
      end: "2026-05-22",
    });
  });

  it("resolves dates through getDateStrByXY with the view's format and start", () => {
    const { calls } = renderHarness();

    pressAt(50);
    moveTo(350);
    releaseAt(350);

    expect(calls.length).toBeGreaterThan(0);
    for (const call of calls) {
      expect(call.format).toBe(YEAR_MONTH_DAY_FORMAT);
      expect(call.firstDayInView).toBe(startOfView);
    }
  });

  it("pins clientY to the press for every resolution during the gesture", () => {
    const { calls } = renderHarness();

    pressAt(50, PRESS_Y);
    moveTo(350, 2000);
    releaseAt(350, 2000);

    // A live y would have reached the stub as 2000 and rolled the day.
    for (const call of calls) {
      expect(call.y).toBe(PRESS_Y);
    }
    expect(storedDates()).toEqual({
      start: "2026-05-18",
      end: "2026-05-22",
    });
  });

  it("returns a value usable directly as an onMouseDown prop", () => {
    renderHarness();

    // Reaching this assertion at all is the runtime half of the proof; the
    // compile-time half is the harness above passing it to onMouseDown.
    expect(surface()).toBeDefined();

    pressAt(50);
    releaseAt(50);

    expect(storedDates()).toEqual({
      start: "2026-05-18",
      end: "2026-05-19",
    });
  });
});
