# Delta Requirements — Attendee avatar badge on grid event cards

- **Run:** `20260829-122202-feature-extend-attendee-avatar-badge`
- **Mode / intent:** brownfield · `feature-extend`
- **Policy:** `opus-plus-sonnet` · auth mode `estimated`
- **Baseline:** `bun test:web` green — 2298 pass / 0 fail / 302 files

This is a **delta** requirements doc: it states only what changes relative to the
repository as it stands at `2d81253a`. Everything not named here is required to
stay bit-for-bit as it is.

---

## 1. In scope

1. A new presentational component that renders a horizontally-stacked
   (overlapping) row of attendee avatar circles for a `GridEvent`.
2. Each circle shows the attendee's **initials**, derived from `displayName`
   when present and from `email` otherwise.
3. Each circle carries a **ring color** determined by that attendee's
   `responseStatus`, drawn from the single shared status→token map.
4. Attendees beyond a fixed visible cap collapse into one `+N` overflow chip.
5. `TimedEventCard` renders the badge when `event.attendees` is non-empty.
6. `AllDayEventCard` renders the badge when `event.attendees` is non-empty.
7. `ATTENDEE_STATUS_DOT` is lifted out of `EventDetailsSection.tsx` into a
   shared module under `packages/web/src/common/`, and `EventDetailsSection`
   imports it back with **no change to its rendered output**.
8. `EventCard.test.tsx` gains badge-present and badge-absent coverage for both
   card types.
9. A colocated unit test accompanies each new module.

## 2. Out of scope

1. Any change to `packages/core/**` — the attendee contracts are already
   sufficient. No schema widening, no new field, no photo URL added.
2. Any change to `packages/web/src/common/types/web.event.types.ts` or any
   `event.view-model.ts` — `attendees` already reaches both cards.
3. Any change to either card's **exported prop type**. No new prop, no renamed
   prop, no widened prop.
4. Grid layout, sizing, positioning, interaction, drag/resize, or hook code.
5. Avatar **image** fetching, caching, or storage. A photo is rendered only if
   the model already carries a URL, which it does not today; the code path may
   exist but is unreachable in practice and is not a deliverable.
6. Hover cards, tooltips-beyond-`title`, popovers, or click handlers on the
   badge.
7. Feature flags or staged rollout.
8. Restyling `EventDetailsSection`'s existing attendee list.
9. Any edit to AI-assistant config (`AGENTS.md`, `.cursor/**`, `.claude/**`).

---

## 3. Functional requirements

### Module A — shared status→token map (`packages/web/src/common/`)

- **FR-A1** Export a single `Record<AttendeeResponseStatus, string>` mapping,
  preserving today's values exactly: `accepted → bg-success`,
  `declined → bg-error`, `tentative → bg-warning`,
  `needsAction → bg-text-subtle`.
- **FR-A2** The badge needs a *ring* class, not a *background* class, for the
  same four statuses. The module must therefore expose the status→color
  relationship in a form that yields both `bg-*` and `ring-*` variants without
  either consumer hand-writing a second map. Tailwind requires whole literal
  class names, so a runtime string concatenation (`` `ring-${x}` ``) is
  forbidden — both variants must appear as complete literals in source.
- **FR-A3** The module exports the human-readable status label helper only if
  the badge needs it; otherwise `attendeeStatusLabel` stays in
  `EventDetailsSection`. (Design decides; both cards need *some* accessible
  status text, so lifting it is expected.)
- **FR-A4** The module is typed against
  `AttendeeResponseStatus` imported from `@core/types/event-attendance.contracts`
  (import only — that file is off-limits for edits), so a future enum member
  makes the map a compile error rather than a silent `undefined` class.
- **FR-A5** The module is pure: no React import, no side effects, no store
  access.

### Module B — avatar badge component (`packages/web/src/grid/components/`)

- **FR-B1** Accepts the attendee list (`GridEvent["attendees"]`) and renders
  nothing at all — `null`, not an empty wrapper — when it is `undefined` or
  length 0.
- **FR-B2** Renders one circle per attendee up to a visible cap; the cap is a
  named module constant, not a literal at the call site.
- **FR-B3** Initials are derived deterministically: from `displayName` when
  non-null (first letter of the first two whitespace-separated words), else the
  first letter of `email`. Always uppercased. Never more than two characters.
