# Change Plan — refactor — Unify Week/Day interaction layers

**Run:** `20260826-082906-refactor-week-day-interaction`
**Intent:** `refactor` · delta plan, not a greenfield design
**Base:** branch `CMP-104/opus-plus-sonnet`, HEAD `2d81253ab8a4c8e69b27e28d12c6ae9cc61d1bfe`
*(corrected by orchestrator: the architect's draft named `CMP-104/flash-agsdk-only`, which is a
different, superseded branch. Verified via `git rev-parse --abbrev-ref HEAD`.)*
**Binding rulings:** `requirements.md` §5.1 (reduced commit scope, per-view mappers retained),
§5.2 (option A, coordinators via type-annotation-and-import edits only), §5.3 (tier — no plan impact)

Every path below is inside `.sdlc/local/write-contract.json` `allowlist`. Files in the four in-scope
trees that are not listed are **UNCHANGED**; this plan does not enumerate the full 26+13 file
inventory, only the delta.

---

## 0. Findings that contradict the requirements

Surfaced rather than worked around. F1 and F2 need a Gate ruling before Phase 7; F3–F6 are
corrections for the record.

### F1 — BLOCKING. AC-1's file count and AC-5's "no test deleted" contradict §1.3's test collapse.

`requirements.md` §1.3 requires the two 92-line targeting test files to "collapse to one
table-driven test covering both views". AC-1 requires `bun test:web` to report
**2298 passing / 0 failing / 302 files**. AC-5 requires that no test be "weakened, skipped, or
deleted".

Two files becoming one file makes the suite report **301 files**, not 302. AC-1 fails on a
successful execution of §1.3. AC-5's literal wording also forbids removing
`week-event.targeting.test.ts` and `day-event.targeting.test.ts` at all.

Test *count* is preserved: 4 `it()` per view × 2 views = 8 today, and 8 as
`describe.each([week, day])` cases after. Assertions are carried over verbatim.

**Requested amendment.** AC-1 → `2298 passing / 0 failing / 301 files`. AC-5 → "no assertion
weakened, skipped, deleted, or re-asserted; file-level consolidation permitted only where every
assertion survives as a table case with identical expectations." If the amendment is refused,
**stage S2 is dropped** and both targeting test files stay as-is; the rest of the plan is
unaffected, and AC-7 still passes (§9).

> **RULING (Gate 2): AMENDMENT GRANTED — option A. S2 stays in.**
> AC-1 is now `2298 passing / 0 failing / **301 files**`; AC-5 is restated at assertion level.
> Reason recorded: the criteria predated knowledge of the file merge, and **no assertion is lost**.
> **The 8-cases-before / 8-cases-after invariant is now load-bearing (AC-5a):** if the collapse
> would drop or alter any assertion, **STOP and bubble up** rather than proceeding. The pass count
> 2298 is the real invariant; the file count is bookkeeping.

### F2 — Interpretation ruling needed. "The shared interaction layer" is ambiguous, and one reading is impossible.

AC-6 and §5.2 require the unified `InteractionCommitResult` to land "in the shared interaction
layer". `intent_brief.md` names two different things "shared": `packages/web/src/interaction/`
(the "shared engine") and `packages/web/src/grid/interaction/` (the "shared grid substrate").

