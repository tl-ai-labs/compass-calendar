# Intent Brief — docs — Weekly view interactions

## Context

Compass Calendar's week view has three interaction surfaces that are undocumented for
contributors: all-day / multi-day selection, recurring-event display, and event colors.

The repo's root `README.md` is a 57-line landing page (Why try compass → Features → Tech stack
→ Getting started → Resources) whose Features section is five one-line bullets. Reference-depth
interaction documentation does not fit there. The house location for this material is
`docs/frontend/`, which already holds `week-drag-interaction.md`, `frontend-runtime-flow.md`,
`responsive-layout.md`, and `event-caching.md`.

`docs/frontend/` house style, confirmed by discovery:
- explanatory prose, heavily source-cited with inline backticked repo-relative paths
- several pages open with a bolded `## The one-sentence model` thesis
- each page closes with a named trap section (`## Pitfall`, `## Memo Comparator Trap`)
- Mermaid used sparingly (only `week-drag-interaction.md` has any)

Existing overlap to respect, not duplicate:
- `docs/frontend/week-drag-interaction.md` already covers dragging **saved** events
- `docs/acceptance/recurring-events.md` already covers recurrence UX as a manual runbook

Baseline: source is identical to `4189de1` (the only drift since is `.sdlc/` bookkeeping and a
`.gitignore` change). Branch `CMP-102/opus-plus-flash-v37-sdk` sits on main's tip with no feature
commits.

## Goal

Add a new contributor-facing page, `docs/frontend/weekly-view-interactions.md`, documenting the
week view's interaction model across three topics — multi-day / all-day selection, recurring
events, and event colors — in `docs/frontend/` house style, citing the implementing modules by
repo-relative path.

Add one pointer to it from the root `README.md` so the landing page stays short.

Audience: contributors / engineers.

## Task type

doc_addition

## Files in scope

- `docs/frontend/weekly-view-interactions.md` — new file, the section body
- `README.md` — one pointer bullet only, no restructuring

## Files off-limits

Everything else. Explicitly:

- `packages/**` — this run changes no source. Documentation only.
- `docs/frontend/week-drag-interaction.md`, `docs/acceptance/recurring-events.md` — the new page
  links to these; it does not edit them
- `.sdlc/**`, `.git/**`, `.github/**`
- `.claude/**`, `.cursor/**`, `.codex/**`, `.agents/**`, `AGENTS.md` — all detected AI configs,
  off-limits by default
- `compass.yaml`, `compass.example.yaml`, `*.env*`, `.mcp.json`
- `package.json`, `packages/*/package.json`, `bun.lock`, `biome.json`, `patches/**`
- `node_modules/**`, `build/**`, `buildcache/**`, `packages/*/build/**`
- `e2e/**`, `playwright-report/**`, `test-results/**`, `blob-report/**`

## Acceptance criteria

- AC-1 `docs/frontend/weekly-view-interactions.md` exists and covers all three topics.
- AC-2 Every behavioral claim is true of **this branch's** source. In particular the doc must
  state that all-day event *creation* is click-only with a fixed one-day span
  (`useAllDayDraftCreation.ts` hardcodes `endDate = dayjs(startDate).add(1, "day")`, no
  `mousemove` listener), and that multi-day spans arise from *move and resize* of saved events,
  not from drag-selection at create time. Drag-to-select a span exists only in the timed grid
  (`useTimedDraftCreation.ts`).
- AC-3 Colors section states the two constraints: the 11 Compass color slots are a Zod enum in
  `packages/core/src/types/event-color.contracts.ts` mapping 1:1 to Google's legacy colors, and
  `colorHex` is **read-only** / provider-assigned — the picker only ever writes `color`.
- AC-4 No example shows a raw Tailwind or theme color utility class (`bun run lint` runs
  `check-semantic-colors.ts`, which bans them in `packages/web/src`).
- AC-5 Matches `docs/frontend/` house style: source-cited inline paths, and a closing named trap
  section.
- AC-6 Links to `week-drag-interaction.md` and `acceptance/recurring-events.md` rather than
  restating them.
- AC-7 `README.md` gains exactly one pointer; no other line changes.
- AC-8 No file under `packages/` is modified. `git diff --name-only` lists only the two in-scope
  files.

## Gate 0 outcome (approved 2026-09-03)

- Auth mode: `estimated` (claude-cli subscription; cost is an estimate booking cached=0).
- Multi-day handling: **document what exists and name the gap** — click-to-create with a fixed
  one-day span, multi-day via move/resize of saved events, contrasted with the timed grid's
  drag-select, and an explicit statement that all-day drag-to-create is not implemented on this
  branch.
- `docs/README.md` index: not edited. Root `README.md` pointer only.
- Write contract frozen and enforcement probe-verified live: a `Write` to
  `packages/web/src/__mmo_write_contract_probe__.ts` was denied against `packages/**`.

## Non-goals

- No source changes, no new tests, no behavior changes.
- Not fixing the pre-existing red test
  (`RecurrenceSection > keeps the event's own date selectable when the event ends after
  midnight` — date-dependent rot, fails on a clean tree).
- Not implementing all-day drag-to-create, however tempting once documented as absent.
- Not restructuring the README or the `docs/` tree.
- Not editing `docs/README.md`'s "Common Change Paths" index (raise at Gate 0 if wanted).
