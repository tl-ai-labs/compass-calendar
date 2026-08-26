# Delta Requirements — CMP-103 · One-click join icon on grid event cards

- **Run:** `20260825-220640-feature-extend-one-click-join`
- **Intent:** `feature-extend` (Phase 1 form: *delta requirements*)
- **Policy:** `opus-plus-sonnet` · auth_mode `estimated`
- **Branch:** `CMP-103/opus-plus-sonnet` @ `2d81253a`
- **Source brief:** `.sdlc/runs/20260825-220640-feature-extend-one-click-join/intent_brief.md`

This is a **delta** document. It records only what changes relative to the code as it
exists on this branch today, plus the invariants the change must not break. Everything
asserted below under "Verified baseline" was re-read from source or re-run in this
session — no anchor is inherited on trust from the brief.

---

## 1. Verified baseline (re-confirmed this run)

| Claim | Verified at | Status |
|---|---|---|
| `ConferenceSchema = z.strictObject({ url: z.url(), label: string\|null })` | `packages/core/src/types/event-attendance.contracts.ts:31-35` | confirmed |
| Grid event type carries conference | `packages/web/src/common/types/web.event.types.ts:88` — `conference: ConferenceSchema.nullable().optional()` | confirmed |
| View-model maps it onto card props | `packages/web/src/events/queries/event.view-model.ts:94` | confirmed |
| Draft adapter picks only `title\|description\|location\|color` | `grid-event-draft.adapter.ts:529-534, 553-560`; rationale comment at `:583-590` | confirmed |
| Timed repeat-icon gate | `TimedEventCard.tsx:116-120` (`isRecurring && !isPlaceholder && duration>=15 && width>=40`) | confirmed |
| All-day repeat-icon gate | `AllDayEventCard.tsx:76-77` (`isRecurring && !isPlaceholder && width>=60`) | confirmed |
| Repeat icon owns `absolute right-1 bottom-0.5`, `pointer-events-none`, `size={10}` | `EventRepeatIcon.tsx:15-23` | confirmed |
| All-day reserves `pr-3.5` only when `showRepeatIcon` | `AllDayEventCard.tsx:188-191` | confirmed |
| Timed resize handles `stopPropagation` on mousedown | `TimedEventCard.tsx:344-347, 355-358` | confirmed |
| All-day card always `stopPropagation`s mousedown | `AllDayEventCard.tsx:171-176` | confirmed |
| Icon convention = `getInteractiveIconClassName` | `packages/web/src/components/Icons/icon.utils.ts:3-6`, used by `Repeat.tsx:9` | confirmed |
| Existing join precedent uses `@phosphor-icons/react` `VideoCameraIcon` | `UpNextCard.tsx:87-97`, `EventDetailsSection.tsx:46-56` | confirmed |
| Cards are consumed by Week and Day without conference-specific props | `GridEvent.tsx`, `AllDayEvent.tsx`, `GridDraft.tsx`, `DayCalendarEventCards.tsx:93,180` | confirmed |
| Focused-suite baseline | `EventCard.test.tsx` + `AllDayGridRow.test.tsx` + `calendarCardIdentity.test.tsx` | **re-run this session: 30 pass / 0 fail / 78 expects / 3 files** |
| `act(...)` warnings from `TimedEventCardBase` / `AllDayEventCardBase` | observed in the run above | confirmed pre-existing noise |

Full-suite anchor (`bun test:web` = 2298 pass / 0 fail / 302 files) is carried over from
the pre-check and **has not been re-observed in this session**. It will be established as
an observed number in Phase 7, not asserted before then.

---

## 2. In scope

1. A new shared presentational component `EventJoinIcon.tsx` under
   `packages/web/src/grid/components/`, owning the join affordance for both cards so the
   two cannot drift apart — the same one-place rule `EventRepeatIcon.tsx:8-14` states.
2. Rendering that component from `TimedEventCard` and `AllDayEventCard`, gated on the
   event carrying a conference URL and on the card being in a saved (non-draft,
   non-placeholder) display state.
3. Test coverage in the existing `EventCard.test.tsx`, which already exercises both cards.

## 3. Out of scope

1. Any change to `ConferenceSchema`, the sync normalizer, the backend, or the draft adapter.
2. A join affordance on any surface other than the two grid cards.
3. Any write-path support — `conference` stays read-only and must never enter a write payload.
4. Clipboard-copy, in-app meeting modal, or provider-specific join variants.
5. Changing the existing href handling on `UpNextCard`, `EventDetailsSection`, or
   `UpNextBanner`.
6. Any merge, rebase, or cherry-pick from the three prior CMP-103 arms.

---

## 4. Functional requirements

### FR-1 — Shared join-icon component
A single `EventJoinIcon` component renders the affordance. Both cards import it; neither
card inlines its own anchor, spacing, or accessible-name logic.

