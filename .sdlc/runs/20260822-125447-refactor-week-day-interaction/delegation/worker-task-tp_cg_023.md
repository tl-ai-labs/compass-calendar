## Task tp_cg_023 — codegen / existing_file_edit
Module: config
### Working directory
You are running as an agent inside `/home/sainadh/projects/compass-calendar/compass/compass-calendar`. You may list, read,
edit and create files there, and run commands there. That directory is the
only place you can act; nothing outside it is reachable.
### Instruction
APPEND-ONLY EDIT to the repo-root .gitignore. Add exactly two new entries if they are not already present: `.sdlc/` and `.hook-logs/`. Add them at the END of the file, preceded by a single comment line reading `# AI-SDLC run bookkeeping (also keeps Biome from linting it - biome.json sets vcs.useIgnoreFile)`. CRITICAL: this is APPEND-ONLY. Do NOT reorder, rewrite, deduplicate, sort, or remove ANY existing line. Every pre-existing line must remain byte-identical and in its current order. Preserve the file's existing trailing-newline convention. EFFICIENCY RULE: do NOT run tests, type-check, build or lint. Touch NO other file. Do NOT run git, rm, mv, or any cleanup command.
### Provided excerpts
These are extracts, not whole files. The paths are real — open them in the
working directory when you need more than the excerpt shows.

#### .gitignore
_Included because: Current tail of the file. Append after the last line; leave everything above untouched._

```
buildcache/
logs/
node_modules/
packages/backend/logs
packages/backend/build
packages/backend/node_modules
packages/core/build/
packages/web/node_modules/
packages/web/build/
playwright-report/
test-results/
tmp/
```

#### biome.json
_Included because: Why this matters: Biome honours .gitignore, so these two entries also stop it linting the run's own bookkeeping (151 of 156 current lint errors)._

```
{
  "vcs": {
    "enabled": true,
    "clientKind": "git",
    "useIgnoreFile": true
  },
  "formatter": { "enabled": true, "indentStyle": "space", "indentWidth": 2, "lineWidth": 80 }
}
```
### Acceptance criteria
- .sdlc/ and .hook-logs/ are present in .gitignore
- A single explanatory comment line precedes them
- Every pre-existing line is byte-identical and in its original order
- No other file is created or modified
### Your final message
Your final message must be a single JSON object and nothing else — no
prose before it, no summary after it, no ``` fence around it. It must
conform to this schema:

```json
{
  "type": "object",
  "properties": {
    "file_written": {
      "type": "string"
    },
    "content": {
      "type": "string"
    }
  },
  "required": [
    "file_written",
    "content"
  ]
}
```