import { applySmartScroll as applySmartScrollFrame } from "../adapter.helpers";
import { type SmartScrollCache } from "../layout.cache";
import { type VisualPoint } from "../types/timed-drag.types";

/**
 * The layout cache and smart-scroll offset an interaction holds for the
 * duration of one gesture.
 *
 * Both views kept an identical pair of closed-over `layout` / `scrollTop`
 * locals, seeded the scroll offset from the layout's own
 * `smartScroll.initialScrollTop`, and ran a byte-identical `applySmartScroll`
 * wrapper. That pair is here, once.
 *
 * What is deliberately NOT here: Week's edge-navigation reset and its
 * layout-rebuild-pending flag. Those are Week-only, and keeping them out means
 * this module never needs to name Week's edge-navigation store — which is what
 * structurally guarantees the shared layer adds no writer to it.
 */

type SmartScrollableLayout = { smartScroll?: SmartScrollCache };

export const createViewLayoutScrollState = <
  TLayout extends SmartScrollableLayout,
>() => {
  let layout: TLayout | null = null;
  let scrollTop: number | null = null;

  return {
    /**
     * Clears both. Week additionally resets edge navigation and its rebuild
     * flag around this call; Day has neither.
     */
    clear: () => {
      layout = null;
      scrollTop = null;
    },
    get: () => layout,
    getScrollTop: () => scrollTop,
    /** Seeds the scroll offset from the new layout, as both views always did. */
    set: (nextLayout: TLayout) => {
      layout = nextLayout;
      scrollTop = nextLayout.smartScroll?.initialScrollTop ?? null;
    },
    applySmartScroll: (pointer: VisualPoint) => {
      const result = applySmartScrollFrame({ layout, pointer, scrollTop });
      scrollTop = result.scrollTop;

      return {
        isScrolling: result.isScrolling,
        scrollDeltaPx: result.scrollDeltaPx,
      };
    },
  };
};
