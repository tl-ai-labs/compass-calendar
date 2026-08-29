# Senior code review — attendee avatar badge on grid event cards

- **Run:** `20260829-122202-feature-extend-attendee-avatar-badge`
- **Mode / intent:** brownfield · `feature-extend`
- **Scope:** the 9 changed files only. Pre-existing smells elsewhere are out of scope
  and are not reported.
- **Reviewer checks run:**
  - `bunx typescript@7.0.2 -p packages/web/tsconfig.app.json --noEmit` → **clean**
  - `bunx typescript@7.0.2 -p packages/web/tsconfig.test.json --noEmit` → **clean**
  - `bun packages/scripts/src/testing/check-semantic-colors.ts` → **exit 0**
  - `bunx biome check <the 9 files>` → **4 errors, 2 warnings**
  - `bun test ./src/grid/components/EventAttendeeBadge.test.tsx
    ./src/common/styles/attendee-status.styles.test.ts
    ./src/grid/components/EventCard.test.tsx` (from `packages/web`) →
    **46 pass / 0 fail / 130 expect() calls**. The `act(...)` warnings are the
    pre-existing noise NFR-5 already excuses.
  - Full suite deliberately **not** run (orchestrator owns that phase).

---

## Verdict

**CHANGES REQUIRED** — one blocker, mechanical and zero-risk (biome errors in the new
files break AC-7 for the changed set). Everything load-bearing is correct:
NFR-2 holds, NFR-1/3/4/6/7 hold, FR-A*/B*/C*/D*/E* are implemented as designed, and
FR-F1–F5 are covered. Fix the four formatter/import-order errors and this is an
approve.

### Things I verified rather than assumed

- **NFR-2 (absent/empty attendee path byte-identical)** — **holds.** The entire
  no-attendee delta in both cards is a `{showAttendeeBadge && <EventAttendeeBadge …/>}`
  expression, which React renders as nothing (no text node, no comment node, no
  wrapper). No existing `className` string, attribute, element, or child order was
  edited in either card — I diffed both files whole, not just the hunks.
  The one non-JSX change, `TimedEventCard.tsx:139-149`, is arithmetically identical on
  the false path:
  `(showTimeLabel ? GRID_EVENT_TIME_LABEL_LINE_HEIGHT : 0) + (false ? … : 0)`
  reduces to exactly the old `showTimeLabel ? h - LINE_HEIGHT : h`. The added
  `showAttendeeBadge` dep only affects memo identity, never output.
  (I could not produce a byte-level `innerHTML` diff against `HEAD` — the sandbox
  refuses scratch files both inside and outside the repo — so this is a structural
  proof plus the 46 green tests, not a captured DOM dump. Given the shape of the diff
  the structural proof is total, not probabilistic.)
- **NFR-6 (render cost)** — **holds.** No `useEffect`, no store subscription, no new
  context read. Derivation is `slice(0, 3)` + a label built from the visible slice
  only, i.e. O(cap) not O(attendees). The badge is not `memo`-wrapped, which is
  *consistent* with the surrounding cards: `TimedEventCard`/`AllDayEventCard` are bare
  `forwardRef(...)` with no `memo`, and `EventRepeatIcon` is not memoized either.
  Adding `memo` here would be inconsistent, not an improvement.
- **NFR-1 (semantic tokens)** — **holds.** `check-semantic-colors.ts` exits 0. Every
  class used (`success`, `error`, `warning`, `text-subtle`, `text`, `text-muted`,
  `surface-raised`, `border-strong`) resolves to a `@theme inline` token in
  `packages/web/src/index.css` (lines 106–123). No hex, no rgb, no raw palette class.
  `ring-<token>` is a proven pattern in this codebase (`ring-accent` at
  `index.css:261`), so Tailwind will emit the eight literals.
