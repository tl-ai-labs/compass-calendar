# Discovery — run 20260826-082906-refactor-week-day-interaction

- **Mode:** refresh → `incremental`
- **Built:** 2026-08-26T08:31:51Z
- **Plugin:** mmo 0.6.0
- **Intent:** refactor — *unify the duplicated Week and Day interaction adapter/commit/targeting/registry layers on top of the shared interaction engine*

## Refresh decision

`discovery-refresh.mjs` returned `incremental`: 9 files changed across 2 commits since the baseline
(built 2026-08-20T04:32:08Z at `4189de1`). Current HEAD is `2d81253a`.

The delta was **verified, not assumed**:

```
git diff --name-only 4189de1..2d81253a | grep -v '^\.sdlc/' | grep -v '^\.gitignore$'
→ (empty)
```

Changed: `.gitignore` (M) plus seven newly-added `.sdlc/**` files. **Zero application source changed**, and all
stack manifests still carry pre-baseline mtimes (2026-08-19). The existing baseline is therefore still
source-accurate; groups 2, 3, 4, 5, 7 and 9 are carried forward unchanged. Groups 1 (git), 6 (AI config) and
8 (topology/monorepo/submodule/LFS) were re-scanned because the `.gitignore` edit and the branch change
touch them.

`stack-profile.md` is reused as-is for the same reason.

## Git state

| Field | Value |
|---|---|
| HEAD | `2d81253ab8a4c8e69b27e28d12c6ae9cc61d1bfe` |
| Branch | `CMP-104/opus-plus-sonnet` (cut from `main`) |
| Dirty | yes — `.claude/settings.json` modified (tracked); `.sdlc/local/` untracked |
| Remote | `origin` → `git@github.com:tl-ai-labs/compass-calendar.git` |
| Tracked files | 1590 |
| `.sdlc/` gitignored | **partially** — see coexistence risks |

No application source is dirty. The one dirty tracked file is off-limits.

## Detected stacks

Bun 1.3.14 / Node ≥24 / TypeScript 7.0.2 monorepo (lerna + bun workspaces, `packages/*`).
Five packages: `@compass/web`, `@compass/backend`, `@compass/core`, `@compass/sync`, `@compass/scripts`.
Web is React 18 + Zustand + TanStack Router/Query + Tailwind 4, tested with testing-library + msw.
No pre-authored adapter matches; the adaptive stack profile at `.sdlc/baseline/stack-profile.md` is authoritative.

No submodules. No Git-LFS. No `.env*` files (config is `compass.yaml`, gitignored).

## Test command

**Proposed: `bun test:web`** — from `AGENTS.md` § Validation defaults (Web → `bun test:web`) and
`package.json#scripts.test:web`. The refactor is confined to `packages/web`.

**Recommend pairing with `bun type-check`.** This refactor unifies exported *type* names across the two
views. Type breakage is the primary regression risk and `bun test:web` will not surface it.

`AGENTS.md` explicitly warns against defaulting to the full `bun test`. Gate 0 confirms.

## Intent scope — interaction layers

### Prior finding re-verified: no `WeekBody`

Searched `packages/web/src`, `e2e/` and `docs/` at HEAD `2d81253a` for `WeekBody` / `week-body`:
**zero matches**. The prior discovery's note **still holds** — the week body is composed by
`packages/web/src/views/Week/components/Grid/Grid.tsx` (156 lines) via `AllDayRow > MainGrid > EventGrid`.

### Shared interaction engine

`packages/web/src/interaction/` — 1527 lines. The generic core is
`interaction.engine.ts` (604 lines), exporting `createInteractionEngine<TTarget, TVisual, TResult>`, with the
adapter contract `InteractionAdapter<TTarget, TVisual, TResult>` in `interaction.adapter.types.ts` (51 lines).

A second shared substrate sits at `packages/web/src/grid/interaction/` (2625 lines) and already holds the
factories the per-view layers wrap — `view-event-registry.ts` (`createViewInteractionRegistry`),
`event.targeting.ts` (`createGridEventTargeting`), `layout.cache.ts`, and all the drag/resize math modules.

**The unification target already exists.** Both views already sit on top of it. What is duplicated is the
thin per-view *naming and placement* layer above it.

