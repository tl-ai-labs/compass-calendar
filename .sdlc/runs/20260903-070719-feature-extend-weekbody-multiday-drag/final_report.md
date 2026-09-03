# Final Report — feature-extend — Multi-day drag-to-select in the all-day row

**Run:** `20260903-070719-feature-extend-weekbody-multiday-drag`
**Mode:** brownfield · **Intent:** feature-extend · **Policy:** `opus-plus-flash-v37` · **auth_mode:** `estimated`
**Branch:** `CMP-101/opus-plus-flash-v37-sdk` (off `main@2d81253a`) · **Nothing committed**
**Date:** 2026-09-03

---

## 1. What shipped

Pressing on the Week view's all-day row and dragging horizontally across N day columns now creates a
single all-day draft spanning exactly those N days, previewed live during the drag and committed on
release. A plain click still produces the one-day draft it always did.

The gesture is an **escalation layered on top of the existing press**, not a replacement for it. That
shape was forced by AC-3 and is the single most important design fact in this run — see §3.

**7 files, all inside the frozen allowlist** (5 modified, 2 new). 481 lines added, 11 removed.

| File | Change |
|---|---|
| `packages/web/src/grid/interaction/math/all-day.create.ts` | **NEW** — pure day-range math: `resolveAllDayDayRange`, `isSameAllDayDayRange`, `hasExceededAllDayDragThreshold` |
| `packages/web/src/grid/interaction/math/all-day.create.test.ts` | **NEW** — 11 unit tests |
| `packages/web/src/grid/hooks/useAllDayDraftCreation.ts` | +143/−11 — the gesture state machine |
| `packages/web/src/grid/hooks/useAllDayDraftCreation.test.tsx` | +262/−0 — **append-only**, 11 new tests |
| `packages/web/src/views/Week/components/Grid/AllDayRow/AllDayRow.tsx` | +14 — Week opts in; form-open fix |
| `packages/web/src/interaction/interaction.constants.ts` | +11 — `ALLDAY_DRAFT_CREATE_MOVE_THRESHOLD_PX = 8` |
| `docs/frontend/week-drag-interaction.md` | +51 — "All-day drag-to-create" section |

No rendering work was needed — multi-day spans already draw (`event.position.ts:101-140`). No Day-view
file was touched: `git diff packages/web/src/views/Day/` is empty.

---

## 2. Acceptance criteria — judged against the **real** 2297/1 baseline

| AC | Status | Evidence |
|---|---|---|
| **AC-1** drag across N columns → one N-day draft, previewed live | **PASS** | `setGridDraft` per column crossing; test asserts store holds `2026-05-20 → 2026-05-23` after press x=50 → move x=250, with only 1 commit so far |
| **AC-2** release opens the form for the span | **PASS (after a blocker fix)** | Was **broken**; see §3. Fixed in `AllDayRow.openAllDayDraft`. **Static verification only — needs the manual browser check in §6.** |
| **AC-3** plain click unchanged; existing test passes **unmodified** | **PASS** | `git diff --numstat` = **262 added, 0 removed**. Protected test intact at line 60. Re-verified after *both* write passes. |
| **AC-4** right-to-left == left-to-right | **PASS** | Lexicographic min/max in `all-day.create.ts:41-44`; unit + hook-level tests |
| **AC-5** clamped to the visible window | **PASS** | Enforced twice: `getVisibleDateIndexByX` clamps upstream, and `AllDayRow` passes a real window. **Mutation-proven** — see §4 |
| **AC-6** Day view not regressed | **PASS** | Day's call site passes **no** `multiDayDrag` key → hook returns before arming. `git diff` on `views/Day/` empty. Two pinning tests added (D-1 option c) |
| **AC-7** suite green, new behaviour covered | **PASS** | 2319/1 vs 2297/1 baseline = **+22 tests, zero new failures** |

### Test results (independently re-run and confirmed)

| | pass | fail | tests | files |
|---|---|---|---|---|
| Baseline, clean tree (measured twice) | 2297 | 1 | 2298 | 302 |
| After codegen | 2318 | 1 | 2319 | 303 |
| **Final** | **2319** | **1** | **2320** | **303** |

