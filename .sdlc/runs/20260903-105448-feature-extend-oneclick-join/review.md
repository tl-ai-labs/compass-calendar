# Senior Code Review — `20260903-105448-feature-extend-oneclick-join`

Reviewed at working tree on branch `CMP-103/opus-plus-flash-v37-sdk`, base `2d81253a`.
Scope: the 11 paths in `provenance.json` only. `.sdlc/**` treated as bookkeeping and ignored.

I re-derived nothing that was already verified except where noted; where I did re-derive, it is
called out as **[verified independently]**.

---

## 1. Verdict

**`request_changes`**

The architecture is right and the hard part — the sibling-not-descendant resolution — is correct,
well-argued, and I could not break it. The blast-radius analysis in `design.md` §3.4 holds up
under inspection; I checked every claim in it and found no counterexample.

What blocks merge is narrower and concrete:

- one shipped layout defect (F-1) caused by a stale number in `design.md` that was copied verbatim
  into `TimedEventCard.tsx`;
- one e2e spec that is very likely broken on first execution for a structural reason the design
  itself predicts (B-1);
- three invariants the design explicitly declares load-bearing that no test pins (F-3, F-4, F-5).

None of these require rethinking the approach. B-1 and F-1 are the only two I would insist on
before merge; the rest are cheap and I would take them in the same pass.

---

## 2. Blockers

### B-1 — The timed e2e spec seeds a 4-card deck and will fail its own `joinLink.click()`

`e2e/timed/event-join.spec.ts:22-46`

