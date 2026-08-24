# Brownfield discovery — compass-calendar

- **Run ID:** `20260819-212923-feature-extend-weekbody-multiday-drag`
- **Mode:** first-time (full scan)
- **Plugin version:** 0.5.0
- **Scope:** Tier 1 (cheap local reads). Tier 2 confirmations happen at Gate 0.

---

## Git state

| Field | Value |
|---|---|
| HEAD | `4189de1389d8a4644ae20d9c5a907f1d161b5496` |
| Branch | `main` (tracking `origin/main`) |
| Remote | `git@github.com:tl-ai-labs/compass-calendar.git` |
| Dirty | No — only untracked `.sdlc/` |
| Tracked files | 1,582 |
| `.gitignore` covers `.sdlc/` | **No** |

Working tree is clean, so rollback anchoring on `4189de13` is safe.

## Directory topology

```
.agents/   .claude/   .codex/   .cursor/   .github/
docs/      e2e/       packages/  patches/  self-host/
```

Entry points: `packages/web/src/index.tsx`, `packages/backend/src/app.ts`,
`packages/sync/src/app.ts`, `packages/scripts/src/cli.ts`.

## Detected stacks

Single-language monorepo: **TypeScript on the Bun runtime**.

| Manifest | Package | Notable |
|---|---|---|
| `package.json` (root) | `compass` | bun@1.3.14, node >=24, TypeScript 7.0.2, Biome, Playwright |
| `packages/web/package.json` | `@compass/web` | React 18, Zustand 5, TanStack Router/Query, Tailwind 4, Zod, Dexie, TipTap |
| `packages/backend/package.json` | `@compass/backend` | Express, SuperTokens, MongoDB |
| `packages/core/package.json` | `@compass/core` | Zod shared contracts |
| `packages/sync/package.json` | `@compass/sync` | Google APIs sync |
| `packages/scripts/package.json` | `@compass/scripts` | build/test tooling |

**Monorepo:** Lerna (`lerna.json`) over Bun workspaces (`packages/*`). No Nx/Turbo/pnpm.

**Path aliases** (from `AGENTS.md`, enforced by `.cursor/rules/imports-and-packages.mdc`):
`@web/*` → `packages/web/src/*`, `@core/*` → `packages/core/src/*`, plus
`@compass/backend|core|sync|scripts`. Deep relative imports are discouraged.

**Adapter note:** v1 ships `generic.md`, `nest.md`, `python.md`. This repo is a
React SPA on Bun — no matching pre-authored adapter, so the adaptive stack
profile (Tier 2b) is recommended before codegen.

## Test / build commands

Proposed default: **`bun test:web`**
Source: `AGENTS.md` "Validation defaults" + `package.json#scripts.test:web`.

`AGENTS.md` explicitly instructs: *"Avoid defaulting to `bun test`; use the
focused package test first."* The upcoming intent touches `packages/web` only,
so the scoped web suite is correct. Full `bun test` chains all five packages and
requires a Mongo environment for backend/sync/scripts.

| Purpose | Command |
|---|---|
| Web unit tests (proposed) | `bun test:web` |
| Full suite | `bun test` |
| Core | `bun test:core` |
| Types | `bun type-check` |
| Lint | `bun lint` (Biome + semantic-color check) |
| E2E | `bun test:e2e` (Playwright) |
| Diff-aware | `bun run verify` |

Gate 0 must confirm `bun test:web`.

## Docs present

`README.md`, `AGENTS.md`, `CONTRIBUTING.md`, `SECURITY.md`, `CODE_OF_CONDUCT.md`,
`docs/README.md` (docs index), `docs/architecture/`, `docs/frontend/`,
`docs/features/`, `docs/backend/`, `docs/development/`.

## Detected AI/agent setup

| Path | Type |
|---|---|
| `.claude/settings.json`, `.claude/launch.json` | Claude Code project config |
| `.cursor/rules/*.mdc` (4 files) | Cursor rules |
| `.cursor/hooks.json`, `.cursor/hooks/format-after-edit.ts` | Cursor format-on-edit hook |
| `.codex/config.toml`, `.codex/hooks.json` | Codex config + hooks |
| `.agents/skills/` (9 skills) | Shared agent skills |
| `.agents/skills/chaos/agents/openai.yaml` | External model agent config |
| `AGENTS.md` | Cross-agent instructions |

Absent: `CLAUDE.md`, `.mcp.json` (gitignored, not on disk), `.cursorrules`,
`.aider.conf.yml`, `.continue/`, Copilot instructions, `.roo/`,
repo-local `routing-policy.yaml`.

