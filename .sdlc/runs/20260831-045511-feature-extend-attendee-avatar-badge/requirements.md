# Requirements — feature-extend — Attendee status badge on Week grid event cards

- **Run:** `20260831-045511-feature-extend-attendee-avatar-badge`
- **Mode / intent:** brownfield / `feature-extend` (delta requirements form)
- **Policy:** `opus-only-v5` (single tier — `claude-opus-5`), `auth_mode: estimated`
- **Branch:** `CMP-105/opus-only-v5` @ `2d81253a`
- **Test command:** `bun test:web` (repo root)
- **Source brief:** `intent_brief.md` (Gate 0 approved 2026-08-31)

This is a **delta** requirements document: it states only what changes relative to the code that
exists at `2d81253a`, plus the invariants the change must not break.

---

## 0. Baseline facts verified in-tree (not assumed)

These were read from source during this phase; the design phase may rely on them.

| # | Fact | Evidence |
|---|---|---|
| B-1 | `GridEvent` **already carries `attendees`** — `attendees: z.array(AttendeeSchema).readonly().optional()` | `packages/web/src/common/types/web.event.types.ts:87` |
| B-2 | The view-model **already populates it** on every grid event — `attendees: details?.attendees` | `packages/web/src/events/queries/event.view-model.ts:92` |
| B-3 | `AttendeeResponseStatus` is a 4-member enum: `needsAction \| accepted \| declined \| tentative` | `packages/core/src/types/event-attendance.contracts.ts` |
| B-4 | `Attendee` = `{ email, displayName: string \| null, responseStatus }` — **no avatar/photo field exists client-side** | same file |
| B-5 | `EventDetailsSection` holds the two constants module-privately (not exported) and renders the dot at `size-2.5 shrink-0 rounded-full <class>` with `aria-hidden` + `title`, RSVP text carried on the parent `<li>`'s `aria-label` | `EventDetailsSection.tsx:12-20, 76-87` |
| B-6 | `TimedEventCard` gates optional chrome on `position.width` / `position.height` / duration: `showRepeatIcon` (duration ≥ 15 min **and** `width ≥ 40`), `showTimeLabel` (`height ≥ 36` **and** `width ≥ 90`) | `TimedEventCard.tsx:57-58, 116-126`; `grid.constants.ts` |
| B-7 | `AllDayEventCard` is a fixed-height 20px strip (`EVENT_ALLDAY_HEIGHT`) and gates only on width (`REPEAT_ICON_MIN_WIDTH = 60`) | `AllDayEventCard.tsx:32,77`; `grid.constants.ts` |
| B-8 | Both cards build a single `accessibleLabel` string and set it as `aria-label` on the card root (`role="button"`) | `TimedEventCard.tsx:265-268`; `AllDayEventCard.tsx:138-141` |
| B-9 | `GridEvent.tsx` passes the whole `event` object to `TimedEventCard` — **no prop plumbing is needed** for attendees | `GridEvent.tsx` render body |
| B-10 | **No `__snapshots__` directory exists anywhere under `packages/web/src`** — the brief's "existing snapshots unchanged" clause is vacuous; assertion-based tests only | `find packages/web/src -name __snapshots__` → empty |
| B-11 | Card tests live in one file, `packages/web/src/grid/components/EventCard.test.tsx` (575 lines, `bun:test` + Testing Library, local `createEvent()` factory) | that file |
| B-12 | Card content wrapper is `flex flex-col flex-wrap items-start` (timed) / `flex min-w-0 items-center` (all-day); the timed title uses `-webkit-line-clamp` sized off `position.height` | `TimedEventCard.tsx:208-224,321-326` |

**B-1/B-2/B-9 together retire two items the brief listed as in-scope-if-needed:**
`web.event.types.ts` and `event.view-model.ts` need **no change**, and `GridEvent.tsx` needs no
new prop. They stay in the write allowlist but the design phase should plan zero packets against
them unless it finds a reason this phase missed.

---

## 1. In scope

1. Extract `ATTENDEE_STATUS_DOT` and `attendeeStatusLabel` out of `EventDetailsSection.tsx` into a
   new shared module under `packages/web/src/grid/components/` (exact path is a Gate 2 decision),
   re-exporting or re-typing `AttendeeResponseStatus` so consumers need not reach into `@core`.