`InteractionCommitResult` has a `event: GridEvent` field. `packages/web/src/interaction/` is
deliberately view- and grid-agnostic — `interaction.adapter.types.ts` imports exactly one thing
(`./interaction.types`) and the engine is generic over `<TTarget, TVisual, TResult>` precisely so
it never learns what an event is. Putting a `GridEvent`-shaped type there couples the generic
engine to `@web/common/types/web.event.types` and contradicts §2.3 ("rewriting the shared engine's
public contract" is a non-goal).

**This plan lands it at `packages/web/src/grid/interaction/commit/commit-result.ts`** — shared by
both views, adjacent to the existing shared `commit/timed-moved.ts` and `commit/cross-row.commit.ts`
it already sits beside. AC-6's words are satisfied on the grid-substrate reading. Flagging because
the alternative reading is defensible and the choice is not reversible cheaply once eight commit
sites import it.

> ### ADR-1 — `InteractionCommitResult` lives in `grid/interaction/commit/`, not `interaction/`
>
> **Status:** Accepted at Gate 2 (2026-08-26). **Supersedes:** nothing. **Do not relitigate.**
>
> **Context.** AC-6 requires the unified commit-result type to land "in the shared interaction
> layer". The brief uses "shared" for two different directories:
> `packages/web/src/interaction/` (the generic engine) and `packages/web/src/grid/interaction/`
> (the grid substrate). Only one of them can host this type.
>
> **Decision.** `packages/web/src/grid/interaction/commit/commit-result.ts`.
>
> **Rationale — the deciding factor.** `packages/web/src/interaction/` is generic over
> `<TTarget, TVisual, TResult>` *precisely so that it never learns what an event is*.
> `interaction.adapter.types.ts` imports exactly one module (`./interaction.types`); the engine
> is event-agnostic by construction. `InteractionCommitResult` carries an `event: GridEvent`
> field, so placing it in `interaction/` would couple the generic engine to
> `@web/common/types/web.event.types` — and "rewriting the shared engine's public contract" is an
> explicit non-goal (`intent_brief.md` §Non-goals). The grid substrate, by contrast, is already
> `GridEvent`-aware: `commit/cross-row.commit.ts` and `commit/timed-moved.ts` sit in exactly this
> directory and already import that type.
>
> **Consequences.** Both views import the unified type from the grid substrate. The generic engine
> stays event-agnostic and is not modified by this run. Reversing this decision after S5 means
> rewriting eight commit sites plus both coordinators, which is why it was settled at Gate 2
> rather than left to codegen.

### F3 — §1.1 undercounts. The registry files re-export **nine** members, not eight.

`WEEK_INTERACTION_EVENT_ID_ATTRIBUTE`, `WEEK_INTERACTION_EVENT_TYPE_ATTRIBUTE`,
`WeekInteractionEventType`, `WeekRegisteredEventTarget`, `WeekEventRegistry`,
`getWeekInteractionTargetAttributes`, `createWeekEventRegistry`, `weekEventRegistry`,
`useWeekEventRegistrationRef`. Immaterial to the work; corrected so the shim's export list is
audited against the right number.

### F4 — §1.1/§1.2 mis-frame registry and targeting. There is no second implementation to collapse.

Both concerns are **already** on one shared parameterized factory at HEAD:
`createViewInteractionRegistry(viewName)` in `grid/interaction/view-event-registry.ts` and
`createGridEventTargeting<TType>()` in `grid/interaction/event.targeting.ts`. `week-event.registry.ts`
and `day-event.registry.ts` contain zero logic — they are a `const week = createViewInteractionRegistry("week")`
call plus a prefixed re-export block. `week-event.targeting.ts` / `day-event.targeting.ts` contain
one duplicated expression each: the `TARGET_SELECTOR` template and the `createGridEventTargeting`
call.

**AC-4's "one implementation" is already true for registry and targeting at HEAD.** What is
genuinely duplicated is the *binding boilerplate* — 59 lines per view. The achievable win is one
shared **binding factory** (`createViewInteractionBindings`) that emits registry + selector +
targeting together, dropping each view to ~14 lines of prefixed re-export. That is what this plan
does. It is a real ~45-line-per-view reduction, but it is not "collapsing two implementations into
one", and the plan should not be reviewed as if it were.

### F5 — The brief's "individual files" list points at the wrong files.

`intent_brief.md` lists nine call-site files "(import/type updates only)". Under this plan
**all nine need zero edits**, and so do all five listed test files (§5 proves this file by file).
The two files that actually take annotation edits — `WeekInteractionCoordinator.tsx` and
`DayInteractionCoordinator.tsx` — are not on that list; they are covered by the
`packages/web/src/views/*/interaction/**` tree globs. The allowlist is correct; the brief's
framing of where the churn lands is not.

### F6 — PB-9 is accurate but incomplete in a way that invites a silent regression.

PB-9 records that Week reads `WEEK_EDGE_NAVIGATION_THRESHOLD_PX` and Day reads
`INTERACTION_EDGE_THRESHOLD_PX`. It omits that Week builds **one** options object
(`weekLayoutCacheOptions`) used for *both* rows, so Week's all-day row also receives
`edgeThresholdPx: WEEK_EDGE_NAVIGATION_THRESHOLD_PX` (50) and a `smartScroll` block that
`buildAllDayGridLayoutCache` silently discards — whereas `buildDayAllDayLayoutCache` hard-codes
`edgeThresholdPx: 0` and omits `smartScroll` and `mainGridElementId` entirely. A "converge the two
layout-cache builders" move would give Week's all-day row `0` or Day's all-day row `50`. **The two
option objects stay separate.** §1.6 geometry work is limited to deleting type aliases (§4, S4).

---

## 1. Target module layout

### 1.1 `packages/web/src/interaction/**` — no change

| Path | Verdict |
|---|---|
| `interaction/interaction.adapter.types.ts` | **UNCHANGED** — `InteractionAdapter<TTarget, TVisual, TResult>` stays generic and `GridEvent`-free (F2) |
| `interaction/interaction.engine.ts` | **UNCHANGED** — §2.3 non-goal |
| `interaction/interaction.types.ts` | **UNCHANGED** |
| `interaction/interaction.constants.ts` | **UNCHANGED** — `INTERACTION_EDGE_THRESHOLD_PX` keeps its value; PB-5/PB-9 |

### 1.2 `packages/web/src/grid/interaction/**` — three additions, one addition in S2

| Path | Verdict | Contents |
|---|---|---|
| `grid/interaction/view-interaction.bindings.ts` | **NEW** | `createViewInteractionBindings(viewName)` — registry + `targetSelector` + targeting in one call |
| `grid/interaction/view-adapter.types.ts` | **NEW** | generic target / visual / runtime / options / adapter contract (§2.3) |
| `grid/interaction/commit/commit-result.ts` | **NEW** | `InteractionCommitResult` union, the four per-type aliases, `buildInteractionCommitResult`, `commitWithMapper`, `InteractionCommitMapper` (§2.4) |
| `grid/interaction/view-interaction.bindings.test.ts` | **NEW** (S2) | table-driven targeting test over `week` + `day` |
| `grid/interaction/view-event-registry.ts` | **UNCHANGED** | `viewInteractionAttributeNames`, `CALENDAR_VIEW_INTERACTION_ID_ATTRIBUTES` untouched — PB-10 |
| `grid/interaction/event.targeting.ts` | **UNCHANGED** | |
| `grid/interaction/layout.cache.ts` | **UNCHANGED** | |
| `grid/interaction/adapter.helpers.ts` | **UNCHANGED** | |
| `grid/interaction/commit/timed-moved.ts` | **UNCHANGED** | `hasTimedDragVisualMoved`, `hasTimedResizeVisualMoved` |
| `grid/interaction/commit/cross-row.commit.ts` | **UNCHANGED** | Week-only consumer; PB-4 |

### 1.3 `packages/web/src/views/Week/interaction/**`

| Path | Verdict | Note |
|---|---|---|
| `week-interaction.bindings.ts` | **NEW** | `export const weekInteractionBindings = createViewInteractionBindings("week");` — the **only** call site for `"week"` |
| `registry/week-event.registry.ts` | **MODIFIED** | shim: nine prefixed re-exports off `weekInteractionBindings`. Path and export names unchanged |
| `targeting/week-event.targeting.ts` | **MODIFIED** | shim: `WeekGridEventTargetType`, `WeekGridEventTarget`, four `*WeekGridEventTarget*` fns off `weekInteractionBindings`. Path and export names unchanged |
| `targeting/week-event.targeting.test.ts` | **DELETED** (S2) | assertions carried into `grid/interaction/view-interaction.bindings.test.ts` |
| `adapter/week-interaction.adapter.types.ts` | **MODIFIED** | 149 → ~58; keeps `WeekInteractionRuntime`, `WeekInteractionAdapterOptions`, `WeekInteractionAdapter`; everything else becomes a one-line alias of a `view-adapter.types.ts` member |
| `adapter/geometry/week-layout.cache.ts` | **MODIFIED** | drop `WeekLayoutCacheSources`, `WeekLayoutCache`, `export type { SmartScrollCache }`, `export { getNearestDayColumn }`. `WeekLayoutCacheInput` and all three builders unchanged (PB-9) |
| `adapter/commit/all-day.commit.ts` | **MODIFIED** | gains `commitAllDayDragInteraction` + `commitAllDayResizeInteraction` (moved in from `interactions/`); keeps `allDayDragVisualToGridEvent`, `hasAllDayDragVisualMoved`, `allDayResizeVisualToGridEvent`, `hasAllDayResizeVisualChanged`, module-private `getExclusiveEndDateBaseline` |
| `adapter/commit/timed.commit.ts` | **MODIFIED** | gains `commitTimedDragInteraction` + `commitTimedResizeInteraction`; keeps `timedDragVisualToGridEvent`, `timedResizeVisualToGridEvent` and the `timed-moved` re-export |
| `adapter/visuals/all-day.drag.ts` | **MOVED** (`adapter/interactions/all-day.drag.ts` → here) | `createAllDayDragInteractionVisual`, `updateAllDayDragInteractionVisual` only |
| `adapter/visuals/all-day.resize.ts` | **MOVED** (`adapter/interactions/all-day.resize.ts` → here) | `createAllDayResizeInteractionVisual`, `updateAllDayResizeInteractionVisual` only |
| `adapter/visuals/timed.drag.ts` | **MOVED** (`adapter/interactions/timed.drag.ts` → here) | `createTimedDragInteractionVisual`, `updateTimedDragInteractionVisual` only |
| `adapter/visuals/timed.resize.ts` | **MOVED** (`adapter/interactions/timed.resize.ts` → here) | `createTimedResizeInteractionVisual`, `updateTimedResizeInteractionVisual` only |
| `adapter/visuals/all-day.visible-range.ts` | **MOVED** (`adapter/interactions/all-day.visible-range.ts` → here) | `getVisibleAllDayRange` byte-identical; relative import `./all-day.visible-range` unchanged |
| `adapter/interactions/` | **DELETED** (directory) | after the five moves |
| `adapter/week-interaction.adapter.ts` | **MODIFIED** | import paths only: `./interactions/*` → `./commit/*` and `./visuals/*`; `getNearestDayColumn` → `@web/grid/interaction/layout.cache`. No body change |
| `WeekInteractionCoordinator.tsx` | **MODIFIED** | §7 — imports + one annotation, zero logic |
| `useWeekInteractionLayoutSync.ts` | **UNCHANGED** | its structural `RebuildableAdapter` keeps working (§2.5) |
| `edge-navigation.ts`, `state/edge-navigation.state.ts`, `state/motion.state.ts` | **UNCHANGED** | PB-5 |

### 1.4 `packages/web/src/views/Day/interaction/**`

| Path | Verdict | Note |
|---|---|---|
| `day-interaction.bindings.ts` | **NEW** | `export const dayInteractionBindings = createViewInteractionBindings("day");` — the **only** call site for `"day"` |
| `registry/day-event.registry.ts` | **MODIFIED** | shim, nine prefixed re-exports. Path and export names unchanged |
| `targeting/day-event.targeting.ts` | **MODIFIED** | shim. Path and export names unchanged |
| `targeting/day-event.targeting.test.ts` | **DELETED** (S2) | |
| `adapter/day-interaction.adapter.types.ts` | **MODIFIED** | 149 → ~58; keeps `DayInteractionAdapterOptions` (with `getColumnKeys`/`getVisibleDate`); the rest becomes aliases |
| `adapter/geometry/day-layout.cache.ts` | **MODIFIED** | drop `DayLayoutCache`, `DayLayoutCacheSources`. `buildDayTimedLayoutCache` / `buildDayAllDayLayoutCache` / `buildDayLayoutCacheForTarget` / `isDayDragTarget` bodies unchanged (PB-9, F6) |
| `adapter/commit/all-day.commit.ts` | **MODIFIED** | four commit bodies rewritten onto `commitWithMapper`; `allDayVisualToDayGridEvent` and the `columnMoveCalendarId` import unchanged |
| `adapter/commit/timed.commit.ts` | **MODIFIED** | same; `timedDragVisualToDayGridEvent`, `timedResizeVisualToDayGridEvent`, `columnMoveCalendarId` unchanged |
| `adapter/day-interaction.adapter.ts` | **UNCHANGED** | its imports (`./commit/all-day.commit`, `./commit/timed.commit`, `./day-interaction.adapter.types`) and all four commit call signatures survive |
| `DayInteractionCoordinator.tsx` | **MODIFIED** | §7 — imports + one annotation, zero logic |

### 1.5 Files removed

Three, all in S2/S5, all replaced in place:
`views/Week/interaction/targeting/week-event.targeting.test.ts`,
`views/Day/interaction/targeting/day-event.targeting.test.ts`,
`views/Week/interaction/adapter/interactions/` (directory, five files, all moved not dropped).

---

## 2. The unified contracts

### 2.1 Shared binding factory — `grid/interaction/view-interaction.bindings.ts`

```ts
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

export interface ViewInteractionBindings {
  createRegistry: () => ViewEventRegistry;
  focusGridEventTarget: (target: GridEventTarget<ViewInteractionEventType>) => void;
  getFirstVisibleGridEventTarget: (root?: ParentNode) => GridEventTarget<ViewInteractionEventType> | null;
  getFocusedGridEventTarget: () => GridEventTarget<ViewInteractionEventType> | null;
  getInteractionTargetAttributes: (input: {
    eventId: string | undefined;
    eventType: ViewInteractionEventType;
  }) => Record<string, string>;
  idAttribute: string;
  listVisibleGridEventTargets: (root?: ParentNode) => GridEventTarget<ViewInteractionEventType>[];
  registry: ViewEventRegistry;
  targetSelector: string;
  typeAttribute: string;
  useRegistrationRef: (input: {
    eventId: string | undefined;
    eventType: ViewInteractionEventType;
    isEnabled: boolean;
  }) => (node: HTMLElement | null) => void;
}

/**
 * One registry + one targeting facade per calendar view, in one call. MUST be
 * invoked exactly once per viewName, from that view's `*-interaction.bindings.ts`
 * — a second call builds a second EventRegistry and silently splits
 * registration from resolution.
 */
export const createViewInteractionBindings = (
  viewName: string,
): ViewInteractionBindings => {
  const view = createViewInteractionRegistry(viewName);
  const targetSelector = `[${view.idAttribute}][${view.typeAttribute}]`;
  const targeting = createGridEventTargeting<ViewInteractionEventType>({
    registry: view.registry,
    targetSelector,
  });

  return { ...view, ...targeting, targetSelector };
};
```

`viewName` is the **only** parameter, and it flows unchanged into the existing
`viewInteractionAttributeNames(viewName)`. PB-10 is preserved by construction: the attribute
strings are still `data-week-interaction-event-id` / `data-day-interaction-event-type` etc.,
computed by the same untouched function from the same two literals.

Per-view instantiation — one file each, and the **only** two call sites:

```ts
// views/Week/interaction/week-interaction.bindings.ts
export const weekInteractionBindings = createViewInteractionBindings("week");
// views/Day/interaction/day-interaction.bindings.ts
export const dayInteractionBindings = createViewInteractionBindings("day");
```

The existing `registry/*-event.registry.ts` and `targeting/*-event.targeting.ts` files stay at
their paths and re-export off the bindings object under the identical `WEEK_`/`DAY_` names. Import
direction is strictly one-way: `registry/* → bindings` and `targeting/* → bindings`. Neither shim
imports the other, so the `targeting → registry` edge that exists today disappears and no cycle
can form.

### 2.2 Shared targeting — no new factory

Per F4, `createGridEventTargeting<TType>()` is already the one shared targeting factory and is
already called by both views. The duplication being removed is the `TARGET_SELECTOR` template and
the call itself, both of which move into `createViewInteractionBindings`. The Biome reformat
difference noted in §1.2 of the requirements disappears because there is now one call site.

### 2.3 Generic adapter contract — `grid/interaction/view-adapter.types.ts`

```ts
export interface ViewInteractionPointerOwnership { reason: string; shouldOwn: boolean; }

export interface ViewResolvedEventTarget {
  event: GridEvent;
  hadFormOpenBeforeInteraction: boolean;
  registered: ViewRegisteredEventTarget;
}
export interface ViewAllDayDragTarget   extends ViewResolvedEventTarget { type: "allDayDrag"; }
export interface ViewAllDayResizeTarget extends ViewResolvedEventTarget { edge: AllDayResizeEdge; type: "allDayResize"; }
export interface ViewTimedDragTarget    extends ViewResolvedEventTarget { type: "timedDrag"; }
export interface ViewTimedResizeTarget  extends ViewResolvedEventTarget { edge: TimedResizeEdge; type: "timedResize"; }

export type ViewInteractionTarget =
  | ViewAllDayDragTarget | ViewAllDayResizeTarget
  | ViewTimedDragTarget  | ViewTimedResizeTarget;

export type ViewInteractionVisual =
  | AllDayDragVisual | AllDayResizeVisual | TimedDragVisual | TimedResizeVisual;

export type ViewEdgeNavigableVisual = AllDayDragVisual | TimedDragVisual;

export interface ViewInteractionRuntime {
  getAllDayEventById?: (eventId: string) => GridEvent | null;
  getTimedEventById(eventId: string): GridEvent | null;
  isFormOpen?: () => boolean;
  onClickAllDayEvent?: (event: GridEvent) => void;
  onClickTimedEvent: (event: GridEvent) => void;
  onCommitAllDayDrag?: (result: AllDayDragCommitResult) => void;
  onCommitAllDayResize?: (result: AllDayResizeCommitResult) => void;
  onCommitTimedDrag: (result: TimedDragCommitResult) => void;
  onCommitTimedResize?: (result: TimedResizeCommitResult) => void;
  onMotionActivation?: (target: ViewInteractionTarget) => void;
}

export interface ViewInteractionAdapterOptions<
  TRuntime extends ViewInteractionRuntime = ViewInteractionRuntime,
  TLayoutSources = GridLayoutCacheSources,
> {
  engineOptions?: InteractionEngineSchedulerOptions;
  getLayoutSources?: () => TLayoutSources;
  runtime?: () => TRuntime;
}

export interface ViewInteractionAdapter {
  cancel(): void;
  connectCancellationEvents(targets?: InteractionCancellationTargets): () => void;
  handlePointerCancel(event: PointerEvent): boolean;
  handlePointerDown(event: PointerEvent): ViewInteractionPointerOwnership;
  handlePointerMove(event: PointerEvent): boolean;
  handlePointerUp(event: PointerEvent): boolean;
  ownsPointer(event: Pick<PointerEvent, "pointerId">): boolean;
}
```

`ViewResolvedEventTarget` is now the base the four target interfaces extend, which is structurally
identical to today's four hand-written interfaces (each already spells out `event`,
`hadFormOpenBeforeInteraction`, `registered` plus a literal `type`). `WeekRegisteredEventTarget`
and `DayRegisteredEventTarget` are both `ViewRegisteredEventTarget` at HEAD, so no view loses
information.

