# Security Review — brownfield, pass 1

**Run:** `20260819-212923-feature-extend-weekbody-multiday-drag`
**Intent:** `feature-extend` (front-end only, `packages/web`)
**Mode:** brownfield — scoped to files touched by this run per `provenance.json`

## Scope

### Files reviewed (all 9 entries in `provenance.json`, minus the `.sdlc/` artifact)

Changed:
- `/home/sainadh/projects/compass-calendar/compass/compass-calendar/packages/web/src/grid/hooks/useAllDayDraftCreation.ts`
- `/home/sainadh/projects/compass-calendar/compass/compass-calendar/packages/web/src/grid/hooks/useAllDayDraftCreation.test.tsx`
- `/home/sainadh/projects/compass-calendar/compass/compass-calendar/packages/web/src/interaction/interaction.constants.ts`
- `/home/sainadh/projects/compass-calendar/compass/compass-calendar/packages/web/src/views/Week/components/Grid/AllDayRow/AllDayRow.tsx`

New:
- `/home/sainadh/projects/compass-calendar/compass/compass-calendar/packages/web/src/grid/interaction/math/all-day.create.ts`
- `/home/sainadh/projects/compass-calendar/compass/compass-calendar/packages/web/src/grid/interaction/math/all-day.create.test.ts`
- `/home/sainadh/projects/compass-calendar/compass/compass-calendar/packages/web/src/views/Week/hooks/grid/useAllDayGridDraftCreation.ts`
- `/home/sainadh/projects/compass-calendar/compass/compass-calendar/packages/web/src/views/Week/hooks/grid/useAllDayGridDraftCreation.test.tsx`

The changed-file list was independently confirmed against `git status --porcelain` and `git ls-files --others --exclude-standard`; the two lists agree exactly, so no touched file escaped review.

### Read but not audited (context only, unchanged by this run)
`DayCalendarGrid.tsx`, `useGridCoordinates.ts`, `useDateCalcs.ts`, `useDayCalendarColumns.ts`, `interaction.pointer.ts`, `shortcuts/escape-ownership.ts`, `shortcuts/app-lock.ts`, `CalendarSelect.tsx`. These were read to answer "does the change break an existing guard" — they are not in scope as review targets.

### Explicitly out of scope
The rest of the repository, the backend, and the persistence path. This gesture makes no network call: the draft lives in the Zustand `draft.store` until the existing (untouched) draft-form submit path saves it. Checklist items about PII-at-rest encryption, audit-log integrity, guards on server routes, JWT/bcrypt, Helmet, rate limiting, and the global error filter have no surface in these four front-end files and are recorded as N/A rather than as passes.

### Enumeration note
`Glob`/`Grep` were not relied on; every listing and search in this review was produced with `Bash` (`git status`, `git diff`, `git show`, `grep -rn`, `cat`, `sed -n`). No conclusion below rests on a search that did not run.

## Verdict

**findings-informational** — no must-fix. Nothing in this change blocks Gate 3.

Three informational items are recorded below. None is exploitable as written; each is a note for the next person to touch this gesture. There are genuinely no critical, high, or medium findings, and this report does not manufacture any.

## Findings

