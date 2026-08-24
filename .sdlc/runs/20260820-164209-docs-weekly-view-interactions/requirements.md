# Requirements — docs — "Weekly view interactions" README section

- **Run:** `20260820-164209-docs-weekly-view-interactions`
- **Mode / intent:** brownfield · `docs` (Phase 1 scoped to "what docs?", per the Intent matrix)
- **Task type for all packets:** `doc_update` (declared under `## Task type` in `intent_brief.md`)
- **Source brief:** `.sdlc/runs/20260820-164209-docs-weekly-view-interactions/intent_brief.md`
- **Write contract:** allowlist = `README.md` only; `packages/**` and `docs/**` off-limits

---

## 1. In scope

1. Add exactly one new section to root `README.md`, titled **"Weekly view interactions"**, at
   heading level `##` (same level as the existing `## Features`, `## Tech stack`,
   `## Getting started`, `## Resources`).
2. The section covers three already-shipped behaviors, each as a short end-user blurb:
   multi-day select/drag on the week grid, recurring events, and event colors.
3. The multi-day select blurb links out to `docs/frontend/week-drag-interaction.md`.
4. The recurring events blurb links out to `docs/acceptance/recurring-events.md`.
5. The event colors blurb is written fresh from the current `EventColorPicker` implementation
   (no existing doc exists to link to).
6. Placement: after `## Features` and before `## Tech stack` — the section is product-behavior
   content, so it belongs with the user-facing half of the README, not after the operational
   ("Getting started", "Resources") half.

## 2. Out of scope

1. Any file other than `README.md`. No source under `packages/**`, no docs under `docs/**`.
2. Authoring a new engineer-facing event-colors doc under `docs/` (explicit non-goal in the brief).
3. Editing `docs/frontend/week-drag-interaction.md` or `docs/acceptance/recurring-events.md`,
   including to fix the terminology gap recorded in §7 OQ-1.
4. Any application-code change, even one that would make a description more accurate — mismatches
   are flagged, never fixed (brief non-goal 3).
5. Restructuring, retitling, or rewording the README's existing sections.
6. Adding `.sdlc/` to `.gitignore` (Gate 0 declined; carried to the final report instead).

## 3. Functional requirements

### Module: `readme` — section skeleton

- **FR-1** — `README.md` gains one `##`-level heading whose text is `Weekly view interactions`.
- **FR-2** — The section contains three sub-blurbs, one per behavior, in this order:
  multi-day select, recurring events, event colors. Each is short (roughly 1–3 sentences or an
  equivalently sized bullet), matching the README's existing terse, second-person, benefit-first
  tone ("Find the perfect slot for an event with your keyboard").
- **FR-3** — Style is *summarize + link out*, not self-contained: no scenario tables, no key-by-key
  runbook steps, no implementation detail (no file paths, no class or component names such as
  `WeekInteractionCoordinator`, no `layout cache` / `updateVisual` internals) copied from `docs/`.
- **FR-4** — The section is inserted between `## Features` and `## Tech stack`; the byte content of
  every other line in `README.md` is unchanged.

### Module: `readme` — multi-day select blurb

- **FR-5** — Describes, in user terms, dragging an event across the week grid's day columns to
  move it to another day, and dragging the edge of an all-day event across days to span multiple
  days. Grounded in `docs/frontend/week-drag-interaction.md`, which documents both the
  timed-event day-column drag and the multi-day all-day span (clamped to the visible window).
- **FR-6** — Contains a relative Markdown link to `./docs/frontend/week-drag-interaction.md`,
  phrased as "how it works" / implementation detail rather than as user instructions.
- **FR-7** — May mention that dragging to the edge of the grid pages to the adjacent week
  mid-drag (`onRequestWeekNavigation` dwell behavior) — a genuinely user-visible behavior — but
  must not describe the paging as always "a week": the window pages by the number of visible day
  columns, which is 1–7 depending on viewport (`docs/frontend/responsive-layout.md`).

### Module: `readme` — recurring events blurb

- **FR-8** — Describes creating a repeating event and that editing or deleting one occurrence
  offers a scope choice.
- **FR-9** — The scope description must match the shipped UX as documented in
  `docs/acceptance/recurring-events.md`: the edit/delete applies to **This Event** immediately,
  and a transient toast then offers **This and Following** (`1`) and **All** (`2`). It must NOT be
  described as an up-front three-way modal, which is the common (and here incorrect) pattern.
- **FR-10** — Contains a relative Markdown link to `./docs/acceptance/recurring-events.md`,
  described as the full UX runbook / walkthrough.
- **FR-11** — Does not enumerate all ten runbook scenarios, and does not claim recurrence rule
  editing offers "This Event" — per the runbook, a structural rule change deliberately does not
  offer that scope.

### Module: `readme` — event colors blurb

- **FR-12** — States that an event can be tagged with one of **11** named colors from the event
  form's color picker, plus a "Calendar default" (no color) option that clears the tag.
  Verified against `EventColorSlotSchema` in
  `packages/core/src/types/event-color.contracts.ts`: `lavender`, `mint`, `plum`, `coral`, `gold`,
  `orange`, `blue`, `slate`, `indigo`, `green`, `red` — and `eventColorLabel(null) === "Calendar default"`
  in `packages/web/src/common/styles/theme.util.ts`.
- **FR-13** — States the color is saved on the event and shows on its card in the grid. Verified:
  `EventForm.tsx` patches the draft's `color` field from `EventColorPicker`, and both
  `TimedEventCard.tsx` and `AllDayEventCard.tsx` resolve their fill via `useEventPalette(color)`.
