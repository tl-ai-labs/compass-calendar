# Security Review — attendee avatar badge (brownfield, feature-extend)

Run: `20260829-122202-feature-extend-attendee-avatar-badge`
Scope: the 5 new + 4 edited files listed in the task. The rest of the repo is out of scope;
pre-existing issues are recorded as advisory only.

## Verdict: MEDIUM (bounded)

No injection, no auth surface, no network, no storage, no new dependencies. The entire risk of
this change is **data minimization**: it moves attendee identity — including raw email addresses —
out of the click-to-open event form and into an `aria-label` on a DOM node that is rendered on
every grid card, in an app that ships an unmasked DOM-recording analytics SDK. That is a real and
fixable exposure delta, not a theoretical one. Everything else on the checklist is clean.

---

## Findings

### F-1 — MEDIUM — Raw attendee email addresses enter the always-rendered grid DOM

`packages/web/src/grid/components/EventAttendeeBadge.tsx:38` and `:61`

```ts
`${attendee.displayName ?? attendee.email}, ${attendeeStatusLabel(attendee.responseStatus)}`
```

This string is bound to `aria-label` on the badge root (line 61), which renders on every grid card
that has attendees and clears the size gates.

The exposure delta is real and I verified it rather than assuming it:

```
$ git grep -n "attendees" HEAD -- packages/web/src/grid/
(no output)
```

Before this run, **no file under `packages/web/src/grid/` referenced attendee data at all**.
Attendee identity was reachable only by opening an event's detail form
(`EventDetailsSection.tsx:63`, behind a click). It is now present in the persistent DOM of the
default view.

When `displayName` is `null` — common for external / non-contact Google attendees — the label falls
back to the **full email address**. So a week view can carry dozens of attendee emails in its
accessible tree at rest.

Note this is *not* an authorization break. The viewer is already entitled to this data; they could
open the event and read it. The issue is that it is now disclosed continuously and passively rather
than on demand, which widens shoulder-surfing, screen-share, screenshot, DOM-dump, and
accessibility-tree-export exposure. Screen sharing a calendar is an extremely common act.

**Remediation:** drop the email from the label. The email adds nothing for a screen-reader user
that the display name does not, and the visible circle only ever shows an initial. Prefer a
non-identifying fallback:

```ts
const labelName = (a: Attendee) => a.displayName ?? "1 guest";  // or "unnamed guest"
```

If the email must stay for disambiguation, gate it behind the same interaction boundary the form
uses rather than rendering it at rest.

### F-2 — MEDIUM — PostHog runs with no masking configuration, placing F-1's label in capture scope

`packages/web/src/auth/posthog/posthog.bootstrap.ts:24-52`

The `posthog.init` call sets `capture_exceptions`, `before_send`, `opt_in_site_apps`, and
`person_profiles`. It sets **no** masking or capture-suppression options. I grepped the whole web
package for any:

```
$ grep -rniE "ph-no-capture|mask_all|maskAllText|maskTextSelector|session_recording|disable_session_recording|autocapture" packages/web/src
packages/web/src/auth/posthog/posthog-dead-click-filter.util.ts:19  (a comment only)
```

So all `posthog-js` defaults are in effect, and no element in the app is marked `ph-no-capture`.
Under defaults, session replay records the DOM via rrweb with `maskAllInputs` on but **text and
element attributes unmasked** — an `aria-label` is captured verbatim. F-1's emails would then leave
the browser and land in PostHog.

**I could not confirm from the codebase whether session replay is actually enabled**, because that
is a server-side PostHog project setting, not a value in this repo. I am therefore rating this on
the configuration gap I can see, not asserting that exfiltration is occurring. Treat it as
conditional and verify the project setting.

I also traced the autocapture path specifically and it is *lower* risk than it first appears: the
badge root is `pointer-events-none` (line 63) so it is never itself a click target, and PostHog's
element-chain capture walks *ancestors* of the clicked node — the badge is a descendant of the
card, so a card click does not pull the badge's attributes into `$autocapture`. Session replay, not
autocapture, is the vector that matters here.

**Remediation:** fixing F-1 makes this moot for this feature. Independently, and worth its own
ticket, this app has no replay masking policy at all for a surface full of meeting titles and
attendee names — consider `maskTextSelector` or `ph-no-capture` on calendar content broadly.

### F-3 — LOW — Empty-string `displayName` produces a malformed, name-leading label

`packages/web/src/grid/components/EventAttendeeBadge.tsx:19` vs `:38`

The two helpers disagree on emptiness. `attendeeInitials` uses a truthiness test after trim, so
`""` correctly falls through to the email initial:

```ts
const name = displayName?.trim();
if (name) { ... }
return (email[0] ?? "?").toUpperCase();
```

`attendeeBadgeLabel` uses `??`, which only catches `null`/`undefined`. An `Attendee` with
`displayName: ""` yields a label fragment of `", accepted"`.

This is currently **unreachable through validated data**: `AttendeeSchema` at
`packages/core/src/types/event-attendance.contracts.ts:24-28` declares
`displayName: z.string().trim().min(1).max(256).nullable()`, so `""` cannot survive a parse. It is
reachable only if some path constructs an `Attendee` structurally without parsing — which the
component's own test helper does (`EventAttendeeBadge.test.tsx:12-16`). Cosmetic, not exploitable;
worth aligning for defense in depth.

**Remediation:** `attendee.displayName?.trim() || attendee.email` in the label, matching line 19.

### F-4 — INFORMATIONAL — `key={attendee.email}` collides on duplicate emails

