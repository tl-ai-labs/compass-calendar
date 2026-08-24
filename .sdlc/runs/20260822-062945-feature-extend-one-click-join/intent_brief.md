# Intent Brief — feature-extend — One-click join icon on event cards

## Context
`packages/web/src/grid/components/TimedEventCard.tsx` and `AllDayEventCard.tsx` render calendar
events but give no direct way to join a video call from the card itself — a user has to open the
event first. This is the third attempt at this exact ticket (CMP-103): prior runs on
`CMP-103/opus-plus-flash-v37` (commit `399a2554`) and `CMP-103/flash-agsdk-only` (commit
`cb4a809f`) both converged on the same four-file shape below. This run repeats the same scope
from a clean `main`-based branch (`CMP-103/opus-only-v5`), under the `opus-only-v5` policy, for
policy comparison purposes.

## Goal
Add a one-click join icon to `TimedEventCard` and `AllDayEventCard` for events that carry a
conference link, so the user can join the call directly from the card without opening the event.

## Files in scope
- `packages/web/src/grid/components/TimedEventCard.tsx` (edit)
- `packages/web/src/grid/components/AllDayEventCard.tsx` (edit)
- `packages/web/src/grid/components/EventJoinIcon.tsx` (new)
- `packages/web/src/grid/components/EventCard.test.tsx` (new)
- `.gitignore` (edit — add `.sdlc/` entry, confirmed at Gate 0)

## Files off-limits
- Everything under `.claude/**`, `.codex/**`, `.cursor/**`, `.agents/**`, `AGENTS.md`,
  `compass.yaml`, `*.env*`, build/lock/report dirs, `.sdlc/**`, `.hook-logs/**` (per discovery's
  off-limits list — default off-limits, not moved to the allowlist).
- Any file outside the scope above unless discovery/design surfaces a genuine need, confirmed at
  a later gate.

## Acceptance criteria
- Events with a conference link (Google Meet / Zoom / other detected conferencing URL) show a
  join icon/button on both `TimedEventCard` and `AllDayEventCard`.
- Clicking the icon opens the conference URL directly (e.g. new tab), without requiring the user
  to open the event detail view first.
- Events without a conference link render unchanged — no icon, no layout shift.
- Existing click-to-open-event behavior on the rest of the card is unaffected.
- New/changed code covered by tests; full `bun test:web` suite still green (2298 pass baseline).

## Non-goals
- No changes to how conference links are detected/parsed upstream (assume `conferenceData` /
  `hangoutLink` or equivalent is already available on the event object).
- No redesign of the event card layout beyond adding the icon.
- No changes to the join-icon behavior on other surfaces (e.g. event detail modal) unless already
  present from a prior run.
