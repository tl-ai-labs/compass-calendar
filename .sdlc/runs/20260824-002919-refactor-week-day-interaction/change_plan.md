# CMP-104 — Change Plan (delta refactor)

> **Provenance of this document.** Sections 1–3 were produced by a premium-tier dispatch
> (`tp_change_plan_003`, vendor-reported $0.918970). Sections 4–7 were written by the orchestrator
> in-session after four consecutive `claude-cli` dispatch timeouts (see the Dispatch reliability
> note at the end); their cost is therefore **not** captured in `telemetry.jsonl`.
>
> **Corrections applied to the dispatched output.** The dispatch was sent without the body of
> `requirements.md` attached (an orchestrator packet-construction error — the input slice carried a
> placeholder instead of the file text). It therefore inferred FR meanings from the measured-facts
> sheet and drifted on two of them. Its restatements of **FR-2** and **FR-7** have been replaced
> here with the approved wording, its **OQ-3/OQ-6** answers have been re-pointed at the questions
> actually asked (its original answers were about the layout-cache aliases and the inert
> `smartScroll`, both of which are genuinely useful and are retained as §2.6), and its `file:line`
> citations have been corrected against the repo where they were off. Every load-bearing repo claim
> below was independently verified with a direct read; the verification results are noted inline.

---

## 1. Recommended scope for Gate 2

| FR | Scope (approved wording) | Verdict | Fact-grounded justification |
|----|--------------------------|---------|------------------------------|
| **FR-1** | Make the column key a compiler-checked type across the visual types **and** the layout cache | **IN** | The hazard is concentrated in five shared declarations — `grid/interaction/types/timed-drag.types.ts:38`, `types/all-day-drag.types.ts:28`, `layout.cache.ts:21` (`visibleDates: string[]`), `layout.cache.ts:26` (`DayColumnCache.date`), `layout.cache.ts:169–178` (`buildDayColumns` overloads). Five edits close the hole at source; everything downstream inherits it. This is the actual defect the ticket exists to fix. |
| **FR-2** | Make the shared cross-row commit safe at its shared location | **IN** | `grid/interaction/commit/cross-row.commit.ts:22` and `:45` `dayjs`-parse the key from the **shared** layer. Correct today only because Week is the sole importer — an invariant held by import topology, which is exactly what unification destroys. Pinning the parameter converts an accident into a compiler guarantee, and it is nearly free once FR-1 lands. |
| **FR-3** | Unify the two adapter **type** modules | **IN** | 149 LOC each and **~85% is a pure Week→Day identifier rename**. Genuine deltas are four Week members (`getVisibleDays()`, `onRequestWeekNavigation`, `WeekEdgeNavigableVisual`, `rebuildLayoutAfterNavigation()`) and two Day members (`getColumnKeys()`, `getVisibleDate()`). Best duplication-to-risk ratio in the ticket. |
| **FR-4** | Collapse the two adapter **runtimes** | **CUT** | Two independent reasons. **(a) Blast radius:** 795 + 607 = 1,402 LOC, and the dominant risks — React callback identity and hook/effect ordering — are precisely what the adapter unit tests do not assert, so a green suite would not evidence safety. **(b) Shape mismatch:** `week-interaction.adapter.ts` is decomposed into `adapter/interactions/{timed.drag,timed.resize,all-day.drag,all-day.resize}.ts` plus `adapter/edge-navigation.ts`, while `day-interaction.adapter.ts` is monolithic with no `interactions/` directory. Merging is a re-architecture, not a de-duplication. See §3. |
| **FR-5** | Collapse the layout-cache preset wrappers | **IN** | 73 and 76 LOC, both already thin wrappers over the same shared builders. The differences are **preset data**, not logic. The only structural deltas — Day's `buildDayLayoutCacheForTarget`/`isDayDragTarget`/`isAllDayTarget` and Week's cross-row `buildDragWeekLayoutCache` — stay put. |
| **FR-6** | Collapse the two coordinators | **CUT** | Measured: 217 and 133 LOC, and **the only genuinely duplicated code is the module-level `mapEventsById` helper — ~11 lines, byte-identical**. There is essentially nothing to de-duplicate. Everything else is real domain difference: Week's `commitSavedMutation` carries a `hadFormOpenBeforeInteraction` branch rebuilding a `GridEventDraft` (`editGridEventDraft` → `replaceGridDraftSchedule` → `draftActions.setGridDraft` → `setFormOpen(true)`) and owns `useWeekEventViewModel`, `useDraftContext`, `useWeekInteractionLayoutSync`, `activeInteractionEventRef`, `onRequestWeekNavigation`; Day has no such branch, calls an `onOpenEvent` prop, takes events as props, and owns `getColumnKeys`/`getVisibleDate`. **Optional token:** lift *only* `mapEventsById` into a shared module. ~11 lines, no behaviour surface. Nothing more. |
| **FR-7** | Re-point the existing re-export shims so no consumer outside the two interaction subtrees needs an import edit | **IN** | Bounds the diff and makes INV-13 auditable. It is also where the two dead/no-op aliases get cleaned up (§2.6). Low risk, but **not** zero: a shim can keep its export *name* while its exported *type shape* changes, which compiles at the shim and changes inference at distant call sites — `bun run type-check` is the gate. |

