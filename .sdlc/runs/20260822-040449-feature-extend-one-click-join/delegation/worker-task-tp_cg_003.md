## Task tp_cg_003 — codegen / existing_file_edit
Module: grid-event-cards
### Working directory
You are running as an agent inside `/home/sainadh/projects/compass-calendar/compass/compass-calendar`. You may list, read,
edit and create files there, and run commands there. That directory is the
only place you can act; nothing outside it is reachable.
### Instruction
HARD CONSTRAINT, READ FIRST: Do NOT run git, rm, mv, or any cleanup/housekeeping shell command. Do not revert, stage, commit or clean anything. Only touch the single file packages/web/src/grid/components/AllDayEventCard.tsx. If you notice unrelated dirty state anywhere in the repo, IGNORE it - it is not your task and it is not yours to tidy. Reading files and running type-check/lint/test commands is allowed; mutating the repo outside your artifact_path is not. TASK: Integrate EventJoinIcon into AllDayEventCard.tsx. Read packages/web/src/grid/components/EventJoinIcon.tsx for the prop contract and packages/web/src/grid/components/TimedEventCard.tsx for the sibling integration just landed. Add `import { EventJoinIcon, isSafeConferenceUrl } from "./EventJoinIcon";` in correct import order. Compute next to showRepeatIcon: const showJoinIcon = isSafeConferenceUrl(event.conference?.url) && !isPlaceholder && position.width >= REPEAT_ICON_MIN_WIDTH; Keep this file's local REPEAT_ICON_MIN_WIDTH at 60 - do NOT change it to 40. The all-day row has a fixed height so there is no height/duration gate here. Update the title container className from the current cn("flex min-w-0 items-center", { "pr-3.5": showRepeatIcon }) to reserve room for whichever icons render: pr-7 when showRepeatIcon && showJoinIcon, pr-3.5 when exactly one of them is true, and no extra padding when neither. Render, immediately BEFORE the existing {showRepeatIcon && <EventRepeatIcon baseColor={bgColor} />} line: {showJoinIcon && (<EventJoinIcon baseColor={bgColor} className={showRepeatIcon ? "right-4.5" : "right-1"} title={event.title} url={event.conference!.url} />)}. Change nothing else - every existing prop, handler, resize scaler, style and the forwardRef export must be preserved.
### Provided excerpts
_None supplied. Explore the working directory to find what you need._
### Acceptance criteria
- AllDayEventCard.tsx imports EventJoinIcon and isSafeConferenceUrl from './EventJoinIcon'
- showJoinIcon gates on isSafeConferenceUrl, !isPlaceholder and width >= REPEAT_ICON_MIN_WIDTH, with no height/duration gate
- Local REPEAT_ICON_MIN_WIDTH remains 60
- Title container applies pr-7 for both icons, pr-3.5 for exactly one, and neither class for none
- EventJoinIcon renders with className 'right-4.5' when showRepeatIcon is true and 'right-1' otherwise
- No file other than AllDayEventCard.tsx was created, modified or deleted
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