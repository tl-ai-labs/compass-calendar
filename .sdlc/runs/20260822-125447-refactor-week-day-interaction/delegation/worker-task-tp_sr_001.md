## Task tp_sr_001 — senior_code_review / changed_files_review
Module: week-day-interaction
### Working directory
You are running as an agent inside `/home/sainadh/projects/compass-calendar/compass/compass-calendar`. You may list, read,
edit and create files there, and run commands there. That directory is the
only place you can act; nothing outside it is reachable.
### Instruction
Perform a SENIOR CODE REVIEW of this completed refactor and return exactly ONE JSON object with the keys in the schema. Scope: ONLY the 24 files in the change surface below - do not review the wider codebase. Context: this is a types-only refactor of calendar drag/drop interaction code, parameterizing shared grid types over a TColumnKey so Week (dates) and Day (calendar ids) can share one implementation. Full test suite is green at 2298/2298, type-check passes, lint clean. Delivered scope is FR-1 (branded column keys), FR-2 (generic threading through shared grid layer), FR-5 (collapse duplicated Week/Day adapter type blocks into shared adapter.types.ts). FR-3/FR-4/FR-6 were deliberately CUT by the operator - do NOT flag their absence as a defect. Review for: (1) correctness - does any change alter RUNTIME behavior rather than types only? Check especially layout.cache.ts buildDayColumns overload signatures, the getNearestDayColumn return-type change, and hasTimedDragVisualMoved becoming generic. (2) Is `TColumnKey = string` as a default parameter sound, or does it let un-branded strings silently flow where a branded key is required, defeating FR-1? (3) The two unchecked cast helpers asDateColumnKeys/asDayColumnKeys - is casting at the geometry-cache branding boundary the right call, and is the boundary actually complete or can un-branded data reach a pinned signature by another path? (4) Type-design quality of adapter.types.ts - are the Grid* generics over TRegistered a genuine de-duplication or do they over-abstract? (5) DayColumnKey = CalendarId | DateOnly is a union of two semantically different things - is that honest modeling or a latent bug, given columnMoveCalendarId compares dayDate to initialDayDate? (6) Consistency, naming, dead code, comment accuracy. Be proportionate and concrete: cite file and symbol. Do NOT invent severity where none exists, do NOT recommend generic hardening, do NOT propose FR-3/FR-4/FR-6 work. For each genuine defect emit one refinement packet; if the code is sound, return an EMPTY refinement_packets array. Do NOT write any files. Do NOT run any shell commands - especially never git checkout, git restore, git clean, rm, mv, or any cleanup command.
### Provided excerpts
These are extracts, not whole files. The paths are real — open them in the
working directory when you need more than the excerpt shows.

#### CHANGE-SURFACE.md
_Included because: The exact 24 files this run changed and the verification state. Review only these._

```
=== RUN SCOPE: 22 modified + 2 new = 24 files. +266 / -311 (NET -45 LOC) ===

NEW (types only, zero runtime output):
  packages/web/src/grid/interaction/types/column-key.types.ts - declares DateColumnKey = DateOnly, DayColumnKey = CalendarId | DateOnly, plus the two UNCHECKED cast helpers asDateColumnKeys / asDayColumnKeys. Full content supplied below.
  packages/web/src/grid/interaction/types/adapter.types.ts - shared generic Target/CommitResult/Visual contracts previously duplicated per view. Full content supplied below.

MODIFIED - shared grid layer (generic threading):
  grid/interaction/layout.cache.ts
  grid/interaction/math/{timed.drag,all-day.drag,cross-row.drag,drag-column}.ts
  grid/interaction/commit/timed-moved.ts
  grid/interaction/types/{timed-drag,all-day-drag}.types.ts

MODIFIED - commit boundary (signature pinning):
  grid/interaction/commit/cross-row.commit.ts (pinned to DateColumnKey)
  views/Week/interaction/adapter/commit/{all-day,timed}.commit.ts (pinned to DateColumnKey)
  views/Day/interaction/adapter/commit/{all-day,timed}.commit.ts (pinned to DayColumnKey)

MODIFIED - view adapters / geometry / per-interaction modules:
  views/Week/interaction/adapter/geometry/week-layout.cache.ts (branding boundary)
  views/Day/interaction/adapter/geometry/day-layout.cache.ts (branding boundary)
  views/Day/interaction/adapter/day-interaction.adapter.ts (2 lines: layout type + asDayColumnKeys)
  views/Week/interaction/adapter/interactions/{all-day,timed}.drag.ts (annotations only)
  views/Week/interaction/adapter/week-interaction.adapter.types.ts (149-line duplicate block collapsed to alias re-exports)
  views/Day/interaction/adapter/day-interaction.adapter.types.ts (same collapse)

MODIFIED - test fixture (no assertion changed):
  grid/interaction/commit/cross-row.commit.test.ts

MODIFIED - config:
  .gitignore (APPEND-ONLY: added .sdlc/ and .hook-logs/)

NOT CHANGED: no package.json, no bun.lock, no biome.json, no tsconfig, no dependency added or upgraded. No backend/sync/scripts/core package touched (all off-limits). Neither WeekInteractionCoordinator.tsx nor DayInteractionCoordinator.tsx touched.

VERIFICATION STATE: type-check PASS (tsc exit 0, TypeScript 7.0.2). Lint clean on all 24. Full suite `bun run test:web` = 2298 pass / 0 fail across 302 files, EXACTLY the pre-run baseline (zero regressions).

KNOWN RESIDUAL (already accepted at the security gate, do not re-litigate as new): Day's timed.commit.ts retains a `visual.dayDate as CalendarId` cast inside columnMoveCalendarId, resting on a RUNTIME invariant rather than a compile-time proof.
```

