# Security Review — feature-extend / attendee badge (brownfield, changed-files scope)

**Run:** `20260903-000000-feature-extend-attendee-badge-sdk`
**Baseline:** `2d81253a`
**Scope:** the 8 files in `provenance.json` only. `packages/backend`, `packages/sync`,
`packages/core` were not audited.
**Reviewed bytes:** `EventCard.test.tsx` at `sha256:e07acae0…` (the on-disk state; see S-7 — this is
*not* the hash provenance records for the last completed write).

## Verdict: `pass_with_notes`

The PII posture of the shipped code is **sound, and deliberately so**. Every claim in D-5 that I
could check against the code holds: no email and no display name reaches the DOM on either card, on
any code path, in any attribute, including the `sr-only` span that is the highest-exposure surface
this change creates. The badge is counts-and-status only, and that is a real property of
`attendeeStatusSummary` (`attendee-status.util.ts:43-61`), not a comment.

Two findings are worth blocking on, and neither is a leak. **The card-level PII regression guard
(C-10) is vacuous** — it renders a card at a width where the badge is suppressed, so it asserts the
absence of an email from a card that has no badge on it (S-1). And **this run's provenance record
does not match what is on disk**, so the run is not cleanly revertible and the recorded hashes
cannot be used to attest what was reviewed (S-7).

---

## Findings

| ID | Severity | Location | Issue |
|---|---|---|---|
| S-1 | Medium | `packages/web/src/grid/components/EventCard.test.tsx:840-858` | The only card-level "no email in DOM" test renders a card where the badge is suppressed; it cannot fail |
| S-7 | Medium | `.sdlc/runs/…/provenance.json:90-108` + `backups/` | Recorded `sha_after` does not match disk; the backup is byte-identical to the current file; a trailing entry has `written_at: null`. Revert is not safe and provenance cannot attest the reviewed bytes |
| S-2 | Low | `packages/web/src/grid/components/AttendeeBadge.tsx:129-131` | The `sr-only` description is safe **only** because it is counts-only; PostHog autocapture/replay is live and unmasked, so this property is load-bearing and unpinned at the telemetry layer |
| S-3 | Low | `packages/web/src/interaction/dom/draft-event.clone.ts:4-10` | The drag-ghost id/`aria-describedby` strip is correct but asserted by no test; the badge now depends on it |
| S-4 | Informational | `packages/web/src/grid/components/AttendeeBadge.tsx:120-127` | `+N` publishes an exact, unbucketed headcount on a permanently-visible surface |
| S-5 | Informational | `packages/web/src/common/utils/attendee-status.util.ts:11-16, 48-52` | Provider-sourced `responseStatus` indexes plain objects; inherited-key lookups resolve (`"constructor"`), harmless today |
| S-6 | Blocked | dependency audit | `npm audit --omit=dev` could not be run in this environment — reported as NOT RUN, not as clean |

---

### S-1 — Medium — the card-level PII guard is a test that cannot fail

**Location:** `packages/web/src/grid/components/EventCard.test.tsx:840-858` (test `C-10: no email in
card DOM`).

C-10 renders `TimedEventCard` with `position={position}` — the shared fixture at
`EventCard.test.tsx:41-45`, which is `{ height: 60, width: 140 }`. Trace the gate at
`TimedEventCard.tsx:230-236`:

```ts
const showAttendeeBadge =
  !isPlaceholder &&
  !isCompactEvent &&
  position.width >= MIN_EVENT_WIDTH_FOR_ATTENDEE_BADGE &&           // 140 >= 140  ok
  (!showTimeLabel ||
    position.width >= MIN_EVENT_WIDTH_FOR_BADGE_WITH_TIME_LABEL) && // 140 >= 170  FALSE
  hasAttendeesToShow(event.attendees);
```

