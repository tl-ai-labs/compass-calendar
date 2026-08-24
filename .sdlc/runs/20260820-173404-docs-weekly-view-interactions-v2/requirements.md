# Requirements — docs — "Weekly view interactions" README section

- **Run:** `20260820-173404-docs-weekly-view-interactions-v2`
- **Mode / intent:** brownfield · `docs`
- **Task type:** `doc_addition`
- **Source brief:** `.sdlc/runs/20260820-173404-docs-weekly-view-interactions-v2/intent_brief.md`
- **Target file:** `README.md` (only)

---

## 1. In scope

1. Add exactly one new `## Weekly view interactions` section to the root `README.md`, inserted between the existing `## Features` and `## Tech stack` headings.
2. The section covers exactly two end-user topics in plain language:
   a. **Recurring events**: creating repeating events with Day, Week, Month, and Year frequencies, and choosing between editing/deleting a single occurrence vs. the entire series.
   b. **Event colors**: tagging events with 11 fixed color options.
3. Include a relative Markdown link to `docs/frontend/week-drag-interaction.md` for readers seeking developer/interaction implementation details, without editing or duplicating that file.
4. Ensure README copy is written for end users in plain language with no internal file, component, or function names.

## 2. Out of scope

1. Documenting multi-day select or drag-to-select multiple days: discovery confirmed that multi-day draft creation is not implemented at this commit (`useAllDayDraftCreation.ts` creates a fixed 1-day draft) and is explicitly excluded from this run.
2. Documenting or claiming hourly, minutely, or secondly recurrence frequencies (unsupported).
3. Documenting or claiming arbitrary or custom hex color selection (provider `colorHex` is read-only; Compass picker only supports the 11 fixed slots).
4. Modifying `docs/frontend/week-drag-interaction.md` or any other documentation under `docs/**`.
5. Modifying application code or test suites under `packages/**`.
6. Modifying or reordering any pre-existing text or headings in `README.md` outside the newly inserted section.

## 3. Functional requirements

- **FR-1**: `README.md` gains exactly one new level-2 markdown heading: `## Weekly view interactions`.
- **FR-2**: The section is inserted strictly between the `## Features` section and the `## Tech stack` heading.
- **FR-3**: The section describes recurring events for end users: creating repeating events with Day, Week, Month, or Year frequencies, and the ability to edit or delete either a single occurrence or the full series.
- **FR-4**: The section describes event colors for end users: tagging events using 11 fixed color options (plus clearing/default).
- **FR-5**: The section includes a working relative markdown link to `./docs/frontend/week-drag-interaction.md` for readers seeking implementation details on week grid drag interactions.
- **FR-6**: The README copy is written in plain, user-facing language and contains no internal identifiers, component names (e.g. `RecurrenceSection`, `EventColorPicker`, `WeekInteractionCoordinator`), or source code file paths (except the link target).

## 4. Non-functional requirements

- **NFR-1 · Tone & Voice**: Plain language, benefit-focused, matching the existing terse, second-person style of `README.md`.
- **NFR-2 · Link Validity**: The markdown link to `docs/frontend/week-drag-interaction.md` resolves to the existing file at repo root.
- **NFR-3 · Markdown Hygiene**: Clean Markdown rendering, proper heading hierarchy, blank lines separating blocks, and no trailing whitespace.
- **NFR-4 · Diff Minimality**: The diff on `README.md` is strictly additive with no modifications or deletions to pre-existing lines.
- **NFR-5 · Tooling**: `bun lint` passes cleanly with zero errors.

## 5. Accuracy constraints

Every claim in the new README section must adhere to verified repository facts:

1. **Recurrence Frequencies**: Must ONLY state Day, Week, Month, and Year frequencies. Must NOT state hourly, minutely, or secondly recurrence.
   - *Source of truth*: `packages/web/src/views/Forms/EventForm/DateControlsSection/RecurrenceSection/constants/recurrence.constants.ts` (`FREQUENCY_OPTIONS`, `FREQUENCY_MAP`), `packages/core/src/types/recurrence.contracts.ts`.
2. **Recurrence Scope Actions**: Must accurately describe editing or deleting a single occurrence versus the whole series.
   - *Source of truth*: `packages/web/src/common/utils/toast/recurrence-scope.toast.tsx`, `packages/web/src/views/Forms/hooks/useDeleteEvent.ts`, `packages/web/src/views/Forms/EventForm/DateControlsSection/RecurrenceSection/components/ConvertToStandaloneDialog.tsx`.
3. **Event Color Options**: Must accurately state 11 fixed color slots (`lavender`, `mint`, `plum`, `coral`, `gold`, `orange`, `blue`, `slate`, `indigo`, `green`, `red`) plus default/no color. Must NOT claim arbitrary or custom hex color support.
   - *Source of truth*: `packages/core/src/types/event-color.contracts.ts` (`EventColorSlotSchema`), `packages/web/src/common/styles/theme.util.ts` (`eventColorLabel`).
4. **Multi-Day Select Exclusion**: Must NOT claim multi-day drag-to-create or multi-day select as a working feature, as draft creation at HEAD creates a fixed 1-day draft.
   - *Source of truth*: `packages/web/src/grid/hooks/useAllDayDraftCreation.ts`, baseline discovery findings at HEAD `4189de13`.

## 6. PII inventory & role matrix

PII inventory and role matrix are not applicable to a README-only documentation change.

## 7. Acceptance criteria

1. File `README.md` contains a single new `## Weekly view interactions` section positioned between `## Features` and `## Tech stack`.
2. The section covers recurring events with Day/Week/Month/Year frequencies and single instance vs. whole series edit/delete choices.
3. The section covers event colors with 11 fixed color options.
4. The section contains a working markdown link to `docs/frontend/week-drag-interaction.md`.
5. The section makes no mention of multi-day drag-select or creation.
6. The section makes no claim of hourly/minutely recurrence or custom hex colors.
7. The copy contains no internal component, function, or source code file names.
8. Pre-existing lines in `README.md` are completely unmodified.
9. `bun lint` passes without errors.
10. No files outside `README.md` are modified during the doc addition.

## 8. Open questions for HITL

None.
