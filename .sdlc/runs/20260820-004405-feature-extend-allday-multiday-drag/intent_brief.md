# Intent Brief — feature-extend — Multi-day drag-to-select in the Week all-day row

## Context

The user's request, verbatim:

> add multi-day drag-to-select on WeekBody that creates a spanning event across the dragged day range

Discovery findings that shape this brief (baseline built 2026-08-20T04:32Z at `4189de1`; re-verified
at brief time — HEAD unchanged, tree clean apart from untracked `.sdlc/`):

- **There is no `WeekBody` component.** `grep -rn "WeekBody" packages/web/src` returns zero hits. The
  Week body is `packages/web/src/views/Week/components/Grid/Grid.tsx`, which composes
  `AllDayRow > MainGrid > EventGrid`. "WeekBody" is read as the Week grid body, and — per the user's
  answer at brief time — the gesture lands on the **all-day row**, the surface where a spanning
  (multi-day) event is expressible.
- **The gap.** `packages/web/src/grid/hooks/useAllDayDraftCreation.ts` is click-only. On mousedown it
  resolves a single date and hardcodes the span:
  ```ts
  const startDate = getStartDate(event.clientX, event.clientY);
  const endDate = dayjs(startDate).add(1, "day").format(YEAR_MONTH_DAY_FORMAT);
  ```
  There is no mousemove/mouseup gesture, no movement threshold, and no live preview.
- **The pattern to mirror.** `packages/web/src/grid/hooks/useTimedDraftCreation.ts` already implements
  the full drag-create gesture (threshold, live preview via the draft store, commit on mouseup, cancel
  on blur/escape). Its `resolveDraftForPointer` deliberately ignores cross-day movement behind an
  `isSameDayDrag` guard — that guard is why the timed grid is *not* the chosen surface here, and per
  the user's constraint it stays as-is.
- **Shared-code blast radius.** `packages/web/src/grid/**` and `useAllDayDraftCreation` are consumed by
  both the Week and Day views. The hook is extended in place; Day view is expected to be behaviorally
  unchanged (its single day column collapses any drag range to one day), and Day-view suites run as
  proof of no regression.
- **Clean re-run.** A prior run implemented this same feature on branch `CMP-101/opus-flash-v37`
  (commit `297baf95`). That work is **not** present on the current branch
  (`CMP-101/flash-agsdk-only`, clean at `4189de1`) — greps for `multiDayDraft`, `useAllDayDraftDrag`,
  and `allDayDraftCreationDrag` return zero hits in `packages/web/src` and `docs`. The prior
  implementation is to be **ignored, not consulted**; this run regenerates the feature under the
  `flash-agsdk-only` policy.
- **Run lineage.** Run `20260819-233904` covered this same job, reached Gate 0 approved, and blocked
  at the requirements phase. The user chose to discard it and start fresh; its state file is retained
  as `.sdlc/local/state.discarded-20260819-233904.json`. Its discovery and baseline artifacts are
  carried into this run unchanged, because the repo is byte-identical at the same SHA.
- **Environment fix applied before this run.** A stale `MMO_SELECT=gemini-flash=flash-agsdk-worker`
  (from `.claude/settings.local.json`, left over from the `opus-plus-flash` policy) made every dispatch
  under `flash-agsdk-only` fail at policy load — that policy declared no slots. Per the user's choice,
  `flash-agsdk-only.yaml` now declares a **single-option** `gemini-flash` slot whose only option is the
  renamed model id `flash-agsdk-worker`. The policy stays strictly single-model; no Claude pricing block
  was added. `preflight_dispatch` returns `ok: true` and a live AG-SDK dispatch smoke round-tripped.

## Goal

Extend the Week all-day row so a press-drag-release across day columns selects a contiguous day range
and opens a single draft event spanning that range, instead of the current click-only single-day draft.

Behavior to deliver:

1. **Mousedown** on an empty cell of the Week all-day row starts a potential drag, anchored on that day.
2. **Mousemove** past the movement threshold resolves the pointer's current day column and updates a
   live preview of the spanning draft. Dragging left of the anchor is supported — the range normalizes
   so start ≤ end.
3. **Mouseup** commits the draft as a spanning all-day event covering the full inclusive dragged day
   range, opening the event form the same way the current click flow does.
4. **Below-threshold gestures keep today's behavior** — a plain click still produces the existing
   single-day draft, with no regression to the current click path.
