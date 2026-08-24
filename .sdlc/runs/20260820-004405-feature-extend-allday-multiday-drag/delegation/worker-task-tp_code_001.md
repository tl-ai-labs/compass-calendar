## Task tp_code_001 — codegen / new_file_add
Module: grid-math
### Working directory
You are running as an agent inside `/home/sainadh/projects/compass-calendar/compass/compass-calendar`. You may list, read,
edit and create files there, and run commands there. That directory is the
only place you can act; nothing outside it is reachable.
### Instruction
Create the pure day-range math module and its unit test for the Week all-day multi-day drag feature.

Read .sdlc/runs/20260820-004405-feature-extend-allday-multiday-drag/change_plan.md FIRST. Sections 10 and 11 are orchestrator corrections that OVERRIDE section 4 — obey them. Do not read other .sdlc files. Section 3 gives the exact signatures and full reference bodies for normalizeDayRange, clampDayToVisibleBounds, toExclusiveAllDayEndDate and calculateAllDayCreateSchedule — implement exactly those names and shapes. Section 7 item 1 gives the required test cases.

WRITE EXACTLY TWO FILES:
1. packages/web/src/grid/interaction/math/all-day.create.ts
2. packages/web/src/grid/interaction/math/all-day.create.test.ts

All four functions must be pure: YYYY-MM-DD strings in, YYYY-MM-DD strings out, no React, no store, no Date objects in signatures. dayjs and YEAR_MONTH_DAY_FORMAT may be used internally for the +1-day arithmetic only (import dayjs from "@core/util/date/dayjs" and YEAR_MONTH_DAY_FORMAT from "@core/constants/date.constants"). Remember the end date is EXCLUSIVE: an inclusive span whose last day is 2026-05-20 yields endDate 2026-05-21. Look at a sibling test under packages/web/src/grid/interaction/math/ (e.g. all-day.interaction.test.ts) for the house test style before writing.

HARD LIMITS: write ONLY the two files listed. Do not touch packages/web/src/views/Day/**, packages/web/src/grid/hooks/useTimedDraftCreation.ts, packages/web/src/views/Week/hooks/grid/useTimedGridDraftCreation.ts, MainGrid.test.tsx, or anything under packages/backend|sync|core|scripts. Do not run the test suite (the orchestrator runs it). Match the surrounding code style exactly: bun:test, named exports, import aliases (@core, @web), and the repo's alphabetised import order.
### Provided excerpts
_None supplied. Explore the working directory to find what you need._
### Acceptance criteria
- all-day.create.ts exports normalizeDayRange, clampDayToVisibleBounds, toExclusiveAllDayEndDate, calculateAllDayCreateSchedule
- Every exported function is pure and takes/returns YYYY-MM-DD strings
- Test covers: left-to-right and right-to-left drags produce identical normalized ranges; clamp below minDate and above maxDate; single-day (anchor === current) produces a 1-day exclusive span; multi-day clamped span
- Tests use bun:test
- Exactly two files created; no other file in the repo modified
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