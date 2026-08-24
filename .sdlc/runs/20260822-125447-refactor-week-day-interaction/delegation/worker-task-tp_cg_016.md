## Task tp_cg_016 — codegen / existing_file_edit
Module: types
### Working directory
You are running as an agent inside `/home/sainadh/projects/compass-calendar/compass/compass-calendar`. You may list, read,
edit and create files there, and run commands there. That directory is the
only place you can act; nothing outside it is reachable.
### Instruction
REWRITE packages/web/src/views/Week/interaction/adapter/week-interaction.adapter.types.ts so the duplicated declarations become thin aliases over the new shared generics in `@web/grid/interaction/types/adapter.types`, parameterized with `WeekRegisteredEventTarget` and `DateColumnKey`. CRITICAL: every name currently exported MUST still be exported under the SAME name - 19 files import from here and none of them may need editing. Replace with aliases: WeekInteractionPointerOwnership = GridInteractionPointerOwnership; WeekAllDayDragTarget = GridAllDayDragTarget<WeekRegisteredEventTarget>; WeekAllDayResizeTarget = GridAllDayResizeTarget<WeekRegisteredEventTarget>; WeekTimedDragTarget = GridTimedDragTarget<WeekRegisteredEventTarget>; WeekTimedResizeTarget = GridTimedResizeTarget<WeekRegisteredEventTarget>; WeekInteractionTarget = GridInteractionTarget<WeekRegisteredEventTarget>; WeekResolvedEventTarget = GridResolvedEventTarget<WeekRegisteredEventTarget>; the four CommitResults = the four Grid*CommitResult; WeekInteractionCommitResult = GridInteractionCommitResult; WeekInteractionVisual = GridInteractionVisual<DateColumnKey>; WeekEdgeNavigableVisual = AllDayDragVisual<DateColumnKey> | TimedDragVisual<DateColumnKey>. KEEP these three Week-only interfaces declared in full, exactly as they are today: WeekInteractionAdapterOptions (engineOptions, getLayoutSources -> WeekLayoutCacheSources, runtime), WeekInteractionRuntime (all members incl. getVisibleDays, onRequestWeekNavigation, onMotionActivation and every onCommit* callback with their existing result types), and WeekInteractionAdapter (all 8 members incl. rebuildLayoutAfterNavigation). Drop imports that become unused, keep the ones still needed. EFFICIENCY RULE: do NOT run tests, type-check, build or lint. Touch NO other file. Do NOT run git, rm, mv, or any cleanup command.
### Provided excerpts
These are extracts, not whole files. The paths are real — open them in the
working directory when you need more than the excerpt shows.

#### packages/web/src/views/Week/interaction/adapter/week-interaction.adapter.types.ts
_Included because: The file to rewrite. Open it in the working directory for the exact current text of the three Week-only interfaces, which must survive unchanged._

```
// Week-only interfaces that MUST be kept verbatim:
export interface WeekInteractionAdapterOptions {
  engineOptions?: InteractionEngineSchedulerOptions;
  getLayoutSources?: () => WeekLayoutCacheSources;
  runtime?: () => WeekInteractionRuntime;
}

export interface WeekInteractionRuntime {
  getAllDayEventById?: (eventId: string) => GridEvent | null;
  getTimedEventById(eventId: string): GridEvent | null;
  /**
   * Local YYYY-MM-DD dates of the rendered day columns, in window order.
   * Sourced from the same React render that painted the columns so drag
   * geometry and drop dates always agree with what is on screen.
   */
  getVisibleDays(): string[];
  isFormOpen?: () => boolean;
  onClickAllDayEvent?: (event: GridEvent) => void;
  onClickTimedEvent: (event: GridEvent) => void;
  onCommitAllDayDrag?: (result: WeekAllDayDragCommitResult) => void;
  onCommitAllDayResize?: (result: WeekAllDayResizeCommitResult) => void;
  onCommitTimedDrag: (result: WeekTimedDragCommitResult) => void;
  onCommitTimedResize?: (result: WeekTimedResizeCommitResult) => void;
  onMotionActivation?: (target: WeekInteractionTarget) => void;
  onRequestWeekNavigation?: (direction: "next" | "prev") => void;
}

export interface WeekInteractionAdapter {
  cancel(): void;
  connectCancellationEvents(targets?: InteractionCancellationTargets): () => void;
  handlePointerCancel(event: PointerEvent): boolean;
  handlePointerDown(event: PointerEvent): WeekInteractionPointerOwnership;
  handlePointerMove(event: PointerEvent): boolean;
  handlePointerUp(event: PointerEvent): boolean;
  ownsPointer(event: Pick<PointerEvent, "pointerId">): boolean;
  rebuildLayoutAfterNavigation(): void;
}

// Everything else in the file becomes an alias. Existing imports include:
// import { type WeekRegisteredEventTarget } from "../registry/week-event.registry";
// import { type WeekLayoutCacheSources } from "./geometry/week-layout.cache";
// import { type InteractionCancellationTargets, type InteractionEngineSchedulerOptions } from "@web/interaction/interaction.engine";
```

#### packages/web/src/grid/interaction/types/adapter.types.ts
_Included because: The shared generics just created - alias over these._

```
export interface GridInteractionPointerOwnership { reason: string; shouldOwn: boolean; }
export interface GridAllDayDragTarget<TRegistered> { event: GridEvent; hadFormOpenBeforeInteraction: boolean; registered: TRegistered; type: "allDayDrag"; }
export interface GridAllDayResizeTarget<TRegistered> { edge: AllDayResizeEdge; event: GridEvent; hadFormOpenBeforeInteraction: boolean; registered: TRegistered; type: "allDayResize"; }
export interface GridTimedDragTarget<TRegistered> { event: GridEvent; hadFormOpenBeforeInteraction: boolean; registered: TRegistered; type: "timedDrag"; }
export interface GridTimedResizeTarget<TRegistered> { edge: TimedResizeEdge; event: GridEvent; hadFormOpenBeforeInteraction: boolean; registered: TRegistered; type: "timedResize"; }
export type GridInteractionTarget<TRegistered> = ...;
export type GridResolvedEventTarget<TRegistered> = { event: GridEvent; hadFormOpenBeforeInteraction: boolean; registered: TRegistered; };
export interface GridAllDayDragCommitResult { ... type: "allDayDragEnd"; }
export interface GridAllDayResizeCommitResult { ... type: "allDayResizeEnd"; }
export interface GridTimedDragCommitResult { ... type: "timedDragEnd"; }
export interface GridTimedResizeCommitResult { ... type: "timedResizeEnd"; }
export type GridInteractionCommitResult = ...;
export type GridInteractionVisual<TColumnKey = string> = AllDayDragVisual<TColumnKey> | AllDayResizeVisual | TimedDragVisual<TColumnKey> | TimedResizeVisual;
```
### Acceptance criteria
- Every name previously exported is still exported under the same name
- Targets/commit results/visual union are aliases over the shared generics at WeekRegisteredEventTarget and DateColumnKey
- WeekInteractionAdapterOptions, WeekInteractionRuntime and WeekInteractionAdapter are declared in full and unchanged in behavior
- WeekEdgeNavigableVisual uses DateColumnKey
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