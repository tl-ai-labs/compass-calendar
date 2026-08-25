import { QueryClientProvider } from "@tanstack/react-query";
import { type PropsWithChildren, useState } from "react";
import dayjs, { type Dayjs } from "@core/util/date/dayjs";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@web/__tests__/__mocks__/mock.render";
import { seedEventQueries } from "@web/__tests__/utils/event-query-test-data";
import { createCompassQueryClient } from "@web/api/query-client";
import {
  initialDraftState,
  selectGridDraft,
  useDraftStore,
} from "@web/events/stores/draft.store";
import { type Measurements_Grid } from "@web/views/Week/hooks/grid/useGridLayout";
import { AllDayRow } from "./AllDayRow";
import { afterEach, describe, expect, it, mock } from "bun:test";

// A real (empty) event cache rather than a module mock: bun's mock.module is
// process-wide, so stubbing the week-events query here would strip that
// module's other exports for every test file that runs afterwards.
function Provider({ children }: PropsWithChildren) {
  // useState so a re-render does not drop the seeded cache.
  const [queryClient] = useState(() => {
    const client = createCompassQueryClient();
    seedEventQueries(client, []);
    return client;
  });

  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

const startOfView = dayjs("2026-05-20T00:00:00.000");

const measurements = {
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
} satisfies Measurements_Grid;

// Column identity comes from pointer x, exactly as it does in the real grid:
// x<100 -> 05-20, <200 -> 05-21, <300 -> 05-22, else 05-23.
const dateStrForX = (x: number) => {
  if (x < 100) return "2026-05-20";
  if (x < 200) return "2026-05-21";
  if (x < 300) return "2026-05-22";
  return "2026-05-23";
};

const createDateCalcs = () => ({
  getDateByXY: (x: number, _y: number, _firstDayInView: Dayjs) =>
    dayjs(dateStrForX(x)),
  getDateStrByXY: (x: number) => dateStrForX(x),
  getMinuteByY: (y: number) => y,
  getYByDate: () => 0,
});

const createWeekProps = () => ({
  component: {
    category: "current" as const,
    endOfView: startOfView.endOf("week"),
    isCurrentWeek: true,
    startOfView,
    week: startOfView.week(),
    weekDays: Array.from({ length: 7 }, (_, index) =>
      startOfView.add(index, "day"),
    ),
  },
  query: {
    endOfView: startOfView.add(6, "day").endOf("day"),
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
});

// Renders through the `children` render-prop branch, so the all-day events
// layer is constructed but never mounted.
const renderAllDayRow = () =>
  render(
    <Provider>
      <AllDayRow
        allDayRef={mock()}
        allDayRowRef={mock()}
        dateCalcs={createDateCalcs()}
        measurements={measurements}
        weekProps={createWeekProps()}
      >
        {({ onAllDayMouseDown }) => (
          <button onMouseDown={onAllDayMouseDown} type="button">
            Empty all-day space
          </button>
        )}
      </AllDayRow>
    </Provider>,
  );

const getAllDayButton = () =>
  screen.getByRole("button", { name: "Empty all-day space" });

afterEach(() => {
  cleanup();
  useDraftStore.setState(initialDraftState, true);
});

describe("AllDayRow multi-day drag-to-create", () => {
  it("creates a four-day spanning draft when dragging across four columns", async () => {
    renderAllDayRow();

    fireEvent.mouseDown(getAllDayButton(), {
      button: 0,
      buttons: 1,
      clientX: 50,
      clientY: 0,
    });
    fireEvent.mouseMove(window, { buttons: 1, clientX: 350, clientY: 0 });
    fireEvent.mouseUp(window, { clientX: 350, clientY: 0 });

    await waitFor(() => {
      expect(
        selectGridDraft(useDraftStore.getState())?.values.schedule,
      ).toEqual({
        end: dayjs("2026-05-24").toDate(),
        kind: "allDay",
        start: dayjs("2026-05-20").toDate(),
      });
    });
    expect(useDraftStore.getState().status?.activity).toBe("gridClick");
  });

  it("creates a one-day draft when pressing and releasing without moving", async () => {
    renderAllDayRow();

    fireEvent.mouseDown(getAllDayButton(), {
      button: 0,
      buttons: 1,
      clientX: 50,
      clientY: 0,
    });
    fireEvent.mouseUp(window, { clientX: 50, clientY: 0 });

    await waitFor(() => {
      expect(
        selectGridDraft(useDraftStore.getState())?.values.schedule,
      ).toEqual({
        end: dayjs("2026-05-21").toDate(),
        kind: "allDay",
        start: dayjs("2026-05-20").toDate(),
      });
    });
    expect(useDraftStore.getState().status?.activity).toBe("gridClick");
  });
});