## Coexistence risks

- **Cursor rules detected** at `.cursor/rules/`. The plugin will never touch
  them, but `web-styles.mdc` and `web-testing.mdc` encode the exact conventions
  generated code must match — feed them to codegen as inputs.
- **Cursor AND Codex format-after-edit hooks are live.** `AGENTS.md` states
  formatting is handled by repo-local Codex and Cursor hooks after agent edits.
  Files this plugin writes may be reformatted out-of-band by Biome, so diffs may
  not match byte-for-byte what was emitted.
- **`.sdlc/` is not gitignored.** Run artifacts under `.sdlc/` (packets,
  backups, telemetry) will be untracked but visible to `git add -A`. Gate 0
  should offer to add `.gitignore` to this run's allowlist so the plugin can add
  the entry as part of the run.
- **Aggressive `.gitignore` globs.** The repo ignores `*.mjs` and `*.env*`
  repo-wide. Any `.mjs` helper written into user source would be silently
  untracked. Prefer `.ts` for anything landing in the repo.
- **No custom MCP servers.** `.mcp.json` is gitignored and absent.
- **No repo-local `routing-policy.yaml`** — the shipped policy applies.

## Repo-state risks

| Risk | Severity | Detail |
|---|---|---|
| Git-LFS | none | Not in use; `.gitattributes` has no lfs filters |
| Submodules | none | No `.gitmodules` |
| Dirty tree | none | Clean apart from untracked `.sdlc/` |
| `.sdlc/` not ignored | medium | Visible to `git add -A` |
| `*.mjs` ignore glob | medium | Silently untracks emitted `.mjs` |
| External format hooks | low | May rewrite plugin output |
| Failing tests | not assessed | Tier 1 does not execute tests; Gate 0 should baseline `bun test:web` |

## Env / secrets

No `.env*` files exist on disk. Configuration is via `compass.yaml` (gitignored,
holds secrets) bootstrapped from the tracked `compass.example.yaml`.

Env var **names only** referenced in code: `API_BASEURL`, `COMPASS_BUILD_REF`,
`GOOGLE_CLIENT_ID`, `NODE_ENV`, `PORT`, `POSTHOG_HOST`, `POSTHOG_KEY`, `TZ`.
No values were read or recorded.

## Infrastructure

11 GitHub Actions workflows (`test-unit.yml`, `test-e2e.yml`, deploy staging /
production, docker publish, error-autofix). Docker assets under `.github/docker`
and `self-host/`. No Terraform, GitLab CI, CircleCI, or Jenkins.

## Regulated-repo signals

Only `SECURITY.md` (a standard OSS vulnerability-disclosure policy). No HIPAA /
PCI / SOC2 / GDPR / compliance directories or CODEOWNERS security-team entries.
**No regulated-repo warning required.**

## Proposed off-limits

```
.git/**                     .claude/**              .codex/**
.cursor/**                  .agents/**              AGENTS.md
.mcp.json                   compass.yaml            .playwright-compass.yaml
*.env*                      .env                    .env.*
node_modules/**             build/**                buildcache/**
packages/*/build/**         packages/*/node_modules/**
bun.lock                    patches/**              .github/workflows/**
playwright-report/**        test-results/**         blob-report/**
```

`.github/workflows/**` is proposed off-limits because CI changes carry deploy
risk; move it into scope at Gate 0 if the intent requires it.

---

## Intent-relevant files

Intent: *extend WeekBody multi-day drag.* Everything below is in `packages/web`.

### Important correction: there is no `WeekBody` component

`grep -rn "WeekBody"` across the repo returns **zero hits**. No file, component,
or symbol by that name exists. The week-view body is assembled by `Grid.tsx`
through a render-prop chain. Any plan that assumes a `WeekBody.tsx` file will
target a path that does not exist.

### Week view composition (the "WeekBody" equivalent)

