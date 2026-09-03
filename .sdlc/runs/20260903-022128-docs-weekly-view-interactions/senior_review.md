# Senior Review — docs run `20260903-022128-docs-weekly-view-interactions`

- Mode: brownfield, docs-only. Scope: the two files this run wrote
  (`docs/frontend/weekly-view-interactions.md`, `README.md`).
- Method: every behavioral claim in the page was checked against the cited source on this
  branch (`CMP-102/opus-plus-flash-v37-sdk`, source identical to `2d81253a`). No file was
  edited; this review is report-only.

## Verdict

**fail (needs changes)** — 6 defects at major severity, including two claims that are
factually contradicted by the source and one AC-6 duplication violation.

The headline result is good news: **AC-2 passes cleanly.** The page states plainly and
without hedging that all-day drag-to-create does not exist, and the source agrees. The
failures are elsewhere — a test fixture presented as production UI, a wrong icon threshold,
an over-absolute "solely" claim, a materially incomplete delete story, verbatim restatement
of `week-drag-interaction.md`, and a bloated thesis. All are cheap to fix; none require
touching source.

## AC-2 findings (the correctness-critical check) — PASS

Verified against `packages/web/src/grid/hooks/useAllDayDraftCreation.ts` (whole file, 66 lines):

- (a) **No mousemove listener — confirmed.** The hook's entire surface is a single returned
  `(event: ReactMouseEvent<HTMLElement>, calendarId)` handler. There is no `useEffect`
  registering listeners, no `window.addEventListener` of any kind, no `mouseup`, no `blur`.
  The gesture completes inside the one mousedown call.
- (b) **`endDate` is hardcoded to `startDate + 1 day` — confirmed** (lines 48-51):
  ```ts
  const startDate = getStartDate(event.clientX, event.clientY);
  const endDate = dayjs(startDate).add(1, "day").format(YEAR_MONTH_DAY_FORMAT);
  ```
  No pointer input, no span arithmetic, no clamping — the width is not a function of anything
  the user does after mousedown.
- (c) **No softening anywhere in the page.** Grepped the whole doc: line 11 ("does **NOT**
  exist"), line 39 ("exists exclusively in the timed grid"), line 54 ("never originate from
  drag-creation"). Nothing later walks any of that back. Contrast claim is asymmetric in the
  right direction.

Contrast claim verified against `packages/web/src/grid/hooks/useTimedDraftCreation.ts:218-220`
— `mousemove` / `mouseup` (both capture-phase) and `blur` are all attached, threshold gate at
lines 195-204, live preview through `draftActions.setGridDraft` at 149-155. Correct.

Move/resize origin verified: `all-day.resize.ts` (createAllDayResizeVisual lines 26-41,
`getNearestDayColumn` at 51, `initialEdge` branch at 54-56, `resizeFromStart`/`resizeFromEnd`
at 86-113) and `all-day.drag.ts:35`. Correct — but see D-4 for the over-absolute framing.

## Defects

### D-1 (major) — a test-harness element is presented as the production all-day target
`docs/frontend/weekly-view-interactions.md:17`

> "When triggered on the empty all-day target (`role="button"` with accessible name
> `"Empty all-day space"`)"

`"Empty all-day space"` exists **only** in the unit test:
`packages/web/src/grid/hooks/useAllDayDraftCreation.test.tsx:47` renders
`<button onMouseDown={onMouseDown} type="button">Empty all-day space</button>` inside
`renderHarness()`. Repo-wide grep finds it in no other file.

The real surface is a `<section>`, not a button:
`packages/web/src/grid/components/AllDayGridRow.tsx:69-74` —
`<section className="relative flex w-full …" aria-label="All-day events" id={rowId}
ref={allDayRowRef} onMouseDown={onMouseDown}>`, wired from
`AllDayRow.tsx:196-202` (`onMouseDown={onAllDayMouseDown}`).

**Fix:** describe the trigger as the all-day row `<section aria-label="All-day events">`
(`AllDayGridRow.tsx`), and if the harness button is worth mentioning at all, mark it
explicitly as the test fixture.

### D-2 (major) — the all-day repeat-icon width threshold is stated as 40; it is 60
`docs/frontend/weekly-view-interactions.md:74-77`

The page defines `REPEAT_ICON_MIN_WIDTH = 40` in the timed bullet and then says all-day cards
"Apply the width gate only" — which reads as the same 40. The two cards declare *separate*
module-local constants:

- `packages/web/src/grid/components/TimedEventCard.tsx:57-58` — `REPEAT_ICON_MIN_DURATION_MINUTES = 15`, `REPEAT_ICON_MIN_WIDTH = 40`
- `packages/web/src/grid/components/AllDayEventCard.tsx:32` — `REPEAT_ICON_MIN_WIDTH = 60`

`AllDayEventCard.tsx:76-77`: `isRecurring && !isPlaceholder && position.width >= REPEAT_ICON_MIN_WIDTH` (60).

**Fix:** state the all-day threshold as its own value (60) and note the two constants are
duplicated per card file, not shared.

(Everything else in that bullet checks out: `EventRepeatIcon.tsx` is `aria-hidden="true"`,
`size={10}`, `weight="bold"`, `absolute right-1 bottom-0.5`, `color={darken(baseColor, 30)}`;
the all-day padding claim matches `AllDayEventCard.tsx:190` `"pr-3.5": showRepeatIcon`; the
duration-not-pixels rationale at doc:76 is a faithful paraphrase of the source comment at
`TimedEventCard.tsx:50-56`; the `"Recurring "` prefix is real on both cards
— `TimedEventCard.tsx:251-254`, `AllDayEventCard.tsx:128`.)

### D-3 (major) — the delete story is materially incomplete: deletes *do* raise the series toast
`docs/frontend/weekly-view-interactions.md:85` and `:87-88`

