# Security Review — brownfield refactor

- **Run:** `20260826-082906-refactor-week-day-interaction`
- **Intent:** `refactor` (scope: changed files only)
- **Baseline:** `2d81253ab8a4c8e69b27e28d12c6ae9cc61d1bfe`
- **Reviewed at HEAD:** `2d81253ab8a4c8e69b27e28d12c6ae9cc61d1bfe` (identical — every `git diff HEAD` below is exactly this run's diff, nothing has landed on top)
- **Date:** 2026-08-26

## Verdict

**PASS**

No security finding was introduced by this run. The change is a genuine behavior-preserving
consolidation: no new authorization path, no new mutation entry point, no new DOM sink, no new
dependency, no new shared mutable state. The claim of "no new capability" is verified against
the diff, not taken on assertion.

## Scope and enumeration

Changed set obtained from `git status --porcelain` plus `git diff HEAD` (deletions are staged and
appear in `git diff HEAD`), cross-checked against `provenance.json` `files_touched` — the two
agree on all 28 source paths. Every file audited lives under
`packages/web/src/{grid/interaction,views/Week/interaction,views/Day/interaction}/`.

Search tooling: `Glob`/`Grep` were not relied upon; all enumeration and searching was done with
`Bash` (`git status`, `git diff`, `git show`, `grep -rn`, `ls`, `diff -u`) so no check below rests
on a listing that could not be obtained. Nothing is reported as "absent" that was not actually
searched for.

Note: `.claude/settings.json` and `.sdlc/baseline/{current.json,discovery.md}` are also dirty in
the worktree but are **not** in `provenance.json` and are not source. See "Noted (pre-existing /
out of scope)". This review did not modify them.

## Findings

| Severity | Category | Location | Issue | Recommendation |
|---|---|---|---|---|
| info | Type-contract nominality | `packages/web/src/views/Week/interaction/adapter/week-interaction.adapter.types.ts:84-92` and `packages/web/src/views/Day/interaction/adapter/day-interaction.adapter.types.ts:53-66` | Week's and Day's commit-result and target types are now aliases of the *same* shared types rather than separately-declared interfaces. A future edit could wire a Day commit handler into Week's runtime with no type error. | No action required. TypeScript is structural and the pre-refactor interfaces were member-for-member identical, so assignability was already unrestricted — this run removed duplicated declarations, not a guarantee. If nominal separation is ever wanted, brand the two unions; that would be a new control, not a restoration. |
| info | Test hygiene | `packages/web/src/grid/interaction/view-interaction.bindings.test.ts:24-27` | The new table-driven test operates on the *production* singletons `weekInteractionBindings` / `dayInteractionBindings` and calls `bindings.registry.clear()` and `document.body.innerHTML = ""` in `afterEach`. | Intentional and correct here — running against the real singletons is what makes this test a guard that each view has exactly one registry instance (see below). The `innerHTML = ""` is a constant-string DOM teardown in a test file, not a sink. Keep the `afterEach` clear so the shared registries are not left populated for later files in the same Bun process. |

No critical, high, medium, or low findings. Nothing was invented to pad this table.

## Confirmation of the six required areas

### 1. Authorization preservation — CONFIRMED

- `packages/web/src/events/mutations/useUpdateEvent.ts` is **genuinely unmodified**.
  `git status --porcelain` on that path is empty and `git diff HEAD` on it produces no output.
  It also does not appear anywhere in `provenance.json` `files_touched`.
- Both guards are intact and read in place:
  - recurring-move refusal — `useUpdateEvent.ts:78-81`
    (`sourceEvent.recurrence.kind !== "single"` → `"Repeating events can't move to another calendar."`)
  - read-only target refusal — `useUpdateEvent.ts:82-89` (`isEventReadOnly(lookup, nextCalendarId, false)`).
  - Both are gated behind `nextCalendarId` at `useUpdateEvent.ts:74-77`, which is non-null only
    when the incoming `event.calendarId` differs from the cached `sourceEvent.calendarId`.
