# Intent Brief — docs — Weekly view interactions README section

## Context
Compass's weekly grid view supports several end-user interactions that aren't currently
summarized anywhere in the root `README.md`: recurring events and event colors. (Multi-day
select was originally in scope but discovery found it is not yet implemented at this commit —
`useAllDayDraftCreation.ts` still hardcodes a 1-day draft; four prior runs targeted it but none
landed. It is excluded from this run — see Non-goals.) A developer-facing doc,
`docs/frontend/week-drag-interaction.md`, already covers drag mechanics in implementation detail
and should be linked rather than duplicated.

Audience: end users of the calendar app — plain description of what they can do, not
implementation detail.

## Goal
Add one new `## Weekly view interactions` section to root `README.md` describing, for end
users:
- Recurring events — creating a recurring series (Day/Week/Month/Year frequencies), and the
  series-vs-single-instance choice when editing or deleting an occurrence.
- Event colors — the 11 available color options for tagging events.

Link to `docs/frontend/week-drag-interaction.md` for readers who want interaction/drag
implementation detail rather than restating it.

## Task type
doc_addition

## Files in scope
- `README.md` (new section only, inserted between existing `## Features` and `## Tech stack`
  headings)

## Files off-limits
- Everything else, including `docs/frontend/week-drag-interaction.md` (link to it, don't edit it)
- All existing AI-config files detected by discovery (default off-limits per project policy)
- `.sdlc/**`, `node_modules/**`, `dist/**`, `build/**`, `.next/**`, `.git/**` (project-wide
  off-limits)

## Acceptance criteria
- `README.md` gains exactly one new `##`-level section titled `Weekly view interactions`,
  positioned between `## Features` and `## Tech stack`.
- Section covers recurring events and event colors only — no mention of multi-day select as a
  working feature.
- Recurring-events copy accurately reflects Day/Week/Month/Year-only frequencies and the
  series/instance edit-delete distinction; does not claim hourly/minutely/secondly recurrence.
- Event-colors copy accurately reflects the 11 fixed color slots; does not claim support for
  arbitrary/custom hex colors (provider `colorHex` is read-only in Compass).
- Section links to `docs/frontend/week-drag-interaction.md` rather than duplicating its content.
- `bun lint` passes (README-only change; no test-suite impact expected).

## Non-goals
- Documenting multi-day select — not implemented at this commit; excluded per user decision at
  Gate 0 interview. A future run should pick this up once a prior in-flight attempt actually
  lands.
- Editing `docs/frontend/week-drag-interaction.md` or any other existing doc.
- Any code changes — this is a docs-only run.
