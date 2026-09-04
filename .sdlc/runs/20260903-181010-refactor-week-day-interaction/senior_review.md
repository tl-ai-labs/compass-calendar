# Senior code review — `20260903-181010-refactor-week-day-interaction`

- **Reviewer:** senior code reviewer (adversarial pass)
- **Scope:** files touched by this run only (`git status --porcelain | grep -v .sdlc` → 26 modified, 4 new paths). Nothing outside the three allowlisted directories was reviewed or reported.
- **Contract read:** `requirements.md` (§3 P-0..P-5, §4 R-1..R-5, §2 F-1 correction), `change_plan.md`, `invariants.json`, `packets.json`.
- **Everything below was re-derived from the tree and from `git show HEAD:…`.** Where I say "verified", I ran the command or read both sides.

---

## 0. Verdict up front

**request-changes** — one blocker, three majors.

The behaviour-preservation core of this refactor is **sound**. I attacked every drift vector named in the brief and found no runtime behaviour change on either view. The F-1 correction is correct, the commit ordering is preserved, the motion flag fires at exactly the same points, the 4-probe order is byte-identical, and Day's `getVisibleDate()` still runs on the throw path. The `@ts-expect-error` guard mechanism is genuinely wired (I proved TS2578 fires in this toolchain). That is a good result for a 1400-LOC collapse.

What fails is **verification honesty and test-claim accuracy**:

- The declared P-5 lint gate is **red inside the allowlist** — 12 new Biome diagnostics in files that were clean at HEAD — and was reported as green.
- Of the 11 new `expect()` calls, **none can fail** in the specific way its test name claims. Two of the four landed guard tests test something real but different from their label; two are filler.
- The new shared composition root introduces a cross-view miswiring surface that the R-1 discriminant does **not** cover, and the run's own brand test asserts the escape hatch as a passing expectation.

None of this is a runtime defect. All of it is cheap to fix. Hence request-changes rather than a rejection.

---

## 1. What I verified as CORRECT (stated plainly, because it matters)

These were the five highest-risk drift vectors in the brief. All five are clean.

| # | Claim under test | Verdict | Evidence |
|---|---|---|---|
| V-1 | F-1: Week's two `runtime()` sites are mutually exclusive | **Correct** | `git show HEAD:…/week-interaction.adapter.ts` lines 207–217: `if (result.type === "click") {` opens at 207, `return isOwnedPointer;` at **216**, block closes at **217**; the second `runtime()` is at **219**, outside. Week called `runtime()` exactly once per non-null result and zero times on `!result` — identical to Day (HEAD `day-interaction.adapter.ts:163`). The hoisted single read at `grid/interaction/adapter/view-pointer-session.ts:126` is behaviour-preserving for both views, including under a call-counting spy. `result.type` is a plain discriminant property with no getter, and nothing sits between the `!result` guard and the branch in either view. **Not a blocker.** |
| V-2 | `commit` throws before any cleanup | **Correct** | `view-engine-adapter.ts:74` runs `commitDispatch(...)` first; `clearLayoutState()` / `onInteractionSettled()` at 76–77. HEAD Week: throw at 282, cleanup at 285–287. HEAD Day: throw at 236, cleanup at 239–240. Order preserved for both. |
| V-3 | Week motion flag fires at identical points; Day is a genuine no-op | **Correct** | HEAD Week set `true` at 183 (after `engine.handlePointerDown` succeeds) and `false` at 215 (after the click dispatch, before return) plus in `cancel`/`commit` at 262/287. New: `week-interaction.adapter.ts:113` (`onPointerDownOwned`), `:114` (`onClickHandled`), `:159-162` (`onInteractionSettled`). `view-pointer-session.ts:102` and `:135` place them at exactly the HEAD positions. Day passes neither, and both default to `() => undefined` (`view-pointer-session.ts:63-64`) — HEAD Day had no motion flag at all. |
| V-4 | 4-probe target order matches HEAD for both views | **Correct** | `view-target-resolution.ts:59-81` vs HEAD Week 483–505 and HEAD Day 434–456. Identical order (all-day resize → timed resize → timed drag → all-day drag) and identical bodies for all nine members, differing only in the injected registry. |
| V-5 | Day's `commitDispatch` still calls `getVisibleDate()` before the branch | **Correct** | `day-interaction.adapter.ts:127`, ahead of the four-branch check at 129–145, so it is still called on the throw path. HEAD `day-interaction.adapter.ts:219` did the same. |