- **NFR-3 (no API break)** — **holds.** Neither `TimedEventCardProps` nor the exported
  `AllDayEventCardProps` is touched. The only new prop is `className` on
  `EventAttendeeBadge`'s *unexported* `interface Props`. AC-10 satisfied.
- **FR-E3 (EventDetailsSection output unchanged)** — **holds.** The only edit is the
  import swap; the two call sites (`attendeeStatusLabel` at line 69,
  `ATTENDEE_STATUS_DOT[...]` in the dot `className` at line 79) are character-identical
  to before, and `attendeeStatusLabel`'s body was moved verbatim. AC-6 satisfied:
  `ATTENDEE_STATUS_DOT` now appears only at the import (line 5) and the usage (line 79).
- **Constant comments are accurate**, which matters because they are load-bearing
  documentation: `MIN_EVENT_WIDTH_FOR_TIME_LABEL = 90`,
  `MIN_EVENT_HEIGHT_FOR_TIME_LABEL = 36`, `GRID_EVENT_TIME_LABEL_LINE_HEIGHT = 13`,
  `GRID_EVENT_TITLE_LINE_HEIGHT_PX = 16`, `GRID_EVENT_TITLE_VERTICAL_SLACK_PX = 7`,
  `COMPACT_EVENT_MAX_HEIGHT = 15`, `EVENT_ALLDAY_HEIGHT = 20`. Every number cited in
  `attendee-badge.constants.ts` checks out.
- **No dead code.** All four badge constants are consumed; `ATTENDEE_STATUS_CLASSES`,
  `ATTENDEE_STATUS_DOT`, `ATTENDEE_STATUS_RING`, `attendeeStatusLabel` all have live
  consumers.
- **No regression risk from the new badge text.** Only `EventCard.test.tsx`,
  `EventAttendeeBadge.test.tsx`, `EventForm.test.tsx` and `useUndoRedo.test.tsx`
  mention `attendees` anywhere in `packages/web/src`; no other grid test renders a card
  with attendees, so no existing fixture silently grows a badge.

---

## Blocker

### B-1 — `bun lint` has 4 new biome **errors** inside the changed set (AC-7)

`bunx biome check` on the 9 files reports 4 errors, all in files this run created or
edited, all auto-fixable:

| File | Diagnostic |
|---|---|
| `packages/web/src/grid/components/TimedEventCard.tsx:373` | `format` — the badge JSX line is 82 cols, over the 80-col `lineWidth`; biome wants it wrapped in parens |
| `packages/web/src/grid/components/EventAttendeeBadge.test.tsx:1:1` | `assist/source/organizeImports` — the `@core/...` import sits after the relative `./` imports |
| `packages/web/src/grid/components/EventAttendeeBadge.test.tsx` (3 sites: L45-48, L66-69, L73-76, L141-145) | `format` — `render(...)` calls needlessly split across lines |
| `packages/web/src/common/styles/attendee-status.styles.test.ts:1:1` | `assist/source/organizeImports` |

Exact expected output for `TimedEventCard.tsx:373`:

```tsx
        {showAttendeeBadge && (
          <EventAttendeeBadge attendees={event.attendees} />
        )}
```

**Scoping note for the orchestrator, so nobody chases a ghost:** `bun lint` at repo
root also exits 1 for three `.sdlc/**` JSON format errors. I confirmed
`.sdlc/baseline/current.json` fails biome's formatter *at `HEAD` too*
(`git show HEAD:.sdlc/baseline/current.json | biome check --stdin-file-path=current.json`
→ "contents aren't fixed"), so that part of AC-7 was already red before this run and is
outside the frozen allowlist. **Only the 4 errors in the table above are this run's
debt.** After fixing them, `bunx biome check <the 9 files>` must exit 0.

**Fix:** `bunx biome check --write` on those three files. Do not use
`--write --unsafe` — that would also apply the `useSortedClasses` unsafe fix in
`EventAttendeeBadge.tsx`, which is a separate (minor) item below.

---

## Major

*None.*

---

