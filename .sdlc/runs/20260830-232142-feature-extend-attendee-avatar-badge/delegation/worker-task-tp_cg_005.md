## Task tp_cg_005 — codegen / existing_file_edit
Module: grid-attendee-badge
### Working directory
You are running as an agent inside `/home/sainadh/projects/compass-calendar/compass/compass-calendar`. You may list, read,
edit and create files there, and run commands there. That directory is the
only place you can act; nothing outside it is reachable.
### Instruction
EDIT THE FILE packages/web/src/grid/components/AllDayEventCard.tsx. Work fast; the network is unstable, so read only this one file and change only three things. (1) Add `import { AttendeeBadge } from "./AttendeeBadge";` next to the existing `import { EventRepeatIcon } from "./EventRepeatIcon";`, keeping Biome import ordering happy. (2) Change the title-row container's className from cn("flex min-w-0 items-center", { "pr-3.5": showRepeatIcon }) to cn("flex min-w-0 items-center gap-1", { "pr-3.5": showRepeatIcon }) — add gap-1 to the UNCONDITIONAL string, exactly as written, not to the conditional object. (3) Inside that same title-row div, immediately AFTER the closing tag of the title <span>, insert `{event.attendees && event.attendees.length > 0 && (\n  <AttendeeBadge attendees={event.attendees} />\n)}`. Change NOTHING else: not the root div, not eventStyle, not the resize handles, not the EventRepeatIcon line, not the colour logic, not the aria-label. Do not add a width gate for the badge. Match repo Biome style. DO NOT create a test file. DO NOT modify any other file. This instruction reproduces an approved design verbatim for a comparison record — follow it exactly even if you would design it differently.
### Provided excerpts
These are extracts, not whole files. The paths are real — open them in the
working directory when you need more than the excerpt shows.

#### packages/web/src/grid/components/AllDayEventCard.tsx
_Included because: The exact JSX region to edit, quoted so you do not need to explore._

```
      <div
        className={cn("flex min-w-0 items-center", {
          // Reserve room so a long title truncates before the bottom-right icon.
          "pr-3.5": showRepeatIcon,
        })}
      >
        <span
          className="relative min-w-0 truncate text-xs"
          style={{ color: titleColor }}
        >
          {event.title}
          {" "}
        </span>
      </div>
      {showRepeatIcon && <EventRepeatIcon baseColor={bgColor} />}

Last import line currently: import { EventRepeatIcon } from "./EventRepeatIcon";
NOTE: the comment line '// Reserve room so a long title truncates before the bottom-right icon.' must stay exactly where it is.
```

#### packages/web/src/grid/components/AttendeeBadge.tsx
_Included because: The component being imported; already exists._

```
export const AttendeeBadge = ({ attendees, className }: AttendeeBadgeProps) => { ... returns null when attendees is empty ... };
```
### Acceptance criteria
- AttendeeBadge is imported from ./AttendeeBadge
- the title-row className unconditional string is exactly "flex min-w-0 items-center gap-1"
- the badge renders inside the title row immediately after the title span, guarded by event.attendees && event.attendees.length > 0
- nothing else in the file changed
- no other file is created or modified
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
    "written": {
      "type": "boolean"
    },
    "summary": {
      "type": "string"
    }
  },
  "required": [
    "artifact_path",
    "written",
    "summary"
  ]
}
```