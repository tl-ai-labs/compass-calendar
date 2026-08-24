# CMP-104 — Deferred scope, with context

This run delivered **FR-1 + FR-2**. Everything below was approved at Gate 2 and then deliberately
deferred by a human decision mid-run, or cut at Gate 2. It is recorded here so a follow-up ticket
does not have to re-derive any of it.

**Base state:** branch `CMP-104/opus-plus-flash-v37`, cut from `main` at `4189de13`. The FR-1/FR-2
work is in the working tree, uncommitted. Verification at the point of deferral: `type-check` exit 0,
`lint` exit 0 with the 10 tolerated pre-existing warnings, `test:web` 2305 pass / 0 fail across 303
files (baseline 2298/302; the +7 are newly added invariant assertions, so zero regressions).

---

## Deferred mid-run by human decision (approved at Gate 2, then descoped)

These were **not** cut for lack of merit. The human chose to stop at the FR-1+FR-2 checkpoint so the
type work could land as a clean, independently reviewable delta rather than being bundled into a
large mid-flight diff.

### FR-3 — Unify the two adapter type modules

`week-interaction.adapter.types.ts` and `day-interaction.adapter.types.ts` are 149 LOC each and
**~85% of the difference is a pure Week→Day identifier rename**. A full unified diff was taken during
this run; the genuine differences are only:

- **Week-only:** `getVisibleDays()`, `onRequestWeekNavigation`, the `WeekEdgeNavigableVisual` type,
  and the `rebuildLayoutAfterNavigation()` adapter method.
- **Day-only:** `getColumnKeys()`, `getVisibleDate()`.
- Week declared `WeekLayoutCacheSources` as a bare alias of `GridLayoutCacheSources`; Day already
  imports `GridLayoutCacheSources` directly.

**Design already settled at Gate 2 (do not re-litigate):** extract a shared base
`GridInteractionAdapterOptions<TColumnKey>` / `GridInteractionAdapter<TColumnKey>`, with Week and Day
extending it. Model Week-only capability using **optional `never` negations** on the Day types
(`onRequestWeekNavigation?: never`, `getVisibleDays?: never`, `rebuildLayoutAfterNavigation?: never`).

Rationale for `never` rather than plain omission: omission relies on TypeScript's excess-property
check, which fires on object *literals* only, so a Week-shaped config passed through a variable would
still assign. `?: never` fails on every path. This is what enforces INV-7 (Day must not typecheck as
cross-row/navigation capable) rather than merely documenting it.

Rejected alternatives, with reasons: a discriminated union (there is no runtime discriminant and
nothing would read one; it would force an artificial `view: "week" | "day"` field), and a second
capability type parameter (permanent cost on every shared signature to model something already fully
determined by which options type was chosen).

**Note:** FR-1 has already partly prepared this. `getVisibleDays()` is now `DateColumnKey[]` and
`getColumnKeys()` is now `CalendarColumnKey[]`, so the two runtime interfaces are already
type-distinguished at the column-key level.

### FR-5 — Collapse the layout-cache preset wrappers

`week-layout.cache.ts` (73 LOC) and `day-layout.cache.ts` (76 LOC) are thin option-preset wrappers
over the same three shared builders (`buildTimedGridLayoutCache`, `buildAllDayGridLayoutCache`,
`buildDragGridLayoutCache`). The differences are **pure preset data plus Day-only target dispatch**:

| Preset | `edgeThresholdPx` | `smartScroll` | Builds cross-row cache? |
|---|---|---|---|
| Week timed | `WEEK_EDGE_NAVIGATION_THRESHOLD_PX` (= 50) | yes | yes |
| Week all-day | `WEEK_EDGE_NAVIGATION_THRESHOLD_PX` | **passed but ignored — inert** | — |
| Day timed | `INTERACTION_EDGE_THRESHOLD_PX` (= 50) | yes | no |
| Day all-day | **`0`** | **no** | no |

Day additionally owns `buildDayLayoutCacheForTarget` / `isDayDragTarget` / `isAllDayTarget` (target
dispatch); Week owns `buildDragWeekLayoutCache`. Both stay view-side.

**Two traps recorded for the follow-up:**

1. **Week's all-day preset passes `smartScroll`, and `buildAllDayGridLayoutCache` ignores that
   field.** It is inert today. Carry it across verbatim; do **not** "fix" it. This ticket has no
   mandate to decide whether all-day rows should smart-scroll.
2. **Preset drift is silent.** These values are pure data — a wrong `edgeThresholdPx`, or smart
   scroll accidentally enabled for Day's all-day row, produces no type error and no test failure. It
   surfaces only as changed edge-scroll behaviour during a real drag.

**Mitigation already delivered by this run.** `packages/web/src/grid/interaction/layout-presets.test.ts`
was written and landed *now*, against the current pre-merge wrappers, precisely so the follow-up has
a guard that has demonstrably captured today's values. Land FR-5 against it. An assertion that has
never gone red against the pre-merge values would not be evidence; these have.

### FR-7 — Re-point the re-export shims