| Path | Role |
|---|---|
| `packages/web/src/views/Week/WeekView.tsx` | View root; renders `Header`, `DayLabels`, `WeekInteractionCoordinator`, `Grid`, `Draft`, `Shortcuts`, `Dedication` |
| `packages/web/src/views/Week/components/Grid/Grid.tsx` | **The body composition root.** Nests `AllDayRow` → `MainGrid` → `EventGrid` via render props; wires `onAllDayMouseDown` and `onTimedMouseDown` |
| `packages/web/src/views/Week/components/Grid/AllDayRow/AllDayRow.tsx` | All-day row container; owns all-day mousedown wiring |
| `packages/web/src/views/Week/components/Grid/AllDayRow/AllDayEvents.tsx` | All-day event layer |
| `packages/web/src/views/Week/components/Grid/AllDayRow/AllDayEvent.tsx` | Single all-day chip |
| `packages/web/src/views/Week/components/Grid/MainGrid/MainGrid.tsx` | Timed grid container; owns `startTimedDraftCreation` |
| `packages/web/src/views/Week/components/Grid/MainGrid/MainGridEvents.tsx` | Timed event layer |
| `packages/web/src/views/Week/components/Grid/WeekGridScrollArea.tsx` | Scroll container |
| `packages/web/src/views/Week/components/Header/Header.tsx`, `DayLabels.tsx` | Week header siblings |
| `packages/web/src/views/Week/layout.constants.ts` | `GRID_Y_START` and layout constants |
| `packages/web/src/views/Week/week-view.types.ts` | Week view types |

Shared (view-agnostic) grid primitives:

| Path | Role |
|---|---|
| `packages/web/src/grid/components/EventGrid.tsx` | Combined all-day + timed grid renderer |
| `packages/web/src/grid/components/TimedGrid.tsx` | Timed columns |
| `packages/web/src/grid/components/AllDayGridRow.tsx` | All-day row primitive (mousedown surface) |
| `packages/web/src/grid/components/AllDayEventCard.tsx` | All-day card |
| `packages/web/src/grid/grid.constants.ts` | `DRAFT_DURATION_MIN`, `GRID_TIME_STEP`, `EVENT_ALLDAY_HEIGHT` |

### Drag-to-create / drag-to-select interaction code

**Timed grid — real drag-create exists:**

| Path | Role |
|---|---|
| `packages/web/src/grid/hooks/useTimedDraftCreation.ts` | **Reference implementation** (238 lines). Pointer-down → move-threshold → live draft resize → finish. Uses `TIMED_DRAFT_CREATE_MOVE_THRESHOLD_PX`, `hasExceededInteractionMoveThreshold`, `isEligibleInteractionPointerDown` |
| `packages/web/src/views/Week/hooks/grid/useTimedGridDraftCreation.ts` | Week-view binding (20 lines) — maps x/y to a date via `dateCalcs.getDateByXY`, commits with `draftActions.startGridDraft` |
| `packages/web/src/views/Day/components/Calendar/useDayTimedDraftCreation.ts` | Day-view binding of the same hook |

**All-day row — click-only, NO drag (this is the gap):**

| Path | Role |
|---|---|
| `packages/web/src/grid/hooks/useAllDayDraftCreation.ts` | **66 lines, no drag at all.** Single mousedown handler: reads `getStartDate(clientX, clientY)`, hardcodes `endDate = start + 1 day`, builds the draft, returns. No mousemove, no mouseup, no threshold |
| `packages/web/src/grid/hooks/useAllDayDraftCreation.test.tsx` | Existing test coverage |
| `packages/web/src/grid/layout/all-day-draft.position.ts` | `positionAllDayDraftEvent` — places the live all-day draft |

**Existing drag/resize (for already-created events, not creation):**

| Path | Role |
|---|---|
| `packages/web/src/interaction/interaction.engine.ts` | Core pointer interaction engine |
| `packages/web/src/interaction/interaction.pointer.ts` | Pointer eligibility + move threshold |
| `packages/web/src/interaction/interaction.constants.ts` | Threshold constants |
| `packages/web/src/grid/interaction/math/all-day.drag.ts` | **All-day multi-day drag math already exists** |
| `packages/web/src/grid/interaction/math/all-day.resize.ts` | All-day resize math (multi-day span change) |
| `packages/web/src/grid/interaction/math/cross-row.drag.ts` | All-day ↔ timed row transitions |
| `packages/web/src/grid/interaction/math/timed.drag.ts`, `timed.resize.ts` | Timed equivalents |
| `packages/web/src/grid/interaction/math/snap.ts` | `clamp`, `snapToStep` |
| `packages/web/src/grid/interaction/math/drag-column.ts` | Column resolution from pointer x |
| `packages/web/src/grid/interaction/layout.cache.ts` | `GridLayoutCache`, `getNearestDayColumn` |
| `packages/web/src/views/Week/interaction/WeekInteractionCoordinator.tsx` | Wires the engine into the week view |
| `packages/web/src/views/Week/interaction/adapter/week-interaction.adapter.ts` | Week adapter |
| `packages/web/src/views/Week/interaction/adapter/interactions/all-day.drag.ts` | All-day drag interaction |
| `packages/web/src/views/Week/interaction/adapter/interactions/all-day.resize.ts` | All-day resize interaction |
| `packages/web/src/views/Week/interaction/adapter/commit/all-day.commit.ts` | Commits all-day changes |
| `packages/web/src/views/Week/hooks/grid/useDragEdgeNavigation.ts` | Week-flip while dragging at edges |
| `packages/web/src/views/Week/hooks/grid/useDragEventSmartScroll.ts` | Auto-scroll during drag |

