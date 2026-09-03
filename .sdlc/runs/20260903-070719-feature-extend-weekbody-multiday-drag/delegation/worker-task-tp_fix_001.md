## Task tp_fix_001 — debug / frontend_util
Module: grid-allday-gesture
### Working directory
You are running as an agent inside `/home/sainadh/projects/compass-calendar/compass/compass-calendar`. You may list, read,
edit and create files there, and run commands there. That directory is the
only place you can act; nothing outside it is reachable.
### Instruction
Apply SIX senior-review fixes to an existing, working feature. READ each target file before editing. All 24 tests in useAllDayDraftCreation.test.tsx and all 11 in all-day.create.test.ts currently PASS - keep them passing (except where a fix explicitly changes an assertion). Modify ONLY these 5 files: AllDayRow.tsx, useAllDayDraftCreation.ts, useAllDayDraftCreation.test.tsx, all-day.create.ts, docs/frontend/week-drag-interaction.md.

FIX-1 (BLOCKER). In packages/web/src/views/Week/components/Grid/AllDayRow/AllDayRow.tsx, openAllDayDraft currently calls ONLY draftActions.startGridDraft({activity:'gridClick', draft}). Add draftActions.setFormOpen(true) immediately after it, mirroring views/Day/components/Calendar/DayCalendarGrid.tsx:191-194. Add a short comment: the release commit re-enters startGridDraft with unchanged activity/isDrafting, so useDraftActions.handleChange (deps [isDrafting, activity, setIsFormOpen]) does not re-fire, and the capture-phase stopPropagation in useAllDayDraftCreation.finish stops useGridMouseUp from opening it. Do NOT remove the stopPropagation.

FIX-2 (TEST). In useAllDayDraftCreation.test.tsx the test 'clamps at the window edge' never clamps: the default x->date mapper returns '2026-05-23' for x=9999, which IS the last visible date. ADD a NEW test using a harness whose getStartDate returns an OUT-OF-WINDOW date at extreme x, e.g. (x) => (x > 1000 ? '2026-06-15' : defaultXToDate(x)). Press x=50, mouseMove to x=9999 with {buttons:1}, release; assert the committed span is start 2026-05-20 / end 2026-05-24. Do NOT mutate the shared default mapper. Keep the existing test but RENAME it to say what it really pins (the exclusive-end arithmetic).

FIX-3 (TEST). Same file, the test asserting 'preserves clientId' compares secondDraft.clientId to firstDraft.clientId - BOTH are undefined, so it cannot fail. Remove the surrounding `if (firstDraft.kind === 'create' && ...)` guard that also lets it be skipped, and replace the assertion with a structural one proving the second draft is the first with only schedule swapped, e.g. expect(secondDraft).toEqual({...firstDraft, values: {...firstDraft.values, schedule: <the expected span>}}). Rename the test away from 'preserves clientId'.

FIX-4 (REFACTOR). In packages/web/src/grid/interaction/math/all-day.create.ts, DELETE both try/catch blocks and the `input?.` optional chaining on the non-optional `input` parameter in resolveAllDayDayRange. The body is pure string comparison plus dayjs(...).add(1,'day') and cannot throw; the catch fallbacks produce corrupt zero-length ranges like {start:'',end:''}. Keep observable behaviour on all valid inputs byte-identical - all 11 existing math tests must pass UNMODIFIED.

FIX-5 (BUGFIX+TEST). In useAllDayDraftCreation.ts finish(), after computing finalRange, return early when isSameAllDayDayRange(finalRange, pressRange) - a >8px drag staying inside ONE column must not re-commit an identical draft. Then in useAllDayDraftCreation.test.tsx add expect(onCreateGridDraft).toHaveBeenCalledTimes(1) to the existing 'pins constant-column Day model' test, which exercises exactly this path.