Additionally verified:

- **P-0** — `git status --porcelain packages/web/src/interaction` is **empty**; engine subset untouched.
- **P-1** — `bun run type-check` **exit 0** across `tsconfig.json`, `tsconfig.app.json` and `tsconfig.test.json`; full suite green apart from the known failure. All P-1 frozen symbols still resolve at their original module paths.
- **P-2** — `git diff --numstat packages/web/src/grid/interaction/view-event-registry.ts` = **26 insertions / 2 deletions**, and the only deleted lines are the old `ViewRegisteredEventTarget` alias. `viewInteractionAttributeNames`, `CALENDAR_VIEW_INTERACTION_ID_ATTRIBUTES`, both selectors and `readCalendarEventIdFromElement` are **byte-identical**.
- **P-4** — in-scope subset re-run: **135 pass / 0 fail / 23 files / 348 expects**, exit 0. Floor of 337 held.
- **P-5 (tests)** — full suite re-run: **2304 pass / 1 fail / 1 error / 5782 expects / 304 files**, exit 1. Single failure confirmed by name: `RecurrenceSection > keeps the event's own date selectable when the event ends after midnight`. Pre-existing, out of scope.
- **R-5** — no Week-only or Day-only member leaked onto a shared type. `ViewInteractionRuntime` / `ViewInteractionAdapter` (`view-interaction.adapter.types.ts:129`, `:143`) carry no `getVisibleDays`, `onRequestWeekNavigation`, `rebuildLayoutAfterNavigation`, `getColumnKeys` or `getVisibleDate`; Week extends with them (`week-interaction.adapter.types.ts:45-52`, `:87-90`), Day extends empty.
- **Phantom-brand constraints** — `VIEW_BRAND` is `declare const` at `view-event-registry.ts:15`, **not exported**, and a repo-wide `grep -rn VIEW_BRAND packages/` finds only its own module. `grep -rnE " as [A-Z]| as unknown" packages/web/src/grid/interaction/adapter/` returns **exactly one hit**: `view-target-resolution.ts:224`. Single widening point confirmed.
- **Bare-`GridLayoutCache` safety (R-1 sub-claim)** — verified by reading. `math/all-day.resize.ts` (lines 51, 58, 61, 63, 68), `math/timed.resize.ts` (no `dayColumns` access at all), `interactions/all-day.visible-range.ts` (lines 12, 16) and `math/timed.drag.ts:194` read only `.index`, `.left`, `.width` and `.smartScroll`. **No `.date` read escapes a bare-typed consumer.** The orchestrator's claim holds.
- **`@ts-expect-error` failure mode is real.** I would not take this on trust, so I reproduced it. A standalone probe under `typescript@7.0.2` with the same brand shapes gives `error TS2578: Unused '@ts-expect-error' directive.` on a directive over a non-error line, while the two genuine brand violations are suppressed silently. `tsconfig.test.json` includes `./src/**/*.test.ts`, so both new test files are in the type-check program, and `type-check` exits 0 → **all seven directives in `column-key.types.test.ts` and `view-event-registry.brand.test.ts` suppress real errors.** The discriminant is not inert at those points.
- **Dropped test (tp_t3) — unreachability confirmed.** `interaction.engine.ts:305-317` builds the visual from `pendingSession.target` and `:213-224` commits `{ target: motionSession.target, visual: finalUpdate.visual }`; `updateVisual` never changes `visual.type`, and each view's `createVisual` maps `target.type` 1:1 onto `visual.type`. `adapter.commit` has exactly one call site. The mismatched pair is genuinely unreachable **through the engine**. See m-1 for the caveat.

---

## 2. Must fix before merge

### B-1 — blocker — the P-5 lint gate is red inside the allowlist, and was reported green

**Where:** `packages/web/src/views/Day/interaction/adapter/day-interaction.adapter.ts` (7 diagnostics), `grid/interaction/adapter/create-view-interaction-adapter.ts:68`, `grid/interaction/adapter/view-target-resolution.ts:36`, `grid/interaction/layout.cache.ts:90` and `:144`, `grid/interaction/math/timed.drag.ts:197`, `grid/interaction/commit/cross-row.commit.test.ts:77`.

