# Intent Brief — feature-extend — Attendee avatar badge on grid event cards

## Context

Compass calendar web app (`packages/web`, bun 1.3.14 / TS 7.0.2 / React, lerna+bun
workspaces). Grid event cards currently show title/time only. The event form's
`EventDetailsSection` already renders per-attendee RSVP-status dots via a
**module-private** `ATTENDEE_STATUS_DOT` map (`EventDetailsSection.tsx` L12–20):
`accepted→bg-success`, `declined→bg-error`, `tentative→bg-warning`,
`needsAction→bg-text-subtle`.

Discovery findings for this run
(`20260829-124312-feature-extend-attendee-avatar-badge`):

- **No data plumbing needed.** `GridEvent` (`packages/web/src/common/types/web.event.types.ts`
  L86–88) already carries `organizer` and `attendees`; `events/queries/event.view-model.ts`
  L92–93 already maps them. The badge reads `event.attendees` directly.
- Attendee shape (`packages/core/src/types/event-attendance.contracts.ts`):
  `Attendee = { email, displayName: string | null, responseStatus }`, status enum
  `needsAction | accepted | declined | tentative`.
- Grid cards live at `packages/web/src/grid/components/TimedEventCard.tsx` and
  `AllDayEventCard.tsx`. There is **no `EventCard.tsx`**; `EventCard.test.tsx` is the
  shared test file for both.
- `bun lint` runs `check-semantic-colors.ts` **before** Biome and hard-exits on any raw
  Tailwind palette class under `packages/web/src` — the badge must use semantic tokens
  from `packages/web/src/index.css` L114–125.
- Prior art: commit `c96863ec` on sibling branch `CMP-105/opus-plus-sonnet` implements
  this exact feature. It is **not** an ancestor of this branch's HEAD (`2d81253a`) and
  the feature is verified absent here. This run is a deliberate policy-comparison
  re-implementation under `opus-plus-flash-v37` — **do not cherry-pick or consult that
  diff.**

## Goal

Render an attendee RSVP-status avatar badge on the timed and all-day grid event cards,
driven by `event.attendees`. Each avatar is ring/fill-colored by the attendee's
`responseStatus` using a **single shared** status→token map that is also the source for
`EventDetailsSection`'s existing status dots, so the form and the grid badge cannot
drift. Overflow past a small cap collapses to a `+N` indicator. Purely additive: cards
with no attendees render unchanged and no card prop signature changes.

## Files in scope

- `packages/web/src/grid/components/TimedEventCard.tsx` — render the badge
- `packages/web/src/grid/components/AllDayEventCard.tsx` — render the badge
- `packages/web/src/grid/components/EventAttendeeBadge.tsx` — **new** component
- `packages/web/src/grid/components/EventAttendeeBadge.test.tsx` — **new** unit tests
- `packages/web/src/grid/components/EventCard.test.tsx` — extend for badge coverage
- `packages/web/src/common/styles/**` — **new** shared module holding the extracted
  status→semantic-token map (exact filename at implementer's discretion)
- `packages/web/src/common/styles/*.test.ts` — **new** test for the shared map
- `packages/web/src/views/Forms/EventForm/EventDetailsSection.tsx` — replace the
  module-private `ATTENDEE_STATUS_DOT` with the shared map; rendered output must be
  identical

## Files off-limits

The 26 baseline off-limits globs (`.sdlc/baseline/current.json`), notably:
`.git/**`, `.claude/**`, `.codex/**`, `.cursor/**`, `.agents/**`, `AGENTS.md`,
`.mcp.json`, `compass.yaml`, `*.env*`, `node_modules/**`, `build/**`,
`packages/*/build/**`, `bun.lock`, `patches/**`, `.github/workflows/**`,
`playwright-report/**`, `test-results/**`, `logs/**`, `.hook-logs/**`.

Additionally read-only for this run:
- `packages/core/**` — attendee contract needs no change
- `packages/backend/**`, `packages/sync/**`, `packages/scripts/**`
- `packages/web/src/common/types/**` — `GridEvent` already carries `attendees`
- `packages/web/src/events/**` — view-model already maps attendees
- Any file outside `packages/web/src/**` except the run's own `.sdlc/` artifacts

## Acceptance criteria

1. On both `TimedEventCard` and `AllDayEventCard`, when `event.attendees` is non-empty,
   an attendee badge renders; when it is empty/absent, the card output is
   byte-identical to before this change.
2. Each avatar's status color comes from the **shared** status→token map — the exact
   same module `EventDetailsSection` now imports. No second copy of the mapping exists.
3. `EventDetailsSection`'s status dots render with the same classes/output as before
   (refactor is behavior-preserving).
4. Attendees past a fixed cap collapse into a single `+N` overflow indicator.
5. The badge's accessible label never exposes a raw email address; an attendee with no
   `displayName` reads as `Guest` (or equivalent non-PII label).
6. No change to `TimedEventCard` / `AllDayEventCard` exported prop signatures.
7. Only semantic color tokens used (no raw Tailwind palette classes) — `bun lint`
   passes including `check-semantic-colors.ts`.
8. `bun test:web` green (baseline 2298 pass / 0 fail); `bun lint` green;
   `bun run type-check:web-tests` green.

## Non-goals

- No changes to the attendee/event data model or `packages/core` contracts.
- No new query or view-model plumbing — attendee data is already present on `GridEvent`.
- No changes to `EventDetailsSection` beyond swapping in the shared map.
- No e2e / Playwright automation; jsdom cannot resolve Tailwind, so light/dark and
  narrow/short-card visual checks are a separate manual step, not a pipeline gate.
- Not a cherry-pick of `c96863ec`; no consultation of that commit's diff.
- No demo-seed-data tweaks unless a card is otherwise impossible to exercise in tests.
