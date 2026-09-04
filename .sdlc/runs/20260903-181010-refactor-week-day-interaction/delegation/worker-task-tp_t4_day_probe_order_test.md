## Task tp_t4_day_probe_order_test — tests / test_add
Module: day-interaction
### Working directory
You are running as an agent inside `/home/sainadh/projects/compass-calendar/compass/compass-calendar/packages/web/src/views/Day/interaction`. You may list, read,
edit and create files there, and run commands there. That directory is the
only place you can act; nothing outside it is reachable.
### Instruction
APPEND tests to the EXISTING file adapter/day-interaction.adapter.test.ts (relative to work_dir packages/web/src/views/Day/interaction). Read that whole file first and reuse its existing helpers, fixtures and setup style - do not invent a new harness.

GOAL: close a real coverage gap. The Day adapter resolves a pointerdown by probing four target kinds IN ORDER: all-day resize, then timed resize, then timed drag, then all-day drag. That order is what makes grabbing a resize handle start a RESIZE rather than a DRAG. Week exercises this via 9 test files; Day has none, and the probe order was just hoisted into shared code, so Day needs its own guard.

Add tests asserting:
1. A pointerdown on a registered TIMED event element that carries the resize-handle attribute yields ownership reason "saved-timed-resize" - NOT "saved-timed-drag".
2. A pointerdown on a registered ALL-DAY event element that carries the resize-handle attribute yields ownership reason "saved-all-day-resize" - NOT "saved-all-day-drag".

handlePointerDown returns { reason, shouldOwn }. The reason strings come from getSavedEventOwnershipReason in @web/grid/interaction/adapter.helpers - READ that file to confirm the exact strings before asserting them; do not guess. The resize-handle attribute is EVENT_RESIZE_HANDLE_ATTRIBUTE exported from @web/grid/interaction/dom - read that too for the exact attribute name and how getResizeHandleEdge detects it.

HARD CONSTRAINTS: append only. Do not modify, delete, rename or skip ANY existing test in the file. Do not change existing imports except to ADD what you need. The file must produce zero biome diagnostics (this repo uses inline type modifiers `import { type X }`, never `import type { X }`, and sorts "bun:test" last).
### Provided excerpts
These are extracts, not whole files. The paths are real — open them in the
working directory when you need more than the excerpt shows.

#### packages/web/src/views/Day/interaction/adapter/day-interaction.adapter.test.ts
_Included because: undefined_

```
undefined
```

#### packages/web/src/grid/interaction/adapter.helpers.ts
_Included because: undefined_

```
undefined
```

#### packages/web/src/grid/interaction/dom.ts
_Included because: undefined_

```
undefined
```
### Acceptance criteria
- both resize-handle cases assert the exact ownership reason string read from adapter.helpers
- the tests fail if the 4-probe order is swapped
- no existing test modified, deleted or skipped
- zero biome diagnostics
### Your final message
Your final message must be a single JSON object and nothing else — no
prose before it, no summary after it, no ``` fence around it. It must
conform to this schema:

```json
{
  "type": "object",
  "properties": {
    "path": {
      "type": "string"
    },
    "content": {
      "type": "string"
    }
  },
  "required": [
    "path",
    "content"
  ]
}
```