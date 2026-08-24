# Discovery — 20260824-002919-refactor-week-day-interaction

Mode: **refresh** → helper decision **`cached`**.
The project baseline at `.sdlc/baseline/current.json` (built 2026-08-20T04:32:08Z, HEAD `4189de13`) matches current HEAD exactly and no stack manifest changed, so the generic Tier-1 baseline is reused verbatim and **was not rewritten**. Everything below the fold is a refactor-scoped code survey layered on top, re-derived independently from the tree.

---

## 0. Branch-base verification — the precondition for this A/B

This run is an intentional policy A/B: the same ticket re-run from a clean start under a different model policy, to compare against run `20260822-125447-refactor-week-day-interaction` (which ran under `flash-agsdk-only`).

I verified the branch base rather than assuming it.

| check | result |
|---|---|
| `git rev-parse HEAD` | `4189de1389d8a4644ae20d9c5a907f1d161b5496` |
| `git rev-parse main` | `4189de13…` — **identical** |
| does `62162a95` exist in the repo? | yes, as a commit object |
| `git merge-base --is-ancestor 62162a95 HEAD` | **false** — not an ancestor |
| `git branch --contains 62162a95` | `CMP-104/flash-agsdk-only`, `origin/CMP-104/flash-agsdk-only` only |

**Verdict: the branch base is exactly what we think it is.** The prior run's shipped work is absent, and the duplication this ticket targets is fully present. I confirmed this three independent ways beyond the git check:

1. **LOC fingerprint matches the pre-refactor state exactly** — Week adapter 795, Day adapter 607, both adapter-types files 149/149.
2. **No branded column-key type exists.** All four column-key fields are still bare `string` (that branding was the substance of `62162a95`).
3. **Interaction-scoped tests re-run live: 159 pass / 0 fail across 24 files in 7.7s.**

No reason to halt on branch-base grounds.

---

## 1. Git state

| field | value |
|---|---|
| HEAD | `4189de1389d8a4644ae20d9c5a907f1d161b5496` |
| branch | `CMP-104/opus-plus-flash-v37` (cut from `main`, same commit) |
| dirty | **yes** — `.claude/settings.json` modified (tracked) |
| untracked | `.hook-logs/`, `.sdlc/` |
| remote | `origin` → `git@github.com:tl-ai-labs/compass-calendar.git` |
| `.sdlc` gitignored | **no** |

The dirty file is pre-existing, unrelated to this ticket, and already on the off-limits list. Flagging it only so nothing sweeps it into a commit.

## 2. Stack, size, monorepo

Bun monorepo (`bun@1.3.14`), Bun workspaces (`packages/*`) plus `lerna.json`. TypeScript + React 18. Lint/format via Biome. Type-check pinned to `typescript@7.0.2` across three passes.

Packages: `backend`, `core`, `scripts`, `sync`, `web`. This refactor is entirely inside `packages/web`.

- tracked files: 1,582
- `packages/web` TS/TSX: 946
- in-scope source: **6,321 LOC**; in-scope tests: **6,315 LOC**

Path aliases: `@web/*` → `packages/web/src/*`, `@core/*` → `packages/core/src/*`. In-scope imports use the aliases, not deep relatives (except within a directory).

**Submodules:** none. **Git-LFS:** not in use. **Env files:** none on disk (config is `compass.yaml`, gitignored).

## 3. Test command

- Proposed for Phase 7: **`bun run test:web`**
- Source: `package.json#scripts.test:web` + `AGENTS.md` ("Avoid defaulting to `bun test`; use the focused package test first")

Prefer `bun run test:web` over `bun test:web` so Bun resolves the package script rather than attempting a path.

| scope | result |
|---|---|
| `bun run test:web` | **2298 pass / 0 fail**, 302 files, exit 0 *(caller-supplied cached pre-check at this HEAD)* |
| interaction dirs only | **159 pass / 0 fail**, 24 files, 7.7s *(re-run live during this discovery)* |

