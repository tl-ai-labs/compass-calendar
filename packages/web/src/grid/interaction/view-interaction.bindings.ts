import {
  createGridEventTargeting,
  type GridEventTarget,
} from "@web/grid/interaction/event.targeting";
import {
  createViewInteractionRegistry,
  type ViewEventRegistry,
  type ViewInteractionEventType,
  type ViewRegisteredEventTarget,
} from "@web/grid/interaction/view-event-registry";

export type {
  ViewEventRegistry,
  ViewInteractionEventType,
  ViewRegisteredEventTarget,
};

export type ViewGridEventTarget = GridEventTarget<ViewInteractionEventType>;

/**
 * Narrowed on purpose. This factory is the single funnel that produces every
 * `data-${viewName}-interaction-event-*` attribute value rendered on an event
 * card, and those values are matched by
 * `CALENDAR_VIEW_INTERACTION_ID_ATTRIBUTES`, context menus and undo
 * focus-restore. A typo in a `string` argument would compile and then silently
 * render cards no selector can find.
 */
export type CalendarViewName = "day" | "week";

/**
 * Registry + target selector + targeting for one calendar view, in a single
 * call. Day and Week previously repeated this wiring by hand — a
 * `createViewInteractionRegistry` call, a `TARGET_SELECTOR` template literal
 * built from its two attribute names, and a `createGridEventTargeting` call —
 * once each, differing only in the view name.
 *
 * Call this EXACTLY ONCE PER VIEW. Each call builds a fresh `EventRegistry`,
 * so a second call for the same view would type-check cleanly and then
 * silently split registration from resolution: cards would register into one
 * map while targeting queried another. The two call sites are
 * `views/Week/interaction/week-interaction.bindings.ts` and
 * `views/Day/interaction/day-interaction.bindings.ts`.
 */
export const createViewInteractionBindings = (viewName: CalendarViewName) => {
  const registryBindings = createViewInteractionRegistry(viewName);

  const targetSelector = `[${registryBindings.idAttribute}][${registryBindings.typeAttribute}]`;

  const targeting = createGridEventTargeting<ViewInteractionEventType>({
    registry: registryBindings.registry,
    targetSelector,
  });

  return {
    ...registryBindings,
    targetSelector,
    ...targeting,
  };
};

export type ViewInteractionBindings = ReturnType<
  typeof createViewInteractionBindings
>;
