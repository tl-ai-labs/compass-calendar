# Intent Brief — refactor — Unify Week/Day interaction layers on the shared engine

## Context

`packages/web` carries two parallel interaction stacks — one per calendar view — that both wrap
the same shared substrates:

- **Shared engine:** `packages/web/src/interaction/` (1527 lines), core
  `interaction.engine.ts` (604) exporting `createInteractionEngine<TTarget, TVisual, TResult>`,
  contract in `interaction.adapter.types.ts` (51).
- **Shared grid substrate:** `packages/web/src/grid/interaction/` (2625 lines) — already holds the
  factories both views wrap: `view-event-registry.ts` (`createViewInteractionRegistry`),
  `event.targeting.ts` (`createGridEventTargeting`), `layout.cache.ts`, and the drag/resize math.
- **Week side:** `packages/web/src/views/Week/interaction/` — 5428 lines across 26 files.
- **Day side:** `packages/web/src/views/Day/interaction/` — 2375 lines across 13 files.

Discovery (`discovery.md`, this run) measured the duplication across the four named concerns:

| Concern | Week | Day | Verdict |
|---|---|---|---|
| registry | `week-event.registry.ts` (24) | `day-event.registry.ts` (24) | **pure clone** — normalizing `week`/`day` leaves only the `WEEK_`/`DAY_` constant prefixes differing |
| targeting | `week-event.targeting.ts` (35) | `day-event.targeting.ts` (35) | **pure clone** — all 50 diff lines are renames + one Biome reformat |
| targeting tests | 92 lines | 92 lines | **copy-paste** — 28 diff lines, all renames |
| adapter types | 149 lines | 149 lines | **parallel defs** — real divergence is narrow (Week: `getVisibleDays()`, `onRequestWeekNavigation()`; Day: `getColumnKeys()`, `getVisibleDate()`) |
| commit | `adapter/commit/*` are pure mappers (103); envelope built in `adapter/interactions/` | `adapter/commit/*` are full orchestrators (167); no `interactions/` dir | **CORRECTED at Gate 1 — genuine domain divergence, not drift.** Both views already export the *same four function names*, so there is one naming convention, not two. The bodies differ because a Week column is a **date** and a Day column is a **calendar**. Unifiable: the envelope shape and the directory layout. Not unifiable: the visual→GridEvent mappers. See `requirements.md` §5.1. |
| geometry | local `WeekLayoutCache*` alias family | already imports shared `GridLayoutCacheSources` | **partial-migration asymmetry** — Day is ahead on the same migration |

The registry/targeting clones are mechanical. The commit layer is the substantive problem, but not
for the reason originally stated here: Week builds the
`{event, eventId, hadFormOpenBeforeInteraction, hasMoved, type}` commit envelope in
`adapter/interactions/` (`all-day.drag.ts:93`, `all-day.resize.ts:70`, `timed.drag.ts:109`,
`timed.resize.ts:76`), while Day builds the same envelope in `adapter/commit/`. The **envelope
shape** is identical and is the unifiable part; the **mappers that populate `event`** are
view-specific by design and must stay that way.

> **CORRECTED at Gate 1.** This paragraph previously claimed both envelopes "converge on one shared
> consumer, `packages/web/src/events/mutations/useUpdateEvent.ts` — the natural landing spot for a
> unified result type." That is false and was carried over from an unverified discovery claim.
> `grep -rn "CommitResult" packages/web/src` returns 13 files, **none of them `useUpdateEvent.ts`**;
> that hook takes `{ event, shouldRemove?, applyTo? }` and never sees `eventId`, `hasMoved`,
> `hadFormOpenBeforeInteraction` or `type`. The envelope's real consumers are
> `WeekInteractionCoordinator.tsx` (8 refs) and `DayInteractionCoordinator.tsx` (8 refs).

Two prior CMP-104 runs attempted this ticket on other branches (`flash-agsdk-only`,
`opus-plus-flash-v37`). **Per the user's Gate-0-stage decision, this run starts clean and ignores
their output**, so the three runs stay independently comparable from the same base. This branch was
cut from `main` (`2d81253a`) and does not contain their code.

## Goal

Collapse the duplicated Week and Day **adapter**, **commit**, **targeting**, and **registry** layers
onto the shared interaction engine, so each of those four concerns has one implementation
parameterized per view rather than two near-identical implementations.

Specifically:

1. **Registry** — replace both 24-line clones with a single shared factory call, parameterized by
   the view's id/type attribute names.
2. **Targeting** — replace both 35-line clones (and their two 92-line copy-paste test files) with
   one shared implementation plus one table-driven test.
