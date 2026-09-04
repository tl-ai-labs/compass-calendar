# Security Review — brownfield, changed files only

Run: `20260903-181010-refactor-week-day-interaction`
Mode: brownfield · Intent: refactor · Scope: the 31-path delta (25 modified + 6 new), nothing else.

## Tooling note (read this before trusting any "absent" claim below)

`Glob` and `Grep` were **not present** in this session's tool surface — only `Read`, `Bash`, `Write`.
Every enumeration and every negative result below was produced with `Bash` (`git status --porcelain`,
`git diff`, `git show`, `ls -R`, `grep -rn`), and the exact command is named at each claim. No check in
this review is reported as "clean" on the basis of a search I could not run.

Change set was taken from `git status --porcelain` and cross-checked against
`.sdlc/runs/20260903-181010-refactor-week-day-interaction/provenance.json` (`files_touched[].path`).
The two agree: 26 tracked modifications (incl. 2 test files), plus `grid/interaction/adapter/`
(6 new files), `types/column-key.types.ts`, and 2 new test files. Provenance lists no path outside
that set.

## Summary

Low risk. This is a pure type-level refactor of front-end pointer/DOM code: 24 of 26 modified
production files change only generic parameters, type aliases and comments. The delta introduces no
network call, no storage access, no logging, no dependency change and no new DOM sink — verified by
grep, not assumed. The one genuinely security-relevant line in the diff, the Day-view conversion of
a drag column key into an event's `calendarId`, is **behaviourally identical** to the code it
replaced (`visual.dayDate as CalendarId` → `columnKeyAsCalendarId(visual.dayDate)`, same runtime
guard, same operand), and I traced the single-column fallback end-to-end to confirm the guard cannot
be bypassed. The refactor's premise — that Week date keys and Day calendar-id keys must never be
interchanged — is now enforced by mutually-unassignable compile-time brands, and
`bunx typescript@7.0.2 -p packages/web/tsconfig.app.json --noEmit` exits 0, so that enforcement is
real rather than aspirational. Nothing here blocks Gate 3.

## Findings

| ID | Severity | Category | Location | Origin | Issue | Recommendation |
|---|---|---|---|---|---|---|
| F-1 | low | Data integrity / type safety | `packages/web/src/views/Day/interaction/adapter/commit/timed.commit.ts:102-103` | **pre-existing** (behaviour unchanged; cast merely renamed) | `columnKeyAsCalendarId` writes a column key straight into `event.calendarId` with no runtime validation. The `CalendarColumnKey` brand does **not** prove calendar-id-ness — `asDayColumnKeys` (`geometry/day-layout.cache.ts:39-40`) brands *any* `string[]`, including the single-element `YYYY-MM-DD` fallback. Safety rests entirely on the runtime guard, not the type. | Optional hardening ticket: validate with the `CalendarId` zod parse (or an ObjectId-shape check) at this boundary and drop the write when it fails, rather than relying on an invariant held two files away. |
| F-2 | low | Injection (DOM) | `packages/web/src/grid/interaction/view-event-registry.ts:69-72` (`calendarEventIdValueSelector`) | **pre-existing** | Event id is interpolated unescaped into a CSS attribute selector: `` `[${attr}="${eventId}"]` ``. A `"` or `]` in an id yields a malformed selector and an uncaught `SyntaxError` from `document.querySelector` in the focus/refocus paths (`common/utils/event/event.util.ts:137,161,184`) — a broken-interaction DoS, not script execution (CSS selectors are not an XSS sink). | Wrap with `CSS.escape(eventId)`. The repo already uses `CSS.escape` at `components/DatePicker/DatePicker.tsx:84`, so this is an inconsistency rather than an unknown pattern. File a ticket; do not gate this run. |
| F-3 | info | Type safety | `packages/web/src/grid/interaction/math/timed.drag.ts:194-198` | introduced by this change | `getCurrentScrollTop(layout: GridLayoutCache<string>, …)` is the one deliberately widened signature in shared code — it accepts either view's cache. Safe: the function reads only `layout.smartScroll.initialScrollTop` and touches no column key. Recorded so the plan's "G-3 grep" for bare widening has a known, justified hit. | No action. Keep it in the allow-list for the widening grep. |

### F-1 — the trace, in full

This is the line the brief flagged as most security-relevant (a wrong `calendarId` = an event written
to a calendar the user did not choose), so I traced rather than reasoned about it.

