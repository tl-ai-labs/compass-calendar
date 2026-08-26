# Discovery — 20260826-115739-refactor-week-day-interaction

- **Mode:** refresh → decision `incremental`
- **Baseline reused:** `.sdlc/baseline/current.json` (built 2026-08-20T04:32:08Z at `4189de1`), 2 commits behind
- **Delta since baseline:** 9 files, all `.sdlc/**` plus `.gitignore`. No source, no stack manifest, no policy change.
- **Re-scanned groups:** 1 (git state), 6 (AI config presence), 4 (test command). Groups 2/3/5/7/8/9 merged verbatim from baseline.
- **Intent:** `refactor` — unify duplicated Week and Day interaction adapter / commit / targeting / registry layers on the shared interaction engine.

## Git state

| Field | Value |
|---|---|
| HEAD | `2d81253ab8a4c8e69b27e28d12c6ae9cc61d1bfe` |
| Branch | `CMP-104/opus-only-v5` (**not** `main`; baseline was captured on `main`) |
| Dirty | yes — `.claude/settings.json`, `.sdlc/pre-check-status.json`, `.sdlc/project.json` |
| Remote | `origin git@github.com:tl-ai-labs/compass-calendar.git` |
| `.gitignore` covers `.sdlc/` | **no** (only `_gemini_worker_save/` + `local/debug.log`) |

No modified file is in `packages/web` source, so the refactor starts from a clean source tree.

## Detected stacks

Unchanged from baseline: Bun 1.3.14 / TypeScript 7.0.2 monorepo (lerna + bun workspaces, `packages/*`), React 18 web app. Aliases `@web/* -> packages/web/src/*`, `@core/* -> packages/core/src/*`. Cached `stack-profile.md` stays authoritative — no manifest changed.

## Test command

`bun test:web` → `bun packages/scripts/src/testing/test-parallel.ts web --`. **Confirmed present** in root `package.json#scripts`.

Full suite was **not** re-run. A seam-scoped probe was run instead:

```
cd packages/web && bun test src/views/Week/interaction src/views/Day/interaction src/grid/interaction src/interaction
→ 159 pass / 0 fail / 497 expect() calls / 24 files / 7.45s
```

No pre-existing failures on this seam. (React `act()` warnings appear on stderr; they are noise, not failures.)

---

# Targeted mapping — Week/Day interaction seam

## 1. The shared substrate that already exists

### `packages/web/src/interaction/` — view-agnostic pointer engine (2 240 LOC)

The generic gesture engine. Knows nothing about calendars.

- `interaction.engine.ts:1-604` — `createInteractionEngine`, the pointer state machine (`idle → pending → motion → commit/cancelled`), hold-timer activation, pointer capture, `rebindPreparedSource`, `connectCancellationEvents`.
- `interaction.types.ts:1-41` — `InteractionPhase`, `InteractionPoint`, `InteractionSession`, `InteractionPointerUpResult`.
- `interaction.adapter.types.ts:23-51` — **the contract every view adapter implements.**
- `interaction.pointer.ts`, `interaction.constants.ts`, `interaction.metrics.ts`.
- `dom/` — `cursor.lock.ts`, `draft-event.ts`, `draft-event.clone.ts`, `source-element.visibility.ts`.
- `react/PointerCaptureBoundary.tsx` — React boundary both coordinators wrap children in.

**The adapter contract** (`interaction.adapter.types.ts:23-51`), generic over `<TTarget, TVisual, TResult>`:

| Member | Line | Required |
|---|---|---|
| `getTarget(event)` | `:24` | yes |
| `getSourceElement(target)` | `:25` | yes |
| `getSourceElementDraftEventMode?(target)` | `:26` | no |
| `createVisual({pointerStart, sourceElement, target})` | `:27-31` | yes |
| `getDraftEventMount({sourceElement, target, visual})` | `:32-36` | yes |
| `updateVisual({pointer, target, timestamp, visual})` | `:39-48` | yes — **must be idempotent** (`:37-38`), engine re-invokes at pointerup |
| `commit({target, visual})` | `:49` | yes |
| `cancel?({target, visual})` | `:50` | no |

