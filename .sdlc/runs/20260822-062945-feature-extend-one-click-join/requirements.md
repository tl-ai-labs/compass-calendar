# Delta Requirements — CMP-103 — One-click join icon on event cards

**Run:** `20260822-062945-feature-extend-one-click-join`
**Intent:** `feature-extend` (delta requirements form)
**Policy:** `opus-only-v5` · **auth_mode:** `estimated`
**Branch:** `CMP-103/opus-only-v5` (zero diff vs `main` @ `4189de13` at run start)

---

## 0. Delta baseline — what already exists

This is a *delta* requirements doc: it states only what changes relative to the current `main`.
Verified against the source at run start (not assumed from prior attempts):

| Fact | Evidence |
|---|---|
| `GridEvent` already carries `conference` | `packages/web/src/common/types/web.event.types.ts:88` — `conference: ConferenceSchema.nullable().optional()` |
| `Conference` shape is `{ url, label }` | `packages/core/src/types/event-attendance.contracts.ts:31-35` — `url: z.url()`, `label: string(1..256) \| null` |
| The grid view-model populates it | `packages/web/src/events/queries/event.view-model.ts:94` — `conference: details?.conference` |
| A one-click join precedent already exists | `packages/web/src/components/Sidebar/UpNextCard/UpNextBanner.tsx:32` — `window.open(conferenceUrl, "_blank", "noopener,noreferrer")` |
| Sibling card-icon precedent | `packages/web/src/grid/components/EventRepeatIcon.tsx` — decorative, `aria-hidden`, absolutely positioned bottom-right, `darken(baseColor, 30)` tint |
| Icons wrap Phosphor | `packages/web/src/components/Icons/Repeat.tsx` |

**Consequence (important):** no upstream plumbing is required. The cards receive `conference.url`
directly on their `event` prop. This is what makes the feature a pure two-card + one-component delta.

### Correction to the intent brief's file scope

The intent brief lists `packages/web/src/grid/components/EventCard.test.tsx` as **(new)**. It is
**not new** — it is an existing 575-line file tracked in `main`
(`git ls-tree main` confirms). This run therefore treats it as an **edit / test-backfill**, never a
create. Writing it as a new file would destroy 575 lines of existing card tests. Flagged at Gate 1;
the write-contract allowlist entry is unchanged (the path is identical), only the packet's
`task_type` changes from `new_file_add` to `existing_file_edit`.

---

## 1. In scope

1. A new presentational component `EventJoinIcon` that renders a clickable join affordance for an
   event that has a conference URL.
2. `TimedEventCard` renders `EventJoinIcon` when `event.conference?.url` is present.
3. `AllDayEventCard` renders `EventJoinIcon` when `event.conference?.url` is present.
4. Clicking the icon opens the conference URL in a new tab and does **not** trigger the card's
   own open-event behavior.
5. Keyboard operability of the icon, and an accessible name that is distinct from the card's.
6. Test coverage appended to the existing `EventCard.test.tsx`.
7. `.gitignore` gains a `.sdlc/` entry (confirmed at Gate 0; `baseline.gitignore_covers_sdlc: false`).

## 2. Out of scope

1. Any change to how conference links are detected, normalized or synced (`packages/sync`,
   `packages/core` contracts, `event.view-model.ts`) — the data is already there.
2. Any change to the other five card/consumer surfaces named off-limits in the write contract
   (`UpNextCard.tsx`, `AllDayEvent.tsx`, `GridDraft.tsx`, `GridEvent.tsx`,
   `DayCalendarEventCards.tsx`).
3. Redesign of card layout beyond placing one icon.
4. Changing `UpNextBanner`'s existing join behavior or its `V` shortcut.
5. Any new dependency. Phosphor icons and `classnames` are already present.

---

## 3. Functional requirements

### Module: `EventJoinIcon` (new file)

- **FR-1** `EventJoinIcon` accepts at minimum `{ url: string; baseColor: string }` and renders an
  interactive element carrying the conference URL.
