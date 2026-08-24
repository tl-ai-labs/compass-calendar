# Senior Code Review — 20260822-125447-refactor-week-day-interaction

**Packet:** `tp_sr_001` · **Phase:** `senior_code_review` · **Task type:** `changed_files_review`
**Model:** `gemini-3.7-flash` via `flash-agsdk-worker` (policy `flash-agsdk-only`, rule_index 3)
**Dispatched:** 2026-08-23T13:36:56Z · **Cost:** $0.138204 · **Latency:** 46.9 s
**Scope:** the 24 files this run changed (FR-1 + FR-2 + FR-5 + `.gitignore`)

> **Verdict: `approve` — zero refinement packets.**
>
> This phase was missed by the original session and was run on 2026-08-23 after the
> operator answered Gate 4 with "accept but run senior review first". The reviewer wrote
> no files and made no repo changes (delegation receipt: `added:[] modified:[] removed:[]`,
> 1588 unchanged; `git status` and `HEAD` verified unchanged before and after).
>
> **Reviewer independence caveat:** under `flash-agsdk-only` this review was produced by
> the same model tier that generated the code. See SUMMARY.md for the full disclosure.

The body below is the reviewer's verbatim output. One mechanical transformation was
applied for readability: absolute `file:///home/.../compass-calendar/` link prefixes were
shortened to repo-relative paths. No wording, finding, severity or verdict was altered.

---

### 1. Scope Reviewed

The review encompasses all 24 files in the change surface (+266 / -311 LOC, net -45 LOC):
- **New Shared Contracts (2 files)**:
  - [`column-key.types.ts`](packages/web/src/grid/interaction/types/column-key.types.ts) (`DateColumnKey`, `DayColumnKey`, `asDateColumnKeys`, `asDayColumnKeys`)
  - [`adapter.types.ts`](packages/web/src/grid/interaction/types/adapter.types.ts) (`GridInteractionTarget`, `GridInteractionVisual`, `GridInteractionCommitResult`, etc.)
- **Shared Grid Layer (7 files)**:
  - [`layout.cache.ts`](packages/web/src/grid/interaction/layout.cache.ts)
  - [`timed.drag.ts`](packages/web/src/grid/interaction/math/timed.drag.ts)
  - [`all-day.drag.ts`](packages/web/src/grid/interaction/math/all-day.drag.ts)
  - [`cross-row.drag.ts`](packages/web/src/grid/interaction/math/cross-row.drag.ts)
  - [`drag-column.ts`](packages/web/src/grid/interaction/math/drag-column.ts)
  - [`timed-moved.ts`](packages/web/src/grid/interaction/commit/timed-moved.ts)
  - [`all-day-drag.types.ts`](packages/web/src/grid/interaction/types/all-day-drag.types.ts), [`timed-drag.types.ts`](packages/web/src/grid/interaction/types/timed-drag.types.ts)
- **Commit Boundary (5 files)**:
  - [`cross-row.commit.ts`](packages/web/src/grid/interaction/commit/cross-row.commit.ts)
  - [`all-day.commit.ts` (Week)](packages/web/src/views/Week/interaction/adapter/commit/all-day.commit.ts), [`timed.commit.ts` (Week)](packages/web/src/views/Week/interaction/adapter/commit/timed.commit.ts)
  - [`all-day.commit.ts` (Day)](packages/web/src/views/Day/interaction/adapter/commit/all-day.commit.ts), [`timed.commit.ts` (Day)](packages/web/src/views/Day/interaction/adapter/commit/timed.commit.ts)
- **View Adapters / Geometry / Interactions (8 files)**:
  - [`week-layout.cache.ts`](packages/web/src/views/Week/interaction/adapter/geometry/week-layout.cache.ts), [`day-layout.cache.ts`](packages/web/src/views/Day/interaction/adapter/geometry/day-layout.cache.ts)
  - [`day-interaction.adapter.ts`](packages/web/src/views/Day/interaction/adapter/day-interaction.adapter.ts)
  - [`all-day.drag.ts` (Week)](packages/web/src/views/Week/interaction/adapter/interactions/all-day.drag.ts), [`timed.drag.ts` (Week)](packages/web/src/views/Week/interaction/adapter/interactions/timed.drag.ts)
  - [`week-interaction.adapter.types.ts`](packages/web/src/views/Week/interaction/adapter/week-interaction.adapter.types.ts), [`day-interaction.adapter.types.ts`](packages/web/src/views/Day/interaction/adapter/day-interaction.adapter.types.ts)
