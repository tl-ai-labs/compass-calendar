import { type GridLayoutCache } from "@web/grid/interaction/layout.cache";
import { INTERACTION_EDGE_THRESHOLD_PX } from "@web/interaction/interaction.constants";
import { createViewInteractionLayoutState } from "./view-interaction.layout-state";
import { describe, expect, it } from "bun:test";

/**
 * `scrollTop` is the only accumulating state in the adapter stack, which makes
 * it the only place `updateVisual` idempotence can break. The engine re-invokes
 * `updateVisual` at pointerup with the same pointer
 * (`interaction.adapter.types.ts:37-38`), so a `scrollDeltaPx` that grew on
 * each call would move the event again at commit.
 *
 * These assertions are written to FAIL if `applySmartScroll` is rewritten to
 * add to the previous delta instead of recomputing from the live container.
 * That is a stronger claim than "two calls return the same value", which any
 * implementation satisfies while the pointer sits outside the scroll zone.
 */

const SCROLL_TOP = 200;
const SCROLL_BOTTOM = 1200;

// Deliberately mid-band: far from both scroll zones, so no auto-scroll frame
// is generated and the assertions isolate the delta ARITHMETIC from the
// stepping behaviour.
const DEAD_BAND_POINTER = { x: 0, y: (SCROLL_TOP + SCROLL_BOTTOM) / 2 };

const createLayout = (element: HTMLElement, initialScrollTop = 0) =>
  ({
    smartScroll: {
      bottom: SCROLL_BOTTOM,
      edgeThresholdPx: INTERACTION_EDGE_THRESHOLD_PX,
      element,
      initialScrollTop,
      maxScrollTop: 1000,
      speedPx: 10,
      top: SCROLL_TOP,
    },
  }) as unknown as GridLayoutCache;

const createScrollElement = () => {
  const element = document.createElement("div");
  element.scrollTop = 0;
  return element;
};

describe("createViewInteractionLayoutState smart-scroll delta", () => {
  it("reports the delta absolutely, so repeated identical calls do not compound", () => {
    const element = createScrollElement();
    const state = createViewInteractionLayoutState();

    state.setLayout(createLayout(element));

    // A scroll the adapter did not cause — e.g. the user's wheel.
    element.scrollTop = 40;

    const first = state.applySmartScroll(DEAD_BAND_POINTER);
    const second = state.applySmartScroll(DEAD_BAND_POINTER);

    // An accumulating implementation returns 40 then 80.
    expect(first.scrollDeltaPx).toBe(40);
    expect(second.scrollDeltaPx).toBe(40);
  });

  it("follows the container back down when it scrolls the other way", () => {
    const element = createScrollElement();
    const state = createViewInteractionLayoutState();

    state.setLayout(createLayout(element));

    element.scrollTop = 40;
    state.applySmartScroll(DEAD_BAND_POINTER);
    element.scrollTop = 0;

    // An accumulating implementation cannot return to zero.
    expect(state.applySmartScroll(DEAD_BAND_POINTER).scrollDeltaPx).toBe(0);
  });

  it("measures the delta from the layout's initial scrollTop, not from zero", () => {
    const element = createScrollElement();
    const state = createViewInteractionLayoutState();

    state.setLayout(createLayout(element, 100));
    element.scrollTop = 160;

    expect(state.applySmartScroll(DEAD_BAND_POINTER).scrollDeltaPx).toBe(60);
  });

  it("does not scroll while no layout is set", () => {
    const state = createViewInteractionLayoutState();

    expect(state.applySmartScroll(DEAD_BAND_POINTER)).toEqual({
      isScrolling: false,
      scrollDeltaPx: 0,
    });
  });
});

describe("createViewInteractionLayoutState lifecycle", () => {
  it("reseeds scrollTop from each new layout", () => {
    const element = createScrollElement();
    const state = createViewInteractionLayoutState();

    state.setLayout(createLayout(element, 100));

    expect(state.getScrollTop()).toBe(100);

    state.setLayout(createLayout(element, 250));

    expect(state.getScrollTop()).toBe(250);
  });

  it("nulls both layout and scrollTop on clear", () => {
    const element = createScrollElement();
    const state = createViewInteractionLayoutState();

    state.setLayout(createLayout(element, 100));
    state.clear();

    expect(state.getLayout()).toBeNull();
    expect(state.getScrollTop()).toBeNull();
  });
});
