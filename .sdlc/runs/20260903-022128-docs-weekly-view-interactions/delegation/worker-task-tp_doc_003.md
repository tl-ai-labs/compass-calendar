## Task tp_doc_003 — docs / doc_addition
Module: docs-frontend
### Working directory
You are running as an agent inside `/home/sainadh/projects/compass-calendar/compass/compass-calendar`. You may list, read,
edit and create files there, and run commands there. That directory is the
only place you can act; nothing outside it is reachable.
### Instruction
REVISION PASS. Read the EXISTING file docs/frontend/weekly-view-interactions.md and apply the 15 corrections in the DEFECTS slice. Rewrite the whole file with those corrections applied.

RULES:
- Apply ONLY the listed corrections. Do NOT restructure, retitle sections, or rewrite prose that is not named in a defect. Everything not mentioned is already verified correct and must survive byte-identical where practical.
- Every correction below was verified against source by a reviewer. Use the EXACT replacement facts given. Do NOT substitute your own reading.
- DO NOT WEAKEN AC-2. The claim 'all-day drag-to-create does not exist on this branch' must survive intact in all three places it appears. D-4 loosens a DIFFERENT claim (the word 'solely'); do not let that fix erode the drag-to-create assertion.
- Keep exactly ONE trap section, still titled '## The Scope You Did Not Choose'. Do not add a second.
- No raw Tailwind / theme colour utility classes anywhere.
- Write ONLY docs/frontend/weekly-view-interactions.md. Do NOT touch README.md — it is already correct. Touch no other path.
### Provided excerpts
These are extracts, not whole files. The paths are real — open them in the
working directory when you need more than the excerpt shows.

#### DEFECTS/majors.md
_Included because: The 6 major defects with exact anchors and verified replacement facts._

