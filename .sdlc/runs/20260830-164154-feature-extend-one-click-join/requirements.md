# Requirements — feature-extend — One-click join icon on grid event cards

- **Run:** `20260830-164154-feature-extend-one-click-join`
- **Mode / intent:** brownfield / `feature-extend` (delta requirements)
- **Policy:** `opus-plus-flash-v37` · mechanical tier = `flash-completion` (Vertex ADC, `ai-studies-console`, global)
- **auth_mode:** `estimated`
- **Branch / anchor:** `CMP-103/opus-plus-flash-v37-t2` @ `2d81253a`
- **Source brief:** `.sdlc/runs/20260830-164154-feature-extend-one-click-join/intent_brief.md`
- **Turn-2 re-run of:** `20260821-113930-feature-extend-one-click-join` (same scope, shipped policy name)

This is a **delta** requirements document: it states only what changes relative to the code at
`2d81253a`. Everything not named here is an invariant that must survive the change.

---

## 1. In scope

1. A join affordance rendered by `TimedEventCard`, shown only when `event.conference` is present.
2. The same affordance rendered by `AllDayEventCard`, under the same condition.
3. A shared presentational component `EventJoinIcon.tsx` under
   `packages/web/src/grid/components/`, so the two cards cannot drift apart — mirroring the
   existing `EventRepeatIcon.tsx` precedent.
4. Opening `event.conference.url` in a new tab on activation, without triggering the card's own
   mousedown / select / drag / keyboard-open handlers.
5. A URL-scheme guard that refuses to open anything that is not `http:` or `https:`.
6. Co-existence with `EventRepeatIcon`: when an event is both recurring and has a conference
   link, the two glyphs must not overlap.
7. Narrow/short-card degradation for the join icon that matches the repeat icon's existing
   behaviour on each card.
8. New test coverage in `packages/web/src/grid/components/EventCard.test.tsx`.

## 2. Out of scope

1. Any change to how `conference` is derived or normalized (`packages/sync/**`) — off-limits.
2. Any change to the `conference` type contract
   (`packages/web/src/common/types/web.event.types.ts`, `packages/core/**`) — off-limits.
3. Any change to mutation/write paths (`packages/web/src/events/**`) — off-limits. `conference`
   must never enter a write payload.
4. Any change to the existing Join affordances in `UpNextCard` or `EventDetailsSection`
   (reference patterns only).
5. In-app meeting preview, embedded call UI, or provider-specific (Meet vs Zoom) branching.
6. Reconciling with sibling branch `CMP-105/opus-plus-flash-v37` (`649aea0c`), which edits the
   same render region. Accepted risk, recorded at Gate 0.
7. Adding `.sdlc/` to `.gitignore` (Gate 0 chose to leave `.gitignore` untouched, matching the
   original arm).

---

## 3. Baseline facts verified against the tree at `2d81253a`

These were read, not assumed. Two of them correct the intent brief.

| # | Fact | Evidence |
|---|---|---|
| B-1 | The conference field is **`url`**, not `uri`. `ConferenceSchema = z.strictObject({ url: z.url(), label: z.string()...nullable() })` | `packages/core/src/types/event-attendance.contracts.ts:31-35` |
| B-2 | `GridEvent.conference` is `ConferenceSchema.nullable().optional()` — so it is `Conference \| null \| undefined` | `packages/web/src/common/types/web.event.types.ts:88` |
| B-3 | Both existing Join affordances are plain `<a href target="_blank" rel="noopener noreferrer">`, **not** `window.open` | `UpNextCard.tsx:87-97`, `EventDetailsSection.tsx:46-58` |
| B-4 | `EventRepeatIcon` is `absolute right-1 bottom-0.5`, `pointer-events-none`, `aria-hidden`, size 10, colour `darken(baseColor, 30)` | `EventRepeatIcon.tsx:15-23` |
| B-5 | Timed card gates the repeat icon on `!isPlaceholder && durationMinutes >= 15 && position.width >= 40` | `TimedEventCard.tsx:57-58, 116-120` |
| B-6 | All-day card gates the repeat icon on `!isPlaceholder && position.width >= 60`, and reserves `pr-3.5` on the title row when the icon shows | `AllDayEventCard.tsx:32, 76-77, 188-191` |
| B-7 | Both cards are `role="button" tabIndex={0}` divs whose `onMouseDown` and `onKeyDown` (Enter/Space) drive selection/open; the all-day card's `onMouseDown` already calls `stopPropagation` unconditionally | `TimedEventCard.tsx:290-310`, `AllDayEventCard.tsx:162-176` |
| B-8 | Existing repeat-icon tests select the glyph via `container.querySelector('svg[class*="right-1"]')` — a new right-1 glyph would collide with those selectors | `EventCard.test.tsx:268-343` |

**B-1 correction:** the brief's "## Goal" section says `event.conference.uri`. The Gate 0 design
ruling correctly says `event.conference.url`. `url` is what exists. All requirements below use
`url`.

**B-8 consequence:** the join icon must **not** be placed at `right-1`, or four existing repeat
tests start passing/failing for the wrong reason. This is also the concrete form of requirement 6.

