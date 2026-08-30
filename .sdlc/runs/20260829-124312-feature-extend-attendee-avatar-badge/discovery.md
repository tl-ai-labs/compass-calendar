# Discovery — run 20260829-124312-feature-extend-attendee-avatar-badge

**Mode:** refresh → **`cached`**
**Scanned:** 2026-08-29 · **Plugin:** 0.6.0 · **Intent:** feature-extend

`discovery-refresh.mjs` returned **cached**: git HEAD is unchanged at
`2d81253a` (0 commits behind the living baseline, which was built ~18 minutes
earlier at the same HEAD) and no stack manifest mtime moved. Per the refresh
contract, no re-scan was performed — the living baseline was copied forward as
this run's snapshot.

**The baseline is still valid.** I did not take that on trust: I independently
re-read the load-bearing facts (see Spot verification below). Two fields had
drifted, both metadata-only, neither material to scope.

---

## 1 · Git state

| | |
|---|---|
| HEAD | `2d81253ab8a4c8e69b27e28d12c6ae9cc61d1bfe` |
| Branch | `CMP-105/opus-plus-flash-v37` |
| Remote | `origin` → `git@github.com:tl-ai-labs/compass-calendar.git` |
| Dirty | **yes — but entirely under `.sdlc/`** |
| `.gitignore` covers `.sdlc/` | **no** |

Dirty paths, all plugin-owned and expected:

```
 M .sdlc/CLAUDE-SDLC.md          M .sdlc/ledger.md
 M .sdlc/baseline/current.json   M .sdlc/pre-check-status.json
 M .sdlc/baseline/discovery.md   M .sdlc/project.json
 M .sdlc/ledger.json            ?? .sdlc/local/
```

**No user source is modified.** `git status --short -- packages/ e2e/ docs/` is
empty, so `2d81253a` is a clean rollback anchor for everything the write
contract will touch.

> **Drift vs living baseline.** The baseline recorded branch
> `CMP-105/opus-plus-sonnet` and a clean tree. The actual branch is
> `CMP-105/opus-plus-flash-v37` — same HEAD, identical tree, so this is a
> sibling branch cut from the same commit, not a content difference. Both fields
> have been corrected in `.sdlc/baseline/current.json`.

---

## 2 · Spot verification — what I re-checked

Confirmed unchanged from the cached record:

- **Stacks** — root `package.json` still `bun@1.3.14`, `workspaces: ["packages/*"]`;
  `lerna.json` still `packages/*` + `useWorkspaces`; all five workspace
  manifests present. TypeScript 7.0.2, React 18, Tailwind 4, Biome.
- **Test commands** — every script the baseline names still resolves identically
  (`test:web`, `test:core`, `test:backend`, `test:sync`, `test:scripts`,
  `type-check`, `type-check:web-tests`, `lint`, `verify`, `test:e2e`).
- **Monorepo** — `@compass/{web,backend,core,sync,scripts}` under `packages/*`;
  `@web/*` and `@core/*` aliases still resolve.
- **Submodules** — no `.gitmodules`. **None.**
- **Git-LFS** — `.gitattributes` carries no `filter=lfs`/`diff=lfs`/`merge=lfs`. **Off.**
- **Competing AI configs** — `.claude/`, `.cursor/`, `.codex/`, `.agents/`,
  `AGENTS.md` all present and unchanged. Still **absent**: `.mcp.json`,
  `CLAUDE.md`, `.cursorrules`, `.continue/`, `.roo/`,
  `.github/copilot-instructions.md`. **No repo-local `routing-policy.yaml`**
  at any depth ≤ 3 — the shipped policy applies.
- **Gitignore shape** — `git check-ignore` confirms `.sdlc/runs/`,
  `.sdlc/local/` and `.sdlc/baseline/` are **not** ignored on this branch;
  only `.sdlc/**/_gemini_worker_save/` and `.sdlc/local/debug.log` are.
  The repo-wide `*.env*`, `*.mjs`, `*.log`, `*.tsbuildinfo` globs are still in
  force.
- **Semantic-color guard** — still the first half of `bun lint`, still exits 1 on
  any raw Tailwind palette class under `packages/web/src`.

Drift found: **branch name** and **dirty flag** only (both above). Nothing that
changes stacks, test strategy, off-limits, or scope.

---

## 3 · Detected stacks (carried forward)

