# Security Review — pass1

Mode: `brownfield` · Intent: `refactor` · Run: `20260826-115739-refactor-week-day-interaction`
Repo: `/home/sainadh/projects/compass-calendar/compass/compass-calendar` · HEAD before run: `2d81253a`

## Scope

Scoped to files this run wrote or edited, per the brownfield/refactor row of the intent matrix.
The wider application was **not** audited.

### Commands run to derive the list

```
git status --porcelain packages/web
git diff --stat -- packages/web
find packages/web/src/grid/interaction/adapter \
     packages/web/src/views/Day/interaction/adapter/interactions -type f
# authoritative list, de-duplicated from provenance:
python3 -c "... json.load(open('.sdlc/runs/<run-id>/provenance.json'))['files_touched'] ..."
```

`provenance.json` yields 30 unique paths: 29 source files plus this run's own
`requirements.md`. All 29 were confirmed present on disk before review (no
phantom entries), and the list reconciles exactly with `git status`
(12 tracked-modified + 17 untracked-new).

`Glob`/`Grep` were unavailable on this build; every search below was run through
`Bash` (`grep -rn`, `find`). No conclusion in this document rests on a search
that did not execute — the one check that could not be run is reported as
**not run**, not as passing (see Dependency risk).

### 29 source files reviewed

**New (17)**

| # | Path |
|---|---|
| 1 | `packages/web/src/grid/interaction/view-interaction.module.ts` |
| 2 | `packages/web/src/grid/interaction/view-interaction.module.test.ts` |
| 3 | `packages/web/src/grid/interaction/adapter/view-interaction.core.ts` |
| 4 | `packages/web/src/grid/interaction/adapter/view-interaction.types.ts` |
| 5 | `packages/web/src/grid/interaction/adapter/view-interaction.targets.ts` |
| 6 | `packages/web/src/grid/interaction/adapter/view-interaction.targets.test.ts` |
| 7 | `packages/web/src/grid/interaction/adapter/view-interaction.engine-members.ts` |
| 8 | `packages/web/src/grid/interaction/adapter/view-interaction.layout-state.ts` |
| 9 | `packages/web/src/grid/interaction/adapter/view-interaction.layout-state.test.ts` |
| 10 | `packages/web/src/grid/interaction/adapter/view-interaction.divergence.test.ts` |
| 11 | `packages/web/src/views/Day/interaction/adapter/geometry/day-columns.ts` |
| 12 | `packages/web/src/views/Day/interaction/adapter/interactions/all-day.drag.ts` |
| 13 | `packages/web/src/views/Day/interaction/adapter/interactions/all-day.resize.ts` |
| 14 | `packages/web/src/views/Day/interaction/adapter/interactions/timed.drag.ts` |
| 15 | `packages/web/src/views/Day/interaction/adapter/interactions/timed.resize.ts` |
| 16 | `packages/web/src/views/Day/interaction/adapter/day-interaction.interactions.test.ts` |
| 17 | `packages/web/src/views/Week/interaction/adapter/week-interaction.idempotence.test.ts` |

**Modified (12)**

| # | Path |
|---|---|
| 18 | `packages/web/src/views/Week/interaction/adapter/week-interaction.adapter.ts` |
| 19 | `packages/web/src/views/Week/interaction/adapter/week-interaction.adapter.types.ts` |
| 20 | `packages/web/src/views/Week/interaction/adapter/geometry/week-layout.cache.ts` |
| 21 | `packages/web/src/views/Week/interaction/registry/week-event.registry.ts` |
| 22 | `packages/web/src/views/Week/interaction/targeting/week-event.targeting.ts` |
| 23 | `packages/web/src/views/Day/interaction/adapter/day-interaction.adapter.ts` |
| 24 | `packages/web/src/views/Day/interaction/adapter/day-interaction.adapter.types.ts` |
| 25 | `packages/web/src/views/Day/interaction/adapter/commit/all-day.commit.ts` |
| 26 | `packages/web/src/views/Day/interaction/adapter/commit/timed.commit.ts` |
| 27 | `packages/web/src/views/Day/interaction/adapter/geometry/day-layout.cache.ts` |
| 28 | `packages/web/src/views/Day/interaction/registry/day-event.registry.ts` |
| 29 | `packages/web/src/views/Day/interaction/targeting/day-event.targeting.ts` |

