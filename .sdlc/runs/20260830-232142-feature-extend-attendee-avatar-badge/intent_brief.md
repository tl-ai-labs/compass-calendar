# Intent Brief — feature-extend — Attendee avatar badge on grid event cards

## Context
Compass calendar web app (`packages/web`, React 18 + TypeScript, Tailwind 4, Bun workspaces).
Grid event cards are rendered by `packages/web/src/grid/components/TimedEventCard.tsx` and
`packages/web/src/grid/components/AllDayEventCard.tsx`. Grid events (`GridEvent`,
`packages/web/src/common/types/web.event.types.ts`) already carry optional `organizer` and
`attendees` (each attendee has a `responseStatus: AttendeeResponseStatus`).

The event edit form already shows attendee RSVP state:
`packages/web/src/views/Forms/EventForm/EventDetailsSection.tsx` defines two module-private
constants —
- `ATTENDEE_STATUS_DOT: Record<AttendeeResponseStatus, string>` → `bg-success` / `bg-error` /
  `bg-warning` / `bg-text-subtle`
- `attendeeStatusLabel(status)` → human label (`needsAction` → "hasn't responded")
and renders a `size-2.5 shrink-0 rounded-full <bg-class>` status dot per attendee.

This is one arm of the CMP-105 policy comparison (policy: `flash-agsdk-only`). Sibling runs:
opus-plus-flash-v37 arm (branch `CMP-105/opus-plus-flash-v37`) and an earlier attendee-badge arm.

## Goal
Add an attendee avatar badge to both timed and all-day grid event cards. The badge summarises
who is attending, using the **same** RSVP-status colour/label styling as `EventDetailsSection`.
The RSVP-status styling constants are extracted into a shared module and consumed by both
`EventDetailsSection` and the new grid badge, so there is one source of truth.

Cards with no attendees render exactly as today — no badge element, no layout shift.

## Files in scope
Frozen write-contract allowlist (`.sdlc/local/write-contract.json`, strict mode):
- `packages/web/src/grid/components/**` — covers `TimedEventCard.tsx` + `AllDayEventCard.tsx`
  (render the badge), the NEW `AttendeeBadge.tsx` + its test, and the existing
  `EventCard.test.tsx` / `TimedGrid.test.tsx` / `AllDayGridRow.test.tsx` (extend coverage)
- `packages/web/src/views/Forms/EventForm/EventDetailsSection.tsx` — import the extracted
  status-styling constants instead of defining them locally
- `packages/web/src/views/Forms/EventForm/EventForm.test.tsx` — only if the extraction moves
  an import in an assertion path
- Shared status-styling module (NEW) — design phase picks ONE of these allowlisted homes:
  `packages/web/src/common/utils/attendee/**`,
  `packages/web/src/common/styles/attendee-status.ts` (+ `.test.ts`), or
  `packages/web/src/events/attendance/**` — holds `ATTENDEE_STATUS_DOT` + `attendeeStatusLabel`
  + its test. A different home requires a `revise` at Gate 2.
- `.gitignore` — add a `.sdlc/` entry as part of this run (approved at Gate 0)

## Files off-limits
Everything not listed above, and specifically:
`.git/**`, `.sdlc/**`, `.claude/**`, `.codex/**`, `.cursor/**`, `.agents/**`, `AGENTS.md`,
`.mcp.json`, `compass.yaml`, `.playwright-compass.yaml`, `.env`, `.env.*`, `*.env*`,
`node_modules/**`, `build/**`, `buildcache/**`, `logs/**`, `.hook-logs/**`,
`packages/*/build/**`, `packages/*/node_modules/**`, `bun.lock`, `patches/**`,
`playwright-report/**`, `test-results/**`, `blob-report/**`, `.github/workflows/**`.
Backend / core / sync / scripts packages are out of scope — this is web-only.

## Acceptance criteria
1. Timed and all-day grid event cards show an attendee avatar badge when the event has ≥1
   attendee; the badge reflects each attendee's `responseStatus` with the same colour mapping
   as `EventDetailsSection` (`bg-success` / `bg-error` / `bg-warning` / `bg-text-subtle`).
2. `ATTENDEE_STATUS_DOT` and `attendeeStatusLabel` live in exactly one shared module;
   `EventDetailsSection` imports them from there and its rendered output is unchanged.
3. Events with no attendees render byte-for-byte as before — no badge node, no layout shift,
   no new wrapper.
4. New unit tests cover: the shared status module, the badge component (each response status +
   the empty/omitted-attendees case), and badge presence in both card components.
5. `bun test:web` passes with no pre-existing tests modified except where the extraction
   legitimately moves an import.
6. Biome check clean on all touched files.

## Non-goals
- No changes to how attendee data is fetched, synced, or stored.
- No backend, core, sync, or scripts changes.
- No new RSVP interactions on the grid (no click-to-respond from the badge).
- No redesign of `EventDetailsSection`'s attendee list beyond the constant extraction.
- No avatar images / profile-photo fetching — "avatar badge" here means initials/colour dots
  consistent with the existing dot styling, unless the design phase justifies otherwise within
  the existing theme tokens.