Bun `1.3.14` monorepo, TypeScript 7.0.2, five workspaces under `packages/*`
wired by Lerna + Bun workspaces. Web is React 18 + TanStack Router/Query +
Zustand + Zod + Tailwind 4, tested with Bun's runner via a custom
`test-parallel.ts` harness. Backend is Express + SuperTokens + MongoDB.

No shipped adapter matches (v1 ships `generic`, `nest`, `python`), so the
adaptive stack profile at `.sdlc/baseline/stack-profile.md` is authoritative for
codegen. It was built 2026-08-26 and is **reused, not rebuilt** — no stack
manifest has changed since.

---

## 4 · Test command

**`bun test:web`** → `bun packages/scripts/src/testing/test-parallel.ts web --`
Source: `package.json#scripts.test:web`, corroborated by `AGENTS.md`.

`AGENTS.md` is explicit: *"Avoid defaulting to `bun test`; use the focused
package test first."* This intent touches `packages/web` only, so the scoped
command is correct. Last captured baseline (18 min ago, same HEAD):
**2298 pass / 0 fail** across 302 files, ~83s, exit 0.

> **Suite noise:** React `act()` warnings from `SettingsModal` and provider trees
> are pre-existing stderr, not failures. Do not read them as regression.

Secondary gates for this change: **`bun lint`** (semantic-color guard — see
constraints) and **`bun run type-check:web-tests`**.

---

## 5 · Task-relevant file pointers

> Intent: *show an attendee avatar badge on grid event cards, reusing
> `EventDetailsSection`'s RSVP-status styling.*

### The grid event cards

| File | Lines | Role |
|---|---|---|
| `packages/web/src/grid/components/TimedEventCard.tsx` | 368 | Timed events. Renders title + time label + `EventRepeatIcon`. |
| `packages/web/src/grid/components/AllDayEventCard.tsx` | 228 | All-day / multi-day row. Same title + repeat-icon shape. |
| `packages/web/src/grid/components/EventCard.test.tsx` | 575 | **Existing shared test file for both cards** — extend here. |

There is no file literally named `EventCard.tsx`; the two card components above are
what `EventCard.test.tsx` covers.
`packages/web/src/views/Day/components/Calendar/DayCalendarEventCards.tsx` is a
day-view consumer, not a third card.

### The RSVP-status styling to reuse

`packages/web/src/views/Forms/EventForm/EventDetailsSection.tsx` (109 lines).

Lines 12–20 hold the whole thing:

```tsx
const ATTENDEE_STATUS_DOT: Record<AttendeeResponseStatus, string> = {
  accepted: "bg-success",
  declined: "bg-error",
  tentative: "bg-warning",
  needsAction: "bg-text-subtle",
};

const attendeeStatusLabel = (status: AttendeeResponseStatus): string =>
  status === "needsAction" ? "hasn't responded" : status;
```

Applied at line 86 as
`size-2.5 shrink-0 rounded-full ${ATTENDEE_STATUS_DOT[attendee.responseStatus]}`.
It is currently **module-private** — reusing it on grid cards requires
extracting it to a shared module first. The component also caps the list at
`MAX_VISIBLE_ATTENDEES = 6` with a "+N more" affordance, a useful precedent for
the badge's overflow behaviour.

### The event / attendee data shape

`packages/core/src/types/event-attendance.contracts.ts` — Zod `strictObject`s:

```ts
AttendeeResponseStatus = "needsAction" | "accepted" | "declined" | "tentative"
Attendee  = { email: string(1..320), displayName: string(1..256) | null,
              responseStatus: AttendeeResponseStatus }
Organizer = { email, displayName: string | null }
```

`strictObject` — do not widen the contract; derive display data (initials,
avatar seed) in the web layer.

**Key finding — no data plumbing needed.**
`packages/web/src/common/types/web.event.types.ts` lines 86–88 show `GridEvent`
**already carries** `organizer` and `attendees`:

```ts
organizer: OrganizerSchema.nullable().optional(),
attendees: z.array(AttendeeSchema).readonly().optional(),
```

and `packages/web/src/events/queries/event.view-model.ts` (lines 92–93) already
maps them through. The badge can read `event.attendees` directly — no type
widening, no query change, no adapter change.

Demo fixtures live in
`packages/web/src/common/storage/migrations/external/demo-data-seed.ts`.

### Constraints that will bite