- **`calendarId` is still only ever set by Day's `columnMoveCalendarId`.** `grep -rn "calendarId"`
  across `interaction/`, `grid/interaction/`, `views/Week/interaction/`, `views/Day/interaction/`
  returns exactly two production write sites, both in Day:
  - `packages/web/src/views/Day/interaction/adapter/commit/timed.commit.ts:56`
  - `packages/web/src/views/Day/interaction/adapter/commit/all-day.commit.ts:35`

  Both call `columnMoveCalendarId` (`timed.commit.ts:78-84`), whose body is unchanged:
  it returns `visual.dayDate as CalendarId` only when the column key actually changed, else
  `event.calendarId`. **No Week file writes `calendarId` at all** — confirmed by the same grep.
  The shared commit layer contains zero `calendarId` writes (`commit-result.ts` mentions it only
  in a comment at line 17 explaining why it must not be hoisted).
- The flow into the mutation is byte-identical. Both coordinators still call
  `updateEvent({ event: result.event }, true, { onOptimisticApplied: ... })` —
  `DayInteractionCoordinator.tsx:85-87` and `WeekInteractionCoordinator.tsx:146-148`. The only
  change to either function is the parameter's *type annotation* (a four-member union collapsed
  to the identical shared union); the bodies are untouched in the diff.
- **Bypass assessment:** for a changed file to bypass the guards it would have to reach
  `replace()` without going through `useUpdateEvent`, or set `calendarId` outside Day. Neither
  occurs. The guards are also re-enforced server-side per the comment at `useUpdateEvent.ts:72-73`,
  so this layer is defence-in-depth, not the sole control.

### 2. The unified commit envelope — CONFIRMED, cannot drop or forge fields

`packages/web/src/grid/interaction/commit/commit-result.ts:62-75`:

```ts
): InteractionCommitResultOf<TType> => ({
  event,
  eventId: target.event._id!,
  hadFormOpenBeforeInteraction: target.hadFormOpenBeforeInteraction,
  hasMoved,
  type,
});
```

- `eventId` still derives from `target.event._id` (line 71) — the same expression, including the
  non-null assertion, that appeared in all eight pre-refactor commit builders. Verified by
  `git show HEAD:.../adapter/interactions/{all-day.drag,all-day.resize,timed.drag,timed.resize}.ts`,
  each of which contained a literal `eventId: target.event._id!`.
- `event` is assigned **by reference** at line 69 with no spread, so mapper-set flags survive.
  This matters concretely: Day's `timedDragVisualToDayGridEvent` sets `isAllDay: false` and
  `calendarId` (`timed.commit.ts:50-56`), and both coordinators branch on `result.event.isAllDay`
  (`WeekInteractionCoordinator.tsx:150`). A spread here would be the drop-risk; there is none.
- The envelope cannot *forge* fields either: it has no defaults and no field is synthesised.
  `hasMoved` is a required mapper member with no default (`commit-result.ts:97`), and the
  header comment at lines 80-91 documents exactly why — a shared default computed from the plain
  `has*VisualMoved` predicate would make Week's same-day cross-row drop report `false` and reopen
  instead of save.
- Per-mapper behavioral equivalence was verified by diffing each deleted builder against its
  replacement:
  - Week all-day drag: old `hasMoved: isCrossRow || hasAllDayDragVisualMoved(visual)` →
    new `hasMoved: (v) => v.row === "timed" || hasAllDayDragVisualMoved(v)` — same.
  - Week timed drag: old `isCrossRow || hasTimedDragVisualMoved(visual)` →
    new `v.row === "allDay" || hasTimedDragVisualMoved(v)` — same.
  - Week resizes: mapped unconditionally before and after (`toEvent` ignores `hasMoved`).
  - Day: gated on `hasMoved`, returning `target.event` by identity on a no-op, before and after.
  - The Week/Day asymmetry is pinned by the two new `commit-characterization.test.ts` files.

### 3. Cross-view leakage — CONFIRMED, exactly one registry per view, no aliasing

