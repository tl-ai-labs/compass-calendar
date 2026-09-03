# Discovery — 20260903-105448-feature-extend-oneclick-join

- **Repo:** compass-calendar (`git@github.com:tl-ai-labs/compass-calendar.git`)
- **HEAD:** `2d81253ab8a4c8e69b27e28d12c6ae9cc61d1bfe`
- **Branch:** `CMP-103/opus-plus-flash-v37-sdk`
- **Mode:** refresh → **incremental**
- **Active policy:** `opus-plus-flash-v37`
- **Built:** 2026-09-03T10:54:48Z (plugin 0.6.0)

## Refresh decision

`discovery-refresh.mjs` returned `incremental`: 9 files changed across 2 commits since the
2026-08-20 baseline at `4189de13`. **All 9 are `.sdlc/` artifacts or `.gitignore`** — no user
source, no stack manifest, no policy file. Groups 3, 4 and 6 were re-verified rather than
re-derived; groups 1, 2 and 8 were re-read fresh.

Delta: `.gitignore`, `.sdlc/CLAUDE-SDLC.md`, `.sdlc/baseline/current.json`,
`.sdlc/baseline/discovery.md`, `.sdlc/baseline/stack-profile.md`, `.sdlc/ledger.json`,
`.sdlc/ledger.md`, `.sdlc/pre-check-status.json`, `.sdlc/project.json`.

## Group 1 — git state

Working tree is dirty, but only under `.sdlc/`: `M .sdlc/pre-check-status.json`,
`M .sdlc/project.json`, `?? .sdlc/local/`. **No user source file is modified.**

`.gitignore` changed since the baseline. It now carries three new rules:

```
.sdlc/**/_gemini_worker_save/
.sdlc/local/debug.log
.hook-logs/
```

This does **not** make `gitignore_covers_sdlc` true. The `.sdlc/` tree is deliberately tracked on
this repo (`chore(sdlc): track the project-level SDLC layer on main`), and only the ~28MB worker
save-state blobs and the transient debug log are excluded. Verified: `git check-ignore .sdlc/runs/`
reports **not ignored** on this branch, so run artifacts remain visible to `git add -A` — which is
the intended behaviour here. **Gate 0 should not offer to broaden the `.sdlc/` ignore.**

## Group 2 — topology

Twelve top-level dirs: `.agents`, `.claude`, `.codex`, `.cursor`, `.github`, `.hook-logs`, `docs`,
`e2e`, `logs`, `packages`, `patches`, `self-host`. 1590 tracked files (up from 1582). Two new
top-level dirs vs the baseline (`.hook-logs`, `logs`), both transient/local.

## Groups 3–4 — stacks and test command

Unchanged. Bun 1.3.14 monorepo (lerna + bun workspaces, `packages/*`), TypeScript 7.0.2, five
packages. `packages/web` is React 18 + Tailwind v4 + Zustand + TanStack Router/Query + Dexie +
zod v4, tested with `bun:test` + Testing Library.

### Test baseline — RED, confirmed by the caller

| | |
|---|---|
| Command | `bun run test:web` |
| Tree | clean, at HEAD `2d81253a` |
| Result | **2297 pass / 1 fail / 1 error**, 302 files, exit 1 |
| Failure | `RecurrenceSection > keeps the event's own date selectable when the event ends after midnight` |
| Cause | pre-existing date-rot, unrelated to any pending work |

**This is the bar.** Phase 7 must compare against 2297/1 with that exact failure. "Tests green" is
not achievable on this repo today and must not be used as a gate condition.

## Group 5 — docs

`README.md`, `AGENTS.md`, `CONTRIBUTING.md`, `SECURITY.md`, `CODE_OF_CONDUCT.md`, `docs/README.md`,
plus `docs/architecture`, `docs/frontend`, `docs/features`. No `CLAUDE.md` at repo root.

## Group 6 — AI / agent config

