# Delta Requirements — feature-extend — One-click join icon on grid event cards

Run: `20260903-105448-feature-extend-oneclick-join`
Intent: `feature-extend` · Policy: `opus-plus-flash-v37` · Mode: brownfield
Source brief: `.sdlc/runs/20260903-105448-feature-extend-oneclick-join/intent_brief.md`
**Revision 2** — incorporates the three Gate-1 amendments (AC-3 two-layer, AC-5 axe-in-e2e,
AC-9 scheme guard) and the 8 → 10 allowlist widening. Adds one new blocker, OQ-6.

This is a **delta** requirements document. It states only what changes relative to the
repository at HEAD `2d81253a`, and it records the code-level facts that constrain the design.

---

## 1. In scope

1. A new presentational component that renders a "join" affordance on a grid event card.
2. Rendering that component from `TimedEventCard` and `AllDayEventCard`, gated on the presence
   of a conference URL already carried by `GridEvent`.
3. A render-time `http:`/`https:` scheme guard on the URL before it reaches an `href` (AC-9).
4. A new DOM data attribute, declared next to `EVENT_RESIZE_HANDLE_ATTRIBUTE` in
   `packages/web/src/grid/interaction/dom.ts`, that marks the join control as a
   non-interaction region for the grid's pointer machinery.
5. Honouring that attribute in `getInteractionTarget` in both the Week and Day interaction
   adapters, so a pointer-down on the join control yields no drag/resize target.
6. Unit tests for the new component, and additions to `EventCard.test.tsx`.
7. Two new Playwright specs providing the automated half of AC-8 and the axe
   nested-interactive guard for AC-5.
8. A recorded human browser verification of mouse-click join on a timed and an all-day event.

## 2. Out of scope

1. Any change under `packages/core`, `packages/sync`, `packages/backend`. Conference data
   already arrives correctly shaped; no prop plumbing is required (§4.1).
2. The three existing join affordances (`UpNextCard`, `UpNextBanner` + `V` shortcut,
   `EventDetailsSection`) and any consolidation of them behind a shared helper. **They share
   the same unguarded-scheme sink that AC-9 fixes on the grid card; hardening them is a
   follow-up ticket, not this run.**
4. Changing `ConferenceSchema` itself. AC-9 is a render-time guard in the new component only.
5. Extracting a shared base component for the two cards, or de-duplicating their layout,
   palette or a11y logic. That is a `refactor` job.
6. Fixing the pre-existing `RecurrenceSection` date-rot test failure.
7. Adding axe to the bun component suite. The repo deliberately keeps axe in the Playwright
   layer (§4.4); do not introduce it under `packages/web` this run.
8. Local/anonymous IndexedDB mode as a supported target. A known unticketed bug destroys
   `conference`/`organizer`/`attendees` on any resize/move/edit in that mode. Pre-existing
   debt, explicitly accepted — **but see OQ-6, because the e2e harness runs in exactly this
   mode and that collision is now a live design constraint, not a theoretical one.**
9. Any new npm dependency, and any edit to `package.json` / `bun.lock`.
10. Porting, copying or consulting the five sibling-branch implementations
    (`31a2ffba`, `af2eadd0`, `491169d2`, `cb4a809f`, `399a2554`). This arm is a fresh
    implementation for policy comparison.

## 3. Files in scope

The write contract at `.sdlc/local/write-contract.json` is `active`, `strict`, and holds
exactly these **ten** paths (widened 8 → 10 at the re-opened Gate 0). **No packet in this run
may target an eleventh path** without returning to the user.

New:
- `packages/web/src/grid/components/EventJoinIcon.tsx`
- `packages/web/src/grid/components/EventJoinIcon.test.tsx`
- `e2e/timed/event-join.spec.ts`
- `e2e/allday/event-join.spec.ts`

Edit:
- `packages/web/src/grid/components/TimedEventCard.tsx`
- `packages/web/src/grid/components/AllDayEventCard.tsx`
- `packages/web/src/grid/components/EventCard.test.tsx`
- `packages/web/src/grid/interaction/dom.ts`
- `packages/web/src/views/Week/interaction/adapter/week-interaction.adapter.ts`
- `packages/web/src/views/Day/interaction/adapter/day-interaction.adapter.ts`

