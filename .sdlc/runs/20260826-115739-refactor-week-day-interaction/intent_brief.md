# Intent Brief — refactor — Unify Week and Day interaction layers on the shared engine

## Context

`packages/web` carries two parallel view-level interaction stacks over one shared substrate:

- **Shared, already factored:** `src/interaction/` (2,240 LOC — the view-agnostic pointer engine;
  adapter contract at `interaction.adapter.types.ts:23-51`) and `src/grid/interaction/`
  (2,573 LOC — all drag/resize math, layout caches, smart-scroll, the registry factory at
  `view-event-registry.ts:27-28`, the targeting factory at `event.targeting.ts:9-54`, and the
  visual types both views already share).
- **Duplicated on top:** `src/views/Week/interaction/**` and `src/views/Day/interaction/**`, each
  with its own `adapter/`, `commit/`, `targeting/`, `registry/`.

Discovery (`.sdlc/runs/20260826-115739-refactor-week-day-interaction/discovery.md`) measured the
overlap per concern:

| Concern | Verdict | Week | Day |
|---|---|---|---|
| registry | 100% mechanical duplicate | 24 LOC | 24 LOC |
| targeting | 100% mechanical duplicate | 35 LOC | 35 LOC |
| adapter | structurally parallel, ~82% line-identical | 795 LOC | 607 LOC |
| commit | divergent abstraction level, ~0% shared | 103 LOC | 167 LOC |

What is duplicated upstairs is **wiring, not algorithms** — the algorithms are already shared.

Three findings shape the work:

1. **The `commit/` pair is a false friend.** Same directory name, same filenames, different
   responsibilities. Week's `adapter/commit/*` exports pure visual→GridEvent mappers; Day's exports
   whole `commitXInteraction` functions returning the full result envelope. Week's equivalent of
   Day's commit functions lives one directory away in `adapter/interactions/*`.
2. **Week's `adapter/interactions/*` (385 LOC) is a structural extraction, not a feature.** Day
   inlines the same logic and calls the same `grid/interaction/math/*`. Both adapters call the same
   math at different levels of abstraction — this is the single biggest obstacle to unification.
3. **Some divergence is essential and must survive.** Week columns are dates; Day columns are
   calendars. A Week drag changes the event's date; a Day drag changes its `calendarId`
   (`Day/interaction/adapter/commit/timed.commit.ts:83-94`). Week's all-day drag uses delta
   semantics because multi-day spans are clamped to the rendered window; Day's deliberately
   preserves the event's own dates so multi-day all-day events are not truncated.

## Goal

Collapse the mechanically duplicated Week/Day interaction wiring onto one shared, view-parameterized
layer built on the existing `src/interaction/` engine and `src/grid/interaction/` substrate — without
changing any user-visible behavior in either view, and without leveling Week's richer feature set or
test coverage down to Day's.

The user's guarantee, chosen at intake: **UX identical, internals free.** Week and Day
drag/resize/targeting/keyboard behavior must be indistinguishable to a user. File layout, module
boundaries, and internal APIs are all fair game, and existing tests may be rewritten to follow moved
code, provided coverage does not regress.

Call sites were explicitly left to discovery to map rather than supplied by the user; the 25 files
found are enumerated in §3 of the discovery doc and reflected in the scope below.

## Files in scope

**Primary — expected to change substantially:**

- `packages/web/src/views/Week/interaction/**`
- `packages/web/src/views/Day/interaction/**`
- `packages/web/src/grid/interaction/**`
- `packages/web/src/interaction/**`

**Call sites — import/reference updates expected, behavior unchanged:**

- `packages/web/src/views/Week/WeekView.tsx`
- `packages/web/src/views/Week/components/**`
- `packages/web/src/views/Week/hooks/**`
- `packages/web/src/views/Day/components/**`
- `packages/web/src/views/Day/hooks/**`
- `packages/web/src/views/Day/view/**`
- `packages/web/src/grid/components/**`
- `packages/web/src/grid/hooks/useTimedDraftCreation.ts`
- `packages/web/src/common/utils/event/event.util.ts`
- `packages/web/src/common/utils/event/event.util.test.ts`
- `packages/web/src/components/ContextMenu/contextMenuLayering.test.tsx`
- `packages/web/src/components/ShortcutShowcase/practice.state.ts`
- `packages/web/src/shortcuts/tips/**`
- `packages/web/src/__tests__/utils/state/reset-stores.ts`

