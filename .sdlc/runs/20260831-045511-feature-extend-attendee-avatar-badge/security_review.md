# Security Review — pass_with_notes

Run: `20260831-045511-feature-extend-attendee-avatar-badge`
Intent: `feature-extend` (brownfield, changed-files scope)
Branch: `CMP-105/opus-only-v5` · Baseline: `2d81253a`
Reviewer tooling note: this build exposed only `Read`, `Bash`, `Write` — no `Glob`/`Grep`. All
enumeration below was done with `ls`/`git`/`grep -rn` via Bash, and every claim of absence in this
report is backed by a command that actually ran and returned. No check was skipped and silently
reported as clean.

## 1. Verdict

**`pass_with_notes`.**

D-5 holds on the code path, not merely in the tests. I traced every value flowing from
`event.attendees` into the DOM on both grid cards and only two reach it: `attendees.length` (a
number) and the aggregate `responseStatus` (a four-member enum). No `attendee.email` and no
`attendee.displayName` reaches the visible badge, the card `aria-label`, or the badge `title` on
either card. I confirmed this beyond the run's own assertions by rendering both cards against
hostile fixtures — attendee `displayName` set to `"><img src=x onerror=alert(1)>`, an email
containing the same payload, and an off-contract `responseStatus` of
`<script>alert(1)</script>` — and dumping the full `container.innerHTML`: zero identifiers, zero
payload fragments, no injected node. The change adds no logging, no analytics, no network call, no
persistence and no dependency, touches nothing off-limits, and contains no secrets. It is promoted
to `pass_with_notes` rather than `pass` solely because two structural properties that this
change's privacy posture leans on are **implicit and untested** (INFO-1) and because the change
introduces a deliberate but unremarked sighted-vs-screen-reader disclosure asymmetry in the
size-gated case (INFO-2). Neither is a defect today; both are cheap to pin down and expensive to
rediscover after a future refactor.

## 2. Scope

### Reviewed (the entire diff, per `provenance.json` — 8 paths, 10 write events)

| File | Status |
|---|---|
| `packages/web/src/grid/components/attendee-status.util.ts` | NEW |
| `packages/web/src/grid/components/AttendeeBadge.tsx` | NEW |
| `packages/web/src/grid/components/attendee-status.util.test.ts` | NEW |
| `packages/web/src/grid/grid.constants.ts` | EDIT (×2: `tp_cg_002`, `tp_ref_001`) |
| `packages/web/src/grid/components/TimedEventCard.tsx` | EDIT |
| `packages/web/src/grid/components/AllDayEventCard.tsx` | EDIT |
| `packages/web/src/grid/components/EventCard.test.tsx` | EDIT (×2: `tp_test_002`, `tp_ref_002`) |
| `packages/web/src/views/Forms/EventForm/EventDetailsSection.tsx` | EDIT |

`git status --porcelain` matches this set exactly — no undeclared writes.

### Explicitly out of scope

- **The rest of the repository.** Per the brownfield intent matrix, only findings introduced by
  this run gate Gate 3.
- **`packages/core/**`, `packages/backend/**`, `packages/sync/**`, `packages/scripts/**`** —
  off-limits per `.sdlc/local/write-contract.json`, and confirmed unmodified (§7). I *read*
  `packages/sync/src/providers/google/google-event.normalizer.ts` and
  `packages/core/src/types/event-attendance.contracts.ts` as upstream evidence for the D-5 trace,
  but neither was modified and neither is under review.
- **The full checklist's server-side sections** — encryption at rest, JWT/bcrypt, audit-log
  append-only semantics, Helmet, rate limiting, global error filters, RBAC guards. This diff is
  eight front-end files in a React grid renderer; there is no controller, service, entity,
  interceptor or route in it. Reporting these as "pass" would be false: they were not exercised,
  not because the code is clean but because the code does not exist in this scope.
- **`npm audit --omit=dev`** — not run as a gating check, and deliberately so: `package.json`,
  `packages/web/package.json` and `bun.lock` are all unmodified
  (`git diff --name-only 2d81253a --` over those paths returns empty; `git status --porcelain`
  over them returns empty). This change adds **zero** dependencies, so it cannot move the
  dependency-risk needle. Any advisory surfaced today would be pre-existing and out of scope per
  the brownfield rule.