### Files deliberately read but *not* in scope (used to classify pre-existing vs introduced)

- `packages/web/src/grid/interaction/dom.ts` — unchanged (`git status` clean)
- `packages/web/src/grid/interaction/view-event-registry.ts` — unchanged
- `packages/web/src/views/Week/interaction/state/motion.state.ts` — unchanged
- `git show HEAD:...` copies of `day-interaction.adapter.ts`, `week-interaction.adapter.ts`,
  `day-event.targeting.ts`, `week-event.targeting.ts` — to diff moved code against its origin

## Assessment

**The run brief's claim that the standard checklist is largely not applicable here is correct, and
I am confirming it rather than restating it.** These 29 files are DOM/pointer-geometry code: they
resolve a `PointerEvent` to a calendar event, compute rectangles and minute offsets, and hand a
commit callback to the caller. Across all 29 files there is **no** `fetch`/`axios`/`XMLHttpRequest`,
no `localStorage`/`sessionStorage`/`document.cookie`, no `WebSocket`, no authentication or
authorization decision, no persistence, no credential handling, and no new dependency — each of
those verified by an executed grep, listed in "Explicitly checked and clear". The requirements doc
marking PII inventory and role matrix **not applicable** is an accurate assessment of this change,
not an omission. The only realistic severity class available is availability: an unhandled throw
inside a pointer handler. The refactor's most sensitive surfaces — the draft-event DOM helpers in
`dom.ts` and the CSS-selector builder in `view-event-registry.ts` — were **not touched by this
run**; both were read anyway to classify their behaviour, and `dom.ts` writes event text via
`textContent` only, which is the safe sink. Two low/info-severity observations follow, **both
pre-existing**; neither was introduced or made more reachable by this change.

## Findings

| id | severity | file:line | description | origin | recommendation |
|---|---|---|---|---|---|
| SEC-1 | low | `packages/web/src/grid/interaction/view-event-registry.ts:45-48`, reached from `packages/web/src/views/Week/interaction/adapter/week-interaction.adapter.ts:127-129` | `calendarEventIdValueSelector(eventId)` interpolates an event id straight into a CSS attribute selector — `` `[${attr}="${eventId}"]` `` — with no escaping, and the result is passed to `document.querySelector`. An id containing `"` or `]` would terminate the attribute clause; `querySelector` would then either throw `SyntaxError` inside `rebuildLayoutAfterNavigation` (a pointer/edge-nav handler, so an availability bug) or match a wider set of nodes. Exploitability is low: `resolveAllDayEventTarget`/`resolveTimedEventTarget` reject any event without an `_id`, and ids are server-issued Mongo ObjectId hex, so no quote can occur today. This is a defence-in-depth gap, not a live break. | **pre-existing** — the helper is unchanged by this run (`git status` clean on `view-event-registry.ts`), and the call site existed verbatim at `HEAD:week-interaction.adapter.ts:148-149`. The refactor only moved it from line 148 to line 127. Exposure is unchanged. | Wrap with `CSS.escape(eventId)`. The repo already establishes this convention at `packages/web/src/components/DatePicker/DatePicker.tsx:84`, so this is consistency work, not a new pattern. Track separately from this run. |
| SEC-2 | info | `packages/web/src/grid/interaction/adapter/view-interaction.targets.ts:137-139` and `:176-178` | In `getAllDayResizeTarget` and `getTimedResizeTarget`, the literal `edge` key is written **before** `...target`, so a `target` carrying its own `edge` property would silently override the computed resize edge. Not currently reachable — `target` is the locally-constructed `ViewResolvedEventTarget` (`{event, hadFormOpenBeforeInteraction, registered}`), which has no `edge` key, and the type system rejects one. Noted only because the sibling drag functions at `:116` and `:155` put the literal after the spread, so the ordering is inconsistent within the same new file. | **pre-existing logic, newly co-located** — token-identical to the Week and Day adapters at HEAD; the refactor merged the two copies without altering key order. | Move `edge` after the spread for uniformity with the drag paths. Cosmetic; does not gate. |