## Files off-limits

- `.git/**`, `.claude/**`, `.codex/**`, `.cursor/**`, `.agents/**`, `AGENTS.md`, `.mcp.json`
- `compass.yaml`, `.playwright-compass.yaml`
- `*.env*`, `.env`, `.env.*`
- `node_modules/**`, `packages/*/node_modules/**`, `build/**`, `buildcache/**`, `packages/*/build/**`
- `bun.lock`, `patches/**`
- `playwright-report/**`, `test-results/**`, `blob-report/**`
- `.github/workflows/**`
- `packages/backend/**`, `packages/sync/**`, `packages/scripts/**`
- `packages/core/**`
- `e2e/**` — **write-off-limits, but live blast radius.** See acceptance criterion 3.

The four competing AI configs (`.cursor/rules/`, `.codex/`, `.agents/skills/`, `AGENTS.md`) stay
off-limits by default. Note that `.cursor/rules/web-styles.mdc` and `web-testing.mdc` encode
conventions the generated code must match even though the rule files themselves are never written to.

## Acceptance criteria

1. **Suite green.** `bun test:web` passes with no net loss against the pre-run baseline of 2298
   pass / 0 fail across 302 files. The seam-scoped probe (`bun test src/views/Week/interaction
   src/views/Day/interaction src/grid/interaction src/interaction`) stays at 159 pass / 0 fail or
   better.
2. **Registry and targeting have one implementation each**, parameterized by view rather than
   copied — these are pure `week`↔`day` token substitutions today.
3. **DOM attributes are byte-identical.** The `viewName` passed to `createViewInteractionRegistry`
   must not change. `data-week-interaction-event-id` and `data-day-interaction-event-id` are
   hard-coded in `e2e/timed/move-event-reduced-days.spec.ts:38` and
   `e2e/calendars/calendar-experience.spec.ts:456`, which `bun test:web` does not cover. Renaming
   them silently breaks e2e.
4. **Week's coverage is not leveled down.** Week's adapter carries 48 tests / 149 assertions across
   6 files; Day's carries 14 / 39 in one file. Post-refactor coverage of Week's adapter behavior
   must be preserved or increased — not averaged toward Day's.
5. **Week-only features survive intact:** drag-to-edge week paging (`adapter/edge-navigation.ts`,
   `state/edge-navigation.state.ts`), the `rebuildLayoutAfterNavigation` adapter method and its
   `useWeekInteractionLayoutSync` support, cross-row drag (all-day ↔ timed), and the
   `window.__weekInteractionMotionActive` motion flag — including its global reset at
   `__tests__/utils/state/reset-stores.ts:42`.
6. **Essential divergence survives:** Week columns resolve to dates, Day columns to `calendarId`;
   Week all-day drag keeps delta semantics, Day all-day drag keeps its own-dates semantics.
7. **The engine contract holds.** `updateVisual` remains idempotent — the engine re-invokes it at
   pointerup to recompute before commit (`interaction.adapter.types.ts:37-38`).
8. **No writes outside the allowlist**, enforced by the write contract at the tool boundary.

## Non-goals

- **Closing Day's gaps.** Day lacks cross-row drag, a motion flag, and edge navigation. Discovery
  classifies these as gaps with the substrate already built, but adding them is feature work, not
  this refactor. Unifying the layer must not quietly grant Day new behavior.
- **Changing any user-visible behavior** in either view — this is behavior-preserving by definition.
- **Editing e2e specs.** If the refactor appears to require an e2e change, that is a signal the
  refactor broke criterion 3; raise it instead of editing.
- **Renaming DOM attributes, test ids, or the `viewName` tokens.**
- **Repo-wide style or lint sweeps.** Biome formatting applies to touched files only.
- **Touching the coordinators' data sourcing.** `WeekInteractionCoordinator` sources its own data via
  `useWeekEventViewModel` + `useDraftContext`; `DayInteractionCoordinator` takes events as props.
  Discovery judged these legitimately divergent rather than duplicated.
