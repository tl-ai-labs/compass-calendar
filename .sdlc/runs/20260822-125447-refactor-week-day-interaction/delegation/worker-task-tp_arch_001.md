## Task tp_arch_001 — architecture_design / delta_refactor_plan
Module: week-day-interaction
### Working directory
You are running as an agent inside `/home/sainadh/projects/compass-calendar/compass/compass-calendar`. You may list, read,
edit and create files there, and run commands there. That directory is the
only place you can act; nothing outside it is reachable.
### Instruction
Produce a DELTA REFACTOR PLAN (markdown) for change_plan.md. This is a structural refactor of an existing Bun+React+TS codebase - not a greenfield design. Sections, in order: (1) Decision D-1: column-key type design - RESOLVE the three open questions from requirements section 8, choosing between a generic TimedDragVisual<TColumnKey> vs a branded/tagged union, and JUSTIFY against the two hard constraints in the evidence below (Day's runtime fallback union; the shared cross-row code that dayjs-parses the key). State the exact TypeScript declarations you are proposing. (2) Decision D-2: where shared adapter types live and how the per-view aliases are re-exported so the 25 external import sites do not change. (3) Type-flow analysis: trace the column key through visibleDates -> DayColumnCache.date -> visual.dayDate and state every declaration that must change. (4) Sequenced work plan: ordered steps, each naming exact file paths, each independently type-checkable, with FR-1 strictly before the types merge. Mark each step's risk. (5) Invariant test strategy: for each INV-1..INV-10 name the existing test file that already covers it or the new assertion needed - prefer existing coverage, this is a refactor. (6) Rollback/verification points: which command to run after each step. (7) Explicitly-not-doing list. Be concrete and file-specific; no generic advice. Do NOT write any files. Do NOT run any shell commands - especially never git checkout, git restore, git clean, rm, mv, or any cleanup command. Return the document as a single markdown string in the JSON field change_plan_markdown.
### Provided excerpts
These are extracts, not whole files. The paths are real — open them in the
working directory when you need more than the excerpt shows.

#### .sdlc/runs/20260822-125447-refactor-week-day-interaction/requirements.md
_Included because: Approved requirements. FR-1 is the prerequisite; section 8's three open questions were explicitly delegated to this phase to resolve._

```
FR-1 (Prerequisite): Disambiguate TimedDragVisual.dayDate with Branded/Parameterized Types - replace the overloaded string type for dayDate and initialDayDate with a branded or view-parameterized type; update columnMoveCalendarId and call sites so cross-assignment is a compile-time error.
FR-2: Merge structural types between week-interaction.adapter.types.ts and day-interaction.adapter.types.ts into shared generic types in grid/interaction/types/.
FR-3: Decompose day-interaction.adapter.ts into modular interaction handlers matching Week's adapter/interactions/* structure.
FR-4: Extract common adapter lifecycle routines (target resolution, draft mounting, cancellation handling) into grid/interaction/.
FR-5: Consolidate week-layout.cache.ts and day-layout.cache.ts over grid/interaction/layout.cache.ts, parameterizing view-specific edge thresholds.
FR-6: Extract common coordinator hooks/pointer lifecycle/draft sync between WeekInteractionCoordinator.tsx and DayInteractionCoordinator.tsx, keeping view-specific extensions isolated.

INVARIANTS: INV-1 drag visuals/snapping/constraints identical. INV-2 resize boundaries identical. INV-3 keyboard nav, focus, Escape cancellation, post-undo focus restore identical. INV-4 Week columns=days: column move computes a day delta on startDate/endDate, preserves calendarId. INV-5 Day columns=calendars: column move updates calendarId, preserves date bounds. INV-6 Day all-day drag must NEVER rewrite startDate/endDate (would truncate multi-day all-day events). INV-7 Day timed drag pins date to visibleDate and reassigns calendarId via columnMoveCalendarId without altering duration. INV-8 updateVisual idempotence (engine re-invokes at pointerup before commit). INV-9 data-${view}-interaction-event-* attribute scheme and readCalendarEventIdFromElement/CALENDAR_VIEW_INTERACTION_ID_ATTRIBUTES unchanged. INV-10 Week edge navigation + rebuildLayoutAfterNavigation keeps working without resetting drag visual state.

NFR-2 bun run type-check (TS 7.0.2) exits 0 with no any-casts or suppressions. NFR-3 bun run lint (Biome) exits 0. NFR-4 changes confined to packages/web/** plus .gitignore. NFR-5 public signatures and DOM attribute schemas stable.

OUT OF SCOPE: do not merge commit/*.commit.ts (Week day-deltas vs Day calendar-reassignment are divergent by design); do not collapse the already-unified registry/targeting shims; no cross-package edits; do not modify interaction.engine.ts; do not fix pre-existing act() warnings in DayInteractionCoordinator.test.tsx.

OPEN QUESTIONS DELEGATED TO THIS PHASE: (Q1) generic TimedDragVisual<TColumnKey> vs explicit branded types DateColumnKey/CalendarColumnKey? (Q2) Day decomposed modules under views/Day/interaction/adapter/interactions/ mirroring Week, or hoisted into grid/interaction/adapter/? (Q3) shared adapter types at grid/interaction/types/adapter.types.ts or grid/interaction/adapter.types.ts alongside adapter.helpers.ts?
```

#### EVIDENCE-column-key-overload.md
_Included because: Orchestrator's own source census of the dayDate overload. These two findings are hard constraints on D-1 and are not in the requirements doc._

```
=== FINDING 1: the overload is 3 layers deep, not 1 ===
The column key threads through THREE shared declarations, all currently `string`, all documented as dates:

1. grid/interaction/layout.cache.ts:
   export interface GridLayoutCacheOptions { ... /** Local YYYY-MM-DD dates of the rendered day columns, in window order. */ visibleDates: string[]; }
   export interface DayColumnCache { /** Local YYYY-MM-DD date this column renders. */ date: string; index: number; left: number; width: number; }
2. grid/interaction/types/timed-drag.types.ts:
   export interface TimedDragVisual { ... dayDate: string; /** Local YYYY-MM-DD date of the source column at drag start. */ initialDayDate: string; dayIndex: number; initialDayIndex: number; ... }
   (all-day-drag.types.ts has the same dayDate: string, its comment says 'Column key semantics match TimedDragVisual.dayDate')
3. grid/interaction/math/timed.drag.ts and math/all-day.drag.ts write the key back from the layout column:
   dayDate: nextColumn?.date ?? visual.dayDate
   dayDate: placement.column?.date ?? visual.dayDate

Day view passes CALENDAR IDS into the parameter named `visibleDates`, which land in DayColumnCache.date, which the shared math copies into visual.dayDate. So the mis-naming and the overload run the full depth of the shared layer.

=== FINDING 2 (DECISIVE): in Day, the column key is a RUNTIME UNION, not a per-view constant ===
day-interaction.adapter.ts lines 254-263:
  const calendarColumnKeys = isDayDragTarget(target) ? getColumnKeys() : [];
  const eventColumnIndex = calendarColumnKeys.indexOf(target.event.calendarId ?? "");
  const columnKeys = eventColumnIndex >= 0 ? calendarColumnKeys : [visibleDateKey];
  const initialColumnIndex = Math.max(0, eventColumnIndex);
  const initialColumnKey = columnKeys[initialColumnIndex]!;
and the confirming comment in Day commit/timed.commit.ts:
  'Day-view drag column keys are calendar ids (see createVisual), so a drop on a different column is a cross-calendar move. Same-column drops (and THE SINGLE-COLUMN FALLBACK, WHOSE ONE KEY IS A DATE STRING that never changes) keep the event's own calendarId.'

So Day's key set is EITHER calendar ids OR a one-element array holding a DATE string, chosen per-interaction at runtime (the fallback fires for resizes, and for a drag whose event's calendar is not among the rendered columns). A naive per-view brand - Week=DateColumnKey, Day=CalendarColumnKey - is therefore WRONG and would misdescribe the fallback path. Note the existing cast is safe only by construction: in the fallback there is exactly one key, so `visual.dayDate !== visual.initialDayDate` can never be true, so `visual.dayDate as CalendarId` is unreachable there. Your D-1 must make that safety provable rather than incidental, and must state what happens on the fallback path.

Current Day cast to be replaced (Day adapter/commit/timed.commit.ts):
  export const columnMoveCalendarId = (visual: Pick<TimedDragVisual, "dayDate" | "initialDayDate">, event: GridEvent): CalendarId | undefined =>
    visual.dayDate !== visual.initialDayDate ? (visual.dayDate as CalendarId) : event.calendarId;

=== FINDING 3: cross-row commit is Week-only and DOES dayjs-parse the key ===
grid/interaction/commit/cross-row.commit.ts does `dayjs(visual.dayDate).startOf("day")` and `dayjs(visual.dayDate)`. It is imported ONLY by Week (adapter/interactions/timed.drag.ts and all-day.drag.ts). Day never reaches it, so this is LATENT, not a live bug. But it is shared-layer code that assumes date semantics, so any widening of grid/interaction/ to cover the adapter boundary must keep cross-row unreachable from calendar-keyed views. A well-chosen D-1 type should make that a compile-time guarantee rather than a convention.

=== FINDING 4: the two adapter.types.ts differ by ONE type parameter plus view-only members ===
Every Target and CommitResult interface is structurally identical across the two files; the ONLY difference is `registered: WeekRegisteredEventTarget` vs `registered: DayRegisteredEventTarget`. The four CommitResult interfaces (allDayDragEnd, allDayResizeEnd, timedDragEnd, timedResizeEnd) have NO view-specific member at all - each is { event: GridEvent; eventId: string; hadFormOpenBeforeInteraction: boolean; hasMoved: boolean; type: <literal> }. The Visual union is identical in both files. So the merge is: generic over TRegistered for the four Target interfaces, fully shared for the four CommitResult interfaces and the Visual union.

View-only members that must NOT be forced into the shared shape:
- Week Runtime only: getVisibleDays(): string[]; onRequestWeekNavigation?: (direction: "next"|"prev") => void
- Week Options only: getLayoutSources?: () => WeekLayoutCacheSources
- Week adapter interface only: rebuildLayoutAfterNavigation(): void
- Week type only: WeekEdgeNavigableVisual = AllDayDragVisual | TimedDragVisual
- Day Options only: getColumnKeys?: () => string[]; getVisibleDate?: () => Dayjs; getLayoutSources?: () => GridLayoutCacheSources
- Day only: imports Dayjs from @core/util/date/dayjs
Both adapters otherwise share an identical 8-member interface (cancel, connectCancellationEvents, handlePointerCancel, handlePointerDown, handlePointerMove, handlePointerUp, ownsPointer) - Week adds the 8th, rebuildLayoutAfterNavigation.
Note Day's geometry cache already aliases the shared types verbatim: `export type DayLayoutCache = GridLayoutCache; export type DayLayoutCacheSources = GridLayoutCacheSources;`

=== The shared engine contract (packages/web/src/interaction/interaction.adapter.types.ts, 51 LOC, DO NOT restructure) ===
export interface InteractionAdapter<TTarget, TVisual, TResult> { getTarget(event: PointerEvent): TTarget | null; getSourceElement(target: TTarget): HTMLElement; getSourceElementDraftEventMode?(target: TTarget): SourceElementDraftEventMode; createVisual(input: {pointerStart: InteractionPoint; sourceElement: HTMLElement; target: TTarget}): TVisual | null; getDraftEventMount(input: {sourceElement: HTMLElement; target: TTarget; visual: TVisual}): FloatingDraftEventMount; updateVisual(input: {pointer: InteractionPoint; target: TTarget; timestamp: number; visual: TVisual}): {draftEvent: FloatingDraftEventUpdate; shouldContinue?: boolean; visual: TVisual}; commit(input: {target: TTarget; visual: TVisual}): TResult; cancel?(input: {target: TTarget; visual?: TVisual}): void; }

=== BLAST RADIUS ===
19 files import views/Week/interaction, 6 import views/Day/interaction, contextMenuLayering.test.tsx imports both. 24 files reference dayDate. Baseline: bun run test:web = 2298 pass / 0 fail (302 files, 86.5s); interaction subset 159/159 (3.6s). Path aliases @web/* and @core/*. Biome for lint/format. TS pinned 7.0.2.
```
### Acceptance criteria
- D-1 picks one column-key design, gives exact TypeScript declarations, and explicitly handles Day's single-column date-string fallback path
- D-1 states whether cross-row commit becomes statically unreachable from calendar-keyed views
- Type-flow section names GridLayoutCacheOptions.visibleDates, DayColumnCache.date, TimedDragVisual.dayDate/initialDayDate and AllDayDragVisual.dayDate
- Work plan is ordered, file-specific, FR-1 strictly before the types merge, each step independently type-checkable
- Every INV-1..INV-10 is mapped to an existing test file or a named new assertion
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