**What is wrong.** `invariants.json` P-5-lint states *"The three allowlisted directories stay at zero diagnostics"* with `delta_bar: ZERO Biome diagnostics`, and the review invocation repeats *"Lint: zero diagnostics inside the three in-scope directories."* Both are false.

```
$ npx @biomejs/biome check packages/web/src/grid/interaction \
      packages/web/src/views/Week/interaction packages/web/src/views/Day/interaction
Checked 78 files in 152ms.
Found 7 errors.
Found 5 warnings.
```

Twelve diagnostics, all inside the allowlist:

- **5 × `lint/correctness/noUnusedImports`**, all in `day-interaction.adapter.ts` at `4:3`, `28:8`, `30:8`, `35:8`, `51:3`. **Twelve identifiers are imported and never used.** I counted occurrences: `createInteractionEngine`, `InteractionCancellationTargets`, `InteractionEngine`, `isEligibleInteractionPointerDown`, `getSavedEventOwnershipReason`, `VisualPoint`, `DayAllDayDragTarget`, `DayAllDayResizeTarget`, `DayInteractionPointerOwnership`, `DayResolvedEventTarget`, `DayTimedDragTarget`, `DayTimedResizeTarget` each appear **exactly once** (the import) in the new file and **twice or three times** in `HEAD:day-interaction.adapter.ts`. This is residue from an incomplete hoist, not pre-existing debt.
- **6 × `format`** on `create-view-interaction-adapter.ts`, `view-target-resolution.ts`, `layout.cache.ts`, `math/timed.drag.ts`, `commit/cross-row.commit.test.ts`, `day-interaction.adapter.ts`.
- **1 × `assist/source/organizeImports`** on `day-interaction.adapter.ts:1:1`.

I established these are **new**, not baseline, with a Biome formatter round-trip against HEAD (`biome format --stdin-file-path` on the HEAD blob vs the worktree blob — the exit code of `biome check --stdin` is not trustworthy, so I compared content):

```
HEAD CLEAN / WORK DIRTY : packages/web/src/grid/interaction/math/timed.drag.ts
HEAD CLEAN / WORK DIRTY : packages/web/src/grid/interaction/layout.cache.ts
HEAD CLEAN / WORK DIRTY : packages/web/src/grid/interaction/commit/cross-row.commit.test.ts
```

The other three format-dirty files are new in this run. Repo-wide, `biome check .` goes from the invariant's declared `2 errors / 10 warnings` to **20 errors / 16 warnings**, exit 1.

**Why it matters.** P-5 is an explicit acceptance gate. A gate reported as met when it is objectively failed is worse than the diagnostics themselves — it means the run's self-verification did not actually run the check it claims to have run, which casts doubt on every other "verified" line in the packet. The dead imports specifically are the signature of a partially-completed extraction and are the one lint class that can hide a real mistake (an import kept because the author was unsure whether the hoist was complete).

**Fix.**
1. `npx @biomejs/biome check --write packages/web/src/grid/interaction packages/web/src/views/Week/interaction packages/web/src/views/Day/interaction` — this clears all 12 (the `noUnusedImports` fix is marked unsafe, so confirm the 12 identifiers by eye first; I have already confirmed all 12 are genuinely dead).
2. Re-run `bun run type-check` and the in-scope subset afterwards.
3. Correct `invariants.json` P-5-lint: record the honest post-change count, and record that the allowlist delta bar was breached and then repaired. Do not leave the false "stays at zero" statement in the artifact.

---

## 3. Majors

### M-1 — major — the shared composition root can be wired to the wrong view's registry, and the compiler will not notice

**Where:** `grid/interaction/adapter/create-view-interaction-adapter.ts:52` (`registry: ViewEventRegistry`), `:35` (`TVisual` unconstrained), `grid/interaction/adapter/view-target-resolution.ts:51` and `:224`.

**What is wrong.** R-1's stated goal is that *"a Day visual passed where a Week visual is expected is a type error."* That holds for visuals and layout caches — I verified it. It does **not** hold for the composition root the refactor just created.

`ViewEventRegistry` is unchanged by this run and carries **no view parameter**:

```ts
export type ViewEventRegistry = EventRegistry<ViewInteractionEventType>;
```

