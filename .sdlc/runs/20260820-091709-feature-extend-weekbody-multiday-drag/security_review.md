# Security Review — Multi-day drag-to-create in the Week all-day row

- **Run:** `20260820-091709-feature-extend-weekbody-multiday-drag`
- **Mode / intent:** brownfield · `feature-extend` — scoped to the run's write set
- **Baseline:** `4189de1` on `CMP-101/opus-only`
- **Reviewed:** 2026-08-20

## Verdict

**PASS WITH NOTES**

No finding at medium or above was introduced by this run. Nothing blocks Gate 3.

Two low-severity items and four informational items are recorded below; all are
working-tree/process hygiene or defence-in-depth suggestions, not defects in the shipped
behaviour. A large pre-existing dependency-vulnerability backlog is surfaced as advisory in
§"Noted (pre-existing, out of scope)" — this run introduced **zero** of it.

---

## Method and tool-surface disclosure

`Glob` and `Grep` were **not present** in this session's tool surface. Every search below was
therefore run through `Bash` (`git diff`, `git ls-files`, `grep -rn`, `find`, `sha256sum`), and
each claim in this document is backed by a command that actually executed and returned output.
No check is reported as "clean" on the strength of a listing that could not be obtained; where a
check could not be completed as specified (`npm audit`), that is stated explicitly rather than
recorded as a pass.

**Scope was independently derived, not taken on trust.** I reconstructed the changed-path set from
git rather than reading it out of the task description:

```
{ git diff --name-only 4189de1; git ls-files --others --exclude-standard; } | sort -u
```

This returned the 10 declared files **plus one undeclared path**, `.hook-logs/hook.jsonl`
(finding L-1). I also hashed all 10 files against `provenance.json`; 7 of 10 match their recorded
`sha_after`, and 3 differ — `useAllDayDraftCreation.test.tsx`, `useAllDayGridDraftCreation.test.tsx`
and `docs/frontend/week-drag-interaction.md`. Those three are the files the senior review's
follow-up packets (the NFR-5 listener-identity fix, the m8 harness cleanup, the doc correction)
were instructed to rewrite after provenance was last flushed, so the drift is explained and
expected; I reviewed the **on-disk** contents, not the recorded hashes. Provenance being stale
relative to disk is noted as I-4.

---

## Findings

### Critical

**None.**

### High

**None.**

### Medium

**None.**

### Low

#### L-1 — Undeclared run artifact `.hook-logs/` is untracked *and* un-ignored

- **Location:** `/home/sainadh/projects/compass-calendar/compass/compass-calendar/.hook-logs/hook.jsonl`
- **Issue:** The run left a directory in the working tree that is neither in the declared 10-file
  write set nor covered by `.gitignore`. `git ls-files --others --exclude-standard` lists it, which
  means a `git add -A` / `git commit -a` would sweep it into the commit. This is the same class of
  problem the `.sdlc/` ignore entry was added to solve, applied inconsistently.
- **Contents assessed — benign.** I read the file in full (9 lines, 706 bytes). Every record is
  `{"ts": ..., "event":"mcp_tool_postuse", "payload_bytes": N}` — timestamps and byte counts only.
  **No repository content, no prompts, no file paths, no credentials.** The severity here is
  purely "unintended file in a commit", not disclosure.
- **Recommendation:** Add `.hook-logs/` to the `.gitignore` DIRS block alongside `.sdlc/`, or delete
  the directory before commit. Note this requires re-opening `.gitignore`, whose only sanctioned
  change this run was the `.sdlc/` line — so route it through the write-contract owner rather than
  editing it silently.

#### L-2 — Ignoring `.sdlc/` makes future run artifacts invisible to `git status`

- **Location:** `.gitignore:21` (`+.sdlc/`)
- **Issue:** This was the Gate 0-approved change and it is a **net risk reduction** today: it stops
  run transcripts, telemetry and plans from being committed by accident. The residual risk is
  directional, and worth the user knowing. The provenance schema carries a `backup_path` field
  intended to hold pre-edit copies of repository files. In this run every `backup_path` is `null`
  (verified across all 11 entries in `provenance.json`), so nothing is currently at stake. But once
  `.sdlc/` is ignored, a future run that *does* populate `backup_path` will retain verbatim copies
  of repo files on disk that `git status` will never mention. If such a run ever backs up a file
  containing local credentials — `compass.yaml` is the obvious candidate, and it is separately
  ignored at `.gitignore` for exactly that reason — those secrets would sit in an unignored-by-git,
  unnoticed-by-developer directory indefinitely.