Pre-existing noise: React `act(...)` warnings from `SettingsModal` in `DayInteractionCoordinator.test.tsx`. Not failures — do not "fix" as part of this refactor.

Type-check is a separate slow gate: `bun run type-check`.

---

## 4. Current shape of the Week and Day interaction layers

### Week — `packages/web/src/views/Week/interaction/` (2,166 source LOC)

| file | LOC |
|---|---|
| `adapter/week-interaction.adapter.ts` | 795 |
| `adapter/edge-navigation.ts` | 146 |
| `adapter/week-interaction.adapter.types.ts` | 149 |
| `adapter/interactions/timed.drag.ts` | 111 |
| `adapter/interactions/all-day.drag.ts` | 95 |
| `adapter/interactions/timed.resize.ts` | 78 |
| `adapter/interactions/all-day.resize.ts` | 72 |
| `adapter/interactions/all-day.visible-range.ts` | 29 |
| `adapter/geometry/week-layout.cache.ts` | 73 |
| `adapter/commit/all-day.commit.ts` | 65 |
| `adapter/commit/timed.commit.ts` | 38 |
| `WeekInteractionCoordinator.tsx` | 217 |
| `state/edge-navigation.state.ts` | 60 |
| `state/motion.state.ts` | 18 |
| `useWeekInteractionLayoutSync.ts` | 44 |
| `registry/week-event.registry.ts` | 24 |
| `targeting/week-event.targeting.ts` | 35 |

### Day — `packages/web/src/views/Day/interaction/` (1,207 source LOC)

| file | LOC |
|---|---|
| `adapter/day-interaction.adapter.ts` | 607 |
| `adapter/day-interaction.adapter.types.ts` | 149 |
| `adapter/commit/timed.commit.ts` | 100 |
| `adapter/commit/all-day.commit.ts` | 67 |
| `adapter/geometry/day-layout.cache.ts` | 76 |
| `DayInteractionCoordinator.tsx` | 133 |
| `day-event.focus.ts` | 15 |
| `registry/day-event.registry.ts` | 24 |
| `targeting/day-event.targeting.ts` | 35 |

The structural headline: **Week's adapter is decomposed into five per-interaction modules; Day's is a 607-line monolith.**

---

## 5. Duplicated vs. unified vs. divergent — independently re-derived

I re-derived every verdict from the files rather than inheriting the prior run's. Where I agree, I say so; where I disagree, I say why.

### Already unified — do not re-unify (agree with prior run)

`grid/interaction/view-event-registry.ts` carries an explicit comment: *"Day and Week previously hand-rolled identical copies of this wiring; this factory is the single source of it."*

| layer | evidence | verdict |
|---|---|---|
| **registry** (24 / 24 LOC) | Both files are pure re-export shims over `createViewInteractionRegistry(viewName)`. Verified line by line: identical modulo the literal `"week"`/`"day"` and export identifiers. Zero logic in either. | Done |
| **targeting** (35 / 35 LOC) | Both are shims over `createGridEventTargeting({registry, targetSelector})`. | Done |
| **layout-cache builders** | `buildTimedGridLayoutCache` / `buildAllDayGridLayoutCache` / `buildDragGridLayoutCache` all live in `grid/interaction/layout.cache.ts` and are consumed by both. | Done |
| **timed-moved predicates** | `hasTimedDragVisualMoved` / `hasTimedResizeVisualMoved` shared from `grid/interaction/commit/timed-moved.ts`. | Done |

Collapsing the registry/targeting shims further buys ~120 LOC and costs every call site its view-specific name. **Recommend leaving them.**

One extra observation the prior run missed: `WeekGridEventTargetType` and `DayGridEventTargetType` both resolve to the *same* type, `ViewInteractionEventType = "all-day" | "timed"`. The generic parameter on `createGridEventTargeting` currently buys nothing — both instantiations pass the same type.

