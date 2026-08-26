import { createViewInteractionBindings } from "@web/grid/interaction/view-interaction.bindings";

/**
 * The ONLY `createViewInteractionBindings("day")` call in the repo.
 * See `week-interaction.bindings.ts` for why exactly one call per view.
 */
export const dayInteractionBindings = createViewInteractionBindings("day");
