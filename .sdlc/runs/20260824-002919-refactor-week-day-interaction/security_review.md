# Security Review — pass 1

- **Run:** `20260824-002919-refactor-week-day-interaction`
- **Mode:** brownfield, changed-files-only
- **Branch:** `CMP-104/opus-plus-flash-v37` vs `main @ 4189de13`, nothing committed
- **Scope reviewed:** 41 files (38 modified + 4 untracked, minus `.claude/settings.json` which
  was dirty before the run and is excluded per instruction)
- **Intent:** refactor → full checklist applies to changed files
- **Verdict: PASS-with-findings**

## Summary

This is a type-only frontend refactor with no server surface: it touches no controller, service,
entity, guard, JWT path, password store, or audit table, and it adds no dependency and no
third-party import. The PII / authn-authz / audit-log-integrity / headers sections of the
checklist are **not applicable to this delta** and are recorded as N/A below rather than as
passes — I did not audit the server packages and cannot assert anything about them. On the
substance the run was asked to be judged on, the specific data-corruption path is genuinely
closed: `cross-row.commit.ts` and Week's `all-day.commit.ts` are now pinned to `DateColumnKey`,
a Day-produced visual is rejected with TS2345, and the unchecked `visual.dayDate as CalendarId`
has been replaced by a guard backed by a real regex schema. Reusing the `@core` zod brands rather
than inventing type-only brands was the right call and is why zero unchecked cast helpers survive
in production code. Two MEDIUM findings hold this back from a clean pass, and both concern the
*durability* of the fix rather than a live exploit: the branded key remains assignable to bare
`string`, so the bug **class** is not structurally prevented (only the three known sites are), and
the no-default type parameter that is the entire enforcement mechanism has **no** regression
guard — the `@ts-expect-error` proof file described in the review brief does not exist anywhere in
the tree.

## Findings

| Severity | Category | Location | Issue | Recommendation |
|---|---|---|---|---|
| MEDIUM | Type-safety / data integrity | `packages/web/src/grid/interaction/types/column-key.types.ts:19`, doc claim at `packages/web/src/grid/interaction/types/timed-drag.types.ts:33-37` | `GridColumnKey` is a branded **string**, so it stays assignable to `string`. Any future shared function generic over `TColumnKey extends GridColumnKey` can call `dayjs(visual.dayDate)` with **no compiler error**, reintroducing the exact `Invalid Date → NaN` corruption reachable from Day. Confirmed by a standalone `tsc --noEmit --strict` probe: only bare-`string`-into-key errored (TS2322); both `<T extends GridColumnKey>(v) => dayjs(v.dayDate)` and `dayjs(calendarId)` compiled clean. A live sink already sits in the shared layer: `grid/interaction/date.ts:3` `getLocalMinutes(date: string \| undefined)` accepts any column key silently. The doc comment claiming shared code "cannot parse it without declaring the constraint" is therefore **false as written**. | Minimum: correct the comment to say what is actually true — the three known parse sites are pinned, the constraint is per-site and not structural. Stronger (follow-up ticket): make the key non-assignable to `string` (opaque wrapper, or leave `TColumnKey` unconstrained in shared signatures so string-ness is not inferable in the generic body), which is the "structurally cannot dayjs-parse" property OQ-1 Option B promised and this delivery does not have. |
| MEDIUM | Regression guard absent | `packages/web/src/grid/interaction/types/timed-drag.types.ts:32`, `packages/web/src/grid/interaction/types/all-day-drag.types.ts:15` | The no-default type parameter is the **sole** enforcement mechanism, and nothing pins it. The self-invalidating `@ts-expect-error` proof file described in the review brief **is not in the tree**: `grep -rn "ts-expect-error" packages/web/src` returns 4 hits, all pre-existing and unrelated (`sse.client.test.ts` ×2, `MenuItem.tsx`, `TimePicker.tsx`); there is no `column-key.type.test-d.ts` or equivalent. This was raised as senior-review finding 7 and, unlike findings 2/3/4/5, was **not** actioned. Adding `= string` would type-check green, lint green and pass all 2305 tests, silently restoring the hazard the sibling `flash-agsdk-only` branch shipped. | Add the negative-type test before sign-off (~15 lines): `// @ts-expect-error` on a bare `AllDayDragVisual` (expects TS2314) and on `allDayDragVisualToTimedGridEvent(event, dayVisual)` (expects TS2345). `@ts-expect-error` fails the build when the error *stops* occurring, which is precisely the regression to catch. Grading this MEDIUM, not INFO, deliberately — the prior run logging its equivalent soft spot as accept-as-designed is what let a defaulted parameter ship. |
| LOW | Availability / behaviour change | `packages/web/src/grid/interaction/types/column-key.ts:26-28`, called at `packages/web/src/views/Week/interaction/useWeekInteractionLayoutSync.ts:23` and `packages/web/src/views/Day/interaction/adapter/day-interaction.adapter.ts:246` | `toDateColumnKey` uses `DateOnlySchema.parse`, which **throws**. The refactor moves two call sites from a total `.format()` (previously yielded the harmless string `"Invalid Date"`) to this throwing parse — one inside a `useMemo` on the Week **render path**, one inside `createVisual` on the Day **pointerdown path**. An uncaught throw in render takes the view down. | Reachability independently verified as closed upstream, so this is not a live defect: `routers/loaders.ts:66` validates the route `dateString` with `zYearMonthDayString.safeParse` in `beforeLoad` and redirects on failure (`validateWeekDateParam` / `validateDayDateParam`), and `useWeek.ts:68` derives `weekDays` from that validated anchor. Fail-closed is the correct default for a data-integrity fix, hence LOW. The contract is already documented at `column-key.ts:14-25`. No code change required; carry the cross-module invariant into the FR-3..FR-7 follow-up notes so a third call site re-establishes it. |
| LOW | Test/production boundary | `packages/web/src/grid/interaction/types/column-key.test-util.ts` | Nothing mechanically prevents production code importing this module. The repo has **no eslint config** (biome only, and `biome.json` contains no `noRestrictedImports`); `packages/web/tsconfig.json` has its `include`/`exclude` commented out, so the file compiles alongside production sources; biome's test override matches only `**/*.test.{ts,tsx}` / `**/*.spec.*`, which this filename does **not** match, so it is linted as production; and it is the only `*.test-util.ts` in the repo — the existing convention (per `knip.json`) is `render.test.util.tsx`. | Materially lower risk than it looks, and I verified the mitigation rather than assuming it: all four helpers validate through `DateOnlySchema.parse` / `CalendarIdSchema.parse` and **throw** rather than cast, so importing them from production cannot manufacture an unvalidated brand — a genuine improvement over the prior run's unchecked `asDayColumnKeys`. Zero non-test importers today (12 importers, all `*.test.ts`). Recommend renaming to the repo's existing `column-key.test.util.ts` shape so the test overrides and any future boundary rule pick it up. |
| INFO | Dead code | `packages/web/src/grid/interaction/types/column-key.ts:35-38` | `parseDateColumnKey` has **zero callers** repo-wide — speculative API added inside a declared zero-behaviour-change refactor. Senior-review finding 1, not actioned. | Delete it and re-add in the ticket that actually parses a DOM/URL/storage column key; or state in the comment that it is currently unused and kept as the sanctioned escape hatch, so a later reader does not assume it is on a live path. `knip`'s web workspace config would flag it. |
| INFO | Repo hygiene | `.gitignore` | Adds `.sdlc/` and `.hook-logs/`. | Correct and desirable — run artifacts and hook transcripts should not be committed. No action. |

