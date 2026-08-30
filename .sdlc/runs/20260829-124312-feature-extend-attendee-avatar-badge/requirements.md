# Requirements — feature-extend — Attendee avatar badge on grid event cards

**Run:** `20260829-124312-feature-extend-attendee-avatar-badge`
**Mode:** brownfield · **Intent:** feature-extend · **Form:** delta requirements
**Policy:** `opus-plus-flash-v37` · **auth_mode:** `estimated`
**Anchor commit:** `2d81253a` · **Baseline:** 2298 pass / 0 fail

This is a *delta* requirements document. It states only what changes relative to the
anchor commit. Everything not named here is required to stay bit-identical.

---

## 1. In scope

1. A new presentational React component that renders a compact row of attendee
   avatars, each colored by that attendee's `responseStatus`, plus a `+N` overflow
   indicator when the attendee count exceeds a fixed cap.
2. Rendering that component on `TimedEventCard` (`packages/web/src/grid/components/TimedEventCard.tsx`).
3. Rendering that component on `AllDayEventCard` (`packages/web/src/grid/components/AllDayEventCard.tsx`).
4. Extraction of the module-private `ATTENDEE_STATUS_DOT` map from
   `EventDetailsSection.tsx` (L12–20) into a new shared module under
   `packages/web/src/common/styles/**`, exporting the single canonical
   `AttendeeResponseStatus → semantic-token` mapping.
5. Rewiring `EventDetailsSection.tsx` to import that shared map, with byte-identical
   rendered output.
6. Unit tests for the new component, the shared map, and badge coverage added to the
   existing shared card test file `EventCard.test.tsx`.

## 2. Out of scope

1. Any change to `packages/core` contracts (`Attendee`, `AttendeeResponseStatus`) — read-only.
2. Any change to `packages/web/src/common/types/**` — `GridEvent` already carries
   `attendees` (`web.event.types.ts` L87, `z.array(AttendeeSchema).readonly().optional()`).
3. Any change to `packages/web/src/events/**` — the view-model already maps attendees.
4. Any new query, selector, store, or network plumbing.
5. Any change to `EventDetailsSection` beyond swapping the map import.
6. Playwright/e2e automation. jsdom cannot resolve Tailwind, so light/dark and
   narrow-card visual verification is a **manual post-run step**, not a pipeline gate.
7. Real photographic avatars, avatar image fetching, or gravatar-style remote lookups.
8. Seed/demo data changes.
9. Any behavioral change to the organizer indicator, conference link, or the form's
   "+N more" expand button.

## 3. Functional requirements

### Module: `common/styles` (shared status map) — new

- **FR-1** A new module under `packages/web/src/common/styles/` exports a
  `Record<AttendeeResponseStatus, string>` mapping status → semantic background token,
  with exactly the values currently in `EventDetailsSection.tsx` L12–20:
  `accepted → "bg-success"`, `declined → "bg-error"`, `tentative → "bg-warning"`,
  `needsAction → "bg-text-subtle"`.
- **FR-2** The map is typed as `Record<AttendeeResponseStatus, string>` so adding a
  status to the core enum is a compile error here, not a silent runtime `undefined`
  class.
- **FR-3** The module also exports the status→prose helper equivalent to the existing
  `attendeeStatusLabel` (`needsAction → "hasn't responded"`, otherwise the status
  verbatim), so the badge's accessible text and the form's row label cannot drift.
- **FR-4** Exactly one definition of this mapping exists in `packages/web/src`. A
  grep for the literal `"bg-text-subtle"` paired with `needsAction` returns one file.

### Module: `grid/components` (badge) — new

- **FR-5** A new component `EventAttendeeBadge` accepts the attendee list (matching
  `GridEvent["attendees"]`, i.e. a `readonly` array, optional/undefined-tolerant) and
  renders nothing (`null`) when that list is `undefined` or empty.
- **FR-6** When non-empty, it renders one avatar element per attendee up to a fixed
  cap `MAX_VISIBLE_ATTENDEES` (module constant, small — 3 for the grid card, which is
  far narrower than the form panel that uses 6).
