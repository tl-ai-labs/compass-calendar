## Task tp_packets_001 — plan_task_packets / decomposition
Module: grid-event-cards
### Working directory
You are running as an agent inside `/home/sainadh/projects/compass-calendar/compass/compass-calendar`. You may list, read,
edit and create files there, and run commands there. That directory is the
only place you can act; nothing outside it is reachable.
### Instruction
Decompose the approved change plan into exactly FOUR TaskPackets and write them as a JSON array to .sdlc/runs/20260822-040449-feature-extend-one-click-join/packets.json. READ FIRST: .sdlc/runs/20260822-040449-feature-extend-one-click-join/change_plan.md and requirements.md. THREE GATE-2 DECISIONS override the change plan where they conflict - encode them in the packet instructions: (1) Do NOT create packages/web/src/components/Icons/VideoCamera.tsx; import VideoCameraIcon DIRECTLY from '@phosphor-icons/react' inside EventJoinIcon.tsx, matching UpNextCard.tsx and EventDetailsSection.tsx which already import it raw. Only four paths may EVER be written. (2) Keep the AllDayEventCard width gate at its local REPEAT_ICON_MIN_WIDTH = 60. (3) Keep Tailwind z-10 on the join anchor; do not switch to the ZIndex enum. The four packets, in dependency order: tp_cg_001 artifact_path packages/web/src/grid/components/EventJoinIcon.tsx task_type new_file_add phase codegen; tp_cg_002 artifact_path packages/web/src/grid/components/TimedEventCard.tsx task_type existing_file_edit phase codegen; tp_cg_003 artifact_path packages/web/src/grid/components/AllDayEventCard.tsx task_type existing_file_edit phase codegen; tp_test_001 artifact_path packages/web/src/grid/components/EventCard.test.tsx task_type test_add phase tests. Each packet object MUST have every one of these keys: id, phase, task_type, module ('grid-event-cards'), pass_id ('20260822-040449-feature-extend-one-click-join'), intent ('feature-extend'), artifact_path, instruction (imperative, under 300 tokens, concrete enough to implement without re-reading the change plan), inputs (array, may be empty), outputSchema (JSON Schema object), acceptance (array of testable strings; for tp_test_001 list AC-1..AC-11), budget {maxInputTokens, maxOutputTokens}, retry_count 0. Write ONLY packets.json - do not modify any file under packages/. Return JSON {artifact_path, packet_count, packet_ids}.
### Provided excerpts
_None supplied. Explore the working directory to find what you need._
### Acceptance criteria
- packets.json exists and parses as a JSON array of exactly 4 objects
- Every packet carries id, phase, task_type, module, pass_id, intent, artifact_path, instruction, inputs, outputSchema, acceptance, budget, retry_count
- Every artifact_path is one of the four allowlisted paths under packages/web/src/grid/components/
- No packet references packages/web/src/components/Icons/VideoCamera.tsx
- No file under packages/ was modified by this task
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
      "type": "number"
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