- **FR-14** — Naming the full color list is optional. If listed, the names must match
  `EVENT_COLOR_SLOT_LABEL` exactly (title case: Lavender, Mint, Plum, Coral, Gold, Orange, Blue,
  Slate, Indigo, Green, Red).
- **FR-15** — Must NOT claim any of the following, none of which the implementation supports:
  custom/arbitrary hex colors chosen by the user (the picker only ever writes a named slot;
  `colorHex` exists but is read-only, populated from a provider), per-calendar default colors set
  in Compass, color-based filtering or search, or color as a keyboard-shortcut-driven action.
- **FR-16** — Mentioning that colors round-trip with Google Calendar is permitted and accurate
  (`withColor` is applied in both `event-command.translation.ts` and `event-list.translation.ts`
  in the backend sync service; the slots map 1:1 onto Google's legacy 11 colors). If mentioned, it
  must be phrased as syncing the chosen color, not as importing arbitrary Google colors.
- **FR-17** — No link out for this blurb; there is no `docs/` page for event colors and this run
  is forbidden from creating one.

## 4. Non-functional requirements

- **NFR-1 · Correctness** — Every factual claim traces to code or an existing doc in this repo,
  as cited in FR-5 through FR-16. No inferred or aspirational behavior.
- **NFR-2 · Link validity** — Both outbound links resolve to files that exist at the repo root
  relative path used. Verified present: `docs/frontend/week-drag-interaction.md` (112 lines),
  `docs/acceptance/recurring-events.md` (266 lines). Link style matches the README's existing
  relative-link convention (`./docs/self-hosting/README.md` on line 49).
- **NFR-3 · Markdown hygiene** — Renders cleanly on GitHub: heading level consistent with
  siblings, no broken emphasis, no trailing whitespace, blank line before and after the new
  heading and any list.
- **NFR-4 · Diff minimality** — The change is purely additive. `git diff --stat README.md` shows
  insertions only, no deletions and no modified pre-existing lines.
- **NFR-5 · Tone** — Reads as product copy for a user evaluating Compass, consistent with the
  README's existing voice; no marketing superlatives the rest of the README doesn't use.
- **NFR-6 · Write contract** — The run writes to `README.md` and to
  `.sdlc/runs/20260820-164209-docs-weekly-view-interactions/**` and to nothing else.

## 5. PII inventory

| Field | Sensitivity | Protection |
|---|---|---|
| — | — | No PII. This run adds prose to a public README; it reads no user data, defines no data flow, and stores nothing. |

## 6. Role matrix

| Role | Resource | Action |
|---|---|---|
| README reader (public) | `README.md` | read — the only consumer of this change |
| Compass end user | Week view features described | unchanged by this run (documentation-only) |

No authorization surface is created or altered.

## 7. Acceptance criteria

1. `README.md` contains a `## Weekly view interactions` heading, located between `## Features`
   and `## Tech stack`.
2. That section covers all three behaviors: multi-day select, recurring events, event colors.
3. The multi-day select blurb contains a working relative link to
   `./docs/frontend/week-drag-interaction.md`.
4. The recurring events blurb contains a working relative link to
   `./docs/acceptance/recurring-events.md`.
5. The recurring blurb describes the scope choice as an after-the-fact toast offering
   "This and Following" / "All", not an up-front modal (FR-9).
6. The event colors blurb states 11 named colors plus a default/no-color option, that the color
   is saved on the event, and that it shows on the event's card in the grid (FR-12, FR-13).
7. The event colors blurb contains none of the FR-15 overclaims.
8. Each blurb is short — the whole section is under ~200 words.
9. `git status --porcelain` after the run lists `README.md` as the only modified path outside
   `.sdlc/`.
10. `git diff README.md` shows additions only (NFR-4).
11. Doc-lint (Phase 7) passes: relative links resolve, headings are well-formed, no trailing
    whitespace introduced.

## 8. Open questions for HITL

- **OQ-1 · "Multi-day select" is the brief's term, not the repo's.**
  `docs/frontend/week-drag-interaction.md` documents how a *saved* event's drag resolves the day
  column it lands on, and how an *all-day* event's multi-day span is committed as a date-diff
  delta. It does not document a distinct "multi-day select" gesture (e.g. click-drag across
  several empty day columns to create a draft spanning them). I found no such separately-named
  feature while reading. Plan of record: write the blurb as **"drag events across days"** —
  moving an event to another day, and stretching an all-day event across several — which is what
  the linked doc actually backs, and keep the brief's "multi-day" framing only for the all-day
  span. Say so at Gate 1 if you want the brief's literal wording used instead, or if there is a
  distinct multi-day-select gesture I should describe.

- **OQ-2 · Doc/implementation note, flagged not fixed (per brief non-goal 3).**
  The event colors feature has no `docs/` coverage at all, while the other two behaviors do. This
  run deliberately does not create one. Recommend a follow-up `docs` run to add
  `docs/frontend/event-colors.md` so the README blurb has somewhere to link, matching the other
  two entries' shape. No action needed now — noting it so it lands in the final report.

- **OQ-3 · Color list: name them or not?**
  FR-14 leaves this open. Naming all 11 costs a line and is concrete; omitting them keeps the
  blurb shorter and is more robust to palette changes. Default if you don't say: **omit the
  names**, state "11 colors", keep the section under the word budget.
