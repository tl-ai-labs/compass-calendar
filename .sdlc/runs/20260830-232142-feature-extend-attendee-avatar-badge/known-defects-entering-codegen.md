# Known defects entering codegen

> Run `20260830-232142-feature-extend-attendee-avatar-badge` · policy `flash-agsdk-only` ·
> CMP-105 policy-comparison arm.

## Status

At **Gate 2 the user approved `change_plan.md` as-written**, after being told explicitly that
all five defects below — including the two blockers — would carry into codegen **unfixed**.
The intent is to record what `flash-agsdk-only` produces *without* orchestrator correction.

Accordingly, Phase 4 planned packets **faithfully from the flawed plan**. The decomposition
packet (`tp_plan_001`) was instructed in so many words not to add the two missing test files
and not to drop the `gap-1` change. It complied: `packets.json` contains exactly six packets
matching the plan's six-file change list.

These defects are NOT bugs in the run. They are the measured output of the floor policy, and
they must resurface at Gate 3 and in the final report.

## The five defects

| ID | Severity | Defect | Requirement violated | Carried into packet |
|---|---|---|---|---|
| C-1 | blocking | `AllDayEventCard`'s title-row className becomes `cn("flex min-w-0 items-center gap-1", …)` **unconditionally**, so the class string changes for every all-day card including attendee-less ones. | FR-6 / AC-3 (zero-attendee DOM byte-identical) | `tp_cg_005` |
| C-2 | blocking | Plan omits `packages/web/src/common/styles/attendee-status.test.ts` and `packages/web/src/grid/components/AttendeeBadge.test.tsx`; all tests folded into `EventCard.test.tsx`. | AC-1 (shared-module tests), AC-3 (badge component tests), FR/AC-4 | *no packet exists* — absence is the defect |
| C-3 | major | `role="group"` + `aria-label` placed **inside** a `role="button"` card root. Under ARIA's presentational-children rule the label is not exposed, leaving colour as the only status signal. | NFR-1 (colour never the only signal) | `tp_cg_003` |
| C-4 | minor | Test plan calls for snapshot comparison; `toMatchSnapshot` / `toMatchInlineSnapshot` appear **nowhere** in `packages/web/src`. Introducing snapshots would be a new convention. | project convention, not a stated AC | `tp_cg_006` |
| C-5 | minor | No height/width gate for the badge on `TimedEventCard`, unlike the time label (`MIN_EVENT_HEIGHT_FOR_TIME_LABEL` / `MIN_EVENT_WIDTH_FOR_TIME_LABEL`) and repeat icon (`REPEAT_ICON_MIN_WIDTH`). Card is `overflow-hidden`, so on short events the badge is silently clipped rather than suppressed. | none directly; diverges from the card's own gating convention | `tp_cg_004` |

## Provenance of C-2

C-2 is a direct artifact of a **worker malformation**, not a considered decision. The design
packet `tp_design_001` returned two concatenated JSON objects. The first was truncated mid-D-5;
its `files_to_change` **did** list both missing test files. The second object was complete and
is what `change_plan.md` reproduces — and its `files_to_change` had silently dropped them.
The orchestrator salvaged the second object rather than paying ~$0.38 for a re-dispatch.

So: the floor policy lost two required test files to a serialization failure, and the loss was
invisible in the artifact it produced.

## What was verified as sound (not defects)

- `--color-background` is a genuine Tailwind 4 `@theme inline` token (`packages/web/src/index.css:103`,
  `--color-background: var(--background)`), so `ring-background/60` in D-4 resolves to a real
  utility. The contrast argument holds.
- `EventRepeatIcon` really is `pointer-events-none absolute right-1 bottom-0.5`, size 10,
  `aria-hidden` — D-5's collision analysis is grounded in the actual code.

## Standing instruction for later phases

If codegen or the test phase happens to diverge from the flawed plan in a way that **satisfies
the original acceptance criteria anyway** (for example, the worker writes the two missing test
files on its own initiative, or omits the unconditional `gap-1`), that is to be **recorded as
observed, not forced back to the broken plan**. Divergence-toward-correct is a finding about the
policy, and is exactly as interesting as compliance-with-flawed-plan.
