# Security Review — pass2

- **Run:** `20260829-124312-feature-extend-attendee-avatar-badge`
- **Mode:** brownfield (scoped to the 8 files in `provenance.json`)
- **Intent:** feature-extend
- **Anchor:** `2d81253a` (working tree only; nothing committed)
- **Reviewed:** 2026-08-29
- **Delta re-reviewed:** pass-1 → now is exactly three files — `EventAttendeeBadge.tsx`
  (`tp_rf_001`), `EventAttendeeBadge.test.tsx` (`tp_rf_002a`), `EventCard.test.tsx`
  (`tp_rf_002b`). Verified by diffing each against
  `.sdlc/runs/.../backups/`; no other file in the change set moved.

## Summary

The pass-1 blocking fix landed exactly as specified and is verified by trace, not by
report: both `title` attributes are gone, and `EventAttendeeBadge.tsx` now contains only
two references to attendee-supplied data — `monogramFor(attendee.displayName)` at `:144`
and `key={attendee.email}` at `:147`. Email remains a React key and nothing else. The two
MEDIUM PII findings are **CLOSED**. One precision correction to the framing in the task
brief and in the component's own docstring: it is not true that *no* attendee-supplied
text reaches the DOM — the monogram does, as one uppercased code point whitelisted by
`/^[\p{L}\p{N}]$/u`. That is the feature (FR-8) and a single initial is not an identifier
of the same class as a name or address, but the absolute claim is now written into
`:51-52` and `:105` and should be softened before someone relies on it. The new
`aria-label` breakdown leaks no identity — it is built from `STATUS_ORDER`, a module-level
`as const` tuple, and integer counts, with no path for attendee data to reach the string —
and its incremental disclosure over the pre-existing coloured status rings is small enough
that I would keep it (argument below, rated LOW). The MEDIUM PostHog finding is
**REDUCED to LOW**: the identity payload is out of the DOM, but the label and the monogram
still serialize under rrweb, so masking remains the right hygiene step rather than an
urgent one. The new tests are clean: no network, no snapshot file anywhere in
`packages/web/src`, fixtures on `example.com` and `corp.com`. Posture: **remediation is
complete and correctly targeted; nothing outstanding blocks sign-off.**

## Pass-1 finding disposition

| # | Pass-1 finding | Status | Evidence |
|---|---|---|---|
| MEDIUM-1 | Dead `title` attributes behind `pointer-events-none` + `role="img"` | **CLOSED** | `grep -n "title=" packages/web/src/grid/components/EventAttendeeBadge.tsx` → no match. Backup diff shows both `:129` and `:147` deletions plus the now-dead `statusText` binding. |
| MEDIUM-2 | `displayName` interpolated verbatim into per-avatar `title` | **CLOSED** | Only surviving `displayName` read is `monogramFor(...)` at `EventAttendeeBadge.tsx:144`, which returns at most one `\p{L}`/`\p{N}` code point or `null`. Regression-locked by the new test at `EventAttendeeBadge.test.tsx:177-194`, which asserts every attribute of every element in the subtree is `@`-free for `displayName: "victim@corp.com"` — a reintroduced `title` fails it. |
| MEDIUM-3 | PostHog replay may serialize badge DOM (no `disable_session_recording`, no mask selector) | **REDUCED → LOW** | See LOW-3. Attribute-side identity exposure is gone; label + initials + status classes still serialize. |
| LOW-1 | `key={attendee.email}` → React dev duplicate-key warning prints an email to console | **OPEN (unchanged)** | `EventAttendeeBadge.tsx:147`. Still local-console-only; `capture_console_errors: false` (`posthog.bootstrap.ts:36`) keeps it out of ingest. |
| LOW-2 | Uncapped per-render count scan, unmemoised | **OPEN (marginally widened)** | `countByStatus` at `:122` still scans the full array outside any memo, and now also allocates a counts object plus the `filter`/`map`/`join` chain (`:123-125`) per card per frame. Still integer work; still low urgency. |
| INFO | XSS/injection, authorization (busy-projection gating), secrets/deps — no issue | **Re-confirmed** | No `dangerouslySetInnerHTML`/`innerHTML`/`eval`/`new Function` in the badge or shared module; no `tabIndex`/`onMouse`/`stopPropagation`; `pointer-events-none select-none` intact at `:137`. Card-side gates unchanged (`git diff 2d81253a` on both cards touches only the `showAttendeeBadge` gate, the badge JSX line and the clamp arithmetic). |