- **Recommendation:** Keep the ignore. Add a retention/prune step for `.sdlc/runs/` (e.g. drop runs
  older than N days), and have the backup writer refuse to copy any path matching the repo's own
  secret-ignore patterns (`*.env*`, `compass.yaml`). Not a blocker for this run.

### Informational

#### I-1 — `clientY` is the one unclamped input on the pointer→date path (not reachable)

- **Location:** `packages/web/src/grid/hooks/useAllDayDraftCreation.ts:73,118`;
  `packages/web/src/grid/hooks/useGridCoordinates.ts:36-51`
- I tested the clamping claim empirically rather than reading it, replicating
  `getVisibleDateIndexByX` and `getMinuteByY` verbatim and driving them with hostile values:

  | `clientX` | resolved column index (7 columns, valid `0..6`) |
  |---|---|
  | `NaN` | `0` |
  | `Infinity` | `6` |
  | `-Infinity` | `0` |
  | `1e300` | `6` |
  | `-1e300` | `0` |
  | `Number.MAX_SAFE_INTEGER` | `6` |

  **The x path is completely safe, and for a stronger reason than clamping.** The resolved date is
  *selected* from the `visibleDates` array — `visibleDates[getVisibleDateIndexByX(x)].date`, a real
  `Dayjs` built from `weekDays` — it is never *computed* from `clientX`. No arithmetic on the
  pointer value survives into the date. FR-12's clamping claim is confirmed.

- The `y` path is different. `getMinuteByY` has a floor at 0 but no ceiling and no finiteness check,
  so `getMinuteByY(NaN) → NaN` and `getMinuteByY(Infinity) → Infinity`. Either would flow into
  `.add(minutes, "minutes")` and produce an Invalid Date, which `resolveAllDayCreateRange` would
  then format as the **string** `"Invalid Date"` (confirmed empirically:
  `resolveAllDayCreateRange("Invalid Date", "2026-08-20")` returns
  `{startDate: "Invalid Date", endDate: "2026-08-21"}`), and `allDayGridSchedule`
  (`grid-event-draft.adapter.ts:202-211`) would turn that into `new Date(NaN)` in the draft.
- **Not reachable, for two independent reasons.** (1) The gesture pins `y` at press
  (`pointerStart.y`, `:100`, never reassigned) and only ever passes that pinned value on move
  (`:118`) — this is FR-3, and it is well-documented and mutation-tested. (2) `clientY` on a real
  `MouseEvent` is a WebIDL `long`; the `MouseEvent` constructor applies `ToInt32`, so even a
  hand-dispatched `new MouseEvent("mousedown", { clientY: NaN })` arrives as `0`. There is no DOM
  path that delivers a non-finite `clientY`. I could not construct a reaching input.
- **Recommendation (defence in depth, optional, and it touches a file outside this write set):** a
  `Number.isFinite` guard in `getMinuteByY` would close the class permanently for all five of its
  callers rather than relying on each gesture to pin `y`. Do not do this as part of this run.

#### I-2 — Capture-phase `stopPropagation()` on `mouseup` starves other handlers by design

- **Location:** `packages/web/src/grid/hooks/useAllDayDraftCreation.ts:155-156`
- While a gesture is live, a `window` listener registered with `capture: true` sees `mouseup` before
  any other handler in the document and calls `stopPropagation()`, so no other listener anywhere
  receives that event. This is **the pre-existing house pattern, copied verbatim** — the identical
  construction exists at `useTimedDraftCreation.ts:165-166,218-220`. It is not a new pattern and not
  a new risk class.