The page says "Deletion never prompts" and then describes the post-commit toast purely as an
edit affordance ("There is no `"This event"` button because **the edit** has already applied
to the single occurrence"). A contributor reading only this page concludes that deleting a
recurring occurrence offers no series option. It does:

- `packages/web/src/events/mutations/useEventMutations.ts:846-858` — the `delete` path calls
  `recurrenceScopeOpportunityActions.begin({ kind: "delete", original, source })` whenever
  `original.recurrence.kind === "occurrence" && payload.scope === "this" && !isRestoringHistory()`.
- `packages/web/src/common/utils/toast/recurrence-scope.toast.tsx:48` —
  `const verb = opportunity.kind === "delete" ? "Deleted" : "Changed";` and `toastIdFor()`
  (lines 89-92) routes deletes to `EVENT_DELETED_TOAST_ID`. Same "Apply to series?" body,
  same Following(1)/All(2) buttons.
- Corroborated by the linked runbook: `docs/acceptance/recurring-events.md` Scenarios 8 and 9
  ("While the toast is visible, press `1` … press `2`") are *delete* scenarios.

The narrow claim the page cites is true — `recurrence-scope-decision.ts:89-91` returns
`{ kind: "apply", scope: THIS_EVENT }` unconditionally for `action === "delete"` — but "never
prompts" is about the *pre-commit dialog* only, and the page never says so.

**Fix:** say "delete never opens a pre-commit scope dialog", and add that a delete of an
occurrence raises the same post-commit toast (`kind: "delete"`, verb "Deleted").

### D-4 (major) — "multi-day all-day spans arise **solely** from move/resize" is false
`docs/frontend/weekly-view-interactions.md:54`

The first half ("never originate from drag-creation") is correct and is the AC-2 claim. The
second half ("arise solely by moving or resizing an already-saved all-day event") is
contradicted twice:

1. **The sidebar form has independent start/end date pickers.**
   `packages/web/src/views/Forms/EventForm/DateControlsSection/DateTimeSection/DatePickers/DatePickers.tsx:174-179`
   sets `endDate: formatDate(dayjs(end).add(1, "day").toDate())` on the all-day path with a
   separate `endDatePicker` (line 222). A user can create a multi-day all-day event from the
   form without ever touching the grid.
2. **Multi-day *timed* events are projected into the all-day row.**
   `packages/web/src/events/queries/event.view-model.ts:150-165` — `scheduledNonSeries()` →
   `schedule.kind === "timed"` → `shouldRenderTimedInAllDayRow(...)` →
   `timedMultiDayToAllDayDates(...)` with a `scheduleOverride: { isAllDay: true, … }`. So a
   multi-day bar in the all-day row need not be an all-day event at all. (Already documented
   in `docs/frontend/event-caching.md`, "Multi-day timed events in the all-day row".)

**Fix:** scope the sentence to grid gestures — "no *grid gesture* creates a multi-day all-day
span; on the grid they only arise from move/resize of a saved event" — and add a clause
pointing at the form path and the timed-projection path.

### D-5 (major) — AC-6 violation: `week-drag-interaction.md` is restated, not linked
`docs/frontend/weekly-view-interactions.md:59-62`

The page reproduces the sibling doc's two load-bearing paragraphs, then links to it for "a
detailed explanation" of the very things it just restated:

| new doc | `week-drag-interaction.md` |
|---|---|
| :59 "branches strictly on `initialEdge` captured at grab time rather than a mutable active edge" | :99-106 "must branch on an **immutable** field captured at grab time (e.g. `initialEdge` …) — never on a field the function itself overwrites (e.g. a mutated `activeEdge`)" |
| :60 "all-day … date-diff delta (`dayjs(dayDate).diff(dayjs(initialDayDate), "day")`) because visible multi-day spans are clamped to the window. In contrast, timed events assign days absolutely (`dayjs(visual.dayDate).startOf("day")`)" | :50-58 same two bullets, same two code snippets, same clamping rationale |

R-4 says "Link to, and do not duplicate". This is duplication with the link appended.

**Fix:** delete doc lines 59-60 and let line 62's link carry it; one clause ("commit math
differs by event type — see Week Drag Interaction") is enough.

### D-6 (major) — AC-5: the "one-sentence model" is bloated and is two sentences
`docs/frontend/weekly-view-interactions.md:7`

The bolded thesis alone is 40 words with four coordinate clauses, followed by a second
full sentence that largely repeats it. House style is one short declarative:

- `week-drag-interaction.md:7` — **"A drag column knows its own date."** (6 words)
- `event-caching.md:7` — **"TanStack Query is the cache and the single owner of persisted events."** (12 words)

**Fix:** cut to one short bolded thesis (e.g. "**The week grid commits first and asks
later.**") and move any surviving detail into the unbolded paragraph.

### D-7 (minor) — the opportunity-opening predicate is attributed to the wrong file
`docs/frontend/weekly-view-interactions.md:89`

The page says "The state machine in `…/recurrence-scope-opportunity.store.ts` … opens
opportunities when `original.recurrence.kind === "occurrence" && scope === "this" &&
recurrence.kind === "preserve" && !isRestoringHistory()` and the instance was not previously
declined." The predicate is verbatim correct, but it does not live in the store — the store's
`begin()` (lines 70-80) is unconditional. The guard is in
`packages/web/src/events/mutations/useEventMutations.ts:796-808`.

**Fix:** cite `useEventMutations.ts` for the predicate; keep the store cite for the
ready/requested/submitting state machine.

### D-8 (minor) — "Delete actions do not read or write this set" is contradicted by the store
`docs/frontend/weekly-view-interactions.md:90`

The page copies the store's own comment (`recurrence-scope-opportunity.store.ts:39`), but the
code disagrees in two places:

- `claimPromotion()` (lines 102-118) is kind-agnostic and **deletes** the id from
  `declinedEditInstanceIds`; its own comment says "a delete ask can promote an instance whose
  earlier edit ask was ignored".
- `begin()` (lines 70-80) calls `recordDeclineIfReadyEdit` on the *superseded* opportunity, so
  starting a delete ask while a ready edit ask is live **writes** a decline for that instance.

Accurate statement: a delete ask never *records* a decline for itself and is never suppressed
by the set, but promoting one clears an existing mark.

### D-9 (minor) — timed drag: "adjusts the draft end time by `GRID_TIME_STEP`" is not what happens
`docs/frontend/weekly-view-interactions.md:48`

`useTimedDraftCreation.ts:102-117`: once `hasMoved`, the end follows the pointer
(`resolvedEndDate = pointerDate`); `GRID_TIME_STEP` only supplies the *floor*
(`minimumEndDate = start.add(GRID_TIME_STEP, "minutes")`, applied via
`pointerDate.isBefore(minimumEndDate) ? minimumEndDate : pointerDate`). Also, the upward-drag
swap the page describes is gated on `isSameDayDrag` (line 105) — the page omits that.

### D-10 (minor) — "strictly click-only" ignores the shortcut / command-palette creation path
`docs/frontend/weekly-view-interactions.md:11`

All-day drafts are also created without a click by the `A` shortcut and the command palette:
`packages/web/src/views/Week/hooks/shortcuts/useWeekShortcutOwner.ts:104-116` →
`createAlldayDraft` in `packages/web/src/common/utils/draft/draft.util.ts:50-61`, and
`packages/web/src/components/CommandPalette/event.cmd.constants.ts:28`
(`emitViewCommand("CREATE_ALLDAY_DRAFT")`). That path also produces a fixed one-day span
(`draft.util.ts:61` — `start.add(1, "day")`), so the *span* claim survives; the
"strictly click-only" framing does not.

### D-11 (minor) — the all-day commit delta claim is drag-only
`docs/frontend/weekly-view-interactions.md:60`

"Commits for all-day events use a date-diff delta" is true of **drag**
(`packages/web/src/views/Week/interaction/adapter/commit/all-day.commit.ts:18-21`). All-day
**resize** commits use column-index deltas instead (same file, lines 46-47:
`visual.startDayIndex - visual.initialStartDayIndex`, `visual.endDayIndex -
visual.initialEndDayIndex`) plus an exclusive-end baseline (58-65). (Moot if D-5 removes the
paragraph.)

### D-12 (minor) — Day-view call site also opens the form
`docs/frontend/weekly-view-interactions.md:30`

`DayCalendarGrid.tsx:191-194` — `openGridDraftForm` calls `startGridDraft({ activity:
"gridClick", draft })` **and** `draftActions.setFormOpen(true)`. Week's `AllDayRow.tsx:55-57`
does not. The page presents both call sites as identical.

### D-13 (nit) — `eventColorLabel` returns a display label, not the slot name
`docs/frontend/weekly-view-interactions.md:138`

`theme.util.ts:52-53` returns `EVENT_COLOR_SLOT_LABEL[color]`, which is title-cased
("Lavender", "Coral" — lines 38-44), not the lowercase slot id. The `null` → `"Calendar
default"` half is correct.

### D-14 (nit) — the ban is on palette-named tokens, not all `--color-*`
`docs/frontend/weekly-view-interactions.md:156`

`packages/scripts/src/testing/check-semantic-colors.ts:8-10` bans
`--color-(slate|gray|zinc|…|white)(-\d{2,3})?` specifically, and the utility regex is
`(bg|text|border|ring|outline|placeholder|divide|from|to|via)-<tailwind palette>`. "`--color-*`
theme tokens are strictly forbidden" overstates it. Everything else in that paragraph is
right: the script scans `packages/web/src` only (line 4) and runs first in `bun run lint`
(`package.json:28`).

### D-15 (nit) — `useDeleteEvent` "hardcodes" scope
`docs/frontend/weekly-view-interactions.md:85`

`useDeleteEvent.ts:11-18` (`deleteEventAndDiscardDraft`) hardcodes `scope: "this"`; the hook
itself (lines 34-40) takes `scope: RecurrenceScope = "this"` as a defaulted parameter callers
may override.

## Claims verified correct (no action)

Recording these so a re-review does not re-litigate them:

- All 11 slots and all 11 hex values match `event-color.contracts.ts:6-18` and
  `theme.util.ts:24-36` exactly, in the same order. The "maps 1:1 onto Google's legacy 11" line
  matches the source comment at `event-color.contracts.ts:4-5`.
- `colorHex` read-only: `EventColorPicker.tsx` only calls `onChange(null)` (line 56) or
  `onChange(slot)` (line 70) and its swatch uses exactly the sanctioned inline pattern
  `style={{ backgroundColor: EVENT_COLOR_SLOT_HEX[slot] }}` (line 69), so doc:151 models real
  code. `useSetEventColor.ts:38` patches `{ color }` only.
- `resolveEventPalette` precedence `colorHex` → `color` → theme default:
  `theme.util.ts:105-115`. `buildEventPaletteFromBase` (67-76): `hover: brighten(base)`,
  `gradient: linear-gradient(90deg, darken(base,15), darken(base,30))`,
  `saveButtonShadow: darken(base,25)`. `useEventPalette` reactive (91-95) vs `getEventPalette`
  non-reactive (99-103). All as documented.
- Grid drag/resize commits with no scope dialog: `WeekInteractionCoordinator.tsx:106`
  (`editGridEventDraft(sourceEvent, "this")`) and the source comment at 124-125 ("drag/resize
  commits go through useUpdateEvent (including recurring events) with no scope dialog").
  `useUpdateEvent.ts:36-37` confirms recurrence stays `"preserve"`; the cross-calendar block
  message at line 83 is quoted verbatim correctly.
- Toast: "Apply to series?" (`recurrence-scope.toast.tsx:56`), **Following** + `ShortcutKeys
  keys="1"` (68-69), **All** + `"2"` (81-82), no "This event" button anywhere in the component.
- `WeekView.tsx:202` renders `<SidebarEventDetails confirmAllRecurringEdits={false} />`;
  `SidebarEventDetails.tsx:36` defaults the prop to `true`; `DayViewContent.tsx:138` renders
  `<SidebarEventDetails />` (takes the default). Exactly as documented.
- `RecurrenceScopeDialog.tsx:102` `role="radiogroup"`; options are the
  `RecurringEventUpdateScope` enum values "This Event" / "This and Following Events" /
  "All Events" (`web.event.types.ts:21-25`); rule-change excludes THIS_EVENT and defaults to
  THIS_AND_FOLLOWING (`RecurrenceScopeDialog.tsx:19-22, 79-88`).
- `scheduledNonSeries()` filters `recurrence.kind !== "series"` (`event.view-model.ts:123-126`).
- `packages/sync/src/domain/occurrence-projection.ts` exists;
  `expandLocalEventRecords.ts` header comment matches the doc's one-line summary; optimistic
  expansion lives in `useEventMutations.ts`.
- The `GridEvent` legacy shape is real: `web.event.types.ts:36-42`
  (`recurrence: { rule?, eventId? }`), and `event.view-model.ts:72-76` down-converts —
  occurrences get `{ eventId: seriesId }` with **no** `rule`, exactly as doc:104 says.
- `isEligibleInteractionPointerDown` does filter modifiers and non-primary buttons
  (`interaction.pointer.ts:12-24`); `DRAFT_DURATION_MIN = 30` (`grid.constants.ts:1`);
  `GRID_TIME_STEP = 15` (line 43); `TIMED_DRAFT_CREATE_MOVE_THRESHOLD_PX = 4`
  (`interaction.constants.ts:20`).
- Test names and the asserted schedule quoted at doc:32-35 match
  `useAllDayDraftCreation.test.tsx:60, 84, 96` and the `{ kind: "allDay", start
  2026-05-20, end 2026-05-21 }` assertion at 75-77.
- Trap section: exactly one, titled exactly `## The Scope You Did Not Choose` (line 158). No
  second trap section anywhere in the file. Its body is accurate — the session-suppression
  behavior it describes is `isRecurrenceScopeEditAskDeclined` +
  `recordDeclineIfReadyEdit` (store lines 56-67, 138-141), and "nothing in the drag path will
  do it for them" matches `useEventMutations.ts:796-808` being the only opener.

## AC table

| AC | Requirement (R-6) | Result | Evidence / notes |
|---|---|---|---|
| AC-1 | File exists; all three topics present | **PASS** | `docs/frontend/weekly-view-interactions.md`, 160 lines: All-Day/Multi-Day (9-62), Recurring (64-104), Colors (106-156). |
| AC-2 | All-day drag-to-create documented as absent; re-read against source | **PASS** | No listener in `useAllDayDraftCreation.ts`; `endDate = start + 1 day` (48-51); no hedge anywhere in the page. Timed contrast and move/resize origin verified. See D-4 for the adjacent over-absolute clause (does not weaken the AC-2 claim itself). |
| AC-3 | Both color constraints present in substance | **PASS** | 11-slot enum, 1:1 Google mapping, all 11 hexes, read-only `colorHex`, picker + `useSetEventColor` write `color` only — all verified. Nit D-13. |
| AC-4 | No banned utility-class pattern in any example | **PASS** | Ran the scanner's own regexes over the doc: zero matches. Sanctioned inline `style={{ backgroundColor: EVENT_COLOR_SLOT_HEX[slot] }}` is copied from real picker code. Framing nit D-14. |
| AC-5 | One-sentence-model opener + named closing trap | **FAIL** | Opener present but 40-word/two-sentence (D-6). Trap section is correctly titled `## The Scope You Did Not Choose` and there is exactly one — that half passes. |
| AC-6 | Both links present, neither source restated | **FAIL** | Both links present (62, 66). But doc:59-60 restates `week-drag-interaction.md:50-58, 99-106` near-verbatim (D-5). No meaningful duplication of `docs/acceptance/recurring-events.md`. |
| AC-7 | `git diff -- README.md` is exactly one added line | **PASS** | `1  0  README.md`; the single `+` line is the Weekly View Interactions bullet appended to the links list. No other line touched. |
| AC-8 | `git status --porcelain` lists only in-scope paths | **PASS (note)** | No source or docs path outside the two deliverables was written; `provenance.json` lists exactly those two. `git status` additionally shows SDLC bookkeeping churn — `.sdlc/project.json` (`default_policy` → `opus-plus-flash-v37`), `.sdlc/baseline/current.json`, `.sdlc/baseline/discovery.md`, `.sdlc/pre-check-status.json`, untracked `.sdlc/local/` and `.sdlc/runs/`. Run-layer, not deliverable-layer; flagging for the operator, not as a defect. |

## Recommended fix order

D-2 and D-1 first (wrong facts a contributor will act on), then D-3 and D-4 (misleading
absolutes), then D-5 and D-6 (AC-5/AC-6 compliance), then the minors. All are prose edits to
`docs/frontend/weekly-view-interactions.md`; no source change, no README change.