FIX-6 (DOCS). In docs/frontend/week-drag-interaction.md all-day section, correct TWO inaccuracies: (a) it claims clientId and calendarId 'match so the second commit replaces rather than duplicates' - clientId is undefined on both; the real mechanism is the single-slot gridDraft in the store plus replaceGridDraftSchedule spreading the press draft. (b) it warns startGridDraft yanks the form shut, but the release commit routes through startGridDraft - now that FIX-1 lands, state that the release commit re-opens the form explicitly via setFormOpen(true) because the activity does not transition.

After editing, run: bun run test:web packages/web/src/grid/hooks/useAllDayDraftCreation.test.tsx and bun run test:web packages/web/src/grid/interaction/math/all-day.create.test.ts and make them green.
### Provided excerpts
These are extracts, not whole files. The paths are real — open them in the
working directory when you need more than the excerpt shows.

#### packages/web/src/views/Week/components/Grid/AllDayRow/AllDayRow.tsx (current, lines 55-70)
_Included because: FIX-1 target. Add setFormOpen(true) after startGridDraft._

```
  const openAllDayDraft = (draft: GridEventDraft) => {
    draftActions.startGridDraft({ activity: "gridClick", draft });
  };
  const getVisibleDates = useCallback(
    () =>
      weekProps.component.weekDays.map((date) =>
        date.format(YEAR_MONTH_DAY_FORMAT),
      ),
    [weekProps.component.weekDays],
  );
  const onMouseDown = useAllDayDraftCreation({
    getStartDate: getAllDayDraftStartDate,
    multiDayDrag: { getVisibleDates },
    onCreateGridDraft: openAllDayDraft,
  });

NOTE: draftActions is ALREADY imported in this file from @web/events/stores/draft.store.
```

#### views/Day/components/Calendar/DayCalendarGrid.tsx:191-194 (the convention to mirror)
_Included because: FIX-1 reference - Day already does the correct pair._

```
  const openGridDraftForm = (draft: GridEventDraft) => {
    draftActions.startGridDraft({ activity: "gridClick", draft });
    draftActions.setFormOpen(true);
  };
```

#### WHY FIX-1 is a blocker (verified evidence chain)
_Included because: Context so the fix is applied with understanding, not blindly._

```
1. AllDayRow.openAllDayDraft calls only startGridDraft.
2. draft.store.ts startGridDraft sets isFormOpen: false unconditionally.
3. The effect that would reopen the form is useDraftEffects.ts:62-64:
     useEffect(() => { handleChange(); }, [handleChange]);
   and handleChange (useDraftActions.ts) is a useCallback with deps
     [isDrafting, activity, setIsFormOpen]
   that calls setIsFormOpen(true) when activity === 'gridClick'.
   On the RELEASE commit isDrafting is ALREADY true and activity is ALREADY
   'gridClick', so handleChange keeps identity, the effect does not re-run, and
   the form is never reopened.
4. The other fallback, useGridMouseUp.ts, is a BUBBLE-phase listener on #root.
   finish() calls stopPropagation() from a WINDOW CAPTURE-phase listener, so the
   event never reaches #root.
Net: after a multi-day drag release the form CLOSES, leaving isDrafting:true and a
multi-day gridDraft with no visible UI. The timed gesture avoids this only because
it transitions activity 'creating' -> 'gridClick', which re-fires the effect.
```

#### packages/web/src/grid/interaction/math/all-day.create.ts (current resolveAllDayDayRange)
_Included because: FIX-4 target. Delete the try/catch wrappers and input?. chaining; keep the logic._

