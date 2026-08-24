## Task tp_sec_001 — security_review / security_review
Module: week-allday-drag
### Working directory
You are running as an agent inside `/home/sainadh/projects/compass-calendar/compass/compass-calendar`. You may list, read,
edit and create files there, and run commands there. That directory is the
only place you can act; nothing outside it is reachable.
### Instruction
Security review, CHANGED FILES ONLY. ANALYSIS ONLY — create and modify NO files. Return the report as markdown, your final message.

SCOPE — exactly these, and nothing else (use `git diff` and `git status` to see them):
- packages/web/src/grid/interaction/math/all-day.create.ts (new) and its .test.ts
- packages/web/src/grid/hooks/useAllDayDraftCreation.ts (edited) and its .test.tsx
- packages/web/src/views/Week/hooks/grid/useAllDayGridDraftCreation.ts (new) and its .test.tsx
- packages/web/src/views/Week/components/Grid/AllDayRow/AllDayRow.tsx (edited) and AllDayRow.test.tsx (new)
- docs/frontend/week-drag-interaction.md (edited)

This is a CLIENT-SIDE calendar interaction change: a mouse gesture that builds a local draft object and puts it in a Zustand store. No network calls, no auth, no persistence, no new dependency were added by this change. Do not invent findings to fill sections — for a change of this shape, 'no issue found, here is what I checked' is the expected and correct answer for most categories. State plainly when a category is not applicable and why.

ASSESS, each as its own section:
1. Input handling — the gesture consumes attacker-influenceable-ish values (clientX/clientY, key events, date strings from getDateStrByXY). Can any input produce an unbounded loop, NaN/Invalid Date propagating into the store, a crash, or an inverted/absurd span? Check what clampDayToVisibleBounds does with an Invalid Date string or an empty string, given it uses lexicographic string comparison rather than date comparison.
2. Global event listeners — mousemove/mouseup/blur/keydown are attached to window in CAPTURE phase. Can this swallow or interfere with other handlers, and can a listener outlive the component (leak / use-after-unmount)? Note that the keydown handler calls preventDefault + stopPropagation on Escape.
3. Denial of service / performance — every mousemove past threshold writes to the draft store. Is there any unbounded growth, unthrottled expensive work, or memory retention across gestures?
4. State integrity — can the gesture leave the draft store in a state another feature would misread (orphan draft, draft with activity 'creating' never resolved, discard of a draft the gesture did not own)?
5. Data exposure — any secret, token, PII or user content logged, serialised, or sent anywhere by these files? Any new console output?
6. Dependency risk — were any imports added, and are they all first-party or already-present packages?
7. Documentation — does the docs change disclose anything sensitive (internal URLs, credentials, infrastructure detail)?

End with a section '## Verdict' containing exactly one of: PASS, PASS WITH NOTES, FAIL — plus a one-paragraph justification and a bulleted list of any follow-ups. Use plain repo-relative paths, no file:// links, no LaTeX.
### Provided excerpts
_None supplied. Explore the working directory to find what you need._
### Acceptance criteria
- Covers all 7 categories, marking not-applicable ones as such with a reason
- Explicitly analyses clampDayToVisibleBounds behaviour on malformed or empty date strings given lexicographic comparison
- Explicitly analyses the capture-phase window listeners and the Escape preventDefault/stopPropagation
- Ends with a ## Verdict section stating PASS, PASS WITH NOTES, or FAIL
- No invented findings; not-applicable categories stated plainly
- No file in the repository was created or modified by this review
### Your final message
Return the deliverable itself as your final message — the file content or
the document that was asked for, not a report about producing it.