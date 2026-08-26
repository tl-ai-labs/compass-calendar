import { createViewInteractionBindings } from "@web/grid/interaction/view-interaction.bindings";

/**
 * The ONLY `createViewInteractionBindings("week")` call in the repo.
 *
 * Each call builds a fresh registry, so a second one would silently split
 * registration from resolution — cards registering into one map while
 * targeting queries another. The registry and targeting shims under
 * `registry/` and `targeting/` both re-export off this single instance.
 */
export const weekInteractionBindings = createViewInteractionBindings("week");