2. Point `EventDetailsSection.tsx` at the shared module (import swap only — zero render change).
3. Add an attendee status badge to `TimedEventCard`, rendered only when the event has ≥ 1 attendee
   and the card is large enough.
4. Add the same badge to `AllDayEventCard`, subject to the all-day strip's own (width-only) gate.
5. Accessibility: the badge must never be a color-only signal.
6. Tests: a unit test for the shared module; component tests for badge-shown / badge-hidden /
   badge-suppressed-when-too-small, on both card types.

## 2. Out of scope (delta — unchanged behavior)

1. No change to attendee fetch/storage/sync. `packages/backend`, `packages/sync`, `packages/core`,
   `packages/scripts` are write-contract off-limits.
2. No hover card, popover, tooltip-on-click, or any interaction on the badge. Display only.
   (A mouse-only `title` attribute matching `EventDetailsSection`'s existing dot is permitted —
   it is not an interaction.)
3. **No avatar images and no initials.** `Attendee` carries no photo URL (B-4), and the brief's
   non-goals bar network avatars. "Avatar badge" = the RSVP status dot(s). If the design phase
   wants initials from `displayName`, it must raise it at Gate 2 as an explicit deviation.
4. No Month view, mini-calendar, `BusyPeriodBlock`, or draft-overlay changes.
5. No redesign of `EventDetailsSection`'s layout.
6. No change to `GridEvent.tsx`'s memo comparator, positioning, or deck layout.
7. No new dependency. Everything needed (`classnames`, Tailwind 4 tokens, phosphor icons) is
   already present.

---

## 3. Functional requirements

### Module: shared RSVP status util (new file)

- **FR-1** The module exports `ATTENDEE_STATUS_DOT: Record<AttendeeResponseStatus, string>` with
  exactly today's mapping: `accepted → "bg-success"`, `declined → "bg-error"`,
  `tentative → "bg-warning"`, `needsAction → "bg-text-subtle"`. Values must be **byte-identical**
  to the current literals — these are Tailwind class names and any drift is a silent style break.
- **FR-2** The module exports `attendeeStatusLabel(status: AttendeeResponseStatus): string`
  returning `"hasn't responded"` for `needsAction` and the raw status string otherwise.
- **FR-3** The module re-exports the `AttendeeResponseStatus` type so grid consumers import from
  one place. It must not redeclare or widen the enum — it re-exports `@core`'s type.
- **FR-4** The module is **pure and side-effect free** (no React import, no store access) so it can
  be unit-tested without a DOM.
- **FR-5** The module owns the aggregate rule used by the badge (see FR-9), so both cards and the
  test share one implementation rather than each card computing its own.

### Module: `EventDetailsSection` (existing file, edit)

- **FR-6** The two module-private constants are deleted from this file and imported from the shared
  module instead. The `@core/types/event-attendance.contracts` type import is kept or replaced by
  the shared re-export at the design phase's discretion.
- **FR-7** The rendered output is unchanged: same element tree, same class strings, same
  `aria-label` / `title` text, same `MAX_VISIBLE_ATTENDEES = 6` behavior and "+N more" button.

### Module: `TimedEventCard` (existing file, edit)

- **FR-8** When `event.attendees` is a non-empty array **and** the size gate (FR-11) passes, the
  card renders a badge element. When `attendees` is `undefined`, `[]`, or the gate fails, it
  renders nothing new — no wrapper element, no empty span.
- **FR-9** The badge summarizes RSVP state. The chosen visual (single aggregate dot, capped dot
  row, or dot + count) is a Gate 2 decision, but the aggregate rule must be deterministic and
  defined in the shared module. Whatever is chosen must use only the FR-1 color classes.
- **FR-10** The badge does not displace or reflow existing chrome: the title's line-clamp
  computation and the time label's row must be unaffected for an event **without** attendees, and
  for an event with attendees the title may truncate earlier but must not push the time label past
  the card's clipped edge (the `overflow-hidden` root would silently eat it).
