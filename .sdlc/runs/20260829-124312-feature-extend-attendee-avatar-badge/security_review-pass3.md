# Security Review — pass3 (addendum)

- **Run:** `20260829-124312-feature-extend-attendee-avatar-badge`
- **Mode:** brownfield, narrow re-look scoped to the RF-05 delta
- **Anchor:** `2d81253a` (working tree only; nothing committed — re-confirmed via `git status --porcelain`)
- **Reviewed:** 2026-08-30
- **Delta re-reviewed:** verified by diffing every file in `backups/` against its live
  counterpart, not by trusting the brief. Exactly five files moved, and only in the ways
  described: `attendee-status.ts` (+2 exports), `EventAttendeeBadge.tsx` (import swap,
  `STATUS_ORDER` deleted, label expression rewritten, two comments reworded),
  `attendee-status.test.ts` / `EventAttendeeBadge.test.tsx` / `EventCard.test.tsx`
  (new tests + label-string updates). `EventDetailsSection.tsx` shows only the
  pass-2 extract-to-shared-module change against `2d81253a` — RF-05 did not touch it.
  No manifest change: `git status --porcelain package.json bun.lock packages/web/package.json`
  is empty.

## Summary

The refactor is safe and the name-free-by-construction property is **preserved, not merely
plausible**. The iteration source changed from a literal `as const` tuple to
`Object.keys(ATTENDEE_STATUS_COUNT_NOUN)`, but that call is evaluated once at module
evaluation over an object literal with four hardcoded string keys, in a module that never
imports, receives, or is passed attendee data — there is no expression anywhere in the
module that can write to either export, and the grep over the whole `packages/` tree
returns only reads. Both interpolated operands in the label remain closed: the count is an
integer from `countByStatus`, the noun is one of four string literals defined in the module
body. The prototype-pollution and out-of-enum questions were re-probed by execution, not by
argument, and both behave as pass 2 described. The PII surface is byte-identical:
`attendee.email` at `:146` (React key) and `monogramFor(attendee.displayName)` at `:143`
are still the only two attendee reads in the component. One new **LOW** replaces the closed
one: the corrected comment now overclaims in the *opposite* direction — it asserts "exactly
one attendee-supplied character can reach the DOM", but `String.prototype.toUpperCase` on a
single `\p{L}` code point can expand to two or three characters (`ß`→`SS`, `ﬃ`→`FFI`,
`ǰ`→`J̌`, all of which pass `/^[\p{L}\p{N}]$/u`). Bound is still one *source code point* and
still `@`-free, so the security claim holds; the character-count claim does not. Posture:
**no new exposure, nothing blocking; the carried findings are unchanged in kind and degree.**

## Task-item verdicts

### 1. Label still name-free by construction — CONFIRMED

`EventAttendeeBadge.tsx:120-127` builds `countDetails` from
`ATTENDEE_STATUS_DISPLAY_ORDER.filter(...).map((status) => \`${counts[status]} ${ATTENDEE_STATUS_COUNT_NOUN[status]}\`)`.
Both template holes are closed under any input:

- `counts[status]` — `countByStatus` (`:64-77`) returns an object whose values are only ever
  produced by `+= 1` on an integer-initialised field. No attendee string is assigned into it.
- `ATTENDEE_STATUS_COUNT_NOUN[status]` — the four values are string literals in
  `attendee-status.ts:32-35`. `status` is drawn from `ATTENDEE_STATUS_DISPLAY_ORDER`, so the
  index is one of the four keys and the result is one of the four literals.
- `groupLabel` (`:125-127`) adds only `attendees.length` and the fixed `"guest"/"guests"`.