Unchanged from the baseline; no new config files appeared. Present: `.claude/settings.json`,
`.claude/launch.json`, `.cursor/rules/` (4 `.mdc` files), `.cursor/hooks.json`,
`.cursor/hooks/format-after-edit.ts`, `.codex/config.toml`, `.codex/hooks.json`, `.agents/skills/`
(9 skills), `AGENTS.md`. Absent: `.mcp.json`, `CLAUDE.md`, `.cursorrules`, `.aider.conf.yml`,
`.continue/`, `.github/copilot-instructions.md`, `.roo/`, `routing-policy.yaml`.

## Group 7 — env keys

No `.env*` file exists. Config is `compass.yaml` (gitignored) with `compass.example.yaml` as the
tracked template. Names referenced in code: `API_BASEURL`, `COMPASS_BUILD_REF`, `GOOGLE_CLIENT_ID`,
`NODE_ENV`, `PORT`, `POSTHOG_HOST`, `POSTHOG_KEY`, `TZ`. No values were read.

## Group 8 — monorepo, submodules, LFS, infra

Lerna + bun workspaces over `packages/*`: `@compass/web`, `@compass/backend`, `@compass/core`,
`@compass/sync`, `@compass/scripts`. Path aliases `@web/*` → `packages/web/src/*`, `@core/*` →
`packages/core/src/*`. No submodules, no Git-LFS. 11 GitHub workflows; Docker assets live under
`.github/docker` and `self-host`, not the repo root.

## Group 9 — regulated-repo signals

One weak signal: `SECURITY.md` at repo root. No HIPAA/PCI/SOC2/GDPR docs, no compliance path
segments, no security/compliance CODEOWNERS entries. **`regulated_repo_warning_required: false`.**

## Coexistence risks

- **Cursor rules** at `.cursor/rules/` (4 `.mdc` files, including `web-styles.mdc` and
  `web-testing.mdc`). The plugin will never touch them, but they encode the conventions codegen is
  expected to match.
- **Cursor *and* Codex format-on-edit hooks are active** (`.cursor/hooks.json`,
  `.codex/hooks.json`, `.cursor/hooks/format-after-edit.ts`). `AGENTS.md` says formatting is
  handled by these repo-local hooks after agent edits. Files this plugin writes may be reformatted
  out-of-band by Biome, so byte-identity checks on written files can fail spuriously.
- **`.gitignore` carries a repo-wide `*.mjs` rule.** Any `.mjs` emitted into user source would be
  silently untracked.
- **`.sdlc/` is tracked, not ignored.** Intentional on this repo. Run artifacts under `.sdlc/runs/`
  are visible to `git add -A` by design.
- **No `.mcp.json`, no repo-local `routing-policy.yaml`.** The shipped `opus-plus-flash-v37` policy
  applies with no repo override.

## Proposed off-limits

`.git/**`, `.claude/**`, `.codex/**`, `.cursor/**`, `.agents/**`, `AGENTS.md`, `.mcp.json`,
`compass.yaml`, `.playwright-compass.yaml`, `*.env*`, `.env`, `.env.*`, `node_modules/**`,
`build/**`, `buildcache/**`, `packages/*/build/**`, `packages/*/node_modules/**`, `bun.lock`,
`patches/**`, `playwright-report/**`, `test-results/**`, `blob-report/**`, `.github/workflows/**`,
`.hook-logs/**`, `logs/**`.

---

# Job-scope findings — one-click "join conference" icon on event cards

Requested specifics for the upcoming file-scope proposal. **Facts only; no design proposed.**

## 1. Card components, styles, tests

### The two cards (no shared base)

| Component | Path | Notes |
|---|---|---|
| `TimedEventCard` | `packages/web/src/grid/components/TimedEventCard.tsx` | 369 lines. `TimedEventCardBase` at L85, exported via `forwardRef` at **L368**. Root element L272–313. |
| `AllDayEventCard` | `packages/web/src/grid/components/AllDayEventCard.tsx` | 229 lines. `AllDayEventCardBase` at L54, exported via `forwardRef` at **L228**. Root element L145–179. Props interface is exported (`AllDayEventCardProps`, L34); the timed one is not (L60). |

