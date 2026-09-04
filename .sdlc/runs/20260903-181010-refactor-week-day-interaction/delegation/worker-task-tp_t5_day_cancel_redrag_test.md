## Task tp_t5_day_cancel_redrag_test — tests / test_add
Module: day-interaction
### Working directory
You are running as an agent inside `/home/sainadh/projects/compass-calendar/compass/compass-calendar/packages/web/src/views/Day/interaction`. You may list, read,
edit and create files there, and run commands there. That directory is the
only place you can act; nothing outside it is reachable.
### Instruction
APPEND ONE test to the EXISTING file adapter/day-interaction.adapter.test.ts (relative to work_dir packages/web/src/views/Day/interaction). Read the whole file first and reuse its existing helpers verbatim - createAdapter, registerEvent, makePointerEvent, elementWithRect, timedEvent, the afterEach cleanup. Do NOT build a new harness.

GOAL: guard the interaction's layout + scrollTop lifecycle across a cancel. The adapter caches a layout cache and a smart-scroll offset for the duration of one gesture and clears BOTH on cancel. If the clear ever regresses, a stale scroll offset from the first drag silently leaks into the next drag and every subsequent drop lands at the wrong time - with no test failing.

Write a test that:
1. Starts a timed drag on the registered timed event (pointerdown, then pointermove, then flushFrame) so a layout and scroll offset are cached.
2. Scrolls the grid mid-drag by setting mainGridElement.scrollTop to a NON-ZERO value (createAdapter returns mainGridElement).
3. Calls adapter.cancel() to abort the gesture.
4. Starts a SECOND, fresh timed drag with the same pointer sequence and commits it via pointerup.
5. Asserts the second drag's committed event times are computed from a FRESH layout - i.e. they match what an identical drag produces with no prior cancelled gesture, and are NOT shifted by the stale scroll offset from step 2.

To make the assertion concrete and non-tautological, compute the expected times the same way the file's existing timed-drag tests do (look at how "keeps timed drag on the one visible date" and "uses the latest timed grid scroll position..." assert startDate/endDate) and assert exact strings via expect.stringContaining, not a recomputation of the adapter's own arithmetic.

HARD CONSTRAINTS: append only. Do NOT modify, delete, rename or skip any existing test - the file currently has 16 `it(` blocks and all 16 must remain byte-identical. Zero biome diagnostics (inline type modifiers `import { type X }`, "bun:test" sorted last).
### Provided excerpts
These are extracts, not whole files. The paths are real — open them in the
working directory when you need more than the excerpt shows.

#### packages/web/src/views/Day/interaction/adapter/day-interaction.adapter.test.ts
_Included because: undefined_

```
undefined
```
### Acceptance criteria
- all 16 pre-existing it() blocks unchanged
- new test fails if layout/scrollTop is not cleared on cancel
- zero biome diagnostics
- no other file modified
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