5. **Cancel paths** (escape, blur, pointer leaving the window) discard the in-flight draft without
   committing, consistent with the timed-drag gesture.
6. **Range clamps to the visible week.** Dragging beyond the rendered day columns clamps to the
   first/last visible day rather than producing an out-of-range span.

## Files in scope

Proposed allowlist. Paths marked *(new)* were checked and do not exist yet; the rest were checked and
do exist.

**Core gesture**
- `packages/web/src/grid/hooks/useAllDayDraftCreation.ts` — click-only creator, extended into a drag gesture
- `packages/web/src/grid/hooks/useAllDayDraftCreation.test.tsx` — its unit tests
- `packages/web/src/grid/interaction/math/all-day.create.ts` *(new)* — pure day-range math (normalize, clamp, inclusive span)
- `packages/web/src/grid/interaction/math/all-day.create.test.ts` *(new)* — unit tests for that math
- `packages/web/src/interaction/interaction.constants.ts` — all-day analogue of the movement threshold, if one is needed

**Week wiring**
- `packages/web/src/views/Week/components/Grid/AllDayRow/AllDayRow.tsx` — mousedown entry point
- `packages/web/src/views/Week/components/Grid/AllDayRow/AllDayRow.test.tsx` *(new)* — its tests
- `packages/web/src/views/Week/hooks/grid/useAllDayGridDraftCreation.ts` *(new)* — Week binding of the extended hook, mirroring `useTimedGridDraftCreation.ts`
- `packages/web/src/views/Week/hooks/grid/useAllDayGridDraftCreation.test.tsx` *(new)* — its tests
- `packages/web/src/grid/components/AllDayGridRow.tsx` — all-day column rendering, `onMouseDown`, column DOM geometry
- `packages/web/src/grid/components/AllDayGridRow.test.tsx` *(new)* — its tests

**Draft model, preview, layout**
- `packages/web/src/events/grid-event-draft.adapter.ts` — where a multi-day span is expressed
- `packages/web/src/grid/layout/all-day-draft.position.ts` — spans and positions the in-flight draft across columns
- `packages/web/src/grid/layout/all-day-draft.position.test.ts` — its tests
- `packages/web/src/views/Week/components/Grid/AllDayRow/AllDayEvents.tsx` — all-day event/draft layer

**Docs**
- `docs/frontend/week-drag-interaction.md` — authoritative drag/day-resolution doc; gains the new gesture

**Read-only context (readable, no writes expected)**
- `packages/web/src/grid/hooks/useTimedDraftCreation.ts`, `packages/web/src/views/Week/hooks/grid/useTimedGridDraftCreation.ts` — the gesture pattern to mirror
- `packages/web/src/interaction/interaction.pointer.ts` — pointer eligibility + threshold helpers
- `packages/web/src/views/Week/hooks/grid/useDateCalcs.ts` — `getDateByXY` / `getDateStrByXY`
- `packages/web/src/views/Week/interaction/adapter/geometry/week-layout.cache.ts` — day-column geometry cache
- `packages/web/src/events/stores/draft.store.ts` — live preview channel
- `packages/web/src/views/Week/components/Grid/Grid.tsx` — the actual "week body" composer

**Regression suites expected to run (not necessarily edited)**
- `packages/web/src/views/Week/interaction/adapter/week-interaction.all-day-drag.test.ts`
- `packages/web/src/views/Week/interaction/adapter/week-interaction.all-day-resize.test.ts`
- `packages/web/src/grid/interaction/math/all-day.interaction.test.ts`
- Day-view all-day suites — proof that the shared hook change leaves Day behavior intact

## Files off-limits

Project defaults from `.sdlc/project.json.off_limits_default`:
`.env`, `.env.*`, `.mcp.json`, `.cursor/rules/**`, `.claude/settings.local.json`, `node_modules/**`,
`dist/**`, `build/**`, `.next/**`, `.sdlc/**`, `.git/**`

Plus every AI-config surface discovery detected, all default-OFF-LIMITS:
`.claude/**` (`settings.json`, `launch.json`), `.cursor/**` (`rules/` — 4 `.mdc` files, `hooks.json`,
`hooks/format-after-edit.ts`), `.codex/**` (`config.toml`, `hooks.json`), `.agents/**` (9 shared
skills, `chaos/agents/openai.yaml`), `AGENTS.md`

Plus repo-infrastructure guards:
`.github/workflows/**`, `bun.lock`, `patches/**`, `compass.yaml`, `.playwright-compass.yaml`