### FR-2 — Visibility gate
The affordance renders **iff** the event has a non-empty `conference.url` **and** the card
is in a saved display state.

- `conference` is typed `.nullable().optional()`, so the gate must tolerate both `null` and
  `undefined`.
- Timed card: saved means `displayMode === "saved"` (excludes `"draft"` and `"placeholder"`).
- All-day card: saved means `!isPlaceholder`, mirroring the existing `showRepeatIcon` gate,
  which is the only draft signal that card has.
- Drafts carry `conference === undefined` by construction (FR-2 is therefore belt-and-braces,
  not the sole defence), and this run must not add a spread to the draft adapter that would
  change that.

### FR-3 — Link semantics
The affordance is a real link: an `<a>` with `href={conference.url}`, `target="_blank"`, and
`rel="noopener noreferrer"`. It must be discoverable as `getByRole("link", …)`.

### FR-4 — Interaction isolation (the load-bearing requirement)
Activating the affordance must not select the event, open the event form, or begin a drag.
Both cards are `mousedown`-driven. Three distinct propagation paths must be closed:

- **FR-4a — mousedown.** The affordance must `stopPropagation` on `mousedown`, the way the
  resize handles do (`TimedEventCard.tsx:344-347`). Without this, `TimedEventCard`'s root
  handler (`:303-310`) fires `onEventMouseDown` and `AllDayEventCard`'s root handler
  (`:171-176`) fires `onEventMouseDown` before the link ever activates.
- **FR-4b — keydown.** *Newly identified this run.* Both card roots handle `onKeyDown` and,
  for `Enter`/`Space`, call `e.preventDefault()` then `e.stopPropagation()` then
  `onEventKeyDown(event)` (`TimedEventCard.tsx:290-302`, `AllDayEventCard.tsx:162-170`).
  React attaches these as bubbling handlers, so a keydown originating on a focused inner
  `<a>` reaches them. Left unhandled, pressing Enter on the focused join link would both
  (i) have its default anchor activation cancelled by the card's `preventDefault`, and
  (ii) open the event form — the exact opposite of the intended behaviour, and a failure
  that a mouse-only test would not catch. The affordance must therefore stop `Enter`
  (and `Space`) from reaching the card root.
- **FR-4c — click.** Neither card has an `onClick` today, so no click-path handler exists to
  suppress; this is recorded as an invariant to re-check rather than a change to make.

### FR-5 — No collision with the repeat indicator
A recurring, conference-bearing event must show both icons, non-overlapping and both
legible. The repeat icon already owns `absolute right-1 bottom-0.5`; the all-day card
reserves `pr-3.5` for it only when `showRepeatIcon` is true. The reserved-space logic must
become correct for all four combinations of (repeat on/off × join on/off), not just the two
that exist today.

### FR-6 — Accessible name
The link's accessible name must identify which event is being joined — a bare "Join" is
insufficient when a week grid renders many cards. It should compose from the event title and,
where available, `conference.label`.

### FR-7 — Icon and styling convention
Uses `@phosphor-icons/react`'s `VideoCameraIcon` with the `getInteractiveIconClassName`
convention. No new icon dependency. **See OQ-1** — the `components/Icons/*` wrapper half of
this convention is blocked by the write contract.

### FR-8 — Pointer-target integrity
The affordance must not be occluded by, and must not occlude, the resize handles, which are
absolutely positioned at `ZIndex.LAYER_4` and span the full width (timed: 4.5px strips at
top and bottom) or full height (all-day: 4.5px strips at left and right) of the card. The
repeat icon avoids this question entirely by being `pointer-events-none`; a clickable
affordance cannot. A bottom-right placement on the timed card sits inside the `endDate`
handle's strip, and a right-edge placement on the all-day card abuts the `endDate` strip.
Placement and stacking are the architect's call; the invariant is that after this change
both resize handles remain grabbable and the join link remains clickable.

---

## 5. Non-functional requirements

- **NFR-1 — Zero layout shift when absent.** An event without a conference URL renders
  exactly as it does today: no reserved padding, no changed clamp, no changed truncation.
- **NFR-2 — Both cards, one behaviour.** Any divergence between the two cards must be
  forced by an actual structural difference (e.g. `displayMode` vs `isPlaceholder`), not by
  drift.
- **NFR-3 — Consumers untouched.** `GridEvent.tsx`, `AllDayEvent.tsx`, `GridDraft.tsx`, and
  `DayCalendarEventCards.tsx` are not edited and must keep compiling and working; both cards
  already receive the whole `event`, so no new prop is required at any call site.
- **NFR-4 — Test-convention compliance.** Per `.cursor/rules/web-testing.mdc` and `AGENTS.md`,
  new assertions use semantic queries (`getByRole("link", …)`), not the structural
  `container.querySelector('svg[class*="right-1"]')` shortcut the repeat-icon tests use.
  That shortcut is legitimate there only because the repeat glyph is `aria-hidden`; the join
  affordance is deliberately not.
