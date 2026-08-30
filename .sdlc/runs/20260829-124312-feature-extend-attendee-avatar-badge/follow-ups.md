# Follow-ups — run 20260829-124312-feature-extend-attendee-avatar-badge

Consolidated from all three Gate 3 review passes (senior + security, pass 1/2/3).
**Nothing here was fixed in this run.** Gate 3 was accepted with these deferred.

- Run: `20260829-124312-feature-extend-attendee-avatar-badge` (brownfield, `feature-extend`)
- Anchor: `2d81253a` — **nothing committed**
- Policy: `opus-plus-flash-v37`, `auth_mode=estimated`
- Feature: attendee avatar badge on grid event cards + shared RSVP status module

Severity is the reviewers' own. "Blocking" = none of these; all were explicitly accepted.

---

## A. Correctness / maintainability (source changes — each needs a mini-gate)

### FU-1 — Monogram comment says "characters", must say "code points"
**Severity:** LOW (security, pass 3). **File:** `packages/web/src/grid/components/EventAttendeeBadge.tsx:42-47`

The comment asserts *"exactly one attendee-supplied character can reach the DOM"*. False:
`String.prototype.toUpperCase()` is not length-preserving. Verified by execution:

| input | passes `/^[\p{L}\p{N}]$/u` | `toUpperCase()` | length |
|---|---|---|---|
| `ß` | yes | `SS` | 1 → 2 |
| `ﬃ` | yes | `FFI` | 1 → 3 |
| `ŉ` | yes | `ʼN` | 1 → 2 |

The **security bound is intact** — one whitelisted *source code point*, and no `@` is reachable in
any case. Only the character-count wording is wrong. Reword to code points.

> **This comment has now been wrong in three consecutive review passes.** Pass 1: claimed the
> `title` was exposed to assistive tech (false — `pointer-events-none` + `role="img"` closed both
> channels). Pass 2: claimed *no* attendee-supplied text reaches the DOM (false — the monogram
> does). Pass 3: claims exactly one character (false — `toUpperCase` expands). Whoever picks this
> up should treat the comment as load-bearing and verify the claim by execution, not by reading.

### FU-2 — Display order is implicit in object-literal key order
**Severity:** nit N-8 (senior, pass 3). **File:** `packages/web/src/common/styles/attendee-status.ts`

`ATTENDEE_STATUS_DISPLAY_ORDER = Object.keys(ATTENDEE_STATUS_COUNT_NOUN)`. A purely cosmetic
re-sort of the noun map's keys would silently change screen-reader output. It is guarded by a test
(`attendee-status.test.ts`, "orders the display sequence most-actionable first") but **not** by the
type system. Consider an explicit ordered tuple validated against the Record, or a comment marking
key order as load-bearing.

### FU-3 — Stale "No cast anywhere." comment
**Severity:** nit N-9 (senior, pass 3). **File:** `packages/web/src/grid/components/EventAttendeeBadge.tsx:83`

RF-05 introduced one narrow `as AttendeeResponseStatus[]` cast in `attendee-status.ts`, so the
props docblock's blanket "No cast anywhere." now misleads. Note the senior's finding that NFR-3 *as
written* (`requirements.md:136-138`) scopes "without a cast" to the badge's **prop type**, which
remains cast-free — so the code is compliant and only the prose is wrong.

### FU-4 — Freeze the display order
**Severity:** INFO (security, pass 3). **File:** `packages/web/src/common/styles/attendee-status.ts`

The deleted `STATUS_ORDER` was `as const` (readonly tuple). `ATTENDEE_STATUS_DISPLAY_ORDER` is
typed mutable and is not frozen. `Object.freeze` + `readonly` typing would make the
"name-free by construction" invariant — currently verified by grep — enforceable by the compiler.
Offsetting note: the refactor *gained* compile-time exhaustiveness that the tuple never had.

### FU-5 — MINOR-3: unused `MAX_VISIBLE_ATTENDEES` export
Exported from `EventAttendeeBadge.tsx` but consumed nowhere outside the module. Un-export or use.

### FU-6 — MINOR-4: constants location and a near-duplicate
Badge constants live in the component file rather than `grid.constants.ts` alongside their peers,
and `MIN_EVENT_WIDTH_FOR_ATTENDEE_BADGE` duplicates the existing `MIN_EVENT_WIDTH_FOR_TIME_LABEL`.
Decide whether they should be one constant.

### FU-7 — MINOR-6: misleading test name
Test name does not describe what the body asserts. Rename.

