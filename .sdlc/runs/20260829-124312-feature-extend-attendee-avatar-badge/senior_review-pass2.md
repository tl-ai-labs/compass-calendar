# Senior Code Review — PASS 2 — feature-extend — Attendee avatar badge on grid event cards

**Run:** `20260829-124312-feature-extend-attendee-avatar-badge`
**Mode:** brownfield · **Intent:** feature-extend · **Scope:** the 8 files touched by this run only
**Anchor:** `2d81253a` (working-tree only, nothing committed)
**Pass 1:** `senior_review.md` — VERDICT: REQUEST_CHANGES (3 MAJOR, 8 MINOR)
**This pass:** re-verification of RF-01..RF-04 against the code, plus a regression hunt on the fix.

Env-fixture gate (reviewer checklist item 8): still **not applicable** — client-side React, no
validating config boot in the change set. (Direct `bun test <file>` does throw
`PORT is required when API_BASEURL is not configured` from the pre-existing
`packages/web/src/common/constants/env.constants.ts`, but that is repo test-harness
infrastructure untouched by this run; the sanctioned entry point `bun test:web` supplies it.)

---

## 1. Verification method

I re-read every changed file at its current on-disk state rather than trusting the refinement
summary, re-derived the label arithmetic by hand, hashed the untouched files against
`provenance.json`, and re-ran the two badge test files through the project runner. I did not
re-run the full suite (reported: 2317 pass / 0 fail).

Independent commands run:

- `bunx biome check` over all 8 changed files → **"Checked 8 files in 30ms"**, zero diagnostics.
- `bun packages/scripts/src/testing/test-parallel.ts web -- EventAttendeeBadge.test.tsx attendee-status.test.ts` → **12 pass / 0 fail / 57 expect**.
- `sha256sum` on `EventDetailsSection.tsx` = `5b03f669…`, byte-identical to its `tp_codegen_008`
  `sha_after` in `provenance.json`. Same for `attendee-status.ts` (`16212cce…`, `tp_codegen_001`),
  `TimedEventCard.tsx` (`7d7a365e…`), `AllDayEventCard.tsx` (`612cbb2b…`).

---

## 2. Pass-1 MAJORs — status

### MAJOR-1 — NFR-5 conveyed by colour alone — **CLOSED**

`EventAttendeeBadge.tsx` L122-128 now reads:

```ts
const counts = countByStatus(attendees);
const countDetails = STATUS_ORDER.filter((status) => counts[status] > 0)
  .map((status) => `${counts[status]} ${attendeeStatusLabel(status)}`)
  .join(", ");
const groupLabel = `${attendees.length} ${
  attendees.length === 1 ? "guest" : "guests"
}: ${countDetails}`;
```

Re-derived by hand, not read off the tests:

| input | `counts` | `countDetails` | `groupLabel` |
|---|---|---|---|
| 1 × accepted | `{a:1,d:0,t:0,n:0}` | `"1 accepted"` | `"1 guest: 1 accepted"` |
| 1 × needsAction | `{a:0,d:0,t:0,n:1}` | `"1 hasn't responded"` | `"1 guest: 1 hasn't responded"` |
| 2 × accepted + 1 × needsAction | `{2,0,0,1}` | `"2 accepted, 1 hasn't responded"` | `"3 guests: 2 accepted, 1 hasn't responded"` |
| 1 each of all four | `{1,1,1,1}` | `"1 accepted, 1 declined, 1 tentative, 1 hasn't responded"` | `"4 guests: …"` |
| 4 attendees, 2 accepted + 2 declined (overflow case) | `{2,2,0,0}` | `"2 accepted, 2 declined"` | `"4 guests: 2 accepted, 2 declined"` |

Three properties I specifically checked:

1. **Zero counts really are omitted.** The `filter(counts[status] > 0)` runs *before* `.map`, so a
   zero-count status contributes no segment and no stray separator. The `join(", ")` cannot emit a
   leading/trailing comma because it operates on the already-filtered array. Confirmed for the
   1-guest case (3 of 4 statuses zero) and the 2-status case.
2. **The overflow case counts the whole group, not the visible slice.** `countByStatus(attendees)`
   is passed the full array (L122), while `visible = attendees.slice(0, avatarCount)` (L120) is used
   only for rendering. So at 50 attendees the label says `50 guests: …` with a full breakdown while
   only 2 avatars + `+48` render. That is the correct choice and it is not what a careless fix would
   have done (`countByStatus(visible)` would have been a silent under-count).