Additionally in scope from the intent brief, tracked as its own step rather than under an FR:
**`.gitignore`** gains `.sdlc/` and `.hook-logs/` entries. Verified absent today; both directories
show as untracked at HEAD.

### What this scope buys, and what it does not

It buys the thing the ticket exists for. The column key stops being a bare `string` at every shared
declaration, so the two places that silently disagree about what a key *means* — Week's date
columns and Day's calendar-or-date union (`day-interaction.adapter.ts:260`) — become a compile-time
distinction instead of a convention held together by comments. The three `dayjs(visual.dayDate)`
parses that are valid only for date keys (`Week/…/commit/all-day.commit.ts:18`,
`grid/interaction/commit/cross-row.commit.ts:22` and `:45`) get signatures that say so. Two pieces
of defensive debris disappear. Alongside that, the shared layer widens by the two extractions with
the best duplication-to-risk ratio available.

It does **not** buy a smaller adapter layer. Afterwards, `week-interaction.adapter.ts` and
`day-interaction.adapter.ts` are still 795 and 607 LOC and still shaped differently, and the two
coordinators are still two coordinators. That is deliberate: FR-4 is where measured duplication does
not justify the risk, and FR-6 is where the duplication barely exists. Nothing here forecloses
either — §3 argues FR-3 is in fact the load-bearing prerequisite for the FR-4 end-state worth
wanting.

---

## 2. Design decisions

### 2.1 OQ-1 — Column-key mechanism: branded union as the constraint, threaded by a type parameter

**Recommendation: hybrid — and the brands are not new.**

The decisive fact, **verified** at `packages/core/src/types/domain-primitives.ts`: both brands this
ticket needs already exist, *with runtime constructors*.

```ts
export const CalendarIdSchema = ObjectIdStringSchema.brand<"CalendarId">();   // :21
export type  CalendarId = z.infer<typeof CalendarIdSchema>;                   // :22
export const DateOnlySchema = zYearMonthDayString.brand<"DateOnly">();        // :24
export type  DateOnly = z.infer<typeof DateOnlySchema>;                       // :25
```

So we do not invent brands. **New file `packages/web/src/grid/interaction/types/column-key.types.ts`:**

```ts
import { type CalendarId, type DateOnly } from "@core/types/domain-primitives";

/** A column identified by the calendar date it renders: every Week column, and
 *  Day's fallback column when no calendar columns are present. */
export type DateColumnKey = DateOnly;

/** A column identified by the calendar it renders: Day's calendar columns. */
export type CalendarColumnKey = CalendarId;

/** Constraint for the column-key type parameter. Bare `string` is NOT assignable
 *  to this — that is the whole enforcement mechanism (see 2.2). */
export type GridColumnKey = DateColumnKey | CalendarColumnKey;

/** Day's instantiation. day-interaction.adapter.ts:255-261 picks the calendar
 *  keys when the event's calendar is a rendered column, and falls back to
 *  `[visibleDateKey]` when it is not, so a Day key is genuinely either kind. */
export type DayColumnKey = CalendarColumnKey | DateColumnKey;
```

**Honest trade-off, stated plainly.** `DayColumnKey` is structurally identical to `GridColumnKey`
today, because Day is the only view with more than one kind of column. It earns its declaration as
documentation and as a single edit point if a third key kind appears — but it is an alias, not a
distinct type, and a reader who assumes otherwise will be wrong. The comment says so.

**Why not the alternatives.** A plain unconstrained opaque generic never rejects `string`, so it
cannot satisfy 2.2. A branded union with no type parameter would force
`DateColumnKey | CalendarColumnKey` onto *every* shared visual, which is a downgrade —
`cross-row.commit.ts` would still have to accept calendar keys it cannot parse. The hybrid is the
only shape where the shared layer stays generic and each consumer pins the instantiation it can
honour.

**Declarations that change:**

| File:line | Change |
|---|---|
| `grid/interaction/types/timed-drag.types.ts:30,38,44` | `TimedDragVisual<TColumnKey extends GridColumnKey>`; `dayDate: TColumnKey`; `initialDayDate: TColumnKey` |
| `grid/interaction/types/all-day-drag.types.ts:14,28,32` | same shape; keep the `:24–27` comment cross-referencing `TimedDragVisual.dayDate` |
| `grid/interaction/layout.cache.ts:9,21` | `GridLayoutCacheOptions<TColumnKey extends GridColumnKey>` with `visibleDates: TColumnKey[]` |
| `grid/interaction/layout.cache.ts:24,26` | `DayColumnCache<TColumnKey extends GridColumnKey>` with `date: TColumnKey` |
| `grid/interaction/layout.cache.ts:50,58` | `GridLayoutCache<TColumnKey>` carrying `dayColumns: DayColumnCache<TColumnKey>[]` and the recursive `crossRow?` |
| `grid/interaction/layout.cache.ts:65–69,169–192` | `BuildDayColumnsInput<TColumnKey>` and `buildDayColumns<TColumnKey>` — both overloads plus the implementation |
| `grid/interaction/layout.cache.ts:194` | `getNearestDayColumn<TColumnKey>` |
| `grid/interaction/math/timed.drag.ts:18,33` · `math/all-day.drag.ts:12,24` | factory inputs `dayDate: TColumnKey`; `createTimedDragVisual<TColumnKey>` / `createAllDayDragVisual<TColumnKey>` |
| `grid/interaction/math/timed.drag.ts:48,85,115` · `math/all-day.drag.ts:35,70,88` | **no textual change** — `initialDayDate: dayDate` and `dayDate: nextColumn?.date ?? visual.dayDate` type-check as-is once the parameter is threaded. This is why the propagation step is cheap. |
| `Week/…/week-interaction.adapter.types.ts` | `getVisibleDays(): DateColumnKey[]`; `WeekEdgeNavigableVisual = AllDayDragVisual<DateColumnKey> \| TimedDragVisual<DateColumnKey>` |
| `Day/…/day-interaction.adapter.types.ts` | `getColumnKeys?: () => CalendarColumnKey[]` |

