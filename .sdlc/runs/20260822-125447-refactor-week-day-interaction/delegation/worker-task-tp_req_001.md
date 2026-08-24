## Task tp_req_001 — requirements_analysis / delta_requirements
Module: week-day-interaction
### Working directory
You are running as an agent inside `/home/sainadh/projects/compass-calendar/compass/compass-calendar`. You may list, read,
edit and create files there, and run commands there. That directory is the
only place you can act; nothing outside it is reachable.
### Instruction
Produce a REFACTOR DELTA requirements document (markdown) for unifying the duplicated Week/Day interaction adapter layers in a Bun+React+TS monorepo. This is a refactor: the dominant requirement class is INVARIANTS TO PRESERVE, not new behavior. Structure the markdown with exactly these sections: (1) Scope of change - numbered, each naming concrete files; (2) Out of scope - numbered, echoing the brief's non-goals; (3) Invariants to preserve - INV-1.. each a testable statement of behavior that must be identical before and after (drag, resize, keyboard nav, commit semantics, Week columns=days vs Day columns=calendars, Day all-day drag never rewriting dates, updateVisual idempotence); (4) Functional requirements - FR-1.. for the structural work itself, with FR-1 being the TimedDragVisual.dayDate branded-type prerequisite; (5) Non-functional requirements - NFR-1.. (zero behavior change, type-check clean, lint clean, no cross-package edits, no public API/attribute renames); (6) Risk register - table of risk, likelihood, blast radius, mitigation, drawn from the discovery notes; (7) Acceptance criteria - numbered and executable, each mapped to a command or a named test; (8) Open questions for HITL. Do NOT write any files. Do NOT run any shell commands - especially never git checkout, git restore, git clean, rm, mv, or any cleanup command. Return the document as a single markdown string in the JSON field requirements_markdown.
### Provided excerpts
These are extracts, not whole files. The paths are real — open them in the
working directory when you need more than the excerpt shows.

#### .sdlc/runs/20260822-125447-refactor-week-day-interaction/intent_brief.md
_Included because: The approved, frozen scope for this run. Requirements must not exceed it._

```
# Intent Brief - refactor - Unify Week/Day interaction adapter, commit-boundary types, and coordinators

## Context
packages/web/src/views/Week/interaction and packages/web/src/views/Day/interaction each implement their own InteractionAdapter on top of the shared, already-generic interaction.engine.ts. Two of four originally-suspected duplicated layers are ALREADY unified (event registry and event targeting are thin shims over shared grid/interaction/ factories). Real remaining duplication:
- week-interaction.adapter.ts (795 LOC) vs day-interaction.adapter.ts (607 LOC) - bulk of duplication, though much is Week-only functionality.
- week-interaction.adapter.types.ts vs day-interaction.adapter.types.ts (149/149 LOC, only 24 differing lines) - BEST FIRST MERGE TARGET.
- geometry/week-layout.cache.ts vs geometry/day-layout.cache.ts (73/76 LOC) - both wrap the same shared builders/constants.
- WeekInteractionCoordinator.tsx (217) vs DayInteractionCoordinator.tsx (133) - Week has extra edge-navigation/layout-sync wiring.

The commit layer (commit/*.commit.ts) is NOT duplication - Week columns are days, Day columns are calendars; Day's all-day drag deliberately never rewrites dates, only calendarId. Out of scope to merge; only narrow type-only edits allowed there if the branded type forces it.

Week's decomposed shape (adapter/interactions/* - five per-interaction modules, plus edge-navigation.ts and dedicated state modules) is the better target to unify toward; Day's monolithic adapter should move toward that shape, not the reverse.

PREREQUISITE, not a nice-to-have: TimedDragVisual.dayDate is string-typed but overloaded - a YYYY-MM-DD date in Week, a CalendarId in Day (see columnMoveCalendarId in Day's commit code, which casts visual.dayDate as CalendarId). No type error currently catches misuse. This must be given a branded or parameterized type (e.g. a TColumnKey generic, or a branded DateColumnKey | CalendarColumnKey union) BEFORE any adapter/types merge proceeds - discovery flagged this as the single highest-risk item in the whole run. Type-level change only; no runtime behavior difference.

interaction.engine.ts itself needs no change - already a generic createInteractionEngine<TTarget, TVisual, TResult> and both views already implement InteractionAdapter. The gap is that grid/interaction/ stops short of the adapter/commit boundary; widen that layer rather than pushing view-specific logic up into src/interaction/.

## Goal
Reduce the real duplication between Week's and Day's interaction adapters, adapter-types, geometry layout caches, and coordinators by widening the shared grid/interaction/ layer to cover the adapter/commit boundary - starting with the adapter-types merge - while giving TimedDragVisual.dayDate a type that statically distinguishes Week's date usage from Day's CalendarId usage. No behavior change for either view.

## Files in scope
- packages/web/src/grid/interaction/** (the shared layer being widened)
- packages/web/src/views/Week/interaction/**
- packages/web/src/views/Day/interaction/**
- packages/web/src/interaction/interaction.adapter.types.ts (only if the branded/parameterized column-key type requires touching the shared InteractionAdapter contract)
- Matching/co-located test files for all of the above (*.test.ts, *.test.tsx, contextMenuLayering.test.tsx since it imports both views)
- .gitignore (add .sdlc/backups/** so this run's bookkeeping does not create diff noise)

## Files off-limits
.env .env.* .mcp.json .cursor/** .claude/** .sdlc/** .git/** .hook-logs/** node_modules/** dist/** build/** packages/backend/** packages/sync/** packages/scripts/** packages/core/**
The refactor is confined to packages/web. packages/core/src/types/event.contracts.ts and sibling core types are explicitly off-limits - no cross-package type changes.

## Acceptance criteria
- bun run test:web stays green at the current baseline (2298 pass / 0 fail) plus any new tests - zero regressions. Interaction-only subset (159/159) green too.
- bun run type-check and bun run lint both exit 0.
- week/day adapter.types.ts duplication reduced - first and primary merge target.
- TimedDragVisual.dayDate's overloaded string type replaced with a branded or view-parameterized type making Week's date usage and Day's CalendarId usage statically distinct; existing casts (columnMoveCalendarId) updated without behavior change.
- No change to drag/resize/keyboard-navigation/commit BEHAVIOR for either view - structural refactor only.
- Already-unified registry/targeting shims (week/day-event.registry.ts, week/day-event.targeting.ts) left alone.

## Non-goals
- Do not merge commit/*.commit.ts logic.
- Do not further collapse the already-unified event-registry/event-targeting shims.
- Do not touch packages/backend, packages/sync, packages/scripts, packages/core.
- Do not fix the pre-existing act(...) warning noise from SettingsModal in DayInteractionCoordinator.test.tsx.
- No new features, no user-visible behavior change, no unrelated cleanup.
```