No high, critical, or medium findings. No finding was introduced by this run.

## Explicitly checked and clear

Each item below is a grep that **executed** across all 29 in-scope files and returned no hit (or
only the benign hits noted).

1. **No new sinks for event data.** `grep -nE "console\.|debugger|alert\(|process\.stdout|analytics|telemetry|track\(|logEvent|Sentry|captureException|datadog|posthog|amplitude|mixpanel"` over all 29 files returns exactly one hit, and it is a *prose comment* at `view-interaction.core.ts:52` mentioning `window.__weekInteractionMotionActive`. Zero `console.log`/`console.error`, zero `debugger`, zero analytics calls. The merge of the two adapters left no debug logging behind — this was the highest-prior risk in the brief and it is clean.
2. **No thrown error embeds event content.** No `throw` in the changed non-test files interpolates a title, description, or `calendarId` into a message.
3. **No HTML-injection sink.** `grep -nE "innerHTML|outerHTML|insertAdjacentHTML|dangerouslySetInnerHTML|document\.write|eval\(|new Function|createContextualFragment|javascript:|srcdoc"` returns only four hits, all `document.body.innerHTML = ""` **test teardown** in `view-interaction.module.test.ts:9`, `view-interaction.targets.test.ts:71`, and `week-interaction.idempotence.test.ts:90,200`. Assigning the empty string is not a sink.
4. **The draft-event DOM path is safe and untouched.** `packages/web/src/grid/interaction/dom.ts` is unmodified by this run (`git status --porcelain` clean). Its only event-derived write is `timeLabel.textContent = getTimesLabel(...)` at `dom.ts:54`; `createDraftEventMount` builds nodes via `document.createElement` (`dom.ts:108`) and `setAttribute` (`dom.ts:110`). The five `mutate: (node) => ...` callbacks in the two adapters (`day-interaction.adapter.ts:237,261`; `week-interaction.adapter.ts:270,315,349`) delegate to `updateDraftEventTimeLabel` and add no markup of their own. No event-derived string reaches an HTML-parsing sink anywhere on this path.
5. **`targetSelector` construction is safe.** `view-interaction.module.ts:25` builds `` `[${view.idAttribute}][${view.typeAttribute}]` ``. Those attribute names come from `viewInteractionAttributeNames(viewName)` with `viewName` supplied as the string literals `"day"` and `"week"` at `view-interaction.module.ts:67-68`. No untrusted value can reach this template. `view-interaction.module.test.ts:70-74` pins both resulting selectors.
6. **No prototype pollution.** Every spread in the changed non-test files was inspected individually: `view-interaction.module.ts:28`, `view-interaction.targets.ts:116,138,155,177`, `view-interaction.core.ts:88`, `day-columns.ts` (none), `timed.commit.ts:18,50`, `all-day.commit.ts:29`, `all-day.drag.ts:74`, `day-layout.cache.ts:29,47`, `week-layout.cache.ts:49`, `week-interaction.adapter.ts:269,348,423,454`. All spread internally-constructed, statically-typed objects (targets, layout sources, engine options, `Schema_GridEvent`). None merges an attacker-supplied **key name**, none writes `__proto__`/`constructor`/`prototype`, and no `Object.assign` onto a shared object appears. `Object.freeze` at `view-interaction.module.ts:66` is a correctness guard on the two-registry invariant, not a security control, and is used correctly.
7. **Non-null assertions are sound and unchanged.** The eight `target.event._id!` sites in `interactions/{all-day,timed}.{drag,resize}.ts` are guarded upstream: `view-interaction.targets.ts:67` (`if (!allDayEvent?._id || !allDayEvent.isAllDay) return null`) and `:89` (`if (!timedEvent?._id || timedEvent.isAllDay) return null`). Those guards existed verbatim at `HEAD:day-interaction.adapter.ts:550,573` and `HEAD:week-interaction.adapter.ts:599,622` — the refactor consolidated them, it did not weaken them. `day-columns.ts:37` (`columnKeys[initialColumnIndex]!`) is safe by construction: when `eventColumnIndex >= 0` the index is a verified `indexOf` result into `calendarColumnKeys`; otherwise the index is `0` into a single-element array. Identical to `HEAD:day-interaction.adapter.ts:263`. **No assertion is newly reachable on an undefined value**, so the availability concern raised in the brief does not materialise.
8. **No network, storage, or messaging surface.** `grep -nE "fetch\(|axios|XMLHttpRequest|localStorage|sessionStorage|document\.cookie|WebSocket|navigator\.send|postMessage|import\("` over all 29 files: zero hits.
9. **No secrets.** `grep -rniE "(api[_-]?key|secret|password|token|bearer|credential|private[_-]?key)[ \t]*[:=][ \t]*['\"\`][a-zA-Z0-9]"` over all 29 files: zero hits. The three new test files embed no real credentials — fixtures are synthetic event ids and dates only.
10. **No dependency added.** `git status --porcelain -- package.json bun.lock '*/package.json'` returns empty and `git diff --stat` on those paths is empty, so both manifests are untouched as required. The only non-relative import introduced anywhere in the 29 files is `"bun:test"` (test files); everything else resolves through `@web/`, `@core/`, or a relative path.
11. **The `window.__weekInteractionMotionActive` global is pre-existing and carries no data.** It is defined in `packages/web/src/views/Week/interaction/state/motion.state.ts` (unmodified by this run) and holds a `boolean`. No event content is written to `window`.

