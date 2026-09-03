# Intent Brief — feature-extend — One-click join icon on grid event cards

## Context

Compass renders events in the week/day grid through two independent sibling components,
`TimedEventCard` and `AllDayEventCard`. They share no base component — they duplicate layout,
palette and a11y logic, and the only genuinely shared code between them is `EventRepeatIcon.tsx`
and `calendar-accent.util.ts`.

Conference data is already available at the point of render. `ConferenceSchema` is
`{ url: string, label: string | null }` (`packages/core/src/types/event-attendance.contracts.ts:31-35`),
and `GridEvent` already carries it (`packages/web/src/common/types/web.event.types.ts:88`),
populated in `packages/web/src/events/queries/event.view-model.ts:94`. Google's `hangoutLink` /
`conferenceData` / `entryPoints` are collapsed to `{url,label}` upstream in the sync package and
never appear under `packages/web`. **No prop plumbing is required** — `event.conference?.url` is
already in scope inside both cards.

Join affordances already exist elsewhere in the app, but none on a grid card: `UpNextCard.tsx:87-97`
(anchor), `UpNextBanner.tsx:32,82-87` plus the `V` shortcut in `shortcuts.registry.ts:22-24`, and
`EventDetailsSection.tsx:46-58` (anchor). There is exactly one URL extractor (`useUpNextEvent.ts:68-71`)
and it reads the store event, not a `GridEvent`. There is no shared join-URL helper and no scheme
validation anywhere — `z.url()` constrains parseability, not scheme.

**The sharp edge.** Both cards already call `stopPropagation` in six places each, but that pattern
will not protect a new nested control. `PointerCaptureBoundary.tsx` subscribes
`onPointerDownCapture` at an *ancestor* (L107, handler L69-80) and calls `preventDefault()` +
`stopPropagation()` on ownership (L193-201). Capture at an ancestor always precedes the target
phase, so a descendant link or button cannot defend itself. The repo's working pattern is a data
attribute checked by the interaction adapters' `getInteractionTarget`, exactly as
`EVENT_RESIZE_HANDLE_ATTRIBUTE` (`grid/interaction/dom.ts:22-39`) is checked at
`week-interaction.adapter.ts:483-506` and `day-interaction.adapter.ts:434-461`.

**Why the test suite cannot be the acceptance signal.** `EventCard.test.tsx` mounts both cards with
no `PointerCaptureBoundary` ancestor, so a join control can pass every unit test and be dead in the
running app. This is not hypothetical: five unmerged sibling branches (`31a2ffba`, `af2eadd0`,
`491169d2`, `cb4a809f`, `399a2554`) each implemented this feature and all five converged on the same
new path `grid/components/EventJoinIcon.tsx`; the recorded browser check on the `-t2` arm found
mouse-click join opening the detail panel instead of joining, while its suite was green.

Repo baseline is RED before we start: `bun run test:web` on a clean tree at HEAD `2d81253a` gives
2297 pass / 1 fail / 1 error, exit 1. The single failure is
`RecurrenceSection > keeps the event's own date selectable when the event ends after midnight`,
pre-existing date-rot unrelated to this work.

## Goal

Add a one-click join affordance to `TimedEventCard` and `AllDayEventCard`.

The icon renders **only** on events that carry a conference URL. Clicking it opens that URL in a new
tab and must **not** open the event detail panel or start a drag/resize gesture. It must be reachable
by keyboard and carry an accessible name that identifies which event it joins.

## Files in scope

New:
- `packages/web/src/grid/components/EventJoinIcon.tsx`
- `packages/web/src/grid/components/EventJoinIcon.test.tsx`

Edit:
- `packages/web/src/grid/components/TimedEventCard.tsx`
- `packages/web/src/grid/components/AllDayEventCard.tsx`
- `packages/web/src/grid/components/EventCard.test.tsx`
- `packages/web/src/grid/interaction/dom.ts` — add the join-control data attribute alongside
  `EVENT_RESIZE_HANDLE_ATTRIBUTE`
- `packages/web/src/views/Week/interaction/adapter/week-interaction.adapter.ts` — honour it in
  `getInteractionTarget`
- `packages/web/src/views/Day/interaction/adapter/day-interaction.adapter.ts` — same

Added at Gate 1 (allowlist widened 8 → 10, user-approved):
- `e2e/timed/event-join.spec.ts` (new)
- `e2e/allday/event-join.spec.ts` (new)

Added at Gate 1 rev 2 (allowlist widened 10 → 11, user-approved, OQ-6 option B):
- `e2e/utils/event-test-utils.ts` (edit) — **additive only**: one new exported
  `seedEventWithConference` helper that writes a conference-bearing record directly into the
  `compass-local` IndexedDB `events` store via `page.evaluate`. Do not alter any existing export;
  every e2e spec in the repo imports its setup from this module, so a change to existing behavior
  breaks the whole suite. Required because e2e runs signed out against local IndexedDB
  (`prepareCalendarPage` → `clearClientAuthState` → `resetLocalEventDb`), conference is read-only
  provider-sourced data with no form input that can set it, and no e2e spec has ever had a
  conference-bearing event.

`e2e/utils/axe-assertion.ts` is **read-only** — import it, do not modify it. Its
`expectNoAxeViolations` scopes to `wcag2a/2aa/21a/21aa/22aa`, and axe-core 4.12.1 tags
`nested-interactive` with `wcag2a`, so it catches the AC-5 conflict unmodified.
`playwright.config.ts` needs no edit; specs under `e2e/` are auto-discovered.

**Both specs must assert drag/resize (AC-4) against a second, conference-free event.** Dragging the
conference-bearing card would trip the known local-mode bug that destroys `conference` on
move/resize/edit; the icon would correctly disappear and the spec would misread it as a failure of
this feature.