- **FR-11** The badge is gated on card size using the existing style — module-level named
  constants in the same shape as `REPEAT_ICON_MIN_WIDTH` / `MIN_EVENT_HEIGHT_FOR_TIME_LABEL`, not
  inline magic numbers. Gate thresholds are a Gate 2 decision; a 15-minute event
  (`COMPACT_EVENT_MAX_HEIGHT = 15`) must not show the badge.
- **FR-12** The badge is suppressed for `displayMode === "placeholder"` (matching `showRepeatIcon`),
  since a placeholder is a drag ghost, not a real card. Behavior for `"draft"` is a Gate 2
  decision (a draft has no attendees in practice, so this is defensive).
- **FR-13** The badge must not interfere with pointer interaction: it sits inside the card root and
  must not stop propagation, must not be a resize-handle sibling that steals the `mousedown`, and
  must not sit above `EVENT_RESIZE_HANDLE_ATTRIBUTE` elements in z-order.

### Module: `AllDayEventCard` (existing file, edit)

- **FR-14** Same badge, same shared module, gated on `position.width` only (the strip is a fixed
  20px tall — a height gate would be dead code). Threshold is a Gate 2 decision.
- **FR-15** The all-day title currently truncates against the full row; when the badge shows, room
  must be reserved for it the way `pr-3.5` already reserves room for `showRepeatIcon`, so a long
  title truncates instead of overlapping the badge.

### Cross-cutting

- **FR-16** No `any`, no non-null assertion, no `as` cast to smuggle `attendees` through. The field
  is already typed (B-1); if the design phase believes a cast is needed, that is a signal the
  design is wrong.

---

## 4. Non-functional requirements

- **NFR-1 (a11y — repo rule A9, "color is never the only signal").** RSVP state must be reachable
  as text by a screen reader. Two acceptable shapes, both used elsewhere in this repo:
  (a) fold the state into the card root's existing `accessibleLabel` string (B-8), or
  (b) put an `aria-label` on the badge group and `aria-hidden` on the individual dots
  (the `EventDetailsSection` pattern, B-5).
  The design phase picks one and Gate 2 ratifies it. A mouse `title` alone is **not** sufficient.
- **NFR-2 (render cost).** The badge must not introduce a hook, a store subscription, a context
  read, or a `useMemo` over a newly-allocated array per render in a component that renders once per
  visible event. Derivation from `event.attendees` must be O(n) over a list that is already in
  memory, computed inline.
- **NFR-3 (memoization).** `GridEventMemo`'s comparator compares `prev.event === next.event` by
  reference. The badge must derive from `event` only — deriving from anything outside the
  comparator's inputs would produce a stale badge.
- **NFR-4 (styling conventions).** Tailwind 4 utility classes only, using existing semantic tokens
  (`bg-success`, `bg-error`, `bg-warning`, `bg-text-subtle`). No new CSS file, no inline color
  literals, no new token. `.cursor/rules/web-styles.mdc` governs and is off-limits to edit.
- **NFR-5 (typing).** `bun type-check` must pass. TypeScript 7.0.2, strict.
- **NFR-6 (lint/format).** Biome-clean. Note the repo has out-of-band Cursor/Codex format-on-edit
  hooks (baseline `coexistence_notes`) that may reformat written files; codegen should emit
  already-formatted code so the diff is stable.
- **NFR-7 (test isolation).** New tests use the existing `bun:test` + Testing Library conventions
  and the local `createEvent()` factory in `EventCard.test.tsx` (B-11) rather than introducing a
  second fixture style.
- **NFR-8 (write contract).** All writes confined to the frozen allowlist:
  `packages/web/src/grid/**`, `packages/web/src/views/Week/components/Event/**`,
  `packages/web/src/views/Forms/EventForm/**`, `web.event.types.ts`, `event.view-model.ts`.

---

## 5. PII inventory