```
D-1 — A TEST FIXTURE IS PRESENTED AS PRODUCTION UI.
Current text (in '### All-Day Creation Gesture'):
    When triggered on the empty all-day target (`role="button"` with accessible name `"Empty all-day space"`):
PROBLEM: `role="button"` / "Empty all-day space" exists ONLY in the test harness packages/web/src/grid/hooks/useAllDayDraftCreation.test.tsx. Zero production occurrences.
VERIFIED REPLACEMENT FACT: the real production surface is a section landmark in packages/web/src/grid/components/AllDayGridRow.tsx (lines 69-74):
    <section
      className="..."
      aria-label="All-day events"
      id={rowId}
      ref={allDayRowRef}
      onMouseDown={onMouseDown}
    >
The mousedown handler is attached to the whole all-day row section, not to a button.
FIX: rewrite the sentence to say the handler is attached to the all-day row section (`packages/web/src/grid/components/AllDayGridRow.tsx`, `aria-label="All-day events"`). Remove the role="button" / "Empty all-day space" claim entirely. You MAY still cite the test names elsewhere — those are correct — but must not present the test's accessible name as production UI.

D-2 — WRONG THRESHOLD FOR ALL-DAY CARDS.
Current text implies all-day cards reuse the timed card's REPEAT_ICON_MIN_WIDTH = 40.
VERIFIED FACT: these are TWO SEPARATE module-local constants.
  - packages/web/src/grid/components/TimedEventCard.tsx:57-58 — REPEAT_ICON_MIN_DURATION_MINUTES = 15, REPEAT_ICON_MIN_WIDTH = 40
  - packages/web/src/grid/components/AllDayEventCard.tsx:32 — REPEAT_ICON_MIN_WIDTH = 60  (its own constant, different value)
FIX: in the all-day bullet, state the width gate is that file's own REPEAT_ICON_MIN_WIDTH = 60, and make clear it is a separate constant from the timed card's 40, not a shared one.

D-3 — THE DELETE STORY IS INCOMPLETE; KEEP THE DIALOG/TOAST DISTINCTION CRISP.
Current text: 'Deletion never prompts: ... returns { kind: "apply", scope: THIS_EVENT } unconditionally ... because deletions are undoable via Cmd/Ctrl+Z.' And later: 'Delete actions do not read or write this set.'
VERIFIED FACTS — BOTH HALVES ARE TRUE AND MUST BOTH APPEAR:
  (a) The modal pre-commit scope DIALOG never appears for delete. packages/web/src/events/recurrence/recurrence-scope-decision.ts returns { kind: "apply", scope: THIS_EVENT } unconditionally for action === "delete". THIS CLAIM IS CORRECT — KEEP IT.
  (b) BUT the after-the-fact scope TOAST *is* raised for deletes. packages/web/src/events/mutations/useEventMutations.ts (around line 855) calls recurrenceScopeOpportunityActions.begin({ kind: "delete", original, source }). packages/web/src/common/utils/toast/recurrence-scope.toast.tsx renders it with the verb "Deleted" and the same Following / All buttons.
FIX: say plainly that delete never raises the modal dialog, but DOES raise the post-commit toast, with verb "Deleted". Do NOT flip this to 'deletes prompt' — the distinction between the blocking dialog (never) and the non-blocking toast (yes) is the whole point.
ALSO FIX the sentence 'Delete actions do not read or write this set' — see D-8.

D-4 — 'SOLELY' IS FALSE.
Current text: 'Multi-day all-day spans never originate from drag-creation; they arise solely by moving or resizing an already-saved all-day event.'
VERIFIED: multi-day all-day spans ALSO arise from (i) the event form's independent end-date picker (packages/web/src/views/Forms/EventForm/DateControlsSection/.../DatePickers.tsx), and (ii) multi-day TIMED events being projected into the all-day row — packages/web/src/events/queries/event.view-model.ts filters timed events through shouldRenderTimedInAllDayRow() and re-renders them with scheduleOverride { isAllDay: true, isTimedMultiDayDisplay: true }.
FIX: drop the word 'solely'. Keep 'never originate from drag-creation' — that half is TRUE and is AC-2 critical. Add a short sentence naming the other two origins (form end-date picker; multi-day timed projected into the all-day row). Consider renaming the heading from '### Multi-Day Spans via Move and Resize' to something accurate like '### Where Multi-Day Spans Come From'.

D-5 — AC-6 VIOLATION: RESTATES THE LINKED DOC.
The two bullets currently reading (a) 'To maintain idempotency across repeated animation frames and pre-commit checks, the math branches strictly on initialEdge captured at grab time rather than a mutable active edge.' and (b) 'Commits for all-day events use a date-diff delta (dayjs(dayDate).diff(dayjs(initialDayDate), "day")) because visible multi-day spans are clamped to the window. In contrast, timed events assign days absolutely (dayjs(visual.dayDate).startOf("day")).' RESTATE docs/frontend/week-drag-interaction.md near-verbatim (same snippets, same clamping rationale) — and then the very next line links to that doc 'for a detailed explanation'.
FIX: DELETE both of those bullets. Replace with a single short sentence that says the commit math and idempotency rules are owned by the drag doc, and link to it. Keep the two bullets about createAllDayResizeVisual / updateAllDayResizeVisual — those describe the all-day resize entry points and are not duplicated there.

D-6 — THE ONE-SENTENCE MODEL IS NOT ONE SENTENCE.
Current: a 40-word bolded sentence with four clauses, PLUS a second sentence after it. Sibling pages use 6-12 words ('**A drag column knows its own date.**').
FIX: replace the ENTIRE '## The one-sentence model' body with exactly this, and nothing else:

**The week grid commits every gesture immediately and asks about scope afterward.**

Then at most two short plain (non-bolded) sentences expanding it — pointing out that creation resolves synchronously on mousedown and that recurrence scope is negotiated after the commit, never before. Delete the existing second sentence entirely.
```

#### DEFECTS/minors-and-security.md
_Included because: The 9 minors plus the medium security finding._

