# Senior Code Review — CMP-104 (FR-1 + FR-2)

- **Run:** `20260824-002919-refactor-week-day-interaction`
- **Branch:** `CMP-104/opus-plus-flash-v37` @ base `4189de13` (nothing committed)
- **Scope reviewed:** working tree only, 42 files. Commit `62162a95` on the sibling
  `flash-agsdk-only` branch was **not** read or modified.
- **Intent:** refactor, hard "zero runtime behaviour change" requirement.

## Verdict: **approve-with-comments**

No blockers. FR-1 and FR-2 are correctly and completely delivered, and the two riskiest
behaviour-preservation claims (decisions 3 and 4) hold under scrutiny. Seven minor findings,
all mechanical; none require re-opening the design.

---

## Verification re-run independently

| Check | Result |
|---|---|
| `bun run type-check` | exit 0, zero errors |
| `bun run lint` | exit 0, **10 warnings** — matches tolerated pre-existing count, none in changed files |
| `bun run test:web` | **2305 pass / 0 fail** across 303 files |

The +7 tests reconcile exactly: `layout-presets.test.ts` +4, `view-event-registry.test.ts` +2
(`it.each` × 2), `day-interaction.adapter.test.ts` +1.

### Compile-probes (written, run, deleted; tree left clean)

Both central FR-1/FR-2 claims are compiler-verified, not merely asserted:

```
__probe.negative.ts(10,41): error TS2345: Argument of type 'AllDayDragVisual<DayColumnKey>'
  is not assignable to parameter of type 'AllDayDragVisual<string & $brand<"DateOnly">>'.
__probe.negative.ts(13,21): error TS2314: Generic type 'AllDayDragVisual<TColumnKey>'
  requires 1 type argument(s).
```

- **TS2345** — a Day visual is genuinely rejected by the `DateColumnKey`-pinned shared
  cross-row commit. This is exactly the hazard FR-2 existed to close, and it is closed.
- **TS2314** — omitting the type argument is a hard error. The no-default choice works as
  designed. This is a strictly stronger guarantee than the defaulted
  `TimedDragVisual<TColumnKey = string>` shipped on the sibling branch, where every un-updated
  call site would have silently kept bare `string` and the compiler would have said nothing.
  Type-check passing on a no-default parameter is itself the proof that **every** consumer was
  found and updated.

---

## What I most wanted to scrutinise

### Behaviour preservation — decisions 3, 4, 5

**Decision 3 (`columnMoveCalendarId`, `Day/.../commit/timed.commit.ts:85-98`) — reasoning
VERIFIED, guard is genuinely unreachable.**

The argument holds, and it holds for a reason slightly more specific than stated. Confirmed by
reading `day-interaction.adapter.ts` end to end:

- `createVisual` (line 267) computes `columnKeys` **once** and passes that **same array** to
  both `buildDayLayoutCacheForTarget` (line 271) and `createTimedDragVisual` /
  `createAllDayDragVisual` (lines 289, 320). So `initialDayDate` and every subsequent `dayDate`
  are drawn from one identical key list.
- `dayDate` is only ever reassigned from `layout.dayColumns[].date` — verified in
  `updateAllDayDragVisual` (`math/all-day.drag.ts:87,97`) and `updateTimedDragVisual`. It never
  originates anywhere else.
- `layout` is assigned at exactly one site (line 283) and nulled at lines 215 and 240. Day has
  **no** `rebuildLayoutAfterNavigation` (Week does), so the layout cannot be swapped mid-drag.
- Day never builds a `crossRow` cache (`buildDayAllDayLayoutCache` / `buildDayTimedLayoutCache`
  call the single-row builders, not `buildDragGridLayoutCache`), so no second column list can
  leak in.

That yields exactly two reachable states:
- `eventColumnIndex >= 0` → `columnKeys = calendarColumnKeys`, every element a
  `CalendarColumnKey` → `isCalendarColumnKey` is always true → identical to the old
  `as CalendarId`.
- `eventColumnIndex < 0` → `columnKeys = [visibleDateKey]`, length 1 → `getNearestDayColumn`
  can only return that one column → `dayDate === initialDayDate` always → the `!==` branch is
  never entered at all.

So the new guard cannot fire, and in the unreachable state where it would, returning
`event.calendarId` is *safer* than the old code (which returned a date string cast to
`CalendarId` — a corrupted id). **Behaviour-identical on every reachable path.** Confirmed, not
refuted.

