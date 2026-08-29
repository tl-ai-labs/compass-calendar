# Discovery — 20260829-122202-feature-extend-attendee-avatar-badge

**Mode:** refresh → `incremental`
**Built:** 2026-08-29T12:25:28Z · **Plugin:** 0.6.0
**Baseline carried from:** 2026-08-20T04:32:08Z @ `4189de1` (2 commits behind)

`discovery-refresh.mjs` returned `incremental`: 9 files changed since the last
baseline, and every one is under `.sdlc/` or is `.gitignore` itself. No stack
manifest changed and no new AI-config files appeared. Groups 1 (git), 6 (AI
config) and 7 (env) were re-scanned along with the gitignore-derived off-limits
list; groups 2–5 and 8 were carried forward after spot-verification (top-level
dirs, entry points and workspace membership all still resolve).

---

## Git state

| Field | Value |
|---|---|
| HEAD | `2d81253ab8a4c8e69b27e28d12c6ae9cc61d1bfe` |
| Branch | `CMP-105/opus-plus-sonnet` |
| Dirty | no — working tree fully clean |
| Remote | `origin` → `git@github.com:tl-ai-labs/compass-calendar.git` |
| Tracked files | 1590 |
| Submodules | none |
| Git-LFS | not in use |

> **Note — branch drift.** The session-start snapshot named the branch
> `CMP-105/opus-only-v5`; the actual checked-out branch is
> `CMP-105/opus-plus-sonnet`. Confirm the intended working branch at Gate 0
> before any write lands.

## Detected stacks

Bun-native TypeScript monorepo (`bun@1.3.14`, node engine `>=24`, TypeScript
`7.0.2`), managed as Lerna + Bun workspaces over `packages/*`:

| Package | Root | Frameworks |
|---|---|---|
| `@compass/web` | `packages/web` | React 18, Zustand, TanStack Router, Tiptap, Dexie, Zod, Tailwind 4, Testing Library, MSW |
| `@compass/backend` | `packages/backend` | Express, SuperTokens, MongoDB |
| `@compass/core` | `packages/core` | Zod (shared contracts) |
| `@compass/sync` | `packages/sync` | googleapis |
| `@compass/scripts` | `packages/scripts` | — |

Path aliases: `@web/*` → `packages/web/src/*`, `@core/*` → `packages/core/src/*`.

**Adapter match:** no shipped adapter fits (v1 ships generic/nest/python only).
The cached adaptive profile at `.sdlc/baseline/stack-profile.md` is reused —
no manifest changed, so it was not rebuilt.

## Test command