The spec seeds three timed events at the identical slot `10:00Z–11:00Z`. The demo seed already
ships **"Try Compass" at today 10:00–11:00 local** (`demo-data-seed.ts:173-179`), and the demo data
is present on every e2e run (`prepareCalendarPage` deletes the DB, the reload re-seeds, and the
spec's own seeding happens after that). So the overlap group is **four**, not three.

That group becomes a fanned deck. Working the layout through:

- `createTimedEventLayout` (`timed-deck.layout.ts:41-48`) groups all four and assigns
  `deckLayout = { order, groupSize: 4 }`.
- `applyTimedDeckPositionWithIndent` (`timed-deck.layout.ts:82-101`) with
  `TIMED_EVENT_FAN_INDENT = 44`: for a ~148px week column, `getDeckIndent` returns
  `min(44, (148-72)/3) = 25.3`, `fanned = 148 - 24 - 76 = 48`, and the width floors at
  `DECK_MIN_WIDTH = 72`.
- Card *i* therefore occupies `x ∈ [L + 25.3i, L + 25.3i + 72]`; card *i+1* starts 25.3px later
  and extends to `L + 25.3i + 97`. Card *i+1* **fully covers** `[L + 25.3i + 25, …]`.
- The join anchor for card *i* sits at `left = position.left + position.width - 2 - 24`
  (`EventJoinIcon.tsx:108-109`), i.e. `x ∈ [L + 25.3i + 46, L + 25.3i + 70]` — entirely inside the
  region card *i+1* covers.
- Stacking: card *i*'s `position.zIndex = order + 1`, so its anchor takes `order + 2`
  (`EventJoinIcon.tsx:116`). Card *i+1*'s z is `(order+1) + 1 = order + 2`. **Equal.** Paint order
  falls to DOM order.

`design.md` §3.4 item 3 states this outcome deliberately: *"A deck card stacked above its neighbour
still paints over that neighbour's join control (equal z, later in DOM order), which is the desired
behaviour."* It is the desired product behaviour. It is fatal to this spec.

Which card ends up on top is **nondeterministic**: `orderBackgroundFirst`
(`timed-deck.layout.ts:199-204`) sorts by `start` then by `end` descending; all four events tie on
both, so `Array.prototype.sort` stability falls back to store iteration order, which is keyed on
randomly generated hex ids (`event-test-utils.ts:384-389`). The join event is last — and therefore
clickable — roughly one run in four.

`await expect(joinLink).toBeVisible()` at `:55` still passes (Playwright visibility ignores
occlusion), so the spec gets all the way to `joinLink.click()` at `:74` before failing with
"element intercepts pointer events", which reads as a feature bug rather than a fixture bug.

**Fix.** Give each seeded event its own non-overlapping slot, and pick slots the demo seed does not
occupy. Demo events sit at today 09:00–09:30, 10:00–11:00, 12:00–13:00, 14:00–14:30, 15:00–15:30,
17:00–18:00 (`demo-data-seed.ts:132-235`). `06:00–07:00`, `07:00–08:00`, `08:00–09:00` are clear.
Keeping the events non-overlapping also removes the deck entirely, so each card gets the full
column width and the `JOIN_ICON_MIN_WIDTH = 60` gate stops being load-bearing for the spec.

### B-2 — `TimedEventCard`'s title reserve is 3px short of the control it is reserving for

`packages/web/src/grid/components/TimedEventCard.tsx:361-362`

```tsx
"pr-5": showJoinIcon && !showRepeatIcon,   // 20px
"pr-9": showJoinIcon && showRepeatIcon,    // 36px
```

The control occupies `rightInsetPx + JOIN_CONTROL_SIZE_PX` measured from the card's right edge:
`2 + 24 = 26px` alone, `16 + 24 = 40px` with the repeat glyph. The content div already sits 3px in
from the root's `pr-0.75`, so the effective reserve is **23px** and **39px** — short by 3px and 1px
respectively. A wrapping title runs under the join control, which is precisely what NFR-6 forbids
and what the design's own OQ-1 reasoning ("a control that overlaps the title is an accessibility
problem in its own right") set out to prevent.

`AllDayEventCard.tsx:219-220` gets the same geometry right — `pr-6` (24) and `pr-10` (40), plus the
same 3px root padding — so the two cards are inconsistent for identical geometry.

Root cause is F-11 below: `design.md` §5.1 still specifies the control as **20px** and its
`pr-5`/`pr-9` numbers are correct for a 20px control. `JOIN_CONTROL_SIZE_PX` was raised to 24 in
`EventJoinIcon.tsx:15` for the axe `target-size` reason, and the timed card's padding was never
brought along. The all-day card was.

**Fix.** `pr-5` → `pr-6`, `pr-9` → `pr-10` in `TimedEventCard.tsx:361-362`, matching
`AllDayEventCard.tsx:219-220`. Correct §5.1 and §3.4 of `design.md` in the same change.

---

## 3. Findings

### F-1 (high) — AC-3 layer 1 has zero automated coverage, and the host test files already exist

`packages/web/src/grid/interaction/dom.ts:55-61`,
`week-interaction.adapter.ts:492-494`, `day-interaction.adapter.ts:443-445`

The pointer-path bail is the half of AC-3 that `stopPropagation` structurally cannot do, and it is
completely untested. The brief framed this as "no adapter test file is on the allowlist", which
implies none exists. That is not the case:

```
packages/web/src/views/Week/interaction/adapter/week-interaction.adapter.test.ts
packages/web/src/views/Day/interaction/adapter/day-interaction.adapter.test.ts
packages/web/src/views/Week/interaction/adapter/week-interaction.timed-drag.test.ts
… and four more sibling suites
```

Well-established adapter suites exist and would have hosted a three-line case each. There is also no
`packages/web/src/grid/interaction/dom.test.ts`, so `isJoinControlTarget` itself — a pure function
over a `Pick<PointerEvent, "target">`, trivially testable with a detached DOM node — has no unit
test either. The write contract was widened 8 → 10 at Gate 0 and again to 11 for
`event-test-utils.ts`; the adapter tests were never asked for.

Net: the only thing exercising layer 1 anywhere is `joinLink.click()` in two **unexecuted** specs,
one of which is B-1.

**Fix.** Follow-up ticket FU-1. `isJoinControlTarget` needs three cases (target inside the anchor,
target on the child SVG resolving through `closest()`, target on the card root returning false), and
each adapter needs one case asserting `getInteractionTarget` returns `null` for a pointerdown whose
target carries `EVENT_JOIN_CONTROL_ATTRIBUTE`.

### F-2 (high) — the `>= 30` duration gate is declared load-bearing and pinned by nothing

`packages/web/src/grid/components/TimedEventCard.tsx:71-75, 147`

Both the source comment and `design.md` §6 OQ-1 state in bold that this comparison must stay
inclusive, because the demo "Morning standup" is *exactly* 30 minutes (`demo-data-seed.ts:137-138`,
`todayAt(9,0)` → `todayAt(9,30)`) and is the only conference-bearing event in the seed — so
tightening the gate silently removes the join control from the untouched
`e2e/accessibility/app-a11y.spec.ts` week-view scan **[verified independently]** and from the timed
spec's ambient fixture.

The tests do not pin it. The only duration case is a 15-minute negative
(`EventCard.test.tsx:666-685`); every positive uses the 60-minute default fixture
(`EventCard.test.tsx:23,33`). Changing `>=` to `>`, or `30` to `31`, or to `45`, leaves
`bun run test:web` fully green.

**Fix.** Add a positive case at exactly 30 minutes (`09:00:00.000Z` → `09:30:00.000Z`) next to the
15-minute negative, with a comment naming the demo standup so the next reader knows why the boundary
is not arbitrary.

### F-3 (high) — the "blocked scheme" e2e assertions pass for the wrong reason

`e2e/timed/event-join.spec.ts:60-62`, `e2e/allday/event-join.spec.ts:68-70`

```ts
await expect(
  grid.getByRole("link", { name: `Join ${blockedTitle}` }),
).toHaveCount(0);
```

This asserts the join link is absent but never asserts the blocked event's **card** is present. If
the seeded record is malformed, dropped on read, laid out off-screen, or positioned into a zeroed
column, the count is 0 and the test passes green having proved nothing about AC-9 — the single most
security-relevant acceptance criterion in the change.

I confirmed the record *does* survive today: `ConferenceSchema.url` is `z.url()`
(`event-attendance.contracts.ts:31-34`), and I ran zod against the installed version — `z.url()`
**accepts** `"javascript:alert(1)"` and `"data:text/html,<script>"` **[verified independently]**.
So the threat AC-9 addresses is real and the record parses. The assertion is still structurally
unfalsifiable and would not notice if that changed.

The same applies to the `controlTitle` assertion two lines below in each spec.

**Fix.** Precede each with `await expectTimedEventVisible(page, blockedTitle)` /
`await expectAllDayEventVisible(page, blockedTitle)`, and likewise for `controlTitle`. Two lines per
spec, and it converts three dead assertions per spec into live ones.

### F-4 (medium) — the sibling-not-descendant invariant has no unit guard

`packages/web/src/grid/components/EventCard.test.tsx:576-843`

This is the central structural decision of the change (`design.md` §3, the whole of it), and the
reason the cards now return fragments. Nothing in the bun suite asserts it. A future refactor that
nests the anchor back inside the card root would keep all 43 new tests green and only surface in the
axe scan — which has never been executed, and which the all-day spec deliberately does not carry
(F-6).

I grepped: `EventCard.test.tsx` contains no `contains(`, no `closest(`, no `style.left`.

**Fix.** One assertion per card type:

```ts
const card = screen.getByRole("button", { name: /Planning block/ });
const link = screen.getByRole("link", { name: "Join Planning block" });
expect(card.contains(link)).toBe(false);
```

This is accessibility-tree-sourced on both sides (NFR-2 satisfied) and would have caught the exact
class of regression the design spends four pages preventing.

### F-5 (medium) — the repeat/join non-collision test cannot fail on the property it names

`packages/web/src/grid/components/EventCard.test.tsx:724-745`

"keeps the repeat icon visible when both repeat and join icons show on a timed event" asserts only
that both elements exist. It never checks that the join control moved left by
`JOIN_CONTROL_REPEAT_CLEARANCE_PX`. Deleting the `rightInsetPx={showRepeatIcon ? … : undefined}`
prop from `TimedEventCard.tsx:411-413` **and** `AllDayEventCard.tsx:260-262` leaves the suite green
while the two glyphs sit on top of each other. `EventJoinIcon.test.tsx:186-203` tests the geometry
of the component in isolation, but nothing tests the wiring from either card.

Secondary note on the same test: `container.querySelector('svg[class*="right-1"]')` is the only raw
CSS-selector assertion in the new set. It is defensible — the repeat icon is `aria-hidden` so it has
no accessibility-tree handle — but it is coupled to a Tailwind utility class that a restyle would
change.

**Fix.** Render the same event twice, with and without `recurrence`, and assert `link.style.left`
differs by exactly 14 (`JOIN_CONTROL_REPEAT_CLEARANCE_PX - JOIN_CONTROL_DEFAULT_RIGHT_INSET_PX`).

### F-6 (medium) — the all-day control ships a WCAG 2.5.8 defect; the response removed the detector

`e2e/allday/event-join.spec.ts:1-4`, `packages/web/src/grid/components/AllDayEventCard.tsx:94-97`

The spec's header comment documents the omission clearly and honestly, and I confirmed the premise
is not hypothetical: axe-core 4.12.1's `matchTags` only consults `rule.enabled` when the include
list is empty — `if (matching || include.length === 0 && rule.enabled !== false)` — so `target-size`
(tags `cat.sensory-and-visual-cues,wcag22aa,wcag258`, shipped `enabled: false`) **does** execute
under `expectNoAxeViolations`'s `withTags([…,"wcag22aa"])` **[verified independently]**.

The geometry confirms the failure mode. `EVENT_ALLDAY_HEIGHT = 20`,
`EVENT_ALLDAY_ROW_HEIGHT = 23` (`grid.constants.ts:3-5`). The anchor is 24px tall pinned at
`position.top` (`EventJoinIcon.tsx:112-114`, the `Math.max(0, …)` clamp), so it spans
`[top, top+24]` while the *next* all-day row's chip begins at `top+23` — a 1px overlap on top of the
full overlap with its own 20px chip. Two interactive targets at ~0px spacing, one of them under
24×24: `target-size` fails on the chip.

So the shipped product has a real WCAG 2.2 AA target-size violation on every conference-bearing
all-day event, and the merge artifact of that decision is "don't scan the all-day row". The Gate-2
decision (B) is the user's to make and I am not overturning it. But it is recorded in a spec file
comment only — there is nothing in `AllDayEventCard.tsx` to warn the next person, and no ticket.

**Fix.** Mirror the comment onto `AllDayEventCard.tsx:94` next to `showJoinIcon`, and file FU-3.

### F-7 (medium) — the all-day spec's second test is flaky one day in seven

`e2e/allday/event-join.spec.ts:88-102`

The drag test seeds its control event on `tomorrow` and drags it one column left. When the run lands
on the last visible day of the rendered week, `tomorrow` falls outside `visibleDates`,
`getVisibleAllDaySpan` returns null and `getAllDayEventPosition` returns `zeroPosition()`
(`event.position.ts:117-126`), so `expectAllDayEventVisible` times out. On the first visible day the
leftward drag runs off the grid instead.

The first test in the same file correctly uses `today` and is unaffected.

**Fix.** Seed on `today` like the first test, and drag *right* one column, or derive the column from
`getVisibleDayDates(page)` (`event-test-utils.ts:52-63`) and pick an interior one.

### F-8 (medium) — both specs anchor times to UTC while the grid lays out in local time

`e2e/timed/event-join.spec.ts:22-24`, `e2e/allday/event-join.spec.ts:26-33, 90-101`

`playwright.config.ts` sets no `use.timezoneId`, so the browser inherits the host timezone. The
timed spec builds `${new Date().toISOString().slice(0,10)}T10:00:00.000Z` — a UTC date label on a
UTC instant. At UTC−5 that renders at 05:00 local; at UTC+9, 19:00; and whenever the host's local
date differs from its UTC date, the card lands in a different column than the spec assumes. The
all-day spec derives its `YYYY-MM-DD` strings from `getUTC*` getters while the all-day row is laid
out on local dates.

This does not bite in a UTC CI container, which is presumably why it was not noticed, but the
deliverable is supposed to be runnable as-is. It also interacts with B-1: it is the UTC case
(offset 0) that makes the seeded events collide exactly with the demo "Try Compass".

**Fix.** Preferred: derive the day from `getVisibleDayDates(page)` and build local-offset ISO
strings — stays inside the allowlist. Alternative: `use: { timezoneId: "UTC" }` in
`playwright.config.ts`, which is a twelfth path and needs a Gate-0 reopen.

### F-9 (low) — `JOIN_ICON_MIN_WIDTH = 60` silently depends on `DECK_MIN_WIDTH = 72`

`packages/web/src/grid/components/TimedEventCard.tsx:70`

`applyTimedDeckPositionWithIndent` floors every deck card at `DECK_MIN_WIDTH = 72`
(`timed-deck.layout.ts:88-95`), which is why the join control never disappears from a deck card
today — I worked this through for group sizes 2 through 5 and the width always lands at 72
**[verified independently]**. The margin is 12px and nothing records the dependency. Lower
`DECK_MIN_WIDTH`, or raise `JOIN_ICON_MIN_WIDTH`, and conference-bearing deck cards lose their join
control with no failing test. The existing width tests use 30 and 140, so they do not pin 60 either.

**Fix.** A comment citing `DECK_MIN_WIDTH` on the constant, and a boundary case at exactly 60.

### F-10 (low) — the `"Untitled event"` fallback is written three times

`EventJoinIcon.tsx:101`, `TimedEventCard.tsx:274`, `AllDayEventCard.tsx:258`

`EventJoinIcon` computes `eventTitle.trim() || "Untitled event"`; `TimedEventCard` passes an
`eventTitle` that already carries the fallback; `AllDayEventCard` inlines
`event.title || "Untitled event"` at the call site. Three sites, two literal duplicates, and the
component's `.trim()` makes it subtly non-identical to the other two (a whitespace-only title yields
"Untitled event" from the component but not from the card's `aria-label`). DRY.

**Fix.** Keep the fallback in `EventJoinIcon` only and pass `event.title` raw from both cards.

### F-11 (low) — `design.md` is internally stale on the control size, and that staleness shipped

`design.md` §3.4 item 2 ("the 20×20 control") and §5.1 (the `pr-5` / `pr-9` block, and the OQ-1
reasoning "a 20px control on a 40px card leaves 20px of title"). The shipped constant is 24
(`EventJoinIcon.tsx:15`), correctly raised for `target-size`. §2 and §6 were updated for the change;
§3.4 and §5.1 were not, and `TimedEventCard.tsx:361-362` copied §5.1 verbatim. That is B-2.

**Fix.** Correct both sections alongside the B-2 code fix.

### F-12 (low) — `crypto.getRandomValues` at Node scope in the e2e helper

`e2e/utils/event-test-utils.ts:384-389`

Called outside `page.evaluate`, i.e. in the Playwright/Node process. Fine on Node ≥ 19 and Bun, but
nothing else in this 470-line file touches a Node global, so the dependency is invisible and would
fail as a bare `crypto is not defined` if the Playwright runtime is ever pinned older.

**Fix.** `import { randomBytes } from "node:crypto"`, or generate the ids inside `page.evaluate`.

---

## 4. What I checked and found correct

Recording these so the next reviewer does not repeat the work.

**Record shape (item 7 of the brief) — clean.** Verified field by field against
`LocalEventRecordSchema` (`local-event.record.ts:7-23`) and `EventSchema`
(`event.contracts.ts:100-114`), both `z.strictObject`:

- `version: 2` literal ✓; top-level `id === event.id`, satisfying the `.refine` at
  `local-event.record.ts:17-22` ✓
- **Optional fields are genuinely omitted, not set to `undefined`** — the
  `...(seed.conferenceUrl ? { conference: … } : {})` idiom at `event-test-utils.ts:427-435` is the
  correct form and avoids the IndexedDB-persists-the-undefined-key trap the brief flagged ✓
- `content.kind: "details"` with both required members ✓; `location` / `organizer` / `attendees` /
  `color` / `colorHex` / `icalUid` / `exdates` all absent ✓; no extra keys, so `strictObject` holds
- timed `end >= start` (`event.contracts.ts:50`) ✓; all-day `end > start` exclusive
  (`event.contracts.ts:62`) ✓ — `tomorrow`/`dayAfter` are correctly one day past
- `timeZone: "UTC"` passes `TimezoneSchema`'s `Intl.DateTimeFormat` round-trip
  (`type.utils.ts:34-44`) ✓
- generated 24-hex `id` satisfies `EventIdSchema` (`min(1).max(256)`) and the fallback calendar id
  satisfies `CalendarIdSchema` = `ObjectIdStringSchema` = `/^[0-9a-f]{24}$/i` (`type.utils.ts:54`) ✓
- `recurrence: { kind: "single" }` ✓, `createdAt` ISO-with-offset ✓, `updatedAt: null` ✓

**The calendar-id handshake is correct.** `persistentBrowserStore` stores raw strings with no JSON
wrapper (`browser-key-value.store.ts:26-28`), so `localStorage.getItem("compass.localCalendarId")`
at `event-test-utils.ts:394` returns exactly what `getLocalCalendarSentinelId`
(`local-calendar.sentinel.ts:16-25`) wrote, and the read-or-generate-then-reload sequence converges
on one id. This was the most likely silent-failure mode in the helper and it is handled.

**The `.evaluate` block's error handling is sound.** Explicit guard with a diagnostic message when
the `events` store is missing (`:409-414`), `transaction.onerror` *and* `onabort` both wired
(`:452-453` — most hand-written IDB code forgets `onabort`), `db.close()` in `finally`. No swallowed
errors.

**Blast radius of the fragment — clean.** Checked every mechanism the brief named:
- ref stays on the card root in all four consumers (`GridEvent.tsx:133-148`, `AllDayEvent.tsx:63-72`,
  `DayCalendarEventCards.tsx:93-108, 180-193`), so the week/day registries, `rebindPreparedSource`
  and `readElementRect` are untouched
- `createDraftEventMount` clones `source` = the ref'd root (`dom.ts:92-101`), so the anchor is
  structurally absent from the drag ghost — OQ-2 resolved for free, as claimed
- `getFirstDirectResizeHandle` iterates `node.children` of the root only (`dom.ts:154-165`)
- **zero** `firstChild` / `firstElementChild` / `children[0]` / `React.Children` uses anywhere in
  `packages/web/src`
- the only `> *` CSS rule in the codebase is `c-disclosure-content` (`index.css:324`), unrelated
- memo comparators (`GridEvent.tsx:153-167`, `AllDayEvent.tsx:80-92`) unaffected — no new props
- the anchor and the card are siblings deriving geometry from the same `position` object, so they
  share a containing block by construction regardless of which ancestor establishes it

**AC-9 has no bypass I could find.** `new URL(url)` with no base correctly rejects relative input.
Leading/embedded whitespace, tabs and newlines are stripped identically by the URL parser and by the
browser's own `href` parsing, so returning the *original* string cannot diverge in scheme from what
was validated — the byte-identity requirement and the security property are compatible here.
Uppercase schemes normalise via `parsed.protocol` and are correctly accepted (covered at
`EventJoinIcon.test.tsx:151-165`). `if (!url)` covers `""`, `null` and `undefined`.

**Locator hygiene.** Every locator in both specs is name-filtered against a `createEventTitle`
value; there is no bare `getByRole("link")` and no unfiltered `toHaveCount(0)`. The ambient demo
"Morning standup" join link is correctly not captured. Item 8 of the brief is satisfied.

**Neither spec drags or resizes the conference-bearing card.** AC-4 runs against a dedicated
conference-free event in both files (`timed:80-160`, `allday:83-146`). Item 6 satisfied — this is
the trap that would have misreported the local-mode conference-destruction bug as a feature failure,
and it was avoided deliberately.

**`event-test-utils.ts` is purely additive.** `git diff` shows zero `-` lines; all 18 prior exports
intact.

**No `any`, no unsafe casts, no swallowed errors in the React code.** `EventJoinIcon`'s props are
fully typed, `resolveJoinHref` narrows `string | null | undefined` correctly, and the `try/catch`
around `new URL` discards the exception deliberately with a comment explaining why `URL.canParse`
was not used.

**Component suite re-run [verified independently]:** `bun test EventJoinIcon.test.tsx
EventCard.test.tsx` → **43 pass / 0 fail**, 99 assertions.

---

## 5. AC verification table

| AC | Status | Evidence |
|---|---|---|
| **AC-1** — renders iff `conference?.url` present | **met, with a documented widening** | `TimedEventCard.tsx:141-148`, `AllDayEventCard.tsx:93-97`. Gated additionally on placeholder / motion / width / duration per the OQ-1 amendment, which FR-6 permits provided it is stated in the design and tested. It is stated (`design.md` §6 OQ-1) and tested (`EventCard.test.tsx:612-705, 780-817`) — except the 30-minute boundary itself (F-2). |
| **AC-2** — new tab, opener severed, referrer suppressed | **met** | `EventJoinIcon.tsx:103-118` (`target="_blank"`, `rel="noopener noreferrer"`); asserted at `EventJoinIcon.test.tsx:32-47` and again in both e2e specs. |
| **AC-3** — no detail panel, no drag/resize | **partially met** | Layer 2 (mouse) present at `EventJoinIcon.tsx:119-127`, tested at `EventJoinIcon.test.tsx:167-185`, and mutation-verified by the author. Layer 1 (pointer) present at `dom.ts:55-61` + `week:492-494` + `day:443-445` and correct on inspection — the bail precedes every branch, mirrors `getResizeHandleEdge`, and `closest()` resolves from the child SVG (proved at `EventJoinIcon.test.tsx:64-77`). But it has **no unit test** (F-1) and its only e2e exercise is inside the spec B-1 breaks. |
| **AC-4** — existing card behavior unchanged | **met statically; e2e unverified** | Suite delta +23 with no new failures. Blast-radius mechanisms all checked clean (§4 above). e2e coverage exists in both specs but has never run. |
| **AC-5** — keyboard reachable, named, nested-interactive resolved | **partially met** | Reachable (a real `<a href>`, not a div), named via `aria-label` and asserted through `getByRole(…, {name})` throughout. The nested-interactive resolution is stated in `design.md` §3 and is correct. But the guard is incomplete: the invariant has no unit test (F-4), the all-day half carries no axe scan at all (F-6), and the timed half's scan has never executed. |
| **AC-6** — no new failures | **met** | 2320/1/1 vs baseline 2297/1/1; delta +23 passing, same single pre-existing `RecurrenceSection` failure and same pre-existing `useRecurrence` error. |
| **AC-7** — no new deps | **met** | `git diff --stat` shows only the 11 allowlisted paths plus `.sdlc/**`. No `package.json` / `bun.lock` change. |
| **AC-8** — browser verification, backed by e2e | **not met** | The human check has not been recorded, and the automated backing is not merge-ready: the timed spec is very likely broken (B-1) and neither has been executed. |
| **AC-9** — `http:`/`https:` only | **met in code; weakly guarded in e2e** | `resolveJoinHref` (`EventJoinIcon.tsx:37-58`) is correct and I could not bypass it. Unit coverage is genuinely good (`EventJoinIcon.test.tsx:79-150` covers `javascript:`, `data:`, `vbscript:`, unparseable, relative, empty) and `EventCard.test.tsx:706-723` covers it end-to-end through the card. The two e2e assertions for it are the unfalsifiable ones (F-3). |

---

## 6. Test quality assessment

**Tests that cannot fail, or cannot fail on the property they name:**

1. **`e2e/timed/event-join.spec.ts:60-66` and `e2e/allday/event-join.spec.ts:68-74`** — the
   blocked-scheme and control-event `toHaveCount(0)` assertions. Structurally unfalsifiable: they
   cannot distinguish "the guard worked" from "the event never rendered". This is the strongest
   instance in the change set and it sits on AC-9. (F-3)
2. **`EventCard.test.tsx:724-745`** — "keeps the repeat icon visible when both … show" cannot fail
   if the two glyphs overlap, which is the only thing it is there to prevent. (F-5)
3. **No test anywhere** asserts the anchor is a sibling rather than a descendant of the card root —
   the change's central invariant. (F-4)
4. **No test anywhere** asserts the `rightInsetPx` prop is wired from either card. (F-5)

**Tests that are falsifiable but do not pin the boundary they imply:**

5. `EventCard.test.tsx:666-685` (15-minute negative) — survives `>=` → `>`, and 30 → 45. (F-2)
6. `EventCard.test.tsx:648-665` and `:799-817` (width 30 vs the 140 default) — survive
   `JOIN_ICON_MIN_WIDTH` 60 → 100. (F-9)

**Borderline, judged acceptable:**

7. `await expect(page.getByRole("form").getByPlaceholder("Title")).toBeHidden()`
   (`timed:78`, `allday:81`). Playwright's `toBeHidden` passes for an *absent* element, so this
   would pass vacuously if the locator were wrong. It is saved by the second test in each file
   asserting `toHaveValue(controlTitle)` on the identical locator — if the locator broke, that test
   fails loudly. And it does genuinely fail if the panel opens, which is the point. I would still
   prefer an explicit `toHaveCount(0)` on `page.getByRole("form")`.
8. `container.querySelector('svg[class*="right-1"]')` (`EventCard.test.tsx:743`) — the only raw
   CSS-selector assertion. Defensible (the repeat icon is `aria-hidden` and has no a11y-tree
   handle), but coupled to a Tailwind class.

**Strong tests worth keeping as-is:**

- `EventJoinIcon.test.tsx:186-203` (geometry) pins all four computed style values and would catch
  any regression in the `left`/`top` arithmetic. The best test in the set.
- `EventJoinIcon.test.tsx:64-77` (attribute reachable via `closest()` from the child SVG) tests
  exactly the property FR-3 exists for, from the real pointer target.
- `EventJoinIcon.test.tsx:79-150` — six scheme-rejection cases including the two the brief asked
  for plus relative and empty. Thorough.

**NFR-2 compliance: clean.** I re-grepped `EventCard.test.tsx` and `EventJoinIcon.test.tsx` for
`getAttribute("role")` and `[role=` and found zero. Every join assertion goes through
`getByRole`/`queryByRole` with a name. This is the failure mode a prior arm on this repo shipped and
it has been avoided here.

---

## 7. Risks carried into merge

1. **The e2e specs have never been executed.** Everything in §5's AC-8 row, and the automated half
   of AC-3 layer 1 and AC-5, rests on code that has never run once. B-1 is a bug I found by reading;
   there may be others that only execution surfaces.
2. **AC-3 layer 1 is untested and unexecuted, in both senses simultaneously** (F-1 + B-1). If the
   adapter bail is wrong, nothing in this repo will tell you — the mouse-path `stopPropagation`
   masks it in the component suite, and the component suite has no `PointerCaptureBoundary`
   ancestor (`design.md` §4.3, which I confirmed). This is the same shape as the `-t2` arm's shipped
   defect: green suite, broken in the browser. **The human browser check is not optional here.**
3. **The untouched `e2e/accessibility/app-a11y.spec.ts` now scans a join control.** Its "week view"
   checkpoint scans the whole page with no `include`, the demo "Morning standup" renders the anchor
   (30-min gate inclusive, ~148px wide, both gates cleared), and `target-size` really does run. The
   24px choice is correct and I verified the mechanism, but this spec is not on the allowlist and
   has not been executed since the change. If it fails, it fails in a file this run may not touch.
4. **A knowingly-shipped WCAG 2.5.8 violation on all-day join controls**, with the detector removed
   rather than the defect fixed (F-6). Accepted at Gate 2; carried as debt with no ticket yet.
5. **Timed-card title underlap** until B-2 is fixed — a user-visible layout defect on exactly the
   cards this feature targets.
6. **Environment coupling in both specs**: host timezone (F-8) and day-of-week (F-7). Both pass in a
   UTC CI container on most days, which is the worst kind of flake.
7. **The `motionMode` asymmetry between the cards** (`AllDayEventCard.tsx:86-93`) — an in-flight
   all-day drag keeps a live join anchor on the moving bar. Reasoned through in `design.md` §5.2 and
   accepted; the ghost is clean and the source card is a suppressed placeholder, so I agree it is
   safe. Recording it because it is invisible from the code alone.
8. **Recurring draft previews.** `GridDraft.tsx:124-140` renders preview occurrences with
   `displayMode="draft"`, which OQ-1 chose to render the icon on. Editing a recurring
   conference-bearing series will therefore put several identically-named `Join <title>` links in
   the accessibility tree at once. Not an axe violation and not a regression, but it was not
   considered in OQ-4's "no net new exposure" reasoning.

---

## 8. Follow-up tickets

Worded to stand alone without this run's context.

**FU-1 — Unit-test the grid join control's pointer-path bail**
`packages/web/src/grid/interaction/dom.ts` exports `isJoinControlTarget`, consumed by
`getInteractionTarget` in `week-interaction.adapter.ts` and `day-interaction.adapter.ts` to disown
pointers that begin on an event card's join link. None of the three has a unit test. Add: three
cases for `isJoinControlTarget` in a new `packages/web/src/grid/interaction/dom.test.ts` (target
inside the anchor; target on the anchor's child `<svg>`, resolving through `closest()`; target on
the card root → `false`), and one case in each of the existing
`week-interaction.adapter.test.ts` / `day-interaction.adapter.test.ts` asserting
`getInteractionTarget` returns `null` for a pointerdown whose target carries
`data-calendar-event-join-control="true"`. Without this, removing the bail leaves the whole suite
green while one-click join silently starts dragging the event instead.

**FU-2 — Harden the three pre-existing conference-link anchors against non-http schemes**
`UpNextCard.tsx`, `UpNextBanner.tsx` (and its `V` keyboard shortcut) and
`EventDetailsSection.tsx` each render `event.conference.url` straight into an `href` with no scheme
check. `ConferenceSchema.url` is `z.url()`, which accepts `javascript:` and `data:` (confirmed
against the installed zod), so a hostile or corrupted provider payload is click-to-execute at all
three sinks. `resolveJoinHref` in
`packages/web/src/grid/components/EventJoinIcon.tsx` already solves this correctly for the grid
card; lift it to a shared module and apply it at all four sites. Consider additionally constraining
`ConferenceSchema.url` at the contract boundary so the guard is not per-sink.

**FU-3 — Resolve the all-day join control's WCAG 2.5.8 target-size violation**
The join control on an all-day event card is 24×24 CSS px overlaying a 20px-tall chip
(`EVENT_ALLDAY_HEIGHT = 20`, `EVENT_ALLDAY_ROW_HEIGHT = 23`). Two interactive targets at ~0px
spacing, one under 24×24, fails axe's `target-size` rule on the chip. `e2e/allday/event-join.spec.ts`
currently carries no axe scan for exactly this reason. Options: grow the all-day chip to ≥24px,
place the control outside the chip's bounds with ≥24px spacing, or record a scoped, reasoned
exclusion. Once resolved, add `expectNoAxeViolations(page, { include: "#allDayRow" })` to that spec
so the nested-interactive guard covers the all-day path too.

**FU-4 — Give the timed and all-day grid cards a shared icon-reserve helper**
`TimedEventCard.tsx` and `AllDayEventCard.tsx` each compute a right-hand padding reserve for the
repeat and join glyphs from hand-written Tailwind classes (`pr-5`/`pr-9` and `pr-3.5`/`pr-6`/`pr-10`).
The two drifted the moment `JOIN_CONTROL_SIZE_PX` changed from 20 to 24 — the all-day card was
updated and the timed card was not. Derive the reserve from `JOIN_CONTROL_SIZE_PX`,
`JOIN_CONTROL_REPEAT_CLEARANCE_PX` and the card root's own padding in one place so the numbers cannot
disagree again.

**FU-5 — Pin the e2e suite's timezone and stop deriving fixture dates from UTC getters**
`playwright.config.ts` sets no `use.timezoneId`, so specs inherit the host timezone while the
calendar grid lays out in local time. Several specs build fixture timestamps from
`new Date().toISOString()` and `getUTC*`, which drift into the wrong column — or out of the rendered
week — on non-UTC hosts. Either pin `timezoneId: "UTC"` in the Playwright config, or add a shared
helper that derives fixture dates from `getVisibleDayDates(page)` and emits local-offset ISO strings.

**FU-6 — Add boundary tests for the grid join control's visibility gates**
`TimedEventCard.tsx` gates the join control on `durationMinutes >= 30` and `position.width >= 60`;
`AllDayEventCard.tsx` gates on `position.width >= 60`. The 30-minute inclusive comparison is
load-bearing: the demo seed's only conference-bearing event ("Morning standup") is exactly 30
minutes and is what gives the e2e accessibility scan a join control to inspect. The width gate sits
12px below `DECK_MIN_WIDTH = 72`, which is the only reason deck cards keep their control. Current
tests use 15/60 minutes and 30/140px, so none of these boundaries is pinned. Add exact-boundary
cases and a comment on each constant naming what it depends on.

**FU-7 — Suppress duplicate join links across recurring draft previews**
When a recurring, conference-bearing event is opened for editing, `GridDraft` renders a read-only
preview card per visible occurrence, each with `displayMode="draft"` — which renders its own join
control. The result is several identically-named `Join <title>` links in the accessibility tree
simultaneously. Decide whether preview occurrences should carry the control at all, and if not, add
the suppression alongside the existing `isPlaceholder` gate in `TimedEventCard.tsx`.

---

## 9. Refinement packets

Ordered. Packets 1 and 2 are merge-blocking; 3 through 6 are cheap and should ride along.

| # | Task | Paths | Acceptance |
|---|---|---|---|
| 1 | Fix B-1: re-slot the timed spec's seeded events onto distinct, demo-free hours so no deck forms | `e2e/timed/event-join.spec.ts` | No two events in the spec overlap; none collides with a demo slot (09:00, 10:00, 12:00, 14:00, 15:00, 17:00); a comment records why |
| 2 | Fix B-2 + F-11: `pr-5`→`pr-6`, `pr-9`→`pr-10`; correct `design.md` §3.4 and §5.1 to 24px | `TimedEventCard.tsx`, `design.md` | Timed and all-day reserves match for identical geometry; no "20px" left in the design where the shipped constant is 24 |
| 3 | Fix F-3: assert each seeded card is visible before asserting its join link is absent | `e2e/timed/event-join.spec.ts`, `e2e/allday/event-join.spec.ts` | Every `toHaveCount(0)` is preceded by a positive visibility assertion for the same event |
| 4 | Fix F-4 + F-5 + F-2: sibling-relationship guard, `rightInsetPx` wiring guard, exact-30-minute boundary case | `EventCard.test.tsx` | Nesting the anchor, deleting `rightInsetPx`, or changing `>= 30` to `> 30` each fails at least one test |
| 5 | Fix F-7 + F-8: seed the all-day drag test on `today` and drag right; derive both specs' dates from `getVisibleDayDates` | `e2e/allday/event-join.spec.ts`, `e2e/timed/event-join.spec.ts` | Specs pass on a non-UTC host and on any day of the week |
| 6 | Fix F-6 + F-9 + F-10: target-size comment on `AllDayEventCard`, `DECK_MIN_WIDTH` comment on `JOIN_ICON_MIN_WIDTH`, single `"Untitled event"` fallback | `AllDayEventCard.tsx`, `TimedEventCard.tsx`, `EventJoinIcon.tsx` | The fallback exists once; both non-obvious constants name their dependency |

All six stay inside the existing 11-path write contract. No twelfth path is required.