## Files off-limits

Project defaults from `.sdlc/project.json`: `.env`, `.env.*`, `.mcp.json`, `.cursor/rules/**`,
`.claude/settings.local.json`, `node_modules/**`, `dist/**`, `build/**`, `.next/**`, `.sdlc/**`,
`.git/**`.

All detected AI-tool configuration, off-limits by default: `.claude/settings.json`,
`.claude/launch.json`, `.cursor/rules/`, `.cursor/hooks.json`, `.cursor/hooks/format-after-edit.ts`,
`.codex/config.toml`, `.codex/hooks.json`, `.agents/skills/`,
`.agents/skills/chaos/agents/openai.yaml`, `AGENTS.md`.

Also off-limits for this run:
- `packages/core/**`, `packages/sync/**`, `packages/backend/**` — conference data already arrives
  correctly shaped; nothing upstream needs to change.
- `packages/web/src/components/UpNext*`, `EventDetailsSection.tsx`, `shortcuts.registry.ts` — the
  existing join affordances stay as they are.
- Every `package.json` and `bun.lock` — see AC-7.

## Acceptance criteria

- **AC-1** The join icon renders on a card if and only if `event.conference?.url` is present.
- **AC-2** Activating it opens the conference URL in a new tab (`target="_blank"` with
  `rel="noopener noreferrer"`, or equivalent).
- **AC-3** *(amended at Gate 1)* Activating it does **not** open the event detail panel and does
  **not** initiate a drag or resize. There are **two independent swallow paths and both must be
  handled**, exactly as the existing resize handles do:
  1. **Pointer path** — a join-control data attribute in `grid/interaction/dom.ts`, honoured by
     `getInteractionTarget` in both interaction adapters. Mirrors `EVENT_RESIZE_HANDLE_ATTRIBUTE`.
     `stopPropagation` alone cannot work here: `PointerCaptureBoundary` captures
     `onPointerDownCapture` at an *ancestor*, which always precedes the target phase.
  2. **Mouse path** — `e.stopPropagation()` in the join control's own `onMouseDown`.
     `PointerCaptureBoundary` only intercepts `pointer*` events; both card roots separately handle
     `onMouseDown` → `onEventMouseDown` (`TimedEventCard.tsx:303-310`,
     `AllDayEventCard.tsx:171-176`), and that is what opens the detail panel. A nested control's
     `mousedown` bubbles normally, so fixing `getInteractionTarget` does nothing for it.

  Reference implementation of both layers together: `TimedEventCard.tsx:344-347` and
  `AllDayEventCard.tsx:208-211`.
- **AC-4** Existing card behavior is unchanged: clicking the card body still opens the detail panel;
  drag-to-move and resize still work on both card types.
- **AC-5** *(amended at Gate 1)* The control is keyboard reachable and exposes an accessible name
  identifying the event. Tests must assert against the **accessibility tree**
  (`getByRole(..., { name })`), not a raw `role` DOM attribute. Both card roots are `role="button"`,
  so the nested-interactive conflict must be resolved deliberately and the resolution stated in the
  design. The repo already ships `@axe-core/playwright@^4.12.1` + `axe-core@^4.12.1` and a helper at
  `e2e/utils/axe-assertion.ts`, so the nested-interactive check goes in the Playwright e2e layer
  (see AC-8) rather than being left to human inspection. What is genuinely absent is axe in the
  *bun component* suite — do not add it there this run.

- **AC-9** *(added at Gate 1)* The `href` must be constrained to `http:`/`https:` before rendering.
  `ConferenceSchema.url` is `z.url()`, which validates parseability but **not scheme**, so a stored
  `javascript:` URL would become click-to-execute the moment it reaches an `href`. This change is
  what creates that sink on the grid card, so the guard ships with it.
- **AC-6** `bun run test:web` shows no *new* failures beyond the known pre-existing
  `RecurrenceSection` date-rot failure. The suite going green is necessary but **not sufficient** —
  see AC-8.
- **AC-7** No new npm dependencies. Use `@phosphor-icons/react` (already present) and the existing
  `c-icon` / `getInteractiveIconClassName` conventions in `components/Icons/`.
- **AC-8** *(amended at Gate 1)* **Browser verification is a required gate, not optional.**
  Mouse-click join must be confirmed working in the running app on both a timed and an all-day
  event, and the card's own click/drag confirmed still working. Unit tests cannot establish this
  because `EventCard.test.tsx` mounts the cards without a `PointerCaptureBoundary` ancestor.
  This is now backed by two Playwright specs (`e2e/timed/event-join.spec.ts`,
  `e2e/allday/event-join.spec.ts`) so the click path has an automated regression guard, each
  carrying the AC-5 axe assertion. The specs do not replace a human browser check; they make the
  failure mode catchable on re-run.

## Non-goals

- Local/anonymous IndexedDB mode is **not** handled this run. A known unticketed bug destroys
  `conference`/`organizer`/`attendees` on any resize/move/edit in that mode, so the icon will
  disappear from a card after a local-mode edit. Accepted as pre-existing debt; not to be fixed here.
- Fixing the pre-existing `RecurrenceSection` date-rot test failure.
- Extracting a shared base component for the two cards, or de-duplicating their layout/palette/a11y
  logic. Tempting, but that is a `refactor` job, not this one.
- Consolidating the three existing join affordances or introducing a shared join-URL helper for them.
- ~~Conference URL scheme validation~~ — **moved INTO scope at Gate 1 as AC-9.** Only the render-time
  `href` guard in the new join control is in scope; changing `ConferenceSchema` itself, or hardening
  the three pre-existing anchors that share the same sink, remains out of scope (follow-up ticket).
- Porting or merging any of the five sibling branches' implementations.
