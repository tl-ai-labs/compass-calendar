# Discovery — 20260822-125447-refactor-week-day-interaction

Mode: **refresh** → helper decision **`cached`**.
Baseline at `.sdlc/baseline/current.json` (built 2026-08-20T04:32:08Z, HEAD `4189de13`) matches current HEAD exactly, and no stack manifest changed. Project-wide baseline was **not** rewritten. This file adds a refactor-scoped survey on top of the cached baseline.

## Git state

| field | value |
|---|---|
| HEAD | `4189de1389d8a4644ae20d9c5a907f1d161b5496` |
| branch | `CMP-104/flash-agsdk-only` (cut from `main`, same commit) |
| dirty | no tracked modifications |
| untracked | `.hook-logs/`, `.sdlc/` |
| remote | `origin` → `git@github.com:tl-ai-labs/compass-calendar.git` |
| `.sdlc` gitignored | **no** |

### Note — branch moved since the session snapshot

The session opened on `CMP-103/opus-only-v5` @ `491169d2`; the working tree is now on `CMP-104/flash-agsdk-only` @ `4189de13`. The CMP-103 commit is **not lost** — it exists locally and on `origin/CMP-103/opus-only-v5`. But the paused run `20260822-062945-feature-extend-one-click-join` has **no `state.json`**, so it cannot be resumed by the orchestrator's resume path, and resuming it from this branch would apply CMP-103 work onto a CMP-104 base. Treat that run as closed unless the user says otherwise.

## Stack & size

Bun monorepo (`bun@1.3.14`), Bun workspaces (`packages/*`) plus `lerna.json`. TypeScript + React. Lint/format via Biome. Type-check pinned to `typescript@7.0.2`.

Packages: `backend`, `core`, `scripts`, `sync`, `web`. Refactor is entirely inside `packages/web`.

- tracked files: 1,582
- `packages/web` TS/TSX: 939
- refactor scope source: 6,321 LOC; matching tests: 6,315 LOC

Path aliases: `@web/*` → `packages/web/src/*`, `@core/*` → `packages/core/src/*`. Imports in scope use the aliases, not deep relatives (except within a directory).

## Test command & baseline status

- Scoped (what Phase 7 should use): **`bun run test:web`**
- Full: `bun test` (runs core, sync, web, backend, scripts — needs Mongo for several)

Both captured green **before** any changes:

| scope | result |
|---|---|
| `bun run test:web` | **2298 pass / 0 fail**, 302 files, 86.5s |
| interaction dirs only | **159 pass / 0 fail**, 83 files, 3.6s |

Pre-existing noise: React `act(...)` warnings from `SettingsModal` in `DayInteractionCoordinator.test.tsx`. Not failures; do not "fix" as part of this refactor.

## Refactor file map — verified and corrected

The candidate map was broadly right about *where* things live, but **wrong about which layers are still duplicated**. Two of the four named layers are already unified.

### Already unified — do not re-unify

`grid/interaction/view-event-registry.ts` carries an explicit comment: *"Day and Week previously hand-rolled identical copies of this wiring; this factory is the single source of it."*

| shared module | per-view files | status |
|---|---|---|
| `packages/web/src/grid/interaction/view-event-registry.ts` | `Week/interaction/registry/week-event.registry.ts` (24 L), `Day/interaction/registry/day-event.registry.ts` (24 L) | **Done.** Per-view files are pure re-export shims over `createViewInteractionRegistry(viewName)`. Only 4 lines differ after name normalization — all the literal `"week"` / `"day"` argument and export names. |
| `packages/web/src/grid/interaction/event.targeting.ts` | `Week/interaction/targeting/week-event.targeting.ts` (35 L), `Day/interaction/targeting/day-event.targeting.ts` (35 L) | **Done.** Shims over `createGridEventTargeting({registry, targetSelector})`. 16 differing lines, all naming plus one gratuitous formatting difference in the Day generic call. |
| `packages/web/src/grid/interaction/layout.cache.ts` | both `geometry/*-layout.cache.ts` | **Partly done.** Both views call the same `buildTimedGridLayoutCache` / `buildAllDayGridLayoutCache` builders. |
| `packages/web/src/grid/interaction/commit/timed-moved.ts` | both `commit/timed.commit.ts` | **Done.** Both import the shared `hasTimedDragVisualMoved` / `hasTimedResizeVisualMoved`. |

