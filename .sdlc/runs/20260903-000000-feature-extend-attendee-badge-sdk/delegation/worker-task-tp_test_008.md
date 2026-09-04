## Task tp_test_008 — tests / test_add
Module: cards
### Working directory
You are running as an agent inside `/home/sainadh/projects/compass-calendar/compass/compass-calendar`. You may list, read,
edit and create files there, and run commands there. That directory is the
only place you can act; nothing outside it is reachable.
### Instruction
APPEND-ONLY edit of the EXISTING file packages/web/src/grid/components/EventCard.test.tsx (currently 575 lines). You may NOT modify, reformat, reorder or delete ANY existing line. The eleven accessible-name queries and every svg[class*='right-1'] and resize-handle assertion must remain byte-identical. Make exactly two additions per section '### 2.8' of .sdlc/runs/20260903-000000-feature-extend-attendee-badge-sdk/change_plan.md: (1) add `import { ATTENDEE_BADGE_ATTRIBUTE } from "./AttendeeBadge";` to the existing relative-import group; (2) append the three shared helpers (attendee, futureEvent, badgeDescriptionOf) and then new it(...) blocks for cases C-1 through C-20 from the third table of '## 4. Test plan', INSIDE the existing describe('EventCard', ...) block, after the last existing test and before the block's closing. C-16 and C-17 are the seven-step byte-identity guard specified in decision D-6 - step 7 (the sensitivity control asserting that an attendee-bearing render DIFFERS from the no-attendee baseline innerHTML) is MANDATORY; without it the guard is a test that cannot fail. C-18/C-19/C-20 are the D-7 time-label yield cases: C-18 at width 150 with a long cross-meridiem range asserts badge ABSENT + full time-label text + content-wrapper class exactly 'flex flex-col flex-wrap items-start'; C-19 at width 170 asserts badge AND label coexist; C-20 at width 150 height 30 (no time label) asserts the badge IS shown. Cards need position width>=140 to show a badge at all. After writing, run `cd packages/web && bun test src/grid/components/EventCard.test.tsx` and iterate until every test passes. Do not create, edit or delete any other file.
### Provided excerpts
These are extracts, not whole files. The paths are real — open them in the
working directory when you need more than the excerpt shows.

#### .sdlc/runs/20260903-000000-feature-extend-attendee-badge-sdk/change_plan.md
_Included because: Authoritative source for every new case._

```
SECTION 2.8 (append-only rules + the three helper bodies), '## 4. Test plan' third table (C-1..C-20), decision D-6 (byte-identity guard, seven steps) and decision D-7 (time-label yield thresholds).
```

#### packages/web/src/grid/components/EventCard.test.tsx
_Included because: Edit target - APPEND ONLY, never modify an existing line._

```
The 575-line existing file. createEvent helper at lines 20-37; shared `position` object at 39-44; describe block opens at 46 and its closing braces are the last two lines. Append inside the describe, after the final existing test.
```

#### packages/web/src/grid/components/AttendeeBadge.tsx
_Included because: Import source and the width gates the new cases exercise._

```
Supplies ATTENDEE_BADGE_ATTRIBUTE ('data-attendee-badge'), MAX_VISIBLE_ATTENDEE_DOTS (3), MIN_EVENT_WIDTH_FOR_ATTENDEE_BADGE (140), MIN_EVENT_WIDTH_FOR_BADGE_WITH_TIME_LABEL (170).
```

#### packages/web/src/grid/components/TimedEventCard.tsx
_Included because: Component under test - the gating logic the new cases assert._

```
Already edited. showAttendeeBadge = !isPlaceholder && !isCompactEvent && width>=140 && (!showTimeLabel || width>=170) && hasAttendeesToShow. Content wrapper gets pr-10/pr-14 only when showAttendeeBadge.
```

#### packages/web/src/grid/components/AllDayEventCard.tsx
_Included because: Component under test._

```
Already edited. showAttendeeBadge = !isPlaceholder && width>=140 && hasAttendeesToShow. Badge is inline after the title span.
```
### Acceptance criteria
- Every pre-existing line of EventCard.test.tsx is unchanged
- All eleven pre-existing accessible-name queries still present verbatim
- New cases C-1..C-20 are present
- C-16 and C-17 implement all seven steps of D-6 including the sensitivity control
- C-18 asserts badge absent AND full time-label text AND no pr-10/pr-14 on the content wrapper
- C-19 asserts badge and time label coexist at width 170
- C-20 asserts the badge still shows at width 150 when no time label is rendered
- Every test in the file passes when run with bun test
- No raw Tailwind palette colour class anywhere in the file
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