`packages/web/src/grid/components/EventAttendeeBadge.tsx:69`. `AttendeeSchema` does not enforce
uniqueness across the array. Duplicate emails would trigger React key collision and possible
mis-keyed reconciliation. A rendering-correctness nit with no security consequence; noted only
because it sits in the audited diff.

---

## Checked and found clean

Explicit negative results, so they are on record:

- **XSS / injection — clean.** Grepped all 9 changed files for
  `dangerouslySetInnerHTML|innerHTML|outerHTML|eval(|new Function|insertAdjacentHTML|document.write|javascript:`.
  Zero hits in the new files. `displayName` and `email` reach the DOM only as React text children
  (line 76) and as a React `aria-label` attribute value (line 61) — both auto-escaped. The only
  `href=` hit in the diff is `conference.url` at `EventDetailsSection.tsx:41`, which is
  **pre-existing and untouched** by this run (the diff there only swaps imports and deletes two
  local constants).
- **CSS class injection — clean.** `ATTENDEE_STATUS_RING[attendee.responseStatus]`
  (line 73) is a fixed `Record` lookup, not string interpolation. The key type is the zod enum
  `AttendeeResponseStatusSchema` (4 literal members), and `attendee-status.styles.ts:16-24` is typed
  as a total `Record`, so an unknown status is a compile error rather than an `undefined` class.
  The file's own header comment (lines 8-11) explicitly forbids building these with template
  literals. No provider string reaches a `style` or `class` context.
- **Rendering DoS — clean, genuinely bounded.** `attendees.slice(0, 3)` at line 56 happens
  *before* any mapping, and `attendeeBadgeLabel` maps over `visible` (line 36), not the full array.
  Overflow is arithmetic (line 57), not iteration. The unbounded array — `z.array(AttendeeSchema)`
  carries no `.max()` — is touched only via `.length` (O(1)) and `.slice` (O(3)). A 10,000-attendee
  event costs this component O(1). Per-field length is additionally capped by the schema
  (email ≤ 320, displayName ≤ 256), so the label cannot exceed roughly 1 KB.
- **Module boundary — not widened.** `GridEvent.attendees` already existed at
  `packages/web/src/common/types/web.event.types.ts:87`, a file this run did not touch. The new
  `@web/grid/... -> @core/types/event-attendance.contracts` edges are **type-only imports**
  (`import { type Attendee }`), erased at compile time. This change makes the grid *render* data
  its type already carried; it does not route new data into a new layer.
- **No new dependencies.** `git status` shows no change to any `package.json`, `bun.lock`, or other
  lockfile. `classnames` — the only runtime import in the new component — is already declared at
  `packages/web/package.json:22`.
- **No secrets.** Grepped the changed files for
  `(api[_-]?key|secret|password|token|bearer|credential|private[_-]?key)\s*[:=]\s*['"][a-zA-Z0-9]`.
  Zero hits. Test fixtures are synthetic throughout (`ada@x.com`, `bob@x.com`, `overflow-${i}@x.com`,
  and the invented `NAME_POOL` at `EventAttendeeBadge.test.tsx:31-42`). No real credentials or real
  personal data embedded.

Checklist items skipped as structurally inapplicable — this diff contains no server code, no route,
no controller, no persistence, and no auth logic: encryption at rest, role-based response masking,
audit-log ordering/append-only/read-role, route guards, `reports_to` checks, JWT secret sourcing,
password hashing cost factor, helmet, rate limiting, global error filter, `.env.example`.

---

## Noted (pre-existing, out of scope — advisory, not gating)

- **Dependency audit: 24 high / 37 moderate / 8 low.** `npm audit --omit=dev` **cannot run here** —
  it exits `ENOLOCK` because this is a Bun repo with `bun.lock` and no `package-lock.json`. I am
  explicitly not recording that check as passing. I ran the working equivalent, `bun audit --prod`
  (bun 1.3.14), which reports **69 vulnerabilities (24 high, 37 moderate, 8 low)** — notably
  `nodemailer` (arbitrary file read / SSRF, high), `ip-address` (SSRF via octal octets, high),
  `postcss` (arbitrary file read via `sourceMappingURL`, high), `nanoid`, `ws`, `body-parser`.
  **None are attributable to this run** — no dependency manifest changed. Also note `--prod` still
  surfaced dev-only paths (e.g. `jsdom`), so that count overstates production exposure. Worth a
  dedicated remediation ticket, and worth fixing the audit tooling gap so this check is runnable in
  CI at all.
- **Same email-fallback pattern in the form.** `EventDetailsSection.tsx:63` and `:74` already did
  `attendee.displayName ?? attendee.email` into an `aria-label`. F-1 is consistent with existing
  house style; what changed is the *placement* (always-on grid vs. click-to-open panel). If F-1 is
  fixed, fix this alongside it for one coherent policy.
- **`conference.url` rendered into `href`.** `EventDetailsSection.tsx:41`, validated by `z.url()`
  at `event-attendance.contracts.ts:32`. Whether that validator rejects a `javascript:` scheme is
  worth confirming separately; I did not verify it and it is untouched by this run.

---

## Required before sign-off

1. **F-1** — remove the raw email fallback from the grid `aria-label`
   (`EventAttendeeBadge.tsx:38`). This is the one change I would gate on.
2. **F-2** — confirm whether PostHog session replay is enabled for this project. If it is, F-1 is
   an active PII-to-third-party flow and should be fixed before merge, not after.

Non-blocking: F-3 (align the emptiness check), F-4 (key choice), and a follow-up ticket for the
dependency backlog and the missing replay-masking policy.
