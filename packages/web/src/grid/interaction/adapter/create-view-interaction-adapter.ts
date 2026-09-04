import { type InteractionAdapter } from "@web/interaction/interaction.adapter.types";
import {
  createInteractionEngine,
  type InteractionEngine,
  type InteractionEngineSchedulerOptions,
} from "@web/interaction/interaction.engine";
import {
  type ViewEventRegistry,
  type ViewRegisteredEventTarget,
} from "../view-event-registry";
import {
  type ViewInteractionAdapter,
  type ViewInteractionCommitResult,
  type ViewInteractionRuntime,
  type ViewInteractionTarget,
} from "./view-interaction.adapter.types";
import { createViewPointerSession } from "./view-pointer-session";
import { createViewTargetResolver } from "./view-target-resolution";

/**
 * Composition root for a view's interaction adapter.
 *
 * The three pieces below have to be built in this order, and the order is the
 * reason this lives in one place: the target resolver is needed to build the
 * engine adapter, the engine adapter is needed to build the engine, and the
 * engine is needed to build the pointer session. Both views previously spelled
 * that sequence out identically.
 *
 * `buildEngineAdapter` is a callback rather than a value because the view's
 * `createVisual` / `updateVisual` (Band C — genuinely divergent, never merged)
 * need the resolver that is created here. The view receives `getTarget` and
 * returns its own fully-formed engine adapter.
 */

export interface ViewInteractionAdapterInput<TView extends string, TVisual> {
  buildEngineAdapter: (input: {
    getTarget: (
      event: PointerEvent,
    ) => ViewInteractionTarget<ViewRegisteredEventTarget<TView>> | null;
  }) => InteractionAdapter<
    ViewInteractionTarget<ViewRegisteredEventTarget<TView>>,
    TVisual,
    ViewInteractionCommitResult
  >;
  engineOptions?: InteractionEngineSchedulerOptions;
  /** e.g. "ineligible-week-pointer" */
  ineligibleReason: string;
  /** e.g. "no-week-interaction-target" */
  noTargetReason: string;
  onClickHandled?: () => void;
  onPointerDownOwned?: () => void;
  /**
   * Brand-paired with `TView`, so this cannot be another view's registry —
   * see the note on `createViewTargetResolver`.
   */
  registry: ViewEventRegistry<TView>;
  runtime: () => ViewInteractionRuntime<ViewRegisteredEventTarget<TView>>;
}

export const createViewInteractionAdapter = <TView extends string, TVisual>({
  buildEngineAdapter,
  engineOptions,
  ineligibleReason,
  noTargetReason,
  onClickHandled,
  onPointerDownOwned,
  registry,
  runtime,
}: ViewInteractionAdapterInput<TView, TVisual>): ViewInteractionAdapter & {
  engine: InteractionEngine<
    ViewInteractionTarget<ViewRegisteredEventTarget<TView>>,
    TVisual,
    ViewInteractionCommitResult
  >;
} => {
  const { getInteractionTarget } = createViewTargetResolver<TView>({
    registry,
    runtime,
  });

  const engine: InteractionEngine<
    ViewInteractionTarget<ViewRegisteredEventTarget<TView>>,
    TVisual,
    ViewInteractionCommitResult
  > = createInteractionEngine({
    adapter: buildEngineAdapter({ getTarget: getInteractionTarget }),
    ...engineOptions,
  });

  const pointerSession = createViewPointerSession<
    ViewRegisteredEventTarget<TView>,
    TVisual
  >({
    engine,
    getInteractionTarget,
    ineligibleReason,
    noTargetReason,
    onClickHandled,
    onPointerDownOwned,
    runtime,
  });

  // The engine is handed back because Week needs it for
  // `rebuildLayoutAfterNavigation` (getSession / rebindPreparedSource). Day
  // ignores it.
  return { ...pointerSession, engine };
};