| ID | Severity | File:line | Description | Recommendation |
|---|---|---|---|---|
| F-1 | low | `packages/web/src/grid/hooks/useAllDayDraftCreation.ts:217-231` | The gesture installs a raw window **capture-phase** `keydown` listener and calls `stopPropagation()` on Escape while a preview is live. Every other Escape consumer in the app registers on `document` (capture) or through the shortcuts layer, and the repo has a formal arbitration module, `shortcuts/escape-ownership.ts` (`isHigherEscapeOwner()` = app-locked \|\| floating layer open \|\| event form open) that this listener does not consult. Window-capture runs strictly before document-capture, so during a live preview one Escape keystroke is withheld from `useEditSequenceShortcut`, `useKeyboardOnlyMode`, `useShiftHoldEventHints`, `ShortcutShowcase` and the hotkey-bound Escape handlers. **Impact is bounded and fail-safe:** it requires the mouse button to be held on the all-day row *and* the drag to have crossed a day boundary; `cancel()` runs on the same keystroke and removes the listener, so exactly one Escape can ever be absorbed, and the effect is to cancel the drag (deny), never to dismiss a guard or confirm an action. | Consult `isHigherEscapeOwner()` before calling `preventDefault()`/`stopPropagation()`, so a modal, the app lock, or an open event form keeps first claim on the key. Alternatively register through the shortcuts layer so the ownership convention applies automatically. |
| F-2 | info | `packages/web/src/grid/hooks/useAllDayDraftCreation.ts:73, 96-107, 243` | `calendarId` is captured in the gesture closure at mousedown and reused for the mouseup commit, while the Day view's `canCreateDraftOnCalendar` check is evaluated only at mousedown — a nominal TOCTOU window spanning the drag. **Not realizable today:** the Day view is the only guarded call site, all of its columns share the same `date` (`useDayCalendarColumns.visibleDates` maps every calendar column to `dateInView`) and its `getAllDayDraftStartDate` passes `y = 0`, so `pointerDate === anchorDate` on every move, the preview never starts, and `finish()` returns before the second commit. The captured id is therefore consumed exactly once, immediately after the guard. | No change required now. Re-evaluate if the Day view ever gains date-varying columns or the Week gains a per-column calendar guard: at that point re-run the writable check against the *release* column inside `finish()` rather than trusting the mousedown closure. |
| F-3 | info | `packages/web/src/grid/hooks/useAllDayDraftCreation.ts:31-36, 243, 172` | A drag fires the create callback **twice** (once on mousedown, once on release). Both current callbacks are idempotent store overwrites, so this is harmless today, and the author documented it in the header comment. It becomes a real defect the moment a callback acquires a side effect — an analytics event, a network POST, or anything non-idempotent would double-fire. | Keep the invariant documented at the callback boundary, or move the mousedown commit behind the same `isPreviewStarted` gate that `finish()` uses if a side-effecting consumer is ever added. |

Categories with no findings, stated rather than padded: **input trust — none**, **listener/resource hygiene — none**, **PII/data exposure — none**, **dependency delta — none**, **test-code contamination of production — none**.

## Explicitly checked and cleared

**1. Authorization — no bypass introduced, in either view.**
- The Day view's guard is still ahead of every draft-creating path. `DayCalendarGrid.tsx:369` still routes `onAllDayMouseDown` through `createOnCalendarSurface`, which resolves the calendar under the cursor, runs `canCreateDraftOnCalendar(calendar, showErrorToast, writableCalendarIds)`, and on failure calls `preventDefault()`/`stopPropagation()` and returns **without** invoking the hook handler. The entire new drag machinery (listener installation, preview, release commit) lives *inside* the returned handler, downstream of that gate — it is unreachable when the guard denies. This file is unchanged by the run, and the wrapper's position was verified by reading it, not assumed.
- The new drag path cannot walk a draft onto a calendar the user cannot write to. In the Day view the drag produces no preview at all (see F-2 reasoning), so Day behavior is bit-identical to before the change. In the Week view the columns are days, not calendars, so a horizontal drag changes the date range and never the calendar.
- `calendarId` is defaulted to `null` at the Week call site. **This is pre-existing, not introduced by this change** — `git show HEAD:...AllDayRow.tsx` confirms the old code also bound the handler straight to `onMouseDown` with no second argument, so the parameter defaulted to `null` then too. The new binding hook `useAllDayGridDraftCreation.ts` reproduces the prior wiring verbatim. See the pre-existing section.
- Right-click is still rejected first (`isRightClick`, line 75), before any listener is installed.