- `grep -rn "createViewInteractionBindings(" packages/web/src` returns exactly **two** call
  sites, one per view:
  - `packages/web/src/views/Week/interaction/week-interaction.bindings.ts:11`
  - `packages/web/src/views/Day/interaction/day-interaction.bindings.ts:7`
- `grep -rn "createViewInteractionRegistry(" packages/web/src` returns exactly **one**
  production call — `view-interaction.bindings.ts:35`, inside the factory. All other matches are
  in `view-event-registry.test.ts` (test-local instances, no production reachability).
- Each `createViewInteractionBindings` call builds a fresh `EventRegistry` and hands the *same*
  instance to both the registry surface and `createGridEventTargeting`
  (`view-interaction.bindings.ts:35-42`), so registration and resolution cannot split. Both
  per-view shims re-export off the single instance:
  `week-event.registry.ts` and `week-event.targeting.ts` both import `weekInteractionBindings`;
  ditto Day. Verified in the diffs.
- **No new shared mutable state.** The three new `grid/` files contain no module-level `let` and
  no mutable export: `commit-result.ts` is pure functions plus types, `view-adapter.types.ts` is
  types only, `view-interaction.bindings.ts` is a factory. The only module-level singletons are
  the two per-view bindings objects — and those replace two pre-existing per-view singletons
  (`const week = createViewInteractionRegistry("week")` formerly at the top of
  `week-event.registry.ts`, plus a targeting closure over the same registry). Net singleton count
  is unchanged; the shared code holds none.
- Week's and Day's registries remain namespaced by distinct attribute sets
  (`data-week-…` vs `data-day-…`), so neither can resolve the other's DOM nodes even if
  co-mounted. No import edge runs from one view's interaction tree into the other's
  (`week-interaction.bindings.ts` imports only from `@web/grid/...`), so there is no module cycle
  and no half-initialised sibling at eval time.
- The `WeekLayoutCache` → `GridLayoutCache` change in the Week visual builders is the removal of
  a type *alias* that already expanded to `GridLayoutCache` (`git diff` on
  `week-layout.cache.ts` shows `export type WeekLayoutCache = GridLayoutCache;` being deleted).
  It is not a widening: the two were the same type before and after.

### 4. DOM attribute / selector integrity — CONFIRMED, unchanged and not broadened

- `packages/web/src/grid/interaction/view-event-registry.ts` — which defines
  `viewInteractionAttributeNames` (lines 26-29), `CALENDAR_VIEW_INTERACTION_ID_ATTRIBUTES`
  (lines 37-40), `calendarEventIdValueSelector` (lines 45-48) and
  `readCalendarEventIdFromElement` (lines 50-66) — is **unmodified**. `git status --porcelain`
  on it is empty and it is absent from `provenance.json`. Attribute *values* therefore cannot
  have changed.
- Independently corroborated: `EventCard.test.tsx:64-65`, `view-event-registry.test.ts:36-39` and
  `DayCalendarGrid.test.tsx:529` assert the literal strings
  `data-week-interaction-event-id` / `data-day-interaction-event-id` and the suite is green
  (2305 pass / 0 fail).
- The target selector is constructed identically. Old (from `git show HEAD:`):
  `` const TARGET_SELECTOR = `[${WEEK_INTERACTION_EVENT_ID_ATTRIBUTE}][${WEEK_INTERACTION_EVENT_TYPE_ATTRIBUTE}]` ``
  (`week-event.targeting.ts:17`, and the Day twin at `day-event.targeting.ts:16`).
  New: `` const targetSelector = `[${registryBindings.idAttribute}][${registryBindings.typeAttribute}]` ``
  (`view-interaction.bindings.ts:37`). Same two attributes, same order, still a **conjunction** of
  both id and type — **not** broadened to a disjunction, and still per-view. Neither view can
  resolve the other's nodes.