- **FR-B4** Circles overlap via a negative horizontal offset; DOM order is the
  attendee-array order.
- **FR-B5** Each circle's ring color is `RING[attendee.responseStatus]` from
  Module A.
- **FR-B6** With more attendees than the cap, a final `+N` chip renders where
  `N = attendees.length - cap`. With exactly the cap or fewer, no chip renders.
- **FR-B7** The badge is announced accessibly: the group carries a label
  summarising the guest count and per-status breakdown, or each circle carries
  its own `aria-label`/`title` with name + status. Color alone must never be
  the only signal (matches the existing comment in `EventDetailsSection.tsx`).
- **FR-B8** The badge is presentational — no `onClick`, no focus target, no
  `tabIndex`. It must not intercept pointer events destined for the card's
  drag/resize handlers (`pointer-events-none` on the badge, or equivalent).

### Module C — `TimedEventCard` integration

- **FR-C1** The badge renders inside the existing content wrapper, positioned so
  it does not displace the title or the time label.
- **FR-C2** When `event.attendees` is absent or empty, the rendered DOM is
  identical to today's — no wrapper element, no extra class, no changed
  `aria-label`.
- **FR-C3** The card's `aria-label` string is unchanged in all cases. Attendee
  information is announced by the badge's own labelling, not by mutating the
  card label.
- **FR-C4** No change to `TimedEventCardProps`.

### Module D — `AllDayEventCard` integration

- **FR-D1** Badge renders in the single-row flex content area, after the title
  span, without breaking the title's `truncate` behavior.
- **FR-D2** Same absent/empty invariance as **FR-C2**.
- **FR-D3** No change to `AllDayEventCardProps` (note: this type is *exported*,
  so a change here is a public API break).

### Module E — `EventDetailsSection` reuse

- **FR-E1** The local `ATTENDEE_STATUS_DOT` declaration is removed.
- **FR-E2** The component imports the shared map and uses it at the identical
  call site (`ATTENDEE_STATUS_DOT[attendee.responseStatus]` in the dot
  `className`).
- **FR-E3** Rendered output is unchanged: same classes, same `title`, same
  `aria-label`, same `+N more` button behavior.

### Module F — tests

- **FR-F1** `EventCard.test.tsx` gains, for **both** cards: attendees present →
  badge visible with the expected per-status ring classes; attendees absent →
  no badge in the DOM.
- **FR-F2** An overflow case asserts the `+N` chip text for a list longer than
  the cap.
- **FR-F3** A colocated test for Module A asserts every `AttendeeResponseStatus`
  member has both a `bg-*` and a `ring-*` entry and that the `bg-*` values match
  the four tokens this run inherited.
- **FR-F4** A colocated test for Module B covers initials derivation
  (`displayName` two-word, `displayName` one-word, `null` → email fallback) and
  the empty/undefined → `null` case.
- **FR-F5** Tests use RTL with semantic queries per `.cursor/rules/web-testing.mdc`;
  no snapshot tests, no implementation-detail assertions beyond the class
  assertions the ring requirement forces.

---

## 4. Non-functional requirements

- **NFR-1 Styling** Only semantic color tokens
  (`success` / `error` / `warning` / `text-subtle` and existing surface/text
  tokens). `bun lint`'s `check-semantic-colors.ts` must pass. No raw Tailwind
  palette class (`bg-green-500`, `text-zinc-900`, …) anywhere in the diff.
- **NFR-2 Additive-only** Absent-attendee render path must be byte-identical.
  This is the load-bearing guarantee: Compass-native events and busy-projection
  events have no `attendees`, and they are the majority of cards on screen.
- **NFR-3 No API break** No exported prop type changes; `AllDayEventCardProps`
  in particular is exported and consumed elsewhere.
- **NFR-4 No new dependency.** The badge is built from existing primitives
  (`classnames`, Tailwind, React). No avatar library, no new package.json entry —
  `package.json` is outside the allowlist, so a new dep cannot be added even if
  wanted.
- **NFR-5 Test suite** `bun test:web` finishes with **no new failures** against
  the 2298-pass baseline. React `act()` warnings already in the output are
  pre-existing noise and are not treated as regressions.