*Advisory, not a defect:* this unreachability is an unwritten coupling — it depends on
`createVisual` feeding one array to both consumers. The intent brief names "adding cross-row
drag to Day" as a follow-up ticket; that work would rebuild Day's layout mid-drag and could make
the fallback live. The code comment already concedes the fallback is "the same conservative
answer", which is honest. Worth carrying into the follow-up ticket's notes.

**Decision 4 (`day-interaction.adapter.ts:262-264`) — behaviour-identical.**

Old `indexOf(calendarId ?? "")` vs new `calendarId ? indexOf(calendarId) : -1`. The two diverge
only if `calendarColumnKeys` contains `""`. Its sole production source is
`DayCalendarGrid.tsx:176` — `displayedCalendars.map((c) => c.id)`, now typed `CalendarColumnKey[]`
(24-hex branded), so `""` is not representable. Note the new guard is `truthy`, not `!= null`, so
it *also* short-circuits `calendarId === ""`; old code's `"" ?? ""` → `indexOf("")` → `-1`
reaches the same answer. Equivalent.

**Decision 5 (`Day/.../commit/all-day.commit.ts:22`) — behaviour-identical.**

`"dayDate" in visual` on a field the interface declares non-optional, against objects built by
`createAllDayDragVisual` which unconditionally sets `dayDate`. Always `true` at runtime; deleting
it cannot change `hasMoved`. Correct removal.

### Did the brand leak?

**Production: no.** A grep for `dayDate|initialDayDate|visibleDates|visibleDays|columnKeys` cross
-referenced against `string` across `grid/interaction/**`, `views/Week/interaction/**` and
`views/Day/interaction/**` returns **zero** hits. No `any`, no `@ts-expect-error`, no
`@ts-ignore` anywhere in the changed set. The only `as` in changed production code is
`layout.cache.ts:191` (`input as BuildDayColumnsInput<TColumnKey>`), which is the pre-existing
overload-implementation discriminator, unchanged in kind.

**Tests: yes, in one place** — see finding 3 below (`as never`, pre-existing but now removable).

### Variance / inference

Clean. `GridLayoutCache<TColumnKey>` is used covariantly (the parameter appears only in
`DayColumnCache.date` and `visibleDates`), so `AllDayDragVisual<DayColumnKey>` is correctly
**not** assignable to `AllDayDragVisual<DateColumnKey>` — confirmed by the TS2345 probe above.
The reverse widening (Week visual into a Day-parameterised slot) is permitted but harmless: each
adapter's `DayInteractionVisual` / `WeekInteractionVisual` union keeps the two stacks separate.
I found no un-annotated inference site that resolves `TColumnKey` too loosely — every
`buildDayColumns` / `getNearestDayColumn` / `resolveDragColumn` call infers from an
already-branded argument.

`DayColumnKey` is structurally identical to `GridColumnKey` today; the doc comment at
`column-key.types.ts:21-32` says so explicitly rather than implying a constraint it does not
carry. Honest.

### INV-12 geometry — byte-identical

Diffed `buildDayColumns` bodies old vs new. The three load-bearing lines are unchanged
character-for-character:

```ts
const columnWidth = input.width / dates.length;
left: input.left + columnWidth * index,
if (dates.length === 0) { return []; }
```

Only the signature and the overload-discriminator cast gained `<TColumnKey>`. INV-12 holds.

### Test quality

- `layout-presets.test.ts` — **load-bearing.** It pins `edgeThresholdPx` and
  `smartScroll` presence/absence for all four presets, including the two easy-to-miss cases
  (Day all-day pinned to `0`; Week all-day passing a `smartScroll` option that
  `buildAllDayGridLayoutCache` silently ignores). Nothing asserted these before. Good guard for
  the deferred FR-5.
- `day-interaction.adapter.test.ts:484` — **load-bearing, correctly scoped.** It passes under
  both old and new code, which is exactly right for a refactor: it pins the equivalence. It
  asserts an observable outcome (`hasMoved === false`, `calendarId === undefined`) that would
  flip if the fallback ever anchored to column 0.
- `view-event-registry.test.ts:109` — **partly vacuous.** See finding 5.

### Env fixtures

**N/A.** Frontend refactor, no validating `ConfigModule`/Joi/Zod config schema in scope, and the
intent is `refactor`. The env-fixture blocker rule does not apply.

---

## Findings