### `packages/web/src/grid/interaction/` — calendar-grid substrate (2 573 LOC)

Genuinely shared by both views today:

- `adapter.helpers.ts:11-12` shared smart-scroll tuning; `:20-33` `getSavedEventOwnershipReason`; `:35-47` `getSavedEventInteractionCursor`; `:49-58` `readElementRect`; `:65-100` `applySmartScroll`.
- `event.registry.ts:1-112` + `view-event-registry.ts:1-128` — `createViewInteractionRegistry(viewName)` factory emitting `data-${viewName}-interaction-event-{id,type}` attributes (`view-event-registry.ts:27-28`).
- `event.targeting.ts:9-54` — `createGridEventTargeting({registry, targetSelector})` factory returning focus/list/first-visible helpers.
- `layout.cache.ts:1-218` — `buildTimedGridLayoutCache`, `buildAllDayGridLayoutCache`, `buildDragGridLayoutCache`, `getNearestDayColumn`, `GridLayoutCacheSources`.
- `math/` — `all-day.drag.ts`, `all-day.resize.ts`, `timed.drag.ts`, `timed.resize.ts`, `cross-row.drag.ts`, `smart-scroll.ts`, `drag-column.ts`, `snap.ts`.
- `commit/timed-moved.ts` (`hasTimedDragVisualMoved`, `hasTimedResizeVisualMoved`), `commit/cross-row.commit.ts`.
- `types/` — `all-day-drag.types.ts`, `all-day-resize.types.ts`, `timed-drag.types.ts`, `timed-resize.types.ts`. **Both views already share the visual types.**

**Verdict:** the substrate is in good shape. All geometry, math, visual types, registry/targeting factories and smart-scroll are already shared. What is duplicated in the view layers is *wiring*, not algorithms.

## 2. The two parallel view layers, concern by concern

`views/Week/interaction/` = 26 files / 5 428 LOC. `views/Day/interaction/` = 13 files / 2 375 LOC.

### Concern A — registry: **100 % mechanical duplicate**

- Week `registry/week-event.registry.ts:1-24`, Day `registry/day-event.registry.ts:1-24`.
- A line-by-line diff is a pure `week`↔`day` token substitution. Both are thin re-export shells over `createViewInteractionRegistry("week"|"day")` (`week-event.registry.ts:8` / `day-event.registry.ts:8`).
- **Only genuine difference:** the string literal `"week"` vs `"day"`.

### Concern B — targeting: **100 % mechanical duplicate**

- Week `targeting/week-event.targeting.ts:1-35`, Day `targeting/day-event.targeting.ts:1-35`.
- Identical shape: build `TARGET_SELECTOR` from the registry's two attributes (`:16` both), call `createGridEventTargeting` (`:18` / `:18-23`), re-export the four helpers under view-prefixed names.
- The only textual delta beyond naming is a Biome line-wrap artifact at `day-event.targeting.ts:18-23`.

### Concern C — adapter: **structurally parallel, ~82 % line-identical**

- Week `adapter/week-interaction.adapter.ts:1-795`, Day `adapter/day-interaction.adapter.ts:1-607`.
- Normalizing `week`↔`day` tokens, **499 of Day's 607 lines have an identical counterpart in Week**.
- The public surface is the same modulo one method:

| Member | Week | Day |
|---|---|---|
| `ownsPointer` | `:125-127` | `:107-109` |
| `connectCancellationEvents` | `:129-131` | `:111-113` |
| `handlePointerDown` | `:157-189` | `:115-145` |
| `handlePointerMove` | `:191-197` | `:147-153` |
| `handlePointerUp` | `:199-239` | `:155-193` |
| `handlePointerCancel` | `:241-257` | `:195-211` |
| `rebuildLayoutAfterNavigation` | `:133-155` | **absent** |

