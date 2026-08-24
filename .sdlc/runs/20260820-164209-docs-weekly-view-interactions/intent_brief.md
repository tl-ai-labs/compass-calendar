# Intent Brief — docs — Weekly view interactions README section

## Context
Root `README.md` currently covers "Why try compass", Features, Tech stack,
Getting started, and Resources — it has no interaction-level detail on how
the Week view actually works. Three relevant behaviors already exist in the
product and are documented at engineer/QA depth in `docs/`, but not
summarized anywhere user-facing:
- Multi-day select/drag on the week grid — mechanics documented in
  `docs/frontend/week-drag-interaction.md`.
- Recurring events (create/edit/delete scope, series vs. occurrence) —
  documented as a QA runbook in `docs/acceptance/recurring-events.md`.
- Event colors — an 11-slot color picker (`EventColorPicker`) already wired
  into the Event detail panel and grid chip rendering, with **no existing
  doc** anywhere in the repo.

## Goal
Add a new "Weekly view interactions" section to root `README.md`, written
for end users (matching the README's existing tone), covering:
1. Multi-day select — brief user-facing description, linking to
   `docs/frontend/week-drag-interaction.md` for implementation detail.
2. Recurring events — brief user-facing description, linking to
   `docs/acceptance/recurring-events.md` for the full UX runbook.
3. Event colors — brief user-facing description (no existing doc to link to;
   write this one fresh from the current `EventColorPicker` implementation).

Style: summarize + link out, not self-contained — keep each blurb short,
point to the deeper docs rather than duplicating their content.

## Task type
doc_update

## Files in scope
- README.md

## Files off-limits
- Everything else, per project defaults (`.env*`, `.mcp.json`,
  `.cursor/rules/**`, `.claude/settings.local.json`, `node_modules/**`,
  `dist/**`, `build/**`, `.next/**`, `.sdlc/**`, `.git/**`).
- All source under `packages/**` — this is a docs-only change, no code
  should be touched.
- Existing docs under `docs/**` — link to them, do not edit them as part of
  this run.

## Acceptance criteria
- README.md contains a new "Weekly view interactions" section (or
  equivalently-named heading under an appropriate existing section) covering
  all three behaviors: multi-day select, recurring events, event colors.
- The multi-day select and recurring events blurbs link to
  `docs/frontend/week-drag-interaction.md` and
  `docs/acceptance/recurring-events.md` respectively.
- The event colors blurb accurately reflects the current implementation
  (11 named color slots via `EventColorPicker`, persisted per event, applied
  to the grid chip) without overclaiming features that don't exist.
- No other files are modified.
- Markdown renders cleanly (valid links, consistent heading level with
  surrounding sections).

## Non-goals
- Do not write new engineer-facing documentation for event colors under
  `docs/` — the fresh content lives only in the README blurb for this run.
- Do not modify `docs/frontend/week-drag-interaction.md` or
  `docs/acceptance/recurring-events.md`.
- Do not touch any application code, even if it would make a description
  "more accurate" — flag any doc/implementation mismatch found instead of
  fixing the implementation.
