# Senior Code Review — feature-extend — Attendee status badge on grid event cards

Run: `20260903-000000-feature-extend-attendee-badge-sdk`
Baseline: `main@2d81253a`
Scope: the 8 files listed in `provenance.json`. Pre-existing smells in untouched files are out of
scope and are not reported.
Reviewer method: read all 8 files in full; `git diff` against `2d81253a` for the 4 edited files;
repo-wide greps for `ATTENDEE_STATUS_DOT`, the width constants, and the card render sites.

Env-fixture check (system policy line 19): **not applicable**. This is a browser package with no
validating `ConfigModule` / Joi / Zod / envalid config schema in its boot path; the run introduces
no new required env var. No `.env.example` / `.env.test` is owed.

---

## Verdict: `changes_required`

The **implementation** is sound. I looked hard for a real component bug and did not find one: the
D-7 conjunction is written correctly, the `pr-10`/`pr-14` reserve is keyed off the same flag, the
`readonly`/frozen/`undefined` paths are all safe, `ATTENDEE_STATUS_DOT` is declared exactly once,
the `EventDetailsSection` diff is genuinely import-only, and no PII reaches the DOM.

The **test suite is where this fails**. Five of the twenty appended card-level cases render a
timed card at the shared `position` fixture (140 × 60), a width at which D-7 correctly suppresses
the badge. Those tests assert properties "of a card with a badge" against a card that has no
badge. The worst of them is **C-10, the only card-level PII guard, which is now completely dead**
— exactly the failure mode flagged in the review brief.

There is also one substantive product/design question (R-6) about how much of the Week view the
D-7 threshold actually turns the feature off in, which I believe has not been costed.

None of the findings requires touching the component source. R-1..R-5 are edits to
`EventCard.test.tsx` only. R-6 needs a decision plus a browser check.

---

## Proof that the badge does not render at the shared `position` fixture

This is load-bearing for R-1..R-5, so here is the derivation, which does **not** require re-running
anything — it follows from a test in this very suite that is already green.

`EventCard.test.tsx:41-45` defines `position = { height: 60, …, width: 140 }`.
For a `futureEvent()` timed card (`TimedEventCard.tsx:129-133`):

```
showTimeLabel = !isAllDay(true) && !isInPast(true, 2099) && 60 >= 36 && 140 >= 90  →  true
```

and (`TimedEventCard.tsx:232-240`):

```
showAttendeeBadge = … && (!showTimeLabel || position.width >= 170)  →  (false || 140>=170)  →  false
```

The independent confirmation is **C-19/C-18 themselves**: `EventCard.test.tsx:1156-1186` (C-18)
asserts that at `width: 150, height: 60` with attendees present the badge is `null`, and it passes.
The gate is monotonic in width, so at `width: 140` the badge is likewise absent. Any green C-case
that renders a timed card at `position` and claims to be testing badge behaviour is therefore
testing a card with no badge.

---

## Findings

### R-1 — `blocker` — `packages/web/src/grid/components/EventCard.test.tsx:840-859` (C-10)

**The only card-level PII guard is a test that cannot fail.**

C-10 renders `TimedEventCard` at `position` (140 × 60) with
`attendee("secret@example.com", "accepted", "Ada Lovelace")` and asserts
`card.outerHTML` contains neither the email nor the display name. Per the derivation above, **no
badge is rendered in this test**, so neither string could appear regardless of what
`AttendeeBadge` does. The assertion would still pass if the badge rendered
`<span title="Ada Lovelace <secret@example.com>">` — and it would still pass if `AttendeeBadge`
were deleted from the repo.

Why it matters: PII-1 / AC-11 are the highest-consequence requirements in this delta (the change
moves attendee data from a click-to-open form onto a shoulder-surfable, screenshot-heavy surface).
`B-10` (`AttendeeBadge.test.tsx:248-265`) does genuinely guard the component in isolation, so
there is no live leak today. But C-10 is the guard on the *card* — the surface that would catch a
future `title=` or `aria-label` composition added by either card — and it is void. A dead guard on
a PII property is worse than no guard, because the AC table records it as covered.

**Fix.** Change `position={position}` to `position={badgePosition}` (line 850), and add a
positive control so the test can never silently go vacuous again:

