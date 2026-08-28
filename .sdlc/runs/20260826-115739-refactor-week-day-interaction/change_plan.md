# Change Plan — refactor: unify Week and Day interaction layers

- **Run:** `20260826-115739-refactor-week-day-interaction`
- **Mode:** brownfield · **Intent:** `refactor` · **Stack:** Bun 1.3.14 / TS / React 18, `@web/* -> packages/web/src/*`
- **Guarantee:** UX identical, internals free.
- **Gate 1 decisions honoured:** Q1 = Week's factored `create/update/commit` shape wins, Day lifts up.
  Q2 = **(a) scaffolding only** — two thin view adapters survive. Q3 = `window.__weekInteractionMotionActive`
  keeps its name and its home.

## STOP — semantic conflict found

**None.** Lifting Day to Week's factored shape is achievable as pure restructuring. Two places came
close and are recorded here so a reviewer can confirm the judgement rather than take it on trust:

1. **`visibleDate` threading.** Day's commit functions take a third positional argument
   (`Day/.../commit/timed.commit.ts:17-21,35-39`, `all-day.commit.ts:39-43`); Week's take
   `(target, visual)` (`Week/.../interactions/timed.drag.ts:93-96`). The resolution is that **Week's
   signatures do not change** and Day's `commitXInteraction` move to `interactions/*` **with their
   existing three-argument signature intact**. "Week's shape" means *one module per interaction
   exporting `createX` / `updateX` / `commitX`* — not one shared signature (that is Q2 option (b),
   deferred). No Day commit argument is added, removed, reordered, or defaulted.
2. **Day's all-day update produces no ghost label.** Week's `updateAllDayDragInteractionVisual`
   returns `{ event, visual }` (`Week/.../interactions/all-day.drag.ts:66-75`) because a cross-row
   drop needs a time preview; Day's all-day path has no label at all
   (`day-interaction.adapter.ts:339-351` returns `draftEvent: { transform }` only). Day's extracted
   `updateAllDayDragInteractionVisual` therefore returns the **bare next visual**, mirroring Week's
   own `updateAllDayResizeInteractionVisual` (`all-day.resize.ts:45-57`), which also returns a bare
   visual. Returning `{ event: null, visual }` would be dead code and would imply Day has a cross-row
   concept — forbidden by Out-of-scope 1 / AC-6.

---

## 0. The shape of the change, in one paragraph

The duplication is **wiring**: target resolution (~160 identical lines per adapter), pointer-handler
plumbing, engine construction, the layout/scrollTop mutable pair, the three pure engine-adapter
members, and four identical sets of target/visual/commit-result **type declarations**. All of that
moves into a new `packages/web/src/grid/interaction/adapter/**` substrate plus one new
`grid/interaction/view-interaction.module.ts` for registry+targeting. What stays per-view is exactly
what FR-7/FR-8 protect: column semantics (dates vs `calendarId`), commit semantics (delta vs
own-dates), layout-cache options, edge navigation, cross-row drag, the motion flag, and
`rebuildLayoutAfterNavigation`. **No public export name and no module path used by any of the 25
call sites changes**, so the call-site stage is a verification stage, not an edit stage.

---

## 1. Files added

All paths are inside the confirmed allowlist (`packages/web/src/grid/interaction/**`,
`packages/web/src/views/{Week,Day}/interaction/**`).

### Shared registry + targeting (Stage 1–2)

| # | Path | Purpose |
|---|---|---|
| A1 | `packages/web/src/grid/interaction/view-interaction.module.ts` | The single per-view registry+targeting implementation (FR-1, FR-5). Exports a frozen `VIEW_INTERACTION_MODULES = { day, week }` built at module scope from `createViewInteractionRegistry("day")` / `createViewInteractionRegistry("week")` — literals preserved verbatim for AC-3 — each wrapped with its `TARGET_SELECTOR` and one `createGridEventTargeting` call. **Exactly two module instances exist for the process lifetime; there is no exported function that mints a third** (FR-2). |
| A2 | `packages/web/src/grid/interaction/view-interaction.module.test.ts` | New. Guards FR-2 structurally: `VIEW_INTERACTION_MODULES.week.registry` is reference-identical across repeat property access and identical to the instance re-exported as `weekEventRegistry`; the same for `day`; `week.registry !== day.registry`; attribute strings are `data-week-interaction-event-{id,type}` / `data-day-…` byte-for-byte (FR-3). |

### Shared adapter substrate (Stage 3–4)

