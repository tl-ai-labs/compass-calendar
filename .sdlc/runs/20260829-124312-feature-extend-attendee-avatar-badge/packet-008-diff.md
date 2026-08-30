# Packet 8 — `EventDetailsSection.tsx` — PREVIEWED, NOT APPLIED

Status at pause (2026-08-29 ~23:30 local): diff computed in memory by the
orchestrator, presented at the packet-8 mini-gate, **user paused instead of
approving**. Not written to disk. `git status` shows `EventDetailsSection.tsx`
unmodified.

This is the behaviour-preserving refactor: delete the module-private
`ATTENDEE_STATUS_DOT` + `attendeeStatusLabel`, import both from the new
`@web/common/styles/attendee-status` under the same names. Rendered DOM must be
byte-identical (FR-20). `MAX_VISIBLE_ATTENDEES = 6` stays local (not the grid's 3).

Both `old_string`s matched exactly once when previewed against anchor `2d81253a`.

```diff
--- a/packages/web/src/views/Forms/EventForm/EventDetailsSection.tsx
+++ b/packages/web/src/views/Forms/EventForm/EventDetailsSection.tsx
@@ -1,7 +1,10 @@
 import { UsersIcon, VideoCameraIcon } from "@phosphor-icons/react";
 import { useState } from "react";
 import { type EventContent } from "@core/types/event.contracts";
-import { type AttendeeResponseStatus } from "@core/types/event-attendance.contracts";
+import {
+  ATTENDEE_STATUS_DOT,
+  attendeeStatusLabel,
+} from "@web/common/styles/attendee-status";

 type EventDetails = Extract<EventContent, { kind: "details" }>;

@@ -9,16 +12,6 @@
   details: Pick<EventDetails, "organizer" | "attendees" | "conference">;
 }

-const ATTENDEE_STATUS_DOT: Record<AttendeeResponseStatus, string> = {
-  accepted: "bg-success",
-  declined: "bg-error",
-  tentative: "bg-warning",
-  needsAction: "bg-text-subtle",
-};
-
-const attendeeStatusLabel = (status: AttendeeResponseStatus): string =>
-  status === "needsAction" ? "hasn't responded" : status;
-
 const MAX_VISIBLE_ATTENDEES = 6;

 /**
```

Two hunks, +4 / −11. Orchestrator's pre-apply property checks on the preview:

| Check | Result |
|---|---|
| `MAX_VISIBLE_ATTENDEES = 6` survives (stays local, not shared with grid's 3) | true |
| email fallback line survives verbatim (`displayName ?? attendee.email`, R3) | true |
| `AttendeeResponseStatus` still referenced after edit | false (type import correctly now unused) |
| literal `bg-text-subtle` still in file | false (FR-4: one definition repo-wide) |
| word `needsAction` still in file | false |
| JSX body byte-identical from `const MAX_VISIBLE_ATTENDEES` to EOF | true (FR-20) |

`EventForm.test.tsx` (asserts `getByText("2 guests")` and
`getByLabelText("guest@example.com, declined")`, **not editable**) expected
unaffected — orchestrator to prove by running it after applying.

## On resume
Re-activate the write contract, then either (a) re-present this diff for approval
and apply on approval, or (b) let the orchestrator recompute it (both anchors are
simple, low risk of drift). Then: full `bun test:web` + `bun lint` +
`bun run type-check:web-tests` + `git diff --stat` vs `2d81253a`, senior review,
security review, then Gate 3.