`weekEventRegistry` and `dayEventRegistry` are therefore the *same type*. `ViewInteractionAdapterInput<TRegistered, TVisual>` declares `registry: ViewEventRegistry` with no relation to `TRegistered`, and `TVisual` is entirely unconstrained. So:

```ts
createViewInteractionAdapter<WeekRegisteredEventTarget, DayInteractionVisual>({
  registry: dayEventRegistry,   // ← type-checks
  ...
})
```

compiles cleanly. The `registered as TRegistered` cast at `view-target-resolution.ts:224` then stamps a Day registration with the Week brand and the mistake propagates brand-correct all the way to commit. The comment at `:217-222` — *"Each registry is namespaced by its own `data-${view}-interaction-event-*` attributes, so anything it resolves demonstrably belongs to this view"* — is true only if the registry actually matches the view, which is precisely the thing the types do not check.

**Why it matters.** At HEAD there was no shared root: each adapter hard-coded `weekEventRegistry` / `dayEventRegistry` inline, so this miswiring was not expressible. **This refactor created the surface.** It is exactly the class of "silent cross-view defect" that §5 of `requirements.md` says the type system was supposed to start catching, and Day — the less-tested view — is where it would land. It is not a live defect today (both call sites are correct: `week-interaction.adapter.ts:115`, `day-interaction.adapter.ts:103`), but the guard R-1 promises is absent at the one new place it was most needed.

**Fix.** Brand the registry the same way the target is branded, so the pairing is checked once at the root:

```ts
// view-event-registry.ts
export type ViewEventRegistry<TView extends string = string> =
  EventRegistry<ViewInteractionEventType> & { readonly [VIEW_BRAND]?: TView };
```

then in the two registry modules export the singleton as `ViewEventRegistry<"week">` / `ViewEventRegistry<"day">`, and in `ViewInteractionAdapterInput` declare `registry: ViewEventRegistry<ViewOf<TRegistered>>` (or, simpler and equally effective, add a `view: TViewName` field consumed by both `TRegistered` and `registry`). Also constrain `TVisual` to `ViewInteractionVisual<TColumnKey>` and thread the column-key parameter through the root so the visual and the registered target cannot disagree.

### M-2 — major — the two Day "resize-handle probe order" tests do not test probe order, and the module comment asserting the order is load-bearing is false

**Where:** `views/Day/interaction/adapter/day-interaction.adapter.test.ts:667` and `:682`; `grid/interaction/adapter/view-target-resolution.ts:54-58`.

**What is wrong.** The comment reads:

> *"Probe order is load-bearing and must not be reordered: a pointerdown on a resize handle has to be claimed by a resize probe before either drag probe sees it, or grabbing a handle would start dragging the event instead."*

That is not how the code works. The four probes are **mutually exclusive by construction**, so no permutation of them can change the result:

- `getAllDayResizeTarget` (`:102`) and `getTimedResizeTarget` (`:143`) both require `getResizeHandleEdge(event)` **truthy**.
- `getAllDayDragTarget` (`:83`) and `getTimedDragTarget` (`:124`) both **return `null` immediately** if `getResizeHandleEdge(event)` is truthy (`:86-88`, `:127-129`).
- Within each pair, `getRegisteredTarget(event, "all-day")` vs `(event, "timed")` filter on the eventType of the *same* registration — `event.registry.ts:79-86` resolves at most one element via `closest()`, which carries exactly one `eventType`. Only one filter can pass.

`getResizeHandleEdge` (`grid/interaction/dom.ts:29-39`) is a pure `closest()` read, so it is deterministic across the four calls. At most one probe can return non-null for any pointer event. **Order is unobservable** — and this was equally true at HEAD, so no behaviour was at risk either way.

Consequently the two tests would pass under any permutation of the four probes. They cannot detect the regression they are named for.

**Why it matters.** Two of the four landed guard tests are labelled as covering the single invariant the brief calls out as "the part that matters most", and they do not. That misrepresents the coverage picture for the exact view (Day) that has half of Week's test depth. A future maintainer reading the comment will also believe a constraint exists that does not.

**In fairness — these tests do have real value, just not the stated value.** What they actually cover is the *handle-guard* inside `getTimedDragTarget` / `getAllDayDragTarget` — and this refactor collapsed four copies of that guard (two per view) down to two. Deleting either guard *would* break these tests. That is a genuine regression test for the change.