3. **Adapter types** — hoist the ~145 shared lines into one generic contract; keep only the genuinely
   view-specific members (`getVisibleDays`/`onRequestWeekNavigation` vs `getColumnKeys`/`getVisibleDate`)
   as the per-view extension points.
4. **Commit** *(CORRECTED at Gate 1)* — converge on **one directory layout** and **one shared
   envelope builder** for the `{event, eventId, hadFormOpenBeforeInteraction, hasMoved, type}`
   shape, which is genuinely identical across both views. **Retain the per-view
   visual→GridEvent mappers as the declared extension point** — they diverge because a Week
   column is a date and a Day column is a calendar, and unifying them would change one view's
   behavior (forbidden by AC-3). There is no naming convention to converge: both views already
   export the same four function names. The unified `InteractionCommitResult` type lands in the
   shared interaction layer and is consumed by the two **coordinators**, not by
   `useUpdateEvent.ts`. See `requirements.md` §5.1 and §5.2.
5. **Geometry (opportunistic)** — finish the layout-cache migration Week is behind on, so both views
   import the shared `GridLayoutCacheSources` rather than Week keeping a local alias family.

## Files in scope

**Whole trees** (files may be moved, merged, or deleted inside them):

- `packages/web/src/interaction/**`
- `packages/web/src/grid/interaction/**`
- `packages/web/src/views/Week/interaction/**`
- `packages/web/src/views/Day/interaction/**`

**Individual files** (import/type updates only — no behavior change intended):

- `packages/web/src/views/Week/WeekView.tsx`
- `packages/web/src/views/Week/components/Grid/Grid.tsx`
- `packages/web/src/views/Week/components/Grid/AllDayRow/AllDayEvents.tsx`
- `packages/web/src/views/Week/components/Grid/MainGrid/MainGridEvents.tsx`
- `packages/web/src/views/Week/hooks/shortcuts/useWeekShortcutOwner.ts`
- `packages/web/src/views/Day/components/Calendar/DayCalendarGrid.tsx`
- `packages/web/src/views/Day/components/Calendar/DayCalendarEventCards.tsx`
- `packages/web/src/views/Day/hooks/shortcuts/useDayEventNudgeShortcuts.ts`
- `packages/web/src/events/mutations/useUpdateEvent.ts` — **expected to need NO edit.** Verified at
  Gate 1: it does not reference any commit-result type (`grep -rn "CommitResult"` → 13 files, not
  this one) and takes `{ event, shouldRemove?, applyTo? }`. It stays in the frozen allowlist so the
  write contract does not churn, but no packet should invent a reason to touch it. Its
  cross-calendar guards and `fastDeepEqual` no-op short-circuit are invariants (`requirements.md`
  PB-8).

**Test files** (may be updated for moved imports; see acceptance criteria for the limits):

- `packages/web/src/views/Week/components/Grid/MainGrid/MainGrid.test.tsx`
- `packages/web/src/views/Week/components/Grid/MainGrid/eventReadOnlyInteraction.test.tsx`
- `packages/web/src/views/Week/components/Grid/MainGrid/keyboardEditForm.test.tsx`
- `packages/web/src/views/Week/hooks/shortcuts/useWeekShortcutOwner.test.tsx`
- `packages/web/src/views/Day/hooks/shortcuts/useDayEventNudgeShortcuts.test.tsx`

All 14 individual paths above were verified to exist at HEAD `2d81253a`.

## Files off-limits

Project defaults from `.sdlc/project.json.off_limits_default`:
`.env`, `.env.*`, `.mcp.json`, `.cursor/rules/**`, `.claude/settings.local.json`,
`node_modules/**`, `dist/**`, `build/**`, `.next/**`, `.sdlc/**`, `.git/**`

AI configs detected in the repo (default OFF-LIMITS):
`.claude/**`, `.codex/**`, `.cursor/**`, `.agents/**`, `AGENTS.md`, `.mcp.json`

Repo-specific additions:
`compass.yaml`, `.playwright-compass.yaml`, `bun.lock`, `patches/**`, `buildcache/**`,
`packages/*/build/**`, `packages/*/node_modules/**`, `playwright-report/**`, `test-results/**`,
`blob-report/**`, `.github/workflows/**`