```
S-1 (SECURITY, MEDIUM) — THE UNDO CLAIM IS OVER-BROAD AND UNSAFE.
Current text asserts, unqualified, that deletions are undoable via Cmd/Ctrl+Z.
VERIFIED: packages/web/src/events/mutations/event.mutation-history.ts lines 84-85 gate it:
    const undoable =
      !!existing && isUndoableRecurrence(existing) && isThisScope(scope);
    if (undoable) undoHistoryActions.record({ kind: "delete", event: existing });
where isUndoableRecurrence(event) is `event.recurrence.kind !== "series"` and isThisScope(scope) is `!scope || scope === "this"`.
CONSEQUENCE: deleting a SERIES BASE, or deleting at scope "all" / "thisAndFollowing", records NO undo entry and is IRREVERSIBLE client-side. The codebase is careful about this: packages/web/src/common/utils/toast/deleted-toast.util.tsx withholds the Cmd+Z keycap for exactly this reason.
FIX: qualify the undo claim precisely — a single event or a single occurrence at scope "this" is undoable; a series-base delete or any non-"this" scope is NOT. This matters because the closing trap section tells contributors to add new grid mutations.
NOTE: packages/web/src/views/Forms/hooks/useDeleteEvent.ts carries a source comment saying deletes are undoable via Cmd/Ctrl+Z with NO qualification. That comment is itself over-broad. Do NOT copy it. Do not add a TODO or try to fix that file — it is off-limits.

D-7 — WRONG HOME FOR THE OPPORTUNITY PREDICATE.
The doc attributes the 'opens opportunities when ...' predicate to recurrence-scope-opportunity.store.ts. It actually lives at the CALL SITE, packages/web/src/events/mutations/useEventMutations.ts (around lines 796-808 for replace, 846-858 for delete). The store exposes begin/dismiss/requestPromotion/claimPromotion/complete; it does not itself decide when to open.
FIX: attribute the predicate to useEventMutations.ts; keep the store cited for the state machine only.

D-8 — 'DELETE ACTIONS DO NOT READ OR WRITE THIS SET' IS WRONG.
Contradicted by claimPromotion (recurrence-scope-opportunity.store.ts ~lines 107-115) and by begin()'s supersede path.
FIX: remove that sentence. Replace with an accurate statement: the declined set suppresses the ASK for later EDITS to that instance; it is not a blanket 'deletes never touch it'. If unsure of the exact semantics, state only what is certain — that dismissing the toast records the instance in declinedEditInstanceIds and later edits to it stop asking for the rest of the session.

D-9 — GRID_TIME_STEP MISCHARACTERIZED.
Current: 'Movement past hasExceededInteractionMoveThreshold adjusts the draft end time by GRID_TIME_STEP.'
VERIFIED: GRID_TIME_STEP is the MINIMUM end (the floor), not an increment. In useTimedDraftCreation.ts the end follows the pointer date directly; GRID_TIME_STEP only supplies `const minimumEndDate = start.add(GRID_TIME_STEP, "minutes")` so a shrinking drag cannot go below one step.
FIX: say the end follows the pointer, floored at one GRID_TIME_STEP above the start.

D-10 — useDeleteEvent ATTRIBUTION (security, LOW).
Current text says 'packages/web/src/views/Forms/hooks/useDeleteEvent.ts hardcodes scope: "this"'.
VERIFIED: the hardcoding is in the standalone helper `deleteEventAndDiscardDraft` in that file. The `useDeleteEvent` HOOK itself takes a caller-supplied scope, defaulting to "this" — and that is precisely the path that can pass a non-undoable scope.
FIX: attribute the hardcoded scope to deleteEventAndDiscardDraft, and note the hook accepts a caller-supplied scope.

REMAINING MINOR POLISH (apply only if it does not disturb correct prose):
D-11 — Do not imply the repeat icon's duration gate applies to all-day cards; only the timed card has a duration gate.
D-12 — Where the doc says the toast has 'no "This event" button because the edit has already applied', keep it — it is correct — but make sure it reads correctly for the delete case too now that D-3 adds deletes.
D-13 — Ensure every inline path remains backticked and repo-relative.
D-14 — Keep the existing correct citations for scheduledNonSeries(), WeekView.tsx confirmAllRecurringEdits={false}, the RecurrenceScopeDialog radiogroup and its rule-change exclusion, and all 11 hex values — these were all verified correct, do not touch them.
D-15 — Preserve the trailing newline at end of file.
```
### Acceptance criteria
- The role="button" / 'Empty all-day space' test fixture is no longer presented as production UI; the all-day row section landmark in AllDayGridRow.tsx is cited instead.
- All-day repeat icon width gate is stated as REPEAT_ICON_MIN_WIDTH = 60, a separate constant from the timed card's 40.
- Delete is described as never raising the modal scope dialog but DOES raise the post-commit 'Deleted' toast.
- The word 'solely' is gone; the form end-date picker and multi-day timed projection are named as other origins of multi-day spans.
- The assertion that all-day drag-to-create does NOT exist on this branch survives intact and unweakened.
- The restated commit-math / idempotency bullets are removed and replaced by a link to week-drag-interaction.md.
- The one-sentence model is a single bolded sentence of at most 15 words, with no second bolded sentence.
- The Cmd/Ctrl+Z undo claim is qualified: series-base deletes and non-'this' scopes are not undoable.
- The opportunity-opening predicate is attributed to useEventMutations.ts, not the store.
- The sentence 'Delete actions do not read or write this set' is removed.
- GRID_TIME_STEP is described as a floor, not an increment.
- Exactly ONE trap section remains, titled '## The Scope You Did Not Choose'.
- No raw Tailwind or theme colour utility class appears anywhere.
- Only docs/frontend/weekly-view-interactions.md is written. README.md is NOT modified.
### Your final message
Your final message must be a single JSON object and nothing else — no
prose before it, no summary after it, no ``` fence around it. It must
conform to this schema:

```json
{
  "type": "object",
  "properties": {
    "path": {
      "type": "string"
    },
    "content": {
      "type": "string"
    }
  },
  "required": [
    "path",
    "content"
  ]
}
```