## Task tp_plan_001 — plan_task_packets / decomposition
Module: readme
### Working directory
You are running as an agent inside `/home/sainadh/projects/compass-calendar/compass/compass-calendar`. You may list, read,
edit and create files there, and run commands there. That directory is the
only place you can act; nothing outside it is reachable.
### Instruction
Decompose the approved requirements into TaskPackets and write them as a JSON array to .sdlc/runs/20260820-173404-docs-weekly-view-interactions-v2/packets.json. Write ONLY that file. This run is a single-file docs addition, so emit EXACTLY ONE packet with: id 'tp_docs_001', phase 'docs', task_type 'doc_addition' (taken verbatim from the brief's '## Task type' heading, do not infer), module 'readme', pass_id '20260820-173404-docs-weekly-view-interactions-v2', intent 'docs', artifact_path 'README.md', retry_count 0, budget {maxInputTokens: 4000, maxOutputTokens: 3000}. Its 'instruction' field must be a self-contained imperative under 300 tokens telling a writer to insert one new '## Weekly view interactions' section into README.md strictly between the existing '## Features' section and the '## Tech stack' heading, additively, changing no pre-existing line; covering ONLY recurring events (Day/Week/Month/Year frequencies; edit-or-delete a single occurrence vs the whole series) and event colors (11 fixed options); forbidding any mention of multi-day drag-select, hourly/minutely recurrence, or custom hex colors; requiring a relative link to docs/frontend/week-drag-interaction.md without duplicating or editing it; end-user voice, plain language, no internal file/component/function names. Its 'inputs' must be a FileSlice array (path, reason, content) carrying the README insertion context. Its 'acceptance' must be testable bullets mirroring requirements.md section 7. Its 'outputSchema' must be a JSON Schema object describing the write result.
### Provided excerpts
These are extracts, not whole files. The paths are real — open them in the
working directory when you need more than the excerpt shows.

#### .sdlc/runs/20260820-173404-docs-weekly-view-interactions-v2/requirements.md
_Included because: The approved requirements — the packet's acceptance bullets must mirror its section 7._

```
In scope: one new '## Weekly view interactions' section in root README.md between '## Features' and '## Tech stack'; two topics only (recurring events: Day/Week/Month/Year frequencies + single-occurrence vs whole-series edit/delete; event colors: 11 fixed options); relative link to docs/frontend/week-drag-interaction.md; end-user plain language, no internal names.
Out of scope: multi-day select / drag-to-select (NOT implemented at HEAD 4189de13); hourly/minutely/secondly recurrence; arbitrary or custom hex colors (colorHex is provider read-only); editing docs/frontend/week-drag-interaction.md or any other doc; any code change under packages/**; modifying any pre-existing README line.
FR-1..FR-6 and acceptance criteria 1..10: exactly one new level-2 heading, correct position, both topics covered accurately, working link, no multi-day mention, no unsupported-feature claims, no internal identifiers, pre-existing lines unmodified, bun lint passes, no file other than README.md modified.
PII inventory and role matrix: not applicable to a README-only change.
```

#### README.md
_Included because: Insertion context: exact surrounding text and house voice the new section must match._

```
Line 23: '## Features'
Lines 25-35: 'Cool things you can do with in Compass' followed by a bullet list (keyboard slot-finding with SHIFT + arrows, cmd palette, edit events smoothly, Google Calendar sync), then 'Things you can't do in Compass (yet):' followed by bullets (attendees/reminders/locations/meeting links, Outlook events).
Line 37: '## Tech stack'
Lines 39-41: bullets for Frontend / Backend / Testing.
House voice: terse, second-person, benefit-first, bold lead-ins on bullets, occasional inline code for keys.
```
### Acceptance criteria
- packets.json exists at the stated artifact_path and parses as a JSON array
- The array has exactly one element
- That element sets task_type to doc_addition, artifact_path to README.md, intent to docs, and pass_id to the run id
- The element's instruction forbids multi-day select, hourly/minutely recurrence, and custom hex colors, and requires the week-drag-interaction.md link
- All required TaskPacket fields are present: id, phase, task_type, module, instruction, inputs, outputSchema, acceptance, budget, pass_id
- No file other than packets.json is created or modified
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
    "packet_count": {
      "type": "integer"
    },
    "packet_ids": {
      "type": "array",
      "items": {
        "type": "string"
      }
    }
  },
  "required": [
    "artifact_path",
    "packet_count",
    "packet_ids"
  ]
}
```