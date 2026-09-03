# Security Review — brownfield, intent-scoped (`feature-extend`, one-click join)

Run: `20260903-105448-feature-extend-oneclick-join`
Scope: the 11 files listed in `provenance.json` only. Everything else in the repo is out of scope
and appears (if at all) under *Noted (pre-existing, out of scope)*.
Reviewer method: `git diff` on the 7 edited files, full read of the 4 new files, plus live
Chromium probes of the URL sink (see §4). No source file was modified by this review.

## 1. Verdict

**`pass_with_notes`.**

The AC-9 scheme guard is sound against every scheme-injection payload I could construct: 65
hostile inputs, 0 bypasses, verified against a real Chromium URL parser rather than by inspection.
`rel="noopener noreferrer"` and `target="_blank"` are statically present with no code path that
can drop them. Nothing in the change logs, transmits, or otherwise re-exposes the conference URL,
and no dependency was added.

The notes are two: one **medium** finding where the guard validates a *different* URL than the one
the browser actually resolves (S-1 — not a scheme bypass, but it does hand an attacker a
same-origin navigation primitive, which reaches a destructive dev-only route), and one **low**
geometry finding where the all-day join control overhangs the chip below it (S-2). Neither blocks
Gate 3 in my judgement, but S-1 has a two-line fix and should be taken now rather than deferred,
because this change is explicitly establishing the guard pattern that three other call sites are
expected to adopt later — a subtly incomplete pattern will be copied.

## 2. Threat model for this change

**The asset.** `event.conference.url` is a bearer capability: possession of a meeting join URL is
frequently sufficient to enter the meeting. `event.title` is medium-sensitivity PII (client names,
candidate names, deal topics).

**Who controls the input.** `conference.url` is provider-sourced — Google's `hangoutLink` /
`entryPoints`, collapsed upstream in `packages/sync`. The user does not type it and the event form
cannot set it. The trust boundary that matters is therefore *not* Compass↔user; it is
**Compass↔"anyone who can put an event on the user's calendar."** In practice that is *any sender
on the internet*: a meeting invite from an arbitrary Gmail address lands on the invitee's calendar
(often auto-added, depending on Google Calendar settings) carrying attacker-chosen title and
conference data. So `conference.url` must be treated as fully attacker-controlled, low-effort,
unauthenticated input.

**Trust boundaries crossed by this change.**

| Boundary | Crossed how | Guard |
|---|---|---|
| Attacker-controlled string → live DOM `href` (navigation sink) | `EventJoinIcon.tsx:103` | `resolveJoinHref` (`EventJoinIcon.tsx:37-59`) — scheme allowlist |
| Attacker-controlled string → outbound `Referer` header | `target="_blank"` | `rel="noreferrer"` (`EventJoinIcon.tsx:104`) |
| Opened tab → opener window object | `target="_blank"` | `rel="noopener"` (same line) |
| Attacker-controlled string → any log / analytics / error path | none introduced | verified absent by grep |
| Attacker-controlled string → HTML text (injection) | none — React `setAttribute`, no SSR, no `dangerouslySetInnerHTML` anywhere in `packages/web/src` | N/A |
| Pointer routing (drag/resize disown) | `dom.ts:56-61` + both adapters | attribute is a module constant, set in exactly one place |

**What this change does *not* introduce:** no new persistence, no new network call, no new logged
field, no new dependency, no new secret, no server-side surface at all. It is render-only.

## 3. Findings

Severity reflects exploitability *given* an attacker who can send the victim a calendar invite.

---

### S-1 — medium — the guard validates a URL the browser may not resolve to

**Location:** `packages/web/src/grid/components/EventJoinIcon.tsx:51` and `:56-58`
(`parsed = new URL(url)` with no base, then `return url` — the *original* string, not `parsed.href`).