**2. Event-listener hygiene — bounded; no unbounded accumulation, no immortal gesture.** Four window listeners are installed per gesture and all four are removed together in `cleanup()` (lines 126-132). Each termination path was traced:
- *Rapid repeated mousedown*: line 87 calls `gestureRef.current?.cancel()` before starting a new gesture, so at most one gesture — four listeners — is ever live.
- *No orphaning via the ref*: `cleanup()` nulls `gestureRef.current` unconditionally, which would be a clobber hazard if a stale gesture could clean up after a newer one registered. It cannot: `finish()`/`cancel()` are both short-circuited by `isFinished`/`isCancelled`, and a new gesture is only registered *after* the old one has been cancelled, so the old cleanup can never run a second time.
- *Mousedown with no mouseup*: terminated by any of mouseup, a mousemove with `buttons !== 1` (covers a release that happened off-window), Escape, window blur, or unmount. A truly idle held button leaves four listeners — a constant, not a leak.
- *Unmount mid-gesture*: the `useEffect` with `[]` deps calls `gestureRef.current?.cancel()` on unmount, removing the listeners and discarding the preview draft.
- *Multiple simultaneous buttons*: `buttons !== 1` routes to `finish()`. (Minor UX quirk — a chorded press commits rather than cancels — but not a resource or security issue.)
- The `blur` listener is deliberately registered non-capture, so it sees only the window's own blur and is not triggered by non-bubbling element blurs. Correct choice.
- The run's own test file asserts this: `expectNoLeakedListeners` fails on any unbalanced `type#phase` pair across drag, cancel and unmount cases.

**3. Input trust — no invalid date, no absurd range, no harmful serialization.** Traced `clientX` end to end. `useGridCoordinates.getVisibleDateIndexByX` clamps the column index with `Math.max(0, Math.min(dateIndex, visibleDates.length - 1))`, so an arbitrary or synthetic `clientX` (negative, `1e9`, `NaN`-adjacent) resolves to an in-range column. The Week's `visibleDates` are the seven `weekDays`, so the resolved value is always a real `Dayjs` drawn from the rendered week — the maximum reachable span is seven days, and thousands-of-days ranges are unreachable. `getMinuteByY` is floored at `Math.max(0, …)`. `getAllDayCreateRange` receives two `YYYY-MM-DD` strings formatted from valid `Dayjs` objects, so `Invalid Date` cannot arise; it normalizes reverse drags and returns a half-open range matching the existing click path's convention. Freezing Y at the anchor (lines 118-124) additionally removes the scroll-dependent minute accumulation from the drag, so anchor and pointer share one offset and the span stays consistent. No new value reaches the network on this path at all.

**4. Keyboard interception — lifetime strictly bounded.** The `keydown` listener exists only between mousedown and the first of mouseup / release-detected mousemove / Escape / window blur / unmount; `cleanup()` removes it on every one of those paths. `preventDefault()`/`stopPropagation()` fire only when `isPreviewStarted` is true, and `stopPropagation` (not `stopImmediatePropagation`) is used, so other window-level capture listeners still run. Residual concern recorded as F-1.

**5. PII / data exposure — zero delta.** A targeted grep across the four production files for `console.*`, `localStorage`, `sessionStorage`, `document.cookie`, `fetch(`, `axios`, `window.location`, `history.push/replace`, `analytics`, `track(`, `posthog`, `sentry` returned exactly one hit, and it is the word "analytics" inside a source comment. No new logging, telemetry, storage, URL parameter, or DOM attribute carries user content. The draft holds only a date range and an empty title/description/location until the user types.

**6. Dependency risk — no delta.** `git diff --name-only HEAD -- '*package.json' '*bun.lock' 'bun.lockb'` returns zero files. No import in any new or changed file references a package that was not already in use (`react`, `dayjs` via the `@core` wrapper, and first-party `@web`/`@core` modules only). `npm audit --omit=dev` cannot run in this repo — it is a Bun workspace with `bun.lock` and no `package-lock.json`, and npm exits `ENOLOCK`; synthesizing a lockfile would have written an artifact into the repo. `bun audit` was run instead as the equivalent; results are pre-existing and recorded below.

