# Senior Review #2 (re-review after remediation) — docs run `20260903-022128-docs-weekly-view-interactions`

- Mode: brownfield, docs-only. Scope: the two files this run wrote
  (`docs/frontend/weekly-view-interactions.md`, `README.md`).
- Method: every remediated claim re-checked against the cited source on this branch. No file
  was edited by this review; report-only. `git status --porcelain` confirms **no `packages/**`
  file changed during remediation**, so every claim verified in review #1 against unchanged
  source remains valid by construction — only the doc's prose could have regressed, and that
  was checked by diffing the doc against the run's own pre-remediation backup.

## Verdict

**pass_with_notes**

All 6 majors (D-1..D-6) and the security note (S-1) are genuinely fixed and each fix was
re-derived from source, not taken on trust. AC-5 and AC-6 now pass, so all eight ACs pass.
The remediation diff is tightly scoped: it touches exactly the 9 regions it was supposed to
touch and nothing else — no previously-correct content was collaterally damaged. README is a
clean one-line addition.

Notes (not blocking): four minors from review #1 (D-10, D-12, D-13, D-14) were not addressed
at all, D-9 is fixed only in its main half, and the D-3/D-8 rewrites each introduce a mildly
over-broad sentence (N-1, N-2). None is a false statement a contributor would act on
destructively; all are precision nits.

## How the remediation diff was scoped

`diff -u backups/docs__frontend__weekly-view-interactions.md docs/frontend/weekly-view-interactions.md`
returns exactly 9 hunks, all inside the sections named in the defects: the thesis (D-6), the
all-day trigger sentence (D-1), the timed `GRID_TIME_STEP` bullet (D-9), the multi-day-origins
section incl. its heading and the two deleted bullets (D-4, D-5), the all-day repeat-icon
bullet (D-2), the deletion bullet (D-3, S-1, D-15), the toast/no-"This event" bullet, the
predicate bullet (D-7), and the `declinedEditInstanceIds` bullet (D-8). **Zero** changes to the
Event Colors section, Series Storage, Week-vs-Day, the trap section, or the AC-2 assertions.
That is the strongest available evidence that nothing correct was broken.

## Per-defect verification table

