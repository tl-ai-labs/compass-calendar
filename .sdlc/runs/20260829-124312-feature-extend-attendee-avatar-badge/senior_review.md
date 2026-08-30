# Senior Code Review — feature-extend — Attendee avatar badge on grid event cards

**Run:** `20260829-124312-feature-extend-attendee-avatar-badge`
**Mode:** brownfield · **Intent:** feature-extend · **Scope:** the 8 files touched by this run only
**Anchor:** `2d81253a` (working-tree only, nothing committed)
**Reviewer phase:** `senior_code_review`

Scope note: findings below are confined to files this run wrote or edited. Pre-existing smells
in untouched files were ignored per brownfield policy.

Env-fixture gate (reviewer checklist item 8): **not applicable.** This is a client-side React
module. There is no Nest `ConfigModule`, Joi/Zod/envalid env schema, or equivalent validating
config boot anywhere in the change set, so the `.env.example` / `.env.test` blocker does not
apply to this run.

---

## 1. What I verified independently

I re-derived the load-bearing arithmetic rather than trusting the design doc.

**Cap arithmetic (FR-9) — correct.** `EventAttendeeBadge.tsx` L91-95:

```ts
const avatarCount =
  attendees.length > MAX_VISIBLE_ATTENDEES ? MAX_VISIBLE_ATTENDEES - 1 : attendees.length;
const overflowCount = attendees.length - avatarCount;
```

At the dangerous boundary `length === 4`: `avatarCount = 2`, `overflowCount = 2`, total rendered
elements `= 3 = MAX_VISIBLE_ATTENDEES`. At `length === 3`: 3 avatars, no chip. This is exactly
`N = attendees.length - 2` as Gate 1 resolved, and `EventAttendeeBadge.test.tsx` L41-58 asserts
`[4,"+2"] [6,"+4"] [50,"+48"]` with 2 avatars each. No off-by-one. This was flagged as the
highest-risk area and it is clean.

**Line-clamp arithmetic (FR-18) — correct.** `getLineClamp(h) = max(1, round((h - 7) / 16))`
(`grid.util.ts` L92-99 with `GRID_EVENT_TITLE_VERTICAL_SLACK_PX = 7`,
`GRID_EVENT_TITLE_LINE_HEIGHT_PX = 16`). At the test fixture `height: 60`:
`60 - 13 = 47 → round(40/16) = round(2.5) = 3`; with the badge `60 - 13 - 16 = 31 →
round(24/16) = round(1.5) = 2`. Matches the test's `"3"` then `"2"`. The documented
`MIN_EVENT_HEIGHT_FOR_ATTENDEE_BADGE = 52` (`16 + 13 + 16 + 7`) is internally consistent: at
h=52 the title still gets exactly 1 line.

**Width gates — documented arithmetic checks out.** The comment at
`EventAttendeeBadge.tsx` L28-31 cites `pl-1.25 / pr-0.75`; I confirmed both cards really do use
that padding (`TimedEventCard.tsx:292`, `AllDayEventCard.tsx:161`), so `90 - 5 - 3 = 82` is real.
Badge max 52px + repeat-icon reserve ~14px = 66 < 82: no collision. On `AllDayEventCard` the badge
is placed *inside* the `pr-3.5`-reserving row (L195-215), so it cannot collide with the
absolutely-positioned `EventRepeatIcon` either. Good.

**FR-4 (single definition of the RSVP map) — holds.** `grep -rn "bg-success\|bg-error\|bg-warning\|bg-text-subtle" packages/web/src`
excluding tests returns the new `attendee-status.ts` plus three unrelated hits
(`OverlayPanel.tsx:263`, `EventDetailsSection.tsx:65-66` — a comment, `BillingPastDueBanner.tsx:11`).
Exactly one status-map definition repo-wide.

**FR-19/FR-20 (packet-8 refactor) — genuinely behaviour-preserving.** The diff is a pure deletion
of the module-private `ATTENDEE_STATUS_DOT` / `attendeeStatusLabel` plus an import swap; the
extracted values are character-identical (`accepted → "bg-success"`, `declined → "bg-error"`,
`tentative → "bg-warning"`, `needsAction → "bg-text-subtle"`, `needsAction → "hasn't responded"`).
`MAX_VISIBLE_ATTENDEES = 6` correctly stayed local. No DOM, class string, `aria-label` or `title`
in `EventDetailsSection` moved.

