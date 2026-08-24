## Task tp_cg_015 — codegen / new_file_add
Module: types
### Working directory
You are running as an agent inside `/home/sainadh/projects/compass-calendar/compass/compass-calendar`. You may list, read,
edit and create files there, and run commands there. That directory is the
only place you can act; nothing outside it is reachable.
### Instruction
CREATE packages/web/src/grid/interaction/types/adapter.types.ts - the shared adapter contracts that Week and Day currently duplicate. Write it to disk. Types only, zero runtime output. Copy the shapes EXACTLY from the two existing per-view files (provided); do not invent or rename fields. Contents: (a) `GridInteractionPointerOwnership { reason: string; shouldOwn: boolean }`. (b) Four Target interfaces generic over TRegistered, each with `event: GridEvent; hadFormOpenBeforeInteraction: boolean; registered: TRegistered; type: <literal>`: GridAllDayDragTarget (type "allDayDrag"), GridAllDayResizeTarget (type "allDayResize", PLUS `edge: AllDayResizeEdge`), GridTimedDragTarget (type "timedDrag"), GridTimedResizeTarget (type "timedResize", PLUS `edge: TimedResizeEdge`). (c) `GridInteractionTarget<TRegistered>` union of those four. (d) `GridResolvedEventTarget<TRegistered> = { event: GridEvent; hadFormOpenBeforeInteraction: boolean; registered: TRegistered }`. (e) Four CommitResult interfaces with NO generic, each `event: GridEvent; eventId: string; hadFormOpenBeforeInteraction: boolean; hasMoved: boolean; type: <literal>` where the literals are "allDayDragEnd", "allDayResizeEnd", "timedDragEnd", "timedResizeEnd". (f) `GridInteractionCommitResult` union of those four. (g) `GridInteractionVisual<TColumnKey = string> = AllDayDragVisual<TColumnKey> | AllDayResizeVisual | TimedDragVisual<TColumnKey> | TimedResizeVisual`. Discriminant literals are camelCase EXACTLY as written above. Import GridEvent from @web/common/types/web.event.types and the visual/edge types from the sibling files in this same directory using relative paths. Add a short file-header comment explaining that Week and Day previously hand-rolled identical copies of these and this is now the single source. EFFICIENCY RULE: do NOT run tests, type-check, build or lint. Touch NO other file. Do NOT run git, rm, mv, or any cleanup command.
### Provided excerpts
These are extracts, not whole files. The paths are real — open them in the
working directory when you need more than the excerpt shows.

#### packages/web/src/views/Week/interaction/adapter/week-interaction.adapter.types.ts
_Included because: Source of truth for the exact shapes. The ONLY view-specific part is `registered: WeekRegisteredEventTarget`._

```
export interface WeekInteractionPointerOwnership { reason: string; shouldOwn: boolean; }

export interface WeekAllDayDragCommitResult { event: GridEvent; eventId: string; hadFormOpenBeforeInteraction: boolean; hasMoved: boolean; type: "allDayDragEnd"; }
export interface WeekAllDayDragTarget { event: GridEvent; hadFormOpenBeforeInteraction: boolean; registered: WeekRegisteredEventTarget; type: "allDayDrag"; }
export interface WeekAllDayResizeCommitResult { event: GridEvent; eventId: string; hadFormOpenBeforeInteraction: boolean; hasMoved: boolean; type: "allDayResizeEnd"; }
export interface WeekAllDayResizeTarget { edge: AllDayResizeEdge; event: GridEvent; hadFormOpenBeforeInteraction: boolean; registered: WeekRegisteredEventTarget; type: "allDayResize"; }
export interface WeekTimedDragCommitResult { event: GridEvent; eventId: string; hadFormOpenBeforeInteraction: boolean; hasMoved: boolean; type: "timedDragEnd"; }
export interface WeekTimedDragTarget { event: GridEvent; hadFormOpenBeforeInteraction: boolean; registered: WeekRegisteredEventTarget; type: "timedDrag"; }
export interface WeekTimedResizeCommitResult { event: GridEvent; eventId: string; hadFormOpenBeforeInteraction: boolean; hasMoved: boolean; type: "timedResizeEnd"; }
export interface WeekTimedResizeTarget { edge: TimedResizeEdge; event: GridEvent; hadFormOpenBeforeInteraction: boolean; registered: WeekRegisteredEventTarget; type: "timedResize"; }

export type WeekInteractionTarget = WeekAllDayDragTarget | WeekAllDayResizeTarget | WeekTimedDragTarget | WeekTimedResizeTarget;
export type WeekInteractionVisual = AllDayDragVisual | AllDayResizeVisual | TimedDragVisual | TimedResizeVisual;
export type WeekInteractionCommitResult = WeekAllDayDragCommitResult | WeekAllDayResizeCommitResult | WeekTimedDragCommitResult | WeekTimedResizeCommitResult;
export type WeekResolvedEventTarget = { event: GridEvent; hadFormOpenBeforeInteraction: boolean; registered: WeekRegisteredEventTarget; };

// imports used:
// import { type GridEvent } from "@web/common/types/web.event.types";
// import { type AllDayDragVisual } from "@web/grid/interaction/types/all-day-drag.types";
// import { type AllDayResizeEdge, type AllDayResizeVisual } from "@web/grid/interaction/types/all-day-resize.types";
// import { type TimedDragVisual } from "@web/grid/interaction/types/timed-drag.types";
// import { type TimedResizeEdge, type TimedResizeVisual } from "@web/grid/interaction/types/timed-resize.types";
```

#### packages/web/src/views/Day/interaction/adapter/day-interaction.adapter.types.ts
_Included because: Confirms the Day copies are structurally identical apart from `registered: DayRegisteredEventTarget` - which is why TRegistered is the only generic the Targets need._

```
export interface DayInteractionPointerOwnership { reason: string; shouldOwn: boolean; }
export interface DayAllDayDragTarget { event: GridEvent; hadFormOpenBeforeInteraction: boolean; registered: DayRegisteredEventTarget; type: "allDayDrag"; }
export interface DayTimedDragCommitResult { event: GridEvent; eventId: string; hadFormOpenBeforeInteraction: boolean; hasMoved: boolean; type: "timedDragEnd"; }
// ...identical to Week's apart from the registered type.
```
### Acceptance criteria
- File created at packages/web/src/grid/interaction/types/adapter.types.ts
- Four Target interfaces generic over TRegistered with camelCase discriminants and edge on the two resize targets
- Four CommitResult interfaces with no generic and the ...End discriminants
- GridInteractionVisual<TColumnKey = string> parameterizes only the two drag visuals
- Types only - no runtime output
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