Reachability is gated by `visual.dayDate !== visual.initialDayDate` (`timed.commit.ts:85-87`; the
all-day sibling at `commit/all-day.commit.ts:19-31` uses the identical guard and the same helper).
The dangerous case is the single-column fallback, where the one column key is a **date string**, not
a calendar id. Chain:

1. `day-interaction.adapter.ts:157-167` — when the event's calendar is not among the rendered
   columns (`eventColumnIndex < 0`), `columnKeys` becomes `asDayColumnKeys([visibleDateKey])`,
   an array of length 1, and `initialColumnKey = columnKeys[0]`.
2. `layout.cache.ts:194-220` — `buildDayColumns` maps `visibleDates` 1:1, so `dayColumns` has
   exactly one entry, whose `.date` is that same fallback key. Columns come from the array only;
   they are never re-derived from the DOM, so there is no way for a second column to appear.
3. `math/drag-column.ts:31` → `layout.cache.ts:222-240` — `getNearestDayColumn` over a 1-element
   array returns that element unconditionally.
4. `math/timed.drag.ts:115` — `dayDate: nextColumn?.date ?? visual.dayDate`, i.e. the same key.

Therefore `dayDate === initialDayDate` in the fallback, the guard is false, and
`columnMoveCalendarId` returns `event.calendarId` unchanged. The cross-row branch at
`math/timed.drag.ts:75-90` (which would set `dayDate` from an all-day placement) is unreachable in
Day: `buildDayLayoutCacheForTarget` calls `buildDayTimedLayoutCache`, which never populates
`crossRow`, so `getDragRowLayouts(layout, "timed")` yields `allDay === null`
(`math/cross-row.drag.ts:39-41`). Even if it were reachable, that layout would be built from the
same single-element `visibleDates`.

The fallback is covered by an existing regression test —
`day-interaction.adapter.test.ts:462-471`, an "orphan" event dragged horizontally, asserting
`result.event.calendarId` is preserved. Confirmed green (see Verification).

Non-fallback Day drags do change `calendarId` to another rendered column's key. That is the
intended cross-calendar-move feature, the keys come from `DayInteractionCoordinator.tsx:64`
(`calendarColumnKeysRef`, the rendered calendar ids), and it is unchanged by this run. Whether the
user is authorised to write to the destination calendar is a server-side concern outside this delta.

### Cross-view confusion (brief item 3) — no finding

The refactor's premise holds, and it is enforced, not merely documented:

- `types/column-key.types.ts:21-45` — `DateColumnKey` and `CalendarColumnKey` are distinct
  `unique symbol` brands, mutually unassignable in both directions.
- Week's date-parsing commits are now typed `DateColumnKey`-only
  (`grid/interaction/commit/cross-row.commit.ts:26,49`; `views/Week/.../commit/timed.commit.ts`;
  `views/Week/.../commit/all-day.commit.ts`), so a Day visual whose key is a calendar id can no
  longer be `dayjs`-parsed as a date. That was previously a live silent-wrong-date hazard.
- The DOM-target side gets a phantom view brand (`view-event-registry.ts:15,37-40`), with
  `ViewRegisteredEventTarget<"day">` / `<"week">` at the two registries.
- Every shared function in `grid/interaction/math/**` and `commit/**` is parameterized over `TKey`
  (verified by reading each diff); the only un-parameterized shared signature is F-3.
- Routing one view's visual into the other's commit is impossible by construction anyway:
  `commitDispatch` is supplied by each view's own adapter
  (`day-interaction.adapter.ts:124-146`), not by the shared layer.

Compile-time claims verified by execution, not by reading: type-check exits 0, and
`view-event-registry.brand.test.ts` / `column-key.types.test.ts` assert the negative direction with
`@ts-expect-error`.

### Casts (brief item 4) — exactly four, all justified

`grep -nE "\bas "` across all 31 non-test delta files returns 4 real casts (the remainder are
`as const`, `import … as …`, or the word "as" in prose):

1. `views/Day/.../geometry/day-layout.cache.ts:40` — `keys as CalendarColumnKey[]`. Sole Day entry
   point to the branded world; input signature `getColumnKeys(): string[]` is owned outside this
   layer. Widens role, not value — see F-1.
2. `views/Week/.../geometry/week-layout.cache.ts:68` — `sources.visibleDays as DateColumnKey[]`.
   Week mirror of (1); values are the `YYYY-MM-DD` keys produced by the same render that painted
   the columns.
3. `views/Day/.../commit/timed.commit.ts:103` — `key as unknown as CalendarId`. The subject of F-1.
   The double cast is required because the two brands are disjoint; it is strictly more legible
   than the bare `as CalendarId` it replaced, and runtime-identical.
