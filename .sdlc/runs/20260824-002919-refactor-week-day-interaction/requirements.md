# CMP-104 — Refactor Requirements: widen `packages/web/src/grid/interaction/` to the adapter boundary

## Purpose and delta scope

Week and Day each maintain a near-identical interaction adapter stack on top of an already-generic engine. The only change this ticket permits is structural: widen the shared layer at `packages/web/src/grid/interaction/` so it owns the *adapter boundary* (adapter types, adapter runtime, layout-cache presets, coordinator), then collapse `packages/web/src/views/Week/interaction/**` and `packages/web/src/views/Day/interaction/**` onto it with **zero runtime behaviour change**. Verified duplication: `week-interaction.adapter.ts` (795 LOC) vs `day-interaction.adapter.ts` (607 LOC); `week-interaction.adapter.types.ts` and `day-interaction.adapter.types.ts` (149 LOC each, ~85% a pure Week->Day identifier rename); `WeekInteractionCoordinator.tsx` (217 LOC) vs `DayInteractionCoordinator.tsx` (133 LOC); `week-layout.cache.ts` (73 LOC) vs `day-layout.cache.ts` (76 LOC). This is a delta spec: it states what must be preserved and what restructuring is allowed. It designs no new feature and fixes no defect other than the type hazard in FR-1, which is a prerequisite for the merge being safe at all.

## Preservation invariants

Each INV must be provably unchanged after the refactor. Where an invariant is not currently pinned by a test, pinning it is in scope (see AC-5).

**INV-1 — Week timed drag and resize commit identically.** A Week timed drag or resize that starts in column A and ends in column B must produce exactly the same `GridEvent` (start/end date-times, duration, `calendarId`) as today. Week column keys remain local `YYYY-MM-DD` date strings, per the doc comment on `TimedDragVisual.dayDate` in `packages/web/src/grid/interaction/types/timed-drag.types.ts`.

**INV-2 — Day timed drag and resize commit identically, including the cross-calendar move rule.** A drop on a *different* column key remains a cross-calendar move and a same-column drop keeps the event's own `calendarId` — `packages/web/src/views/Day/interaction/adapter/commit/timed.commit.ts:82` (`columnMoveCalendarId`). The single-column fallback, whose one key is a date string that never changes, must continue to behave as a same-column drop (i.e. never a calendar move).

**INV-3 — Week all-day drag keeps DELTA (not absolute) date semantics.** `dayDelta = dayjs(visual.dayDate).diff(dayjs(visual.initialDayDate), 'day')`, applied to both `startDate` and `endDate` — `packages/web/src/views/Week/interaction/adapter/commit/all-day.commit.ts:18`. Multi-day spans clamped to the rendered window must keep moving by the delta from the clamped visible start; they must never snap to the drop column's absolute date.

**INV-4 — Day all-day drag never rewrites dates.** The Day all-day commit path must continue to leave `startDate`/`endDate` untouched — `packages/web/src/views/Day/interaction/adapter/commit/all-day.commit.ts:19`. This is deliberate, not an oversight; unification must not make Day inherit Week's delta rule.

**INV-5 — The all-day movement test stays a raw key inequality.** `hasAllDayDragVisualMoved` compares `visual.dayDate !== visual.initialDayDate` with no parsing or normalisation (`packages/web/src/views/Week/interaction/adapter/commit/all-day.commit.ts`). Introducing date normalisation here would change which drags are treated as moves.

**INV-6 — The targeting attribute scheme and view-agnostic id resolution are unchanged.** The `data-${view}-interaction-event-*` attributes emitted via `view-event-registry.ts` keep their exact names and values in both views, and `readCalendarEventIdFromElement` must keep resolving a calendar event id **view-agnostically** from any of them. Context menus and undo focus-restore read event ids through this path; a rename, a narrowing to one view, or a change in which element carries the attribute breaks them at runtime with no compiler error. The shim modules `{week,day}-event.registry.ts` and `{week,day}-event.targeting.ts` may be re-pointed, but every name they export today must keep resolving.

**INV-7 — Cross-row fields stay inert for Day.** `row`, `crossRowSize` and `timedStartMinutes` live on the shared visual types (`packages/web/src/grid/interaction/types/timed-drag.types.ts`) but only Week ever populates them. After unification, Day must still never populate them and never dispatch a cross-row drop. A shared shape that makes Day *look* like it supports cross-row drops (fields typecheck, nothing drives them) is a defect even though it compiles.