**The stated 2298/0 baseline was wrong.** Measured twice on a clean tree with zero source changes:
`RecurrenceSection > "keeps the event's own date selectable when the event ends after midnight"`
already failed. It hardcodes `/Monday, August 3rd, 2026/` at `:176` against a fixture pinned to
2026-08-03; today is 2026-09-03, so the datepicker no longer renders August. Pure date-rot, unrelated
to this job, and off-allowlist. **AC-7 was therefore judged against 2297/1**, and the final state is
that same single failure and no other.

---

## 3. The blocker senior review caught — and no test could have

**F-1: the Week draft form *closed* on release of a multi-day drag.** AC-2 passed in the mocked hook
tests and was broken in the running app. Verified chain:

1. `AllDayRow.openAllDayDraft` called only `startGridDraft`, which sets `isFormOpen: false`.
2. The effect that would reopen it is `useEffect(() => handleChange(), [handleChange])`, and
   `handleChange`'s deps are `[isDrafting, activity, setIsFormOpen]`. On the **release** commit all
   three are unchanged (already `true`, already `"gridClick"`) → identity stable → **effect never
   re-runs**.
3. The fallback `useGridMouseUp` is a **bubble-phase** listener on `#root`; `finish()` calls
   `stopPropagation()` from a **window capture-phase** listener, so the event never reaches it.

The timed gesture survives the identical `stopPropagation` only because it transitions `activity`
from `"creating"` → `"gridClick"`. Press-then-escalate commits `"gridClick"` twice and has no
transition to ride.

Fixed by mirroring `DayCalendarGrid.tsx:191-194` — `setFormOpen(true)` immediately after
`startGridDraft`, with the reasoning recorded inline.

**The run's own generated docs warned that `startGridDraft` "would yank the form shut" — and the code
walked into it one step later.** Worth remembering: a design doc naming a hazard is not the same as
code avoiding it.

---

## 4. Two tests that could not fail — found and fixed

1. `expect(secondDraft.clientId).toBe(firstDraft.clientId)` — **both were `undefined`**
   (`createGridEventDraft(schedule, undefined, calendarId)`). It was the only guard on the
   "replace, not duplicate" property. Replaced with structural equality; the `if` guard that let it
   be skipped entirely was removed.
2. `"clamps at the window edge"` never clamped — `defaultXToDate(9999)` returned `"2026-05-23"`,
   which *is* the last visible date, so the clamp was a no-op on that input.

Also removed: a `try/catch` in `resolveAllDayDayRange` whose fallbacks produced `{start:"", end:""}` —
the exact corrupt zero-length range the design set out to prevent — while silently swallowing errors.

**Mutation proof.** Rather than trust the fix, the clamp was disabled (`if (false && ...)`):

```
(fail) useAllDayDraftCreation multi-day drag > clamps at the window edge
(fail) all-day create math > clamp past right edge
(fail) all-day create math > clamp past left edge
(fail) all-day create math > out-of-window anchor clamps too
 21 pass, 4 fail
```

Restored byte-exact (hash back to `ea4e3253b6a4`); 25/25 green. The clamp tests now genuinely
discriminate.

---

## 5. Security review — `pass_with_notes`

Two findings, neither blocking and neither reachable in shipped wiring:

- **SEC-1 (low)** — `resolveAllDayDayRange` has no internal validity guard, so a future unclamped
  caller could push `Invalid Date` into the store. Both production call sites clamp upstream today.
- **SEC-2 (info)** — the capture-phase `stopPropagation` compensation is invariant-dependent; if
  `getNextAction` ever routes new all-day drafts differently, the suppression becomes a silent drop.

The reviewer explicitly listed PII/authz/audit-log checks as **not applicable** to these 7 files
rather than marking them passed — the right call.

**Dependency note:** `npm audit` cannot run in this repo (Bun-only, `ENOLOCK`). `bun audit --prod`
reports 75 vulnerabilities (26 high), **all pre-existing transitive; this run added zero
dependencies** (`package.json` and `bun.lock` untouched).

---

## 6. NOT DONE — read this before merging

### 6.1 The manual browser check (highest open risk)

**TP-R1's own acceptance says static reasoning is insufficient for the blocker fix.** It has not been
performed. A human must do this:

1. Open the **Week** view.
2. Press on empty all-day space and **drag across 3 day columns**.
   - *Expect during drag:* the form is open and its dates update live as the pointer moves.
   - *Expect on release:* **the form stays open**, showing the 3-day range.
   - *This is the exact behaviour that was broken (F-1). If the form vanishes on release, the fix did
     not work.*