#### The runtime/options asymmetry — how it is reconciled without moving a member

The divergence is not symmetric and must not be made symmetric:

| View-specific member | Lives on (HEAD) | Read at |
|---|---|---|
| `getVisibleDays(): string[]` | Week **runtime** | `week-interaction.adapter.ts:getLayoutInput()`, every frame via `runtime()` |
| `onRequestWeekNavigation?(direction)` | Week **runtime** | `updateEdgeNavigation()`, on dwell |
| `getColumnKeys?(): string[]` | Day **options** | `day-interaction.adapter.ts:createVisual()`, once per gesture |
| `getVisibleDate?(): Dayjs` | Day **options** | `createVisual()` and `commit()`, per gesture |

These are not the same kind of thing. Week's two are *live per-frame reads of React render state*
routed through the mutable `runtimeRef` the coordinator rewrites on every render — moving
`getVisibleDays` to options would freeze it at `useMemo(..., [])` adapter-construction time and
break mid-drag week navigation (PB-5). Day's two are *per-gesture inputs* captured in
`createDayInteractionAdapter`'s `useMemo(..., [dateInView])`; moving them to the runtime would
change when `dateInView` is re-read and re-key the adapter's memo.

**Reconciliation: two extension points, not one.** The generic contract is extensible on *both*
objects, and each view extends exactly the one it uses today. Nothing moves.

