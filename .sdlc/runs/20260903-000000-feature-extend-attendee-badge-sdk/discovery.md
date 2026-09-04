# Discovery — Compass Calendar

- **run_id**: `20260903-000000-feature-extend-attendee-badge-sdk`
- **mode**: `refresh` → helper decision **`incremental`**
- **built_at**: 2026-09-04T05:55:39Z
- **plugin_version**: 0.6.0 (previous baseline was written by 0.5.0)
- **intent hint**: feature-extend — *show an attendee avatar badge on grid event cards, reusing EventDetailsSection's RSVP-status styling*

## Refresh decision

`discovery-refresh.mjs` returned `incremental`: 9 files changed across 2 commits since the
baseline was built (2026-08-20 at `4189de1`, on `main`). Every delta file is inside `.sdlc/`
except `.gitignore`. **No stack manifest changed** and `.sdlc/policy.yaml` did not change.

| | baseline | now |
|---|---|---|
| git HEAD | `4189de1` | `2d81253a` |
| branch | `main` | `CMP-105/opus-plus-flash-v37-sdk` |
| age | — | 2 commits |

The caller asked for the full read order anyway (to gather feature-extend context), so all nine
groups were re-scanned; groups 3–4 were re-read and confirmed byte-equivalent to the cached values.

## Group 1 — git state

- HEAD `2d81253ab8a4c8e69b27e28d12c6ae9cc61d1bfe`
- branch `CMP-105/opus-plus-flash-v37-sdk`
- remote `origin` → `git@github.com:tl-ai-labs/compass-calendar.git`
- **dirty: yes, but only inside `.sdlc/`** — `.sdlc/pre-check-status.json` and `.sdlc/project.json`
  are modified. `packages/` and `e2e/` are clean, so the source tree is a valid rollback anchor.
- `gitignore_covers_sdlc`: **false**. The only `.sdlc` entries are
  `.sdlc/**/_gemini_worker_save/` and `.sdlc/local/debug.log`. `git check-ignore` confirms
  `.sdlc/runs/…` and `.sdlc/baseline/current.json` are **not** ignored on this branch.

## Group 2 — topology

Top-level: `.agents/ .claude/ .codex/ .cursor/ .github/ .hook-logs/ docs/ e2e/ logs/ packages/ patches/ self-host/ test-results/`
(`.hook-logs/`, `logs/`, `test-results/` are gitignored working dirs, not source.)

Entry points: `packages/web/src/index.tsx`, `packages/backend/src/app.ts`,
`packages/sync/src/app.ts`, `packages/scripts/src/cli.ts`.

## Groups 3–4 — detected stacks and test command

Single-language monorepo: **node-typescript on the Bun runtime** (`bun@1.3.14`,
`engines.node >= 24`, `typescript 7.0.2`), six manifests.

| manifest | frameworks |
|---|---|
| `package.json` (root) | react-18, tanstack-react-router, tanstack-react-query, zustand, zod, tailwind-4, express, playwright, biome |
| `packages/web/package.json` | react-18, zustand, tanstack-react-router, tiptap, dexie, zod, tailwind-4, testing-library, msw |
| `packages/backend/package.json` | express, supertokens, mongodb |
| `packages/core/package.json` | zod |
| `packages/sync/package.json` | googleapis |
| `packages/scripts/package.json` | — |

