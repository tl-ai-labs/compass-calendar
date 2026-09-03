## Task tp_cg_001 — codegen / frontend_util
Module: grid-allday-math
### Working directory
You are running as an agent inside `/home/sainadh/projects/compass-calendar/compass/compass-calendar`. You may list, read,
edit and create files there, and run commands there. That directory is the
only place you can act; nothing outside it is reachable.
### Instruction
Write TWO NEW files and MODIFY ONE existing file in the Compass Calendar repo (bun + TypeScript + React, biome-formatted).

1. CREATE packages/web/src/grid/interaction/math/all-day.create.ts - a PURE module (no React, no store, no DOM) exporting exactly: type AllDayDayRange, type ResolveAllDayDayRangeInput, resolveAllDayDayRange, isSameAllDayDayRange, hasExceededAllDayDragThreshold. Implement precisely the SPEC input below.

2. CREATE packages/web/src/grid/interaction/math/all-day.create.test.ts - implement EVERY row of the TEST TABLE input below as its own it() block.

3. MODIFY packages/web/src/interaction/interaction.constants.ts - APPEND the new constant and EXTEND the existing doc comment with a paragraph justifying a third threshold value. Do NOT change the values or meaning of the two existing thresholds.

Hard rules: dates are 'YYYY-MM-DD' strings end to end; compare them with plain lexicographic string comparison (NOT dayjs) for min/max so direction-agnosticism is structural; use dayjs ONLY for the +1 day exclusive-end arithmetic. Import dayjs from '@core/util/date/dayjs' and YEAR_MONTH_DAY_FORMAT from '@core/constants/date.constants'. In the test file the 'bun:test' import goes LAST, after all other imports (biome ordering). resolveAllDayDayRange must NEVER throw - it runs inside a mousemove handler. Write ONLY these three files.
### Provided excerpts
These are extracts, not whole files. The paths are real — open them in the
working directory when you need more than the excerpt shows.

#### packages/web/src/interaction/interaction.constants.ts
_Included because: FILE TO MODIFY - full current contents. Append the new constant; extend the doc comment. Leave existing values untouched._

```
/**
 * Shared gesture timings for grid interaction.
 *
 * `INTERACTION_MOVE_THRESHOLD_PX` (25) gates motion on an existing event/draft -
 * the pointer must clearly intend a drag before the card moves.
 * `TIMED_DRAFT_CREATE_MOVE_THRESHOLD_PX` (4) is intentionally tighter: on empty
 * grid it distinguishes a click-to-create from a drag-to-resize-duration. Do
 * not unify these values; they measure different products of the gesture.
 *
 * `INTERACTION_EDGE_THRESHOLD_PX` is the shared proximity band for Day/Week
 * smart-scroll and Week edge-navigation - same distance, different axes.
 */
export const INTERACTION_HOLD_DELAY_MS = 750;
export const INTERACTION_MOVE_THRESHOLD_PX = 25;
// Safety net while rAF waits for committed geometry. 500ms covers dense-week /
// series-projection commits that used to flash when the old 250ms deadline
// won the race; no-op commits may linger this long before the clone drops.
export const INTERACTION_COMMIT_TEARDOWN_DEADLINE_MS = 500;
export const INTERACTION_EDGE_THRESHOLD_PX = 50;
export const TIMED_DRAFT_CREATE_MOVE_THRESHOLD_PX = 4;

```

#### SPEC/all-day.create.ts (authoritative API + semantics)
_Included because: The exact signatures and semantics to implement. Do not deviate._