**Can `Object.keys` over the module-level Record be influenced by attendee data? No, and
here is the code-level reason rather than the intuition.** `ATTENDEE_STATUS_DISPLAY_ORDER`
is a module-scope `const` initialised at module evaluation time (`attendee-status.ts:47-49`)
from `ATTENDEE_STATUS_COUNT_NOUN`, an object literal whose four keys are written out
verbatim at `:32-35`. Module evaluation happens at import, strictly before any component
render, so no attendee value exists yet when `Object.keys` runs. For attendee data to reach
the key list, something would have to *mutate* `ATTENDEE_STATUS_COUNT_NOUN` or push onto
`ATTENDEE_STATUS_DISPLAY_ORDER` after that point:
`grep -rn "ATTENDEE_STATUS_COUNT_NOUN\|ATTENDEE_STATUS_DISPLAY_ORDER" packages/ --include=*.ts --include=*.tsx`
returns 18 sites, all of them reads (2 import lines, 2 index reads in the badge, the rest
assertions in `attendee-status.test.ts`). `attendee-status.ts` imports only a *type*
(`:1`), so the module has no runtime dependency that could reach in either. The badge's own
label expression only reads. So the key list is fixed at four values for the process
lifetime, and — importantly — even if it were not, the `.map` interpolates
`ATTENDEE_STATUS_COUNT_NOUN[status]` (a value, always a literal) rather than `status`
itself, so an injected key would still have to arrive as a *value* in that Record to be
printed. Two independent barriers, same conclusion as pass 2.

One thing genuinely weakened, flagged as INFO-1 below, is the *compile-time* guard:
`STATUS_ORDER` was `readonly ["accepted", ...]`, whereas `ATTENDEE_STATUS_DISPLAY_ORDER` is
typed `AttendeeResponseStatus[]` (mutable) and neither export is `Object.freeze`d. Nothing
in the repo mutates them, so this is a hardening nit, not a live path.

### 2. `counts[attendee.responseStatus]` lookup — CONFIRMED SAFE (re-probed by execution)

Ran the actual expressions rather than reasoning about them. On a fresh
`{accepted:0, declined:0, tentative:0, needsAction:0}` literal:

- `counts["__proto__"] += 1` → **no own key created and no pollution**; `({}).accepted` is
  still `undefined` and `Object.prototype` is still an object. The read yields
  `Object.prototype`, `+ 1` coerces to the string `"[object Object]1"`, and the `__proto__`
  setter silently rejects a non-object primitive. No throw.
- `counts["constructor"] += 1` and `counts["toString"] += 1` → harmless *own* string
  properties. No throw, no effect on the four real counters.
- `counts["maybe"] += 1` → own property `NaN`.

None of these keys is in `ATTENDEE_STATUS_DISPLAY_ORDER`, so **an out-of-enum
`responseStatus` still cannot be printed**: it is not iterated at all, and therefore never
reaches the `counts[status] > 0` filter or the `.map`. The worst observable effect is
unchanged from pass 2 — an undercounted breakdown (`"3 guests: 2 accepted"`) or, fully
degenerate, an empty `countDetails` yielding a trailing `": "`. Cosmetic. Note the
indirection change did **not** alter this property: the filter/map source is still a fixed
four-element list, only its provenance changed.

### 3. Pass-2 comment-overclaim LOW — **CLOSED**, but see LOW-4

The absolute claims are gone. `EventAttendeeBadge.tsx:41-49` now states the whitelisted
single-code-point invariant and even carries a "do not restate this as ..." guard for future
maintainers, and the docstring at `:100-103` reads "no attendee-supplied string is written
to the DOM beyond the single whitelisted monogram character". `grep` for the old wording
returns nothing. The finding as written in pass 2 is closed.

It does, however, overshoot slightly in the other direction, which the task asked me to
check specifically. See LOW-4: "exactly one attendee-supplied character" and "no
attendee-supplied string longer than one character ... can reach the rendered monogram" are
both false for characters whose uppercase mapping expands. The correct bound is *at most one
attendee-supplied **code point**, uppercased* — which may render as up to three characters.

### 4. PII surface — **UNCHANGED**

