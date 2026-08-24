# Delta Refactor Plan — Week/Day Interaction Unification

**Run:** `20260822-125447-refactor-week-day-interaction` · **Intent:** refactor · **Phase:** architecture_design
**Revision:** rev-2 — scope cut at Gate 2 (FR-3 and FR-6 deferred; steps 1–4 retained)

> **Provenance note.** This document was assembled by the orchestrator from two dispatched
> attempts (`tp_arch_001`, `tp_arch_002`), both routed to `gemini-3.7-flash` per the
> `flash-agsdk-only` policy. Attempt 1 produced accurate structural content but an **unsound**
> D-1 (an optional-property brand, which creates no nominal type in TypeScript, plus
> `CalendarId | string` which widens to `string` — so both of its claimed compile-time
> guarantees were false). Attempt 2 fixed D-1 correctly but regressed sections 2–5, inventing
> six file paths that do not exist and type shapes contradicting the real source. The
> orchestrator kept attempt 2's D-1, restored attempt 1's structural content, and **corrected
> every type shape and file path against the actual files on disk**. Items marked
> **[orchestrator]** are additions from direct source reading that neither attempt produced.
>
> **rev-2 (Gate 2).** The human approved D-1's three judgment calls as-is (reuse `DateOnly`/
> `CalendarId`; reject `DateOnlySchema.parse()` at the boundary; keep `columnMoveCalendarId`'s
> cast honestly narrowed) and cut FR-3 + FR-6 from the run. Applied directly by the orchestrator
> as a deterministic scope edit — no re-dispatch, since re-generating the whole plan to remove
> two rows would have risked the same fabrication seen in attempt 2.

---

## 1. D-1 — Column-key type design (resolves Q1, Q2, Q3)

### 1.1 Reuse the repo's existing branded primitives — do not invent a brand

`packages/core/src/types/domain-primitives.ts` already defines Zod-branded nominal types:

```ts
export const CalendarIdSchema = ObjectIdStringSchema.brand<"CalendarId">();
export type CalendarId = z.infer<typeof CalendarIdSchema>;

export const DateOnlySchema = zYearMonthDayString.brand<"DateOnly">();
export type DateOnly = z.infer<typeof DateOnlySchema>;
```

`DateOnly` is already exactly the YYYY-MM-DD branded type this refactor needs. Declare the
column keys as aliases in a new file `packages/web/src/grid/interaction/types/column-key.types.ts`:

```ts
import { type CalendarId, type DateOnly } from "@core/types/domain-primitives";

/** Week columns are dates. */
export type DateColumnKey = DateOnly;

/**
 * Day columns are calendar ids when calendar columns are rendered, and a single
 * date key in the fallback case (see 1.3).
 */
export type DayColumnKey = CalendarId | DateOnly;
```

### 1.2 Why the guarantee actually holds

Zod's `.brand<"X">()` produces `string & z.$brand<"X">`, where the brand carrier is a
**required** symbol-keyed property. Therefore:

1. A plain `string` is **not** assignable to `DateOnly` or `CalendarId` — it lacks the required
   brand property.
2. `CalendarId` and `DateOnly` carry disjoint brand tags, so neither is assignable to the other.
3. `DayColumnKey = CalendarId | DateOnly` is a union of two branded types and does **not** widen
   to `string`.

This is precisely the property an optional `__brand?` would lack, and it is why the
cross-row guarantee in 1.4 is a genuine compile-time guarantee rather than a convention.

### 1.3 The Day fallback — a runtime argument, stated as such

`day-interaction.adapter.ts:254-263`:

```ts
const calendarColumnKeys = isDayDragTarget(target) ? getColumnKeys() : [];
const eventColumnIndex = calendarColumnKeys.indexOf(target.event.calendarId ?? "");
const columnKeys = eventColumnIndex >= 0 ? calendarColumnKeys : [visibleDateKey];
const initialColumnIndex = Math.max(0, eventColumnIndex);
const initialColumnKey = columnKeys[initialColumnIndex]!;
```

Day's key set is **either** calendar ids **or** a one-element array holding a date key, chosen
per interaction at runtime. The fallback fires for resizes and for a drag whose event's calendar
is not among the rendered columns.

