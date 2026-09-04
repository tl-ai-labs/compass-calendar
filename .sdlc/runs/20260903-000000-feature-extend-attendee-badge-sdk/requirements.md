# Delta Requirements — feature-extend — Attendee avatar badge on grid event cards

Run: `20260903-000000-feature-extend-attendee-badge-sdk`
Intent: `feature-extend` (delta requirements — this document describes only the change,
not the existing system)
Baseline: `main@2d81253a`, branch `CMP-105/opus-plus-flash-v37-sdk`
Source brief: `intent_brief.md` (scope, allowlist and Gate 0 record are authoritative there
and are not restated)

---

## 1. Verified starting state

Everything below was read from the working tree at HEAD, not assumed from the brief.

| Fact | Evidence |
|---|---|
| Two shared card components render every grid card | `grid/components/TimedEventCard.tsx` (368 ln, `forwardRef`), `grid/components/AllDayEventCard.tsx` (228 ln, `forwardRef`) |
| `GridEvent` already carries the attendance fields | `common/types/web.event.types.ts:86-88` — `organizer` nullable+optional, `attendees` `z.array(AttendeeSchema).readonly().optional()`, `conference` nullable+optional |
| The view-model already populates them | `events/queries/event.view-model.ts:92-94` |
| Status→colour map and label helper are module-private | `views/Forms/EventForm/EventDetailsSection.tsx:12-20` — neither `ATTENDEE_STATUS_DOT` nor `attendeeStatusLabel` is exported |
| The colour-only-signal rule is already documented policy | `EventDetailsSection.tsx:72-75` comment: the dot is `aria-hidden` with a mouse-only `title`; the accessible signal lives on the parent `<li>`'s `aria-label` |
| The status enum is closed and read-only for this run | `packages/core/src/types/event-attendance.contracts.ts:14-19` — exactly four values |
| Both cards already own their bottom-right corner | `EventRepeatIcon.tsx:18` pins `absolute right-1 bottom-0.5` on both cards |
| Lint forbids raw palette classes | `packages/scripts/src/testing/check-semantic-colors.ts` regex-scans all of `packages/web/src` for `bg-*/text-*/...` palette utilities and exits 1; it runs **before** biome in `package.json:28` |
| Test baseline is RED, not green | recorded baseline 2297 pass / 1 fail / 1 error; the failure is `RecurrenceSection > keeps the event's own date selectable when the event ends after midnight` |

**Consequence for the design:** `ATTENDEE_STATUS_DOT` values are `bg-success` / `bg-error` /
`bg-warning` / `bg-text-subtle` — already semantic tokens. Moving them verbatim satisfies NFR-4
by construction. Any new colour invented for the badge would have to be a semantic token too.

---

## 2. In scope

1. A new presentational component that renders an attendee status indicator on a grid event card.
2. Rendering that component from both `TimedEventCard` and `AllDayEventCard`, so Week and Day —
   timed and all-day — are covered with no per-view edits.
3. Extracting `ATTENDEE_STATUS_DOT` and `attendeeStatusLabel` out of `EventDetailsSection.tsx`
   into a shared util, and re-pointing `EventDetailsSection` at the extracted symbols.
4. Unit tests for the new component and the extracted util; card-level tests in the existing
   `EventCard.test.tsx`.

## 3. Out of scope

1. **Month view** — does not exist in this repo (Gate 0 decision, recorded as a non-goal in the
   brief). Any later artifact that mentions a Month cell is a defect to be raised at the gate
   where it appears.
2. Remote avatar imagery / profile photos. "Avatar badge" = the status-coloured attendee
   indicator built from data already on the event.
3. Any change to the resize-handle geometry, including the known pre-existing `endDate`
   `elementFromPoint` failure on ~30% of cards.
4. The pre-existing `RecurrenceSection` date-rot failure — off-limits, must not be touched.
5. The known local-IndexedDB bug that drops `attendees` on resize/move/edit in anonymous mode.
6. Any change to the attendance contract in `packages/core/**` (read-only) or to
   `packages/web/src/index.css` (semantic tokens are consumed, never redefined).
