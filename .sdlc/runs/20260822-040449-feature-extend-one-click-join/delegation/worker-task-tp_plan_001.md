## Task tp_plan_001 — change_plan / existing_file_edit
Module: grid-event-cards
### Working directory
You are running as an agent inside `/home/sainadh/projects/compass-calendar/compass/compass-calendar`. You may list, read,
edit and create files there, and run commands there. That directory is the
only place you can act; nothing outside it is reachable.
### Instruction
Write a DELTA change plan (design doc) for the approved requirements. READ FIRST: .sdlc/runs/20260822-040449-feature-extend-one-click-join/requirements.md, and in packages/web/src/grid/components/: TimedEventCard.tsx, AllDayEventCard.tsx, EventRepeatIcon.tsx, EventCard.test.tsx (existing 575-line suite - match its harness, render helpers and naming exactly). Also read packages/web/src/components/Icons/Repeat.tsx and icon.utils.ts (the repo's Phosphor wrapper pattern), and packages/web/src/components/Sidebar/UpNextCard/UpNextBanner.tsx (window.open precedent). TWO DECISIONS ARE ALREADY MADE BY THE USER - do not re-open them: (1) the glyph is VideoCameraIcon from @phosphor-icons/react, wrapped in the repo's Icons/ pattern; (2) TimedEventCard gates the join icon on the SAME width threshold as the repeat icon, REPEAT_ICON_MIN_WIDTH = 40. Write .sdlc/runs/20260822-040449-feature-extend-one-click-join/change_plan.md covering: 1. Component contract for EventJoinIcon (exact props, exact TSX, element choice anchor-vs-button and why, className/positioning strategy, how it avoids colliding with EventRepeatIcon's `absolute right-1 bottom-0.5`); 2. isSafeConferenceUrl validation helper - where it lives, exact implementation, which schemes pass; 3. Exact diff plan per file (what lines change in TimedEventCard.tsx and AllDayEventCard.tsx, including the all-day title padding permutation table for neither/repeat-only/join-only/both); 4. Test plan - one bullet per acceptance criterion AC-1..AC-11 naming the describe/it block and the assertion, reusing the existing suite's helpers; 5. Risks and rejected alternatives. Be concrete enough that a codegen worker can implement without re-deciding anything. Do NOT edit any file under packages/ in this task - write only the markdown artifact. Return JSON {artifact_path, summary, files_planned}.
### Provided excerpts
_None supplied. Explore the working directory to find what you need._
### Acceptance criteria
- change_plan.md exists at the stated artifact_path
- Specifies EventJoinIcon props and TSX concretely, using VideoCameraIcon from @phosphor-icons/react
- Uses REPEAT_ICON_MIN_WIDTH = 40 as the timed-card width gate, not a new constant value
- Includes an all-day padding permutation table for all four icon combinations
- Maps every AC-1..AC-11 to a named test block
- No file under packages/ was modified by this task
### Your final message
Your final message must be a single JSON object and nothing else — no
prose before it, no summary after it, no ``` fence around it. It must
conform to this schema:

```json
{
  "type": "object",
  "properties": {
    "artifact_path": {
      "type": "string"
    },
    "summary": {
      "type": "string"
    },
    "files_planned": {
      "type": "array",
      "items": {
        "type": "string"
      }
    }
  },
  "required": [
    "artifact_path",
    "summary"
  ]
}
```