| Field | Source | Sensitivity | Handling in this change |
|---|---|---|---|
| `attendee.email` | provider (Google), already on the client | **Medium** — personal identifier | **Must not be rendered on the grid card, and must not enter the card's `aria-label` or `title`.** The grid is a screenshot-and-screenshare surface; the form (`EventDetailsSection`) is a deliberate open. Aggregate counts/statuses only. |
| `attendee.displayName` | provider, may be `null` | **Medium** — personal identifier | Same as email: not on the card in this change. This is the concrete reason initials are out of scope (§2.3). |
| `attendee.responseStatus` | provider | **Low** — but socially sensitive in aggregate ("3 declined") | Rendered as color + text. Acceptable: it is already visible in the form to the same user, and the grid shows only the user's own calendar. |
| `organizer.email` | provider | Medium | Untouched by this change. |

**PII-1:** No new data leaves the client. No logging, no analytics event, no PostHog capture is
added by this change.

## 6. Role matrix

Compass Week grid is single-user; there is no role dimension in the client. Recorded for
completeness:

| Role | Resource | Action | Change |
|---|---|---|---|
| Signed-in user | own/subscribed calendar event | read attendee RSVP on grid card | **new (additive read of data already fetched)** |
| Signed-in user | busy-projection event (`isBusy`) | read attendee RSVP | none — busy events carry no `details`, so `attendees` is `undefined` and FR-8 renders nothing |
| Signed-in user | demo event (`isDemo`) | read attendee RSVP | none — demo fixtures carry no attendees today |
| Any | anything on backend/sync | — | unchanged (off-limits) |

---

## 7. Acceptance criteria

Traceability to the brief's AC-1…AC-6 in the right column.