---

## 4. Functional requirements

### FR-1 — Shared join-icon component
Add `packages/web/src/grid/components/EventJoinIcon.tsx` exporting `EventJoinIcon`.

- Props: `{ baseColor: string; label?: string | null; url: string }`.
- Renders `VideoCameraIcon` from `@phosphor-icons/react`, size `10`, `weight="bold"`, tinted
  `darken(baseColor, 30)` — matching `EventRepeatIcon`'s treatment so the two glyphs read as one
  icon family (B-4).
- Positioned `absolute bottom-0.5`, horizontally **left of** the repeat slot, at a distinct
  class (see FR-5) so existing `svg[class*="right-1"]` selectors do not match it (B-8).

### FR-2 — Visibility condition
The join icon renders **iff** `event.conference` is truthy **and** `event.conference.url` passes
the scheme guard (FR-4) **and** the card's own icon-space gate allows it (FR-6).

- Absent entirely (no wrapper element, no reserved space) when `event.conference` is
  `null`/`undefined` — a non-conference card must be byte-for-byte unchanged in layout.

### FR-3 — Activation opens the link in a new tab
Activating the join control opens `event.conference.url` in a new tab.

- **Design ruling 1 (Gate 0, binding):** use `window.open(url, "_blank", "noopener,noreferrer")`.
- Activation is available by pointer (click) and by keyboard (Enter/Space), since the control is
  a real focusable control (FR-5).

> **Note for the architect (raised, not decided here).** Ruling 1 diverges from the repo's own
> two existing Join affordances, which are anchors (B-3). An anchor gets new-tab, keyboard
> activation, middle-click, "copy link address" and `rel=noopener` for free, and cannot be eaten
> by a popup blocker. `window.open` needs all of that hand-built. The ruling is binding for this
> run; the design should record the divergence explicitly and, if it keeps `window.open`, must
> satisfy FR-5's keyboard clause by hand. Flagged at Gate 1 for the user's awareness.

### FR-4 — URL-scheme guard
Before opening, the URL must be parsed and its protocol checked against an allowlist of
`http:` and `https:`.

- A URL that fails to parse, or whose protocol is anything else (notably `javascript:`,
  `data:`, `vbscript:`, `file:`), MUST NOT be opened.
- A conference whose `url` fails the guard MUST NOT render the icon at all (fail closed, FR-2) —
  a visible control that silently does nothing is worse than an absent one.
- The guard lives in the shared component (or a sibling util under
  `packages/web/src/grid/components/`) so both cards inherit it.

### FR-5 — Nested interactive control, isolated from the card
**Design ruling 2 (Gate 0, binding):** the join control is a nested interactive element with
`stopPropagation`, not folded into the card's group `aria-label`.

- The control has its own accessible name: `Join <label>` when `conference.label` is present,
  otherwise `Join meeting` — matching `EventDetailsSection`'s existing `label ?? "Join meeting"`
  fallback (B-3).
- It is focusable in its own right and reachable by keyboard.
- `onMouseDown`, `onClick` and `onKeyDown` on the control MUST call `stopPropagation()` (and
  `preventDefault()` where the card would otherwise act) so that:
  - the card's `onEventMouseDown` does not fire (no selection, no drag start),
  - the card's Enter/Space `onEventKeyDown` does not fire,
  - the all-day row's create handler is not reached.
- `onMouseDown` isolation specifically matters because both cards drive interaction from
  `mousedown`, not `click` (B-7) — stopping only `click` would still start a drag.

### FR-6 — Space-sharing with the repeat icon
**Design ruling 3 (Gate 0, binding):** always visible when `event.conference` is present;
degrades on narrow/short cards the same way `EventRepeatIcon` does.

- **Timed card:** the join icon is gated by the same predicate shape the repeat icon uses —
  `!isPlaceholder && durationMinutes >= 15 && position.width >= <width gate>` (B-5). Whether the
  width gate is the same `40` or a larger constant (because two glyphs need more room than one)
  is a design decision for Phase 2.
- **All-day card:** gated by `!isPlaceholder && position.width >= <width gate>` (B-6), and the
  title row's reserved right padding must grow when both icons show, so a long title still
  truncates before the icons rather than under them.
- When both icons render, they occupy adjacent, non-overlapping horizontal slots on the card's
  bottom-right. The repeat icon keeps its existing `right-1` position; the join icon sits
  further left.
- When only the join icon renders, it MAY still sit in the left slot (stable position beats
  reflow) — Phase 2 decides.

### FR-7 — Read-only contract preserved
No code path introduced by this change may place `conference` into an event mutation payload.
`packages/web/src/events/**` is off-limits at the write-contract level, so this is enforced
mechanically; the requirement is stated so the senior review checks it explicitly.

---

## 5. Non-functional requirements

- **NFR-1 — Write contract.** Every file written by this run is under
  `packages/web/src/grid/components/**`. Off-limits paths (frozen at Gate 0) are never touched.