| # | Path | Purpose |
|---|---|---|
| A3 | `packages/web/src/grid/interaction/adapter/view-interaction.types.ts` | One declaration of the types that are today declared twice, character-for-character: `ViewInteractionPointerOwnership`, `ViewResolvedEventTarget`, `ViewAllDayDragTarget`, `ViewAllDayResizeTarget`, `ViewTimedDragTarget`, `ViewTimedResizeTarget`, `ViewInteractionTarget`, `ViewInteractionVisual`, the four `View*CommitResult` interfaces, `ViewInteractionCommitResult`, `ViewInteractionRuntimeBase`, `ViewInteractionAdapterBase`. Verified identical against `week-interaction.adapter.types.ts:19-137` and `day-interaction.adapter.types.ts:20-137` — both views' `*RegisteredEventTarget` are aliases of the same `ViewRegisteredEventTarget`. |
| A4 | `packages/web/src/grid/interaction/adapter/view-interaction.targets.ts` | The target-resolution layer, extracted from `week-interaction.adapter.ts:483-640` and `day-interaction.adapter.ts:434-591` (token-identical apart from the registry instance). Exports `createViewInteractionTargetResolver({ registry, runtime })` → `{ getInteractionTarget }`, preserving the exact precedence all-day-resize → timed-resize → timed-drag → all-day-drag, plus the shared predicates `isViewAllDayTarget` and `isViewDragTarget` (three duplicate copies today: `week-interaction.adapter.ts:755,760`, `day-interaction.adapter.ts:604`, `day-layout.cache.ts:59,73`). |
| A5 | `packages/web/src/grid/interaction/adapter/view-interaction.targets.test.ts` | New. Direct coverage of the resolver: resize-handle precedence, `isAllDay` mismatch rejection (`:599`, `:550`), `hadFormOpenBeforeInteraction` defaulting to `false` when `isFormOpen` is absent, and per-call `runtime()` re-read. |
| A6 | `packages/web/src/grid/interaction/adapter/view-interaction.engine-members.ts` | The three engine-adapter members that are literally identical in both files (`week:342-349` / `day:322-329`), exported as named standalone functions — `viewInteractionDraftEventMount`, `getViewInteractionSourceElement`, `getViewInteractionDraftEventMode` — **not** as an object to spread, so each adapter's engine-adapter literal keeps its alphabetical key order and Biome reformat stays a no-op (NFR-4). |
| A7 | `packages/web/src/grid/interaction/adapter/view-interaction.layout-state.ts` | `createViewInteractionLayoutState()` → `{ applySmartScroll, clear, getLayout, getScrollTop, setLayout }`, extracted from `week:659-666,731-741` and `day:95-96,425-432` (identical). This is the **single owner of the only mutable state that can break `updateVisual` idempotence** — `scrollTop` accumulates across invocations. Its doc comment states that invariant explicitly (FR-6/AC-8). |
| A8 | `packages/web/src/grid/interaction/adapter/view-interaction.core.ts` | `createViewInteractionAdapterCore({ createEngineAdapter, engineOptions, onPointerDownAccepted?, onPointerClickSettled?, ownershipReasons, registry, runtime })` → `{ adapter, engine, getInteractionTarget }`. Owns engine construction and the seven common methods: `ownsPointer`, `connectCancellationEvents`, `handlePointerDown`, `handlePointerMove`, `handlePointerUp`, `handlePointerCancel`, `cancel`. `ownershipReasons` carries the ownership strings verbatim (`"ineligible-week-pointer"` / `"no-week-interaction-target"` vs `"ineligible-day-pointer"` / `"no-day-interaction-target"`); `onPointerDownAccepted` is Week's `setWeekInteractionMotionActive(true)` (`:183`); `onPointerClickSettled` is Week's `setWeekInteractionMotionActive(false)` (`:215`). Day passes neither — that is how AC-6 is enforced at the type level. The `engine` handle is returned so Week can build `rebuildLayoutAfterNavigation` on top; Day never reads it. |
| A9 | `packages/web/src/grid/interaction/adapter/view-interaction.divergence.test.ts` | New, **AC-7's dedicated artifact**. One file that asserts the four essential divergences side by side: Week all-day drag applies a *day delta* to the event's own dates; Day all-day drag *keeps* the event's dates and changes only `calendarId`; Week timed drag writes an absolute *date*; Day timed drag writes `visibleDate` + `columnMoveCalendarId`. Imports both views' commit modules (test-only cross-tree import, both inside the allowlist). |

### Day's lift to Week's shape (Stage 6)