### Four-layer map

| Layer | Week | Day |
|---|---|---|
| adapter | `adapter/week-interaction.adapter.ts` (795) + types (149) + `edge-navigation.ts` (146) + `geometry/week-layout.cache.ts` (73) + `interactions/` (5 files, 385) | `adapter/day-interaction.adapter.ts` (607) + types (149) + `geometry/day-layout.cache.ts` (76) |
| commit | `adapter/commit/all-day.commit.ts` (65), `adapter/commit/timed.commit.ts` (38) — **pure mappers only** | `adapter/commit/all-day.commit.ts` (67), `adapter/commit/timed.commit.ts` (100) — **full orchestrators** |
| targeting | `targeting/week-event.targeting.ts` (35) + test (92) | `targeting/day-event.targeting.ts` (35) + test (92) |
| registry | `registry/week-event.registry.ts` (24) + test (440) | `registry/day-event.registry.ts` (24) + test (141) |
| coordinator | `WeekInteractionCoordinator.tsx` (217) + `useWeekInteractionLayoutSync.ts` (44) + `state/` (78) | `DayInteractionCoordinator.tsx` (133) |
| **total** | **5428 lines** | **2375 lines** |

## Duplication evidence

1. **Registry — pure name-substitution clone (high).** Both files are 24 lines. `diff` reports 22 changed
   lines, *all* of them `Week`↔`Day` identifier renames. Both call `createViewInteractionRegistry()` and
   re-export the same eight members under prefixed names. No view-specific logic exists in either.

2. **Targeting — pure name-substitution clone (high).** Both 35 lines; 50 diff lines, all renames plus one
   Biome reformat of a generic argument. Both wrap `createGridEventTargeting<T>()`.

3. **Targeting tests — copy-paste (high).** Both exactly 92 lines; 28 diff lines, all renames. Same
   `describe`/`it` bodies and fixtures.

4. **Adapter types — parallel definitions (medium).** Both exactly 149 lines. The four commit-result shapes,
   `*InteractionPointerOwnership`, `*InteractionAdapterOptions` and `*InteractionRuntime` are structurally
   the same. Real divergence is narrow: Week's runtime adds `getVisibleDays()` and
   `onRequestWeekNavigation()`; Day's options add `getColumnKeys()` and `getVisibleDate()`.

5. **Commit — divergent *placement* of the same concern (high; highest-value target).** This is drift, not
   cloning. Week's `commit/` holds only pure `*VisualToGridEvent` mappers, and builds the
   `{event, eventId, hadFormOpenBeforeInteraction, hasMoved, type}` envelope elsewhere — in
   `adapter/interactions/all-day.drag.ts:93`, `all-day.resize.ts:70`, `timed.drag.ts:109`,
   `timed.resize.ts:76`. Day has **no** `interactions/` directory; its `commit/` holds the full
   `commit*Interaction()` orchestrators that build that same envelope. One concern, two directory names,
   two function-naming conventions.

6. **Geometry — partial-migration asymmetry (medium).** Day already imports the shared
   `GridLayoutCacheSources` directly; Week still re-exports a local `WeekLayoutCacheSources` /
   `WeekLayoutCache` / `WeekLayoutCacheInput` alias family. Day is further along the same migration.

7. **Adapter bodies — parallel implementations on a shared skeleton (medium).** Identical top-level shape
   (`inertRuntime` const → `create*InteractionAdapter` factory → private `isAllDayTarget` guard), both
   importing the same three engine modules. Week's extra ~190 lines are genuinely week-only edge-navigation
   and multi-column-window concerns.

8. **Coordinators — parallel React wrappers (low).** 188 diff lines; both wrap `PointerCaptureBoundary` and
   `useUpdateEvent`. Unify only after the layers below converge.

### Call sites

Week: `WeekView.tsx`, `components/Grid/Grid.tsx`, `Grid/AllDayRow/AllDayEvents.tsx`,
`Grid/MainGrid/MainGridEvents.tsx`, `hooks/shortcuts/useWeekShortcutOwner.ts`.
Day: `components/Calendar/DayCalendarGrid.tsx`, `components/Calendar/DayCalendarEventCards.tsx`,
`hooks/shortcuts/useDayEventNudgeShortcuts.ts`.
Shared boundary: `packages/web/src/events/mutations/useUpdateEvent.ts` consumes both views' commit results —
**the one file both sides meet in**, so it is the natural place for the unified result type to land.