### 2.2 OQ-7 (blocking) — No bare-string-assignable default, and a proof that cannot rot

The prior run (`62162a95`, on another branch — characterize only, do not modify) shipped
`export interface TimedDragVisual<TColumnKey = string>`. That default is the latent hole: any
un-annotated instantiation resolves the key straight back to `string` and restores the original
hazard **with a green type-check**. Nothing warns.

**Enforcement — both parts required:**

1. **No default at all.** Not `= string`, not `= DateColumnKey`, nothing. Omission is then
   `TS2314: Generic type … requires 1 type argument(s)` — a hard error at every un-annotated
   reference. A default that merely isn't assignable from `string` would still let omission compile
   and silently pick a kind; refusing a default makes the choice mandatory and visible in source.
2. **Constrain to `GridColumnKey`.** Because both members are zod brands, `string` is not
   assignable, so even an explicit `TimedDragVisual<string>` fails with `TS2344`. (1) catches
   omission; (2) catches deliberate widening.

**Proof — a self-invalidating guard.** New file
`packages/web/src/grid/interaction/types/column-key.types.test.ts`:

```ts
// @ts-expect-error TS2314 - omitting the key type must be a compile error, never
// a silent downgrade to `string`. If a default is ever reintroduced, this line
// starts compiling, the directive becomes unused, and TS2578 fails the build.
type _NoBareInstantiation = TimedDragVisual;

// @ts-expect-error TS2344 - `string` must not satisfy the constraint.
type _NoStringKey = TimedDragVisual<string>;

// @ts-expect-error TS2322 - a raw literal must not be a DateColumnKey.
const _noRawLiteral: DateColumnKey = "2026-08-24";
```

The guard is load-bearing precisely because of `TS2578: Unused '@ts-expect-error' directive`. If
anyone re-adds `= string`, line 1 compiles, the directive goes unused, and **the guard file itself
fails to compile**. The check cannot silently pass by degrading — which is exactly the failure mode
of the prior run's arrangement. Repeat all three for `AllDayDragVisual` and
`GridLayoutCacheOptions`. No `tsconfig` change is needed.

### 2.3 Brand construction at the boundaries — no unchecked cast helper

The prior run needed `asDayColumnKeys()` because it invented TypeScript-only brands, which have **no
runtime constructor** — the only way to produce one is a cast, so a cast helper was inevitable.
Reusing the `@core` zod brands removes the reason for the helper: `DateOnlySchema` and
`CalendarIdSchema` *are* the constructors, and they validate.

New runtime module `packages/web/src/grid/interaction/types/column-key.ts`:

1. **Derived from a `Dayjs`** — the dominant path. `day-interaction.adapter.ts:245` currently does
   `getVisibleDate().format(YEAR_MONTH_DAY_FORMAT)`. Replace with `toDateColumnKey(getVisibleDate())`
   = `DateOnlySchema.parse(d.format(YEAR_MONTH_DAY_FORMAT))`. The key move: **the input is not a
   string at all**, so there is no untrusted shape to smuggle through — a `Dayjs` formatted with
   `YEAR_MONTH_DAY_FORMAT` is date-only by construction, and zod confirms it. The same constructor
   supplies Week's `getVisibleDays(): DateColumnKey[]`.
2. **Arriving as a genuine string** (DOM dataset, URL, storage) —
   `parseDateColumnKey(raw: string): DateColumnKey | null` via `safeParse`. Returns `null` on
   failure, forcing callers to branch. Total function, no escape hatch.
3. **Calendar ids from React props** — no construction needed: `GridEvent.calendarId` is *already*
   `CalendarId`. Typing `getColumnKeys?: () => CalendarColumnKey[]` exposes exactly one leak,
   **verified** at `day-interaction.adapter.ts:257–259`:
   `calendarColumnKeys.indexOf(target.event.calendarId ?? "")`. The `?? ""` substitutes a bare
   string for a missing id and will now be a compile error. Fix by skipping the lookup when
   `calendarId` is undefined — `eventColumnIndex = target.event.calendarId ? keys.indexOf(target.event.calendarId) : -1`
   — which is what the surrounding `>= 0` guard already intends.

