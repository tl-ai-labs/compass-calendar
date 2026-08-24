import {
  ID_ALLDAY_COLUMNS,
  ID_GRID_COLUMNS_TIMED,
  ID_GRID_MAIN,
} from "@web/common/constants/web.constants";
import { INTERACTION_EDGE_THRESHOLD_PX } from "@web/interaction/interaction.constants";
import {
  buildDayAllDayLayoutCache,
  buildDayTimedLayoutCache,
} from "@web/views/Day/interaction/adapter/geometry/day-layout.cache";
import { WEEK_EDGE_NAVIGATION_THRESHOLD_PX } from "@web/views/Week/interaction/adapter/edge-navigation";
import {
  buildAllDayWeekLayoutCache,
  buildTimedWeekLayoutCache,
} from "@web/views/Week/interaction/adapter/geometry/week-layout.cache";
import { asDateColumnKeys } from "./types/column-key.test-util";
import { afterEach, describe, expect, it } from "bun:test";

/**
 * INV-9 / INV-10 — the per-view layout preset VALUES.
 *
 * `edgeThresholdPx` and the presence or absence of `smartScroll` are pure
 * configuration data. Nothing asserted them before this file: a wrong
 * threshold, or smart scroll accidentally enabled for Day's all-day row,
 * produces no type error and no test failure — it surfaces only as changed
 * edge-scroll behaviour during a real drag.
 *
 * These assertions exist to make that drift loud. They are written against the
 * CURRENT (pre-merge) preset wrappers, so they capture today's values, and
 * they are the guard the deferred FR-5 preset merge should be landed against.
 */

const setRect = (
  element: HTMLElement,
  rect: Pick<DOMRect, "height" | "left" | "top" | "width">,
) => {
  const domRect = {
    ...rect,
    bottom: rect.top + rect.height,
    right: rect.left + rect.width,
    x: rect.left,
    y: rect.top,
    toJSON: () => ({}),
  } as DOMRect;

  element.getBoundingClientRect = () => domRect;
};

const mountGrid = () => {
  const mainGrid = document.createElement("div");
  const timedColumns = document.createElement("div");
  const allDayColumns = document.createElement("div");

  mainGrid.id = ID_GRID_MAIN;
  timedColumns.id = ID_GRID_COLUMNS_TIMED;
  allDayColumns.id = ID_ALLDAY_COLUMNS;
  mainGrid.append(timedColumns);
  document.body.append(mainGrid, allDayColumns);

  Object.defineProperty(mainGrid, "clientHeight", { value: 1300 });
  Object.defineProperty(mainGrid, "scrollHeight", { value: 2600 });
  mainGrid.scrollTop = 0;

  setRect(mainGrid, { height: 1300, left: 50, top: 100, width: 750 });
  setRect(timedColumns, { height: 1300, left: 100, top: 100, width: 700 });
  setRect(allDayColumns, { height: 40, left: 100, top: 20, width: 700 });

  return { allDayColumns, mainGrid, timedColumns };
};

const WEEK_DATES = asDateColumnKeys(["2026-05-10", "2026-05-11", "2026-05-12"]);

const DAY_DATES = asDateColumnKeys(["2026-05-10"]);

afterEach(() => {
  document.body.innerHTML = "";
});

describe("layout cache presets", () => {
  it("Week timed preset uses the week edge threshold and enables smart scroll", () => {
    mountGrid();

    const layout = buildTimedWeekLayoutCache({ visibleDays: WEEK_DATES });

    expect(layout).not.toBeNull();
    expect(layout!.edgeNavigation.edgeThresholdPx).toBe(
      WEEK_EDGE_NAVIGATION_THRESHOLD_PX,
    );
    expect(layout!.smartScroll).toBeDefined();
    expect(layout!.smartScroll!.speedPx).toBe(10);
    // bottom = rect.bottom (1400) - SMART_SCROLL_BOTTOM_INSET_PX (100)
    expect(layout!.smartScroll!.bottom).toBe(1300);
  });

  it("Week all-day preset carries the week edge threshold and no smart scroll", () => {
    mountGrid();

    const layout = buildAllDayWeekLayoutCache({ visibleDays: WEEK_DATES });

    expect(layout).not.toBeNull();
    expect(layout!.edgeNavigation.edgeThresholdPx).toBe(
      WEEK_EDGE_NAVIGATION_THRESHOLD_PX,
    );
    // The Week all-day preset DOES pass a smartScroll option, but
    // buildAllDayGridLayoutCache ignores that field, so it is inert. This
    // assertion pins the inertness: it is preserved behaviour, not a bug to
    // "fix" during the deferred preset merge.
    expect(layout!.smartScroll).toBeUndefined();
  });

  it("Day timed preset uses the shared interaction edge threshold and enables smart scroll", () => {
    const { allDayColumns, mainGrid, timedColumns } = mountGrid();

    const layout = buildDayTimedLayoutCache(
      {
        allDayColumnsElement: allDayColumns,
        mainGridElement: mainGrid,
        timedColumnsElement: timedColumns,
      },
      DAY_DATES,
    );

    expect(layout).not.toBeNull();
    expect(layout!.edgeNavigation.edgeThresholdPx).toBe(
      INTERACTION_EDGE_THRESHOLD_PX,
    );
    expect(layout!.smartScroll).toBeDefined();
  });

  it("Day all-day preset pins edgeThresholdPx to 0 and never smart-scrolls", () => {
    const { allDayColumns, mainGrid, timedColumns } = mountGrid();

    const layout = buildDayAllDayLayoutCache(
      {
        allDayColumnsElement: allDayColumns,
        mainGridElement: mainGrid,
        timedColumnsElement: timedColumns,
      },
      DAY_DATES,
    );

    expect(layout).not.toBeNull();
    // Deliberately 0, unlike every other preset. The Day all-day row does not
    // edge-navigate.
    expect(layout!.edgeNavigation.edgeThresholdPx).toBe(0);
    expect(layout!.smartScroll).toBeUndefined();
  });
});