7. Widening the write contract.

---

## 4. Functional requirements

### Module: `common/utils` — extracted status util (new)

- **FR-1** A new module `packages/web/src/common/utils/attendee-status.util.ts` exports
  `ATTENDEE_STATUS_DOT: Record<AttendeeResponseStatus, string>` with the four entries moved
  **byte-for-byte** from `EventDetailsSection.tsx:12-17` (`accepted: "bg-success"`,
  `declined: "bg-error"`, `tentative: "bg-warning"`, `needsAction: "bg-text-subtle"`).
- **FR-2** The same module exports `attendeeStatusLabel(status: AttendeeResponseStatus): string`
  with behaviour identical to the current private helper: `needsAction` → `"hasn't responded"`,
  every other value → the status string itself.
- **FR-3** After this change `ATTENDEE_STATUS_DOT` is **declared exactly once** in the repo.
  `EventDetailsSection.tsx` imports both symbols instead of declaring them, and its rendered
  output is unchanged.

### Module: `grid/components` — the badge (new)

- **FR-4** A new component `packages/web/src/grid/components/AttendeeBadge.tsx` takes the event's
  attendee list (and the organizer, if the design needs it for labelling) and renders a compact
  status indicator suitable for a grid card.
- **FR-5** The badge renders **nothing** (returns `null`) when there are no attendees to show.
  `attendees` is `optional` and `readonly` on `GridEvent` and is `undefined` for busy-projection
  events, so the component must handle `undefined`, `[]`, and a frozen array without throwing.
- **FR-6** The badge's status colours come from `ATTENDEE_STATUS_DOT` (FR-1). It defines no
  colour map of its own and no raw palette class.
- **FR-7** The RSVP signal is **not colour-only**. The badge carries a text or ARIA equivalent,
  following the pattern already documented at `EventDetailsSection.tsx:72-75`: the coloured
  element itself may be `aria-hidden`, provided an accessible name on an ancestor conveys the
  same information.

### Module: `grid/components` — card integration (edit)

- **FR-8** `TimedEventCard` renders the badge for timed cards.
- **FR-9** `AllDayEventCard` renders the badge for all-day and multi-day row cards.
- **FR-10** The badge must not displace or overlap either card's existing bottom-right
  `EventRepeatIcon` (`absolute right-1 bottom-0.5`) when both are shown on the same card.
- **FR-11** The badge must not sit on top of either resize handle's hit area
  (`[data-calendar-event-resize-handle]`, 4.5px at each edge). Cards already have a
  documented `endDate` hit-testing weakness; the badge must not enlarge it. If the badge is
  rendered inside the card it must be `pointer-events-none` or otherwise non-hit-testable,
  unless the design gives it an interactive role and states how the handles stay reachable.
- **FR-12** Cards with no attendees keep rendering exactly as they do today. (Note: Gate 0
  explicitly declined a byte-identity assertion for this case, so this is a requirement on
  intent, not a test-enforced invariant — see §7 AC-9.)

---

## 5. Non-functional requirements

- **NFR-1 (a11y)** No new colour-only signal. Matches the existing repo rule at
  `EventDetailsSection.tsx:72-75`.
- **NFR-2 (a11y)** The card's existing `role="button"` + `aria-label` contract must survive.
  `EventCard.test.tsx` queries cards by their exact accessible name (e.g.
  `"Timed event: Planning block, 9 - 10 AM"`); if the badge's accessible text is folded into the
  card's own `aria-label`, every one of those existing queries breaks. The design must state
  which it does and account for the fallout.
- **NFR-3 (single source of truth)** No duplicated status→colour map anywhere in the repo.
- **NFR-4 (lint)** `bun lint` passes, including `check-semantic-colors.ts` which runs first.
  Only semantic tokens; the regex catches `bg-green-500`-style classes anywhere under
  `packages/web/src`, including inside test files and comments.
- **NFR-5 (layout)** Cards can be as small as `min-h-2.5` and are `overflow-hidden`; the compact
  path (`position.height <= COMPACT_EVENT_MAX_HEIGHT`) and the narrow path
  (`position.width < MIN_EVENT_WIDTH_FOR_TIME_LABEL`) already suppress card chrome. The badge
  must degrade on small cards rather than push the title out or spill.