Plus, for this run specifically (each confirmed by the user as a constraint):
- `packages/backend/**`, `packages/sync/**`, `packages/core/**`, `packages/scripts/**` — web-only interaction change; no backend or persistence work
- `packages/web/src/grid/hooks/useTimedDraftCreation.ts` and the timed-drag path — the `isSameDayDrag` guard stays
- `packages/web/src/views/Day/**` — Day view must be *proven unchanged*, not edited

## Acceptance criteria

1. Press-drag-release across N day columns in the Week all-day row opens exactly one draft event whose span is the inclusive dragged day range (N days), not 1 day.
2. Dragging right-to-left produces the same normalized range as the equivalent left-to-right drag.
3. A drag that stays under the movement threshold still produces today's single-day draft — the existing click-to-create behavior is unregressed.
4. A live preview of the spanning draft is visible during the drag and follows the pointer across columns.
5. Escape / blur / pointer-leave during the drag discards the draft; no event is created and no form opens.
6. A drag extending past the rendered week clamps to the first/last visible day; no out-of-range or inverted span reaches the draft store.
7. Day-range math is unit-tested as a pure function (normalize, clamp, inclusive span), including the single-day case.
8. `bun test:web` passes with no new failures against the baseline recorded at Gate 0.
9. Day-view all-day behavior is unchanged, demonstrated by its existing suites passing untouched.
10. `docs/frontend/week-drag-interaction.md` documents the new gesture alongside the existing ones.

## Non-goals

- Cross-day dragging in the **timed** grid — the `isSameDayDrag` guard in `useTimedDraftCreation.ts` stays.
- Adding the gesture to **Day view**, or any deliberate Day-view behavior change.
- Multi-day drag on any surface other than the Week all-day row (month view, mini-calendar, sidebar).
- Moving or resizing *existing* all-day events — `all-day.drag.ts` / `all-day.resize.ts` behavior is untouched.
- Backend, sync, or persistence changes — client-side draft creation only; commit flows through the existing all-day event path.
- Porting or consulting the prior `CMP-101/opus-flash-v37` implementation.
- E2E test authoring (`e2e/allday/event-smoke.spec.ts`) unless a phase explicitly calls for it.

---

## Gate 0 outcome (approved 2026-08-20)

Approved as proposed. Confirmed at the gate:

- **Stack:** node-typescript monorepo, work confined to `packages/web`.
- **Test command:** `bun test:web`. Baseline re-measured at `4189de1` under plugin 0.6.0:
  **2298 pass / 0 fail across 302 files (86.87s, exit 0)** — this is the number acceptance
  criterion 8 is judged against.
- **Auth mode:** `estimated`.
- **Policy:** `flash-agsdk-only` — every phase dispatches to `gemini-3.7-flash` via the Antigravity
  SDK agent door (`flash-agsdk-worker`).
- **Existing AI setup:** all detected configs stay OFF-LIMITS; none moved into scope.
- **`.gitignore`:** added to the allowlist (the `[Y/n]` prompt defaulted to yes) so this run can add
  a `.sdlc/` entry.
- **Repo-state risks acknowledged:** Cursor + Codex format-on-edit hooks may reformat written files
  out-of-band; the repo-wide `*.mjs` ignore rule is not expected to bite (output is `.ts`/`.tsx`/`.md`);
  no LFS, no submodules, clean tree, tests green before the run.
- **Rollback anchor:** branch `CMP-101/flash-agsdk-only` at `4189de1`. (`baseline.json` records the
  branch as `main` at the same SHA — label drift from the discovery pass; the tree is byte-identical.)

## Cost-reporting decision (carried forward from 2026-08-20)

`flash-agsdk-only.yaml` stays strictly single-model — no Claude pricing block. Routing is unaffected
either way (every rule and the `default:` resolve to the one Flash leaf; there is no escalation path).
Reported `cost_usd` therefore covers **dispatched Flash calls only**; the orchestrator subagent's own
Claude session turns are unpriced by design. This must be stated plainly at Gate 4 and in the ledger
row. The `$4.26` figure from the `opus-plus-flash-v37` run is not a like-for-like comparison, since
that policy prices its Opus spend.

Measured overhead to expect: the AG-SDK door carries an ~11.1k-token identity preamble on every
packet (~$0.017 before any real work), so packet count drives cost more than packet size.