```ts
const card = screen.getByRole("button", { name: "Timed event: Planning block, 9 - 10 AM" });
expect(card.querySelector(`[${ATTENDEE_BADGE_ATTRIBUTE}]`)).not.toBeNull(); // control
expect(card.outerHTML).not.toContain("secret@example.com");
expect(card.outerHTML).not.toContain("Ada Lovelace");
```

Then repeat the whole assertion block against `AllDayEventCard` at `position` (the all-day gate is
140 with no time-label conjunct, so the badge does render there), so both card surfaces are
covered.

---

### R-2 — `major` — `packages/web/src/grid/components/EventCard.test.tsx:775-801` (C-8)

**AC-10 is unproven for the timed card — the case that actually matters.**

C-8 ("resize handles survive a badge on timed card") renders at `position`, so no badge exists.
The `toHaveLength(2)` and the two `mouseDown` assertions are true of the pre-change component and
would pass with `AttendeeBadge` deleted.

This is the one card where the risk is real. On `TimedEventCard` the badge is **absolutely
positioned** at `bottom-0.5 / right-1|right-4` (`TimedEventCard.tsx:401-411`), directly over the
`endDate` scaler strip (`scalerStyle({ bottom: "-0.25px" })`, 4.5px, `width: 100%`,
`ZIndex.LAYER_4`). D-4's `pointer-events-none` is the only thing keeping it out of
`elementFromPoint`, and the repo already has a documented, unrelated `endDate` hit-testing
weakness on ~30% of cards. On `AllDayEventCard` the badge is inline, not overlapping — so C-9,
which *is* live, guards the easy case and C-8 guards nothing on the hard one.

**Fix.** `position={badgePosition}` at line 786, plus the same `expect(badge).not.toBeNull()`
control before the handle assertions. Note that `fireEvent.mouseDown(handles[i])` dispatches
directly at the node and does not exercise hit-testing at all; if AC-10 is meant to mean "the
handle is reachable by a real pointer", the only honest evidence is a browser check (see R-6's
note on manual verification), and the AC table should say so rather than claim `fireEvent` proves
it.

---

### R-3 — `major` — `packages/web/src/grid/components/EventCard.test.tsx:660-679` (C-4)

**AC-9's with-a-badge case is vacuous for the timed card.**

C-4 is titled "card name unchanged with a badge present" and renders at `position` — no badge.
It asserts the `aria-label` string that 11 other pre-existing tests in this file already assert on
badge-less cards, so it adds no information. The entire point of C-4 (per NFR-2 / R-1 of the plan)
is to prove that adding `aria-describedby` + an `sr-only` descendant does not perturb the card's
accessible **name**; with no badge and no `aria-describedby` on the root, it proves nothing.

The all-day analogue C-5 (`:681-699`) *is* live (all-day badge renders at 140), so the risk is
partially covered — but the timed card is where the badge is a sibling of the content wrapper
rather than inline, which is a different DOM shape for name computation to walk.

**Fix.** `position={badgePosition}` at line 668, plus
`expect(card).toHaveAttribute("aria-describedby")` as the control that proves the badge and its
description wiring are actually present while the name is unchanged.

---

### R-4 — `minor` — `EventCard.test.tsx:701-733` (C-6), `:899-930` (C-13 timed half), `:932-972` (C-14 timed half)

**Three more non-discriminating cases from the same root cause.**

- **C-6** (`:701-733`) — timed `attendees: undefined` / `[]` at `position`. The badge is suppressed
  by width before `hasAttendeesToShow` is ever consulted, so C-6 would pass if the empty-list guard
  in `AttendeeBadge.tsx:97` were removed. AC-6 for the timed card survives only because **C-16
  steps 2-3** (`:1039-1061`) run the same two shapes at `badgePosition` and compare `innerHTML`.
  That is real coverage — but it lives in a test named "byte-identity guard", not in the test named
  after AC-6.
- **C-13 timed half** (`:899-913`) — `width: 90, height: 60` still yields `showTimeLabel === true`,
  so D-7 suppresses the badge on its own. This half cannot detect deletion of
  `MIN_EVENT_WIDTH_FOR_ATTENDEE_BADGE`. Only the all-day half (`:916-929`) isolates the 140 floor.
- **C-14 timed half** (`:938-951`) — the frozen array never reaches `attendees.slice(...)` because
  the badge does not render, so the timed half of the AC-12 evidence is inert. The all-day half and
  `B-7`/`B-8` do cover it.