**FR-12 (pointer/keyboard inertness) — holds.** Zero hits for `stopPropagation`, `preventDefault`,
`onMouse*`, `onClick`, `tabIndex`, or any `data-calendar-event-*` / `data-week-interaction-*`
attribute in `EventAttendeeBadge.tsx`. Root is `pointer-events-none`.

**PII (FR-8, §5 inventory) — email never reaches the DOM.** `attendee.email` appears exactly once,
as `key={attendee.email}` (L123), which React consumes for reconciliation and never serializes.
The monogram is gated on `/^[\p{L}\p{N}]$/u`, and destructuring (`const [first = ""] = trimmed`)
uses the string iterator so a surrogate pair is not split into a lone half — a nice detail.

**Type safety — clean.** `attendees: readonly Attendee[] | undefined` matches
`GridEvent["attendees"]` with no cast; `Record<AttendeeResponseStatus, string>` gives FR-2's
compile-time exhaustiveness; no `any`, no non-null assertion, no `as` anywhere in the change set.
Neither card's prop interface changed (FR-15).

**Error handling.** No async, no throw sites, no caught-and-swallowed errors, no stack-trace
surface. Nothing to report.

**Authz.** No route, guard, or role surface is touched. §6 of the requirements is accurate: this is
presentational rendering of already-authorized, already-fetched fields.

---

## 2. Findings

### MAJOR-1 — NFR-5 is not met: per-avatar status is conveyed by colour alone

`packages/web/src/grid/components/EventAttendeeBadge.tsx` L106-141

The per-avatar status signal is carried **only** by `title={`${displayName ?? "Guest"}, ${statusText}`}`
(L129). Both delivery channels for that attribute are closed by the badge's own markup:

1. **Assistive tech: pruned.** The root is `<span role="img" aria-label={groupLabel}>`. ARIA's
   `img` role is *Children Presentational: True*, so the entire descendant subtree is removed
   from the accessibility tree and the per-avatar `title`s are never announced. The design doc
   states this itself (`design.md` L426-428: *"makes the root a leaf in the accessibility tree —
   descendants are not announced"*).
2. **Mouse: suppressed.** `pointer-events-none` on the root (L112) means the element is never a
   hit-test target, so the browser renders no native tooltip — it resolves the tooltip from the
   nearest hit ancestor instead, which is the card, which has no `title`.

`design.md` L656-660 asserts the opposite — *"The attribute stays in the DOM and is still exposed
to assistive technology and to `getByTitle` in tests, so NFR-5's non-color signal and AC-9 both
hold; only the mouse-hover tooltip is lost."* That claim is false and is directly contradicted by
the same document's §4. Only the third clause (`getByTitle` in tests) is true, and a test query is
not a user-facing channel.

Net user-visible result: a sighted colourblind user sees three identically-shaped discs whose only
differentiator is ring hue, with no tooltip and no visible text. A screen-reader user hears
`"3 guests, 2 accepted"` and cannot tell whether the third guest declined, is tentative, or has not
responded — declined/tentative/needsAction are not surfaced in any perceivable channel at all.

The requirement is explicit that the badge should behave *"the way `EventDetailsSection`'s dots
already do"*, and that component's own comment (L65-68) spells out the correct pattern:
*"title is a mouse-only tooltip, so the row's `aria-label` carries the same info as accessible
text."* The badge kept the dot's `title` but dropped the `aria-label` half that made it work.

**Fix (both halves needed):**
- Screen readers: extend the root `aria-label` from an accepted-only count to a full status
  breakdown, e.g. `"3 guests: 2 accepted, 1 declined"` (omit zero-count statuses). This is still a
  single O(n) pass and still names nobody, so FR-10's no-`@` guarantee is untouched.
- Sighted colourblind users: give each avatar a non-hue differentiator, or accept that the ring is
  decorative and say so. If the ring stays decorative-only, delete the now-inert per-avatar `title`
  rather than leaving markup that reads as an a11y affordance but is not one.
- Correct `design.md` §8's "Accepted trade-off" paragraph either way — as written it will mislead
  the next reader.

### MAJOR-2 — AC-9 ("Guest") is asserted against an imperceptible attribute

`packages/web/src/grid/components/EventAttendeeBadge.test.tsx` L85-98

```ts
const avatar = screen.getByTitle("Guest, hasn't responded");
```

Follows from MAJOR-1: this is the only assertion backing acceptance criterion 9 and FR-11, and the
attribute it queries is announced to nobody and shown to nobody. The test is green while the
user-facing behaviour it claims to cover does not exist. Once MAJOR-1 is fixed, re-point this
assertion at whatever channel actually surfaces `Guest`.

### MAJOR-3 — FR-7 has zero test coverage; `declined` and `tentative` never render in any test

`EventAttendeeBadge.test.tsx`, `EventCard.test.tsx`

FR-7 ("Each avatar's status color class is read from the FR-1 shared map keyed by that attendee's
`responseStatus`") is the only functional requirement in the run with no direct assertion.
`attendee-status.test.ts` tests the map *object* in isolation; nothing tests that the map is
*applied* to an avatar. Grepping the two badge-rendering test files, only `accepted` and
`needsAction` appear as fixture values — `declined` and `tentative` are never rendered anywhere.

Concretely: deleting `ATTENDEE_STATUS_DOT[attendee.responseStatus]` from L126, or hardcoding
`"bg-success"` in its place, keeps the entire 2313-test suite green. Given that the whole point of
packet 8 was to make this map canonical, the wiring deserves an assertion.

**Fix:** add a table-driven case over all four `AttendeeResponseStatusSchema.options` asserting the
rendered avatar's `className` contains `ATTENDEE_STATUS_DOT[status]` (import the map, do not
re-type the literals — re-typing them would recreate the FR-4 duplication in test code).

### MINOR-1 — stale biome suppression in new code

`EventAttendeeBadge.tsx:107`

Confirmed independently: `bunx biome check` over the four changed source files reports exactly one
warning, `suppressions/unused` at L107. The rule no longer fires, so the suppression has no effect.

**The correct fix is deleting the two comment lines, not changing the markup.** `role="img"` +
`aria-label` on a `<span>` is a deliberate choice (it makes the node an a11y leaf, which is what
keeps per-avatar identities out of the announcement — `design.md` §4); an `<img>` element is not
applicable, there is no `src`. Switching to `role="group"` would be actively wrong, as the design's
R6 row notes: it would expose the avatar subtree to AT and reopen the FR-10 surface.

Also worth correcting in the run record: the phase summary states the 11 biome warnings are "all
pre-existing files untouched by this run". This one is in a file this run created.

### MINOR-2 — a load-bearing code comment states something false

`EventAttendeeBadge.tsx` L38-41:

> *"That is what makes the no-@ guarantee airtight: no attendee-supplied character that is not
> `\p{L}` or `\p{N}` can ever reach the DOM, so "@" cannot, even from a displayName that looks like
> an email address."*

Not true. L129 writes the raw `displayName` into `title`, so `displayName: "sales@corp.com"` puts
`@` in the DOM. That *behaviour* is fine — the PII inventory explicitly sanctions `displayName` in
`title`, and it is a provider-supplied display name, not the email field. But the comment's absolute
claim is wrong, sits directly above the regex a future maintainer will consult, and would justify
an unsafe change (e.g. "the regex guarantees no `@`, so I can render the name as visible text").

**Fix:** scope the claim to the monogram — "no attendee-supplied character that is not `\p{L}` or
`\p{N}` reaches the *rendered monogram*" — and note that `title` deliberately carries the full
`displayName` per the PII table.

### MINOR-3 — `MAX_VISIBLE_ATTENDEES` is exported but nothing consumes it; AC-7 asked for cap-derived assertions

`EventAttendeeBadge.tsx:13`, `EventAttendeeBadge.test.tsx` L27-58

`grep -rn MAX_VISIBLE_ATTENDEES packages/web/src` shows the badge's export has no importer. The
tests hardcode `2` avatars and `"+2" / "+4" / "+48"`. AC-7 specified the assertions in terms of the
constant (*"with `MAX_VISIBLE_ATTENDEES + 3` attendees, the rendered avatar count equals
`MAX_VISIBLE_ATTENDEES - 1`"*), which is presumably why it was exported. Either import it in the
test and derive the expectations, or drop the export.

### MINOR-4 — new layout constants diverge from the grid's constants convention, and one duplicates an existing value

`EventAttendeeBadge.tsx` L20-35

`MIN_EVENT_WIDTH_FOR_ATTENDEE_BADGE = 90` is a silent copy of `MIN_EVENT_WIDTH_FOR_TIME_LABEL = 90`
(`grid.constants.ts:29`). Every sibling grid layout gate — `COMPACT_EVENT_MAX_HEIGHT`,
`MIN_EVENT_HEIGHT_FOR_TIME_LABEL`, `GRID_EVENT_TIME_LABEL_LINE_HEIGHT`,
`GRID_EVENT_TITLE_VERTICAL_SLACK_PX` — lives in `grid.constants.ts`, and `TimedEventCard` already
imports from there. The five new constants live in a component file instead. (The convention is
admittedly mixed — `REPEAT_ICON_MIN_WIDTH` is duplicated locally in both cards — so this is a nit,
not a defect.) Prefer referencing `MIN_EVENT_WIDTH_FOR_TIME_LABEL` for the shared 90, or moving the
new gates next to their siblings.

### MINOR-5 — two of the three size gates are untested

`EventCard.test.tsx`

Only the timed *height* gate has a test (L676-701, height 40 vs the 52 threshold). Neither
`MIN_EVENT_WIDTH_FOR_ATTENDEE_BADGE` (90) nor `MIN_ALLDAY_WIDTH_FOR_ATTENDEE_BADGE` (120) is
asserted. The all-day card's *only* gate is that 120 — it could be changed to 0 or to 10000 and the
suite stays green. The file already has the idiom for this (`position={{ ...position, width: 30 }}`
at L338), so two more cases are cheap.

### MINOR-6 — misleading test name

`EventCard.test.tsx:719` — `"keeps the timed title line clamp unchanged when an event has no attendees"`.
The substance of the test is the *changed* clamp (3 → 2) when attendees are present; the no-attendee
render is only the control. Rename to something like `"gives the attendee badge a row out of the
title's line clamp"`.

### MINOR-7 — badge gate omits the `!isPlaceholder` guard its neighbour applies

`TimedEventCard.tsx:135-138`, `AllDayEventCard.tsx:84-85`

`showRepeatIcon` on both cards includes `!isPlaceholder`; `showAttendeeBadge` does not. A drag
placeholder ghost will therefore render the badge while suppressing the repeat icon. This may well
be intentional (the placeholder is already `opacity: 0.5` as a whole), but it is an unexplained
divergence from the gate immediately above it. Either add the guard or add a one-line comment
saying why the badge deliberately differs.

### MINOR-8 — NFR-7 says O(cap); the implementation is O(n)

`EventAttendeeBadge.tsx` L55-61 — `countAccepted` walks the full attendee list. NFR-7 says
"Derivation from `attendees` must be O(cap), not O(n)". In practice this is unavoidable for an
accurate group count, it is allocation-free, and the comment defends the choice well (correctly
warning against `.filter().length`). Flagging only because requirement text and implementation
disagree and neither the design nor the code acknowledges the deviation. Attendee lists are small;
no action needed beyond a note. (If MAJOR-1 is fixed by extending the label, keep it to one pass.)

---

## 3. React correctness

Nothing wrong. No hooks in the badge, so the `if (!attendees || attendees.length === 0) return null`
early return at L89 is safe. Keys are stable and content-derived (`attendee.email`), not indices.
No prop drilling — `baseColor` is passed the same way `EventRepeatIcon` already takes it, which
correctly prevents the badge from calling `useEventPalette` and disagreeing with the card about
draft/past/hover state. `lineClamp`'s `useMemo` dependency array was correctly extended with
`showAttendeeBadge`.

On memoisation: there is no `React.memo` anywhere in `packages/web/src/grid/components`, so NFR-7's
"must not defeat the cards' existing memoization" has nothing to defeat. The badge's per-render
`darken()` + `theme.getContrastText()` mirror what `TimedEventCard` (L202) and `EventRepeatIcon`
already do per render. Consistent; no new cost pattern introduced.

---

## 4. Verdict rationale

The mechanical core of this change is well executed — the arithmetic that was called out as
highest-risk is provably correct, the refactor is genuinely behaviour-preserving, FR-4 is verified
by grep, and the PII discipline around `email` is tight and correctly reasoned.

What stops an approval is that the accessibility story does not survive scrutiny. NFR-5 is a stated
requirement, the design's justification for considering it satisfied is internally contradictory
(§8 contradicts §4), and the single acceptance criterion covering it asserts against an attribute no
user can perceive. That is a real user-facing gap dressed as a passing test, not a style preference.
MAJOR-3 compounds it: the one functional requirement tying the whole packet-8 extraction together
has no test holding it in place.

All three majors are contained, well-localised, and fixable without touching the cap arithmetic or
the refactor.

---

## 5. Refinement TaskPackets

```json
[
  {
    "id": "RF-01",
    "phase": "refinement",
    "task_type": "a11y-fix",
    "module": "grid/components",
    "instruction": "Fix NFR-5 in EventAttendeeBadge.tsx. Per-avatar RSVP status is currently colour-only: the `title` on each avatar is unreachable both to assistive tech (the root's role=\"img\" makes it an a11y leaf, pruning all descendants) and to the mouse (pointer-events-none suppresses the native tooltip). (a) Extend the root aria-label from '<n> guests, <k> accepted' to a full non-zero status breakdown, e.g. '3 guests: 2 accepted, 1 declined' / '1 guest: 1 hasn't responded', built from a single O(n) pass and using attendeeStatusLabel from @web/common/styles/attendee-status so prose cannot drift. Name nobody - FR-10's no-@ guarantee on the root label must still hold under every input, including displayName values that look like email addresses. (b) Either give each avatar a non-hue differentiator so sighted colourblind users can distinguish statuses, or, if the ring is to remain purely decorative, delete the now-inert per-avatar `title` so the markup stops advertising an affordance it does not provide. Do NOT change role=\"img\" to role=\"group\" - that would expose the avatar subtree to AT and reopen the FR-10 surface. Do not touch the cap arithmetic (L91-96), the monogram regex, or the key={attendee.email} usage.",
    "artifact_path": "packages/web/src/grid/components/EventAttendeeBadge.tsx",
    "acceptance": [
      "A screen reader announcing the badge can distinguish declined / tentative / needsAction from accepted; the root aria-label is no longer accepted-only.",
      "The root aria-label contains no '@' for every input, including an attendee whose displayName is 'sales@corp.com'.",
      "The root aria-label contains no attendee displayName under any input.",
      "role=\"img\" is retained; no tabIndex, no onMouse*/onClick, no stopPropagation is introduced; pointer-events-none is retained.",
      "MAX_VISIBLE_ATTENDEES stays 3 and the overflow arithmetic (N = attendees.length - 2) is byte-unchanged.",
      "bun test:web >= 2313 pass / 0 fail; bun run type-check:web-tests exit 0."
    ]
  },
  {
    "id": "RF-02",
    "phase": "refinement",
    "task_type": "test-hardening",
    "module": "grid/components",
    "instruction": "Close three test gaps. (1) FR-7 is untested: add a table-driven case over AttendeeResponseStatusSchema.options asserting the rendered avatar element's className contains ATTENDEE_STATUS_DOT[status]. Import ATTENDEE_STATUS_DOT from @web/common/styles/attendee-status - do NOT re-type the 'bg-success'/'bg-error'/'bg-warning'/'bg-text-subtle' literals in the test, which would recreate the FR-4 duplication in test code. `declined` and `tentative` currently never appear in any badge fixture; after this they must. (2) Re-point the AC-9 'Guest' assertion (EventAttendeeBadge.test.tsx L85-98) away from getByTitle at whatever perceivable channel RF-01 lands on. (3) Import MAX_VISIBLE_ATTENDEES in EventAttendeeBadge.test.tsx and derive the cap assertions from it per AC-7 (MAX_VISIBLE_ATTENDEES + 3 attendees -> MAX_VISIBLE_ATTENDEES - 1 avatars) instead of the hardcoded 2 / '+2' / '+4' / '+48'; alternatively drop the unused export. Add to EventCard.test.tsx: a timed-card case below MIN_EVENT_WIDTH_FOR_ATTENDEE_BADGE (90) and an all-day case below MIN_ALLDAY_WIDTH_FOR_ATTENDEE_BADGE (120), both asserting queryByTestId('event-attendee-badge') is null - the all-day 120 gate is currently entirely unasserted. Rename EventCard.test.tsx:719 to describe what it actually tests (the clamp dropping 3 -> 2 when the badge takes a row). Do not weaken or edit any pre-existing assertion.",
    "artifact_path": "packages/web/src/grid/components/EventAttendeeBadge.test.tsx",
    "acceptance": [
      "Removing `ATTENDEE_STATUS_DOT[attendee.responseStatus]` from EventAttendeeBadge.tsx L126, or replacing it with a hardcoded class, makes at least one test fail.",
      "All four AttendeeResponseStatus members are exercised through a rendered avatar.",
      "Changing MIN_ALLDAY_WIDTH_FOR_ATTENDEE_BADGE from 120 makes at least one test fail.",
      "Changing MIN_EVENT_WIDTH_FOR_ATTENDEE_BADGE from 90 makes at least one test fail.",
      "No assertion existing at anchor 2d81253a is edited or deleted.",
      "bun test:web >= 2313 pass / 0 fail."
    ]
  },
  {
    "id": "RF-03",
    "phase": "refinement",
    "task_type": "lint-and-comment-fix",
    "module": "grid/components",
    "instruction": "Two small corrections in EventAttendeeBadge.tsx. (1) Delete the stale two-line `// biome-ignore lint/a11y/useSemanticElements: ...` comment at L107-108 - biome reports it as suppressions/unused because the rule no longer fires. Delete the comment; do NOT change the markup to satisfy the rule (role=\"img\" + aria-label on a span is the deliberate a11y-leaf choice, and there is no <img> src here). (2) Correct the comment at L38-41: its claim that no non-\\p{L}/\\p{N} character 'can ever reach the DOM, so \"@\" cannot' is false, because L129 interpolates the raw displayName into `title`. Scope the claim to the rendered monogram and note that `title` deliberately carries the full displayName as sanctioned by the requirements' PII inventory. Optionally also reference MIN_EVENT_WIDTH_FOR_TIME_LABEL from @web/grid/grid.constants instead of redeclaring the same value 90 as MIN_EVENT_WIDTH_FOR_ATTENDEE_BADGE, and add a one-line note to TimedEventCard/AllDayEventCard explaining why showAttendeeBadge omits the !isPlaceholder guard that showRepeatIcon applies (or add the guard).",
    "artifact_path": "packages/web/src/grid/components/EventAttendeeBadge.tsx",
    "acceptance": [
      "`bunx biome check packages/ self-host/` reports zero warnings in files created or modified by this run.",
      "No source comment in the change set makes a factual claim contradicted by the code.",
      "Rendered DOM is unchanged by this packet (comment/constant edits only).",
      "bun test:web >= 2313 pass / 0 fail; bun lint exit 0."
    ]
  },
  {
    "id": "RF-04",
    "phase": "refinement",
    "task_type": "design-doc-correction",
    "module": "run-artifacts",
    "instruction": "design.md section 8's 'Accepted trade-off' paragraph (L656-660) asserts that the per-avatar `title` 'is still exposed to assistive technology ... so NFR-5's non-color signal and AC-9 both hold'. This is false and is contradicted by design.md's own section 4 (L426-428), which correctly states that role=\"img\" makes the root an a11y leaf whose descendants are not announced. Rewrite the paragraph to state accurately that (a) the per-avatar title is announced to nobody because of the role=\"img\" leaf, (b) pointer-events-none additionally suppresses the mouse tooltip, and (c) NFR-5 is therefore carried by whatever mechanism RF-01 lands on, not by the title. Keep the FR-12-outranks-hover-tooltip reasoning, which is sound.",
    "artifact_path": ".sdlc/runs/20260829-124312-feature-extend-attendee-avatar-badge/design.md",
    "acceptance": [
      "design.md section 8 no longer claims the per-avatar title reaches assistive technology.",
      "design.md sections 4 and 8 agree on the a11y-tree consequences of role=\"img\".",
      "The NFR-5 mechanism described in design.md matches what EventAttendeeBadge.tsx actually implements after RF-01."
    ]
  }
]
```

---

VERDICT: REQUEST_CHANGES