### Genuinely duplicated — the real targets

| layer | Week | Day | normalized diff | note |
|---|---|---|---|---|
| **adapter types** | 149 | 149 | **23 / ~132 lines** | **Best first target.** Eight interface pairs are structurally identical after normalization; the four commit-result shapes are byte-identical modulo prefix. |
| **adapter** | 795 | 607 | **408 / ~676** | Bulk of the work, but ~40% of the delta is Week-only *capability*, not divergent copies. |
| **coordinator** | 217 | 133 | — | Same mount/attach/detach lifecycle; Week adds edge-nav and layout-sync wiring. |

For adapter-types, genuine divergence is confined to four spots: Options (Day adds `getColumnKeys`/`getVisibleDate`), Runtime (Week adds `getVisibleDays` + `onRequestWeekNavigation`), Adapter (Week adds `rebuildLayoutAfterNavigation`), and Week-only `WeekEdgeNavigableVisual`. Everything else is mechanical.

### NOT duplication — divergent by design (agree with prior run)

The commit layers were in the job description as duplicates. **They are not.** I re-derived this and confirm both axes of difference:

- **Shape.** Week exports pure transforms (`allDayDragVisualToGridEvent`, `timedDragVisualToGridEvent`) and lets the adapter wrap them. Day exports whole commit functions (`commitAllDayDragInteraction(target, visual, visibleDate) → CommitResult`) that already build the full `{event, eventId, hadFormOpenBeforeInteraction, hasMoved, type}` envelope.
- **Semantics.** In Week a column is a **day**; in Day a column is a **calendar**.
  - Week all-day drag applies a *day delta* to `startDate`/`endDate`.
  - Day all-day drag **must not touch dates at all** — it changes `calendarId`. Explicit comment: *"rewriting them to the visible date would truncate a multi-day all-day event to a single day."*
  - Day timed drag sets `calendarId` via `columnMoveCalendarId(...)` and pins the date to `visibleDate`.