## 3. D-5 verification — the traced data path

> **D-5** (`design.md:145-163`): *Nothing derived from `attendee.email` or `attendee.displayName`
> reaches the DOM on a grid card. The card renders only `attendees.length` and the aggregate
> `responseStatus`. This holds for the visible badge, the card's `aria-label`, and the badge's
> `title`.*

### 3.1 The source shape

`packages/core/src/types/event-attendance.contracts.ts:24-28` — an `Attendee` carries exactly three
fields, two of which are identifiers:

```
email: z.string().trim().min(1).max(320),
displayName: z.string().trim().min(1).max(256).nullable(),
responseStatus: AttendeeResponseStatusSchema,   // "needsAction"|"accepted"|"declined"|"tentative"
```

It reaches the card as `GridEvent.attendees`, declared
`z.array(AttendeeSchema).readonly().optional()` at
`packages/web/src/common/types/web.event.types.ts:87`.

### 3.2 Every read of `event.attendees` on the card path

`grep -rni "attendee" packages/web/src/grid` returns exactly seven files — and all seven are in
this run's changed set. There is no pre-existing grid code that touches attendees, so the trace
below is complete for the grid surface, not just for the diff.

Both cards read `event.attendees` in exactly **two** places each, and both reads are terminal:

| Card | Line | Expression | What escapes |
|---|---|---|---|
| Timed | `TimedEventCard.tsx:140` | `aggregateAttendeeStatus(event.attendees)` | enum \| null |
| Timed | `TimedEventCard.tsx:141` | `event.attendees?.length ?? 0` | number |
| All-day | `AllDayEventCard.tsx:87` | `aggregateAttendeeStatus(event.attendees)` | enum \| null |
| All-day | `AllDayEventCard.tsx:88` | `event.attendees?.length ?? 0` | number |

There is no third read. No `.map`, no `.filter`, no index access, no destructure of an attendee
object anywhere on either card — confirmed by grepping the changed set for
`email|displayName|\.name|attendees\[|attendees\.map|attendees\.filter|photo|avatar|picture|profile`.
The only hits outside comments and tests are the three pre-existing form lines
(`EventDetailsSection.tsx:63,64,72`), which are the deliberate surface and are **unchanged** by
this diff.

`aggregateAttendeeStatus` (`attendee-status.util.ts:54-66`) receives the attendee objects and
therefore *sees* the identifiers, but its return type is
`AttendeeResponseStatus | null` and its body only ever returns `attendee.responseStatus` or the
`"accepted"` seed. Identifiers terminate here.

### 3.3 The four DOM sinks

**(a) Visible badge content** — `AttendeeBadge.tsx:51-54`. Two children: a `<span>` whose class is
`ATTENDEE_STATUS_DOT[status]` (a colour token), and `attendeeCountLabel(count)` — a number, capped
at `"9+"` (`attendee-status.util.ts:116-120`). No identifier is in scope inside the component: the
`Props` interface (`AttendeeBadge.tsx:18-30`) admits only `className`, `count: number`,
`status: AttendeeResponseStatus`, `style`. **The badge cannot render an identifier because it is
never given one.**

**(b) Badge `title`** — `AttendeeBadge.tsx:49`: `title={attendeeSummaryLabel(status, count)}`.

**(c) Timed card `aria-label`** — composed at `TimedEventCard.tsx:302-311`; the attendee
contribution is `attendeeSuffix` = `` `, ${attendeeSummaryLabel(attendeeStatus, attendeeCount)}` ``
(`:302-305`), applied to the root at `:317`.

**(d) All-day card `aria-label`** — composed at `AllDayEventCard.tsx:155-164`, same construction
(`:155-158`), applied at `:170`.

All three text sinks funnel through one function.

### 3.4 Is `attendeeSummaryLabel` structurally incapable of emitting an identifier?

`attendee-status.util.ts:98-107`:

```ts
export function attendeeSummaryLabel(
  status: AttendeeResponseStatus,
  count: number,
): string {
  const statusText =
    count === 1 ? attendeeStatusLabel(status) : ATTENDEE_AGGREGATE_LABEL[status];
  return `${count} ${count === 1 ? "guest" : "guests"}, ${statusText}`;
}
```

