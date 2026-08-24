# Requirements Document: Refactor & Unify Week/Day Interaction Adapter Layers

> **rev-3 (final delivered scope).** FR-3, FR-6 (cut at Gate 2) and **FR-4 (cut mid-execution)**
> are all **DEFERRED to a follow-up ticket**. FR-4 was dropped after the run hit two
> environment-level vendor failures: it was the only remaining step that moves *runtime* code
> rather than types, and it touches both large adapters. **Delivered scope is FR-1 + FR-2 + FR-5**
> — a pure type-safety and type-deduplication change with no runtime edits. Affected below:
> §1 items 4 and 6, §4 FR-3/FR-4/FR-6, §7 acceptance criterion 8. All invariants (§3) still apply in full.

## 1. Scope of Change
1. `packages/web/src/views/Week/interaction/adapter/week-interaction.adapter.types.ts` & `packages/web/src/views/Day/interaction/adapter/day-interaction.adapter.types.ts`: Unify common interaction target, visual, and commit-result type definitions into shared generic definitions under `packages/web/src/grid/interaction/types/` (or `packages/web/src/grid/interaction/adapter.types.ts`).
2. `packages/web/src/grid/interaction/**`: Widen the shared grid interaction infrastructure to supply reusable adapter factories, lifecycle helpers, and view-parameterized column key types.
3. `packages/web/src/interaction/interaction.adapter.types.ts`: Apply narrow type-level updates only if required to support branded or parameterized column keys in the shared `InteractionAdapter` interface.
4. `packages/web/src/views/Week/interaction/adapter/week-interaction.adapter.ts` & `packages/web/src/views/Day/interaction/adapter/day-interaction.adapter.ts`: Establish the column-key branding boundary (FR-1) and adopt the shared adapter lifecycle helpers (FR-4). **Scope-cut at Gate 2:** aligning Day's monolithic adapter to Week's decomposed `adapter/interactions/*` architecture is deferred (see FR-3).
5. `packages/web/src/views/Week/interaction/geometry/week-layout.cache.ts` & `packages/web/src/views/Day/interaction/geometry/day-layout.cache.ts`: Unify layout cache wrappers over `packages/web/src/grid/interaction/layout.cache.ts` by abstracting edge thresholds and view inputs.
6. ~~`packages/web/src/views/Week/interaction/WeekInteractionCoordinator.tsx` & `packages/web/src/views/Day/interaction/DayInteractionCoordinator.tsx`: Consolidate duplicated coordinator lifecycle and event-binding logic while preserving view-specific hooks.~~ **DEFERRED at Gate 2 (see FR-6).** Neither coordinator is modified by this run.
7. Co-located test suites: Update and verify test files including `packages/web/src/views/Week/interaction/**/*.test.{ts,tsx}`, `packages/web/src/views/Day/interaction/**/*.test.{ts,tsx}`, `packages/web/src/grid/interaction/**/*.test.{ts,tsx}`, and `packages/web/src/components/ContextMenu/contextMenuLayering.test.tsx`.
8. `.gitignore`: Add `.sdlc/backups/**` to avoid diff noise from refactoring run backups.

## 2. Out of Scope
1. Do not merge commit logic in `packages/web/src/views/Week/interaction/commit/*.commit.ts` and `packages/web/src/views/Day/interaction/commit/*.commit.ts` — Week (columns = days, day deltas) and Day (columns = calendars, calendar reassignment) commit semantics are divergent by design.
2. Do not modify or further collapse the already-unified event registry shims (`week-event.registry.ts`, `day-event.registry.ts`) or event targeting shims (`week-event.targeting.ts`, `day-event.targeting.ts`).
3. Do not modify files in `packages/core/**` (e.g., `packages/core/src/types/event.contracts.ts`), `packages/backend/**`, `packages/sync/**`, or `packages/scripts/**` — no cross-package changes.
4. Do not modify `packages/web/src/interaction/interaction.engine.ts`, which is already generic and stable.
5. Do not fix or suppress pre-existing React `act(...)` warning noise originating from `SettingsModal` in `DayInteractionCoordinator.test.tsx`.
6. Do not introduce any new user-facing features, UI/UX changes, or unrelated code cleanup.
7. **(added rev-2)** Do not decompose `day-interaction.adapter.ts` into per-interaction modules — deferred (FR-3).
8. **(added rev-2)** Do not modify `WeekInteractionCoordinator.tsx` or `DayInteractionCoordinator.tsx` — deferred (FR-6).