- The engine-adapter object is built in the same order in both (`cancel` `:259`/`:213`, `commit` `:264`/`:217`, `createVisual` `:291`/`:244`, `getDraftEventMount` `:342`/`:322`, `getSourceElement` `:347`/`:327`, `getSourceElementDraftEventMode` `:348`/`:328`, `getTarget` `:350`/`:330`, `updateVisual` `:351`/`:331`).
- Adapter **types** are ~95 % identical: `week-interaction.adapter.types.ts` vs `day-interaction.adapter.types.ts` differ only in naming plus the runtime-shape items in the table below.
- **Genuine divergence** (essential, not accidental):
  - Week columns are **dates** → runtime supplies `getVisibleDays(): string[]` (`week-interaction.adapter.types.ts:31-36`).
  - Day columns are **calendars** → options supply `getColumnKeys(): string[]` and `getVisibleDate(): Dayjs` (`day-interaction.adapter.types.ts:26-33, 35`).
  - Consequence: a Week drag changes the event's **date**; a Day drag changes its **`calendarId`** (`Day/.../commit/timed.commit.ts:83-94`, `columnMoveCalendarId`).

### Concern D — commit: **divergent abstraction level, ~0 % shared**

This is the most misleading pair — same directory name, same filenames, **different responsibilities**.

- **Week `adapter/commit/*` exports pure visual→GridEvent mappers plus predicates:** `hasAllDayDragVisualMoved` (`all-day.commit.ts:14`), `allDayDragVisualToGridEvent` (`:16`), `hasAllDayResizeVisualChanged` (`:39`), `allDayResizeVisualToGridEvent` (`:43`), `getExclusiveEndDateBaseline` (`:63`); `timedDragVisualToGridEvent` / `timedResizeVisualToGridEvent` (`timed.commit.ts:11, 28`).
- **Day `adapter/commit/*` exports whole commit functions returning the full result envelope:** `commitAllDayDragInteraction` (`all-day.commit.ts:14-38`), `commitAllDayResizeInteraction` (`:40-56`), `commitTimedDragInteraction` (`timed.commit.ts:10-24`), `commitTimedResizeInteraction` (`:26-40`).
- Week's equivalents of Day's `commitXInteraction` live one directory away, in `adapter/interactions/*` — e.g. `commitAllDayDragInteraction` at `Week/interaction/adapter/interactions/all-day.drag.ts:77-95`. **Same function names, different homes.**
- Domain divergence is real: Week's all-day drag uses **delta** semantics (`all-day.commit.ts:22-31`, comment explains multi-day spans clamped to the rendered window); Day's deliberately keeps the event's own dates because "rewriting them to the visible date would truncate a multi-day all-day event" (`Day/.../all-day.commit.ts:22-25`).

### Week-only pieces — feature vs. gap

| Piece | LOC | Verdict |
|---|---|---|
| `adapter/interactions/*` (5 files) | 385 | **NOT a feature — structural extraction only.** Week factored create/update/commit per interaction into modules (`createXInteractionVisual` / `updateXInteractionVisual` / `commitXInteraction`). Day inlines the identical logic in `day-interaction.adapter.ts`, calling the same shared `grid/interaction/math/*` (imports at `:19,23,27,31`). This is the single biggest obstacle to unification: both call the same math at different levels of abstraction. |
| `adapter/edge-navigation.ts` | 146 | **Genuine Week-only feature.** Drag to the window edge to page weeks mid-drag (`WEEK_EDGE_NAVIGATION_DWELL_MS = 500` `:34`, `createWeekEdgeNavigationController` `:44`). |
| `state/edge-navigation.state.ts` | 60 | **Genuine Week-only feature** — backing store for the edge-nav indicators. |
| `useWeekInteractionLayoutSync.ts` | 44 | **Genuine Week-only feature** — rebuilds drag layout after an edge-nav re-render (`:32-42`); only caller is `WeekInteractionCoordinator.tsx:74`. Exists solely to serve `rebuildLayoutAfterNavigation`. |
| `state/motion.state.ts` | 18 | **Week-only, but the concept is view-agnostic.** A global `window.__weekInteractionMotionActive` flag. Day has no equivalent — a **gap**, not a Week feature. |
| cross-row drag (all-day ↔ timed) | — | **Week-only feature; Day gap with substrate already built.** Week uses it at `interactions/all-day.drag.ts:1,83-86` and `interactions/timed.drag.ts:3,99-108`; the math (`grid/interaction/math/cross-row.drag.ts`) and commit (`grid/interaction/commit/cross-row.commit.ts`) are already shared and unused by Day. |

