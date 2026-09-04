# Change Plan — refactor — Unify the Week/Day interaction adapter layer

- **Run:** `20260903-181010-refactor-week-day-interaction`
- **Intent:** `refactor` → delta plan, not a greenfield design
- **Contract:** `requirements.md` §3 (P-0..P-5) and §4 (R-1..R-5) are binding
- **Allowlist (frozen):** `packages/web/src/grid/interaction/**`,
  `packages/web/src/views/Week/interaction/**`, `packages/web/src/views/Day/interaction/**`
- **Every path in this plan was checked against that allowlist.** No step touches
  `packages/web/src/interaction/**` (the engine) or anything else outside the three globs.

---

## 0. Findings that change the approved plan — read before Gate 2

Two statements in the inputs did not survive contact with the code. Both are recorded here rather
than quietly worked around.

### F-1 (blocking a Gate-2 acknowledgement) · Week does **not** call `runtime()` twice in `handlePointerUp`

`requirements.md` §2 and the architecture brief both assert: *"Week calls `runtime()` inside the
click branch **and again** after it (lines 208, 219); Day calls it once before the branch (line
163). Any hoisted version picks one. That is a real, if small, behavior change."*

Reading `views/Week/interaction/adapter/week-interaction.adapter.ts:199-239`:

- L203 `if (!result) return isOwnedPointer;`
- L207 `if (result.type === "click") {` … L208 `const currentRuntime = runtime();` … **L216
  `return isOwnedPointer;`**
- L219 `const currentRuntime = runtime();` — reached **only when L207 was false**

Lines 208 and 219 are on **mutually exclusive branches**. Week calls `runtime()` exactly **once**
on the click path, exactly **once** on the commit path, and **zero** times on the `!result` path.
Day (`day-interaction.adapter.ts:155-193`) has the identical profile: once at L163 for any non-null
result, zero on the `!result` path at L159.

The only structural difference is that Week reads the runtime *after* evaluating `result.type ===
"click"` while Day reads it *before*. `result.type` is a property read on a plain object with no
getter and no side effect, and there is no other statement between the `!result` guard and the
branch in either view. **The two shapes are behaviorally identical, on every path, for every
possible `runtime` closure — including a spy that counts calls.**