`columnMoveCalendarId`'s existing cast is safe because in the fallback there is exactly one
column, so `visual.dayDate !== visual.initialDayDate` can never be true and the cast is
unreachable. **This is a runtime argument, not a static one** — the union type does not by
itself prove it. The signature becomes:

```ts
export const columnMoveCalendarId = (
  visual: Pick<TimedDragVisual<DayColumnKey>, "dayDate" | "initialDayDate">,
  event: GridEvent,
): CalendarId | undefined =>
  visual.dayDate !== visual.initialDayDate
    ? (visual.dayDate as CalendarId)
    : event.calendarId;
```

The residual `as CalendarId` narrows a `CalendarId | DateOnly` union on a runtime-established
invariant. It is narrower and better-documented than today's `string → CalendarId` cast, but it
is **not** eliminated. Do not claim otherwise in review.

### 1.4 Cross-row containment — a real compile-time guarantee

`grid/interaction/commit/cross-row.commit.ts` calls `dayjs(visual.dayDate)`. It is imported only
by Week (`adapter/interactions/timed.drag.ts`, `adapter/interactions/all-day.drag.ts`); Day never
reaches it, so this is latent, not a live bug. Pinning its signatures to the date-keyed type:

```ts
export const allDayDragVisualToTimedGridEvent = (
  event: GridEvent, visual: AllDayDragVisual<DateColumnKey>): GridEvent => ...
export const timedDragVisualToAllDayGridEvent = (
  event: GridEvent, visual: TimedDragVisual<DateColumnKey>): GridEvent => ...
```

makes a Day visual (`TimedDragVisual<DayColumnKey>`) a compile error at these call sites, so the
containment becomes structural rather than incidental.

### 1.5 Branding boundary — inside the allowlist

The branded values must enter somewhere; today the producers are plainly-typed `string[]`.

| View | Producer (declared) | Branding boundary | In allowlist? |
|---|---|---|---|
| Week | `WeekInteractionRuntime.getVisibleDays(): string[]` | `week-interaction.adapter.ts`, where visible days are read before building the layout cache | Yes (`views/Week/interaction/**`) |
| Day | `DayInteractionAdapterOptions.getColumnKeys?: () => string[]`, `getVisibleDate?: () => Dayjs` | `day-interaction.adapter.ts`, at the `columnKeys` construction quoted in 1.3 | Yes (`views/Day/interaction/**`) |

**Decision: the brand stops at the adapter boundary.** The runtime/coordinator implementations
that supply `getVisibleDays` / `getColumnKeys` keep their `string[]` signatures, so no edit is
needed outside `views/{Week,Day}/interaction/**`. **No allowlist blocker.**

### 1.6 **[orchestrator]** Use a cast helper at the boundary, not `DateOnlySchema.parse`

Attempt 2 proposed `DateOnlySchema.parse(day)` at the boundary. **Reject that**, on INV-1
grounds: the layout cache is rebuilt mid-drag (Week rebuilds it on edge navigation, see
`rebuildLayoutAfterNavigation`), so a `.parse()` there puts Zod validation on a per-frame hot
path and, worse, **throws** on any malformed input during a live drag. Today that input is
silently tolerated. Introducing a throw is a behavior change and violates INV-1/NFR-1.

Use an unchecked, single-purpose, documented cast helper co-located in the grid layer instead:

```ts
// packages/web/src/grid/interaction/types/column-key.types.ts
/**
 * Unchecked. The caller has already established these are the rendered column
 * keys; validation belongs where the columns are produced, not on the drag path.
 */
export const asDateColumnKeys = (keys: string[]): DateColumnKey[] =>
  keys as DateColumnKey[];
export const asDayColumnKeys = (keys: string[]): DayColumnKey[] =>
  keys as DayColumnKey[];
```

Confining the unsoundness to two named one-line helpers is the honest trade: the brand buys
static separation of the two key domains, and does not pretend to buy runtime validation.

### 1.7 Answers to Q2 and Q3

- **Q2:** *Moot for this run — FR-3 was cut at Gate 2 (see §4).* Recorded for the follow-up ticket:
  Day's decomposed modules should go in `packages/web/src/views/Day/interaction/adapter/interactions/`,
  mirroring Week 1:1 — **not** hoisted into `grid/interaction/adapter/`.