**Proposed test command: `bun run test:web`**
(source: `AGENTS.md`#Validation-defaults + `package.json`#`scripts.test:web`).
AGENTS.md says explicitly *"Avoid defaulting to `bun test`; use the focused package test first."*
This intent touches `packages/web` only. `bun test` (root) chains core+sync+web+backend+scripts
and the non-web legs need a live MongoDB. Gate 0 must confirm.
Never add `--parallel` — `.cursor/rules/web-testing.mdc` forbids it (jsdom/MSW isolation).

### Clean-tree baseline is RED

Measured on this tree at `2d81253a`:

```
2297 pass
   1 fail
   1 error
5771 expect() calls
Ran 2298 tests across 302 files. [104.68s]
error: script "test:web" exited with code 1
```

The single failing test is:

```
(fail) RecurrenceSection > keeps the event's own date selectable when the event ends after midnight
```

in `packages/web/src/views/Forms/EventForm/RecurrenceSection.test.tsx`. It is **date-rot** — the
assertion is pinned to a wall-clock date that has since passed. It is pre-existing and unrelated
to this intent: do not fix it as part of this run, and do not count it as a regression. Verified
by two independent full runs of the suite on this clean tree.

**Phase 7 must diff against 2297/1/1, not against zero failures.** Any ledger row claiming
"2298/0 green" on a clean tree is wrong.

## Group 5 — docs

`README.md`, `AGENTS.md`, `CONTRIBUTING.md`, `SECURITY.md`, `CODE_OF_CONDUCT.md`,
`docs/README.md`, plus `docs/architecture/`, `docs/frontend/`, `docs/features/`,
`docs/development/` (includes `testing-playbook.md`, which `.cursor/rules/web-testing.mdc`
tells you to read before touching test infrastructure). **No repo-root `CLAUDE.md`.**

## Group 6 — Detected AI/agent setup

Four coexisting agent toolchains:

- `.claude/settings.json`, `.claude/settings.local.json`, `.claude/launch.json`
- `.cursor/rules/` — 4 `.mdc` files: `imports-and-packages`, `sync-package`, **`web-styles`**, **`web-testing`**
- `.cursor/hooks.json`, `.cursor/hooks/format-after-edit.ts`, `.cursor/settings.json`,
  `.cursor/environment.json`, `.cursor/bootstrap-backend.sh`
- `.codex/config.toml`, `.codex/hooks.json`
- `.agents/skills/` — 9 skills (a11y-audit, chaos, google-sync-debug, handoff,
  local-dev-bootstrap, qa-test-staging, ship, simplify, verify-change)
- `.agents/skills/chaos/agents/openai.yaml` — external-model agent config
- `AGENTS.md`

Absent: `.mcp.json` (gitignored *and* not on disk), `CLAUDE.md`, `.cursorrules`,
`.aider.conf.yml`, `.continue/`, `.github/copilot-instructions.md`, `.roo/`, and — checked
repo-wide — **no `routing-policy.yaml` anywhere**, so the selected shipped policy applies.

## Group 7 — env keys (names only)

**No `.env*` files exist on disk** (and `*.env*` is a repo-wide `.gitignore` glob). Runtime
config is `compass.yaml` at repo root — gitignored, and AGENTS.md states it contains secrets —
templated by the tracked `compass.example.yaml`.

Key **names** from `compass.example.yaml` (no values read or transmitted):
`apiUrl, backend, callbackBaseUrl, compassToken, internalAuthToken, key, logLevel, mongo,
mongoUri, nodeEnv, originsAllowed, password, port, postConnectRedirectUrl, replicaSetKey,
runtime, serviceUrl, supertokens, sync, timezone, uri, url, username, version, web`

Env vars referenced in code: `API_BASEURL, COMPASS_BUILD_REF, GOOGLE_CLIENT_ID, NODE_ENV,
PORT, POSTHOG_HOST, POSTHOG_KEY, TZ`.

## Group 8 — monorepo, submodules, LFS, infra

**Monorepo**: `lerna` + bun workspaces, glob `packages/*`.

| package | root | test command |
|---|---|---|
| `@compass/web` | `packages/web` | `bun run test:web` |
| `@compass/backend` | `packages/backend` | `bun run test:backend` (needs MongoDB) |
| `@compass/core` | `packages/core` | `bun run test:core` |
| `@compass/sync` | `packages/sync` | `bun run test:sync` (needs MongoDB) |
| `@compass/scripts` | `packages/scripts` | `bun run test:scripts` (needs MongoDB) |

Aliases: `@web/*` → `packages/web/src/*`, `@core/*` → `packages/core/src/*`.

- **Submodules**: none (`.gitmodules` absent).
- **Git-LFS**: none. `.gitattributes` only sets `eol=lf` and `binary` for image/font types —
  no `filter=lfs`.
- **Encrypted secrets**: none. No SOPS / git-crypt / sealed-secrets / age / vault artifacts.
  `compass.yaml` is plaintext-but-gitignored.
- **Infra**: 11 GitHub Actions workflows; Docker assets under `.github/docker/` and `self-host/`
  (no root `Dockerfile`); no terraform / gitlab-ci / circleci / Jenkins.

## Group 9 — regulated-repo signals

Only `SECURITY.md` (a standard OSS vulnerability-disclosure policy). No HIPAA/PCI/SOC2/GDPR
files, no `compliance/` or `regulated/` paths, no security-team CODEOWNERS entries.
`regulated_repo_warning_required: false`.

---

# Feature-extend findings — attendee avatar badge

## 1. Where grid event cards are rendered

Two shared card components under `packages/web/src/grid/components/` do all the rendering:

- **`TimedEventCard.tsx`** (368 lines, `forwardRef`) — timed events
- **`AllDayEventCard.tsx`** (228 lines, `forwardRef`) — all-day events
- **`EventRepeatIcon.tsx`** (24 lines) — the existing *shared card indicator* precedent; both
  cards render it. This is the shape a badge should copy.

Call sites:

| view | file | renders |
|---|---|---|
| Week | `packages/web/src/views/Week/components/Event/Grid/GridEvent/GridEvent.tsx:134` | `TimedEventCard` |
| Week | `packages/web/src/views/Week/components/Grid/AllDayRow/AllDayEvent.tsx:64` | `AllDayEventCard` |
| Week | `packages/web/src/views/Week/components/Draft/grid/GridDraft.tsx` | draft overlay |
| Week | `packages/web/src/views/Week/components/Grid/Grid.tsx` | composes AllDayRow + MainGrid |
| Day | `packages/web/src/views/Day/components/Calendar/DayCalendarEventCards.tsx:93,180` | `AllDayEventCard`, `TimedEventCard` |
| Day | `packages/web/src/views/Day/components/Calendar/DayCalendarGrid.tsx` | Day grid container |
| shared | `packages/web/src/grid/components/EventGrid.tsx` | list-level container; resolves `calendarIdentity` once |
| shared | `packages/web/src/grid/components/TimedGrid.tsx`, `AllDayGridRow.tsx` | layer/row |

> **There is no Month view.** The views are Week, Day, and Life
> (`packages/web/src/views/Life/LifeGrid.tsx` — a life/year grid that renders no event cards).
> If the plan or ACs mention a Month view, that is a defect to raise at Gate 2.

Because both cards are shared, **one badge component wired into `TimedEventCard` +
`AllDayEventCard` covers both Week and Day** — no per-view work.

## 2. EventDetailsSection and its RSVP-status styling

`packages/web/src/views/Forms/EventForm/EventDetailsSection.tsx` (109 lines).

- **`ATTENDEE_STATUS_DOT`** (lines 12–17) — `Record<AttendeeResponseStatus, string>`:
  `accepted: "bg-success"`, `declined: "bg-error"`, `tentative: "bg-warning"`,
  `needsAction: "bg-text-subtle"`
- **`attendeeStatusLabel(status)`** (lines 19–20) — `needsAction` → `"hasn't responded"`,
  otherwise the status verbatim
- Dot markup: `<span aria-hidden title={statusText} className={`size-2.5 shrink-0 rounded-full ${ATTENDEE_STATUS_DOT[…]}`} />`
- `MAX_VISIBLE_ATTENDEES = 6`, overflow via a `+N more` button using `c-focus-ring`
- Container: `flex flex-col gap-2 rounded-md bg-surface-overlay p-3 text-text text-xs`

**A11y pattern to copy** (the file's own comment, lines 72–75, spells it out): the dot is
`aria-hidden` and its `title` is a mouse-only tooltip; the real signal is the row's
`aria-label` = `` `${name}, ${statusText}${isOrganizer ? ", organizer" : ""}` ``. Colour alone
is not an accessible signal.

**Both symbols are module-private — neither is exported.** Reuse therefore requires extracting
them into a shared module that *both* `EventDetailsSection` and the new badge import, or the
two will silently drift. That extraction edits a file covered by `EventForm.test.tsx`.

Semantic tokens live in `packages/web/src/index.css`: `--success` (#78ae88 light / #57876a dark),
`--warning` (#c2a578 / #9c7d45), `--error` (#c17e70 / #ad6553), bridged to Tailwind at lines
123–125 via `--color-success/-warning/-error`. `bun lint` runs
`packages/scripts/src/testing/check-semantic-colors.ts` **before** biome, so raw palette classes
fail lint. `packages/web/src/common/styles/theme-css.test.ts` guards the token list.

## 3. Existing attendee / avatar / badge components

**None exist in the working tree.**

- The only `*Badge*` file is `packages/web/src/components/WelcomeModal/ProductHuntBadge.tsx` —
  an unrelated marketing image link.
- There is no `Avatar` component and no `AttendeeBadge`.
- `AttendeeBadge.tsx` and `attendee-status.util.test.ts` **do** appear under
  `.git/sdlc-parking/CMP-105/...` — those are backups from prior CMP-105 runs on *other
  branches*. They are not importable and must not be assumed present.

Closest reusable precedent: **`EventRepeatIcon.tsx`** — tiny props interface, `aria-hidden`,
`pointer-events-none`, absolutely positioned bottom-right, colour derived from the card's
`bgColor`, with a JSDoc paragraph explaining why it is shared so the two cards can't drift.
Icons come from `@phosphor-icons/react` (EventDetailsSection uses `UsersIcon`); local wrappers
live in `packages/web/src/components/Icons/`.

### Data is already on the card — no plumbing needed

- `packages/core/src/types/event-attendance.contracts.ts` — `AttendeeResponseStatusSchema`
  (`needsAction | accepted | declined | tentative`), `AttendeeSchema {email, displayName|null,
  responseStatus}`, `OrganizerSchema`, `ConferenceSchema`.
- `packages/web/src/common/types/web.event.types.ts:86-88` — `organizer` / `attendees` /
  `conference` on the web Event schema, so **`GridEvent` already carries them**.
- `packages/web/src/events/queries/event.view-model.ts:92-94` — maps them onto the derived grid event.

Caveats: `attendees` is **optional and readonly**, and is `undefined` for busy-projection events
(`content.kind === "busy"`) and for Compass-native events with no guests — handle empty.
Separately, a known unticketed bug drops `conference`/`organizer`/`attendees` on any
resize/move/edit **in anonymous IndexedDB (local) mode**, so an in-app manual check in local
mode can show an empty badge after an interaction; verify with a synced account or the demo seed.

## 4. Test touchpoints

- `packages/web/src/grid/components/EventCard.test.tsx` — the existing card test file, 20+ `it`s
  across both cards. New badge tests belong here. Conventions: `bun:test`
  (`describe/it/expect/mock`), `@testing-library/react` `render`+`screen`,
  `@testing-library/jest-dom`, a local `createEvent(overrides)` factory cast `as GridEvent`, and
  a shared `position` fixture.
- `packages/web/src/views/Forms/EventForm/EventForm.test.tsx` — covers the existing RSVP dots;
  extracting `ATTENDEE_STATUS_DOT` must keep these green.
- `EventGrid.test.tsx`, `DayCalendarGrid.test.tsx`, `WeekView.render.test.tsx`,
  `common/styles/theme-css.test.ts`.

## 5. Layout constraints on the cards

- Cards are `absolute` + `overflow-hidden`. Bottom-right is already taken by `EventRepeatIcon`
  (all-day adds `pr-3.5` when it shows). `inset-y-0 left-0 w-[3px]` is the calendar accent bar.
- Invisible 4.5px resize handles sit top/bottom (timed) and left/right (all-day).
- Size gates already exist in `grid.constants.ts`: `COMPACT_EVENT_MAX_HEIGHT`,
  `MIN_EVENT_HEIGHT_FOR_TIME_LABEL`, `MIN_EVENT_WIDTH_FOR_TIME_LABEL`. A badge needs an
  analogous gate or it will overflow tiny cards.
- Known pre-existing UI bug: the `endDate` resize handle already fails `elementFromPoint` on
  ~30% of cards. A new absolutely-positioned badge must not widen that.

---

## Coexistence risks (surface verbatim at Gate 0)

- **Cursor rules detected.** You have Cursor rules at `.cursor/rules/` (4 `.mdc` files). The
  plugin will never touch them, but they encode conventions codegen must match:
  `web-styles.mdc` forbids raw Tailwind palette classes in favour of semantic tokens, and
  `web-testing.mdc` mandates RTL semantic queries, forbids implementation-detail assertions,
  and forbids adding `--parallel` to `test:web`.
- **Cursor and Codex format-on-edit hooks are active** (`.cursor/hooks.json`,
  `.codex/hooks.json`, `.cursor/hooks/format-after-edit.ts`). Files this plugin writes may be
  reformatted out-of-band by Biome after the write.
- **`.sdlc/` not gitignored.** Your `.gitignore` doesn't cover `.sdlc/` — only
  `.sdlc/**/_gemini_worker_save/` and `.sdlc/local/debug.log`. Run artifacts under `.sdlc/`
  (packets, backups, telemetry) will be untracked but visible to `git add -A`. Gate 0 will offer
  to add `.gitignore` to this run's allowlist so the plugin can add the entry as part of the run.
- **Aggressive ignore globs.** `.gitignore` contains repo-wide `*.mjs`, `*.env*`, `*.log`,
  `*.mongodb`, `*.tsbuildinfo`, plus `.mcp.json` and `compass.yaml`. Any `.mjs` the plugin
  emits into user source would be silently untracked.
- **No custom MCP servers.** `.mcp.json` is gitignored and absent locally.
- **No repo-local `routing-policy.yaml`** anywhere in the repo — the shipped/selected policy applies.
- **Per-branch run parking.** A local `post-checkout` hook parks `.sdlc/runs/` per branch under
  `.git/sdlc-parking/`. Prior CMP-105 attendee-badge runs from other branches live there and
  are not part of this working tree.

## Proposed off-limits

```
.git/**            .claude/**          .codex/**           .cursor/**
.agents/**         AGENTS.md           .mcp.json           compass.yaml
.playwright-compass.yaml               *.env*              .env    .env.*
node_modules/**    build/**            buildcache/**
packages/*/build/**                    packages/*/node_modules/**
bun.lock           patches/**
playwright-report/**   test-results/**   blob-report/**   logs/**   .hook-logs/**
.github/workflows/**
```

## Stack profile (Tier 2b)

The repo's stack (React SPA on Bun) has **no pre-authored adapter** — v1 ships only
`generic.md`, `nest.md`, `python.md` — so an adaptive stack profile is required. One already
exists at `.sdlc/baseline/stack-profile.md`, built 2026-09-03 with no manifest change since, so
it is **reused rather than rebuilt**. It is authoritative over `generic.md` on conflict.