**The one narrowing site.** `Day/…/commit/timed.commit.ts:77–82` returns `CalendarId | undefined`
from `visual.dayDate`, now `DayColumnKey`. Replace the `as CalendarId` cast with a validating guard
`isCalendarColumnKey(k) => CalendarIdSchema.safeParse(k).success`, falling through to
`event.calendarId` when false. The guard should never fire at runtime — `day-interaction.adapter.ts:255–261`
gives `columnKeys` either the calendar keys or a single-element date array, and a single-element
array can never produce `dayDate !== initialDayDate` — but writing it as a guard rather than a cast
tells the type system the truth, and the false branch returns the same conservative answer the
current code already intends. See R-4 for the risk that it *does* fire.

### 2.4 OQ-2 — `cross-row.commit.ts` stays in `grid/interaction/commit/`

**Recommendation: keep it where it is, pinned to `DateColumnKey`.** Signatures become
`allDayDragVisualToTimedGridEvent(event, visual: AllDayDragVisual<DateColumnKey>)` and
`timedDragVisualToAllDayGridEvent(event, visual: TimedDragVisual<DateColumnKey>)`.

The file is imported only by Week today, which is the argument for moving it — and it is the wrong
argument. What the file *does* is convert between all-day and timed grid events; that is a grid
capability, not a Week feature. Its two parses are valid for date-typed keys and meaningless for
calendar-typed ones, and pinning the parameter states that constraint in the signature — which is
the property that makes it *safe* to leave shared. Moving it under `views/Week/interaction/` would
narrow the shared layer at the moment the ticket's purpose is to widen it, and it would have to move
back the first time another date-column view (a 3-day view, a custom range) needs the conversion.

This adds no cross-row capability to Day and touches no commit rule. Day's adapter never builds a
drag/cross-row cache, so nothing in the Day tree reaches these functions; and afterwards it *could
not* typecheck against them even if it tried, because `DayColumnKey` is not assignable to
`DateColumnKey`. The type parameter enforces what file placement only suggested.

### 2.5 OQ-4 — Week-only capability: shared base plus per-view types, with `never` negations

**Recommendation: shared base + per-view options, and declare Week's capability members as optional
`never` on the Day types.** Flat optional fields are correctly rejected by the requirements;
optional-`never` is a different construct — a *negative* declaration — and it is what makes the
assignment actually fail.

```ts
// grid/interaction/adapter/base.types.ts  (NEW — the FR-3 extraction)
export interface GridInteractionAdapterOptions<TColumnKey extends GridColumnKey> { /* the ~85% */ }
export interface GridInteractionAdapter<TColumnKey extends GridColumnKey> { /* the ~85% */ }

// Week/…/week-interaction.adapter.types.ts
export interface WeekInteractionAdapterOptions
  extends GridInteractionAdapterOptions<DateColumnKey> {
  getVisibleDays(): DateColumnKey[];
  onRequestWeekNavigation?: (direction: "next" | "prev") => void;
}

// Day/…/day-interaction.adapter.types.ts
export interface DayInteractionAdapterOptions
  extends GridInteractionAdapterOptions<DayColumnKey> {
  getColumnKeys?: () => CalendarColumnKey[];
  getVisibleDate?: () => Dayjs;
  /** INV-7: Day drives no navigation. Declared `never` so a Week-shaped config
   *  is rejected even when it arrives via a variable, not just a literal. */
  onRequestWeekNavigation?: never;
  getVisibleDays?: never;
}
```

Apply the same `rebuildLayoutAfterNavigation?: never` negation to `DayInteractionAdapter`.

**Why `never` and not mere omission:** omission relies on TypeScript's excess-property check, which
fires on object *literals* only. A Week-shaped config passed through a variable would assign
cleanly. `?: never` makes it an error on every path — the difference between documenting INV-7 and
enforcing it.

**Why not a discriminated union:** there is no runtime discriminant and nothing would read one. The
adapters are separate factory functions selected at import time, not one factory branching on a tag;
a union would force an artificial `view: "week" | "day"` field and narrowing at call sites with no
ambiguity to resolve.

**Why not a capability type parameter:** it would put a second parameter alongside `TColumnKey` on
every shared signature, permanently, to model a capability that is fixed per view at compile time
and already fully determined by which options type was chosen. Cost on every declaration,
information gained on none.

### 2.6 Two dead/no-op aliases, and the inert `smartScroll`

*(These were surfaced by the dispatch under its own numbering; they are real and verified, and are
retained here as concrete FR-7/FR-5 work items.)*

- **`DayLayoutCacheSources`** (`day-layout.cache.ts:26`) — **verified dead**: the declaration is its
  only occurrence in the tree. Day's types file already imports `GridLayoutCacheSources` directly.
  Delete.
- **`WeekLayoutCacheSources`** (`week-layout.cache.ts:24`) — a bare no-op alias with **three**
  consumer sites (`WeekInteractionCoordinator.tsx:18` and `:30`;
  `week-interaction.adapter.types.ts:17` and `:26`; `week-layout.cache.ts:43`). Inline to
  `GridLayoutCacheSources`. The asymmetry between these two aliases is itself a small trap.