**There is no shared parent or base card component.** The two are independent siblings that
duplicate their layout, palette and a11y-label logic. The only code they genuinely share is:

- `packages/web/src/grid/components/EventRepeatIcon.tsx` — the one shared in-card sub-component
  (25 lines). Its docstring states its purpose explicitly: *"Keeping it in one place stops the two
  cards from drifting apart."* Consumed at `TimedEventCard.tsx:363` and `AllDayEventCard.tsx:201`.
- `packages/web/src/grid/components/calendar-accent.util.ts` — `calendarAccentStyle`,
  `calendarAccentAccessibleSuffix`, `eventEdgeFocusShadow`, `eventFocusColor`,
  `eventFocusOutlineClass`. Its header comment (L8) names both cards.

### Styled-components: none

**`styled-components` is used in zero files under `packages/web/src`, and there are zero
`*.styled.*` files.** The repo has fully migrated to Tailwind v4. Both cards style themselves with:

- `classnames` imported as `cn` (`TimedEventCard.tsx:1`, `AllDayEventCard.tsx:1`)
- Tailwind utility strings on the root div (`TimedEventCard.tsx:279–286`, `AllDayEventCard.tsx:152–160`)
- inline `CSSProperties` objects for anything computed (`eventStyle`, `titleStyle`,
  `timeLabelStyle`, `scalerStyle`)
- CSS custom properties `--event-bg`, `--event-hover-bg`, `--event-focus-color` set in
  `eventStyle` and read by the Tailwind arbitrary values `bg-(--event-bg)` /
  `hover:bg-(--event-hover-bg)`

Shared `@utility` classes live in `packages/web/src/index.css`:

- `c-focus-ring` — **L260–262**: `rounded focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent focus-visible:ring-offset-1 focus-visible:ring-offset-surface-panel`
- `c-icon` — **L403–405**: `transition-[filter] duration-200 hover:brightness-[1.3]`

Layout constants: `packages/web/src/grid/grid.constants.ts` (imported at `TimedEventCard.tsx:27–38`).

### Existing test files

| Path | Covers |
|---|---|
| `packages/web/src/grid/components/EventCard.test.tsx` | **The** card test file — both cards. 21 `it()` cases under one `describe("EventCard")` (L47). Shared `createEvent` factory L20–38, shared `position` L40–45. `bun:test` (`describe/it/expect/mock`) + `@testing-library/react` + `@testing-library/jest-dom`, imported at L1–18. Timed cases L52–343; all-day cases L345–460; shared focus-chrome cases L462–580. |
| `packages/web/src/calendars/calendarCardIdentity.test.tsx` | Renders both cards (L70 timed, L87 all-day) for the calendar-accent identity path. |
| `packages/web/src/grid/components/AllDayGridRow.test.tsx` | The all-day row that hosts the cards. |

### Who renders the cards

| Consumer | Line | Card |
|---|---|---|
| `packages/web/src/views/Week/components/Event/Grid/GridEvent/GridEvent.tsx` | 134 | Timed (Week) |
| `packages/web/src/views/Week/components/Grid/AllDayRow/AllDayEvent.tsx` | 64 | All-day (Week) |
| `packages/web/src/views/Day/components/Calendar/DayCalendarEventCards.tsx` | 93 / 180 | All-day / Timed (Day) |
| `packages/web/src/views/Week/components/Draft/grid/GridDraft.tsx` | 123 (comment) | Timed draft overlay |

Both wrappers are `memo`ised with explicit comparators (`GridEvent.tsx:154–167`,
`AllDayEvent.tsx:81–92`) that enumerate props by name — a new prop would need adding there.

## 2. Where conference / video-link data lives

### The type

`packages/core/src/types/event-attendance.contracts.ts` **L31–35**:

```ts
export const ConferenceSchema = z.strictObject({
  url: z.url(),
  label: z.string().trim().min(1).max(256).nullable(),
});
export type Conference = z.infer<typeof ConferenceSchema>;
```

