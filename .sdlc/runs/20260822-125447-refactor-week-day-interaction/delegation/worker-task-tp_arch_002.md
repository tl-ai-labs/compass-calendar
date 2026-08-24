## Task tp_arch_002 — architecture_design / delta_refactor_plan
Module: week-day-interaction
### Working directory
You are running as an agent inside `/home/sainadh/projects/compass-calendar/compass/compass-calendar`. You may list, read,
edit and create files there, and run commands there. That directory is the
only place you can act; nothing outside it is reachable.
### Instruction
Rewrite a DELTA REFACTOR PLAN for change_plan.md. A previous attempt failed for two reasons; both must be fixed.

FAILURE 1 - OUTPUT FORMAT. The previous attempt emitted TWO concatenated JSON objects, the first truncated. Emit EXACTLY ONE JSON object, with exactly one key, change_plan_markdown, whose value is the whole markdown document as a single string. Nothing before or after it.

FAILURE 2 - THE TYPE DESIGN WAS UNSOUND. The previous D-1 proposed `type DateColumnKey = string & { readonly __brand?: \"DateColumnKey\" }` and `type DayColumnKey = CalendarId | string`, then claimed passing a Day visual where a Date visual is expected would be a compile-time error. BOTH claims are false in TypeScript: (a) an OPTIONAL brand property creates no nominal type at all - plain `string` is assignable to `string & { __brand?: X }`, so the brand is vacuous; (b) `CalendarId | string` widens to just `string`, erasing the distinction entirely. So that design would compile-check nothing while appearing to. Do not repeat it, and do not invent a new hand-rolled brand.

Use the repository's EXISTING branded-type convention instead - see the evidence input. Your D-1 must state, in one short paragraph, WHY the guarantee actually holds under the types you choose (i.e. that the brand property is required, not optional, so assignability genuinely fails), and must not claim any guarantee you cannot back that way. Where a guarantee is a runtime argument rather than a compile-time one, say so plainly rather than calling it static.

Keep the same section structure as before: (1) D-1 column-key type design resolving Q1/Q2/Q3 with exact declarations; (2) D-2 shared adapter types + per-view re-export strategy; (3) type-flow analysis; (4) sequenced work plan, FR-1 strictly first, each step file-specific and independently type-checkable, with a risk mark; (5) invariant test strategy mapping INV-1..INV-10; (6) verification command per step; (7) explicitly-not-doing list. Sections 2-7 of the previous attempt were sound - reproduce that content, corrected for the new D-1.

D-1 MUST additionally answer the boundary question in the evidence: the branded values have to ENTER the system somewhere, and today the producers are plainly-typed `string[]`. Name the exact boundary where a plain string becomes a branded key for each view, state whether that boundary sits inside this run's allowlist, and if any required edit falls OUTSIDE the allowlist say so explicitly as a BLOCKER rather than planning the edit.

Do NOT write any files. Do NOT run any shell commands - especially never git checkout, git restore, git clean, rm, mv, or any cleanup command.
### Provided excerpts
These are extracts, not whole files. The paths are real — open them in the
working directory when you need more than the excerpt shows.

#### EVIDENCE-existing-brand-convention.md
_Included because: Decisive: the repo already has real nominal branded types, including one for YYYY-MM-DD. This replaces the invented brand that made the last attempt unsound._

