## Task tp_t2_phantom_brand_test — tests / test_add
Module: grid-interaction-registry
### Working directory
You are running as an agent inside `/home/sainadh/projects/compass-calendar/compass/compass-calendar/packages/web/src/grid/interaction`. You may list, read,
edit and create files there, and run commands there. That directory is the
only place you can act; nothing outside it is reachable.
### Instruction
Create the file view-event-registry.brand.test.ts in your work_dir root (packages/web/src/grid/interaction). Read ./view-event-registry.ts and ./event.registry.ts first.

Write a bun:test file proving the phantom view brand on ViewRegisteredEventTarget discriminates Week from Day.

Use EXACTLY these imports, in exactly this order (this repo sorts "bun:test" LAST, and @web paths alphabetically):
  import { createEventRegistry } from "@web/grid/interaction/event.registry";
  import { type ViewInteractionEventType } from "@web/grid/interaction/view-event-registry";
  import { type DayRegisteredEventTarget } from "@web/views/Day/interaction/registry/day-event.registry";
  import { type WeekRegisteredEventTarget } from "@web/views/Week/interaction/registry/week-event.registry";
  import { describe, expect, it } from "bun:test";

Style rules for this repo: inline type modifiers `import { type X }`, NEVER `import type { X }`. Prefix intentionally-unused variables with `_` so Biome's noUnusedVariables does not fire.

Required proofs, each mis-assignment on its own line directly under its own `// @ts-expect-error` comment:
1. A WeekRegisteredEventTarget is NOT assignable to DayRegisteredEventTarget.
2. A DayRegisteredEventTarget is NOT assignable to WeekRegisteredEventTarget.
Create the two source values with `null as unknown as WeekRegisteredEventTarget` / `... as DayRegisteredEventTarget` at module scope.

Then add a POSITIVE assertion (NO @ts-expect-error, it must compile cleanly) that the single widening point works: a raw registry registration is assignable to BOTH branded types. Build it as a module-scope value typed `RegisteredEventTarget<ViewInteractionEventType>`-shaped, e.g. `const raw = { element: null as unknown as HTMLElement, eventId: "e1", eventType: "timed" as ViewInteractionEventType };` then `const _asWeek: WeekRegisteredEventTarget = raw;` and `const _asDay: DayRegisteredEventTarget = raw;`. Check ./event.registry.ts for the real RegisteredEventTarget field names and match them exactly.

Finally add one runtime test with at least one expect() - assert createEventRegistry produces a registry object (e.g. expect(typeof registry.resolveFromTarget).toBe("function")), checking event.registry.ts for the real factory signature and returned method names.

The file must produce ZERO biome diagnostics and type-check must stay exit 0. Do not modify any other file.
### Provided excerpts
These are extracts, not whole files. The paths are real — open them in the
working directory when you need more than the excerpt shows.

#### packages/web/src/grid/interaction/view-event-registry.ts
_Included because: undefined_

```
undefined
```

#### packages/web/src/grid/interaction/event.registry.ts
_Included because: undefined_

```
undefined
```
### Acceptance criteria
- both directions of Week/Day rejection proven with @ts-expect-error
- positive widening assertion compiles with no suppression
- at least one runtime expect()
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