Read-only, imported but never modified: `e2e/utils/axe-assertion.ts`.
`playwright.config.ts` needs no edit — `testDir: "./e2e"` auto-discovers specs
(`playwright.config.ts:8`).

---

## 4. Code-level findings that constrain the design

Established by reading the repo. Not assumptions.

### 4.1 The data is already in scope

`ConferenceSchema` is `{ url: string, label: string | null }`
(`packages/core/src/types/event-attendance.contracts.ts:31-35`). `GridEvent` carries
`conference: ConferenceSchema.nullable().optional()`
(`packages/web/src/common/types/web.event.types.ts:88`), populated at
`packages/web/src/events/queries/event.view-model.ts:94`. Both card components already
destructure `event`, so `event.conference?.url` is in scope with no prop changes.

### 4.2 There are TWO distinct ways a join click can be swallowed, and both must be handled

**Path A — the pointer path (ancestor capture).**
`PointerCaptureBoundary` subscribes `onPointerDownCapture` on a `display: contents` wrapper
that is an **ancestor** of the cards (`PointerCaptureBoundary.tsx:107`, handler `:69-80`). On
`shouldOwn: true` it calls `consumeOwnedPointerEvent` → `preventDefault()` +
`stopPropagation()` (`:193-201`). Capture phase on an ancestor runs *before* the target phase,
so a descendant anchor cannot defend itself — the event never reaches it. Ownership is decided
by the adapter's `handlePointerDown` → `getInteractionTarget`
(`week-interaction.adapter.ts:157-187`, `day-interaction.adapter.ts:125`). The only way to keep
the pointer event alive for a nested control is to make `getInteractionTarget` return `null`
over it. `stopPropagation` inside the card is structurally incapable of fixing this.

**Path B — the mouse path (normal bubbling).**
Both card roots handle `onMouseDown` and call `onEventMouseDown`, which is what opens the
detail panel (`TimedEventCard.tsx:303-310`, `AllDayEventCard.tsx:171-176`). `mousedown` is a
separate event from `pointerdown` and `PointerCaptureBoundary` does not intercept it at all.
A mousedown on a nested join control **bubbles normally** to the card root and opens the panel.
Path A's fix does nothing about this. This path requires `e.stopPropagation()` on the join
control's own `onMouseDown`.

**The resize handles already do both, and are the reference implementation.** Each handle
carries `EVENT_RESIZE_HANDLE_ATTRIBUTE` — honoured by `getResizeHandleEdge` (`dom.ts:31-39`)
and consulted by the adapters (`week:483-506`, `day:434-461`) — *and* calls
`e.stopPropagation()` in its own `onMouseDown` (`TimedEventCard.tsx:344-347, 355-358`;
`AllDayEventCard.tsx:208-211, 219-222`). Two layers, two event paths.

### 4.3 The bun component suite structurally cannot validate Path A

`EventCard.test.tsx` renders both cards bare — no `PointerCaptureBoundary` ancestor anywhere in
the file (575 lines, verified). Every assertion it can make about pointer behavior is vacuous
with respect to the real tree. A prior arm on this repo shipped a green suite whose mouse-click
join opened the detail panel instead of joining. Path A's acceptance signal is the Playwright
layer plus the human browser check; the bun suite covers rendering, naming, and Path B.

### 4.4 Accessibility tooling exists — in the Playwright layer only

- `@axe-core/playwright@^4.12.1` and `axe-core@^4.12.1` are root devDependencies
  (`package.json:63,70`).
- `e2e/accessibility/` holds three existing specs (`app-a11y`, `datepicker-a11y`,
  `focus-visible`).
- `e2e/utils/axe-assertion.ts` exports `expectNoAxeViolations(page, { include, checkpoint,
  knownIncomplete })`, scanning with `withTags(["wcag2a","wcag2aa","wcag21a","wcag21aa",
  "wcag22aa"])` and failing on any `violations` entry.