- **NFR-5 — Untrusted input boundary.** `conference.url` is provider-sourced data that
  reaches a DOM sink (`href`). Zod's `z.url()` at the contract boundary establishes
  well-formedness, not that the URL is safe to place in an anchor. This requirement records
  the boundary as security-relevant so Phase 8 evaluates it on the evidence; it deliberately
  does not prescribe a mitigation here.

---

## 6. Data / PII note

No new data is collected, stored, or transmitted by this change. `conference.url` and
`conference.label` are already present in the web layer's event objects and already rendered
on two other surfaces. The delta is that the URL now also appears as an `href` attribute on
grid cards, which changes where it is *exposed in the DOM*, not what is held. Anything that
observes DOM attributes or click targets on the grid would newly observe meeting URLs.
Flagged for Phase 8; no requirement asserted here.

---

## 7. Acceptance criteria

Traceable to the brief's AC-1…AC-9; AC-10/AC-11 are additions from this analysis.

| # | Criterion | Verified by |
|---|---|---|
| AC-1 | An event with `conference.url` renders a join link on **both** cards | test |
| AC-2 | An event with no conference renders nothing new and shifts no layout | test |
| AC-3 | The link has `href` = the conference URL, `target="_blank"`, `rel="noopener noreferrer"` | test |
| AC-4 | `mousedown` on the affordance does not call `onEventMouseDown` (both cards) | test |
| AC-5 | `Enter` on the focused affordance does not call `onEventKeyDown` and is not `preventDefault`ed by the card root (both cards) | test (FR-4b) |
| AC-6 | The affordance is found by `getByRole("link", { name: … })`, and the name identifies the event | test |
| AC-7 | A recurring **and** conference-bearing event shows both icons without overlap | test |
| AC-8 | Draft and placeholder cards render no join link | test |
| AC-9 | Uses `VideoCameraIcon` from `@phosphor-icons/react` with `getInteractiveIconClassName`; no new dependency | review + `package.json` unchanged |
| AC-10 | Resize handles remain functional on both cards after the change | existing tests (`onScalerMouseDown` assertions) must still pass |
| AC-11 | `bun test:web` shows no new failures vs. the Phase 7 baseline; focused probe ≥ 30 pass / 0 fail | observed test run |

---

## 8. Open questions for HITL

### OQ-1 — FR-7's `components/Icons/*` half is outside the write contract (needs a decision)

The brief's AC-7 asks for the `components/Icons/*` **+** `getInteractiveIconClassName`
convention. `packages/web/src/components/Icons/` currently contains only
`ChevronLeftIcon.tsx`, `ChevronRightIcon.tsx`, `CircleIcon.tsx`, `Repeat.tsx`, `Sidebar.tsx`,
and `icon.utils.ts` — there is **no** `VideoCamera.tsx` wrapper. Following that convention
literally means creating `packages/web/src/components/Icons/VideoCamera.tsx`, which is **not
in this run's four-file allowlist** and would be refused by the write-contract hook.

Proposed resolution (default if you simply approve): `EventJoinIcon.tsx` imports
`VideoCameraIcon` directly from `@phosphor-icons/react` and applies
`getInteractiveIconClassName` itself. This is exactly what the two existing precedents do
(`UpNextCard.tsx:1`, `EventDetailsSection.tsx:1` both import from the package directly), keeps
the run inside its allowlist, and satisfies "no new icon library". The wrapper file can be a
follow-up if the team wants the indirection.

The alternative — widening the allowlist by one file — is available but changes the frozen
contract mid-run, and would make this arm's file count differ from the other three arms in
the A/B.

### OQ-2 — Accessible-name wording (low stakes, defaulting)

FR-6 requires the name to identify the event. Absent direction, the default will be
`Join <event title>`, falling back to `conference.label` where it adds information. Say the
word if you want a different phrasing; this is cosmetic to the architecture but is asserted
in tests, so it is cheaper to settle now.

---

## 9. Risk register

| ID | Risk | Mitigation |
|---|---|---|
| R-1 | Keydown bubbling silently defeats keyboard join (FR-4b) | Explicit AC-5 test on both cards |
| R-2 | Resize handles at `LAYER_4` steal the join click (FR-8) | Explicit AC-10; architect decides placement/stacking |
| R-3 | All-day `pr-3.5` reservation logic is only correct for the repeat icon today (FR-5) | AC-7 covers the both-icons case |
| R-4 | Provider-sourced URL reaches an `href` sink (NFR-5) | Phase 8 security review, on evidence |
| R-5 | Day view is a second consumer and is not edited (NFR-3) | Full `bun test:web` in Phase 7 |