#### packages/web/src/grid/interaction/types/column-key.types.ts
_Included because: New file, full content. The heart of FR-1 - branded key definitions and the two unchecked cast helpers._

```
import { type CalendarId, type DateOnly } from "@core/types/domain-primitives";

/**
 * Week grid columns are dates.
 */
export type DateColumnKey = DateOnly;

/**
 * Day grid columns are calendar ids, except the single-column fallback whose
 * one key is a date.
 */
export type DayColumnKey = CalendarId | DateOnly;

/**
 * DELIBERATELY UNCHECKED casts: the callers have already established these
 * are the rendered column keys, and running a validating parse here would put
 * Zod on the mid-drag hot path and throw on input that is silently tolerated
 * today, which would be a behavior change.
 */
export const asDateColumnKeys = (keys: string[]): DateColumnKey[] =>
  keys as DateColumnKey[];

export const asDayColumnKeys = (keys: string[]): DayColumnKey[] =>
  keys as DayColumnKey[];

```

#### packages/web/src/grid/interaction/types/adapter.types.ts
_Included because: New file, full content. The FR-5 de-duplication target - shared Grid* contracts both view adapters now alias._

```
/**
 * Shared adapter contracts previously duplicated across Week and Day view adapters.
 * This is now the single source of truth for grid interaction types.
 */

import { type GridEvent } from "@web/common/types/web.event.types";
import { type AllDayDragVisual } from "./all-day-drag.types";
import {
  type AllDayResizeEdge,
  type AllDayResizeVisual,
} from "./all-day-resize.types";
import { type TimedDragVisual } from "./timed-drag.types";
import {
  type TimedResizeEdge,
  type TimedResizeVisual,
} from "./timed-resize.types";

export interface GridInteractionPointerOwnership {
  reason: string;
  shouldOwn: boolean;
}

export interface GridAllDayDragTarget<TRegistered> {
  event: GridEvent;
  hadFormOpenBeforeInteraction: boolean;
  registered: TRegistered;
  type: "allDayDrag";
}

export interface GridAllDayResizeTarget<TRegistered> {
  edge: AllDayResizeEdge;
  event: GridEvent;
  hadFormOpenBeforeInteraction: boolean;
  registered: TRegistered;
  type: "allDayResize";
}

export interface GridTimedDragTarget<TRegistered> {
  event: GridEvent;
  hadFormOpenBeforeInteraction: boolean;
  registered: TRegistered;
  type: "timedDrag";
}

export interface GridTimedResizeTarget<TRegistered> {
  edge: TimedResizeEdge;
  event: GridEvent;
  hadFormOpenBeforeInteraction: boolean;
  registered: TRegistered;
  type: "timedResize";
}

export type GridInteractionTarget<TRegistered> =
  | GridAllDayDragTarget<TRegistered>
  | GridAllDayResizeTarget<TRegistered>
  | GridTimedDragTarget<TRegistered>
  | GridTimedResizeTarget<TRegistered>;

export type GridResolvedEventTarget<TRegistered> = {
  event: GridEvent;
  hadFormOpenBeforeInteraction: boolean;
  registered: TRegistered;
};

export interface GridAllDayDragCommitResult {
  event: GridEvent;
  eventId: string;
  hadFormOpenBeforeInteraction: boolean;
  hasMoved: boolean;
  type: "allDayDragEnd";
}

export interface GridAllDayResizeCommitResult {
  event: GridEvent;
  eventId: string;
  hadFormOpenBeforeInteraction: boolean;
  hasMoved: boolean;
  type: "allDayResizeEnd";
}

export interface GridTimedDragCommitResult {
  event: GridEvent;
  eventId: string;
  hadFormOpenBeforeInteraction: boolean;
  hasMoved: boolean;
  type: "timedDragEnd";
}

export interface GridTimedResizeCommitResult {
  event: GridEvent;
  eventId: string;
  hadFormOpenBeforeInteraction: boolean;
  hasMoved: boolean;
  type: "timedResizeEnd";
}

export type GridInteractionCommitResult =
  | GridAllDayDragCommitResult
  | GridAllDayResizeCommitResult
  | GridTimedDragCommitResult
  | GridTimedResizeCommitResult;

export type GridInteractionVisual<TColumnKey = string> =
  | AllDayDragVisual<TColumnKey>
  | AllDayResizeVisual
  | TimedDragVisual<TColumnKey>
  | TimedResizeVisual;

```

#### scoped.diff
_Included because: The complete unified diff of all 22 modified tracked files (the 2 new files are untracked so their full content is supplied separately above). This is the actual change to review._