Collapsing the registry/targeting shims further buys ~120 LOC and costs every call site its view-specific name. Low value; recommend leaving them.

### Genuinely duplicated — the real targets

| Week | Day | LOC | note |
|---|---|---|---|
| `adapter/week-interaction.adapter.ts` | `adapter/day-interaction.adapter.ts` | 795 / 607 | The bulk of the duplication. Both build an `InteractionAdapter`; 448 differing lines after normalization, but much of that is Week-only features rather than divergent copies of the same logic. |
| `adapter/week-interaction.adapter.types.ts` | `adapter/day-interaction.adapter.types.ts` | 149 / 149 | **Best first target.** Only 24 differing lines after normalization. The target/visual/commit-result union types are structurally identical. |
| `adapter/geometry/week-layout.cache.ts` | `adapter/geometry/day-layout.cache.ts` | 73 / 76 | Both wrap the same shared builders with the same constants (`ID_GRID_MAIN`, `GRID_TIME_STEP`, `TIMED_VISIBLE_HOURS`, smart-scroll insets). Differ in edge threshold source and in what extra input they take. |
| `WeekInteractionCoordinator.tsx` | `DayInteractionCoordinator.tsx` | 217 / 133 | Week carries extra edge-navigation and layout-sync wiring. |

### NOT duplication — divergent by design

The commit layers were in the candidate list as duplicates. They are not. They differ in **both shape and semantics**:

- **Shape.** Week's `commit/*.commit.ts` export pure transforms (`allDayDragVisualToGridEvent`, `timedDragVisualToGridEvent`) and let the adapter wrap the result. Day's export whole commit functions (`commitAllDayDragInteraction(target, visual, visibleDate) → CommitResult`) that already build `{event, eventId, hadFormOpenBeforeInteraction, hasMoved, type}`.
- **Semantics.** In Week a column is a **day**; in Day a column is a **calendar**. So:
  - Week all-day drag applies a *day delta* to `startDate`/`endDate`.
  - Day all-day drag **must not touch dates at all** — it changes `calendarId`. There is an explicit comment: *"rewriting them to the visible date would truncate a multi-day all-day event to a single day."*
  - Day timed drag sets `calendarId` via `columnMoveCalendarId(...)` and pins the date to `visibleDate`.

### Critical risk for the refactor

`TimedDragVisual.dayDate` is **overloaded**. In Week it holds a `YYYY-MM-DD` date. In Day it holds a **`CalendarId`** — see `day-interaction.adapter.ts` lines ~258-313 (`initialColumnKey` comes from `columnKeys`, which are calendar ids) and the documented cast in `Day/.../commit/timed.commit.ts`:

```ts
export const columnMoveCalendarId = (
  visual: Pick<TimedDragVisual, "dayDate" | "initialDayDate">,
  event: GridEvent,
): CalendarId | undefined =>
  visual.dayDate !== visual.initialDayDate
    ? (visual.dayDate as CalendarId)
    : event.calendarId;
```

A shared engine that assumes `dayDate` is a date will silently break Day-view cross-calendar drag, and the type system will not catch it — both are `string`. **Any unification must first give the column key a view-parameterised type** (e.g. `TColumnKey` generic, or branded `DateColumnKey | CalendarColumnKey`) before merging commit logic.

### Asymmetric surface (also missing from the candidate map)

Week-only, no Day counterpart:
- `adapter/interactions/{all-day.drag,all-day.resize,all-day.visible-range,timed.drag,timed.resize}.ts` — Week's adapter is decomposed into per-interaction modules; Day's is monolithic. **This is arguably the better shape to unify toward.**
- `adapter/edge-navigation.ts`, `state/edge-navigation.state.ts`, `state/motion.state.ts`, `useWeekInteractionLayoutSync.ts`
- Runtime hooks `getVisibleDays()`, `onRequestWeekNavigation`, `rebuildLayoutAfterNavigation()`, type `WeekEdgeNavigableVisual`

Day-only:
- `day-event.focus.ts`
- Runtime hooks `getColumnKeys()`, `getVisibleDate()`

### Shared engine — confirmed target, current API

`packages/web/src/interaction/interaction.engine.ts` is the right engine. Surface is small:

- `createInteractionEngine<TTarget, TVisual, TResult>(...)`
- `InteractionEngine<TTarget, TVisual, TResult>`, `InteractionEngineSchedulerOptions`, `InteractionCancellationTargets`