3. **Singular/plural on the noun is handled** (`attendees.length === 1 ? "guest" : "guests"`), and
   the whole label is still `@`-free by construction: no `displayName` and no `email` is
   interpolated into it — only integers and `attendeeStatusLabel(status)`, whose four possible
   outputs are `accepted / declined / tentative / hasn't responded`.

The second half of the fix also landed: both the per-avatar `title` and the overflow-chip `title`
are gone. `grep -niE "guest|tooltip|title"` over `EventAttendeeBadge.tsx` returns only the
line-clamp comments about the *card title* and the `"guest"/"guests"` ternary — no `title=` JSX
attribute anywhere in the file. `role="img"`, `aria-label`, and `pointer-events-none` are all
retained; no `tabIndex`, `onMouse*`, `onClick` or `stopPropagation` was introduced. The cap
arithmetic (L115-119) and `key={attendee.email}` are byte-unchanged from pass 1.

The pass-1 complaint is therefore fully answered: a screen-reader user now hears declined /
tentative / needsAction explicitly, and the markup no longer advertises a hover affordance it does
not provide. The "ring is decorative" position is now stated honestly in the component docblock
(L100-106) instead of being contradicted by inert `title`s.

### MAJOR-2 — AC-9 asserted against an imperceptible attribute — **CLOSED**

`EventAttendeeBadge.test.tsx` L88-106. `getByTitle("Guest, hasn't responded")` is gone. The
replacement asserts three perceivable facts: the avatar exists by test id, it contains an `<svg>`
(the person glyph), its `textContent` is `""`, and the root's accessible name is
`"1 guest: 1 hasn't responded"` via `getByRole("img", { name: … })`. `getByRole(..., {name})` goes
through the accessible-name computation, so this assertion is anchored to what AT actually
receives, not to a raw attribute.

Consistent with Gate 3 ruling A (accepted, not relitigated): "Guest" is no longer a rendered string
anywhere in `packages/web/src` — grep confirms zero occurrences in the badge, both cards, and the
shared style module.

`EventCard.test.tsx` L599-603 was updated in step
(`"2 guests: 1 accepted, 1 hasn't responded"`), and I re-derived that expectation independently
from the fixture at L581-592 (1 accepted + 1 needsAction) — it is correct, not merely
copy-pasted from the implementation.

### MAJOR-3 — FR-7 untested; `declined`/`tentative` never rendered — **CLOSED**

`EventAttendeeBadge.test.tsx` L160-175 iterates `AttendeeResponseStatusSchema.options` and asserts
`screen.getByTestId("event-attendee-avatar").className` contains `ATTENDEE_STATUS_DOT[status]`,
importing the map (L8) rather than re-typing the literals — so FR-4's single-definition property is
not quietly recreated in test code. All four enum members now render through a real avatar.

**Is it tautological? No.** The avatar `className` is `cn(<literal base>, ATTENDEE_STATUS_DOT[…])`
where the literal base is
`"flex size-4 shrink-0 items-center justify-center rounded-full p-0.5"`. None of the four token
strings (`bg-success`, `bg-error`, `bg-warning`, `bg-text-subtle`) is a substring of that base, and
none is a substring of any other, so:

- deleting `ATTENDEE_STATUS_DOT[attendee.responseStatus]` from L150 → all four iterations fail;
- hardcoding any single class (e.g. `"bg-success"`) → the other three iterations fail;
- mis-keying (e.g. always `ATTENDEE_STATUS_DOT.accepted`) → three iterations fail.

This is exactly the mutation sensitivity pass 1 asked for. (Derived statically rather than by
mutating the file, since this pass is read-only; the derivation is airtight because the class string
is a pure `cn` of one literal and one map lookup.)

Pass-1 MINOR-1 (stale `biome-ignore`) and MINOR-2 (false no-`@` comment) are also closed: biome
reports zero diagnostics across all 8 files, and L47-52's claim is now scoped to the rendered
monogram. Pass-1 MINOR-5 (untested width gates) is closed by the two new `EventCard.test.tsx` cases
— and both gates are now two-sided: width 80 / 110 assert the badge is absent, while the positive
tests at the default `position.width = 140` (L41-45) assert it is present, so raising *or* lowering
either constant breaks a test.