Note `z.url()` constrains the string to *parse* as a URL. It does **not** constrain the scheme —
`javascript:` and `data:` parse fine. There is no scheme check anywhere on the web side today.

Attached to:

- `packages/core/src/types/event.contracts.ts:30` — `conference: ConferenceSchema.nullable().optional()` on the `kind: "details"` content variant
- `packages/core/src/types/sync/event.contracts.ts:86` and `:186` — `conference: ConferenceSchema.nullable()`
- **`packages/web/src/common/types/web.event.types.ts:88`** — `conference: ConferenceSchema.nullable().optional()` **inside `GridEventSchema`** (L47–90, `export type GridEvent` L90)

**This is the key fact: `GridEvent` already carries `conference`.** Both cards already receive the
whole `event: GridEvent` object, so `event.conference?.url` and `event.conference?.label` are
already in scope inside `TimedEventCard.tsx` and `AllDayEventCard.tsx` with **no prop plumbing and
no wrapper/memo-comparator change required**.

### Where it gets populated

`packages/web/src/events/queries/event.view-model.ts:94` — `conference: details?.conference`, in
the same block that joins `location`, `organizer` and `attendees` onto the grid event (L91–94).

### Provider field names — collapsed in `sync`, absent from `web`

`packages/sync/src/providers/google/google-event.normalizer.ts` **L160–172**:

```ts
item.hangoutLink ??
item.conferenceData?.entryPoints?.find(
  (entry: calendar_v3.Schema$EntryPoint) =>
    entry.entryPointType === "video",
)?.uri
...
label: item.conferenceData?.conferenceSolution?.name || null,
```

So `hangoutLink`, `conferenceData`, `entryPoints`, `videoLink` etc. **never appear anywhere under
`packages/web`**. The web side only ever sees the normalised `{ url, label }`. Covered by
`packages/sync/src/providers/google/google-event.normalizer.test.ts:210–245` (including a
`"not-a-url"` rejection case). Also referenced as a leak canary at
`packages/sync/src/safety/safety-canary.ts:18–19`.

### Existing extract/normalize helper

**One, and it is not reusable from a card:**

`packages/web/src/components/Sidebar/UpNextCard/useUpNextEvent.ts` **L68–71**:

```ts
const conferenceUrl =
  sourceEvent?.content.kind === "details"
    ? sourceEvent.content.conference?.url
    : undefined;
```

It reads from the *store* event (`content.kind === "details"` discriminant), not from a
`GridEvent`, and it lives inside the UpNext hook. **There is no shared join-URL helper module and
no URL normalisation/sanitisation utility anywhere in `packages/web`.**

### Related caveats found in-tree

- `packages/web/src/events/mutations/useEventMutations.ts:218` — organizer/attendees/conference are
  **read-only**; no write command sets them.
- `packages/web/src/events/mutations/useUndoRedo.ts:138` — conference is absent until the settle refetch.
- `packages/web/src/events/grid-event-draft.adapter.ts:586` — comment on `conference`/`colorHex`
  having been added for the read side only, warning that a spread bypasses it.
- Demo fixture with a real Google Meet conference:
  `packages/web/src/common/storage/migrations/external/demo-data-seed.ts:144–147`.

## 3. Existing join / conference affordances in `packages/web`

**Yes — three, all outside the grid. None on a grid card.**

1. **`packages/web/src/components/Sidebar/UpNextCard/UpNextCard.tsx:87–97`** — an `<a>` labelled
   "Join":
   ```tsx
   {upNext.conference && (
     <a href={upNext.conference.url} target="_blank" rel="noopener noreferrer"
        className="c-focus-ring relative z-10 flex w-fit items-center gap-1 text-accent text-xs hover:underline">
       <VideoCameraIcon size={12} />
       Join
     </a>
   )}
   ```
   The comment at L64–67 is directly relevant: the card's whole-surface click target is an
   *absolutely positioned sibling button* (L68–73), and the Join link defends itself with
   `relative z-10` **paint order**, not `stopPropagation`. Tests:
   `UpNextCard.test.tsx:198–238` (`getByRole("link", { name: "Join" })`).