- `calendarEventIdValueSelector(eventId)` has exactly one production caller,
  `packages/web/src/views/Week/interaction/adapter/week-interaction.adapter.ts:153`. I diffed
  that region against `git show HEAD:` and it is **byte-identical** (same `weekEventRegistry.resolve(...)
  ?? document.querySelector<HTMLElement>(calendarEventIdValueSelector(eventId))` fallback, same
  guard). This run did not change that selector's exposure at all — no new caller, no wider input,
  no new reachable path. See the pre-existing note below for the escaping observation.

### 5. Standard sweep (changed files only) — CLEAN

Run with `grep -nE` over the full 28-file changed set:

- **Injected / interpolated selectors:** the only `querySelector` in the changed set is
  `week-interaction.adapter.ts:152`, unchanged from HEAD (above). The only other interpolated
  selector is `view-interaction.bindings.ts:37`, built from two hardcoded attribute-name literals
  derived from a string parameter that is a compile-time constant (`"week"` / `"day"`) at both
  call sites — no runtime or user-controlled input reaches it.
- **HTML sinks:** no `dangerouslySetInnerHTML`, `outerHTML`, `insertAdjacentHTML`,
  `document.write`, `eval(`, or `new Function` anywhere in the changed set. The single `innerHTML`
  hit is `view-interaction.bindings.test.ts:26`, a constant-empty-string teardown in a test file.
- **Secret / PII leakage into logs:** zero `console.*`, `logger.*` or `captureException` calls
  in the changed set. `grep -rEn "(api[_-]?key|secret|password|token)[ \t]*[:=][ \t]*['\"][a-zA-Z0-9]"`
  over the changed set returns nothing.
- **Unvalidated input reaching a mutation:** the only mutation entry from this layer is
  `updateEvent(...)` in the two coordinators, and it is unchanged. Downstream,
  `useUpdateEvent.ts:112` still runs `parseGridEventDraft(patchedDraft)` and refuses on
  `!(parsed.ok && parsed.mode === "edit")` — the zod validation gate is intact and was not touched.
- **New dependency:** none. `git status --porcelain bun.lock package.json packages/*/package.json`
  is empty; no manifest and no lockfile changed. Every import added by this run resolves to an
  existing in-repo module under `@web/`.

### 6. Test-only code reaching production — CONFIRMED, no coupling

- `grep -rn` for any non-test module importing a `*.test` path across `packages/web/src` returns
  nothing. Nothing imports `view-interaction.bindings.test` at all.
- `grid/interaction/view-interaction.bindings.test.ts` imports `dayInteractionBindings` and
  `weekInteractionBindings` from `views/**` (lines 1-2). This is a **test file importing
  production code**, which is the safe direction — production code never imports it, so no
  `grid/ → views/` production edge is created. The import graph of the production `grid/` layer
  is unchanged.
- The two `commit-characterization.test.ts` files import only sibling production commit modules
  and type-only symbols; they export nothing consumed elsewhere.
- No leftover references to the deleted `adapter/interactions/` directory exist anywhere
  (`grep -rn "adapter/interactions/\|from \"./interactions/\|from \"../interactions/"` → none);
  the directory is gone and `adapter/visuals/` replaced it, with the moved files diffing to
  import-path and type-alias changes only.
- Test fixtures contain no real credentials or PII: identifiers are `evt-1`, `first`, `focused`,
  `visible`, `target`, and dates are synthetic (`2026-05-13T09:00:00.000`).

## Passing checks

- `useUpdateEvent.ts` untouched; both authorization guards intact and still on the only path.
- `calendarId` writes remain confined to two Day-view call sites via `columnMoveCalendarId`.
- Commit envelope assigns `event` by reference (no spread) and derives `eventId` from
  `target.event._id`, matching all eight pre-refactor builders.
- Exactly one interaction registry instance per view; zero cross-view aliasing; no new shared
  mutable state in the shared layer.
- Interaction attribute names and values unchanged (defining module unmodified, asserted by
  green tests); target selector still a per-view conjunction, not broadened.