`showTimeLabel` (`TimedEventCard.tsx:129-133`) is **true** for C-10's event: it is not all-day, it
is a 2099 date so `!isInPast`, `height 60 >= MIN_EVENT_HEIGHT_FOR_TIME_LABEL (36)` and
`width 140 >= MIN_EVENT_WIDTH_FOR_TIME_LABEL (90)`. The D-7 conjunction therefore evaluates false
and **no badge is rendered at all**. `expect(card.outerHTML).not.toContain("secret@example.com")`
passes against a card that never had the opportunity to contain it.

This is not inference from arithmetic alone — the same test file proves it. `C-18`
(`EventCard.test.tsx:1158-1186`) renders a timed card at `width: 150, height: 60` with one attendee
and asserts `card.querySelector("[data-attendee-badge]")` **is null**, and that test is green
(60 pass / 0 fail on the three changed test files, `bun run test:web` scoped to them). C-10's card
is 10px narrower with everything else equal, so it is strictly further inside the suppressed region.

> **RESOLVED after this review was written (Gate 3).** The analysis above was correct at the time and
> the trace is retained as the evidence for it. Two changes since:
>
> 1. **S-1 is fixed and the fix is proved, not asserted.** C-10 now renders at `badgePosition`
>    (width 190) and calls a new `expectBadge(card)` precondition first, so the PII assertion runs
>    against a card that demonstrably has a badge. Verified by mutation: making `AttendeeBadge`
>    return `null` makes **C-10 fail**, along with C-4, C-8 and C-14 — the other three cases this
>    review and the senior review both identified as vacuous.
> 2. **The constant quoted above changed.** `MIN_EVENT_WIDTH_FOR_BADGE_WITH_TIME_LABEL` is now
>    **150**, not 170 (senior-review finding R-6, decided by the user at Gate 3; derivation in
>    `change_plan.md` D-7a). The `// 140 >= 170 FALSE` line therefore reads `140 >= 150 FALSE`
>    today — the conclusion for C-10's original 140px fixture is unchanged, which is why the fix was
>    to move the fixture rather than to move the gate. C-18 and C-20 moved 150 → 145 to stay inside
>    the narrowed suppression band, and the mutation proof was **re-run after** the gate change
>    specifically to confirm it had not re-vacuated this guard: 12 failures, C-10 among them.

**Risk.** The runtime property is fine today. What is missing is the tripwire. If someone later adds
a `title={...}` tooltip to the card root, folds attendee text into `aria-label`, or changes
`attendeeStatusSummary` to `displayName ?? email`, C-10 is the test named for catching it at the
card level — and it would stay green. `AttendeeBadge.test.tsx:247-265` (B-10) and
`attendee-status.util.test.ts:114-135` (U-9) do cover the component and util levels and *are* live,
so the blast radius of this defect is the card-wiring layer only.

**Fix.** Change `position={position}` to `position={badgePosition}` (`EventCard.test.tsx:597`,
width 190) in C-10, and add a badge-presence assertion as a sensitivity control *before* the two
`not.toContain` assertions — the same pattern D-6 step 7 already applies to the byte-identity guard.
Without that control the test can silently re-rot.

**Same defect, non-security, in the same family:** `C-4: card name unchanged with a badge present`
(`EventCard.test.tsx:659-676`) also uses `position` (140). It is named "with a badge present" and no
badge is present, so it is currently a duplicate of the no-badge name assertion. Worth fixing in the
same edit; not a security finding.

---

### S-7 — Medium — provenance does not match disk; the run is not cleanly revertible

**Location:** `.sdlc/runs/20260903-000000-feature-extend-attendee-badge-sdk/provenance.json:90-108`
and `.sdlc/runs/…/backups/packages__web__src__grid__components__EventCard.test.tsx`.

Three inconsistencies, all on `packages/web/src/grid/components/EventCard.test.tsx`:

1. **The recorded `sha_after` is wrong.** Entry `tp_debug_009` (`:93`) records
   `sha_after: sha256:9f813a72…` as the result of the last completed write. `sha256sum` of the file
   on disk is `e07acae0…`. Nothing has touched the file during this review — its mtime is
   `2026-09-04 07:29:58Z`, i.e. ~56 seconds after `tp_debug_009`'s `written_at` of `07:29:02Z`, and
   six minutes before I began reading it. So the divergence was there before the review, not caused
   by it.
2. **The backup is not a pre-write snapshot.** `backups/packages__web__src__grid__components__EventCard.test.tsx`
   hashes to `e07acae0…` — byte-identical to the **current** file. Restoring that backup would be a
   no-op. `tp_debug_009` is the only entry in the whole run that carries a non-null `backup_path`, so
   the one file with apparent revert coverage has none in practice.
3. **A trailing entry is unresolved.** `tp_debug_010` (`:99-108`) has `sha_after: null` and
   `written_at: null`, with `sha_before: e07acae0…`. It is either an aborted write or an operation
   that completed without recording. Either way the ledger's last word on this file is a write that
   never reports what it produced.

**Risk.** Two concrete consequences, neither hypothetical: (a) `/mmo:revert` on this run cannot
restore `EventCard.test.tsx` to its pre-run state — the backup is the post-run content and the other
seven entries have `backup_path: null`; (b) provenance cannot be used to attest *which* bytes were
security-reviewed, because the hash it records for this file is not the hash of the file that exists.
I reviewed the on-disk content (`e07acae0…`), which is the content that will ship; the ledger simply
does not agree with it.

**Fix.** Recompute and correct `sha_after` for `tp_debug_009` from disk, resolve or delete the
dangling `tp_debug_010` entry, and re-take the backup from the true pre-run state
(`git show 2d81253a:packages/web/src/grid/components/EventCard.test.tsx` is available and is the
authoritative pre-run content, since the file is tracked). Until then, treat this run as
**revert-unsafe** and roll back with `git checkout 2d81253a -- <path>` plus deletion of the four
untracked new files, not with the run's backup.

---

### S-2 — Low — the `sr-only` text is safe, and that safety is load-bearing and unpinned

**Location:** `packages/web/src/grid/components/AttendeeBadge.tsx:129-131`, rendering
`attendeeStatusSummary` from `attendee-status.util.ts:43-61`.

The brief asked me to treat this as the highest-leverage item, and it is. The span's text is part of
`element.textContent`, so it lands in `container.innerHTML` dumps, `prettyDOM` output on any failing
card test, accessibility-tree exports, and anything that scrapes the grid. I verified the contents
are counts and status words only:

- `attendeeStatusSummary` reads `attendee.responseStatus` and `attendees.length`. It never reads
  `displayName` or `email` — those identifiers do not appear anywhere in the util file.
- The status vocabulary is closed: `ATTENDEE_STATUS_SUMMARY_ORDER` (`:24-29`) is a fixed 4-element
  literal, and `parts` is built by *filtering that list*, not by iterating attendee-supplied keys.
  A provider status outside the enum contributes to `attendees.length` but cannot contribute a
  token to the sentence. There is no path by which attendee-controlled text reaches the output.
- Empirically green: `C-3` (`EventCard.test.tsx:634-657`) resolves the card's `aria-describedby`
  through `document.getElementById` and asserts the description is exactly
  `"3 guests: 2 accepted, 1 hasn't responded"`.
- `U-9` (`attendee-status.util.test.ts:114-135`) asserts the summary contains no `"@"`, neither
  display name and neither email — and it is a test that *can* fail: a naive
  `displayName ?? email` implementation fails it immediately.

**So why is this a finding at all.** This repo ships PostHog, initialised unconditionally when
enabled (`packages/web/src/auth/posthog/posthog.bootstrap.ts:19-53`) with `person_profiles: "always"`,
default autocapture, and **no** `session_recording` masking config, no `maskAllText`, no
`maskTextSelector`. Session replay is a server-side project toggle that is invisible in this repo, so
I cannot tell from the code whether the grid DOM is being recorded. If it is, every `sr-only` string
on screen goes to a third-party processor verbatim. The `ErrorBoundary`
(`packages/web/src/components/ErrorBoundary/ErrorBoundary.tsx:45-51`) additionally ships
`componentStack` to `captureException` — component names only, no props, so that path is clean.