#### .sdlc/runs/20260822-125447-refactor-week-day-interaction/discovery.md
_Included because: Verified file map, baseline test counts, blast radius and the critical dayDate risk - the factual basis for the risk register and acceptance criteria._

```
Baseline tests green BEFORE any change: `bun run test:web` = 2298 pass / 0 fail, 302 files, 86.5s. Interaction dirs only = 159 pass / 0 fail, 83 files, 3.6s. Pre-existing noise: React act(...) warnings from SettingsModal in DayInteractionCoordinator.test.tsx - NOT failures, do not fix.

Stack: Bun monorepo (bun@1.3.14), Bun workspaces packages/*, TypeScript + React, lint/format via Biome, type-check pinned typescript@7.0.2. Path aliases @web/* -> packages/web/src/*, @core/* -> packages/core/src/*. Imports in scope use aliases, not deep relatives.

ALREADY UNIFIED - do not re-unify: grid/interaction/view-event-registry.ts (Week/Day registry shims, 24 L each, only 4 differing lines); grid/interaction/event.targeting.ts (Week/Day targeting shims, 35 L each, 16 differing lines, naming only); grid/interaction/layout.cache.ts builders already shared by both geometry caches; grid/interaction/commit/timed-moved.ts already shared by both commit modules.

GENUINELY DUPLICATED - the real targets: adapter/week-interaction.adapter.ts vs adapter/day-interaction.adapter.ts (795/607 LOC, 448 differing lines but much is Week-only features); adapter/week-interaction.adapter.types.ts vs adapter/day-interaction.adapter.types.ts (149/149, only 24 differing lines, BEST FIRST TARGET, target/visual/commit-result union types structurally identical); adapter/geometry/week-layout.cache.ts vs day-layout.cache.ts (73/76, same shared builders and constants ID_GRID_MAIN, GRID_TIME_STEP, TIMED_VISIBLE_HOURS, smart-scroll insets; differ in edge threshold source and extra input); WeekInteractionCoordinator.tsx vs DayInteractionCoordinator.tsx (217/133).

NOT DUPLICATION - divergent by design: Week's commit/*.commit.ts export pure transforms (allDayDragVisualToGridEvent, timedDragVisualToGridEvent) and let the adapter wrap the result; Day's export whole commit functions (commitAllDayDragInteraction(target, visual, visibleDate) -> CommitResult) already building {event, eventId, hadFormOpenBeforeInteraction, hasMoved, type}. Semantics: in Week a column is a DAY, in Day a column is a CALENDAR. Week all-day drag applies a day delta to startDate/endDate. Day all-day drag MUST NOT touch dates at all - it changes calendarId (explicit code comment: rewriting them to the visible date would truncate a multi-day all-day event to a single day). Day timed drag sets calendarId via columnMoveCalendarId(...) and pins the date to visibleDate.

CRITICAL RISK: TimedDragVisual.dayDate is OVERLOADED. Week: YYYY-MM-DD date. Day: a CalendarId - see day-interaction.adapter.ts ~lines 258-313 (initialColumnKey comes from columnKeys, which are calendar ids) and the documented cast in Day commit/timed.commit.ts:
  export const columnMoveCalendarId = (visual: Pick<TimedDragVisual, "dayDate" | "initialDayDate">, event: GridEvent): CalendarId | undefined => visual.dayDate !== visual.initialDayDate ? (visual.dayDate as CalendarId) : event.calendarId;
A shared engine assuming dayDate is a date will silently break Day-view cross-calendar drag and the type system will NOT catch it - both are string. Any unification must first give the column key a view-parameterised type.

ASYMMETRIC SURFACE: Week-only, no Day counterpart: adapter/interactions/{all-day.drag,all-day.resize,all-day.visible-range,timed.drag,timed.resize}.ts (Week decomposed per-interaction, Day monolithic - Week's is the better shape to unify toward); adapter/edge-navigation.ts, state/edge-navigation.state.ts, state/motion.state.ts, useWeekInteractionLayoutSync.ts; runtime hooks getVisibleDays(), onRequestWeekNavigation, rebuildLayoutAfterNavigation(), type WeekEdgeNavigableVisual. Day-only: day-event.focus.ts; runtime hooks getColumnKeys(), getVisibleDate().

SHARED ENGINE (confirmed target, needs no change): packages/web/src/interaction/interaction.engine.ts exports createInteractionEngine<TTarget, TVisual, TResult>, InteractionEngine<...>, InteractionEngineSchedulerOptions, InteractionCancellationTargets. The contract both views implement is InteractionAdapter<TTarget, TVisual, TResult> in interaction.adapter.types.ts: getTarget, getSourceElement, getSourceElementDraftEventMode?, createVisual, getDraftEventMount, updateVisual (documented MUST BE IDEMPOTENT - the engine re-invokes at pointerup before commit), commit, cancel?. The gap is that grid/interaction/ stops short of covering the adapter/commit layer. Natural move: widen grid/interaction/ (already holds event.registry, event.targeting, view-event-registry, layout.cache, adapter.helpers, math/, commit/, types/) with a view-parameterised adapter factory.

BLAST RADIUS: 19 files import views/Week/interaction, 6 import views/Day/interaction. Cross-view consumers needing care: packages/web/src/components/ContextMenu/contextMenuLayering.test.tsx (imports both), packages/web/src/__tests__/utils/state/reset-stores.ts, packages/web/src/common/utils/event/event.util.test.ts, packages/web/src/views/Forms/hooks/useCloseEventForm.test.ts. view-event-registry.ts also exports CALENDAR_VIEW_INTERACTION_ID_ATTRIBUTES and readCalendarEventIdFromElement, used by context menus and undo focus-restore to resolve an event id without knowing the view - renaming the data-${view}-interaction-event-* attribute scheme would break those.

In-scope size: 6,321 source LOC across ~60 files; 6,315 test LOC. Likely touched: ~12 source + ~14 test files. Verification: bun run test:web (86.5s); bun run type-check is a separate slow gate (three tsc passes, pinned 7.0.2).
```
### Acceptance criteria
- requirements_markdown contains all 8 required sections in order
- Invariants section uses INV-n identifiers and every entry is a testable behavioral statement
- FR-1 is the TimedDragVisual.dayDate branded/parameterized column-key type prerequisite
- Acceptance criteria reference bun run test:web (2298 baseline), bun run type-check, bun run lint
- Non-goals from the brief appear in Out of scope, including not merging commit/*.commit.ts
- No files written and no shell commands executed
### Your final message
Your final message must be a single JSON object and nothing else — no
prose before it, no summary after it, no ``` fence around it. It must
conform to this schema:

```json
{
  "type": "object",
  "properties": {
    "requirements_markdown": {
      "type": "string"
    }
  },
  "required": [
    "requirements_markdown"
  ]
}
```