**Issue.** `resolveJoinHref` parses `url` with **no base**, then, on success, hands the **original
string** to `href`. The browser resolves that attribute **against the document base URL**. For an
absolute URL with an authority (`https://host/...`) these two parses are identical — I verified
this over the whole corpus in §4, and the *scheme* can never diverge. But the WHATWG URL parser has
a case where a base *is* consulted even though a scheme is present: when the input's scheme is a
*special* scheme **identical to the base's scheme** and the input has no `//` authority, the parser
falls into the relative state. In that case the two parses differ in **host and path** while both
remaining `https:`.

Measured in Chromium with base `https://victim.test/app/week`:

| stored `conference.url` | `new URL(raw)` — what the guard validated | rendered `a.href` — where the click actually goes |
|---|---|---|
| `https:evil.test/x` | `https://evil.test/x` | **`https://victim.test/app/evil.test/x`** |
| `https:/evil.test/x` | `https://evil.test/x` | **`https://victim.test/evil.test/x`** |
| `https:/foo` | `https://foo/` | **`https://victim.test/foo`** |
| `http:evil.test/x` (base is https) | `http://evil.test/x` | `http://evil.test/x` (no divergence — schemes differ) |

The divergence always lands on the **app's own origin**, so it is not a scheme escape and not an
open redirect to an attacker host. It is a **same-origin navigation primitive**: attacker-supplied
calendar data can make the "Join" link open *any path + query on the Compass origin* in a new tab.

**Exploitability.** Requires the stored scheme to match the deployment scheme, which the attacker
knows (`https:` for a deployed instance, `http:` for a local dev server). Concretely reachable
targets today:

- `https:/cleanup` → `https://<app>/cleanup`. `CleanupView` (`packages/web/src/views/Cleanup/Cleanup.tsx:23-49`)
  calls `clearAllBrowserStorage()` **on mount, with no confirmation** — SuperTokens `signOut()`,
  deletes every `compass.*` localStorage key, and `deleteDatabase("compass-local")`. One click on a
  "Join" button destroys local data and signs the user out. **Mitigating:** the route is registered
  only when `IS_DEV` (`packages/web/src/routers/router.routes.tsx:136`), so this is a
  developer/self-hoster hazard, not a production one.
- `https:/auth/google/callback?code=…&state=…` → reaches `completeGoogleAuthorization` with an
  attacker-chosen query. **Not exploitable:** it requires a `state` matching an intent the app
  itself stored in sessionStorage (`complete-google-authorization.ts:85-97`), which the attacker
  cannot guess or plant. Recorded because it is the shape of the risk if a future GET route acts on
  its query.
- Otherwise limited to opening `/week`, `/day`, `/life` in a new tab — nuisance-grade.

I rate this medium rather than low because the primitive is real, the input is unauthenticated and
remote, one currently-reachable target is destructive, and — most importantly — this function is
the reference implementation three other call sites are slated to copy (FU-SEC-1).

**Fix (two lines, preserves the byte-identity requirement).** Pin what you validated to what the
browser will resolve:

```ts
// after the existing successful parse
if (typeof window !== "undefined" && parsed.href !== new URL(url, window.location.href).href) {
  return null; // the rendered destination is not the one that was validated
}
```

Or, if byte-identity can be relaxed, `return parsed.href` — which removes the entire class. If the
`window`-free form is preferred for the `bun:test` environment, parsing against a fixed sentinel
base of the *same scheme* (e.g. `new URL(url, "https://x.invalid/")` when `parsed.protocol` is
`https:`) reproduces the relative-state behaviour deterministically. Add the four rows of the table
above as unit cases; none of them is covered today.

---

### S-2 — low — the all-day join control overhangs the chip in the lane below, at a higher z-index

**Location:** `packages/web/src/grid/components/EventJoinIcon.tsx:107` (`height: 24`) and `:112-114`
(`top: position.top + Math.max(0, (position.height - 24) / 2)`), against
`packages/web/src/grid/grid.constants.ts:3-5` (`EVENT_ALLDAY_HEIGHT = 20`, `EVENT_ALLDAY_GAP = 3`,
row pitch `23`).