This makes D-5 the difference between "counts to PostHog" and "an entire week of attendee names and
email addresses to PostHog". The decision is correct and I want it to stay correct.

**Fix (defensive, not blocking).** Either (a) add `data-ph-no-capture` to the badge root alongside
`ATTENDEE_BADGE_ATTRIBUTE`, so the surface is masked regardless of what a future edit puts in the
span, or (b) at minimum add a one-line comment at `attendee-status.util.ts:43` naming PostHog as the
concrete exposure channel, so the next person to consider `displayName ?? email` sees the cost. The
existing comment (`:35-38`) says "every DOM snapshot" — true, but it does not name the live
third-party sink.

---

### S-3 — Low — the drag-ghost strip is correct but nothing asserts it

**Location:** `packages/web/src/interaction/dom/draft-event.clone.ts:1-17`, called from the single
site `packages/web/src/grid/interaction/dom.ts:79`.

Verified, and it is clean:

- `cloneNode(true)` copies the badge subtree, then lines 4-10 iterate `[clone, ...querySelectorAll("*")]`
  and remove `id` and `aria-describedby` from **every** node. The `sr-only` span loses its `id` and
  the ghost root loses its `aria-describedby` in the same pass, so there is no duplicate `id` in the
  document and no dangling IDREF. The ordering objection does not apply — both removals happen, on
  all nodes, before the clone is mounted.
- The clone root gets `aria-hidden="true"` (`:12`), so the surviving `sr-only` text is not announced
  twice.
- What the clone *does* carry is the counts-only summary text and `data-attendee-badge="true"`, a
  literal. Both are safe by S-2's argument.
- There is no `dataTransfer.setData` anywhere in `packages/web/src/grid/interaction/` or
  `packages/web/src/interaction/` — this is a pointer-driven drag, not HTML5 DnD, so no card text is
  serialised into a drag payload or the clipboard.
- `createDraftEventClone` is the only clone path; `grep -rn "cloneNode"` across `packages/web/src`
  returns exactly this one non-test hit.

**Risk.** `change_plan.md` D-1 calls this "luck we get to keep, not something to rely on silently",
and it is right: the badge is now the first grid feature that depends on that strip, and nothing
fails if line 7 is deleted. The failure mode is a duplicate `id` in the document plus a ghost that
carries a description a screen reader could reach if `aria-hidden` were ever dropped.

**Fix.** One test on `createDraftEventClone`: clone a rendered badge-bearing card, assert the clone
subtree has no `id` and no `aria-describedby`, and assert `document.querySelectorAll("#<id>")` still
has length 1 after mounting the ghost.

---

### S-4 — Informational — the count is a new inference channel; the exact value is unbucketed

**Location:** `packages/web/src/grid/components/AttendeeBadge.tsx:102-127`.

Answering the brief's question directly: **yes, the badge creates a new inference channel, and no, it
does not leak identities.** An observer who can see the screen but is not entitled to the attendee
list now learns, without a click and for every card on screen at once:

1. that an event has guests at all (previously required opening the form),
2. how many — exactly, because `overflowCount = attendees.length - 3` is rendered raw, so a 50-person
   meeting reads `+47`,
3. the RSVP mix for the first three in provider order, by colour.

The requirements classify attendee count as **Low** sensitivity and permit rendering it, so this is
within the agreed envelope, and D-5 states the trade explicitly. Two observations worth recording
rather than fixing:

- The *precise* headcount is more than the requirement strictly needs. A screenshot of a week now
  carries an exact org-chart-shaped signal (which meetings are large, which one-on-ones exist, which
  meeting had three declines). Bucketing at `9+` would keep the product value and cut the precision.
  Not a blocker; I would not hold sign-off for it.