## Findings

| Severity | Category | Location | Issue | Recommendation |
|---|---|---|---|---|
| LOW | PII / aggregate disclosure | `packages/web/src/grid/components/EventAttendeeBadge.tsx:122-128` | **New per-status `aria-label` breakdown.** Assessed on the merits, not waved through. It leaks no identity: `countDetails` is built by mapping `STATUS_ORDER` (a module-level `as const` tuple, `:40-45`) through `attendeeStatusLabel` and interpolating integers — `displayName` and `email` are unreachable from that expression, so the string is `@`-free and name-free by construction for any input. On the disclosure question: the breakdown is *aggregate*, and the same information is already on-screen in higher fidelity — each avatar's ring is `bg-error`/`bg-success`/`bg-warning` (`attendee-status.ts:8-13`), so a shoulder-surfer or a screenshot of a 2-person 1:1 already shows the red ring; "1 declined" adds nothing a sighted observer of the same pixels did not have. Two places it *does* exceed the visual channel: (a) `countByStatus` is called on the **full** array (`:122`) while only 2 avatars render past the cap, so for a 4+ attendee event the label aggregates statuses the pixels hide; (b) an `aria-label` is not visible, so it survives into DOM-scraping channels (see LOW-3) where the rings are only pixels. Both are counts, over a group the viewer is already authorized to enumerate per-person via the form panel. | **Keep it.** Removing the breakdown would restore hue-as-sole-status-signal (a WCAG 1.4.1 problem the label exists to solve) while not reducing the on-screen disclosure at all, since the rings carry it regardless. If RSVP state on a shared screen is genuinely a concern for this org, the control belongs one level up — a user setting that suppresses the badge — not a degraded accessible name. Do apply the LOW-3 masking so the label is not the one status channel that escapes into replay. |
| LOW | Documentation accuracy (code comments) | `packages/web/src/grid/components/EventAttendeeBadge.tsx:50-52`, `:105` | Both comments now assert the absolute: *"no attendee-supplied text reaches the DOM at all"* and *"no attendee-supplied text is written to the DOM"*. The monogram is attendee-supplied text — one uppercased code point from `displayName`, rendered at `:158`. The claim that actually holds is the narrower, structurally-guaranteed one. A future maintainer who trusts the absolute wording could add a second `displayName` read believing the invariant is enforced somewhere rather than being an artifact of there only being one call site. | Reword to the true invariant: *"the only attendee-supplied text in the DOM is a single `\p{L}`/`\p{N}` code point; no other character from `displayName`, and no character of `email`, reaches any text node or attribute."* |
| LOW | PII / third-party egress (was MEDIUM-3) | `EventAttendeeBadge.tsx:135`, `:158` in combination with `packages/web/src/auth/posthog/posthog.bootstrap.ts:24-52` | Re-assessed post-remediation, as asked. Removing the titles **substantially reduces but does not eliminate** the exposure. Reduced: the attribute that held a full `displayName` per attendee on an always-rendered surface is gone, so the worst case of the remote session-replay toggle is no longer "every attendee name on every visible card is in the replay stream". Not eliminated: rrweb serializes attributes and text, and the badge subtree still carries (a) the `aria-label` group breakdown, (b) one initial per visible attendee, (c) `bg-success`/`bg-error`/etc. class names that encode per-attendee RSVP status positionally. Initials plus status plus the event title plus the account identity PostHog already has (`person_profiles: "always"`, `:51`) is a weak but non-zero re-identification aid. Re-verified: `grep -rn "ph-no-capture\|maskAllText\|maskTextSelector\|disable_session_recording" packages/web/src` → **no match**, so whether replay records is still a server-side project toggle I cannot see from this repo. Autocapture remains a non-path (`pointer-events-none`, so the badge can never be a click ancestor). | Unchanged from pass 1 and now cheap relative to what is left: add `ph-no-capture` to the badge root class list so the subtree is masked in replay regardless of the remote setting, and confirm the project's session-replay toggle out of band. No longer a sign-off blocker at this exposure level. |
| INFO | Robustness (not a vulnerability) | `EventAttendeeBadge.tsx:76-78`, `:123-128` | Traced the "attacker-controlled label text" question to ground, per task item 5. `attendeeStatusLabel` takes `AttendeeResponseStatus` and returns either the literal `"hasn't responded"` or the status value itself — one of four enum members (`attendee-status.ts:18-19`; `AttendeeResponseStatusSchema` is `z.enum([...])` in `packages/core/src/types/event-attendance.contracts.ts`). More importantly the guarantee does not depend on that typing: the label iterates `STATUS_ORDER`, so even if unvalidated data reached the component, an out-of-enum `responseStatus` could never be *printed* — it can only fail the `counts[status] > 0` filter. Checked the two adjacent hazards of `counts[attendee.responseStatus] += 1` on an unvalidated key: `"__proto__"` is a no-op (the setter rejects a non-object value, no pollution), `"constructor"` sets a harmless own property; neither throws and neither reaches the string. Worst observable effect is an undercounted breakdown, e.g. `"3 guests: 2 accepted"`, and in the fully-degenerate case an empty `countDetails` yielding a trailing `": "`. Cosmetic. | None required. If you want the cosmetic edge gone, fall back to a bare `"N guests"` when `countDetails === ""`. |
| INFO | Test hygiene — **no issue found** | `EventAttendeeBadge.test.tsx`, `attendee-status.test.ts`, `EventCard.test.tsx` | Task item 4 verified directly. No `toMatchSnapshot`/`toMatchInlineSnapshot`, no `fetch`/`axios`/`XMLHttpRequest`, no `http(s)://`, no `localhost`, no `process.env` in any of the three files; `find packages/web/src -name "__snapshots__" -o -name "*.snap"` → nothing, so no fixture is persisted to disk. Fixtures use `example.com` throughout; the one realistic-looking address, `victim@corp.com` (`EventAttendeeBadge.test.tsx:180-181`), is a synthetic negative-test value and is exactly the case pass 1 asked for. Secret-shaped-literal grep across all 8 changed files → no match. | None. |
| INFO | Dependency risk — unchanged | repo root | `npm audit --omit=dev` remains unrunnable (no `package-lock.json`; bun workspace → `ENOLOCK`), as accepted in the brief. Re-ran `bun audit --prod`: **69 vulnerabilities (24 high, 37 moderate, 8 low)** — byte-identical to pass 1. `git status --porcelain` on `package.json`/`bun.lock` is empty, so **0 introduced by this run**. Caveat stands: `bun audit --prod` still walks build and test trees (`postcss`, `nanoid`, `ws`, `jsdom`), so the figure is not a production-only baseline and must not be compared against an `npm audit --omit=dev` number. | Out of scope for this run. Track the 24 high transitives on their own ticket. |

