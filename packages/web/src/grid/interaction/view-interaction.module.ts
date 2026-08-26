import {
  createGridEventTargeting,
  type GridEventTarget,
} from "./event.targeting";
import {
  createViewInteractionRegistry,
  type ViewInteractionEventType,
} from "./view-event-registry";

export type ViewGridEventTarget = GridEventTarget<ViewInteractionEventType>;

type ViewInteractionRegistryHandle = ReturnType<
  typeof createViewInteractionRegistry
>;

/**
 * Pairs a view's registry with the targeting helpers that resolve against it,
 * so the two can never drift apart: the `targetSelector` is derived from the
 * very attributes the registry writes, and the targeting closure is bound to
 * the registry instance the event cards register into.
 *
 * Not exported. See `VIEW_INTERACTION_MODULES` for why.
 */
const buildViewInteractionModule = (view: ViewInteractionRegistryHandle) => {
  const targetSelector = `[${view.idAttribute}][${view.typeAttribute}]`;

  return {
    ...view,
    targetSelector,
    targeting: createGridEventTargeting<ViewInteractionEventType>({
      registry: view.registry,
      targetSelector,
    }),
  };
};

/**
 * The one implementation of per-view interaction wiring. Day and Week each get
 * exactly one module, built once at module scope and frozen.
 *
 * Two invariants are load-bearing and deliberately enforced by shape rather
 * than by convention:
 *
 * 1. **Exactly two registry instances exist for the lifetime of the process.**
 *    Event cards register their DOM nodes into `registry`, and targeting,
 *    focus restore and the keyboard shortcut owners resolve out of it. A third
 *    instance would type-check and pass unit tests in isolation while silently
 *    breaking focus and keyboard targeting at runtime, because registrations
 *    would land in one instance and lookups in another. There is therefore no
 *    exported function that builds a module — `buildViewInteractionModule` is
 *    private and is called exactly twice, right here.
 *
 * 2. **The `viewName` literals are part of the public DOM contract.** They
 *    produce `data-week-interaction-event-{id,type}` and
 *    `data-day-interaction-event-{id,type}`, which Playwright specs under
 *    `e2e/` match on and which `bun test:web` does not cover. The two calls
 *    below are written with literal arguments, never a variable, so the
 *    attribute names stay greppable from source.
 *
 * `createRegistry` (re-exported per view as `createWeekEventRegistry` /
 * `createDayEventRegistry`) does mint fresh, isolated registries — that is its
 * purpose, and tests use it to get a registry that is not the shared one. It
 * does not affect invariant 1: it returns a bare registry, never a module, and
 * nothing wires it into targeting.
 */
export const VIEW_INTERACTION_MODULES = Object.freeze({
  day: buildViewInteractionModule(createViewInteractionRegistry("day")),
  week: buildViewInteractionModule(createViewInteractionRegistry("week")),
});

export type ViewInteractionModule =
  (typeof VIEW_INTERACTION_MODULES)[keyof typeof VIEW_INTERACTION_MODULES];
