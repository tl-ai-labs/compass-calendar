# Intent Brief — feature-extend — Attendee avatar badge on grid event cards

## Context

Compass renders calendar events in the Week and Day grid through two shared card
components: `packages/web/src/grid/components/TimedEventCard.tsx` and
`packages/web/src/grid/components/AllDayEventCard.tsx` (consumed by the Week
`GridEvent`, Week `AllDayEvent`, and Day `DayCalendarEventCards` surfaces — one
change to the cards covers every grid surface).

Attendee data is already available on the card without any plumbing work:
`GridEvent` (`packages/web/src/common/types/web.event.types.ts`) already carries
`attendees: z.array(AttendeeSchema).readonly().optional()`, projected by
`event.view-model.ts`. Both card prop types already take the full `event: GridEvent`.
`attendees` is optional and absent for Compass-native and busy-projection events.

RSVP-status styling already exists in
`packages/web/src/views/Forms/EventForm/EventDetailsSection.tsx` (lines 12–17) as a
module-private `ATTENDEE_STATUS_DOT: Record<AttendeeResponseStatus, string>` mapping
each status to a semantic color token:

| status       | token           |
|--------------|-----------------|
| accepted     | `bg-success`    |
| declined     | `bg-error`      |
| tentative    | `bg-warning`    |
| needsAction  | `bg-text-subtle`|

Tokens defined in `packages/web/src/index.css`. `AttendeeResponseStatus` /
`AttendeeSchema` live in `packages/core/src/types/event-attendance.contracts.ts`
(`AttendeeSchema = { email, displayName: string | null, responseStatus }`).

`bun lint` runs `check-semantic-colors.ts` and rejects raw Tailwind palette classes —
the badge must use semantic tokens only.

## Goal

Render an attendee avatar badge on the grid event cards (timed + all-day, Week + Day).

- **Form:** stacked/overlapping avatar circles. Each circle shows the attendee's
  initials, falling back to a photo only if one is already available on the model
  (none is today — initials in practice). Each circle is ring-colored by that
  attendee's RSVP `responseStatus`, reusing the same status→token mapping as
  `EventDetailsSection`. Overflow beyond a small cap renders as a `+N` chip.
- **Reuse, don't duplicate:** lift `ATTENDEE_STATUS_DOT` out of
  `EventDetailsSection.tsx` into a shared web module and have `EventDetailsSection`
  import it back, so the grid badge and the form can't drift. (User-confirmed at the
  intent interview.)
- **Purely additive:** cards render exactly as today when `event.attendees` is
  absent or empty. No card prop-signature changes. No feature flag. Existing
  `packages/web/src/grid/components/EventCard.test.tsx` must stay green.

## Files in scope

- `packages/web/src/grid/components/TimedEventCard.tsx` — render the badge
- `packages/web/src/grid/components/AllDayEventCard.tsx` — render the badge
- `packages/web/src/grid/components/` — **new** avatar-badge component + colocated
  `*.test.tsx` (exact filename at design's discretion)
- `packages/web/src/common/` — **new** shared module holding the
  `AttendeeResponseStatus → semantic token` map (exact path — `common/styles/` vs
  `common/utils/` — at design's discretion)
- `packages/web/src/views/Forms/EventForm/EventDetailsSection.tsx` — drop the local
  `ATTENDEE_STATUS_DOT`, import the shared map (behavior unchanged)
- `packages/web/src/grid/components/EventCard.test.tsx` — extend with badge cases
  (attendees present → badge shows with correct rings; absent/empty → no badge)
- A colocated test for the shared map module if one is added

## Files off-limits

- `.env`, `.env.*`, `.mcp.json`, `.cursor/rules/**`, `.claude/settings.local.json`
- `node_modules/**`, `dist/**`, `build/**`, `.next/**`, `.sdlc/**`, `.git/**`
- `packages/core/src/types/event-attendance.contracts.ts` and any other
  `packages/core/**` contract — the data model is already sufficient; do not widen it
- `packages/web/src/common/types/web.event.types.ts`,
  `packages/web/src/**/event.view-model.ts` — attendees already flow through; no
  view-model or type change needed
- Any grid layout / interaction / hooks code — this is presentational only
- All AI-assistant config files detected in discovery (`AGENTS.md`, Cursor, Codex,
  Claude configs) — read-only

## Acceptance criteria

1. Timed and all-day grid cards show a stacked avatar-circle badge when
   `event.attendees` is non-empty; each circle's ring color matches the attendee's
   `responseStatus` via the shared status→token map.
2. More than the visible cap of attendees renders a `+N` overflow chip.
3. Cards with no `attendees` (Compass-native, busy-projection) render byte-identical
   to before — no badge, no layout shift, no new DOM.
4. `ATTENDEE_STATUS_DOT` no longer defined in `EventDetailsSection.tsx`; it imports
   the shared map. The form's attendee dots look and behave exactly as before.
5. Only semantic color tokens used; `bun lint` (incl. `check-semantic-colors.ts`)
   passes.
6. `bun test:web` passes with no new failures; `EventCard.test.tsx` covers the
   badge-present and badge-absent paths.
7. No change to any card component's exported prop types.

## Non-goals

- No changes to the attendee/RSVP data model or its Zod contracts.
- No photo/avatar-image fetching or storage; initials only (photo path only if the
  model already carries a URL).
- No hover card, tooltip, or click behavior on the badge beyond what a plain
  presentational element gives for free (a `title`/`aria-label` is fine).
- No feature flag / gradual rollout.
- No restyling of `EventDetailsSection`'s existing attendee list.
- No Week/Day grid layout, sizing, or interaction changes.