- **Verified against the installed axe-core 4.12.1:** the `nested-interactive` rule carries
  tags `["cat.keyboard","wcag2a","wcag412","TTv5","TT6.a","EN-301-549","EN-9.4.1.2","RGAAv4",
  "RGAA-7.1.1"]`. `wcag2a` is inside the helper's tag set, so **the existing helper catches a
  nested-interactive violation with no modification.** This is what gives AC-5 an automated
  guard.
- What is genuinely absent is axe in the bun component suite. Do not add it (§2.7).
- Biome's `lint/a11y` rules are active and enforced — both card roots already carry
  `biome-ignore lint/a11y/useSemanticElements` and `noStaticElementInteractions` suppressions.
  New code must satisfy those rules or carry a justified suppression in the same style.

### 4.5 The nested-interactive conflict is real

Both card roots are `<div role="button" tabIndex={0}>` (`TimedEventCard.tsx:272-278`,
`AllDayEventCard.tsx:145-151`). An `<a>` or `<button>` inside them is an interactive element
nested in an interactive element. Beyond the rule violation, a screen reader in browse mode may
not expose the inner control at all, which would silently defeat AC-5. The design MUST state
which resolution it takes and why, and the e2e axe assertion (§4.4) will hold it.

### 4.6 Existing conventions the new component must follow

- Icons: `@phosphor-icons/react` is already a dependency. `VideoCameraIcon` is the established
  glyph for "join" (`UpNextCard.tsx:1,94`; `EventDetailsSection.tsx:1,53`).
- `packages/web/src/components/Icons/` wraps Phosphor icons via `getInteractiveIconClassName`
  (`icon.utils.ts:3-6`), which prepends the `c-icon` utility (`index.css:403-405`:
  `transition-[filter] hover:brightness-[1.3]`). `Repeat.tsx` is the reference wrapper.
- `EventRepeatIcon.tsx` is the reference for a small glyph pinned inside a card: absolutely
  positioned bottom-right, tinted `darken(baseColor, 30)`, `pointer-events-none`, `aria-hidden`.
  The join icon is the *interactive* counterpart, so it must NOT be `pointer-events-none` and
  must NOT be `aria-hidden`.
- The existing join anchor pattern is `<a href target="_blank" rel="noopener noreferrer">` with
  a `c-focus-ring` class (`UpNextCard.tsx:87-97`).
- `AllDayEventCard` already reserves space for a bottom-right glyph with a conditional `pr-3.5`
  on the title row (`:188-191`); the repeat icon and a join icon can collide.
- Repeat-icon size gates: `TimedEventCard` uses `REPEAT_ICON_MIN_DURATION_MINUTES = 15` and
  `REPEAT_ICON_MIN_WIDTH = 40`; `AllDayEventCard` uses `REPEAT_ICON_MIN_WIDTH = 60`. Whether the
  join icon needs an equivalent gate is OQ-1.

### 4.7 The draft-clone path strips interaction attributes

`createDraftEventMount` (`dom.ts:74-100`) clones the card for the drag ghost and strips the
per-view interaction attributes in `DRAFT_CLONE_STRIPPED_ATTRIBUTES`. A join control inside the
clone would be a focusable, non-functional duplicate anchor in the drag ghost. See OQ-2.

### 4.8 The e2e harness runs in anonymous local-IndexedDB mode, and cannot create a conference

This is the finding behind OQ-6 and it is load-bearing for the two new specs.

- `prepareCalendarPage` (`e2e/utils/event-test-utils.ts:147-160`) calls `clearClientAuthState`
  (removes `localStorage["compass.auth"]`, `:135-139`) and `resetLocalEventDb` (`:162+`). Every
  e2e spec therefore runs **signed out**, against the local IndexedDB store `compass-local`
  (`legacy-primary-key.migration.ts:5`), stores `events` / `tasks`.
- Conference is **read-only, provider-sourced** (`web.event.types.ts:87` comment). The event
  form only *renders* it (`EventDetailsSection.tsx:46-58`); there is no input that can set it.
- `grep -rn "conference\|hangout" e2e/` returns **nothing**. No existing spec has ever had a
  conference-bearing event.
- Therefore the standard spec pattern used by `event-smoke.spec.ts` — create an event through
  the UI, assert on it — **cannot produce a card that renders the join icon at all.** The two
  new specs cannot be written the way every neighbouring spec is written.