## Passing checks

- **No attendee-supplied string reaches any DOM attribute.** Verified by reading every
  attribute the component emits: `aria-label` (counts + fixed labels), `className`,
  `data-testid`, `style` (colours from `baseColor`), `key` (React-internal). No `title`,
  no `data-*` carrying attendee data, no `alt`.
- **`attendee.email` is a React key and nothing else.** Exactly one occurrence in the file
  (`:147`); `grep -n "\.email"` returns that line alone.
- **The `@`-in-`displayName` gap pass 1 identified is now regression-locked.**
  `EventAttendeeBadge.test.tsx:177-194` renders `displayName: "victim@corp.com"` and
  asserts both `container.textContent` and every attribute of every element in the subtree
  are `@`-free. This is the test pass 1 asked for and it is strictly stronger than the
  all-null case at `:63-86`, which is retained.
- **Group label names nobody, and the test proves it positively** — `getByRole("img", {
  name: "3 guests: 2 accepted, 1 hasn't responded" })` plus explicit `not.toContain` on
  each fixture name (`:127-134`).
- **`"Guest"` is no longer a rendered string anywhere.** `grep -n "Guest"` in the component
  → no match; asserted at `:100` (`avatar.textContent` is `""`) with the glyph present.
  Consistent with Gate 3 ruling A; not relitigated.