```ts
// views/Week/interaction/adapter/week-interaction.adapter.types.ts
export interface WeekInteractionRuntime extends ViewInteractionRuntime {
  getVisibleDays(): string[];
  onRequestWeekNavigation?: (direction: "next" | "prev") => void;
}
export interface WeekInteractionAdapterOptions
  extends ViewInteractionAdapterOptions<WeekInteractionRuntime, WeekLayoutCacheSourcesInput> {}
//   ^ no additional members — Week's extension point is the runtime

// views/Day/interaction/adapter/day-interaction.adapter.types.ts
export type DayInteractionRuntime = ViewInteractionRuntime;
//   ^ no additional members — Day's extension point is the options
export interface DayInteractionAdapterOptions
  extends ViewInteractionAdapterOptions<DayInteractionRuntime, GridLayoutCacheSources> {
  getColumnKeys?: () => string[];
  getVisibleDate?: () => Dayjs;
}
```

`ViewInteractionAdapterOptions` is generic in `TLayoutSources` so Week keeps
`getLayoutSources?: () => GridLayoutCacheSources` while its *builders* keep taking
`WeekLayoutCacheInput` (which the adapter constructs by spreading `getLayoutSources()` and adding
`visibleDays`). That construction (`getLayoutInput()`) is untouched — PB-9.

The doc comments currently sitting on `getVisibleDays` (Week) and `getColumnKeys` (Day) move with
their members; they are the only surviving prose that explains the date-vs-calendar column
semantics at the type level and must not be dropped.

#### Members present on only one view

| Member | Present on | Handling |
|---|---|---|
| `rebuildLayoutAfterNavigation(): void` | Week's adapter only | `export interface WeekInteractionAdapter extends ViewInteractionAdapter { rebuildLayoutAfterNavigation(): void; }`; `export type DayInteractionAdapter = ViewInteractionAdapter;` |
| `WeekEdgeNavigableVisual` | Week only | declared shared as `ViewEdgeNavigableVisual` (its content — `AllDayDragVisual \| TimedDragVisual` — is view-agnostic); Week keeps `export type WeekEdgeNavigableVisual = ViewEdgeNavigableVisual;` so `updateEdgeNavigation<TVisual extends WeekEdgeNavigableVisual>` in the adapter body needs no edit. Day never references it |

**Rule, stated so codegen cannot get it wrong: a member that exists on one view is added by
interface extension on that view's side. It is never added to the shared base as optional.**
Making `rebuildLayoutAfterNavigation?()` optional on `ViewInteractionAdapter` would compile, change
no runtime behavior, and quietly let `useWeekInteractionLayoutSync`'s structural
`RebuildableAdapter` accept a Day adapter — losing the only compile-time guard on PB-5's wiring.

Both view type files additionally keep a one-line alias per shared member so that
`week-interaction.adapter.ts` (795 lines) and `day-interaction.adapter.ts` (607 lines) need **zero
body edits**:

```ts
export type WeekInteractionTarget = ViewInteractionTarget;
export type WeekAllDayDragTarget = ViewAllDayDragTarget;
export type WeekInteractionVisual = ViewInteractionVisual;
export type WeekResolvedEventTarget = ViewResolvedEventTarget;
export type WeekInteractionPointerOwnership = ViewInteractionPointerOwnership;
export type WeekInteractionCommitResult = InteractionCommitResult;
export type WeekAllDayDragCommitResult = AllDayDragCommitResult;   // …and the other three
```

These aliases are the price of not rewriting two large adapter bodies. They are one line each and
have exactly one definition behind them, which satisfies AC-4.

### 2.4 `InteractionCommitResult` and the shared envelope builder — `grid/interaction/commit/commit-result.ts`

```ts
export type InteractionCommitType =
  | "allDayDragEnd" | "allDayResizeEnd" | "timedDragEnd" | "timedResizeEnd";

export interface InteractionCommitResultOf<TType extends InteractionCommitType> {
  event: GridEvent;
  eventId: string;
  hadFormOpenBeforeInteraction: boolean;
  hasMoved: boolean;
  type: TType;
}

export type AllDayDragCommitResult   = InteractionCommitResultOf<"allDayDragEnd">;
export type AllDayResizeCommitResult = InteractionCommitResultOf<"allDayResizeEnd">;
export type TimedDragCommitResult    = InteractionCommitResultOf<"timedDragEnd">;
export type TimedResizeCommitResult  = InteractionCommitResultOf<"timedResizeEnd">;

export type InteractionCommitResult =
  | AllDayDragCommitResult | AllDayResizeCommitResult
  | TimedDragCommitResult  | TimedResizeCommitResult;

/** The minimum a commit target must carry. Both views' four targets satisfy it. */
export interface CommittableInteractionTarget {
  event: GridEvent;
  hadFormOpenBeforeInteraction: boolean;
}

/**
 * The declared per-view extension point (requirements.md §5.1). A Week column is
 * a date and a Day column is a calendar, so `hasMoved` and `toEvent` are and stay
 * view-specific. This builder owns the envelope and NOTHING else: it never
 * defaults `hasMoved`, never decides whether to map, and never inspects or
 * rewrites the mapped event.
 */
export interface InteractionCommitMapper<
  TTarget extends CommittableInteractionTarget,
  TVisual,
> {
  hasMoved: (visual: TVisual, target: TTarget) => boolean;
  toEvent: (target: TTarget, visual: TVisual, hasMoved: boolean) => GridEvent;
}

export const buildInteractionCommitResult = <TType extends InteractionCommitType>({
  event,
  hasMoved,
  target,
  type,
}: {
  event: GridEvent;
  hasMoved: boolean;
  target: CommittableInteractionTarget;
  type: TType;
}): InteractionCommitResultOf<TType> => ({
  event,
  eventId: target.event._id!,
  hadFormOpenBeforeInteraction: target.hadFormOpenBeforeInteraction,
  hasMoved,
  type,
});

export const commitWithMapper = <
  TType extends InteractionCommitType,
  TTarget extends CommittableInteractionTarget,
  TVisual,
>(
  type: TType,
  target: TTarget,
  visual: TVisual,
  mapper: InteractionCommitMapper<TTarget, TVisual>,
): InteractionCommitResultOf<TType> => {
  const hasMoved = mapper.hasMoved(visual, target);

  return buildInteractionCommitResult({
    event: mapper.toEvent(target, visual, hasMoved),
    hasMoved,
    target,
    type,
  });
};
```

`eventId: target.event._id!` is centralised here — PB-6's "every case" claim verified against all
eight sites. `commitWithMapper` is uncurried and takes `target` and `visual` positionally so that
**all eight exported `commit*Interaction` signatures are unchanged**, including Day's third
`visibleDate: Dayjs` parameter, which each Day commit function closes over into its mapper literal.
Neither adapter's `commit()` switch changes.

`toEvent` receives `hasMoved` as its third argument specifically so that Week's "always map" and
Day's "map only when moved" are both one expression, and the builder never has to legislate which
is correct. Week ignores the third argument; Day branches on it.

Per-view usage, showing the retained mappers as the extension point:

```ts
// Week — adapter/commit/timed.commit.ts   (PB-3, PB-4)
export const commitTimedDragInteraction = (
  target: WeekTimedDragTarget, visual: TimedDragVisual,
): TimedDragCommitResult =>
  commitWithMapper("timedDragEnd", target, visual, {
    // A drop in the all-day row is always a change, even onto the same day:
    // the event loses its time of day.
    hasMoved: (v) => v.row === "allDay" || hasTimedDragVisualMoved(v),
    toEvent: (t, v) =>
      v.row === "allDay"
        ? timedDragVisualToAllDayGridEvent(t.event, v)
        : timedDragVisualToGridEvent(t.event, v),
  });

// Day — adapter/commit/timed.commit.ts    (PB-3)
export const commitTimedDragInteraction = (
  target: DayTimedDragTarget, visual: TimedDragVisual, visibleDate: Dayjs,
): TimedDragCommitResult =>
  commitWithMapper("timedDragEnd", target, visual, {
    hasMoved: hasTimedDragVisualMoved,
    toEvent: (t, v, hasMoved) =>
      hasMoved ? timedDragVisualToDayGridEvent(t.event, v, visibleDate) : t.event,
  });
```