- **Q3:** Shared adapter types go in `packages/web/src/grid/interaction/types/adapter.types.ts`,
  keeping `types/` as the contract home and `adapter.helpers.ts` for executable helpers.

---

## 2. D-2 — Shared adapter types and per-view re-exports

Verified against the two real 149-line files: every Target and CommitResult is structurally
identical across views; the **only** difference is `registered: WeekRegisteredEventTarget` vs
`DayRegisteredEventTarget`. So Targets are generic over `TRegistered`; CommitResults are fully
shared with no generic.

New file `packages/web/src/grid/interaction/types/adapter.types.ts` — **exact shapes from source**:

```ts
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

// No view-specific member — fully shared.
export interface GridAllDayDragCommitResult {
  event: GridEvent; eventId: string;
  hadFormOpenBeforeInteraction: boolean; hasMoved: boolean;
  type: "allDayDragEnd";
}
export interface GridAllDayResizeCommitResult { /* ...same, */ type: "allDayResizeEnd"; }
export interface GridTimedDragCommitResult    { /* ...same, */ type: "timedDragEnd"; }
export interface GridTimedResizeCommitResult  { /* ...same, */ type: "timedResizeEnd"; }

export type GridInteractionCommitResult =
  | GridAllDayDragCommitResult | GridAllDayResizeCommitResult
  | GridTimedDragCommitResult  | GridTimedResizeCommitResult;

export type GridInteractionVisual<TColumnKey> =
  | AllDayDragVisual<TColumnKey> | AllDayResizeVisual
  | TimedDragVisual<TColumnKey>  | TimedResizeVisual;
```

> Discriminant literals are `"allDayDrag" | "allDayResize" | "timedDrag" | "timedResize"` and
> `"...End"` for commit results — **camelCase, exactly as on disk**. Both dispatched attempts got
> these wrong (`"all-day-drag"`, `{handled: boolean}`); do not reintroduce.

**Per-view files keep their names and become alias re-exports**, so all 25 external import sites
are untouched (NFR-5):

```ts
// week-interaction.adapter.types.ts
export type WeekAllDayDragTarget = GridAllDayDragTarget<WeekRegisteredEventTarget>;
export type WeekTimedDragCommitResult = GridTimedDragCommitResult;
export type WeekInteractionVisual = GridInteractionVisual<DateColumnKey>;
export type WeekEdgeNavigableVisual =
  | AllDayDragVisual<DateColumnKey> | TimedDragVisual<DateColumnKey>;
// ...and retains Week-only: WeekInteractionRuntime (getVisibleDays, onRequestWeekNavigation),
// WeekInteractionAdapterOptions (getLayoutSources -> WeekLayoutCacheSources),
// WeekInteractionAdapter (incl. rebuildLayoutAfterNavigation)

// day-interaction.adapter.types.ts
export type DayAllDayDragTarget = GridAllDayDragTarget<DayRegisteredEventTarget>;
export type DayInteractionVisual = GridInteractionVisual<DayColumnKey>;
// ...and retains Day-only: DayInteractionRuntime, DayInteractionAdapterOptions
// (getColumnKeys, getVisibleDate, getLayoutSources -> GridLayoutCacheSources), DayInteractionAdapter
```

---

## 3. Type-flow analysis

```
GridLayoutCacheOptions<TColumnKey>.visibleDates: TColumnKey[]
  ↓  buildTimedGridLayoutCache / buildAllDayGridLayoutCache
DayColumnCache<TColumnKey>.date: TColumnKey   (in GridLayoutCache.dayColumns)
  ↓  math/timed.drag.ts, math/all-day.drag.ts:  dayDate: nextColumn?.date ?? visual.dayDate
TimedDragVisual<TColumnKey>.dayDate / .initialDayDate
AllDayDragVisual<TColumnKey>.dayDate / .initialDayDate
  ↓
Week commits (date math, cross-row)  |  Day commit (columnMoveCalendarId → CalendarId)
```

**Declarations that must change** (all verified to exist):