Keep every export name in `{week,day}-event.registry.ts`, `{week,day}-event.targeting.ts` and the
per-view type modules, re-pointed at the shared layer, so no consumer outside the two interaction
subtrees plus `grid/interaction/` needs an import edit (bounds the diff, keeps INV-13 auditable).

Includes deleting two aliases, both verified during this run:

- **`DayLayoutCacheSources`** (`day-layout.cache.ts:26`) — **verified dead**: its declaration is its
  only occurrence in the tree.
- **`WeekLayoutCacheSources`** (`week-layout.cache.ts:24`) — a bare no-op alias with **three**
  consumer sites: `WeekInteractionCoordinator.tsx:18` and `:30`,
  `week-interaction.adapter.types.ts:17` and `:26`, and `week-layout.cache.ts:43`. Inline to
  `GridLayoutCacheSources`.

**Risk to carry:** a shim can keep its export *name* while its exported *type shape* changes, which
compiles at the shim and changes inference at distant call sites. `bun run type-check` across all
workspaces is the gate; call out in review any shim whose exported type shape changed.

---

## Cut at Gate 2 (with the measurement that justified each cut)

### FR-4 — Collapse the two adapter runtimes

Cut for two independent reasons:

1. **Blast radius.** `week-interaction.adapter.ts` (795 LOC) + `day-interaction.adapter.ts` (607 LOC)
   = 1,402 LOC, and the risks that dominate — React callback identity and hook/effect ordering — are
   exactly what the adapter unit tests do not assert. A green suite would not evidence safety.
2. **Shape mismatch.** Week is **decomposed** into `adapter/interactions/{timed.drag, timed.resize,
   all-day.drag, all-day.resize}.ts` plus `adapter/edge-navigation.ts`; Day is **monolithic** with no
   `interactions/` directory. Merging is a re-architecture, not a de-duplication.

**End-state decision taken at Gate 2 — this is settled, do not re-open:**
**Option B is the destination, Option A is its first step.**

- *Option A (first step):* align Day to Week's decomposed `adapter/interactions/*` shape. Bounded,
  intra-file motion; Day's public surface is unchanged so `day-interaction.adapter.test.ts` should
  pass untouched — a genuine safety signal. Independently valuable and can land alone.
- *Option B (destination):* collapse both onto one shared `createGridInteractionAdapter<TColumnKey>`
  in `grid/interaction/`, with Week and Day reduced to configuration. This *is* the "widen
  `grid/interaction/`" goal restated. Option A alone leaves the shared layer exactly as wide as it
  was.

FR-3's shared base and FR-5's preset separation are the load-bearing prerequisites for Option B —
which is a further reason to land them before attempting FR-4.

**Hazard to preserve through any FR-4 work:** the shared adapter must be *structurally* incapable of
giving Day a cross-row path. The `?: never` negations (FR-3) and the `DayColumnKey`-vs-`DateColumnKey`
split (already landed in FR-1) are what guarantee that.

### FR-6 — Collapse the two coordinators

Cut on a **measurement**, not on caution. `WeekInteractionCoordinator.tsx` (217 LOC) and
`DayInteractionCoordinator.tsx` (133 LOC) were read line by line during this run, and **the only
genuinely duplicated code is the module-level `mapEventsById` helper — ~11 lines, byte-identical.**

Everything else is real domain difference:

- Week's `commitSavedMutation` has a `hadFormOpenBeforeInteraction` branch that rebuilds a
  `GridEventDraft` (`editGridEventDraft` → `replaceGridDraftSchedule` → `draftActions.setGridDraft` →
  `setFormOpen(true)`). Day has no such branch and simply calls an `onOpenEvent` prop.
- Week owns `useWeekEventViewModel`, `useDraftContext`, `useWeekInteractionLayoutSync`,
  `activeInteractionEventRef`, `onRequestWeekNavigation`.
- Day takes events as props and owns `getColumnKeys` / `getVisibleDate`.

**There is essentially nothing to de-duplicate.** The human's instruction at Gate 2 was explicit:
*cut means cut* — do not lift the 11-line helper as a consolation prize. If it falls out naturally as
a byproduct of FR-3, that is fine; do not go after it as its own change.

---

## Open questions that remain open

- **OQ-3 — Day's single-column date fallback.** `day-interaction.adapter.ts` picks the calendar
  column keys when the event's calendar is a rendered column, and falls back to a single *date* key
  when it is not. INV-11 froze this as behaviour for this ticket, and FR-1 made it visible to the
  compiler via the `DayColumnKey` union. Still to decide: is it permanent behaviour, or should Day's
  column keys become uniformly calendar ids? If the latter, `DayColumnKey` collapses to
  `CalendarColumnKey` and the union becomes meaningful rather than an alias of `GridColumnKey`.
- **Whether `DayColumnKey` earns its declaration.** It is structurally identical to `GridColumnKey`
  today. It is documented as such at its declaration. Resolving OQ-3 resolves this too.
- **Should the Week all-day preset's inert `smartScroll` be removed or honoured?** See FR-5 trap 1.
  Deliberately out of scope for CMP-104.