The four Week mappers (`allDayDragVisualToGridEvent`, `allDayResizeVisualToGridEvent`,
`timedDragVisualToGridEvent`, `timedResizeVisualToGridEvent`) and the four Day mappers
(`allDayVisualToDayGridEvent`, `timedDragVisualToDayGridEvent`, `timedResizeVisualToDayGridEvent`,
`columnMoveCalendarId`) keep their bodies **byte-identical**. Both `commit/` directories keep their
own copy of the domain rule. That is the §5.1 ruling, restated as code.

### 2.5 Consumer of `rebuildLayoutAfterNavigation` — unchanged

`useWeekInteractionLayoutSync.ts` declares its own local structural interface
(`interface RebuildableAdapter { rebuildLayoutAfterNavigation(): void }`) and never imports
`WeekInteractionAdapter`. Extending `ViewInteractionAdapter` with the method on Week's side keeps
that structural match exact, so this file is untouched.

---

## 3. Ordered work sequence

Six stages. Each is independently type-checkable and each leaves the tree green. Registry and
targeting first (mechanical, no runtime semantics); commit last (the only stage that can change
behavior).

| Stage | Scope | `bun type-check` must prove | Also run |
|---|---|---|---|
| **SC** characterization (DIRECTED at Gate 2) | NEW `views/Week/interaction/adapter/commit-characterization.test.ts` (CT-1, CT-2 Week half) + NEW `views/Day/interaction/adapter/commit-characterization.test.ts` (CT-2 Day half). **Purely additive — no existing file touched** | Both new files compile against the **unmodified** HEAD commit signatures. No production type changes | **The two new files, run green on pristine HEAD.** This is the evidence AC-5b requires. Run and record BEFORE S0 |
| **S0** additive scaffolding | NEW `grid/interaction/view-interaction.bindings.ts`, `view-adapter.types.ts`, `commit/commit-result.ts`. Nothing imports them yet | The three new modules compile standalone; `InteractionCommitResult` discriminates on `type` (assert by a local `satisfies` in the file, not a test); no existing module changed | — |
| **S1** registry + targeting rebind | NEW `week-interaction.bindings.ts`, `day-interaction.bindings.ts`; MODIFIED four shim files | Every existing importer of `week-event.registry`, `day-event.registry`, `week-event.targeting`, `day-event.targeting` still resolves the same nine/six names at the same paths, with the same types. Zero diff outside `views/*/interaction/{registry,targeting}/` + the two new bindings files | `bun test:web` on the two targeting test files + `MainGrid.test.tsx` + `useDayEventNudgeShortcuts.test.tsx` — proves registry **instance identity** survives (register-then-resolve across module boundaries) |
| **S2** targeting test collapse | NEW `grid/interaction/view-interaction.bindings.test.ts`; DELETE the two per-view test files | (no type surface change) | `bun test:web` — 8 targeting cases still run, expectations byte-identical. **File count drops 302 → 301; see F1** |
| **S3** adapter types | MODIFIED both `*-interaction.adapter.types.ts` | Both adapters (795 / 607 lines) and both coordinators compile with **zero body edits**; `WeekInteractionAdapter` still structurally satisfies `RebuildableAdapter`; `DayInteractionAdapter` does **not** have `rebuildLayoutAfterNavigation` | — |
| **S4** geometry alias reduction | MODIFIED both `geometry/*-layout.cache.ts` | No orphaned importer of `WeekLayoutCacheSources`, `WeekLayoutCache`, `SmartScrollCache` (Week re-export), `DayLayoutCache`, `DayLayoutCacheSources`. `WeekLayoutCacheInput` survives with `visibleDays` (PB-9) | — |
| **S5** commit envelope + directory | MOVE five Week files to `adapter/visuals/`; fold four `commit*Interaction` into `adapter/commit/*`; DELETE `adapter/interactions/`; rewrite all eight commit bodies onto `commitWithMapper` | All eight `commit*Interaction` keep their exact parameter lists (Day's keep `visibleDate`); both adapters' `commit()` switches unchanged; `getExclusiveEndDateBaseline` still module-private to Week's `all-day.commit.ts` | **full `bun test:web`** — this is the only stage that can regress behavior |
| **S6** coordinator adoption | MODIFIED both coordinators — imports + one annotation each | Both coordinators consume `InteractionCommitResult`; `git diff` shows only import lines and the `commitSavedMutation` parameter type | full `bun test:web` + `git diff` reviewed against §7 |

S6 is deliberately separate from S5 so AC-6's "zero logic change" claim is auditable as a
standalone diff.

**SC is deliberately first, before S0.** The Gate 2 directive requires the characterization tests
to pass against *unmodified HEAD behavior*. S0–S4 do not touch the commit layer, so running SC any
time before S5 would technically satisfy that — but running it on a pristine tree makes the
evidence unambiguous and removes any argument that an earlier stage shaped the result. If SC
cannot go green on pristine HEAD, the test encodes a wrong belief about current behavior: fix the
test, never the source, and if the belief was right and the source disagrees, **stop and bubble
up** — that would mean HEAD does not behave as R1/R10 claim, which invalidates part of §6.

**SC's assertions become regression guards, not just documentation, from S5 onward.** They must be
re-run green after S5 and again after S6. A green SC after S5 is the single strongest piece of
evidence that PB-4 and R10 survived the commit rewrite.

**Placement note.** Both SC files sit inside `views/*/interaction/**`, which the frozen allowlist
covers by tree glob. No contract change is needed and none was requested. If writing either test
turns out to require a file outside the allowlist, that is a **stop-and-bubble-up** condition per
the Gate 2 directive, not a reason to widen scope.

---

## 4. Per-invariant preservation argument

| # | Invariant | Which planned change touches it | Why it survives |
|---|---|---|---|
| **PB-1** | Week all-day drag shifts `startDate`/`endDate` by a day delta; Day all-day drag rewrites `calendarId` and leaves dates alone | S5 only. Week's `commitAllDayDragInteraction` moves from `adapter/interactions/all-day.drag.ts` into `adapter/commit/all-day.commit.ts` and is rewritten as a `commitWithMapper` call; Day's is rewritten in place | The two mappers are **not** touched. Week's `allDayDragVisualToGridEvent` (with its `dayjs(visual.dayDate).diff(dayjs(visual.initialDayDate), "day")` delta and the comment explaining window clamping) stays in Week's `commit/all-day.commit.ts`. Day's inline `{...target.event, calendarId: columnMoveCalendarId(visual, target.event)}` stays in Day's. `commitWithMapper` receives whichever `toEvent` it is handed and returns it unexamined. There is no code path in which Week's mapper can be reached from Day's commit function or vice versa — they are in different files, in different trees, with no shared import |
| **PB-2** | Week all-day resize applies independent `startDayDelta`/`endDayDelta` over the exclusive-end baseline; Day collapses to one day at `visibleDate` and forces `isAllDay: true` | S5 only | Week: `allDayResizeVisualToGridEvent` and its module-private helper `getExclusiveEndDateBaseline` stay in the same file that gains `commitAllDayResizeInteraction`, so the helper stays module-private and is never a candidate for hoisting. Its internal `if (!hasAllDayResizeVisualChanged(visual)) return event;` short-circuit is inside the mapper, not in the builder. Day: `allDayVisualToDayGridEvent` keeps `isAllDay: true` and the `visibleDate.add(1, "day")` exclusive end; `commitAllDayResizeInteraction` keeps its third `visibleDate` parameter and its `hasMoved ? map : target.event` gate, now expressed as `toEvent: (t, v, hasMoved) => hasMoved ? allDayVisualToDayGridEvent(t.event, visibleDate) : t.event` — note Day's mapper **ignores `visual` entirely**, which is preserved verbatim |
| **PB-3** | Week timed drag treats `visual.dayDate` as the target day (absolute); Day treats it as a `calendarId` via `columnMoveCalendarId`, takes the day from `visibleDate`, sets `isAllDay: false`. Single-column Day fallback resolves to the event's own `calendarId` | S5 (commit bodies) + S3 (`getVisibleDate` stays on Day's options) | `timedDragVisualToGridEvent` (Week) and `timedDragVisualToDayGridEvent` + `columnMoveCalendarId` (Day) are unchanged. The single-column fallback lives in `day-interaction.adapter.ts:createVisual` (`columnKeys = eventColumnIndex >= 0 ? calendarColumnKeys : [visibleDateKey]`), a file this plan does not modify at all; `columnMoveCalendarId`'s `visual.dayDate !== visual.initialDayDate ? dayDate : event.calendarId` is unchanged, so a fallback column whose one key never changes still returns `event.calendarId`. `getVisibleDate` stays on `DayInteractionAdapterOptions` (§2.3), so the `useMemo(..., [dateInView])` keying in `DayInteractionCoordinator` is unchanged |
| **PB-4** | Week-only cross-row drag: timed drop is **always** `hasMoved: true`; all-day drop is **always** `hasMoved: true`; mid-drag ghost nulling | S5. `commitAllDayDragInteraction` / `commitTimedDragInteraction` move file and are rewritten as `commitWithMapper` calls; `updateAllDayDragInteractionVisual` / `updateTimedDragInteractionVisual` move to `adapter/visuals/` unchanged | The forcing rule becomes the mapper's `hasMoved` callback verbatim: `(v) => v.row === "timed" \|\| hasAllDayDragVisualMoved(v)` and `(v) => v.row === "allDay" \|\| hasTimedDragVisualMoved(v)`. `commitWithMapper` has **no default** for `hasMoved` — it is a required member of `InteractionCommitMapper`, so omitting it is a type error, not a silent `false`. The `isCrossRow` selection of `allDayDragVisualToTimedGridEvent` / `timedDragVisualToAllDayGridEvent` moves into `toEvent` with the same condition. Ghost nulling (`nextVisual.row === "timed" ? ... : null` and `nextVisual.row === "allDay" ? null : ...`) is inside the two `update*InteractionVisual` functions, which are **moved, not edited** — the move is a path change plus the loss of the now-unused sibling exports from that file. `grid/interaction/commit/cross-row.commit.ts` is untouched, and Day never imports it |
| **PB-5** | Week-only edge navigation: `rebuildLayoutAfterNavigation()`, `edge-navigation.ts`, `edge-navigation.state.ts`, `WEEK_EDGE_NAVIGATION_THRESHOLD_PX`, `onRequestWeekNavigation`, `onMotionActivation` retention of `activeInteractionEventRef`. Day uses `INTERACTION_EDGE_THRESHOLD_PX` and `edgeThresholdPx: 0` | S3 (adapter interface) + S4 (geometry aliases) + S6 (coordinator) | `rebuildLayoutAfterNavigation` is added to `WeekInteractionAdapter` by interface extension, never made optional on the shared base (§2.3), so `DayInteractionAdapter` still cannot satisfy `RebuildableAdapter`. `onRequestWeekNavigation` stays on `WeekInteractionRuntime` — the whole point of the two-extension-point reconciliation. `edge-navigation.ts` and `state/edge-navigation.state.ts` are not in the change list. S4 deletes only *type aliases* from `week-layout.cache.ts`; `weekLayoutCacheOptions`'s `edgeThresholdPx: WEEK_EDGE_NAVIGATION_THRESHOLD_PX` and Day's `INTERACTION_EDGE_THRESHOLD_PX` / `edgeThresholdPx: 0` are untouched (F6). `WeekInteractionCoordinator`'s `onMotionActivation` body — including `activeInteractionEventRef.current = target.event._id ? (eventsById.get(...) ?? null) : null` — is inside the runtime object literal, which §7 forbids touching |
| **PB-6** | Envelope is exactly `{event, eventId, hadFormOpenBeforeInteraction, hasMoved, type}`, `eventId = target.event._id!`, four `type` literals | S5 — this is the one thing being unified | `buildInteractionCommitResult` produces exactly those five keys in that order and nothing else; `InteractionCommitResultOf<TType>` declares exactly those five fields. `eventId: target.event._id!` is the single expression, verified identical at all eight sites at HEAD. The four `type` literals are the `InteractionCommitType` union, and each `commit*Interaction` passes its own literal as the first argument, so the return type narrows to the right per-type alias and both adapters' `result.result.type === "allDayDragEnd"` narrowing in `handlePointerUp` keeps working |
| **PB-7** | Week's `commitSavedMutation` has three branches; Day's goes straight to `updateEvent` | S6 only, and only the parameter's type annotation | The edit replaces the inline four-member union with `InteractionCommitResult`. That union is *the same set of four object types* — every member has the identical five fields, so `result.hasMoved`, `result.hadFormOpenBeforeInteraction` and `result.event.isAllDay` all still type-check with no narrowing. Week keeps `if (!result.hasMoved) {…} if (result.hadFormOpenBeforeInteraction) {…} updateEvent(…)`; Day keeps `if (!result.hasMoved) {…} updateEvent(…)`. §7 specifies the exact line ranges that may change, and the branch bodies are outside all of them |
| **PB-8** | `useUpdateEvent` untouched: cross-calendar guards, `fastDeepEqual` short-circuit | Nothing | `packages/web/src/events/mutations/useUpdateEvent.ts` appears in no stage. It is in the allowlist only so the write contract does not churn. Verified: it imports no commit-result type and takes `{event, shouldRemove?, applyTo?}`. Both coordinators keep calling `updateEvent({ event: result.event }, true, { onOptimisticApplied: … })` with a byte-identical call expression. **Stop condition: any packet that opens this file is wrong** |
| **PB-9** | Week threads `visibleDays` through a `WeekLayoutCacheInput` object field; Day passes `visibleDates` as a second positional arg. Week has `buildDragWeekLayoutCache`; Day has none. Different edge-threshold constants | S4 | S4 deletes `WeekLayoutCacheSources`/`WeekLayoutCache`/`DayLayoutCache`/`DayLayoutCacheSources` — four aliases that expand to `GridLayoutCacheSources`/`GridLayoutCache` and carry no structure. `WeekLayoutCacheInput` (which carries the real `visibleDays: string[]` field) is **kept**, as are all three Week builders (`buildTimedWeekLayoutCache`, `buildAllDayWeekLayoutCache`, `buildDragWeekLayoutCache`) and both Day builders with their positional `visibleDates`. `weekLayoutCacheOptions`'s `visibleDates: sources.visibleDays` bridge is untouched. Neither builder family is merged (F6) |
| **PB-10** | `data-week-interaction-event-id` / `-type` and the `day` pair keep their exact rendered values | S1 | `createViewInteractionBindings(viewName)` calls the untouched `createViewInteractionRegistry(viewName)`, which calls the untouched `viewInteractionAttributeNames(viewName)`. The only two call sites pass the literals `"week"` and `"day"`. `TARGET_SELECTOR` is now computed once inside the factory from the same `idAttribute`/`typeAttribute` values, so the selector string is character-identical. `CALENDAR_VIEW_INTERACTION_ID_ATTRIBUTES` and `readCalendarEventIdFromElement` in `view-event-registry.ts` are untouched. `MainGrid.test.tsx` and `eventReadOnlyInteraction.test.tsx` assert on `WEEK_INTERACTION_EVENT_ID_ATTRIBUTE` / `_TYPE_ATTRIBUTE`, which keep their names *and* values — neither test file changes |