Run-only additions (out of this ticket's blast radius):
`packages/backend/**`, `packages/sync/**`, `packages/scripts/**`, `packages/core/**`, `e2e/**`

`packages/core` is read-only context for this run — imported, never edited.

## Acceptance criteria

1. *(AMENDED at Gate 2 to 301 files; that amendment was ITSELF stale and is superseded by the
   measured result.)* **MEASURED: `bun test:web` → 2305 pass / 0 fail / 303 files, exit 0.**
   The Gate 2 figure of 301 was computed before the Gate 2 directive added stage SC's two
   characterization files. Correct arithmetic: 302 − 2 (targeting tests collapsed) + 1
   (table-driven replacement) + 2 (SC) = **303 files**; 2298 + 7 (SC) + 0 (the collapse is net
   zero: 8 `it()` before, 8 after) = **2305 pass**. **No pre-existing test was lost**, which is the
   actual invariant. See `requirements.md` AC-1 / AC-5a.
2. `bun type-check` passes. Required in addition to the test command: this refactor unifies
   exported *type* names across views, and `bun test:web` alone will not catch type breakage.
3. All Week **and** Day interaction behavior — drag, resize, click-place, keyboard-place, and draft
   handling — is semantically identical after the change. Neither view's behavior is allowed to
   change to match the other.
4. Each of the four concerns (adapter, commit, targeting, registry) has **one** implementation
   after the change, with per-view differences expressed as parameters or narrow extension points
   rather than duplicated files.
5. *(RESTATED at Gate 2, finding F1 — assertion level, not file level.)* Existing test files may be
   edited **only** to follow moved imports or renamed types. No **assertion** may be weakened,
   skipped, deleted or changed. File-level consolidation is permitted **only** where every
   assertion survives as a table case with identical expectations — the S2 targeting collapse must
   preserve exactly **8 `it()` cases** (4 per view before, 8 table cases after). If the collapse
   would drop or alter any assertion, **stop and bubble up**. Adding new tests is permitted.

5a. *(DIRECTED at Gate 2.)* **Characterization tests are required before the commit layer is
   touched.** `change_plan.md` §6 rates R1 (Week's cross-row same-day drop forcing `hasMoved: true`
   — potential user-visible data loss) and R10 (Week's timed resize maps unconditionally, Day's is
   gated) as the highest-risk items, and **no existing test covers either**. Both must be pinned by
   a new test that **passes against unmodified HEAD before stage S5 runs**. A characterization test
   that only goes green after the refactor documents the change rather than guarding against it. If
   either cannot be written inside the frozen allowlist, stop and bubble up.
6. *(RESTATED at Gate 1 — the original wording named `useUpdateEvent.ts` and was unsatisfiable.)*
   A single unified `InteractionCommitResult` type lands in the shared interaction layer, and both
   `WeekInteractionCoordinator.tsx` and `DayInteractionCoordinator.tsx` consume it via
   **type-annotation-and-import changes only**. Week's three-branch commit routing
   (`!hasMoved` → reopen · `hadFormOpenBeforeInteraction` → rebuild draft + reopen form ·
   else → `updateEvent`) and Day's one-branch routing (straight to `updateEvent`) are preserved
   **verbatim**. `useUpdateEvent.ts` is **not** edited.
7. Net line count across the four in-scope interaction trees goes **down**. (Baseline: Week 5428 +
   Day 2375 = 7803 lines across the two view trees.)

   > **MEASURED — FAILS AS WRITTEN, ruling needed at Gate 3.** Two-tree total is **7817**, over by
   > **14 lines**. The overage is entirely the Gate-2-directed characterization tests (322 lines:
   > Week 173 + Day 149), which land inside the two view trees. **Excluding them: 7495, passing
   > with 308 lines of headroom.** AC-7 was written before those tests were directed.
   >
   > Also note this criterion says "across the four in-scope trees" but its baseline only counts
   > **two**. On the all-four measure the refactor is **+438** (12 636 → 13 074), because roughly
   > half the two-tree reduction is *relocation* into `grid/interaction/**` rather than deletion.
   > See `requirements.md` AC-7 / AC-7a.

## Non-goals

- Adding any new user-facing capability to either view. This is consolidation only.
- Changing `packages/core`, the backend, the sync package, or the e2e suite.
- Rewriting the shared engine's public contract (`createInteractionEngine`) — it is the target to
  unify *onto*, not a thing to redesign.
- Reconciling the Week and Day **coordinators** (`WeekInteractionCoordinator.tsx` 217 lines,
  `DayInteractionCoordinator.tsx` 133 lines). Discovery rated their overlap **low**.
  **RELAXED at Gate 1 (option A), to exactly this extent and no further:** editing both
  coordinators' **type annotations and imports** so they consume the unified
  `InteractionCommitResult` is **IN SCOPE**. Any change to coordinator **logic** — control flow,
  branch structure, the runtime object, draft handling, `updateEvent` call shape — remains a
  **non-goal**. If the implementation finds it wants a logic change, it must **stop and bubble it
  up as a Gate revision**, never perform it.
- Adopting, cherry-picking, or reconciling with the output of the two prior CMP-104 runs.
- Adding `.sdlc/` to `.gitignore` — `main` deliberately tracks the SDLC layer (commit `2d81253a`).
