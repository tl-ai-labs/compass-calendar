# Senior Code Review — PASS 3 (spot-check addendum) — Attendee avatar badge on grid event cards

**Run:** `20260829-124312-feature-extend-attendee-avatar-badge`
**Anchor:** `2d81253a` (working tree only, nothing committed)
**Pass 2:** `senior_review-pass2.md` — APPROVE_WITH_NITS (N-1 grammar, N-2 exhaustiveness, N-3 comment overclaim)
**Scope of this pass:** did RF-05 close N-1/N-2/N-3, and did anything regress. Not a re-review.

Method: read the current on-disk state of the six files RF-05 could have touched, re-derived the
label arithmetic by hand, hashed the three files RF-05 should *not* have touched against
`provenance.json`, and ran the two badge test files through the project runner
(`bun packages/scripts/src/testing/test-parallel.ts web -- <paths>` → **16 pass / 0 fail /
78 expect**, up from 12/57 at pass 2). `bunx biome check` over the five changed files →
"Checked 5 files in 35ms", zero diagnostics. Full suite not re-run.

---

## 1. N-1 (aggregate grammar) — CLOSED

`attendee-status.ts:28-36` adds `ATTENDEE_STATUS_COUNT_NOUN: Record<AttendeeResponseStatus, string>`
with `needsAction: "no response"`; `EventAttendeeBadge.tsx:123` interpolates that map, not
`attendeeStatusLabel`. `grep` confirms `attendeeStatusLabel` no longer appears anywhere in
`EventAttendeeBadge.tsx` — its only remaining production caller is `EventDetailsSection.tsx:69`.

Re-derived by hand (not read off the tests): 4 × needsAction → `"4 guests: 4 no response"`;
1 accepted + 1 declined + 1 needsAction → `"3 guests: 1 accepted, 1 declined, 1 no response"`;
1 × needsAction → `"1 guest: 1 no response"`. The zero-filter still runs before `.map`, so no stray
separators, and `countByStatus(attendees)` still takes the full array, not `visible` — the overflow
case still counts the whole group.

**Regression lock is non-tautological.** `EventAttendeeBadge.test.tsx:160-192` asserts through
`getByRole("img", { name: … })`, i.e. the accessible-name computation, against two literal strings
typed out in the test rather than derived from the map. Reverting `EventAttendeeBadge.tsx:123` to
`attendeeStatusLabel(status)` produces `"4 guests: 4 hasn't responded"` and
`"… 1 hasn't responded"`, neither of which matches, so both halves fail. Deleting the `filter` also
fails (zero-count segments appear). It is a real lock, and it is the right one: it is written against
the *rendered* label, not against `ATTENDEE_STATUS_COUNT_NOUN`, so it cannot be satisfied by editing
the map alone.

## 2. N-2 (exhaustiveness) — CLOSED, and the ordering claim holds

`STATUS_ORDER` is gone — `grep -rn "STATUS_ORDER" packages/` returns only the new
`ATTENDEE_STATUS_DISPLAY_ORDER` name. Order now comes from `Object.keys(ATTENDEE_STATUS_COUNT_NOUN)`
(`attendee-status.ts:47-49`), and the `Record<AttendeeResponseStatus, string>` annotation is a real
anchor in both directions: a missing key is a "missing properties" error, an extra key is an excess-
property error. So a fifth enum member cannot be silently dropped from the label — the failure mode
pass 2 described is structurally gone.

**Ordering verified independently.** `AttendeeResponseStatusSchema` is declared
`["needsAction", "accepted", "declined", "tentative"]` (`event-attendance.contracts.ts:14-19`).
The noun map's key order is `accepted, declined, tentative, needsAction`. These differ in the first
position, which is what makes the check meaningful. Two places prove the map's order (not the enum's)
is what reaches the label:

- `attendee-status.test.ts:56-70` asserts `toEqual(["accepted","declined","tentative","needsAction"])`
  **and** `not.toEqual(AttendeeResponseStatusSchema.options)` **and** containment of every option.