3. Then **plain-click** on empty all-day space.
   - *Expect:* a one-day draft, form open. (AC-3 non-regression.)
4. Optionally, drag **right-to-left** across 3 columns → same span as left-to-right (AC-4), and drag
   **past the week edge** → the range stops at the last visible day (AC-5).

Record the outcome in this run's `manifest.json` as `manual_verification_result`.

### 6.2 Deliberately deferred (approved as follow-ups, not implemented)

- **TP-R6 / F-9** — the `buttons !== 1` early-finish path (button released outside the window) has
  **no test**. Verified absent: zero `buttons: 0` occurrences in the test file. It is the only path
  that can commit a span without a `mouseup`.
- **F-6** — gesture handlers were not converted to hoisted `function` declarations. `cleanup()`
  closes over `onMouseMove`/`onMouseUp`/`onBlur` declared below it. **Not a live bug** (every call
  site was traced), but a latent trap and a divergence from `useTimedDraftCreation.ts:157-211`.
- **F-7** — `hasExceededAllDayDragThreshold` lives in `grid/interaction/math/` rather than beside
  `hasExceededInteractionMoveThreshold` in `interaction/interaction.pointer.ts`, which was not on
  this run's allowlist.
- **F-8** — the `useCallback` on `getVisibleDates` is defeated by the fresh `{ getVisibleDates }`
  object literal at the call site. Harmless, but misleading about where the perf boundary is.

---

## 7. A claim I made at Gate 3 that did not hold up

**I reported "`biome check` clean on all 6 code files". That was inaccurate.** Re-running it now:

```
packages/web/src/grid/interaction/math/all-day.create.ts  format  — Found 1 error
  line 43: `const last =` is split across two lines; the formatter wants it joined.
```

What happened: I ran `biome check` **before** the senior-review fix packet rewrote that file (FIX-4
removed the `try/catch`, which changed the indentation), and I never re-ran it afterwards — I
reported a stale result as current. Purely cosmetic, no correctness impact, fixed by one
`biome check --write`. **Left unfixed deliberately**, per the Gate 3 ruling; recorded as a follow-up.

The lesson generalises: any verification run before a later write pass has to be re-run after it. The
test suite was re-run; the linter was not.

---

## 8. Two defects in the run machinery

1. **Provenance is partly stale.** 5 of 7 files carry a `sha_after` from the *first* write pass. The
   helper consumes its `--before` record when `--after` is called, so the senior-review fix pass had
   nothing to match and was silently ignored (it logged `no matching --before record`). Also:
   `backup_path` is `null` on **all 7** entries. `sha_before` is intact and **matches git HEAD for all
   5 tracked files**, so restoration is still correct for those; the 2 new files have no backup (they
   are simply deletions).
2. **`tp_cg_001` telemetry is false.** It recorded `success: false, 0 tokens, $0` after a vendor 429 +
   TLS handshake timeout — but **the worker had already written all three files**, and they pass
   11/11. The crash preempted only its structured result. A dispatch result is **not** a reliable
   proxy for whether the filesystem changed; the run was saved by checking `git status` rather than
   trusting the return value. A correction event was logged; the raw event remains for audit.

Also recorded: a mid-session instruction to make file edits via Bash `sed`/heredocs was **declined**
throughout. The write contract's hard enforcement is a `PreToolUse` hook matching `Write|Edit` only,
so Bash writes would have bypassed it entirely. Both subagents independently made the same call.

---

## 9. Rollback

**Recommended — plain git, not `/mmo:revert`:**

```bash
git checkout -- \
  docs/frontend/week-drag-interaction.md \
  packages/web/src/grid/hooks/useAllDayDraftCreation.test.tsx \
  packages/web/src/grid/hooks/useAllDayDraftCreation.ts \
  packages/web/src/interaction/interaction.constants.ts \
  packages/web/src/views/Week/components/Grid/AllDayRow/AllDayRow.tsx

rm packages/web/src/grid/interaction/math/all-day.create.ts \
   packages/web/src/grid/interaction/math/all-day.create.test.ts
```

