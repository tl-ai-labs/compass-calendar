# Intent Brief — feature-extend — Attendee avatar badge on grid event cards

## Context

Compass Calendar, a Bun + React 18 + Tailwind 4 TypeScript monorepo (lerna + bun workspaces,
`packages/*`). Grid event cards are rendered by exactly two shared components:

- `packages/web/src/grid/components/TimedEventCard.tsx` (368 lines, forwardRef)
- `packages/web/src/grid/components/AllDayEventCard.tsx` (228 lines, forwardRef)

Both are consumed by the Week view (`views/Week/components/Event/Grid/GridEvent/GridEvent.tsx:134`,
`views/Week/components/Grid/AllDayRow/AllDayEvent.tsx:64`, `Draft/grid/GridDraft.tsx`) and the Day
view (`views/Day/components/Calendar/DayCalendarEventCards.tsx:93` all-day, `:180` timed). Because
the two card components are shared, a badge wired into them covers Week and Day — timed and all-day
— with no per-view work.

The RSVP status styling to be reused lives in `packages/web/src/views/Forms/EventForm/EventDetailsSection.tsx`
(109 lines):

```ts
const ATTENDEE_STATUS_DOT: Record<AttendeeResponseStatus, string> = {
  accepted: "bg-success", declined: "bg-error",
  tentative: "bg-warning", needsAction: "bg-text-subtle",
};
const attendeeStatusLabel = (status) => status === "needsAction" ? "hasn't responded" : status;
```

Neither symbol is exported. The dot markup is `size-2.5 shrink-0 rounded-full ${ATTENDEE_STATUS_DOT[…]}`,
rendered `aria-hidden` with a mouse-only `title`; the accessible signal lives on the parent `<li>`
`aria-label` (`${name}, ${statusText}${isOrganizer ? ", organizer" : ""}`). Comments at lines 72–75
state explicitly that colour alone is not an accessible signal.

Attendee data needs no plumbing: `web.event.types.ts:86-88` carries `organizer`/`attendees`/`conference`
on the web Event schema, and `events/queries/event.view-model.ts:92-94` maps them through. The
contract is `packages/core/src/types/event-attendance.contracts.ts` (read-only for this run).

This is the fifth CMP-105 policy-comparison arm (the `opus-plus-flash-v37` SDK door). Four prior arms
built a nominally similar badge on other branches; none of that code is importable here and none of it
may be assumed present.

## Goal

Show an attendee avatar badge on grid event cards, reusing EventDetailsSection's RSVP-status styling
rather than defining new colours.

## Files in scope

Proposed allowlist (Gate 0 may edit):

| Path | Change |
|---|---|
| `packages/web/src/grid/components/AttendeeBadge.tsx` | new — the badge component |
| `packages/web/src/grid/components/AttendeeBadge.test.tsx` | new — badge unit tests |
| `packages/web/src/grid/components/TimedEventCard.tsx` | edit — render the badge |
| `packages/web/src/grid/components/AllDayEventCard.tsx` | edit — render the badge |
| `packages/web/src/grid/components/EventCard.test.tsx` | edit — card-level badge tests |
| `packages/web/src/common/utils/attendee-status.util.ts` | new — extracted `ATTENDEE_STATUS_DOT` + `attendeeStatusLabel` |
| `packages/web/src/common/utils/attendee-status.util.test.ts` | new — tests for the extracted util |
| `packages/web/src/views/Forms/EventForm/EventDetailsSection.tsx` | edit — import the extracted symbols instead of declaring them |

The extraction of the two symbols is load-bearing, not incidental: without it the badge and
EventDetailsSection carry duplicate colour maps that will drift. The extraction edits a file covered
by `EventForm.test.tsx`, which must stay green.

## Files off-limits

Everything not in the allowlist. Called out explicitly:

- All detected AI configs (default OFF-LIMITS): `.claude/settings.json`, `.claude/settings.local.json`,
  `.claude/launch.json`, `.cursor/**` (rules, hooks, settings, environment, bootstrap script),
  `.codex/config.toml`, `.codex/hooks.json`, `.agents/skills/**`, `AGENTS.md`
- `packages/backend/**`, `packages/sync/**`, `packages/scripts/**`
- `packages/core/**` — the attendance contract is read-only
- `packages/web/src/index.css` — semantic colour tokens (`--success/--warning/--error`) are consumed,
  never redefined
- `compass.yaml` (gitignored, holds secrets), any `.env*`
- `packages/web/src/views/Forms/EventForm/RecurrenceSection.test.tsx` — home of the pre-existing
  failure; must not be "fixed" opportunistically to make the suite look green

## Acceptance criteria

1. Timed grid event cards with attendees show an attendee avatar badge.
2. All-day / multi-day row cards with attendees show the same badge.
3. The badge's RSVP status colours come from the same single source as EventDetailsSection's dots —
   `ATTENDEE_STATUS_DOT` is declared exactly once in the repo after this change.
4. EventDetailsSection renders identically to before (imports the extracted symbols; no visual change).
5. The RSVP status signal is not colour-only — it carries a text/ARIA equivalent, consistent with the
   existing pattern documented at `EventDetailsSection.tsx:72-75`.
6. `attendees` is optional and readonly and is `undefined` for busy-projection events; the badge must
   render nothing rather than throw in that case.
7. `bun run test:web` shows no NEW failures against the recorded baseline of 2297 pass / 1 fail /
   1 error. Phase 7 diffs against that baseline, not against zero.
8. `bun lint` passes, including the `check-semantic-colors.ts` gate that runs before biome — raw
   palette classes fail lint.

## Gate 0 record

Approved 2026-09-03 (UTC 2026-09-04T05:5x). Confirmed at the gate:

- Intent `feature-extend`; stack node-typescript/Bun; test command `bun run test:web`.
- Policy `opus-plus-flash-v37`, mechanical door `flash-agsdk-worker` (not overridden), Gemini via
  `vertex-adc`. Auth mode **`estimated`** — subscription auth via claude-cli; there are no API keys
  in this project, so reported cost is an estimate that books `cached=0` and is not comparable
  across policies.
- **Month dropped by explicit decision.** The requested "Month cells" scope was raised at the gate as
  unbuildable and the user chose to drop it, keeping Week + Day + all-day. Recorded as a non-goal below.
- The byte-identity guard for no-attendee cards was offered at the gate and **not** taken. AC-4 covers
  EventDetailsSection's appearance only; there is deliberately no AC asserting that a card without
  attendees is unchanged.
- All detected AI configs left OFF-LIMITS. `.sdlc/` left out of `.gitignore` on this branch so run
  artifacts stay committable.
- Write contract frozen to `.sdlc/local/write-contract.json` and both deny paths probed live with real
  Writes: an off-limits path (`packages/backend/**`) and a not-in-allowlist path were each refused at
  the tool boundary.

## Non-goals

- **Month view.** The requested "Month cells" scope is not buildable: this repo has no Month view.
  `src/views/` contains Day, Week, Life, Forms, BackendDown, Cleanup, GoogleAuthCallback, NotFound,
  Root; `views/Life/LifeGrid.tsx` renders no event cards, and a repo-wide grep for Month view
  components returns zero hits. Raised at Gate 0 for a decision; recorded here as a non-goal.
- Widening or relocating the existing invisible 4.5px resize handles. The `endDate` handle already
  fails `elementFromPoint` on roughly 30% of cards (pre-existing, verified at `main@2d81253a`); the
  badge must not make it worse, but fixing it is a separate ticket.
- Fixing the pre-existing `RecurrenceSection` date-rot failure.
- Fixing the known local-IndexedDB bug that drops attendees on resize/move/edit in anonymous mode.
- Backfilling avatar imagery / photo URLs. "Avatar badge" here means the status-coloured attendee
  indicator built from data already on the event, not remote profile images.