**Fix.**
1. Rewrite the comment at `view-target-resolution.ts:54-58` to state the truth: the four probes are mutually exclusive because the resize probes require a handle edge and the drag probes bail on one, so the *guards* are load-bearing, not the order.
2. Rename the two tests to what they assert, e.g. *"the timed drag probe refuses a pointerdown that lands on a resize handle"*.
3. If probe-order coverage is genuinely wanted, it has to be a unit test on `createViewTargetResolver` with a stubbed registry — but given the exclusivity proof above, I would not spend the packet. Retire the requirement instead.

### M-3 — major — the cancel-then-redrag test cannot fail if `clearLayoutState()` is deleted

**Where:** `views/Day/interaction/adapter/day-interaction.adapter.test.ts:702` (*"clears cached layout and scroll offset on cancel so subsequent drag computes fresh times"*).

**What is wrong.** The test drives a drag, sets `mainGridElement.scrollTop = 120`, calls `adapter.cancel()`, then drives a second drag and asserts a 10:00–11:00 commit. It cannot distinguish a working `clear()` from a missing one.

`createViewLayoutScrollState.set()` (`grid/interaction/adapter/view-layout-scroll.state.ts:40-43`) **unconditionally** assigns both fields:

```ts
set: (nextLayout: TLayout) => {
  layout = nextLayout;
  scrollTop = nextLayout.smartScroll?.initialScrollTop ?? null;
},
```

Every gesture begins at `createVisual`, which calls `layoutState.set(nextLayout)` (`day-interaction.adapter.ts:180`) before any `updateVisual` can run — the engine enforces this at `interaction.engine.ts:305-317`, and a null `createVisual` aborts the session outright. So both `layout` and `scrollTop` are overwritten on the second drag regardless of whether `cancel()` cleared them. Removing `clearLayoutState` entirely from `view-engine-adapter.ts:61` would leave this test green.

Stale layout state is in fact **unobservable through the whole public surface**: `updateVisual` only runs inside a session, `isPointerOverAllDayRow` only from `updateVisual`, and Week's `rebuildLayoutIfNeeded` is gated behind `session.phase === "idle"` (`week-interaction.adapter.ts:122-124`). `clear()` is hygiene, not a guard.

**Why it matters.** This is the only landed test that names the shared `clearLayoutState` / `onInteractionSettled` unwind path. Booking it as coverage of that path overstates the safety net around the piece of Band B that changed shape most (the cancel/commit teardown moved from two inline blocks into one shared factory plus two injected callbacks).

**In fairness**, the test does provide real integration value — "after `cancel()`, a fresh drag still commits the right times" exercises the whole shared unwind path end-to-end and would catch a teardown that broke the engine's session reset. Keep it; relabel it.

**Fix.**
1. Rename to what it proves: *"a cancelled drag does not corrupt the next drag's commit"*.
2. If the `clear()` behaviour is genuinely worth locking, test `createViewLayoutScrollState` directly — it is exported and trivially unit-testable: `set(layoutA)` → `clear()` → assert `get() === null && getScrollTop() === null`. Three lines, and it *can* fail.

---

## 4. Follow-up ticket (not merge-blocking)

### m-1 — minor — the tp_t3 drop rationale is weaker than recorded

The orchestrator dropped the mismatched-target throw test because the pair is unreachable through the public API. **I verified the unreachability against the engine and it is correct** (see §1). But the packet's acceptance criteria also required *"post-throw recovery asserted"*, and more importantly the refactor **created a new, directly-testable seam**: `createViewEngineAdapter` is exported from `grid/interaction/adapter/view-engine-adapter.ts:40` and can be called with a hand-built mismatched `{ target, visual }` pair without going anywhere near the engine. The dispatch-before-cleanup ordering at `:74-77` — which the file's own comment calls "deliberate and load-bearing" — is therefore protected only by that comment.

**Fix:** a ~12-line unit test on `createViewEngineAdapter` with spy `commitDispatch` (throwing), `clearLayoutState` and `onInteractionSettled`, asserting the throw propagates and **neither cleanup spy was called**. That locks the exact ordering the hoist put at risk.