**Issue.** For a 20px all-day chip the `Math.max(0, …)` clamp pins the control to the chip's top, so
it spans `[top, top+24]` while the chip ends at `top+20` and the next lane's chip begins at
`top+23`. The control therefore covers the **top 1px** of the chip directly below it, across its
24px width, at `zIndex = position.zIndex + 1` — above that chip. A pointerdown in that 1px strip is
routed to the *upper* event's join link (and `isJoinControlTarget` additionally disowns the pointer,
so it is not a drag either).

**Exploitability.** Requires 1px pointer precision on the victim's part and yields "user opens the
attacker's meeting URL in a new tab instead of opening the intended event" — i.e. a very
low-reliability tapjack. Horizontally the control is always inside its own card's rect
(`left + width - inset - 24 >= left` for all gated widths ≥60), and in the timed grid the deck's
`zIndex = order + 1` (`timed-deck.layout.ts:101`) means the `+1` control ties with the next card in
the deck and loses on DOM order, so it is occluded rather than occluding. All-day is the only case
that overhangs.

**Fix.** Clamp the control's height to the host card when the card is shorter:
`height: Math.min(JOIN_CONTROL_SIZE_PX, position.height)` — or shift the whole control up by the
overhang. Note this collides with the already-accepted WCAG 2.5.8 trade-off (a 20px chip cannot host
a 24px target); if the 24px size is kept for a11y reasons, at minimum keep the control's *bottom*
at `position.top + position.height` and let it grow upward instead.

---

### S-3 — info — userinfo-in-authority URLs are accepted (correctly) and are visually deceptive

**Location:** `EventJoinIcon.tsx:56-58`.

`https://meet.google.com@evil.test/join` parses as `https:` with host `evil.test` and is **allowed**
— correctly, since it is a well-formed https URL and rejecting userinfo would break legitimate
providers. The browser status bar on hover shows the full string, and the control's accessible name
is `Join <title>`, so nothing in the UI names the real destination. This is inherent to rendering
provider URLs as links and is identical to the three pre-existing anchors; recorded so it is a
conscious acceptance, not an oversight. No action required in this change.

---

### S-4 — info — leak surfaces for the conference URL: none found

Checked and clear across all 11 changed files:

- Not logged: no `console.*`, no `Sentry`, no `posthog`/`track()` call in `EventJoinIcon.tsx`,
  `TimedEventCard.tsx`, `AllDayEventCard.tsx`, or `dom.ts` (grep, exit 1).
- Not placed in a `title`/tooltip attribute anywhere — the anchor has `aria-label` and `href` only.
- Not in the accessible name: the name is `Join ${eventTitle}`; the URL is never spoken as content.
- Not in an error message: `resolveJoinHref` swallows the parse failure and returns `null`; it never
  echoes the input.
- Not duplicated into the drag ghost: `createDraftEventClone` (`interaction/dom/draft-event.clone.ts:2`)
  clones the *card root*, and the anchor is a **sibling** of that root, so the URL never enters the
  floating clone that gets re-parented during a drag. Verified structurally, not just from the comment.
- `rel="noopener noreferrer"` and `target="_blank"` are **static JSX literals** on a single `<a>`
  (`EventJoinIcon.tsx:104, 118`) with no conditional, no prop override, and no spread that could
  shadow them. There is no code path that produces `target="_blank"` without both tokens.
  `noreferrer` is what suppresses the `Referer` header to the join target; `noopener` severs
  `window.opener`. Asserted in `EventJoinIcon.test.tsx:32-47` and in both e2e specs.

Residual, inherent, and unavoidable for any link: the URL is visible in the browser status bar on
hover and in screen-reader link lists that are configured to announce URLs.

---

### S-5 — info — the e2e seeding helper is test-only and clean

**Location:** `e2e/utils/event-test-utils.ts:358-469` (`seedEventWithConference`).

- **Cannot ship.** `e2e/` is a standalone Playwright project with its own `e2e/tsconfig.json`
  (`"include": ["./**/*.ts"]`). It is not under any `packages/*/src` tree, it is not referenced by
  the web build, and nothing in `packages/*/src` imports from `e2e/` (grep: the only hit is a
  *comment* at `packages/web/src/auth/state/user-metadata.store.ts:76`). The app's `@web/*` and
  `@core/*` path aliases (`packages/web/tsconfig.json`) do not map `e2e/`, so `packages/web/src`
  cannot import it even accidentally.