- The only route is seeding a conference-bearing record directly into the `compass-local`
  IndexedDB `events` store via `page.evaluate`, which requires matching the Dexie record shape.
- **Second-order collision:** the known local-mode bug (§2.8) destroys `conference` on any
  move/resize/edit. So a spec that seeds a conference event, then drags it to prove AC-4's
  "drag still works", will destroy the conference and the icon will vanish — a *correct*
  observation of a pre-existing bug that would read as a failure of this feature.

---

## 5. Functional requirements

**Module: `grid/components` (new component)**

- **FR-1** A new component `EventJoinIcon` renders an activatable control that navigates to a
  supplied conference URL in a new browsing context, using `target="_blank"` and
  `rel="noopener noreferrer"` (or an equivalent providing both opener-severing and referrer
  suppression).
- **FR-2** `EventJoinIcon` renders **nothing** unless the supplied URL parses and its protocol
  is exactly `http:` or `https:`. Any other scheme (notably `javascript:`, `data:`, `vbscript:`)
  and any unparseable value yield no control and no `href`. (AC-9)
- **FR-3** `EventJoinIcon` carries the join data attribute from FR-7 on the element that
  receives the pointer, and the attribute must be discoverable via `closest()` from the true
  event target — the glyph itself is a child SVG, so the attribute belongs on the anchor.
- **FR-4** `EventJoinIcon` exposes an accessible name that identifies the event it joins, not a
  bare "Join". The name must be readable from the accessibility tree.
- **FR-5** `EventJoinIcon` calls `e.stopPropagation()` in its own `onMouseDown` so the host
  card's `onEventMouseDown` does not fire (§4.2 Path B).

**Module: `grid/components` (card integration)**

- **FR-6** `TimedEventCard` and `AllDayEventCard` each render `EventJoinIcon` if and only if
  `event.conference?.url` is a non-empty string. No other condition may suppress it except an
  explicitly designed size/placeholder gate (OQ-1), which if adopted must be stated in the
  design and tested.

**Module: `grid/interaction`**

- **FR-7** `dom.ts` exports a new constant for the join-control data attribute, declared
  alongside `EVENT_RESIZE_HANDLE_ATTRIBUTE`, plus a predicate shaped like `getResizeHandleEdge`
  reporting whether a pointer event originated inside a join control.
- **FR-8** `week-interaction.adapter.ts:483` `getInteractionTarget` returns `null` when that
  predicate is true, before any other target resolution.
- **FR-9** `day-interaction.adapter.ts:434` `getInteractionTarget` does the same.

**Module: tests**

- **FR-10** `EventJoinIcon.test.tsx` covers: rendered `href`, `target`, `rel`; the accessible
  name; the data attribute reachable via `closest()`; scheme rejection for at least
  `javascript:` and one unparseable value; and that mousedown does not reach a parent handler.
- **FR-11** `EventCard.test.tsx` gains coverage for FR-6 on both card types (present with a
  conference, absent without), asserting via the accessibility tree.
- **FR-12** `e2e/timed/event-join.spec.ts` and `e2e/allday/event-join.spec.ts` each cover:
  activating the join control reaches the conference URL; the card's own click and drag still
  behave; and `expectNoAxeViolations` scoped to the grid passes (catching nested-interactive per
  §4.4). Both depend on the OQ-6 resolution.

## 6. Non-functional requirements

- **NFR-1 · No new dependencies.** No change to any `package.json` or `bun.lock`. Both are
  off-limits in the write contract, so a violation fails at the tool boundary.
- **NFR-2 · Accessibility-tree assertions only.** Component tests MUST use
  `getByRole(role, { name })` / `queryByRole`. Asserting a raw `role=` DOM attribute via
  `getAttribute` or a `[role="link"]` selector is prohibited — a prior arm on this repo shipped
  exactly that and the tests were unfalsifiable.
- **NFR-3 · No regression in existing card behavior.** Card-body click still opens the detail
  panel; drag-to-move and resize still work on both card types.
