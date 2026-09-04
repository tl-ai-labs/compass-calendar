import { type ViewInteractionRuntime } from "@web/grid/interaction/adapter/view-interaction.adapter.types";
import { createViewTargetResolver } from "@web/grid/interaction/adapter/view-target-resolution";
import { type SmartScrollCache } from "@web/grid/interaction/layout.cache";
import { type ViewRegisteredEventTarget } from "@web/grid/interaction/view-event-registry";
import { dayEventRegistry } from "@web/views/Day/interaction/registry/day-event.registry";
import { weekEventRegistry } from "@web/views/Week/interaction/registry/week-event.registry";
import { createViewEngineAdapter } from "./view-engine-adapter";
import { createViewLayoutScrollState } from "./view-layout-scroll.state";
import { describe, expect, it } from "bun:test";

const weekRuntime = null as unknown as () => ViewInteractionRuntime<
  ViewRegisteredEventTarget<"week">
>;

const smartScrollCache = (initialScrollTop: number): SmartScrollCache => ({
  bottom: 800,
  edgeThresholdPx: 0,
  element: document.createElement("div"),
  initialScrollTop,
  maxScrollTop: 1000,
  speedPx: 10,
  top: 0,
});

describe("createViewLayoutScrollState", () => {
  // The adapters' cancel/commit teardown calls clear(). No integration test
  // can prove that runs - every gesture reseeds both fields in createVisual
  // before anything reads them - so the contract is pinned directly here.
  it("drops the layout and the scroll offset on clear", () => {
    const state = createViewLayoutScrollState<{
      smartScroll?: SmartScrollCache;
    }>();

    state.set({ smartScroll: smartScrollCache(120) });

    expect(state.get()).not.toBeNull();
    expect(state.getScrollTop()).toBe(120);

    state.clear();

    expect(state.get()).toBeNull();
    expect(state.getScrollTop()).toBeNull();
  });

  it("seeds the scroll offset from the layout, and nulls it when absent", () => {
    const state = createViewLayoutScrollState<{
      smartScroll?: SmartScrollCache;
    }>();

    state.set({ smartScroll: smartScrollCache(40) });
    expect(state.getScrollTop()).toBe(40);

    state.set({});
    expect(state.getScrollTop()).toBeNull();
  });
});

describe("shared adapter wiring", () => {
  it("refuses to build a view's target resolver from another view's registry", () => {
    // The registry and the registered target are parameterised by the SAME
    // view tag, so a Week-typed resolver cannot be handed Day's registry.
    // Without this pairing the `registered as TRegistered` cast inside
    // getRegisteredTarget would stamp Day registrations with the Week brand
    // and the mistake would propagate brand-correct all the way to commit.
    createViewTargetResolver<"week">({
      // @ts-expect-error - dayEventRegistry is ViewEventRegistry<"day">
      registry: dayEventRegistry,
      runtime: weekRuntime,
    });

    // The correctly-paired call compiles with no suppression.
    const resolver = createViewTargetResolver<"week">({
      registry: weekEventRegistry,
      runtime: weekRuntime,
    });

    expect(typeof resolver.getInteractionTarget).toBe("function");
  });

  it("throws from commit before running any cleanup", () => {
    // Both views deliberately left their session state intact when the
    // target/visual pair disagreed: the throw came first, cleanup second.
    // The hoist moved that ordering into shared code where no integration
    // test can reach it (the engine always commits a matching pair), so it
    // is pinned here at the seam instead.
    const calls: string[] = [];
    const adapter = createViewEngineAdapter<
      ViewRegisteredEventTarget<"week">,
      { type: "timedDrag" },
      never
    >({
      clearLayoutState: () => calls.push("clearLayoutState"),
      commitDispatch: () => {
        calls.push("commitDispatch");
        throw new Error("Mismatched Week interaction target");
      },
      createVisual: () => null,
      getTarget: () => null,
      onInteractionSettled: () => calls.push("onInteractionSettled"),
      updateVisual: ({ visual }) => ({ draftEvent: null, visual }),
    });

    expect(() =>
      adapter.commit({
        target: null as never,
        visual: { type: "timedDrag" },
      }),
    ).toThrow("Mismatched Week interaction target");

    // The throw must escape before either cleanup hook runs.
    expect(calls).toEqual(["commitDispatch"]);
  });

  it("runs cleanup after a successful commit, in order", () => {
    const calls: string[] = [];
    const adapter = createViewEngineAdapter<
      ViewRegisteredEventTarget<"week">,
      { type: "timedDrag" },
      "ok"
    >({
      clearLayoutState: () => calls.push("clearLayoutState"),
      commitDispatch: () => {
        calls.push("commitDispatch");
        return "ok";
      },
      createVisual: () => null,
      getTarget: () => null,
      onInteractionSettled: () => calls.push("onInteractionSettled"),
      updateVisual: ({ visual }) => ({ draftEvent: null, visual }),
    });

    const result = adapter.commit({
      target: null as never,
      visual: { type: "timedDrag" },
    });

    expect(result).toBe("ok");
    expect(calls).toEqual([
      "commitDispatch",
      "clearLayoutState",
      "onInteractionSettled",
    ]);
  });
});