- **No credentials, no secrets.** Secret-pattern grep across all 11 changed files returns nothing.
  The only identifiers are `crypto.getRandomValues`-derived hex ids.
- **No outbound network.** Both new specs build the conference URL as
  `new URL("/e2e-join-target", page.url())` — same-origin by construction. There is no external host
  literal anywhere in the three e2e files (grep for `https?://`: no matches). CI needs no egress.
- **Writes are confined to the test browser profile:** the `compass-local` IndexedDB `events` store
  and `localStorage["compass.localCalendarId"]` (written only if absent). The helper throws rather
  than creating the store if `prepareCalendarPage` has not run first, so it cannot fabricate a
  half-built schema.
- The hostile fixture values (`javascript:alert(1)`) live only in seeded IndexedDB rows and unit
  props. That is the right place for them.

---

### S-6 — info — the pointer-disown attribute cannot be forged, and disowning is bounded

**Location:** `packages/web/src/grid/interaction/dom.ts:22-23, 45-61`; both adapters at
`week-interaction.adapter.ts:487-495` / `day-interaction.adapter.ts:438-446`.

`EVENT_JOIN_CONTROL_ATTRIBUTE` is a module constant, and the full-repo grep for both the constant
and the raw string `data-calendar-event-join-control` returns exactly five sites: the two
declarations, the `closest()` call, the single static JSX spread in `EventJoinIcon.tsx:100`, and one
assertion in `EventJoinIcon.test.tsx:76`. The attribute name is a constant (not interpolated from
data) and the value is the literal `"true"`, which the selector requires. **No attacker-influenced
value can cause the attribute to appear on an element.**

Abuse of the disown itself is bounded: it only fires for a pointerdown whose target has the
attribute on itself or an ancestor, i.e. inside a 24×24 box that (in the timed grid) lies wholly
within its own card. The consequence is that drag/resize is unavailable in that box — a documented
UX trade-off, matching how `getResizeHandleEdge` already behaves, not a way to suppress a gesture
elsewhere on the grid. The one place the box escapes its own card is S-2.

---

### S-7 — info — no dependency change

`git status --porcelain package.json bun.lock packages/*/package.json` → empty. No new dependency,
no lockfile churn. `npm audit --omit=dev` is not runnable here (no `package-lock.json`; the repo is
Bun-managed), so I ran the equivalent: `bun audit --production` → **75 pre-existing vulnerabilities
(26 high, 41 moderate, 8 low)**, all in transitively-inherited packages (`nanoid`, `postcss`,
`ws` via `jsdom`, `@tiptap/core`, …). **None is attributable to this run** and none is reachable
from the changed files. Advisory only — see *Noted* below.

## 4. AC-9 guard analysis — explicit verdict

**Verdict: `resolveJoinHref` is sound as a scheme guard. I could not bypass it.**
The crux question posed — *can the string the browser resolves for `href` ever differ in effective
**scheme** from the string `new URL()` parsed?* — answers **no**, and I established that
empirically rather than by argument.

**Method.** Real Chromium (Playwright, `@playwright/test`), document base `https://victim.test/app/week`.
For each input I ran the exact `resolveJoinHref` body, and when it returned non-null I did
`a.setAttribute("href", returned)` on a live element and read back `a.protocol` / `a.href` — i.e.
the browser's own resolution of the attribute, which is what a click follows. 65 inputs.
**Mismatches (allowed by the guard, but resolving to a non-http(s) scheme in the DOM): 0.**

Bypasses attempted and what each returned:

| Payload class | Examples | Result |
|---|---|---|
| Plain dangerous schemes | `javascript:alert(1)`, `data:text/html,<script>…`, `data:…;base64,…`, `vbscript:msgbox(1)` | **BLOCK** |
| Case variation | `JavaScript:`, `JAVASCRIPT:` | **BLOCK** (`parsed.protocol` is lowercased by spec) |
| Leading whitespace / C0 | `" javascript:"`, `"\tjavascript:"`, `"\njavascript:"`, `"\rjavascript:"`, `"\u000b"`, `"\f"`, `" \t\n\r "` prefix | **BLOCK** — the parser strips leading C0/space *before* scheme detection, so the guard sees `javascript:` too |
| Embedded tab/newline in the scheme | `java\tscript:`, `java\nscript:`, `java\rscript:` | **BLOCK** — tab/LF/CR are removed *everywhere* in the input by the parser, reassembling `javascript:` for the guard exactly as it does for the browser |
| NUL and other C0 | `"\u0000javascript:"`, `java\u0000script:`, `javascript\u0000:`, `"\u0001"`, `"\u001f"`, `"\u007f"` prefixes | **BLOCK** (these do *not* reassemble; they simply fail to parse) |
| Unicode look-alike / BOM prefixes | `"\u00a0javascript:"`, `"\u2028javascript:"`, `"\ufeffjavascript:"` | **BLOCK** (not stripped → unparseable) |
| Confusable schemes | `blob:https://…`, `filesystem:https://…`, `file:///etc/passwd`, `about:blank`, `chrome://settings`, `view-source:https://…`, `ws://`, `mailto:`, `tel:`, `intent://…#Intent;scheme=http;end` | **BLOCK** — every one, including the two (`blob:`, `filesystem:`) whose *inner* URL is https |
| Scheme smuggling | `https:javascript:alert(1)` | **BLOCK** (parses to `https://javascript:alert(1)` → invalid port → throws) |
| Protocol-relative / relative | `//evil.test/path`, `/relative`, `relative`, `""`, `"not a url"` | **BLOCK** — the deliberate omission of a base is what does this, and it is the right call |
| Backslash confusion | `https:\\evil.test\x`, `http:/\evil.test/x`, `https://good.test\@evil.test/` | **ALLOW**, and the DOM resolves *identically* to what was validated (backslashes are normalised to `/` by both) — no divergence |
| Userinfo tricks | `https://evil.test@good.test/`, `https://good.test@evil.test/` | **ALLOW**, DOM host matches the validated host — see S-3 |
| Payload smuggled in path/query | `https://good.test/?next=javascript:alert(1)`, `https://good.test/%0Ajavascript:alert(1)` | **ALLOW** and harmless — the scheme is https and the payload is inert path/query data |
| Uppercase / mixed valid | `HTTPS://MEET.EXAMPLE.COM/x`, `hTtPs://good.test/x` | **ALLOW** (correct) |
| IDN / punycode | `https://гoogle.test/x` → `https://xn--oogle-mwe.test/x` | **ALLOW** (correct; homograph display is a browser concern) |
| Tab *inside* a valid scheme | `ht\ttps://good.test`, `https\t://good.test` | **ALLOW**, DOM resolves to `https://good.test/` — same as validated |

**Why "return the original string" is nonetheless safe for scheme.** Both `new URL(input)` and
`href` attribute resolution run the *same* WHATWG basic URL parser, including the identical
pre-processing (strip leading/trailing C0-or-space; remove all tab/LF/CR). The base URL is consulted
only in the no-scheme and special-relative states. Any input that survives `new URL(input)` **with
no base** has already committed to a scheme, and the guard has already inspected the *post-parse*
`parsed.protocol` — not a regex over the raw text — so scheme-obfuscation tricks that a textual
allowlist would miss are normalised away before the comparison. This is exactly why the
`parsed.protocol` form is stronger than a `startsWith("https://")` check would have been.

**The single caveat is S-1:** base-independence holds for *scheme*, not for *host and path*. The
special-relative state (input scheme === base scheme, no `//`) makes the rendered target differ
from the validated one while keeping the scheme https. That is a correctness gap in the
"byte-identity" decision, not a hole in the allowlist — but it is the reason I do not sign the guard
off as unconditionally correct.