- **FR-7** Each avatar's status color class is read from the FR-1 shared map keyed by
  that attendee's `responseStatus`. No literal color class appears in the badge.
- **FR-8** Each avatar displays a derived initial/monogram from `displayName` when
  present. When `displayName` is `null`, the avatar falls back to a non-PII glyph —
  **never** a character derived from the email local-part.
- **FR-9** When `attendees.length > MAX_VISIBLE_ATTENDEES`, the badge renders exactly
  `MAX_VISIBLE_ATTENDEES - 1` avatars plus one `+N` overflow chip where
  `N = attendees.length - (MAX_VISIBLE_ATTENDEES - 1)`, so the total element count is
  bounded at `MAX_VISIBLE_ATTENDEES` regardless of attendee count.
  (Cap arithmetic must be stated in the design and asserted in tests; an off-by-one
  here is the most likely defect.)
- **FR-10** The badge's accessible label summarizes the group (e.g. "3 guests, 2
  accepted") rather than enumerating identities, and **contains no `@`-bearing
  substring under any input**, including when `displayName` is `null` and when a
  `displayName` itself looks like an email.
- **FR-11** ~~An attendee with `displayName === null` is referred to as `Guest` in any
  human-readable text the badge produces.~~ **SUPERSEDED at Gate 3 by ruling A.** The badge
  produces no per-attendee human-readable text at all, so there is nothing for `Guest` to
  label. The sole carrier was a `title` attribute that `pointer-events-none` and
  `role="img"` jointly made unreachable to both hover and assistive tech, while still
  holding `displayName` — which directory syncs frequently set to the attendee's email — in
  an always-visible DOM. RF-01 deleted it. **Revised FR-11:** an attendee with
  `displayName === null` renders the neutral person glyph and no text; attendee identity is
  never surfaced per-avatar, only as a name-free group count in the root `aria-label`
  (e.g. `"3 guests: 2 accepted, 1 declined"`).
- **FR-12** The badge is keyboard-inert and does not capture pointer events: it must
  not add a tab stop, must not stop propagation of `mousedown`, and must not interfere
  with the card's existing drag/resize/select interaction attributes.

### Module: `grid/components` (card integration) — modified

- **FR-13** `TimedEventCard` renders the badge from `event.attendees`.
- **FR-14** `AllDayEventCard` renders the badge from `event.attendees`.
- **FR-15** Neither card's exported prop interface changes: `TimedEventCardProps` and
  `AllDayEventCardProps` keep exactly their current members, names, and types. The
  badge is driven entirely off the already-present `event` prop.
- **FR-16** When `event.attendees` is absent or empty, both cards render output
  identical to the anchor commit — no wrapper element, no extra whitespace node, no
  changed class strings, no changed `aria-label`.
- **FR-17** The badge must not alter either card's existing `aria-label` string.
  Screen-reader users get the attendee information from the badge's own label, not by
  mutation of the card label. (Rationale: `EventCard.test.tsx` matches cards by exact
  accessible name; more importantly, appending to the card label would change how every
  existing card announces.)
- **FR-18** On `TimedEventCard`, the badge must not break the existing title
  line-clamp arithmetic (`getLineClamp` against `position.height`) or push the time
  label past the card's clipped edge.

### Module: `views/Forms/EventForm` (refactor) — modified

- **FR-19** `EventDetailsSection.tsx` deletes its module-private `ATTENDEE_STATUS_DOT`
  and `attendeeStatusLabel` definitions and imports both from the FR-1/FR-3 module.
- **FR-20** `EventDetailsSection`'s rendered DOM — element structure, class strings,
  `aria-label` values, `title` values, the `MAX_VISIBLE_ATTENDEES = 6` expand behavior
  — is unchanged. This is a pure behavior-preserving refactor.

## 4. Non-functional requirements

