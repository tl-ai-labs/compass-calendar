# Discovery — run 20260820-212654-docs-weekly-view-interactions-v3

**Mode:** refresh → `cached`
**Verified at:** 2026-08-20T21:26:54Z
**Repo:** `/home/sainadh/projects/compass-calendar/compass/compass-calendar`

## Baseline reuse

`discovery-refresh.mjs` returned **`cached`**: git HEAD is unchanged and no stack
manifest mtime moved since the living baseline was built.

- Baseline built at `2026-08-20T04:32:08Z` by run `20260819-212923-feature-extend-weekbody-multiday-drag`
- `git_head_baseline` = `git_head_current` = `4189de1389d8a4644ae20d9c5a907f1d161b5496`
- Age: **0 commits behind**, ~17 hours old
- `policy_changed`: false · `manifests_changed`: none · `delta_files`: none

No re-scan was performed. Groups 2, 3, 4, 6, 7, 8 and 9 are reused verbatim from
`.sdlc/baseline/current.json`. Groups 1 (git state) and 5 (docs) were re-read,
plus a targeted verification pass for this run's docs intent (see below).

`.sdlc/baseline/current.json` and `.sdlc/baseline/discovery.md` were **not**
rebuilt, per the caller's instruction and the `cached` decision.

## Drift since baseline (all benign)

| Kind | Severity | Detail |
|---|---|---|
| Branch changed | none | Baseline was built on `main`; this run is on `CMP-102/opus-only-v5`, branched from `main` at the same SHA `4189de1`. Tree content is identical. |
| New untracked dir | low | `.hook-logs/` (contains `hook.jsonl`) appeared since baseline. Not gitignored. Added to proposed off-limits. |
| Plugin version | low | Baseline recorded `plugin_version: 0.5.0`; the running plugin is `0.6.0`. `schema_version` is still `1`, so the cached baseline remains valid. |

Working tree is otherwise **clean** — `git status --porcelain -uno` returns nothing.
Untracked: `.sdlc/`, `.hook-logs/`.

## Repo shape (from cached baseline)

Bun + Lerna monorepo, `packages/*` workspaces, TypeScript 7, React 18.

| Package | Root | Test command |
|---|---|---|
| `@compass/web` | `packages/web` | `bun test:web` |
| `@compass/backend` | `packages/backend` | `bun test:backend` |
| `@compass/core` | `packages/core` | `bun test:core` |
| `@compass/sync` | `packages/sync` | `bun test:sync` |
| `@compass/scripts` | `packages/scripts` | `bun test:scripts` |

Proposed test command: **`bun test:web`** (source: `AGENTS.md#Validation-defaults`).
AGENTS.md explicitly says *"Avoid defaulting to `bun test`; use the focused package
test first."*

**Docs-intent note:** this run is expected to touch `README.md` (and possibly
`docs/`) only. No package test is meaningful for a pure-markdown change; the
relevant gates are `bun lint` (Biome formats markdown) and a link check. Gate 0
should confirm whether any test command runs at all.

## Intent scope — docs: Weekly view interactions

Target: add a "Weekly view interactions" section to `README.md`.

`README.md` is **57 lines**, with headings:

```
# Compass Calendar
## Why try compass?
###   You'll get more done / You'll get less done / It'll be around for the long-term
## Features
## Tech stack
## Getting started
## Resources
```

There is **no existing "Weekly view" or "interaction" content in README.md** — a
grep for `weekly view|week view|interaction` returns nothing. The new section is
genuinely additive. `## Features` is the natural anchor.

`docs/README.md` maintains a **"Common Change Paths"** bullet list that already
links `week-drag-interaction.md` and `recurring-events.md`. If this run creates a
new event-colors doc, that index is the conventional place to register it.

## Verification of prior-run findings

The caller supplied three facts from runs on `CMP-102/flash-agsdk-only` and
`CMP-102/opus-plus-flash-v37`. All three **still hold at `4189de1`**, with
caveats.

### 1. Multi-day select — CONFIRMED, with a scope caveat

`docs/frontend/week-drag-interaction.md` exists (5,359 bytes). Last commit to
touch it: `a7e2b167 refactor(web): simplify calendar grid organization (#2159)`.
Headings: *The one-sentence model · Why this exists · How it works now ·
Mid-drag week navigation · updateVisual Must Be Idempotent · Pitfall*.

Supplementary coverage:
- `docs/frontend/event-caching.md` § *Multi-day timed events in the all-day row*
  (`isTimedMultiDayDisplay`, `isTimedEventMultiDay`, `timedMultiDayToAllDayDates`)
- `docs/architecture/glossary.md` — a timed event crossing midnight renders as a
  multi-day span in the all-day row without becoming an all-day event

**Caveat:** the doc describes dragging and resizing **existing** events across day
columns. All-day commits use a *date-diff delta* (`dayjs(dayDate).diff(dayjs(initialDayDate), "day")`)
precisely because multi-day spans are clamped to the visible window. It does not
cover drag-to-create. See the accuracy risk below.

### 2. Recurring events — CONFIRMED

`docs/acceptance/recurring-events.md` exists (8,607 bytes) with **5 scenarios**:
create weekly · create daily with end date · edit *this event only* · edit *this
and following* · edit *all events*.