## Passing checks

Each of these is an assertion I ran, not an absence I inferred from a search I could not perform.

- **The specific corruption path is closed at every known site.** `grid/interaction/commit/cross-row.commit.ts:25,52` and `views/Week/interaction/adapter/commit/all-day.commit.ts:11,17` are pinned to `AllDayDragVisual<DateColumnKey>` / `TimedDragVisual<DateColumnKey>`. Because `GridLayoutCache<TColumnKey>` uses the parameter covariantly, `AllDayDragVisual<DayColumnKey>` is correctly **not** assignable to `AllDayDragVisual<DateColumnKey>` (TS2345). Importer topology re-verified independently: `grep -rn` for both cross-row functions returns only `views/Week/.../interactions/{timed,all-day}.drag.ts` plus the co-located test. No Day importer exists.
- **Cast audit — clean.** `grep -rn "ts-expect-error\|@ts-ignore\|as never\|as unknown\|as any\|as string\|as CalendarId\|as DateOnly"` across `grid/interaction/**`, `views/Week/interaction/**` and `views/Day/interaction/**` returns **zero** code hits (three hits are prose inside comments). The tuple cast and the seven `as never` casts the senior review flagged are gone. Exactly one `as` survives in changed production code — `layout.cache.ts:191` `(input as BuildDayColumnsInput<TColumnKey>)` — and it is reviewed and cleared: it is the pre-existing two-overload implementation discriminator, it reinterprets an argument *shape* rather than manufacturing a brand, and the keys it reads are already branded at the call site.
- **The unchecked brand cast is genuinely gone from the hot path.** `views/Day/.../commit/timed.commit.ts:95` replaces `visual.dayDate as CalendarId` with `isCalendarColumnKey(visual.dayDate)`, falling back to `event.calendarId`. In the previously-unreachable state the old code returned a **date string cast to `CalendarId`** — a corrupted id written to the event. The new fallback is strictly safer.
- **Runtime constructors genuinely validate; they do not assert.** `DateOnlySchema` → `zYearMonthDayString` (`packages/core/src/types/type.utils.ts:20-32`) is a strict `dayjs(s, "YYYY-MM-DD", true).isValid()` refine, so `"Invalid Date"` is rejected. `CalendarIdSchema` → `ObjectIdStringSchema` (`:54`) is a literal `/^[0-9a-f]{24}$/i` regex — notably **not** `ObjectId.isValid`, which would also accept any 12-character string. The two brands are provably disjoint (10-char date vs 24-hex id), so `isCalendarColumnKey` cannot misclassify a date column key as a calendar id.
- **No path bypasses the constructor.** The sole production ingress for calendar column keys is `views/Day/components/Calendar/DayCalendarGrid.tsx:176` — `displayedCalendars.map((calendar) => calendar.id)` — cast-free, flowing into the now-narrowed `calendarColumnKeys?: CalendarColumnKey[]` prop. The sole ingress for date column keys is `toDateColumnKey`, which parses. `day-interaction.adapter.ts:262-264` replaced `indexOf(calendarId ?? "")` with an explicit truthiness guard, removing the empty-string sentinel rather than laundering it.
- **Secrets — none.** `grep -rEn "(api[_-]?key|secret|password|token)[ \t]*[:=][ \t]*['\"][a-zA-Z0-9]"` across the three interaction subtrees returns zero hits. Test fixtures use obvious placeholder ObjectIds (`aaaaaaaaaaaaaaaaaaaaaaaa`, `bbbb…`, `cccc…`), not real credentials.
- **No PII in logs or error messages.** `grep -rn "console\.\|logger\."` across all three interaction subtrees returns zero hits. The only new throw sites are zod parse errors carrying a date string (`toDateColumnKey`), which is not PII.
- **Dependency risk from new imports — none.** Every import added by this delta resolves to `@core/*` or `@web/*` intra-repo. `git diff --stat` on `package.json`, `packages/*/package.json` and `bun.lock` is **empty** — no manifest change.

