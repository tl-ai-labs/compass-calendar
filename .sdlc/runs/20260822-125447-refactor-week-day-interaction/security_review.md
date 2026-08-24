# Security Review: Week/Day Interaction Type Refactor

**Run:** `20260822-125447-refactor-week-day-interaction` · **Intent:** refactor · **Scope:** changed files only (per the refactor row of the Intent matrix)
**Reviewer:** `gemini-3.7-flash` via `flash-agsdk-only` (packet `tp_sec_001`)

> **Orchestrator corrections applied to the generated text.** Two factual fixes:
> (1) the model listed `day-layout.cache.ts` as "brands day column keys using `asDayColumnKeys`" — it does not. Day's branding boundary is in **`day-interaction.adapter.ts`**, at the `columnKeys` construction; the geometry file merely *accepts* `DayColumnKey[]`. Week's branding genuinely is in `week-layout.cache.ts`.
> (2) The residual-risk section names only `day-interaction.adapter.test.ts:457`; `:444` also covers the paired INV-6 invariant and is named below.

## 1. Scope Reviewed

25 files (23 modified, 2 new), net −34 LOC.

**New type definitions**
- `grid/interaction/types/column-key.types.ts` — declares `DateColumnKey`, `DayColumnKey`, and the unchecked helpers `asDateColumnKeys` / `asDayColumnKeys`.
- `grid/interaction/types/adapter.types.ts` — shared generic `Target` / `CommitResult` / `Visual` contracts, previously duplicated per view.

**Shared grid layer** (generic threading, no logic change)
`layout.cache.ts`, `math/{timed.drag,all-day.drag,cross-row.drag,drag-column}.ts`, `commit/timed-moved.ts`, `types/{timed-drag,all-day-drag}.types.ts`.

**Commit boundaries** (type-only signature pinning)
`grid/interaction/commit/cross-row.commit.ts` pinned to `DateColumnKey`; Week's two commit modules pinned to `DateColumnKey`; Day's two pinned to `DayColumnKey`, with `columnMoveCalendarId` narrowed.

**View adapters, geometry, per-interaction modules**
`week-layout.cache.ts` (Week branding boundary), `day-layout.cache.ts` (accepts `DayColumnKey[]`), `day-interaction.adapter.ts` (**Day branding boundary** — two lines: layout type + `asDayColumnKeys`), Week's two per-interaction drag modules (annotations only), and both `*-interaction.adapter.types.ts` files (149-line duplicates collapsed to alias re-exports).

**Test fixture** — `cross-row.commit.test.ts` (fixture typing only, zero assertion changes).
**Configuration** — `.gitignore` (append-only: `.sdlc/`, `.hook-logs/`).

## 2. Threat Assessment

**1. Does any change alter RUNTIME behavior (vs types only)?**
**Verdict: No.** All modifications are compile-time type annotations, generic parameter threading, type deduplication, and zero-runtime type assertions. No control flow, arithmetic, or data transformation was altered. Emitted JavaScript is functionally identical.

**2. Do the unchecked cast helpers weaken validation that previously existed?**
**Verdict: No.** Before this refactor, column keys were raw `string[]` passed through layout caching and drag math with **no** runtime validation at these call sites. The helpers add a compile-time brand barrier without adding or removing any runtime check. A validating `parse` was explicitly rejected in design because the layout cache is rebuilt mid-drag: it would place Zod on a per-frame hot path *and* throw on input that is silently tolerated today — itself a behavior change.

**3. Does the residual `visual.dayDate as CalendarId` cast create a cross-calendar data-integrity risk?**
**Verdict: No risk; bounded by single-column runtime geometry.** In Day view the column key is a `CalendarId` when calendar columns render, or a `DateOnly` in the single-column fallback (resizes, or an event whose calendar has no rendered column). The cast sits behind `visual.dayDate !== visual.initialDayDate`. In fallback mode exactly one column exists, so that condition can never be true and the cast is unreachable while `dayDate` is a date. The cast is also **strictly narrower** than before: previously `string → CalendarId`, now `CalendarId | DateOnly → CalendarId`.

**4. Could the change cause an event to be written to the WRONG calendar, or dates silently rewritten?**
**Verdict: No.** Branding statically separates `DateColumnKey` from `DayColumnKey`, so date-dependent logic — notably `cross-row.commit.ts`, which calls `dayjs(visual.dayDate)` — can no longer receive a calendar id. That containment was previously convention only (Day merely happened not to import it) and is now a compile error. Day's all-day date-preservation invariant (INV-6) is preserved verbatim.

**5. Does the `.gitignore` change hide anything security-relevant?**
**Verdict: No.** Append-only addition of two local tooling directories. No credentials, env files, tracked sources or build artifacts are newly ignored.

**6. Any secrets, credentials, PII, logging or dependency changes?**
**Verdict: No.** Zero across all 25 files. No `package.json`, lockfile, `biome.json` or `tsconfig` change; no dependency added, upgraded or removed.

## 3. Findings

| ID | Severity | File | Description | Recommendation |
|---|---|---|---|---|
| **SEC-01** | INFO | `types/column-key.types.ts` | `asDateColumnKeys` / `asDayColumnKeys` are unchecked type assertions. | Accept as designed. Preserves hot-path drag performance without altering runtime behavior, while enabling static brand enforcement. |
| **SEC-02** | INFO | `Day/.../commit/timed.commit.ts` | `columnMoveCalendarId` narrows `DayColumnKey` to `CalendarId` behind a change guard. | Accept as designed. Bounded by the single-column runtime invariant and covered by existing tests. |
| **SEC-03** | INFO | `.gitignore` | Ignores `.sdlc/` and `.hook-logs/`. | Accept as designed. Standard tooling paths. |

No LOW, MEDIUM or HIGH findings.

## 4. Residual Risks Accepted

The cast in `columnMoveCalendarId` rests on a **runtime invariant, not a compile-time proof**: in the single-column `DateOnly` fallback, `visual.dayDate !== visual.initialDayDate` is guaranteed false because only one column exists, so `(visual.dayDate as CalendarId)` is never evaluated on a date. This is stated plainly rather than overclaimed — the type system narrows the cast but does not eliminate it.

Covering tests, both existing and passing:
- `day-interaction.adapter.test.ts:457` — *"disables cross-column movement for an event whose calendar has no column"* (the fallback path; asserts `hasMoved: false` and unchanged `calendarId`).
- `day-interaction.adapter.test.ts:444` — *"keeps a multi-day all-day event's dates on a cross-calendar move"* (asserts `calendarId` changes while `startDate`/`endDate` stay byte-identical — INV-6).

## 5. Verdict

This refactor is strictly a compile-time type-safety improvement that eliminates column-key domain confusion between Week-view dates and Day-view calendar ids. It introduces no runtime logic change, preserves all existing data-integrity invariants, and maintains full test-suite parity (2298 pass / 0 fail, unchanged from baseline). **Safe to merge from a security standpoint.**

## Verification state at review time

| Gate | Result |
|---|---|
| `bun run type-check` | **PASS** (exit 0, three `tsc` passes, TypeScript 7.0.2) |
| `bun run lint` | **All 25 changed files clean.** One pre-existing repo error remains in `packages/sync` — off-limits to this run, untouched, unrelated. |
| `bun run test:web` | **2298 pass / 0 fail across 302 files** — exactly the pre-run baseline. Zero regressions. |
