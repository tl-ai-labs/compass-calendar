# Security Review — pass1

**Run:** `20260903-070719-feature-extend-weekbody-multiday-drag`
**Mode:** brownfield, intent `feature-extend`
**Scope:** the 7 files in `provenance.json` (verified against `git status`; scope list and provenance agree exactly)
**Verdict: pass_with_notes**

## Summary

This is a client-side pointer-gesture and date-arithmetic change with no network, auth,
persistence, storage, or DOM-injection surface: the changed files contain zero `fetch`/`axios`,
zero `localStorage`/`sessionStorage`, zero `innerHTML`/`dangerouslySetInnerHTML`, zero logging
statements, and zero dependency changes (`package.json` and `bun.lock` are untouched). The
gesture lifecycle is a faithful copy of the already-shipped `useTimedDraftCreation` pattern and
is in one respect stricter than it — `finish()` only calls `preventDefault`/`stopPropagation`
after the drag threshold has been crossed, so plain clicks propagate normally. Listener teardown
is closed on all five exit paths and is bounded to one gesture slot, so no leak or gesture-DoS
path exists. Both findings below are low/info and neither is reachable in the shipped wiring;
nothing here gates the run. The checklist sections on PII encryption, role-based masking, audit
logging, JWT/password storage, Helmet, rate limiting, and error filters have no counterpart in
these 7 files — they are not silently passed, they are not applicable to this diff, and no claim
is made about them elsewhere in the repo.

## Findings