- Because the dots are in **provider order, unsorted** (D-2, `:100-102`), the three visible statuses
  are a stable sample rather than a ranked summary — which is the right call, and also means the
  visible colours do not systematically surface declines.

---

### S-5 — Informational — unguarded index lookups on provider-sourced keys

**Location:** `packages/web/src/common/utils/attendee-status.util.ts:11-16` and `:48-52`;
consumed at `AttendeeBadge.tsx:117`.

`ATTENDEE_STATUS_DOT` and the `counts` accumulator are plain object literals indexed by
`attendee.responseStatus`. `AttendeeResponseStatusSchema` is a `z.enum` (`packages/core/src/types/
event-attendance.contracts.ts:14`, `:27`), so validated data cannot reach these lookups with a
surprising key. If an unvalidated path ever does:

- `ATTENDEE_STATUS_DOT["constructor"]` resolves through the prototype and stringifies the `Object`
  constructor into the `className` template at `AttendeeBadge.tsx:117`. Cosmetic only — React sets
  `className` as an attribute value, so there is no escape into markup and no XSS.
- `counts["__proto__"] = (… ?? 0) + 1` does **not** pollute `Object.prototype`: assigning a
  non-object to the `__proto__` setter is ignored. No prototype-pollution risk.
- Neither path can put attendee text into the DOM, so this is not a PII issue.

**Fix (cheap, optional).** `Object.create(null)` for `counts`, and
`ATTENDEE_STATUS_DOT[status] ?? ATTENDEE_STATUS_DOT.needsAction` at the call site.

---

### S-6 — Blocked — `npm audit --omit=dev` could not be run

Reporting this as **not run**, not as passing.

- `npm audit --omit=dev` fails with `ENOLOCK`: this is a Bun workspace with `bun.lock` and no
  `package-lock.json`.
- `bun audit --prod` and `bun audit` were each attempted and **timed out** (300s and 240s), which is
  consistent with no network egress from this sandbox.

What I *can* state from the repo, verified: **this run adds no dependency.**
`git diff 2d81253a --stat` against `package.json`, `packages/web/package.json`, `bun.lock`,
`package-lock.json` and `yarn.lock` is empty, and `git status` shows no modification to any manifest
or lockfile. The only third-party import introduced is `classnames` in `AttendeeBadge.tsx:1`, already
a declared dependency at `packages/web/package.json:22`. The change therefore adds no new dependency
risk; the *existing* dependency posture is unverified by this review.

---

## Explicit statement on each PII requirement

**PII-1 — no raw email in always-visible card text. HOLDS.**
The always-visible text produced by this change is: up to three empty `<span>` dots
(`AttendeeBadge.tsx:114-119` — no text children at all) and, when `attendees.length > 3`, the string
`+{overflowCount}` (`:120-127`), which is an integer. No attendee field is interpolated into any
visible text node on either card. The card `aria-label` expressions in `TimedEventCard.tsx` and
`AllDayEventCard.tsx` are untouched by the diff — the only root-attribute addition on either card is
`aria-describedby` (`TimedEventCard.tsx:307`, `AllDayEventCard.tsx:161`), and name computation never
consults `aria-describedby`.

**PII-2 — the design DECLINED the permitted `displayName ?? email` fallback. HOLDS, verified in code
rather than in prose.**
`attendee-status.util.ts` contains no reference to `displayName` or `email` in any form. The
accessible description is counts-and-status only, of the exact shape the brief specified
(`"3 guests: 2 accepted, 1 hasn't responded"`), asserted live by C-3 and U-9. The permitted fallback
still exists at `EventDetailsSection.tsx:63` (`const name = attendee.displayName ?? attendee.email`)
— that is the **form** surface, is pre-existing, is where names are supposed to be read, and is
unchanged by this run. The only edit to that file is the extraction of `ATTENDEE_STATUS_DOT` and
`attendeeStatusLabel` into the shared util; the diff moves no other line and changes no rendering.