**7. Test code cannot reach production.** `trackWindowListeners` monkey-patches `window.addEventListener`/`removeEventListener`, but it is a module-local `const` inside `useAllDayDraftCreation.test.tsx`, is never exported, and `restore()` is called in a `finally` in all three call sites (lines 421-422, 442-443, 458-459) so a failing assertion cannot leak the wrappers into sibling tests. No production file imports any `.test` module (verified by grep), so the helper is outside the bundler's import graph. The three test files contain no `vi.mock`/`jest.mock`, no `Object.defineProperty`, no `process.env` manipulation, and no credentials — a secrets grep over them returned nothing. Fixture data is dates and pixel offsets.

**Checklist items that are N/A for this change** (front-end mouse gesture, no server surface, no persistence): PII encryption at rest and its controller→service→entity trace; role-based response masking; audit-log ordering, append-only-ness and field capture; per-route guards, `reports_to` checks, JWT secret sourcing, password hashing; Helmet; auth-endpoint rate limiting; global error filter. Marked N/A rather than "passing" so the reader is not misled into thinking they were exercised.

## Pre-existing observations (out of scope for this run, non-gating)

- **P-1 — The Week all-day row has no writable-calendar guard, and `calendarId` is `null`.** Confirmed pre-existing via `git show HEAD:packages/web/src/views/Week/components/Grid/AllDayRow/AllDayRow.tsx`, which bound the same handler with no calendar argument. Only the Day view wraps creation in `createOnCalendarSurface`. The residual risk is small — the Week draft is in-memory, `null` means "no target chosen yet", and the downstream `CalendarSelect` form field only offers `getWritableCalendars(...)` and renders "No writable calendar available" when the set is empty, so the read-only case is closed at the form. Still, the two views enforce write permission at different layers, which is the kind of asymmetry that rots. Worth normalizing on the Day view's approach when the Week gains per-calendar columns.
- **P-2 — Client-side-only write authorization for draft creation.** `canCreateDraftOnCalendar` is a UX gate: it reads `calendar.capabilities.canWrite` from the calendars query and shows a toast. It is not, and should not be treated as, an authorization boundary — the server must reject writes to non-writable calendars independently. That backend check was not verified here (out of scope for a changed-files review) and should be confirmed to exist on the event-create route.
- **P-3 — Dependency advisories in the existing tree.** `bun audit` reports **69 vulnerabilities (24 high, 37 moderate, 8 low)**, concentrated in the build/test chain — `postcss` (arbitrary `.map` file read via attacker-controlled `sourceMappingURL`, GHSA-6g55-p6wh-862q and its incomplete-fix follow-up), `nanoid` (infinite loop on negative/zero size), and `ws` via `jsdom` (memory-exhaustion DoS). Note that `--prod` did not appear to exclude dev dependencies (jsdom still appears), so the production-only subset is likely much smaller than 24 high. None of this is attributable to this run — no manifest changed — but the tree is due a `bun update` pass and a proper prod-only triage.
- **P-4 — Y-derived date drift in the shared coordinate helper.** `getDateByXY` adds `getMinuteByY(y)` to the column date, and `getMinuteByY` folds in `mainGrid.scrollTop`. For an all-day row sitting above the timed grid the arithmetic stays under a day in practice, so no date rolls over, but the coupling is fragile. This change actually *reduces* exposure by freezing Y for the duration of the drag (lines 118-124); flagged only so the underlying helper's behavior is on the owner's radar.

## PII inventory delta

**None.** No new category of personal data is read, written, derived, transmitted, logged, or persisted. The gesture produces an in-memory `GridEventDraft` containing a start date, an exclusive end date, an all-day flag, and a `calendarId` that is `null` in the Week view — all values the user just produced with their own cursor, none of it leaving the tab. Title, description and location remain empty until the user types into the form, which is a path this change does not touch. No new field requires encryption, masking, retention handling, or audit-log coverage.
