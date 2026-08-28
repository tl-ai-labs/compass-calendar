# Requirements (delta) — refactor: unify Week and Day interaction layers

- **Run:** `20260826-115739-refactor-week-day-interaction`
- **Intent:** `refactor` → Phase 1 runs in **delta form: what must be preserved**
- **Sources:** `intent_brief.md`, `discovery.md` (§2 duplication analysis and §3 blast radius are
  taken as given and are not re-derived here)
- **Guarantee chosen at intake:** *UX identical, internals free.*

This is a behavior-preserving refactor. There is therefore no new functional behavior to specify.
The requirements below are **invariants**: the properties the post-refactor code must still have.
Each is written to be checkable, and each names the artifact that proves it.

---

## In scope

1. Collapse the mechanically duplicated Week/Day interaction **wiring** — `registry/`, `targeting/`,
   and the structurally parallel `adapter/` — onto one shared, **view-parameterized** layer sitting on
   the existing `src/interaction/` engine and `src/grid/interaction/` substrate.
2. Reconcile the false-friend `commit/` pair: Week's `adapter/commit/*` (pure visual→`GridEvent`
   mappers) and Day's `adapter/commit/*` (whole `commitXInteraction` functions returning a result
   envelope) must end up at **one** agreed abstraction level, with Week's `adapter/interactions/*`
   folded into the same scheme.
3. Update every import/reference at the 25 call sites enumerated in discovery §3, with no behavior
   change at any of them.
4. Rewrite/relocate existing tests to follow moved code, subject to FR-9 (no coverage regression).
5. Biome formatting on touched files only.

## Out of scope

1. **Closing Day's gaps.** Day has no cross-row drag, no motion flag, and no edge navigation.
   Unification must not grant Day any of them, even where the shared substrate already exists
   (`grid/interaction/math/cross-row.drag.ts`, `grid/interaction/commit/cross-row.commit.ts`).
2. Any user-visible behavior change in either view.
3. Editing anything under `e2e/**` (write-off-limits; see FR-3).
4. Renaming DOM attributes, `data-testid`s, or the `viewName` tokens.
5. Repo-wide style or lint sweeps.
6. The coordinators' data sourcing. `WeekInteractionCoordinator` keeps sourcing via
   `useWeekEventViewModel` + `useDraftContext`; `DayInteractionCoordinator` keeps taking events as
   props. Discovery judged these legitimately divergent.
7. Any package other than `packages/web` — `packages/core`, `backend`, `sync`, `scripts` are
   off-limits in the frozen write contract.

---

## Functional requirements (preservation invariants)

### Module: registry

- **FR-1 — One registry implementation, parameterized by view.** After the refactor there is exactly
  one non-generated implementation of the per-view registry shell. Week and Day differ only by the
  string literal passed to `createViewInteractionRegistry`.
- **FR-2 — Registry instance identity is preserved.** `weekEventRegistry` / `dayEventRegistry` are
  today **module-level singletons** (`week-event.registry.ts:8,22`, `day-event.registry.ts:8,22`):
  the registration refs used by the event cards and the targeting helpers that resolve them read the
  **same** instance. A parameterized layer must keep exactly one registry instance per view for the
  lifetime of the module. A factory that returns a fresh registry per call site would type-check,
  pass unit tests in isolation, and silently break focus/targeting at runtime. This is the single
  highest-risk failure mode in the registry concern.
- **FR-3 — DOM attributes are byte-identical.** The `viewName` argument must remain `"week"` and
  `"day"`, so the emitted attributes stay `data-week-interaction-event-{id,type}` and
  `data-day-interaction-event-{id,type}` (`view-event-registry.ts:26-29`). These are hard-coded in
  `e2e/timed/move-event-reduced-days.spec.ts:38` and `e2e/calendars/calendar-experience.spec.ts:456`,
  which `bun test:web` does **not** cover. If any step of the refactor appears to require an e2e edit,
  that is a signal FR-3 was violated — **halt and raise it, do not edit e2e.**
- **FR-4 — Cross-view consumers keep working.** `CALENDAR_VIEW_INTERACTION_ID_ATTRIBUTES` and its
  derived selectors (`view-event-registry.ts:37-66`) are consumed by `common/utils/event/event.util.ts`
  and `shortcuts/tips/**` and must keep resolving an event id from either view's card.

### Module: targeting

