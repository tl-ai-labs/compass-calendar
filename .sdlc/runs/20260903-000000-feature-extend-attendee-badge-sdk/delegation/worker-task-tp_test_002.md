## Task tp_test_002 — tests / test_add
Module: attendee-status-util
### Working directory
You are running as an agent inside `/home/sainadh/projects/compass-calendar/compass/compass-calendar`. You may list, read,
edit and create files there, and run commands there. That directory is the
only place you can act; nothing outside it is reachable.
### Instruction
Create the NEW test file packages/web/src/common/utils/attendee-status.util.test.ts. Implement test cases U-1 through U-9 exactly as tabulated in the first table of '## 4. Test plan' in .sdlc/runs/20260903-000000-feature-extend-attendee-badge-sdk/change_plan.md. Use `bun:test` (import { describe, expect, it } from 'bun:test'). This is a pure module with no DOM - do NOT import @testing-library/react or jest-dom. Import the symbols under test from './attendee-status.util'. Assert the exact strings given in the table, including the singular 'guest' vs plural 'guests' and the apostrophe in "hasn't responded". U-7 must supply the four statuses in REVERSE order and still expect the module's fixed order. U-8 must pass an Object.freeze'd array. U-9 must assert the summary contains no '@'. Write ONLY this one file. Do not create, edit or delete any other file under any circumstances.
### Provided excerpts
These are extracts, not whole files. The paths are real — open them in the
working directory when you need more than the excerpt shows.

#### .sdlc/runs/20260903-000000-feature-extend-attendee-badge-sdk/change_plan.md
_Included because: Defines the required cases and the exact expected strings._

```
'## 4. Test plan' first table (U-1..U-9) plus section 2.1's exact output-string table.
```

#### packages/web/src/common/utils/attendee-status.util.ts
_Included because: Import source._

```
The module under test. Exports ATTENDEE_STATUS_DOT, attendeeStatusLabel, attendeeStatusSummary. Read the real file for exact signatures.
```
### Acceptance criteria
- File packages/web/src/common/utils/attendee-status.util.test.ts exists
- Covers all nine cases U-1..U-9
- Uses bun:test only; no DOM library imported
- U-7 supplies statuses in reverse order and expects the module's fixed order
- U-8 passes a frozen array and asserts no throw
- U-9 asserts the summary contains no '@'
- No raw Tailwind palette colour class appears anywhere, including in expected-value strings
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