- I enumerated every other `mouseup` consumer in the web package to check for collateral starvation:
  - `useGridMouseUp.ts:88` (`#root`, bubble) — **is** starved. Already independently verified by the
    senior review (§5): the form-open path it used to serve is now reached through
    `useDraftActions.ts:369-383` → `useDraftEffects.ts:62-64` on the `"creating"` → `"gridClick"`
    activity transition. Compensated.
  - `useGridEventMouseDown.ts:136` (`document`, bubble) — **not** starved. I confirmed it registers
    *inside* `onMouseDown` on an event card (`:125-140`), so it is mutually exclusive with a gesture
    that can only begin on empty all-day space. The two can never be live at once.
  - `useTimedDraftCreation.ts:219` — same mutual-exclusion argument.
- No action needed.

#### I-3 — Synthetic / untrusted events can drive the gesture; this crosses no trust boundary

- `isTrusted` is not checked, so script-dispatched `mousemove`/`mouseup` can drive the gesture to
  completion. This does not matter here, and the reasoning is worth recording so it is not
  re-litigated: any script able to dispatch events already has same-origin DOM access and could call
  `draftActions.startGridDraft` directly, so the gesture grants it nothing it did not have. There is
  no privilege boundary between "synthetic event" and "real event" in this code path.
- The one framing where it would matter is **clickjacking** — an attacker framing the app to trick a
  user into a drag. The outcome is bounded: the gesture terminates at an *unconfirmed draft* that
  requires a further explicit user confirmation before anything is written (see PII sign-off below).
  There is no silent state change and no network effect. Adding an `isTrusted` check would not
  improve this, and would break the test suite's `fireEvent` usage.

#### I-4 — `provenance.json` is stale relative to disk for 3 files

Recorded `sha_after` does not match the current file for `useAllDayDraftCreation.test.tsx`,
`useAllDayGridDraftCreation.test.tsx` and `docs/frontend/week-drag-interaction.md`. The cause is
benign (post-senior-review remediation packets landed after the last provenance flush) and the
`git_head_after` / `commits` fields are still `null`/empty, consistent with an uncommitted run. Flag
only because provenance is the integrity record a downstream gate would rely on to detect tampering:
if it can drift from disk during normal operation, it cannot distinguish drift from tampering.
Recommend flushing provenance after remediation packets, not only after codegen.

---

## Checklist disposition

Most of the supplied checklist targets a NestJS-style server (guards, JWT, bcrypt, Helmet, rate
limiting, audit tables, PII-at-rest encryption). **This diff contains no server-side code.** I
verified that claim rather than asserting it:

```
{ git diff --name-only 4189de1; git ls-files --others --exclude-standard; } \
  | grep -E "packages/(backend|sync|core)/|^e2e/"   ->  NONE
```

All 11 changed paths are under `packages/web/src`, `docs/`, or repo-root dotfiles. The server-side
checks are therefore **not applicable to this diff** — which is a different statement from "passing",
and is not evidence about the server's actual posture.

| Checklist item | Disposition |
|---|---|
| `government_id` / `bank_account` / `salary_base` encrypted at rest | **N/A** — no such field exists in this codebase (calendar app); no entity, service or controller in the diff. |
| Role-based response masking in serializer/interceptor/DTO | **N/A** — no serializer or DTO in the diff. |
| Audit log written before PII read/write, in-transaction | **N/A** — no audit-log subsystem touched; no persistence at all in the diff. |
| Every controller route has a guard | **N/A** — no controller in the diff. |
| Guards check role AND `reports_to` | **N/A** — no `reports_to` concept in this codebase. |
| JWT secret from env, not hardcoded | **N/A to diff** — no auth code changed. Not independently assessed. |
| Password storage bcrypt/argon2 | **N/A to diff** — auth is delegated to `supertokens-node`; unchanged. |
| Audit entries append-only / auditor-only read | **N/A** — no audit table in the diff. |
| No secrets in committed code | **PASS** — see sign-off table. |
| `.env.example` provided, `.env` gitignored | **PASS (pre-existing)** — `git ls-files \| grep -c "\.env"` returns `0` (no env file tracked); `.gitignore:4` is `*.env*`. Unchanged by this run. |
| Helmet middleware enabled | **N/A to diff** — server middleware unchanged. |
| Rate limiting on auth endpoints | **N/A to diff** — no auth endpoint touched. |
| Global error filter sanitizes responses | **N/A to diff** — no filter touched. |
| `npm audit --omit=dev` clean | **COULD NOT RUN AS SPECIFIED** — see advisory below. Substituted `bun audit --production`. |