- No new dependency, no manifest or lockfile change.
- No HTML sink, no eval-family call, no logging of event data, no secret pattern in the diff.
- Zod validation gate on the mutation path untouched.
- No production module imports test code.
- Verified state independently consistent with a behavior-preserving change:
  `bun type-check` 0, `bun test:web` 2305 pass / 0 fail, `bunx biome check packages/` 0 errors.

## Required fixes before sign-off

None. No finding from this run blocks Gate 3.

## Noted (pre-existing, out of scope — advisory, non-blocking)

1. **`calendarEventIdValueSelector` does not escape its input.**
   `packages/web/src/grid/interaction/view-event-registry.ts:45-48` interpolates `eventId`
   directly into a CSS attribute selector (`[attr="${eventId}"]`) with no `CSS.escape`. A value
   containing `"` would break the selector and throw a `SyntaxError` from `querySelector`. Impact
   is limited: ids originate from Mongo ObjectId strings via the app's own DOM attributes, and the
   call site is a fallback behind a registry lookup. **This run did not change it** — the defining
   module is unmodified and the single call site is byte-identical to HEAD. Recommend `CSS.escape`
   as hardening in a separate ticket.

2. **Dependency advisories.** `npm audit --omit=dev` cannot run here (`ENOLOCK` — this is a Bun
   workspace with `bun.lock` and no `package-lock.json`). `bun audit --prod` was used instead;
   note the `--prod` flag did **not** take effect, so the reported 69 vulnerabilities
   (24 high / 37 moderate / 8 low) span dev and backend deps. Spot-checking the high-severity
   web hits — `postcss`, `@tailwindcss/postcss`, `jsdom`/`ws`, `nanoid` — all sit in
   `packages/web/package.json` **devDependencies** (lines 39+), i.e. build/test-time only.
   The one runtime-relevant hit is `dompurify`: the direct dependency resolves to a safe
   `3.4.13` (`bun.lock:912`), while a vulnerable `3.3.3` is pulled in transitively by `posthog-js`
   (`bun.lock:1824`, four moderate IN_PLACE-mode advisories). **Entirely pre-existing** — this run
   changed no manifest and no lockfile. Recommend a separate deps run.

3. **Untracked-by-provenance worktree modifications.** `.claude/settings.json` (registers the mmo
   write-contract hook on `Write|Edit`) and `.sdlc/baseline/{current.json,discovery.md}` are dirty
   but absent from `provenance.json`. They are operator/tooling config, not product source, and
   were not modified by this review. Flagged only because `/mmo:revert` would not restore them.

4. **Run-integrity note already self-recorded.** `provenance.json` carries an
   `_orchestrator_correction` for `tp_sc_002` (`WORKER-WRITE-BYPASS`): a mechanical worker wrote
   `views/Day/interaction/adapter/commit-characterization.test.ts` to disk before the
   `--before` provenance snapshot ran, so `existed_before` was initially recorded as `true` with a
   spurious backup. The correction sets `on_revert: DELETE`. Not a security defect in the produced
   code, but it is the same defect class as CMP-103 PROV-1 and is worth carrying into the
   follow-up ticket.

## Residual risk

Low. The residual risk of this change is confined to *future* edits rather than the current diff:
by collapsing eight near-identical commit builders into one envelope and two per-view type files
into shared aliases, the refactor removes the accidental duplication that used to make a
Week-rule-applied-to-Day mistake obvious at the point of edit. That risk is actively mitigated in
the delivered code — `hasMoved` is a required mapper field with no default
(`commit-result.ts:97`), `columnMoveCalendarId` is documented as DAY-ONLY and must not be hoisted
(`timed.commit.ts:73-77`), the Week-only exclusive-end baseline is deliberately not exported
(`Week/.../all-day.commit.ts:66-72`), the extension-point rule forbidding optional single-view
members on base types is written into `view-adapter.types.ts:28-42`, and the Week/Day commit
asymmetry is pinned by characterization tests in both views. Authorization risk specifically is
unchanged: the two guards live in an unmodified file, on an unmodified call path, and are
re-enforced server-side.