- **NFR-1 (semantic colors)** No raw Tailwind palette class (`bg-red-500`,
  `text-gray-400`, …) anywhere under `packages/web/src`. `bun lint` runs
  `packages/scripts/src/testing/check-semantic-colors.ts` **before** Biome and
  hard-exits on the first violation, so this is a build-breaking constraint, not a
  style preference. Only tokens declared in `packages/web/src/index.css` L102–130 are
  permitted.
- **NFR-2 (lint)** `bun lint` exits 0 — semantic-color check *and* Biome (formatting,
  import ordering, a11y rules).
- **NFR-3 (types)** `bun run type-check:web-tests` exits 0. Note `attendees` is
  `readonly` and `optional`; the badge's prop type must accept
  `readonly Attendee[] | undefined` without a cast.
- **NFR-4 (tests)** `bun test:web` reports **at least** 2298 passing and **0 failing**.
  Pre-existing React `act()` warnings from `SettingsModal` are known noise and are not
  regression signal.
- **NFR-5 (a11y, non-color signal)** Status must not be conveyed by color alone. Each
  avatar carries a text/`title` affordance the way `EventDetailsSection`'s dots already
  do (see its L72–75 comment), so colorblind and screen-reader users get the same
  information.
- **NFR-6 (contrast)** Card fills are dynamic (`useEventPalette`, past-event
  darken/brighten, hover). The badge must remain legible across those states; it must
  not assume a fixed card background.
- **NFR-7 (render cost)** The badge is on the grid's hot path — one instance per
  visible event. Derivation from `attendees` must be O(cap), not O(n) formatting over
  the full list, and must not allocate per-render in a way that defeats the cards'
  existing memoization.
- **NFR-8 (additive-only)** No file outside the frozen write-contract allowlist is
  modified. Allowlist: `packages/web/src/grid/components/**`,
  `packages/web/src/common/styles/**`,
  `packages/web/src/views/Forms/EventForm/EventDetailsSection.tsx`.

## 5. PII inventory

| Field | Source | Sensitivity | Protection in this change |
|---|---|---|---|
| `attendee.email` | `packages/core` `AttendeeSchema` | **PII** — direct identifier | Never rendered as text, never placed in `aria-label`, `title`, or any `data-*` attribute by the badge. Permitted only as a React `key` (not serialized to DOM). Not used to derive the initial glyph. |
| `attendee.displayName` | `AttendeeSchema`, nullable | Low — a chosen display name, but note directory syncs frequently set it **to the email address**, and an attacker controls it for their own account | **REVISED at Gate 3.** Reaches the DOM only as a single uppercased monogram code point whitelisted to `\p{L}`/`\p{N}`, so `@` cannot appear. It no longer appears in the badge's `title` — RF-01 deleted both `title` attributes after review found them unreachable to hover and AT alike. Null renders the neutral glyph and no text. |
| `attendee.responseStatus` | enum | Low | Rendered as a semantic color + accessible text. |
| `organizer.email` | `EventContent` details | **PII** | Untouched by this change; `EventDetailsSection` keeps its existing equality-only use. |

**PII regression risk being closed:** `EventDetailsSection` L70 deliberately falls back
to `attendee.email` for display *inside the authenticated form panel*. The grid card is
a denser, more screenshot-prone, always-visible surface — the badge must **not** inherit
that fallback. This asymmetry is intentional and must be preserved by the refactor:
extracting the map must not tempt an implementer to also extract the `?? attendee.email`
name fallback into shared code.

## 6. Role matrix

No authorization surface changes. This is a client-side presentational change over data
already fetched, already authorized, and already rendered elsewhere in the same
authenticated session.

| Role | Resource | Action | Change |
|---|---|---|---|
| Authenticated user | own/shared calendar events already in `GridEvent` | read + render | unchanged; badge renders a subset of already-present fields |
| Unauthenticated | — | — | unreachable; grid is behind auth |

## 7. Acceptance criteria