| File | Declarations |
|---|---|
| `grid/interaction/types/column-key.types.ts` | **new** — `DateColumnKey`, `DayColumnKey`, `asDateColumnKeys`, `asDayColumnKeys` |
| `grid/interaction/layout.cache.ts` | `GridLayoutCacheOptions<TColumnKey>`, `DayColumnCache<TColumnKey>`, `GridLayoutCache<TColumnKey>`, `BuildDayColumnsInput`, `buildTimedGridLayoutCache`, `buildAllDayGridLayoutCache`, and the drag/nearest-column helpers |
| `grid/interaction/types/timed-drag.types.ts` | `TimedDragVisual<TColumnKey>` (`dayDate`, `initialDayDate`) |
| `grid/interaction/types/all-day-drag.types.ts` | `AllDayDragVisual<TColumnKey>` (`dayDate`, `initialDayDate`) |
| `grid/interaction/math/timed.drag.ts`, `math/all-day.drag.ts` | thread `TColumnKey` through the input/result types |
| `grid/interaction/commit/cross-row.commit.ts` | pin both exports to `<DateColumnKey>` |
| `grid/interaction/commit/timed-moved.ts` | generic over `TColumnKey` (compares keys only) |
| `views/Day/interaction/adapter/commit/timed.commit.ts` | `columnMoveCalendarId` signature (type-only touch — permitted narrow exception to the "don't touch commit" rule) |
| `views/Week/interaction/adapter/commit/*.commit.ts` | bind visual params to `DateColumnKey` (type-only) |

`AllDayResizeVisual` and `TimedResizeVisual` carry no column key — leave them alone.

---

## 4. Sequenced work plan

Each step must be independently type-checkable. **FR-1 lands strictly first.**

| # | FR | Files | Risk |
|---|---|---|---|
| 1 | FR-1 | `types/column-key.types.ts` (new), `types/timed-drag.types.ts`, `types/all-day-drag.types.ts`, `layout.cache.ts`, `math/{timed,all-day}.drag.ts`, `commit/cross-row.commit.ts`, `commit/timed-moved.ts`, both adapters' branding boundary, both views' commit signatures | **Medium** — widest type surface; `TColumnKey` defaults keep intermediate states compiling |
| 2 | FR-2 | `types/adapter.types.ts` (new), `week-interaction.adapter.types.ts`, `day-interaction.adapter.types.ts` | **Low** — pure type aliases, zero runtime |
| 3 | FR-5 | `geometry/week-layout.cache.ts`, `geometry/day-layout.cache.ts` (Day already aliases the shared types verbatim) | **Low** |
| 4 | — | `.gitignore` — add `.sdlc/` and `.hook-logs/` | **Low** |

### Cut — deferred to a follow-up ticket

| FR | What it was | Why deferred |
|---|---|---|
| **FR-3** | Decompose `day-interaction.adapter.ts` (607 LOC) into `adapter/interactions/{all-day.drag,all-day.resize,timed.drag,timed.resize}.ts` mirroring Week | Cut at Gate 2. Largest behavioral surface in the run |
| **FR-6** | Harmonize `WeekInteractionCoordinator.tsx` / `DayInteractionCoordinator.tsx` behind a shared hook | Cut at Gate 2. Behavior-changing; depends on FR-3's shape |
| **FR-4** | Extract shared adapter lifecycle helpers (target resolution, draft mounting, cancellation) into `grid/interaction/adapter.helpers.ts` and have both adapters consume them | **Cut mid-execution**, after the run hit two environment-level vendor failures. It was the only remaining step that moves *runtime* code rather than types, and it touches both the 795-line and 607-line adapters. Same reasoning as the Gate 2 cut: rough dispatch quality, no fallback tier under `flash-agsdk-only`, shrink the blast radius. |

**Net delivered scope: FR-1 + FR-2 + FR-5** — a type-safety and type-deduplication change with no runtime edits.

**Rationale (Gate 2, human decision).** Steps 1–4 are type-level and helper-extraction work;
steps 5–6 were the only two that could change runtime behavior. Phase 2's own dispatch quality
was poor — one unsound type design, one with six hallucinated file paths — and under
`flash-agsdk-only` there is no stronger fallback tier to escalate to mid-run. That argues for a
smaller blast radius, not a larger one. FR-3/FR-6 are deferred until the FR-1 type-safety
foundation from this run is in place and battle-tested.

**Consequence for scope:** no file under `views/Day/interaction/adapter/interactions/` is created,
and neither coordinator `.tsx` is modified. Both coordinators' tests remain in the suite purely as
regression guards (INV-3, INV-10).

---

## 5. Invariant test strategy