**Coordinators are legitimately divergent, not duplicated.** `WeekInteractionCoordinator.tsx` (217 LOC) sources its own data via `useWeekEventViewModel` + `useDraftContext` and is coupled to the draft-store adapters; `DayInteractionCoordinator.tsx` (133 LOC) takes `allDayEvents` / `timedEvents` / `calendarColumnKeys` as props and reads `useDraftStore` directly. Both wrap `PointerCaptureBoundary`.

## 3. Call sites / blast radius

Every file **outside** the four trees that imports from them. 25 files.

### `views/Week/components/**` (9)
| File | Imports |
|---|---|
| `Grid/MainGrid/MainGridEvents.tsx` | `Week/interaction/registry/week-event.registry` |
| `Grid/MainGrid/MainGrid.test.tsx` | `registry/week-event.registry`, `state/motion.state` |
| `Grid/MainGrid/MainGridBusyPeriods.test.tsx` | `registry/week-event.registry` |
| `Grid/MainGrid/keyboardEditForm.test.tsx` | `registry/week-event.registry` |
| `Grid/MainGrid/eventReadOnlyInteraction.test.tsx` | `registry/week-event.registry` |
| `Grid/MainGrid/EdgeNavigationIndicators/EdgeNavigationIndicators.tsx` | `state/edge-navigation.state` |
| `Grid/AllDayRow/AllDayEvents.tsx` | `registry/week-event.registry` |
| `Event/Grid/GridEvent/GridEvent.tsx` | `state/motion.state` (`:21`, read at `:116`) |
| `Draft/grid/GridDraft.tsx` | `registry/week-event.registry` |

### `views/Week/components/Draft/**` → shared trees only (3)
`hooks/state/useDraftState.ts` → `@web/interaction/dom/cursor.lock`; `hooks/actions/draft-drag-schedule.util.ts` (+ its test) → `grid/interaction/math/cross-row.drag`, `grid/interaction/types/timed-drag.types`; `hooks/actions/useDraftActions.test.ts` → `grid/interaction/math/cross-row.drag`.

### `views/Week/hooks/**` (6)
`grid/useVisibleDayCount.ts` (`:2`, `:28`) and `grid/useGridLayout.ts` (`:2`, `:7`) → `state/motion.state`; `grid/useDragEdgeNavigation.ts` → `state/edge-navigation.state` + `adapter/edge-navigation`; `grid/useGridEventMouseDown.ts` (+ test) → `@web/interaction/interaction.pointer`, `interaction.constants`; `grid/useDragEventSmartScroll.ts` → `interaction.constants`; `shortcuts/useWeekShortcutOwner.ts` → `targeting/week-event.targeting`; `shortcuts/useWeekShortcutOwner.test.tsx` → `registry/week-event.registry`.

### `views/Week` root (1)
`WeekView.tsx` → `Week/interaction/WeekInteractionCoordinator`.

### `views/Day/**` (5)
| File | Imports |
|---|---|
| `components/Calendar/DayCalendarGrid.tsx` | `Day/interaction/DayInteractionCoordinator` |
| `components/Calendar/DayCalendarEventCards.tsx` | `registry/day-event.registry` |
| `view/DayViewContent.tsx` | `Day/interaction/day-event.focus` |
| `hooks/shortcuts/useDayEventNudgeShortcuts.ts` | `targeting/day-event.targeting` |
| `hooks/shortcuts/useDayEventNudgeShortcuts.test.tsx` | `registry/day-event.registry` |