| ID | Defect (review #1) | Status | Evidence re-derived from source |
|---|---|---|---|
| D-1 | Test fixture presented as production UI | **FIXED** | Doc:19 now cites `packages/web/src/grid/components/AllDayGridRow.tsx`, `aria-label="All-day events"`. Verified this is the real surface: `AllDayGridRow.tsx` renders `<section className="relative flex w-full …" aria-label="All-day events" id={rowId} ref={allDayRowRef} onMouseDown={onMouseDown}>`. Handler chain confirmed end-to-end: `AllDayRow.tsx:58` `const onMouseDown = useAllDayDraftCreation({…})` → passed as `onAllDayMouseDown` (68, 82, 110, 130) → `AllDayGridRow` prop `onMouseDown={onAllDayMouseDown}` (143). So the mousedown handler really is attached there. Repo-wide grep for `role="button"` / `"Empty all-day space"` in the doc: **zero hits** (the string now survives only in `useAllDayDraftCreation.test.tsx:47,64,88,102` and in run bookkeeping). |
| D-2 | All-day icon width gate stated as 40 | **FIXED** | Doc:77 now says all-day uses "that file's own `REPEAT_ICON_MIN_WIDTH = 60` (a separate constant from the timed card's `40`, with no duration gate)". Both values verified: `TimedEventCard.tsx:57-58` (`…MIN_DURATION_MINUTES = 15`, `…MIN_WIDTH = 40`, applied 119-120); `AllDayEventCard.tsx:32` (`= 60`, applied 76-77 with **no** duration term). The "separate constant" framing is correct — two module-local declarations, no shared export. |
| D-3 | Delete story incomplete (dialog vs toast) | **FIXED, crisp** | Doc:85 now reads "Deletion never prompts **with a modal dialog**" + "Deletions do raise the post-commit toast with the verb `"Deleted"`". Both halves verified: `recurrence-scope-decision.ts:87-90` returns `{ kind: "apply", scope: RecurringEventUpdateScope.THIS_EVENT }` as the first statement for `action === "delete"` (no dialog, unconditional); `useEventMutations.ts:850-859` calls `recurrenceScopeOpportunityActions.begin({ kind: "delete", original, source })`, and `recurrence-scope.toast.tsx:48` `const verb = opportunity.kind === "delete" ? "Deleted" : "Changed";`. The distinction is **not** flipped — the doc never says deletes prompt. See N-1 for a scope nit on the toast half. |
| D-4 | "solely from move/resize" false | **FIXED** | "solely" is gone (doc:56). Both new origins verified. (a) **Form end-date picker — behaviour confirmed, not just file existence.** `DateTimeSection.tsx:51-66` renders `<DatePickers …>` **only** when `category === Categories_Event.ALLDAY`, so this is the all-day path. `DatePickers.tsx` declares a genuinely independent end picker (`calendarClassName="endDatePicker"`, own `isOpen`, own `onSelect={onSelectEndDate}`, own `selected={displayEndDate}`), and `onSelectEndDate` calls `shouldAdjustComplimentDate("end", …)`, which per `web.datetime.util.ts:21-45` only reports `shouldAdjust` when `_end.isBefore(_start)`. For any end **after** start it takes the else branch: `onSetScheduleField({ endDate: formatDate(dayjs(end).add(1, "day").toDate()) })` — start untouched, end moved out → a multi-day all-day event created entirely from the form. Claim holds. (b) **Timed projection**: `event.view-model.ts:145-167` `multiDayTimedAsAllDayFrom` filters `schedule.kind === "timed"` through `shouldRenderTimedInAllDayRow(...)` (defined `event-nudge.util.ts:77`) and re-emits with `scheduleOverride: { isAllDay: true, startDate, endDate, isTimedMultiDayDisplay: true }`. Doc's partial quote of that object is accurate (it omits `startDate`/`endDate` but is not presented as verbatim-complete). |
| D-5 | AC-6 duplication of `week-drag-interaction.md` | **FIXED** | Both offending bullets deleted (the `initialEdge` idempotency-rationale bullet and the date-diff-delta/absolute-assignment bullet), replaced by one line: doc:62 "Commit math and idempotency rules are owned by [Week Drag Interaction](./week-drag-interaction.md)." Cross-checked the sibling's two load-bearing passages (`week-drag-interaction.md:50-58` commit math, `:99-106` immutable-field rule) — **no remaining restatement** of either. The two surviving bullets (doc:59-60) describe `createAllDayResizeVisual`'s captured fields and `updateAllDayResizeVisual`'s branch, which are direct source facts (verified `all-day.resize.ts:26-41,47-56`), not the sibling doc's prose. AC-6 duplication is cleared. |
| D-6 | Thesis bloated / two sentences | **FIXED** | Doc:7 is now one bolded sentence: "**The week grid commits every gesture immediately and asks about scope afterward.**" — 12 words (`wc -w` = 12), ≤15. The elaboration moved to an unbolded line 9, matching house style in `week-drag-interaction.md:7` / `event-caching.md:7`. |
| S-1 (security, medium) | Unqualified Cmd/Ctrl+Z undo claim | **FIXED** | Doc:85 now: "A single event or a single occurrence at scope `"this"` is undoable via Cmd/Ctrl+Z, whereas deleting a series base or deleting at scope `"all"` or `"thisAndFollowing"` is not undoable." Verified in `event.mutation-history.ts`: `isUndoableRecurrence = (event) => event.recurrence.kind !== "series"` (line ~20), `isThisScope = (scope?) => !scope || scope === "this"` (line 30), and `recordEventDeleteHistory` line 84-87 `const undoable = !!existing && isUndoableRecurrence(existing) && isThisScope(scope); if (undoable) undoHistoryActions.record(...); showDeletedToast(undoable);`. Since `recurrence.kind ∈ {single, series, occurrence}`, "single event or occurrence at scope this" is exactly the undoable set. Accurate. |
| D-7 | Predicate attributed to the store | **FIXED — both predicates verified** | Doc:89 now attributes it to "the mutation call site in `…/useEventMutations.ts`" and keeps the store cite for the state machine only. **Edit predicate** verified verbatim at `useEventMutations.ts:796-808`: `original && original.recurrence.kind === "occurrence" && payload.input.scope === "this" && payload.input.recurrence.kind === "preserve" && !isRestoringHistory() && !isRecurrenceScopeEditAskDeclined(original.id)` → `begin({ kind: "replace", … })`. **Delete predicate** verified at `useEventMutations.ts:850-859`: `original && original.recurrence.kind === "occurrence" && payload.scope === "this" && !isRestoringHistory()` → `begin({ kind: "delete", … })`. The doc's claim that the delete predicate omits the `recurrence.kind === "preserve"` clause is **correct** — and the delete predicate also omits the `isRecurrenceScopeEditAskDeclined` check, which the doc handles correctly by attaching the "(and the instance was not previously declined)" parenthetical to the *edit* branch only. Both predicates are right, and so is the asymmetry. |
| D-8 | "Delete actions do not read or write this set" | **FIXED** | That sentence is gone (doc:90). Its removal is correct: `recurrence-scope-opportunity.store.ts` `claimPromotion()` (102-118) is kind-agnostic and deletes the id from `declinedEditInstanceIds`, and `begin()` (70-80) calls `recordDeclineIfReadyEdit` on the superseded opportunity. Note the *source comment* at store:39 still carries the inaccurate claim; the doc no longer parrots it. See N-2 for a residual nit in the replacement sentence. |
| D-9 | `GRID_TIME_STEP` described as an increment | **FIXED (main half); residual stands** | Doc:50 now: "adjusts the draft end time to follow the pointer, floored at one `GRID_TIME_STEP` above the start" — matches `useTimedDraftCreation.ts:102,114-117` (`minimumEndDate = start.add(GRID_TIME_STEP, "minutes")`; `resolvedEndDate = pointerDate.isBefore(minimumEndDate) ? minimumEndDate : pointerDate`). Floor framing correct. **Residual:** the doc still says "Dragging upward swaps the start and end" without the `isSameDayDrag` gate — source is `const isUpwardDrag = isSameDayDrag && pointerDate.isBefore(start)` (line 105), and the follow-the-pointer branch is likewise `else if (isSameDayDrag)` (113). Cross-day pointer positions fall through to the untouched `defaultEndDate`. Minor, unaddressed. |
| D-10 | "strictly click-only" ignores `A` shortcut / command palette | **NOT FIXED** | Doc:13 still says "Creation on the all-day bar is strictly click-only". Source unchanged and still contradicts the framing: `useWeekShortcutOwner.ts:111` `void createAlldayDraft(...)` and `:153` `"CREATE_ALLDAY_DRAFT"`; `event.cmd.constants.ts:28` `emitViewCommand("CREATE_ALLDAY_DRAFT")`; `draft.util.ts:50` `createAlldayDraft`. The *one-day span* claim still survives (that path also does `start.add(1, "day")`), so AC-2 is unaffected. |
| D-11 | All-day commit delta claim was drag-only | **RESOLVED (moot)** | The bullet was deleted as part of the D-5 fix; no commit-delta claim remains in the page. |
| D-12 | Day-view call site also opens the form | **NOT FIXED** | Doc:32 still presents `AllDayRow.tsx` and `DayCalendarGrid.tsx` as identical `onCreateGridDraft` call sites. `DayCalendarGrid.tsx:191-194` still additionally calls `draftActions.setFormOpen(true)`; Week's `AllDayRow.tsx:55-57` does not. |
| D-13 | `eventColorLabel` returns a display label | **NOT FIXED** | Doc:138 still says "returns the slot name". `theme.util.ts:52-53` returns `EVENT_COLOR_SLOT_LABEL[color]`, title-cased ("Lavender", "Coral", …, map at 38-50). The `null → "Calendar default"` half remains correct. |
| D-14 | Ban is on palette-named `--color-*` tokens only | **NOT FIXED** | Doc:156 still says "`--color-*` theme tokens are strictly forbidden". `check-semantic-colors.ts:8-10` `rawColorTheme = /--color-(?:slate\|gray\|…\|white)(?:-\d{2,3})?/g` — palette-named only; semantic tokens like `--color-border` are permitted. Overstatement persists. |
| D-15 | `useDeleteEvent` "hardcodes" scope | **FIXED** (= the item called "D-10" in the re-review brief) | Doc:85 now attributes the hardcode to `deleteEventAndDiscardDraft` and notes the hook takes a caller-supplied scope. Verified: `useDeleteEvent.ts:11-23` `deleteEventAndDiscardDraft(...)` → `deleteEvent?.({ id, scope: "this" })`; `useDeleteEvent.ts:31-41` `const deleteEvent = useCallback((scope: RecurrenceScope = "this") => { … deleteEventMutation({ id, scope }); … })` — defaulted parameter, overridable. Exactly as documented. |

**Numbering note for the operator:** the re-review brief's "D-10" describes the hardcoded-scope
item, which is **D-15** in review #1. Review #1's actual D-10 (the "strictly click-only" framing)
was not in the remediation packet and is still open. Table above uses review #1's numbering.

## New defects introduced by the remediation

Both are precision nits inside sentences the remediation rewrote. Neither is a false claim that
would mislead a contributor into wrong code, and neither is a regression of a previously-correct
statement — but both are new text, so they are logged here rather than folded into D-3/D-8.

### N-1 (minor) — "Deletions do raise the post-commit toast" is unqualified
`docs/frontend/weekly-view-interactions.md:85`

The scope toast is raised only for the delete predicate verified above — occurrence, scope
`"this"`, not restoring history. Deleting a non-recurring event or deleting at scope `"all"`
raises no "Apply to series?" toast; it raises the *generic* deleted toast instead
(`event.mutation-history.ts:87` `showDeletedToast(undoable)` →
`packages/web/src/common/utils/toast/deleted-toast.util.tsx:14`). Two different toasts both
carry the word "Deleted", which makes the unqualified sentence ambiguous. Mitigating: doc:89,
four lines later, states the delete predicate precisely.

**Fix:** "Deleting a recurring **occurrence** at scope `"this"` raises the same post-commit
scope toast, with the verb `"Deleted"` instead of `"Changed"`."

### N-2 (minor) — "dismissing the toast records the instance" is unqualified
`docs/frontend/weekly-view-interactions.md:90`

`recordDeclineIfReadyEdit` (store:56-67) returns early unless
`current.kind === "replace" && current.status === "ready"`. Dismissing a **delete** toast
records nothing, and `claimPromotion` (102-118) *clears* an existing mark. The replacement
sentence is a strict improvement over the removed false claim, but it now over-generalises in
the opposite direction.

**Fix:** "dismissing or ignoring an **edit** ask records the instance … ; delete asks never
record one, and promoting any ask clears an existing mark."

## Critical regression checks

| Check | Result |
|---|---|
| **AC-2 unweakened** | **PASS.** All three assertions survive the D-4 edit verbatim: doc:13 "Drag-to-create does **NOT** exist for all-day events on this branch… strictly click-only and always creates a fixed one-day span"; doc:41 "drag-to-select-a-span exists **exclusively** in the timed grid"; doc:56 "Multi-day all-day spans **never** originate from drag-creation". The word "solely" was removed from a *different* clause — the one about where multi-day spans come from *after* creation — and the "never originate from drag-creation" half of that same sentence is byte-identical to the pre-remediation text. Grepped the full page for hedges ("usually", "typically", "generally", "in most cases", "except"): none attach to the drag-to-create claim. Source unchanged: `useAllDayDraftCreation.ts` still registers no `mousemove`/`mouseup`/`blur` and still computes `endDate = dayjs(startDate).add(1, "day")`. |
| **Exactly one trap section** | **PASS.** `grep "^## "` returns 5 headings; the only trap section is line 158, titled exactly `## The Scope You Did Not Choose`. No duplicate or renamed trap. Its body is unchanged from the reviewed-correct version. |
| **Previously-verified-correct content intact** | **PASS.** The remediation diff touches none of it, and no source file changed. Spot-re-confirmed: 11 slots + all 11 hexes (doc:115-119, 136-137), the 1:1 Google legacy mapping (121), `colorHex` read-only (128-130), `resolveEventPalette` precedence + `buildEventPaletteFromBase` shades (139-144), `WeekView.tsx` `confirmAllRecurringEdits={false}` (95), `RecurrenceScopeDialog` `role="radiogroup"` + THIS_EVENT exclusion (96), `scheduledNonSeries()` (100, still `recurrence.kind !== "series"` at `event.view-model.ts:123-126`), `GridEvent` legacy `{ rule?, eventId? }` shape (104), and the three quoted test names + the `{ kind: "allDay", start 2026-05-20, end 2026-05-21 }` assertion (35-37) — the test file was not modified. |
| **Backticked paths resolve; new-path claims checked** | **PASS.** All 33 repo-relative paths in the page resolve on disk. The three "misses" in the mechanical scan are bare filenames used as prose siblings, not paths — `timed.drag.ts`, `timed.resize.ts`, `cross-row.drag.ts`, all present in `packages/web/src/grid/interaction/math/`; plus one short-form second reference to `event-color.contracts.ts` whose full path is given earlier at doc:112. The two **newly added** paths were checked for *claim* accuracy, not mere existence: `AllDayGridRow.tsx` (D-1, handler chain traced) and `DatePickers.tsx` (D-4, all-day-only render + independent end-picker behaviour traced). Both claims hold. |
| **README integrity** | **PASS, independently confirmed.** `git diff --stat -- README.md` → `README.md \| 1 +` / `1 file changed, 1 insertion(+)` — **zero deletions**. The full `git diff` is a single hunk `@@ -55,3 +55,4 @@` appending one line to the links list: `- **Weekly View Interactions**: [docs/frontend/weekly-view-interactions.md](./docs/frontend/weekly-view-interactions.md)`. No other line, no mode change, no trailing-newline churn. The silent revert reported by the operator is fully repaired. |

## AC table (final)

| AC | Requirement (R-6) | Result | Evidence |
|---|---|---|---|
| AC-1 | File exists; all three topics present | **PASS** | 160 lines. All-Day/Multi-Day (11-62), Recurring (64-104), Colors (106-156), trap (158-160). |
| AC-2 | All-day drag-to-create documented as absent; re-read against source | **PASS** | Three unhedged assertions (13, 41, 56) intact after remediation; `useAllDayDraftCreation.ts` re-read — no listeners, `endDate = start + 1 day`. D-4's fix did not erode it. |
| AC-3 | Both color constraints present in substance | **PASS** | Section untouched by remediation; 11-slot enum, 1:1 mapping, read-only `colorHex`, picker + `useSetEventColor` write `color` only. Nit D-13 open. |
| AC-4 | No banned utility-class pattern in any example | **PASS** | Re-ran both scanner regexes (`rawColorUtility`, `rawColorTheme` from `check-semantic-colors.ts:6-10`) over the page: zero matches. Framing nit D-14 open. |
| AC-5 | One-sentence-model opener + named closing trap | **PASS** (was FAIL) | Opener is one bolded 12-word sentence (doc:7). Exactly one trap section, titled `## The Scope You Did Not Choose`. |
| AC-6 | Both links present, neither source restated | **PASS** (was FAIL) | Links at 62 and 66. The two duplicated bullets are deleted; no remaining restatement of `week-drag-interaction.md:50-58` or `:99-106`. No duplication of `docs/acceptance/recurring-events.md`. |
| AC-7 | `git diff -- README.md` is exactly one added line | **PASS** | `1 file changed, 1 insertion(+)`, single hunk, zero deletions. |
| AC-8 | `git status --porcelain` lists only in-scope paths | **PASS (note)** | Deliverables: ` M README.md`, `?? docs/frontend/weekly-view-interactions.md`. No `packages/**` path is modified — remediation stayed inside the doc, as required. Remaining entries are SDLC run-layer bookkeeping (`.sdlc/baseline/current.json`, `.sdlc/baseline/discovery.md`, `.sdlc/pre-check-status.json`, `.sdlc/project.json`, untracked `.sdlc/local/`, `.sdlc/runs/`) — flagged for the operator, not a deliverable defect. |

## Recommended follow-ups (non-blocking)

One optional cleanup packet, all prose edits to `docs/frontend/weekly-view-interactions.md`,
no source and no README change:

1. N-1 — qualify the delete-toast sentence (doc:85) to occurrence + scope `"this"`.
2. N-2 — qualify the decline-recording sentence (doc:90) to edit asks; note promotion clears.
3. D-10 — soften "strictly click-only" (doc:13) to "no drag-to-create gesture"; mention the `A`
   shortcut / command-palette path, noting it also yields a fixed one-day span.
4. D-13 — `eventColorLabel` returns a title-cased display label, not the slot id (doc:138).
5. D-14 — scope the token ban to palette-named `--color-<palette>` tokens (doc:156).
6. D-12 — note that the Day-view call site additionally calls `draftActions.setFormOpen(true)` (doc:32).
7. D-9 residual — add the `isSameDayDrag` gate on the upward-swap sentence (doc:50).

None of these blocks acceptance of this run.
