## Task tp_cg_004 — codegen / existing_file_edit
Module: grid-attendee-badge
### Working directory
You are running as an agent inside `/home/sainadh/projects/compass-calendar/compass/compass-calendar`. You may list, read,
edit and create files there, and run commands there. That directory is the
only place you can act; nothing outside it is reachable.
### Instruction
EDIT THE FILE packages/web/src/grid/components/TimedEventCard.tsx. Work fast; the network is unstable, so read only this one file and change only two things. (1) Add the sibling import `import { AttendeeBadge } from "./AttendeeBadge";` next to the existing `import { EventRepeatIcon } from "./EventRepeatIcon";` at the end of the import block, keeping Biome's import ordering happy. (2) Inside the content wrapper div that carries EVENT_CONTENT_ATTRIBUTE, render the badge. The exact insertion point: that div currently holds `<span style={titleStyle}>{event.title}</span>` followed by a `{!event.isAllDay && ( <> ... </> )}` fragment whose first child is the `{showTimeLabel && <span ...>{timeRange}</span>}` block and whose remaining children are the two resize-handle divs. Insert `{event.attendees && event.attendees.length > 0 && (\n  <AttendeeBadge attendees={event.attendees} />\n)}` immediately AFTER the showTimeLabel block and BEFORE the first resize-handle div, i.e. inside that same fragment. Change NOTHING else: not the title span, not titleStyle, not lineClamp, not the resize handles, not the EventRepeatIcon line, not the root div's className or aria-label, not any of the colour logic. Do not add a width or height gate for the badge. Do not add a wrapper element around the badge. Match repo Biome style. DO NOT create a test file. DO NOT modify any other file.
### Provided excerpts
These are extracts, not whole files. The paths are real — open them in the
working directory when you need more than the excerpt shows.

#### packages/web/src/grid/components/TimedEventCard.tsx
_Included because: The exact JSX region to edit, quoted so you do not need to explore._

```
      <div
        className="flex flex-col flex-wrap items-start"
        style={{ color: contentColor }}
        {...{ [EVENT_CONTENT_ATTRIBUTE]: "true" }}
      >
        <span style={titleStyle}>{event.title}</span>
        {!event.isAllDay && (
          <>
            {showTimeLabel && (
              <span
                className="relative"
                {...{ [EVENT_TIME_LABEL_ATTRIBUTE]: "true" }}
                style={{ ...timeLabelStyle, zIndex: ZIndex.LAYER_3 }}
              >
                {timeRange}
              </span>
            )}
            {/* biome-ignore lint/a11y/noStaticElementInteractions: Resize handles are pointer-only drag targets hidden from assistive tech. */}
            <div
              aria-hidden="true"
              role="presentation"
              {...{ [EVENT_RESIZE_HANDLE_ATTRIBUTE]: "startDate" }}
              style={scalerStyle({ top: "-0.25px" })}
              onMouseDown={(e) => {
                e.stopPropagation();
                onScalerMouseDown?.(event, e, "startDate");
              }}
            />
            ... endDate handle follows ...
          </>
        )}
      </div>
      {showRepeatIcon && <EventRepeatIcon baseColor={bgColor} />}

Last import line currently: import { EventRepeatIcon } from "./EventRepeatIcon";
```

#### packages/web/src/grid/components/AttendeeBadge.tsx
_Included because: The component being imported; already exists._

```
export interface AttendeeBadgeProps { attendees?: readonly Attendee[] | null; className?: string }
export const AttendeeBadge = ({ attendees, className }: AttendeeBadgeProps) => { ... returns null when empty ... };
```
### Acceptance criteria
- AttendeeBadge is imported from ./AttendeeBadge
- the badge renders inside the EVENT_CONTENT_ATTRIBUTE div, after the time label and before the resize handles
- the guard is event.attendees && event.attendees.length > 0
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