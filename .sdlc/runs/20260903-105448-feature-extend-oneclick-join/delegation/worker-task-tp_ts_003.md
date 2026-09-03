## Task tp_ts_003 — tests / test_add
Module: grid-components
### Working directory
You are running as an agent inside `/home/sainadh/projects/compass-calendar/compass/compass-calendar`. You may list, read,
edit and create files there, and run commands there. That directory is the
only place you can act; nothing outside it is reachable.
### Instruction
Create packages/web/src/grid/components/EventJoinIcon.test.tsx, a bun:test suite for the EventJoinIcon component at packages/web/src/grid/components/EventJoinIcon.tsx (read it first).

Mirror the import style of packages/web/src/grid/components/EventCard.test.tsx lines 1-18: @testing-library/react, then bun:test named imports (describe, expect, it, mock), then `import "@testing-library/jest-dom";`, then local imports.

Required cases (all 10):
1. renders a named link: screen.getByRole("link", { name: "Join Planning block" }) resolves.
2. target/rel/href: toHaveAttribute("target","_blank"), toHaveAttribute("rel","noopener noreferrer"), toHaveAttribute("href", url).
3. empty eventTitle yields accessible name "Join Untitled event".
4. the data attribute is reachable from the real pointer target: link.querySelector("svg").closest(`[${EVENT_JOIN_CONTROL_ATTRIBUTE}]`) === link. Import EVENT_JOIN_CONTROL_ATTRIBUTE from @web/grid/interaction/dom.
5. url "javascript:alert(1)" renders nothing: screen.queryByRole("link") is null.
6. same for "data:text/html,<script>" and "vbscript:msgbox(1)".
7. same for "not a url", "/relative", and "".
8. "HTTPS://MEET.EXAMPLE.COM/x" DOES render (uppercase scheme normalizes).
9. mousedown does not reach a parent handler: render inside <div onMouseDown={parentSpy}> carrying the same `biome-ignore lint/a11y/noStaticElementInteractions` comment style used in EventCard.test.tsx; fireEvent.mouseDown(link); expect(parentSpy).not.toHaveBeenCalled().
10. geometry: with position={{ left: 10, top: 20, width: 140, height: 60 }} and rightInsetPx={16}, assert link.style.left === "110px", link.style.top === "38px", link.style.width === "24px", link.style.height === "24px".

HARD RULES:
- Every presence/absence assertion MUST use getByRole/queryByRole against the accessibility tree. NEVER use getAttribute("role") and NEVER use a CSS selector containing [role=. A previous attempt at this feature shipped role-attribute assertions that could not fail; that is the specific defect being guarded against.
- Do NOT import or use axe / jest-axe in this file.
- Do NOT call fireEvent.click on the anchor: a real href triggers a navigation-not-implemented error in the DOM shim. Case 9 uses mouseDown only.
- Write ONLY the file packages/web/src/grid/components/EventJoinIcon.test.tsx. Do not create, modify or delete any other file for any reason.
### Provided excerpts
These are extracts, not whole files. The paths are real — open them in the
working directory when you need more than the excerpt shows.

#### packages/web/src/grid/components/EventJoinIcon.tsx
_Included because: component under test - read for exact props and behaviour_

```

```

#### packages/web/src/grid/components/EventCard.test.tsx
_Included because: import order and bun:test conventions to mirror_

```

```

#### packages/web/src/grid/interaction/dom.ts
_Included because: EVENT_JOIN_CONTROL_ATTRIBUTE export used by case 4_

```

```
### Acceptance criteria
- all 10 cases present
- zero occurrences of getAttribute("role") and zero [role= selectors
- no axe import
- no fireEvent.click on the anchor
- only EventJoinIcon.test.tsx is written
### Your final message
Your final message must be a single JSON object and nothing else — no
prose before it, no summary after it, no ``` fence around it. It must
conform to this schema:

```json
{
  "type": "object",
  "properties": {
    "file_content": {
      "type": "string",
      "description": "Full contents of EventJoinIcon.test.tsx"
    },
    "files_written": {
      "type": "array",
      "items": {
        "type": "string"
      },
      "description": "Every path written"
    }
  },
  "required": [
    "file_content"
  ]
}
```