`grep -n "\.email\|displayName\|title=\|dangerouslySetInnerHTML\|innerHTML"` on the
component returns exactly four lines: the `monogramFor` signature (`:52`), its `trim` (`:53`),
`monogramFor(attendee.displayName)` (`:143`), and `key={attendee.email}` (`:146`). No
`title`, no `alt`, no `data-*` carrying attendee data, no HTML-injection sink. Email is a
React key and nothing else; `displayName` reaches `monogramFor` and nothing else. The badge
is still `pointer-events-none select-none` (`:136`) with no handlers and no `tabIndex`.
RF-05 emitted no new DOM attribute — the `aria-label` is the same attribute with different
literal text.

### 5. PostHog masking gap (pass-2 LOW, was MEDIUM-3) — **UNCHANGED; does not move the needle**

Re-verified the gap is still open:
`grep -rn "ph-no-capture\|maskAllText\|maskTextSelector\|disable_session_recording" packages/web/src`
→ no match. On whether the richer label changes the assessment: **it does not.** The label's
information content is identical — same integer counts, same four statuses, same ordering;
only the needsAction noun changed from `"hasn't responded"` to `"no response"`, which is
three characters shorter, not richer. It discloses no additional field, no additional
attendee, and no identity. rrweb's serialisation cost is unchanged in kind. The
re-identification argument in pass 2 (initials + positional status classes + event title +
an already-known account identity) is untouched by a synonym swap. Recommendation stands at
LOW: add `ph-no-capture` to the badge root and confirm the project's replay toggle out of
band.

## Findings (this pass)

| Severity | Category | Location | Issue | Recommendation |
|---|---|---|---|---|
| LOW | Documentation accuracy (code comments) | `packages/web/src/grid/components/EventAttendeeBadge.tsx:42-47` | **New comment overclaims in the opposite direction.** It asserts "exactly one attendee-supplied character can reach the DOM - the uppercased first code point" and "no attendee-supplied string longer than one character ... can reach the rendered monogram". `monogramFor` (`:57`) returns `first.toUpperCase()`, and Unicode uppercase mappings are not length-preserving: `ß`→`SS`, `ﬁ`→`FI`, `ﬃ`→`FFI`, `ŉ`→`ʼN`, `ǰ`→`J̌` — all five pass `/^[\p{L}\p{N}]$/u`, so a `displayName` beginning with any of them renders a 2–3 character monogram. Executed, not inferred. Security impact is nil: the bound is still **one attendee-supplied code point**, still whitelisted to `\p{L}`/`\p{N}`, so no `@` and no name fragment. But the comment is now the third revision of this same sentence and is still not literally true, and it explicitly instructs future maintainers to rely on it. | Reword the bound to code points: *"at most one attendee-supplied code point reaches the DOM — the first `\p{L}`/`\p{N}` code point of `displayName`, uppercased. Its uppercase mapping may expand to more than one character (ß→SS), so this is a bound on source code points, not on rendered length. No other character of `displayName`, and no character of `email`, reaches any text node or attribute."* Non-blocking. |
| INFO | Hardening (compile-time guard weakened) | `packages/web/src/common/styles/attendee-status.ts:28-49` | `STATUS_ORDER` was `as const`, i.e. a `readonly` tuple that TypeScript would refuse to `push` to. Its replacement is typed `AttendeeResponseStatus[]` (mutable, via the `as` cast at `:49`) and `ATTENDEE_STATUS_COUNT_NOUN` is a plain mutable `Record`; neither is `Object.freeze`d. No caller mutates either (all 18 references across `packages/` are reads), so there is no live path and the by-construction argument above does not depend on immutability — but the refactor did remove a compile-time barrier that previously made "the label's word list is a constant" enforceable rather than conventional. | Optional: `as readonly AttendeeResponseStatus[]` on `:49` and `Object.freeze(...)` on both exports, or restore `as const` on the Record. Cheap, and it makes the invariant this pass just verified by grep enforceable by the compiler instead. |
| INFO | Test hygiene — no issue found | `attendee-status.test.ts`, `EventAttendeeBadge.test.tsx`, `EventCard.test.tsx` | New RF-05 tests re-checked for embedded credentials and real data. Secret-shaped-literal grep across all eight changed files → no match (exit 1). Fixture addresses are 14 × `@example.com` and 2 × `@corp.com`, the latter being the synthetic `victim@corp.com` negative-test value pass 2 already vetted. No new network call, no `process.env`, no snapshot file. | None. |
| INFO | Dependency risk — unchanged | repo root | No manifest or lockfile change in this delta (`git status --porcelain` on `package.json` / `bun.lock` / `packages/web/package.json` is empty), and RF-05 added no import outside the workspace. The pass-2 baseline therefore stands unmodified: `npm audit --omit=dev` remains unrunnable (bun workspace, `ENOLOCK`); `bun audit --prod` = 69 vulnerabilities / 24 high, **0 introduced by this run**, all pre-existing transitives. Caveat carried forward verbatim: `bun audit --prod` walks build/test trees, so that figure is not a production-only baseline and must not be compared against an `npm audit --omit=dev` number. | Out of scope; track the 24 high transitives on their own ticket. |