- **Week's all-day preset passes `smartScroll`, which `buildAllDayGridLayoutCache` ignores.** Inert
  today. The preset extraction must be behaviour-identical, and this ticket has no mandate to decide
  whether all-day rows *should* smart-scroll. Carry it across verbatim with a one-line comment
  recording that it is currently ignored; file the question separately.

### 2.7 OQ-3 and OQ-6 — the questions actually asked

- **OQ-3 — how to record Day's single-column date fallback.** Treat it as **permanent behaviour for
  now, documented in the shared types, with a follow-up ticket filed to decide**. INV-11 freezes it
  for this ticket either way. The `DayColumnKey` union and the comment at
  `column-key.types.ts` are the documentation; the follow-up asks whether Day's column keys should
  become uniformly calendar ids, which would let `DayColumnKey` collapse to `CalendarColumnKey` and
  make the union genuinely meaningful rather than an alias.
- **OQ-6 — may FR-1 rewrite the now-wrong doc comments?** **Yes.** `GridLayoutCacheOptions.visibleDates`
  (`layout.cache.ts:20`) and `DayColumnCache.date` (`layout.cache.ts:25`) are both documented as
  `Local YYYY-MM-DD` but demonstrably carry calendar ids in Day. The comments are wrong, not
  authoritative; correcting them is a doc-only change bundled into FR-1.

---

## 3. FR-4 end-state options — decision requested, execution deferred

FR-4 is **CUT** from Gate 2. Both options are deferred regardless of which is chosen; the decision
requested is which end-state this ticket's work should aim *toward*, so FR-1/2/3/5 do not
accidentally build away from it.

### Option A — align Day to Week's decomposed shape

Give `views/Day/interaction/adapter/` an `interactions/` directory mirroring Week's
`{timed.drag, timed.resize, all-day.drag, all-day.resize}.ts`, splitting the 607-LOC monolith along
the same seams. *(This is the framing the prior run used for its deferred FR-3.)*

**End-state:** two adapters, both decomposed, still one per view under `views/`. Nothing new moves
into `grid/interaction/`.

**Migration cost:** moderate and bounded. Purely intra-file motion within one writable tree; the Day
adapter's public surface is unchanged, so `day-interaction.adapter.test.ts` should pass untouched —
a genuine safety signal. Callback identity and effect ordering stay inside one file's control flow.

**Weakness:** it buys symmetry, not sharing. The 1,402 LOC remain 1,402 LOC in `views/`, and
parallel-but-separate structure is exactly the arrangement that lets the two adapters drift again —
the `WeekLayoutCacheSources`/`DayLayoutCacheSources` asymmetry is that drift in miniature.

### Option B — collapse both onto one shared adapter in `grid/interaction/`

