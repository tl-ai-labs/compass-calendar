# Intent Brief — docs — Weekly view interactions README section

## Context

Compass Calendar is a Bun-run TypeScript monorepo (lerna + bun workspaces over `packages/*`);
the weekly view lives in `packages/web`. The root `README.md` is user-facing: it opens with a
pitch, then a short `## Features` list written in second person with no file paths, then tech
stack and getting-started tables.

The weekly view has grown three interaction behaviours that the README never mentions:
multi-day selection in the all-day row, recurring-event display, and per-calendar event
colouring. All three have real implementations on this branch — `useAllDayDraftCreation.ts`,
`EventRepeatIcon.tsx`, and `calendar-accent.util.ts` / `allDayColumnTint.util.ts` respectively.

This is the fourth run of ticket CMP-102 under a different model policy each time
(`opus-plus-flash-v37`, `flash-agsdk-only`, `opus-only-v5`, now `opus-plus-sonnet`), so the
run is also a policy comparison. Prior runs landed 6–8 line sections in commits `c7fa74bb`,
`d93303a0`, `f2fb36c9` — each on its own branch, none merged to main.

## Goal

Add a `## Weekly view interactions` section to the root `README.md` documenting multi-day
select, recurring events, and event colors, in the README's existing end-user voice.

## Task type

doc_update

## Files in scope

- `README.md` — the only file this run may write.

Read-only for grounding (the section must describe what these actually do, not what the
ticket assumes):

- `packages/web/src/grid/hooks/useAllDayDraftCreation.ts`
- `packages/web/src/grid/components/AllDayGridRow.tsx`, `AllDayEventCard.tsx`
- `packages/web/src/grid/utils/allDayEventOnDay.util.ts`, `allDayColumnTint.util.ts`
- `packages/web/src/grid/components/EventRepeatIcon.tsx`, `calendar-accent.util.ts`
- `packages/sync/src/domain/series-exception.ts`, `event-instance-assembly.test.ts`
- `docs/frontend/week-drag-interaction.md` — nearest doc neighbour, for terminology only

## Files off-limits

Project defaults from `.sdlc/project.json.off_limits_default`:
`.env`, `.env.*`, `.mcp.json`, `.cursor/rules/**`, `.claude/settings.local.json`,
`node_modules/**`, `dist/**`, `build/**`, `.next/**`, `.sdlc/**`, `.git/**`

Competing AI toolchains detected by discovery — off-limits by default, none moved into scope
at Gate 0: `.claude/**`, `.cursor/**`, `.codex/**`, `.agents/**`, `AGENTS.md`

Also off-limits for this run:
- All of `packages/**` — this is a docs-only change; no source edits.
- `docs/**` — the audience decision put the content in the README, not a new doc page.
- `.gitignore` — two prior CMP-102 runs quietly appended a line to it. Not wanted here;
  main already carries the SDLC ignore rules as of `44db7f45`.

## Acceptance criteria

1. `README.md` gains exactly one new `## Weekly view interactions` section; no existing line
   is reworded or reordered.
2. The section covers all three subjects: multi-day select, recurring events, event colors.
3. Every behavioural claim is traceable to code on this branch. Anything the code does not
   actually do is omitted rather than softened.
4. Voice and formatting match the existing README — second person, bulleted, no file paths,
   no component names, no mermaid.
5. Placed adjacent to `## Features` (which it extends), not appended at the end of the file.
6. Keyboard shortcuts, if mentioned, use the README's existing backtick-key convention
   (`SHIFT` + `↑` `↓` `←` `→`).

## Non-goals

- No new file under `docs/`. Considered and declined at the interview.
- No source changes, no tests, no screenshots.
- Not documenting the unmerged CMP-101 all-day multi-day drag work — `all-day.create.ts` is
  absent from this branch, so that behaviour must not be described.
- Not fixing the README's existing typos (`existance`, `absense`, "Cool things you can do
  with in Compass") — out of scope, flag in the final report instead.

## Validation

Test command of record: `bun lint`. Recorded with a caveat confirmed at Gate 0 — it validates
nothing about this change. The repo has no markdown linter (no markdownlint, remark, vale, or
prettier for `.md`; Biome does not lint markdown), and `bun test:web` says nothing about
`README.md`. The real gate is human review at Gate 4, plus a diff check that no file other
than `README.md` was written.

## Gate 0 record

- Approved: 2026-08-25T09:02Z (reply: `approved`)
- Policy: `opus-plus-sonnet` (project default, no per-run override)
- Auth mode: `estimated` — both tiers via the `claude-cli` adapter, no vendor API key
- Branch: `CMP-102/opus-plus-sonnet`, at `c3c59a36`
- AI-coexistence answer: all detected configs left OFF-LIMITS
- `.gitignore` blanket `.sdlc/` rule: declined by design — `c3c59a36` tracks the
  project-level `.sdlc/` layer on main deliberately