**Fix.** C-6 and C-14: `badgePosition`. C-13: keep the `width: 90` case, and add a timed case at
`{ width: 139, height: 30 }` (label off, below the floor → absent) paired with
`{ width: 140, height: 30 }` (present). That pins the 140 boundary on the timed card, which
nothing currently does in either direction.

---

### R-5 — `major` — `EventCard.test.tsx:597` and the appended block generally

**Structural fix: nothing in the appended suite forces a "badge present" precondition, which is
why R-1..R-4 all happened at once and went undetected through a green run.**

The defect log in `change_plan.md:889-902` records that D-7 was added at Gate 2 without
reconciling the pre-existing C-cases, and that the repair was `const badgePosition = { ...position,
width: 190 }`. The repair was applied to C-1, C-3, C-11, C-15 and C-16 — the five cases whose
assertions *fail loudly* when the badge is absent. It was not applied to C-4, C-6, C-8, C-10 or
C-14 — the five cases whose assertions *pass silently* when the badge is absent. That is not a
coincidence; the repair was driven by the red suite rather than by the list of cases the new
threshold affected, so it converged exactly on the cases that could complain. **The fix did not
paper over a component bug — the component is right — but it did stop one step short, and the
stopping point was determined by what the runner reported rather than by what D-7 changed.**

**Fix.** Add a shared helper next to `badgeDescriptionOf` (`:590-595`) and call it first in every
case that claims to be about a card with a badge:

```ts
const expectBadge = (card: HTMLElement) => {
  const badge = card.querySelector(`[${ATTENDEE_BADGE_ATTRIBUTE}]`);
  expect(badge).not.toBeNull();
  return badge as HTMLElement;
};
```

Applied to C-1, C-3, C-4, C-8, C-10, C-11, C-14, C-15, C-19 and C-20 this makes the whole class of
defect impossible: any future change to a width gate turns the affected tests red instead of
green-and-meaningless.

---

### R-6 — `major` — `packages/web/src/grid/components/AttendeeBadge.tsx:59` (D-7 threshold) — needs a decision, not just a code change

**On the Week view the badge is suppressed on effectively every non-overlapping timed card, on any
window narrower than a wide desktop. I do not think this reach cost was computed at Gate 2.**

Card width for a timed event (`grid/layout/event.position.ts:53`) is:

```
cardWidth = columnWidth * widthMultiplier - TIMED_EVENT_COLUMN_INSET * 2   // inset*2 = 10px
```

and column width (`views/Week/util/week-window.util.ts:15-22`) is
`(trackWidth - GRID_MARGIN_LEFT) / visibleDayCount` with
`visibleDayCount = clamp(floor((trackWidth - 50) / 140), 1, 7)`.

For a non-overlapping event (`widthMultiplier = 1`) to clear the 170px D-7 gate you need
`columnWidth >= 180`, i.e.:

| visibleDayCount | required trackWidth | but that trackWidth actually yields |
|---|---|---|
| 7 | ≥ 1310px | 7 columns — reachable, but only above ~1310px of grid track |
| 6 | ≥ 1130px | ≥ 1030px already snaps to **7** columns → column 154px → card 144px → suppressed |
| 5 | ≥ 950px | ≥ 890px already snaps to 6 columns → card < 153px → suppressed |

Because `visibleDayCount` increases the moment the track can afford another 140px column, the
column width is pinned into the 140–180px band for every track width below ~1310px. The grid track
is the window minus the (user-resizable, persisted) sidebar. On a 1440px laptop with a ~250px
sidebar the track is ≈ 1190px → 7 columns → column ≈ 163px → **card ≈ 153px → no badge on any
timed Week card**. Day view is unaffected (one column, cards are wide); the all-day row is
unaffected (gate stays at 140, no time-label conjunct); overlapping events are worse still
(`widthMultiplier` ≈ 0.5 puts them below even the 140 floor).

So the shipped behaviour is plausibly: *the badge works in Day view and on all-day rows, and is
invisible for timed events in Week view at the window size most people use.* That may be an
acceptable trade — D-7's reasoning that "when only one fits, the one with no alternative wins" is
correct — but it should be a stated, measured trade, and right now the plan states the opposite
impression ("three distinct timed-card regimes", `change_plan.md:847-849`) without noting that one
of those regimes swallows the whole default Week layout.