- **FR-2** It renders a video-call glyph sourced from the existing Phosphor wrapper convention
  (`@web/components/Icons/*`), tinted from `baseColor` the same way `EventRepeatIcon` tints
  (`darken(baseColor, 30)`), so it complements the event fill in both themes.
- **FR-3** Activating it opens `url` via `window.open(url, "_blank", "noopener,noreferrer")` —
  matching `UpNextBanner.tsx:32` exactly. `noopener,noreferrer` is mandatory (see NFR-4).
- **FR-4** It **stops propagation** on `mousedown` and on `click`, so the card's
  `onEventMouseDown` / open-event handler does not also fire. This is the single highest-risk
  behavior in the delta: both cards bind `onMouseDown` on the root, and `TimedEventCard`'s handler
  starts a drag.
- **FR-5** It is a real focusable control with an accessible name naming the action and, when
  available, the provider label — e.g. `Join <label>` falling back to `Join video call`. It must
  **not** be `aria-hidden` (unlike `EventRepeatIcon`, which is decorative because recurrence is
  already in the card's `aria-label`; a join action is not announced anywhere else).
- **FR-6** Keyboard: `Enter` and `Space` activate it, and the activation must not bubble to the
  card's `onKeyDown` (which calls `onEventKeyDown` → opens the event form).

### Module: `TimedEventCard` (edit)

- **FR-7** Compute `showJoinIcon` from `event.conference?.url` being a non-empty string.
- **FR-8** Suppress the icon when `displayMode === "placeholder"` (matching `showRepeatIcon`'s
  `!isPlaceholder` guard) — a placeholder is a ghost, not an actionable card.
- **FR-9** Apply a minimum-size gate consistent with the existing repeat-icon gating so the icon
  never overflows a tiny card. Reuse the established constants pattern in `grid.constants` /
  local module constants rather than inventing inline magic numbers.
- **FR-10** When both the repeat icon and the join icon are shown, they must not overlap. The
  repeat icon is pinned `absolute right-1 bottom-0.5`; the join icon needs a non-conflicting slot.

### Module: `AllDayEventCard` (edit)

- **FR-11** Same conference-presence condition as FR-7.
- **FR-12** Suppress when `isPlaceholder` is true.
- **FR-13** The title row already reserves `pr-3.5` when `showRepeatIcon`; that reservation must
  be extended to account for the join icon so a long title truncates before the icon rather than
  running under it.

### Cross-cutting

- **FR-14** Events **without** a conference URL must render byte-identically to today: no icon
  node, no added padding, no layout shift, no changed `aria-label`.

---

## 4. Non-functional requirements

- **NFR-1 (No regression)** The full `bun test:web` suite stays green. Baseline is **2298 passing**
  (per intent brief). The 575-line `EventCard.test.tsx` must keep all existing assertions passing —
  the file is appended to, never rewritten.
- **NFR-2 (Type safety)** No `any`, no non-null assertion on `conference`. `bun type-check` clean.
- **NFR-3 (Lint/format)** Biome clean; the repo's `.cursor/rules/web-styles` conventions
  (Tailwind utility classes, `cn`) are followed. Existing `biome-ignore` comment style is respected.
- **NFR-4 (Security — reverse tabnabbing)** `window.open` to a third-party, event-supplied URL
  MUST pass `noopener,noreferrer`. Without it the opened page gets `window.opener` and can
  navigate the calendar tab to a phishing page. Non-negotiable.
- **NFR-5 (Accessibility)** Icon has an accessible name, is keyboard reachable, and meets the
  repo's stated 4.5:1 contrast bar that the surrounding card code repeatedly defends. The card's
  own `role="button"` must not end up with a nested interactive descendant that breaks its
  semantics more than the existing code already does — document the tradeoff if unavoidable.
- **NFR-6 (No new deps)** Zero additions to any `package.json`.

---

## 5. PII / sensitive-data inventory

| Field | Sensitivity | Handling in this delta |
|---|---|---|
| `event.conference.url` | Medium — a meeting URL is a capability token; possession often grants join rights | Rendered as an `href`/`window.open` target only. **Must not** be logged, sent to analytics, or placed in a `title`/tooltip that could be screenshotted into a bug report. Not persisted anywhere new. |
| `event.conference.label` | Low — provider name (e.g. "Google Meet") | Safe to use in the accessible name. |
| `event.title` | Medium | Unchanged by this delta. |

**PII-1** No new logging, telemetry, or network call may be introduced by this feature.
**PII-2** The conference URL must not be written into any DOM attribute that is not required for
the click behavior. If an anchor is used, `href` is required and acceptable; a redundant
`data-*` copy of the URL is not.

---

## 6. Role matrix

Not applicable in the traditional sense — this is a client-side rendering change with no
authorization surface. The one relevant distinction:

| Actor | Resource | Action | Rule |
|---|---|---|---|
| Any signed-in user viewing their grid | An event they can see | Join via icon | Allowed iff `conference.url` is present on the event the user already has read access to |
| Any user | A `busy`-content event (`content.kind === "busy"`) | Join | **Not possible** — `busy` events carry no `conference` field by contract, so FR-7's condition is false. No extra guard needed, but a test should pin it. |
| Any user | A placeholder/draft card | Join | Suppressed per FR-8 / FR-12 |

---

## 7. Acceptance criteria

1. **AC-1** A timed event with `conference.url` renders an element with an accessible name matching
   `/join/i`; a timed event without `conference` renders none.
2. **AC-2** Same as AC-1 for `AllDayEventCard`.
3. **AC-3** Clicking the join control calls `window.open` with the exact conference URL, `"_blank"`,
   and a features string containing both `noopener` and `noreferrer`.
4. **AC-4** Clicking the join control does **not** invoke the card's `onEventMouseDown`.
5. **AC-5** Activating the join control via keyboard does **not** invoke `onEventKeyDown`.
6. **AC-6** A placeholder card with a conference URL renders no join control (both card types).
7. **AC-7** Every pre-existing assertion in `EventCard.test.tsx` still passes, and the file's
   existing 575 lines are preserved (diff shows additions only, plus any import-line edits).
8. **AC-8** `bun test:web` is green with pass count >= 2298 + the new cases.
9. **AC-9** `bun type-check` and `bun lint` are clean.
10. **AC-10** `.gitignore` contains a `.sdlc/` entry, appended — no existing entry removed or
    reordered.

---

## 8. Open questions for HITL (Gate 1)

- **Q1 — `EventCard.test.tsx` is an existing file, not new.** Confirmed above. I intend to
  **append** tests via an `existing_file_edit` packet with a diff-preview mini-gate before the
  write. Confirm this is what you want (the alternative — a separate `EventJoinIcon.test.tsx` —
  would leave the allowlist path unused and is *not* in the frozen write contract, so it would
  require reopening Gate 0).
- **Q2 — Icon placement when the repeat icon is also present (FR-10).** The repeat icon owns
  `bottom-right`. Options: (a) join icon at bottom-right and repeat shifts left; (b) join icon
  top-right; (c) join icon left of repeat. Prior accepted attempts converged on a shape I have
  deliberately not read, per the "treat as from-scratch" instruction. I will let the architect
  decide at Gate 2 unless you have a preference now.
- **Q3 — Anchor vs button.** An `<a href>` gives free middle-click/"open in new tab" and correct
  semantics, but nests an interactive element inside the card's `role="button"`. A `<button>` with
  `window.open` avoids the href but loses middle-click. Both cards already carry
  `biome-ignore lint/a11y/useSemanticElements` comments acknowledging the root is a non-semantic
  button. Architect's call at Gate 2; flagging because it affects NFR-5.
- **Q4 — Scope of `bun test:web`.** Gate 0 confirmed `bun test:web`. Note `AGENTS.md` prefers the
  focused package command, so this is consistent. No action needed unless you want the full
  `bun test`.