4. `grid/interaction/adapter/view-target-resolution.ts:224` — `registered as TRegistered`. Sole
   widening point for the phantom view brand. Sound: each registry is namespaced by its own
   `data-${view}-interaction-event-*` attributes, so anything it resolves provably belongs to that
   view; the cast only attaches an optional phantom property that erases at runtime.

One further cast exists at `layout.cache.ts:206` (`input as BuildDayColumnsInput<TKey>`) — confirmed
**pre-existing** via `git diff` (it is an overload-dispatch cast, outside the changed hunks).

## Passing checks

- **Off-limits boundary honoured.** `git status --porcelain packages/web/src/interaction` → empty.
- **No dependency change.** `git status --porcelain -- bun.lock '*package.json'` → empty, re-verified
  after running the type-check (the `bunx` "Saved lockfile" line touched a tool cache, not the repo).
- **No secrets.** `grep -rniE "(api[_-]?key|secret|passwd|password|token|bearer)[ \t]*[:=][ \t]*['\"][a-zA-Z0-9]"` over the whole delta, tests and new dirs included → no matches.
- **No new PII logging.** `grep -nE "console\.|logger|log\.|Sentry|captureException|track\(|analytics"` over all 31 non-test delta files → no matches. Calendar event titles/attendees are never read into a log or a string in this delta.
- **No new dangerous sinks.** `grep -nE "innerHTML|outerHTML|dangerouslySetInnerHTML|eval\(|new Function|localStorage|sessionStorage|fetch\(|document\.write"` over the same set → no matches. The 6 new shared adapter files (812 lines) contain **zero** `querySelector` / `getAttribute` / `document.` references — DOM access stayed in the views.
- **Selector path unchanged by this run.** The only hunk in `view-event-registry.ts` is the
  `ViewRegisteredEventTarget` type; `git show HEAD:` confirms `calendarEventIdValueSelector` and its
  Week call site at `week-interaction.adapter.ts:135` are both pre-existing and byte-identical. Event ids are 24-char hex ObjectIds (`createObjectIdString()`, `event.util.ts:46`), so F-2 has no practical trigger today.
- **No credentials in the new test fixtures.** The 2 new test files use `null as unknown as HTMLElement` and literal `"e1"`; the calendar ids in the Day adapter test are `"cccccccccccccccccccccccc"`-style placeholders.
- **Runtime behaviour parity on the sensitive path** is asserted by an existing test, not just by inspection.

### Checklist items not applicable

No controller/route, guard, JWT, password-hashing, PII-at-rest, serializer-masking or audit-log code
exists anywhere in this delta — confirmed by the greps above, not by assumption. Those sections of
the standard checklist are genuinely out of scope for a front-end pointer refactor and are recorded
as N/A rather than as passes.

## Verification performed

- `bunx typescript@7.0.2 -p packages/web/tsconfig.app.json --noEmit` → exit 0.
- `bun run test:web -- day-interaction.adapter.test.ts column-key.types.test.ts view-event-registry.brand.test.ts cross-row.commit.test.ts` → **27 pass / 0 fail**, incl. the fallback `calendarId`-preservation test.
  (A first attempt with bare `bun test` reported 1 fail — that was the harness's missing `PORT`/`API_BASEURL` env, not a test defect; it disappears under the repo's own runner.)

## Noted (pre-existing, out of scope — do not gate this run)

- **Dependency advisories.** `npm audit --omit=dev` is unusable here (`ENOLOCK` — bun workspace, no
  `package-lock.json`), so I ran `bun audit`: **76 vulnerabilities, 26 high / 42 moderate / 8 low**,
  incl. high-severity `postcss` (arbitrary file read via `sourceMappingURL`), `nanoid`, `ws`
  (via `jsdom`), and `ip-address` (via `@compass/backend` → `mongodb`). Most sit under build/test
  tooling. **None are attributable to this run** — no manifest or lockfile changed. Existing repo
  debt; worth its own ticket.
- F-1 and F-2 above are both pre-existing and are ticket material, not gate material.

## Required fixes before sign-off

None. No finding is introduced by this change at a severity that should block Gate 3.

Suggested follow-up tickets (non-blocking): F-2 (`CSS.escape` in `calendarEventIdValueSelector`),
F-1 (runtime validation at the `columnKeyAsCalendarId` boundary), and the `bun audit` backlog.

## Verdict

**pass_with_notes** — the two substantive findings are pre-existing and low severity; the delta
itself is a type-level refactor that narrows an existing hazard (untagged column keys) rather than
adding one.