- **Test Fixture & Config (2 files)**:
  - [`cross-row.commit.test.ts`](packages/web/src/grid/interaction/commit/cross-row.commit.test.ts)
  - [`.gitignore`](.gitignore)

---

### 2. Summary of Changes

This refactor parameterizes the shared calendar grid interaction engine over column key types (`TColumnKey`), establishing a clean compile-time boundary between Week view grids (where column keys represent local dates, [`DateColumnKey`](packages/web/src/grid/interaction/types/column-key.types.ts#L6)) and Day view grids (where column keys represent calendar IDs or fallback date keys, [`DayColumnKey`](packages/web/src/grid/interaction/types/column-key.types.ts#L12)).

Specifically:
1. **Branded Column Keys (FR-1)**: Declares distinct domain types and lightweight unchecked boundary branders ([`asDateColumnKeys`](packages/web/src/grid/interaction/types/column-key.types.ts#L19), [`asDayColumnKeys`](packages/web/src/grid/interaction/types/column-key.types.ts#L22)).
2. **Generic Grid Layer (FR-2)**: Threads `<TColumnKey = string>` through geometry caches, math calculations, drag visual structures, and movement predicates without runtime execution changes.
3. **De-duplicated Adapter Contracts (FR-5)**: Centralizes identical pointer ownership, target, commit result, and visual contracts into [`adapter.types.ts`](packages/web/src/grid/interaction/types/adapter.types.ts), allowing Week and Day adapter type definitions to collapse into direct alias re-exports parameterized by `TRegistered` and `TColumnKey`.

---

### 3. Findings Table

| ID | Severity | File | Symbol | Description | Recommendation |
|---|---|---|---|---|---|
| F-01 | Info | [`timed.commit.ts`](packages/web/src/views/Day/interaction/adapter/commit/timed.commit.ts#L76) | [`columnMoveCalendarId`](packages/web/src/views/Day/interaction/adapter/commit/timed.commit.ts#L75) | Known residual cast `visual.dayDate as CalendarId` retained under single-column fallback invariant. | Accepted at security gate; no action needed. |
| F-02 | Info | [`layout.cache.ts`](packages/web/src/grid/interaction/layout.cache.ts#L9) | [`GridLayoutCacheOptions`](packages/web/src/grid/interaction/layout.cache.ts#L9) | Generic parameter defaults to `string` across shared utility types for backward ergonomics. | Sound; type inference and view-boundary pinning ensure strong branding at caller sites. |

*No blocking or defect-level findings identified across the 24 scoped files.*

---

### 4. Review Questions

#### (1) Correctness & Runtime Behavior
- **Verdict**: Sound (Zero runtime behavioral changes).
- **Reasoning**:
  - [`buildDayColumns`](packages/web/src/grid/interaction/layout.cache.ts#L177-L203): Both overload signatures and implementation were parameterized with `<TColumnKey = string>`. The underlying runtime branching (`visibleDates ?? input.visibleDates`), math operations (`input.width / dates.length`), and object projection (`{ date, index, left, width }`) remain identical.
  - [`getNearestDayColumn`](packages/web/src/grid/interaction/layout.cache.ts#L205-L223): Parameterized over `TColumnKey`. The return type changed from an inferred `DayColumnCache | null` to an explicit `DayColumnCache<TColumnKey> | null`. The loop search, distance comparisons, and null-initialization are unchanged.
  - [`hasTimedDragVisualMoved`](packages/web/src/grid/interaction/commit/timed-moved.ts#L1-L7): Parameterized over `<TColumnKey = string>`. The strict equality checks on `dayDate`, `startMinutes`, and `endMinutes` execute identically.

#### (2) Soundness of Default `TColumnKey = string`
- **Verdict**: Sound.
- **Reasoning**: The default `= string` on [`GridLayoutCacheOptions<TColumnKey = string>`](packages/web/src/grid/interaction/layout.cache.ts#L9), [`TimedDragVisual<TColumnKey = string>`](packages/web/src/grid/interaction/types/timed-drag.types.ts#L27), etc., preserves backward compatibility for generic callers while allowing TypeScript's type inference to bind `TColumnKey` to [`DateColumnKey`](packages/web/src/grid/interaction/types/column-key.types.ts#L6) or [`DayColumnKey`](packages/web/src/grid/interaction/types/column-key.types.ts#L12) whenever parameterized caches/visuals are supplied. Because view adapters and commit boundaries ([`WeekLayoutCache`](packages/web/src/views/Week/interaction/adapter/geometry/week-layout.cache.ts#L41), [`DayLayoutCache`](packages/web/src/views/Day/interaction/adapter/geometry/day-layout.cache.ts#L26), [`timedDragVisualToGridEvent`](packages/web/src/views/Week/interaction/adapter/commit/timed.commit.ts#L11)) pin their signatures to concrete branded types, an unbranded string cannot silently flow into a pinned function.

#### (3) Unchecked Cast Helpers & Geometry Boundary
- **Verdict**: Sound & Complete.
- **Reasoning**: In high-frequency 60fps interaction/drag lifecycles, performing runtime Zod schema parsing on every animation frame would degrade performance and risk throwing unexpected exceptions on input that was previously handled smoothly. Casting at the geometry cache boundary ([`asDateColumnKeys`](packages/web/src/grid/interaction/types/column-key.types.ts#L19) in [`weekLayoutCacheOptions`](packages/web/src/views/Week/interaction/adapter/geometry/week-layout.cache.ts#L61) and [`asDayColumnKeys`](packages/web/src/grid/interaction/types/column-key.types.ts#L22) in [`day-interaction.adapter.ts`](packages/web/src/views/Day/interaction/adapter/day-interaction.adapter.ts#L266)) establishes a strict entry point: all visuals created from these layouts inherit the branded keys, and no alternative unbranded pathways bypass this boundary into the pinned commit layer.

#### (4) Type-Design Quality of `adapter.types.ts`
- **Verdict**: Sound (Genuine de-duplication, not over-abstracted).
- **Reasoning**: The shared [`Grid*`](packages/web/src/grid/interaction/types/adapter.types.ts) types cleanly isolate the single axis of variation between Week and Day interaction targets: the registered event target shape (`TRegistered`). Parameterizing [`GridInteractionTarget<TRegistered>`](packages/web/src/grid/interaction/types/adapter.types.ts#L57) and [`GridInteractionVisual<TColumnKey>`](packages/web/src/grid/interaction/types/adapter.types.ts#L106) allows both [`week-interaction.adapter.types.ts`](packages/web/src/views/Week/interaction/adapter/week-interaction.adapter.types.ts) and [`day-interaction.adapter.types.ts`](packages/web/src/views/Day/interaction/adapter/day-interaction.adapter.types.ts) to eliminate ~150 lines of duplicate boilerplate without introducing nested type acrobatics or brittle conditionals.

#### (5) Modeling of `DayColumnKey = CalendarId | DateOnly`
- **Verdict**: Sound (Honest modeling of dual-mode Day grid).
- **Reasoning**: In multi-column Day views, columns represent active calendars (keyed by [`CalendarId`](packages/web/src/grid/interaction/types/column-key.types.ts#L12)). In the single-column fallback mode, the single column key is the date itself ([`DateOnly`](packages/web/src/grid/interaction/types/column-key.types.ts#L12)). Modeling [`DayColumnKey`](packages/web/src/grid/interaction/types/column-key.types.ts#L12) as `CalendarId | DateOnly` truthfully reflects this runtime state. In [`columnMoveCalendarId`](packages/web/src/views/Day/interaction/adapter/commit/timed.commit.ts#L75), when running in the single-column fallback mode, `visual.dayDate` and `visual.initialDayDate` are identical (`visibleDateKey`), so `visual.dayDate !== visual.initialDayDate` evaluates to `false` and returns the event's existing `calendarId`, avoiding erroneous calendar reassignment.

#### (6) Consistency, Naming, Dead Code, and Comments
- **Verdict**: Sound.
- **Reasoning**: Naming across interfaces and helper functions is consistent with the rest of `@web/grid`. Comments in [`column-key.types.ts`](packages/web/src/grid/interaction/types/column-key.types.ts#L14-L18) and [`week-layout.cache.ts`](packages/web/src/views/Week/interaction/adapter/geometry/week-layout.cache.ts#L59-L60) explicitly document the unchecked branding rationale. There are no dead code paths, orphan types, or unused imports.

---

### 5. Verdict

**Approve**. The refactor delivers FR-1, FR-2, and FR-5 with high type discipline, zero runtime behavior regressions, clean deduplication across view adapters, and robust verification (2298/2298 unit tests green, type-check exit 0, clean lint). It is sound to merge.