```
=== THE REPO ALREADY HAS REAL BRANDED TYPES - REUSE THEM, DO NOT INVENT ===
packages/core/src/types/domain-primitives.ts (verbatim):

  export const EventIdSchema = z.string().trim().min(1).max(256).brand<"EventId">();
  export type EventId = z.infer<typeof EventIdSchema>;

  export const CalendarIdSchema = ObjectIdStringSchema.brand<"CalendarId">();
  export type CalendarId = z.infer<typeof CalendarIdSchema>;

  export const DateOnlySchema = zYearMonthDayString.brand<"DateOnly">();
  export type DateOnly = z.infer<typeof DateOnlySchema>;

  export const DateTimeSchema = z.iso.datetime({ offset: true }).brand<"DateTime">();
  export type DateTime = z.infer<typeof DateTimeSchema>;

Key points for your D-1:
- Zod's .brand<"X">() produces `string & z.$brand<"X">`, where the brand carries a REQUIRED symbol-keyed property. That is genuine nominal typing: a plain `string` is NOT assignable to it, and `CalendarId` is NOT assignable to `DateOnly` or vice versa. This is the property the previous attempt's optional `__brand?` lacked.
- `DateOnly` is ALREADY EXACTLY the YYYY-MM-DD branded type this refactor needs for Week's date columns (zYearMonthDayString branded "DateOnly"). There is no reason to invent a DateColumnKey brand; alias it if you want a domain-specific name (`type DateColumnKey = DateOnly`).
- `CalendarId` is already imported and used by web code, including the Day commit file this refactor touches. So a Day column key union is `CalendarId | DateOnly` - a union of TWO branded types, which does NOT widen to `string`, unlike the previous attempt's `CalendarId | string`.
- Escape hatch to avoid: `.brand()` types are constructed via SchemaName.parse(value) or a cast. Prefer parse at a single boundary over scattering casts; if you choose a cast, confine it to one named helper and say why it is safe there.

=== HARD CONSTRAINT: packages/core IS OFF-LIMITS FOR EDITS ===
This run's write allowlist is: packages/web/src/grid/interaction/**, packages/web/src/views/Week/interaction/**, packages/web/src/views/Day/interaction/**, packages/web/src/interaction/interaction.adapter.types.ts, packages/web/src/components/ContextMenu/contextMenuLayering.test.tsx, .gitignore.
packages/core/** is OFF-LIMITS. IMPORTING from @core/types/domain-primitives is fine and needs no core edit (web files already do it). MODIFYING anything under packages/core is forbidden - if your design needs it, that is a BLOCKER to surface, not a step to plan.

=== THE BOUNDARY PROBLEM YOU MUST ANSWER ===
The column keys are produced as PLAIN `string[]` today, and some producers sit OUTSIDE the allowlist. Trace it:
- Week: WeekInteractionRuntime.getVisibleDays(): string[]  (declared in week-interaction.adapter.types.ts - IN allowlist; but its IMPLEMENTATION is supplied by whatever Week view component constructs the runtime, which may be OUTSIDE views/Week/interaction/**).
- Day: DayInteractionAdapterOptions.getColumnKeys?: () => string[] and getVisibleDate?: () => Dayjs (declared in day-interaction.adapter.types.ts - IN allowlist; implementation supplied by the Day coordinator/view).
- Both feed GridLayoutCacheOptions.visibleDates: string[] -> DayColumnCache.date: string -> visual.dayDate.
- Day additionally derives a fallback key from the visible date: `const columnKeys = eventColumnIndex >= 0 ? calendarColumnKeys : [visibleDateKey];` in day-interaction.adapter.ts.
Decide and state: does the branded type stop at the adapter boundary (with one parse/cast helper inside the allowlist), or does it propagate out to the runtime/coordinator implementations? The first keeps the run inside its allowlist; the second may not. Choose deliberately and justify.
```

#### .sdlc/runs/20260822-125447-refactor-week-day-interaction/change_plan.attempt1-notes.md
_Included because: The sound parts of attempt 1 to reproduce, so the rewrite does not lose correct work._