---

## 5. Blast radius — the 14 individual allowlist files

Verified by reading each file's import block at HEAD. The shim strategy (§2.1) exists specifically
to make this column read "none".

### Call sites (9)

| File | Interaction imports at HEAD | Edit needed |
|---|---|---|
| `views/Week/WeekView.tsx` | `WeekInteractionCoordinator` only. `getWeekInteractionLayoutSources` is an un-annotated `useCallback` returning an object literal | **none** |
| `views/Week/components/Grid/Grid.tsx` | **none at all** — no import from any interaction tree | **none.** In the allowlist precautionarily (F5) |
| `views/Week/components/Grid/AllDayRow/AllDayEvents.tsx` | `getWeekInteractionTargetAttributes`, `useWeekEventRegistrationRef` from `…/registry/week-event.registry` | **none** — path and both names preserved by the shim |
| `views/Week/components/Grid/MainGrid/MainGridEvents.tsx` | same two names, same path | **none** |
| `views/Week/hooks/shortcuts/useWeekShortcutOwner.ts` | `focusWeekGridEventTarget`, `getFirstVisibleWeekGridEventTarget`, `getFocusedWeekGridEventTarget`, `listVisibleWeekGridEventTargets` from `…/targeting/week-event.targeting` | **none** — path and all four names preserved by the shim |
| `views/Day/components/Calendar/DayCalendarGrid.tsx` | `DayInteractionCoordinator` only | **none** |
| `views/Day/components/Calendar/DayCalendarEventCards.tsx` | `getDayInteractionTargetAttributes`, `useDayEventRegistrationRef` from `…/registry/day-event.registry` | **none** |
| `views/Day/hooks/shortcuts/useDayEventNudgeShortcuts.ts` | `focusDayGridEventTarget`, `getFocusedDayGridEventTarget`, `listVisibleDayGridEventTargets` from `…/targeting/day-event.targeting` | **none** |
| `events/mutations/useUpdateEvent.ts` | none | **none — by ruling (PB-8, AC-6).** Opening this file is a stop condition |