Every file below was verified to exist. This is a refactor: prefer existing coverage.

| INV | Existing coverage | Action |
|---|---|---|
| INV-1 drag visuals/snapping | `grid/interaction/math/timed.interaction.test.ts`, `math/all-day.interaction.test.ts`, `math/smart-scroll.test.ts` | Existing — must stay green unmodified |
| INV-2 resize boundaries | `views/Week/.../week-interaction.timed-resize.test.ts`, `week-interaction.all-day-resize.test.ts` | Existing |
| INV-3 keyboard/focus/cancel | `WeekInteractionCoordinator.test.ts`, `DayInteractionCoordinator.test.tsx`, `interaction/dom/cursor.lock.test.ts`, `interaction/react/PointerCaptureBoundary.test.tsx` | Existing |
| INV-4 Week columns=days | `week-interaction.timed-drag.test.ts`, `week-interaction.all-day-drag.test.ts` | Existing |
| INV-5 Day columns=calendars | `day-interaction.adapter.test.ts` | Existing |
| INV-6 Day all-day never rewrites dates | `day-interaction.adapter.test.ts:444` — *"keeps a multi-day all-day event's dates on a cross-calendar move"* | **Already covered — no new test needed.** Verified during execution: it asserts `calendarId` becomes CALENDAR_B while `startDate` and `endDate` stay byte-identical. This plan's earlier "NEW ASSERTION" claim was wrong; the coverage predates the run and passes. |
| INV-7 Day timed pins to visibleDate / fallback | `day-interaction.adapter.test.ts:457` — *"disables cross-column movement for an event whose calendar has no column"* | **Already covered — no new test needed.** Exercises the exact single-column fallback that `columnMoveCalendarId`'s residual cast relies on (§1.3), asserting no calendar change and `hasMoved: false`. |
| INV-8 `updateVisual` idempotence | `interaction/interaction.engine.test.ts` | Existing |
| INV-9 DOM attribute scheme | `week-event.targeting.test.ts`, `day-event.targeting.test.ts`, `view-event-registry.test.ts`, `event.registry.test.ts`, `components/ContextMenu/contextMenuLayering.test.tsx` | Existing |
| INV-10 Week edge nav / layout rebuild | `week-interaction.cross-row-drag.test.ts`, `grid/interaction/commit/cross-row.commit.test.ts`, `math/cross-row.drag.test.ts` | Existing |
| — layout cache | `grid/interaction/layout.cache.test.ts` | Existing — directly exercises the step-1 generic |

---

## 6. Verification after every step

```bash
bun run type-check    # exit 0, no `any`, no ts-expect-error/ts-ignore added
bun run lint          # Biome, exit 0
bun run test:web      # baseline 2298 pass / 0 fail — zero regressions
```

Interaction-only subset (159/159, ~3.6s) is the fast inner loop; the full `test:web` (~86.5s) is
the gate before declaring any step done. A step that cannot reach all three green is reverted,
not patched forward.

---

## 7. Explicitly not doing

1. **No merge of `commit/*.commit.ts` logic** — Week day-deltas vs Day calendar-reassignment are
   divergent by design. Type-only signature touches (§3) are the sole permitted exception.
2. **No change to `interaction.engine.ts`** — already generic.
3. **No change to `interaction.adapter.types.ts`** — the `InteractionAdapter<TTarget, TVisual, TResult>`
   contract already accommodates this design; it is in the allowlist only as a contingency and is
   not expected to be touched.
4. **No further collapse of the registry/targeting shims.**
5. **No edits under `packages/core/**`** — `DateOnly`/`CalendarId` are imported read-only.
6. **No fixing the pre-existing `act(...)` warnings** in `DayInteractionCoordinator.test.tsx`.
7. **No renaming** of `data-${view}-interaction-event-*` attributes or the
   `CALENDAR_VIEW_INTERACTION_ID_ATTRIBUTES` / `readCalendarEventIdFromElement` exports.
8. **No decomposition of `day-interaction.adapter.ts`** (FR-3) — cut at Gate 2, deferred. The file
   is still touched in step 1 (branding boundary) and step 4 (adopting shared helpers), but its
   monolithic structure is left intact.
9. **No changes to either coordinator `.tsx`** (FR-6) — cut at Gate 2, deferred.
