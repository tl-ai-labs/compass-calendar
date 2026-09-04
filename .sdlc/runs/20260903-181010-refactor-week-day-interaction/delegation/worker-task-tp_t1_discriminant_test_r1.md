## Task tp_t1_discriminant_test_r1 — tests / test_add
Module: grid-interaction-types
### Working directory
You are running as an agent inside `/home/sainadh/projects/compass-calendar/compass/compass-calendar/packages/web/src/grid/interaction`. You may list, read,
edit and create files there, and run commands there. That directory is the
only place you can act; nothing outside it is reachable.
### Instruction
Rewrite the EXISTING file types/column-key.types.test.ts (relative to work_dir packages/web/src/grid/interaction). Its type-level content is correct and must be preserved; it FAILED lint validation and must be fixed.

Two lint defects to fix, both reported by `biome check`:
1. lint/style/useImportType at line 2: this repo writes inline type modifiers, NOT `import type { X }`. Convert every `import type { X } from "..."` to `import { type X } from "..."`.
2. assist/source/organizeImports at line 1: imports must be sorted by module specifier. The correct order for this file is: "bun:test", then "../layout.cache", then "./column-key.types", then "./timed-drag.types".

Everything else must stay exactly as it is. In particular KEEP all five @ts-expect-error lines and the assignments beneath them — type-check currently passes with them, which proves each one suppresses a real error. Removing or reordering them would destroy the proof. KEEP the `_`-prefixed variable names (Biome treats that prefix as intentionally-unused, so they do not trip noUnusedVariables). KEEP both runtime expect() calls.

The file must end up with: zero biome diagnostics, type-check still exit 0, and the same five negative proofs plus the zero-runtime-footprint test.
### Provided excerpts
These are extracts, not whole files. The paths are real — open them in the
working directory when you need more than the excerpt shows.

#### packages/web/src/grid/interaction/types/column-key.types.test.ts
_Included because: undefined_

```
undefined
```
### Acceptance criteria
- biome check reports zero diagnostics for this file
- all five @ts-expect-error lines retained
- type-check exit 0
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