**PII-3 — no attendee data in any `data-*` attribute, and none reaching logs/telemetry. HOLDS.**
The single new `data-*` attribute is `data-attendee-badge="true"`
(`AttendeeBadge.tsx:62`, applied at `:107`), a literal with no interpolation. `B-11`
(`AttendeeBadge.test.tsx:266-289`) enumerates the badge root's attributes and asserts the `data-`
set is exactly `["data-attendee-badge"]` — a live, non-vacuous test. Grepping all five changed
source files for `console.`, `logger`, `Sentry`, `track(`, `analytics`, `telemetry`,
`captureException`, `posthog`, `amplitude` returns **nothing**: these files contain no sink of any
kind. The indirect telemetry exposure via PostHog autocapture/replay is covered in S-2 and is safe
only because of the PII-2 decision.

**`key={attendee.email}` — acceptable, and I do not disagree.**
`AttendeeBadge.tsx:116`. React keys are used for reconciliation and are never written to the DOM;
they do not appear as attributes, as properties on the host node, or in `outerHTML`. This is
verified here, not merely asserted: `B-10` (`AttendeeBadge.test.tsx:247-265`) renders a badge with
`email: "secret@example.com"` — used as the key — and asserts `container.innerHTML` does not contain
it, and that test is green. Two caveats I would note rather than block on: (1) the email *is*
retained in the React fiber, so React DevTools or a heap snapshot on a user's machine can see it —
but the same is true of `event.attendees` reaching the component at all, so the key adds no
exposure; (2) email is a legitimate stable identity for an attendee here, and the obvious
alternative (array index) would be worse for correctness. Keep it.

---

## Passing checks

- **No secrets in the changed files.** The checklist's secret pattern
  (`(api[_-]?key|secret|password|token)[ \t]*[:=][ \t]*['"][a-zA-Z0-9]`), run across all eight
  changed files, returns no match. The token `secret` appears only in the fixture address
  `secret@example.com`.
- **No real credentials or real personal data in fixtures.** Every email in the three test files is
  under `@example.com` (RFC 2606 reserved): `a@`, `ada@`, `alice@`, `b@`, `bob@`, `c@`, `charles@`,
  `grace@`, `margaret@`, `secret@`, `user1-5@`. Display names are historical figures.
- **No new dependency** — see S-6.
- **No new attendee data crosses a package boundary.** The util imports types from
  `@core/types/event-attendance.contracts` (type-only) and is consumed by web only.
- **The no-attendee path is genuinely byte-identical**, with a live sensitivity control. The D-6
  guards (`EventCard.test.tsx:1005-1153`) assert `baseline` contains none of `data-attendee-badge`,
  `aria-describedby`, `sr-only`, that the `undefined` / missing-key / `[]` paths agree, and — step 7
  — that a one-attendee render **differs** from the baseline. That last assertion is what makes the
  rest of the guard meaningful, and it is present for both cards.
- **`aria-describedby` cannot dangle.** It is emitted only when `showAttendeeBadge` is true
  (`TimedEventCard.tsx:307`, `AllDayEventCard.tsx:161`), and that flag is a strict conjunction that
  includes `hasAttendeesToShow`, which is the same predicate `AttendeeBadge` uses to decide whether
  to render the `sr-only` span at all (`AttendeeBadge.tsx:97`). The id comes from `useId()`, unique
  per card instance.
- **The badge is out of the hit-testing path.** `pointer-events-none` on the badge root
  (`AttendeeBadge.tsx:109`) means it cannot become a click target, which also means PostHog
  autocapture can never fire with the badge as `$el` and never attaches the badge subtree's text as
  `$el_text`.
- **Drag ghost carries no attendee data and no dangling reference** — see S-3.
- **Changed test files are green:** 60 pass / 0 fail / 162 assertions across
  `EventCard.test.tsx`, `AttendeeBadge.test.tsx`, `attendee-status.util.test.ts`.

---

## Required fixes before sign-off