## Carried-finding disposition

| # | Finding | Status |
|---|---|---|
| pass-1 MEDIUM-1 / MEDIUM-2 | `title` attributes leaking `displayName` | **CLOSED** (re-verified this pass: no `title=` in the component) |
| pass-2 LOW (comment overclaim) | "no attendee-supplied text reaches the DOM at all" | **CLOSED** — superseded by LOW-4 above, a narrower and non-security nit |
| pass-2 LOW (aria-label aggregate disclosure) | Per-status breakdown in the accessible name | **UNCHANGED** — same counts, same structure, one synonym swap; keep it (WCAG 1.4.1 rationale from pass 2 stands) |
| LOW-1 | `key={attendee.email}` → React dev duplicate-key warning prints an address | **OPEN (unchanged, accepted)** — `EventAttendeeBadge.tsx:146`; console-only, `capture_console_errors: false` |
| LOW-2 | `countByStatus` scans the uncapped array, unmemoised | **OPEN (unchanged, accepted)** — `:119-124`; RF-05 changed the iteration source, not the cost profile |
| pass-2 LOW-3 | PostHog session replay, no masking | **UNCHANGED** — gap still open, and the richer label does **not** move the needle (see item 5) |
| pre-existing | `EventDetailsSection.tsx:41` `z.url()` accepts `javascript:` scheme | **OPEN, out of scope** — confirmed untouched by RF-05; ticket it |
| pre-existing | `bun audit --prod` 69 vulns / 24 high | **UNCHANGED** — 0 introduced |
| advisory | `design.md` §3.6 / §PII / §8 still describe the removed `title` | **OPEN (unchanged)** — RF-05 did not touch `design.md` (mtime `21:20`, before the `01:28` packet); still worth a cleanup before archive, still non-gating |

## Passing checks (re-verified this pass)

- Label is name-free by construction under the new indirection — two independent barriers
  (fixed key list computed at module load; values interpolated are module-literal strings).
- Out-of-enum `responseStatus` cannot be printed; `__proto__` causes no pollution; neither
  `__proto__` nor `constructor` throws. Probed by execution.
- PII surface byte-identical: `email` → React key only, `displayName` → `monogramFor` only.
- Badge remains interaction-inert; no new DOM attribute introduced by RF-05.
- Exhaustiveness is now compiler-enforced via the explicit `Record<AttendeeResponseStatus, string>`
  annotation, and locked by `attendee-status.test.ts:46-52` against
  `AttendeeResponseStatusSchema.options` — a strict improvement over the hand-maintained tuple,
  which could silently drift from the enum.
- No secrets, no new dependency, no manifest change, no snapshot file.
- Verification claims in the brief were spot-checked structurally (backups diff, git status,
  grep counts) rather than relayed; the suite numbers themselves (2321 pass, lint 0,
  type-check 0) are taken from the brief and were not re-run in this narrow pass.

## Required fixes before sign-off

None.

VERDICT: PASS_WITH_FINDINGS