```
diff --git a/.gitignore b/.gitignore
@@ -33,3 +33,6 @@ packages/web/build/
 playwright-report/
 test-results/
 tmp/
+# AI-SDLC run bookkeeping (also keeps Biome from linting it - biome.json sets vcs.useIgnoreFile)
+.sdlc/
+.hook-logs/

diff --git a/packages/web/src/grid/interaction/commit/cross-row.commit.test.ts
@@ -1,5 +1,9 @@
 import { type GridEvent } from "@web/common/types/web.event.types";
 import { type AllDayDragVisual } from "@web/grid/interaction/types/all-day-drag.types";
+import {
+  asDateColumnKeys,
+  type DateColumnKey,
+} from "@web/grid/interaction/types/column-key.types";
@@ -25,14 +29,17 @@
+// The Week-side cross-row commit takes date-keyed columns so test fixtures brand their dates the same way production does.
+const columnKey = (date: string): DateColumnKey => asDateColumnKeys([date])[0]!;
+
 const allDayDragVisual = (
-  overrides: Partial<AllDayDragVisual> = {},
-): AllDayDragVisual => ({
+  overrides: Partial<AllDayDragVisual<DateColumnKey>> = {},
+): AllDayDragVisual<DateColumnKey> => ({
   crossRowSize: null,
-  dayDate: "2026-05-13",
+  dayDate: columnKey("2026-05-13"),
-  initialDayDate: "2026-05-13",
+  initialDayDate: columnKey("2026-05-13"),
@@ -44,15 +51,15 @@
 const timedDragVisual = (
-  overrides: Partial<TimedDragVisual> = {},
-): TimedDragVisual => ({
+  overrides: Partial<TimedDragVisual<DateColumnKey>> = {},
+): TimedDragVisual<DateColumnKey> => ({
-  dayDate: "2026-05-19",
+  dayDate: columnKey("2026-05-19"),
-  initialDayDate: "2026-05-19",
+  initialDayDate: columnKey("2026-05-19"),
(remaining hunks in this test file are the same mechanical substitution of columnKey("...") for a bare date string literal at 5 more call sites; NO assertion or expected value was changed)

diff --git a/packages/web/src/grid/interaction/commit/cross-row.commit.ts
@@ -3,6 +3,7 @@
 import { type AllDayDragVisual } from "../types/all-day-drag.types";
+import { type DateColumnKey } from "../types/column-key.types";
@@ -17,7 +18,7 @@
 export const allDayDragVisualToTimedGridEvent = (
   event: GridEvent,
-  visual: AllDayDragVisual,
+  visual: AllDayDragVisual<DateColumnKey>,
 ): GridEvent => {
   const day = dayjs(visual.dayDate).startOf("day");
@@ -40,7 +41,7 @@
 export const timedDragVisualToAllDayGridEvent = (
   event: GridEvent,
-  visual: TimedDragVisual,
+  visual: TimedDragVisual<DateColumnKey>,
 ): GridEvent => {
   const day = dayjs(visual.dayDate);

diff --git a/packages/web/src/grid/interaction/commit/timed-moved.ts
@@ -1,7 +1,9 @@
-export const hasTimedDragVisualMoved = (visual: TimedDragVisual) =>
+export const hasTimedDragVisualMoved = <TColumnKey = string>(
+  visual: TimedDragVisual<TColumnKey>,
+) =>
   visual.dayDate !== visual.initialDayDate ||
   visual.startMinutes !== visual.initialStartMinutes ||
   visual.endMinutes !== visual.initialEndMinutes;

diff --git a/packages/web/src/grid/interaction/layout.cache.ts
@@ -6,7 +6,7 @@
 export interface GridLayoutCacheSources {
   timedColumnsElement?: HTMLElement | null;
 }
 
-export interface GridLayoutCacheOptions {
+export interface GridLayoutCacheOptions<TColumnKey = string> {
@@ -17,13 +17,19 @@
-  /** Local YYYY-MM-DD dates of the rendered day columns, in window order. */
-  visibleDates: string[];
+  /**
+   * Keys of the rendered day columns, in window order, view-parameterized
+   * (Week uses DateColumnKey, Day uses DayColumnKey).
+   */
+  visibleDates: TColumnKey[];
 }
 
-export interface DayColumnCache {
-  /** Local YYYY-MM-DD date this column renders. */
-  date: string;
+export interface DayColumnCache<TColumnKey = string> {
+  /**
+   * Key of the column this column renders, view-parameterized (Week uses
+   * DateColumnKey, Day uses DayColumnKey).
+   */
+  date: TColumnKey;
   index: number;
   left: number;
   width: number;
@@ -47,28 +53,28 @@
-export interface GridLayoutCache {
+export interface GridLayoutCache<TColumnKey = string> {
-  crossRow?: GridLayoutCache;
-  dayColumns: DayColumnCache[];
+  crossRow?: GridLayoutCache<TColumnKey>;
+  dayColumns: DayColumnCache<TColumnKey>[];
   edgeNavigation: EdgeNavigationCache;
   pixelsPerMinute: number;
   snapMinutes: number;
   smartScroll?: SmartScrollCache;
 }
 
-interface BuildDayColumnsInput {
+interface BuildDayColumnsInput<TColumnKey = string> {
   left: number;
-  visibleDates: string[];
+  visibleDates: TColumnKey[];
   width: number;
 }
 
-export const buildTimedGridLayoutCache = ({
+export const buildTimedGridLayoutCache = <TColumnKey = string>({
@@ -78,7 +84,8 @@
-}: GridLayoutCacheOptions & GridLayoutCacheSources): GridLayoutCache | null => {
+}: GridLayoutCacheOptions<TColumnKey> &
+  GridLayoutCacheSources): GridLayoutCache<TColumnKey> | null => {
@@ -119,13 +126,14 @@
-export const buildAllDayGridLayoutCache = ({
+export const buildAllDayGridLayoutCache = <TColumnKey = string>({
-}: GridLayoutCacheOptions & GridLayoutCacheSources): GridLayoutCache | null => {
+}: GridLayoutCacheOptions<TColumnKey> &
+  GridLayoutCacheSources): GridLayoutCache<TColumnKey> | null => {
@@ -151,13 +159,13 @@
- * only when the drag's own row is missing — a missing *other* row just leaves
+ * only when the drag's own row is missing - a missing *other* row just leaves
-export const buildDragGridLayoutCache = (
-  options: GridLayoutCacheOptions & GridLayoutCacheSources,
+export const buildDragGridLayoutCache = <TColumnKey = string>(
+  options: GridLayoutCacheOptions<TColumnKey> & GridLayoutCacheSources,
   sourceRow: DragRow,
-): GridLayoutCache | null => {
+): GridLayoutCache<TColumnKey> | null => {
@@ -166,16 +174,19 @@
-export function buildDayColumns(input: BuildDayColumnsInput): DayColumnCache[];
-export function buildDayColumns(
+export function buildDayColumns<TColumnKey = string>(
+  input: BuildDayColumnsInput<TColumnKey>,
+): DayColumnCache<TColumnKey>[];
+export function buildDayColumns<TColumnKey = string>(
   input: Pick<DOMRect, "left" | "width">,
-  visibleDates: string[],
-): DayColumnCache[];
-export function buildDayColumns(
-  input: BuildDayColumnsInput | Pick<DOMRect, "left" | "width">,
-  visibleDates?: string[],
-): DayColumnCache[] {
-  const dates = visibleDates ?? (input as BuildDayColumnsInput).visibleDates;
+  visibleDates: TColumnKey[],
+): DayColumnCache<TColumnKey>[];
+export function buildDayColumns<TColumnKey = string>(
+  input: BuildDayColumnsInput<TColumnKey> | Pick<DOMRect, "left" | "width">,
+  visibleDates?: TColumnKey[],
+): DayColumnCache<TColumnKey>[] {
+  const dates =
+    visibleDates ?? (input as BuildDayColumnsInput<TColumnKey>).visibleDates;
@@ -191,8 +202,11 @@
-export const getNearestDayColumn = (columns: DayColumnCache[], x: number) => {
-  let nearest: DayColumnCache | null = null;
+export const getNearestDayColumn = <TColumnKey = string>(
+  columns: DayColumnCache<TColumnKey>[],
+  x: number,
+): DayColumnCache<TColumnKey> | null => {
+  let nearest: DayColumnCache<TColumnKey> | null = null;
   let nearestDistance = Number.POSITIVE_INFINITY;

diff --git a/packages/web/src/grid/interaction/math/all-day.drag.ts
@@ -8,26 +8,26 @@
-interface CreateAllDayDragVisualInput {
-  dayDate: string;
+interface CreateAllDayDragVisualInput<TColumnKey = string> {
+  dayDate: TColumnKey;
-interface UpdateAllDayDragVisualInput {
-  layout: GridLayoutCache;
+interface UpdateAllDayDragVisualInput<TColumnKey = string> {
+  layout: GridLayoutCache<TColumnKey>;
-export const createAllDayDragVisual = ({
+export const createAllDayDragVisual = <TColumnKey = string>({
-}: CreateAllDayDragVisualInput): AllDayDragVisual => ({
+}: CreateAllDayDragVisualInput<TColumnKey>): AllDayDragVisual<TColumnKey> => ({
@@ -42,10 +42,10 @@
-export const updateAllDayDragVisual = (
-  visual: AllDayDragVisual,
-  { layout, pointer }: UpdateAllDayDragVisualInput,
-): AllDayDragVisual => {
+export const updateAllDayDragVisual = <TColumnKey = string>(
+  visual: AllDayDragVisual<TColumnKey>,
+  { layout, pointer }: UpdateAllDayDragVisualInput<TColumnKey>,
+): AllDayDragVisual<TColumnKey> => {

diff --git a/packages/web/src/grid/interaction/math/cross-row.drag.ts
@@ -21,18 +21,21 @@
-interface CrossRowPlacement {
-  column: DayColumnCache | null;
+interface CrossRowPlacement<TColumnKey = string> {
+  column: DayColumnCache<TColumnKey> | null;
-export const getDragRowLayouts = (
-  layout: GridLayoutCache,
+export const getDragRowLayouts = <TColumnKey = string>(
+  layout: GridLayoutCache<TColumnKey>,
   sourceRow: DragRow,
-): { allDay: GridLayoutCache | null; timed: GridLayoutCache | null } =>
+): {
+  allDay: GridLayoutCache<TColumnKey> | null;
+  timed: GridLayoutCache<TColumnKey> | null;
+} =>
@@ -45,16 +48,16 @@
-export const resolveDragRow = ({
+export const resolveDragRow = <TColumnKey = string>({
-  allDay: GridLayoutCache | null;
+  allDay: GridLayoutCache<TColumnKey> | null;
-  timed: GridLayoutCache | null;
+  timed: GridLayoutCache<TColumnKey> | null;
@@ -72,15 +75,15 @@
-export const getCrossRowTimedPlacement = ({
+export const getCrossRowTimedPlacement = <TColumnKey = string>({
-  layout: GridLayoutCache;
+  layout: GridLayoutCache<TColumnKey>;
-}): CrossRowPlacement & { startMinutes: number } => {
+}): CrossRowPlacement<TColumnKey> & { startMinutes: number } => {
@@ -116,15 +119,15 @@
-export const getCrossRowAllDayPlacement = ({
+export const getCrossRowAllDayPlacement = <TColumnKey = string>({
-  layout: GridLayoutCache;
+  layout: GridLayoutCache<TColumnKey>;
-}): CrossRowPlacement => {
+}): CrossRowPlacement<TColumnKey> => {

diff --git a/packages/web/src/grid/interaction/math/drag-column.ts
@@ -11,7 +11,7 @@
-export const resolveDragColumn = ({
+export const resolveDragColumn = <TColumnKey = string>({
-  layout: GridLayoutCache;
+  layout: GridLayoutCache<TColumnKey>;

diff --git a/packages/web/src/grid/interaction/math/timed.drag.ts
@@ -14,8 +14,8 @@
-interface CreateTimedDragVisualInput {
-  dayDate: string;
+interface CreateTimedDragVisualInput<TColumnKey = string> {
+  dayDate: TColumnKey;
-interface UpdateTimedDragVisualInput {
-  layout: GridLayoutCache;
+interface UpdateTimedDragVisualInput<TColumnKey = string> {
+  layout: GridLayoutCache<TColumnKey>;
-export const createTimedDragVisual = ({
+export const createTimedDragVisual = <TColumnKey = string>({
-}: CreateTimedDragVisualInput): TimedDragVisual => ({
+}: CreateTimedDragVisualInput<TColumnKey>): TimedDragVisual<TColumnKey> => ({
@@ -57,10 +57,14 @@
-export const updateTimedDragVisual = (
-  visual: TimedDragVisual,
-  { layout, pointer, scrollDeltaPx = 0 }: UpdateTimedDragVisualInput,
-): TimedDragVisual => {
+export const updateTimedDragVisual = <TColumnKey = string>(
+  visual: TimedDragVisual<TColumnKey>,
+  {
+    layout,
+    pointer,
+    scrollDeltaPx = 0,
+  }: UpdateTimedDragVisualInput<TColumnKey>,
+): TimedDragVisual<TColumnKey> => {
@@ -124,16 +128,16 @@
-const getBoundedVerticalPlacement = ({
+const getBoundedVerticalPlacement = <TColumnKey = string>({
-  layout: GridLayoutCache;
+  layout: GridLayoutCache<TColumnKey>;
-  visual: TimedDragVisual;
+  visual: TimedDragVisual<TColumnKey>;
@@ -191,5 +195,7 @@
-const getCurrentScrollTop = (layout: GridLayoutCache, scrollDeltaPx: number) =>
-  (layout.smartScroll?.initialScrollTop ?? 0) + scrollDeltaPx;
+const getCurrentScrollTop = <TColumnKey = string>(
+  layout: GridLayoutCache<TColumnKey>,
+  scrollDeltaPx: number,
+) => (layout.smartScroll?.initialScrollTop ?? 0) + scrollDeltaPx;

diff --git a/packages/web/src/grid/interaction/types/all-day-drag.types.ts
@@ -11,7 +11,7 @@
-export interface AllDayDragVisual {
+export interface AllDayDragVisual<TColumnKey = string> {
@@ -22,14 +22,14 @@
   /**
-   * Column key semantics match TimedDragVisual.dayDate: a date in the Week
-   * view, a calendar id in the Day view.
+   * Key of the column currently under the drag, view-parameterized (Week uses
+   * DateColumnKey, Day uses DayColumnKey).
    */
-  dayDate: string;
+  dayDate: TColumnKey;
   dayIndex: number;
   eventId: string;
-  /** Local YYYY-MM-DD date of the (window-clamped) source column at drag start. */
-  initialDayDate: string;
+  /** Key of the (window-clamped) source column at drag start. */
+  initialDayDate: TColumnKey;

diff --git a/packages/web/src/grid/interaction/types/timed-drag.types.ts
@@ -27,21 +27,19 @@
-export interface TimedDragVisual {
+export interface TimedDragVisual<TColumnKey = string> {
   crossRowSize: CrossRowSize;
   /**
-   * Key of the column currently under the drag. Week view columns are
-   * local YYYY-MM-DD dates; Day view columns are CALENDAR IDS (all columns
-   * share the visible date there) - do not dayjs-parse this without knowing
-   * which view produced it.
+   * Key of the column currently under the drag, view-parameterized (Week uses
+   * DateColumnKey, Day uses DayColumnKey).
    */
-  dayDate: string;
+  dayDate: TColumnKey;
-  /** Local YYYY-MM-DD date of the source column at drag start. */
-  initialDayDate: string;
+  /** Key of the source column at drag start. */
+  initialDayDate: TColumnKey;

diff --git a/packages/web/src/views/Day/interaction/adapter/commit/all-day.commit.ts
@@ -3,6 +3,7 @@
+import { type DayColumnKey } from "@web/grid/interaction/types/column-key.types";
@@ -13,7 +14,7 @@
 export const commitAllDayDragInteraction = (
   target: DayAllDayDragTarget,
-  visual: AllDayDragVisual,
+  visual: AllDayDragVisual<DayColumnKey>,
 ): DayAllDayDragCommitResult => {
   const hasMoved =
     "dayDate" in visual ? visual.dayDate !== visual.initialDayDate : false;

diff --git a/packages/web/src/views/Day/interaction/adapter/commit/timed.commit.ts
@@ -5,6 +5,7 @@
+import { type DayColumnKey } from "@web/grid/interaction/types/column-key.types";
@@ -16,7 +17,7 @@
 export const commitTimedDragInteraction = (
   target: DayTimedDragTarget,
-  visual: TimedDragVisual,
+  visual: TimedDragVisual<DayColumnKey>,
   visibleDate: Dayjs,
 ): DayTimedDragCommitResult => {
   const hasMoved = hasTimedDragVisualMoved(visual);
@@ -52,7 +53,7 @@
 export const timedDragVisualToDayGridEvent = (
   event: GridEvent,
-  visual: TimedDragVisual,
+  visual: TimedDragVisual<DayColumnKey>,
   visibleDate: Dayjs,
 ): GridEvent => ({
@@ -75,7 +76,7 @@
  * keep the event's own calendarId.
  */
 export const columnMoveCalendarId = (
-  visual: Pick<TimedDragVisual, "dayDate" | "initialDayDate">,
+  visual: Pick<TimedDragVisual<DayColumnKey>, "dayDate" | "initialDayDate">,
   event: GridEvent,
 ): CalendarId | undefined =>
   visual.dayDate !== visual.initialDayDate
     ? (visual.dayDate as CalendarId)   <-- RESIDUAL CAST (already accepted)
     : ...

diff --git a/packages/web/src/views/Day/interaction/adapter/day-interaction.adapter.ts
@@ -12,7 +12,6 @@
-import { type GridLayoutCache } from "@web/grid/interaction/layout.cache";
@@ -29,6 +28,10 @@
+import {
+  asDayColumnKeys,
+  type DayColumnKey,
+} from "@web/grid/interaction/types/column-key.types";
@@ -67,6 +70,7 @@
 import {
   buildDayLayoutCacheForTarget,
+  type DayLayoutCache,
   isDayDragTarget,
 } from "./geometry/day-layout.cache";
@@ -92,7 +96,7 @@
-  let layout: GridLayoutCache | null = null;
+  let layout: DayLayoutCache | null = null;
@@ -257,8 +261,11 @@
         const eventColumnIndex = calendarColumnKeys.indexOf(
           target.event.calendarId ?? "",
         );
-        const columnKeys =
-          eventColumnIndex >= 0 ? calendarColumnKeys : [visibleDateKey];
+        // Day branding boundary: the fallback branch's single key is a DATE,
+        // not a calendar id, which is why DayColumnKey is a union.
+        const columnKeys: DayColumnKey[] = asDayColumnKeys(
+          eventColumnIndex >= 0 ? calendarColumnKeys : [visibleDateKey],
+        );
         const initialColumnIndex = Math.max(0, eventColumnIndex);
         const initialColumnKey = columnKeys[initialColumnIndex]!;

diff --git a/packages/web/src/views/Day/interaction/adapter/day-interaction.adapter.types.ts
(149-line block of standalone interface declarations collapsed to alias re-exports of the shared Grid* types; representative:)
-export interface DayInteractionPointerOwnership { reason: string; shouldOwn: boolean; }
+export type DayInteractionPointerOwnership = GridInteractionPointerOwnership;
-export interface DayAllDayDragCommitResult { event: GridEvent; eventId: string; hadFormOpenBeforeInteraction: boolean; hasMoved: boolean; type: "allDayDragEnd"; }
+export type DayAllDayDragCommitResult = GridAllDayDragCommitResult;
-export interface DayAllDayDragTarget { event: GridEvent; hadFormOpenBeforeInteraction: boolean; registered: DayRegisteredEventTarget; type: "allDayDrag"; }
+export type DayAllDayDragTarget = GridAllDayDragTarget<DayRegisteredEventTarget>;
(...same shape for AllDayResize, TimedDrag, TimedResize commit-results and targets...)
-export type DayInteractionTarget = | DayAllDayDragTarget | DayAllDayResizeTarget | DayTimedDragTarget | DayTimedResizeTarget;
+export type DayInteractionTarget = GridInteractionTarget<DayRegisteredEventTarget>;
-export type DayInteractionVisual = | AllDayDragVisual | AllDayResizeVisual | TimedDragVisual | TimedResizeVisual;
+export type DayInteractionVisual = GridInteractionVisual<DayColumnKey>;
-export type DayInteractionCommitResult = | DayAllDayDragCommitResult | ... ;
+export type DayInteractionCommitResult = GridInteractionCommitResult;
-export type DayResolvedEventTarget = { event: GridEvent; hadFormOpenBeforeInteraction: boolean; registered: DayRegisteredEventTarget; };
+export type DayResolvedEventTarget = GridResolvedEventTarget<DayRegisteredEventTarget>;

diff --git a/packages/web/src/views/Day/interaction/adapter/geometry/day-layout.cache.ts
@@ -14,6 +14,7 @@
+import { type DayColumnKey } from "@web/grid/interaction/types/column-key.types";
@@ -22,13 +23,13 @@
-export type DayLayoutCache = GridLayoutCache;
+export type DayLayoutCache = GridLayoutCache<DayColumnKey>;
 export type DayLayoutCacheSources = GridLayoutCacheSources;
 
 export const buildDayTimedLayoutCache = (
   sources: GridLayoutCacheSources,
-  visibleDates: string[],
-) =>
+  columnKeys: DayColumnKey[],
+): DayLayoutCache | null =>
   buildTimedGridLayoutCache({
-    visibleDates,
+    visibleDates: columnKeys,
   });
@@ -40,20 +41,20 @@
 export const buildDayAllDayLayoutCache = (
   sources: GridLayoutCacheSources,
-  visibleDates: string[],
-) =>
+  columnKeys: DayColumnKey[],
+): DayLayoutCache | null =>
   buildAllDayGridLayoutCache({
-    visibleDates,
+    visibleDates: columnKeys,
   });
@@ -64,11 +65,11 @@
 export const buildDayLayoutCacheForTarget = (
   target: DayInteractionTarget,
   sources: GridLayoutCacheSources,
-  visibleDates: string[],
-) =>
+  columnKeys: DayColumnKey[],
+): DayLayoutCache | null =>
   isAllDayTarget(target)
-    ? buildDayAllDayLayoutCache(sources, visibleDates)
-    : buildDayTimedLayoutCache(sources, visibleDates);
+    ? buildDayAllDayLayoutCache(sources, columnKeys)
+    : buildDayTimedLayoutCache(sources, columnKeys);

diff --git a/packages/web/src/views/Week/interaction/adapter/commit/all-day.commit.ts
@@ -3,13 +3,15 @@
+import { type DateColumnKey } from "@web/grid/interaction/types/column-key.types";
 
-export const hasAllDayDragVisualMoved = (visual: AllDayDragVisual) =>
-  visual.dayDate !== visual.initialDayDate;
+export const hasAllDayDragVisualMoved = (
+  visual: AllDayDragVisual<DateColumnKey>,
+) => visual.dayDate !== visual.initialDayDate;
 
 export const allDayDragVisualToGridEvent = (
   event: GridEvent,
-  visual: AllDayDragVisual,
+  visual: AllDayDragVisual<DateColumnKey>,
 ): GridEvent => {

diff --git a/packages/web/src/views/Week/interaction/adapter/commit/timed.commit.ts
@@ -4,6 +4,7 @@
+import { type DateColumnKey } from "@web/grid/interaction/types/column-key.types";
@@ -11,7 +12,7 @@
 export const timedDragVisualToGridEvent = (
   event: GridEvent,
-  visual: TimedDragVisual,
+  visual: TimedDragVisual<DateColumnKey>,
 ): GridEvent => {

diff --git a/packages/web/src/views/Week/interaction/adapter/geometry/week-layout.cache.ts
@@ -18,6 +18,10 @@
+import {
+  asDateColumnKeys,
+  type DateColumnKey,
+} from "@web/grid/interaction/types/column-key.types";
@@ -34,13 +38,13 @@
 export interface WeekLayoutCacheInput extends GridLayoutCacheSources {
   visibleDays: string[];
 }
 
-export type WeekLayoutCache = GridLayoutCache;
+export type WeekLayoutCache = GridLayoutCache<DateColumnKey>;
@@ -52,7 +56,9 @@
 const weekLayoutCacheOptions = (
   sources: WeekLayoutCacheInput,
-): GridLayoutCacheOptions & WeekLayoutCacheSources => ({
+): GridLayoutCacheOptions<DateColumnKey> & WeekLayoutCacheSources => ({
-  visibleDates: sources.visibleDays,
+  // Branding boundary: the runtime supplies plain strings and they are
+  // branded once here rather than validated per-frame on the drag path.
+  visibleDates: asDateColumnKeys(sources.visibleDays),
 });

diff --git a/packages/web/src/views/Week/interaction/adapter/interactions/all-day.drag.ts
@@ -4,6 +4,7 @@
+import { type DateColumnKey } from "@web/grid/interaction/types/column-key.types";
@@ -56,7 +57,7 @@
-  visual: AllDayDragVisual;
+  visual: AllDayDragVisual<DateColumnKey>;
@@ -76,7 +77,7 @@
 export const commitAllDayDragInteraction = (
   target: WeekAllDayDragTarget,
-  visual: AllDayDragVisual,
+  visual: AllDayDragVisual<DateColumnKey>,
 ): WeekAllDayDragCommitResult => {

diff --git a/packages/web/src/views/Week/interaction/adapter/interactions/timed.drag.ts
@@ -6,6 +6,7 @@
+import { type DateColumnKey } from "@web/grid/interaction/types/column-key.types";
@@ -71,7 +72,7 @@
-  visual: TimedDragVisual;
+  visual: TimedDragVisual<DateColumnKey>;
@@ -92,7 +93,7 @@
 export const commitTimedDragInteraction = (
   target: WeekTimedDragTarget,
-  visual: TimedDragVisual,
+  visual: TimedDragVisual<DateColumnKey>,
 ): WeekTimedDragCommitResult => {

diff --git a/packages/web/src/views/Week/interaction/adapter/week-interaction.adapter.types.ts
(same 149-line collapse as the Day side; representative:)
-export interface WeekInteractionPointerOwnership { reason: string; shouldOwn: boolean; }
+export type WeekInteractionPointerOwnership = GridInteractionPointerOwnership;
-export interface WeekAllDayDragTarget { event: GridEvent; hadFormOpenBeforeInteraction: boolean; registered: WeekRegisteredEventTarget; type: "allDayDrag"; }
+export type WeekAllDayDragTarget = GridAllDayDragTarget<WeekRegisteredEventTarget>;
(...same shape for the other three interaction kinds...)
-export type WeekInteractionTarget = | WeekAllDayDragTarget | ... ;
+export type WeekInteractionTarget = GridInteractionTarget<WeekRegisteredEventTarget>;
-export type WeekInteractionVisual = | AllDayDragVisual | AllDayResizeVisual | TimedDragVisual | TimedResizeVisual;
+export type WeekInteractionVisual = GridInteractionVisual<DateColumnKey>;
-export type WeekEdgeNavigableVisual = AllDayDragVisual | TimedDragVisual;
+export type WeekEdgeNavigableVisual =
+  | AllDayDragVisual<DateColumnKey>
+  | TimedDragVisual<DateColumnKey>;
-export type WeekResolvedEventTarget = { event: GridEvent; hadFormOpenBeforeInteraction: boolean; registered: WeekRegisteredEventTarget; };
+export type WeekResolvedEventTarget = GridResolvedEventTarget<WeekRegisteredEventTarget>;

```
### Acceptance criteria
- Returns exactly one JSON object with keys senior_review_markdown, verdict, refinement_packets
- Review covers only the 24 files in the stated change surface; no wider-codebase findings
- Each of the six review questions in the instruction is answered explicitly with a verdict and reasoning
- Every finding cites a concrete file and symbol; no generic security or hardening advice
- No packet is emitted for the deliberately cut FR-3/FR-4/FR-6 scope or for the already-accepted columnMoveCalendarId residual cast
- refinement_packets is an empty array if and only if verdict is approve or approve_with_nits
- No files were written and no shell commands were run
### Your final message
Your final message must be a single JSON object and nothing else — no
prose before it, no summary after it, no ``` fence around it. It must
conform to this schema:

```json
{
  "type": "object",
  "properties": {
    "senior_review_markdown": {
      "type": "string",
      "description": "The full review document as markdown: (1) Scope reviewed; (2) What the refactor does, in your own words; (3) Findings table with id, severity (info/low/medium/high), file, symbol, description, recommendation; (4) Answers to the six specific review questions in the instruction; (5) Verdict paragraph stating plainly whether this is sound to merge as a no-behavior-change refactor."
    },
    "verdict": {
      "type": "string",
      "enum": [
        "approve",
        "approve_with_nits",
        "request_changes"
      ],
      "description": "approve = no changes needed. approve_with_nits = only info/low observations, nothing blocking. request_changes = at least one medium/high defect requiring a code change."
    },
    "refinement_packets": {
      "type": "array",
      "description": "One entry per genuine defect requiring a code change. EMPTY ARRAY if the code is sound. Do not emit packets for info-level observations.",
      "items": {
        "type": "object",
        "properties": {
          "file": {
            "type": "string",
            "description": "Repo-relative path of the file to change"
          },
          "symbol": {
            "type": "string",
            "description": "The function/type/symbol involved"
          },
          "severity": {
            "type": "string",
            "enum": [
              "low",
              "medium",
              "high"
            ]
          },
          "issue": {
            "type": "string",
            "description": "What is wrong and why it matters"
          },
          "proposed_fix": {
            "type": "string",
            "description": "The concrete change to make"
          },
          "behavior_change_risk": {
            "type": "string",
            "description": "Whether applying this fix could alter runtime behavior, and how it would be verified"
          }
        },
        "required": [
          "file",
          "symbol",
          "severity",
          "issue",
          "proposed_fix",
          "behavior_change_risk"
        ]
      }
    }
  },
  "required": [
    "senior_review_markdown",
    "verdict",
    "refinement_packets"
  ]
}
```