- `EventAttendeeBadge.test.tsx:177-191` feeds attendees in **needsAction-first** order and asserts
  `"3 guests: 1 accepted, 1 declined, 1 no response"`. If the order were inherited from
  `.options`, the label would be `"1 no response, 1 accepted, 1 declined"` and this fails. This is
  the assertion that actually discriminates, and it is at the rendered-label level.

## 3. N-3 (comment overclaim) — CLOSED

`EventAttendeeBadge.tsx:43-49` now states the precise invariant ("exactly one attendee-supplied
character can reach the DOM — the uppercased first code point — and only when it matches `\p{L}` or
`\p{N}`") and carries an explicit do-not-restate warning naming the prior overclaim. The docblock at
L102-103 matches ("no attendee-supplied string is written to the DOM beyond the single whitelisted
monogram character; attendee email is used only as a React key"). Both are now accurate. `RF-01` is
gone from the component. Both are still load-bearing and still correct against the code above them.

## 4. Regression hunt

- **`attendeeStatusLabel` unchanged** (`attendee-status.ts:18-19`, verbatim), still consumed at
  `EventDetailsSection.tsx:69` for both the row `aria-label` and the dot `title`, and still covered by
  a render assertion — `EventForm.test.tsx:1482` `getByLabelText("guest@example.com, declined")`.
  Not dead, not broken.
- **No collateral edits.** `EventDetailsSection.tsx` (`5b03f669…`), `TimedEventCard.tsx`
  (`7d7a365e…`) and `AllDayEventCard.tsx` (`612cbb2b…`) are byte-identical to their pass-2 hashes and
  to `provenance.json`. The cap arithmetic, the width/height gates and packet 8's refactor are
  untouched.
- **1-guest singular still reads right:** `"1 guest: 1 no response"` / `"1 guest: 1 accepted"`,
  asserted at `EventAttendeeBadge.test.tsx:104`.
- **`EventCard.test.tsx:601`** now expects `"2 guests: 1 accepted, 1 no response"`; re-derived from
  the fixture at L581-592 (1 accepted + 1 needsAction) — correct, not copy-pasted.
- **No new dead code.** All three exports of `attendee-status.ts` have live importers. (The
  pre-existing `MAX_VISIBLE_ATTENDEES` orphan is carried forward, unchanged.)
- **No stale comment introduced by RF-05** in the changed source — with the two exceptions in §6.

## 5. The single narrow cast — I agree with the trade

`Object.keys(ATTENDEE_STATUS_COUNT_NOUN) as AttendeeResponseStatus[]` is acceptable, and I would have
approved it without the escalation. Reasons:

1. **It is provably sound, not merely convenient.** The object is an *object literal* annotated
   `Record<AttendeeResponseStatus, string>`. TypeScript rejects a missing key and rejects an extra
   key, so at runtime `Object.keys` returns exactly the union's members. The assertion restates a
   fact the compiler already enforces one line above; it is not papering over an unknown.
2. **It does not violate the actual requirement.** NFR-3 (`requirements.md:136-138`) says the
   *badge's prop type* "must accept `readonly Attendee[] | undefined` without a cast". That still
   holds — `EventAttendeeBadgeProps` is cast-free. "No cast anywhere" is design.md editorial prose
   (L198), not the normative text.
3. **It is bounded and locked.** One expression, in a 49-line module, directly under a comment that
   explains exactly why, and two runtime tests pin the resulting array's contents and length.

I also agree with rejecting the two alternatives as described: `satisfies` does not prove totality,
and an `Exclude<>` guard needing a dummy binding trades a sound cast for lint suppression. For the
record there is a third, cast-free option that was not on the table — sort
`AttendeeResponseStatusSchema.options` by a `Record<AttendeeResponseStatus, number>` rank map — which
is exhaustive by construction *and* cast-free, but it introduces a second enum-keyed map to keep in
sync purely to avoid an assertion the compiler has already validated. Not worth it. **No change
requested.**

## 6. New nits (none blocking)

- **N-8 — display order is now implicit in object-literal key order.** `ATTENDEE_STATUS_DISPLAY_ORDER`
  derives ordering from insertion order of `ATTENDEE_STATUS_COUNT_NOUN`, so an edit that reads as
  purely cosmetic (alphabetizing the map, a codemod, a merge resolution) silently reorders
  screen-reader output. The comment at `attendee-status.ts:38-46` says so, and
  `attendee-status.test.ts:57-62` catches it, so the risk is contained — but the guard is a test, not
  the type system, which is a slightly weaker footing than the exhaustiveness guarantee it sits
  beside. Recording, not requesting.
- **N-9 — two doc/comment strings are now stale.** `EventAttendeeBadge.tsx:83` still ends the props
  docblock with "No cast anywhere."; scoped to the prop type it is true, but a reader now finds a cast
  in the module it imports from. Suggest "No cast at the call site." Separately, `design.md:292` and
  `design.md:805` still quote the pre-RF-05 label `"1 guest: 1 hasn't responded"`, and design.md
  records neither the new aggregate-noun map nor the cast deviation — an extension of pass-2 N-4, same
  fix (sweep design.md once before the artifacts are treated as the record).
- **N-10 — `provenance.json` sha_after drift on one file.** `attendee-status.ts` on disk is
  `925fa635…`; the `tp_rf_005` entry records `b4e3647a…`. Its mtime (01:35:56) is 8s *after*
  provenance was written (01:35:48), and the on-disk multi-line `Record<...>` generic is
  formatter-shaped — almost certainly a post-write format pass that was not recorded. The other five
  RF-05 hashes match exactly. Content is correct and lints clean, and `backup_path` is intact so
  `/mmo:revert` still works; the defect is that the run record no longer describes what is on disk.
  Same family as pass-2 N-7.

## 7. Carried forward, still not fixed (accepted, not relitigated)

MINOR-3 unused `MAX_VISIBLE_ATTENDEES` export · MINOR-4 constants location /
`MIN_EVENT_WIDTH_FOR_ATTENDEE_BADGE` duplicating `MIN_EVENT_WIDTH_FOR_TIME_LABEL` · MINOR-6 test name
(`EventCard.test.tsx:761`) · MINOR-7 missing `!isPlaceholder` guard · MINOR-8 NFR-7 O(cap) vs O(n) ·
`biome.json` needs `"!.sdlc"` · `EventDetailsSection.tsx:41` `javascript:`-scheme href (pre-existing) ·
LOW-1 duplicate-key warning · LOW-2 uncapped scan · posthog masking gap · pass-2 N-4/N-5 doc sweeps ·
**the `RF-01` packet id at `EventAttendeeBadge.test.tsx:101`** (user reviewed and chose to keep;
cosmetic follow-up only).

Also noted, pre-existing and unchanged by RF-05: the per-attendee `"hasn't responded"` prose is
asserted only in `attendee-status.test.ts`, never in an `EventDetailsSection` render test. Not a
regression; mentioning so it is not mistaken for one later.

## 8. Rationale

All three pass-2 nits are closed in the code, not just in the summary, and closed by the stronger
mechanism in each case: a separate aggregate map rather than a special-case in the shared label
helper; an ordering derived from the same annotated Record that carries exhaustiveness rather than a
parallel hand-maintained tuple; and comments that now name the precise invariant plus the overclaim
not to repeat. The N-1 lock discriminates against the exact string that shipped, and the ordering
test discriminates against the enum's own order — neither is tautological. Nothing regressed: the
three untouched files are hash-identical, `attendeeStatusLabel` is intact and still exercised at its
remaining call site, and the singular case still reads correctly. The one deliberate cast is sound,
narrow, documented and does not violate NFR-3 as written.

What remains is one implicit-ordering observation, two stale strings, and a provenance hash that
drifted from disk. None affects what ships.

---

VERDICT: APPROVE_WITH_NITS
