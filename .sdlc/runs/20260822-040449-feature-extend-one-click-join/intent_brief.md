# Intent Brief — feature-extend — One-click join icon on event cards

## Context
`TimedEventCard` and `AllDayEventCard` (packages/web/src/grid/components/) render events on the
week/day grids. Events that carry a conference link (`ConferenceSchema.url`) currently require
opening the event before joining the meeting. A near-identical feature already shipped once,
under run `20260821-113930-feature-extend-one-click-join` on branch
`CMP-103/opus-plus-flash-v37` (commit `399a2554`), but that work lives only on that branch — it
never reached `main`. This run re-implements the same capability from a clean `main` checkout
(branch `CMP-103/flash-agsdk-only`), under the `flash-agsdk-only` policy, as a deliberate
side-by-side policy comparison (cost/quality) rather than a fresh ask.

## Goal
Add a small icon-only one-click "join" affordance to `TimedEventCard` and `AllDayEventCard` that
appears only when the event has a conference URL, and opens the meeting in one click without
selecting the event underneath.

## Files in scope
- `packages/web/src/grid/components/TimedEventCard.tsx`
- `packages/web/src/grid/components/AllDayEventCard.tsx`
- `packages/web/src/grid/components/EventJoinIcon.tsx` (new)
- `packages/web/src/grid/components/EventCard.test.tsx` (new/extended — regression coverage)
- `packages/web/src/grid/components/calendar-accent.util.ts` (read-only reference unless the
  design phase finds a shared-util touch is warranted)

## Files off-limits
- Everything outside `packages/web/src/grid/components/` unless Gate 0 review expands scope
- `views/Week/components/Grid/AllDayRow/AllDayEvent.tsx`, `Draft/grid/GridDraft.tsx`,
  `Event/Grid/GridEvent/GridEvent.tsx`, `Day/components/Calendar/DayCalendarEventCards.tsx` —
  consumers of these cards, not the cards themselves; out of scope for this extend
- Any other event surfaces with unvalidated-href patterns (`UpNextCard.tsx`,
  `EventDetailsSection.tsx`, `UpNextBanner.tsx`) — the prior run explicitly deferred these as a
  separate class of follow-up, not part of this feature

## Acceptance criteria
- Icon renders only when the event has a conference URL, and only for safe `http(s)` URLs
  (defense-in-depth against `javascript:`/`data:`/`vbscript:` schemes reaching the href)
- Click/mousedown/keydown on the icon stop propagation so it never triggers card
  selection/drag/open
- `TimedEventCard` gates the icon on a minimum card width/height so it never renders on cards too
  small to host it cleanly, and coexists with the existing repeat icon (offset, no overlap)
- `AllDayEventCard` wires the same icon (fixed row height needs no size gate)
- Conference URL is excluded from PostHog autocapture (`ph-no-capture` or equivalent)
- Regression tests cover render/hide thresholds, click-to-open, propagation stopping, all-day
  padding permutations, z-index, and hostile URL-scheme rejection (with a positive control)
- No special backward-compatibility constraint beyond the above: additive change, existing props
  and behavior for events without a conference link are unchanged

## Non-goals
- Fixing the unvalidated-href pattern elsewhere (UpNextCard, EventDetailsSection, UpNextBanner)
- Any change to how conference links are parsed/stored upstream of `ConferenceSchema.url`
- Merging or rebasing the prior `CMP-103/opus-plus-flash-v37` implementation — this is an
  independent re-implementation for policy comparison, not a cherry-pick