2. **`packages/web/src/components/Sidebar/UpNextCard/UpNextBanner.tsx`** — keyboard path.
   `window.open(conferenceUrl, "_blank", "noopener,noreferrer")` at **L32**; shortcut enabled at
   L42; the primary action label flips `"Join"`/`"Open"` and the hint flips `V`/`N` at L82–87.
   Shortcut registered at `packages/web/src/shortcuts/shortcuts.registry.ts:22–24`
   (`id: "nav-join-meeting"`, `label: "Join Up Next meeting"`). Tests:
   `UpNextBanner.test.tsx:79–130`.

3. **`packages/web/src/views/Forms/EventForm/EventDetailsSection.tsx:46–58`** — read-only anchor in
   the event form, `<VideoCameraIcon size={16} className="shrink-0 text-text-muted" />` plus
   `{conference.label ?? "Join meeting"}`. Tests: `EventForm.test.tsx:1343–1356`.

Also: `DescriptionEditor.tsx:114–115` documents that the structured `conference` field **only ever
covers Google Meet**; Zoom/Teams links arrive as raw anchors inside the description HTML.

### Prior attempts on sibling branches — five, none merged

`main@2d81253a` is clean: `git grep -niE 'join|conference' main -- packages/web/src/grid/` returns
only `Array.prototype.join` calls and a test event titled `"Conference"`. But five sibling branches
each carry an unmerged implementation of exactly this feature:

| SHA | Date | Branch | New files | Also touched |
|---|---|---|---|---|
| `31a2ffba` | 2026-08-30 | `CMP-103/opus-plus-flash-v37-t2` | `EventJoinIcon.tsx` (77), `event-join-url.util.ts` (34), `event-join-url.util.test.ts` (73) | cards + `EventCard.test.tsx` (+386) |
| `af2eadd0` | 2026-08-26 | `CMP-103/opus-plus-sonnet` | `EventJoinIcon.tsx` (153) | **`grid/interaction/dom.ts` (+21), `day-interaction.adapter.ts` (+9), `week-interaction.adapter.ts` (+9)** + 2 adapter test files |
| `491169d2` | 2026-08-22 | `CMP-103/opus-only-v5` | `EventJoinIcon.tsx` (151) | **`grid/interaction/event.registry.ts` (+36)**, `.gitignore` |
| `cb4a809f` | 2026-08-21 | `CMP-103/flash-agsdk-only` | (`EventJoinIcon.tsx` created earlier in-branch) | cards + `EventCard.test.tsx` |
| `399a2554` | 2026-08-21 | `CMP-103/opus-plus-flash-v37` | `EventJoinIcon.tsx` (92) | cards + `EventCard.test.tsx` |

All five independently converged on the same new file path
**`packages/web/src/grid/components/EventJoinIcon.tsx`**, and all five modified
`TimedEventCard.tsx`, `AllDayEventCard.tsx` and `EventCard.test.tsx`. **Two of the five found they
also had to modify the interaction layer** — see §5. None of this exists on `main`, so this run
starts from zero, but the convergence is strong evidence about where the work lands.

## 4. Icon system

- **Library:** `@phosphor-icons/react` `^2.1.7` — `packages/web/package.json:11`. It is the only
  icon library in the package (no lucide, no heroicons, no react-icons).
- **Registration:** `packages/web/src/components/IconProvider/IconProvider.tsx` wraps children in
  phosphor's `IconContext.Provider` with `value={{ size: 25 }}` (L6–10). Mounted once, in
  `packages/web/src/components/CompassProvider/CompassProvider.tsx:68` (closing L77). It sets a
  **default size only** — no color, no weight. Every call site that wants a small glyph passes
  `size` explicitly.
