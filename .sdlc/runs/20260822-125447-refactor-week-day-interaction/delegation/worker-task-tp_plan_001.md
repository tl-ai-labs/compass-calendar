## Task tp_plan_001 — plan_task_packets / decomposition
Module: week-day-interaction
### Working directory
You are running as an agent inside `/home/sainadh/projects/compass-calendar/compass/compass-calendar`. You may list, read,
edit and create files there, and run commands there. That directory is the
only place you can act; nothing outside it is reachable.
### Instruction
Decompose the approved rev-2 refactor plan into an ordered array of TaskPackets, one per file-sized unit of work. Return ONE JSON object with a single key `packets` whose value is the array. Nothing before or after it.

Each packet object must have exactly these keys: id (tp_cg_NNN, sequential from tp_cg_001), phase (always "codegen"), task_type ("existing_file_edit" for a file that exists, "new_file_add" for a file being created), module (one of: types, layout, math, commit, adapter, geometry, config), instruction (imperative, under 200 words, naming the exact edit), artifact_path (repo-relative path), step (1-5, from the plan), depends_on (array of packet ids that must land first, [] for none), risk ("low"|"medium"), acceptance (array of testable bullets).

HARD RULES:
- artifact_path MUST come from the VERIFIED FILE INVENTORY input. Do NOT invent, guess, or infer any path. If a step needs a file not in the inventory, it is a NEW file and must be listed in the inventory's 'files to be created' section - only those two are creatable.
- Order the array so dependencies always precede dependents. Step 1 packets come before step 2, etc.
- Every packet edits exactly ONE file.
- Do NOT emit packets for test files - existing tests must pass unmodified, except the two new assertions listed in the plan input, which get their own packets at the end of step 1.
- Do NOT emit any packet for FR-3 or FR-6 - those are CUT from this run.

Do NOT write any files. Do NOT run any shell commands - especially never git checkout, git restore, git clean, rm, mv, or any cleanup command.
### Provided excerpts
These are extracts, not whole files. The paths are real — open them in the
working directory when you need more than the excerpt shows.

#### VERIFIED-FILE-INVENTORY.md
_Included because: The ONLY paths that may appear as artifact_path. Every one was confirmed to exist on disk at this LOC. Two additional files are to be created._

```
=== FILES THAT EXIST (artifact_path must be one of these, verbatim) ===
59   packages/web/src/grid/interaction/types/timed-drag.types.ts
45   packages/web/src/grid/interaction/types/all-day-drag.types.ts
218  packages/web/src/grid/interaction/layout.cache.ts
195  packages/web/src/grid/interaction/math/timed.drag.ts
97   packages/web/src/grid/interaction/math/all-day.drag.ts
53   packages/web/src/grid/interaction/commit/cross-row.commit.ts
11   packages/web/src/grid/interaction/commit/timed-moved.ts
100  packages/web/src/grid/interaction/adapter.helpers.ts
795  packages/web/src/views/Week/interaction/adapter/week-interaction.adapter.ts
149  packages/web/src/views/Week/interaction/adapter/week-interaction.adapter.types.ts
73   packages/web/src/views/Week/interaction/adapter/geometry/week-layout.cache.ts
65   packages/web/src/views/Week/interaction/adapter/commit/all-day.commit.ts
38   packages/web/src/views/Week/interaction/adapter/commit/timed.commit.ts
607  packages/web/src/views/Day/interaction/adapter/day-interaction.adapter.ts
149  packages/web/src/views/Day/interaction/adapter/day-interaction.adapter.types.ts
76   packages/web/src/views/Day/interaction/adapter/geometry/day-layout.cache.ts
100  packages/web/src/views/Day/interaction/adapter/commit/timed.commit.ts
35   .gitignore

=== FILES TO BE CREATED (task_type: new_file_add) ===
packages/web/src/grid/interaction/types/column-key.types.ts
packages/web/src/grid/interaction/types/adapter.types.ts

=== TEST FILES - DO NOT EMIT EDIT PACKETS, EXCEPT THE TWO NEW ASSERTIONS ===
packages/web/src/views/Day/interaction/adapter/day-interaction.adapter.test.ts  <- gets TWO new assertions (INV-6 multi-day all-day cross-calendar drag leaves startDate/endDate unchanged; INV-7 fallback path where the event's calendar is not among rendered columns). One packet, task_type existing_file_edit, module commit, at the END of step 1.
All other test files must pass UNMODIFIED.
```

#### .sdlc/runs/20260822-125447-refactor-week-day-interaction/change_plan.md
_Included because: The approved rev-2 plan: what each step does, in order._