---

## Sign-off table

| Area | Verdict | Evidence |
|---|---|---|
| **PII** | **PASS** — requirements §6's claim is accurate, and verified independently | The gesture's only output is a `GridEventDraft` written to an **in-memory Zustand store**. I read `draft.store.ts` in full: it is `create()(devtools(...))` with **no `persist` middleware**, and `grep` for `localStorage\|sessionStorage\|indexedDB\|persist\|console.\|fetch(\|axios\|telemetry\|Sentry\|posthog` over that file returns nothing. The same grep, plus `XMLHttpRequest\|navigator.send\|document.cookie\|innerHTML\|eval(\|new Function`, over all five changed/new source files returns **NONE FOUND**. The draft carries `title: ""`, `description: ""`, `location: ""` (`grid-event-draft.adapter.ts:56-59`) — dates and an optional `calendarId` only. Nothing is persisted or transmitted before user confirmation. |
| **PII — dev-mode caveat** | Informational | `draft.store.ts:55-58` wraps the store in `devtools({ enabled: IS_DEV })`. In dev builds the draft — including calendar dates — is broadcast to the Redux DevTools extension, and this gesture now emits one action per column crossing instead of one per click. **Pre-existing, dev-only, correctly gated.** No production exposure. |
| **Authorization** | **PASS** — requirements §7's claim is accurate | No authorization surface exists in the diff to change. The gesture is a strict superset of a capability the user already exercises by clicking, on their own calendar, client-side. It creates no new role, permission, or check, and it cannot reach another user's data: `calendarId` is passed through unmodified from the existing call signature (`useAllDayDraftCreation.ts:59,79`) and is never derived from pointer input. All authorization remains server-side and untouched (verified: zero `packages/backend/**` paths in the change set). |
| **Secrets** | **PASS** | `grep -nEi "(api[_-]?key\|secret\|password\|passwd\|token\|credential\|bearer\|authorization\|private[_-]?key\|BEGIN .*PRIVATE\|client[_-]?secret\|access[_-]?key)"` across **all 10 files individually**: **zero matches in every file**. A separate scan of the three test files for `@domain.tld` addresses, `https?://` URLs, `Bearer `, JWT-shaped `eyJ...` strings, and 32+ hex-char blobs: **NONE**. Test fixtures use literal dates (`2026-05-18`) and role-based queries only. The docs file contains no examples with credentials. |
| **Dependencies** | **PASS — nothing added, changed, or removed** | `git diff --stat 4189de1 -- package.json bun.lock packages/*/package.json patches/` returns **empty**, and `git diff --name-only 4189de1 \| grep -i "package.json\|lock\|patches"` returns **NONE**. The dependency graph is byte-identical to baseline. No supply-chain delta. |
| **DoS / performance** | **PASS** | Per qualifying `mousemove` the work is bounded and constant: one `getBoundingClientRect()`, one `reduce` over 7 column widths, two `dayjs` constructions, two `format` calls. Below the move threshold `resolveRangeForPointer` short-circuits (`:112-114`) and no resolution happens at all. Store writes are deduped by `isSameAllDayCreateRange`, which compares **both** `startDate` and `endDate` — the complete identity of the range — so sub-column jitter writes nothing and writes occur only on an actual column crossing (bounded by pointer-event rate, ~1 small object each). The dedupe is sufficient; there is no field the range carries that it fails to compare. |
| **Listener lifecycle (DoS/resource)** | **PASS — fix confirmed present** | `cleanup()` (`:122-127`) removes all three listeners with **capture flags matching the registrations** at `:208-210` (`true`, `true`, default) and nulls `gestureRef`. All three terminal paths route through it: `finish()` (`:154`), `cancel()` (`:168`), and unmount (`:51-55`). Both are re-entrancy guarded by `isFinished`/`isCancelled`. The senior review's NFR-5 gap — a test that counted calls and so could not see a capture-flag mismatch — is **closed in the on-disk test**: `listenerBindingsFor` (`useAllDayDraftCreation.test.tsx:135`) now maps to `(handler, capture)` pairs and `:417-424` asserts every added pair has a matching removed pair. The lost-`mouseup` edge case (release outside the window with no `blur`) is covered defensively by the `buttons !== 1` check at `:180-183`, which routes to `finish()` on the very next move — the exposure window is one `mousemove` wide. |