> **CORRECTION (recorded at Gate 3, after this review was written).** "Invisible for timed events in
> Week view" / "no badge on any timed Week card" **overstates it, and the correction matters.** The
> predicate is
> `!isPlaceholder && !isCompactEvent && width >= 140 && (!showTimeLabel || width >= GATE) && hasAttendeesToShow`,
> and `showTimeLabel` itself additionally requires `height >= MIN_EVENT_HEIGHT_FOR_TIME_LABEL (36)`
> and a non-past event. So at a ~163px column the badge **did** still render on cards under 36px tall
> (a 30-minute event at typical zoom) and on past events; it was hidden only on ≥36px-tall future
> events. The real defect was therefore **inconsistency within a single column** — a 30-minute
> meeting showing a badge while the 60-minute meeting below it did not — rather than total absence.
> That is a sharper argument for changing the gate than the original wording, not a weaker one.
>
> **Resolved at Gate 3:** the user chose to lower the threshold. It is now **150**, derived from the
> common same-meridiem label (~85px worst case) instead of the ~108px cross-meridiem outlier. See
> `change_plan.md` decision **D-7a** for the derivation, the new band table, and the accepted
> clipping trade. New case **C-21** pins the 163px column with a time label showing, and the whole
> suite was re-mutation-tested after the change (12 failures with the badge disabled, C-10 included).

Two sub-points that make the 170 look over-conservative:

1. **170 is derived from the worst-case label, and applied to every label.** The derivation
   (`AttendeeBadge.tsx:36-57`) uses `"11:30 AM - 12:45 PM"` ≈ 108px, which only occurs when the
   range crosses the meridiem *and* both halves have minutes — `_cleanStartMeridiem`
   (`common/utils/datetime/web.date.util.ts:277-284`) strips the start meridiem whenever both
   match, so the common label is `"9 - 10 AM"` ≈ 55px. The threshold for that label would be
   5 + 55 + 56 = **116px**, i.e. below the badge's own 140 floor — the conflict would not exist at
   all. The component already has the actual label in hand (`timeRange`, `TimedEventCard.tsx:280`),
   so the gate could be `position.width >= 5 + reserve + estimateLabelWidth(timeRange)` or, more
   cheaply, a two-valued threshold keyed on whether `timeRange` contains two meridiems.
2. **The stated regression is partly pre-existing.** D-7 says a 140–170px card "renders correctly
   today" (`change_plan.md:828-830`). It does not: `MIN_EVENT_WIDTH_FOR_TIME_LABEL` is 90, so a
   ~108px long label is already clipped today on cards from 90px to ~113px wide, with no badge
   involved. The decision to yield is still right; the recorded justification overstates it on a
   checkable fact and should be corrected so a future reader does not treat 170 as load-bearing.

**Fix.** (a) Verify in the running app what a Week column measures at the team's standard window
size and record it — this run has **no manual/browser verification** on record, and this is
precisely the kind of "green in tests, invisible in the app" gap that a suite run cannot see.
(b) If the badge is indeed dark in Week view, replace the constant threshold with the
label-derived one in (1). (c) Correct the D-7 rationale per (2).

---

### R-7 — `minor` — `packages/web/src/grid/components/AttendeeBadge.tsx:31` (the 140 constant)

The comment spends 12 lines arguing, correctly, why `MIN_EVENT_WIDTH_FOR_ATTENDEE_BADGE` is *not*
`DAY_COLUMN_MIN_USABLE_WIDTH` — a column is not a card, `widthMultiplier` divides one into the
other, and coupling the badge's legibility to `week-window.util`'s column-count arithmetic would
be real coupling. **I accept that argument**; the two quantities are genuinely different and the
duplication is defensible.