---

## 3. Regression hunt on the fix itself

**`countByStatus` complexity and allocation — acceptable, with a small delta.** L67-80 is a single
`for..of` over the list with a plain integer accumulator; still O(n), still no per-status
`.filter().length`, and the comment warning future maintainers off filters survived. New per-render
cost versus pass 1: one 4-field object literal, plus the `filter` → `map` → `join` chain's two
intermediate arrays (each ≤ 4 elements) and one joined string. Pass 1's `countAccepted` allocated
nothing and produced one template string. On a grid that renders many cards this is a real but tiny
delta, bounded by the four-member enum rather than by attendee count. No action needed; recorded
below as an informational note only.

**Label reads correctly for 1 guest** — `"1 guest: 1 accepted"` / `"1 guest: 1 hasn't responded"`.
Verified by derivation and asserted at `EventAttendeeBadge.test.tsx:104`.

**No stale comment left in the 8 changed source files** — with two small exceptions, below (N-3).
`grep -niE "guest|tooltip|title"` over the badge, both cards and `attendee-status.ts` turns up
nothing that still describes the removed `title`. `attendee-status.ts`'s docblock ("so colour is not
the only signal") remains true for both consumers.

**No hook / ordering regression.** The component still has no hooks, so the `return null` early exit
above the new `countByStatus` call is safe. `countByStatus` runs after the early return, so it is
never called with an empty array.

**FR-4 still holds.** `grep -rn '"bg-success"|"bg-error"|"bg-warning"|"bg-text-subtle"'` over
`packages/web/src` + `packages/core/src` (tests excluded) returns four hits, all inside
`packages/web/src/common/styles/attendee-status.ts`. Exactly one definition repo-wide.

**Packet 8's `EventDetailsSection` refactor is untouched.** `git diff 2d81253a` on that file is
still the pure deletion of the module-private map + label helper and the import swap (4 insertions,
11 deletions); `MAX_VISIBLE_ATTENDEES = 6` stayed local; no DOM, class string, `aria-label` or
`title` moved. Its current sha256 equals the `tp_codegen_008` `sha_after` recorded in
`provenance.json`, so no refinement packet reopened it.

---

## 4. New findings (all MINOR — none block)

### N-1 — the new group label is ungrammatical in the plural: "4 hasn't responded"

`EventAttendeeBadge.tsx:124` + `attendee-status.ts:18-19`

`attendeeStatusLabel` was written for a *per-attendee* context ("Ada, hasn't responded"), where the
verb agrees. RF-01 reuses it in an *aggregate* context, where `needsAction` now yields
`"4 guests: 4 hasn't responded"` — every all-unresponded event, which is the common case for a
freshly-invited meeting. The other three statuses aggregate fine ("2 accepted", "1 declined"). This
is a new, screen-reader-perceivable wording regression introduced by the fix, and it is not covered:
the only assertion on this branch is the singular `"1 guest: 1 hasn't responded"`, which reads
correctly, so the plural form is never exercised.

**Fix:** give the badge an aggregate phrasing for `needsAction` (e.g. `"4 awaiting response"` /
`"4 not responded"`) rather than changing `attendeeStatusLabel`, whose singular form is correct for
`EventDetailsSection`'s per-attendee row and is asserted there. Add one assertion covering a plural
`needsAction` label.

### N-2 — `STATUS_ORDER` is not tied to the enum's exhaustiveness guarantee

`EventAttendeeBadge.tsx:40-45`

`ATTENDEE_STATUS_DOT` (`Record<AttendeeResponseStatus, string>`) and `countByStatus`'s initializer
(`Record<AttendeeResponseStatus, number>`) both fail to compile if a member is added to
`AttendeeResponseStatusSchema` — that is FR-2's stated compile-time guarantee. The new
`STATUS_ORDER` tuple is hand-maintained `as const` and carries no such guarantee: a fifth status
would compile fine here and be *silently dropped from the label*, so an event whose attendees all
held the new status would announce `"3 guests: "` with an empty breakdown. The blast radius is
small (the two neighbouring compile errors drag a maintainer into this exact file), which is why
this is minor rather than major.

