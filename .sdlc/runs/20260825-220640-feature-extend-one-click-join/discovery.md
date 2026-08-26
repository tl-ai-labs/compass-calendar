# Discovery — 20260825-220640-feature-extend-one-click-join

- **Mode:** refresh → `incremental`
- **Baseline:** built 2026-08-20T04:32:08Z at `4189de1`; 2 commits behind
- **Current HEAD:** `2d81253a` on `CMP-103/opus-plus-sonnet`
- **Intent:** feature-extend — "add a one-click join icon to TimedEventCard and AllDayEventCard for events with a conference link"
- **Refresh decision reason:** 9 files changed since baseline, all under `.sdlc/**` plus `.gitignore`. **No stack manifest changed**, `.sdlc/policy.yaml` unchanged.
- **Groups re-scanned:** 1 (git), 6 (AI config), 7 (env), 8 (monorepo/submodules/LFS)
- **Groups carried forward:** 2 (topology), 3 (stacks), 4 (test commands), 5 (docs), 9 (regulated signals)

---

## 1. Git state

| field | value |
|---|---|
| head | `2d81253ab8a4c8e69b27e28d12c6ae9cc61d1bfe` |
| branch | `CMP-103/opus-plus-sonnet` |
| dirty | **yes** — 1 tracked modification |
| remotes | `origin` → `git@github.com:tl-ai-labs/compass-calendar.git` |
| gitignore covers `.sdlc/` | **no** (only `.sdlc/**/_gemini_worker_save/` and `.sdlc/local/debug.log`) |
| `.sdlc/` tracked in git | **yes** — 8 files, deliberately committed at `2d81253a` |

Dirty file: `.claude/settings.json` (+11 lines) — the manually registered mmo
write-contract `PreToolUse` hook. Pre-existing, unrelated to this intent, and
inside off-limits. **Do not stage or revert it.**

Branch note: the branch is `CMP-103/opus-plus-sonnet` but the run id and intent
describe one-click-join work. Gate 0 should confirm whether a fresh
`CMP-<ticket>/opus-plus-sonnet` branch should be cut first.

## 2–5. Topology, stacks, test commands, docs

Unchanged from baseline (no manifest deltas). Bun 1.3.14 / TypeScript 7.0.2
monorepo, `lerna` + bun workspaces over `packages/*`:
`@compass/web`, `@compass/backend`, `@compass/core`, `@compass/sync`,
`@compass/scripts`. React 18 + Tailwind 4 + Zustand + zod/v4 on the web side.

**Proposed test command:** `bun test:web`
(source: `package.json#scripts.test:web` → `packages/scripts/src/testing/test-parallel.ts`).
`AGENTS.md` explicitly says "Avoid defaulting to `bun test`; use the focused
package test first." Gate 0 confirms.

**Pre-existing test state — GREEN.** Focused probe from `packages/web`:

```
bun test src/grid/components/EventCard.test.tsx \
         src/grid/components/AllDayGridRow.test.tsx \
         src/calendars/calendarCardIdentity.test.tsx
→ 30 pass, 0 fail, 78 expect() calls, 6.33s
```

Only noise is pre-existing React `not wrapped in act(...)` warnings originating
from `TimedEventCardBase` and `AllDayEventCardBase` (the `useEdgeFocusStore`
subscription). Not failures; do not "fix" them as part of this run.

---

## Intent deep-dive

### A. Current shape of the two cards

Both live in `packages/web/src/grid/components/` and are **siblings, not a
base/derived pair.** There is no shared wrapper component. The only shared code
is two small utilities:

- `calendar-accent.util.ts` — `calendarAccentStyle`, `calendarAccentAccessibleSuffix`, `eventEdgeFocusShadow`, `eventFocusColor`, `eventFocusOutlineClass`
- `EventRepeatIcon.tsx` — the shared recurrence glyph (docstring at :8-14 explicitly says "Keeping it in one place stops the two cards from drifting apart")