| # | Criterion | Verified by | Brief |
|---|---|---|---|
| **AC-1** | A timed grid card for an event with ≥ 1 attendee renders a badge whose dot class comes from `ATTENDEE_STATUS_DOT` in the **shared module**, and `EventDetailsSection` imports the same symbol from the same module (single source of truth — provable by `grep`: exactly one definition site in `packages/web/src`). | component test + grep | AC-1 |
| **AC-2** | A card for an event with `attendees: undefined` **and** one with `attendees: []` render exactly as before: no badge node, and the existing `EventCard.test.tsx` assertions pass unmodified. | existing tests unchanged + new negative test | AC-2 |
| **AC-3** | RSVP state is reachable as text: querying the rendered card by accessible name (or the badge by its `aria-label`) surfaces the status wording, and every purely-decorative dot is `aria-hidden`. Asserted against the accessible name, **not** against a raw `class` attribute. | component test | AC-3 |
| **AC-4** | A card sized below the FR-11 threshold (e.g. a 15-minute event, `height ≤ COMPACT_EVENT_MAX_HEIGHT`, or `width` under the badge's min) renders no badge; the threshold is a named exported constant, asserted by importing it rather than hardcoding a pixel value in the test. | component test | AC-4 |
| **AC-5** | `EventDetailsSection` renders identically after extraction: `EventForm.test.tsx` and the other EventForm tests pass with **zero assertion edits** (`git diff --stat` on those files shows no change, or change only if a test file is added). | test run + diff check | AC-5 |
| **AC-6** | `bun test:web` passes with no new failures vs. the pre-run baseline; new unit test covers all four `ATTENDEE_STATUS_DOT` entries and both `attendeeStatusLabel` branches; component tests cover badge-shown / badge-hidden / badge-suppressed-when-small on **both** `TimedEventCard` and `AllDayEventCard`. | test run | AC-6 |
| **AC-7** | `bun type-check` passes. | type-check | NFR-5 |
| **AC-8** | Every file written is inside the frozen write-contract allowlist; `provenance.json` records a before/after entry for each. | write-contract hook + provenance | NFR-8 |

**Pre-run test baseline must be captured before any codegen** so AC-6's "no new failures" is
measurable rather than asserted. (Phase 7 owns this; noted here because it is an AC dependency.)

---

## 8. Open questions for HITL

These are decisions this phase deliberately did **not** make. None blocks Gate 1 — all are Gate 2
material unless you want to rule now.

- **Q-1 (badge shape).** One aggregate dot, or up to N per-attendee dots? The brief says "aggregate
  **or** individual". A capped dot row (e.g. max 3 + "+N") reads richer but costs horizontal room
  on a grid card that is often ~140px wide and already carries a repeat icon. Recommendation:
  **single aggregate dot + attendee count**, with the aggregate rule in the shared module.
- **Q-2 (aggregate rule).** If Q-1 is "aggregate", what colors it? Candidates: (a) worst-case
  precedence `declined > needsAction > tentative > accepted`; (b) the organizer-relevant
  "everyone accepted / some pending / someone declined" tri-state; (c) the *current user's own*
  RSVP — but the client has no reliable "which attendee am I" signal on `GridEvent` (no user email
  on the entity), so (c) would need data plumbing this run has ruled out. Recommendation: **(a)**,
  documented in the shared module.
- **Q-3 (a11y placement).** NFR-1 (a) fold into the card's `aria-label`, or (b) `aria-label` on the
  badge group? (a) is one announcement and matches how this card already carries the recurring and
  calendar signals; (b) matches `EventDetailsSection`. Recommendation: **(a)** for the card, since
  the card root is the only focusable element and a nested label on a non-focusable span is
  frequently skipped by screen readers.
- **Q-4 (all-day scope).** The brief says all-day "if attendee data is present there". It **is**
  (B-1/B-2 apply to both card types). Confirm all-day is in, or drop it to keep the diff smaller.
  Recommendation: **keep it in** — it is the same shared component, and dropping it leaves an
  inconsistency a user will notice.
- **Q-5 (PII ruling).** §5 forbids attendee names/emails on the grid card, including in the
  `aria-label`. This is stricter than the brief, which is silent on it. Confirm — if you want names
  in the accessible label, say so and §5 changes.
- **Q-6 (branch).** This run is on `CMP-105/opus-only-v5` @ `2d81253a`, a policy-comparison arm of
  the same CMP-105 ticket. Confirm that is where you want the diff to land.

---

## 9. Risks

| # | Risk | Mitigation |
|---|---|---|
| R-1 | Extraction changes `EventDetailsSection`'s output through a stray formatting or class-string edit (AC-5 fail). | Codegen packet is a *pure move*: delete two declarations, add one import, touch nothing else. Verified with `git diff` on that file being ≤ ~10 lines, and by its tests passing unedited. |
| R-2 | Badge overflows a narrow/short card, clipping the title or time label (AC-4 fail). | FR-11 named-constant gate + a component test at the smallest permitted size. |
| R-3 | Test asserts the Tailwind `class` string rather than the accessible name, so the test passes while the a11y promise is unmet. | AC-3 explicitly requires assertion against the accessible name; senior review checks for this. |
| R-4 | The out-of-band Cursor/Codex format-on-edit hooks reformat plugin-written files mid-run, making a later `git diff` check misleading. | NFR-6: emit already-formatted code; run Biome check at Phase 7 rather than trusting the write. |
| R-5 | Attendee list includes the organizer; naive counting says "3 guests" where the form says something else. | The form counts `attendees.length` verbatim (`EventDetailsSection.tsx:65`); the badge must use the same count so the two surfaces never disagree. |
| R-6 | `readonly` array type on `attendees` breaks a `.sort()` / `.reverse()` in the aggregate rule (NFR-5 fail). | Aggregate rule must be non-mutating (reduce/some/every), which is also NFR-2's requirement. |

---

## 10. Deliverables

| Path | Action |
|---|---|
| `packages/web/src/grid/components/<shared-status-module>.ts` | **new** |
| `packages/web/src/grid/components/<shared-status-module>.test.ts` | **new** |
| `packages/web/src/grid/components/TimedEventCard.tsx` | edit |
| `packages/web/src/grid/components/AllDayEventCard.tsx` | edit |
| `packages/web/src/grid/components/EventCard.test.tsx` | edit (append cases) |
| `packages/web/src/views/Forms/EventForm/EventDetailsSection.tsx` | edit (import swap) |
| *(optional, Gate 2)* `packages/web/src/grid/components/AttendeeBadge.tsx` | new, if the badge is split out |
| `packages/web/src/common/types/web.event.types.ts` | **no change expected** (B-1) |
| `packages/web/src/events/queries/event.view-model.ts` | **no change expected** (B-2) |
| `packages/web/src/views/Week/.../GridEvent.tsx` | **no change expected** (B-9) |
