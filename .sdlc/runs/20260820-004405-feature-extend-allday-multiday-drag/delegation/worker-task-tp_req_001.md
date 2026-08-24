## Task tp_req_001 — requirements_analysis / delta_requirements
Module: week-allday-drag
### Working directory
You are running as an agent inside `/home/sainadh/projects/compass-calendar/compass/compass-calendar`. You may list, read,
edit and create files there, and run commands there. That directory is the
only place you can act; nothing outside it is reachable.
### Instruction
Write a DELTA requirements document for extending the Week all-day row with multi-day drag-to-select. READ FIRST, in this order: (1) .sdlc/runs/20260820-004405-feature-extend-allday-multiday-drag/intent_brief.md — authoritative scope, goal, acceptance criteria, non-goals, off-limits; (2) packages/web/src/grid/hooks/useAllDayDraftCreation.ts (current click-only creator); (3) packages/web/src/grid/hooks/useTimedDraftCreation.ts (the gesture pattern to mirror); (4) packages/web/src/views/Week/components/Grid/AllDayRow/AllDayRow.tsx and packages/web/src/views/Day/components/Calendar/DayCalendarGrid.tsx (the hook's TWO consumers). DO NOT create or modify any file — this is an analysis-only task; return the document as your final message. Write it as a DELTA: only what changes, with each requirement naming the concrete file(s) it lands in. Sections, in order: ## In scope (numbered, testable) / ## Out of scope (numbered, from the brief's non-goals) / ## Current behavior (what the click-only path does today, with file+line references) / ## Functional requirements (FR-1..FR-n, each: statement, affected file(s), observable acceptance) / ## Non-functional requirements (NFR-1..; include backwards-compatibility of the shared hook's public option and return signatures, and Day-view no-op) / ## Invariants that must not regress (numbered; include the four Gate-0 constraints) / ## Acceptance criteria (restate the brief's 10, each mapped to the FR/NFR that satisfies it) / ## Open questions for HITL (only genuine ambiguities; say None if none). No PII inventory and no role matrix — this is a client-side interaction change with no data model.
### Provided excerpts
_None supplied. Explore the working directory to find what you need._
### Acceptance criteria
- Document is markdown only, no JSON, no code fences around the whole doc
- Every FR names the concrete in-scope file(s) it lands in
- All 10 acceptance criteria from intent_brief.md are restated and each maps to at least one FR or NFR
- The four Gate-0 constraints appear as invariants: click-to-create unregressed, views/Day/** never edited, isSameDayDrag guard in useTimedDraftCreation.ts stays, no backend/sync/core/scripts changes
- Backwards compatibility of useAllDayDraftCreation's existing callers (Week AllDayRow and Day DayCalendarGrid) is stated as an explicit NFR
- No file in the repository was created or modified by this task
### Your final message
Return the deliverable itself as your final message — the file content or
the document that was asked for, not a report about producing it.