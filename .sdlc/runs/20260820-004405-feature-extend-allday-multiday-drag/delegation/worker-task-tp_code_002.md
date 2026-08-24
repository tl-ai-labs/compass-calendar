## Task tp_code_002 — codegen / existing_file_edit
Module: allday-hook
### Working directory
You are running as an agent inside `/home/sainadh/projects/compass-calendar/compass/compass-calendar`. You may list, read,
edit and create files there, and run commands there. That directory is the
only place you can act; nothing outside it is reachable.
### Instruction
Extend the shared all-day draft-creation hook with an OPT-IN multi-day drag gesture.

Read .sdlc/runs/20260820-004405-feature-extend-allday-multiday-drag/change_plan.md FIRST. Sections 10 and 11 are orchestrator corrections that OVERRIDE section 4 — obey them. Section 2 gives the exact option/return types, section 5 the preview/commit calls. Mirror the gesture mechanics in packages/web/src/grid/hooks/useTimedDraftCreation.ts (read it; do NOT edit it). The pure math already exists at packages/web/src/grid/interaction/math/all-day.create.ts — read it and import calculateAllDayCreateSchedule from "@web/grid/interaction/math/all-day.create". Do not reimplement that math.

WRITE EXACTLY TWO FILES:
1. packages/web/src/grid/hooks/useAllDayDraftCreation.ts (edit)
2. packages/web/src/grid/hooks/useAllDayDraftCreation.test.tsx (edit — keep the three existing tests passing, unchanged in intent)

THE CONTRACT, precisely:
- Add optional visibleBounds?: { minDate: string; maxDate: string } to UseAllDayDraftCreationOptions. The hook still RETURNS the same bare handler (event, calendarId?) => void. Do NOT change the return shape — both call sites assign it straight to onMouseDown.
- WITHOUT visibleBounds: run the current body verbatim (isRightClick ignore, preventDefault + stopPropagation, isDrafting discard-and-return, resolve one date via getStartDate, +1 day, createGridEventDraft, onCreateGridDraft ?? onCreateDraft) and return. Attach NO window listeners. This is Day view's path and must stay behaviourally identical to today.
- WITH visibleBounds (Week only): on mousedown, after the same right-click / isDrafting / preventDefault checks, resolve and clamp the anchor day, build the single-day draft, and publish it IMMEDIATELY via draftActions.startGridDraft({ activity: "creating", draft }). Per section 10 this is what keeps the existing mousedown-only assertion in MainGrid.test.tsx green. Then attach window listeners for mousemove, mouseup, blur and keydown (use capture where useTimedDraftCreation uses capture). Once the pointer passes TIMED_DRAFT_CREATE_MOVE_THRESHOLD_PX (4px, via hasExceededInteractionMoveThreshold), recompute with calculateAllDayCreateSchedule and call draftActions.setGridDraft(replaceGridDraftSchedule(draft, allDayGridSchedule(startDate, endDate))). On mouseup call onCreateGridDraft(finalDraft) EXACTLY ONCE (or onCreateDraft(gridEventDraftToSchemaEvent(finalDraft)) when onCreateGridDraft is absent). On Escape keydown or window blur call draftActions.discard() and commit nothing. Remove every listener on finish, on cancel and on unmount — use a gestureRef plus a useEffect cleanup exactly as useTimedDraftCreation does.

REQUIRED NEW TEST CASES (change_plan section 7 item 2 plus section 11):
- sub-threshold click still yields the single-day draft
- left-to-right drag across days commits the spanning range
- right-to-left drag normalizes to the same span as the equivalent left-to-right drag
- Escape mid-drag discards, onCreateGridDraft never called
- window blur mid-drag discards, onCreateGridDraft never called
- drag past the bounds clamps to minDate/maxDate
- opt-out path (no visibleBounds) commits on mousedown and attaches no window listeners
- SECTION 11 CASE: opted-in mousedown with NO mouseup leaves the store draft at activity "creating"; then on mouseup onCreateGridDraft fires exactly once

HARD LIMITS: write ONLY the two files listed. Do not touch packages/web/src/views/Day/**, useTimedDraftCreation.ts, useTimedGridDraftCreation.ts, MainGrid.test.tsx, or anything under packages/backend|sync|core|scripts. Do not run the test suite (the orchestrator runs it). Match the surrounding code style exactly: bun:test, named exports, @core/@web import aliases, alphabetised imports.
### Provided excerpts
_None supplied. Explore the working directory to find what you need._
### Acceptance criteria
- visibleBounds is optional; omitting it runs the pre-existing synchronous mousedown-commit body and attaches no window listeners
- Hook still returns the bare (event, calendarId?) => void handler
- Opted-in mousedown publishes the single-day draft with activity 'creating' before any mouseup
- onCreateGridDraft is called exactly once per gesture, on mouseup
- Escape keydown and window blur both discard without committing
- All listeners removed on finish, cancel and unmount
- The three pre-existing tests still pass unmodified in intent
- New cases cover sub-threshold click, LTR drag, RTL normalization, Escape, blur, clamping, opt-out path, and the activity-'creating'-on-mousedown case
- Exactly two files modified
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
        "type": "string"
      }
    },
    "summary": {
      "type": "string"
    },
    "deviations": {
      "type": "array",
      "items": {
        "type": "string"
      }
    }
  },
  "required": [
    "files_written",
    "summary"
  ]
}
```