### Test files (5)

| File | Interaction imports at HEAD | Edit needed |
|---|---|---|
| `views/Week/components/Grid/MainGrid/MainGrid.test.tsx` | `WEEK_INTERACTION_EVENT_ID_ATTRIBUTE`, `WEEK_INTERACTION_EVENT_TYPE_ATTRIBUTE`, `weekEventRegistry` + `setWeekInteractionMotionActive` | **none** — names, paths and attribute *values* all preserved (PB-10); `state/motion.state.ts` untouched |
| `views/Week/components/Grid/MainGrid/eventReadOnlyInteraction.test.tsx` | `WEEK_INTERACTION_EVENT_ID_ATTRIBUTE`, `weekEventRegistry` | **none** |
| `views/Week/components/Grid/MainGrid/keyboardEditForm.test.tsx` | `weekEventRegistry` | **none** |
| `views/Week/hooks/shortcuts/useWeekShortcutOwner.test.tsx` | `getWeekInteractionTargetAttributes`, `weekEventRegistry` | **none** |
| `views/Day/hooks/shortcuts/useDayEventNudgeShortcuts.test.tsx` | `dayEventRegistry`, `getDayInteractionTargetAttributes` | **none** |

**Net: 0 of 14 need an edit.** Every edited file in this plan lives inside
`packages/web/src/interaction/**` (none), `packages/web/src/grid/interaction/**` (4 new files), or
one of the two `views/*/interaction/**` trees. If a packet proposes an edit to any file in this
section, the shim strategy has been broken somewhere upstream — treat it as a stop condition and
re-check S1/S3 rather than editing the call site.

---

## 6. Risks and stop conditions

| # | Risk — where a naive execution silently changes behavior | Stop condition |
|---|---|---|
| **R1** | **Cross-row `hasMoved` forcing (PB-4).** A "cleaner" `commitWithMapper` that computes `hasMoved` from a shared predicate (`hasAllDayDragVisualMoved` / `hasTimedDragVisualMoved`) turns Week's same-day cross-row drop into `hasMoved: false`. The coordinator then takes the `!hasMoved` branch and **reopens the event instead of saving the row change** — a real, user-visible data loss that no current test asserts | `hasMoved` is a **required** member of `InteractionCommitMapper` with no default anywhere. Any shared fallback, any `hasMoved?:`, any `hasMoved = has*VisualMoved` default parameter → stop |
| **R2** | **Day's `isAllDay` forcing (PB-2, PB-3).** `allDayVisualToDayGridEvent` sets `isAllDay: true`; `timedDragVisualToDayGridEvent` / `timedResizeVisualToDayGridEvent` set `isAllDay: false`. A builder that "normalizes" the event, spreads `target.event` after the mapped event, or reconstructs `{...mapped, ...defaults}` drops the flag, and the coordinator's `result.event.isAllDay` branch (`gridEventDraftFromSavedResult`) then builds the wrong `GridScheduleDraft` kind | `buildInteractionCommitResult` assigns `event` by reference and never spreads it. Any spread of the mapped event inside `commit-result.ts` → stop |
| **R3** | **Week's exclusive-end-date baseline (PB-2).** `getExclusiveEndDateBaseline` is module-private in Week's `commit/all-day.commit.ts`. Folding `commitAllDayResizeInteraction` into that file makes it look like shared-able infrastructure. Hoisting it to `grid/interaction/commit/` would put a Week-only rule one import away from Day's resize, which must instead collapse to a single day | The helper stays un-exported and stays in Week's tree. Any `export const getExclusiveEndDateBaseline` → stop |
| **R4** | **Single-column Day fallback (PB-3).** `columnMoveCalendarId` is exported from Day's `commit/timed.commit.ts` and imported by Day's `commit/all-day.commit.ts`. Under a "converge the commit directories" reading this looks like the obvious candidate to hoist to the shared commit layer. It must not move: Week's all-day and timed drags must never be able to reach a function that rewrites `calendarId` | `columnMoveCalendarId` stays in `views/Day/interaction/adapter/commit/timed.commit.ts`. Any move into `grid/interaction/commit/` → stop |
| **R5** | **PB-10 attribute values.** Renaming `WEEK_INTERACTION_EVENT_ID_ATTRIBUTE` is allowed; changing what it *evaluates to* is not. Passing anything but the literals `"week"` / `"day"` into the bindings factory, or "tidying" `viewInteractionAttributeNames`'s template, breaks every rendered card, `TARGET_SELECTOR`, `CALENDAR_VIEW_INTERACTION_ID_ATTRIBUTES`, undo focus-restore, context menus, and two test files | `grid/interaction/view-event-registry.ts` is not in the change list. Any diff to it → stop |
| **R6** | **Registry instance identity.** `createViewInteractionBindings` builds a fresh `EventRegistry` on every call. Two call sites for `"week"` (e.g. one in the registry shim and one in the targeting shim) compiles and type-checks cleanly, then silently splits registration from resolution: `weekEventRegistry.register(...)` populates one map while `listVisibleWeekGridEventTargets()` queries another. `MainGrid.test.tsx` and the targeting tests would catch it; a subtler split might not | Exactly one `createViewInteractionBindings("week")` and one `createViewInteractionBindings("day")` in the whole repo, in the two `*-interaction.bindings.ts` files. `grep -c createViewInteractionBindings` over `views/**` must be 2 |
| **R7** | **Import cycle in the shims.** If `targeting/week-event.targeting.ts` keeps importing `weekEventRegistry` from `registry/week-event.registry.ts` *and* the registry file imports from bindings, the graph still works — but if either shim imports the other, module-init order can hand `createGridEventTargeting` an undefined registry at load time | Both shims import from `../week-interaction.bindings` only. Neither imports the other |
| **R8** | **Ghost-preview nulling (PB-4, second half).** The `nextVisual.row === "timed" ? … : null` and `nextVisual.row === "allDay" ? null : …` ternaries in `updateAllDayDragInteractionVisual` / `updateTimedDragInteractionVisual` look like duplicated boilerplate ripe for a shared `crossRowGhostEvent()` helper. They are asymmetric (one nulls on `!== "timed"`, the other on `=== "allDay"`) and a shared helper will get one of them backwards | The five S5 file moves are **content-identical moves**. Any diff inside a moved function body beyond import-path lines → stop |
| **R9** | **Orphaned alias importers (S4).** `SmartScrollCache` (re-exported from `week-layout.cache.ts`), `WeekLayoutCache`, `DayLayoutCache`, `DayLayoutCacheSources` may have importers outside the four in-scope trees that this plan has not enumerated. `bun type-check` will surface them | If the orphaned importer is inside the allowlist, rewire its import to `@web/grid/interaction/layout.cache`. **If it is outside the allowlist, keep the alias** — §1.6 is explicitly "opportunistic" and is not worth a write-contract violation |
| **R10** | **Week's unconditional resize mapping.** Week's `commitTimedResizeInteraction` calls `timedResizeVisualToGridEvent` *even when `hasMoved` is false*, so the `!hasMoved` path hands the coordinator a re-formatted event (`dayjs(event.startDate).startOf("day").add(visual.startMinutes,"minutes").format()`), not the original object. Day's equivalent returns `target.event` untouched. "Optimising" Week's to `hasMoved ? map : t.event` changes what `openTimedEvent(result.event)` receives, and changes what `fastDeepEqual` compares downstream | Week's `toEvent` ignores its `hasMoved` argument for both resize commits and for `commitAllDayResizeInteraction`. Day's uses it for all four. Do not converge |
| **R11** | **Suite file count (F1).** S2 takes the suite from 302 files to 301, failing AC-1 as written | Do not run Phase 7 against the unamended AC-1. Either land the F1 amendment or drop S2 |

