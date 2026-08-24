## Task tp_review_001 — senior_code_review / code_review
Module: week-allday-drag
### Working directory
You are running as an agent inside `/home/sainadh/projects/compass-calendar/compass/compass-calendar`. You may list, read,
edit and create files there, and run commands there. That directory is the
only place you can act; nothing outside it is reachable.
### Instruction
Senior code review of a shipped change. REVIEW ONLY — create and modify NO files. Return JSON per the schema.

THE CHANGE: multi-day drag-to-select in the Week all-day row. `git diff` and `git status` show the full change set. Files: packages/web/src/grid/interaction/math/all-day.create.ts (+test, new), packages/web/src/grid/hooks/useAllDayDraftCreation.ts (+test, edited), packages/web/src/views/Week/hooks/grid/useAllDayGridDraftCreation.ts (+test, new), packages/web/src/views/Week/components/Grid/AllDayRow/AllDayRow.tsx (edited), packages/web/src/views/Week/components/Grid/AllDayRow/AllDayRow.test.tsx (new), docs/frontend/week-drag-interaction.md (edited).

THE SPEC: .sdlc/runs/20260820-004405-feature-extend-allday-multiday-drag/change_plan.md — sections 10 and 11 OVERRIDE section 4. Also read requirements.md in that directory for FR-1..FR-7 and the invariants. Compare the shipped code against BOTH, and against the reference gesture in packages/web/src/grid/hooks/useTimedDraftCreation.ts.

FULL SUITE IS GREEN: bun test:web = 2327 pass / 0 fail / 305 files, against a 2298 / 0 / 302 baseline. So do NOT report anything as a defect merely because you suspect a test would fail — tests pass. Report real defects, and be specific about the input that triggers each.

REVIEW THESE QUESTIONS EXPLICITLY, one finding each (severity none is a valid answer):
1. The opted-in path checks only isRightClick, while useTimedDraftCreation additionally calls isEligibleInteractionPointerDown (button/isPrimary/alt/ctrl/meta/shift). Does alt/ctrl/meta/shift + left-press on the Week all-day row now start a drag gesture that should have been ignored? What is the user-visible consequence, e.g. on macOS ctrl-click?
2. Listener lifecycle: are mousemove/mouseup/blur/keydown ALWAYS removed — on finish, on cancel, on unmount mid-gesture, and on a second mousedown while a gesture is live? Any path that leaks a listener or leaves gestureRef stale?
3. Stale-closure risk: isDrafting is read from useDraftStore at render, but the gesture publishes a draft on mousedown. Trace what happens on the SECOND mousedown after a completed gesture, and mid-gesture re-renders.
4. Does the opt-out path (no visibleBounds) remain behaviourally identical to the pre-change code? Diff it line by line against the original body. Day view depends on this.
5. Is the exclusive end-date convention applied consistently in the hook, the math module and the tests? Look for any off-by-one.
6. Escape/blur cancellation: does cancel() ever discard a draft it did not create (e.g. an unrelated draft already open), and is discard() safe when the gesture published nothing?
7. Test quality: do the new tests actually exercise what they claim — in particular, does the right-to-left test genuinely drag leftwards, and does the clamp test genuinely exceed the bounds? Any assertion that would pass even if the feature were reverted?
8. Scope compliance: confirm via git status that packages/web/src/views/Day/**, useTimedDraftCreation.ts, useTimedGridDraftCreation.ts and MainGrid.test.tsx are UNMODIFIED.

For each finding give: id, title, severity (blocker|major|minor|nit|none), file, line, what_is_wrong, why_it_matters, suggested_fix. Be concrete; no generic advice. If the code is correct on a question, say so with severity none and state the evidence you checked.
### Provided excerpts
_None supplied. Explore the working directory to find what you need._
### Acceptance criteria
- Every one of the 8 review questions produces at least one finding, including severity 'none' answers with evidence
- Findings cite real file paths and line numbers from the shipped code
- scope_compliance is backed by git evidence
- No file in the repository was created or modified by this review
### Your final message
Your final message must be a single JSON object and nothing else — no
prose before it, no summary after it, no ``` fence around it. It must
conform to this schema:

```json
{
  "type": "object",
  "properties": {
    "verdict": {
      "type": "string",
      "enum": [
        "approve",
        "approve_with_comments",
        "request_changes"
      ]
    },
    "summary": {
      "type": "string"
    },
    "scope_compliance": {
      "type": "object",
      "properties": {
        "day_view_unmodified": {
          "type": "boolean"
        },
        "timed_hook_unmodified": {
          "type": "boolean"
        },
        "maingrid_test_unmodified": {
          "type": "boolean"
        },
        "evidence": {
          "type": "string"
        }
      },
      "required": [
        "day_view_unmodified",
        "timed_hook_unmodified",
        "maingrid_test_unmodified",
        "evidence"
      ]
    },
    "findings": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "id": {
            "type": "string"
          },
          "title": {
            "type": "string"
          },
          "severity": {
            "type": "string",
            "enum": [
              "blocker",
              "major",
              "minor",
              "nit",
              "none"
            ]
          },
          "file": {
            "type": "string"
          },
          "line": {
            "type": "number"
          },
          "what_is_wrong": {
            "type": "string"
          },
          "why_it_matters": {
            "type": "string"
          },
          "suggested_fix": {
            "type": "string"
          }
        },
        "required": [
          "id",
          "title",
          "severity",
          "file",
          "what_is_wrong",
          "why_it_matters",
          "suggested_fix"
        ]
      }
    }
  },
  "required": [
    "verdict",
    "summary",
    "scope_compliance",
    "findings"
  ]
}
```