**Yes — by parameter list.** The function never receives an attendee object. Its only inputs are a
status enum and a number; there is no channel through which an email or a name could arrive, let
alone be emitted. This is the strongest possible form of the guarantee: it is enforced by the
signature, not by the body's discipline. D-5's own framing (`design.md:165-167`) confirms this was
the deliberate design intent, and D-1's rejected alternative — passing the attendee objects — is
precisely what would have dissolved it.

Its two branches resolve to a fixed table (`ATTENDEE_AGGREGATE_LABEL`, `:79-85`, four constant
strings) or to `attendeeStatusLabel` (`:31-32`). The latter returns the status *verbatim* for
anything other than `needsAction` — the one place in the module where an input value is echoed
into output rather than mapped through a table. See INFO-1: this is safe, but for a reason that is
currently implicit.

**And no caller reconstructs an identifier alongside it.** Both call sites interpolate the result
into a suffix built from `attendeeStatus` and `attendeeCount` only
(`TimedEventCard.tsx:302-305`, `AllDayEventCard.tsx:155-158`); neither has an attendee object in
scope at that point beyond `event.attendees`, which it does not touch. Repo-wide, the only importers
of the module are the two cards, the badge, the two test files, and `EventDetailsSection.tsx` —
verified by grep. There is no fourth consumer.

### 3.5 Empirical confirmation against hostile input

Static tracing establishes the path; I confirmed the rendered artefact. I rendered both cards
against attendees carrying an XSS-shaped `displayName` (`"><img src=x onerror=alert(1)>`), an
email containing the same payload, real-looking names, and an off-contract `responseStatus`, then
asserted on the full `container.innerHTML`. Actual rendered output:

```
TIMED ARIA:  Timed event: Planning block, 9 - 10 AM, 3 guests, at least one declined
TIMED TITLE: 3 guests, at least one declined
ALLDAY ARIA: All-day event: Conf, 3 guests, at least one declined
```

The complete badge markup, verbatim from the DOM:

```html
<span aria-hidden="true" data-attendee-badge="true" class="pointer-events-none flex shrink-0
 items-center gap-0.5 text-[10px] leading-none absolute top-0.5 right-1"
 style="color: rgb(5, 18, 26);" title="3 guests, at least one declined">
  <span class="size-2 shrink-0 rounded-full bg-error"></span>3</span>
```

No `pequod.test`, no `Starbuck`, no `Queequeg`, no `onerror`, no `evil.test`, no `<img>`, no
`<script>` node. 3/3 adversarial assertions passed. (Harness: `bun test` with
`--preload ./packages/web/src/__tests__/web.preload.ts`; the probe lived outside the repo in the
session scratchpad and no file was added to the working tree.)

The third case is the informative one: an attendee whose `responseStatus` was
`"<script>alert(1)</script>"` rendered as **`1 guest, accepted`** — the bogus value did not reach
the DOM even though `attendeeStatusLabel` echoes its input. See INFO-1 for why.

### 3.6 The accessibility-tree angle

D-5 explicitly rejects "names in the accessible label only" on the grounds that an `aria-label` is
plain-text DOM, readable in a dev-tools screenshare and captured by any a11y-tree scrape, and that
it would hand screen-reader users a strictly larger disclosure than sighted users
(`design.md:160-163`). **The implementation honours this.** The `aria-label` strings dumped in
§3.5 are the real, complete accessible names, and they contain no identifier. A screen-reader user
hears `3 guests, at least one declined`; a sighted user hovering the badge sees the identical
string via `title`. Neither modality receives a name or an email, so there is no
discrimination-by-modality disclosure of PII.

The badge itself is `aria-hidden="true"` in full (`AttendeeBadge.tsx:42`), so the dot and count are
not double-announced; the single announcement comes from the card root, matching D-3. One residual
asymmetry exists in the *size-gated* case, and it concerns non-identifying status only — INFO-2.

### 3.7 Conclusion

**D-5 holds on the code path.** The identifier fields terminate inside
`aggregateAttendeeStatus`, which returns an enum; the sole text-producing function takes
`(status, count)` and is therefore incapable by signature of emitting an identifier; both cards'
`aria-label` and the badge's `title` are built exclusively from that function's output; and the
rendered DOM is clean under adversarial input. `EventDetailsSection` remains the deliberate
identity surface and its rendering logic is untouched by this diff (the only change is an import
relocation — §5).

