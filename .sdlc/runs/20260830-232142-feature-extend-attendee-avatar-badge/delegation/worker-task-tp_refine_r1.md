## Task tp_refine_r1 — codegen / existing_file_edit
Module: grid-attendee-badge
### Working directory
You are running as an agent inside `/home/sainadh/projects/compass-calendar/compass/compass-calendar`. You may list, read,
edit and create files there, and run commands there. That directory is the
only place you can act; nothing outside it is reachable.
### Instruction
Fix senior-review finding R-1 in packages/web/src/grid/components/AttendeeBadge.tsx. Run `bunx biome check --write packages/web/src/grid/components/AttendeeBadge.tsx` from the repo root, then verify with `bunx biome check packages/web/src/grid/components/AttendeeBadge.tsx`. That resolves the formatter error and the three lint/nursery/useSortedClasses diagnostics automatically. SCOPE LIMIT — read carefully: the remaining warning `lint/a11y/useSemanticElements` at the `role="group"` div MUST BE LEFT EXACTLY AS IS. Do NOT change role="group" to a semantic element, do NOT remove the role, do NOT add aria-hidden, and do NOT add a biome-ignore comment for it. That role is a frozen design decision under review elsewhere and changing it would corrupt a policy-comparison record. So the expected end state is: formatting fixed, Tailwind classes sorted, and the useSemanticElements warning still reported. Change NO OTHER FILE and change no runtime behaviour — the rendered DOM must be identical apart from Tailwind class ORDER within the same className strings. Report in `remaining_diagnostics` exactly which biome diagnostics still appear after your fix.
### Provided excerpts
These are extracts, not whole files. The paths are real — open them in the
working directory when you need more than the excerpt shows.

#### BIOME_OUTPUT
_Included because: The exact diagnostics to clear, and the one to preserve._

```
packages/web/src/grid/components/AttendeeBadge.tsx:34:7 lint/a11y/useSemanticElements   <-- PRESERVE THIS ONE
packages/web/src/grid/components/AttendeeBadge.tsx:37:9 lint/nursery/useSortedClasses FIXABLE   <-- fix
packages/web/src/grid/components/AttendeeBadge.tsx:50:15 lint/nursery/useSortedClasses FIXABLE  <-- fix
packages/web/src/grid/components/AttendeeBadge.tsx:59:21 lint/nursery/useSortedClasses FIXABLE  <-- fix
packages/web/src/grid/components/AttendeeBadge.tsx format error  <-- fix
Formatter wants:
    const summaryLabel = `Attendees: ${attendees
      .map(
        (a) =>
          `${a.displayName ?? a.email} (${attendeeStatusLabel(a.responseStatus)})`,
      )
      .join(", ")}`;
Class sorting wants e.g. "pl-0.5 font-medium text-[9px] leading-none opacity-80" for the overflow span.
```
### Acceptance criteria
- biome reports no format error and no useSortedClasses diagnostics for AttendeeBadge.tsx
- the role="group" attribute is still present and unmodified
- no biome-ignore comment was added
- no other file was modified
- rendered DOM is unchanged apart from class order
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
    "written": {
      "type": "boolean"
    },
    "summary": {
      "type": "string"
    },
    "remaining_diagnostics": {
      "type": "string"
    }
  },
  "required": [
    "artifact_path",
    "written",
    "summary",
    "remaining_diagnostics"
  ]
}
```