## Task tp_sec_001 — security_review / changed_files_review
Module: week-day-interaction
### Working directory
You are running as an agent inside `/home/sainadh/projects/compass-calendar/compass/compass-calendar`. You may list, read,
edit and create files there, and run commands there. That directory is the
only place you can act; nothing outside it is reachable.
### Instruction
Perform a CHANGED-FILES-ONLY security review of this refactor and return it as a single markdown string in the JSON field security_review_markdown. Emit exactly ONE JSON object with that one key. Scope: only the 25 files listed in the change surface - do not review the wider codebase. This is a type-level refactor of calendar drag/drop interaction code in a local-first calendar app; there is no network, auth, or persistence code in the diff. Structure the document as: (1) Scope reviewed - the file list and what changed in one line each, grouped by category; (2) Threat assessment - work through these specific questions and answer each with a verdict and reasoning: does any change alter RUNTIME behavior (vs types only)? do the two unchecked cast helpers asDateColumnKeys/asDayColumnKeys weaken any validation that previously existed? does the residual `visual.dayDate as CalendarId` cast in Day's timed.commit.ts create a cross-calendar data-integrity risk, and what bounds it? could the branded-type change cause an event to be written to the WRONG calendar or have its dates silently rewritten? does the .gitignore change hide anything security-relevant? any secrets, credentials, PII, logging or dependency changes? (3) Findings table - id, severity (info/low/medium/high), file, description, recommendation. Use INFO for observations that are not defects. (4) Residual risks accepted - specifically the columnMoveCalendarId cast, stating plainly that it rests on a RUNTIME invariant not a compile-time proof, and naming the test that covers it. (5) Verdict - one paragraph, and state explicitly whether this change is safe to merge from a security standpoint. Be proportionate: this is a types-only refactor with a green full test suite, so do NOT invent severity where none exists, and do NOT recommend generic security hardening unrelated to the diff. Do NOT write any files. Do NOT run any shell commands - especially never git checkout, git restore, git clean, rm, mv, or any cleanup command.
### Provided excerpts
These are extracts, not whole files. The paths are real — open them in the
working directory when you need more than the excerpt shows.

#### CHANGE-SURFACE.md
_Included because: The exact files changed and the verification state. Review only these._

```
=== 23 modified + 2 new files, 277 insertions / 311 deletions (NET -34 LOC) ===
NEW (types only, no runtime output):
  packages/web/src/grid/interaction/types/column-key.types.ts  - declares DateColumnKey = DateOnly, DayColumnKey = CalendarId | DateOnly, and two UNCHECKED cast helpers asDateColumnKeys/asDayColumnKeys
  packages/web/src/grid/interaction/types/adapter.types.ts     - shared generic Target/CommitResult/Visual contracts previously duplicated per view

MODIFIED - shared grid layer (generic threading, no logic change):
  grid/interaction/layout.cache.ts, math/{timed.drag,all-day.drag,cross-row.drag,drag-column}.ts,
  commit/timed-moved.ts, types/{timed-drag,all-day-drag}.types.ts
MODIFIED - commit boundary (type-only signature pinning):
  grid/interaction/commit/cross-row.commit.ts  (pinned to DateColumnKey)
  views/Week/interaction/adapter/commit/{all-day,timed}.commit.ts (pinned to DateColumnKey)
  views/Day/interaction/adapter/commit/{all-day,timed}.commit.ts  (pinned to DayColumnKey)
MODIFIED - view adapters / geometry / per-interaction modules:
  views/{Week,Day}/interaction/adapter/geometry/*-layout.cache.ts (branding boundary)
  views/Day/interaction/adapter/day-interaction.adapter.ts (2 lines: layout type + asDayColumnKeys)
  views/Week/interaction/adapter/interactions/{all-day,timed}.drag.ts (annotations only)
  views/{Week,Day}/interaction/adapter/*-interaction.adapter.types.ts (149-line duplicates collapsed to alias re-exports)
MODIFIED - test fixture (no assertion changed):
  grid/interaction/commit/cross-row.commit.test.ts
MODIFIED - config:
  .gitignore  (APPEND-ONLY: added `.sdlc/` and `.hook-logs/`)

NOT CHANGED: no package.json, no bun.lock, no biome.json, no tsconfig, no dependency added or upgraded. No backend, sync, scripts or core package touched (all off-limits). Neither WeekInteractionCoordinator.tsx nor DayInteractionCoordinator.tsx touched.
NOTE: .claude/settings.json appears modified in git status but is a PRE-EXISTING change from an earlier session - NOT part of this run and off-limits to it.

=== VERIFICATION STATE ===
bun run type-check : PASS (exit 0, three tsc passes, TypeScript 7.0.2)
bun run lint       : all 25 changed files clean. One pre-existing repo error remains in packages/sync (off-limits, untouched, unrelated).
bun run test:web   : 2298 pass / 0 fail across 302 files - EXACTLY the pre-run baseline. Zero regressions.
```