## 4. Findings

No findings at `low` severity or above. No attendee identifier can reach the grid DOM by any path I
could construct, statically or at runtime. The four notes below are `info`: none blocks sign-off,
and I am recording them because they are load-bearing assumptions that are currently invisible,
not because the diff needs padding.

| ID | Severity | File:line | Issue | Recommendation |
|---|---|---|---|---|
| INFO-1 | info | `attendee-status.util.ts:31-32`, `:39-44`, `:54-66` | `attendeeStatusLabel` echoes its `status` argument verbatim into the `aria-label`/`title` for any status other than `needsAction`, and `ATTENDEE_AGGREGATE_LABEL[status]` / `ATTENDEE_STATUS_DOT[status]` are unchecked index lookups. This is safe only because of an **undocumented, untested invariant**: `aggregateAttendeeStatus` is a total clamp onto the four valid enum members — for an off-contract status `ATTENDEE_STATUS_SEVERITY[bogus]` is `undefined`, `undefined > n` is `false`, so the reduce can only ever return the `"accepted"` seed or a value that is already a key of the severity map. Confirmed empirically (§3.5). The secondary runtime guarantee is upstream and out of scope: `google-event.normalizer.ts:142,153-155` allowlists `responseStatus` at ingest and folds anything unrecognised to `needsAction`. Note also that `GridEventSchema` is **type-only** — `grep` for `.parse(` across `packages/web/src` shows it is never parsed at runtime — so `readonly` and the enum are compile-time constructs with no runtime teeth in the web layer (see §6). | Pin the invariant with one test: `aggregateAttendeeStatus([{responseStatus: "bogus" as never}])` must return a member of the enum. Optionally extend the `:51-52` comment ("reduce, never sort") to say *why* it must stay a reduce — a `sort`-based or `Math.max`-based max would surface the raw value and break the clamp. |
| INFO-2 | info | `TimedEventCard.tsx:298-305`; `AllDayEventCard.tsx:153-158` | The RSVP suffix is added to `aria-label` whenever guests exist, deliberately **not** gated on `showAttendeeBadge`. On a card too small or narrow to draw the badge, a screen-reader user is told `2 guests, at least one declined` while a sighted user sees nothing at all. No identifier is involved, so D-5 is not violated, and the behaviour is defensible (withholding information from AT users because of a *visual* space constraint would be the worse bug) and is explicitly commented as intentional. But it is a real modality asymmetry in a change whose headline decision turns on not creating one. | No code change required. Record the ruling explicitly so it is not "fixed" later by someone pattern-matching D-5's modality-symmetry language and gating the suffix on `showAttendeeBadge`. |
| INFO-3 | info | `EventDetailsSection.tsx:4-7` | The event form (`views/Forms/`) now imports `ATTENDEE_STATUS_DOT` and `attendeeStatusLabel` from `@web/grid/components/attendee-status.util`. A layering inversion: the deliberate PII surface now depends on a module owned by the ambient grid surface, so a future grid-motivated edit to the shared RSVP vocabulary silently changes the form. The dedupe itself is sound and is the stated point of the extraction. | Consider relocating the shared vocabulary to a neutral module (e.g. `@web/common/`) that both surfaces depend on, rather than pointing the form at the grid. Cosmetic/maintenance, not security. |
| INFO-4 | info | `attendee-status.util.ts:79-85` | The aggregate phrasing (`at least one declined`) is socially sensitive in bulk in a way a single disclosure is not: it becomes persistently visible across an entire week on a screenshare/recording surface. Requirements §5 grades `responseStatus` **Low** and D-5's rationale accepts this trade explicitly (the actionable signal without the identifier), and the grid shows only the viewer's own calendar. Flagged because it is the one genuinely *new* ambient disclosure this change makes — see §6. | Accept as designed. Worth an explicit operator acknowledgement rather than silent inheritance. |

### Checks that ran clean (with the command that established it)

- **No secrets.** The checklist regex over all eight changed files returns nothing:
  `grep -rnE "(api[_-]?key|secret|password|token|bearer)[ \t]*[=:][ \t]*['\"][a-zA-Z0-9]"` → no
  match.
