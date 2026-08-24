## Task tp_cg_001 — codegen / new_file_add
Module: grid-event-cards
### Working directory
You are running as an agent inside `/home/sainadh/projects/compass-calendar/compass/compass-calendar`. You may list, read,
edit and create files there, and run commands there. That directory is the
only place you can act; nothing outside it is reachable.
### Instruction
Create packages/web/src/grid/components/EventJoinIcon.tsx exporting EventJoinIcon and isSafeConferenceUrl. Read packages/web/src/grid/components/EventRepeatIcon.tsx first and match its file style, import ordering and TSDoc conventions. EventJoinIconProps has url (string), title (string optional), baseColor (string), className (string optional). Export a pure type guard isSafeConferenceUrl(url: unknown): url is string that returns true only for a non-empty string whose parsed protocol is 'http:' or 'https:' (wrap new URL() in try/catch; return false on throw). EventJoinIcon renders an anchor <a> with href=url, target='_blank', rel='noopener noreferrer', aria-label (title ? `Join meeting: ${title}` : 'Join meeting'), and className cn('ph-no-capture absolute bottom-0.5 z-10 flex items-center justify-center rounded-xs p-0.5 hover:opacity-80 focus-visible:outline-1 focus-visible:outline-(--event-focus-color)', className ?? 'right-1'). Call e.stopPropagation() in onClick, in onMouseDown, and in onKeyDown when e.key is 'Enter' or ' '. Render VideoCameraIcon imported DIRECTLY from '@phosphor-icons/react' (exactly as packages/web/src/components/Sidebar/UpNextCard/UpNextCard.tsx does) with aria-hidden='true', color=darken(baseColor, 30) from '@web/common/styles/color.utils', size=10, weight='bold'. Do NOT create or import any intermediate icon wrapper file. Write ONLY this one file; touch nothing else.
### Provided excerpts
_None supplied. Explore the working directory to find what you need._
### Acceptance criteria
- EventJoinIcon.tsx exports EventJoinIcon and isSafeConferenceUrl
- isSafeConferenceUrl returns true only for valid http: and https: string URLs
- VideoCameraIcon is imported directly from '@phosphor-icons/react'
- Anchor element has rel='noopener noreferrer', target='_blank', and class 'ph-no-capture'
- onClick, onMouseDown, and onKeyDown (Enter/Space) call stopPropagation
- VideoCameraIcon uses darken(baseColor, 30), size 10, and bold weight
- No file other than EventJoinIcon.tsx was created or modified
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