- **Two import styles coexist:**
  1. **Direct** — `import { VideoCameraIcon } from "@phosphor-icons/react"`
     (`UpNextCard.tsx:1`, `EventDetailsSection.tsx:1`).
  2. **Local thin wrapper** under `packages/web/src/components/Icons/`
     (`ChevronLeftIcon.tsx`, `ChevronRightIcon.tsx`, `CircleIcon.tsx`, `Repeat.tsx`, `Sidebar.tsx`,
     `icon.utils.ts`). Each re-exports the phosphor icon with the shared class applied:
     ```ts
     // packages/web/src/components/Icons/Repeat.tsx
     export const RepeatIcon = ({ className, ...props }: IconProps) => (
       <PhosphorRepeatIcon className={getInteractiveIconClassName(className)} {...props} />
     );
     ```
     `getInteractiveIconClassName` (`icon.utils.ts:3–6`) is `classNames("c-icon", hoverBrightnessClass, className)`.

### Representative small icon rendered inside a card

`packages/web/src/grid/components/EventRepeatIcon.tsx` — the only icon currently rendered inside
either grid card:

```tsx
export const EventRepeatIcon = ({ baseColor }: Props) => (
  <RepeatIcon
    aria-hidden="true"
    className="pointer-events-none absolute right-1 bottom-0.5"
    color={darken(baseColor, 30)}
    size={10}
    weight="bold"
  />
);
```

Its call sites show the surrounding conventions:

- Gated on card geometry before render — `TimedEventCard.tsx:116–120` requires
  `durationMinutes >= 15` **and** `position.width >= 40` (`REPEAT_ICON_MIN_WIDTH`, L58);
  `AllDayEventCard.tsx:76–77` requires `position.width >= 60` (L32). The timed gate deliberately
  keys on **duration, not rendered pixel height** — see the comment at `TimedEventCard.tsx:51–57`.
- The all-day card **reserves room** so the title truncates before the glyph:
  `AllDayEventCard.tsx:188–191` adds `"pr-3.5"` to the title row when `showRepeatIcon`.
- Tinted from the card fill via `darken(baseColor, 30)`, never a fixed color.
- **Decorative:** `aria-hidden="true"` + `pointer-events-none`; the recurring state is announced
  through the card's `aria-label` instead.

**Important:** this is *not* an interactive control. **There is no interactive icon button rendered
inside either grid card today.** The closest interactive icon examples in a card-like container are
the UpNextCard `<a>` (§3.1) and `EventDetailsSection.tsx:96–104`
(`<button type="button" className="c-focus-ring self-start rounded-xs pl-6 …">`).

## 5. Convention for click handlers that must not trigger the card's own open/select

This is the sharpest constraint in the whole job, and the React-level answer is **not sufficient**.

### What exists at the React level

Both cards and both wrappers already call `stopPropagation`:

| Location | Purpose |
|---|---|
| `TimedEventCard.tsx:296` | keydown — stops Enter/Space reaching parent shortcuts |
| `TimedEventCard.tsx:305` | mousedown, only when no `onEventMouseDown` was supplied |
| `TimedEventCard.tsx:345`, `:356` | the two resize handles' `onMouseDown` |
| `AllDayEventCard.tsx:168` | keydown |
| `AllDayEventCard.tsx:174` | mousedown — **always**, with the comment *"Stop bubble so the all-day row create handler cannot overwrite a card click"* |
| `AllDayEventCard.tsx:209`, `:220` | the two resize handles' `onMouseDown` |
| `AllDayEvent.tsx:54–61` (wrapper) | same reason, at the wrapper level |
| `GridEvent.tsx:112–131` (wrapper) | bails on `isWeekInteractionMotionActive()` and on right-click; stops propagation only when no handler exists |

Elsewhere in the app the same idiom appears for nested controls:
`views/Forms/ActionsMenu/MenuItem.tsx:56`, `components/OverlayPanel/OverlayPanel.tsx:142,148`,
`RecurrenceSection/components/CaretInput.tsx:16,28`, `TimePicker.tsx:120–129`.

### Why that is not enough on a grid card