One `createGridInteractionAdapter<TColumnKey>(options)` in the shared layer, with Week and Day
reduced to configuration: presets, key type, capability set. *(This is this run's FR-4 framing.)*

**End-state:** the adapter itself is shared. The view folders retain only genuinely view-specific
pieces — Week's `edge-navigation.ts` and `useWeekInteractionLayoutSync.ts`, Day's target dispatch.

**Migration cost:** high. It absorbs Option A's decomposition as a prerequisite *and* must reconcile
the real behavioural deltas: Week's cross-row `buildDragWeekLayoutCache` against Day's
`buildDayLayoutCacheForTarget`/`isDayDragTarget`/`isAllDayTarget`, plus Week-only edge navigation.
Done carelessly it is also the most likely way to accidentally hand Day a cross-row path — the
shared adapter must be structurally incapable of it, which the §2.5 `never` negations and the
`DayColumnKey`-vs-`DateColumnKey` split are designed to guarantee.

### Which fits "widen `grid/interaction/`" — **Option B**

Option B *is* the goal restated: the adapter moves into the shared layer and the views become
configuration. Option A leaves the shared layer exactly as wide as it was and only makes the two
view-local adapters resemble each other — a readability improvement, not a widening.

The practical route is **A as a step, B as the destination**: Option A's decomposition is a strict
prerequisite for B and is independently valuable, so it can land alone without committing to B.

**What this ticket should do about it:** nothing, except stop building away from it. The Gate-2
scope is already the right groundwork — FR-3 produces `GridInteractionAdapterOptions<TColumnKey>`
and the capability split, which is precisely the per-view config surface Option B needs, and FR-5
produces the preset separation that lets one shared adapter take both views' geometry from data.
That FR-3 is the load-bearing prerequisite for the FR-4 end-state is a further reason to keep it IN
and FR-4 out.

---

## 4. Ordered execution plan

Every step ends at a **verification gate**. FR-1 and FR-2 are each their own fully-green checkpoint
before the next begins (AC-7). Steps are sequenced so that no step depends on a later one.

**Character of FR-1:** a *wide but shallow* signature change. It touches many files, but almost every
downstream edit is dictated by a compiler error rather than by judgment — which is what makes the
bulk of it safe to delegate once the type design (S1–S2) is fixed by a premium tier.

### S1 — Introduce the column-key vocabulary (FR-1a) · **JUDGMENT**

- **Files (new):** `packages/web/src/grid/interaction/types/column-key.types.ts`,
  `packages/web/src/grid/interaction/types/column-key.ts`,
  `packages/web/src/grid/interaction/types/column-key.types.test.ts`
- **Change:** declare `DateColumnKey`, `CalendarColumnKey`, `GridColumnKey`, `DayColumnKey` over the
  existing `@core` zod brands; add `toDateColumnKey`, `parseDateColumnKey`, `isCalendarColumnKey`;
  add the three self-invalidating `@ts-expect-error` guards.
- **INVs at risk:** none — additive only, nothing imports these yet.
- **Gate:** `bun run type-check` clean (the guard file must compile *because* its directives are
  used); `bun run lint` exit 0. Full suite unchanged at 2298.
- **Why judgment:** the constraint shape and the no-default rule are the entire safety mechanism.

### S2 — Thread the parameter through the shared layer (FR-1b) · **JUDGMENT**

- **Files:** `grid/interaction/types/timed-drag.types.ts`, `types/all-day-drag.types.ts`,
  `grid/interaction/layout.cache.ts`, `grid/interaction/math/timed.drag.ts`,
  `grid/interaction/math/all-day.drag.ts`
- **Change:** add `<TColumnKey extends GridColumnKey>` per the §2.1 table; correct the two wrong doc
  comments (OQ-6). The six propagation sites need no textual change.
- **INVs at risk:** INV-12 (layout geometry must be unchanged — this is types-only, assert it),
  INV-7 (do not let the cross-row fields become populated for Day as a side effect).
- **Gate:** type-check will now fail *loudly across consumers* — that is expected and is the input to
  S3. Do not proceed until the shared layer itself is internally consistent.
- **Why judgment:** variance and inference decisions here determine whether S3 is mechanical.

### S3 — Fix the compiler-guided fallout (FR-1c) · **MECHANICAL**

- **Files:** `Week/interaction/adapter/commit/all-day.commit.ts`, `commit/timed.commit.ts`,
  `Week/interaction/adapter/interactions/{timed.drag,all-day.drag,timed.resize,all-day.resize}.ts`,
  `Week/interaction/adapter/week-interaction.adapter.ts`,
  `Week/interaction/adapter/geometry/week-layout.cache.ts`,
  `Day/interaction/adapter/day-interaction.adapter.ts` (`:245`, `:257–259`, `:282`, `:313`),
  `Day/interaction/adapter/commit/timed.commit.ts` (`:82`),
  `Day/interaction/adapter/commit/all-day.commit.ts` (`:19`),
  `Day/interaction/adapter/geometry/day-layout.cache.ts`
- **Change:** instantiate the parameter at each consumer; replace the `?? ""` with the
  undefined-guard; replace the `as CalendarId` cast with `isCalendarColumnKey`; delete the dead
  `"dayDate" in visual` check; adopt `toDateColumnKey` at the two derivation points.
- **INVs at risk:** INV-2 (the cross-calendar move rule), INV-4 (Day all-day never rewrites dates),
  INV-11 (the fallback must survive), INV-3 (Week delta semantics).
- **Gate:** **full FR-1 checkpoint** — `bun run type-check` clean, `bun run test:web` 2298/0 across
  302 files, interaction suite 159/0, `bun run lint` exit 0 with no new warnings.
- **Why mechanical:** every edit is dictated by a compiler error with a known-correct fix; the two
  semantic edits (guard, cast replacement) are specified verbatim in §2.3.

### S4 — Pin the shared cross-row commit (FR-2) · **MECHANICAL**

- **Files:** `grid/interaction/commit/cross-row.commit.ts`, plus any Week call sites needing an
  explicit instantiation.
- **Change:** pin both functions to `<DateColumnKey>` per §2.4. No logic change; no runtime guard
  added (a guard that can fire would violate INV-8; one that cannot is the dead code FR-1 removes).
- **INVs at risk:** INV-8.
- **Gate:** **full FR-2 checkpoint** — same four commands, all green. Additionally confirm by
  inspection that no Day-tree file can name these functions with a `DayColumnKey` visual.

### S5 — Unify the adapter type modules (FR-3) · **JUDGMENT**

- **Files (new):** `grid/interaction/adapter/base.types.ts`. **Modified:**
  `Week/interaction/adapter/week-interaction.adapter.types.ts`,
  `Day/interaction/adapter/day-interaction.adapter.types.ts`
- **Change:** extract the ~85% shared surface; Week and Day extend it; add the three `?: never`
  negations to the Day types per §2.5.
- **INVs at risk:** INV-7 (this is the step that *enforces* it), INV-9 (Week navigation members must
  survive intact), INV-13.
- **Gate:** all four commands green, plus the new INV-7 type assertion from S8.
- **Why judgment:** the extension-point modelling is the decision FR-4 would later build on.

### S6 — Collapse the layout-cache presets (FR-5) · **JUDGMENT**

- **Files:** `Week/interaction/adapter/geometry/week-layout.cache.ts`,
  `Day/interaction/adapter/geometry/day-layout.cache.ts`, and a shared preset factory under
  `grid/interaction/`.
- **Change:** one preset-driven factory taking per-view data; Day's target-dispatch helpers and
  Week's cross-row builder stay view-side. Carry the inert `smartScroll` verbatim (§2.6).
- **INVs at risk:** **INV-9 and INV-10 — the highest-risk step in the ticket for silent breakage**,
  because the preset values are pure data and nothing asserts them today (see §5).
- **Gate:** all four commands green **and** the new preset-value assertions from S8 passing.
- **Why judgment:** "preserve exact values" is the whole task; a transcription slip is invisible.

### S7 — Re-point the shims and delete the dead aliases (FR-7) · **MECHANICAL**

- **Files:** `Week/interaction/registry/week-event.registry.ts`,
  `Week/interaction/targeting/week-event.targeting.ts`,
  `Day/interaction/registry/day-event.registry.ts`,
  `Day/interaction/targeting/day-event.targeting.ts`, both geometry cache files, plus
  `WeekInteractionCoordinator.tsx:18,30` and `week-interaction.adapter.types.ts:17,26` for the
  `WeekLayoutCacheSources` inline.
- **Change:** re-point exports; delete `DayLayoutCacheSources` and `WeekLayoutCacheSources`.
- **INVs at risk:** INV-6 (every export name must keep resolving), INV-13.
- **Gate:** all four commands green; confirm no file outside the two interaction subtrees and
  `grid/interaction/` appears in `git diff --name-only`.

### S8 — Pin the unpinned invariants · **JUDGMENT** (assertions), **MECHANICAL** (mechanics)

Add the new assertions from §5. Sequenced last so they assert the final shape, **except** that the
INV-9/INV-10 preset assertions should be written *before* S6 and run against the pre-merge code
first, to prove they actually capture today's values. Gate: all four commands green.

### S9 — `.gitignore` · **MECHANICAL**

Add `.sdlc/` and `.hook-logs/`. Verified absent today. Gate: `git status --porcelain` no longer
lists them as untracked.

---

## 5. Test strategy

### What is already pinned

| INV | Pinned by |
|---|---|
| INV-1 (Week timed drag/resize) | `week-interaction.timed-drag.test.ts` (819 LOC), `week-interaction.timed-resize.test.ts` (537) |
| INV-2 (Day timed drag/resize + cross-calendar rule) | `day-interaction.adapter.test.ts` (665) |
| INV-3 (Week all-day delta semantics) | `week-interaction.all-day-drag.test.ts` (488) |
| INV-5 (raw key inequality) | `week-interaction.all-day-drag.test.ts` |
| INV-8 (Week cross-row) | `grid/interaction/commit/cross-row.commit.test.ts` (146), `math/cross-row.drag.test.ts` (203), `week-interaction.cross-row-drag.test.ts` (474) |
| INV-12 (layout geometry) | `grid/interaction/layout.cache.test.ts` (55) |
| INV-13 (blast radius) | not a test — enforced by the write contract and the S7 `git diff` check |

### What is NOT pinned, and must be

1. **INV-9 / INV-10 — the layout preset values. This is the most important gap.** `edgeThresholdPx`
   (`WEEK_EDGE_NAVIGATION_THRESHOLD_PX` for Week, `INTERACTION_EDGE_THRESHOLD_PX` for Day timed, `0`
   for Day all-day) and the presence/absence of `smartScroll` are **pure data asserted by nothing
   today**. A transcription slip during S6 produces no type error and no test failure — it surfaces
   only as changed edge-scroll behaviour during a real drag. *New assertions* in
   `grid/interaction/layout.cache.test.ts` (or a new `layout-presets.test.ts` beside the shared
   factory): for each of the three presets, assert the exact `edgeThresholdPx` and that
   `smartScroll` is defined for Week/Day-timed and **undefined** for Day-all-day. Write these
   **before S6** and run them against current code first — an assertion that has never gone red
   against the pre-merge values is not evidence.
2. **INV-6 — view-agnostic id resolution.** `view-event-registry.test.ts` (101 LOC) covers the
   registry, but the requirement is that `readCalendarEventIdFromElement` resolves ids from *both*
   views' `data-${view}-interaction-event-*` attributes. Add an explicit two-view assertion there:
   build an element with the Week attribute and one with the Day attribute, and assert the same
   resolver returns the right id for each. This is what context menus and undo focus-restore depend
   on, and it would break at runtime with no compiler error.
3. **INV-7 — cross-row fields inert for Day.** Currently enforced only by nothing populating them.
   Add a *type-level* assertion in `column-key.types.test.ts` (or beside the Day adapter types) that
   a Week-shaped options object with `onRequestWeekNavigation` is **not** assignable to
   `DayInteractionAdapterOptions` — this is what the `?: never` negations buy, and without an
   assertion a future edit could quietly drop them.
4. **INV-11 — Day's fallback duality.** Add a case to `day-interaction.adapter.test.ts`: when the
   event's calendar is *not* among the rendered columns, the single fallback column key is a date,
   and a purely vertical drag commits **no** calendar move. This directly guards the `?? ""` fix in
   S3.
5. **INV-4 — Day all-day never rewrites dates.** Confirm existing coverage; if absent, add a direct
   assertion that `commitAllDayDragInteraction` returns `startDate`/`endDate` untouched.

### Known noise — do not fix

React `act(...)` warnings from `SettingsModal` in `DayInteractionCoordinator.test.tsx` are
pre-existing and explicitly out of scope. They are warnings, not failures. Do not "clean them up"
while in the file.

---

## 6. Rollback

Each step is an independent checkpoint committed separately, so rollback never unwinds more than one
step.

| Step | Revert | Confirm clean |
|---|---|---|
| S1 | Delete the three new files | `type-check` + full suite green; `git status` shows no residue |
| S2 | `git revert` the S2 commit | The shared layer returns to bare `string`; consumers compile again |
| S3 | Revert S3 **and** S2 together — S2 alone leaves consumers uncompilable | Full four-command gate green at the pre-FR-1 baseline |
| S4 | Revert S4 alone; independent of S3 | Four-command gate green |
| S5 | Revert S5; restores the two 149-LOC type modules | Four-command gate green |
| S6 | Revert S6; restores both preset wrappers | Preset assertions from S8 pass against the restored values |
| S7 | Revert S7; shims and both aliases return | `git diff --name-only` empty outside the interaction subtrees |
| S8 | Assertions are additive — delete the added cases | Suite returns to 2298 |
| S9 | Remove the two `.gitignore` lines | — |

**Whole-run rollback:** `git revert` the range, then confirm `bun run test:web` is 2298/0 and
`git merge-base --is-ancestor 62162a95 HEAD` is still false (this branch must never acquire the
prior run's commit).

---

## 7. Risks and mitigations

| # | Risk | Likelihood | Impact | Mitigation | Step |
|---|---|---|---|---|---|
| R-1 | The type parameter silently resolves to `string` at an un-annotated site, restoring the original hazard with a green type-check — the exact hole in the prior run's shipped code | **High** if a default is allowed; Low with the design as specified | **High** — silent date corruption, no compiler help | No default at all (TS2314 on omission) + `GridColumnKey` constraint (TS2344 on `<string>`) + the self-invalidating `@ts-expect-error` guard whose directives fail via TS2578 if a default returns | S1, S2 |
| R-2 | **FR-5 preset drift** — a wrong `edgeThresholdPx`, or `smartScroll` accidentally enabled for Day's all-day row. No type error, no test failure; surfaces only during a real drag | **Medium** | Medium — changed edge-scroll behaviour, violates INV-9/INV-10 | Write the preset-value assertions **before** S6 and run them green against pre-merge code, so they demonstrably capture today's values | S6, S8 |
| R-3 | An FR-7 shim keeps its export *name* while its exported *type shape* changes, compiling at the shim but changing inference at distant call sites | Medium | Medium | `bun run type-check` across all workspaces is the gate; explicitly list in review any shim whose exported type shape changed | S7 |
| R-4 | The `isCalendarColumnKey` guard **does** fire at runtime, changing behaviour — it is asserted unreachable, and an unreachable-guard assumption is exactly the kind that rots | Low | **High** — a cross-calendar move silently becomes a no-op | The false branch returns `event.calendarId`, the same conservative answer the current cast path intends, so a firing guard degrades safely rather than corrupting. Cover with the INV-11 fallback test | S3, S8 |
| R-5 | Scope creep into the CUT FR-4/FR-6 — S3 and S7 both open the two large adapters and the coordinators | Medium | Medium — blows the risk budget the Gate-2 cut was chosen to respect | Cut is explicit in this plan; S3 edits to the adapters are limited to compiler-dictated instantiations; a coordinator edit beyond the optional `mapEventsById` lift is out of scope and should be refused at review | S3, S7 |
| R-6 | `DayColumnKey` is an alias of `GridColumnKey` today and a future reader treats it as a distinct constraint | Medium | Low | Documented explicitly at the declaration; the follow-up ticket in §2.7 (OQ-3) is where it either becomes distinct or is removed | S1 |
| R-7 | Threading the parameter through `layout.cache.ts` (the widest shared surface) leaks back to `string` via one un-annotated inference site | Medium | High | The brand constraint makes bare `string` non-assignable, so a leak is a compile error rather than a silent widening; R-1's guards cover the reintroduced-default case | S2 |

---

## Dispatch reliability note (recorded for the policy A/B)

Six premium dispatches were attempted for this phase. **Four timed out** at the `claude-cli`
adapter's 300s ceiling with zero output tokens and `$0` cost; two succeeded. The failures correlate
perfectly with `cache_hit: false` — every dispatch that hit the prompt cache returned (1.7s to
283s), every dispatch that missed it hung until killed. Instruction length was investigated as a
cause and **ruled out**: a ~2.8k-char instruction succeeded, and a later ~2.4k-char instruction with
bulk content moved into `inputs` (the same shape that had just succeeded) still timed out.

Two consequences worth carrying into the report:

1. **No ambiguity about partial writes.** Because this policy's tier is a *model* that returns
   content which the orchestrator then writes through the gated `Write`/`Edit` path, a failed
   dispatch is unambiguously a no-op. This was verified after the first failure — no
   `change_plan.md`, no source edits. The prior run's `success:false`-but-actually-written pattern
   is structurally impossible here, because the worker has no shell.
2. **Sections 4–7 were written by the orchestrator in-session**, not dispatched, after the fourth
   timeout. Their cost is absent from `telemetry.jsonl`, so the run's captured total understates the
   true total. This is a deviation from `auth_mode: vendor` and is declared rather than hidden.