1. **S-1** — repoint C-10 at `badgePosition` and add a badge-presence sensitivity assertion, so the
   card-level PII guard can fail. (Fix C-4's identical vacuity in the same edit.)
2. **S-7** — correct `sha_after` for `tp_debug_009`, resolve the dangling `tp_debug_010` entry, and
   re-take the `EventCard.test.tsx` backup from `2d81253a`. Until then this run must be treated as
   revert-unsafe.

Nothing else blocks. S-2, S-3, S-4, S-5 are recommendations, and S-6 is an environment limitation to
carry forward rather than a defect in this change.

---

## What would have to change for this PII posture to stop being sound

Stated plainly, because the posture is sound and the ways to break it are few and specific:

1. **Anyone puts a name into `attendeeStatusSummary`.** It is one `??` away from
   `displayName ?? email`, it is now shared by the grid *and* the form
   (`EventDetailsSection.tsx:5-8`), and the form is the surface where adding a name is legitimate. A
   change made for the form would land on every visible grid card. This is the single highest-risk
   future edit, and S-1 is what removes the tripwire for it at the card level.
2. **A `title` tooltip is added to the badge or the card.** D-5 forbids it; nothing in the code
   enforces the absence.
3. **`data-attendee-badge` gains an interpolated value**, or a second `data-*` carrying a count or an
   email is added. B-11 catches this at the component level only.
4. **PostHog session replay is enabled server-side** while someone has done (1) — no code change in
   this repo would signal it.
5. **The `aria-hidden` on the drag-ghost root, or the `id`/`aria-describedby` strip, is removed** —
   nothing asserts either.

---

## What this review did NOT cover

- **Anything outside the 8 files in `provenance.json`.** `packages/backend`, `packages/sync`,
  `packages/core` were explicitly off-limits and were not read except for
  `event-attendance.contracts.ts:14-27` (read-only, to confirm the `responseStatus` enum is validated
  at the contract boundary for S-5).
- **The entire backend half of the checklist — not checked, and therefore not cleared.** No changed
  file is a controller, service, entity, guard, serializer or interceptor. I did **not** verify:
  encryption at rest for `government_id` / `bank_account` / `salary_base` (those field names do not
  exist in any changed file — confirmed by grep — and I did not look for them elsewhere);
  role-based response masking; audit-log ordering, append-only-ness or read restriction; per-route
  guards; `reports_to` relationship checks; JWT secret sourcing; password hashing cost factors;
  Helmet; rate limiting on auth endpoints; global error-filter sanitisation. Read every one of those
  as **unknown**, not as passing.
- **`.env` / `.env.example` hygiene.** A single check of `.gitignore` and `.env.example` was denied
  by the sandbox and I did not retry, because no changed file touches configuration. Unverified.
- **Dependency vulnerability status** — S-6. The audit did not run. I verified only that this change
  adds nothing to audit.
- **Runtime / browser verification.** Everything here is from source reading plus the three changed
  test files run under `bun`. I did not open the app, did not screenshot a real grid, and did not
  confirm in a browser that the badge renders where the CSS math says it does. In particular the
  width-gate arithmetic in D-2/D-7 (35px badge, 108px worst-case time label) is *assumed*, not
  measured — a wrong constant there is a layout bug, not a security bug, but it would change which
  cards show a badge and therefore how much of S-4's inference channel is actually live.
- **Full-suite regression.** I ran only the three changed test files (60 pass / 0 fail), not
  `bun run test:web` in full.
- **The rest of the run's provenance.** S-7 documents the `EventCard.test.tsx` divergence, which I
  found because the file changed under me mid-review. I did **not** re-hash the other seven entries
  against disk, so I cannot say whether the same divergence affects them.
- **Out of scope by instruction, not assessed:** the pre-existing `RecurrenceSection` failure, `bun
  lint` on `.sdlc/**` artifacts, the resize-handle hit-testing weakness, and the local-IndexedDB
  attendee-drop bug.