- **Badge remains interaction-inert.** `pointer-events-none select-none` at `:137`, no
  `tabIndex`, no handlers, no `stopPropagation`. FR-12 intact after the refactor.
- **Render cap still slices before mapping** (`:120` before `:143`); off-by-one arithmetic
  re-asserted for 1/2/3/4/6/50 attendees.
- **Busy-projection events still cannot render a badge**, double-gated
  (`attendeeCount > 0` in both cards + the component's own early return at `:113`);
  neither card's gate was touched by the remediation.
- **Tests re-run by me, not relayed.** `bun packages/scripts/src/testing/test-parallel.ts
  web -- <the three changed test files>` → **39 pass / 0 fail / 131 expect() calls /
  exit 0** (pass 1 was 35 across the same files; +4 is the new negative test and the
  re-scoped AC-9 assertions). The `act(...)` warnings in the output are pre-existing
  card-test noise, not failures.
- **Secrets/env hygiene unchanged.** `POSTHOG_KEY`/`POSTHOG_HOST` come from `ENV_WEB`
  (`posthog.bootstrap.ts:25-26`), not literals. No env file touched; `.gitignore:4` still
  carries `*.env*`.

## Noted (pre-existing / out of scope)

- `packages/web/src/views/Forms/EventForm/EventDetailsSection.tsx:41` — provider-sourced
  `href={conference.url}` where `ConferenceSchema.url` is `z.url()`, which accepts a
  `javascript:` scheme. Pre-existing, untouched by this run (confirmed against
  `git diff 2d81253a`, which shows only the extract-to-shared-module import change).
  Accepted as an out-of-scope follow-up per the brief. Ticket it.
- `EventDetailsSection.tsx:63` — `displayName ?? email` renders full addresses in the form
  panel. Deliberate, unchanged, and correctly *not* mirrored onto the grid.
- **Run-artifact drift (advisory, not source).**
  `.sdlc/runs/.../design.md` was corrected in §3.5 (`:282-295`) and §8 (`:665-689`), but
  three places still describe the removed `title`: the §3.6 element-structure listing still
  shows `title={\`${attendee.displayName ?? "Guest"}, ${statusText}\`}` (`design.md:328`)
  and `title={\`${overflowCount} more\`}` (`:344`); the PII discussion at `:424-432` still
  states the title "**does** interpolate `displayName`" and instructs *"do not broaden
  [the AC-8 test] to arbitrary displayNames, which would contradict the PII table"* —
  which now directly contradicts both the shipped component and the new test at
  `EventAttendeeBadge.test.tsx:177`; and `:728`/`:847` still cite "the `title` text" as an
  NFR-5 status signal. No runtime impact, but this is the spec-of-record and as written it
  instructs a future implementer to put `displayName` back into an attribute. Worth a
  five-minute cleanup before the design doc is archived. Flagged as advisory — it does not
  gate the run.

## Required fixes before sign-off

None. The single pass-1 blocker (remove both `title` attributes) is closed and
regression-locked.

## Advisory (not blocking)

1. Soften the two absolute "no attendee-supplied text in the DOM" comments
   (`EventAttendeeBadge.tsx:50-52`, `:105`) to the true invariant — one whitelisted
   `\p{L}`/`\p{N}` code point, nothing else.
2. Add `ph-no-capture` to the badge root and confirm the PostHog project's session-replay
   toggle out of band (downgraded from the pass-1 MEDIUM).
3. Memoise `countByStatus` + the label chain (`:122-128`) so an uncapped attendee array is
   not rescanned and re-allocated per card per frame on the drag/resize path.
4. Optionally key on index or a non-reversible hash instead of `email` (`:147`) to keep an
   address out of React's dev-mode duplicate-key console warning.
5. Reconcile `design.md` §3.6 / §PII / §8 with the shipped component (see drift note).
6. File the pre-existing `z.url()` / `javascript:` href ticket for
   `EventDetailsSection.tsx:41`.

VERDICT: PASS_WITH_FINDINGS