**Proposed: `bun test:web`** (source: `package.json#scripts.test:web`, backed by
AGENTS.md's validation defaults, which say explicitly *"Avoid defaulting to
`bun test`; use the focused package test first."*). This intent touches
`packages/web` only.

Alternatives: `bun test` (full), `bun test:core`, `bun type-check`,
`bun run type-check:web-tests`, `bun lint`, `bun run verify` (diff-aware),
`bun test:e2e`.

**Pre-existing suite state — green.** Captured this run:

```
2298 pass · 0 fail · 5775 expect() calls · 302 files · 82.87s · exit 0
```

The suite prints React `act()` warnings from `SettingsModal` and the provider
tree. These are pre-existing stderr noise, **not** failures — do not read their
presence as regression signal.

> `bun lint` also runs `packages/scripts/src/testing/check-semantic-colors.ts`,
> which rejects raw Tailwind palette classes. Any new badge styling must use
> semantic tokens or lint fails.

---

## Intent scope — attendee-avatar badge on grid event cards

### Grid event-card components

There are exactly two card components, both under `packages/web/src/grid/components/`,
and both are shared by the Week **and** Day views:

- **`packages/web/src/grid/components/TimedEventCard.tsx`** (368 lines) —
  timed events in the main grid. Exported via `forwardRef`.
- **`packages/web/src/grid/components/AllDayEventCard.tsx`** (228 lines) —
  all-day row events. Exported via `forwardRef`.

Render paths into those two cards:

| Consumer | Path |
|---|---|
| Week · timed | `packages/web/src/views/Week/components/Event/Grid/GridEvent/GridEvent.tsx:134` |
| Week · all-day | `packages/web/src/views/Week/components/Grid/AllDayRow/AllDayEvent.tsx:64` |
| Day · both | `packages/web/src/views/Day/components/Calendar/DayCalendarEventCards.tsx:93,180` |

Because Week and Day both funnel through the same two components, a badge added
to `TimedEventCard` / `AllDayEventCard` reaches every grid surface at once —
no per-view duplication needed.

Supporting files in the same dir: `EventGrid.tsx`, `TimedGrid.tsx`,
`AllDayGridRow.tsx`, `EventRepeatIcon.tsx` (a good precedent for a small
card-adornment component), `calendar-accent.util.ts`.

### EventDetailsSection and the RSVP styling

**`packages/web/src/views/Forms/EventForm/EventDetailsSection.tsx`**

The RSVP-status styling is a module-private constant at **lines 12–17**:

```tsx
const ATTENDEE_STATUS_DOT: Record<AttendeeResponseStatus, string> = {
  accepted: "bg-success",
  declined: "bg-error",
  tentative: "bg-warning",
  needsAction: "bg-text-subtle",
};
```

Applied at line 86 as `` `size-2.5 shrink-0 rounded-full ${ATTENDEE_STATUS_DOT[attendee.responseStatus]}` ``.
A sibling helper `attendeeStatusLabel` (line 19) maps `needsAction` →
`"hasn't responded"` for the accessible label, and `MAX_VISIBLE_ATTENDEES = 6`
(line 22) caps the visible list with a `+N more` disclosure.

The four semantic tokens are real Tailwind-4 theme vars defined in
`packages/web/src/index.css` (`--color-success` :123, `--color-warning` :124,
`--color-error` :125, `--color-text-subtle` :114).

> **Reuse note.** `ATTENDEE_STATUS_DOT` is not exported. Grid cards importing
> from `views/Forms/EventForm/` would be a layering inversion
> (`grid/` → `views/`). Lift the map — and probably `attendeeStatusLabel` — into
> a shared module (e.g. alongside `packages/web/src/grid/components/` or a
> `common/` styles util) and have `EventDetailsSection` import it back, so the
> two surfaces cannot drift.

### Attendee / RSVP data model

Canonical contract: **`packages/core/src/types/event-attendance.contracts.ts`**
(Zod v4, standalone to avoid a circular import):

- `AttendeeResponseStatusSchema = z.enum(["needsAction","accepted","declined","tentative"])`
  → type `AttendeeResponseStatus`
- `AttendeeSchema = z.strictObject({ email, displayName: string|null, responseStatus })`
  → type `Attendee`
- also exports `OrganizerSchema` / `Organizer` and `ConferenceSchema` / `Conference`

**The data already reaches the cards.** `GridEventSchema` in
`packages/web/src/common/types/web.event.types.ts` (definition at :47, type at :90)
extends `WebEventSchema` with:

```ts
organizer: OrganizerSchema.nullable().optional(),
attendees: z.array(AttendeeSchema).readonly().optional(),
conference: ConferenceSchema.nullable().optional(),
```

and `packages/web/src/events/queries/event.view-model.ts` (`gridEventsFrom`,
lines 92–94) projects `organizer` / `attendees` / `conference` off
`event.content` when `content.kind === "details"`.

Both `TimedEventCardProps` and `AllDayEventCardProps` take a full
`event: GridEvent`. **No type widening, view-model change, or prop-threading is
required** to read RSVP data at the card — the badge can read
`event.attendees` directly.

Caveats for codegen: `attendees` is **optional and readonly**, and is absent for
Compass-native events and for busy-projection events (`isBusy`), whose content
carries none of these fields. The badge must degrade to rendering nothing.

### Web component test structure

- Runner: **Bun's built-in test runner**, driven by
  `packages/scripts/src/testing/test-parallel.ts` with profile `web`
  (preload `packages/web/src/__tests__/web.preload.ts`, scan `./packages/web/src`).
  The web profile deliberately runs **sequentially** — `--parallel` is omitted
  for `web` only (`test-parallel.ts:90`), and `web-testing.mdc` says not to add
  it without resolving the jsdom/MSW isolation constraints.
- `packages/web/bunfig.toml` sets `preload = ["./src/__tests__/web.preload.ts"]`,
  `root = "./src"`.
- Harness: `packages/web/src/__tests__/setup/` (`jsdom-env.ts`,
  `browser-polyfills.ts`, `indexeddb-env.ts`, `asset-stubs.plugin.ts`,
  `test-lifecycle.ts`) plus shared render helpers in
  `packages/web/src/__tests__/__mocks__/mock.render.tsx`.
- Tests are **colocated** as `*.test.tsx` next to the component.
- **The card test to extend already exists:**
  `packages/web/src/grid/components/EventCard.test.tsx`. It imports
  `{ fireEvent, render, screen }` from `@testing-library/react`, uses
  `{ afterEach, describe, expect, it, mock }` from `bun:test`, pulls in
  `@testing-library/jest-dom`, and exercises **both** `AllDayEventCard` and
  `TimedEventCard` from one file via a local
  `createEvent = (overrides: Partial<GridEvent> = {}): GridEvent` factory and a
  shared `position` object. Adding `attendees` overrides to that factory is the
  natural extension point.
- Conventions (`.cursor/rules/web-testing.mdc`): RTL + `user-event` +
  semantic queries (`getByRole`), no implementation-detail assertions, prefer
  shared harnesses over broad module mocks, restore globals/timers/spies in
  teardown. Read `docs/development/testing-playbook.md` before touching test
  infrastructure.

---

## Detected AI/agent setup

`.claude/settings.json`, `.claude/settings.local.json`, `.cursor/rules/` (4 `.mdc`
files), `.cursor/hooks.json`, `.cursor/hooks/format-after-edit.ts`,
`.codex/config.toml`, `.codex/hooks.json`, `.agents/skills/` (9 skills),
`.agents/skills/chaos/agents/openai.yaml`, `AGENTS.md`.

Absent: `CLAUDE.md`, `CLAUDE.local.md`, `.mcp.json` (gitignored + not on disk),
`.cursorrules`, `.aider.conf.yml`, `.continue/`,
`.github/copilot-instructions.md`, `.roo/`, `routing-policy.yaml`.

**No change since the 2026-08-20 baseline.**

## Coexistence risks

- **Cursor rules detected.** You have Cursor rules at `.cursor/rules/`. The
  plugin will never touch them, but `web-styles.mdc` and `web-testing.mdc` both
  glob `packages/web/**` — exactly this run's scope — so they encode the
  conventions codegen must match.
- **Cursor and Codex format-on-edit hooks are active**
  (`.cursor/hooks.json`, `.codex/hooks.json`, `.cursor/hooks/format-after-edit.ts`).
  AGENTS.md states formatting is handled by these repo-local hooks after agent
  edits. Files this plugin writes may be reformatted out-of-band by Biome.
- **`.sdlc/` not gitignored.** Your `.gitignore` doesn't cover `.sdlc/` — only
  `.sdlc/**/_gemini_worker_save/` and `.sdlc/local/debug.log`. As of commit
  `2d81253a` the `.sdlc/` tree is *tracked*, and `.sdlc/runs/**` is **not**
  ignored on this branch. Run artifacts (packets, `changes.md`, `backups/<file>`
  echoes of touched source) will be visible to `git add -A`. Gate 0 can offer to
  add `.gitignore` to this run's allowlist if you want the entry added.
- **Aggressive ignore globs.** `.gitignore` carries repo-wide `*.mjs` and
  `*.env*` rules. Verified: `foo.mjs` and `packages/web/src/x.env.ts` both match.
  Any file the plugin emits into user source with those name shapes would be
  silently untracked.
- **No competing MCP servers.** `.mcp.json` is gitignored and absent locally.
- **No repo-local `routing-policy.yaml`** — the shipped policy applies.

## Regulated-repo signals

One low-signal hit: `SECURITY.md` at repo root (a standard OSS vulnerability
disclosure policy, not a compliance regime). No HIPAA/PCI/SOC2/GDPR markers, no
`compliance/` or `regulated/` paths, no security/compliance CODEOWNERS entries.
`regulated_repo_warning_required: false` — no Gate 0 warning needed.

## Proposed off-limits

```
.git/**                      .claude/**                 .codex/**
.cursor/**                   .agents/**                 AGENTS.md
.mcp.json                    compass.yaml               .playwright-compass.yaml
*.env*  .env  .env.*         node_modules/**            build/**
buildcache/**                logs/**                    .hook-logs/**
packages/*/build/**          packages/*/node_modules/** bun.lock
patches/**                   playwright-report/**       test-results/**
blob-report/**               .github/workflows/**
```

## Environment keys

No `.env*` files exist on disk — config flows through `compass.yaml` (gitignored)
with `compass.example.yaml` as the tracked template. Env names referenced in
source (names only, never values): `API_BASEURL`, `COMPASS_BUILD_REF`,
`GOOGLE_CLIENT_ID`, `NODE_ENV`, `PORT`, `POSTHOG_HOST`, `POSTHOG_KEY`, `TZ`.

## Repo-state risks

| Risk | Severity | Detail |
|---|---|---|
| `.sdlc/` not ignored | medium | Tracked tree; `git add -A` stages run artifacts incl. source backups |
| Aggressive gitignore | medium | Repo-wide `*.mjs`, `*.env*` |
| External format hooks | low | Cursor/Codex may rewrite plugin output |
| Branch mismatch | low | Snapshot said `opus-only-v5`, actual `opus-plus-sonnet` |
| Git-LFS | none | Not in use |
| Submodules | none | No `.gitmodules` |
| Dirty tree | none | Clean at scan time |
| Failing pre-existing tests | none | `bun test:web` 2298 pass / 0 fail |