Test call sites: `MainGrid.test.tsx`, `eventReadOnlyInteraction.test.tsx`, `keyboardEditForm.test.tsx`,
`useWeekShortcutOwner.test.tsx`, `useDayEventNudgeShortcuts.test.tsx`.

## Detected AI/agent setup

`.claude/` (settings.json — dirty, settings.local.json — new since baseline, launch.json), `.cursor/`
(4 `.mdc` rules, hooks.json, hooks/format-after-edit.ts), `.codex/` (config.toml, hooks.json), `.agents/skills/`
(9 skills), `AGENTS.md`. Absent: `CLAUDE.md`, `.mcp.json`, `.cursorrules`, aider, continue, copilot, roo,
repo-local `routing-policy.yaml`.

## Coexistence risks

- **Cursor rules** at `.cursor/rules/` — never touched, but `web-styles.mdc` and `web-testing.mdc` encode
  conventions codegen must match.
- **Cursor AND Codex format-on-edit hooks are both active.** `AGENTS.md` states formatting is handled by
  these repo-local hooks after agent edits. Files this plugin writes may be reformatted out-of-band by Biome.
- **`.gitignore` does not cover `.sdlc/`.** It now ignores only `.sdlc/**/_gemini_worker_save/` and
  `.sdlc/local/debug.log` (added in the current delta), plus `.hook-logs/`. Every other run artifact —
  `packets.json`, `changes.md`, `backups/<file>` — stays untracked but visible to `git add -A`. Gate 0 should
  offer to add `.gitignore` to this run's allowlist.
- **Repo-wide `*.mjs` ignore rule** — any `.mjs` emitted into user source would be silently untracked.
- **`.claude/settings.json` is dirty** and `.claude/settings.local.json` is new. Both off-limits; neither
  must be staged by this run.
- No competing MCP servers; no repo-local routing policy.

## Regulated-repo signals

One low-signal hit: `SECURITY.md` at repo root (a standard OSS policy file). No HIPAA/PCI/SOC2/GDPR markers,
no compliance-team CODEOWNERS entries. `regulated_repo_warning_required: false`.

## Proposed files-in-scope allowlist

Whole trees (files are moved/deleted inside them):
`packages/web/src/interaction/**`, `packages/web/src/grid/interaction/**`,
`packages/web/src/views/Week/interaction/**`, `packages/web/src/views/Day/interaction/**`.

Individually (import-update-only): `views/Week/WeekView.tsx`, `views/Week/components/Grid/Grid.tsx`,
`views/Week/components/Grid/AllDayRow/AllDayEvents.tsx`,
`views/Week/components/Grid/MainGrid/MainGridEvents.tsx`,
`views/Week/hooks/shortcuts/useWeekShortcutOwner.ts`,
`views/Day/components/Calendar/DayCalendarGrid.tsx`,
`views/Day/components/Calendar/DayCalendarEventCards.tsx`,
`views/Day/hooks/shortcuts/useDayEventNudgeShortcuts.ts`,
`events/mutations/useUpdateEvent.ts`, plus the five test files listed under Call sites.

## Proposed off-limits

Standing: `.git/**`, `.claude/**`, `.codex/**`, `.cursor/**`, `.agents/**`, `AGENTS.md`, `.mcp.json`,
`compass.yaml`, `.playwright-compass.yaml`, `*.env*`, `node_modules/**`, `build/**`, `buildcache/**`,
`packages/*/build/**`, `packages/*/node_modules/**`, `bun.lock`, `patches/**`, `playwright-report/**`,
`test-results/**`, `blob-report/**`, `.github/workflows/**`.

Added for this run only: `packages/backend/**`, `packages/sync/**`, `packages/scripts/**`,
`packages/core/**`, `e2e/**`. The refactor is confined to `packages/web`; `packages/core` is read-only
context (`domain-primitives`, `dayjs`) — imported, never edited.