---

## Noted (pre-existing, out of scope — advisory, does not gate this run)

### A-1 — `npm audit --omit=dev` cannot run in this repo; `bun audit` reports a large backlog

The specified command fails outright — this is a Bun workspace with `bun.lock` and **no
`package-lock.json`**:

```
npm error code ENOLOCK
npm error audit This command requires an existing lockfile.
```

I deliberately did **not** generate a lockfile to satisfy it, since `npm i --package-lock-only`
would mutate the repo. I substituted `bun audit --production`, which reads `bun.lock`:

> **69 vulnerabilities (24 high, 37 moderate, 8 low)**

Highlights: `nodemailer <7.0.7` (2 high — arbitrary file read / full-response SSRF via message-level
`raw`; addressparser recursion DoS), `ip-address <=10.1.0` (high — leading-zero octet SSRF /
trust-boundary bypass, reached via `mongodb`), `postcss <=8.5.22` (2 high — arbitrary `.map` file
read and path traversal via attacker-controlled `sourceMappingURL`), `nanoid <3.3.16` (2 high),
`ws >=8.0.0 <8.20.1` (high — memory-exhaustion DoS), plus 7 moderate `axios` advisories, `cookie
<0.7.0`, and `body-parser <1.20.6`.

**Every one of these is inherited from the baseline.** Because `bun.lock` is byte-identical to
`4189de1`, this run introduced exactly zero of them, and per brownfield scoping they do not gate
Gate 3. Two caveats on the numbers, stated so they are not over-read:

1. `--production` does not appear to filter reliably across workspaces — `msw` and `jsdom` (both
   dev-only) still appear in the output, so the true production-reachable count is **lower** than 69.
2. Triage by exposure, not by count. `postcss`/`nanoid`/`ws`/`jsdom`/`msw` are build- and test-time
   only. `nodemailer`/`ip-address`/`axios`/`cookie`/`body-parser` reach `@compass/backend` at
   runtime and are the ones that actually warrant scheduling.

**Recommendation:** open a separate dependency-remediation ticket for the backend-reachable
advisories. Also add a `bun audit` step to CI, since the `npm audit` gate specified in the review
checklist is currently **non-functional against this repo** and has therefore never been enforcing
anything.

### A-2 — `MainGrid.test.tsx:519` is failing, and it is not a security concern

The single suite failure (`"creates a one-day draft from empty all-day space"`) is a test that fires
only `mouseDown`, against a change that intentionally moves Week's click-to-create handoff to
`mouseup`. Assessed for security significance: **none.** It is a test-harness assumption, not a
runtime authorization, validation, or data-exposure behaviour; the end state after a real
click (`mousedown` + `mouseup`) is unchanged, and the file is outside the write contract's allowlist
so leaving it untouched pending user approval is the correct call. The new doc section already
records the required fix ("If you add a Week test that asserts a draft exists after a bare
`mouseDown`, fire `mouseUp` too"). No security action.

---

## Required fixes before sign-off

**None blocking.**

Recommended before commit (hygiene, not security-blocking):

1. **L-1** — ignore or delete `.hook-logs/` so it cannot be swept into a `git add -A`. Contents are
   verified benign; this is about commit cleanliness.

Recommended as follow-up tickets (not this run):

2. **L-2** — add retention/pruning for `.sdlc/runs/`, and make the provenance backup writer refuse
   paths matching the repo's secret-ignore patterns.
3. **A-1** — schedule remediation of the backend-reachable dependency advisories, and replace the
   non-functional `npm audit --omit=dev` gate with `bun audit`.
4. **I-1** — consider a `Number.isFinite` guard in `getMinuteByY` to close the Invalid-Date class for
   all five callers rather than per-gesture. Optional; currently unreachable.
5. **I-4** — flush `provenance.json` after remediation packets, not only after codegen.