Drag and resize are **not** driven by those React handlers. They are driven by
`packages/web/src/interaction/react/PointerCaptureBoundary.tsx`, which subscribes
`onPointerDownCapture` (element L107, handler L69–80) — i.e. the **capture phase at an ancestor of
the card**. When the view adapter answers `shouldOwn: true`, the boundary calls:

```ts
// PointerCaptureBoundary.tsx:193–201
const consumeOwnedPointerEvent = (event) => {
  event.preventDefault();
  event.stopPropagation();
};
```

Capture at an ancestor always runs before the target phase, so **a nested link or button inside a
card cannot defend itself with its own `stopPropagation` or `onClick`** — the ancestor has already
`preventDefault()`ed the pointerdown before the descendant's handlers run.

### The pattern the repo actually uses for this

A **data attribute that the view adapters check while resolving the interaction target** — exactly
how resize handles already work:

- `packages/web/src/grid/interaction/dom.ts:22–23` —
  `EVENT_RESIZE_HANDLE_ATTRIBUTE = "data-calendar-event-resize-handle"`
- `packages/web/src/grid/interaction/dom.ts:29–39` — `getResizeHandleEdge(event)` resolves via
  `event.target.closest([attr])`
- Week adapter: ownership decision at
  `packages/web/src/views/Week/interaction/adapter/week-interaction.adapter.ts:167–188`
  (`const target = getInteractionTarget(event); if (!target) return { shouldOwn: false }`);
  `getInteractionTarget` itself at **L483–506**, with `getResizeHandleEdge` consulted at L510, L529,
  L549, L568.
- Day adapter: the mirror image at
  `packages/web/src/views/Day/interaction/adapter/day-interaction.adapter.ts:125` and **L434–461**,
  L480, L500, L519.

Both adapters resolve targets in a fixed priority order (all-day resize → timed resize → timed drag
→ all-day drag) and each branch bails to `null` when the pointer is over a resize handle.

**Two of the five prior arms rediscovered this independently.** `af2eadd0` added
`EVENT_INTERACTIVE_ATTRIBUTE = "data-calendar-event-interactive"` and
`isInteractiveAffordanceTarget()` to `dom.ts` plus a bail at the top of both adapters'
`getInteractionTarget`; `491169d2` instead patched `grid/interaction/event.registry.ts`. **Neither
mechanism exists on `main`.**

### Three further traps in this area

1. **The unit tests cannot catch it.** `EventCard.test.tsx` renders both cards with **no
   `PointerCaptureBoundary` ancestor** (see the render calls from L57 onward — the cards are
   mounted bare). A join control can therefore pass every card unit test and still be dead in the
   running app. This matches the recorded browser check on `CMP-103/opus-plus-flash-v37-t2`, where
   mouse-click join was broken (it opened the event panel) while the keyboard path worked and the
   suite was green.
2. **The drag ghost deep-clones the card.** `createDraftEventMount`
   (`grid/interaction/dom.ts:71–99`) clones the card element via
   `packages/web/src/interaction/dom/draft-event.clone.ts` and strips only
   `DRAFT_CLONE_STRIPPED_ATTRIBUTES` (L15–18, the two view-registry attributes). Any new
   interactive descendant will be cloned into the floating ghost as-is.
3. **Accessibility.** Both card roots are `role="button"` with an explicit biome suppression
   (`TimedEventCard.tsx:271`, `AllDayEventCard.tsx:144`). A focusable descendant inside a
   `role="button"` trips axe's `nested-interactive` rule (serious / wcag2a) — `af2eadd0` recorded
   this as a known, documented deviation. The repo has `e2e/accessibility/` and an `a11y-audit`
   skill under `.agents/skills/`.

## Notes / bounds

Scan completed well inside the Tier 1 timebox. No Tier 2b adaptive stack profile was rebuilt: the
refresh decision is `incremental`, no stack manifest changed, and the cached
`.sdlc/baseline/stack-profile.md` remains valid under the freshness rule. No file outside `.sdlc/`
was written or modified.