---

## 7. Explicit non-goals, and the exact boundary of the coordinator relaxation

Unchanged non-goals from `intent_brief.md`, restated because several are adjacent to work in this
plan:

- **No new user-facing capability** in either view. Consolidation only.
- **No change to `createInteractionEngine`** or anything else in `packages/web/src/interaction/`.
  It is the substrate, not the subject (§1.1 above lists all four files as UNCHANGED).
- **No unification of the visual→GridEvent mappers** (§5.1 ruling). Eight mappers in, eight
  mappers out, bodies byte-identical.
- **No merge of the layout-cache builders** (PB-9, F6). Week's object-field `visibleDays` and Day's
  positional `visibleDates` both survive; so do `buildDragWeekLayoutCache` (Week-only) and the two
  different edge-threshold constants.
- **No extraction of Day's inline `create*Visual`/`update*Visual`** out of
  `day-interaction.adapter.ts` to mirror Week's new `adapter/visuals/`. Week has a `visuals/`
  directory because it already had one under a different name; Day does not, and creating one would
  be a 200-line reshape of a file no acceptance criterion asks about. The residual directory
  asymmetry is documented, not fixed.
- **No edit to `useUpdateEvent.ts`** (PB-8, AC-6).
- **No adoption of the two prior CMP-104 runs' output.**
- **No `.gitignore` change.**

### The coordinator relaxation, at its exact boundary

**IN SCOPE — precisely these edits and no others:**

`views/Week/interaction/WeekInteractionCoordinator.tsx`

| Location at HEAD | Change |
|---|---|
| line 18 `import { type WeekLayoutCacheSources } from "./adapter/geometry/week-layout.cache";` | → `import { type GridLayoutCacheSources } from "@web/grid/interaction/layout.cache";` (S4 deletes the alias) |
| line 30 `getLayoutSources?: () => WeekLayoutCacheSources;` | → `getLayoutSources?: () => GridLayoutCacheSources;` |
| lines 19–26 import block | drop the four `type Week*CommitResult` members; keep `createWeekInteractionAdapter` and `type WeekInteractionRuntime`; add `import { type InteractionCommitResult } from "@web/grid/interaction/commit/commit-result";` |
| lines 128–134 `const commitSavedMutation = (result: \| WeekAllDayDragCommitResult \| … ) => {` | → `const commitSavedMutation = (result: InteractionCommitResult) => {` |

`views/Day/interaction/DayInteractionCoordinator.tsx`

| Location at HEAD | Change |
|---|---|
| lines 12–19 import block | drop the four `type Day*CommitResult` members; keep `createDayInteractionAdapter` and `type DayInteractionRuntime`; add the same `InteractionCommitResult` import |
| lines 82–88 `const commitSavedMutation = (result: \| DayAllDayDragCommitResult \| … ) => {` | → `const commitSavedMutation = (result: InteractionCommitResult) => {` |
| line 10 `GridLayoutCacheSources` import | unchanged — Day is already on the shared type |

**OUT OF SCOPE in both coordinators — any diff here is a Gate revision, not a packet:**
control flow and branch structure of `commitSavedMutation` (Week's three branches at lines 135–157;
Day's one at lines 89–96); the `runtimeRef.current = {…}` object literal and every member of it
including `onMotionActivation` and `onRequestWeekNavigation`; `openClickedGridEvent` /
`openDayCalendarEvent`; `gridEventDraftFromSavedResult`; `resolveInteractionSourceEvent`;
`mapEventsById`; the `useMemo` dependency arrays; the `updateEvent(…)` call shape; the
`useWeekInteractionLayoutSync(adapter, weekProps)` wiring; `PointerCaptureBoundary`.

If the implementation finds it *wants* a logic change in either coordinator — including one that
looks purely cosmetic, such as extracting the duplicated `mapEventsById` into a shared module —
**stop and bubble it up.** PB-7 is the invariant that asymmetric routing is behavior, not drift.

---

## 8. Line-count accounting (AC-7)

AC-7 measures only the two view trees. Being explicit about how much of the reduction is deletion
versus relocation into `grid/interaction/**`:

| Tree | HEAD | Delta | Of which relocation | Of which genuine deletion |
|---|---|---|---|---|
| `views/Week/interaction/**` | 5428 | ≈ −228 | ≈ −110 (adapter types → shared; envelope → shared; targeting wiring → shared) | ≈ −118 (targeting test file; alias family; per-view binding boilerplate) |
| `views/Day/interaction/**` | 2375 | ≈ −221 | ≈ −108 | ≈ −113 |
| **Two-tree total (AC-7)** | **7803** | **≈ 7354** | | |
| `grid/interaction/**` | 2625 | ≈ +340 (4 new files) | | |
| **All four trees** | 10 336 | ≈ −110 | | |

**Adjusted for stage SC (added at Gate 2).** The two characterization test files are additive and
land inside the two view trees, so they count against AC-7: roughly **+130 lines** (≈ +75 Week for
CT-1 + CT-2's Week half, ≈ +55 Day for CT-2's Day half). Revised two-tree total ≈ **7484**, still
comfortably under the 7803 baseline. AC-7 headroom drops from ~450 to ~320 lines. This is the
correct trade — AC-7 is a proxy metric, and R1 is potential data loss.

AC-7 passes with ~320 lines of headroom (~450 before SC). Without S2 (if F1 had been refused) the
two-tree total would be ≈ 7668 with SC included, and AC-7 would still pass. Reviewers should note that roughly half the two-tree reduction is
relocation — the honest global win is the eliminated second copy of the 149-line adapter-types file
(≈ −130) and the eliminated second 92-line targeting test (≈ −85).

---

## 9. Cross-cutting sequencing summary

```
SC (characterization tests — MUST go green on pristine HEAD)
 │
 v
S0 (shared scaffolding, additive)
 ├─> S1 (registry+targeting shims)  ──> S2 (test collapse)      [gated on F1]
 ├─> S3 (adapter types)             ──> S5 (commit) ──> S6 (coordinators)
 └─> S4 (geometry aliases)          ──┘                    ↑
                                                    S5 must land before S6:
                                                    the coordinators cannot
                                                    import InteractionCommitResult
                                                    until the adapters return it
```

Hard ordering constraints:

0. **SC before S0, and therefore before everything.** The characterization tests must go green on
   a pristine tree (AC-5b). Re-run them after S5 and after S6; they are regression guards from S5
   onward, not one-shot documentation.
1. **S0 before everything else.** All three shared modules are imported by S1/S3/S5.
2. **S1 before S2.** The table-driven test asserts against `weekInteractionBindings` /
   `dayInteractionBindings`.
3. **S3 before S5.** The commit bodies return `AllDayDragCommitResult` etc. from
   `commit-result.ts`; the adapters reach them through the per-view aliases S3 installs.
4. **S4 before S6.** S6's Week coordinator import swap (`WeekLayoutCacheSources` →
   `GridLayoutCacheSources`) is only valid once S4 has deleted the alias. Running S6 first leaves a
   dangling import for one stage.
5. **S5 before S6.** Non-negotiable, and the reason S6 is its own stage: the AC-6 diff must be
   reviewable as annotation-only against an already-green tree.
6. **S2 is independent of S3–S6** and can be dropped entirely (F1) without touching any other
   stage.