#### SEMANTIC-CONTEXT.md
_Included because: The domain semantics needed to judge the data-integrity questions._

```
=== WHAT THE REFACTOR ACTUALLY DID ===
TimedDragVisual.dayDate and AllDayDragVisual.dayDate were `string` but OVERLOADED: in Week view a column key is a YYYY-MM-DD DATE; in Day view a column key is a CALENDAR ID. Nothing in the type system caught a mix-up. A shared code path that assumed 'date' would silently corrupt Day-view cross-calendar drags. This refactor gives the column key a view-parameterized branded type so the two domains are statically distinct.

The brands are the repo's EXISTING zod-branded primitives from packages/core (imported read-only, core was not modified):
  CalendarIdSchema = ObjectIdStringSchema.brand<"CalendarId">()
  DateOnlySchema   = zYearMonthDayString.brand<"DateOnly">()
zod 4.4.3 defines `$brand` as a REQUIRED unique-symbol property, so plain `string` is not assignable to either, and CalendarId is not assignable to DateOnly. Verified empirically: the compiler emitted 'Type string is not assignable to type string & $brand<"DateOnly">' at the intended boundary.

=== CONTAINMENT WIN ===
grid/interaction/commit/cross-row.commit.ts calls dayjs(visual.dayDate) - only meaningful for DATE-keyed columns. It is now PINNED to DateColumnKey, so passing a calendar-keyed Day visual is a COMPILE ERROR. Previously this was prevented only by convention (Day happened not to import it).

=== THE TWO UNCHECKED CAST HELPERS ===
  export const asDateColumnKeys = (keys: string[]): DateColumnKey[] => keys as DateColumnKey[];
  export const asDayColumnKeys  = (keys: string[]): DayColumnKey[]  => keys as DayColumnKey[];
They are deliberately unchecked. A validating parse (DateOnlySchema.parse) was explicitly REJECTED during design because the layout cache is rebuilt mid-drag, so a parse would put zod on a per-frame hot path AND would THROW on input that is silently tolerated today - i.e. it would be a behavior change, violating the run's no-behavior-change invariant. IMPORTANT: no validation existed at these call sites before this refactor either; the values were plain strings passed straight through. So this adds static separation without removing any pre-existing runtime check.

=== THE RESIDUAL CAST (the one thing to scrutinize) ===
views/Day/interaction/adapter/commit/timed.commit.ts:
  export const columnMoveCalendarId = (
    visual: Pick<TimedDragVisual<DayColumnKey>, "dayDate" | "initialDayDate">,
    event: GridEvent,
  ): CalendarId | undefined =>
    visual.dayDate !== visual.initialDayDate ? (visual.dayDate as CalendarId) : event.calendarId;
Day's column keys are calendar ids WHEN calendar columns are rendered, but in the single-column FALLBACK the one key is a DATE. The fallback fires for resizes and for a drag whose event's calendar is not among the rendered columns. The cast is safe only because in the fallback there is exactly ONE column, so dayDate !== initialDayDate can never be true and the cast is unreachable. That is a RUNTIME invariant, not a compile-time proof. It was a `string -> CalendarId` cast before this refactor and is now a `CalendarId|DateOnly -> CalendarId` cast, i.e. strictly narrower.
TEST COVERAGE for that invariant (both existing, both passing):
  day-interaction.adapter.test.ts:457 'disables cross-column movement for an event whose calendar has no column' - the fallback path, asserts hasMoved false and calendarId unchanged.
  day-interaction.adapter.test.ts:444 'keeps a multi-day all-day event's dates on a cross-calendar move' - asserts calendarId changes to the target calendar while startDate/endDate stay byte-identical.

=== DAY ALL-DAY DATE INVARIANT (INV-6) ===
Day all-day drag must NEVER rewrite startDate/endDate - only calendarId - because rewriting them to the visible date would truncate a multi-day all-day event to a single day. That code and its explanatory comment were preserved verbatim; the covering test passes.
```
### Acceptance criteria
- Response is exactly one JSON object with the single key security_review_markdown
- Every one of the listed threat questions is answered with a verdict
- Findings table uses proportionate severities and does not invent risk in a types-only diff
- The columnMoveCalendarId cast is described as resting on a runtime invariant, with its covering test named
- A clear merge verdict is given
### Your final message
Your final message must be a single JSON object and nothing else — no
prose before it, no summary after it, no ``` fence around it. It must
conform to this schema:

```json
{
  "type": "object",
  "properties": {
    "security_review_markdown": {
      "type": "string"
    }
  },
  "required": [
    "security_review_markdown"
  ]
}
```