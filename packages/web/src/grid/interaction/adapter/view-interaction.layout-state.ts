import { applySmartScroll as applySmartScrollFrame } from "@web/grid/interaction/adapter.helpers";
import { type GridLayoutCache } from "@web/grid/interaction/layout.cache";
import { type VisualPoint } from "@web/grid/interaction/types/timed-drag.types";

/**
 * The layout cache and scroll position for one in-flight interaction.
 *
 * This module is the single owner of the only mutable state in the adapter
 * stack that can break `updateVisual` idempotence. The engine re-invokes
 * `updateVisual` at pointerup with the same pointer to recompute the visual
 * before commit (see `interaction.adapter.types.ts:37-38`), so anything that
 * *accumulates* across invocations would make the second call return something
 * different from the first.
 *
 * `scrollTop` is exactly such a value, and it is safe only because
 * `applySmartScroll` recomputes it from the live scroll container each frame
 * rather than adding a delta to the previous value: calling it twice with the
 * same pointer produces the same `scrollDeltaPx` both times. Any change here
 * that turns `scrollTop` into a running total silently breaks the engine
 * contract, and the double-invocation assertions are what would catch it.
 */
export const createViewInteractionLayoutState = () => {
  let layout: GridLayoutCache | null = null;
  let scrollTop: number | null = null;

  return {
    applySmartScroll: (pointer: VisualPoint) => {
      const result = applySmartScrollFrame({ layout, pointer, scrollTop });
      scrollTop = result.scrollTop;
      return {
        isScrolling: result.isScrolling,
        scrollDeltaPx: result.scrollDeltaPx,
      };
    },
    clear: () => {
      layout = null;
      scrollTop = null;
    },
    getLayout: () => layout,
    getScrollTop: () => scrollTop,
    setLayout: (nextLayout: GridLayoutCache) => {
      layout = nextLayout;
      scrollTop = nextLayout.smartScroll?.initialScrollTop ?? null;
    },
  };
};

export type ViewInteractionLayoutState = ReturnType<
  typeof createViewInteractionLayoutState
>;