- **NFR-4 · Test-suite delta, not absolute.** The repo baseline at HEAD `2d81253a` is
  **RED**: `bun run test:web` → 2297 pass / 1 fail / 1 error, exit 1. The single failure is
  `RecurrenceSection > keeps the event's own date selectable when the event ends after
  midnight`, pre-existing date rot. Acceptance is **no new failures**, measured as a delta
  against 2297/1. The suite must never be reported as "green".
- **NFR-5 · Style conformance.** New code passes the repo's Biome configuration, follows
  existing import-ordering and `@web/...` alias conventions, and matches the commenting style of
  neighbouring grid components (explain *why*, not *what*).
- **NFR-6 · Visual non-interference.** The join icon must not overlap or displace the repeat
  icon, and must not push a title into overflow on a narrow card.
- **NFR-7 · e2e helper is read-only.** `e2e/utils/axe-assertion.ts` is imported, never modified.

## 7. PII and data-handling inventory

| Field | Source | Sensitivity | Handling in this change |
|---|---|---|---|
| `event.conference.url` | Provider (Google `hangoutLink` / `entryPoints`), collapsed upstream in `packages/sync` | **Medium** — a join URL is a bearer capability; anyone holding it may be able to enter the meeting | Rendered into an `href`, gated by the FR-2 scheme guard. Never logged, never transmitted. `rel="noopener noreferrer"` required so the URL does not leak as a `Referer` to the join target and the opened tab cannot reach back via `window.opener`. |
| `event.conference.label` | Same | Low | Display / accessible naming only. |
| `event.title` | User / provider | **Medium** — meeting titles routinely contain client names, candidate names, topics | Already rendered on the card today. This change additionally places it into the join control's accessible name (FR-4). No net new exposure surface; see OQ-4. |

No new persistence, no new network call, no new logging. The change is render-only.

## 8. Role matrix

Client-side rendering change with no authorization surface. For completeness:

| Actor | Resource | Action | Change |
|---|---|---|---|
| Signed-in user | own/subscribed event with a conference URL | view + activate join control | **new** |
| Signed-in user | event without a conference URL | (control absent) | unchanged |
| Anonymous / local IndexedDB user | local event | control renders until the first local edit destroys `conference` (§2.8) | pre-existing debt |

Read-only events (`isDemo`, cross-account duplicates, busy/placeholder cards) are a design
question, not an authz one — OQ-1.

## 9. Acceptance criteria

Traceable to the amended brief's AC-1…AC-9.

- **AC-1** The join control renders on a card if and only if `event.conference?.url` is
  present. *(Unit tests, both card types, present/absent.)*
- **AC-2** Activating it opens the conference URL in a new tab, opener severed, referrer
  suppressed. *(Unit test asserts `href`, `target`, `rel`.)*
- **AC-3** Activating it does **not** open the detail panel and does **not** initiate a drag or
  resize. **Both layers are required**, exactly as the resize handles do it (§4.2):
  1. **Pointer path** — join data attribute in `dom.ts`, honoured by `getInteractionTarget` in
     both adapters. `stopPropagation` alone cannot work here.
  2. **Mouse path** — `e.stopPropagation()` in the join control's own `onMouseDown`.
  *(Adapter unit tests for layer 1; card unit test for layer 2; e2e + human browser check for
  both in the real tree.)*
- **AC-4** Existing card behavior unchanged: card-body click opens the detail panel;
  drag-to-move and resize work on both card types. *(Existing suite delta + e2e + browser
  check.)*
- **AC-5** The control is keyboard reachable and exposes an accessible name identifying the
  event. Component tests assert via `getByRole(..., { name })`, never a raw `role` DOM
  attribute. The nested-interactive conflict (§4.5) is resolved deliberately, the resolution is
  stated in `design.md`, and it is guarded automatically by `expectNoAxeViolations` in the two
  new e2e specs (§4.4). Axe is NOT added to the bun suite.
- **AC-6** `bun run test:web` shows no new failures beyond the known `RecurrenceSection`
  date-rot failure — delta against 2297 pass / 1 fail (NFR-4).
- **AC-7** No new npm dependencies; no `package.json` / `bun.lock` change. *(Verified by
  `git diff --stat` showing only allowlisted paths.)*