- **NFR-6 (typing)** `attendees` is `readonly` — the badge must not sort/splice/reverse it in
  place. Any ordering must be done on a copy.
- **NFR-7 (no plumbing)** No changes to the view-model, the store, or the Week/Day call sites.
  All four call sites (`GridEvent.tsx:134`, `AllDayEvent.tsx:64`, `GridDraft.tsx`,
  `DayCalendarEventCards.tsx:93/:180`) already pass the whole `GridEvent`.

---

## 6. PII inventory

Attendee data is real personal data and this change moves it from a click-to-open form onto a
surface that is visible without any interaction.

| Field | Source | Sensitivity | Protection required by this change |
|---|---|---|---|
| `attendee.email` | `AttendeeSchema.email` (`core`) | **PII — direct identifier** | Must NOT be rendered as visible text on a grid card. Permitted only inside an accessible name if the design has no display name to fall back on, and the design must say so explicitly. |
| `attendee.displayName` | `AttendeeSchema.displayName`, nullable | **PII — personal name** | May appear in an accessible name / tooltip. Truncation must not be the only protection. |
| `attendee.responseStatus` | closed enum | Low — meeting metadata | Fine to render as colour + text equivalent. |
| `organizer.email` / `organizer.displayName` | `OrganizerSchema`, nullable | **PII** | Same treatment as attendee fields. |
| attendee **count** | derived | Low | Fine to render. |

- **PII-1** The badge must not put a raw email address into always-visible card text. A grid is
  a shoulder-surfable, screenshot-heavy surface; the existing form is not.
- **PII-2** Falling back `displayName ?? email` (as `EventDetailsSection.tsx:70` does) is
  acceptable **inside an accessible name or tooltip**, and is a decision the design must make
  explicitly rather than inherit by copy-paste.
- **PII-3** No attendee data may be logged, sent to telemetry, or written into a `data-*`
  attribute (`data-*` is trivially scraped and lands in DOM snapshots).

## 7. Role matrix

Not applicable in the usual sense — this is a client-side presentational change with no new
endpoint, no new authorization decision and no new data fetch. The only access-control-adjacent
statement is:

| Actor | Resource | Action | Note |
|---|---|---|---|
| Signed-in user | attendees of events already on their own calendar | view | Already granted; the data is already in the client's store and already rendered in `EventDetailsSection`. This change changes *where* it is shown, not *who* can see it. |
| Anonymous / local (IndexedDB) mode user | attendees on locally-stored events | view | Same. Note the known local-mode bug that destroys `attendees` on edit — out of scope, but it means the badge will legitimately disappear after an edit in that mode. |

---

## 8. Acceptance criteria

Mapped from the brief's AC-1..AC-8, plus the ones this analysis adds.

- **AC-1** (brief AC-1) A timed grid card whose event has attendees renders the badge.
  *Test:* `EventCard.test.tsx` — render `TimedEventCard` with an event carrying ≥1 attendee,
  assert the badge is present.
- **AC-2** (brief AC-2) An all-day / multi-day row card whose event has attendees renders the
  same badge. *Test:* same file, `AllDayEventCard`.
- **AC-3** (brief AC-3) `ATTENDEE_STATUS_DOT` is declared exactly once in the repo.
  *Test:* mechanically checkable — `grep -rn "ATTENDEE_STATUS_DOT\s*[:=]" packages/` returns
  exactly one declaration site, in `attendee-status.util.ts`.
- **AC-4** (brief AC-4) `EventDetailsSection` renders identically to before. *Test:* the existing
  `EventForm.test.tsx` attendee assertions stay green with zero edits to that file.
  `EventForm.test.tsx` is **not** in the allowlist, which is the enforcement: if it needed
  editing, AC-4 has failed.
- **AC-5** (brief AC-5) The RSVP status signal is not colour-only — an accessible text equivalent
  exists. *Test:* query the badge by accessible name / text, not by class.