```
export const resolveAllDayDayRange = (
  input: ResolveAllDayDayRangeInput,
): AllDayDayRange => {
  try {
    const { anchorDate, pointerDate, visibleDates } = input;
    let clampedAnchor = anchorDate;
    let clampedPointer = pointerDate;

    if (visibleDates && visibleDates.length > 0) {
      const windowStart = visibleDates[0];
      const windowEnd = visibleDates[visibleDates.length - 1];
      if (clampedAnchor < windowStart) clampedAnchor = windowStart;
      else if (clampedAnchor > windowEnd) clampedAnchor = windowEnd;

      if (clampedPointer < windowStart) clampedPointer = windowStart;
      else if (clampedPointer > windowEnd) clampedPointer = windowEnd;
    }

    const start =
      clampedAnchor <= clampedPointer ? clampedAnchor : clampedPointer;
    const last =
      clampedAnchor >= clampedPointer ? clampedAnchor : clampedPointer;

    const parsedEnd = dayjs(last).add(1, "day");
    if (!parsedEnd.isValid()) {
      const fallbackEnd = dayjs(anchorDate).add(1, "day");
      return {
        start: anchorDate,
        end: fallbackEnd.isValid()
          ? fallbackEnd.format(YEAR_MONTH_DAY_FORMAT)
          : anchorDate,
      };
    }

    return {
      start,
      end: parsedEnd.format(YEAR_MONTH_DAY_FORMAT),
    };
  } catch {
    /* nested fallback returning {start:'',end:''} - DELETE ALL OF THIS */
  }
};

TARGET SHAPE: destructure input directly, clamp, normalise with lexicographic
compare, return { start, end: dayjs(last).add(1,'day').format(YEAR_MONTH_DAY_FORMAT) }.
No try, no catch, no input?. The 11 existing tests in all-day.create.test.ts must
pass completely unmodified - do not edit that file.
```

#### packages/web/src/grid/hooks/useAllDayDraftCreation.ts (current finish())
_Included because: FIX-5 target. Add the no-op dedup guard after computing finalRange._

```
    const finish = (mouseEvent: MouseEvent) => {
      if (isFinished || isCancelled) return;
      isFinished = true;
      cleanup();
      if (!hasMoved) return;
      mouseEvent.preventDefault();
      mouseEvent.stopPropagation();
      const finalRange = resolveRangeForPointer(mouseEvent);
      const finalDraft = draftForRange(finalRange);
      if (onCreateGridDraft) {
        onCreateGridDraft(finalDraft);
      } else {
        onCreateDraft?.(gridEventDraftToSchemaEvent(finalDraft));
      }
    };

Add, immediately after `const finalRange = resolveRangeForPointer(mouseEvent);`:
  if (isSameAllDayDayRange(finalRange, pressRange)) return;
isSameAllDayDayRange is already imported in this file. pressRange is in scope.
```
### Acceptance criteria
- AllDayRow.tsx openAllDayDraft calls draftActions.setFormOpen(true) immediately after draftActions.startGridDraft, with an explanatory comment
- The capture-phase stopPropagation in useAllDayDraftCreation.finish is NOT removed
- A new hook test proves the window clamp using an out-of-window getStartDate and asserts end === 2026-05-24
- The clientId assertion is replaced by a structural equality that would fail if draftForRange built a fresh draft instead of using replaceGridDraftSchedule, and its enclosing if-guard is gone
- all-day.create.ts resolveAllDayDayRange contains no try, no catch, and no optional chaining on input
- All 11 tests in all-day.create.test.ts pass with that file UNMODIFIED
- finish() returns early without committing when the final range equals the press range
- The constant-column Day pin test asserts onCreateGridDraft was called exactly once
- docs/frontend/week-drag-interaction.md no longer claims a meaningful shared clientId and describes the explicit setFormOpen(true) on release
- Only the 5 named files are modified; no file under views/Day/ is touched
- bun run test:web on both changed test files is green
### Your final message
Your final message must be a single JSON object and nothing else — no
prose before it, no summary after it, no ``` fence around it. It must
conform to this schema:

```json
{
  "type": "object",
  "properties": {
    "files_written": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "path": {
            "type": "string"
          },
          "fix_ids": {
            "type": "string"
          },
          "summary": {
            "type": "string"
          }
        },
        "required": [
          "path",
          "summary"
        ]
      }
    },
    "test_results": {
      "type": "string"
    },
    "notes": {
      "type": "string"
    }
  },
  "required": [
    "files_written",
    "test_results"
  ]
}
```