## Task tp_test_004 — tests / test_add
Module: attendee-badge
### Working directory
You are running as an agent inside `/home/sainadh/projects/compass-calendar/compass/compass-calendar`. You may list, read,
edit and create files there, and run commands there. That directory is the
only place you can act; nothing outside it is reachable.
### Instruction
Create the NEW test file packages/web/src/grid/components/AttendeeBadge.test.tsx. Implement cases B-1 through B-11 exactly as tabulated in the second table of '## 4. Test plan' in .sdlc/runs/20260903-000000-feature-extend-attendee-badge-sdk/change_plan.md. Copy the import header shape from the existing packages/web/src/grid/components/EventCard.test.tsx (@testing-library/react + bun:test + '@testing-library/jest-dom'). Render <AttendeeBadge/> directly with explicit props: attendees, baseColor (use a hex like '#3b82f6'), descriptionId (a literal like 'desc-1'), and className where relevant. B-10 is a PII assertion and must use the fixture { email: 'secret@example.com', displayName: 'Ada' } and assert container.innerHTML contains NEITHER string. B-7 must pass an Object.freeze'd array. B-9 asserts the root class contains pointer-events-none. Do NOT write any raw Tailwind palette colour name anywhere, including in expected strings and comments - `bun lint` scans test files too and fails on e.g. bg-green-500. After writing, run `cd packages/web && bun test src/grid/components/AttendeeBadge.test.tsx` and iterate until all cases pass. Write ONLY this one file - do not create, edit or delete any other file, and in particular do NOT touch EventCard.test.tsx or AttendeeBadge.tsx.
### Provided excerpts
These are extracts, not whole files. The paths are real — open them in the
working directory when you need more than the excerpt shows.

#### .sdlc/runs/20260903-000000-feature-extend-attendee-badge-sdk/change_plan.md
_Included because: Defines the required cases and assertions._

```
'## 4. Test plan' second table (B-1..B-11), plus section 2.3 for the component's exact prop names and rendered structure.
```

#### packages/web/src/grid/components/AttendeeBadge.tsx
_Included because: Import source - read the real file for exact prop names._

```
The component under test. Props: attendees, baseColor, className?, descriptionId. Exports ATTENDEE_BADGE_ATTRIBUTE and MAX_VISIBLE_ATTENDEE_DOTS.
```

#### packages/web/src/grid/components/EventCard.test.tsx
_Included because: House style reference only._

```
Existing sibling test file - copy its import header and testing-library conventions. DO NOT MODIFY THIS FILE in this packet.
```
### Acceptance criteria
- File packages/web/src/grid/components/AttendeeBadge.test.tsx exists
- Covers all eleven cases B-1..B-11
- B-10 asserts neither 'secret@example.com' nor 'Ada' appears in the rendered HTML
- B-7 passes a frozen array and asserts no throw
- B-6 asserts the description reports all attendees, not only the visible ones
- All tests in the file pass when run with bun test
- No raw Tailwind palette colour class anywhere in the file
- EventCard.test.tsx and AttendeeBadge.tsx are NOT modified
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