- **AC-6** (brief AC-6) With `attendees: undefined` (busy-projection) and with `attendees: []`,
  both cards render without throwing and show no badge. *Test:* explicit cases in
  `EventCard.test.tsx` and `AttendeeBadge.test.tsx`.
- **AC-7** (brief AC-7) `bun run test:web` shows **no new failures against 2297 pass / 1 fail /
  1 error**. Phase 7 diffs against that baseline, not against zero. The run must report the raw
  numbers and must not describe the suite as "green".
- **AC-8** (brief AC-8) `bun lint` passes, `check-semantic-colors.ts` included.
- **AC-9** (added, NFR-2) Every pre-existing accessible-name query in `EventCard.test.tsx`
  (e.g. `getByRole("button", { name: "Timed event: Planning block, 9 - 10 AM" })`) still
  resolves after the change. This is the concrete form of "don't break the card's a11y
  contract", and it is the AC most likely to fail if the design appends badge text to the
  card's `aria-label`.
- **AC-10** (added, FR-11) Both resize handles remain present and mouse-down-able on a card that
  shows a badge. *Test:* the existing `document.querySelectorAll("[data-calendar-event-resize-handle]")`
  → length 2 assertion, repeated on a card with attendees.
- **AC-11** (added, PII-1) No attendee email appears in always-visible card text. *Test:* render
  a card with an attendee whose `email` is `secret@example.com` and whose `displayName` is set;
  assert the email is not in the card's visible text content.
- **AC-12** (added, NFR-6) The badge does not mutate the `attendees` array. *Test:* pass
  `Object.freeze([...])` and assert no throw (strict mode throws on in-place mutation of a
  frozen array).

---

## 9. Open questions for HITL

These are genuine forks the architect must resolve at Gate 2; none of them is answered by the
brief.

- **Q-1 (a11y, highest risk)** How does the badge's accessible text attach? Three options, with
  very different blast radii:
  (a) fold into the card's existing `aria-label` — **breaks every name-based query in
  `EventCard.test.tsx` and `AllDayGridRow.test.tsx`**, and those files are only partly in the
  allowlist (`AllDayGridRow.test.tsx` is **not** in it);
  (b) give the badge its own nested element with an accessible name — a nested accessible name
  inside `role="button"` may or may not be exposed depending on name-computation, and the card's
  own tests query by role;
  (c) `title` + `aria-hidden` only — **fails AC-5** (that is exactly the colour-only pattern the
  existing comment warns against).
  My recommendation: (b) with an explicit assertion that the card's own name is unchanged.
- **Q-2 (density)** What does the badge show when an event has 12 attendees on a 140px-wide,
  60px-tall card? A single roll-up dot? N dots capped at k? A count? `EventDetailsSection`
  caps at `MAX_VISIBLE_ATTENDEES = 6` with a "+N more" button, but a grid card has no room for
  that and no place to put a button.
- **Q-3 (which status)** With mixed RSVP statuses, one badge cannot show four colours. Is the
  badge per-attendee (multiple dots) or a single aggregate? If aggregate, what is the precedence
  rule, and can it be stated without inventing new product semantics?
- **Q-4 (placement)** Bottom-right is taken by `EventRepeatIcon` on both cards. Top-right
  collides with nothing today but sits over the `startDate` resize handle's 4.5px strip on
  `TimedEventCard`. The design must pick a corner and say how FR-10 and FR-11 are both satisfied.
- **Q-5 (util location)** The brief places the util at `common/utils/attendee-status.util.ts`
  (flat), but every existing sibling is in a subdirectory (`common/utils/event/`,
  `common/utils/form/`, `common/utils/grid/`, …). The flat path is what the frozen write
  contract allows, so it is what we will use — but note this is a deviation from local
  convention that a reviewer will flag. Changing it would require widening the contract, which
  this run will not do.
- **Q-6 (Gate 0 carry-over)** Gate 0 declined the byte-identity guard for no-attendee cards.
  FR-12 therefore has no enforcing test. Confirm that is still the intent, or add the guard now
  — it is much cheaper here than after codegen.
