## Task tp_cg_002 — codegen / existing_file_edit
Module: grid-event-cards
### Working directory
You are running as an agent inside `/home/sainadh/projects/compass-calendar/compass/compass-calendar`. You may list, read,
edit and create files there, and run commands there. That directory is the
only place you can act; nothing outside it is reachable.
### Instruction
HARD CONSTRAINT, READ FIRST: Do NOT run git, rm, mv, or any cleanup/housekeeping shell command. Do not revert, stage, commit or clean anything. Only touch the single file packages/web/src/grid/components/TimedEventCard.tsx. If you notice unrelated dirty state anywhere in the repo, IGNORE it - it is not your task and it is not yours to tidy. Reading files and running type-check/lint/test commands is allowed; mutating the repo outside your artifact_path is not. TASK: Integrate EventJoinIcon into TimedEventCard.tsx. Read packages/web/src/grid/components/EventJoinIcon.tsx first for the exact prop contract. Add `import { EventJoinIcon, isSafeConferenceUrl } from "./EventJoinIcon";` in correct import order. Compute, next to the existing showRepeatIcon: const showJoinIcon = isSafeConferenceUrl(event.conference?.url) && !isPlaceholder && durationMinutes >= REPEAT_ICON_MIN_DURATION_MINUTES && position.width >= REPEAT_ICON_MIN_WIDTH; Render, immediately BEFORE the existing {showRepeatIcon && <EventRepeatIcon baseColor={bgColor} />} line: {showJoinIcon && (<EventJoinIcon baseColor={bgColor} className={showRepeatIcon ? "right-4.5" : "right-1"} title={event.title} url={event.conference!.url} />)}. Leave REPEAT_ICON_MIN_WIDTH at 40 and REPEAT_ICON_MIN_DURATION_MINUTES at 15. Change nothing else - every existing prop, handler, style, comment and the forwardRef export must be preserved byte-for-byte. Add a brief comment explaining why the join icon shares the repeat icon's width gate.
### Provided excerpts
_None supplied. Explore the working directory to find what you need._
### Acceptance criteria
- TimedEventCard.tsx imports EventJoinIcon and isSafeConferenceUrl from './EventJoinIcon'
- showJoinIcon gates on isSafeConferenceUrl, !isPlaceholder, duration >= 15, and width >= REPEAT_ICON_MIN_WIDTH (40)
- EventJoinIcon renders with className 'right-4.5' when showRepeatIcon is true and 'right-1' otherwise
- REPEAT_ICON_MIN_WIDTH remains 40 and all pre-existing behavior is unchanged
- No file other than TimedEventCard.tsx was created, modified or deleted
- No git, rm or mv command was run
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
    }
  },
  "required": [
    "files_written",
    "summary"
  ]
}
```