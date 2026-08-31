# Senior code review — grid attendee badge

> Run `20260830-232142-feature-extend-attendee-avatar-badge` · branch `CMP-105/flash-agsdk-only`
> · anchor `2d81253a` · reviewer: gemini-3.7-flash via Antigravity (packet `tp_review_001`).
> Reviewed against the ORIGINAL acceptance criteria, not against the knowingly-flawed change plan.

**Verdict: `request_changes`.**

## Acceptance-criteria assessment

| AC | Status | Evidence |
|---|---|---|
| AC-1 shared module has unit tests | **NOT MET** | No `attendee-status.test.ts` was created. |
| AC-2 EventDetailsSection imports the constants, output unchanged | **MET** | Imports from the shared module; JSX identical. |
| AC-3 zero-attendee cards render byte-for-byte as before | **NOT MET** | `AllDayEventCard` unconditionally adds `gap-1` to the title wrapper, changing the class string even with no attendees. |
| AC-4 tests cover shared module, badge per status + empty, both cards | **NOT MET** | No isolated tests for the module or the badge; `tentative` never covered; no AllDayEventCard-with-attendees test. |
| AC-5 `bun test:web` passes, no pre-existing tests modified | **MET** | 2303 pass / 0 fail; +5 tests; 218 pure insertions; no existing test touched. |
| AC-6 Biome clean on touched files | **NOT MET** | Exit 1 on `AttendeeBadge.tsx`: 1 format error, 3 `useSortedClasses`, 1 `useSemanticElements`. |

Two of six met.

## Findings

### R-1 · blocker · `AttendeeBadge.tsx`
Biome fails: formatting error at the `summaryLabel` `.map` arrow, `lint/nursery/useSortedClasses` at 37:9, 50:15 and 59:21, and `lint/a11y/useSemanticElements` at 34:7 on the `role="group"` div.
*Why it matters:* violates AC-6 directly and fails CI check scripts and commit hooks with exit 1.
*Fix:* format per Biome, sort the Tailwind class strings, and either address or explicitly `biome-ignore` the `role="group"` warning.

### R-2 · major · `AllDayEventCard.tsx`
Unconditional `gap-1` on the title container className regardless of whether `event.attendees` exists.
*Why it matters:* violates AC-3's byte-for-byte requirement.
*Fix:* make `gap-1` conditional on attendee presence, or move the spacing onto `AttendeeBadge` itself.

### R-3 · major · `AttendeeBadge.tsx`
Renders `role="group"` + `aria-label` inside card roots that are `role="button"`.
*Why it matters:* per WAI-ARIA, a `button`'s descendants are presentational; screen readers ignore the nested group and its label, so the attendee summary is inaccessible and colour becomes the only signal.
*Fix:* fold attendee count/status into the parent card's `accessibleLabel` and mark the badge `aria-hidden="true"`.

### R-4 · major · `EventCard.test.tsx`
No `attendee-status.test.ts`, no `AttendeeBadge.test.tsx`, no `tentative` dot coverage, and no test that the badge renders inside `AllDayEventCard`.
*Why it matters:* violates AC-1 and AC-4; regressions in the shared styles, the badge in isolation, or the all-day card would not be caught.
*Fix:* add the two missing test files and an AllDayEventCard-with-attendees case.

### R-5 · minor · `EventCard.test.tsx`
"does not block card interaction" fires `mouseDown` on the card root, never on the badge; the a11y test queries the DOM attribute via `querySelector` rather than the accessibility tree.
*Why it matters:* the test passes without proving pointer events on the badge bubble to the card handler — false confidence. The `querySelector` choice is also precisely why the suite stays green while R-3 is true.
*Fix:* dispatch `mouseDown` on the badge element itself.

### R-6 · minor · `TimedEventCard.tsx`
Badge rendered with no height/width gate, unlike `showTimeLabel` (`MIN_EVENT_HEIGHT_FOR_TIME_LABEL` / `MIN_EVENT_WIDTH_FOR_TIME_LABEL`) and the repeat icon (`REPEAT_ICON_MIN_WIDTH`).
*Why it matters:* on short events the badge is pushed below the title and clipped by the card's `overflow-hidden`, or crowds the layout.
*Fix:* gate on available height, or use a compact layout when constrained.

## Credit

- `EventDetailsSection.tsx` delegates cleanly to the shared module with zero change to rendered output — AC-2 genuinely satisfied.
- `attendee-status.ts` is a correct, centralized single source of truth for the RSVP colours and labels.
- `AttendeeBadge` correctly implements the 3-attendee cap, the `+N` overflow, and per-attendee title tooltips.
- Zero regressions: every pre-existing test still passes, none modified.
- `bun type-check` passes cleanly across the workspace.

## Mapping to the defects known at Gate 2

The reviewer was not told about C-1..C-5 and rediscovered four of them independently:

| Gate-2 defect | Reviewer finding |
|---|---|
| C-1 unconditional `gap-1` | R-2 |
| C-2 missing test files | R-4 |
| C-3 inert `role="group"` | R-3 |
| C-4 snapshot pattern | *not raised* — codegen quietly declined to use snapshots, so the defect never reached the code |
| C-5 no badge gate on timed card | R-6 |
| — | **R-1 (new)** Biome failure, introduced by codegen, not present in the plan |
| — | **R-5 (new)** the interaction test does not exercise the badge |

## Disposition

- **R-1** — partially fixed this run by refinement packet `tp_refine_r1` (formatting + class sorting only). The `useSemanticElements` warning was deliberately **left in place**: it is the lint engine objecting to the very `role="group"` that R-3/C-3 is about, and the Gate 2 ruling froze that decision.
- **R-2, R-4, R-6** — **not fixed.** These are C-1, C-2 and C-5, frozen by the Gate 2 "approved as-written" ruling for the policy-comparison record. All three are carried as must-fix-before-merge follow-ups.
- **R-3 — accepted as debt at Gate 3, and this finding's own `fix_suggestion` was overruled.** The badge stays `aria-hidden`; attendee detail must **not** be folded into either card's `accessibleLabel`. Doing so would trade an inert-a11y bug for a live PII broadcast (security finding F-1) on a commonly screen-shared surface. RSVP detail behind a click, in `EventDetailsSection`, is the right altitude. Record R-3 as accepted-as-debt with that rationale — not as "to be fixed by folding into accessibleLabel".
- **R-5** — **not fixed.** Same test file as R-4; fixing it in isolation would misrepresent the arm's first-shot test quality.