- **No real credentials in fixtures.** Test attendees use synthetic, reserved-style domains —
  `guest-<status>@compass.test` (`EventCard.test.tsx:58`) and `*@pequod.test` (`:929-931`, `:962-964`).
  `.test` is RFC 2606 reserved; these resolve nowhere and authenticate to nothing.
- **No injection surface.** No `dangerouslySetInnerHTML`, `innerHTML` assignment, or `eval` in any
  changed file. The only `innerHTML` occurrences are *read-only assertions* in the F-3 regression
  guards (`EventCard.test.tsx:945-947,972-974`). `title` and `aria-label` receive computed strings
  that React escapes as attribute values; confirmed non-exploitable under an XSS-shaped
  `displayName` in §3.5.
- **No logging / analytics / network / persistence.** Grep for
  `console.(log|warn|error|debug)|posthog|analytics|capture\(|track\(|fetch\(|axios|localStorage|sessionStorage|document.cookie|window.open`
  across the changed set → no match. Requirements PII-1 holds as implemented.
- **No new dependency.** `package.json`, `packages/web/package.json`, `bun.lock` all unmodified.
- **`.env` hygiene.** `.gitignore:4` carries `*.env*`; `git ls-files | grep -iE "(^|/)\.env"`
  returns nothing. (Unchanged by this run.)
- **Tests genuinely pass.** I ran them rather than trusting `review.json`:
  `bun test --preload ./packages/web/src/__tests__/web.preload.ts` over `EventCard.test.tsx` and
  `attendee-status.util.test.ts` → **58 pass / 0 fail, 140 expect() calls**. (Note for the
  operator: these files need the web preload and are *not* runnable under a bare `bun test` or
  under `vitest` — both fail on missing DOM/`bun:test`. That is harness configuration, not a defect.)
- **F-3 remediation verified.** The senior review's F-3 correctly observed that the only PII test
  asserted on a function that could not regress. The added card-level guards
  (`EventCard.test.tsx:926-951` timed, `:953-979` all-day) now assert on rendered
  `container.innerHTML` and are paired with a positive `getByRole` name assertion so they cannot be
  satisfied by rendering nothing. This is the right shape of guard, aimed at the right layer. My
  independent adversarial probe (§3.5) is a superset and also passes.

## 5. PII inventory delta vs requirements §5

The table holds as implemented. One row's handling changed shape without changing its rule, and one
row needs a wording correction.

| Field | §5 said | As actually implemented | Delta |
|---|---|---|---|
| `attendee.email` | Must not render on the card, nor in `aria-label`/`title` | Never leaves `aggregateAttendeeStatus`; absent from rendered DOM under hostile fixtures | **No delta.** Now enforced structurally (function signature) *and* guarded at DOM level. |
| `attendee.displayName` | Same as email; initials out of scope | Same; no initials, no avatar, no `photo`/`picture` reference anywhere in the diff | **No delta.** |
| `attendee.responseStatus` | Low, socially sensitive in aggregate; rendered as colour + text | Rendered as one **aggregate** dot + text, never per-attendee | **Delta, risk-reducing.** §5 implies a status rendering; the implementation collapses N statuses to one worst-case value (`ATTENDEE_STATUS_SEVERITY`, `:39-44`), so per-attendee RSVP is *not* recoverable from a card. Strictly less disclosure than §5 permitted. |
| `organizer.email` | Untouched | Untouched — no `organizer` reference in either card | **No delta.** |
| `attendees.length` | *not listed* | Newly rendered on every qualifying card, capped at `9+` above 9 (`:114-120`) | **New row.** Guest *count* is now on the ambient surface. Low sensitivity, but it is a data point §5 did not enumerate; the `9+` cap also bounds precision for large meetings. Recommend adding it to §5 for completeness. |
| **PII-1** ("no new data leaves the client") | asserted | verified — no logging, analytics, network, persistence | **Holds.** |

**Correction for §5's `responseStatus` row:** it justifies the rendering partly as *"it is already
visible in the form to the same user."* True but incomplete — the point of D-5 is that
*visibility is not the variable; surface is.* The same data moves from a deliberate,
one-event-at-a-time surface to a persistent, all-week one. D-5 reasons about this correctly; §5's
one-line justification does not, and would be a weak citation if reused. See INFO-4.