### FU-8 — MINOR-7: missing `!isPlaceholder` guard
`showAttendeeBadge` omits the `!isPlaceholder` guard that its immediate neighbour applies. Confirm
whether a placeholder/draft card should render the badge; if not, add the guard.

### FU-9 — `RF-01` packet id left in a test comment
**File:** `packages/web/src/grid/components/EventAttendeeBadge.test.tsx:101`
Shipped comments should not cite run-internal packet ids. **The user reviewed this and chose to
leave it** — recorded for completeness, not as an oversight.

---

## B. Security / privacy

### FU-10 — PostHog session replay has no masking (MEDIUM-3 → LOW)
**Severity:** LOW (reduced at pass 2, unchanged at pass 3). **File:** `posthog.bootstrap.ts`

No `disable_session_recording`, no `maskAllText`, no `maskTextSelector`; `grep` for
`ph-no-capture|maskAllText|maskTextSelector|disable_session_recording` across `packages/web/src`
returns nothing. Attendee *identity* is now out of the DOM, but rrweb still serializes the group
`aria-label`, one monogram initial per avatar, and the `bg-success`/`bg-error` classes that encode
RSVP positionally.

**Two-part fix:** add `ph-no-capture` to the badge root, **and** confirm the project's
session-recording toggle out of band — it is server-side and not verifiable from this repo.
Note the pass-3 finding that the richer label did **not** move the needle: same counts, same
structure, and `"hasn't responded"` → `"no response"` is three characters *shorter*.

### FU-11 — `EventDetailsSection.tsx:41` accepts a `javascript:` scheme
**Severity:** flagged both passes as pre-existing / out of scope.

`href={conference.url}` is provider-sourced and `z.url()` accepts `javascript:`. React 18 only
warns rather than blocking. **Untouched by this run** but adjacent to it; deserves its own ticket.

### FU-12 — LOW-1: `key={attendee.email}` can print an email to console
Duplicate attendee emails would trigger React's dev-mode duplicate-key warning, which includes the
key value — i.e. an email address in the console. Dev-only.

---

## C. Performance

### FU-13 — LOW-2: `countByStatus` scans the uncapped array
Runs over **all** attendees (correct — the label must report totals, not the visible slice), and
allocates a counts object plus a `filter`/`map`/`join` chain on every render. On a 50-attendee
event only 2 avatars render but all 50 are counted. Memoize if the grid's render profile warrants.

---

## D. Tooling / repo hygiene

### FU-14 — `biome.json` needs a `!.sdlc` exclude
**Out of scope this run:** `biome.json` is off-limits in the write contract and Gate 2 explicitly
left it untouched.

`bun lint` is `biome check .`, and `biome.json`'s `files.includes` has no `!.sdlc` entry while
`.sdlc/runs/` is not gitignored on this branch. So biome lints run bookkeeping — including
`.sdlc/runs/*/backups/*.ts(x)`, which are verbatim pre-edit copies — as if it were source. This
cost two separate remediation rounds during the run. Adding `"!.sdlc"` to `files.includes` fixes it
permanently.

### FU-15 — npm-audit caveat (informational, no action)
`npm audit --omit=dev` is **unrunnable** here (bun workspace, no `package-lock.json` → `ENOLOCK`).
Substitute `bun audit --prod`: **69 vulnerabilities / 24 high, all pre-existing transitive
(nodemailer, postcss, ws/jsdom), 0 introduced by this run** — which adds no dependencies. That
figure includes build/test trees, so **do not compare it against an `npm audit --omit=dev`
baseline.**

---

## Process lessons (not code tickets)

1. **A load-bearing comment was wrong in all three passes.** See FU-1. Each pass "fixed" it and
   introduced a new false claim in the opposite direction. Claims about what reaches the DOM should
   be verified by execution and pinned by a test, not restated in prose.
2. **The orchestrator fabricated two provenance sha values and self-caught.** While backfilling the
   N-10 record, it wrote hashes for which it had only ever observed the leading 13 characters,
   padding the remainder. Caught before proceeding; both values recomputed and replaced, and all 8
   tracked paths re-verified as `sha_after == disk`. Root cause: reconstructing a value from a
   truncated console echo instead of recomputing it. Never transcribe a hash — always recompute.
3. **Dry-run pre-formatting outside the repo is unsound.** Running `biome check --write` on a copy
   in a scratch dir does not load the project's assist rules, so an `organizeImports` error passed a
   "clean" dry run and landed in source. Format inside the repo, or re-run the check after applying.
4. **Provenance must bracket *every* write.** The N-10 gap came from applying a follow-up formatting
   `Edit` after the `--after` call had already run.