- **FR-5 — One targeting implementation, parameterized by view.** Week's and Day's targeting files
  are a pure token substitution over `createGridEventTargeting` plus a `TARGET_SELECTOR` built from
  the registry's two attributes. One implementation; the four exported helpers must remain callable
  by `useWeekShortcutOwner.ts` and `useDayEventNudgeShortcuts.ts` with unchanged semantics (including
  the `isVisibleEventElement` visibility rule at `event.targeting.ts:56-62`).

### Module: adapter

- **FR-6 — The engine contract holds, and `updateVisual` stays idempotent.** The unified adapter must
  still satisfy `InteractionAdapter<TTarget, TVisual, TResult>`
  (`interaction.adapter.types.ts:23-51`), and `updateVisual` must remain safe to call twice with the
  same pointer: the engine re-invokes it at pointerup to recompute before commit (`:37-38`). Any
  accumulate-into-visual rewrite introduced while merging the two adapters violates this.
- **FR-7 — Essential Week/Day divergence survives.** Unification is of *wiring*, not of these:
  - Week columns resolve to **dates** — the runtime supplies `getVisibleDays(): string[]`.
  - Day columns resolve to **calendars** — options supply `getColumnKeys(): string[]` and
    `getVisibleDate(): Dayjs`; a column change is a **`calendarId`** change via
    `columnMoveCalendarId` (`Day/.../commit/timed.commit.ts:77-83`).
  - Week all-day drag keeps **delta** semantics (`Week/.../commit/all-day.commit.ts:14-31`) because
    multi-day spans are clamped to the rendered window.
  - Day all-day drag keeps **own-dates** semantics (`Day/.../commit/all-day.commit.ts:21-31`) because
    rewriting to the visible date truncates a multi-day all-day event.
  - Day's remaining commit quirks are preserved *as they are*, not normalized: Day all-day **resize**
    does rewrite to `visibleDate`/`visibleDate+1` (`Day/.../all-day.commit.ts:59-67`), and Day's
    all-day drag guards with `"dayDate" in visual` (`:18-19`). These asymmetries are current behavior;
    tidying them is a behavior change and out of scope.
- **FR-8 — Week-only features survive intact.** Specifically:
  - drag-to-edge week paging — `adapter/edge-navigation.ts` (dwell `500ms`) + `state/edge-navigation.state.ts`;
  - `rebuildLayoutAfterNavigation` and its `useWeekInteractionLayoutSync` support (sole caller
    `WeekInteractionCoordinator.tsx:74`);
  - cross-row drag (all-day ↔ timed);
  - the `window.__weekInteractionMotionActive` flag (`state/motion.state.ts`), read by
    `GridEvent.tsx:116`, `useVisibleDayCount.ts`, `useGridLayout.ts`, **and globally reset at
    `__tests__/utils/state/reset-stores.ts:42`** — if the flag moves, that reset must move with it or
    tests leak state across files.
  - Day gains none of the above (see Out of scope 1).

### Module: call sites

- **FR-9 — Week's test coverage is not leveled down.** Week's adapter carries **48 tests / 149
  assertions across 6 files**; Day's carries **14 / 39 in one**. Post-refactor coverage of Week's
  adapter behavior is preserved or increased. Merging Week's 6 adapter suites into one Day-shaped
  suite is an explicit failure, even if the totals happen to hold.
- **FR-10 — No writes outside the frozen allowlist.** Enforced at the tool boundary by
  `.sdlc/local/write-contract.json` (`strict: true`). A refused write is a scope signal to surface,
  not an obstacle to route around.

---

## Non-functional requirements

- **NFR-1 — Suite green, no net loss.** `bun test:web` passes at ≥ the pre-run baseline of
  **2298 pass / 0 fail across 302 files**.
- **NFR-2 — Seam probe holds.** `bun test src/views/Week/interaction src/views/Day/interaction
  src/grid/interaction src/interaction` stays at **≥ 159 pass / 0 fail**.
- **NFR-3 — No new runtime dependencies**, and no change to `package.json`, `bun.lock`, or `patches/**`
  (all off-limits).
- **NFR-4 — Conventions.** Generated code matches `.cursor/rules/web-styles.mdc` and `web-testing.mdc`
  (read-only inputs; the rule files themselves are off-limits). Repo-local Cursor/Codex format-after-edit
  hooks may reformat written files out-of-band — output must be Biome-stable so that reformat is a no-op.