### m-2 — minor — `AnyColumnKey` is a dead export that its own doc tells you not to use

`grid/interaction/types/column-key.types.ts:55`. Repo-wide grep finds zero consumers; the only other mentions are its own docstring and a reference in `layout.cache.ts:4`. Its doc says *"Never use this in a parameter position in shared code"* — a type nobody may use in the only position it would be reached for is better deleted than shipped. **Fix:** delete it, and fold its warning into the `layout.cache.ts` header note that already makes the same point.

### m-3 — minor — the brand test asserts the escape hatch as a passing expectation

`grid/interaction/view-event-registry.brand.test.ts:16-17`:

```ts
const _asWeek: WeekRegisteredEventTarget = raw;
const _asDay: DayRegisteredEventTarget = raw;
```

Both compile, with no `@ts-expect-error`. I reproduced this in an isolated probe: because the brand is an **optional** property (`readonly [VIEW_BRAND]?: TView`), any un-branded value that matches `RegisteredEventTarget` structurally satisfies **both** brands. That is the deliberate design (documented at `view-event-registry.ts:34-38`) and it is what makes the single widening cast possible — but as written these two lines read like a guarantee rather than the documented limitation they are, and they are unused module-level consts that no assertion covers.

Today the hazard is latent, not live: `resolveFromTarget` is the only producer of an unbranded registration and it has exactly one consumer (`view-target-resolution.ts:215`). It is the *mechanism* behind M-1. **Fix:** move these two lines under a comment naming them as the acknowledged widening property, e.g. `// DOCUMENTED LIMITATION: an unbranded registration satisfies both brands — this is what makes the single cast in getRegisteredTarget possible, and why the registry itself must be brand-paired (see M-1).`

### m-4 — minor — `"asserts the brand has zero runtime footprint"` is a tautology

`grid/interaction/types/column-key.types.test.ts:28-34`. `typeof (rawLiteral as DateColumnKey)` is `"string"` for *any* TypeScript type alias — the assertion cannot fail and would still pass if `ColumnKey` were defined as `never`. It contributes 2 of the 11 new expects. Harmless, but it is not evidence. **Fix:** delete, or replace with something that could fail (e.g. round-trip a branded key through `updateTimedDragVisual` and assert the returned `dayDate` is still `===` the input string).

### m-5 — minor — `"creates an event registry instance"` is a smoke test of an untouched module

`grid/interaction/view-event-registry.brand.test.ts:28-40` asserts `typeof registry.<member> === "function"` four times against `createEventRegistry`, which this run did not modify. 4 of the 11 new expects. Combined with m-4, **6 of the 11 new `expect()` calls test nothing this run changed** — which matters because P-4's "expect count must not fall below 337" creates a standing incentive to pad. **Fix:** delete it; the brand file should contain only the type-level assertions, which are the part that carries weight.

### m-6 — minor — `updateVisual` now captures the layout once where HEAD re-read it after an external callback

`views/Week/interaction/adapter/week-interaction.adapter.ts:237` hoists `const layout = layoutState.get()` above the whole dispatch. HEAD re-read the closure variable `layout` at each use site — notably at 381 and 459, i.e. **after** `updateEdgeNavigation(...)` ran at 375/453. `updateEdgeNavigation` invokes `runtime().onRequestWeekNavigation?.(...)` (`:412`), which reaches `WeekInteractionCoordinator.tsx:182` → `weekProps.util.incrementWeek("drag-to-edge")`.

If that navigation could re-render synchronously, `useWeekInteractionLayoutSync.ts:40` would call `rebuildLayoutAfterNavigation()` → `rebuildLayoutIfNeeded` → `layoutState.set(...)`, and HEAD would then use the **new** layout where the refactor uses the stale captured one.

**It cannot today.** `rebuildLayoutAfterNavigation` fires from a `useLayoutEffect` (`useWeekInteractionLayoutSync.ts:32`), and `grep -rn flushSync packages/web/src` returns **nothing**, so React batches the update and no synchronous rebuild is possible inside the `updateVisual` call stack. Not a defect. But it is a semantic narrowing that a future `flushSync`, or a synchronous edge-nav path, would silently turn into a real one. **Fix:** either re-read `layoutState.get()` after `updateEdgeNavigation` on the two drag branches, or add a comment at `:237` recording that the single capture is safe only because navigation is asynchronous.