**Secondary observation (verified, informs the follow-ups, not a finding on this change).** In
current Chromium, a `javascript:` URL on an anchor with `target="_blank"` does **not** execute:
`<a href="javascript:…">` clicked *in-tab* set the flag in the app's own origin (`pwned: true`,
origin `https://victim.test`), but the same anchor with `target="_blank" rel="noopener noreferrer"`
produced an `about:blank` popup and executed nothing, as did
`window.open("javascript:…", "_blank", "noopener,noreferrer")`. So the browser is providing a second
layer here. **Do not rely on it:** it is engine- and version-specific, it evaporates the moment a
link is opened in the same tab or a `target` is dropped in a refactor, and it does nothing about
external-protocol-handler schemes (`intent:`, `ms-…:`, `search-ms:`), which `resolveJoinHref`
correctly blocks and no browser blocks for you.

## 5. Data-handling review — requirements §7, confirmed against the code

| Field | §7 claim | Verdict against the code |
|---|---|---|
| `event.conference.url` | Rendered into an `href`, gated by the FR-2 scheme guard; never logged, never transmitted; `rel="noopener noreferrer"` required | **Confirmed.** Guard at `EventJoinIcon.tsx:37-59`, applied twice (card-level at `TimedEventCard.tsx:142` / `AllDayEventCard.tsx:93`, then again inside the component at `:95`; idempotent — re-parsing an already-validated string yields the same verdict). `rel`/`target` static at `:104`/`:118`. No log, analytics, tooltip, error echo, or clone path (S-4). **Correction to the wording:** "never transmitted" is true of the app, but the URL *is* sent to the join target as the navigation itself, and the `Referer` suppression that §7 credits is doing real work — it prevents the *Compass* URL leaking to the provider, not the join URL leaking. **Addition:** the URL is also visible in the browser status bar on hover and in SR link lists. **Caveat:** S-1 means the *validated* URL and the *navigated* URL are not guaranteed to be the same URL. |
| `event.conference.label` | "Display / accessible naming only" | **Corrected — inaccurate for this change.** `EventJoinIcon` never reads `label`; the accessible name is `Join ${eventTitle}` (`:101`) and the glyph is `aria-hidden`. `label` is consumed only by the pre-existing `EventDetailsSection.tsx:55`. The e2e helper defaults it to `"Compass Meet"` for seeding. This change's handling of `label` is: **unused**. Lower risk than §7 states, not higher. |
| `event.title` | Additionally placed into the join control's accessible name; no net-new exposure surface | **Confirmed — I agree it is not net-new.** The same title is already announced by the host card's own `aria-label` in the same view: `TimedEventCard.tsx:281-282` (`Timed event: ${eventTitle}, …`) and `AllDayEventCard.tsx:148` (`All-day event: ${event.title \|\| "Untitled event"}`), and it is rendered as visible text on the card. A screen-reader user hearing `Join Acme — layoff planning` learns nothing they did not already learn from the card. **One thing the *link* context does change:** the title now also appears in the browser's **link list / "Links" rotor** and in the status-bar tooltip context, i.e. in surfaces that enumerate links rather than grid cards. That is a change of *placement*, not of audience — every one of those surfaces is same-origin, same-session, same-user. It does not survive a screenshot or a shoulder-surf any differently than the card text does. Net-new exposure: **none.** |
| — | "No new persistence, no new network call, no new logging. The change is render-only." | **Confirmed** for `packages/web/src`. The one write introduced anywhere in the run is `seedEventWithConference` writing IndexedDB + one `localStorage` key, which is Playwright-only and cannot reach a shipped bundle (S-5). |

**Additional PII/data checks performed (all clear):** no secret-shaped literal in any of the 11 files;
no `.env`/config file touched (`.env*` is gitignored repo-wide); no fixture credential; no external
host contacted by the new e2e specs.

## 6. Follow-up security tickets

Worded to stand alone, without this run's context.

