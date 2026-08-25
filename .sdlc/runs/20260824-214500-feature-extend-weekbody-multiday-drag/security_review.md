# Security Review — brownfield, changed-files-only

Run: `20260824-214500-feature-extend-weekbody-multiday-drag`
Intent: `feature-extend`
Base: `main` (`4189de1389d8a4644ae20d9c5a907f1d161b5496`)

## 1. Verdict

**no-blocking-issues**

This is a self-contained, front-end-only pointer-gesture change with no network, storage, logging,
serialisation, dependency or authorisation surface. Listener teardown is correct on every terminal
path with matching capture flags, store writes are bounded, and a cancelled gesture cannot commit.
Two low-severity robustness items are recorded below; neither is reachable with real input in a way
that damages data, and neither blocks sign-off.

## 2. Scope statement

Reviewed only the eight files this run wrote, cross-checked against
`.sdlc/runs/20260824-214500-feature-extend-weekbody-multiday-drag/provenance.json` and
`git diff main -- packages/` (the provenance list and the diff agree; no stray writes):

- `packages/web/src/grid/hooks/useAllDayDraftCreation.ts` (substantive)
- `packages/web/src/grid/interaction/math/all-day.create.ts` (new)
- `packages/web/src/interaction/interaction.constants.ts`
- `packages/web/src/views/Week/components/Grid/AllDayRow/AllDayRow.tsx`
- `packages/web/src/grid/hooks/useAllDayDraftCreation.test.tsx`
- `packages/web/src/grid/interaction/math/all-day.create.test.ts` (new)
- `packages/web/src/views/Week/components/Grid/AllDayRow/AllDayRow.test.tsx` (new)
- `packages/web/src/views/Week/components/Grid/MainGrid/MainGrid.test.tsx`

I read unchanged files **only** where the changed code's safety depends on them, and I make no
claims about their own correctness: `useGridCoordinates.ts` and `useDateCalcs.ts` (to determine
whether an unbounded or malformed day range is producible), `interaction.pointer.ts`,
`draft.store.ts`, and a grep of the repo's other `Escape` handlers (to judge interception impact).

Deliberately **not** audited: auth, session, Google OAuth and sync subsystems;
`useTimedDraftCreation.ts` and `packages/web/src/views/Day/**` (declared off-limits and confirmed
unmodified by `git status`); repo-wide dependency CVE sweep.

Tooling note: `Glob`/`Grep` are absent from this build's tool surface, so every enumeration and
absence claim below comes from a `Bash` command (`git diff`, `git status`, `grep -rn`, `find`) that
actually ran. No check is reported as clean on the strength of a search I could not perform.

Verification: `bun test:web` over the three affected test files — **35 pass, 0 fail**.
(An initial bare `bun test` failed on a missing `PORT` env var; that was my harness error, not a
code defect, and is not reported as a finding.)

## 3. Findings

| Severity | File:line | Description | Recommendation |
|---|---|---|---|
| Low | `useAllDayDraftCreation.ts:216` (reached from `:250`) | **Orphaned-gesture listener leak on re-press.** `startMultiDayGesture` assigns `gestureRef.current = { cancel }` without cancelling a gesture already in flight. A second eligible mousedown while a prior gesture is live *and has not yet previewed* (so `isDrafting` is `false` and the dismiss branch at `:230` is skipped) overwrites the handle and strands the previous gesture's four `window` listeners with no remaining way to cancel them — including the capture-phase `keydown` that consumes one global Escape and the `mousemove` that can commit a stray draft. **Reachability is low:** `handleMouseMove:171-174` finishes any orphan on the first move with `buttons !== 1`, so an orphan self-heals on essentially any pointer motion, and a second *eligible* mousedown is not physically producible (button 0 cannot be pressed twice without a release, and every other button fails `isEligibleInteractionPointerDown`). Defence-in-depth, not an exploitable defect. | Call `gestureRef.current?.cancel()` unconditionally at the top of the returned handler, above the `isDrafting` branch. |
| Low | `useAllDayDraftCreation.ts:96` | **`cleanup()` nulls the ref unconditionally.** `gestureRef.current = null` does not check that the ref still points at *this* gesture, so a late-terminating older gesture clears a newer gesture's handle and defeats the unmount cancel at `:55`. Same root cause and same low reachability as above. | Capture the handle (`const handle = { cancel }`) and null only on identity: `if (gestureRef.current === handle) gestureRef.current = null;`. |
| Low | `useAllDayDraftCreation.ts:202-210` | **A no-op Escape is still swallowed globally.** `handleKeyDown` calls `preventDefault()` + `stopPropagation()` at window capture *before* checking whether the gesture ever started a preview, and the listener is armed on mousedown (`:215`) regardless of whether the 4px threshold is crossed. While the primary button is held on the all-day row with no preview yet, one Escape is consumed and `cancel()` produces no visible effect (`isPreviewStarted` is `false`, so no `discard()`). Window-capture is the first stage of the propagation path, so the repo's ~15 other Escape consumers (`useGlobalShortcuts.ts:87`, `useEscapeToDismissToast.ts:17`, `OverlayPanel.tsx:139`, …) are all preempted. Bounded: requires a physically held button, clears on release, and cannot outlive the gesture except via the finding above. | Gate the `preventDefault`/`stopPropagation` on `isPreviewStarted`, so a cancel that does nothing does not eat a global Escape. |
| Info | `all-day.create.ts:25,31,36` | **`resolveAllDayCreateRange` validates nothing.** `startDate` is passed through verbatim (by explicit design, per the module comment) and `endDate` is `dayjs(inclusiveEnd).add(1,'day')`. A `getStartDate` returning `""` would survive `pointerDate ?? anchorDate` (nullish coalescing does not catch empty string) and yield the literal string `"Invalid Date"` as `endDate`, which would flow into the committed draft. Not reachable from either current call site (see the clean result below); recorded as an unguarded contract for future consumers. | Optional: assert `dayjs(x).isValid()` on the resolved range, or narrow the option's type. |
| Info | `useAllDayDraftCreation.ts:104` | The pointer's `clientY` now reaches `getStartDate` on every move, so `getMinuteByY` (which clamps only the low end, `Math.max(0, …)`) participates in resolving the day for y-values far outside the all-day row that the click path never produced. `gridY` cannot exceed roughly 24h of pixels, so a day rollover is not actually reachable; noted only because the drag newly exercises this input range. | None required. |