### m-7 — minor — pre-existing hazard carried forward, as agreed

`row`, `crossRowSize` and `timedStartMinutes` still sit on `AllDayDragVisual` / `TimedDragVisual`, so `DayInteractionVisual` (`day-interaction.adapter.types.ts:80`) still makes Day *look* cross-row capable while nothing populates it. Explicitly out of scope per R-5 and correctly not fixed. Noting so it survives into a ticket alongside the Q-1 edge-navigation singleton (recommendation (a)+(c), which the delta honours — the shared layer never names the edge-navigation store; `view-engine-adapter.ts:28-34` and `view-layout-scroll.state.ts:14-17` keep it behind opaque callbacks, and I confirmed no third writer was added).

Also carried forward: `views/Day/interaction/adapter/commit/all-day.commit.ts:19`, `"dayDate" in visual ? … : false` — `dayDate` is a required field of `AllDayDragVisual`, so the guard is always true. Pre-existing, in a file this run touched only for its type parameter.

### m-8 — nit — net LOC grew

Adapters 795→494 and 607→323 (−585) and the two types files 149+149→90+86 (−122) are real wins, but the new shared layer is 812 LOC plus 55 for `column-key.types.ts`. Net **+160 LOC** across the boundary. The excess is almost entirely doc comment, much of it high quality, and some of it (the probe-order comment in M-2, the "no test, protected by reading" note at `view-engine-adapter.ts:70-73`) asserts things that turn out not to hold. Worth a trim pass when M-2 is addressed.

### m-9 — nit — the composition root forces Day to discard `engine`

`create-view-interaction-adapter.ts:103` always returns `{ ...pointerSession, engine }`, so Day must write `const { engine: _engine, ...pointerSession } = …` (`day-interaction.adapter.ts:95`). The underscore keeps Biome quiet but it is a smell on a brand-new API. **Fix:** return the engine under a separate accessor, or make the root generic over whether the view needs it.

---

## 5. Coverage summary (the honest version)

| Guard | Planned | Landed | Can it actually fail? |
|---|---|---|---|
| tp_t1 — column-key discriminant | yes | yes | **Yes** — 5 `@ts-expect-error`, all verified load-bearing (TS2578 proven wired) |
| tp_t2 — phantom view brand | yes | yes | **Yes** for the 2 `@ts-expect-error`; **no** for the 4 runtime expects (m-5) |
| tp_t4 — Day resize-handle probe order | yes | yes | **Not for probe order** (M-2). Yes for the handle guard. |
| tp_t5 — Day cancel-then-redrag | yes | yes | **Not for stale scroll state** (M-3). Yes as an integration smoke. |
| tp_t3 — mismatched-target throw | yes | **dropped** | Unreachable via the engine (verified) — but reachable and testable at `createViewEngineAdapter` (m-1) |

Net: **+11 expects**, of which 6 test nothing this run changed and 5 test something real but different from their label. **The genuine new safety net produced by this refactor is the seven type-level assertions, not the runtime ones.** That is worth stating plainly, because it is the opposite of how the run's artifacts read.

---

## 6. Overall verdict

**request-changes.**

Behaviour preservation — the whole point — holds. I went looking hard for silent drift on both views and found none: every one of the five drift vectors the brief flagged is clean, the F-1 correction is correct against HEAD, and the two claims I was told to be most sceptical of (the `runtime()` hoist and the bare-`GridLayoutCache` widening) both survive scrutiny. The write contract was respected: nothing outside the three allowlisted directories was touched and the engine is byte-clean.

What blocks merge is **B-1**: an explicit acceptance gate is red inside the allowlist and was recorded as green, including twelve dead imports left by an incomplete hoist. That is a five-minute fix and a correction to `invariants.json`.

**M-1** should land in the same change — the refactor created a cross-view miswiring surface at the new composition root that R-1's discriminant does not cover, on the less-tested view, which is precisely the failure mode R-1 exists to prevent.

**M-2** and **M-3** are documentation-and-labelling fixes plus two cheap real tests; they do not change a line of production behaviour but they do change what the run can honestly claim about its own coverage.

Once B-1 and M-1 are addressed and M-2/M-3 are relabelled with their two replacement tests, this is a clean approve. The underlying engineering is good work.