| # | Path | Purpose |
|---|---|---|
| A10 | `packages/web/src/views/Day/interaction/adapter/geometry/day-columns.ts` | `resolveDayColumns({ getColumnKeys, target, visibleDate })` → `{ columnKeys, initialColumnIndex, initialColumnKey }`. Verbatim extraction of `day-interaction.adapter.ts:245-263`, comment at `:246-253` moved with it. Lives in `geometry/` and not `interactions/` because its output feeds the layout-cache build, which happens before any per-interaction visual is created. |
| A11 | `packages/web/src/views/Day/interaction/adapter/interactions/all-day.drag.ts` | `createAllDayDragInteractionVisual` (from `day:280-288`), `updateAllDayDragInteractionVisual` (from `day:339-351`, returns the bare visual), `commitAllDayDragInteraction` (moved verbatim from `commit/all-day.commit.ts:14-37`, signature `(target, visual)` unchanged). |
| A12 | `packages/web/src/views/Day/interaction/adapter/interactions/all-day.resize.ts` | `createAllDayResizeInteractionVisual` (from `day:290-299`, note `endDayIndex: 0` / `startDayIndex: 0` — Day does **not** use `getVisibleAllDayRange`), `updateAllDayResizeInteractionVisual` (from `day:353-367`), `commitAllDayResizeInteraction` (verbatim from `commit/all-day.commit.ts:39-57`, keeps `(target, visual, visibleDate)` and keeps the visibleDate rewrite that FR-7 says stays as-is). |
| A13 | `packages/web/src/views/Day/interaction/adapter/interactions/timed.drag.ts` | `createTimedDragInteractionVisual` (from `day:312-320`), `updateTimedDragInteractionVisual` (from `day:401-411`; returns `{ event, visual }` like Week's, with `event` built by `timedDragVisualToDayGridEvent`), `commitTimedDragInteraction` (verbatim from `commit/timed.commit.ts:17-33`). |
| A14 | `packages/web/src/views/Day/interaction/adapter/interactions/timed.resize.ts` | `createTimedResizeInteractionVisual` (from `day:301-310`), `updateTimedResizeInteractionVisual` (from `day:369-394`; returns `{ event, visual }`), `commitTimedResizeInteraction` (verbatim from `commit/timed.commit.ts:35-51`). |
| A15 | `packages/web/src/views/Day/interaction/adapter/day-interaction.interactions.test.ts` | New, **strictly additive** — Day's existing suite is not touched. Covers the four newly extracted modules directly plus `resolveDayColumns`: single-column fallback when the event's calendar is not among the rendered columns (`day:254-262`), `columnMoveCalendarId` on same-column vs cross-column drops, Day's `"dayDate" in visual` guard (`commit/all-day.commit.ts:18-19`), Day all-day resize rewriting to `visibleDate`/`visibleDate+1`, and **AC-8** for Day. |

### Week's AC-8 artifact (Stage 7)

| # | Path | Purpose |
|---|---|---|
| A16 | `packages/web/src/views/Week/interaction/adapter/week-interaction.idempotence.test.ts` | New 7th Week adapter grouping. Exists as its own file precisely so **none of the six FR-9-protected suites is edited** — `git diff --stat` proving those six untouched is the cheapest possible AC-5 audit. Content: AC-8 double-invocation of `updateVisual`. |

**Added: 16 files** (10 source, 6 test).

---

## 2. Files edited

Packet type is `refactor_extract` where code leaves the file for another module, `patch_apply`
where the edit is surgical and in place.

### Stage 1 — registry (2 files)

| Path | Type | Shape of change |
|---|---|---|
| `packages/web/src/views/Week/interaction/registry/week-event.registry.ts` | `refactor_extract` | Line 8 becomes `const week = VIEW_INTERACTION_MODULES.week;`. Lines 10-24 keep **all nine exports byte-identical in name and order**: `WEEK_INTERACTION_EVENT_ID_ATTRIBUTE`, `WEEK_INTERACTION_EVENT_TYPE_ATTRIBUTE`, `WeekInteractionEventType`, `WeekRegisteredEventTarget`, `WeekEventRegistry`, `getWeekInteractionTargetAttributes`, `createWeekEventRegistry`, `weekEventRegistry`, `useWeekEventRegistrationRef`. `createWeekEventRegistry` **must be kept** — `week-event.registry.test.tsx:301,331` uses it to mint isolated registries. |
| `packages/web/src/views/Day/interaction/registry/day-event.registry.ts` | `refactor_extract` | Same, `VIEW_INTERACTION_MODULES.day`, all nine `Day*` exports preserved. |

### Stage 2 — targeting (2 files)

| Path | Type | Shape of change |
|---|---|---|
| `packages/web/src/views/Week/interaction/targeting/week-event.targeting.ts` | `refactor_extract` | Deletes local `TARGET_SELECTOR` (`:17`) and the local `createGridEventTargeting` call (`:19-23`); the four exports become aliases onto `VIEW_INTERACTION_MODULES.week`. Types `WeekGridEventTargetType` / `WeekGridEventTarget` and exports `getFocusedWeekGridEventTarget`, `getFirstVisibleWeekGridEventTarget`, `listVisibleWeekGridEventTargets`, `focusWeekGridEventTarget` all preserved. |
| `packages/web/src/views/Day/interaction/targeting/day-event.targeting.ts` | `refactor_extract` | Same for `Day*`. The Biome line-wrap artifact at `:18-23` disappears with the code it wrapped. |

### Stage 3 — adapter types (2 files)

| Path | Type | Shape of change |
|---|---|---|
| `packages/web/src/views/Week/interaction/adapter/week-interaction.adapter.types.ts` | `refactor_extract` | `:19-22`, `:50-136` collapse to `export type X = ViewX;` aliases over A3. What stays as a real declaration: `WeekInteractionAdapterOptions` (`:24-28`), `WeekInteractionRuntime` (`:30-48` — it `extends ViewInteractionRuntimeBase` and adds **only** `getVisibleDays(): string[]` and `onRequestWeekNavigation?`), `WeekEdgeNavigableVisual` (`:130`), and `WeekInteractionAdapter` (`:138-149` — `extends ViewInteractionAdapterBase` adding **only** `rebuildLayoutAfterNavigation(): void`). Every exported name survives; this is a type-only packet with zero emitted-JS diff. |
| `packages/web/src/views/Day/interaction/adapter/day-interaction.adapter.types.ts` | `refactor_extract` | Same collapse. Real declarations kept: `DayInteractionAdapterOptions` (`:25-38`, incl. the `getColumnKeys` doc comment at `:27-33`), `DayInteractionRuntime` (`extends ViewInteractionRuntimeBase`, adds nothing), `DayInteractionAdapter = ViewInteractionAdapterBase` — **no** `rebuildLayoutAfterNavigation` (AC-6). |

### Stage 5 — Week adapter (2 files)

| Path | Type | Shape of change |
|---|---|---|
| `packages/web/src/views/Week/interaction/adapter/week-interaction.adapter.ts` | `refactor_extract` | 795 → ~370 LOC. Removed: `:125-131` (`ownsPointer`, `connectCancellationEvents`), `:157-197` and `:241-251` (pointer handlers), `:483-640` (all seven target resolvers), `:659-666` + `:731-741` (smart-scroll + layout state), `:755-763` (`isAllDayTarget`/`isDragTarget`), `:767-781` (`buildWeekLayoutCacheForTarget`, moved into geometry). Retained **in place and unedited in substance**: `rebuildLayoutAfterNavigation` (`:133-155`), the whole `createEngineAdapter` body (`:253-481`) including the edge-nav wiring and the three `"Mismatched Week interaction target"` throws, `updateEdgeNavigation` (`:668-703`), `getLayoutInput` (`:705-710`), `rebuildLayoutIfNeeded` (`:712-725`), `getDraftEventSize` (`:786-793`), and the type re-export block `:83-90` (the coordinator imports commit-result types from here). New body: `const core = createViewInteractionAdapterCore({...}); return { ...core.adapter, rebuildLayoutAfterNavigation };`. **The exported factory name and options shape do not change.** |
| `packages/web/src/views/Week/interaction/adapter/geometry/week-layout.cache.ts` | `patch_apply` | Gains `buildWeekLayoutCacheForTarget` (moved from `week-interaction.adapter.ts:767-781` with its comment at `:765-766`), so it mirrors Day's `buildDayLayoutCacheForTarget`. Re-exports `isViewDragTarget`/`isViewAllDayTarget` from A4 for the adapter's use. No change to any `weekLayoutCacheOptions` value — `WEEK_EDGE_NAVIGATION_THRESHOLD_PX`, `ID_ALLDAY_COLUMNS`, and the smart-scroll tuning stay exactly as at `:41-56`. |

### Stage 6 — Day adapter, commit and geometry (4 files)

| Path | Type | Shape of change |
|---|---|---|
| `packages/web/src/views/Day/interaction/adapter/day-interaction.adapter.ts` | `refactor_extract` | 607 → ~230 LOC. Removed to shared: `:107-113`, `:115-145`, `:147-153`, `:155-205` (handlers), `:425-432` (smart-scroll), `:434-591` (target resolvers), `:604-607` (`isAllDayTarget`). Removed to Day's own new modules: `:245-263` → A10; `:280-320` → A11–A14 `createX`; `:339-420` → A11–A14 `updateX`. Retained: the `createEngineAdapter` skeleton with its `commit` dispatch calling `getVisibleDate()` **once, unconditionally, before the branch** (`:219`) exactly as today, the `"Mismatched Day interaction target"` throws, `inertRuntime` (`:82-86`), and the type re-export block `:73-80`. `createDayInteractionAdapter`'s name and options shape do not change. **Day acquires no edge-navigation, no motion flag, no cross-row math, and no `rebuildLayoutAfterNavigation` import.** |
| `packages/web/src/views/Day/interaction/adapter/commit/all-day.commit.ts` | `refactor_extract` | `commitAllDayDragInteraction` (`:14-37`) and `commitAllDayResizeInteraction` (`:39-57`) move to A11/A12. What remains is Week-shaped: the private mapper `allDayVisualToDayGridEvent` (`:59-67`) becomes **exported**, and the two inline `hasMoved` expressions (`:18-19`, `:44-46`) become named exported predicates `hasDayAllDayDragVisualMoved` / `hasDayAllDayResizeVisualChanged` — mirroring Week's `all-day.commit.ts:7,34`. The `"dayDate" in visual` guard moves with its expression, untouched. |
| `packages/web/src/views/Day/interaction/adapter/commit/timed.commit.ts` | `refactor_extract` | `commitTimedDragInteraction` (`:17-33`) and `commitTimedResizeInteraction` (`:35-51`) move to A13/A14. Retained and unchanged: `timedDragVisualToDayGridEvent` (`:53-69`), `columnMoveCalendarId` (`:71-83`, doc comment included), `timedResizeVisualToDayGridEvent` (`:85-100`), and the `hasTimedDragVisualMoved` / `hasTimedResizeVisualMoved` re-export (`:4-7`) — Week's `timed.commit.ts:10` re-exports the same pair the same way. |
| `packages/web/src/views/Day/interaction/adapter/geometry/day-layout.cache.ts` | `patch_apply` | Deletes the local `isAllDayTarget` (`:59-62`) and the local `isDayDragTarget` body (`:73-76`); `isDayDragTarget` becomes a one-line re-export of A4's `isViewDragTarget` so the existing import surface is untouched even if a consumer outside the files I read depends on it. `buildDayTimedLayoutCache` / `buildDayAllDayLayoutCache` / `buildDayLayoutCacheForTarget` are **not touched** — Day's `edgeThresholdPx: INTERACTION_EDGE_THRESHOLD_PX` vs `0`, and its deliberate absence of `buildDragGridLayoutCache`, are the mechanism by which Day has no cross-row drop and no edge navigation. |

**Edited: 12 files.** Not one of them is outside `views/{Week,Day}/interaction/**`.

### Explicitly NOT edited

- `packages/web/src/interaction/**` — the engine is already correct; the contract at
  `interaction.adapter.types.ts:23-51` is consumed, never modified.
- `packages/web/src/grid/interaction/view-event-registry.ts` — untouched, so
  `CALENDAR_VIEW_INTERACTION_ID_ATTRIBUTES` and its four derived helpers (`:37-66`) keep working for
  `event.util.ts` and `shortcuts/tips/**` (FR-4) with zero risk.
- `packages/web/src/grid/interaction/event.targeting.ts` — the `isVisibleEventElement` rule
  (`:56-62`) is consumed unchanged (FR-5).
- `packages/web/src/views/Week/interaction/state/motion.state.ts`,
  `state/edge-navigation.state.ts`, `adapter/edge-navigation.ts`,
  `useWeekInteractionLayoutSync.ts` — all Week-only features, all untouched (FR-8, Q3).
- `packages/web/src/views/Week/interaction/adapter/interactions/*` (5 files) and
  `adapter/commit/*` (2 files) — already at the target abstraction level; **zero diff**. This is the
  direct consequence of Q1 and the reason Week's six suites can stay byte-identical.
- All 25 call sites (see §6).

---

## 3. Files removed

**None.**

This refactor deletes roughly 700 lines, but every one of them is *intra-file*: duplicated bodies
leave `week-interaction.adapter.ts`, `day-interaction.adapter.ts`, the two `*.adapter.types.ts`, and
Day's two `commit/*` files for the shared substrate, and each of those six files survives with a
smaller, view-specific remainder. Deleting the four view shells
(`registry/*.registry.ts`, `targeting/*.targeting.ts`) was considered and **rejected**: they contain
no logic after Stage 1–2, they are the named import surface for 14 of the 25 call sites, and
deleting them would convert a zero-call-site-edit refactor into a 14-file import churn for no
structural gain. FR-1 and FR-5 ask for one *implementation*, not one *file*, and after Stage 2 the
shells contain only aliases.

---

## 4. Data-layer changes

**None.** No schema, migration, ORM model, store shape, or persisted value is touched. The two
module-level in-memory singletons in play (the per-view event registry, the edge-navigation store)
keep their current lifetimes and identities.

---

## 5. API contract changes

**None.** No HTTP route, request shape, response shape, or network call is touched. The only
"contract" in scope is the in-process `InteractionAdapter<TTarget, TVisual, TResult>` at
`interaction.adapter.types.ts:23-51`, which is satisfied unchanged by both views.

---

## 6. Framework-owned wiring

This repo has **no barrel/index files on this seam** — every consumer imports a deep path. The
equivalent framework-owned wiring is therefore (a) module-scope singleton instantiation and (b) the
exact export surface of each shell. Both must land inside the same packet as the file whose
internals change; an export list that drifts one packet away from its implementation is a broken
build at an intermediate checkpoint, which defeats NFR-6.

**Paired-packet rule for the packet plan:**

1. `view-interaction.module.ts` (A1) and both registry shells ship in **one Stage-1 packet**. The two
   `createViewInteractionRegistry("day"|"week")` literals and both `VIEW_INTERACTION_MODULES.*`
   consumers must exist simultaneously.
2. Both targeting shells ship in **one Stage-2 packet** — `contextMenuLayering.test.tsx` imports both
   views' registries, so a half-migrated pair is observable.
3. `view-interaction.types.ts` (A3) and both `*.adapter.types.ts` collapses ship in **one Stage-3
   packet**.
4. Day's four `interactions/*` modules (A11–A14), `day-columns.ts` (A10), the two `commit/*`
   slimmings and the Day adapter rewrite ship in **one Stage-6 packet** — moving a `commitX` out of
   `commit/` while the adapter still imports it from `commit/` does not compile.

**Import surfaces that must be re-emitted verbatim** (the packet writer treats these as the contract,
not as free-form output):

- `registry/week-event.registry.ts` → 9 exports, `registry/day-event.registry.ts` → 9 exports.
- `targeting/week-event.targeting.ts` → 6 exports, `targeting/day-event.targeting.ts` → 6 exports.
- `adapter/week-interaction.adapter.ts` → `createWeekInteractionAdapter` + the six type re-exports at
  `:83-90`.
- `adapter/day-interaction.adapter.ts` → `createDayInteractionAdapter` + the six type re-exports at
  `:73-80`.
- `state/motion.state.ts` → `isWeekInteractionMotionActive`, `setWeekInteractionMotionActive`
  (the latter is registered in `__tests__/utils/state/reset-stores.ts:42,71`; **that registration is
  not moved**, per Q3).

### The 25 call sites (discovery §3) — verdict per file

Every one is **no edit required**, because the module path and the export name it imports are
preserved by design. The packet plan carries this table so Stage 8 can verify it by `git status`
rather than by inspection.

| Group | File | Imports | Verdict |
|---|---|---|---|
| Week components | `Grid/MainGrid/MainGridEvents.tsx` | `registry/week-event.registry` | unchanged |
| | `Grid/MainGrid/MainGrid.test.tsx` | registry + `state/motion.state` | unchanged |
| | `Grid/MainGrid/MainGridBusyPeriods.test.tsx` | registry | unchanged |
| | `Grid/MainGrid/keyboardEditForm.test.tsx` | registry | unchanged |
| | `Grid/MainGrid/eventReadOnlyInteraction.test.tsx` | registry | unchanged |
| | `Grid/MainGrid/EdgeNavigationIndicators/EdgeNavigationIndicators.tsx` | `state/edge-navigation.state` | unchanged (file untouched) |
| | `Grid/AllDayRow/AllDayEvents.tsx` | registry | unchanged |
| | `Event/Grid/GridEvent/GridEvent.tsx` | `state/motion.state` (`:21`, read `:116`) | unchanged (Q3) |
| | `Draft/grid/GridDraft.tsx` | registry | unchanged |
| Week draft hooks | `Draft/hooks/state/useDraftState.ts` | `@web/interaction/dom/cursor.lock` | unchanged (engine untouched) |
| | `Draft/hooks/actions/draft-drag-schedule.util.ts` (+ test) | `grid/interaction/math/cross-row.drag`, `types/timed-drag.types` | unchanged (math untouched) |
| | `Draft/hooks/actions/useDraftActions.test.ts` | `grid/interaction/math/cross-row.drag` | unchanged |
| Week hooks | `hooks/grid/useVisibleDayCount.ts` (`:2,:28`) | `state/motion.state` | unchanged |
| | `hooks/grid/useGridLayout.ts` (`:2,:7`) | `state/motion.state` | unchanged |
| | `hooks/grid/useDragEdgeNavigation.ts` | `state/edge-navigation.state` + `adapter/edge-navigation` | unchanged |
| | `hooks/grid/useGridEventMouseDown.ts` (+ test) | `interaction.pointer`, `interaction.constants` | unchanged |
| | `hooks/grid/useDragEventSmartScroll.ts` | `interaction.constants` | unchanged |
| | `hooks/shortcuts/useWeekShortcutOwner.ts` | `targeting/week-event.targeting` | unchanged (4 helper names preserved) |
| | `hooks/shortcuts/useWeekShortcutOwner.test.tsx` | `registry/week-event.registry` | unchanged |
| Week root | `WeekView.tsx` | `Week/interaction/WeekInteractionCoordinator` | unchanged (coordinator untouched) |
| Day | `components/Calendar/DayCalendarGrid.tsx` | `Day/interaction/DayInteractionCoordinator` | unchanged |
| | `components/Calendar/DayCalendarEventCards.tsx` | `registry/day-event.registry` | unchanged |
| | `view/DayViewContent.tsx` | `Day/interaction/day-event.focus` | unchanged (`day-event.focus.ts:1-4` imports the two preserved targeting helpers) |
| | `hooks/shortcuts/useDayEventNudgeShortcuts.ts` | `targeting/day-event.targeting` | unchanged |
| | `hooks/shortcuts/useDayEventNudgeShortcuts.test.tsx` | `registry/day-event.registry` | unchanged |
| Cross-view | `components/ContextMenu/contextMenuLayering.test.tsx` | **both** registries | unchanged |
| | `common/utils/event/event.util.ts` | `grid/interaction/view-event-registry` | unchanged (that file is not edited) |
| | `common/utils/event/event.util.test.ts` | `Week/.../week-event.registry` | unchanged |
| | `shortcuts/tips/useIsAnyCalendarEventFocused.ts` | `view-event-registry` | unchanged |
| | `shortcuts/tips/useShortcutTipTrigger.test.tsx` | `view-event-registry` | unchanged |
| | `__tests__/utils/state/reset-stores.ts` (`:42`, `:71`) | `Week/.../state/motion.state` | unchanged (Q3 — the decisive reason the flag does not move) |
| | `grid/components/{TimedEventCard,AllDayEventCard}.tsx` | `grid/interaction/dom` | unchanged |
| Other shared | `grid/hooks/useTimedDraftCreation.ts` | `interaction.pointer` + `interaction.constants` | unchanged |
| | `components/ShortcutShowcase/practice.state.ts` | `grid/interaction/math/snap` | unchanged |

**If any packet produces a diff in any file in this table, the packet is wrong** — it means an export
name or module path drifted, and the fix is in the shell, not in the call site.

---

## 7. Config schema — env variables added

**None.** This is a front-end pointer-interaction refactor; no packet reads `process.env`, adds a
feature flag, or touches `.env*` (off-limits).

---

## 8. Testing surface — the invariants the full suite must preserve

**Baseline to beat:** full `bun test:web` = 2298 pass / 0 fail / 302 files. Seam probe
(`bun test src/views/Week/interaction src/views/Day/interaction src/grid/interaction src/interaction`)
= 159 pass / 0 fail / 497 expects / 24 files.

### 8.1 Which of the 24 seam files move, which are rewritten, which stay untouched

| Bucket | Files | Disposition |
|---|---|---|
| Shared substrate (12 per discovery §4, 11 named there) — `interaction.engine.test.ts`, `PointerCaptureBoundary.test.tsx`, `cursor.lock.test.ts`, `math/cross-row.drag.test.ts`, `commit/cross-row.commit.test.ts`, `view-event-registry.test.ts`, `layout.cache.test.ts`, `math/timed.interaction.test.ts`, `event.registry.test.ts`, `math/smart-scroll.test.ts`, `math/all-day.interaction.test.ts` | 12 | **Untouched, not moved, must stay green at every stage.** `view-event-registry.test.ts:16,23,26,36-39,86,87` asserts the DOM attribute strings — it is the in-suite proxy for FR-3/AC-3 and is deliberately left alone so it remains an independent witness. |
| Week adapter — `week-interaction.timed-drag.test.ts` (14/43), `.cross-row-drag.test.ts` (9/23), `.timed-resize.test.ts` (9/29), `.all-day-drag.test.ts` (8/30), `.all-day-resize.test.ts` (7/23), `.adapter.test.ts` (1/1) | 6 | **Untouched. Not moved, not renamed, not merged, not reformatted.** They drive the public `createWeekInteractionAdapter` (confirmed: `week-interaction.all-day-drag.test.ts:6-8` imports only the factory, the registry, and the edge-nav state), and that factory's name, path, and options shape are all preserved — so they compile and pass against the rewritten internals with a zero-byte diff. **This is the FR-9/AC-5 mechanism: 48 tests / 149 assertions across 6 behavioral groupings, proven preserved by `git diff --stat` showing six untouched paths, not by a recount.** |
| Day adapter — `day-interaction.adapter.test.ts` (14/39) | 1 | **Untouched.** Same argument: it imports `createDayInteractionAdapter` and the commit-result types from `./day-interaction.adapter` (`:6-13`), all preserved. Day's coverage is *added to*, never rewritten — the larger Day diff that Q1 accepted lands in source, not in Day's only green suite. |
| Registry — `week-event.registry.test.tsx` (9/36), `day-event.registry.test.tsx` (6/12) | 2 | **Untouched.** They exercise `useWeekEventRegistrationRef`, `getWeekInteractionTargetAttributes`, `createWeekEventRegistry`, and the `weekEventRegistry` singleton — every one preserved by name. `week-event.registry.test.tsx:249,272,292,296` assert singleton behaviour and are a second independent FR-2 witness alongside A2. |
| Targeting — `week-event.targeting.test.ts` (4/4), `day-event.targeting.test.ts` (4/4) | 2 | **Untouched.** `week-event.targeting.test.ts:34` registers into the `weekEventRegistry` singleton and then reads through the targeting helpers — it fails loudly if Stage 2 ever hands targeting a different registry instance than the one the cards register into. This is the single most valuable existing test for FR-2 and it must run at the Stage-2 checkpoint. |
| Coordinators — `WeekInteractionCoordinator.test.ts` (2/2), `DayInteractionCoordinator.test.tsx` (3/5) | 2 | **Untouched.** Coordinators are out of scope (requirements Out-of-scope 6). |

**Net: zero of the 24 seam files is moved, renamed, rewritten, or edited.** Every one of them is a
regression witness for the stage that lands beside it.

### 8.2 Also untouched, and load-bearing for AC-3

`grid/components/EventCard.test.tsx:64,65,78,356,357,370,371` and
`views/Day/components/Calendar/DayCalendarGrid.test.tsx:529,552` hard-code the interaction attribute
names. They stay untouched and green — the in-suite tripwire for the e2e coupling that `bun test:web`
cannot see.

### 8.3 New assertions required

**AC-8 — `updateVisual` double-invocation idempotence.** Files: A16 (Week), A15 (Day). This must be
specified precisely or codegen will write a test that fails for a legitimate reason and someone will
"fix" it by changing behavior:

- Invoke `updateVisual({ pointer, target, timestamp, visual })` twice with the **same pointer object
  and the same `timestamp`**, and assert the returned `visual` deep-equals across both calls.
- **Choose a pointer outside the smart-scroll band.** `applySmartScroll` (A7, from `week:659-666` /
  `day:425-432`) intentionally accumulates `scrollTop` across invocations; with a pointer inside the
  band, a second invocation legitimately advances the scroll and yields a different visual. That is
  today's behavior in both views and is **not** to be changed. The AC-8 test asserts the contract the
  engine actually relies on (`interaction.adapter.types.ts:37-38`): recomputation from the same
  inputs, with the pointer where the engine's pointerup re-invocation normally happens.
- **Also assert the same `timestamp`.** Week's `updateEdgeNavigation` (`week:668-703`) is
  timestamp-driven; it passes `visual` through untouched on every branch (`:676`, `:695-698`,
  `:699-702`), so the *visual* is idempotent regardless — but pinning the timestamp keeps the test
  asserting one thing.
- Cover all four interaction types per view.

**AC-7 — essential divergence, one assertion each.** File: A9.
- Week all-day drag → **delta**: an event whose visible span was clamped keeps its own start/end
  shifted by `dayjs(visual.dayDate).diff(visual.initialDayDate,"day")`
  (`Week/.../commit/all-day.commit.ts:19-31`), `calendarId` untouched.
- Day all-day drag → **own dates**: `startDate`/`endDate` identical to the input event, `calendarId`
  = `columnMoveCalendarId(visual, event)` (`Day/.../commit/all-day.commit.ts:25-31`). A multi-day
  all-day event is not truncated.
- Week timed drag → absolute **date** from the column (`Week/.../commit/timed.commit.ts:18-24`).
- Day timed drag → `visibleDate` + minutes and a **`calendarId`** change on a cross-column drop
  (`Day/.../commit/timed.commit.ts:53-69,77-83`).

**AC-6 — Day gains nothing.** File: A15, plus the Stage-8 grep. Assert that a Day timed drag whose
pointer sits over the all-day row still commits `timedDragEnd` with times intact (no cross-row
promotion), and that `createDayInteractionAdapter(...)` has no `rebuildLayoutAfterNavigation`
property at runtime.

**FR-2 — registry singleton identity.** File: A2 (see §1).

**New shared-substrate coverage.** File: A5 (target resolution). File: A15 (`resolveDayColumns`
single-column fallback — the branch at `day:254-262` that today has no direct test).

### 8.4 Targets

- Full suite: **≥ 2298 pass / 0 fail**, file count 302 → **307** (5 new test files reachable by the
  runner; A9 is one of them).
- Seam probe: **≥ 159 pass / 0 fail**, expected ≈ 190–200 pass across 29 files.
- Both must be re-run at each stage checkpoint in §10 — the seam probe is the fast gate, the full
  suite is the gate before the run closes.

---

## 9. Off-limits reminders

1. **`e2e/**` — write-off-limits, live blast radius.** `e2e/timed/move-event-reduced-days.spec.ts:38`
   and `e2e/calendars/calendar-experience.spec.ts:456` hard-code `data-week-interaction-event-id`,
   and `bun test:web` does not run them. The plan protects this three ways: `view-event-registry.ts`
   is not edited at all; A1 keeps the literal calls `createViewInteractionRegistry("day")` and
   `createViewInteractionRegistry("week")` in source so AC-3's grep matches verbatim; and
   `view-event-registry.test.ts` + `EventCard.test.tsx` stay untouched as in-suite witnesses.
   **If any packet appears to need an e2e edit, halt and raise it. Do not edit `e2e/**`.**
2. **`.cursor/rules/web-styles.mdc` and `web-testing.mdc`** are read-only inputs whose conventions
   the generated code must match. Never plan a write to them.
3. **`packages/core/**`, `packages/backend/**`, `packages/sync/**`, `packages/scripts/**`,
   `package.json`, `bun.lock`, `patches/**`, `*.env*`, `.github/workflows/**`** — untouched. Nothing
   in this plan adds a dependency (NFR-3).
4. **`.claude/**`, `.codex/**`, `.agents/**`, `AGENTS.md`** — untouched. Note the repo-local
   format-after-edit hooks may reformat written files out of band; every new file must be
   Biome-stable on first write (NFR-4), which is why A6 exports named functions instead of a
   spreadable object (preserving alphabetical key order in the engine-adapter literals).
5. **Closest brush with off-limits:** Stage 6 rewrites `day-interaction.adapter.ts`, whose sibling
   `DayInteractionCoordinator.tsx` is *in* the tree but out of scope by requirements Out-of-scope 6.
   Do not touch it, and do not change `createDayInteractionAdapter`'s options shape, which is what
   the coordinator constructs.
6. **NFR-5 tripwires:** no `any`, no `@ts-expect-error`, and no widening to `unknown` to force one
   signature. The design avoids all three by exploiting the fact that Week's and Day's target,
   visual, and commit-result types are already structurally identical (verified against
   `week-interaction.adapter.types.ts:50-136` / `day-interaction.adapter.types.ts:53-137`), so the
   shared core needs no generic gymnastics. The existing `!` non-null assertions (e.g.
   `target.event._id!`, `columnKeys[initialColumnIndex]!` at `day:263`) move verbatim and are not new.

---

## 10. Cross-cutting sequencing

Eight stages, each a separately revertible packet group, ordered so a failure is attributable to one
concern (NFR-6). **Checkpoint** = run the seam probe; **Full checkpoint** = seam probe + `bun test:web`.

> **Added at Gate 2 by user decision — `bun run type-check` is a gate after EVERY stage**, not only
> Stage 4. The script exists in root `package.json` and covers three passes: the root project, then
> `packages/web/tsconfig.app.json`, then `type-check:web-tests` →
> `packages/web/tsconfig.test.json --noEmit`. Because it includes the **test** tsconfig, it catches
> breakage in moved or rewritten test files, which the seam probe alone would miss until the file is
> executed.
>
> Rationale: this plan claims each stage is separately revertible, and stages 1–2 ∥ 3 and 5 ∥ 6 run in
> parallel. A type error surfacing one stage late, inside a parallel pair, is materially harder to
> attribute to a stage and undermines the revertibility claim. A per-stage type-check restores it.
>
> **If `bun run type-check` fails at a stage, halt that stage and report. Do not push forward hoping a
> later stage fixes it.**
>
> This also retires the Stage 4 weak-checkpoint caveat recorded below. The Phase 2 note that no
> typecheck script could be asserted was wrong — the script exists, so Stage 4's "pure addition,
> nothing imports it, `bun test` cannot prove type validity" gap is now closed by type-check rather
> than accepted as risk. Stage 4's gate below should be read as **Checkpoint + type-check**, and the
> sentence calling its green "weaker than the others" no longer applies.

| Stage | Concern | Contents | Depends on | Gate |
|---|---|---|---|---|
| **1** | registry | A1, A2; edit both `*-event.registry.ts` | — | **Checkpoint, independently green.** `week-event.registry.test.tsx` (9/36) + `day-event.registry.test.tsx` (6/12) + A2 must pass. FR-2 is proven here or nowhere. |
| **2** | targeting | edit both `*-event.targeting.ts` | 1 | **Checkpoint, independently green.** The two targeting suites (4/4 each) register into the singleton and read through the helpers — they fail if Stage 1 handed out two instances. |
| **3** | adapter types | A3; collapse both `*.adapter.types.ts` | — (independent of 1–2) | **Full checkpoint.** Type-only; the emitted JS diff is empty, so any suite movement here is a real defect. |
| **4** | shared adapter substrate | A4, A5, A6, A7, A8 | 3 | **Checkpoint.** Pure addition — nothing imports A4/A6/A7/A8 yet, so behavior cannot move. A5 gives the new resolver its own coverage immediately. Type validity of A8 is only *proven* at Stage 5; this is the one stage whose green is weaker than the others, and it is accepted in exchange for reviewability. |
| **5** | Week adapter | edit `week-interaction.adapter.ts`, `geometry/week-layout.cache.ts` | 4 | **Full checkpoint, and the run's highest-value gate.** Week's six suites (48/149) must pass **with a zero-byte diff**. Any failure here is a defect in A4/A7/A8 or in the Week rewrite — nothing else changed. |
| **6** | Day adapter + commit | A10–A14; edit `day-interaction.adapter.ts`, both Day `commit/*`, `geometry/day-layout.cache.ts` | 4 (not 5 — independent of Week) | **Full checkpoint.** `day-interaction.adapter.test.ts` (14/39) must pass with a zero-byte diff. This is the Q1 diff Day agreed to absorb. |
| **7** | new coverage | A9, A15, A16 | 5, 6 | **Full checkpoint.** AC-7, AC-8, AC-6 assertions land. Suite ≥ 2298 + new; 307 files. |
| **8** | call sites (verification only) | no writes | 7 | AC-3: `grep -r 'createViewInteractionRegistry(' packages/web/src` shows only `"day"` and `"week"` literals; `e2e/` unchanged in `git status`. AC-6: grep for a Day import of `cross-row`, `motion.state`, or `edge-navigation` returns nothing. AC-9: `git status --porcelain` shows no path outside the allowlist and **no path among the 25 call sites in §6**. |

**Parallelism:** Stages 1–2 and Stage 3 are independent; Stages 5 and 6 are independent of each other
once 4 lands. If a stage must be reverted, nothing downstream of it in this table has been written
yet, by construction.

**The three checkpoints that matter most:** Stage 2 (registry identity survives targeting), Stage 5
(Week's 48/149 unchanged), Stage 6 (Day's 14/39 unchanged).

---

## Deferred follow-ups

- **Q2 option (b) — one fully parameterized adapter factory over column resolution and commit
  strategy.** Deferred deliberately, not forgotten. Rationale: (b) removes perhaps another ~150 lines
  but concentrates the remaining risk in exactly the code the brief calls *essential divergence*
  (Week↔date vs Day↔`calendarId`, delta vs own-dates) — it would put FR-6 and FR-7 behind a single
  strategy interface, which is the one place a behavior-preserving refactor cannot afford a mistake.
  Revisit only after (a) has been green on `main` for a release and only with a Week↔Day
  differential test suite (A9 is the seed of that suite) in place first.
- **Day's feature gaps** — cross-row drag, motion flag, edge navigation. Out of scope by decree
  (Out-of-scope 1, AC-6). After this refactor the shared substrate makes each a small, isolated
  feature ticket rather than a fork of Week; that is a benefit of the refactor, not a licence taken
  by it.
- **Day's commit asymmetries** — all-day *resize* rewrites to `visibleDate`
  (`Day/.../all-day.commit.ts:59-67`) while all-day *drag* deliberately does not, and the drag guards
  with `"dayDate" in visual` (`:18-19`). Preserved verbatim per FR-7. Whether the resize behaviour is
  intended is a product question, not a refactor question; file it separately.
