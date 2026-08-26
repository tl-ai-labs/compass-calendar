# Intent Brief — feature-extend — One-click join icon on event cards

## Context

`TimedEventCard.tsx` and `AllDayEventCard.tsx` (`packages/web/src/grid/components/`) render
events on the week/day grids. An event carrying a conference link currently requires opening the
event before the user can join the meeting.

This is the **fourth arm of the CMP-103 policy A/B** on one identical ticket. Prior arms, all
anchored at `4189de1`, all accepted:

| Branch | Policy | Files | Tests | Cost | Outcome |
|---|---|---|---|---|---|
| `CMP-103/opus-plus-flash-v37` | opus-cli-plus-flash-adc | 4 (3 edit, 1 new) | 2298→2316 | $5.71 ⚠ | committed `399a2554` |
| `CMP-103/flash-agsdk-only` | flash-agsdk-only | 4 (3 edit, 1 new) | 2298→2309 | $5.46 ⚠ | partially committed `53f057e4` |
| `CMP-103/opus-only-v5` | opus-only-v5 | 7 (6 edit, 1 new) | 2298→2326 | $5.32 | uncommitted |

This run re-implements the same capability from a clean `main`-based branch
(`CMP-103/opus-plus-sonnet`) under the `opus-plus-sonnet` policy. It is an independent
re-implementation for policy comparison — **not** a cherry-pick, rebase, or merge of any prior
arm's work.

Data plumbing is already complete and was re-verified this run — no plumbing step is needed:

- `ConferenceSchema = z.strictObject({ url: z.url(), label: string|null })` —
  `packages/core/src/types/event-attendance.contracts.ts:31-35`
- Normalizer fills it from `hangoutLink` / `conferenceData.entryPoints[video]` —
  `packages/sync/src/providers/google/google-event.normalizer.ts:161-172`
- Backend passes it through — `event-list.translation.ts:13`
- Web grid type carries it — `packages/web/src/common/types/web.event.types.ts:88`
- View-model maps it onto card props — `packages/web/src/events/queries/event.view-model.ts:94`

So `event.conference?.url` is readable inside both card bodies today. Existing precedent for the
affordance: `UpNextCard.tsx:87-97` and `EventDetailsSection.tsx:46-56`, both using
`@phosphor-icons/react`'s `VideoCameraIcon`. The closest structural analogue on the cards
themselves is `EventRepeatIcon.tsx`, whose docstring at `:8-14` states the one-place rule that
"stops the two cards from drifting apart".

## Goal

Add an icon-only one-click join affordance to `TimedEventCard` and `AllDayEventCard`, shown only
when the event carries a conference URL, that opens the meeting in a new tab in one click without
selecting, opening, or dragging the event underneath.

## Files in scope

- `packages/web/src/grid/components/TimedEventCard.tsx` (edit)
- `packages/web/src/grid/components/AllDayEventCard.tsx` (edit)
- `packages/web/src/grid/components/EventJoinIcon.tsx` (new)
- `packages/web/src/grid/components/EventCard.test.tsx` (edit — covers both cards already)

## Files off-limits

Project defaults from `.sdlc/project.json.off_limits_default`: `.env`, `.env.*`, `.mcp.json`,
`.cursor/rules/**`, `.claude/settings.local.json`, `node_modules/**`, `dist/**`, `build/**`,
`.next/**`, `.sdlc/**`, `.git/**`.

AI configs detected in the repo, all **off-limits by default**: `.claude/settings.json`
(modified in the working tree — the mmo write-contract hook), `.claude/settings.local.json`,
`.claude/launch.json`, `.cursor/rules/` (4 `.mdc` files), `.cursor/hooks.json`,
`.cursor/hooks/format-after-edit.ts`, `.codex/config.toml`, `.codex/hooks.json`,
`.agents/skills/`, `AGENTS.md`, `compass.yaml`.

Ticket-specific (this is a `packages/web` UI-only change):

- `packages/core/src/types/event-attendance.contracts.ts`,
  `packages/core/src/types/event.contracts.ts`,
  `packages/core/src/types/sync/event.contracts.ts` — consume the contract, don't reshape it
- `packages/backend/**`, `packages/sync/**`
- `packages/web/src/events/grid-event-draft.adapter.ts` — the explicit-pick logic from #2555
  (comment at `:586`); do not introduce a spread that bypasses it
- Any mutation/write payload path — `conference` must never enter a write payload
- Consumers of these cards (`GridEvent.tsx`, `AllDayEvent.tsx`, `DayCalendarEventCards.tsx`) —
  they must keep working, but are not edited by this run
- Other surfaces with the same href pattern (`UpNextCard.tsx`, `EventDetailsSection.tsx`,
  `UpNextBanner.tsx`) — deferred by prior arms as a separate class of follow-up

## Acceptance criteria

1. An event with `conference.url` renders a join icon on both cards; an event without one
   renders nothing new and takes no layout shift.
2. Activating it opens `conference.url` in a new tab with `rel="noopener noreferrer"`.
3. Activating it does **not** fire the card's `onEventMouseDown` — no selection, no form open,
   no drag start. Both cards are `mousedown`-driven and have no `onClick` today, so the
   affordance must `stopPropagation` on `mousedown` the way the resize handles do
   (`TimedEventCard.tsx:344-347`). `AllDayEventCard`'s handler at `:171-176` already always
   stops propagation.
4. Reachable by keyboard and exposed as a link — asserted via `getByRole("link", …)` per
   `.cursor/rules/web-testing.mdc`, not the structural `container.querySelector('svg[class*=…]')`
   shortcut the repeat icon uses (that glyph is `aria-hidden`). Accessible name identifies the
   event being joined.
5. Recurring **and** conference-bearing events must not collide: the repeat icon already owns
   `absolute right-1 bottom-0.5`, and `AllDayEventCard.tsx:190` reserves `pr-3.5` only when
   `showRepeatIcon` is true. Both icons visible, non-overlapping.
6. Draft and placeholder cards render no join icon. `editableContent()`
   (`grid-event-draft.adapter.ts:532,553,560`) deliberately picks only
   `title|description|location|color`, so drafts carry `conference === undefined`. Gate on saved
   state, mirroring the existing `showRepeatIcon` gates (`TimedEventCard.tsx:116-120`,
   `AllDayEventCard.tsx:76-77`).
7. Uses the existing `@phosphor-icons/react` `VideoCameraIcon` via the
   `components/Icons/*` + `getInteractiveIconClassName` convention. No new icon library.
8. `bun test:web` passes with no new failures. Baseline this run: focused probe of
   `EventCard.test.tsx` + `AllDayGridRow.test.tsx` + `calendarCardIdentity.test.tsx` =
   30 pass / 0 fail / 78 expects; full-suite anchor from pre-check = 2298 pass / 0 fail / 302
   files. Pre-existing React `act(...)` warnings from `TimedEventCardBase` /
   `AllDayEventCardBase` are known noise, not regressions.
9. The Day view is a second consumer of these cards (`DayCalendarEventCards.tsx:93,180`) and
   must not regress.

## Non-goals

- No changes to the conference contract, the sync normalizer, or the backend.
- No join affordance on any other surface — the two grid cards only.
- No write-path support: conference stays read-only; drafts continue to drop it.
- No clipboard-copy or in-app meeting modal variants.
- No merging, rebasing, or cherry-picking of the three prior CMP-103 arms.
- No fixing the unvalidated-href pattern on `UpNextCard` / `EventDetailsSection` /
  `UpNextBanner` — separate follow-up, explicitly deferred by prior arms.