## Not applicable to this delta

Recorded explicitly so these are not mistaken for passes. I did **not** audit the server packages
and make no claim about them.

- **PII handling** (`government_id` / `bank_account` / `salary_base` encryption at rest,
  role-based response masking, audit-log ordering) — no such fields, entities, serializers,
  interceptors or DTOs exist in this delta. All 41 files are under `packages/web/src`.
- **Authn & authz** (route guards, `reports_to` checks, JWT secret sourcing, password hashing
  cost factor) — no route, guard, token or credential store is touched.
- **Audit log integrity** (append-only, `auditor`-only read, actor/action/target/fields/ts/request_id) —
  no audit table or writer in scope.
- **Surface & headers** (helmet, auth rate limiting, global error filter) — frontend-only delta,
  no HTTP server middleware touched.
- **`.env.example` / `.env` gitignored** — not part of the delta; repo-wide config audit is out of
  scope for a changed-files-only review and I did not perform it.

## Noted (pre-existing, out of scope — advisory, does not gate)

- **`npm audit --omit=dev` could not be run as specified.** This is a bun workspace with no npm
  lockfile: `npm audit --omit=dev` fails with `ENOLOCK`. I ran `bun audit --omit=dev` instead, and
  bun does **not** honour `--omit=dev` — the output includes dev and build-chain packages. Result:
  **69 vulnerabilities (24 high, 37 moderate, 8 low)**, e.g. `postcss` (arbitrary file read via
  `sourceMappingURL`, high), `nanoid` via postcss (high), `ws` via jsdom (high, DoS),
  `ip-address` via mongodb (high, SSRF/trust-boundary bypass). Because the dependency manifests are
  byte-unchanged in this delta, **none of these are introduced by this run** and none gate Gate 3.
  Flagging separately that the production-only subset has not actually been isolated — the "no
  high/critical in prod deps" checklist item is **unverified**, not passed.
- **`.claude/settings.json`** was dirty before this run and is excluded per instruction; senior
  finding 6 recommends committing it separately from CMP-104 so the ticket commit stays a clean,
  revertable type-only change. Agreed, but it is a hygiene point, not a security one.

## Required fixes before sign-off

1. **Add the missing `@ts-expect-error` regression guard** for the no-default `TColumnKey`
   (MEDIUM, `timed-drag.types.ts:32` / `all-day-drag.types.ts:15`). This is the cheapest and most
   load-bearing fix on the list: without it the entire safety property of the ticket is one
   three-character edit away from silently evaporating, with green type-check, green lint and
   2305 green tests. The review brief describes this file as delivered; it is not.
2. **Correct the false claim in the `TimedDragVisual.dayDate` doc comment**
   (MEDIUM, `timed-drag.types.ts:33-37`). Shared code *can* `dayjs`-parse a branded key — the
   protection is that three specific functions declare `DateColumnKey`, not that parsing is
   structurally impossible. Leaving the stronger claim in place will mislead the FR-3..FR-7 merge
   work, which is exactly when new shared consumers get written.

Recommended, not blocking: file a follow-up for the structural fix in finding M-1 (key not
assignable to `string`), rename `column-key.test-util.ts` to the repo's existing
`*.test.util.ts` convention, and delete or annotate the dead `parseDateColumnKey`.