**Do not merge commit bodies.** At most, unify the `CommitResult` envelope shape (adopt Day's) and keep per-view transforms.

### Where I disagree with the prior run — the geometry layer

The prior discovery filed geometry under *"Genuinely duplicated — the real targets"*, describing the pair as *"Both wrap the same shared builders with the same constants… Differ in edge threshold source and in what extra input they take."*

**I disagree.** After name normalization, 80 lines differ across files of only ~66 and ~70 normalized lines — essentially every line. They share **dependencies**, not **structure**:

- Week funnels everything through one `weekLayoutCacheOptions(sources)` builder, then exposes three thin wrappers. Day writes **two independent option literals that duplicate each other internally**.
- Week exposes `buildDragWeekLayoutCache` (both rows at once, for cross-row drag). **Day has no cross-row builder at all.**
- Edge threshold: Week uses `WEEK_EDGE_NAVIGATION_THRESHOLD_PX`; Day uses `INTERACTION_EDGE_THRESHOLD_PX` for timed and a hardcoded `0` for all-day.
- Day's geometry file additionally hosts *adapter* concerns — `buildDayLayoutCacheForTarget`, `isAllDayTarget`, `isDayDragTarget`. Week keeps the equivalent predicates private inside its adapter (lines 755–760).

So the unification win here is **smaller and different** than implied: hoist the shared option-literal into one builder, and move Day's target predicates out of the geometry file. It is not a copy-paste pair waiting to be deleted.

### Asymmetric surface

**Week-only:** the five `adapter/interactions/*` modules, `adapter/edge-navigation.ts`, `state/edge-navigation.state.ts`, `state/motion.state.ts`, `useWeekInteractionLayoutSync.ts`, runtime hooks `getVisibleDays()` / `onRequestWeekNavigation` / `rebuildLayoutAfterNavigation()`, type `WeekEdgeNavigableVisual`, and **all cross-row drag** (Week is the sole importer of `grid/interaction/commit/cross-row.commit.ts`).

**Day-only:** `day-event.focus.ts`, runtime hooks `getColumnKeys()` / `getVisibleDate()`, and the geometry-hosted target predicates.

**Capability gap worth naming at the gate:** Day has **no cross-row (all-day ↔ timed) drag**. Verified — Day's adapter never reads or writes `visual.row`, and `cross-row.commit.ts` is imported only by Week. This is a feature difference, not just a code difference, and a unification must not silently imply Day gained it.

---

## 6. Type-safety hazards in the shared visual/target types

### H1 (high) — column-key overload. **Still present on this branch.**

The prior run flagged this and was right to. But it named only `TimedDragVisual.dayDate`. **The overload actually spans four fields across two shared types**, and I'd characterize it as wider and better-hidden than the prior write-up suggests.

All four are plain `string`:

- `grid/interaction/types/timed-drag.types.ts` → `TimedDragVisual.dayDate` (line 38), `TimedDragVisual.initialDayDate` (line 44)
- `grid/interaction/types/all-day-drag.types.ts` → `AllDayDragVisual.dayDate` (line 29), `AllDayDragVisual.initialDayDate` (line 32)

**Producer.** Week passes `YYYY-MM-DD` dates. Day passes **calendar ids** — `day-interaction.adapter.ts` lines 254–282 and 313, where `columnKeys` come from `getColumnKeys()` and `initialColumnKey` is fed in as `dayDate`. The shared visual factories then propagate it:

```ts
// grid/interaction/math/timed.drag.ts:48  and  math/all-day.drag.ts:35
initialDayDate: dayDate,
```

…so `initialDayDate` silently inherits the same overload.

**Unsafe consumers** — these dayjs-parse the column key:

```ts
// views/Week/interaction/adapter/commit/all-day.commit.ts:19-23
const dayDelta = dayjs(visual.dayDate).diff(dayjs(visual.initialDayDate), "day");
```
```ts
// views/Week/interaction/adapter/commit/timed.commit.ts:15
const movedDay = dayjs(visual.dayDate).startOf("day");
```

**Safe consumers** compare by equality only and never parse — which is precisely why `timed-moved.ts` was safe to share.

**Unchecked assertion** in Day:

```ts
// views/Day/interaction/adapter/commit/timed.commit.ts:78-83
export const columnMoveCalendarId = (
  visual: Pick<TimedDragVisual, "dayDate" | "initialDayDate">,
  event: GridEvent,
): CalendarId | undefined =>
  visual.dayDate !== visual.initialDayDate
    ? (visual.dayDate as CalendarId)
    : event.calendarId;
```

**Failure mode.** If a unified engine routes Day visuals through Week's date-parsing commit path, `dayjs("<calendarId>")` yields an Invalid Date, `.diff()` yields `NaN`, and event dates corrupt silently. TypeScript catches nothing — every field is `string`.

**Documentation rot compounds it.** Three of the four fields carry docstrings that are now wrong:
- `TimedDragVisual.initialDayDate` still says *"Local YYYY-MM-DD date of the source column at drag start."*
- `AllDayDragVisual.initialDayDate` still says *"Local YYYY-MM-DD date of the (window-clamped) source column."*
- `AllDayDragVisual.dayDate` carries **two stacked block comments** (lines 15–27) that contradict each other — the first calls it a date, the second correctly documents the per-view overload.

**Mitigation and sequencing constraint.** Introduce a branded or parameterised column-key type (`TColumnKey` generic, or `DateColumnKey | CalendarColumnKey` brands) and thread it through both visual types **before** merging any commit or adapter logic. This is exactly what the prior run's `62162a95` did first, and independently I reach the same conclusion: it is the correct opening move. **No commit-layer or adapter-layer merge should land before H1 is fixed.**

### H2 (medium) — Week-shaped fields are dead weight in Day. *Not flagged by the prior run.*

`TimedDragVisual.row`, `TimedDragVisual.crossRowSize`, `AllDayDragVisual.row`, `AllDayDragVisual.crossRowSize` and `AllDayDragVisual.timedStartMinutes` live on the **shared** types, but only Week ever drives them. A naive unification will make Day *appear* to support cross-row drops — the fields typecheck — while nothing populates them.

### H3 (low) — redundant per-view target-type aliases

`WeekGridEventTargetType` and `DayGridEventTargetType` are both aliases of the same union. Harmless, but noise a unification should clear.

---

## 7. Blast radius

**19** files import `views/Week/interaction`; **6** import `views/Day/interaction`; **1** imports both.

Cross-view and out-of-view consumers needing care:

- `components/ContextMenu/contextMenuLayering.test.tsx` — **imports both**
- `__tests__/utils/state/reset-stores.ts`
- `common/utils/event/event.util.test.ts`
- `views/Forms/hooks/useCloseEventForm.test.ts`

**Fragile public surface.** `grid/interaction/view-event-registry.ts` also exports `CALENDAR_VIEW_INTERACTION_ID_ATTRIBUTES`, `calendarEventIdElementSelector`, `calendarEventIdValueSelector` and `readCalendarEventIdFromElement`. These resolve an event id from the DOM *without knowing the view*, and are used by context menus and undo focus-restore. **Renaming the `data-${view}-interaction-event-*` attribute scheme breaks them.**

Full lists in `baseline.json`.

---

## 8. State of the shared layer

### `src/interaction/` (2,208 LOC) — the engine. Already fully generic.

Public surface is small: `createInteractionEngine<TTarget, TVisual, TResult>`, `InteractionEngine`, `InteractionEngineSchedulerOptions`, `InteractionCancellationTargets`, and the `InteractionAdapter<TTarget, TVisual, TResult>` contract.

**Where it stops:** it knows nothing about grids, columns, dates or calendars. It owns pointer lifecycle, draft-event DOM cloning, cursor lock, source-element visibility, and the `PointerCaptureBoundary` React wrapper. Both views already implement its adapter contract.

One contract detail any refactor must preserve, documented in the source: **`updateVisual` must be idempotent** — the engine re-invokes it at pointerup with the same pointer to recompute the visual before commit.

### `grid/interaction/` (2,721 LOC) — grid-aware, view-agnostic.

Already covers `event.registry`, `view-event-registry`, `event.targeting`, `layout.cache`, `adapter.helpers`, `dom`, `date`, `use-event-registration-ref`, all of `math/`, `commit/{cross-row,timed-moved}`, and `types/`.

**Where it stops — and this is the finding that matters:** it provides **no adapter factory**. Each view hand-assembles its own `createXInteractionAdapter` over the engine. So the gap is *not* the engine, which is already shared and already generic. The gap is that `grid/interaction/` stops short of the adapter layer.

**Recommended direction:** widen `grid/interaction/` with a view-parameterised adapter factory (`createGridInteractionAdapter<TColumnKey, …>`). Do **not** push Week/Day grid logic down into `src/interaction/`, which must stay grid-agnostic.

---

## 9. Scope correction for this ticket

The job description names four layers: *adapter, commit, targeting, registry*. Measured against the tree:

- **targeting** — already unified. Drop from scope.
- **registry** — already unified. Drop from scope.
- **commit** — divergent by design. Drop from scope (beyond envelope alignment).
- **adapter** — the genuine target, along with **adapter-types**, **coordinator**, and a smaller-than-expected slice of **geometry**.

Suggested sequencing:

1. **Fix H1** — brand/parameterise the column key across all four fields; correct the three stale docstrings. Type-only, no behavior change.
2. **Unify adapter-types** via a generic factory (~110 of 149 lines per file).
3. **Extract the shared coordinator lifecycle** into a hook.
4. **Hoist the geometry option-literal**; move Day's target predicates out of the geometry file.
5. **Only then** consider an adapter factory in `grid/interaction/`, unifying toward Week's decomposed `interactions/` shape.

## 10. Detected AI/agent setup

| path | type |
|---|---|
| `.claude/settings.json` (modified), `.claude/settings.local.json`, `.claude/launch.json` | Claude Code project config |
| `.cursor/rules/*.mdc` (web-styles, web-testing, imports-and-packages, sync-package) | Cursor rules |
| `.cursor/hooks.json`, `.cursor/hooks/format-after-edit.ts` | Cursor format-on-save hook |
| `.codex/config.toml`, `.codex/hooks.json` | Codex config + hooks |
| `.agents/skills/` | shared agent skills |
| `AGENTS.md` | agent instructions |

No `.mcp.json`, no `CLAUDE.md`, no repo-local `routing-policy.yaml`, no aider/continue/roo config.

## 11. Coexistence risks

- **Cursor + Codex format-on-edit hooks are both active.** `AGENTS.md` states formatting is handled by these repo-local hooks after agent edits. If either editor is open on this repo during the run, our output may be reformatted underneath us and produce diff churn. Untouched by the plugin either way.
- **`.sdlc/` and `.hook-logs/` are not gitignored.** Both untracked and visible to `git add -A`. A refactor run writes `backups/<file>` under `.sdlc/`, echoing source content of every touched file. Gate 0 should offer to add `.gitignore` to this run's allowlist so the entries can be added.
- **`.gitignore` carries repo-wide `*.mjs` and `*.env*` rules.** Any `.mjs` emitted into user source would be silently untracked.
- **`.claude/settings.json` is dirty before the run starts.** Pre-existing and off-limits; just don't let it ride along in a commit.
- **Cursor rules encode conventions codegen must match** — `web-styles.mdc` and `web-testing.mdc` in particular.

## 12. Regulated-repo signals

Only `SECURITY.md` at repo root — a standard OSS vulnerability-disclosure file, not a compliance obligation marker. No HIPAA/PCI/SOC2/GDPR docs, no compliance CODEOWNERS. **No warning required.** No env files exist in the repo at all, so no env key names were collected.

## 13. Infra

`.github/workflows/` present (11 workflows). No Dockerfile, docker-compose, terraform, or GitLab CI at repo root (Docker assets live under `.github/docker` and `self-host`).

## 14. Proposed off-limits

```
.git/**  .claude/**  .codex/**  .cursor/**  .agents/**  AGENTS.md
.mcp.json  .hook-logs/**  .sdlc/**
compass.yaml  .playwright-compass.yaml  *.env*  .env  .env.*
node_modules/**  build/**  buildcache/**
packages/*/build/**  packages/*/node_modules/**
bun.lock  patches/**  playwright-report/**  test-results/**  blob-report/**
.github/workflows/**
```

Plus, run-specific: `packages/backend/**`, `packages/sync/**`, `packages/scripts/**`, `packages/core/**`, `e2e/**`, `self-host/**` — this refactor is confined to `packages/web/src/{interaction,grid/interaction,views/Week/interaction,views/Day/interaction}`.

Note `packages/core` is *read-only-imported* by the scope (`@core/util/date/dayjs`, `@core/types/domain-primitives`) but must not be modified.

## 15. Cost-projection inputs for Gate 0

- 1,582 tracked files; 946 TS/TSX in `packages/web`
- in-scope source: 6,321 LOC; in-scope tests: 6,315 LOC
- likely-touched: ~12 source + ~14 test files
- verification loop: `bun run test:web`, ~86s, currently 2298/2298 green
- fast inner loop available: interaction-scoped run, 7.7s, 159/159 green
- type-check is a separate slow gate: `bun run type-check` (three `tsc` passes, pinned 7.0.2)