Both follow the same shape: a `…Base` function component wrapped in
`forwardRef`, exported as the bare name.

**`TimedEventCard.tsx` (369 lines)**

- Props interface `TimedEventCardProps` at :60-83 — `boxShadow`, `calendarIdentity`, `displayMode: "draft" | "placeholder" | "saved"`, `event: GridEvent`, `focusColor`, `interactionAttributes`, `isSelected`, `motionMode: "dragging" | "idle" | "resizing"`, `onBlur`, `onEventKeyDown`, `onEventMouseDown`, `onFocus`, `onMouseEnter`, `onMouseLeave`, `onScalerMouseDown`, `position`. Interface is **not exported**.
- `TimedEventCardBase` at :85; `export const TimedEventCard = forwardRef(TimedEventCardBase)` at :368.
- Renders a single `<div role="button" tabIndex={0}>` at :272-313 (with a `biome-ignore lint/a11y/useSemanticElements` at :271).
- Existing handlers on that div: `onBlur` :288, `onFocus` :289, `onKeyDown` :290-302 (Enter/Space → `preventDefault` + `stopPropagation` + `onEventKeyDown(event)`), `onMouseDown` :303-310 (delegates to `onEventMouseDown`, or `stopPropagation` when absent), `onMouseEnter` :311, `onMouseLeave` :312. **No `onClick` anywhere** — the card is mouse-down driven.
- Children: optional calendar accent bar :314-320; content wrapper :321-325 carrying `EVENT_CONTENT_ATTRIBUTE`; title `<span>` :326; for non-all-day, the time label :329-337 and two absolutely-positioned resize handles :338-359 (each `stopPropagation`s on mousedown); `{showRepeatIcon && <EventRepeatIcon baseColor={bgColor} />}` at :363.
- `showRepeatIcon` gate at :116-120: `isRecurring && !isPlaceholder && durationMinutes >= 15 && position.width >= 40`.
- Accessible label assembled at :246-268 and set as `aria-label` :274.

**`AllDayEventCard.tsx` (229 lines)**