**INV-8 — Week cross-row drag (timed <-> all-day) is unchanged**, including both date computations at `packages/web/src/grid/interaction/commit/cross-row.commit.ts:22` and `:45`.

**INV-9 — Week edge navigation is unchanged.** `getVisibleDays()`, `onRequestWeekNavigation`, `WeekEdgeNavigableVisual` and `rebuildLayoutAfterNavigation()` keep their current triggering and sequencing, and the Week layout preset keeps `edgeThresholdPx = WEEK_EDGE_NAVIGATION_THRESHOLD_PX` with smart scroll enabled (`packages/web/src/views/Week/interaction/adapter/geometry/week-layout.cache.ts`).

**INV-10 — Day layout presets are unchanged.** Day's all-day preset keeps `edgeThresholdPx = 0` with no smart scroll, and the Day-only target-dispatch helpers keep their current behaviour (`packages/web/src/views/Day/interaction/adapter/geometry/day-layout.cache.ts`).

**INV-11 — Day's column-key duality is preserved exactly as-is.** `const columnKeys = eventColumnIndex >= 0 ? calendarColumnKeys : [visibleDateKey]` in `packages/web/src/views/Day/interaction/adapter/day-interaction.adapter.ts:260` means a Day column key is a `CalendarId` when calendar columns are rendered and a `YYYY-MM-DD` date string when they are not. FR-1 must make this duality **visible to the compiler**, not remove it. Deleting the fallback (or forcing it to a calendar id) is a runtime behaviour change and is out of scope.

**INV-12 — Layout cache geometry is unchanged.** `buildDayColumns` continues to emit columns in window order with `columnWidth = input.width / dates.length`, `left = input.left + columnWidth * index`, and `[]` for an empty date list, for both views (`packages/web/src/grid/interaction/layout.cache.ts`).

**INV-13 — Nothing outside the two interaction folders and the shared grid interaction layer changes.** The engine at `packages/web/src/interaction/**` is untouched, `GridEvent` persistence payloads are byte-identical, and no rendered DOM, CSS class, or element id changes.

## Functional requirements

Ordering is a hard constraint, not a preference: **FR-1 must land and be verified green as its own checkpoint before any merge work (FR-3..FR-7) begins.** FR-2 is the second prerequisite because it disarms a trap that only becomes live once the layer is shared.

### FR-1 — Make the column key a compiler-checked type across the visual types *and* the layout cache (PREREQUISITE)

`TimedDragVisual.dayDate` / `.initialDayDate` and `AllDayDragVisual.dayDate` / `.initialDayDate` are declared bare `string` while semantically carrying a **column key** whose meaning is view-dependent (`packages/web/src/grid/interaction/types/timed-drag.types.ts`). The type must be changed so that a consumer cannot parse or cast the key without the compiler establishing which kind of key it holds. The fix must additionally reach `GridLayoutCacheOptions.visibleDates: string[]`, `DayColumnCache.date: string` and `buildDayColumns` in `packages/web/src/grid/interaction/layout.cache.ts`; the same key flows through those, so a fix that stops at the visual types lets the key launder back to `string` at the layout boundary and is cosmetic.

Landing FR-1 must remove, as a consequence rather than as separate cleanup:
- the unchecked `visual.dayDate as CalendarId` cast at `packages/web/src/views/Day/interaction/adapter/commit/timed.commit.ts:82`;
- the defensive `'dayDate' in visual ? ... : false` guard at `packages/web/src/views/Day/interaction/adapter/commit/all-day.commit.ts:19`, which tests a field the type declares non-optional and is dead-code evidence that the declared type is not trusted.

**Rationale.** The overload is already producing a silent corruption path today (see FR-2) and is the single reason the merge is unsafe: once Week and Day visuals flow through one shared adapter, every shared consumer becomes reachable from both views, and only the type system can tell them apart. Doing this first converts what would be a runtime-regression hunt into compiler errors.

**Risk.** (a) A naive two-way brand — `WeekColumnKey = date`, `DayColumnKey = CalendarId` — is **unsound**, because Day is internally inconsistent per INV-11; any accepted model must express Day's key as *calendar-id-or-date*, or keep it opaque. See OQ-1. (b) The obvious over-correction is to eliminate Day's date fallback so the brand becomes clean; that is a behaviour change and is forbidden by INV-11. (c) Threading a new key type through `layout.cache.ts` touches the widest shared surface in the module and can leak back to `string` through a single un-annotated inference site — AC-3 alone will not catch a leak, so the key type must be non-assignable from bare `string` in at least one direction.