**Fix:** derive the order from `AttendeeResponseStatusSchema.options`, or add a compile-time
exhaustiveness assertion tying `STATUS_ORDER[number]` to `AttendeeResponseStatus` in both
directions.

### N-3 — two comments now overclaim in the opposite direction

`EventAttendeeBadge.tsx:50-52` — *"so no attendee-supplied text reaches the DOM at all - not merely
no '@'"* — and the docblock at L104-105 — *"no attendee-supplied text is written to the DOM"*.

Not quite true, and the same sentence's first half says so: the monogram **is** one
attendee-supplied code point, taken from `displayName` and regex-filtered to `\p{L}`/`\p{N}`. This
is the pass-1 MINOR-2 failure mode reappearing with the sign flipped — a load-bearing comment
sitting directly above the regex making an absolute claim a future maintainer could act on. The
accurate statement is "no attendee-supplied text beyond the single filtered monogram character".

Also in the same comment: *"The per-avatar title attribute was removed in RF-01"*. `RF-01` is an
SDLC packet id that exists only in `.sdlc/runs/…` (gitignored on most branches); it will be
meaningless to a reader of this file in six months. Comments in shipped source should describe the
behaviour, not the run that produced it.

### N-4 — `design.md` is corrected in §3.5 and §8 but still contradicts itself in four other places

RF-04 did exactly what it was scoped to do, and §3.5 (L282-295) and §8 (L665-692) are now accurate
and explicitly marked SUPERSEDED. But the stale claim survives elsewhere in the same document:

- **§3.6 element-structure listing (L306-345)** still shows the deleted
  `// biome-ignore lint/a11y/useSemanticElements` comment, `title={`${attendee.displayName ?? "Guest"}, ${statusText}`}`
  on each avatar, `title={`${overflowCount} more`}` on the chip, and the now-removed `statusText`
  line — with no supersession marker. This is the block a reader copies from.
- **§4 PII (L424-431)**: *"the per-avatar `title` **does** interpolate `displayName`"* — false now.
  Worse, it instructs *"do not broaden [the AC-8 test] to arbitrary displayNames, which would
  contradict the PII table"* — but RF-02 correctly added exactly that test
  (`"keeps @ out of the DOM when a display name looks like an email"`, L177-194), which is now safe
  precisely because the `title` is gone. Doc and test now give opposite instructions.
- **§4 (L437-438)**: *"The `biome-ignore … useSemanticElements` comment is required"* — it was
  deleted, and biome is clean without it. Same paragraph still quotes the old label shape
  `getByRole("img", { name: "3 guests, 2 accepted" })`.
- **§7 test matrix rows 8-9 (L795-796)** still specify `getByTitle("Guest, hasn't responded")`.
- **ADR-1 (L727-728 and L847-848)**: *"NFR-5 is satisfied independently by the `title` text and the
  root label"* — the `title` half is gone; the root label is now the sole channel.
- **File table row 4 (L39)** still lists "`Guest` fallback" as what the test file covers.

Documentation-only, in a run artifact rather than shipped code, so minor — but the whole point of
RF-04 was that the next reader not be misled, and six of these would still mislead them.

### N-5 — `requirements.md` was never annotated with Gate 3 ruling A

`requirements.md` L85 (FR-11: *"An attendee with `displayName === null` is referred to as `Guest`"*),
L155 (PII inventory: *"may appear in the badge's `title`. Null-safe fallback is `Guest`"*), L191
(AC-9: *"A test asserts an attendee with `displayName: null` surfaces as `Guest`"*), and L217/L235
all still state the pre-ruling behaviour. The waiver is recorded only in `design.md` §3.5. As the
acceptance record stands, FR-11 and AC-9 read as *unmet* rather than *deliberately superseded*.

**Fix:** append a one-line supersession note to FR-11, AC-9 and the `displayName` PII row pointing
at Gate 3 ruling A. Cheap, and it is what a later auditor will read first.

### N-6 — both `@`-freedom tests can pass vacuously

`EventAttendeeBadge.test.tsx` L63-86 and L177-194 assert only *absences*
(`container.textContent` has no `@`; no attribute contains `@`). If the component regressed to
rendering nothing at all, both would pass green. Every other test in the file happens to cover the
positive render, so the risk is low, but one `expect(screen.getByTestId("event-attendee-badge")).toBeInTheDocument()`
in each would make them non-vacuous.