```
STEP 1 (FR-1, risk medium) - column-key branding. Create types/column-key.types.ts declaring:
  import { type CalendarId, type DateOnly } from "@core/types/domain-primitives";
  export type DateColumnKey = DateOnly;
  export type DayColumnKey = CalendarId | DateOnly;
  export const asDateColumnKeys = (keys: string[]): DateColumnKey[] => keys as DateColumnKey[];
  export const asDayColumnKeys = (keys: string[]): DayColumnKey[] => keys as DayColumnKey[];
Then parameterize, each with a `= string` DEFAULT so intermediate states still compile:
  - types/timed-drag.types.ts: TimedDragVisual<TColumnKey = string>, fields dayDate and initialDayDate become TColumnKey.
  - types/all-day-drag.types.ts: AllDayDragVisual<TColumnKey = string>, same two fields.
  - layout.cache.ts: GridLayoutCacheOptions<TColumnKey = string> (visibleDates: TColumnKey[]), DayColumnCache<TColumnKey = string> (date: TColumnKey), GridLayoutCache<TColumnKey = string> (dayColumns, crossRow), and thread through the builder functions.
  - math/timed.drag.ts and math/all-day.drag.ts: thread TColumnKey through their input/result types; the line `dayDate: nextColumn?.date ?? visual.dayDate` must keep working.
  - commit/timed-moved.ts: generic over TColumnKey (it only compares keys for equality).
  - commit/cross-row.commit.ts: PIN both exports to the date-keyed type - allDayDragVisualToTimedGridEvent takes AllDayDragVisual<DateColumnKey>, timedDragVisualToAllDayGridEvent takes TimedDragVisual<DateColumnKey>. This is what makes Day visuals a compile error here.
  - week-interaction.adapter.ts: apply asDateColumnKeys at the boundary where getVisibleDays() is read before building the layout cache.
  - day-interaction.adapter.ts: apply asDayColumnKeys at the columnKeys construction (`const columnKeys = eventColumnIndex >= 0 ? calendarColumnKeys : [visibleDateKey];`).
  - Week commit files (commit/all-day.commit.ts, commit/timed.commit.ts): bind visual params to DateColumnKey. TYPE-ONLY, no logic change.
  - Day commit/timed.commit.ts: columnMoveCalendarId signature takes Pick<TimedDragVisual<DayColumnKey>, "dayDate"|"initialDayDate">. Keep the existing `as CalendarId` cast and its comment. TYPE-ONLY, no logic change.
  - THEN the two new test assertions in day-interaction.adapter.test.ts.

STEP 2 (FR-2, risk low) - shared adapter types, PURE TYPE ALIASES, zero runtime. Create types/adapter.types.ts with: GridInteractionPointerOwnership {reason: string; shouldOwn: boolean}; GridAllDayDragTarget<TRegistered>/GridAllDayResizeTarget<TRegistered>/GridTimedDragTarget<TRegistered>/GridTimedResizeTarget<TRegistered> each {event: GridEvent; hadFormOpenBeforeInteraction: boolean; registered: TRegistered; type: <literal>} plus `edge` on the two resize ones; discriminant literals are EXACTLY "allDayDrag", "allDayResize", "timedDrag", "timedResize" (camelCase); GridInteractionTarget<TRegistered> union; GridResolvedEventTarget<TRegistered>; the four CommitResult interfaces each {event: GridEvent; eventId: string; hadFormOpenBeforeInteraction: boolean; hasMoved: boolean; type: <literal>} with literals "allDayDragEnd", "allDayResizeEnd", "timedDragEnd", "timedResizeEnd"; GridInteractionCommitResult union; GridInteractionVisual<TColumnKey> union. Then rewrite week-interaction.adapter.types.ts and day-interaction.adapter.types.ts to re-export aliases over these generics, KEEPING every existing exported name so the 25 external import sites are untouched, and KEEPING each view's own Runtime/Options/Adapter interfaces verbatim (Week keeps getVisibleDays, onRequestWeekNavigation, rebuildLayoutAfterNavigation, WeekEdgeNavigableVisual; Day keeps getColumnKeys, getVisibleDate).

STEP 3 (FR-5, risk low) - geometry/week-layout.cache.ts and geometry/day-layout.cache.ts: consolidate over the now-generic shared builders, parameterizing the view-specific edge threshold. Day already aliases the shared types verbatim (export type DayLayoutCache = GridLayoutCache).

STEP 4 (FR-4, risk low-medium) - grid/interaction/adapter.helpers.ts: extract the common adapter lifecycle routines (target resolution, draft mounting, cancellation handling) that both adapters duplicate; then week-interaction.adapter.ts and day-interaction.adapter.ts consume them.

STEP 5 (risk low) - .gitignore: add `.sdlc/` and `.sdlc/backups/**`.

CUT FROM THIS RUN - emit NO packets: FR-3 (decomposing day-interaction.adapter.ts into adapter/interactions/*) and FR-6 (coordinator harmonization). Neither coordinator .tsx is touched.

VERIFY AFTER EVERY STEP: bun run type-check, bun run lint, bun run test:web (baseline 2298 pass / 0 fail).
```
### Acceptance criteria
- Response is exactly one JSON object with the single key packets
- Every artifact_path appears verbatim in the verified inventory or is one of the two creatable files
- Packets are ordered so dependencies precede dependents and step numbers are non-decreasing
- No packet targets FR-3 or FR-6 work
- No test file other than day-interaction.adapter.test.ts appears as an artifact_path
- Each packet edits exactly one file
### Your final message
Your final message must be a single JSON object and nothing else — no
prose before it, no summary after it, no ``` fence around it. It must
conform to this schema:

```json
{
  "type": "object",
  "properties": {
    "packets": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "id": {
            "type": "string"
          },
          "phase": {
            "type": "string"
          },
          "task_type": {
            "type": "string"
          },
          "module": {
            "type": "string"
          },
          "instruction": {
            "type": "string"
          },
          "artifact_path": {
            "type": "string"
          },
          "step": {
            "type": "number"
          },
          "depends_on": {
            "type": "array",
            "items": {
              "type": "string"
            }
          },
          "risk": {
            "type": "string"
          },
          "acceptance": {
            "type": "array",
            "items": {
              "type": "string"
            }
          }
        },
        "required": [
          "id",
          "phase",
          "task_type",
          "module",
          "instruction",
          "artifact_path",
          "step",
          "depends_on",
          "risk",
          "acceptance"
        ]
      }
    }
  },
  "required": [
    "packets"
  ]
}
```