| # | Sev | File:line | Issue |
|---|---|---|---|
| 1 | minor | `packages/web/src/grid/interaction/types/column-key.ts:24` | `parseDateColumnKey` has **zero callers** |
| 2 | minor | `packages/web/src/views/Day/interaction/adapter/day-interaction.adapter.test.ts:33-36` | New `as` tuple cast; `asCalendarColumnKey` sits unused |
| 3 | minor | same file `:40,52,423,434,443,456,465` | Six stale `as never` casts now defeat the new brand |
| 4 | minor | `packages/web/src/grid/interaction/types/column-key.ts:10-17` | Doc comment overclaims totality; `toDateColumnKey` throws |
| 5 | minor | `packages/web/src/grid/interaction/view-event-registry.test.ts:103-125` | Self-referential assertion; comment claims rename-detection it does not provide |
| 6 | minor | `.claude/settings.json:84-94` | Unrelated tooling change riding in the CMP-104 change set |
| 7 | minor | `packages/web/src/grid/interaction/types/timed-drag.types.ts:32` | No regression guard against a future default being added to `TColumnKey` |

### 1 — `parseDateColumnKey` is dead code (minor)

`packages/web/src/grid/interaction/types/column-key.ts:24`

Zero callers anywhere in `packages/web/src`. It is documented for keys that "genuinely arrive as
strings (DOM dataset, URL, storage)" — a real future need, but speculative API added inside a
zero-behaviour-change refactor.

**Fix:** delete it, and re-add it in the ticket that actually parses a DOM/URL column key. (If it
is deliberately kept as the sanctioned escape hatch for that future work, say so in the comment
and note it is currently unused, so a later reader does not assume it is on a live path.)

### 2 — New `as` tuple cast, while the helper that avoids it goes unused (minor)

`packages/web/src/views/Day/interaction/adapter/day-interaction.adapter.test.ts:33-36`

```ts
const [CALENDAR_A, CALENDAR_B] = asCalendarColumnKeys([
  "aaaaaaaaaaaaaaaaaaaaaaaa",
  "bbbbbbbbbbbbbbbbbbbbbbbb",
]) as [CalendarColumnKey, CalendarColumnKey];
```

The stated design goal was that "NO unchecked cast helper is needed anywhere", and this is the
one new `as` the change introduces. It is benign (the *elements* are validated; the assertion is
only about tuple arity vs `noUncheckedIndexedAccess`) but it is avoidable — and
`asCalendarColumnKey`, the singular helper that removes the need for it, has **zero callers**.

**Fix:**

```ts
const CALENDAR_A = asCalendarColumnKey("aaaaaaaaaaaaaaaaaaaaaaaa");
const CALENDAR_B = asCalendarColumnKey("bbbbbbbbbbbbbbbbbbbbbbbb");
```

Cast-free, and it puts the unused export to work. The `CalendarColumnKey` type import then
becomes unused at the top of the file if nothing else needs it — check before removing.

### 3 — Stale `as never` casts defeat the brand in the suite that exercises it (minor)

`day-interaction.adapter.test.ts:40, 52, 423, 434, 443, 456, 465`

These are **pre-existing** (verified present at `HEAD`), so they are not a regression. But they
were only ever there because `CALENDAR_A` used to be a bare `string` and `GridEvent.calendarId`
is `CalendarIdSchema.optional()`. Now that `CALENDAR_A` is a `CalendarColumnKey` (= `CalendarId`),
they are redundant — and `as never` is assignable to *everything*, so it is a broader escape
hatch than `any`. Leaving it on the exact field this ticket set out to protect means the Day
adapter's own suite no longer proves `calendarId` is brand-correct.

Compile-probe confirms removal is safe: assigning a bare `CalendarColumnKey` to
`Pick<GridEvent, "calendarId">` type-checks clean.

**Fix:** drop `as never` at all seven sites. Line 465's
`calendarId: "cccccccccccccccccccccccc" as never` becomes
`asCalendarColumnKey("cccccccccccccccccccccccc")`.

### 4 — `toDateColumnKey` is partial, but documented as if total (minor)

`packages/web/src/grid/interaction/types/column-key.ts:10-17`

The comment claims: *"The input is not a string at all, so there is no untrusted shape to smuggle
through: a Dayjs formatted with YEAR_MONTH_DAY_FORMAT is date-only by construction, and the parse
is the proof."*

That is false for an **invalid** Dayjs. Verified empirically:
`dayjs("not-a-date").format("YYYY-MM-DD") === "Invalid Date"`, which fails
`zYearMonthDayString`'s refine, so `toDateColumnKey` **throws**. Its sibling
`parseDateColumnKey` is explicitly documented "Total function: never throws" — the contrast
invites a reader to assume `toDateColumnKey` is total too.