```
REPRODUCE THESE (they were correct and evidence-backed):

Q2 answer: Day interaction handlers decomposed under packages/web/src/views/Day/interaction/adapter/interactions/ mirroring Week 1:1, NOT hoisted into grid/interaction/adapter/.
Q3 answer: shared adapter types at packages/web/src/grid/interaction/types/adapter.types.ts (keeping types/ as the contract home, adapter.helpers.ts for executable helpers).

D-2 shared type set - correct as designed:
- Generic over TRegistered: GridAllDayDragTarget<TRegistered>, GridAllDayResizeTarget<TRegistered>, GridTimedDragTarget<TRegistered>, GridTimedResizeTarget<TRegistered>, GridInteractionTarget<TRegistered>, GridResolvedEventTarget<TRegistered>.
- Fully shared, no generic needed (identical in both views): GridAllDayDragCommitResult, GridAllDayResizeCommitResult, GridTimedDragCommitResult, GridTimedResizeCommitResult, GridInteractionCommitResult, GridInteractionPointerOwnership.
- Generic visual union: GridInteractionVisual<TColumnKey>.
- Per-view files keep their existing names and re-export aliases (WeekAllDayDragTarget = GridAllDayDragTarget<WeekRegisteredEventTarget>, etc.) so all 25 external import sites are untouched. Week retains WeekInteractionRuntime/WeekInteractionAdapterOptions/WeekInteractionAdapter (incl. rebuildLayoutAfterNavigation and WeekEdgeNavigableVisual); Day retains its own options/runtime/adapter.

Type-flow chain - correct:
GridLayoutCacheOptions.visibleDates -> DayColumnCache.date -> (math/timed.drag.ts and math/all-day.drag.ts write `dayDate: nextColumn?.date ?? visual.dayDate`) -> TimedDragVisual.dayDate/initialDayDate and AllDayDragVisual.dayDate/initialDayDate -> Week commit (date math) / Day commit (columnMoveCalendarId -> CalendarId).
Declarations to change: layout.cache.ts (GridLayoutCacheOptions, DayColumnCache, GridLayoutCache, BuildDayColumnsInput, buildTimedGridLayoutCache, buildAllDayGridLayoutCache, buildDragGridLayoutCache, buildDayColumns, getNearestDayColumn); types/timed-drag.types.ts; types/all-day-drag.types.ts; grid/interaction/commit/cross-row.commit.ts (pin to the date-keyed type); Day adapter/commit/timed.commit.ts (columnMoveCalendarId signature).

Step order - correct: Step 1 FR-1 column-key parameterization (prerequisite, Medium risk) -> Step 2 FR-2 shared adapter types + re-export aliases (Low risk, pure type aliases) -> Step 3 FR-5 layout cache consolidation (Low) -> Step 4 FR-4 adapter lifecycle helpers into grid/interaction/adapter.helpers.ts (Low) -> Step 5 FR-3 Day adapter decomposition into interactions/{all-day.drag,all-day.resize,timed.drag,timed.resize}.ts (Medium) -> Step 6 FR-6 coordinator lifecycle hook extraction (Medium).

Verification per step: bun run type-check (exit 0, no any-casts/suppressions); bun run lint (Biome, exit 0); interaction-subset tests; then bun run test:web (baseline 2298 pass / 0 fail) before declaring a step done.

INV mapping - reuse existing tests where they exist: INV-1 grid/interaction math tests; INV-2 Week timed-resize and all-day-resize adapter tests; INV-3 the two coordinator tests; INV-4 week-interaction.timed-drag.test.ts; INV-5/6/7 day-interaction.adapter.test.ts; INV-8 interaction.engine.test.ts; INV-9 the week/day targeting tests; INV-10 Week cross-row-drag / edge-navigation coverage. NOTE: verify each named test file actually exists before asserting it covers the invariant; where none exists, say NEW ASSERTION NEEDED and name the file it should go in.

Not-doing list - correct: no commit/*.commit.ts merge; no interaction.engine.ts change; no registry/targeting collapse; no cross-package edits; no act() warning fixes.
```
### Acceptance criteria
- Response is exactly one JSON object with the single key change_plan_markdown
- D-1 reuses the repo's Zod .brand<>() types (DateOnly, CalendarId) rather than inventing an optional-property brand
- D-1 explains why assignability genuinely fails, citing the required (not optional) brand property
- D-1 names the exact parse/cast boundary where plain strings become branded keys, per view, and states whether it falls inside the run's allowlist
- Any required edit outside the allowlist is flagged as a BLOCKER, not planned as a step
- Sections 2-7 reproduce the sound content from attempt 1
- No files written and no shell commands executed
### Your final message
Your final message must be a single JSON object and nothing else — no
prose before it, no summary after it, no ``` fence around it. It must
conform to this schema:

```json
{
  "type": "object",
  "properties": {
    "change_plan_markdown": {
      "type": "string"
    }
  },
  "required": [
    "change_plan_markdown"
  ]
}
```