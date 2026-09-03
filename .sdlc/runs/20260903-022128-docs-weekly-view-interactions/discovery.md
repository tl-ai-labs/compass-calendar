# Discovery — 20260903-022128-docs-weekly-view-interactions

- **Mode:** refresh → **incremental**
- **Repo:** `/home/sainadh/projects/compass-calendar/compass/compass-calendar`
- **HEAD:** `2d81253a` on branch `CMP-102/opus-plus-flash-v37-sdk`
- **Baseline superseded:** `4189de1` built 2026-08-20T04:32:08Z (plugin 0.5.0), 2 commits behind
- **Intent:** `docs` / `doc_addition` — document the week view's interaction surface for contributors

## Refresh verdict

`discovery-refresh.mjs` returned `incremental`: 9 files changed across 2 commits, `manifests_changed: []`,
`policy_changed: false`.

The caller's claim that source is unchanged was **verified, not assumed**:

```
git diff --name-only 4189de1..2d81253a | grep -v '^\.sdlc/' | grep -v '^\.gitignore$'
→ (empty)
```

All 9 changed files are `.sdlc/` bookkeeping (CLAUDE-SDLC.md, baseline/*, ledger.*, pre-check-status.json,
project.json) plus a 5-line `.gitignore` append. **Zero source, manifest, or policy drift.**

Groups re-scanned: 1 (git), 5 (docs), 6 (AI config), 7 (env), 9 (regulated signals).
Groups carried forward from the 2026-08-20 baseline: 2 (topology), 3 (stacks), 4 (test scripts), 8 (monorepo/submodules/LFS).
The cached `stack-profile.md` remains valid and was not rebuilt — no manifest drift, and this run generates no code.

## Git state

| Field | Value |
|---|---|
| head | `2d81253ab8a4c8e69b27e28d12c6ae9cc61d1bfe` |
| branch | `CMP-102/opus-plus-flash-v37-sdk` |
| dirty | yes — but **only** `.sdlc/` paths |
| source tree | **clean** |
| remote | `origin git@github.com:tl-ai-labs/compass-calendar.git` |
| gitignore covers `.sdlc/` | **no** (only two narrow subpaths) |

Modified: `.sdlc/pre-check-status.json`, `.sdlc/project.json`. Untracked: `.sdlc/local/`.
No file under `packages/`, `docs/`, or `e2e/` is modified. Branch is named CMP-102 but sits on `main`'s tip
with no feature commits yet.

## Detected stacks

Bun 1.3.14 workspace monorepo (`packages/*`), lerna + bun workspaces, TypeScript 7.0.2, Node engine `>=24`.
Five packages: `@compass/web` (React 18, Zustand, TanStack Router/Query, Tailwind 4, Dexie, Testing Library, MSW),
`@compass/backend` (Express, SuperTokens, MongoDB), `@compass/core` (Zod), `@compass/sync` (googleapis),
`@compass/scripts`. Path aliases `@web/*` → `packages/web/src/*`, `@core/*` → `packages/core/src/*`.

No pre-authored adapter matches (v1 ships generic/nest/python only) — `generic.md` plus the cached
`stack-profile.md` apply.

## Test command

**Proposed: `bun run test:web`** (source: `package.json#scripts.test:web` + `AGENTS.md` validation defaults,
which say "avoid defaulting to `bun test`; use the focused package test first").

This run writes only Markdown under `docs/`, so the suite is a regression guard, not a gate on new tests.

### The baseline is RED — pre-existing

```
packages/web/src/views/Forms/EventForm/DateControlsSection/RecurrenceSection/RecurrenceSection.test.tsx
(fail) RecurrenceSection > keeps the event's own date selectable when the event ends after midnight
5 pass / 1 fail / 1 error
```

Verified on this clean tree. It is date-dependent rot (a `waitFor` on a react-select combobox), **not** caused
by this run. Any post-run suite will look red regardless. Record the *delta*, not the absolute count.
This failure sits in the recurrence UI — the very area being documented — so do not read it as a signal that
the docs broke something.

Gotcha for the test harness: `bun run test:web -- RecurrenceSection` prefixes the filter with `./` and matches
nothing. To run a single file: `cd packages/web && bun test <path>`.

## Docs layout and house style

```
docs/README.md              index — "Start Here" + "Common Change Paths" + section lists
docs/CI-CD/                 versioning, workflows
docs/Config/                README
docs/acceptance/            auth, events, google-sync, recurring-events, shortcuts
docs/architecture/          event-domain-model, glossary, multi-account-sync, repo-architecture
docs/backend/               README (route map), backend-error-handling, backend-request-flow
docs/development/           quickstart, local-development, testing-playbook, feature-file-map,
                            common-change-recipes, types-and-validation, troubleshoot, cli,
                            hosting-modes, launch-ops-checklist, performance-baselines
docs/features/              billing, google-sync-and-sse-flow, offline-storage-and-migrations,
                            password-auth-flow
docs/frontend/              event-caching, frontend-runtime-flow, responsive-layout,
                            week-drag-interaction
docs/self-hosting/          README, backup-and-restore, customizing, event-migration-runbook,
                            google-calendar, monitoring, server-guide, upgrades
```

### `docs/frontend/` style — explanatory, source-cited

Title-Case `#` H1, then a one-or-two-line italic-free subtitle stating what the page answers.
Several pages open with a **`## The one-sentence model`** section containing a single bolded thesis sentence
(`week-drag-interaction.md`, `event-caching.md`). Then `## Why this exists` / mechanism sections.

- **Cites exact source paths constantly** — inline backticked repo-relative paths, often as a `Files:` bullet
  list under a heading. `frontend-runtime-flow.md` has 48 `packages/` references; `responsive-layout.md` has 5.
- **Mermaid diagrams** are used but sparingly — only `week-drag-interaction.md` has them (2: a `flowchart LR`
  and a `sequenceDiagram`). The other three frontend pages have none.
- Cross-links are relative (`./responsive-layout.md`).
- Ends with a **`## Pitfall`** or trap section naming the specific mistake not to repeat
  (`## Memo Comparator Trap`, `## Pitfall`, `## updateVisual Must Be Idempotent`).
- Tone is direct, second-person-free, present tense. Explains *why the current design exists* by narrating the
  bug the old design caused.

### `docs/acceptance/` style — manual-verification runbooks

Very different shape. `# Title`, one-line purpose, then a rigid template:

- `## Scope` with a "Use this guide to validate:" bullet list AND a "Do not use this guide to validate:" list
  that cross-references sibling runbooks.
- `## Setup` — numbered steps (`bun run dev:web`, log in, navigate to `/week`), then "Helpful notes:".
- `---` separators, then `## Scenario N: Title Case Description`, each with exactly three H3s:
  `### UX` (prose expectation), `### Steps` (numbered), `### Expected Results` (bullets).
- **Does not cite source paths** — purely user-visible behavior.

**Implication for this run:** a contributor-facing interaction doc belongs in `docs/frontend/`
(explanatory + source-cited), not `docs/acceptance/`. It should be linked from `docs/README.md`'s
"Common Change Paths" list, alongside the existing "Dragging/resizing events on the week grid" entry, and
possibly from `docs/development/feature-file-map.md`.

**Note the overlap:** `docs/frontend/week-drag-interaction.md` already covers dragging *saved* events
(column-date resolution, mid-drag week navigation, `updateVisual` idempotence). New content should
complement rather than restate it.

## The three requested topics

### 1. Multi-day / all-day selection and drag-create — PARTIAL, drag-create does not exist

The all-day row supports multi-day **move and resize** of already-saved events, but **creation is click-only
with a fixed 1-day span**. `packages/web/src/grid/hooks/useAllDayDraftCreation.ts` computes
`endDate = dayjs(startDate).add(1, "day")` on mousedown — there is no pointer-drag span selection.
The timed grid, by contrast, has true drag-create via `useTimedDraftCreation.ts`.
This confirms the `key_gap` recorded in the 2026-08-20 baseline; it is unchanged.

Composition: `Grid.tsx` → `AllDayRow` → `MainGrid` → `EventGrid`. There is no component named `WeekBody`.

Files:

- `packages/web/src/views/Week/components/Grid/AllDayRow/AllDayRow.tsx`,
  `AllDayEvents.tsx`, `AllDayEvent.tsx` — week-view all-day row; wires `useAllDayDraftCreation`
  to `dateCalcs.getDateStrByXY` and opens a grid draft via `draftActions.startGridDraft`.
- `packages/web/src/grid/components/AllDayGridRow.tsx`, `AllDayEventCard.tsx` — shared row + card.
- `packages/web/src/grid/hooks/useAllDayDraftCreation.ts` — **the 1-day-fixed creation path**.
- `packages/web/src/grid/hooks/useTimedDraftCreation.ts`,
  `packages/web/src/views/Week/hooks/grid/useTimedGridDraftCreation.ts` — the drag-create that *does* exist.
- `packages/web/src/grid/layout/all-day-draft.position.ts` — draft placement.
- `packages/web/src/grid/interaction/math/all-day.drag.ts`, `all-day.resize.ts` — pure math.
- `packages/web/src/grid/interaction/types/all-day-drag.types.ts`, `all-day-resize.types.ts` — visuals carry
  `dayDate` / `initialDayDate`, never a bare index.
- `packages/web/src/grid/interaction/commit/cross-row.commit.ts` — multi-day span commit.
- `packages/web/src/views/Week/interaction/adapter/interactions/all-day.drag.ts`, `all-day.resize.ts`,
  `all-day.visible-range.ts`; `adapter/commit/all-day.commit.ts`;
  `adapter/geometry/week-layout.cache.ts`.
- `packages/web/src/views/Week/interaction/WeekInteractionCoordinator.tsx` — supplies `getVisibleDays()`.
- `packages/web/src/grid/interaction/layout.cache.ts` — `buildDayColumns` stamps each column with its date.
- `packages/web/src/views/Week/hooks/grid/useDateCalcs.ts`, `useDragEdgeNavigation.ts`,
  `useVisibleDayCount.ts`.
- `packages/web/src/interaction/interaction.engine.ts` — `handlePointerUp` re-runs `updateVisual` before commit.

Key asymmetry worth documenting: **timed** commits assign the target day absolutely
(`dayjs(visual.dayDate).startOf("day")`), while **all-day** commits use a date-diff delta
(`dayjs(dayDate).diff(dayjs(initialDayDate), "day")`) because multi-day spans are clamped to the visible window.

### 2. Recurring events — exists

- Rule engine: `packages/core/src/util/event/compass.event.rrule.ts`.
- Scope machinery (This / This-and-Following / All): `packages/web/src/events/recurrence/` —
  `recurrence-scope.ts`, `recurrence-scope-decision.ts`, `recurrence-scope-opportunity.store.ts`,
  `RecurrenceScopeOpportunityHost.tsx`, `projectRecurringEdit.ts`, `useRecurrenceScopeConfirmation.ts`.
- Toast + dialog: `packages/web/src/common/utils/toast/recurrence-scope.toast.tsx`,
  `packages/web/src/views/Forms/EventForm/RecurrenceScopeDialog.tsx`.
- Form UI: `packages/web/src/views/Forms/EventForm/DateControlsSection/RecurrenceSection/` —
  `RecurrenceSection.tsx`, `RecurrenceSectionView.tsx`, `useRecurrence/useRecurrence.ts`,
  `constants/recurrence.constants.ts`, `components/RecurrenceToggle.tsx`, `components/RecurrenceIntervalSelect.tsx`.
- **Week-view-visible surface** (the part relevant to an interaction doc):
  `packages/web/src/views/Week/components/Draft/grid/getRecurringDraftPreviews.ts` — ghost previews of a
  repeating draft across the week; and `packages/web/src/grid/components/EventRepeatIcon.tsx` — the decorative
  repeat glyph shared by timed and all-day cards, tinted `darken(baseColor, 30)`, `aria-hidden` because the
  recurring state is announced through each card's `aria-label`.

User-facing behavior is already documented in `docs/acceptance/recurring-events.md`.

### 3. Event colors — exists

Eleven Compass-owned color **slots** — `lavender, mint, plum, coral, gold, orange, blue, slate, indigo, green,
red` — defined as a Zod enum in `packages/core/src/types/event-color.contracts.ts`, mapping 1:1 onto Google's
legacy 11 event colors, with providers adapting at the boundary.

- Slot → hex and labels: `packages/web/src/common/styles/theme.util.ts`
  (`EVENT_COLOR_SLOT_HEX`, `eventColorLabel`, `buildEventPaletteFromBase`).
- Tint helpers: `packages/web/src/common/styles/color.utils.ts` (`brighten`, `darken`, `isDark`, `readability`
  — tinycolor-backed); `packages/web/src/common/styles/colors.ts`.
- Picker + mutation: `packages/web/src/views/Forms/EventForm/EventColorPicker/EventColorPicker.tsx` (radio
  group over `EventColorSlotSchema.options`), `packages/web/src/views/Forms/hooks/useSetEventColor.ts`
  (optimistic replace, used by the event context menu).
- Grid rendering: `packages/web/src/grid/components/TimedEventCard.tsx`, `AllDayEventCard.tsx`,
  `packages/web/src/grid/utils/allDayColumnTint.util.ts` (all-day color wash on day columns).
- Provider mapping: `packages/sync/src/domain/color-label-map.ts`,
  `packages/sync/src/providers/google/google-color.map.ts`.

Two constraints a contributor doc must state:

1. `colorHex` is **read-only** — a provider-assigned custom color (Google's post-June-2026 event labels) with
   no Compass slot equivalent. Compass's own picker only ever writes `color`, never `colorHex`.
2. `bun run lint` runs `packages/scripts/src/testing/check-semantic-colors.ts`, which **bans raw Tailwind and
   raw theme color utilities** (`bg-blue-500`, `--color-red-400`, …) anywhere in `packages/web/src`. Docs must
   not show raw color classes in examples.

## Detected AI/agent setup

Verbatim `ai_configs_detected`:

```json
[
  { "path": ".claude/settings.json", "type": "claude-code" },
  { "path": ".claude/settings.local.json", "type": "claude-code-local",
    "detail": "gitignored via **/.claude/settings.local.json; present on disk this run (was absent at 2026-08-20 baseline)" },
  { "path": ".claude/launch.json", "type": "claude-code" },
  { "path": ".cursor/rules/", "type": "cursor",
    "detail": "4 .mdc rule files: imports-and-packages, sync-package, web-styles, web-testing" },
  { "path": ".cursor/hooks.json", "type": "cursor-hooks" },
  { "path": ".cursor/hooks/format-after-edit.ts", "type": "cursor-hook-script" },
  { "path": ".codex/config.toml", "type": "codex" },
  { "path": ".codex/hooks.json", "type": "codex-hooks" },
  { "path": ".agents/skills/", "type": "shared-agent-skills",
    "detail": "9 skills incl. ship, simplify, verify-change, a11y-audit" },
  { "path": ".agents/skills/chaos/agents/openai.yaml", "type": "external-model-agent-config" },
  { "path": "AGENTS.md", "type": "agent-instructions" }
]
```

Absent: `.mcp.json` (gitignored, not on disk), `CLAUDE.md`, `CLAUDE.local.md`, `.cursorrules`,
`.aider.conf.yml`, `.continue/`, `.github/copilot-instructions.md`, `.roo/`, `routing-policy.yaml`,
`gemini*.{yaml,json}`.

Only delta vs the 2026-08-20 baseline: `.claude/settings.local.json` now exists on disk (gitignored).

## Coexistence risks

- **Cursor rules detected** — `.cursor/rules/` holds 4 `.mdc` files (`imports-and-packages`, `sync-package`,
  `web-styles`, `web-testing`). The plugin will never touch them, but they encode conventions any generated
  content must match.
- **Cursor AND Codex format-on-edit hooks are active** — `.cursor/hooks.json`, `.codex/hooks.json`,
  `.cursor/hooks/format-after-edit.ts`. `AGENTS.md` states formatting is handled by these repo-local hooks
  after agent edits, so Markdown this plugin writes may be reformatted out-of-band by Biome.
- **No custom `.mcp.json`** — gitignored and absent locally; no competing MCP servers registered.
- **No repo-local `routing-policy.yaml`** — the shipped policy applies.
- **`.sdlc/` not gitignored** — your `.gitignore` doesn't cover `.sdlc/`. Run artifacts under `.sdlc/`
  (packets, backups, telemetry) will be untracked but visible to `git add -A`. Only
  `.sdlc/**/_gemini_worker_save/` and `.sdlc/local/debug.log` are ignored. Gate 0 will offer to add
  `.gitignore` to this run's allowlist so the plugin can add the entry as part of the run.

## Repo-state risks

| Risk | Severity | Detail |
|---|---|---|
| Pre-existing failing test | medium | 1 fail in `RecurrenceSection.test.tsx` on a clean tree — date-rot, in the area being documented |
| `.gitignore` missing `.sdlc/` | medium | run artifacts visible to `git add -A` |
| Aggressive `.gitignore` | medium | repo-wide `*.mjs` and `*.env*` globs; `.sdlc/runs/` ignored on sibling branches → use `git add -f` |
| External format hooks | low | Cursor/Codex format-after-edit may rewrite plugin output |
| Dirty tree | low | two tracked `.sdlc/` files + untracked `.sdlc/local/`; **source clean** |
| Git-LFS | none | no `filter/diff/merge=lfs` entries in `.gitattributes` |
| Submodules | none | no `.gitmodules` |
| Encrypted secrets | none | no SOPS / git-crypt / age / sealed-secrets; secrets live in gitignored `compass.yaml` |

## Env keys

No `.env*` files exist on disk. Configuration is `compass.yaml` (gitignored) with `compass.example.yaml` as the
tracked template. Env vars referenced in code (names only): `API_BASEURL`, `COMPASS_BUILD_REF`,
`GOOGLE_CLIENT_ID`, `NODE_ENV`, `PORT`, `POSTHOG_HOST`, `POSTHOG_KEY`, `TZ`.

## Regulated-repo signals

One weak signal: `SECURITY.md` at repo root (a standard OSS policy file, not a compliance marker).
`regulated_repo_warning_required: false`.

## Proposed off-limits

`.git/**`, `.claude/**`, `.codex/**`, `.cursor/**`, `.agents/**`, `AGENTS.md`, `.mcp.json`, `compass.yaml`,
`.playwright-compass.yaml`, `*.env*`, `.env`, `.env.*`, `node_modules/**`, `build/**`, `buildcache/**`,
`packages/*/build/**`, `packages/*/node_modules/**`, `bun.lock`, `patches/**`, `playwright-report/**`,
`test-results/**`, `blob-report/**`, `.github/workflows/**`.

Since the intent is `doc_addition`, the expected write scope is `docs/frontend/` (new page) plus
`docs/README.md` and possibly `docs/development/feature-file-map.md` for index links. All of `packages/**`
can be treated as read-only for this run.