This matters because the refactor moves two call sites from a total `.format()` to this throwing
parse:
- `useWeekInteractionLayoutSync.ts:23` — inside a `useMemo`, i.e. the Week **render path**. An
  uncaught throw here takes down the view.
- `day-interaction.adapter.ts:246` — inside `createVisual`, i.e. the **pointerdown path**.

**Reachability is closed upstream, so this is not a live defect.** `routers/loaders.ts:66`
validates the `dateString` route param with `zYearMonthDayString.safeParse` in `beforeLoad` and
redirects on failure, so `useWeek`'s `anchor` (and therefore `weekDays`) and Day's `dateInView`
are always valid Dayjs. I confirmed both routes are guarded (`validateWeekDateParam` /
`validateDayDateParam`).

**Fix:** correct the comment to state the actual contract — *throws on an invalid Dayjs; callers
must supply a valid one, which route-param validation in `routers/loaders.ts` guarantees for both
current call sites*. That converts an invisible cross-module invariant into a documented one, so
a future third call site knows what it owes.

### 5 — New registry test is self-referential; its comment overclaims (minor)

`packages/web/src/grid/interaction/view-event-registry.test.ts:103-125`

The comment says the test guards against "an attribute were renamed". It does not. The test
builds the attribute it sets from `viewInteractionAttributeNames(viewName)` — the *same* function
`calendarEventIdElementSelector` uses to build the selector it asserts against. Rename the
template to `data-${v}-ix-event-id` and both sides move together; the test still passes.

Actual rename-detection already exists, in two tests this one sits between: line 15 hard-codes
`"data-week-interaction-event-id"` / `"data-day-interaction-event-id"` literals, and line 34
hard-codes all four `idAttribute` / `typeAttribute` literals.

It is not *fully* vacuous — it does add genuinely new coverage: `readCalendarEventIdFromElement`
resolving from the element **itself** (not only a descendant), for the **day** scheme, which no
existing test covered.

**Fix:** keep the test, narrow the comment to what it actually guards (view-agnostic resolution
from both self and descendant, for both views), and drop the rename claim — or make the claim
true by hard-coding the two literal attribute names in the `it.each` table instead of deriving
them.

### 6 — Unrelated tooling change in the change set (minor)

`.claude/settings.json:84-94`

Registers the mmo plugin's write-contract hook. Legitimate and unrelated to CMP-104; it is not in
the intent brief's "Files in scope" list (which names only the three interaction trees plus
`.gitignore`). No runtime impact on the app.

**Fix:** commit separately from the CMP-104 refactor so the ticket's commit is a clean,
revertable type-only change. (`.gitignore` adding `.sdlc/` and `.hook-logs/` **is** in scope per
the brief — leave it.)

### 7 — Nothing prevents a future default on `TColumnKey` (minor)

`timed-drag.types.ts:32`, `all-day-drag.types.ts:15`

The no-default choice is the entire enforcement mechanism, and it is enforced only by
`type-check` failing today. A future contributor hitting TS2314 in unrelated work could
"fix" it by adding `= string`, silently restoring the original hazard with a green build — which
is precisely the shape the sibling branch shipped.

**Fix:** add a small negative-type test pinning both properties, e.g. a
`column-key.type.test-d.ts` with `// @ts-expect-error` on a bare `AllDayDragVisual` and on
`allDayDragVisualToTimedGridEvent(event, dayVisual)`. `@ts-expect-error` is the correct tool
here — it *fails* if the error stops occurring, which is exactly the regression to catch.

---

## Summary

FR-1 and FR-2 are done properly. The compiler now enforces the Week/Day column-key distinction
that was previously held only by import topology, the geometry is untouched, and the three
behaviour-preservation decisions I was asked to challenge all survive close reading — decision 3's
unreachability argument in particular is sound for a stronger reason than stated (single array,
single layout assignment, no mid-drag rebuild in Day). Reusing the existing `@core` zod brands
instead of inventing type-only brands was the right call: it is why no unchecked cast helper was
needed in production code, and the grep confirms none was.

The seven findings are all mechanical cleanup. Findings 2 and 3 are worth doing before commit —
together they are ~8 lines and they close the only spots where the new brand can still be
bypassed. Findings 1, 4, 5, 6, 7 can land in the same commit or a follow-up.