- **AC-8** **Browser verification is a required gate.** In the running app, on both a timed and
  an all-day event carrying a conference URL: mouse-click on the join control opens the
  conference URL and does **not** open the detail panel; and the card's own click, drag-to-move
  and resize still behave. Backed by `e2e/timed/event-join.spec.ts` and
  `e2e/allday/event-join.spec.ts` so the click path has an automated regression guard. **The
  specs do not replace the human check** — AC-6 and the e2e passing are together necessary but
  not sufficient.
- **AC-9** The `href` is constrained to `http:`/`https:` before rendering (FR-2). Scope is the
  render-time guard in the new join control only; `ConferenceSchema` is unchanged and the three
  pre-existing anchors sharing this sink are a follow-up ticket.

## 10. Open questions for HITL

- **OQ-1 · Which cards get the icon?** `event.conference?.url` presence is the stated rule, but
  the cards have states where an interactive control is questionable: `displayMode="placeholder"`
  (0.5 opacity, non-interactive), `displayMode="draft"`, `isDemo` sample events, and very small
  cards. **Proposed default:** suppress on `placeholder`, render everywhere else, and adopt a
  width gate matching each card's existing `REPEAT_ICON_MIN_WIDTH` (40 timed / 60 all-day).
  *Riding to Gate 2.*
- **OQ-2 · Drag-ghost clone.** Should the join attribute join `DRAFT_CLONE_STRIPPED_ATTRIBUTES`
  (`dom.ts:16-19`), or should the control be removed from the clone another way? Leaving it
  produces a focusable, non-functional duplicate anchor inside the drag ghost. **Proposed
  default:** strip it from the clone. `dom.ts` is allowlisted. *Riding to Gate 2.*
- **OQ-3 · RESOLVED at Gate 1.** URL scheme validation pulled into scope as AC-9 / FR-2.
- **OQ-4 · Accessible name content.** FR-4 requires the name to identify the event, i.e. the
  meeting title inside a link name ("Join Planning block"). Titles carry medium-sensitivity
  content (§7), but the card's existing `aria-label` already announces the title, so there is no
  net new exposure. **Proposed default:** include the title. *Riding to Gate 2.*
- **OQ-5 · CLOSED, no action.** Under `opus-plus-flash-v37` the `codegen` rule matches a fixed
  `task_type` list excluding the brownfield primitives `new_file_add` / `existing_file_edit`, so
  those packets fall through to `default: opus` rather than the mechanical tier. `phase: tests`
  does match and routes to `flash-agsdk-worker`. Per Gate-1 direction this is left exactly as-is
  and recorded in telemetry — it is part of what this arm measures.
- **OQ-6 · NEW BLOCKER — the two e2e specs cannot be built as specified.** Per §4.8: every e2e
  spec runs signed-out against local IndexedDB, conference is read-only and provider-sourced,
  the event form cannot set one, and no existing spec has ever had a conference-bearing event.
  The `event-smoke.spec.ts` pattern the new specs are meant to mirror cannot render the join
  icon at all. Three ways forward, needing a user decision:
  - **(A) Seed IndexedDB inline in each spec.** No eleventh path. Costs ~30-40 duplicated lines
    per spec and couples both to the Dexie record shape of the `compass-local` `events` store.
  - **(B) Add `e2e/utils/event-test-utils.ts` as an eleventh allowlisted path** and put one
    shared `seedEventWithConference` helper there. Matches repo convention — every other spec
    imports its setup from that file. **Recommended.** Requires re-opening Gate 0.
  - **(C) Drop the two specs from this run.** AC-8 reverts to a human-only browser check and the
    e2e coverage becomes a follow-up ticket. Cheapest; loses the automated guard, and with it
    the automated half of AC-5's nested-interactive check.

  Independently of A/B/C, the specs must avoid dragging *the conference-bearing card* to satisfy
  AC-4, because the local-mode bug (§2.8, §4.8) destroys `conference` on move and the icon would
  correctly disappear. **Proposed:** assert drag/resize against a second, conference-free event
  in the same spec, and leave the local-mode destruction untested and explicitly noted.
