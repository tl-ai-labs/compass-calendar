# Intent Brief — feature-extend — Attendee avatar badge on grid event cards

## Context

Compass renders timed events on the Week grid through
`packages/web/src/views/Week/components/Event/Grid/GridEvent/GridEvent.tsx`, which delegates the
actual card chrome to `packages/web/src/grid/components/TimedEventCard.tsx`. All-day events use a
sibling card, `packages/web/src/grid/components/AllDayEventCard.tsx`. Today a grid card shows the
title, an optional time label, an optional recurring-event icon (`EventRepeatIcon`), and a
calendar-accent bar — nothing about who is attending.

The event form already renders attendee RSVP state in
`packages/web/src/views/Forms/EventForm/EventDetailsSection.tsx`:

- `ATTENDEE_STATUS_DOT: Record<AttendeeResponseStatus, string>` —
  `accepted → bg-success`, `declined → bg-error`, `tentative → bg-warning`,
  `needsAction → bg-text-subtle`
- `attendeeStatusLabel(status)` — human text; `needsAction` → `"hasn't responded"`
- dot element: `size-2.5 shrink-0 rounded-full <status-class>`, `aria-hidden`, mouse `title`,
  and the parent row carries an `aria-label` combining name + status (color is never the only
  signal — a11y rule A9).

`AttendeeResponseStatus` is defined in `@core/types/event-attendance.contracts`. Attendee data is
available on the event view-model (`packages/web/src/events/queries/event.view-model.ts:93`
exposes `attendees` from event details) and typed via
`packages/web/src/common/types/web.event.types.ts:87`
(`attendees: z.array(AttendeeSchema).readonly().optional()`).

## Goal

Show a compact attendee badge on grid event cards (timed cards; all-day cards if the same data
is available) that surfaces whether the event has guests and their aggregate/individual RSVP
state, reusing `EventDetailsSection`'s RSVP-status color + label conventions rather than
introducing a second set of status styles.

Concretely:

1. Extract the RSVP-status style/label logic (`ATTENDEE_STATUS_DOT`, `attendeeStatusLabel`, and
   the `AttendeeResponseStatus` import) from `EventDetailsSection.tsx` into a shared module under
   `packages/web/src/` so both the form and the grid card import one source of truth.
2. Add a badge element to the grid event card that renders only when the event has ≥1 attendee,
   gated on available card width/height the way `showRepeatIcon` / `showTimeLabel` already gate
   optional chrome (a 15-minute sliver must not overflow).
3. Keep the badge accessible: it must not be a color-only signal — carry the RSVP state in text
   the card's `aria-label` already builds, or an `aria-label`/`title` on the badge group,
   following the pattern `EventDetailsSection` uses.
4. `EventDetailsSection.tsx` keeps rendering identically after the extraction (import swap only).

## Files in scope

- `packages/web/src/grid/components/TimedEventCard.tsx` — render the badge
- `packages/web/src/views/Week/components/Event/Grid/GridEvent/GridEvent.tsx` — pass attendee
  data through if `TimedEventCard` needs it as a prop (only if not already on `event`)
- `packages/web/src/grid/components/AllDayEventCard.tsx` — same badge on all-day cards if
  attendee data is present there
- `packages/web/src/views/Forms/EventForm/EventDetailsSection.tsx` — swap module-private RSVP
  constants for the shared import
- **NEW** `packages/web/src/grid/components/attendee-status.util.ts` (or a similar shared path
  the design phase picks) — the extracted `ATTENDEE_STATUS_DOT` + `attendeeStatusLabel` +
  re-exported `AttendeeResponseStatus`
- **NEW** co-located `AttendeeBadge` component file if the design phase splits it out
- Test files for the above: `TimedEventCard` / `EventCard` test(s) under
  `packages/web/src/grid/components/`, `EventForm.test.tsx`, and a new test for the shared util
- `packages/web/src/common/types/web.event.types.ts` — only if the `GridEvent` entity type must
  gain `attendees` (read-only) to reach the card

## Files off-limits

Project defaults from `.sdlc/project.json.off_limits_default` (`.env*`, `.mcp.json`,
`.cursor/rules/**`, `.claude/settings.local.json`, `node_modules/**`, `dist/**`, `build/**`,
`.next/**`, `.sdlc/**`, `.git/**`) plus all detected AI-config paths
(`.claude/settings.json`, `.claude/launch.json`, `.cursor/hooks.json`,
`.cursor/hooks/format-after-edit.ts`, `.codex/**`, `.agents/**`, `AGENTS.md`), plus:

- `packages/backend/**`, `packages/sync/**`, `packages/scripts/**` — no server/sync changes
- `packages/core/**` — consume the existing `event-attendance.contracts` type, do not modify it
- Any `**/__snapshots__/**` — regenerate via the test runner, never hand-edit

## Acceptance criteria

- AC-1: A grid event card for an event with ≥1 attendee renders a badge using the same RSVP
  status colors as `EventDetailsSection` (`bg-success` / `bg-error` / `bg-warning` /
  `bg-text-subtle`), sourced from a single shared module now imported by both.
- AC-2: A grid event card for an event with no attendees renders exactly as it does today (no
  badge, no layout shift, existing snapshots unchanged or updated only for the additive node).
- AC-3: The badge is not a color-only signal — RSVP state is reachable as text via the card's
  `aria-label` or an `aria-label`/`title` on the badge, consistent with `EventDetailsSection`'s
  approach.
- AC-4: The badge is suppressed on cards too small to fit it, using the existing width/height
  gating style (`position.width` / `position.height` thresholds), so a 15-minute event does not
  overflow or clip.
- AC-5: `EventDetailsSection` renders byte-identically after the constant extraction (verified by
  its existing tests staying green with no assertion changes).
- AC-6: `bun test:web` passes with no new failures; new unit test covers the shared
  status-util module; a component test covers "badge shows for event with attendees / hidden
  without".

## Non-goals

- No change to how attendees are fetched, stored, or synced (backend/sync untouched).
- No hover card, popover, or click interaction on the badge — display only this run.
- No avatar images / initials rendering from a network source; "avatar badge" here means the
  RSVP status dot(s), matching `EventDetailsSection`. (If the design phase wants initials, it
  must use data already on the client and flag it at Gate 2.)
- No Month view or mini-calendar changes — Week grid cards only.
- No redesign of `EventDetailsSection`'s own layout.

## Gate 0 — resolved 2026-08-31

- **Approved** as scoped.
- Auth mode: `estimated` (claude-cli subscription; cost is an estimate booking cached input at 0).
- Policy: `opus-only-v5` (project default; single premium tier → `claude-opus-5`).
- Test command: `bun test:web` (repo root cwd).
- `.gitignore`: left unchanged — user wants `.sdlc/` run data committed and pushed, so it stays
  tracked; close-out uses `git add -f` for any narrowly-gitignored sub-paths.
- Write contract frozen to `.sdlc/local/write-contract.json` (strict). Allowlist is dir-scoped to
  `packages/web/src/{grid,views/Week/components/Event,views/Forms/EventForm}/**` +
  `web.event.types.ts` + `event.view-model.ts`; Gates 1 and 2 narrow the actual file list.

