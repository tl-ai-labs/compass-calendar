# Intent Brief — feature-extend — One-click join icon on event cards

> Turn-2 re-run of `20260821-113930-feature-extend-one-click-join`. Same job, same
> scope, run under the shipped policy name `opus-plus-flash-v37` (the original arm
> ran under the custom-named clone `opus-cli-plus-flash-adc`). Brief body reused
> verbatim from the original so this stays a faithful A/B arm.

## Context
`TimedEventCard.tsx` and `AllDayEventCard.tsx` (both in `packages/web/src/grid/components/`)
render `GridEvent` objects. `GridEvent.conference` (`packages/web/src/common/types/web.event.types.ts`)
is already populated end-to-end and explicitly documented as **read-only, provider-sourced**:
`packages/sync/src/providers/google/google-event.normalizer.ts` derives it from
`item.hangoutLink ?? item.conferenceData?.entryPoints?.find(type === "video")?.uri`, with a
`label` from `conferenceSolution?.name`, and it's joined onto the grid view model in
`packages/web/src/events/queries/event.view-model.ts`.

Two Join affordances already exist elsewhere in the app and use `@phosphor-icons/react`'s
`VideoCameraIcon`:
- `packages/web/src/components/Sidebar/UpNextCard/UpNextCard.tsx` (lines ~87-97)
- `packages/web/src/views/Forms/EventForm/EventDetailsSection.tsx` (lines ~46-58, falls back to
  "Join meeting" when `label` is null)

The closest structural analogue on the grid cards themselves is
`packages/web/src/grid/components/EventRepeatIcon.tsx` — a small glyph pinned bottom-right on
both `TimedEventCard` and `AllDayEventCard`.

## Goal
Add a one-click "join" icon to `TimedEventCard` and `AllDayEventCard`, shown only when
`event.conference` is present, that opens `event.conference.uri` in a new tab on click —
mirroring the existing `VideoCameraIcon`-based Join pattern from `UpNextCard` /
`EventDetailsSection` rather than inventing a new visual language.

## Files in scope
- `packages/web/src/grid/components/TimedEventCard.tsx`
- `packages/web/src/grid/components/AllDayEventCard.tsx`
- `packages/web/src/grid/components/EventRepeatIcon.tsx` (reference pattern; touch only if a
  shared icon-slot helper is the cleanest way to avoid colliding with the repeat indicator)
- `packages/web/src/grid/components/EventCard.test.tsx` (add join-icon coverage alongside the
  existing repeat-indicator cases: placement, short/narrow events, draft previews)
- Any new small presentational component under `packages/web/src/grid/components/` if a shared
  join-icon component is warranted (e.g. `EventJoinIcon.tsx`)

## Files off-limits
- `packages/web/src/common/types/web.event.types.ts` (the `conference` field's read-only
  contract — consume it, don't reshape it)
- `packages/web/src/events/mutations/useEventMutations.ts` and any repository/mutation payload
  path — `conference` must never be added to a write payload (enforced today by
  `useUndoRedo.test.tsx:297-302`)
- `packages/web/src/events/grid-event-draft.adapter.ts` (existing explicit-join logic from #2555;
  do not introduce a spread that bypasses it)
- `packages/sync/**` (normalizer / safety-canary layer — out of scope, this is a UI-only change)
- Standard project off-limits: `.env*`, `.mcp.json`, `.cursor/rules/**`,
  `.claude/settings.local.json`, `node_modules/**`, `dist/**`, `build/**`, `.next/**`,
  `.sdlc/**`, `.git/**`

## Acceptance criteria
- A join icon/button appears on `TimedEventCard` and `AllDayEventCard` **only** when
  `event.conference` is truthy; absent otherwise (no layout shift for non-conference events).
- Clicking it opens `event.conference.uri` in a new tab (`window.open(..., "_blank",
  "noopener,noreferrer")` or the repo's existing equivalent helper if one exists) and does not
  trigger the card's own click/select/drag handlers (must stop propagation).
- Uses the existing `VideoCameraIcon` (`@phosphor-icons/react`) to stay visually consistent with
  `UpNextCard` and `EventDetailsSection`.
- Does not regress `EventRepeatIcon` — when an event is both recurring and has a conference link,
  the two icons must not visually overlap; when a card is too narrow to show icons (per the
  existing "too narrow" test case in `EventCard.test.tsx`), the join icon degrades the same way
  the repeat icon does today rather than overflowing.
- `event.conference` stays strictly read-only — no change touches the mutation/write path.
- New tests in `EventCard.test.tsx` cover: icon shown with conference link, icon absent without
  one, click opens the link without triggering card selection, and the narrow/short-event case.
- `bun test:web` passes.

## Non-goals
- No changes to how `conference` is derived/normalized in `packages/sync`.
- No in-app meeting preview, embedded call UI, or calendar-provider-specific join flows (e.g.
  Zoom vs. Meet branching) — just surface the existing URL.
- No changes to `UpNextCard` or `EventDetailsSection`'s own Join affordances (reference only).

## Gate 0 — confirmed scope (2026-08-30, approved)
- **Policy:** `opus-plus-flash-v37`; mechanical tier = `flash-completion` door (Vertex ADC /
  `ai-studies-console`). **auth_mode:** `estimated`.
- **Test command:** `bun test:web` (+ `bun type-check` in Phase 7). No `--parallel`.
- **Write-contract allowlist:** `packages/web/src/grid/components/**` (strict).
- **Off-limits (frozen):** project defaults + all detected AI configs
  (`.claude/**`, `.codex/**`, `.cursor/**`, `.agents/**`, `AGENTS.md`) +
  `packages/web/src/common/types/**`, `packages/web/src/events/**`, `packages/sync/**`,
  `packages/core/**`, `packages/backend/**`, `packages/scripts/**`.
- **Design rulings** (carried forward from the `20260821-113930` arm):
  1. Open `event.conference.url` in a new tab via
     `window.open(url, "_blank", "noopener,noreferrer")`, guarded by a URL-scheme check
     (reject `javascript:` / non-http(s)).
  2. Nested interactive control with `stopPropagation` against the card's drag/open handlers
     (not folded into the group `aria-label`).
  3. Always visible when `event.conference` is present; degrades on narrow/short cards the
     same way `EventRepeatIcon` does.
- **`.gitignore`:** left untouched (`.sdlc/` entry not added) — matches the original arm;
  noted for the final report.
- **Known risk accepted:** sibling branch `CMP-105/opus-plus-flash-v37` (`649aea0c`, pushed)
  touches the same render region of both cards + `EventCard.test.tsx`; a future merge to
  `main` will conflict. Out of scope for this run.
