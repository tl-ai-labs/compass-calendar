## Task tp_code_003 — codegen / new_file_add
Module: week-wiring
### Working directory
You are running as an agent inside `/home/sainadh/projects/compass-calendar/compass/compass-calendar`. You may list, read,
edit and create files there, and run commands there. That directory is the
only place you can act; nothing outside it is reachable.
### Instruction
Wire the opt-in all-day drag gesture into the Week view — the ONLY call site that opts in.

Read .sdlc/runs/20260820-004405-feature-extend-allday-multiday-drag/change_plan.md sections 5, 6, 7, 10 and 11. Then read the ALREADY-SHIPPED hook packages/web/src/grid/hooks/useAllDayDraftCreation.ts — it now takes an optional visibleBounds?: { minDate, maxDate } and still returns a bare (event, calendarId?) => void handler. Mirror packages/web/src/views/Week/hooks/grid/useTimedGridDraftCreation.ts for shape (read it; do NOT edit it).

WRITE EXACTLY FOUR FILES:
1. packages/web/src/views/Week/hooks/grid/useAllDayGridDraftCreation.ts (new) — takes { dateCalcs, weekProps } like useTimedGridDraftCreation. getStartDate: (clientX, clientY) => dateCalcs.getDateStrByXY(clientX, clientY, weekProps.query.startOfView, YEAR_MONTH_DAY_FORMAT). visibleBounds from weekProps.component.weekDays: minDate = weekDays[0] formatted YEAR_MONTH_DAY_FORMAT, maxDate = weekDays[weekDays.length - 1] formatted the same. onCreateGridDraft: (draft) => draftActions.startGridDraft({ activity: "gridClick", draft }). Return the handler.
2. packages/web/src/views/Week/hooks/grid/useAllDayGridDraftCreation.test.tsx (new)
3. packages/web/src/views/Week/components/Grid/AllDayRow/AllDayRow.tsx (edit) — replace ONLY the inline getAllDayDraftStartDate / openAllDayDraft / useAllDayDraftCreation block (roughly lines 44-61) with a single call to the new binding hook. Everything else in this file stays byte-identical: the Props interface, the children vs calendar render branches, AllDayRowChildren, AllDayRowCalendar, useAllDayEventsLayer and the AllDayGridRow wiring.
4. packages/web/src/views/Week/components/Grid/AllDayRow/AllDayRow.test.tsx (new)

EMPTY-WEEK GUARD: if weekDays is empty, pass NO visibleBounds (the hook then falls back to the click-only path) rather than indexing [-1].

CRITICAL REGRESSION PROOF: packages/web/src/views/Week/components/Grid/MainGrid/MainGrid.test.tsx is NOT in your write scope — do not edit it. Read it around line 261 (renderGridRegions mounts the real AllDayRow) and lines 519-534 ("creates a one-day draft from empty all-day space" fires mouseDown with NO mouseUp and asserts the store already holds { kind: allDay, start 2024-01-14, end 2024-01-15 }). Your wiring must keep that green — that is exactly why the hook publishes activity "creating" on mousedown.

HARD LIMITS: write ONLY the four files listed. Do not touch packages/web/src/views/Day/**, useTimedDraftCreation.ts, useTimedGridDraftCreation.ts, MainGrid.test.tsx, or anything under packages/backend|sync|core|scripts. Do not run the test suite (the orchestrator runs it). Match the surrounding code style: bun:test, named exports, @core/@web aliases, alphabetised imports.
### Provided excerpts
_None supplied. Explore the working directory to find what you need._
### Acceptance criteria
- useAllDayGridDraftCreation returns the handler AllDayRow binds to onMouseDown, mirroring useTimedGridDraftCreation's shape
- visibleBounds comes from weekDays first/last formatted YEAR_MONTH_DAY_FORMAT; empty weekDays passes no bounds
- AllDayRow.tsx changes only the hook call block; props, both render branches and AllDayGridRow wiring untouched
- MainGrid.test.tsx is not modified
- Exactly four files written
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