**FU-SEC-1 — Extract one scheme-guarded join-link helper and adopt it at all four call sites.**
`packages/web/src/components/Sidebar/UpNextCard/UpNextCard.tsx:89`,
`packages/web/src/components/Sidebar/UpNextCard/UpNextBanner.tsx:32` (`window.open`, also bound to
the `V` keyboard shortcut at `:41-43`), and
`packages/web/src/views/Forms/EventForm/EventDetailsSection.tsx:48` each render or open
`event.conference.url` **with no scheme check at all**. `ConferenceSchema.url` is `z.url()`, which
validates parseability only and accepts `javascript:` and `data:`. The URL is provider-sourced, so
any sender who can get a meeting invite onto the user's calendar controls it. Chromium currently
refuses to execute `javascript:` for `target="_blank"` / `window.open` navigations, which
accidentally covers these three today — that is an engine behaviour, not a control, and it does not
cover external-protocol-handler schemes. Move `resolveJoinHref` out of
`packages/web/src/grid/components/EventJoinIcon.tsx` into a shared module and use it at all four
sites. *(Deliberately deferred when the grid join control was added; the guard pattern now exists
and should be centralised before it is copy-pasted a fifth time.)*

**FU-SEC-2 — Fix the validated-vs-rendered URL divergence in the join-link guard (finding S-1).**
`resolveJoinHref` parses with `new URL(url)` (no base) but returns the **original** string, which
the browser then resolves against the document base. When the stored scheme equals the page's
scheme and the value has no `//` authority (e.g. `https:/cleanup`, `https:evil.test/x`), the parser
enters the relative state and the click navigates **same-origin to an attacker-chosen path and
query**, not to the host that was validated. Pin them together — reject when
`parsed.href !== new URL(url, document.baseURI).href`, or return `parsed.href` — and add the four
divergent inputs as regression tests. Do this as part of FU-SEC-1 so the shared helper ships correct.

**FU-SEC-3 — Constrain the conference URL scheme at the contract boundary.**
`ConferenceSchema.url` in `packages/core/src/types/event-attendance.contracts.ts:31-35` is a bare
`z.url()`. Add a scheme refinement (`http:`/`https:` only) so every consumer — web, backend,
sync — inherits the constraint instead of each render site re-deriving it, and so hostile values are
rejected at ingest rather than at paint. Requires an audit of existing stored rows and a decision on
whether to drop or quarantine non-conforming conference data on read.

**FU-SEC-4 — The `/cleanup` route destroys local data on mount with no confirmation.**
`packages/web/src/views/Cleanup/Cleanup.tsx:23-49` calls `clearAllBrowserStorage()` from a `useEffect`
on first render — SuperTokens `signOut()`, removal of every `compass.*` localStorage key, and
`indexedDB.deleteDatabase("compass-local")` — with no user confirmation. It is currently registered
only under `IS_DEV` (`packages/web/src/routers/router.routes.tsx:136`), which is the only thing
keeping this out of production. Any same-origin navigation primitive (see FU-SEC-2) turns it into
one-click data destruction for developers and self-hosters. Gate it behind an explicit in-page
confirmation rather than behind route registration alone.

**FU-SEC-5 — All-day join control overhangs the chip below it (finding S-2).**
The 24px control on a 20px all-day chip (pitch 23px) covers the top 1px of the next lane's chip at a
higher z-index, so a pointerdown there activates the *upper* event's join link. Clamp the control's
height to the host card, or anchor its bottom edge to the card's bottom. Interacts with the accepted
WCAG 2.5.8 target-size trade-off, so resolve both together.

## Noted (pre-existing, out of scope — advisory, does not gate this run)

- **Dependency advisories.** `bun audit --production`: 75 vulnerabilities (26 high, 41 moderate,
  8 low) across `nanoid`, `postcss`, `ws` (via `jsdom`), `@tiptap/core` and others. All predate this
  run — `package.json` and `bun.lock` are untouched — and none is reachable from the changed files.
  Worth its own remediation ticket. (`npm audit --omit=dev` is not applicable: the repo has no
  `package-lock.json`.)
- **The three unguarded conference anchors** and **`ConferenceSchema` being left as `z.url()`** were
  explicitly scoped out of this change and are captured above as FU-SEC-1 and FU-SEC-3.
- **WCAG 2.5.8 target-size on the 20px all-day chip** is an accessibility trade-off, already
  accepted. It acquires a (minor) security angle only through S-2 / FU-SEC-5.