### Cross-view / shared consumers (7) — **highest-risk group, touches both views**
| File | Imports |
|---|---|
| `components/ContextMenu/contextMenuLayering.test.tsx` | **both** `Week/.../week-event.registry` and `Day/.../day-event.registry` |
| `common/utils/event/event.util.ts` | `grid/interaction/view-event-registry` |
| `common/utils/event/event.util.test.ts` | `Week/.../week-event.registry` |
| `shortcuts/tips/useIsAnyCalendarEventFocused.ts` | `grid/interaction/view-event-registry` |
| `shortcuts/tips/useShortcutTipTrigger.test.tsx` | `grid/interaction/view-event-registry` |
| `__tests__/utils/state/reset-stores.ts` | `Week/.../state/motion.state` (`:42`, reset at `:71`) |
| `grid/components/{TimedEventCard,AllDayEventCard}.tsx` | `grid/interaction/dom` |

### Other shared-tree consumers (2)
`grid/hooks/useTimedDraftCreation.ts` → `@web/interaction/interaction.pointer` + `interaction.constants`; `components/ShortcutShowcase/practice.state.ts` → `grid/interaction/math/snap`.

### e2e — **coupled by DOM attribute, not import**
- `e2e/timed/move-event-reduced-days.spec.ts:38` — locator `#timedEvents [role="button"][data-week-interaction-event-id]`
- `e2e/calendars/calendar-experience.spec.ts:456` — reads `"data-week-interaction-event-id"`

Also asserted in unit tests: `grid/components/EventCard.test.tsx:64,65,78,356,357,370,371`, `grid/interaction/view-event-registry.test.ts:16,23,26,36-39,86,87`, `views/Day/components/Calendar/DayCalendarGrid.test.tsx:529,552`.

> **Any change to the `viewName` passed to `createViewInteractionRegistry` renames these DOM attributes and breaks e2e — which `bun test:web` does not cover.**

## 4. Test surface guarding the seam

24 files, **159 tests / 497 assertions**, all green.

### Shared substrate (12 files, 68 tests / 194 expects)
`interaction/interaction.engine.test.ts` 22/96 · `interaction/react/PointerCaptureBoundary.test.tsx` 6/18 · `interaction/dom/cursor.lock.test.ts` 3/8 · `grid/interaction/math/cross-row.drag.test.ts` 11/25 · `grid/interaction/commit/cross-row.commit.test.ts` 6/17 · `grid/interaction/view-event-registry.test.ts` 6/15 · `grid/interaction/layout.cache.test.ts` 4/8 · `grid/interaction/math/timed.interaction.test.ts` 3/4 · `grid/interaction/event.registry.test.ts` 3/3 · `grid/interaction/math/smart-scroll.test.ts` 2/3 · `grid/interaction/math/all-day.interaction.test.ts` 2/2

### By duplicated concern

| Concern | Week | Day |
|---|---|---|
| **adapter** | `week-interaction.timed-drag.test.ts` 14/43 · `.cross-row-drag.test.ts` 9/23 · `.timed-resize.test.ts` 9/29 · `.all-day-drag.test.ts` 8/30 · `.all-day-resize.test.ts` 7/23 · `.adapter.test.ts` 1/1 — **48 tests / 149 expects** | `day-interaction.adapter.test.ts` — **14 tests / 39 expects** |
| **commit** | no dedicated file — covered indirectly via the adapter tests above | no dedicated file — covered via `day-interaction.adapter.test.ts` |
| **registry** | `week-event.registry.test.tsx` 9/36 | `day-event.registry.test.tsx` 6/12 |
| **targeting** | `week-event.targeting.test.ts` 4/4 | `day-event.targeting.test.ts` 4/4 |
| **coordinator** | `WeekInteractionCoordinator.test.ts` 2/2 | `DayInteractionCoordinator.test.tsx` 3/5 |

**Asymmetry worth flagging:** Week's adapter carries **48 tests / 149 assertions** across 6 files; Day's carries **14 / 39** in one. Week's cross-row-drag suite (9 tests) has no Day counterpart because the feature is Week-only. Any unification must not silently drop Week's coverage down to Day's level.