## Out of scope / deferred

- **`npm audit --omit=dev` — NOT RUN, and therefore not reported as passing.** The command fails with `ENOLOCK`: this is a Bun workspace with `bun.lock` and no `package-lock.json`. I ran `bun audit --prod` as the closest substitute; it reports **69 vulnerabilities (24 high, 37 moderate, 8 low)**, including high-severity advisories in `postcss`, `nanoid`, `ws` (via `jsdom`), and `ip-address` (via `@compass/backend › mongodb`). **All are pre-existing and none is attributable to this run**, which added zero dependencies (verified in item 10 above). Recorded as advisory; does not gate this run. If a gating dependency posture is wanted, either generate a lockfile (`npm i --package-lock-only`) or adopt `bun audit --prod` as the canonical command in the checklist — the current checklist command cannot succeed in this repo.
- **The wider application** — controllers, services, entities, guards, audit log, Helmet, rate limiting, error filters. None of these exist in the reviewed slice; this is front-end pointer code in a Bun monorepo. Not walked, per brownfield scoping.
- **PII encryption at rest, role-based response masking, audit-log ordering.** No `government_id`, `bank_account`, or `salary_base` field exists anywhere in the reviewed files, and this slice performs no read or write of persisted data. The requirements doc's "not applicable" is correct and I am not manufacturing entries to fill these sections.
- **SEC-1 remediation** (`CSS.escape` in `view-event-registry.ts`) touches a file outside this run's change set. It should be filed as its own ticket rather than folded into a behaviour-preserving refactor.

## Verdict

`pass-with-observations`

Two observations, **both pre-existing**, **zero introduced by this run**, none above `low`. Nothing
here blocks Gate 3. The one item worth carrying forward as an independent ticket is SEC-1.