```
export interface AllDayDayRange {
  /** Inclusive first day, YYYY-MM-DD. */
  start: string;
  /** EXCLUSIVE last day, YYYY-MM-DD - feeds allDayGridSchedule directly. */
  end: string;
}

export interface ResolveAllDayDayRangeInput {
  /** The day the press landed on, YYYY-MM-DD. */
  anchorDate: string;
  /** The day under the pointer right now, YYYY-MM-DD. */
  pointerDate: string;
  /**
   * The rendered window, ascending YYYY-MM-DD. When supplied, both anchor and
   * pointer are clamped into [first, last] before normalisation. Omit to skip
   * clamping.
   */
  visibleDates?: readonly string[];
}

export const resolveAllDayDayRange = (input: ResolveAllDayDayRangeInput): AllDayDayRange;
export const isSameAllDayDayRange = (a: AllDayDayRange, b: AllDayDayRange): boolean;
/** X-AXIS-ONLY move threshold test. Strict greater-than. Symmetric (use Math.abs). */
export const hasExceededAllDayDragThreshold = (currentX: number, initialX: number, thresholdPx: number): boolean;

SEMANTICS of resolveAllDayDayRange, in order:
1. If visibleDates is non-empty, clamp anchorDate and pointerDate into
   [visibleDates[0], visibleDates[visibleDates.length - 1]].
2. Normalise: first = min(clampedAnchor, clampedPointer), last = max(...), using
   plain LEXICOGRAPHIC string comparison (YYYY-MM-DD sorts correctly as text).
   This makes direction-agnosticism structural, not conditional.
3. end = dayjs(last).add(1, 'day').format(YEAR_MONTH_DAY_FORMAT). This must be
   byte-identical arithmetic to the line it replaces, so anchor=pointer=2026-05-20
   yields exactly {start:'2026-05-20', end:'2026-05-21'}.
4. The EXCLUSIVE end is NEVER clamped into the window. On the last visible column
   the correct end is lastVisible + 1 day, legitimately one day past the window.
   Clamping it would collapse the span to zero length.
5. Degenerate input (empty visibleDates, unparseable date) falls back to the
   one-day range at anchorDate. NEVER throws.
```

#### SPEC/interaction.constants.ts addition
_Included because: The constant to add, its value, and the reasoning the doc comment must carry._

```
export const ALLDAY_DRAFT_CREATE_MOVE_THRESHOLD_PX = 8;

The existing doc comment says the thresholds 'measure different products of the
gesture' and must not be unified. Honouring that REQUIRES a third value, not a
reuse. Extend the comment with a paragraph making this case:
- TIMED_DRAFT_CREATE_MOVE_THRESHOLD_PX (4) measures a VERTICAL duration drag
  against a 15-minute row; at 4px the draft still looks like the default 30
  minutes, so a jitter escalation is invisible and free.
- INTERACTION_MOVE_THRESHOLD_PX (25) gates moving an EXISTING card and is far too
  coarse here: 25px can be a third of a narrow day column.
- ALLDAY_DRAFT_CREATE_MOVE_THRESHOLD_PX (8) measures HORIZONTAL day-column intent
  across columns roughly 100-200px wide. A jitter escalation is NOT free here: it
  flips hasMoved, producing a second draft commit at release and a form whose
  dates visibly re-seed on what the user meant as a click. 8px sits above ordinary
  click jitter and hand tremor while staying far below half a column.
```

#### SPEC/all-day.create.test.ts (required test table)
_Included because: Implement every row as its own it() block. These are the acceptance proofs._

```
| test | asserts |
| one-day identity | {anchor:'2026-05-20', pointer:'2026-05-20'} => {start:'2026-05-20', end:'2026-05-21'} (pins the exact values an untouched existing test asserts) |
| left-to-right | {anchor:'2026-05-20', pointer:'2026-05-22'} => {start:'2026-05-20', end:'2026-05-23'} |
| right-to-left is identical | {anchor:'2026-05-22', pointer:'2026-05-20'} => the SAME object as above, via toEqual |
| clamp past right edge | visibleDates 2026-05-18..2026-05-24, pointer '2026-06-02' => end '2026-05-25' |
| clamp past left edge | same window, pointer '2026-04-01' => start '2026-05-18' |
| out-of-window anchor clamps too | anchor '2026-05-01', pointer '2026-05-20' => start '2026-05-18' |
| exclusive end is NOT clamped | window ends '2026-05-24', anchor=pointer='2026-05-24' => end '2026-05-25', NOT '2026-05-24' (zero-length-span guard) |
| month boundary | anchor '2026-05-31', pointer '2026-06-02' => {start:'2026-05-31', end:'2026-06-03'} |
| no window supplied | visibleDates omitted and [] => unclamped range, no throw |
| hasExceededAllDayDragThreshold | (120,100,8)=>true; (104,100,8)=>false; (92,100,8)=>true (symmetric); (108,100,8)=>false (strict >) |
| isSameAllDayDayRange | equal => true; differing end => false |

For the window tests use the full ascending list:
['2026-05-18','2026-05-19','2026-05-20','2026-05-21','2026-05-22','2026-05-23','2026-05-24']
```