### Command
`bun test:web` (root `package.json#scripts.test:web`). Verified present. Prior full-suite probe at `4189de1`: 2298 pass / 0 fail / 302 files / ~87 s — **not re-run this session**. Seam-scoped probe this session: **159 pass / 0 fail in 7.45 s**.

## 5. Repo-state risks for Gate 0

| Risk | Severity | Detail |
|---|---|---|
| e2e attribute coupling | **medium** | 2 Playwright specs hard-code `data-week-interaction-event-id`. Not covered by `bun test:web`. Renaming the registry `viewName` breaks them silently. |
| `.gitignore` does not cover `.sdlc/` | **medium** | Only `_gemini_worker_save/` + `local/debug.log` ignored. Run artifacts visible to `git add -A`. |
| Aggressive `.gitignore` globs | **medium** | Repo-wide `*.mjs` (`.gitignore:6`) and `*.env*` (`:4`). Any `.mjs` emitted into source would be silently untracked. |
| Cursor + Codex format-on-edit hooks | low | `.cursor/hooks.json`, `.codex/hooks.json`, `.cursor/hooks/format-after-edit.ts` may reformat plugin output out-of-band via Biome. |
| Non-default branch | low | On `CMP-104/opus-only-v5`; baseline captured on `main`. Branch already carries prior-run SDLC commits. |
| Dirty tree at start | low | `.claude/settings.json` (off-limits), `.sdlc/pre-check-status.json`, `.sdlc/project.json`. No `packages/web` source modified. |
| Submodules | none | No `.gitmodules`. |
| Git-LFS | none | No LFS filters in `.gitattributes`. |
| Encrypted secrets | none | No SOPS / git-crypt / age / sealed-secrets markers. No `.env*` on disk. |
| Pre-existing failing tests | none | Seam-scoped probe green (159/0). |

### Competing AI configs
Present: `.cursor/rules/` (4 `.mdc`: imports-and-packages, sync-package, **web-styles**, **web-testing**), `.cursor/hooks.json`, `.codex/config.toml`, `.codex/hooks.json`, `.agents/skills/` (9 skills), `.claude/settings.json`, `.claude/launch.json`, `AGENTS.md`.
Absent: `CLAUDE.md`, `.github/copilot-instructions.md`, `.cursorrules`, `.mcp.json`, `.aider.conf.yml`, `.continue/`, `.roo/`, repo-local `routing-policy.yaml`.

`.cursor/rules/web-styles.mdc` and `web-testing.mdc` encode conventions codegen must match, even though the files themselves stay off-limits.

## Coexistence risks (verbatim for Gate 0)

- **Cursor rules detected** — You have Cursor rules at `.cursor/rules/`. The plugin will never touch them, but if you have Cursor's auto-lint running on save, changes we make may trigger it.
- **Codex + Cursor format-after-edit hooks detected** — `AGENTS.md` states formatting is handled by these repo-local hooks after agent edits. Files this plugin writes may be reformatted out-of-band by Biome.
- **`.sdlc/` not gitignored** — Your `.gitignore` doesn't cover `.sdlc/`. Run artifacts under `.sdlc/` (packets, backups, telemetry) will be untracked but visible to `git add -A`. Gate 0 will offer to add `.gitignore` to this run's allowlist so the plugin can add the entry as part of the run.
- **No repo-local `routing-policy.yaml`** — the shipped policy applies.

## Proposed off-limits

```
.git/**  .claude/**  .codex/**  .cursor/**  .agents/**  AGENTS.md  .mcp.json
compass.yaml  .playwright-compass.yaml  *.env*  .env  .env.*
node_modules/**  build/**  buildcache/**  packages/*/build/**  packages/*/node_modules/**
bun.lock  patches/**  playwright-report/**  test-results/**  blob-report/**
.github/workflows/**
packages/backend/**  packages/sync/**  packages/scripts/**
e2e/**
```

`e2e/**` is off-limits for **writes** but is live blast radius — see §3.