### FR-2 — Make the shared cross-row commit safe at its shared location (PREREQUISITE)

`packages/web/src/grid/interaction/commit/cross-row.commit.ts:22` and `:45` both `dayjs`-parse `visual.dayDate`. The file already lives in the **shared** layer and is imported only by Week today, so it happens to be correct; under unification its shared placement makes it a live trap. The same class of bug is concretely reachable at `packages/web/src/views/Week/interaction/adapter/commit/all-day.commit.ts:18`, where a Day-produced visual would yield `Invalid Date` -> `NaN` day delta -> silently corrupted `startDate`/`endDate` with no throw. Both parse sites must be constrained so that a Day-produced visual cannot reach them.

**Rationale.** This is the one place where the current duplication is *load-bearing for correctness*: Week-only reachability is what keeps the parse valid. Removing the duplication without first encoding that constraint converts an invariant enforced by accident into nothing at all.

**Risk.** The constraint must be **type-level** (FR-1's key type used as a parameter bound or a narrowed input), not a runtime guard or throw. Adding a runtime check that can fire is new behaviour and violates INV-8; adding one that can never fire is dead code of exactly the kind FR-1 is removing at Day `all-day.commit.ts:19`.

### FR-3 — Unify the two adapter type modules into one shared, parameterised type module

Collapse `week-interaction.adapter.types.ts` and `day-interaction.adapter.types.ts` (149 LOC each, ~85% identical modulo a Week->Day identifier rename) into a single module under `packages/web/src/grid/interaction/`. The only genuine differences that must survive as explicit, view-specific extension points are: Week runtime `getVisibleDays()`, `onRequestWeekNavigation`, `WeekEdgeNavigableVisual`, `rebuildLayoutAfterNavigation()`; Day options `getColumnKeys()` and `getVisibleDate()`. `WeekLayoutCacheSources` is a bare alias of `GridLayoutCacheSources` and should be dropped in favour of `GridLayoutCacheSources`, which Day already uses directly.

**Rationale.** The types are the narrowest place to establish the shared shape, and they gate FR-4/FR-6; getting the extension-point modelling right here is what keeps the runtime merge mechanical.

**Risk.** Modelling the Week-only members as plain optional fields on one flat shared type re-creates exactly the INV-7 hazard at the adapter level — Day configs would typecheck against navigation hooks nothing drives. The shape must make Week-only capability structurally unavailable to Day (discriminated union, separate config types, or a capability type parameter). See OQ-4.

### FR-4 — Collapse the two adapter runtimes onto one shared adapter

`week-interaction.adapter.ts` (795 LOC) and `day-interaction.adapter.ts` (607 LOC) become one shared implementation plus two thin view configurations supplying the differences enumerated in FR-3 (Week: visible-days source, navigation request, layout rebuild; Day: `getColumnKeys()`, `getVisibleDate()`, including the INV-11 fallback).

**Rationale.** This is the bulk of the duplication and the actual point of the ticket; everything before it exists to make this step compiler-guarded rather than review-guarded.

**Risk.** Highest blast radius in the ticket. Callback identity, hook/effect ordering and listener registration order must be preserved — a stable-identity callback that becomes freshly allocated per render (or vice versa) changes effect re-subscription and can alter drag frame timing without failing a unit test. Must not begin until FR-1 and FR-2 are green.

### FR-5 — Collapse the layout-cache preset wrappers

`week-layout.cache.ts` (73 LOC) and `day-layout.cache.ts` (76 LOC) are thin option presets over the same three grid builders (`buildTimed`, `buildAllDay`, `buildDragGridLayoutCache`). Replace them with one shared preset-driven factory taking per-view preset values, preserving INV-9 (Week: `WEEK_EDGE_NAVIGATION_THRESHOLD_PX`, smart scroll on) and INV-10 (Day all-day: `edgeThresholdPx = 0`, no smart scroll), and keeping the Day-only target-dispatch helpers as Day-side configuration.

**Rationale.** With FR-1 already typing `visibleDates`/`DayColumnCache.date`, the preset wrappers are the last place the two views diverge for reasons that are pure data.

**Risk.** Preset drift is silent: a wrong `edgeThresholdPx`, or smart scroll accidentally enabled for Day, produces no type error and no unit-test failure — it only shows up as an edge-scroll behaviour change during a real drag. Preset values must be asserted directly (AC-5).

### FR-6 — Collapse the two coordinators

`WeekInteractionCoordinator.tsx` (217 LOC) and `DayInteractionCoordinator.tsx` (133 LOC) become one shared coordinator plus view props; Week retains its navigation wiring per INV-9.

**Rationale.** The coordinators are the last duplicated seam between the shared adapter and the views; leaving them split re-introduces per-view drift on the next change.

**Risk.** Hook ordering and render counts must not change, and the rendered DOM — including every `data-${view}-interaction-event-*` attribute per INV-6 — must be identical. A coordinator refactor is the most likely place to accidentally change which element carries the targeting attribute.

### FR-7 — Re-point the existing re-export shims instead of editing consumers

`{week,day}-event.registry.ts`, `{week,day}-event.targeting.ts` and the per-view type modules keep every export name they have today, re-pointed at the shared layer, so that no file outside `packages/web/src/views/{Week,Day}/interaction/**` and `packages/web/src/grid/interaction/**` needs an import edit.

**Rationale.** Bounds the diff to the refactored subtree and keeps the change reviewable against INV-13.

**Risk.** A shim can keep its export *name* while its exported *type* changes shape, which compiles at the shim but changes inference at distant call sites. `bun run type-check` (AC-3) is the gate here, and any shim whose exported type shape changed must be called out in review.

## Out of scope

These four were confirmed with the human at Gate 0 and must not be reopened during implementation.

1. **The engine at `packages/web/src/interaction/**`.** It is already generic, and it is hard off-limits under this run's write contract. No file below that path may be created, modified or deleted.
2. **The targeting and registry layers** — `{week,day}-event.registry.ts` and `{week,day}-event.targeting.ts`. They are already pure re-export shims with zero logic, so there is nothing to unify; FR-7 only re-points them, and INV-6 pins the behaviour they front.
3. **The commit layer.** It is divergent **by design**: in Week a column is a day, in Day a column is a calendar, and Day's all-day drag deliberately never rewrites dates (INV-4). FR-1 and FR-2 touch commit files only to delete the unsafe cast (`Day timed.commit.ts:82`) and the defensive guard (`Day all-day.commit.ts:19`) and to constrain the shared cross-row parse; the commit *rules* themselves stay exactly as they are.
4. **Adding cross-row drag to Day.** That is a capability gap and belongs to a separate ticket. Making Day's cross-row fields inert-but-honest (INV-7) is a typing concern, not an implementation of the capability — do not conflate them.

Also out of scope: performance work, visual/CSS changes, eliminating Day's single-column date fallback (INV-11, OQ-3), and any new test beyond those needed to pin the invariants above.

## Acceptance criteria

- **AC-1** — `bun run test:web` holds at **2298 pass / 0 fail across 302 files**. No test deleted, skipped or rewritten to accommodate the refactor.
- **AC-2** — The interaction-scoped suite holds at **159 pass / 0 fail**.
- **AC-3** — `bun run type-check` is clean, with no `any`, no `as` cast and no `@ts-expect-error` introduced to satisfy FR-1's key type.
- **AC-4** — `bun run lint` exits 0 with the **10 pre-existing warnings tolerated and zero new warnings**.
- **AC-5** — **No runtime behaviour change.** Specifically verifiable: every INV-1..INV-13 is either covered by an existing passing test or gains a test in this ticket; the Week/Day layout preset values (INV-9, INV-10) are asserted directly; `readCalendarEventIdFromElement` resolves ids from both views' attributes (INV-6); and Day's all-day commit still returns dates untouched (INV-4).
- **AC-6** — Net LOC in `packages/web/src/views/{Week,Day}/interaction/**` plus `packages/web/src/grid/interaction/**` decreases, and no new export escapes those two subtrees (INV-13, FR-7).
- **AC-7** — FR-1 is verified against AC-1..AC-4 as its own checkpoint, before any FR-3..FR-7 change is written. FR-2 is verified the same way immediately after.

## Open questions for the Gate 2 human decision

**OQ-1 (blocking FR-1) — Should the column key be a BRANDED STRING UNION or an OPAQUE GENERIC TYPE PARAMETER?**

Fact 2 rules out the tidy answer up front: because `columnKeys = eventColumnIndex >= 0 ? calendarColumnKeys : [visibleDateKey]` (`day-interaction.adapter.ts:260`), a Day column key is a `CalendarId` *or* a `YYYY-MM-DD` date depending on render state, so a two-way brand (`WeekColumnKey = date`, `DayColumnKey = CalendarId`) would be unsound and would lie about the fallback. Both remaining options must model Day as a union.

- **Option A — branded string union.** Introduce `DateColumnKey` (dayjs-parseable) and `CalendarColumnKey` (never parseable), with `WeekColumnKey = DateColumnKey` and `DayColumnKey = CalendarColumnKey | DateColumnKey`. *For:* concrete, greppable, easy to read in error messages and in review; every hazard site becomes a required narrowing (`Week all-day.commit.ts:18`, `cross-row.commit.ts:22`/`:45` require `DateColumnKey`; `Day timed.commit.ts:82` narrows instead of casting). *Against:* the shared layer must now *enumerate* both views' key kinds, which is the coupling the refactor is supposed to reduce; `GridLayoutCacheOptions.visibleDates` and `DayColumnCache.date` must widen to the union (they hold calendar ids in Day today), so the doc comments in `layout.cache.ts` that say `Local YYYY-MM-DD dates` become wrong and must be rewritten; and Day's adapter needs one explicit, reviewable narrowing point at the fallback branch.
- **Option B — opaque generic parameter.** Thread `TColumnKey` through `TimedDragVisual<TColumnKey>`, `AllDayDragVisual<TColumnKey>`, `GridLayoutCacheOptions<TColumnKey>` and `DayColumnCache<TColumnKey>`; shared code becomes key-agnostic and *structurally cannot* dayjs-parse the key. Week instantiates with a date type, Day with `CalendarId | DateColumnKey`. *For:* handles Day's internal inconsistency without the shared layer knowing about it; and FR-2 falls out directly — `cross-row.commit.ts` declares `TColumnKey extends DateColumnKey`, which is exactly the Week-only constraint that is currently enforced only by import topology. *Against:* generic churn across nearly every shared signature at the moment FR-4/FR-5 are trying to *erase* differences; noticeably worse compiler diagnostics; and a single un-annotated inference site can silently resolve `TColumnKey` to `string`, quietly restoring today's hazard with a green type-check — so Option B needs a deliberate guard against that (e.g. the base key type non-assignable from bare `string`).

Honest summary for the decision: A is cheaper to land and easier to review but hard-codes both views' key vocabulary into the shared layer; B is the sounder model for a layer that is about to be shared and gives FR-2 for free, at the cost of the widest signature churn and a real silent-leak failure mode. The two are not mutually exclusive — B with a `DateColumnKey`/`CalendarColumnKey` brand pair as the instantiation types is a viable hybrid, at the cost of paying for both mechanisms.

**OQ-2 (blocking FR-2) — Where should `cross-row.commit.ts` live?** Keep it in `grid/interaction/commit/` with a compiler-enforced Week-only key constraint, or move it under `views/Week/interaction/` so its Week-only reachability is expressed by location? The former fits the widen-the-shared-layer goal; the latter is a one-line move that removes the trap entirely and is trivially reviewable. Note that adding cross-row drag to Day is explicitly a separate ticket, so shared placement buys nothing today.

**OQ-3 (non-blocking) — How should Day's single-column date fallback be recorded?** INV-11 freezes it for this ticket. Is it permanent behaviour to be documented in the shared types, or tech debt that should get a follow-up ticket to make Day's column keys uniformly calendar ids? The answer changes how much the FR-1 type model should invest in expressing the union.

**OQ-4 (blocking FR-3) — How should Week-only capability be modelled?** Optional fields on one flat shared config are the cheapest and re-create the INV-7 hazard one level up (Day configs would typecheck against navigation hooks nothing drives). Preferred alternatives: a discriminated union on view, separate Week/Day config types over a shared base, or a capability type parameter. Needs a call before FR-3, since FR-4 and FR-6 both build on it.

**OQ-5 (process) — One PR or a stack?** FR-1 strictly precedes FR-3..FR-7 (AC-7), so a stack of at least three (FR-1, FR-2, then the merge) is the natural shape and keeps the behaviour-preserving claim auditable. Confirm the preferred review granularity before implementation starts.

**OQ-7 (blocking FR-1, raised by prior-run cross-check) — Must the column-key type be non-defaulted?** See the cross-check section below. The prior run declared `TimedDragVisual<TColumnKey = string>`. A `= string` default means any un-annotated instantiation silently resolves the key back to bare `string`, restoring today's hazard with a green type-check — precisely the Option B failure mode named in OQ-1. Recommendation: the type parameter must have **no default**, or a default that is not assignable from bare `string`, so that omitting the annotation is a compile error rather than a silent downgrade. Confirm this as a hard requirement on FR-1.

**OQ-6 (non-blocking) — Are the `layout.cache.ts` doc comments authoritative?** `GridLayoutCacheOptions.visibleDates` and `DayColumnCache.date` are both documented as `Local YYYY-MM-DD` but demonstrably carry calendar ids in Day. Confirm that FR-1 may rewrite those comments (a doc-only change) rather than treating the comments as the spec.

---

## Appendix — cross-check against the prior policy A/B run

This run is a deliberate A/B against run `20260822-125447-refactor-week-day-interaction`
(policy `flash-agsdk-only`, $4.942951, 30 dispatches, shipped as commit `62162a95` on branch
`CMP-104/flash-agsdk-only`, which is **not** an ancestor of this branch). The requirements above
were derived independently from the source before the prior artifacts were consulted. This
appendix records where the two landed, because agreement and disagreement are both findings.

**Where this run independently reached the same conclusion.** That FR-1 (the column-key type fix)
is a strict prerequisite gating all merge work; that the two candidate mechanisms are a branded
string union and a generic type parameter; that the adapter-types modules and the geometry layout
caches are the two cleanest merge targets; and that the shared cross-row commit must be pinned to
a date-typed key. Two independent passes under different policies converging on the same ordering
and the same hazard is meaningful corroboration that the sequencing constraint is real and not an
artifact of one model's framing.

**A concern this run raised and then withdrew.** The analysis above initially treated Day's
single-column fallback (`day-interaction.adapter.ts:260`, `[visibleDateKey]`) as a soundness hole
that a two-way brand would miss. Inspection of `62162a95` shows the prior run **did** handle it:
it defined `DayColumnKey` as a union and annotated the fallback with a comment stating that the
key is "not a calendar id, which is why DayColumnKey is a union." The concern is withdrawn, and
INV-11 stands as a preservation requirement rather than as a defect report against prior work.

**A weakness this run identifies that the prior run's shipped code carries.** `62162a95` declares
`export interface TimedDragVisual<TColumnKey = string>`. The `= string` default means the safety
is opt-in: any instantiation that omits the type argument silently resolves the key back to bare
`string` and reproduces the original hazard while type-checking cleanly. The prior run's own
security review appears to have brushed the same surface, recording "unchecked brand-cast helpers"
(e.g. `asDayColumnKeys`) as an INFO-only, accept-as-designed finding. This run treats both as
blocking design questions on FR-1 rather than informational: see OQ-7 for the default, and FR-1's
risk note (c) for the cast helpers. This is the sharpest substantive divergence between the runs
and should drive the Gate 2 decision.

**Genuine scope divergences, to be decided at Gate 2 rather than inherited.**
- The prior run framed its deferred FR-3 as *decomposing Day's adapter to match Week's existing
  modular shape* (aligning Day to Week). This run's FR-4 instead *collapses both adapters onto one
  shared implementation in `grid/interaction/`* (aligning both to the shared layer). These are
  different architectural end-states, not different sizings of the same work, and the second is a
  better fit for the stated goal of widening the shared layer.
- This run adds FR-7 (re-point the existing re-export shims so no consumer outside the two
  interaction subtrees needs an import edit), which has no counterpart in the prior run's plan. It
  exists to bound the diff and make INV-13 auditable.
- This run states FR-2 (shared-location safety of `cross-row.commit.ts`) as a first-class,
  separately-verified prerequisite with its own checkpoint, and raises OQ-2 on whether the file
  should simply move under `views/Week/` instead. The prior run folded the equivalent pinning into
  FR-1.
- Lint acceptance differs and this run's is the operative one: the prior run's NFR-3 demanded
  "0 errors and 0 warnings", whereas this run's confirmed baseline tolerates 10 pre-existing
  warnings provided none are new in the delta (AC-4).

**Not inherited.** The prior run's delivered scope (FR-1 + FR-2 + FR-5, with FR-3/FR-4/FR-6 cut at
Gate 2 and mid-execution) is recorded here as context only. This run's scope is an open question
for the human at Gate 2 and is not pre-committed to the same cut.