### Categories verified clean (stated explicitly rather than padded into the table)

- **Global listener hygiene — clean.** All four add/remove pairs match exactly, capture flags
  included: `mousemove`/`mouseup`/`keydown` are `true` on both sides (`:212-215` vs `:92-95`), and
  `blur` is bubble-phase on both sides. No capture-flag mismatch exists. Every terminal path routes
  through `cleanup()`: mouseup (`:192`), buttons-less move (`:172`), Escape (`:209`), window blur
  (`:196`), component unmount (`:55`), and re-press over an open draft (`:234`). Tests W9 and W10
  assert the window is inert after unmount and after a buttons-less move.
- **Input trust — clean.** Traced `getStartDate` end to end: `AllDayRow.tsx:48` →
  `useDateCalcs.ts:25` → `useGridCoordinates.ts:53 → :47 → :15`. `getVisibleDateIndexByX` hard-clamps
  the index to `[0, visibleDates.length - 1]` (`:33`), `getDateByXY` falls back to `dayjs()` for a
  missing date (`:50`), and the result is formatted with `YEAR_MONTH_DAY_FORMAT`. The value reaching
  the range math is therefore always a well-formed `YYYY-MM-DD` inside the rendered week. **Maximum
  span is 7 days**; no unbounded range and no `Invalid Date` can reach the draft or the API.
- **Unbounded resource use — clean.** The suppression check at `:112` bounds store writes to one per
  day-column change (at most 7 per gesture); test W11 asserts that intra-column moves never call
  `setGridDraft`. Nothing accumulates per move — no arrays, no timers, no `setTimeout`/`setInterval`,
  and no listener registered inside a move handler. Per-move cost is two `dayjs` parses and one
  object allocation, both garbage-collected.
- **State integrity — clean** apart from the re-press item above. A cancelled gesture cannot commit:
  `cancel()` sets `isCancelled` and tears down before `discard()` (`:157-163`), and `finish()` is
  double-guarded (`:133`) on top of having had its listener removed. `finish()` calls `cleanup()`
  **before** `preventDefault`, `getStartDate` and the commit (`:137-149`), so a throw in consumer
  code cannot leave listeners armed. `previewDraft` re-checks both flags *after* the re-entrant
  `getStartDate` call (`:107-110`). `discard()` is gated on `isPreviewStarted` (`:161`), so a gesture
  never destroys a draft it did not create. The only post-unmount write is the deliberate `discard()`
  on the unmount path (`:55`), which targets an external Zustand store, not React state.
- **Data exposure — clean.** Grepped the four non-test changed/new source files for `console.`,
  `debugger`, `fetch(`, `axios`, `localStorage`, `sessionStorage`, `document.cookie`, `innerHTML`
  and `eval(` — no matches. The committed draft is produced by the same
  `createGridEventDraft(schedule, undefined, calendarId)` call the pre-change click path used; only
  the schedule's `endDate` differs. Nothing was added to any network payload, and no event content,
  calendar id or user data is logged or serialised anywhere new.
- **Secrets / fixtures — clean.** The checklist regex plus a widened scan
  (`api_key|secret|password|token`, `Bearer`, `eyJ…` JWTs, `ya29.`, `sk-`, `ghp_`, `AIza`, mail
  domains) over all eight changed files, test files included, returned no matches. No real
  credentials are embedded in the new fixtures.
- **Authn / authz / PII — not applicable.** This delta introduces no route, no guard, no serializer,
  no DTO, no persisted PII field and no audit-log write. The checklist's PII-encryption,
  role-masking, audit-integrity and JWT/password items have no corresponding surface in these files.

## 4. Dependency posture

Unchanged — `git diff main` over `package.json` and `bun.lock` is empty and `git status` shows
neither as modified; every import in the new and changed source files resolves to an internal
`@core`/`@web` alias or to `react`, so no third-party module was added. Repo-wide CVE sweep out of
scope per the brief.

## 5. Residual risks accepted

- The orphaned-gesture leak and the swallowed no-op Escape are both real code paths, kept open
  because the self-healing `buttons !== 1` branch and the physical impossibility of a double primary
  press make them unreachable in normal use. If the hook later gains touch or pointer-event support
  — where a second concurrent primary pointer *is* producible — both should be fixed first, as the
  reasoning that makes them safe today no longer holds.
- During a genuine drag the capture-phase Escape interception is intentional and correct, but it
  does mean the all-day gesture takes priority over every other Escape consumer in the app for the
  duration of the press. That is a deliberate design choice recorded in the change plan, not a
  defect; noted so a future reviewer does not rediscover it as a surprise.
- `resolveAllDayCreateRange` is exported as a general-purpose module while trusting its caller to
  supply parseable dates. Safe for both current call sites; worth a validation guard if a third
  consumer with a less constrained `getStartDate` appears.
- No commit exists yet for this run (`git_head_after: null`, `commits: []`), so this review covers
  the working tree as of the audit, not a committed revision.

## 6. Required fixes before sign-off

None. The three Low items are recommended follow-ups, not gates.