#### packages/web/src/grid/interaction/math/all-day.drag.ts (excerpt, lines 1-16)
_Included because: Sibling module in the SAME directory - match its import style, interface-input-object style, and arrow-const export style._

```
import { type GridLayoutCache } from "@web/grid/interaction/layout.cache";
import { type AllDayDragVisual } from "../types/all-day-drag.types";
import { type VisualPoint, type VisualRect } from "../types/timed-drag.types";
import {
  getCrossRowTimedPlacement,
  getDragRowLayouts,
  resolveDragRow,
} from "./cross-row.drag";
import { resolveDragColumn } from "./drag-column";

interface CreateAllDayDragVisualInput {
  dayDate: string;
  dayIndex: number;
  eventId: string;
  pointerStart: VisualPoint;
  sourceRect: VisualRect;
}
```

#### packages/web/src/grid/interaction/math/smart-scroll.test.ts (excerpt, lines 1-6)
_Included because: Sibling test in the SAME directory - note the 'bun:test' import comes LAST, after the module under test. Biome enforces this ordering._

```
import { getSmartScrollFrame, type SmartScrollCache } from "./smart-scroll";
import { describe, expect, it } from "bun:test";

const cache = {
  bottom: 600,
  edgeThresholdPx: 40,
```
### Acceptance criteria
- packages/web/src/grid/interaction/math/all-day.create.ts exists and exports resolveAllDayDayRange, isSameAllDayDayRange, hasExceededAllDayDragThreshold, and the AllDayDayRange type
- resolveAllDayDayRange({anchorDate:'2026-05-20', pointerDate:'2026-05-20'}) returns exactly {start:'2026-05-20', end:'2026-05-21'}
- resolveAllDayDayRange is direction-agnostic: swapping anchorDate and pointerDate yields a toEqual-identical result
- The exclusive end is never clamped into visibleDates: anchor=pointer=last visible day yields end = lastVisible + 1 day
- resolveAllDayDayRange never throws on empty visibleDates or an unparseable date; it falls back to the one-day range at anchorDate
- hasExceededAllDayDragThreshold compares the X axis only, is symmetric, and uses a strict greater-than
- all-day.create.test.ts implements every row of the supplied test table as a separate it() block
- interaction.constants.ts gains ALLDAY_DRAFT_CREATE_MOVE_THRESHOLD_PX = 8 and an extended doc comment, with INTERACTION_MOVE_THRESHOLD_PX and TIMED_DRAFT_CREATE_MOVE_THRESHOLD_PX unchanged at 25 and 4
- No file outside these three paths is created or modified
- The module is pure: no React import, no zustand/store import, no DOM access
### Your final message
Your final message must be a single JSON object and nothing else — no
prose before it, no summary after it, no ``` fence around it. It must
conform to this schema:

```json
{
  "type": "object",
  "properties": {
    "files_written": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "path": {
            "type": "string"
          },
          "summary": {
            "type": "string"
          }
        },
        "required": [
          "path",
          "summary"
        ]
      }
    },
    "exports": {
      "type": "array",
      "items": {
        "type": "string"
      }
    },
    "notes": {
      "type": "string"
    }
  },
  "required": [
    "files_written",
    "exports"
  ]
}
```