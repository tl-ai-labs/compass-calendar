# Discovery — 20260903-181010-refactor-week-day-interaction

- **Repo:** compass-calendar (`git@github.com:tl-ai-labs/compass-calendar.git`)
- **HEAD:** `2d81253a` on branch `CMP-104/opus-plus-flash-v37-sdk`
- **Mode:** refresh → **full re-scan**. `discovery-refresh.mjs` returned `incremental`
  (9 delta files across 2 commits, `manifests_changed: []`) but every delta file was under
  `.sdlc/` plus `.gitignore` — i.e. no source change since `4189de13`. Caller requested a full
  refresh, so everything below was re-derived from the working tree at HEAD.
- **Intent:** refactor
- **Seed (user's own words):** "unify the duplicated Week and Day interaction
  adapter/commit/targeting/registry layers on top of the shared interaction engine"

> Scoping note: every conclusion below is derived from the code at HEAD. No prior run's
> `discovery.md` / `intent_brief.md` / `change_plan.md` / `review.md` was read.

---

## Headline

**The seed's premise is only about one-quarter right, and the seed names the layers in
the wrong order of value.** Of the four named layers:

| Layer | Verdict | Evidence |
|---|---|---|
| **registry** | **Already a shared shim.** Nothing to unify. | 24 LOC each, both are pure instantiations of `createViewInteractionRegistry` |
| **targeting** | **Already a shared shim.** Nothing to unify. | 35 LOC each, both are pure instantiations of `createGridEventTargeting` |
| **commit** | **Divergent by design.** Unifying is a *behavioural change*, not a refactor. | Week = date-column semantics; Day = calendar-column semantics |
| **adapter** | **Genuinely duplicated.** This is the whole prize. | 795 vs 607 LOC, structurally isomorphic factories |

A naive "unify all four" reading of the seed would spend most of its effort re-shimming
two files that are already shims, and would silently break Day-view all-day drags by
collapsing a deliberate semantic divergence. **Gate 1 should narrow the seed to the adapter
layer**, and treat commit as explicitly out of scope (or in scope only as
*parameterisation*, never as *merging*).

---

## 1. The four named layers, one at a time

### 1a. Registry — already a shared re-export shim (no duplication)

`packages/web/src/views/Week/interaction/registry/week-event.registry.ts` — **24 LOC**
`packages/web/src/views/Day/interaction/registry/day-event.registry.ts` — **24 LOC**

Both files are the *same* file modulo the string `"week"` / `"day"`. Neither contains a
single line of logic. Each calls one shared factory and re-exports its members:

- Shared factory: `createViewInteractionRegistry(viewName)` from
  `@web/grid/interaction/view-event-registry` (**128 LOC**, the real implementation).
- Re-exported symbols, identical set in both files:
  `idAttribute`, `typeAttribute`, `getInteractionTargetAttributes`, `createRegistry`,
  `registry`, `useRegistrationRef`.
- Re-exported types, identical set in both files:
  `ViewInteractionEventType`, `ViewRegisteredEventTarget`, `ViewEventRegistry`
  (aliased to `Week*` / `Day*`).

**Verdict: already-shared shim.** The only thing a "unification" could remove is the
per-view *naming*, and the two shims exist precisely to give each view a distinct DOM
attribute namespace (`week` vs `day`), which is load-bearing for targeting selectors.
Deleting them is a rename, not a de-duplication — and it is the single highest-blast-radius
action available (see §6).

### 1b. Targeting — already a shared re-export shim (no duplication)

`.../Week/interaction/targeting/week-event.targeting.ts` — **35 LOC**
`.../Day/interaction/targeting/day-event.targeting.ts` — **35 LOC**

Same story. Both instantiate `createGridEventTargeting<T>({ registry, targetSelector })`
from `@web/grid/interaction/event.targeting` (**62 LOC**, the real implementation) and
re-export the identical four members:
`getFocusedGridEventTarget`, `getFirstVisibleGridEventTarget`,
`listVisibleGridEventTargets`, `focusGridEventTarget`.

The `TARGET_SELECTOR` const is built from that view's own two registry attributes — the one
genuinely per-view value.

The only difference between the two files is cosmetic: Week introduces an intermediate alias
`WeekGridEventTargetType = WeekInteractionEventType` and passes *that* to the generic, while
Day passes `DayInteractionEventType` directly at the call site while still exporting the
`DayGridEventTargetType` alias. That is a formatting inconsistency worth ~2 lines, not a
duplication.

**Verdict: already-shared shim.**

### 1c. Commit — divergent by design (unifying = behaviour change)

This is the layer most likely to be mis-refactored, because the *file names* match across
views (`adapter/commit/timed.commit.ts`, `adapter/commit/all-day.commit.ts`) while the
*semantics* deliberately do not.

| | Week | Day |
|---|---|---|
| `timed.commit.ts` | 38 LOC | 100 LOC |
| `all-day.commit.ts` | 65 LOC | 67 LOC |
| Exported shape | pure transforms (`*VisualToGridEvent`) | full commit-result builders (`commit*Interaction`) |
| Column key means | a local `YYYY-MM-DD` **date** | a **CalendarId** |
| Timed drag | assigns target day **absolutely** from `visual.dayDate` | assigns **`visibleDate`** for time, and `calendarId` from the column |
| All-day drag | applies a **day delta** to the event's own dates | **does not touch dates at all**; only rewrites `calendarId` |

Two comments in the source state the divergence as intentional:

- Week `all-day.commit.ts`: *"Delta (not absolute) semantics: multi-day spans are clamped to
  the rendered window, so the initial column date is the clamped visible start… The date diff
  also absorbs mid-drag week navigation."*
- Day `all-day.commit.ts`: *"In the Day view every column shares the visible date, so an
  all-day drag that 'moved' can only have changed COLUMN, i.e. calendar. Keep the event's own
  dates: rewriting them to the visible date would truncate a multi-day all-day event to a
  single day."*

So the two all-day commits are not two copies of one idea — they are **two different ideas**,
and merging them re-introduces the exact multi-day truncation bug the Day comment is
defending against.

What *is* already shared here: `hasTimedDragVisualMoved` / `hasTimedResizeVisualMoved` from
`@web/grid/interaction/commit/timed-moved` (**11 LOC**). Week re-exports them verbatim
(`export { hasTimedDragVisualMoved, hasTimedResizeVisualMoved }`); Day imports and calls them.
That is the only genuinely common commit logic, and it is already extracted.

There is also a real structural asymmetry worth fixing *without* touching semantics: Day's
commit module builds the whole `CommitResult` object (`{ event, eventId,
hadFormOpenBeforeInteraction, hasMoved, type }`), whereas Week's commit module exports only
the pure visual→event transform and assembles the result elsewhere. Normalising Week **up** to
Day's shape is a safe, behaviour-preserving move; merging the two bodies is not.

**Verdict: divergent by design.** Safe scope = align the *shape* (result assembly) and share
the `hasMoved` predicates. Unsafe scope = merge the bodies.

### 1d. Adapter — the genuine duplication (the actual prize)

`.../Week/interaction/adapter/week-interaction.adapter.ts` — **795 LOC**
`.../Day/interaction/adapter/day-interaction.adapter.ts` — **607 LOC**

Each file is a single exported factory (`createWeekInteractionAdapter` at line 106,
`createDayInteractionAdapter` at line 88) whose body is one enormous inline
`InteractionEngine<...>` construction. They are structurally isomorphic: the same eight
adapter methods appear in the same (alphabetical) order at near-identical relative offsets.

| Adapter method | Week line | Day line | Relationship |
|---|---|---|---|
| `cancel` | 259 | 213 | Week additionally resets edge-nav + motion state |
| `commit` | 264 | 217 | **Same 4-branch dispatch, same `throw` fallback**; Day threads an extra `visibleDate` arg |
| `createVisual` | 291 | 244 | **Materially different** (see below) |
| `getDraftEventMount` | 342 | 322 | **Byte-identical** |
| `getSourceElement` | 347 | 327 | **Byte-identical** (`target.registered.element`) |
| `getSourceElementDraftEventMode` | 348 | 328 | Identical modulo `isDragTarget` / `isDayDragTarget` |
| `getTarget` | 350 | 330 | **Byte-identical** (`getInteractionTarget(event)`) |
| `updateVisual` | 351 | 331 | Same role; Week takes `timestamp` (needed for edge-nav dwell), Day does not |

Closure state is nearly the same too — Day: `layout`, `scrollTop`. Week: `layout`,
`scrollTop`, plus `edgeNavigation` and `isLayoutRebuildPending`.

`createVisual` is where they truly part company, and it is the same root cause as the commit
divergence: Week resolves columns to **dates** and delegates to its own extracted helpers in
`adapter/interactions/` (`timed.drag.ts` 111, `all-day.drag.ts` 95, `timed.resize.ts` 78,
`all-day.resize.ts` 72, `all-day.visible-range.ts` 29 — 385 LOC of wrappers), while Day
resolves columns to **calendar ids** inline (~20 LOC of column-key logic) and calls the raw
`grid/interaction/math/create*Visual` primitives directly.

So Week and Day sit at *different levels of extraction over the same shared math*: Week wraps
it, Day calls it. That is the real duplication story — not "two copies of the same code" but
"one view grew an intermediate layer the other never did."

**Verdict: genuinely duplicated**, and the four trivially-identical methods
(`getTarget`, `getSourceElement`, `getSourceElementDraftEventMode`, `getDraftEventMount`) plus
the `commit` dispatch skeleton are extractable with essentially zero behavioural risk.

---

## 2. What `packages/web/src/grid/interaction/` already shares — and where it stops

**1,847 LOC, 22 non-test files.** This is *not* a thin layer; a large amount of unification
has already happened here. It contains zero references to `views/Week` or `views/Day`
(verified by grep — no matches at all), so it is genuinely view-agnostic today.

Already shared and consumed by **both** views:
- `view-event-registry.ts` (128) — the registry factory behind both registry shims
- `event.targeting.ts` (62) — the targeting factory behind both targeting shims
- `layout.cache.ts` (218) — `buildTimedGridLayoutCache`, `buildAllDayGridLayoutCache`,
  `buildDragGridLayoutCache`, `getNearestDayColumn`
- `math/timed.drag.ts` (195), `math/timed.resize.ts` (159), `math/all-day.drag.ts` (97),
  `math/all-day.resize.ts` (129) — the `create*Visual` / `update*Visual` primitives
- `math/drag-column.ts` (40) — `resolveDragColumn`, used internally by the two drag math
  modules (not dead code)
- `math/smart-scroll.ts` (73), `math/snap.ts` (5), `dom.ts` (146), `date.ts` (7)
- `adapter.helpers.ts` (100) — `readElementRect`, `applySmartScroll`,
  `getSavedEventInteractionCursor`, `getSavedEventOwnershipReason`, smart-scroll tuning
- `commit/timed-moved.ts` (11) — the `hasMoved` predicates

**Where the shared layer stops short — three concrete boundaries:**

1. **Cross-row conversion is shared in name but Week-only in fact.**
   `grid/interaction/commit/cross-row.commit.ts` (53) and `grid/interaction/math/cross-row.drag.ts`
   (139) live in the shared directory, but the only importers of `cross-row.commit` are
   `Week/.../interactions/all-day.drag.ts` and `Week/.../interactions/timed.drag.ts`.
   **Day has no all-day↔timed conversion at all.** The shared code exists; Day never opted in.
   This is a *capability gap*, not duplication — and it means "unify the adapters" implicitly
   asks whether Day should gain cross-row drag. That is a feature decision and must not be
   smuggled in under a refactor.

2. **The layout-cache wrappers are per-view and take different option sets.**
   `Week/.../geometry/week-layout.cache.ts` (73) and `Day/.../geometry/day-layout.cache.ts` (76)
   both wrap the same `build*GridLayoutCache`, but with different constants
   (Week `edgeThresholdPx: WEEK_EDGE_NAVIGATION_THRESHOLD_PX`; Day timed
   `INTERACTION_EDGE_THRESHOLD_PX` and Day all-day **`edgeThresholdPx: 0`**), and Week
   additionally exposes `buildDragWeekLayoutCache` (both rows at once, for cross-row) which Day
   has no equivalent of. Day's wrapper also carries target-predicate helpers
   (`isAllDayTarget`, `isDayDragTarget`, `buildDayLayoutCacheForTarget`) that Week keeps inside
   its adapter file instead. Same idea, different placement.

3. **No shared adapter skeleton exists.** The shared layer stops at *math and DOM*. There is
   nothing above it that composes those primitives into an `InteractionAdapter`. That missing
   piece is exactly the gap this ticket should fill.

---

## 3. `packages/web/src/interaction/` — the engine, and yes it is already generic

**1,219 LOC, 11 non-test files.** Core is `interaction.engine.ts` (604) plus
`interaction.adapter.types.ts` (51).

It is generic in the strict sense — fully parameterised over three type variables with no
view knowledge:

```ts
export interface InteractionAdapter<TTarget, TVisual, TResult> { ... }
export interface InteractionEngine<TTarget, TVisual, TResult> { ... }
interface InteractionEngineOptions<TTarget, TVisual, TResult>
  extends InteractionEngineSchedulerOptions { adapter: InteractionAdapter<...>; ... }
```

The `InteractionAdapter` contract is the eight-method interface both view adapters implement:
`getTarget`, `getSourceElement`, `getSourceElementDraftEventMode?`, `createVisual`,
`getDraftEventMount`, `updateVisual`, `commit`, `cancel?`.

Grep for Week/Day references inside `src/interaction/` returns **only five comment-prose
mentions** (in `interaction.engine.ts`, `interaction.constants.ts`, `dom/cursor.lock.ts`) and
**zero imports**. The engine also already carries the multi-week affordance
(`rebindPreparedSource`, documented for edge-nav remounts) without depending on Week.

**Conclusion: the engine needs no change.** The seed's phrase "on top of the shared
interaction engine" is accurate — the engine is the stable substrate, and the work is entirely
in the layer *between* the engine and the two views. This is good news for risk: the refactor
never has to touch the 604-LOC engine or its 22 tests.

---

## 4. Type hazards a naive unification would make *worse*

### H-1 (most serious) — `dayDate: string` is an untagged union of two incompatible meanings

In `grid/interaction/types/timed-drag.types.ts` and `all-day-drag.types.ts`, both
`TimedDragVisual.dayDate` and `AllDayDragVisual.dayDate` are typed `string`, and the source
itself documents that the field means two different things:

> *"Key of the column currently under the drag. Week view columns are local YYYY-MM-DD dates;
> Day view columns are CALENDAR IDS (all columns share the visible date there) — do not
> dayjs-parse this without knowing which view produced it."*

The type system cannot tell these apart. Today the hazard is *contained*, because each view
has its own commit module that knows which meaning applies. **A unified adapter/commit path
would put both meanings into one code path where only a runtime discriminator can separate
them — this is the single biggest correctness risk in the ticket.** Any unification must
introduce a real discriminant (a branded type, or a `columnKind: "date" | "calendar"` field on
the visual) *before* merging the paths, not after.

The hazard is already realised once: `columnMoveCalendarId` in Day's `timed.commit.ts` does an
unchecked `visual.dayDate as CalendarId`. If that function is ever reached with a Week visual,
it silently produces a date string typed as a `CalendarId`.

### H-2 — the field *name* lies

`dayDate` / `initialDayDate` are misnamed in the Day view, where they hold calendar ids. A
refactor that unifies without renaming these to something neutral (`columnKey` /
`initialColumnKey`) locks the lie into the shared layer permanently.

### H-3 — stale and doubled doc comments on `AllDayDragVisual`

`all-day-drag.types.ts` has **two consecutive `/** … */` blocks before `dayDate`** (lines 8–27).
The first describes delta-vs-absolute semantics for the Week view; the second was appended later
to note the Day-view calendar-id meaning. They contradict each other and only the second is
current. Immediately below, `initialDayDate` is still documented unconditionally as
*"Local YYYY-MM-DD date of the (window-clamped) source column at drag start"* — which is false
in the Day view. Codegen that pattern-matches on these comments will be actively misled.

### H-4 — the target/result types are structurally identical, so TypeScript will not catch a cross-view mix-up

`week-interaction.adapter.types.ts` and `day-interaction.adapter.types.ts` are both **149 LOC**
and declare the same eight interfaces (`*AllDayDragTarget`, `*AllDayDragCommitResult`,
`*AllDayResizeTarget`, `*AllDayResizeCommitResult`, `*TimedDragTarget`, `*TimedDragCommitResult`,
`*TimedResizeTarget`, `*TimedResizeCommitResult`) with **identical member sets**. Their only
nominal difference is `WeekRegisteredEventTarget` vs `DayRegisteredEventTarget` — and *both of
those alias the same shared type* `ViewRegisteredEventTarget`.

Because TypeScript is structural, a `DayTimedDragCommitResult` is **already** assignable to a
`WeekTimedDragCommitResult` today. There is no type safety being provided by the duplication.
That makes unifying these 16 interfaces genuinely safe (it is a pure rename) — but it also means
**the compiler will not flag mistakes made during the unification**. Do not rely on
`bun run type-check` to catch a mis-wiring here; only the 159 interaction tests will.

### H-5 — genuinely per-view members that a merged type must keep optional

Not everything in those 149-LOC files is symmetric. Week-only: `getVisibleDays(): string[]`,
`onRequestWeekNavigation`, `WeekEdgeNavigableVisual`, and
`rebuildLayoutAfterNavigation()` on the adapter interface. Day-only: `getColumnKeys()`,
`getVisibleDate()`. Week's `WeekInteractionAdapter` has **10 members**; `DayInteractionAdapter`
has **9** (no `rebuildLayoutAfterNavigation`). A merged interface that makes these all required
will force Day to grow no-op stubs; one that makes them all optional weakens Week's contract.
Prefer a generic `InteractionAdapter` + a per-view extension interface.

### H-6 — Week's edge-navigation is module-level singleton state

`Week/interaction/state/edge-navigation.state.ts` (60) and `state/motion.state.ts` (18) hold
process-global mutable state (`getWeekInteractionEdgeNavigationState`,
`setWeekInteractionMotionActive`, plus a `useWeekInteractionEdgeNavigationState` hook), which
the Week adapter mutates from `cancel`, `commit`, and `createVisual`. Day has no equivalent.
Hoisting Week's adapter body into a shared factory will drag this singleton along; if the
shared factory is ever instantiated twice (Week + Day mounted together), the two instances will
fight over one global. This must become instance state before, not during, unification.

---

## 5. Test command and counts

- **Proposed gate command:** `bun run test:web`
  (source: `package.json#scripts.test:web` → `bun packages/scripts/src/testing/test-parallel.ts web --`)
- **Full suite:** `bun run test` = core → sync → web → backend → scripts (5 packages; backend/sync/scripts need Mongo)
- **Runner is bun's own test runner, not jest.** `packages/web/bunfig.toml` sets
  `preload = ["./src/__tests__/web.preload.ts"]`, `root = "./src"`. Note the web profile runs
  **non-parallel** (`parallelFlag = profile === "web" ? [] : ["--parallel"]`).
- Related gates: `bun run type-check` (typescript@7.0.2, three tsconfigs incl.
  `tsconfig.test.json`), `bun run lint` (biome + a semantic-colors checker), `bun run knip`.

**Measured here (cheap, targeted — not the full suite):**

```
cd packages/web && bun test src/interaction src/grid/interaction \
  src/views/Week/interaction src/views/Day/interaction

159 pass · 0 fail · 497 expect() calls · 24 files · 4.47s
```

That is the refactor's real safety net, and it is currently **fully green**. Distribution:
Week interaction 63 tests / 8 files, Day interaction 27 / 4, grid/interaction 37 / 8,
engine 31 / 3. Note the Week adapter's behaviour is covered by five separate scenario files
(`all-day-drag` 8, `all-day-resize` 7, `cross-row-drag` 9, `timed-drag` 14, `timed-resize` 9)
while Day has a single 14-test `day-interaction.adapter.test.ts` — so **Week is far better
protected than Day for this change**, and the cross-row file has no Day counterpart at all
(consistent with §2 finding 1).

One non-failing nuisance: `DayInteractionCoordinator.test.tsx` emits a React
`act(...)` warning from `SettingsModal`. Noise, not a failure, but it will pollute run logs.

**Not measured:** the full `bun run test:web` count. A full run is in flight separately and I
did not re-run it, so **this baseline asserts no repo-wide pass/fail number.**
`packages/web/test-results.xml` exists but is stale (2026-08-19) and contains no parseable
`<testcase>` entries — do not use it as a baseline.

---

## 6. Blast radius of the tempting-but-wrong move

Because registry and targeting are *shims*, "unifying" them means renaming their exports —
and those exports have consumers well outside the interaction directories:

- **Week registry/targeting: 12 external consumer files** (6 non-test), including
  `Week/components/Grid/MainGrid/MainGridEvents.tsx`,
  `Week/components/Grid/AllDayRow/AllDayEvents.tsx`,
  `Week/components/Draft/grid/GridDraft.tsx`,
  `Week/hooks/shortcuts/useWeekShortcutOwner.ts`,
  plus `common/utils/event/event.util.test.ts`, `components/ContextMenu/contextMenuLayering.test.tsx`,
  and `views/Forms/hooks/useCloseEventForm.test.ts`.
- **Day registry/targeting: 4 external consumer files** (2 non-test):
  `Day/components/Calendar/DayCalendarEventCards.tsx`,
  `Day/hooks/shortcuts/useDayEventNudgeShortcuts.ts`, plus two tests.

So collapsing the two shims touches **16 files outside `*/interaction/`** for **zero**
duplication removed — the highest cost-to-benefit ratio available in this ticket. It also
reaches into `Forms/` and `ContextMenu/`, well outside the seed's stated area.

**Recommended scope shape for Gate 1:** adapter layer only, in the order
(a) hoist the four byte-identical methods + the `commit` dispatch skeleton into a shared
adapter factory in `grid/interaction/`; (b) introduce the column-key discriminant (H-1/H-2)
*before* any commit-path merging; (c) de-globalise Week's edge-nav state (H-6). Leave registry,
targeting, and commit semantics alone.

---

## 7. Detected stacks

Single-stack TypeScript monorepo on **Bun 1.3.14**.

- Root `package.json`: `name: compass`, `workspaces: ["packages/*"]`, `packageManager: bun@1.3.14`,
  lockfile `bun.lock`, plus a `lerna.json`.
- Packages: `web` (`@compass/web`), `backend`, `core`, `sync`, `scripts`.
- Web frameworks: React, Redux Toolkit, TanStack React Query, TanStack react-hotkeys,
  styled-components. Tooling: Biome (lint+format), Playwright (e2e), knip, typescript@7.0.2 via bunx.
- Target of this ticket lives entirely in `packages/web/src/`.

## 8. Detected AI/agent setup

`.claude/` (+ `settings.json`, `settings.local.json`), `.cursor/rules/` (4 `.mdc` files),
`.cursor/hooks/format-after-edit.ts`, `.codex/`, `.agents/skills/`, `AGENTS.md`, `.hook-logs/`.

Absent: root `CLAUDE.md`, `.mcp.json` (gitignored, not present), `.cursorrules`,
`.aider.conf.yml`, `.continue/`, `.github/copilot-instructions.md`, `.roo/`, and — importantly
for this A/B — **no repo-local `routing-policy.yaml` anywhere**, so nothing in the repo is
silently overriding the policy arm under test.

Two Cursor rules are directly relevant to this refactor: `web-styles.mdc` and `web-testing.mdc`.

## 9. Coexistence risks

- **Cursor rules at `.cursor/rules/`** — never touched by the plugin, but `web-styles` and
  `web-testing` govern exactly the package being refactored; their conventions are load-bearing
  for codegen.
- **Cursor format-on-edit hook** (`.cursor/hooks/format-after-edit.ts`) — if Cursor is open on
  this repo during the run, files the plugin writes may be reformatted underneath it,
  destabilising diffs and any byte-identity check.
- **No `.mcp.json`** — no competing custom MCP servers to reason about.
- **Multiple agent toolchains side by side** (`.claude/`, `.codex/`, `.agents/skills/`,
  `.cursor/`, `AGENTS.md`) — only `AGENTS.md` is a shared instruction surface; there is no root
  `CLAUDE.md`.
- **`.gitignore` does not cover `.sdlc/`** — run artifacts are visible to `git add -A`. On this
  branch `.sdlc/runs/` **is** tracked (only `.sdlc/**/_gemini_worker_save/` and
  `.sdlc/local/debug.log` are ignored), which is the intended setup here, but a careless
  `git add -A` will sweep run artifacts into a feature commit. Gate 0 should confirm intent.
- **`.gitignore` has a blanket `*.mjs` rule** — any `.mjs` written during the run is silently
  untracked and invisible to `git status`; it would need `git add -f`. Also blanket-ignores
  `*.env*`, `*.log`, `.mcp.json`, `**/.claude/settings.local.json`.
- **Dirty tree, but safely so** — only `.sdlc/pre-check-status.json` and `.sdlc/project.json`
  are modified. No user source file is dirty, so the rollback anchor at `2d81253a` is clean for
  all of `packages/`.
- **No submodules. No git-LFS.** (`.gitattributes` exists but has no `filter/diff/merge=lfs`
  patterns.) Nothing opaque in the write path.

## 10. Regulated-repo signals

One weak hit: **`SECURITY.md`** at repo root. There are **no** compliance directories
(no `HIPAA/`, `PCI/`, `SOC2/`, `GDPR/`, `compliance/`, `regulated/` anywhere under `docs/` or
root), **no `CODEOWNERS` file at all**, and no privacy/compliance docs. `SECURITY.md` here is a
standard OSS vulnerability-disclosure policy.

Gate 0 warning is flagged for completeness, but the honest read is: **this is a formality, not
evidence of a regulated codebase.**

## 11. Proposed off-limits

`.git/**`, `.sdlc/baseline/**`, `.claude/**`, `.cursor/**`, `.codex/**`, `.agents/**`,
`.hook-logs/**`, `AGENTS.md`, `.mcp.json`, `.env` / `.env.*` / `*.env*`, `node_modules/**`,
`packages/*/node_modules/**`, `build/**`, `packages/*/build/**`, `buildcache/**`, `logs/**`,
`test-results/**`, `playwright-report/**`, `blob-report/**`, `patches/**`, `bun.lock`,
`.github/workflows/**`.

## 12. Environment keys (names only)

No `.env*` file exists in the working tree (blanket-ignored by `*.env*`), so
`env_keys_by_file` is empty. Referenced in source: `API_BASEURL`, `COMPASS_BUILD_REF`,
`GOOGLE_CLIENT_ID`, `NODE_ENV`, `PORT`, `POSTHOG_HOST`, `POSTHOG_KEY`, `TZ`. **No values were
read.**

## 13. Scan notes

Full Tier 1 scan, well inside the timebox. No sampling fallback needed (13 top-level dirs,
5 workspace packages). No unreadable files. Tier 2b adaptive stack profile **not triggered**:
this is a Node/TypeScript repo and `.sdlc/baseline/stack-profile.md` already exists
(2026-09-02) with no stack-manifest change since.
