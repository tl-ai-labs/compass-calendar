## Task tp_t1_discriminant_test — tests / test_add
Module: grid-interaction-types
### Working directory
You are running as an agent inside `/home/sainadh/projects/compass-calendar/compass/compass-calendar/packages/web/src/grid/interaction`. You may list, read,
edit and create files there, and run commands there. That directory is the
only place you can act; nothing outside it is reachable.
### Instruction
Create the file types/column-key.types.test.ts (relative to your work_dir, which is packages/web/src/grid/interaction). Read types/column-key.types.ts, types/timed-drag.types.ts and layout.cache.ts first.

Write a bun:test file (import { describe, expect, it } from "bun:test") that proves the column-key discriminant is not inert. Use @ts-expect-error on deliberate mis-assignments. Required proofs:
1. A TimedDragVisual<DateColumnKey> is NOT assignable to TimedDragVisual<CalendarColumnKey>.
2. A TimedDragVisual<CalendarColumnKey> is NOT assignable to TimedDragVisual<DateColumnKey>.
3. A GridLayoutCache<DateColumnKey> is NOT assignable to GridLayoutCache<CalendarColumnKey>.
4. A bare string is NOT assignable to DateColumnKey, and NOT assignable to CalendarColumnKey.
Each mis-assignment must sit on its own line directly under its own @ts-expect-error comment, so that if the discriminant ever goes inert the line becomes an UNUSED @ts-expect-error and type-check FAILS. That failure mode is the entire point of the file.

Also add one runtime test asserting the brand has zero runtime footprint: cast a string literal to DateColumnKey and assert typeof is "string" and that it is strictly equal to the original literal.

Declare fixtures with explicit type annotations rather than constructing full visual objects where you can; keep the file short. Do not modify any other file.
### Provided excerpts
These are extracts, not whole files. The paths are real — open them in the
working directory when you need more than the excerpt shows.

#### packages/web/src/grid/interaction/types/column-key.types.ts
_Included because: undefined_

```
undefined
```

#### packages/web/src/grid/interaction/types/timed-drag.types.ts
_Included because: undefined_

```
undefined
```

#### packages/web/src/grid/interaction/layout.cache.ts
_Included because: undefined_

```
undefined
```
### Acceptance criteria
- file created at types/column-key.types.test.ts
- every @ts-expect-error is genuinely suppressing a real error
- at least one runtime expect() call
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