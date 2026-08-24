# Intent Brief — docs — Weekly view interactions README section

## Context
Root `README.md` (57 lines) currently covers "Why try compass", Features, Tech
stack, Getting started, and Resources — it has no interaction-level detail on
how the Week view actually works. This run is the third leg of a CMP-102
policy comparison (after `CMP-102/flash-agsdk-only` and
`CMP-102/opus-plus-flash-v37`), branched clean from `main` as
`CMP-102/opus-only-v5`.

Discovery on this branch corrected one assumption carried over from the
prior two runs: **this branch has no drag-to-create for multi-day all-day
events** (`useAllDayDraftCreation.ts` derives a fixed single-day draft; that
capability exists only on separate feature branches, not here). The three
topics, verified fresh at this HEAD:

1. **Multi-day select** — what *does* exist here: edge-resize of an all-day
   event across days (`grid/interaction/math/all-day.resize.ts`), cross-row
   drag of an existing event (`math/cross-row.drag.ts`), and multi-day span
   rendering of timed events in the all-day row. Mechanics documented in
   `docs/frontend/week-drag-interaction.md` — that doc covers drag/resize of
   *existing* events, not creation; do not describe it as create-by-drag.
2. **Recurring events** — create/edit/delete scope (series vs. occurrence),
   documented in `docs/acceptance/recurring-events.md`. Note: that file is a
   manual QA runbook (5 scenarios), not a user-facing overview — link to it
   as "how it's tested," not as a feature guide.
3. **Event colors** — an 11-slot color picker (`EventColorPicker`, backed by
   a zod enum in `packages/core/src/types/event-color.contracts.ts`) plus a
   12th default/no-color swatch. **No existing doc anywhere in the repo.**
   Write this blurb fresh, without enumerating all 11 color names (avoids a
   second source of truth against the zod enum that will drift).

## Goal
Add a new "Weekly view interactions" section to root `README.md`, under
`## Features` (the natural anchor — `README.md` has no interaction content
today), written for **end users** matching the README's existing tone,
covering:
1. Multi-day select — accurate to what exists on this branch: resizing/
   dragging an existing event across multiple days in the week grid. Link to
   `docs/frontend/week-drag-interaction.md` for implementation detail. Do
   not claim drag-to-create.
2. Recurring events — brief user-facing description of series vs. single
   occurrence editing. Link to `docs/acceptance/recurring-events.md`,
   framed as the detailed test/behavior reference.
3. Event colors — brief fresh description (assign a color per event via the
   event detail panel; color shows on the grid chip). No color-name
   enumeration, no link (none exists).

Style: summarize + link out, not self-contained — keep each blurb short,
point to the deeper docs rather than duplicating their content.

## Task type
doc_update

## Files in scope
- README.md
- .gitignore (Gate 0: append a `.sdlc/` entry — this branch was cut clean
  from `main` and doesn't carry the fix a sibling CMP-102 branch already
  made on its own history)

## Files off-limits
- Everything else, per project defaults (`.env*`, `.mcp.json`,
  `.cursor/rules/**`, `.claude/settings.local.json`, `node_modules/**`,
  `dist/**`, `build/**`, `.next/**`, `.sdlc/**`, `.git/**`), plus existing
  AI configs (`.claude/settings.json`, `.claude/launch.json`,
  `.cursor/hooks.json`, `.cursor/hooks/format-after-edit.ts`,
  `.codex/config.toml`, `.codex/hooks.json`, `.agents/skills/**`,
  `AGENTS.md`) and `.hook-logs/**` (new since baseline, untracked
  format-hook output).
- All source under `packages/**` — docs-only change, no code touched.
- Existing docs under `docs/**` — link to them, do not edit them this run.

## Acceptance criteria
- README.md contains a new "Weekly view interactions" section under
  `## Features` covering all three behaviors: multi-day select, recurring
  events, event colors.
- The multi-day select blurb describes resize/cross-row drag of an
  *existing* event, not creation, and links to
  `docs/frontend/week-drag-interaction.md`.
- The recurring events blurb links to `docs/acceptance/recurring-events.md`.
- The event colors blurb accurately reflects the current implementation
  (per-event color via `EventColorPicker`, shown on the grid chip) without
  enumerating specific color names or counts.
- No other files are modified besides README.md and .gitignore.
- `.gitignore` gains a `.sdlc/` entry (appended, not restructured).
- Markdown renders cleanly (valid links, consistent heading level with
  surrounding sections).

## Non-goals
- Do not write new engineer-facing documentation for event colors under
  `docs/` — the fresh content lives only in the README blurb for this run.
- Do not modify `docs/frontend/week-drag-interaction.md` or
  `docs/acceptance/recurring-events.md`.
- Do not claim or imply drag-to-create for multi-day all-day events — not
  present on this branch.
- Do not touch any application code, even if it would make a description
  "more accurate" — flag any doc/implementation mismatch found instead of
  fixing the implementation.