This is safe because `sha_before` matches `HEAD` for all 5 tracked files and the 2 new files are
untracked. **Prefer this over `/mmo:revert`**: this policy's `antigravity-worker` tier is known to
falsify provenance, and this run independently produced 5 stale `sha_after` values — so the revert
tool's "changed since?" check cannot be trusted here.

---

## 10. Cost

| Phase | Tier | Provenance | Cost |
|---|---|---|---|
| requirements_analysis | opus (in-session) | estimated | $0.2075 |
| change_plan | opus (architect) | estimated | $0.6200 |
| plan_task_packets | opus (in-session) | estimated | $0.2300 |
| codegen `tp_cg_001` | flash-agsdk-worker | vendor (false $0) | $0.0000 |
| codegen `tp_cg_001` correction | flash-agsdk-worker | estimated | $0.0590 |
| codegen `tp_cg_002` | flash-agsdk-worker | vendor | $1.2304 |
| debug `tp_fix_001` | flash-agsdk-worker | vendor | $0.6575 |
| senior_code_review | opus (subagent) | estimated | $0.8000 |
| security_review | opus (subagent) | estimated | $0.4900 |
| **Run total** | | | **$4.2944** |
| Pre-check smoke | | | $0.1538 |
| **Session total** | | | **$4.4482** |

Mechanical tier: **$1.8879** over 3 events. Premium: **$2.4065**.

**Cost honesty caveats.** Opus figures are in-session estimates booking `cached = 0`, so they
overstate input cost. The mechanical tier pays a ~11.5k-token identity preamble per packet and reads
large cached contexts (`tp_cg_002` alone booked 1.85M cached input tokens), so it is far from free —
at $1.89 for 3 packets it is not obviously cheaper than premium for work of this shape. **These
numbers are not valid for cross-policy ranking.**

---

## 11. Follow-up tickets

| # | Item | Source |
|---|---|---|
| FU-1 | **Manual browser check of the F-1 fix** — §6.1. Highest priority. | TP-R1 acceptance |
| FU-2 | Add a test for the `buttons !== 1` early-finish path | TP-R6 / F-9 |
| FU-3 | Convert gesture handlers to hoisted `function` declarations | F-6 |
| FU-4 | Relocate `hasExceededAllDayDragThreshold` to `interaction.pointer.ts` as `…ThresholdX` | F-7 |
| FU-5 | Drop or correct the ineffective `useCallback` on `getVisibleDates` | F-8 |
| FU-6 | **`biome check --write` on `all-day.create.ts`** (line 43 formatting) | §7 |
| FU-7 | **`RecurrenceSection.test.tsx:176` date-rot** — hardcodes `/Monday, August 3rd, 2026/`. Off-allowlist here, and **it will keep rotting** — every future run on this repo starts from a red suite until fixed | Baseline finding |
| FU-8 | **Day-view column-construction pinning test** beside `useDayCalendarColumns.ts:34-38`. This run pins the hook/math contract, not Day's `date: dateInView` invariant — a future change to real multi-date columns would pass every test here | senior review FU-1 |
| FU-9 | `AllDayRow` has **no test file at all**. This is the test that would have caught F-1 | senior review FU-1 |
| FU-10 | `useDraftEffects.ts:62-64` no-ops on a re-entrant same-activity `startGridDraft` — a general trap for any future press-then-escalate gesture | senior review FU-2 |
| FU-11 | `startGridDraft` + `setFormOpen(true)` is duplicated in 4 places; extract one `openGridDraftForm(draft)` helper | senior review FU-3 |
| FU-12 | SEC-1: add a validity contract to `resolveAllDayDayRange` | security review |
| FU-13 | SEC-2: regression test pinning the `useGridMouseUp` `shouldOpenForm` invariant | security review |
| FU-14 | Dependency hygiene: triage 26 high advisories; document that `bun audit` replaces the unusable `npm audit` | security review |
| FU-15 | **Fix the provenance `--before`/`--after` one-shot model** so a second write pass in the same run is recorded (§8.1) | run machinery |
| FU-16 | **Worker crash-after-write reporting** — a failed dispatch that already wrote files reports `success:false/$0` (§8.2) | run machinery |

---

## 12. State

Nothing committed. 7 files sit modified/untracked in the working tree on
`CMP-101/opus-plus-flash-v37-sdk` at `2d81253a`. `git_head_after` equals `git_head_before`; zero
commits recorded.