1. **Semantic colors only.** `bun lint` runs
   `packages/scripts/src/testing/check-semantic-colors.ts` *before* Biome and
   exits 1 on any raw Tailwind palette class (`bg-blue-300`, `text-zinc-900`,
   `--color-red-500`, `darkBlue-*`) anywhere under `packages/web/src`. Use
   `bg-success` / `bg-error` / `bg-warning` / `bg-text-subtle`, declared in
   `packages/web/src/index.css` lines 114–125.
2. **Space gating.** `TimedEventCard` already gates its repeat icon on
   `REPEAT_ICON_MIN_DURATION_MINUTES = 15` and `REPEAT_ICON_MIN_WIDTH = 40`. A
   badge on a 15-minute card needs equivalent gating.
3. **Truncation reservation.** `AllDayEventCard` adds `pr-3.5` when the repeat
   icon shows, so the title truncates before overlapping it. A badge must join
   that reservation logic.
4. **Cursor rules apply to these globs.** `.cursor/rules/web-styles.mdc`
   (`packages/web/**/*.{tsx,css}`) and `web-testing.mdc` restate these
   conventions. Untouched by the plugin, but codegen must match them.

### Prior art on a sibling branch — read this before planning

Commit `c96863ec` *"feat(web): attendee avatar badge on grid event cards"*
implements this exact feature — but it is **not an ancestor of HEAD**. This
branch was cut from `main` at `2d81253a`, one commit earlier. Verified absent
at HEAD: no `EventAttendeeBadge.tsx`, no `attendee-status.styles.ts`, no file
matching `*avatar*` anywhere under `packages/web/src`.

This is a **policy-comparison re-run**: the same ticket implemented under a
different routing policy. Its 10-file shape is a useful sanity check on scope
(shared style module + badge component + both cards + shared test file + demo
seed), but **Gate 0 should confirm a clean re-implementation is intended rather
than a cherry-pick.**

---

## 6 · Coexistence risks

- **Cursor rules** at `.cursor/rules/` (4 `.mdc` files). Never touched by the
  plugin, but `web-styles.mdc` and `web-testing.mdc` both glob
  `packages/web/**` — they encode the conventions codegen must match.
- **Two format-on-edit hook systems are live** — `.cursor/hooks.json` +
  `.cursor/hooks/format-after-edit.ts` and `.codex/hooks.json`. Files this
  plugin writes may be reformatted out-of-band by Biome. Expect post-write diffs
  that aren't ours.
- **`.sdlc/` is not gitignored and IS tracked.** As of `2d81253a` the `.sdlc/`
  tree is committed, and `.sdlc/runs/**` is not ignored on this branch. Run
  artifacts — `packets.json`, `changes.md`, and `backups/<file>` which echo
  source content — will appear as new files in a tracked directory and are
  picked up by `git add -A`. Gate 0 should decide whether to add a
  `.sdlc/runs/` ignore entry (which requires `.gitignore` on the allowlist).
- **Aggressive repo-wide ignore globs.** `*.env*` and `*.mjs` are ignored
  everywhere. Any `.mjs` the plugin emits into user source, or any file whose
  name contains `.env`, would be silently untracked.
- **No MCP servers.** `.mcp.json` is gitignored and absent locally.
- **No repo-local `routing-policy.yaml`** — the shipped policy applies unchanged.

---

## 7 · Regulated-repo signals

One weak signal: `SECURITY.md` at repo root (a standard OSS vulnerability-
disclosure file). No `HIPAA`/`PCI`/`SOC2`/`GDPR` documents, no
compliance-team CODEOWNERS entries. **`regulated_repo_warning_required: false`** —
no Gate 0 warning needed.

---

## 8 · Proposed off-limits

Unchanged from the living baseline (26 entries):

```
.git/**            .claude/**         .codex/**          .cursor/**
.agents/**         AGENTS.md          .mcp.json          compass.yaml
.playwright-compass.yaml              *.env*             .env
.env.*             node_modules/**    build/**           buildcache/**
logs/**            .hook-logs/**      packages/*/build/**
packages/*/node_modules/**            bun.lock           patches/**
playwright-report/**                  test-results/**    blob-report/**
.github/workflows/**
```

Expected in-scope for this intent: `packages/web/src/grid/components/**`,
`packages/web/src/common/styles/**`,
`packages/web/src/views/Forms/EventForm/EventDetailsSection.tsx`, and
`packages/web/src/common/storage/migrations/external/demo-data-seed.ts`.
`packages/core/**` should stay read-only — the attendee contract needs no change.

---

*Cached refresh. Scan wall time well under the 30s Tier-1 budget.*