| ID | Severity | Location | Issue | Impact | Recommendation |
|---|---|---|---|---|---|
| SEC-1 | low | `packages/web/src/grid/interaction/math/all-day.create.ts:48` | `resolveAllDayDayRange` has no date-validity guard. For an unparseable `last`, `dayjs(last).add(1,"day").format(...)` returns the literal string `"Invalid Date"`, which `allDayGridSchedule` (`packages/web/src/events/grid-event-draft.adapter.ts:202-211`) turns into `new Date(NaN)` in the draft store. Confirmed downstream: the all-day branch of `buildSchedule` (`packages/web/src/events/event-draft.parser.ts:112-136`) only null-checks and string-compares `toDateOnlyString(...)`, so two equal `"Invalid Date"` strings pass `endStr < startStr` and no field error is raised. | **Not reachable today** — see the trace in "Checked and clean" #1; both production call sites clamp. The exposure is that removing the old try/catch left the function with no internal contract enforcement, so a future caller supplying an unclamped date string gets a corrupt draft silently rather than an exception. | Guard at the boundary rather than restoring the silent try/catch (which the senior review correctly removed for masking errors): validate with `dayjs(last).isValid()` and throw, or narrow the input type so only clamped grid dates can be passed. Add a unit case for an unparseable input asserting the chosen behaviour. |
| SEC-2 | info | `packages/web/src/grid/hooks/useAllDayDraftCreation.ts:138-139` | `finish()` calls `stopPropagation()` from a **window capture-phase** listener, which is the first node in the propagation path, so it suppresses the release `mouseup` for every downstream listener — including `useGridMouseUp`, bound on `#root` (`packages/web/src/views/Week/components/Draft/grid/hooks/useGridMouseUp.ts:88`). | **No security impact** (see #4). Flagged only because the compensation is invariant-dependent: `AllDayRow.openAllDayDraft` re-implements the one branch it suppressed (`draftActions.setFormOpen(true)`), which is correct *only* while a new all-day draft keeps taking `useGridMouseUp`'s `shouldOpenForm` branch. If `getNextAction` ever routes new all-day drafts to `shouldSubmit`, or if `stopMotion()` becomes reachable in this state, the suppression becomes a silent behaviour drop. | Keep the coupling documented (the inline comment at `AllDayRow.tsx:58-61` already does this well). Consider narrowing to `stopImmediatePropagation` on the target path, or add a regression test asserting the release commit still opens the form, so a future change to `getNextAction` fails loudly. |

## Checked and clean

The seven areas requested, each with the evidence that produced the "no finding".

1. **Unbounded / adversarial input to the date math — no finding.** Traced both production call
   sites. `AllDayRow.tsx:49-55` and `DayCalendarGrid.tsx:249` both resolve dates through
   `dateCalcs.getDateStrByXY` → `useGridCoordinates.getDateByXY`
   (`packages/web/src/grid/hooks/useGridCoordinates.ts:47-60`), which indexes `visibleDates` with
   `getVisibleDateIndexByX`. That function returns `Math.max(0, Math.min(dateIndex, length - 1))`
   (line 33) and falls back to `dayjs()` when the array is empty (line 50), then formats — so the
   returned string is **always** a valid `YYYY-MM-DD`. A pointer far outside the grid clamps to
   column 0 or the last column; a `NaN` `clientX` leaves `dateIndex` at 0 because every `NaN`
   comparison is false. **`Invalid Date` therefore cannot reach the store through the shipped
   wiring**, and the try/catch removal opened no crash path (SEC-1 records the residual
   defence-in-depth gap only).
   *Empty `visibleDates`*: guarded by `length > 0` at `all-day.create.ts:31`, so `visibleDates[0]`
   is never read; clamping is skipped and the raw dates pass through. Covered by the
   "no window supplied" test (`all-day.create.test.ts:105-124`).
   *Non-ascending window*: produces a wrong-but-bounded range (both clamp targets are still real
   date strings from the supplied array) — no crash, no invalid date. Cannot occur in practice:
   `getVisibleDates` maps `weekProps.component.weekDays`, which is ascending by construction.
   *Pointer y*: `resolveRangeForPointer` freezes `pointerStart.y` (`useAllDayDraftCreation.ts:116`),
   so anchor and pointer share an identical minute offset and cannot drift across a day boundary
   mid-drag.

2. **Resource exhaustion / DoS-by-gesture — no finding.** There **is** a dedup guard:
   `isSameAllDayDayRange(nextRange, lastRange)` at `useAllDayDraftCreation.ts:177-179` returns
   before `draftActions.setGridDraft`, so store writes and re-renders happen at most once per
   day-column crossing (≤ 6 per left-to-right week drag), not once per pointer move. No unbounded
   loop or array growth is keyed off the day range: `resolveAllDayDayRange` is O(1) day-arithmetic
   with no day-by-day iteration, `replaceGridDraftSchedule`
   (`grid-event-draft.adapter.ts:160-169`) is a shallow spread, and `getVisibleDates()` is called
   **once per press** (line 71) and captured in a `const`, not per move. Per-move allocation is a
   fixed handful of small objects, and the pre-move path returns at the threshold check
   (lines 165-174) before allocating anything. Worst case is bounded by the 7-column window.
   *Noted, not a finding*: `getStartDate` per move reaches `getBoundingClientRect()`
   (`useGridCoordinates.ts:17`), a forced-layout read on every `mousemove`. This is a perf
   characteristic identical to the pre-existing timed-drag path, not a security issue.

3. **Event-listener lifecycle — no finding.** `cleanup()` (lines 126-131) removes all three
   listeners with **matching capture flags** (`mousemove`/`mouseup` added and removed with `true`
   at lines 127-128 / 192-193; `blur` added and removed with no flag at lines 129 / 194 — a
   mismatch here would be a silent leak, and there is none). All five exit paths reach it:
   normal release (`onMouseUp` → `finish`, line 136), button released off-window
   (`onMouseMove` `buttons !== 1` → `finish`, lines 161-164), window blur (`onBlur` → `cancel`,
   lines 188-190), unmount (`useEffect` teardown → `gestureRef.current?.cancel`, lines 45-50), and
   supersede by a new press (line 60). `finish` calls `cleanup()` *before* the `!hasMoved` early
   return (lines 136-137), so the click path unregisters too. `isFinished`/`isCancelled` make all
   of these idempotent. Accumulation across repeated drags is impossible: `gestureRef` holds a
   single slot and each new press cancels the previous gesture. The one lingering case — release
   outside the window with no blur and no subsequent move — retains exactly one gesture's
   listeners until the next move or press, which is the same bound as the shipped
   `useTimedDraftCreation` (lines 192-220 there).

4. **`stopPropagation` side effects — no finding.** Enumerated every global mouse listener in
   `packages/web/src`: `useTimedDraftCreation.ts:219` (mutually exclusive gesture),
   `useGridEventMouseDown.ts:136` (drag of an *existing* card — cannot be mid-gesture during a
   fresh empty-space press), `useGridMouseUp.ts:88` (SEC-2, compensated),
   `useKeyboardOnlyMode.ts:80-81` (`mousedown`/`click`, not `mouseup` — unaffected, and
   `preventDefault` on `mouseup` does not suppress the subsequent `click`),
   `DatePicker.tsx:91` (click-outside dismissal on **`mousedown` document capture**, which runs
   before React's root handler and is therefore untouched),
   `PointerCaptureBoundary.tsx:164` (`pointerup`, a different event type that fires *before*
   `mouseup` — unaffected). **No session-activity, idle-timeout, or auto-logout tracking exists in
   the web package**: a targeted `grep -niE "\bidle\b|inactivity|lastActivity|autoLogout|sessionTimeout"`
   over `packages/web/src` returns only `motionMode="idle"` prop values and unrelated comments.
   Critically, the suppression is gated on `hasMoved` (line 137 returns before line 138), so a
   plain click never swallows anything — focus management and click-outside dismissal are intact.

5. **Data exposure — no finding.** No `console.*`, logger, `captureException`, or analytics call
   in any changed file. No event content (title, description, location, attendees) is read,
   serialized, or transmitted; the drag path touches only `schedule`. No new network call, no
   storage write, no `postMessage`. Secrets scan over all 7 changed files
   (`api[_-]?key|secret|password|token|bearer|credential` followed by `=`/`:` and a quoted
   alphanumeric) returns nothing, including in the two test files and the doc — no real
   credentials in fixtures, no secrets in documentation examples.

6. **Dependency risk — confirmed, no new dependency.** `git diff --stat` over `package.json`,
   `packages/web/package.json`, `packages/core/package.json` and `bun.lock` is empty, and
   `git status` lists none of them as modified. The only imports added by `all-day.create.ts` are
   two first-party modules (`@core/constants/date.constants`, `@core/util/date/dayjs`). See the
   advisory section for the repo-wide audit result.

7. **Cross-tenant / calendar scoping — no finding.** The multi-day path cannot swap or drop
   calendar scoping. `calendarId` enters once at `useAllDayDraftCreation.ts:81` into `pressDraft`,
   and every subsequent draft in the gesture is derived from that same object via
   `draftForRange` → `replaceGridDraftSchedule` (lines 120-124), which spreads
   `{ ...draft, values: { ...draft.values, schedule } }`
   (`grid-event-draft.adapter.ts:160-169`) — it replaces **only** `schedule` and preserves
   `values.calendarId` byte-for-byte. The revert path (`cancel`, line 155) re-sets the identical
   `pressDraft` object. There is no second `createGridEventDraft` call in the drag path that could
   re-derive scoping from a different source. Scoping is therefore identical to the pre-existing
   single-day path by construction, not by coincidence.

### Not applicable to this diff (explicitly not claimed as passing)

PII field encryption (`government_id`/`bank_account`/`salary_base`), role-based response masking,
audit-log write ordering and append-only enforcement, route guards and `reports_to` checks, JWT
secret sourcing, password hashing cost factors, Helmet, auth rate limiting, and global error
filters have **no code in the 7 changed files**. These were not audited and no assertion about
their state elsewhere in the repo is made here.

## Noted (pre-existing, out of scope)

- **`npm audit --omit=dev` cannot run in this repo**: it exits `ENOLOCK` because the project uses
  Bun (`bun.lock`, no `package-lock.json`). Substituted `bun audit --prod`, which reports
  **75 vulnerabilities (26 high, 41 moderate, 8 low)**, all in transitive dependencies untouched by
  this run: `ip-address` (high, SSRF/trust-boundary bypass, via `@compass/backend › mongodb`),
  `nanoid` (high, via `@compass/web › postcss`), `postcss` (high, arbitrary `.map` file read via
  attacker-controlled `sourceMappingURL`), `ws` (high, memory-exhaustion DoS, via `jsdom`), and
  `@tiptap/core` (moderate, `mergeAttributes()` `__proto__` handling). **Advisory only — this run
  added zero dependencies, so none of these are introduced by it and none gate Gate 3.** Worth a
  standalone dependency-hygiene ticket; the `postcss` and `@tiptap/core` entries reach the web
  bundle's toolchain and runtime respectively.

## Required fixes before sign-off

None. No finding in scope is blocking.

## Suggested follow-up tickets

1. **SEC-1** — add an explicit validity contract to `resolveAllDayDayRange` (throw on invalid
   input, or narrow the input type) plus a unit case. Low priority; defence-in-depth.
2. **SEC-2** — add a regression test asserting the release commit opens the form, pinning the
   `useGridMouseUp` `shouldOpenForm` invariant that the capture-phase `stopPropagation`
   compensation depends on.
3. **Dependency hygiene (pre-existing)** — triage the 26 high advisories from `bun audit --prod`,
   and note in contributor docs that `npm audit` is unusable here so `bun audit` is the supported
   command.
