## Task tp_cg_017 — codegen / existing_file_edit
Module: types
### Working directory
You are running as an agent inside `/home/sainadh/projects/compass-calendar/compass/compass-calendar`. You may list, read,
edit and create files there, and run commands there. That directory is the
only place you can act; nothing outside it is reachable.
### Instruction
REWRITE packages/web/src/views/Day/interaction/adapter/day-interaction.adapter.types.ts as thin aliases over the shared generics in `@web/grid/interaction/types/adapter.types`, parameterized with `DayRegisteredEventTarget` and `DayColumnKey`. This mirrors exactly what was just done to the Week sibling file - follow that shape. CRITICAL: every name currently exported MUST still be exported under the SAME name; 6 files import from here and none may need editing. Aliases: DayInteractionPointerOwnership = GridInteractionPointerOwnership; DayAllDayDragTarget/DayAllDayResizeTarget/DayTimedDragTarget/DayTimedResizeTarget = the matching Grid*Target<DayRegisteredEventTarget>; DayInteractionTarget = GridInteractionTarget<DayRegisteredEventTarget>; DayResolvedEventTarget = GridResolvedEventTarget<DayRegisteredEventTarget>; the four CommitResults = the four Grid*CommitResult; DayInteractionCommitResult = GridInteractionCommitResult; DayInteractionVisual = GridInteractionVisual<DayColumnKey>. KEEP these three Day-only interfaces declared in full exactly as today: DayInteractionAdapterOptions (engineOptions, getColumnKeys WITH its existing doc comment about per-calendar column keys, getLayoutSources -> GridLayoutCacheSources, getVisibleDate -> Dayjs, runtime), DayInteractionRuntime (all members and every onCommit* callback), and DayInteractionAdapter (its 7 members - Day has NO rebuildLayoutAfterNavigation, do not add one). Keep the Dayjs import. Drop imports that become unused. EFFICIENCY RULE: do NOT run tests, type-check, build or lint. Touch NO other file. Do NOT run git, rm, mv, or any cleanup command.
### Provided excerpts
These are extracts, not whole files. The paths are real — open them in the
working directory when you need more than the excerpt shows.

#### packages/web/src/views/Day/interaction/adapter/day-interaction.adapter.types.ts
_Included because: The file to rewrite. Open it for the exact current text of the three Day-only interfaces._

```
// Day-only interfaces that MUST be kept verbatim:
export interface DayInteractionAdapterOptions {
  engineOptions?: InteractionEngineSchedulerOptions;
  /**
   * Ordered keys of the rendered per-calendar columns (calendar ids, one per
   * displayed calendar). Drags hit-test against these so an event can be
   * dropped on another calendar's column; empty means a single dateless
   * column (no calendar columns rendered), which disables cross-column
   * movement.
   */
  getColumnKeys?: () => string[];
  getLayoutSources?: () => GridLayoutCacheSources;
  getVisibleDate?: () => Dayjs;
  runtime?: () => DayInteractionRuntime;
}

export interface DayInteractionRuntime {
  getAllDayEventById?: (eventId: string) => GridEvent | null;
  getTimedEventById(eventId: string): GridEvent | null;
  isFormOpen?: () => boolean;
  onClickAllDayEvent?: (event: GridEvent) => void;
  onClickTimedEvent: (event: GridEvent) => void;
  onCommitAllDayDrag?: (result: DayAllDayDragCommitResult) => void;
  onCommitAllDayResize?: (result: DayAllDayResizeCommitResult) => void;
  onCommitTimedDrag: (result: DayTimedDragCommitResult) => void;
  onCommitTimedResize?: (result: DayTimedResizeCommitResult) => void;
  onMotionActivation?: (target: DayInteractionTarget) => void;
}

export interface DayInteractionAdapter {
  cancel(): void;
  connectCancellationEvents(targets?: InteractionCancellationTargets): () => void;
  handlePointerCancel(event: PointerEvent): boolean;
  handlePointerDown(event: PointerEvent): DayInteractionPointerOwnership;
  handlePointerMove(event: PointerEvent): boolean;
  handlePointerUp(event: PointerEvent): boolean;
  ownsPointer(event: Pick<PointerEvent, "pointerId">): boolean;
}

// existing imports include:
// import { type Dayjs } from "@core/util/date/dayjs";
// import { type GridLayoutCacheSources } from "@web/grid/interaction/layout.cache";
// import { type DayRegisteredEventTarget } from "../registry/day-event.registry";
```

#### packages/web/src/views/Week/interaction/adapter/week-interaction.adapter.types.ts
_Included because: The sibling file just rewritten - copy this exact alias style._

```
export type WeekInteractionPointerOwnership = GridInteractionPointerOwnership;
export type WeekAllDayDragCommitResult = GridAllDayDragCommitResult;
export type WeekAllDayDragTarget = GridAllDayDragTarget<WeekRegisteredEventTarget>;
export type WeekInteractionTarget = GridInteractionTarget<WeekRegisteredEventTarget>;
export type WeekInteractionVisual = GridInteractionVisual<DateColumnKey>;
export type WeekInteractionCommitResult = GridInteractionCommitResult;
export type WeekResolvedEventTarget = GridResolvedEventTarget<WeekRegisteredEventTarget>;
// ...plus the three Week-only interfaces declared in full.
```
### Acceptance criteria
- Every name previously exported is still exported under the same name
- Targets/commit results/visual union alias the shared generics at DayRegisteredEventTarget and DayColumnKey
- DayInteractionAdapterOptions, DayInteractionRuntime, DayInteractionAdapter declared in full and unchanged
- getColumnKeys keeps its doc comment; DayInteractionAdapter still has exactly 7 members with no rebuildLayoutAfterNavigation
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