What the comment never does is derive **why 140**. Contrast the 170 constant immediately below it,
which shows its arithmetic term by term. 140 is asserted ("the badge costs up to 56px of reserved
right padding, which is unaffordable on a very narrow card") — but 56px of reserve is equally
unaffordable at 150 and affordable at 130 for all the comment shows. The result is that a reader
who notices the collision with `DAY_COLUMN_MIN_USABLE_WIDTH = 140` is told at length that it is
"not drift" without being shown the independent derivation that would prove it.

**Fix.** Add the one-line derivation (e.g. "content column must retain ≥ 84px ≈ 13 chars of
`text-xs` title after the worst-case `pr-14`: 140 − 5 − 56 = 79px" — note that arithmetic gives
79, not 84, so state the real target), or say plainly "chosen by eye, not derived" and drop the
"not drift" claim to a one-liner.

---

### R-8 — `minor` — `packages/web/src/grid/components/AllDayEventCard.tsx:215-222`; test gap

Two small things on the all-day integration:

1. **`shrink-0` is missing.** D-3 (`change_plan.md:708-710`) specifies "inline `shrink-0` element
   in the existing content flex row". The rendered root is
   `pointer-events-none inline-flex items-center gap-0.5` + `ml-1`
   (`AttendeeBadge.tsx:107-112`) with no `shrink-0`. It works today only because a flex item's
   default `min-width: auto` resolves to min-content and every descendant dot carries `shrink-0`,
   so the badge cannot compress. That is an implicit dependency: adding `overflow-hidden` to the
   badge root, or any wrapper, would silently collapse it next to a long title. Add `shrink-0` to
   the root's base class list — it is free and it makes the invariant explicit.
2. **No test covers all-day badge + repeat icon together.** C-11 (`:861-880`) asserts the
   non-collision only on the timed card. On the all-day card the badge is inline *inside* the
   `pr-3.5` wrapper that reserves room for the icon, which is a different mechanism and worth one
   assertion: a recurring all-day event with attendees at `width >= 140` → both
   `svg[class*="right-1"]` and `[data-attendee-badge]` present.

---

### R-9 — `nit` — `packages/web/src/grid/components/EventCard.test.tsx:599`

C-1's title reads `"C-1: timed card, 1 accepted attendee, position (140x60)"` but the test renders
at `badgePosition` (190 × 60). The name is a leftover from before the D-7 repair and now actively
misleads: it documents exactly the width at which the feature is off. Rename to `(190x60)`. The
same stale-name check is worth running over C-4/C-6/C-8/C-10/C-14 once R-1..R-4 land.

---

### R-10 — `nit` — `packages/web/src/grid/components/AttendeeBadge.tsx:64-66`, `:16`, `:31`, `:59`

Placement / typing housekeeping, all defensible, none blocking:

- `hasAttendeesToShow` is a pure type-predicate on a domain type living in a `.tsx` component
  file, imported by two other components. The predicate itself is sound
  (`(attendees?.length ?? 0) > 0` does imply `attendees is readonly Attendee[]`), but neither call
  site exploits the narrowing — both use it as a plain boolean, and `AttendeeBadgeProps.attendees`
  accepts `| undefined` anyway. It could be a plain `boolean` return, or move to
  `common/utils/attendee-status.util.ts` next to the other attendee helpers.
- The two `MIN_EVENT_WIDTH_FOR_*` constants are card-layout gates; every sibling gate
  (`MIN_EVENT_WIDTH_FOR_TIME_LABEL`, `COMPACT_EVENT_MAX_HEIGHT`, `EVENT_WIDTH_MINIMUM`) lives in
  `grid/grid.constants.ts`. There is local precedent for card-local constants
  (`REPEAT_ICON_MIN_WIDTH`, declared *twice*, once in each card) so this is not a violation — but
  `grid.constants.ts` is where a reader will look.
- `common/utils/attendee-status.util.ts` is flat while every sibling is in a subdirectory
  (`event/`, `form/`, `grid/`, `datetime/`…). Requirements Q-5 already predicted this flag and
  recorded that the frozen write contract forced it. Recording it here so it is not lost: this
  should move to `common/utils/event/` in a follow-up.
- `key={attendee.email}` is fine — `AttendeeSchema.email` is `min(1)` and required, so no empty
  keys — but two identical emails on one event would produce a duplicate-key warning. Not worth
  changing.

---

## Things I checked and found correct

Recording these so the next reviewer does not re-derive them.

- **AC-3, exactly one declaration.** `grep -rn "ATTENDEE_STATUS_DOT" packages/` returns 7 hits, of
  which exactly one is a declaration: `attendee-status.util.ts:11`. The other six are imports
  (`AttendeeBadge.tsx:5`, `EventDetailsSection.tsx:5`, the util test) and uses
  (`AttendeeBadge.tsx:117`, `EventDetailsSection.tsx:79`, test `:11`). Clean.
- **AC-4, `EventDetailsSection` is import-only.** The diff removes the two declarations and the
  now-unused `AttendeeResponseStatus` type import, adds one import statement. **Zero JSX lines
  changed** — the two call sites at `:69` and `:79` are untouched, including the existing
  `title={statusText}` tooltip. `git diff --name-only 2d81253a` confirms `EventForm.test.tsx` was
  not modified, which is the enforcement AC-4 relies on.
- **D-7 is a conjunction, not a raised floor.** `TimedEventCard.tsx:232-240` reads
  `… && (!showTimeLabel || position.width >= MIN_EVENT_WIDTH_FOR_BADGE_WITH_TIME_LABEL) && …`.
  C-18/C-19/C-20 pin 150/170/150 exactly as specified, and C-20 (`:1209-1223`) uses
  `height: 30` — below `MIN_EVENT_HEIGHT_FOR_TIME_LABEL` (36) but above `COMPACT_EVENT_MAX_HEIGHT`
  (15) — so it genuinely fails if the floor were raised to 170 instead. C-19 at exactly 170 is a
  real sensitivity control on the *same* long cross-meridiem event as C-18. This trio is the
  best-constructed part of the suite.
- **The reserve is keyed off the same flag.** `TimedEventCard.tsx:356-359`:
  `{"pr-10": showAttendeeBadge && !showRepeatIcon, "pr-14": showAttendeeBadge && showRepeatIcon}`.
  A suppressed card gets neither, so it keeps its full content column, and C-18(c) asserts the
  wrapper class is byte-exact `"flex flex-col flex-wrap items-start"` in the suppressed band. This
  is the assertion that catches "hide the dots but keep the reserve", and it is live.
- **C-16 / C-17, all seven D-6 steps present, including step 7.** C-16 (`:1004-1076`) runs steps
  1-3 (missing-key baseline / `undefined` / `[]` innerHTML equality), 4 (root attribute-name set
  === the 5-element sorted array — this is what fails if `aria-describedby` leaks), 5 (exact
  content-wrapper class), 6 (baseline free of `data-attendee-badge` / `aria-describedby` /
  `sr-only`), and 7 (one attendee ⇒ `innerHTML !== baseline`). **All four renders in C-16 use
  `badgePosition`; all four in C-17 use `position`** — the baseline and the sensitivity control
  share a position in both, so the comparison is meaningful. Without that the whole guard would be
  vacuous, and this is the one place the run got the position discipline right.
- **A11y (D-1).** `aria-describedby={showAttendeeBadge ? id : undefined}` on both roots
  (`TimedEventCard.tsx:307`, `AllDayEventCard.tsx:161`); neither `aria-label` expression is in any
  hunk. The reasoning is correct: name computation (`aria-labelledby` → `aria-label` → content)
  never consults `aria-describedby`, and an IDREF description is computed from the referenced
  subtree independently of the `button` children-presentational prune. Choosing `describedby` over
  a nested `role="img"` name is the right call *specifically because* `dom-accessibility-api` does
  not implement the prune and would have produced a green test for a feature invisible to real AT.
  All 11 pre-existing accessible-name queries are untouched (append-only diff, 0 deletions) and the
  suite is green. Caveat: this remains unverified against a real screen reader — see R-6(a).
- **`readonly` / frozen / `undefined`.** `AttendeeBadge.tsx:97` early-returns on empty;
  `:102` uses `slice()` which copies; nothing sorts, splices or reverses. `attendeeStatusSummary`
  (`attendee-status.util.ts:44-60`) only iterates and reads `.length`. B-7/B-8/U-8 and the all-day
  half of C-14 exercise the frozen path. No mutation anywhere.
- **`MAX_VISIBLE_ATTENDEE_DOTS` vs the slice, and the `+N` arithmetic.**
  `visibleAttendees = attendees.slice(0, 3)`; `overflowCount = attendees.length -
  visibleAttendees.length` — computed from the *slice*, not from the constant, so it is 0 (not
  negative) for lists shorter than the cap, and `overflowCount > 0` gates the counter. Correct.
  C-15 (12 attendees → 3 dots + `+9`, description reports all 12) and B-5 both pin it.
- **PII in practice.** The rendered DOM carries: `data-attendee-badge="true"` (a literal), four
  semantic color class names, an integer, and a counts-only sentence. No `displayName`, no `email`,
  no `title`, no telemetry. D-5's decision to decline the `displayName ?? email` permission that
  PII-2 grants is stricter than required and correctly justified (the `sr-only` text lands in every
  `prettyDOM` dump, and a grid renders dozens of cards). B-10 and U-9 are live guards on this.
- **`darken(baseColor, 30)`** for the `+N` counter matches `EventRepeatIcon.tsx:19` exactly — same
  helper, same amount. Not a duplicated magic number so much as a deliberately matched one.
- **R-8 of the plan (drag-ghost duplicate ids) holds.**
  `interaction/dom/draft-event.clone.ts:6-12` strips `id` **and** `aria-describedby` from the clone
  and every descendant. Verified directly.
- **R-7 of the plan (non-allowlisted tests) holds.** Only two test files render either card:
  `EventCard.test.tsx` (allowlisted) and `calendars/calendarCardIdentity.test.tsx` (no `attendees`
  fixtures). The intersection really is empty.
- **The +40 arithmetic reconciles.** 9 (U-1..U-9) + 11 (B-1..B-11) + 20 (C-1..C-20) = 40 new cases,
  and 2337 − 2297 = 40 across 304 − 302 = 2 new files. The measured numbers are internally
  consistent; no silently skipped test.

---

## AC-by-AC verdict

| AC | Requirement | Verdict | Evidence / gap |
|---|---|---|---|
| **AC-1** | Timed card with attendees renders the badge | **pass** | C-1 at `badgePosition` (190×60); assertion is discriminating |
| **AC-2** | All-day / multi-day card renders the same badge | **pass** | C-2 at 140; the all-day gate has no label conjunct |
| **AC-3** | `ATTENDEE_STATUS_DOT` declared exactly once | **pass** | Verified by grep: sole declaration at `attendee-status.util.ts:11` |
| **AC-4** | `EventDetailsSection` renders identically | **pass** | Diff is import-only, zero JSX change; `EventForm.test.tsx` unmodified and green |
| **AC-5** | RSVP signal is not colour-only | **pass** | C-3 and C-15 assert the full `aria-describedby` → id → `textContent` chain; B-6 at component level. Dots are `aria-hidden` with an `sr-only` equivalent |
| **AC-6** | `undefined` / `[]` render nothing, no throw | **pass (with note)** | All-day covered live by C-7; timed covered by **C-16 steps 2-3**, not by C-6 — C-6 itself is non-discriminating (R-4) |
| **AC-7** | No new failures vs 2297/1/1 | **pass** | 2337/1/1 across 304 files; +40 = exactly the 40 new cases; the 1 failure is the pre-existing `RecurrenceSection` date-rot. Correctly reported as a delta, not as "green" |
| **AC-8** | `bun lint` passes, `check-semantic-colors.ts` included | **pass (with note)** | `check-semantic-colors.ts` passes; `biome check` clean on all 8 files and 0 errors self-hosted. **Whole-repo `bun lint` does fail**, on `.sdlc/**` JSON run artifacts only — no source file. As literally worded the AC is not met; as intended it is |
| **AC-9** | Every pre-existing accessible-name query still resolves | **partial** | The 11 untouched queries pass (append-only, 0 deletions). All-day with-a-badge covered by C-5. **Timed with-a-badge is vacuous (C-4, R-3)** |
| **AC-10** | Both resize handles survive on a card with a badge | **partial** | All-day covered live by C-9. **Timed is vacuous (C-8, R-2)** — and timed is the card where the badge overlaps the `endDate` strip. Also note `fireEvent.mouseDown` bypasses hit-testing entirely |
| **AC-11** | No attendee email in always-visible card text | **fail (as evidenced)** | Component level is genuinely guarded by B-10/U-9 and there is no live leak. **The card-level guard C-10 cannot fail (R-1, blocker)** |
| **AC-12** | Badge does not mutate `attendees` | **pass** | B-7, B-8, U-8, and the all-day half of C-14. Timed half of C-14 is inert (R-4) but not needed |
| **AC-13** | Byte-identity guard for no-attendee cards | **pass** | C-16/C-17 implement all seven D-6 steps; step 7's sensitivity control is present and, critically, uses the same position as the baseline in both cards |

**Summary:** 9 pass (2 with notes), 2 partial, 1 fail, plus one design question (R-6) that no
acceptance criterion covers because the run has no browser verification on record.

To reach `pass_with_notes`: land R-1 (blocker), R-2 and R-3 (major), and R-5's `expectBadge`
helper so the class of defect cannot recur. R-6 needs a recorded measurement from the running app
and either a threshold change or an explicit "yes, Week view timed cards are out of scope at
default window sizes" ruling. R-4 and R-7..R-10 can be follow-ups.