## 3. Invariants to Preserve
- **INV-1: Timed and All-Day Drag Visuals & Constraints**: In both Week and Day views, pointer drag interactions for timed and all-day events must produce identical drag visual dimensions, snapping increments, coordinate math, and boundary constraints as baseline.
- **INV-2: Timed and All-Day Resize Behavior**: In both views, resizing top/bottom edges of timed events and start/end boundaries of all-day events must calculate identical time/date boundaries without visual drift or rounding errors.
- **INV-3: Keyboard Navigation and Cancellation**: Keyboard navigation, focus management, interaction cancellation via `Escape`, and post-undo focus restoration must remain identical to baseline across both views.
- **INV-4: Week Column Semantics (Columns = Days)**: In Week view, moving an event across columns must calculate a day delta, updating `startDate` and `endDate` while strictly preserving the event's `calendarId`.
- **INV-5: Day Column Semantics (Columns = Calendars)**: In Day view, moving an event across columns must update the event's `calendarId` to the target column's calendar ID while preserving its date bounds.
- **INV-6: Day All-Day Date Preservation**: In Day view, dragging an all-day event across calendar columns must NEVER rewrite `startDate` or `endDate` to the visible date, preventing multi-day all-day events from truncating to a single day.
- **INV-7: Day Timed Drag Date Pinning**: In Day view, dragging a timed event across columns must pin the event date to `visibleDate` and reassign `calendarId` via `columnMoveCalendarId` without altering event duration.
- **INV-8: `updateVisual` Idempotence**: In accordance with the `InteractionAdapter` contract, calling `updateVisual` repeatedly with identical pointer coordinates (including the engine's re-invocation on `pointerup` prior to commit) must be completely idempotent and produce deterministic visual state with no side effects.
- **INV-9: DOM Data-Attribute Scheme and Event Resolution**: The DOM attribute schema `data-${view}-interaction-event-*` and helper `readCalendarEventIdFromElement` / `CALENDAR_VIEW_INTERACTION_ID_ATTRIBUTES` in `view-event-registry.ts` must remain unchanged so context menus and undo handlers resolve event IDs without view coupling.
- **INV-10: Week Edge Navigation and Dynamic Layout**: Week view horizontal edge dragging near viewport bounds must continue triggering week navigation and layout recalculation (`rebuildLayoutAfterNavigation`) without resetting active drag visual state.

## 4. Functional Requirements
- **FR-1 (Prerequisite): Disambiguate `TimedDragVisual.dayDate` with Branded/Parameterized Types**: Replace the overloaded `string` type for `TimedDragVisual.dayDate` and `initialDayDate` with a branded or view-parameterized type (e.g., `DateColumnKey` for Week vs `CalendarColumnKey` / `CalendarId` for Day, or a `TColumnKey` generic parameter). Update `columnMoveCalendarId` and call sites so that assigning a calendar ID where a date string is expected (or vice versa) produces a compile-time type error.
- **FR-2: Unified Adapter Types Definition**: Merge structural types between `week-interaction.adapter.types.ts` and `day-interaction.adapter.types.ts` into shared generic types in `packages/web/src/grid/interaction/types/`.
- **FR-3 (DEFERRED — not in this run)**: ~~Decompose Day Interaction Modules: refactor `day-interaction.adapter.ts` from a monolithic structure into modular interaction handlers matching Week's structure (`adapter/interactions/{timed.drag,timed.resize,all-day.drag,all-day.resize}.ts`).~~ Cut at Gate 2. `day-interaction.adapter.ts` is still touched for the FR-1 branding boundary and FR-4 helper adoption, but its structure is left monolithic.
- **FR-4 (DEFERRED — not in this run)**: ~~Shared Adapter Lifecycle Helpers: extract common adapter lifecycle routines (target resolution, draft mounting, cancellation handling) into `packages/web/src/grid/interaction/`.~~ Cut mid-execution. It was the only remaining step that would have edited runtime code in the two large adapters; deferred to the same follow-up ticket as FR-3/FR-6.
- **FR-5: Unified Layout Cache Wrappers**: Consolidate `geometry/week-layout.cache.ts` and `geometry/day-layout.cache.ts` to share common initialization logic from `grid/interaction/layout.cache.ts` while parameterizing view-specific edge thresholds.
- **FR-6 (DEFERRED — not in this run)**: ~~Harmonized Interaction Coordinators: extract common coordinator hooks, pointer lifecycle attachment, and draft visual synchronization between `WeekInteractionCoordinator.tsx` and `DayInteractionCoordinator.tsx` while keeping view-specific extensions isolated.~~ Cut at Gate 2. Neither coordinator `.tsx` is modified by this run; their tests remain as regression guards for INV-3 and INV-10.

## 5. Non-Functional Requirements
- **NFR-1: Zero Behavioral Regressions**: All drag, resize, commit, cancel, and keyboard interaction behaviors must remain functionally identical to baseline.
- **NFR-2: Clean Type-Check**: `bun run type-check` (TypeScript 7.0.2) must pass cleanly with 0 errors across all monorepo workspaces without resorting to `any` casts or type suppression.
- **NFR-3: Clean Linting**: `bun run lint` (Biome) must pass with 0 errors and 0 warnings.
- **NFR-4: No Cross-Package Modifications**: Changes must be strictly confined to `packages/web/**` (and `.gitignore`). No edits to `packages/core/**`, `packages/backend/**`, `packages/sync/**`, or `packages/scripts/**`.
- **NFR-5: Public API & Attribute Stability**: Public function signatures, exported constants, and DOM attribute schemas (`data-*-interaction-event-*`) used outside interaction modules must remain stable and backward-compatible.

## 6. Risk Register
| Risk ID | Risk Description | Likelihood | Blast Radius | Mitigation |
|---|---|---|---|---|
| **R-1** | `TimedDragVisual.dayDate` overloading causes silent data corruption during Day view cross-calendar drag | High | High | Implement FR-1 as a strict prerequisite before adapter unification; enforce static distinction between `DateColumnKey` and `CalendarColumnKey`; verify with Day timed commit unit tests. |
| **R-2** | Day view all-day drag accidentally rewrites dates to `visibleDate`, truncating multi-day events | Medium | High | Keep `commit/*.commit.ts` strictly separate (out of scope); enforce INV-6 with targeted regression assertions verifying date invariance during calendar moves. |
| **R-3** | Violation of `updateVisual` idempotence leads to visual jump or state drift on `pointerup` pre-commit | Low | Medium | Enforce INV-8; ensure visual calculation functions remain pure and free of cumulative side effects. |
| **R-4** | Inadvertent DOM data-attribute changes break context menus or undo focus restoration | Medium | Medium | Maintain exact `CALENDAR_VIEW_INTERACTION_ID_ATTRIBUTES` and `data-${view}-interaction-event-*` formats; verify against `contextMenuLayering.test.tsx`. |
| **R-5** | Coordinator refactoring breaks Week edge navigation or layout sync | Medium | Medium | Keep `edge-navigation.ts`, `edge-navigation.state.ts`, and `useWeekInteractionLayoutSync.ts` as Week-specific coordinator extensions. |
| **R-6** | Type-check failures across multi-pass compilation due to complex generics | Medium | Low | Run `bun run type-check` continuously; prefer explicit generic parameters (`TColumnKey`) over deep conditional types. |

## 7. Acceptance Criteria
1. `bun run test:web` passes with baseline count preserved (>= 2298 tests passing, 0 failing across 302 test files).
2. Interaction test suite subset (`packages/web/src/views/Week/interaction/**/*.test.*`, `packages/web/src/views/Day/interaction/**/*.test.*`, `packages/web/src/grid/interaction/**/*.test.*`) passes with 159/159 tests passing and 0 failures.
3. Integration test `packages/web/src/components/ContextMenu/contextMenuLayering.test.tsx` passes with 0 failures.
4. `bun run type-check` exits with code 0 across all workspaces with no type errors.
5. `bun run lint` exits with code 0 with no lint violations.
6. `TimedDragVisual.dayDate` is statically typed with a branded or view-parameterized column key type, preventing cross-assignment between date strings and calendar IDs at compile time.
7. Type duplication between `week-interaction.adapter.types.ts` and `day-interaction.adapter.types.ts` is eliminated in favor of shared generic types in `packages/web/src/grid/interaction/`.
8. ~~`packages/web/src/views/Day/interaction/adapter/` is decomposed into modular interaction files mirroring Week's architecture.~~ **DEFERRED at Gate 2 — not an acceptance criterion for this run.**
9. Commit modules (`packages/web/src/views/Week/interaction/commit/` and `packages/web/src/views/Day/interaction/commit/`) remain unmerged, preserving Week day deltas and Day calendar reassignments.

## 8. Open Questions for HITL
1. **Column Key Parameterization Approach**: Is a generic parameter on visual types (e.g., `TimedDragVisual<TColumnKey = string>`) preferred, or should we use explicit branded types (e.g., `type DateColumnKey = string & { readonly __brand: unique symbol }` vs `type CalendarColumnKey = CalendarId`)?
2. **Day Interaction Decomposition Location**: Should Day's decomposed interaction modules be placed in `packages/web/src/views/Day/interaction/adapter/interactions/` to match Week's structure, or should identical interaction logic be hoisted directly into `packages/web/src/grid/interaction/adapter/`?
3. **Placement of Shared Adapter Types**: Should unified adapter types be placed in `packages/web/src/grid/interaction/types/adapter.types.ts` or directly in `packages/web/src/grid/interaction/adapter.types.ts` alongside `adapter.helpers.ts`?