- **NFR-6 Render cost** The badge is rendered per event card on a grid that can
  hold dozens of cards. Derivation (initials, slicing) must be O(cap), not
  O(attendees), and must not introduce a `useEffect`, a store subscription, or a
  new context read.
- **NFR-7 Theme** Ring colors resolve through CSS variables, so both the light
  and dark themes are covered automatically by using the tokens. No
  theme-conditional branching in the badge.
- **NFR-8 Write contract** Every file written falls inside the frozen allowlist:
  `packages/web/src/grid/components/**`,
  `packages/web/src/common/styles/**`, `packages/web/src/common/utils/**`,
  `packages/web/src/views/Forms/EventForm/EventDetailsSection.tsx`.

---

## 5. PII inventory

| Field | Source | Sensitivity | Handling in this change |
|---|---|---|---|
| `attendee.email` | Google Calendar via sync | Personal identifier | Used only as an initials fallback and inside an accessible label already scoped to the logged-in user's own calendar view. Never logged, never sent anywhere, never placed in a `data-*` attribute. |
| `attendee.displayName` | Google Calendar via sync | Personal name | Rendered as initials on screen; full name may appear in `title`/`aria-label`. Same exposure the event form already has. |
| `attendee.responseStatus` | Google Calendar via sync | Low — meeting metadata | Rendered as a ring color plus accessible text. |

No new PII enters the system; this change re-renders data already present in the
client and already displayed in the event form. The **delta** is that a name that
previously required opening an event is now visible (as initials) on the grid —
including on a shared screen. That is the intended product behavior and is noted
here so the security review can weigh it explicitly.

## 6. Role matrix

Not applicable — this is a client-side presentational change with no
authorization surface. The data is already in the browser's store, fetched under
the session's existing authorization; no new fetch, endpoint, or permission
check is introduced.

---

## 7. Acceptance criteria

1. **AC-1** A timed grid card whose event has 3 attendees with distinct statuses
   renders 3 circles whose ring classes are `ring-success`, `ring-error`,
   `ring-warning` respectively.
2. **AC-2** An all-day grid card renders the same badge under the same
   conditions.
3. **AC-3** A card whose event has `attendees: undefined` renders no badge
   element; a card with `attendees: []` likewise renders none.
4. **AC-4** A card with (cap + 3) attendees renders exactly `cap` circles and one
   chip reading `+3`.
5. **AC-5** Initials: `"Ada Lovelace" → "AL"`, `"Ada" → "A"`,
   `displayName: null, email: "ada@x.com" → "A"`.
6. **AC-6** `grep -n "ATTENDEE_STATUS_DOT" packages/web/src/views/Forms/EventForm/EventDetailsSection.tsx`
   shows only an import-site usage, no `const` declaration.
7. **AC-7** `bun lint` exits 0, including `check-semantic-colors.ts`.
8. **AC-8** `bun test:web` reports ≥ 2298 passing and 0 failing.
9. **AC-9** `git diff --stat` touches only files inside the allowlist.
10. **AC-10** Neither `TimedEventCardProps` nor `AllDayEventCardProps` gains,
    loses, or renames a member.

---

## 8. Open questions for HITL

1. **Shared-module location.** The brief leaves `common/styles/` vs
   `common/utils/` to design. A status→Tailwind-class map is styling data, and
   `common/styles/` already holds `colors.ts` / `theme.ts` — this run will place
   it under `common/styles/` unless you say otherwise.
2. **Visible cap.** `EventDetailsSection` uses 6, but a grid card is far
   narrower than the form panel. This run proposes **3** for the grid badge
   (independent constant, not shared with the form's 6). Say a number if you
   want a different one.
3. **Compact / narrow cards.** A 15-minute timed card is ~10px tall and a
   narrow column can be ~40px wide; three overlapping circles will not fit.
   This run proposes suppressing the badge below a width/height threshold,
   mirroring the existing `REPEAT_ICON_MIN_WIDTH` / `MIN_EVENT_HEIGHT_FOR_TIME_LABEL`
   precedent. Confirm, or say "always render" and accept clipping.
4. **Organizer.** `EventDetailsSection` marks the organizer, but `GridEvent`
   carries `attendees` without an `organizer` field on the card path. The badge
   therefore cannot mark the organizer, and this run does not attempt to.
   Flagging in case you expected organizer-first ordering.