**Caveat:** this is an **acceptance runbook** (Setup / Steps / Expected Results),
written for manual QA, not a user-facing overview. Linking it from a README
feature section sends readers to test steps. `docs/architecture/event-domain-model.md`
is the conceptual companion.

### 3. Event colors — CONFIRMED, no doc exists

No `docs/` file is about event colors. `color` appears only incidentally in
`frontend-runtime-flow.md`, `shortcuts.md`, `event-domain-model.md`,
`google-sync.md`, `types-and-validation.md`, `feature-file-map.md`, and
`testing-playbook.md`.

The "~11 color slots" figure is **exactly 11**, defined as a zod enum:

- Source of truth: `packages/core/src/types/event-color.contracts.ts` →
  `EventColorSlotSchema = z.enum([lavender, mint, plum, coral, gold, orange,
  blue, slate, indigo, green, red])`
- Hex + label maps: `packages/web/src/common/styles/theme.util.ts` →
  `EVENT_COLOR_SLOT_HEX`, `EVENT_COLOR_SLOT_LABEL`
- Component: `packages/web/src/views/Forms/EventForm/EventColorPicker/EventColorPicker.tsx`
  (plus a colocated `.test.tsx`)
- Mounted from: `EventForm.tsx` and `ContextMenu/ContextMenuItems.tsx`

The picker renders **12 swatches**: the 11 slots plus a leading `null`/default
swatch. Accessibility shape is a `<fieldset>` with an `sr-only` legend
"Event color"; each swatch is a radio input with an `aria-label` and a hover
tooltip.

The contract carries a comment worth surfacing in docs: slots map **1:1 onto
Google's legacy 11 event colors**; providers adapt at the boundary. A separate
custom-provider-color path exists for Google's post-June-2026 colors.

## Docs accuracy risks

### HIGH — multi-day drag-CREATE is not shipped on this branch

`packages/web/src/grid/hooks/useAllDayDraftCreation.ts` is **66 lines** with no
`pointermove` / drag handling. It derives `endDate` from `startDate` and builds a
fixed single-day draft. All-day creation is click-only at `4189de1`.

The prior runs the caller referenced (`CMP-102/flash-agsdk-only`,
`CMP-102/opus-plus-flash-v37`) were **feature** runs that *implemented* all-day
multi-day drag-create on their own branches. This branch is clean from `main`, so
that feature does not exist here.

What *does* exist and is safe to document as "multi-day select":
- `allDayResize` — resizing an existing all-day event's leading/trailing edge
  across days (`packages/web/src/grid/interaction/math/all-day.resize.ts`,
  `adapter.helpers.ts` maps it to a `row-resize` cursor)
- cross-row drag (`packages/web/src/grid/interaction/math/cross-row.drag.ts`)
- multi-day span *rendering* of timed events in the all-day row

**Do not write a README claim that users can drag across days in the all-day row
to create a new multi-day event.** That would ship a false statement.

### MEDIUM — enumerating color names will drift

The 11 names live in a zod enum in `packages/core`. Listing them verbatim in
README creates a second source of truth. Prefer the count plus a link to
`event-color.contracts.ts`.

### LOW — acceptance-runbook link mismatch

See the recurring-events caveat above.

## Coexistence risks

Carried from the cached baseline, plus one new entry:

- **Cursor rules** at `.cursor/rules/` (4 `.mdc` files: `imports-and-packages`,
  `sync-package`, `web-styles`, `web-testing`) — untouched by default, but they
  encode the conventions codegen must match.
- **Cursor AND Codex format-on-edit hooks are active** (`.cursor/hooks.json`,
  `.codex/hooks.json`, `.cursor/hooks/format-after-edit.ts`). AGENTS.md states
  formatting is handled by these repo-local hooks after agent edits. Files this
  plugin writes may be reformatted out-of-band by Biome — including markdown.
- **NEW: `.hook-logs/`** appeared since the baseline (`hook.jsonl`) — almost
  certainly output from those format-after-edit hooks. Untracked, not gitignored.
- **`.gitignore` does NOT cover `.sdlc/`.** Run artifacts (packets, backups,
  telemetry) are untracked but visible to `git add -A`. Gate 0 should offer to add
  `.gitignore` to this run's allowlist so the entry can be added as part of the run.
  Consider covering `.hook-logs/` in the same edit.
- **`.gitignore` contains a repo-wide `*.mjs` rule** — any `.mjs` emitted into user
  source would be silently untracked.
- `.mcp.json` is gitignored and absent locally; no competing MCP servers registered.
- No repo-local `routing-policy.yaml` — the shipped policy applies.

## Proposed off-limits

```
.git/**            .claude/**         .codex/**        .cursor/**
.agents/**         AGENTS.md          .mcp.json        compass.yaml
.playwright-compass.yaml              *.env*           .env      .env.*
node_modules/**    build/**           buildcache/**
packages/*/build/**                   packages/*/node_modules/**
bun.lock           patches/**         playwright-report/**
test-results/**    blob-report/**     .github/workflows/**
.hook-logs/**      <- new this run
```

## Regulated-repo signals

One signal: `SECURITY.md` at repo root. This is a standard OSS security-policy
file, not a compliance-obligation marker. `regulated_repo_warning_required`
remains **false**; no Gate 0 warning required.

## Timing

Well inside the Tier 1 budget — the `cached` decision meant no full scan. Targeted
verification (docs existence, color contract, all-day creation hook) added roughly
6 seconds of bounded reads.