**Consequence.** The `runtimeReadStrategy` injection the requirements imply is unnecessary
complexity in shared code. The skeleton hoists **one read before the branch** (Day's shape) and
that is provably byte-equivalent for Week. §8/Q-1 asks Gate 2 to acknowledge the correction, since
it overrides an explicitly approved §2 clause. A fallback design (injected strategy flag) is
specified in §4/S12 in case the gate prefers to honour the letter of the approved text.

The *other* §2 asymmetry — `setWeekInteractionMotionActive(false)` in Week's click branch (L215),
with no Day counterpart — **is real and is preserved exactly** as an injected hook that Day leaves
as a no-op.

### F-2 (shapes the R-1 design) · Day column keys are **not** all calendar ids

`day-interaction.adapter.ts:245` computes `visibleDateKey = getVisibleDate().format(YEAR_MONTH_DAY_FORMAT)`
— a `YYYY-MM-DD` string — and L261 uses `[visibleDateKey]` as the **entire** `columnKeys` array
whenever the event's calendar is not among the rendered columns. `commit/timed.commit.ts:71-76`
documents and depends on this ("the single-column fallback, whose one key is a date string that
never changes").

So Day's column-key space is `CalendarId ∪ {one YYYY-MM-DD fallback}`. Branding it as `CalendarId`
(from `packages/core/src/types/domain-primitives.ts:21`, which is
`ObjectIdStringSchema.brand<"CalendarId">` — a 24-hex ObjectId) would be a type-level lie that the
fallback path immediately violates. **Day's discriminant must brand the column-key *role*, not the
value format.** This kills the "just reuse `CalendarId` and `DateOnly`" shortcut; see §2.

### F-3 (small, non-blocking) · `getSourceElementDraftEventMode` is Band A, not Band C

`week:348-349` (`isDragTarget`) and `day:328-329` (`isDayDragTarget`) call two differently-named
helpers with byte-identical bodies (`type === "allDayDrag" || type === "timedDrag"` at
`week:760-763` and `day-layout.cache.ts:73-76`). The member is hoistable and is folded into R-2.
`isDayDragTarget` keeps its export from `day-layout.cache.ts` (it is also used at `day:254`).

---

## 1. Summary

**What changes.** `grid/interaction/` gains a column-key discriminant, a generic adapter-boundary
type layer, and a shared adapter factory. `week-interaction.adapter.ts` (795 LOC) and
`day-interaction.adapter.ts` (607 LOC) shrink to: view-local state, `createVisual`/`updateVisual`
(Band C), a commit dispatch closure, and a hooks object handed to the shared factory.

**What provably does not change.**

| Not changed | Why it is provable |
|---|---|
| `packages/web/src/interaction/**` | Outside the allowlist; the write-contract validator rejects it. Verified by `git status --porcelain` (§6, P-0). |
| Runtime shape of any visual, layout cache, or commit result | The discriminant is a compile-time-only brand (§2). Zero emitted-JS difference. |
| The 4-probe target order, Day's single-column fallback, Week's all-day-row scroll suppression, Day's all-day commit never rewriting dates | Band C bodies are moved verbatim or not at all; the probe order is hoisted as one copy of the existing sequence. |
| Edge navigation gains no third writer | The shared layer never imports `edge-navigation.state`; grep-enforced (§6). |
| `data-${view}-interaction-event-*` scheme | `view-event-registry.ts` L26-48 is untouched by every step; only the *type* `ViewRegisteredEventTarget` gains a phantom parameter. |
| Commit modules stay per-view | Band C non-goal; §7. |

**Net direction of the LOC move:** duplication leaves the two view adapters and lands once in
`grid/interaction/adapter/`; it does not land in the engine.

---

## 2. Discriminant design (R-1)

### 2.1 The hazard, restated from the code

Four fields carry an untagged union:

| Field | Declared | Week meaning | Day meaning |
|---|---|---|---|
| `TimedDragVisual.dayDate` | `types/timed-drag.types.ts:38` `string` | local `YYYY-MM-DD` | calendar id **or** the fallback date (F-2) |
| `TimedDragVisual.initialDayDate` | `types/timed-drag.types.ts:44` `string` | same | same |
| `AllDayDragVisual.dayDate` | `types/all-day-drag.types.ts:28` `string` | same | same |
| `AllDayDragVisual.initialDayDate` | `types/all-day-drag.types.ts:32` `string` | same | same |

They are produced from `DayColumnCache.date` (`layout.cache.ts:26`, also `string`) via
`getNearestDayColumn` (`layout.cache.ts:194`) and `resolveDragColumn` (`drag-column.ts:14`), and
consumed by `dayjs(visual.dayDate)` on the Week side (`Week/.../commit/timed.commit.ts:18`,
`Week/.../commit/all-day.commit.ts:18`, `grid/interaction/commit/cross-row.commit.ts:22,45`) and by
an unchecked `visual.dayDate as CalendarId` on the Day side
(`Day/.../commit/timed.commit.ts:82`).

### 2.2 Options considered

**(C) Generic parameter, no brand — rejected outright.**
`TimedDragVisual<TKey extends string>` with `type WeekColumnKey = string; type DayColumnKey =
string` gives two instantiations that both erase to `TimedDragVisual<string>`. TypeScript is
structural: they are mutually assignable and the check is worth nothing. This is *exactly* the
existing hole — `WeekRegisteredEventTarget` and `DayRegisteredEventTarget` are both bare aliases of
`ViewRegisteredEventTarget` (`week-event.registry.ts:14`, `day-event.registry.ts:14`) — and
`requirements.md` §4 R-4 explicitly forbids preserving it. Rejected.

**(B) Tagged wrapper object `{ kind: "date"; value: string }` — rejected on P-3.**
Strongest discrimination and runtime-checkable, but it changes the runtime shape of `dayDate`, and
four live sites compare these fields by `!==`:

- `grid/interaction/commit/timed-moved.ts:5` — `visual.dayDate !== visual.initialDayDate`
- `Week/.../commit/all-day.commit.ts:8` — `hasAllDayDragVisualMoved`
- `Day/.../commit/all-day.commit.ts:19` — `hasMoved`
- `Day/.../commit/timed.commit.ts:81` — `columnMoveCalendarId`

Under object identity every one of those becomes **unconditionally true** — `createTimedDragVisual`
(`math/timed.drag.ts:44,48`) assigns the same reference to both fields today, but
`updateTimedDragVisual:114` writes a fresh `nextColumn.date`, so post-update the two wrappers would
never be identity-equal. `hasMoved` would report `true` for every drag that ends where it started,
on both views. That is a silent, catastrophic P-3 violation that four separate `columnKeysEqual()`
edits would have to catch with 100% hit rate.

It also forces `.value` at six `dayjs(...)` sites, changes `DayColumnCache.date` to the wrapper,
and breaks `grid/interaction/layout.cache.test.ts:19-20`'s
`toMatchObject({ date: "2026-06-28" })` — pressure on P-4 (assertion rewrite, not an import
repoint). Rejected.

**(A) Branded/nominal string types + generic visual types with a default — chosen.**

```ts
// packages/web/src/grid/interaction/types/column-key.types.ts   (NEW)
declare const COLUMN_KEY_BRAND: unique symbol;

/** Compile-time-only tag. Erases completely; no runtime representation. */
export type ColumnKey<TKind extends string> = string & {
  readonly [COLUMN_KEY_BRAND]: TKind;
};

/** Week: local YYYY-MM-DD date of a rendered day column. */
export type DateColumnKey = ColumnKey<"date">;

/**
 * Day: a rendered calendar column's id, OR the single YYYY-MM-DD fallback key
 * used when the event's calendar is not among the rendered columns
 * (day-interaction.adapter.ts:245,261). Deliberately NOT `CalendarId` — see the
 * fallback note on columnMoveCalendarId.
 */
export type CalendarColumnKey = ColumnKey<"calendar">;

/** Compatibility default for the generic visual/layout types. Never widen past this. */
export type AnyColumnKey = CalendarColumnKey | DateColumnKey;
```

### 2.3 ADR — Branded column keys with defaulted generic visual and layout types

**Context.** Four `string` fields carry a two-valued untagged union across a shared layer that is
about to become genuinely shared. `type-check` is currently not a safety net (both view target
aliases resolve to one type; the 16 view interfaces are structurally identical), so a hoisted
method can silently apply Week semantics to a Day value. The write contract forbids editing the
runtime implementers of `getVisibleDays(): string[]`
(`week-interaction.adapter.types.ts:38`, implemented outside the allowlist) and the outside
consumers listed in P-1, so the boundary signatures that carry raw `string[]` **cannot** be
tightened.

**Decision.** Introduce a zero-runtime nominal brand `ColumnKey<TKind>` with two instantiations,
`DateColumnKey` (Week) and `CalendarColumnKey` (Day). Make `TimedDragVisual`, `AllDayDragVisual`,
`DayColumnCache`, `GridLayoutCache`, `GridLayoutCacheOptions` and the drag math generic over
`TColumnKey extends string`, **with a default of `AnyColumnKey`**. Each view's column keys acquire
their brand at exactly **one** documented cast site, inside that view's layout-cache module. The
brand crosses into `CalendarId` at exactly **one** named conversion function.

**Why the brand is nominal and not `DateOnly` / `CalendarId` from `@core`.** Two hard reasons.
(i) F-2: Day's fallback key is a date string, so `CalendarId` (a 24-hex ObjectId brand) is factually
wrong for it. (ii) `DateOnly` and `CalendarId` are zod-v4 runtime brands
(`packages/core/src/types/domain-primitives.ts:21-25`); adopting them would couple the
dependency-free `grid/interaction/types/` layer to zod for a purely compile-time need, and would
make `visibleDates` inhabitable only by values that have passed a schema — which the Week runtime
boundary (`string[]`, unowned) cannot promise.

**Why the default is mandatory and must be `AnyColumnKey`.** The P-1 import scan says the only
symbol consumed from `types/timed-drag.types` outside the allowlist is `DragRow`. If that scan is
even slightly incomplete and some out-of-allowlist module writes a bare `TimedDragVisual`, removing
the default makes `type-check` fail **in a file this run is forbidden to edit** — an unrecoverable
dead end mid-run. The default is a contract-safety device, not a convenience. `AnyColumnKey` (the
union) is the only default that keeps such a hypothetical caller compiling.

**Why the default does not defeat the discriminant.** `TimedDragVisual<DateColumnKey>` →
`TimedDragVisual<CalendarColumnKey>` requires `DateColumnKey` assignable to `CalendarColumnKey`,
i.e. `"date"` assignable to `"calendar"` — false in both directions. Mutual unassignability holds.
Both instantiations *are* assignable to the default `TimedDragVisual<AnyColumnKey>` (mutable
properties are checked covariantly), so the default must never appear in a shared **parameter**
position. Enforced by §6's grep: no in-scope non-test module may name `TimedDragVisual` /
`AllDayDragVisual` / `GridLayoutCache` without a type argument, except the type declarations
themselves.

**Consequences.**
- Positive: `updateTimedDragVisual<TKey>(visual: TimedDragVisual<TKey>, { layout: GridLayoutCache<TKey> })`
  makes "Week layout + Day visual" a compile error. That is the precondition R-2/R-3 need.
- Positive: `grid/interaction/commit/cross-row.commit.ts` narrows to `DateColumnKey`, so feeding a
  Day visual into the cross-row commit becomes a compile error. This is a direct, type-level answer
  to the brief's named hazard ("shared `row`/`crossRowSize`/`timedStartMinutes` make Day *look*
  cross-row capable"). It does **not** remove those fields (out of scope, R-5).
- Positive: the existing unchecked `as CalendarId` becomes one named, commented conversion.
- Negative: two `as`-casts are introduced (one per view, §2.5) and one `as TRegistered` cast in the
  shared registry boundary (§3.2). All three are single-point, commented, and covered by §6 greps.
- Negative: three annotation-only test edits (§2.4). No assertion is touched; P-4 holds.
- Negative: generic signatures make several shared math functions marginally noisier to read.

### 2.4 Full call-site list (file:line)

Every path below is inside the allowlist. Line numbers are HEAD (`2d81253a`) as read this phase.

**New file**

| Path | Contents |
|---|---|
| `packages/web/src/grid/interaction/types/column-key.types.ts` | `ColumnKey`, `DateColumnKey`, `CalendarColumnKey`, `AnyColumnKey` (§2.2) |

**`packages/web/src/grid/interaction/types/timed-drag.types.ts`**

| Line | Change |
|---|---|
| 30 | `interface TimedDragVisual` → `interface TimedDragVisual<TColumnKey extends string = AnyColumnKey>` |
| 31-37 | doc comment: replace the "do not dayjs-parse this without knowing which view produced it" warning with a pointer to `ColumnKey` (the warning is now compiler-enforced) |
| 38 | `dayDate: string;` → `dayDate: TColumnKey;` |
| 43-44 | comment + `initialDayDate: string;` → `initialDayDate: TColumnKey;` |
| 14, 22 | `DragRow`, `CrossRowSize` — **unchanged** (`DragRow` is P-1 frozen for `draft-drag-schedule.util.ts`) |

**`packages/web/src/grid/interaction/types/all-day-drag.types.ts`**

| Line | Change |
|---|---|
| 14 | `interface AllDayDragVisual` → `<TColumnKey extends string = AnyColumnKey>` |
| 16-27 | doc comment updated (delta-vs-absolute semantics text kept verbatim) |
| 28 | `dayDate: string;` → `dayDate: TColumnKey;` |
| 31-32 | `initialDayDate: string;` → `initialDayDate: TColumnKey;` |

**`packages/web/src/grid/interaction/layout.cache.ts`**

| Line | Change |
|---|---|
| 9-22 | `interface GridLayoutCacheOptions<TKey extends string = AnyColumnKey>`; L20-21 `visibleDates: string[]` → `TKey[]` |
| 24-30 | `interface DayColumnCache<TKey extends string = AnyColumnKey>`; L26 `date: string` → `date: TKey` |
| 50-63 | `interface GridLayoutCache<TKey extends string = AnyColumnKey>`; L57 `crossRow?: GridLayoutCache<TKey>`; L58 `dayColumns: DayColumnCache<TKey>[]` |
| 65-69 | `interface BuildDayColumnsInput<TKey extends string = AnyColumnKey>`; L67 `visibleDates: TKey[]` |
| 71-81 | `buildTimedGridLayoutCache` → `<TKey extends string = AnyColumnKey>(options: GridLayoutCacheOptions<TKey> & GridLayoutCacheSources): GridLayoutCache<TKey> \| null` |
| 95 | `buildDayColumns(columnsRect, visibleDates)` — resolves to the `TKey` overload; no edit |
| 122-128 | `buildAllDayGridLayoutCache` — same generic treatment |
| 157-167 | `buildDragGridLayoutCache` — same; L163-166 `primary`/`crossRow` inherit `TKey` |
| 169-192 | both `buildDayColumns` overloads gain `<TKey extends string = AnyColumnKey>`; L186-191 returns `DayColumnCache<TKey>[]` |
| 194-209 | `getNearestDayColumn<TKey extends string = AnyColumnKey>(columns: DayColumnCache<TKey>[], x: number): DayColumnCache<TKey> \| null` |

**`packages/web/src/grid/interaction/math/drag-column.ts`**

| Line | Change |
|---|---|
| 14-24 | `resolveDragColumn` → `<TKey extends string>`; L21 `layout: GridLayoutCache<TKey>` |
| 25-34 | bodies unchanged; `initialColumn` / `nextColumn` infer `DayColumnCache<TKey>` |
| 36-39 | return type becomes `{ nextColumn: DayColumnCache<TKey> \| null; transformX: number }` |

**`packages/web/src/grid/interaction/math/cross-row.drag.ts`**

| Line | Change |
|---|---|
| 24-29 | `interface CrossRowPlacement<TKey extends string>`; L25 `column: DayColumnCache<TKey> \| null` |
| 32-38 | `getDragRowLayouts<TKey extends string>(layout: GridLayoutCache<TKey>, …)` |
| 48-67 | `resolveDragRow<TKey extends string>` — reads no key; parameterised for uniformity |
| 75-116 | `getCrossRowTimedPlacement<TKey extends string>`; L84 `getNearestDayColumn` inherits `TKey` |
| 119-139 | `getCrossRowAllDayPlacement<TKey extends string>`; L128 same |
| 22 | `CROSS_ROW_TIMED_DURATION_MIN` — **unchanged** (P-1 frozen) |

**`packages/web/src/grid/interaction/math/timed.drag.ts`**

| Line | Change |
|---|---|
| 17-25 | `CreateTimedDragVisualInput<TKey extends string>`; L18 `dayDate: string` → `TKey` |
| 27-31 | `UpdateTimedDragVisualInput<TKey extends string>`; L28 `layout: GridLayoutCache<TKey>` |
| 33-41 | `createTimedDragVisual<TKey extends string>(…): TimedDragVisual<TKey>` |
| 60-63 | `updateTimedDragVisual<TKey extends string>(visual: TimedDragVisual<TKey>, …): TimedDragVisual<TKey>` |
| 85, 114 | `placement.column?.date` / `nextColumn?.date` now `TKey`; no edit needed |
| 127-137 | `getBoundedVerticalPlacement` — parameterise `layout`/`visual` on `TKey` |
| 194-195 | `getCurrentScrollTop` — reads no key; leave on the default |

**`packages/web/src/grid/interaction/math/all-day.drag.ts`**

| Line | Change |
|---|---|
| 11-17 | `CreateAllDayDragVisualInput<TKey extends string>`; L12 `dayDate: string` → `TKey` |
| 19-22 | `UpdateAllDayDragVisualInput<TKey extends string>`; L20 `layout: GridLayoutCache<TKey>` |
| 24-30 | `createAllDayDragVisual<TKey extends string>(…): AllDayDragVisual<TKey>` |
| 45-48 | `updateAllDayDragVisual<TKey extends string>(visual: AllDayDragVisual<TKey>, …): AllDayDragVisual<TKey>` |
| 70, 88 | `column?.date` now `TKey`; no edit needed |

**`packages/web/src/grid/interaction/math/all-day.resize.ts`, `math/timed.resize.ts`,
`math/snap.ts`, `math/smart-scroll.ts`** — resize visuals carry no column key; expected **zero
change** against the defaulted `GridLayoutCache`. Not asserted (not read this phase). If the
compiler disagrees, the fix is a mechanical `<TKey extends string>` addition and nothing else.
`clamp` (`math/snap`) is P-1 frozen and is not touched.

**`packages/web/src/grid/interaction/commit/timed-moved.ts`**

| Line | Change |
|---|---|
| 4 | `hasTimedDragVisualMoved = <TKey extends string>(visual: TimedDragVisual<TKey>)`; L5-7 body unchanged |
| 9-11 | `hasTimedResizeVisualMoved` — **unchanged** (no column key) |

**`packages/web/src/grid/interaction/commit/cross-row.commit.ts`** — narrowed to Week

| Line | Change |
|---|---|
| 18-21 | `allDayDragVisualToTimedGridEvent(event, visual: AllDayDragVisual<DateColumnKey>)` |
| 22 | `dayjs(visual.dayDate)` — now type-justified, comment updated |
| 41-44 | `timedDragVisualToAllDayGridEvent(event, visual: TimedDragVisual<DateColumnKey>)` |
| 45 | `dayjs(visual.dayDate)` — same |

**`packages/web/src/views/Week/interaction/adapter/geometry/week-layout.cache.ts`** — Week brand entry

| Line | Change |
|---|---|
| 32-35 | `WeekLayoutCacheInput.visibleDays: string[]` — **stays `string[]`.** Fed by `runtime().getVisibleDays()` whose implementer is outside the allowlist. |
| 37 | `export type WeekLayoutCache = GridLayoutCache;` → `= GridLayoutCache<DateColumnKey>;` |
| 41-43 | return type → `GridLayoutCacheOptions<DateColumnKey> & WeekLayoutCacheSources` |
| **55** | **`visibleDates: sources.visibleDays,` → `visibleDates: sources.visibleDays as DateColumnKey[],`** — the sole Week brand-entry cast (§2.5) |
| 39, 58-73 | `getNearestDayColumn` re-export and the three builders — no edit; return types follow the alias |

**`packages/web/src/views/Day/interaction/adapter/geometry/day-layout.cache.ts`** — Day brand entry

| Line | Change |
|---|---|
| 25 | `export type DayLayoutCache = GridLayoutCache;` → `= GridLayoutCache<CalendarColumnKey>;` |
| new | `export const asDayColumnKeys = (keys: string[]): CalendarColumnKey[] => keys as CalendarColumnKey[];` — the sole Day brand-entry cast (§2.5) |
| 28-31 | `buildDayTimedLayoutCache(sources, visibleDates: string[])` → `visibleDates: CalendarColumnKey[]`, returns `DayLayoutCache \| null` |
| 46-49 | `buildDayAllDayLayoutCache` — same |
| 64-71 | `buildDayLayoutCacheForTarget(target, sources, visibleDates: string[])` → `CalendarColumnKey[]` |
| 73-76 | `isDayDragTarget` — export kept (used at `day:254`, `day:329`); body may delegate to the shared predicate in R-2 |

**`packages/web/src/views/Day/interaction/adapter/day-interaction.adapter.ts`**

| Line | Change |
|---|---|
| 15 | import `GridLayoutCache` from `@web/grid/interaction/layout.cache` → import `DayLayoutCache` from `./geometry/day-layout.cache`; add `asDayColumnKeys` |
| 95 | `let layout: GridLayoutCache \| null` → `let layout: DayLayoutCache \| null` |
| 254-259 | unchanged — `calendarColumnKeys` stays raw `string[]` so `indexOf(target.event.calendarId ?? "")` at L257-259 still compiles |
| **260-261** | `const columnKeys = asDayColumnKeys(eventColumnIndex >= 0 ? calendarColumnKeys : [visibleDateKey]);` |
| 263 | `initialColumnKey` now infers `CalendarColumnKey` — no edit |
| 281-287 | `createAllDayDragVisual({ dayDate: initialColumnKey, … })` infers `AllDayDragVisual<CalendarColumnKey>` — no edit |
| 312-320 | `createTimedDragVisual({ dayDate: initialColumnKey, … })` infers `TimedDragVisual<CalendarColumnKey>` — no edit |
| 340-343, 402-406 | `updateAllDayDragVisual` / `updateTimedDragVisual` — now key-checked against `layout`; no edit |
| 290-310 | all-day/timed **resize** creators — no column key; no edit |

**`packages/web/src/views/Day/interaction/adapter/day-interaction.adapter.types.ts`**

| Line | Change |
|---|---|
| 27-34 | `getColumnKeys?: () => string[]` — **stays `string[]`** (option boundary); doc comment gains a pointer to `asDayColumnKeys` |
| 121-125 | `DayInteractionVisual` → `AllDayDragVisual<CalendarColumnKey> \| AllDayResizeVisual \| TimedDragVisual<CalendarColumnKey> \| TimedResizeVisual` |

**`packages/web/src/views/Week/interaction/adapter/week-interaction.adapter.types.ts`**

| Line | Change |
|---|---|
| 33-38 | `getVisibleDays(): string[]` — **stays `string[]`** (runtime boundary, outside implementer) |
| 118-122 | `WeekInteractionVisual` → `AllDayDragVisual<DateColumnKey> \| AllDayResizeVisual \| TimedDragVisual<DateColumnKey> \| TimedResizeVisual` |
| 130 | `WeekEdgeNavigableVisual = AllDayDragVisual<DateColumnKey> \| TimedDragVisual<DateColumnKey>` |

**`packages/web/src/views/Week/interaction/adapter/commit/timed.commit.ts`**

| Line | Change |
|---|---|
| 10 | re-export of `hasTimedDragVisualMoved` (now generic) — no edit |
| 12-15 | `timedDragVisualToGridEvent(event, visual: TimedDragVisual<DateColumnKey>)` |
| 18 | `dayjs(visual.dayDate)` — type-justified; comment updated |
| 27-38 | `timedResizeVisualToGridEvent` — no column key; no edit |

**`packages/web/src/views/Week/interaction/adapter/commit/all-day.commit.ts`**

| Line | Change |
|---|---|
| 7-8 | `hasAllDayDragVisualMoved = (visual: AllDayDragVisual<DateColumnKey>)` |
| 10-13 | `allDayDragVisualToGridEvent(event, visual: AllDayDragVisual<DateColumnKey>)` |
| 18-21 | `dayjs(visual.dayDate).diff(dayjs(visual.initialDayDate), "day")` — type-justified |
| 34-65 | all-day resize helpers — no column key; no edit |

**`packages/web/src/views/Week/interaction/adapter/interactions/timed.drag.ts`**

| Line | Change |
|---|---|
| 45 | `column.date === startDateKey` — `DateColumnKey === string` is a legal comparison (the operands overlap); **no cast needed** |
| 46, 52-60 | `getNearestDayColumn` / `createTimedDragVisual` infer `DateColumnKey` from `WeekLayoutCache` — no edit |
| 74 | `visual: TimedDragVisual` → `TimedDragVisual<DateColumnKey>` |
| 93-95 | `commitTimedDragInteraction(target, visual: TimedDragVisual<DateColumnKey>)` |

**`packages/web/src/views/Week/interaction/adapter/interactions/all-day.drag.ts`**

| Line | Change |
|---|---|
| 35, 41-47 | infer `DateColumnKey` from `WeekLayoutCache` — no edit |
| 59 | `visual: AllDayDragVisual` → `AllDayDragVisual<DateColumnKey>` |
| 77-79 | `commitAllDayDragInteraction(target, visual: AllDayDragVisual<DateColumnKey>)` |

**`packages/web/src/views/Week/interaction/adapter/interactions/all-day.resize.ts`,
`interactions/timed.resize.ts`, `interactions/all-day.visible-range.ts`** — no column keys;
expected zero change (`all-day.visible-range.ts` not read this phase; flagged, not asserted).

**`packages/web/src/views/Day/interaction/adapter/commit/timed.commit.ts`** — the `as CalendarId` fix

| Line | Change |
|---|---|
| 8 | add `CalendarColumnKey` to the type imports |
| 17-21 | `commitTimedDragInteraction(target, visual: TimedDragVisual<CalendarColumnKey>, …)` |
| 53-57 | `timedDragVisualToDayGridEvent(event, visual: TimedDragVisual<CalendarColumnKey>, …)` |
| 77-79 | `columnMoveCalendarId(visual: Pick<TimedDragVisual<CalendarColumnKey>, "dayDate" \| "initialDayDate">, …)` |
| 81 | `visual.dayDate !== visual.initialDayDate` — unchanged, same operand types |
| **82** | `(visual.dayDate as CalendarId)` → `columnKeyAsCalendarId(visual.dayDate)` |
| new | `const columnKeyAsCalendarId = (key: CalendarColumnKey): CalendarId => key as unknown as CalendarId;` — the sole brand-crossing conversion (§2.5) |
| 71-76 | existing doc comment kept **verbatim**; it is the justification for the conversion |
| 85-100 | `timedResizeVisualToDayGridEvent` — no column key; no edit |

**`packages/web/src/views/Day/interaction/adapter/commit/all-day.commit.ts`**

| Line | Change |
|---|---|
| 14-17 | `commitAllDayDragInteraction(target, visual: AllDayDragVisual<CalendarColumnKey>)` |
| 19 | `"dayDate" in visual ? … : false` — **left exactly as-is.** It is now statically always-true, but removing it is a tidy-up P-3's spirit forbids and it costs nothing at runtime. |
| 29 | `columnMoveCalendarId(visual, target.event)` — `AllDayDragVisual<CalendarColumnKey>` structurally satisfies the `Pick<TimedDragVisual<CalendarColumnKey>, …>` parameter, exactly as today; no edit |

**Test files touched by R-1 — annotation repoints only, zero assertion change (P-4)**

| File | Change |
|---|---|
| `grid/interaction/commit/cross-row.commit.test.ts` (L2-3 imports, plus the two visual literal annotations) | `AllDayDragVisual` → `AllDayDragVisual<DateColumnKey>`, `TimedDragVisual` → `TimedDragVisual<DateColumnKey>`. Required because the narrowed L18/L41 signatures reject the defaulted `AnyColumnKey` literals. |
| `grid/interaction/math/cross-row.drag.test.ts` (L11-15 `dayColumns` fixture) | **Verify only.** Plain date strings infer `TKey = string`; may need `<DateColumnKey>` on the `GridLayoutCache` annotation. Annotation only if so. |
| `grid/interaction/layout.cache.test.ts` (L16, L19-20) | **Expected zero change.** The two-arg `buildDayColumns` overload infers `TKey = string`; `toMatchObject({ date: "2026-06-28" })` still holds. |
| `views/Day/interaction/adapter/day-interaction.adapter.test.ts` | **Expected zero change** — and this is load-bearing evidence: it drives `getColumnKeys` with raw strings through the frozen `string[]` option, so a green run proves the Day brand entry did not leak into the option boundary. |

### 2.5 The boundary-cast story

Exactly three casts are introduced. Each is single-point, commented, and grep-checkable (§6).

| # | Site | Cast | Why it is safe and why it cannot be avoided |
|---|---|---|---|
| 1 | `Week/.../geometry/week-layout.cache.ts:55` | `sources.visibleDays as DateColumnKey[]` | `visibleDays` originates from `WeekInteractionRuntime.getVisibleDays(): string[]` (`week-interaction.adapter.types.ts:38`), whose only implementer is outside the allowlist and whose signature is boundary-frozen. The values are documented and produced as local `YYYY-MM-DD` column dates by the same React render that painted the columns. One cast converts the whole array; **every** downstream Week site (`dayColumns[i].date`, `getNearestDayColumn`, `resolveDragColumn`, both `create*DragVisual` calls) is brand-correct with no further cast. |
| 2 | `Day/.../geometry/day-layout.cache.ts` `asDayColumnKeys()`, called once at `day-interaction.adapter.ts:260-261` | `keys as CalendarColumnKey[]` | Same shape: `DayInteractionAdapterOptions.getColumnKeys?: () => string[]` is a boundary-frozen option, and the fallback key is built locally at L245. Placing the cast in a **named exported function in the layout-cache module** (rather than inline in the adapter) means the grep in §6 can assert there is exactly one caller. |
| 3 | `Day/.../commit/timed.commit.ts` `columnKeyAsCalendarId()` | `key as unknown as CalendarId` | The one deliberate brand crossing. It is reached only when `visual.dayDate !== visual.initialDayDate` (L81), which is unreachable in the single-column fallback (one key, never changes — F-2 / the L71-76 comment). So the key is provably a rendered calendar column's id at that point. `as unknown as` is required because `CalendarColumnKey` and `CalendarId` are disjoint brands; the double cast is the *signal* that this is a deliberate crossing, which is strictly better than today's silent `as CalendarId`. |

A fourth cast appears later, in R-2, at the registry boundary — see §3.2. It is not part of R-1.

**Explicitly not cast:** `layout.dayColumns[i].date`, `getNearestDayColumn(...)?.date`,
`resolveDragColumn(...).nextColumn?.date`, and every `create*Visual({ dayDate })` argument. Those
all inherit the brand through the generic `GridLayoutCache<TKey>` chain. That is the whole point of
making the layout cache generic rather than branding at each visual construction site — brand once
at the source of the keys, and let inference carry it.

---

## 3. Target module layout

### 3.1 New and moved files (all inside the allowlist)

| Path | Exports | Step |
|---|---|---|
| `grid/interaction/types/column-key.types.ts` | `ColumnKey`, `DateColumnKey`, `CalendarColumnKey`, `AnyColumnKey` | S1 |
| `grid/interaction/adapter/view-interaction.adapter.types.ts` | `ViewInteractionPointerOwnership`; `ViewResolvedEventTarget<TReg>`; `ViewAllDayDragTarget<TReg>`, `ViewAllDayResizeTarget<TReg>`, `ViewTimedDragTarget<TReg>`, `ViewTimedResizeTarget<TReg>`; `ViewInteractionTarget<TReg>`; `ViewAllDayDragCommitResult`, `ViewAllDayResizeCommitResult`, `ViewTimedDragCommitResult`, `ViewTimedResizeCommitResult`, `ViewInteractionCommitResult`; `ViewInteractionVisual<TKey>`; `ViewInteractionRuntime<TReg>`; `ViewInteractionAdapter` | S8 |
| `grid/interaction/adapter/view-layout-scroll.state.ts` | `createViewLayoutScrollState<TLayout>()` → `{ get, set, clear, applySmartScroll }` | S9 |
| `grid/interaction/adapter/view-target-resolution.ts` | `createViewTargetResolver<TView, TReg>()`, `isViewAllDayTarget`, `isViewDragTarget` | S10 |
| `grid/interaction/adapter/view-engine-adapter.ts` | `createViewEngineAdapterBase()` — shared `cancel`/`commit`/`getDraftEventMount`/`getSourceElement`/`getSourceElementDraftEventMode`/`getTarget` | S11 |
| `grid/interaction/adapter/view-pointer-session.ts` | `createViewPointerSession()` — `ownsPointer`, `connectCancellationEvents`, `handlePointerDown`, `handlePointerMove`, `handlePointerUp`, `handlePointerCancel`, `cancel` | S12 |
| `grid/interaction/adapter/create-view-interaction-adapter.ts` | `createViewInteractionAdapter()` composition root + `ViewInteractionAdapterHooks` | S13 |

**No file is removed.** `week-interaction.adapter.ts`, `day-interaction.adapter.ts` and both
`*.adapter.types.ts` files survive as the view instantiation sites plus Band C — which is what
keeps P-1 satisfied without a single re-export shim.

### 3.2 The R-4 discrimination problem, and the registry view brand

R-4 wants the 16 duplicated interfaces collapsed into generics parameterised by the view's
registered-target and column-key types. Parameterising on the registered target **alone reproduces
the exact hole R-4 forbids**: `week-event.registry.ts:14` and `day-event.registry.ts:14` are both
`= ViewRegisteredEventTarget`, so `ViewInteractionTarget<WeekRegisteredEventTarget>` is *identical*
to `ViewInteractionTarget<DayRegisteredEventTarget>`. And the target types carry no column key, so
`TColumnKey` cannot discriminate them either (an unused type parameter is structurally invisible in
TypeScript).

**Decision.** Brand the registered-target type with an optional phantom view tag, in
`view-event-registry.ts`:

```ts
declare const VIEW_BRAND: unique symbol;

export type ViewRegisteredEventTarget<TView extends string = string> =
  RegisteredEventTarget<ViewInteractionEventType> & {
    /** Phantom. Never written, never read, erased at compile time. */
    readonly [VIEW_BRAND]?: TView;
  };
```

with `WeekRegisteredEventTarget = ViewRegisteredEventTarget<"week">` and
`DayRegisteredEventTarget = ViewRegisteredEventTarget<"day">`.

- `{[B]?: "week"}` → `{[B]?: "day"}` requires `"week" | undefined` assignable to `"day" | undefined`
  → **false**. Mutual unassignability achieved. A Week target passed to a Day-instantiated shared
  method is now a compile error.
- The raw `createEventRegistry` output (`event.registry.ts:105-109`, a plain object with no such
  property) is assignable to **both**, because the property is optional. That is the one widening we
  need, and it happens at exactly one place.
- Zero runtime footprint. No object gains a field.
- **This is not the banned pattern.** Constraint 5 / R-5 forbid *behavioural* members
  (`row`, `crossRowSize`, `timedStartMinutes`, `rebuildLayoutAfterNavigation`) being optional on a
  shared type so one view "looks capable" of something it isn't. A phantom nominal tag carries no
  behaviour, is never populated, and is never read; it exists solely to make two types
  unassignable. Reviewers should check that distinction, not conflate the two.
- Neither `WeekRegisteredEventTarget` nor `DayRegisteredEventTarget` appears in the P-1 frozen
  symbol table, so widening them is contract-legal. `WEEK_INTERACTION_EVENT_ID_ATTRIBUTE`,
  `getWeekInteractionTargetAttributes`, `useWeekEventRegistrationRef`, `weekEventRegistry` and the
  Day equivalents are untouched, as are L26-48 of `view-event-registry.ts` (P-2).

**Cast #4 (the registry boundary).** Inside the shared `getRegisteredTarget`
(one hoisted copy of `week:633-640` / `day:584-591`), `registry.resolveFromTarget()` returns
`RegisteredEventTarget<ViewInteractionEventType>` and must be handed back as `TRegistered`:

```ts
// The registry is view-namespaced by its data attributes, so anything it
// resolves belongs to this view. One cast, at the only place a raw
// registration enters the branded world.
return registered?.eventType === eventType ? (registered as TRegistered) : null;
```

One cast, in one shared file, at the only registration entry point. Grep-checked in §6.

### 3.3 What the shared factory does **not** get

Per R-5 and constraint 2, and structurally guaranteed by the fact that shared modules never import
these:

- `setWeekInteractionEdgeNavigationState` / `resetWeekInteractionEdgeNavigationState`
  (`Week/interaction/state/edge-navigation.state.ts:22,41`) — the shared layer receives only opaque
  `() => void` hooks and therefore **cannot name these symbols**. `edge-navigation.state.ts` is not
  edited; its exports stay frozen; the writer count stays at two.
- `setWeekInteractionMotionActive` — same mechanism.
- `createWeekEdgeNavigationController`, `updateEdgeNavigation` (`week:668-703`),
  `activeEdgeNavigationIndicatorState` (`week:99-104`),
  `rebuildLayoutAfterNavigation` (`week:133-155`), `rebuildLayoutIfNeeded` (`week:712-725`),
  `isPointerOverAllDayRow` (`week:642-657`), `getLayoutInput` (`week:705-710`),
  `buildWeekLayoutCacheForTarget` (`week:767-781`), `getDraftEventSize` (`week:786-793`),
  `WeekEdgeNavigableVisual` — all stay in `week-interaction.adapter.ts` / its types file.
- `getColumnKeys`, `getVisibleDate` (`day-interaction.adapter.types.ts:34,36`) — stay Day-local.
- Band C: `createVisual` / `updateVisual` on both sides, every `commit/*.commit.ts`.

`ViewInteractionRuntime<TReg>` is a **base** interface; `WeekInteractionRuntime` extends it with
`getVisibleDays` and `onRequestWeekNavigation`, `DayInteractionRuntime` uses it unchanged. No
Week-only member becomes an optional field on the base. Likewise `ViewInteractionAdapter` declares
the seven shared methods and `WeekInteractionAdapter` extends it with `rebuildLayoutAfterNavigation`
(`week-interaction.adapter.types.ts:148`), preserving both public interfaces exactly.

### 3.4 Import graph, before → after

**Week adapter, before** (`week-interaction.adapter.ts:1-81`) — 12 import groups:
`grid/adapter.helpers`, `grid/dom`, `grid/math/cross-row.drag`, `grid/types/timed-drag.types`,
`grid/view-event-registry`, `engine ×3`, `../registry`, `../state/edge-navigation.state`,
`../state/motion.state`, `./edge-navigation`, `./geometry/week-layout.cache`,
`./interactions/* ×4`, `./week-interaction.adapter.types`.

**Week adapter, after** — the engine imports (`interaction.adapter.types`, `interaction.engine`,
`interaction.pointer`) move **into** `grid/interaction/adapter/*` and out of the view file;
`grid/adapter.helpers` (ownership reason, cursor, smart-scroll) likewise; `grid/dom`'s
`getResizeHandleEdge` moves into `view-target-resolution.ts`. The view file adds one import of
`@web/grid/interaction/adapter/create-view-interaction-adapter` and **keeps**
`../state/edge-navigation.state`, `../state/motion.state`, `./edge-navigation`,
`./geometry/week-layout.cache`, `./interactions/*`, `grid/dom` (draft-event mount helpers used by
Band C), `grid/math/cross-row.drag` (for `isPointerOverAllDayRow`) and its own types file.

**Day adapter, before** (`day-interaction.adapter.ts:1-71`) — the same engine trio, `grid/adapter.helpers`,
`grid/dom`, `grid/date`, `grid/layout.cache`, `grid/math/* ×4`, `grid/types/timed-drag.types`,
`../registry`, `./commit/* ×2`, `./day-interaction.adapter.types`, `./geometry/day-layout.cache`.

**Day adapter, after** — same subtractions; adds
`@web/grid/interaction/adapter/create-view-interaction-adapter` and `asDayColumnKeys`; keeps
`grid/date`, `grid/math/* ×4`, `./commit/*`, `./geometry/day-layout.cache` (all Band C).

**New shared-layer edges:** `grid/interaction/adapter/*` → `@web/interaction/*` (engine, import
only — the engine is never edited), → `grid/interaction/adapter.helpers`, → `grid/interaction/dom`,
→ `grid/interaction/view-event-registry`, → `grid/interaction/types/column-key.types`.
**Forbidden new edges:** `grid/interaction/**` → `views/**` (any direction of view-specific import).
Grep-checked in §6.

---

## 4. Ordered step plan

Every step compiles and is independently testable. Commands are run from the repo root. The
mechanical tier has previously mis-reported writes, so **every step's `git status --porcelain`
output is checked against the step's declared file list before the step is recorded**.

Shorthand:
- `SUBSET` = `bun run test:web -- packages/web/src/grid/interaction packages/web/src/views/Week/interaction packages/web/src/views/Day/interaction` → expect **128 pass / 0 fail / 21 files / ≥337 expects**, exit 0
- `ENGINE` = `bun run test:web -- packages/web/src/interaction` → expect **31 pass / 0 fail / 3 files / 160 expects**, exit 0
- `FULL` = `bun run test:web` → expect **2297 pass / 1 fail / 1 error**, exit 1, sole failure `RecurrenceSection`
- `TC` = `bun run type-check`, `LINT` = `bun run lint`

| # | Files touched (all allowlisted) | Verify | Expected delta |
|---|---|---|---|
| **S0** | none | `SUBSET`, `ENGINE`, `FULL`, `TC`, `LINT`; `git status --porcelain` empty | baseline recorded; nothing written |
| **S1** | + `grid/interaction/types/column-key.types.ts` | `TC`, `LINT` | new file, zero importers; 0 test delta |
| **S2** | `grid/interaction/layout.cache.ts`, `math/drag-column.ts`, `math/cross-row.drag.ts` | `TC`, `SUBSET` | generics + defaults only; **no brand in use**; 128/0 unchanged |
| **S3** | `grid/interaction/types/timed-drag.types.ts`, `types/all-day-drag.types.ts`, `math/timed.drag.ts`, `math/all-day.drag.ts`, `commit/timed-moved.ts` | `TC`, `SUBSET` | generics + defaults only; 128/0 unchanged |
| **S4** | `Week/.../geometry/week-layout.cache.ts` (**brand entry**), `Week/.../week-interaction.adapter.types.ts`, `Week/.../commit/timed.commit.ts`, `Week/.../commit/all-day.commit.ts`, `Week/.../interactions/timed.drag.ts`, `Week/.../interactions/all-day.drag.ts`, `grid/interaction/commit/cross-row.commit.ts`, `grid/interaction/commit/cross-row.commit.test.ts` (annotations only) | `TC`, `SUBSET`, `FULL` | Week is fully `DateColumnKey`; 128/0; expects unchanged |
| **S5** | `Day/.../geometry/day-layout.cache.ts` (**brand entry**), `Day/.../day-interaction.adapter.ts` (L15, 95, 260-261), `Day/.../day-interaction.adapter.types.ts`, `Day/.../commit/timed.commit.ts` (**`columnKeyAsCalendarId`**), `Day/.../commit/all-day.commit.ts` | `TC`, `SUBSET`, `FULL` | Day is fully `CalendarColumnKey`; 128/0; `day-interaction.adapter.test.ts` green **untouched** |
| **S6** | + `grid/interaction/types/column-key.types.test.ts` (NEW) | `SUBSET` | **+expects.** Mandatory negative proof — see §5/S6 |
| — | *R-1 complete. Sequencing gate: `SUBSET` 128/0 + `TC` clean before any hoist.* | | |
| **S7** | `grid/interaction/view-event-registry.ts` (phantom view brand only, L15-18 region), `Week/.../registry/week-event.registry.ts:14`, `Day/.../registry/day-event.registry.ts:14` | `TC`, `SUBSET`, `FULL` | P-2 attribute code (L26-48) untouched; all P-1 registry symbols unchanged |
| **S8** | + `grid/interaction/adapter/view-interaction.adapter.types.ts`; `Week/.../week-interaction.adapter.types.ts`, `Day/.../day-interaction.adapter.types.ts` re-expressed as aliases + view-local extras | `TC`, `SUBSET`, `FULL` | R-4 done; both 149-LOC files shrink; every exported name and shape preserved |
| **S9** | + `grid/interaction/adapter/view-layout-scroll.state.ts`; `week-interaction.adapter.ts` (L112-114, 659-666, 731-741), `day-interaction.adapter.ts` (L95-96, 213-216, 239-240, 276-277, 425-432) | `TC`, `SUBSET`, `FULL` | `applySmartScroll` + layout/scrollTop lifecycle exist once |
| **S10** | + `grid/interaction/adapter/view-target-resolution.ts`; both adapters (Week 483-640, 755-763; Day 434-591, 604-607; Day `isDayDragTarget` at `day-layout.cache.ts:73-76` delegates) | `TC`, `SUBSET`, `FULL` | 9 Band-A targeting members exist once; 4-probe order hoisted as one copy |
| **S11** | + `grid/interaction/adapter/view-engine-adapter.ts`; `week-interaction.adapter.ts` (259-290, 342-350), `day-interaction.adapter.ts` (213-243, 322-330) | `TC`, `SUBSET`, `FULL` | shared `cancel`/`commit` skeleton + 4 shared engine-adapter members; `createVisual`/`updateVisual` injected untouched |
| **S12** | + `grid/interaction/adapter/view-pointer-session.ts`; `week-interaction.adapter.ts` (125-131, 157-251, 795), `day-interaction.adapter.ts` (107-113, 115-205) | `TC`, `SUBSET`, `FULL` | Band B pointer handlers exist once; motion hooks injected; F-1 ruling applied |
| **S13** | + `grid/interaction/adapter/create-view-interaction-adapter.ts`; both adapters reduced to hooks + Band C + `return { … }` | `TC`, `SUBSET`, `FULL` | both public adapter surfaces byte-identical (`week:743-752`, `day:593-601`) |
| **S14** | none | full §6 checklist | closing sweep |

**S11 detail — the commit skeleton's throw ordering.** Both views today skip cleanup on a mismatched
target: `week:282` and `day:236` `throw` before `week:285-287` / `day:239-240` run. The shared
skeleton must be

```ts
commit: ({ target, visual }) => {
  const result = hooks.commitDispatch({ target, visual }); // throws inside, message injected
  layoutState.clear();
  hooks.onInteractionSettled();
  return result;
}
```

so the throw propagates before any cleanup. Day's dispatch closure keeps `day:219-237` verbatim,
including `const visibleDate = getVisibleDate()` **before** the four-branch check — preserving that
`getVisibleDate()` is called even on the throw path.

**S12 detail — F-1 applied.** The hoisted `handlePointerUp` is:

```ts
const isOwnedPointer = ownsPointer(event);
const result = engine.handlePointerUp(event);
if (!result) return isOwnedPointer;
const currentRuntime = runtime();          // single read, Day's shape — see F-1
if (result.type === "click") {
  if (isViewAllDayTarget(result.target)) currentRuntime.onClickAllDayEvent?.(result.target.event);
  else currentRuntime.onClickTimedEvent(result.target.event);
  hooks.onClickHandled();                   // Week: setWeekInteractionMotionActive(false); Day: no-op
  return isOwnedPointer;
}
… four result.result.type branches, unchanged order …
```

**Fallback if Gate 2 rejects F-1:** add `runtimeReadStrategy: "before-branch" | "in-branch"` to the
hooks object, branch on it once, Week passes `"in-branch"`. Costs one `if` in shared code and
proves nothing the F-1 analysis does not already prove. Recommended only if the gate wants the
approved §2 text honoured to the letter.

**S12 detail — `handlePointerDown`.** `hooks.onPointerDownOwned()` fires **after**
`engine.handlePointerDown(event)` returns true and **before** the ownership object is returned
(`week:176-188`). Week passes `() => setWeekInteractionMotionActive(true)`; Day passes nothing
(default no-op). `hooks.ineligibleReason` / `hooks.noTargetReason` carry the four view-specific
strings verbatim: `"ineligible-week-pointer"`, `"no-week-interaction-target"`,
`"ineligible-day-pointer"`, `"no-day-interaction-target"`.

---

## 5. Per-step risk + rollback

Rollback for every step is `git checkout -- <declared file list>`; no step spans a migration or a
generated artifact, so revert is always clean at step granularity. Steps are ordered so that no step
depends on an un-verified predecessor.

| # | What breaks silently if wrong | Existing test that catches it |
|---|---|---|
| S1 | nothing (no importers) | — (`TC` suffices) |
| S2 | wrong variance on `GridLayoutCache<TKey>` → later steps refuse to infer | `TC`; `grid/interaction/layout.cache.test.ts` (column construction), `grid/interaction/math/cross-row.drag.test.ts` (placement + row resolution) |
| S3 | a generic parameter dropped on `updateTimedDragVisual` reverts the layout↔visual pairing to `string` and silently re-opens the hazard | `TC` catches the *dropped* parameter only if a branded caller exists — none does yet. **Real risk: this step is type-only and no test can fail.** Mitigated by S4/S5 immediately exercising it and by S6's negative proof. |
| S4 | Week visuals silently fall back to `AnyColumnKey` (default leak) instead of `DateColumnKey`, so the discriminant is inert on the Week side | `TC` will **not** catch a default leak. Caught by the §6 grep `G-3` and by S6. Behaviourally, `views/Week/interaction/WeekInteractionCoordinator.test.ts` and `week-interaction.adapter.test.ts` cover the drag paths. |
| S5 | `asDayColumnKeys` applied to the wrong array (e.g. before the `indexOf` at `day:257`) → `indexOf` compile error (loud), or the fallback branch mis-branded → nothing visible | `views/Day/interaction/adapter/day-interaction.adapter.test.ts` covers the cross-calendar move and the single-column fallback (`CALENDAR_A`/`CALENDAR_B` fixtures, L31-32). `columnKeyAsCalendarId` returning the wrong value shows up as a wrong `calendarId` on the commit result there. |
| **S6** | — | **This step *is* the mitigation for S3/S4.** |
| S7 | the phantom brand declared non-optional → `createEventRegistry` output stops being assignable and every resolve site needs a cast | `TC` fails loudly and immediately. Behaviour covered by `WeekInteractionCoordinator.test.ts` / `DayInteractionCoordinator.test.tsx`. |
| S8 | a Week-only member accidentally added as optional to `ViewInteractionRuntime` → Day *looks* week-navigable | No test can catch this. **Grep `G-5` in §6 is the control**, plus senior review of the base interface. |
| S9 | `layoutState.clear()` ordering swapped relative to the edge-nav reset in Week's `clearInteractionState` (`week:731-736`) → smart-scroll state survives a cancel | `WeekInteractionCoordinator.test.ts`; Day side covered by `day-interaction.adapter.test.ts` only for commit results, **not** for cancel-then-redrag. See "new tests" below. |
| S10 | probe order silently reordered (e.g. timedDrag before timedResize) → resize handles start dragging the event | Week: `WeekInteractionCoordinator.test.ts`. **Day: no existing test drives a resize-handle pointerdown.** See "new tests". |
| S11 | cleanup runs before the throw on a mismatched target; or Day's `getVisibleDate()` hoisted out of the dispatch closure | Neither view has a test for the mismatched-target throw. **New test required** — see below. |
| S12 | `onClickHandled` wired unconditionally → Day starts calling a Week store; or the motion flag set before the engine accepts the pointer | Week: `MainGrid.test.tsx` (outside the allowlist, runs in `FULL`) asserts motion-driven layout; `week-interaction.adapter.test.ts:12-19` covers the no-target refusal. Day: `DayInteractionCoordinator.test.tsx` covers click-to-open-form. A *spurious* Day call to the Week store would be caught by grep `G-1`, not by a test. |
| S13 | a public adapter method dropped from the returned object | `TC` (the `WeekInteractionAdapter` / `DayInteractionAdapter` interfaces are structural returns), plus both coordinator tests. |

### Steps where NO existing test would catch a regression — new tests are mandatory

1. **S6 — the discriminant itself (covers S3 + S4).** New file
   `grid/interaction/types/column-key.types.test.ts` containing:
   - compile-time negative assertions using a local `Expect`/`Not assignable` helper (or
     `@ts-expect-error` on deliberate mis-assignments) proving: `TimedDragVisual<DateColumnKey>` is
     not assignable to `TimedDragVisual<CalendarColumnKey>` and vice versa; `GridLayoutCache<DateColumnKey>`
     is not assignable to `GridLayoutCache<CalendarColumnKey>`; a bare `string` is not assignable to
     either key type. `@ts-expect-error` is the strongest available proof — if the discriminant ever
     goes inert, those lines become "unused expect-error" and `type-check` **fails**.
   - a runtime assertion that `columnKeyAsCalendarId` is identity-preserving (guards the
     `as unknown as` double cast against a future "helpful" transformation).
2. **S11 — mismatched-target throw + cleanup ordering.** Add to
   `views/Day/interaction/adapter/day-interaction.adapter.test.ts` and
   `views/Week/interaction/adapter/week-interaction.adapter.test.ts`: driving a commit with a
   target/visual pair whose `type`s disagree throws with the exact per-view message
   (`"Mismatched Day interaction target"` / `"Mismatched Week interaction target"`) **and** leaves
   the adapter able to start a fresh interaction afterwards.
3. **S10 — Day's 4-probe order.** Add to `day-interaction.adapter.test.ts`: a pointerdown on a
   registered element carrying `EVENT_RESIZE_HANDLE_ATTRIBUTE` must produce ownership reason
   `"saved-timed-resize"` (not `"saved-timed-drag"`), and the all-day equivalent must produce
   `"saved-all-day-resize"`. This is the asymmetric-risk case named in constraint 6: Week's probe
   order is exercised by 9 test files, Day's by 4, and none of Day's drives a resize handle today.
4. **S9 — Day cancel-then-redrag.** Add to `day-interaction.adapter.test.ts`: cancel mid-drag, then
   start a new drag, and assert the second drag's transform is computed from a fresh layout (a stale
   `scrollTop` survives silently otherwise).

All four are **additions**. P-4's floor (≥337 expects across the three dirs) rises; it never falls.

### Asymmetric-risk summary (constraint 6)

Day carries 4 interaction test files to Week's 9. The steps whose Day side is materially
under-covered are **S9, S10, S11** — each gets a mandatory new test above, all landing in
`day-interaction.adapter.test.ts`, which is the one Day file that drives the adapter directly rather
than through the coordinator. `DayInteractionCoordinator.test.tsx` carries known pre-existing
`act(...)` warnings (explicit non-goal) and must not be used as the primary evidence for any step.

---

## 6. Invariant checklist

| ID | Invariant | Verification command / grep | Pass condition |
|---|---|---|---|
| **P-0a** | engine untouched | `git status --porcelain packages/web/src/interaction` | empty output |
| **P-0b** | engine tests unchanged | `bun run test:web -- packages/web/src/interaction` | **31 pass / 0 fail / 3 files / 160 expects**, exit 0 |
| **P-1a** | frozen symbols still exported | `bun run type-check` | clean — every external caller in the P-1 table is type-checked repo-wide |
| **P-1b** | frozen symbols still behave | `bun run test:web` | the P-1 external test files (`MainGrid.test.tsx`, `event.util.test.ts`, `useShortcutTipTrigger.test.tsx`, `contextMenuLayering.test.tsx`, `useWeekShortcutOwner.test.tsx`, `useDayEventNudgeShortcuts.test.tsx`, …) all green |
| **P-2** | attribute scheme unchanged | `git diff --stat -- packages/web/src/grid/interaction/view-event-registry.ts` and inspect: only the `ViewRegisteredEventTarget` type region (L15-18) may differ | L26-48 (`viewInteractionAttributeNames`, `CALENDAR_VIEW_INTERACTION_ID_ATTRIBUTES`, the two selectors, `readCalendarEventIdFromElement`) byte-identical |
| **P-3** | no runtime behaviour change | `SUBSET` + `FULL` | 128/0 (21 files) and 2297/1/1 with the sole failure `RecurrenceSection` |
| **P-4** | assertions not weakened | the `SUBSET` run's reported expect count | **≥ 337**, and 21 files → 21 or more; no `.skip`/`.todo` added (`grep -rn "it.skip\|describe.skip\|it.todo" packages/web/src/grid/interaction packages/web/src/views/Week/interaction packages/web/src/views/Day/interaction`) |
| **P-5a** | types clean | `bun run type-check` | exit 0 |
| **P-5b** | lint clean | `bun run lint` | exit 0, no new warnings in the delta |
| **P-5c** | full suite bar | `bun run test:web` | 2297/1/1, exit 1. `2298/0` is **not** the bar. |
| **G-1** | **edge-nav writer count is exactly two** | `grep -rn "setWeekInteractionEdgeNavigationState\|resetWeekInteractionEdgeNavigationState" packages/web/src --include=*.ts --include=*.tsx` | hits **only** in `views/Week/interaction/state/edge-navigation.state.ts` (declaration + the L42 self-call), `views/Week/interaction/adapter/week-interaction.adapter.ts`, and `views/Week/hooks/grid/useDragEdgeNavigation.ts`. Any other file = fail. |
| **G-2** | **shared layer cannot reach Week state** | `grep -rn "edge-navigation.state\|motion.state\|views/Week\|views/Day\|\.\./\.\./views" packages/web/src/grid/interaction` | **empty** |
| **G-3** | discriminant is not inert (no default leak) | `grep -rn "TimedDragVisual\b\|AllDayDragVisual\b\|GridLayoutCache\b" packages/web/src/grid/interaction packages/web/src/views/Week/interaction packages/web/src/views/Day/interaction \| grep -v "<"` | only the type **declarations** in `types/timed-drag.types.ts`, `types/all-day-drag.types.ts`, `layout.cache.ts` and the alias lines `WeekLayoutCache =` / `DayLayoutCache =` may appear without a type argument |
| **G-4** | brand entries are single-point | `grep -rn "as DateColumnKey\|as CalendarColumnKey\|asDayColumnKeys\|as unknown as CalendarId\|as TRegistered" packages/web/src` | exactly 4 declaration sites (`week-layout.cache.ts`, `day-layout.cache.ts`, `Day/.../commit/timed.commit.ts`, `view-target-resolution.ts`) + exactly 1 call site for `asDayColumnKeys` (`day-interaction.adapter.ts`) |
| **G-5** | no Week/Day-only member on a shared type | manual read of `grid/interaction/adapter/view-interaction.adapter.types.ts` against the R-5 list (`rebuildLayoutAfterNavigation`, `getVisibleDays`, `onRequestWeekNavigation`, `getColumnKeys`, `getVisibleDate`, `WeekEdgeNavigableVisual`) | none of those six names appears in the shared types file |
| **G-6** | `as CalendarId` no longer unchecked | `grep -rn "as CalendarId" packages/web/src/views/Day/interaction` | only inside `columnKeyAsCalendarId`'s body |
| **G-7** | write contract respected | `git status --porcelain` after every step | every path matches `packages/web/src/{grid,views/Week,views/Day}/interaction/**`, and matches the step's declared file list exactly (mechanical-tier write verification, per `requirements.md` §8) |

---

## 7. Explicit non-goals

Restated from `requirements.md` §7 and re-confirmed against the tree this phase:

- **`commit/*.commit.ts` on both sides stays duplicated.** Week's all-day commit applies a
  **date delta** (`Week/.../commit/all-day.commit.ts:18-31` — `dayjs(visual.dayDate).diff(dayjs(visual.initialDayDate), "day")`,
  deliberately delta because multi-day spans are window-clamped); Day's applies a **calendar id and
  never touches dates** (`Day/.../commit/all-day.commit.ts:21-31`, whose comment names the multi-day
  truncation bug it defends against). Merging these re-introduces that bug. R-1 makes them *safer*
  by giving each a mutually-unassignable visual type — it does not merge them.
- **`registry` and `targeting` shims stay.** `week-event.registry.ts` and `day-event.registry.ts`
  are 24 LOC of pure re-export over `createViewInteractionRegistry`
  (`view-event-registry.ts:74-128`); the targeting pair is the same shape. Collapsing them touches
  16 files outside `*/interaction/` for zero duplication removed. S7 changes **one type alias line**
  in each and nothing else.
- **Band C (`createVisual` / `updateVisual`) stays per-view.** Week routes through
  `adapter/interactions/*` with a cross-row layout cache, all-day-row smart-scroll suppression
  (`week:450-452`) and edge navigation; Day computes calendar column keys and calls
  `grid/interaction/math/*` directly. They are injected into the shared skeleton as opaque closures.
- **Cross-row drag is not added to Day.** `row`, `crossRowSize`, `timedStartMinutes` stay on the
  shared visual types. R-1 does narrow `grid/interaction/commit/cross-row.commit.ts` to
  `DateColumnKey`, which makes it a compile error to route a Day visual through the conversion — a
  partial, free mitigation of the named hazard, not a capability change.
- **Per-view layout-cache wrappers stay.** Day's all-day cache uses `edgeThresholdPx: 0`
  (`day-layout.cache.ts:53`) vs Week's `WEEK_EDGE_NAVIGATION_THRESHOLD_PX`
  (`week-layout.cache.ts:46`). Only the key **type** is unified; the constants are not.
- **`edge-navigation.state.ts` is not edited and not de-globalised.** Gate-1 ruling (a)+(c): the
  double instantiation of `createWeekEdgeNavigationController` (`week:111` and
  `useDragEdgeNavigation.ts:19`) predates this run and is recorded as a follow-up ticket, not fixed
  here. G-1 proves this run adds no third writer.
- **`RecurrenceSection` date rot** and **`DayInteractionCoordinator.test.tsx`'s `act(...)`
  warnings** — both outside this run.

---

## 8. Open questions for Gate 2

**Q-1 (needs a ruling) — F-1: the approved §2 `runtime()` asymmetry does not exist.**
`requirements.md` §2 states Week calls `runtime()` twice in `handlePointerUp` and that any hoist
therefore changes behaviour. Lines 208 and 219 are on mutually exclusive branches (208's branch
returns at 216), so Week calls it exactly once per non-null result — identical to Day's line 163.
The plan hoists the single-read shape and treats this as provably behaviour-preserving.
**Ask:** confirm the correction, or direct the fallback (`runtimeReadStrategy` hook, §4/S12), which
adds a branch to shared code to reproduce a distinction that has no observable effect.

**Q-2 (needs a ruling) — the phantom view brand on `ViewRegisteredEventTarget` (§3.2).**
R-4 requires the types collapse to *not* preserve the current cross-view hole, and the only
mechanism TypeScript offers is a property-level nominal tag. The proposal adds an **optional
phantom** property that is never written and never read. It is superficially the same shape as the
pattern constraint 5 bans (`row` / `crossRowSize` as unpopulated shared fields) but categorically
different: no behaviour, no runtime presence, sole purpose is unassignability.
**Ask:** confirm this reading of constraint 5, or accept that R-4 collapses the interfaces while
leaving Week/Day targets mutually assignable (i.e. R-4 delivers deduplication but not
discrimination, and R-1's guarantee stops at the visual/layout layer).

**Q-3 (FYI, no ruling needed unless disputed) — three test files get annotation-only edits.**
`grid/interaction/commit/cross-row.commit.test.ts` (certain),
`grid/interaction/math/cross-row.drag.test.ts` (possible), plus four **new** test additions in
§5. P-4 permits import/annotation repoints; no assertion is modified, deleted or skipped, and the
expect floor only rises.

**Q-4 (FYI) — `grid/interaction/math/all-day.resize.ts`, `math/timed.resize.ts` and
`Week/.../interactions/all-day.visible-range.ts` were not read this phase.** They are expected to
need zero change (no column keys). If S2/S3's `type-check` disagrees, the fix is a mechanical
generic-parameter addition confined to those files, all of which are inside the allowlist. Flagged
rather than assumed.

No other open questions. Everything else in this plan is decided.