The contract both views already implement is `InteractionAdapter<TTarget, TVisual, TResult>` in `interaction.adapter.types.ts`: `getTarget`, `getSourceElement`, `getSourceElementDraftEventMode?`, `createVisual`, `getDraftEventMount`, `updateVisual` (documented as **must be idempotent** — the engine re-invokes at pointerup before commit), `commit`, `cancel?`.

So the engine is already generic and already shared. **The gap is not the engine — it is that `grid/interaction/` stops short of covering the adapter/commit layer.** The natural move is to widen `grid/interaction/` (which already holds `event.registry`, `event.targeting`, `view-event-registry`, `layout.cache`, `adapter.helpers`, `math/`, `commit/`, `types/`) with a view-parameterised adapter factory, not to push Week/Day logic down into `src/interaction/`.

### Blast radius — external consumers

19 files import `views/Week/interaction`, 6 import `views/Day/interaction` (full list in `baseline.json`). Notable cross-view consumers that would need care:
- `packages/web/src/components/ContextMenu/contextMenuLayering.test.tsx` (imports both)
- `packages/web/src/__tests__/utils/state/reset-stores.ts`
- `packages/web/src/common/utils/event/event.util.test.ts`
- `packages/web/src/views/Forms/hooks/useCloseEventForm.test.ts`

`view-event-registry.ts` also exports `CALENDAR_VIEW_INTERACTION_ID_ATTRIBUTES` and `readCalendarEventIdFromElement`, used by context menus and undo focus-restore to resolve an event id without knowing the view. Renaming the `data-${view}-interaction-event-*` attribute scheme would break those.

## Detected AI/agent setup

| path | type |
|---|---|
| `.claude/settings.json`, `.claude/settings.local.json`, `.claude/launch.json` | Claude Code project config |
| `.cursor/rules/*.mdc` (web-styles, web-testing, imports-and-packages, sync-package) | Cursor rules |
| `.cursor/hooks.json`, `.cursor/hooks/format-after-edit.ts` | Cursor format-on-save hook |
| `AGENTS.md` | agent instructions |

No `.mcp.json`, no repo-local `routing-policy.yaml`, no aider/continue/roo config.

## Coexistence risks

- **Cursor rules + format-after-edit hook.** `.cursor/hooks/format-after-edit.ts` reformats on edit. If Cursor is open on this repo while the run writes files, our output may be reformatted underneath us and produce diff churn. Untouched by the plugin either way.
- **`.sdlc/` and `.hook-logs/` are not gitignored.** Both are untracked and visible to `git add -A`. A refactor run writes `backups/<file>` under `.sdlc/`, which will echo source content of every file touched. Gate 0 should offer to add `.gitignore` to this run's allowlist so the entries can be added.
- **Write-contract hook may not be firing.** `.hook-logs/` is present but was previously observed to contain no `write.allow` / `write.deny` entries. Verify the hook is registered before trusting Gate-0 allowlists on a refactor this wide.
- **Stale paused run.** `20260822-062945-feature-extend-one-click-join` has no `state.json` and belongs to a different branch/ticket.

## Regulated-repo signals

Only `SECURITY.md` at repo root — a standard OSS vulnerability-disclosure file, not a compliance obligation marker. No HIPAA/PCI/SOC2/GDPR docs, no compliance CODEOWNERS. **No warning required.** No env files exist in the repo at all, so no env key names were collected.

## Submodules / LFS

None. No `.gitmodules`, no LFS filters in `.gitattributes`.

## Infra

`.github/workflows/` present. No Dockerfile, docker-compose, terraform, or GitLab CI.

## Proposed off-limits

```
.env  .env.*  .mcp.json
.cursor/**  .claude/**
.sdlc/**  .git/**  .hook-logs/**
node_modules/**  dist/**  build/**
```

Plus, recommended for this run specifically: `packages/backend/**`, `packages/sync/**`, `packages/scripts/**`, `packages/core/**` — the refactor is confined to `packages/web/src/{interaction,grid/interaction,views/Week/interaction,views/Day/interaction}`.

## Cost-projection inputs for Gate 0

- 1,582 tracked files; 939 TS/TSX in `packages/web`
- in-scope source: 6,321 LOC across ~60 files; in-scope tests: 6,315 LOC
- likely-touched files: ~12 source + ~14 test
- verification loop: `bun run test:web`, 86.5s, currently 2298/2298 green
- type-check is a separate slow gate: `bun run type-check` (three `tsc` passes, pinned 7.0.2)