- **NFR-5 — Type safety preserved.** No new `any`, no `@ts-expect-error`, and the adapter generics stay
  parameterized rather than widened to `unknown` to make the two views fit one signature.
- **NFR-6 — Reviewability.** The change lands as discrete, per-concern packets (registry → targeting →
  adapter/commit → call sites) so a failure is attributable to one concern rather than one 5,000-line diff.

---

## PII inventory

**Not applicable to this change.** This is a front-end pointer-interaction refactor. No new field is
read, stored, logged, or transmitted; no packet in this run touches a network call, a persistence layer,
or a logger. Calendar event titles and `calendarId`s already flow through this code path and continue to
do so **unchanged** — the refactor must not add any new sink for them (a stray `console.log` of a
`GridEvent` while debugging a merged adapter is the realistic risk, and Phase 8 checks for it on changed
files).

## Role matrix

**Not applicable.** There is no authorization surface in `packages/web/src/{interaction,grid/interaction}`
or the two view interaction trees. Access control lives in `packages/backend/**`, which is off-limits for
this run and unmodified by it.

---

## Acceptance criteria

These are the binding criteria from the approved intent brief, restated as checks:

1. **AC-1** `bun test:web` ≥ 2298 pass / 0 fail across 302 files. *(NFR-1)*
2. **AC-2** Seam probe ≥ 159 pass / 0 fail. *(NFR-2)*
3. **AC-3** `grep -r "createViewInteractionRegistry(" packages/web/src` shows the `viewName` arguments
   are still exactly `"week"` and `"day"`; `grep -rc "data-week-interaction-event-id\|data-day-interaction-event-id"`
   over `e2e/` is unchanged and `e2e/**` has zero modified files in `git status`. *(FR-3)*
4. **AC-4** Registry and targeting each have **one** implementation, view-parameterized, with per-view
   singleton identity intact. *(FR-1, FR-2, FR-5)*
5. **AC-5** Week's adapter test count/assertion count is ≥ 48 / 149, still spread across ≥ 6 behavioral
   groupings. *(FR-9)*
6. **AC-6** All five Week-only features still present and exercised by tests; Day has gained none of
   them — `grep` for a Day cross-row/motion/edge-nav import returns nothing. *(FR-8, Out of scope 1)*
7. **AC-7** Week↔date and Day↔`calendarId`, Week delta vs Day own-dates all-day semantics still hold,
   each covered by an assertion. *(FR-7)*
8. **AC-8** `updateVisual` double-invocation with the same pointer yields an identical visual — asserted,
   not assumed. *(FR-6)*
9. **AC-9** `git status --porcelain` shows no modified path outside the frozen allowlist. *(FR-10)*

---

## Open questions for HITL

- **Q1 — Which abstraction level wins for `commit/`?** Discovery calls this pair the biggest obstacle:
  Week factors create/update/commit into `adapter/interactions/*` (385 LOC, a structural extraction, not
  a feature), while Day inlines the same logic against the same shared math. Both directions preserve
  behavior; they differ in diff size and in which view's tests get rewritten. My recommendation is to
  **adopt Week's factored shape** (`createX` / `updateX` / `commitX` per interaction, view-parameterized)
  and lift Day up to it — it preserves Week's 6-file test decomposition, which FR-9 protects, and moves
  the smaller of the two test suites. The cost is that Day's diff is the larger one. This will be settled
  concretely in the Phase 2 refactor plan; flagging it here because it is the one decision that changes
  the shape of every downstream packet.
- **Q2 — How far should the adapter unification go?** Two defensible stopping points: (a) unify only
  registry + targeting + the shared adapter *scaffolding*, leaving two thin view adapters that supply
  column semantics; or (b) one adapter factory fully parameterized over column resolution and commit
  strategy. (a) is materially lower-risk against FR-6/FR-7 and still removes the 100% duplicates;
  (b) removes more lines but concentrates the risk in exactly the code the brief calls essential
  divergence. Recommendation: **(a)**, with (b) noted as a follow-up. Confirm at Gate 2 if you disagree.
- **Q3 — Motion flag naming.** `window.__weekInteractionMotionActive` is a global whose name encodes
  "week". Under a shared layer the honest name would drop `week`, but that global is asserted by
  `reset-stores.ts:42` and the name is part of the observable surface in tests. Assumed answer:
  **keep the name exactly as-is** — renaming buys nothing and risks FR-8. Say so at Gate 1 if you want
  it renamed instead.