- Props interface `AllDayEventCardProps` at :34-52 — **is exported**. Smaller set: `calendarIdentity`, `event: GridEvent`, `focusColor`, `interactionAttributes`, `isPlaceholder: boolean` (a plain boolean, not the timed card's `displayMode` union), `onEventKeyDown`, `onEventMouseDown`, `onMouseEnter`, `onMouseLeave`, `onScalerMouseDown`, `position`. **No `boxShadow`, no `isSelected`, no `motionMode`, no `onFocus`/`onBlur`.**
- Note the **argument order differs**: timed is `onEventMouseDown(event, e)` (:73), all-day is `onEventMouseDown(e, event)` (:43).
- `AllDayEventCardBase` at :54; `export const AllDayEventCard = forwardRef(AllDayEventCardBase)` at :228.
- Single `<div role="button" tabIndex={0}>` at :145-179. Handlers: `onKeyDown` :162-170, `onMouseDown` :171-176 (**always** `stopPropagation`s — comment at :172-173 explains it must not let the all-day row's create-draft handler overwrite a card click), `onMouseEnter` :177, `onMouseLeave` :178. Again **no `onClick`**.
- Children: accent bar :180-186; a single-row flex title container :187-200 that applies `pr-3.5` **only when `showRepeatIcon`** (:189-191, comment: "Reserve room so a long title truncates before the bottom-right icon"); `{showRepeatIcon && <EventRepeatIcon …/>}` :201; two resize handles :202-223.
- `showRepeatIcon` gate at :76-77: `isRecurring && !isPlaceholder && position.width >= 60` (60, vs the timed card's 40).

**Call sites** (both receive the whole `GridEvent` object, nothing stripped):

- `packages/web/src/views/Week/components/Event/Grid/GridEvent/GridEvent.tsx:134-149` → `<TimedEventCard … event={event} />`, memoized at :154
- `packages/web/src/views/Week/components/Grid/AllDayRow/AllDayEvent.tsx:64-75` → `<AllDayEventCard … event={event} />`, memoized at :81
- `packages/web/src/views/Day/components/Calendar/DayCalendarEventCards.tsx:93` (all-day) and `:180` (timed) — **the Day view is a second consumer; changes hit both views.**
- `packages/web/src/views/Week/components/Draft/grid/GridDraft.tsx:123` — comment notes drafts pass no handlers, so "TimedEventCard swallows clicks".

### B. Conference field end-to-end — **plumbing is COMPLETE**

This was the flagged risk. It is **not** a problem: `Schema_GridEvent` (here named
`GridEventSchema`) does carry `conference`, and the view-model populates it.

| layer | file:line | shape |
|---|---|---|
| schema def | `packages/core/src/types/event-attendance.contracts.ts:31-35` | `ConferenceSchema = z.strictObject({ url: z.url(), label: z.string().trim().min(1).max(256).nullable() })` |
| app contract | `packages/core/src/types/event.contracts.ts:30` | `EventContentSchema` `"details"` branch: `conference: ConferenceSchema.nullable().optional()` |
| sync contract | `packages/core/src/types/sync/event.contracts.ts:86` (`SyncEventContentSchema`), `:186` (`SyncInstanceContentSchema`) | `conference: ConferenceSchema.nullable()` (required-but-nullable on both) |
| backend translation | `packages/backend/src/common/services/sync-service/event-list.translation.ts:13` | `conference: content.conference` |
| **web grid type** | `packages/web/src/common/types/web.event.types.ts:88` | `conference: ConferenceSchema.nullable().optional()` inside `GridEventSchema` |
| **web mapping** | `packages/web/src/events/queries/event.view-model.ts:94` | `conference: details?.conference` in `eventToGridEvent` (alongside `location`/`organizer`/`attendees` at :91-93) |
| card props | `GridEvent.tsx:139`, `AllDayEvent.tsx:66` | whole `GridEvent` passed through |

Independent confirmation that the data really arrives: the demo seed at
`packages/web/src/common/storage/migrations/external/demo-data-seed.ts:144-147`
plants a real `{ url: "https://meet.google.com/abc-defg-hij", label: "Google Meet" }`,
and two existing UI surfaces already render off it —
`packages/web/src/views/Forms/EventForm/EventDetailsSection.tsx:46-56` and
`packages/web/src/components/Sidebar/UpNextCard/UpNextCard.tsx:87-97`.

**Verdict: no plumbing step required. `event.conference?.url` is available inside
both card bodies today.**

**One real caveat (write path, not read path).**
`packages/web/src/events/grid-event-draft.adapter.ts:592-600` — `editableContent()`
picks only `title`/`description`/`location`/`color`. The comment at :583-591 states
that `organizer`/`attendees`/`conference`/`colorHex` are read-side-only and a spread
would fail the strict write contract. Consequence: a **draft or placeholder** card
round-tripped through the draft adapter will have `conference === undefined`.
Gate the join icon on saved state (`displayMode === "saved"` / `!isPlaceholder`),
exactly like the existing `showRepeatIcon` gates. Also see
`useEventMutations.ts:218` and `useUndoRedo.ts:138` for the same read-only framing.

### C. Icon conventions in `packages/web`

- **Library:** `@phosphor-icons/react` `^2.1.7` (`packages/web/package.json:11`). 28 direct import sites; it is the only icon library in the package.
- **Default size** comes from `IconContext.Provider value={{ size: 25 }}` in `packages/web/src/components/IconProvider/IconProvider.tsx`. Grid cards always override explicitly.
- **Wrapper convention:** `packages/web/src/components/Icons/*.tsx` (`Repeat.tsx`, `ChevronLeftIcon.tsx`, `ChevronRightIcon.tsx`, `CircleIcon.tsx`, `Sidebar.tsx`) re-export a Phosphor icon through `getInteractiveIconClassName` (`packages/web/src/components/Icons/icon.utils.ts:3-6`), which prepends the `c-icon` class. Example: `Repeat.tsx` wraps `RepeatIcon as PhosphorRepeatIcon`.
- **Card precedent:** `packages/web/src/grid/components/EventRepeatIcon.tsx:15-23` —
  `size={10}`, `weight="bold"`, `color={darken(baseColor, 30)}`,
  `className="pointer-events-none absolute right-1 bottom-0.5"`, `aria-hidden="true"`,
  with the state announced via the card's `aria-label` instead of the glyph.
- **Join precedent:** `packages/web/src/components/Sidebar/UpNextCard/UpNextCard.tsx:87-97` —
  `<a href={upNext.conference.url} target="_blank" rel="noopener noreferrer" className="c-focus-ring relative z-10 flex w-fit items-center gap-1 text-accent text-xs hover:underline"><VideoCameraIcon size={12} />Join</a>`.
  `UpNextBanner.tsx:31-42` uses `window.open(conferenceUrl, "_blank", "noopener,noreferrer")` bound to the `V` shortcut.
- **Collision risk:** both cards already pin `EventRepeatIcon` to `absolute right-1 bottom-0.5`, and `AllDayEventCard.tsx:190` reserves `pr-3.5` on the title row **only** when `showRepeatIcon`. A join icon needs its own slot and its own title-padding reservation, or a recurring event that also has a conference link will overlap.
- **Event-swallowing risk:** both cards drive everything from `onMouseDown` and `stopPropagation`. A clickable join affordance must `stopPropagation` on `mousedown` (like the resize handles at `TimedEventCard.tsx:344-347` and `AllDayEventCard.tsx:208-211`) or opening the meeting will also open the event form / start a drag.

### D. Test conventions for these components

- **Primary file:** `packages/web/src/grid/components/EventCard.test.tsx` (17.8 KB) — covers **both** cards in one `describe("EventCard")`.
- **Runner:** `bun:test` — `import { afterEach, describe, expect, it, mock } from "bun:test"` (:14), plus a side-effect `import "@testing-library/jest-dom"` (:15).
- **Library:** `@testing-library/react` — `{ fireEvent, render, screen }` (:1). `user-event` is the stated preference in `.cursor/rules/web-testing.mdc` but these card tests use `fireEvent` because they exercise `mousedown`, not `click`.
- **Fixture:** local factory `createEvent(overrides: Partial<GridEvent> = {}): GridEvent` at :20-38, cast `as GridEvent`; shared `position = { height: 60, left: 10, top: 20, width: 140 }` at :40-45. Adding a conference is a one-liner: `createEvent({ conference: { url: "…", label: "…" } })`.
- **Teardown:** `afterEach(() => useEdgeFocusStore.setState(initialEdgeFocusState, true))` at :48-50.
- **Typical test:** render the card → `screen.getByRole("button", { name: "<full aria-label>" })` → assert data attributes / text → `fireEvent.mouseDown(...)` → assert the `mock()` handler call count and args. Example :52-98 (timed) and :345-392 (all-day).
- **Icon assertions are structural, not semantic**, because the repeat glyph is `aria-hidden`: `container.querySelector('svg[class*="right-1"]')` then assert on the class string — see :342 (negative) and :430-437 (positive). A **visible, focusable** join affordance should instead be asserted semantically via `getByRole("link", { name: … })`, which is both better practice and what `web-testing.mdc` asks for.
- **Other relevant test files:** `AllDayGridRow.test.tsx`, `TimedGrid.test.tsx`, `EventGrid.test.tsx`, `calendar-accent.util.test.ts` (same dir) and `packages/web/src/calendars/calendarCardIdentity.test.tsx` (renders both cards).
- **Cursor rule in force:** `.cursor/rules/web-testing.mdc` (glob `packages/web/**/*.{ts,tsx}`) — avoid implementation-detail assertions, prefer shared harnesses over module mocks, restore replaced globals/timers/spies, keep `bun run test:web` sequential. It points at `docs/development/testing-playbook.md`.

---

## Detected AI/agent setup

`.claude/` (settings.json — **modified**, settings.local.json, launch.json),
`.cursor/` (4 `.mdc` rules + `hooks.json` + `hooks/format-after-edit.ts`),
`.codex/` (config.toml + hooks.json), `.agents/skills/` (9 skills),
`AGENTS.md`.
Absent: `.mcp.json` (gitignored, not on disk), `CLAUDE.md`, `.cursorrules`,
`.aider.conf.yml`, `.continue/`, `.github/copilot-instructions.md`, `.roo/`,
repo-local `routing-policy.yaml`.

## Coexistence risks

- **Cursor rules detected** at `.cursor/rules/` — never touched, but `web-testing.mdc` and `web-styles.mdc` encode the conventions this run's codegen must match. Read them as input.
- **Cursor AND Codex format-on-edit hooks are both active** (`.cursor/hooks.json`, `.codex/hooks.json`, `.cursor/hooks/format-after-edit.ts`). `AGENTS.md` says formatting is handled by these repo-local hooks after agent edits, so files this plugin writes may be reformatted out-of-band by Biome.
- **`.sdlc/` is not gitignored** — and is deliberately *tracked* (8 files as of `2d81253a`). New artifacts under `.sdlc/runs/` are untracked but visible to `git add -A`, including `backups/` which echoes source content of files touched this run.
- **Aggressive `.gitignore`** — repo-wide `*.mjs` and `*.env*` globs. Any `.mjs` emitted into user source would be silently untracked.
- **`.claude/settings.json` is dirty** with the manually registered mmo write-contract hook. Off-limits; do not revert or stage.
- **No custom `.mcp.json`**, **no repo-local `routing-policy.yaml`** — the shipped policy applies.

## Proposed off-limits

```
.git/**            .claude/**          .codex/**         .cursor/**
.agents/**         AGENTS.md           .mcp.json         compass.yaml
.playwright-compass.yaml               *.env*  .env  .env.*
node_modules/**    build/**            buildcache/**
packages/*/build/**                    packages/*/node_modules/**
bun.lock           patches/**          playwright-report/**
test-results/**    blob-report/**      .github/workflows/**

# intent-specific, because the conference contract is already complete:
packages/core/src/types/event.contracts.ts
packages/core/src/types/sync/event.contracts.ts
packages/core/src/types/event-attendance.contracts.ts
packages/backend/**
packages/sync/**
```

The last block is a judgment call for Gate 0: since `conference` already flows
end-to-end, this run should be a `packages/web` UI-only change. Locking the
contract and server packages prevents it from silently widening into a
cross-package schema edit. Override at Gate 0 if that is wrong.

## Regulated-repo signals

`SECURITY.md` at repo root only. No `HIPAA`/`PCI`/`SOC2`/`GDPR`/`compliance/`
paths, no security/compliance CODEOWNERS entries.
`regulated_repo_warning_required: false`.

## Repo-state risks

| risk | severity | detail |
|---|---|---|
| dirty tree | low | 1 tracked modification: `.claude/settings.json` (mmo hook). Off-limits; keep out of this run's commit. |
| `.sdlc/` not gitignored | medium | Tracked on purpose; new run artifacts still visible to `git add -A`. |
| aggressive `.gitignore` | medium | `*.mjs` and `*.env*` repo-wide. |
| external format hooks | low | Cursor + Codex Biome format-after-edit may rewrite plugin output. |
| Git-LFS | none | No `.gitattributes`, no LFS. |
| submodules | none | No `.gitmodules`. |
| failing tests | none | 30 pass / 0 fail on the 3 relevant files. |
| branch naming | low | On `CMP-103/opus-plus-sonnet` while the intent looks like different ticket work. Confirm at Gate 0. |