## 6. Residual risks / notes for the operator

1. **Needs a human browser check, not static analysis.** My verification ran in a jsdom/happy-dom
   harness. Two things it cannot settle:
   - **Tooltip rendering.** `title` sits on an element that is both `aria-hidden="true"` and
     `pointer-events-none` (`AttendeeBadge.tsx:42,45`). `pointer-events-none` means the element
     does not receive hover, so the native tooltip **may never appear** in a real browser. This is
     a functional question, not a security one — the security-relevant fact is that the string is
     PII-free either way — but D-3 describes `title` as a deliberate mouse-only affordance, so if
     it never shows, that affordance is dead code. Worth 30 seconds in a browser.
   - **Real screen-reader output.** Confirm NVDA/VoiceOver announce the composed name as the DOM
     shows it, and that the suffix ordering (calendar accent → attendee → edge-focus) is not
     re-ordered or truncated by the AT.
2. **The clamp in INFO-1 is the single point of failure for status passthrough.** The web layer
   never runs `GridEventSchema.parse()`, so nothing at runtime in `packages/web` enforces that
   `responseStatus` is one of four values. Today two independent mechanisms cover it — the sync
   normalizer's ingest allowlist and the reduce's structural clamp. Both are correct; neither is
   asserted by a test in this run. A refactor of `aggregateAttendeeStatus` to a sort/`Math.max`
   form would silently remove the second, and a new non-Google ingest path would remove the first.
   One test closes this.
3. **Type-safety as a security control — honest assessment.** The `readonly` on
   `GridEvent.attendees` (`web.event.types.ts:87`) and the `AttendeeStatusLike` parameter type are
   **compile-time only** and trivially bypassed at runtime by a `as never`/`as any` cast — which is
   exactly what my adversarial probe did to get hostile data in. They are real defences against
   *accidental* regression by a developer (a `push`/`sort` on the attendee array won't typecheck)
   and they are worth having, but they are not a runtime boundary and should not be cited as one.
   The load-bearing runtime control is the `(status, count)` signature of `attendeeSummaryLabel`,
   which needs no type system to hold: the identifier is simply never passed in. That one is
   genuine.
4. **Off-limits compliance: clean.** `git status --porcelain` filtered for
   `packages/(core|backend|sync|scripts)/`, `.claude/`, `.cursor/`, `.codex/`, `.agents/`,
   `AGENTS.md`, `.env` returns **no matches**. All eight touched paths fall inside the
   `write-contract.json` allowlist (`packages/web/src/grid/**` and
   `packages/web/src/views/Forms/EventForm/**`). The only non-`packages/` modifications in the tree
   are `.sdlc/` run bookkeeping.
5. **Provenance/revert caveat (operational, not security).** `provenance.json` records 10 write
   events across 8 paths, but `backup_path` is `null` for 8 of them — only the two `tp_ref_*`
   repairs captured backups. Three files are new and untracked, so `git checkout` will not remove
   them. An automated revert is therefore **not** clean for this run; deleting the three new files
   plus `git checkout` on the five tracked ones is the manual path. Flagging because this pattern
   has bitten previous runs.
6. **Not assessed, by design.** Server-side controls (encryption at rest, RBAC guards,
   `reports_to` checks, JWT/bcrypt, audit-log append-only semantics, Helmet, rate limiting, error
   filters) and dependency advisories. See §2 — absent from this scope, not silently passed.

## Required fixes before sign-off

**None.** No finding at `low` or above; nothing here blocks Gate 3.

Recommended follow-ups (non-blocking, suitable for a follow-up ticket):

- **INFO-1** — add the one-line test pinning `aggregateAttendeeStatus`'s clamp onto the enum, and
  extend the "reduce, never sort" comment to say why it is load-bearing. Cheapest durable win here.
- **INFO-2** — record the size-gated `aria-label` asymmetry as an explicit accepted ruling so it is
  not "corrected" later.
- **§5** — add the `attendees.length` row to the PII inventory and tighten the `responseStatus`
  justification to reason about *surface* rather than *visibility*.
- **INFO-3** — consider relocating the shared RSVP vocabulary out of `grid/` so the form does not
  depend on it.
- Operator browser pass per note 1 (badge tooltip reachability under `pointer-events-none`;
  real screen-reader announcement).