> The multi-day *geometry* is already solved for moving and resizing existing
> all-day events (`all-day.drag.ts`, `all-day.resize.ts`, `cross-row.drag.ts`,
> `drag-column.ts`). The missing piece is a **creation** gesture in the all-day
> row that reuses that column math, mirroring `useTimedDraftCreation`.

### Event-draft creation path

| Path | Role |
|---|---|
| `packages/web/src/events/grid-event-draft.adapter.ts` | `createGridEventDraft`, `allDayGridSchedule`, `timedGridSchedule`, `replaceGridDraftSchedule`, `gridEventDraftToSchemaEvent` — **the schedule constructors a multi-day drag must call** |
| `packages/web/src/events/event-draft.types.ts` | `GridEventDraft` type |
| `packages/web/src/events/event-draft.parser.ts` | Draft parsing/validation |
| `packages/web/src/common/utils/draft/draft.util.ts` | Draft helpers |
| `packages/web/src/common/utils/draft/reposition-draft-by-keyboard.util.ts` | Keyboard repositioning |
| `packages/web/src/views/Week/components/Draft/Draft.tsx` | Draft render root |
| `packages/web/src/views/Week/components/Draft/grid/GridDraft.tsx` | Grid draft renderer |
| `packages/web/src/views/Week/components/Draft/context/DraftProvider.tsx` | Draft context provider |
| `packages/web/src/views/Week/components/Draft/hooks/actions/useDraftActions.ts` | Draft actions |
| `packages/web/src/views/Week/components/Draft/hooks/state/useDraftState.ts` | Draft local state |
| `packages/web/src/views/Week/components/Draft/grid/hooks/useGridMouseMove.ts`, `useGridMouseUp.ts` | Grid pointer handlers during drafting |
| `packages/web/src/views/Week/components/Grid/useGridEventDraftHandlers.ts` | Draft handler wiring |
| `packages/web/src/interaction/dom/draft-event.ts`, `draft-event.clone.ts` | Draft DOM element handling |

### State / store holding draft events

| Path | Role |
|---|---|
| `packages/web/src/events/stores/draft.store.ts` | **Canonical draft store** (Zustand + devtools). Holds `State_DraftEvent { status, gridDraft }`. `Activity_DraftEvent` union already includes `"creating"` — documented as *"A drag-create gesture is live and `gridDraft` is its running preview"*. Exposes `draftActions` (`startGridDraft`, `discard`), selectors `selectGridDraft`, `selectIsDrafting` |
| `packages/web/src/events/stores/draft.store.test.ts` | Store tests |
| `packages/web/src/events/stores/view.store.ts` | View state |
| `packages/web/src/events/stores/undo.store.ts` | Undo/redo — a new creation gesture should register here |
| `packages/web/src/grid/shortcuts/edge-focus.store.ts` | Keyboard edge focus |

The `"creating"` activity already exists in the store's union, so the multi-day
all-day drag can reuse the established `startGridDraft({ activity: "creating" })`
lifecycle rather than introducing new state.

### Likely test targets

- `packages/web/src/grid/hooks/useAllDayDraftCreation.test.tsx`
- `packages/web/src/grid/interaction/math/all-day.interaction.test.ts`
- `packages/web/src/grid/layout/all-day-draft.position.test.ts`
- `packages/web/src/views/Week/components/Draft/grid/GridDraft.test.tsx`
- `packages/web/src/views/Week/WeekView.render.test.tsx`
- `packages/web/src/events/stores/draft.store.test.ts`
- E2E: `e2e/allday/event-smoke.spec.ts`

### Conventions to respect

- `.cursor/rules/web-testing.mdc` and `.cursor/rules/web-styles.mdc` govern web
  test and style conventions — read before generating.
- Use `@web/*` and `@core/*` aliases, never deep relative imports.
- Shared web/backend contracts belong in `packages/core` and use Zod.
- Tests colocate with source as `*.test.ts` / `*.test.tsx`, run by `bun test`.

---

## Notes

Scan completed within the Tier 1 timebox. No sampling fallback was needed
(1,582 tracked files). No files outside `.sdlc/` were written.