## Minor

### M-1 — `EventAttendeeBadge.tsx:60` — the badge's `aria-label` is currently exposed to no assistive tech

**Advisory, not a change request — I am not reopening ADR-4's accepted a11y ceiling.**
But ADR-4 records a factual claim that turns out to be wrong, and the reviewer's job is
to say so rather than let it stand as documented truth.

The root is a role-less `<div>`. `aria-label` is not a supported ARIA property on the
implicit `generic` role, so it is dropped by user agents — and every descendant carries
`aria-hidden="true"`, so the badge contributes *nothing* to the accessibility tree, not
even in browse mode. ADR-4's stated consequence ("the badge's label is reachable in
browse mode and by tooling") holds for tooling and for RTL's `getByLabelText`, but not
for a screen reader. FR-B7 ("the group carries a label summarising the guest count and
per-status breakdown") is therefore satisfied in source but not in effect.

biome agrees: `lint/a11y/useAriaPropsSupportedByRole` fires at
`EventAttendeeBadge.tsx:60` — *"The ARIA attribute 'aria-label' is not supported by this
element."*

This does **not** fail `bun lint`: `biome.json` sets both
`useAriaPropsSupportedByRole` and `useSemanticElements` to `"warn"`, and the repo
already ships 12 warnings.

I probed the fix ADR-4 rejected. Adding `role="img"` to the root:

- clears `useAriaPropsSupportedByRole` (`img` is a name-from-author role), and
- does **not** trip `useSemanticElements` — I ran the modified file through
  `biome check --stdin-file-path=...` and the only remaining diagnostic was the
  pre-existing `useSortedClasses` one. ADR-4's stated reason for rejecting `role="img"`
  ("risks a biome `useSemanticElements` diagnostic whose `biome-ignore` suppression
  would itself be reported as unused") does not reproduce.

It also does not touch the card's `aria-label`, so FR-C3 is untouched either way.

**Recommendation:** either add `role="img"` (one line, no test change needed — the
existing `getByLabelText` assertions keep passing), or amend ADR-4's Consequence
paragraph to say the label is reachable *by tooling and tests only*, not in browse mode.
Silently leaving both the wrong claim and the warning in place is the one option I would
not take. Your call which — this is not gating.

### M-2 — `EventAttendeeBadge.tsx:63` — `lint/nursery/useSortedClasses` warning

`"-space-x-1 pointer-events-none flex shrink-0 items-center"` should be
`"pointer-events-none flex shrink-0 items-center -space-x-1"`. Cosmetic, warning-level,
but it is new debt from this run and the fix is free. (Biome marks the fix "unsafe" only
because class reordering can change specificity; these utilities do not overlap, so it
is safe here.)

### M-3 — `EventAttendeeBadge.test.tsx:177` — CSS-selector assertion violates the house rule

```ts
expect(container.querySelector("[tabindex]")).toBeNull();
```

`AGENTS.md:82` says *"Web tests should use React Testing Library, semantic
role/name/text queries, and `user-event`; avoid CSS selectors and `data-*` locators."*
The in-file comment justifies avoiding a behavioural `mouseDown` test (correct — jsdom
has no pointer-events hit testing), but it does not justify the selector.

**Fix:** assert the absence of focusables semantically and the root attribute directly:

```ts
expect(screen.queryAllByRole("button")).toHaveLength(0);
expect(screen.getByLabelText(/guests/)).not.toHaveAttribute("tabindex");
```

### M-4 — `EventCard.test.tsx:664-676` — `hiddenInitials` diverges from the production algorithm

```ts
const hiddenInitials = (hidden.displayName ?? "")
  .split(/\s+/)
  .map((word) => word[0] ?? "")
  .join("")
  .toUpperCase();
```

The production `attendeeInitials` (`EventAttendeeBadge.tsx:18-29`) applies
`.slice(0, 2)` and `.trim()`; this copy applies neither. It happens to agree today only
because every name in the local `roster` is exactly two words. Add a three-word name to
the roster later and this assertion silently starts querying for a string the DOM never
contains, so `queryByText(...)` returns `null` for the wrong reason and the test passes
vacuously.

**Fix:** hard-code the expected monogram (`expect(screen.queryByText("DF")).toBeNull()`)
— the roster is a local literal, so a literal expectation is both clearer and
non-vacuous. Same reasoning applies to `initialsOf` in `EventAttendeeBadge.test.tsx:20-27`,
which re-implements the production algorithm and therefore cannot detect a bug in it;
that one is lower risk because AC-5's three cases are asserted against literals
elsewhere in the file.

### M-5 — AC-4's "exactly `cap` circles" half is not asserted

AC-4 requires *"renders exactly `cap` circles and one chip reading `+3`"*. Both overflow
tests (`EventCard.test.tsx:648`, `EventAttendeeBadge.test.tsx:141`) assert the chip text
and that one hidden attendee's initials are absent, but neither asserts the *count* of
rendered circles. A regression that rendered 2 circles + the correct `+3` chip would
pass today.

**Fix:** in `EventAttendeeBadge.test.tsx`'s overflow test, assert each visible monogram
is present and count them, e.g.

```ts
for (const name of NAME_POOL.slice(0, ATTENDEE_BADGE_MAX_VISIBLE)) {
  expect(screen.getByText(initialsOf(name))).toBeInTheDocument();
}
```

paired with the existing absence assertion for the first hidden one. That pins both ends
of the cap without a `querySelectorAll`.

---

## Nits

- **N-1 — `EventAttendeeBadge.tsx:69`, `key={attendee.email}`.** `AttendeeSchema` does
  not enforce uniqueness and providers do occasionally repeat an address across
  attendee entries. A duplicate yields a React duplicate-key warning and
  mis-reconciliation. `key={`${attendee.email}-${index}`}` from the `.map` index is safe
  here because the list is a stable slice of a stable array. Low likelihood; free to
  harden.
- **N-2 — `attendee-badge.constants.ts:18`, `ATTENDEE_BADGE_ROW_HEIGHT = 14`
  under-reserves.** The circles are `size-3.5` (14px) *plus* `ring-2`, and a Tailwind
  ring is an outset box-shadow, so the drawn row is ~18px. The `lineClamp` reserve is
  14. `change_plan.md` §9 already accepts a tight fit at exactly 52px; this just names
  the specific 4px. Tunable via the one constant if it looks wrong in the browser.
- **N-3 — two-character monogram in a 14px circle.** `text-xs` is 12px; "AL" at 12px is
  ~13-15px wide inside a 14px circle with `shrink-0` on the span. Expect slight
  horizontal overflow past the circle edge. jsdom cannot catch this — it needs one
  look in a real browser before merge. Not a code defect; flagging because nothing else
  in the pipeline will.
- **N-4 — placeholder cards render the badge.** `showAttendeeBadge` in both cards omits
  the `!isPlaceholder` guard that `showRepeatIcon` uses
  (`AllDayEventCard.tsx:79`, `TimedEventCard.tsx:124`). Dragging a saved Google event
  produces a 50%-opacity ghost that keeps its attendee badge but loses its repeat icon.
  Arguably the badge *should* stay on the ghost; either way it is now inconsistent with
  the neighbouring chrome and was not a stated decision. Worth one line in ADR notes or
  one `&& !isPlaceholder`.
- **N-5 — import-path inconsistency.** `EventAttendeeBadge.tsx:8` imports the constants
  via the `@web/grid/components/...` alias; both test files import the same module via
  `./attendee-badge.constants`. Both are legal per `AGENTS.md`; pick one.
- **N-6 — `projectVariant`'s `as Record<...>` cast (`attendee-status.styles.ts:37`).**
  Correctly documented, and `ATTENDEE_STATUS_CLASSES` above it is the real exhaustiveness
  gate, so the cast cannot mask a missing member. Noting only so a future reader does not
  "simplify" by deleting the total `Record` annotation on line 16-19, which is where the
  compile error actually comes from.

---

## Refinement packets

```json
[
  {
    "id": "rp_review_001",
    "task_type": "lint-fix",
    "module": "web/grid",
    "severity": "blocker",
    "instruction": "Fix the biome formatter error in TimedEventCard.tsx. The line `{showAttendeeBadge && <EventAttendeeBadge attendees={event.attendees} />}` at line 373 exceeds the 80-column lineWidth configured in biome.json. Wrap it exactly as biome's formatter prints it:\n\n        {showAttendeeBadge && (\n          <EventAttendeeBadge attendees={event.attendees} />\n        )}\n\nChange NOTHING else in this file. Do not touch the imports, the showAttendeeBadge const, the lineClamp useMemo, or any className. Run `bunx biome check packages/web/src/grid/components/TimedEventCard.tsx` from the repo root and confirm it reports zero errors before finishing.",
    "artifact_path": "packages/web/src/grid/components/TimedEventCard.tsx",
    "acceptance": [
      "bunx biome check packages/web/src/grid/components/TimedEventCard.tsx exits 0",
      "git diff on this file shows exactly one changed hunk, at the badge JSX line",
      "bunx typescript@7.0.2 -p packages/web/tsconfig.app.json --noEmit is clean",
      "the rendered output is unchanged: the JSX expression is still `showAttendeeBadge && <EventAttendeeBadge attendees={event.attendees} />`"
    ]
  },
  {
    "id": "rp_review_002",
    "task_type": "lint-fix",
    "module": "web/grid",
    "severity": "blocker",
    "instruction": "Fix the biome errors in EventAttendeeBadge.test.tsx: (1) assist/source/organizeImports at 1:1 — the `@core/types/event-attendance.contracts` import currently sits after the relative `./EventAttendeeBadge` and `./attendee-badge.constants` imports and must be reordered per biome's import assist; (2) four formatter errors where `render(...)` calls are split across lines that fit within 80 columns (the tests at lines ~45, ~66, ~73, and the NAME_POOL.slice(...).map(...) at ~141). The mechanical fix is `bunx biome check --write packages/web/src/grid/components/EventAttendeeBadge.test.tsx` from the repo root. Do NOT pass --unsafe. Do not add, remove, or rename any test case, and do not change any assertion.",
    "artifact_path": "packages/web/src/grid/components/EventAttendeeBadge.test.tsx",
    "acceptance": [
      "bunx biome check packages/web/src/grid/components/EventAttendeeBadge.test.tsx exits 0",
      "the file still contains exactly 12 `it(` blocks with unchanged titles",
      "from packages/web, `bun test ./src/grid/components/EventAttendeeBadge.test.tsx` reports 12 pass / 0 fail",
      "no assertion text changed — diff is whitespace and import order only"
    ]
  },
  {
    "id": "rp_review_003",
    "task_type": "lint-fix",
    "module": "web/common",
    "severity": "blocker",
    "instruction": "Fix the assist/source/organizeImports error at 1:1 in attendee-status.styles.test.ts by running `bunx biome check --write packages/web/src/common/styles/attendee-status.styles.test.ts` from the repo root. Do NOT pass --unsafe. Do not change any test body or assertion.",
    "artifact_path": "packages/web/src/common/styles/attendee-status.styles.test.ts",
    "acceptance": [
      "bunx biome check packages/web/src/common/styles/attendee-status.styles.test.ts exits 0",
      "from packages/web, `bun test ./src/common/styles/attendee-status.styles.test.ts` reports 6 pass / 0 fail",
      "diff is import order only"
    ]
  },
  {
    "id": "rp_review_004",
    "task_type": "lint-fix",
    "module": "web/grid",
    "severity": "minor",
    "instruction": "Two warning-level cleanups in EventAttendeeBadge.tsx, both one-liners. (1) lint/nursery/useSortedClasses at line 63: change the root's first class string from \"-space-x-1 pointer-events-none flex shrink-0 items-center\" to \"pointer-events-none flex shrink-0 items-center -space-x-1\". These utilities do not overlap, so reordering is behaviourally inert. (2) lint/a11y/useAriaPropsSupportedByRole at line 60: add `role=\"img\"` as the first prop on the badge root <div>, immediately before the existing aria-label. `aria-label` is not a supported ARIA property on a role-less div (implicit role `generic`), so today the label is dropped by user agents while every child is aria-hidden — the badge reaches the accessibility tree not at all. `role=\"img\"` is a name-from-author role, which makes the label valid. I verified via `biome check --stdin-file-path` that role=\"img\" clears this warning and does NOT trigger useSemanticElements, contrary to what change_plan.md ADR-4 assumed. Do not add a biome-ignore comment. Do not touch the card components' aria-label (FR-C3). Do not change the label string, the cap, the initials logic, or any other class.",
    "artifact_path": "packages/web/src/grid/components/EventAttendeeBadge.tsx",
    "acceptance": [
      "bunx biome check packages/web/src/grid/components/EventAttendeeBadge.tsx reports 0 errors and 0 warnings",
      "the root div has role=\"img\" and its aria-label expression is byte-identical to before",
      "no biome-ignore comment was added",
      "from packages/web, `bun test ./src/grid/components/EventAttendeeBadge.test.tsx ./src/grid/components/EventCard.test.tsx` reports 0 fail — every existing getByLabelText assertion must still pass unchanged",
      "the null-return early exit at the top of the component is untouched, so NFR-2 still holds"
    ]
  },
  {
    "id": "rp_review_005",
    "task_type": "test-hardening",
    "module": "web/grid",
    "severity": "minor",
    "instruction": "Close two test-quality gaps in EventCard.test.tsx, additively. (1) In the test 'collapses attendees past the cap into a +N chip', delete the locally recomputed `hiddenInitials` block — it re-implements attendeeInitials without the `.slice(0, 2)` and `.trim()` that production applies, so it agrees only by accident of the current two-word roster — and replace the assertion with the literal `expect(screen.queryByText(\"DF\")).toBeNull();` (\"Dan Frost\" is the first attendee past ATTENDEE_BADGE_MAX_VISIBLE). (2) In the same test, add the missing half of AC-4 by asserting the three visible monograms are each present: expect(screen.getByText(\"AL\")).toBeInTheDocument(); and likewise \"BS\" and \"CD\". Do not modify createEvent, the shared `position` fixture, the `attendee` helper, or any pre-existing it() block — this file must stay append-and-amend-in-place only, since adding a default `attendees` to createEvent would silently give every legacy card test a badge.",
    "artifact_path": "packages/web/src/grid/components/EventCard.test.tsx",
    "acceptance": [
      "no `hiddenInitials` identifier remains in the file",
      "the overflow test asserts presence of exactly the three visible monograms AND absence of \"DF\" AND the \"+3\" chip",
      "createEvent still has no `attendees` key in its defaults",
      "from packages/web, `bun test ./src/grid/components/EventCard.test.tsx` reports 0 fail and a pass count no lower than before",
      "bunx biome check packages/web/src/grid/components/EventCard.test.tsx exits 0",
      "bunx typescript@7.0.2 -p packages/web/tsconfig.test.json --noEmit is clean"
    ]
  }
]
```

### Dispatch note

`rp_review_001` … `003` are pure `biome check --write` output — mechanical tier, and
they must land before the gate since they are the AC-7 blocker. `rp_review_004` and
`005` are minor; dispatch them in the same batch if the tier is cheap, otherwise defer
`005` and take `004` (it is the only finding with user-visible consequences).

No packet touches a file outside the frozen allowlist.
