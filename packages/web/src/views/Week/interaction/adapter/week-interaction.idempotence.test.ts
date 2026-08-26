import dayjs from "@core/util/date/dayjs";
import {
  ID_GRID_COLUMNS_TIMED,
  ID_GRID_MAIN,
} from "@web/common/constants/web.constants";
import { type GridEvent } from "@web/common/types/web.event.types";
import { createWeekInteractionAdapter } from "@web/views/Week/interaction/adapter/week-interaction.adapter";
import { weekEventRegistry } from "@web/views/Week/interaction/registry/week-event.registry";
import { resetWeekInteractionEdgeNavigationState } from "@web/views/Week/interaction/state/edge-navigation.state";
import { afterEach, describe, expect, it, mock } from "bun:test";

/**
 * The engine contract: `updateVisual` must be idempotent for a given pointer,
 * because the engine re-invokes it at pointerup with the same pointer to
 * recompute the visual before commit
 * (`interaction.adapter.types.ts:37-38`).
 *
 * A seventh Week adapter file rather than an addition to one of the existing
 * six, so that the six suites that guard Week's behaviour stay byte-identical
 * through this refactor and `git diff --stat` is a sufficient audit of that.
 *
 * The failure this catches is an adapter that accumulates into the visual
 * instead of recomputing it: a second identical pointermove would then move
 * the event twice, and the pointerup recompute would move it a third time.
 */

const createTimedEvent = (): GridEvent =>
  ({
    _id: "timed-event",
    endDate: "2026-05-19T10:00:00.000",
    isAllDay: false,
    position: {
      height: 100,
      left: 200,
      maxWidth: 100,
      order: 0,
      top: 900,
      width: 100,
    },
    startDate: "2026-05-19T09:00:00.000",
    title: "Timed event",
    user: "user-1",
  }) as unknown as GridEvent;

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

const makePointerEvent = (
  type: string,
  { target, x, y }: { target: EventTarget; x: number; y: number },
) => {
  const event = new PointerEvent(type, {
    clientX: x,
    clientY: y,
    isPrimary: true,
    pointerId: 1,
  });

  Object.defineProperty(event, "target", { value: target });

  return event;
};

// Sun 2026-05-17 rendered as 7 columns of 100px starting at x=100, so the
// event on Tue 2026-05-19 sits in column 2 (x 300-400).
const FULL_WEEK_DAYS = [
  "2026-05-17",
  "2026-05-18",
  "2026-05-19",
  "2026-05-20",
  "2026-05-21",
  "2026-05-22",
  "2026-05-23",
];

const createHarness = () => {
  document.body.innerHTML = "";
  weekEventRegistry.clear();

  let now = 100;
  let nextFrameId = 1;
  const frameCallbacks = new Map<unknown, FrameRequestCallback>();
  const timerCallbacks = new Map<unknown, () => void>();
  const event = createTimedEvent();
  const source = document.createElement("div");
  const child = document.createElement("span");
  const mainGrid = document.createElement("div");
  const columns = document.createElement("div");
  const onCommitTimedDrag = mock();

  source.style.visibility = "visible";
  mainGrid.id = ID_GRID_MAIN;
  columns.id = ID_GRID_COLUMNS_TIMED;
  source.append(child);
  mainGrid.append(columns, source);
  document.body.append(mainGrid);
  Object.defineProperty(mainGrid, "clientHeight", { value: 1300 });
  Object.defineProperty(mainGrid, "scrollHeight", { value: 2600 });
  mainGrid.scrollTop = 0;

  setRect(mainGrid, { height: 1300, left: 50, top: 100, width: 750 });
  setRect(columns, { height: 2400, left: 100, top: 100, width: 700 });
  setRect(source, { height: 100, left: 300, top: 1000, width: 90 });

  weekEventRegistry.register({
    element: source,
    eventId: event._id!,
    eventType: "timed",
  });

  const adapter = createWeekInteractionAdapter({
    engineOptions: {
      cancelFrame: (frame) => frameCallbacks.delete(frame),
      clearTimer: (timer) => timerCallbacks.delete(timer),
      now: () => now,
      requestFrame: (callback) => {
        const frameId = nextFrameId;

        nextFrameId += 1;
        frameCallbacks.set(frameId, callback);

        return frameId;
      },
      setTimer: (callback) => {
        const timer = Symbol("timer");

        timerCallbacks.set(timer, callback);

        return timer;
      },
    },
    runtime: () => ({
      getTimedEventById: (eventId) => (eventId === event._id ? event : null),
      getVisibleDays: () => FULL_WEEK_DAYS,
      onClickTimedEvent: () => undefined,
      onCommitTimedDrag,
    }),
  });

  const flushFrame = (timestamp = 16) => {
    const [[frameId, callback]] = frameCallbacks;

    if (!callback) {
      throw new Error("Expected a frame callback to be scheduled");
    }

    frameCallbacks.delete(frameId);
    now += 8;
    callback(timestamp);
  };

  const fireHoldTimer = () => {
    const [[timerId, callback]] = timerCallbacks;

    if (!callback) {
      throw new Error("Expected a hold timer to be scheduled");
    }

    timerCallbacks.delete(timerId);
    callback();
  };

  const beginDrag = () => {
    adapter.handlePointerDown(
      makePointerEvent("pointerdown", { target: child, x: 320, y: 1020 }),
    );
    fireHoldTimer();
  };

  const moveTo = (x: number, y: number) => {
    adapter.handlePointerMove(
      makePointerEvent("pointermove", { target: child, x, y }),
    );
    flushFrame();
  };

  const releaseAt = (x: number, y: number) => {
    adapter.handlePointerUp(
      makePointerEvent("pointerup", { target: child, x, y }),
    );
  };

  return { adapter, beginDrag, moveTo, onCommitTimedDrag, releaseAt };
};

