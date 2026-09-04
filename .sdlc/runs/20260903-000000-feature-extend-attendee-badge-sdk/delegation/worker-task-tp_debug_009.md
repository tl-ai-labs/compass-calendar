## Task tp_debug_009 — debug / bug_fix_apply
Module: cards
### Working directory
You are running as an agent inside `/home/sainadh/projects/compass-calendar/compass/compass-calendar`. You may list, read,
edit and create files there, and run commands there. That directory is the
only place you can act; nothing outside it is reachable.
### Instruction
Fix 5 failing tests in the EXISTING file packages/web/src/grid/components/EventCard.test.tsx. Run `cd packages/web && bun test src/grid/components/EventCard.test.tsx` to see them. Failing: C-1, C-3, C-11, C-15, C-16. ROOT CAUSE (already diagnosed - do not re-diagnose, do not change any source file): the shared `position` fixture is { width: 140, height: 60 }. At height 60 the TimedEventCard renders a time label, and TimedEventCard's showAttendeeBadge predicate deliberately suppresses the badge when a time label is showing and width < MIN_EVENT_WIDTH_FOR_BADGE_WITH_TIME_LABEL (170). So at width 140 no badge renders and these five assertions fail. THE COMPONENT IS CORRECT - the tests are wrong. FIX: add a helper `const badgePosition = { ...position, width: 190 };` next to the other helpers, and use `position={badgePosition}` in ONLY those five timed-card cases (C-1, C-3, C-11, C-15, C-16). In C-16 use badgePosition for BOTH the no-attendee baseline renders AND the sensitivity-control render, so the comparison stays like-for-like. Change NOTHING else: do not touch C-18/C-19/C-20 (they intentionally pin widths 150/170/150), do not touch any all-day case, do not modify any of the original 575 lines, and do not edit any file other than this one. Iterate until `bun test src/grid/components/EventCard.test.tsx` reports 0 fail.
### Provided excerpts
These are extracts, not whole files. The paths are real — open them in the
working directory when you need more than the excerpt shows.

#### packages/web/src/grid/components/EventCard.test.tsx
_Included because: Edit target._

```
1217-line test file. Shared `position` = { height: 60, left: 10, top: 20, width: 140 } near line 39. New helpers (attendee, futureEvent, badgeDescriptionOf) around lines 577-595. Failing cases C-1, C-3, C-11, C-15, C-16.
```

#### packages/web/src/grid/components/TimedEventCard.tsx
_Included because: Explains the root cause; read-only for this packet._

```
showAttendeeBadge = !isPlaceholder && !isCompactEvent && position.width >= 140 && (!showTimeLabel || position.width >= 170) && hasAttendeesToShow(event.attendees). This logic is CORRECT and must not be changed.
```

#### packages/web/src/grid/components/AttendeeBadge.tsx
_Included because: The two width gates; read-only for this packet._

```
MIN_EVENT_WIDTH_FOR_ATTENDEE_BADGE = 140; MIN_EVENT_WIDTH_FOR_BADGE_WITH_TIME_LABEL = 170.
```
### Acceptance criteria
- bun test src/grid/components/EventCard.test.tsx reports 0 fail
- A badgePosition helper with width 190 is used by C-1, C-3, C-11, C-15 and C-16
- C-16 uses badgePosition for both its baseline and its sensitivity-control render
- C-18, C-19 and C-20 keep their original pinned widths (150, 170, 150)
- No source component file is modified
- None of the original 575 lines is modified
- No other file created or modified
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
    "content": {
      "type": "string"
    },
    "notes": {
      "type": "string"
    }
  },
  "required": [
    "artifact_path",
    "content"
  ]
}
```