On the substance of item 3 in my brief — *does the `@` test exercise a path where an `@` could have
appeared?* Under the current implementation, **no live path exists**: the only attendee-derived
value that reaches the DOM is the single regex-gated monogram (`"victim@corp.com"` → `"V"`), and
`attendee.email` is consumed by React as a `key` and never serialised. So it is a **regression
guard**, not a live-path exercise — its value is that it fails the moment anyone reintroduces a
`title`, `aria-label`, or `data-*` carrying `displayName` or `email`, which is precisely the change
RF-01 just reverted. It is written well for that job: it walks `container.querySelectorAll("*")`
and every `getAttributeNames()` value, not just `title`. The complementary `"@lice"` case at L147-158
covers the monogram-rejection path itself. I consider the pair meaningful.

### N-7 — informational: `design.md` edits are not recorded in `provenance.json`

The eleven `files_touched` entries cover only `packages/**` paths; RF-04's edit to
`.sdlc/runs/…/design.md` has no entry. Not a code issue, but it means `/mmo:revert` would not
restore that file, and the run record under-reports what the refinement phase changed.

---

## 5. Accepted follow-ups (explicitly NOT fixed in this run)

Recorded here so they are not silently lost; all reviewed and accepted as out of scope.

| id | item | location |
|---|---|---|
| MINOR-3 | `MAX_VISIBLE_ATTENDEES` is exported with no importer (re-verified: only self-references in `EventAttendeeBadge.tsx` L116-117); AC-7's cap-derived assertions remain hardcoded as `2` / `"+2"` / `"+4"` / `"+48"` | `EventAttendeeBadge.tsx:16`, `EventAttendeeBadge.test.tsx:44-61` |
| MINOR-4 | Five new layout constants live in a component file rather than `grid.constants.ts`; `MIN_EVENT_WIDTH_FOR_ATTENDEE_BADGE = 90` silently duplicates `MIN_EVENT_WIDTH_FOR_TIME_LABEL = 90` | `EventAttendeeBadge.tsx:16-38` |
| MINOR-6 | Test name still describes the control, not the substance (`"keeps the timed title line clamp unchanged when an event has no attendees"` — it actually locks the 3 → 2 drop) | `EventCard.test.tsx:761` |
| MINOR-7 | `showAttendeeBadge` omits the `!isPlaceholder` guard that `showRepeatIcon` applies one line above; a drag ghost renders the badge but not the repeat icon (re-verified unchanged) | `TimedEventCard.tsx:122-138`, `AllDayEventCard.tsx:80-85` |
| MINOR-8 | NFR-7 says O(cap); `countByStatus` is O(n). Unavoidable for an accurate group count, allocation-sane, but requirement text and implementation still disagree and neither doc acknowledges it | `EventAttendeeBadge.tsx:67-80` |
| — | `biome.json` needs `"!.sdlc"` in `files.includes`; `biome.json` is off-limits under this run's write contract | `biome.json` |
| — | Pre-existing, out of scope: provider-sourced `href={conference.url}` where the schema's `z.url()` accepts a `javascript:` scheme | `EventDetailsSection.tsx:41` |

---

## 6. Verdict rationale

All three pass-1 MAJORs are genuinely closed, and closed by the right mechanism rather than by
weakening an assertion: the accessible status channel now carries strictly more information than
the inert `title` ever did, the AC-9 assertion is anchored to the accessible-name computation, and
the FR-7 table test is provably mutation-sensitive. No assertion that existed at anchor was edited
or deleted. The fix did not disturb the two highest-risk areas — the cap arithmetic and packet 8's
refactor are byte-identical, verified by hash — and it did not introduce a lint, type, or
complexity regression.

What remains is genuinely minor: one prose-quality wart the fix introduced (`"4 hasn't responded"`),
one hand-maintained tuple that sits outside the enum's compile-time guarantee, two comments that
overclaim in the safe direction, and run-artifact documentation that is now correct in the two
sections RF-04 targeted while still contradicting itself in several others. None of these changes
what ships, and none warrants another refinement round before Gate 4 — but N-1 and N-2 are worth a
cheap follow-up packet, and N-4/N-5 should be swept before this run's artifacts are treated as the
record of what was built.

---

VERDICT: APPROVE_WITH_NITS