- **NFR-2 — No new dependency.** `@phosphor-icons/react` is already a dependency (used by
  `UpNextCard` and `EventDetailsSection`). Nothing is added to `package.json`.
- **NFR-3 — Visual consistency.** The join glyph is `VideoCameraIcon`, matching the two existing
  Join affordances; no new visual language.
- **NFR-4 — Repo conventions.** Tailwind 4 utility classes via `classnames`/`cn`, `@web/*` path
  aliases, Biome formatting, named exports, TSDoc comment on the new component in the style of
  `EventRepeatIcon`'s.
- **NFR-5 — No regression.** `bun test:web` and `bun type-check` both pass. The pre-change
  baseline suite result is captured before any edit, so any new failure is attributable.
- **NFR-6 — Accessibility.** The join control has a non-empty accessible name, visible focus, and
  meets the repo's existing contrast approach (the glyph is tinted from the card fill, as the
  repeat icon is). The card's own `aria-label` is unchanged.
- **NFR-7 — Security.** `noopener,noreferrer` on the opened window (reverse-tabnabbing and
  referrer leakage), plus the FR-4 scheme guard against `javascript:` URLs arriving from a
  provider-sourced field.

---

## 6. PII / data-sensitivity inventory

| Field | Source | Sensitivity | Handling in this change |
|---|---|---|---|
| `event.conference.url` | Provider (Google `hangoutLink` / `conferenceData.entryPoints[].uri`) | **Medium** — a meeting URL is a bearer capability; anyone with it can often join | Rendered as a target for `window.open` only. Never logged, never persisted, never sent to a mutation. `noreferrer` prevents the destination learning the app origin. |
| `event.conference.label` | Provider (`conferenceSolution.name`) | Low | Used only in the control's accessible name. |
| `event.title` | User / provider | Medium | Untouched by this change. |

No new data is collected, stored, or transmitted. This is a render-only change over a field that
is already fetched and already rendered elsewhere in the app.

## 7. Role matrix

Not applicable in a meaningful sense — this is a client-side presentational change with no
authorization surface. For completeness:

| Role | Resource | Action | Effect of this change |
|---|---|---|---|
| Any signed-in user | Own/visible grid event | View join icon | New — visible iff the event they can already see carries a conference link |
| Any signed-in user | `conference.url` | Open in new tab | New — surfaces a URL already visible to them in `UpNextCard` / event form |
| Any user | `conference` | Write/modify | Unchanged — impossible; field stays read-only |

---

## 8. Acceptance criteria

Numbered so Phase 4 packets and Phase 7 tests can cite them.

1. **AC-1** — With `event.conference = { url: "https://meet.google.com/abc-defg-hij", label: "Google Meet" }`,
   `TimedEventCard` renders a join control.
2. **AC-2** — With `event.conference` absent (`undefined`) or `null`, `TimedEventCard` renders no
   join control and no reserved space for one.
3. **AC-3** — AC-1 and AC-2 hold identically for `AllDayEventCard`.
4. **AC-4** — Clicking the join control calls `window.open` with
   `(url, "_blank", "noopener,noreferrer")` and does **not** invoke the card's
   `onEventMouseDown`.
5. **AC-5** — Keyboard activation (Enter) on the join control opens the link and does **not**
   invoke the card's `onEventKeyDown`.
6. **AC-6** — With `conference.url = "javascript:alert(1)"`, no join control is rendered and
   `window.open` is never called.
7. **AC-7** — With an event that is both recurring and has a conference link, both glyphs render
   and their positioning classes differ (no overlap); the existing
   `svg[class*="right-1"]` repeat-icon assertion still resolves to exactly the repeat icon.
8. **AC-8** — On a too-narrow card (`position.width` below the gate), the join control is absent,
   matching the repeat icon's existing degradation. On a short timed event
   (duration < 15 min), likewise.
9. **AC-9** — The join control's accessible name is `Join Google Meet` when `label` is set and
   `Join meeting` when `label` is `null`.
10. **AC-10** — `bun test:web` passes with no failures that were not present in the pre-change
    baseline capture.
11. **AC-11** — `bun type-check` passes.
12. **AC-12** — `git diff --name-only` after the run lists only files under
    `packages/web/src/grid/components/`.

---

## 9. Open questions for HITL

1. **OQ-1 (design-level, deferred to Gate 2).** Ruling 1 mandates `window.open`, but the repo's
   two existing Join affordances are anchors (B-3), which get keyboard activation, new-tab
   semantics, middle-click and popup-blocker immunity for free. Confirm you want `window.open`
   kept, or say the word and Phase 2 will use a nested `<a>` with `stopPropagation` (which
   satisfies rulings 2 and 3 unchanged and matches the repo pattern). **Default if you say
   nothing: keep ruling 1 as written.**
2. **OQ-2.** The brief said `conference.uri`; the field is `conference.url` (B-1). Proceeding
   with `url`. No action needed unless you disagree.
3. **OQ-3 (informational).** Requirement FR-6 leaves the exact width gate constants to Phase 2.
   If you have a preference (reuse `40`/`60` vs. widen when two icons show), say so at Gate 2.
