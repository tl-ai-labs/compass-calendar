## Task tp_docs_001 — docs / doc_update
Module: docs
### Working directory
You are running as an agent inside `/home/sainadh/projects/compass-calendar/compass/compass-calendar`. You may list, read,
edit and create files there, and run commands there. That directory is the
only place you can act; nothing outside it is reachable.
### Instruction
Document the new Week all-day multi-day drag-to-select gesture in docs/frontend/week-drag-interaction.md.

Read the existing doc FIRST and match its structure, heading depth and voice — this is an ADDITION alongside the gestures already described (## The one-sentence model, ## Why this exists, ## How it works now, ## Mid-drag week navigation, ## updateVisual Must Be Idempotent, ## Pitfall), NOT a rewrite. Preserve every existing section verbatim unless a sentence becomes factually wrong.

Then read the SHIPPED implementation and describe what the code actually does — do not describe a plan:
- packages/web/src/grid/interaction/math/all-day.create.ts (normalizeDayRange, clampDayToVisibleBounds, toExclusiveAllDayEndDate, calculateAllDayCreateSchedule)
- packages/web/src/grid/hooks/useAllDayDraftCreation.ts (the opt-in gesture)
- packages/web/src/views/Week/hooks/grid/useAllDayGridDraftCreation.ts (the Week binding, bounds from weekDays)

COVER: the mousedown -> 4px threshold -> live preview -> mouseup lifecycle; the reuse of TIMED_DRAFT_CREATE_MOVE_THRESHOLD_PX rather than a new constant; right-to-left normalization; clamping to the visible week; the EXCLUSIVE end date (an inclusive N-day drag commits end = last day + 1, e.g. Mon 2026-05-18 through Wed 2026-05-20 commits start 2026-05-18 / end 2026-05-21); Escape and window-blur cancellation (and that the timed gesture has no Escape handler, so this is new); and that the gesture is opt-in via visibleBounds, which is why Day view — whose x-axis selects a CALENDAR, not a day — keeps its synchronous mousedown path untouched.

REQUIRED (change_plan.md section 11, approved by the user at Gate 2): state as a deliberate consequence that on the Week all-day row the draft form now opens on RELEASE rather than on press, because a gesture cannot be classified as a click until the pointer is released. Make clear the committed draft VALUE is unchanged for a plain click; only the instant the form opens moves.

WRITE EXACTLY ONE FILE: docs/frontend/week-drag-interaction.md. Do not touch any other file, do not run the test suite.
### Provided excerpts
_None supplied. Explore the working directory to find what you need._
### Acceptance criteria
- Existing sections preserved; the new gesture is added alongside them in the doc's existing structure and voice
- Documents threshold reuse, RTL normalization, clamping, exclusive end date with a worked example, Escape/blur cancel, and the visibleBounds opt-in with the Day-view calendar-axis rationale
- States the form-opens-on-release consequence as deliberate and approved, noting the committed value is unchanged
- Describes the shipped code, not a plan
- Exactly one file modified
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