afterEach(() => {
  document.body.innerHTML = "";
  weekEventRegistry.clear();
  resetWeekInteractionEdgeNavigationState();
});

describe("WeekInteractionAdapter updateVisual idempotence", () => {
  it("moves the event one day for two identical pointermoves plus the pointerup recompute", () => {
    // x=420 is column 3 (Wed 2026-05-20), one column right of the event's own.
    // Three updateVisual invocations at that x — two moves and the engine's
    // own recompute at pointerup — must all land on the same day.
    const { beginDrag, moveTo, onCommitTimedDrag, releaseAt } = createHarness();

    beginDrag();
    moveTo(420, 1020);
    moveTo(420, 1020);
    releaseAt(420, 1020);

    expect(onCommitTimedDrag).toHaveBeenCalledTimes(1);

    const [result] = onCommitTimedDrag.mock.calls[0]!;

    expect(result.hasMoved).toBe(true);
    expect(dayjs(result.event.startDate).format("YYYY-MM-DD")).toBe(
      "2026-05-20",
    );
    expect(dayjs(result.event.endDate).format("YYYY-MM-DD")).toBe("2026-05-20");
  });

  it("produces the same commit whether the pointer moved once or three times to the same point", () => {
    const once = createHarness();

    once.beginDrag();
    once.moveTo(420, 1020);
    once.releaseAt(420, 1020);

    const thrice = createHarness();

    thrice.beginDrag();
    thrice.moveTo(420, 1020);
    thrice.moveTo(420, 1020);
    thrice.moveTo(420, 1020);
    thrice.releaseAt(420, 1020);

    const [onceResult] = once.onCommitTimedDrag.mock.calls[0]!;
    const [thriceResult] = thrice.onCommitTimedDrag.mock.calls[0]!;

    expect(thriceResult.event.startDate).toBe(onceResult.event.startDate);
    expect(thriceResult.event.endDate).toBe(onceResult.event.endDate);
  });

  it("recomputes minutes from the pointer origin, not from the previous visual", () => {
    // What this proves: the vertical position is derived from `pointerStart`
    // each time, so repeating the move does not walk the event down the grid.
    //
    // What it does NOT prove: smart-scroll delta behaviour. This harness's
    // grid spans y 100-1400 with a 100px bottom inset, so the scroll zones sit
    // outside y 150-1250 and every pointer below is in the dead band, where
    // scrollDeltaPx is identically 0. Accumulating zero is still zero, so a
    // regression in `applySmartScroll` would slip past this file — that
    // invariant is covered directly in
    // `grid/interaction/adapter/view-interaction.layout-state.test.ts`.
    const { beginDrag, moveTo, onCommitTimedDrag, releaseAt } = createHarness();

    beginDrag();
    moveTo(320, 1120);
    moveTo(320, 1120);
    moveTo(320, 1120);
    releaseAt(320, 1120);

    const [result] = onCommitTimedDrag.mock.calls[0]!;
    const start = dayjs(result.event.startDate);
    const end = dayjs(result.event.endDate);

    // One hour of duration is preserved, and the start has shifted by the
    // single 100px offset rather than a multiple of it.
    expect(end.diff(start, "minute")).toBe(60);
    expect(start.hour()).toBe(10);
  });
});
