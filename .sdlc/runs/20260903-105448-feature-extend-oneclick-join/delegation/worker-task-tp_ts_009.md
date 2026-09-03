## Task tp_ts_009 — tests / test_add
Module: e2e-utils
### Working directory
You are running as an agent inside `/home/sainadh/projects/compass-calendar/compass/compass-calendar`. You may list, read,
edit and create files there, and run commands there. That directory is the
only place you can act; nothing outside it is reachable.
### Instruction
APPEND two exports to the END of the EXISTING file e2e/utils/event-test-utils.ts. ADDITIVE ONLY.

ABSOLUTE REQUIREMENT: the file currently has 18 `export` declarations. Every one of them must survive byte-identical — do not alter, reorder, rename, re-type or reformat any existing export, import, or module-level const. Every e2e spec in this repo imports from this module, so any change to existing behaviour breaks the whole suite at once. After your edit there must be 20 exports.

Add:

1. `export interface SeededLocalEvent { conferenceUrl?: string; conferenceLabel?: string | null; end: string; kind: "allDay" | "timed"; start: string; title: string; }`

2. `export const seedEventWithConference = async (page: Page, seed: SeededLocalEvent): Promise<string>` which writes ONE event row directly into the `compass-local` IndexedDB `events` object store via page.evaluate, and returns the generated event id.

Implementation contract (follow exactly):
- Generate ids in Node BEFORE page.evaluate, as 24-lowercase-hex strings (ObjectIdStringSchema is /^[0-9a-f]{24}$/i): `Array.from(crypto.getRandomValues(new Uint8Array(12)), (b) => b.toString(16).padStart(2, "0")).join("")`. Generate both an `id` and a `calendarIdFallback`.
- Pass `{ dbName: "compass-local", id, calendarIdFallback, seed }` as a single argument into page.evaluate.
- Inside the page: read `localStorage.getItem("compass.localCalendarId")` (raw string, NOT JSON — the app's persistentBrowserStore uses getItem/setItem directly). If absent, `localStorage.setItem` the fallback so the app's getLocalCalendarSentinelId() resolves to the same id. Use whichever value results as `calendarId`.
- `indexedDB.open(dbName)` with NO version argument, so no upgrade transaction is triggered.
- If `!db.objectStoreNames.contains("events")`, throw new Error("seedEventWithConference ran before the app created compass-local — call prepareCalendarPage(page) first"). Do not silently no-op.
- Use a readwrite transaction and `store.put(record)` (put, not add, so re-seeding is idempotent). Resolve on transaction.oncomplete; reject on onerror/onabort. Then db.close().

The record must satisfy LocalEventRecordSchema -> EventSchema. BOTH are z.strictObject, so extra or explicitly-undefined keys are rejected:
{ version: 2, id, isDemo: false, event: { id /* MUST equal top-level id */, calendarId, content: { kind: "details", title: seed.title, description: "", ...(seed.conferenceUrl ? { conference: { url: seed.conferenceUrl, label: seed.conferenceLabel ?? "Compass Meet" } } : {}) }, schedule: seed.kind === "timed" ? { kind: "timed", start: seed.start, end: seed.end, timeZone: "UTC" } : { kind: "allDay", start: seed.start, end: seed.end }, recurrence: { kind: "single" }, createdAt: new Date().toISOString(), updatedAt: null } }

Critical: OMIT icalUid/location/organizer/attendees/color/colorHex entirely — never set them to undefined, because IndexedDB persists the undefined key and strictObject then rejects the row. Use timeZone "UTC" (not "Etc/UTC"). For the conference-free control event, omit the `conference` key entirely.

Match the file's existing style: arrow-function exports, TSDoc comment explaining WHY the helper exists (conference is read-only provider-sourced data, the event form cannot set one, so a UI-created event can never render the join control).

Write ONLY e2e/utils/event-test-utils.ts. Do not create, modify or delete any other file.
### Provided excerpts
These are extracts, not whole files. The paths are real — open them in the
working directory when you need more than the excerpt shows.

#### e2e/utils/event-test-utils.ts
_Included because: file under edit - all 18 existing exports must survive byte-identical_

```

```

#### packages/web/src/events/types/local-event.record.ts
_Included because: LocalEventRecordSchema the row must satisfy_

```

```

#### packages/core/src/types/event.contracts.ts
_Included because: EventSchema strictObject shape_

```

```
### Acceptance criteria
- file has 20 exports, all 18 pre-existing ones byte-identical
- seedEventWithConference and SeededLocalEvent exported
- optional Event fields omitted rather than set undefined
- top-level id equals event.id
- missing events store throws a named error
- only event-test-utils.ts written
### Your final message
Your final message must be a single JSON object and nothing else — no
prose before it, no summary after it, no ``` fence around it. It must
conform to this schema:

```json
{
  "type": "object",
  "properties": {
    "file_content": {
      "type": "string"
    },
    "files_written": {
      "type": "array",
      "items": {
        "type": "string"
      }
    }
  },
  "required": [
    "file_content"
  ]
}
```