1. `bun test:web` → ≥ 2298 pass, 0 fail.
2. `bun lint` → exit 0, including `check-semantic-colors.ts`.
3. `bun run type-check:web-tests` → exit 0.
4. A test asserts `TimedEventCard` with a non-empty `attendees` renders the badge.
5. A test asserts `AllDayEventCard` with a non-empty `attendees` renders the badge.
6. A test asserts that for `attendees: undefined` and for `attendees: []`, neither card
   emits any badge element (queried by role/testid → null).
7. A test asserts the cap: with `MAX_VISIBLE_ATTENDEES + 3` attendees, the rendered
   avatar count equals `MAX_VISIBLE_ATTENDEES - 1` and exactly one `+N` chip appears
   with the arithmetically correct `N`.
8. A test asserts no rendered text or accessible name anywhere in the badge subtree
   contains `@`, given an attendee list where every `displayName` is `null`.
9. **REVISED at Gate 3 (ruling A).** ~~A test asserts an attendee with `displayName: null`
   surfaces as `Guest`.~~ A test asserts an attendee with `displayName: null` renders the
   neutral person glyph (`svg` present) and empty text, and that the group label names
   nobody (`"1 guest: 1 hasn't responded"`). Asserted via `getByTestId` + `getByRole("img")`,
   **not** `getByTitle` — the `title` no longer exists, and asserting an imperceptible
   attribute was itself a review finding (MAJOR-2).
10. A test asserts each status maps to its expected semantic class via the shared map
    (all four enum members covered).
11. A test asserts the shared map is exhaustive over `AttendeeResponseStatusSchema`'s
    options — iterating the zod enum's values and asserting every key is present, so a
    future core-enum addition fails here rather than rendering an `undefined` class.
12. `EventDetailsSection` output is unchanged: its existing tests still pass unmodified,
    and no assertion in them was edited to accommodate this run.
13. `git diff --stat` against `2d81253a` touches only files inside the allowlist.
14. `TimedEventCardProps` and `AllDayEventCardProps` are textually unchanged in their
    member lists.

## 8. Open questions for HITL

- **Q1 (cap value).** The form uses 6; a grid card is far narrower (a 140px-wide card in
  the existing test fixture). Proposal: **3** for the grid badge, kept as a named
  constant in the badge module and *not* shared with the form's 6. Confirm, or name a
  different number.
- **Q2 (badge placement on `TimedEventCard`).** The card body is a vertical flex column
  holding title then time-label, with a height-driven line-clamp. Proposal: render the
  badge only when the card is tall/wide enough (reusing the existing
  `COMPACT_EVENT_MAX_HEIGHT` / min-width gating philosophy already applied to the repeat
  icon and time label) so the badge never squeezes the title on a 15-minute event.
  Confirm whether a size gate is wanted, or whether the badge should always render when
  attendees exist.
- **Q3 (avatar glyph for `displayName: null`).** Proposal: a neutral person glyph or the
  literal `?`, with accessible text `Guest`. Confirm this over any email-derived initial
  (which requirements FR-8/FR-10 forbid).

---

## 9. HITL Gate 1 resolution — 2026-08-29 (RESUMED)

Requirements **approved**. Open questions resolved:

- **Q1 → cap = 3.** `MAX_VISIBLE_ATTENDEES = 3` as a named constant local to the badge
  module; **not** shared with `EventDetailsSection`'s `6`. Overflow renders 2 avatars +
  one `+N` chip (FR-9 arithmetic: `N = attendees.length - 2`).
- **Q2 → size gate = yes.** The badge renders only when the card is large enough, reusing
  the existing `COMPACT_EVENT_MAX_HEIGHT` / min-width gating philosophy already applied to
  the repeat icon and time label on `TimedEventCard`. It must never squeeze the title
  line-clamp on a short event (FR-18). `AllDayEventCard` has no height variance — gate on
  its existing width/compact criteria only. Design phase to name the exact threshold(s).
- **Q3 → neutral person glyph.** `displayName: null` avatars show a non-PII person glyph
  (not an email-derived initial), accessible text `Guest` (FR-8, FR-10, FR-11).

Proceeding to Phase 2 (architecture_design). Anchor unchanged: `2d81253a`.
