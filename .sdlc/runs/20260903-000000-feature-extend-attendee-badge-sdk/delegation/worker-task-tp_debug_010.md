## Task tp_debug_010 — debug / bug_fix_apply
Module: cards
### Working directory
You are running as an agent inside `/home/sainadh/projects/compass-calendar/compass/compass-calendar`. You may list, read,
edit and create files there, and run commands there. That directory is the
only place you can act; nothing outside it is reachable.
### Instruction
Apply senior-review findings R-1, R-2, R-3, R-4 and R-5 to the EXISTING file packages/web/src/grid/components/EventCard.test.tsx. Read .sdlc/runs/20260903-000000-feature-extend-attendee-badge-sdk/review.md sections R-1 through R-5 for the exact diagnosis and each finding's stated fix. SUMMARY: the shared `position` fixture is width 140, at which a timed card showing a time label renders NO badge (D-7 suppresses below 170). Five appended timed cases therefore assert properties of a badge-less card and would still pass if AttendeeBadge were deleted: C-10 (the only card-level PII guard - this is the blocker), C-8 (resize handles), C-4 (accessible name unchanged), C-6 and the timed halves of C-13/C-14. FIX: (1) switch those timed cases to the existing `badgePosition` helper (width 190) so a badge actually renders; (2) add a precondition helper `const expectBadge = (card: HTMLElement) => { const badge = card.querySelector(`[${ATTENDEE_BADGE_ATTRIBUTE}]`); expect(badge).not.toBeNull(); return badge; };` and call it at the top of every timed case that is supposed to have a badge present, so any future silent-absence regression fails loudly. Do NOT change C-18 (width 150), C-19 (width 170) or C-20 (width 150, height 30) - those pin the D-7 gate deliberately. Do NOT modify any component source file - the components are correct. Do NOT modify any of the original 575 lines. Then run `cd packages/web && bun test src/grid/components/EventCard.test.tsx` and iterate until 0 fail. Edit ONLY this one file.
### Provided excerpts
These are extracts, not whole files. The paths are real — open them in the
working directory when you need more than the excerpt shows.

#### .sdlc/runs/20260903-000000-feature-extend-attendee-badge-sdk/review.md
_Included because: Authoritative list of required changes._

```
Senior review. Findings R-1 (blocker, C-10 dead PII guard), R-2 (C-8), R-3 (C-4), R-4 (C-6, C-13/C-14 timed halves), R-5 (the expectBadge precondition helper). Each finding names exact line ranges and its fix.
```

#### packages/web/src/grid/components/EventCard.test.tsx
_Included because: Edit target._

```
The test file. `position` (width 140) at lines 41-45; `badgePosition` (width 190) helper already exists at line 595; appended cases C-1..C-20 run from ~line 597 to the end.
```

#### packages/web/src/grid/components/TimedEventCard.tsx
_Included because: Explains why width 140 yields no badge; read-only._

```
showAttendeeBadge = !isPlaceholder && !isCompactEvent && width>=140 && (!showTimeLabel || width>=170) && hasAttendeesToShow. CORRECT - do not modify.
```
### Acceptance criteria
- C-10 renders a card that actually has a badge, so the PII assertion can fail if the badge ever leaks an email or displayName
- C-8, C-4, C-6 and the timed halves of C-13/C-14 render at badgePosition where applicable
- An expectBadge precondition helper exists and is called by every timed case expecting a badge
- C-18, C-19 and C-20 keep widths 150, 170 and 150 respectively
- No component source file modified
- None of the original 575 lines modified
- bun test src/grid/components/EventCard.test.tsx reports 0 fail
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