# Security Review — one-click join (brownfield, changed files only)

Run: `20260825-220640-feature-extend-one-click-join`
Baseline: `2d81253a`
Scope: the 7 files this run wrote (per `provenance.json`) plus the immediate blast radius
needed to judge them (interaction boundary, conference data flow, page-level instrumentation).

## Summary — overall risk: LOW-to-MEDIUM

The change is, on the whole, careful and better-defended than the code it sits next to. The
one genuinely dangerous property of this data flow — that `Conference.url` is validated with
`z.url()`, which I confirmed empirically accepts `javascript:`, `data:`, `vbscript:`, `blob:`
and `filesystem:` — was identified by the implementer and closed at the new sink with a
protocol allowlist (`EventJoinIcon.tsx:27-29`). `rel="noopener noreferrer"`, `target="_blank"`,
`draggable={false}` are all correct. The new interaction opt-out is not attacker-settable: it
is a constant spread from `dom.ts:26-28`, the only HTML-injection path in the web package
(`DescriptionEditor`) runs DOMPurify with `ALLOWED_ATTR: ["href"]`, and nothing in the grid
renders untrusted markup. The guard is centralised inside `getInteractionTarget`, so every
caller of that resolver inherits it rather than each call site re-checking.

What remains is not a memory-unsafe or injection-class problem; it is a *trust-presentation*
problem. Anyone who can drop an event on the user's calendar now gets a one-click, unlabelled,
provider-styled link on the calendar grid, with no hostname shown anywhere in the UI and an
accessible name ("Join <title> via <label>") built from two attacker-controlled strings. That
is the finding I would not sign off without addressing (SEC-01). Secondary: the meeting URL is
now an `href` in the grid DOM for every visible event, and PostHog autocapture — enabled by
default in `posthog.bootstrap.ts`, with `mask_all_element_attributes` left at its `false`
default — ships `attr__href` off-origin when the link is clicked (SEC-02).

No secrets, no credentials, no server-side surface, no dependency changes in this run.

## Findings

| ID | Severity | CWE | Location | Description | Attack scenario | Exploitability | Remediation |
|---|---|---|---|---|---|---|---|
| SEC-01 | Medium | CWE-451 (UI misrepresentation), CWE-1021 | `packages/web/src/grid/components/EventJoinIcon.tsx:75-94` | The join affordance discloses no destination. The icon is a generic `VideoCameraIcon`; the only text is the `aria-label`, built from `event.title` and `conference.label`, both attacker-controlled. There is no `title` attribute, so there is no hover tooltip, and keyboard/AT users get no host at all. The rendered `href` is whatever the invite carried. | Mallory emails a calendar invite to the victim (Google auto-adds invitations from unknown senders under the common default). She sets `conferenceData.conferenceSolution.name = "Google Meet"` and `entryPoints[].uri = "https://meet-google.<attacker>.com/j/abc-defg-hij"`. Compass's normalizer (`google-event.normalizer.ts:159-175`) takes the first `entryPointType === "video"` URI verbatim. The victim sees a normal-looking meeting on the grid, one left-click opens the attacker page in a new tab — a Google/Zoom sign-in replica, or a "install our meeting helper" prompt. AT users hear "Join Standup via Google Meet". | Moderate. No account access needed, only the victim's calendar address; the payload is a normal invite. Requires one user click, but the change is specifically designed to make that click a single, natural one. Pre-change the same URL took an extra step (open event form) that at least rendered `conference.label` in text. | Disclose the destination host on the affordance: set `title={new URL(conference.url).host}` (reuse the already-parsed URL from `getJoinableConference` rather than re-parsing) and append the host to `accessibleName`, e.g. `` `Join ${eventTitle} via ${conference.label ?? "meeting"} (${host})` ``. Optionally: keep the bare one-click icon only for an allowlist of known conference hosts (`meet.google.com`, `*.zoom.us`, `teams.microsoft.com`, `*.webex.com`) and, for anything else, render the icon so it opens the event details instead of navigating. |
| SEC-02 | Low (Medium if session replay is enabled project-side) | CWE-200 | `packages/web/src/grid/components/EventJoinIcon.tsx:91` + `packages/web/src/auth/posthog/posthog.bootstrap.ts:23-45` | The meeting URL is now an `href` attribute in the grid DOM for every visible event with a conference, and PostHog autocapture is on (never disabled in `posthog.init`; `mask_all_element_attributes` defaults to `false`; I confirmed `attr__href` is collected and truncated at 1024 chars in the bundled `posthog-js`). Meeting URLs are capability URLs — a Zoom link with `?pwd=`, a Teams link with tenant/thread identifiers, a Meet code — so the URL is the credential. | The victim clicks Join. PostHog receives `$autocapture` with `attr__href = <full meeting URL>`. Anyone with access to the analytics project (or the PostHog "site apps" the app opts into via `opt_in_site_apps: true`, which execute remotely-configured JS in the page) can enumerate the user's joinable meetings. If the PostHog project has session replay switched on, the rrweb DOM snapshot carries every visible event's meeting URL, not just clicked ones — no click required. | Low as a deliberate attack (requires access to the analytics vendor/project); high as an accidental data-handling exposure, which is the realistic failure mode. Note the *click*-capture shape is pre-existing (`EventDetailsSection.tsx:47-52` is also an anchor); what is new is grid-wide, always-present exposure. | Add `ph-no-capture` to the anchor's `className` (the class is honoured by the bundled `posthog-js`), or set `element_attribute_ignorelist: ["href"]` in `posthog.init`. Confirm with the PostHog project owner whether session replay is enabled; if it is, also add a replay mask to the anchor. Decide explicitly whether meeting URLs are in scope for the analytics subprocessor. |
| SEC-03 | Low | CWE-319 | `packages/web/src/grid/components/EventJoinIcon.tsx:29` | The allowlist admits `http:` as well as `https:`. Every real conference provider is HTTPS-only, so `http:` in this field is either a misconfiguration or hostile. A top-level navigation to `http:` is not blocked by mixed-content rules, so the click silently leaves TLS. | A hostile invite sets a plaintext `http://` entry point; the victim's click is then trivially interceptable on a hostile network, and any redirect chain is observable/injectable. | Low — needs both a hostile invite and a network position, or just an incompetent organizer. | Drop `http:` from the allowlist: `return protocol === "https:" ? conference : null;`. Update the two `javascript:` specs to also pin `http://…` as non-renderable so the narrowing cannot be silently reverted. |
| SEC-04 | Info | CWE-1287 | `packages/web/src/grid/components/EventJoinIcon.tsx:27` vs `:91` | The gate parses `conference.url` and then discards the parse; the `href` is set from the raw string. Anchor `href` resolution and `new URL()` are the same WHATWG parser, and I verified the normalising cases agree (`JaVaScRiPt:`, embedded tab/newline, leading space all normalise to `javascript:` and are blocked), so there is no live divergence — but the invariant is validated on one value and applied to a different one, which is the shape that becomes a bug the moment either side gains a wrapper. | None currently. | None currently. | Have `getJoinableConference` return the conference with the normalised `url: parsed.href` (or return the parsed `URL` alongside), and render `href` from that, so the value checked is the value used. |

### Not applicable to this change

The standing checklist items for PII-at-rest encryption, role-based response masking, audit-log
ordering/append-only-ness, JWT secret sourcing, password hashing cost factor, guard coverage on
controller routes, rate limiting, and the global error filter are **out of scope for these 7
files**: the run touched only `packages/web` client-side rendering and pointer-interaction code
and added no route, no persistence, no auth path, and no server module. I am recording these as
not-applicable rather than as passes — I did not audit the server surface in this run and no
statement here should be read as clearing it.

## Controls verified as present and working

- **Scheme allowlist on the new sink.** `EventJoinIcon.tsx:26-31` re-parses `conference.url`
  and renders only `http:`/`https:`. This is load-bearing and not redundant: I ran the repo's
  own `zod@3.25.76` `zod/v4` `z.url()` against `javascript:alert(1)`, `JaVaScRiPt:…`,
  `data:text/html,…`, `vbscript:`, `blob:`, `filesystem:`, `ms-msdt:` — **every one passes the
  schema**. I then ran the gate's exact predicate over the same corpus plus tab/newline/leading
  -space obfuscations: all script-capable schemes blocked, `http`/`https` allowed, relative and
  protocol-relative inputs rejected by the `try/catch`.
- **Both cards go through the single gate.** `TimedEventCard.tsx:123` and
  `AllDayEventCard.tsx:79`; the icon is rendered only inside `joinConference && …`
  (`TimedEventCard.tsx:370-377`, `AllDayEventCard.tsx:233-240`). No third render path exists —
  `EventJoinIcon` has exactly two importers.
- **Tabnabbing and referrer.** `rel="noopener noreferrer"` at `EventJoinIcon.tsx:92` with
  `target="_blank"` at `:94`. The opened page gets no `window.opener` handle and no `Referer`,
  so the meeting URL is not leaked to the destination's referrer chain and the destination
  cannot navigate the Compass tab.
- **The Space-key path does not bypass anything.** `EventJoinIcon.tsx:95-110` calls
  `e.currentTarget.click()` from inside a real user keydown, so it inherits transient user
  activation and re-enters the same anchor with the same `rel`/`target`; it cannot be reached
  for a URL the gate rejected, because the element would not exist.
- **The interaction opt-out is not attacker-settable.** The attribute is written only via the
  frozen constant at `dom.ts:22-28`; the reader at `dom.ts:54-60` matches the same selector.
  The only sanitizer-fed HTML in the web package (`DescriptionEditor.tsx:23-27`) allows
  `ALLOWED_ATTR: ["href"]` only — no `data-*` survives — and that content never renders inside
  the grid. There is no `dangerouslySetInnerHTML` anywhere in `packages/web/src`; the single
  `innerHTML` write (`index.tsx:20`) is a static boot-failure string.
- **Declining a target does not widen ownership.** `week-interaction.adapter.ts:168-175` and the
  Day equivalent turn a null target into `{ shouldOwn: false }`, and
  `PointerCaptureBoundary.tsx:69-80` calls `preventDefault()`/`stopPropagation()` *only* when
  `shouldOwn` is true. So the opt-out narrows the grid's pointer ownership over a 12×12px
  element; it does not grant the element anything. Both adapters place the check inside
  `getInteractionTarget`, which is also the resolver used by the engine's `getTarget`
  (`week-interaction.adapter.ts:351`), so drag, resize and click resolution all inherit it —
  there is no second resolver that skips the guard.
- **Drag ghosts are inert.** `draft-event.clone.ts` sets `pointerEvents = "none"` on the clone
  root and the anchor does not re-enable it, so a cloned join link cannot become a pointer
  target or a second navigation surface.
- **Stacking.** `ZIndex.LAYER_5 = 5` (`web.constants.ts:27`) sits far below
  `Z_INDEX_MODAL = 23`, so the link cannot overlay the event form, a menu or a modal — no
  clickjacking-by-z-index within the app.
- **No secrets in the diff.** `grep -rniE "(api[_-]?key|secret|password|token)[ \t]*[:=][ \t]*['\"][a-zA-Z0-9]"` over all 7 files: no matches. Test fixtures use the placeholder
  `https://meet.google.com/abc-defg-hij`, matching the existing demo seed; no real meeting
  URLs, tokens or accounts were committed. `.gitignore:4` is `*.env*`; no `.env` file is
  present in the tree.
- **Dependencies unchanged.** No `package.json` / `bun.lock` delta in this run. `bun audit`
  reports 69 pre-existing advisories (24 high) — concentrated in build/test tooling (`postcss`,
  `nanoid` via postcss, `ws` via `jsdom`, `ip-address` via `mongodb`). None introduced here;
  see the out-of-scope section.

## Data-exposure delta

What is observable now that was not before, and to whom:

1. **In the DOM, continuously:** `conference.url` as an `href` on every visible Week/Day card
   whose event has a conference — potentially dozens at once. Before this change the URL
   entered the DOM only inside an opened event form (`EventDetailsSection.tsx:48`), one event at
   a time, or incidentally inside a description body. Readable by: any script in the app origin
   (the PostHog SDK, plus PostHog *site apps*, which `opt_in_site_apps: true` allows the vendor
   to inject remotely), and any browser extension with content-script access.
2. **Off-origin, on click:** PostHog `$autocapture` with `attr__href` = the full meeting URL
   (and `$dead_click`/`$dead_swipe` variants that the repo already filters for other reasons).
   New in the sense that the grid is a new place this fires from; the shape itself matches the
   existing form anchor.
3. **Off-origin, passively:** if session replay is enabled on the PostHog project (nothing in
   the code enables or disables it — it is a remote setting), replay snapshots now carry every
   on-screen meeting URL.
4. **To assistive technology:** an accessible name combining `event.title` and
   `conference.label`. Both were already on the card or in the form; no new data, but note both
   are attacker-controlled (see SEC-01).
5. **NOT newly exposed:** nothing is sent to the meeting host on render; on click the
   destination receives no `Referer` and no `window.opener` (`EventJoinIcon.tsx:92`). No new
   network request, no new persisted field, no new API surface. The write path is untouched —
   `conference` remains provider-sourced and read-only
   (`event-command.translation.ts:39-57`, `useEventMutations.ts:218`).

## Residual risk accepted

- **Any https URL from a synced invite remains one click away.** Short of an outright provider
  allowlist, that is inherent to the feature; the mitigation is disclosure (SEC-01), not
  blocking. Accepted on the basis that `noopener noreferrer` prevents the opened page from
  touching the Compass tab, and that the scheme gate prevents same-origin script execution.
- **The `javascript:`/`data:` path is defence-in-depth, not a demonstrated exploit.** Google
  documents video entry-point URIs as HTTPS URLs and very likely validates them, and
  `hangoutLink` is Google-generated, so I could not demonstrate a hostile scheme actually
  arriving through the live sync path. The gate is still correct to exist: the *contract*
  (`ConferenceSchema`) admits those schemes, the record round-trips through Compass storage
  where the constraint is only `z.url()`, and the app ships **no CSP on its own document** (see
  out-of-scope note), so the gate is the only thing standing between that field and a script
  URL. Accepted as written.
- **Nested-interactive a11y deviation** — already documented in the component header and owned
  by a follow-up ticket. Not a security control. Related and undocumented: the drag-ghost clone
  is `aria-hidden="true"` yet now contains a natively focusable anchor (`removeAttribute("tabindex")`
  does not defocus an `<a href>`); it is pointer-inert and transient. Info only.

## Test gaps (security-relevant)

1. **The scheme allowlist is pinned only against `javascript:`.** Two specs cover
   `javascript:alert(1)`. A "simplifying" rewrite to `!url.startsWith("javascript:")` — exactly
   the kind of change a future refactor makes — would keep both specs green while reopening
   `data:`, `vbscript:`, `blob:`, `JaVaScRiPt:` and tab/newline-obfuscated variants. Add a
   table-driven spec over `getJoinableConference` covering at minimum
   `data:text/html,…`, `vbscript:`, `blob:https://…`, `JaVaScRiPt:alert(1)`, a leading-space
   `javascript:` and (once SEC-03 lands) `http://…`, plus positive cases for `https://`.
2. **No test exercises the adapter side of the opt-out.** The test file says so itself
   (`EventCard.test.tsx:577-582`). The anchor's `data-calendar-event-interactive` attribute is
   asserted, so deleting it from the component is caught — but deleting the
   `isInteractiveAffordanceTarget` early return from either
   `week-interaction.adapter.ts:491` / `day-interaction.adapter.ts:442` is caught by nothing.
   Add an adapter-level unit test asserting `handlePointerDown` returns
   `shouldOwn: false` for a pointerdown whose target is inside an element carrying the
   attribute, in both adapters. (Its failure mode is a dead link, not an exploit — but the
   attribute/adapter pair is the only reason the sink is reachable at all, and half of it is
   untested.)
3. **No test pins `rel` against partial removal.** `toHaveAttribute("rel", "noopener noreferrer")`
   is asserted in both card specs — this one is actually covered; recorded here only so the
   sign-off is explicit that tabnabbing has a regression test and the scheme gate does not have
   an adequate one.
4. **No integration/e2e test that a plain left click on the icon navigates** rather than
   starting a drag or opening the event form. All new specs render the cards without a
   `PointerCaptureBoundary` or an adapter above them, so the real end-to-end click path is
   unverified by the suite.

Verification run: `bun test src/grid/components/EventCard.test.tsx` — 38 pass, 0 fail.

## Noted (pre-existing, out of scope — advisory, does not gate this run)

These sit outside the 7 changed files and predate `2d81253a`. They are listed because this
change proves the underlying assumption is unsafe, and because the checklist asks whether
equivalent sinks elsewhere are consistent with the guards introduced here. **They are not
blockers for Gate 3.**

- **`packages/web/src/views/Forms/EventForm/EventDetailsSection.tsx:47-52`** renders
  `href={conference.url}` with **no scheme check**. Same untrusted field, same DOM sink, no
  gate. If a hostile scheme ever reaches storage, this is stored XSS in the app origin —
  session cookies, IndexedDB event cache, the works. Fix is one line now that the helper
  exists: gate with `getJoinableConference` (or lift it to a shared `conference.util`).
- **`packages/web/src/components/Sidebar/UpNextCard/UpNextBanner.tsx:31-32`** calls
  `window.open(conferenceUrl, "_blank", "noopener,noreferrer")` with no scheme check, reachable
  by clicking the banner button or pressing `V`. `window.open` on a `javascript:` URL is a
  known execution vector; `noopener` complicates but does not reliably prevent it across
  engines. Same fix.
- **No Content-Security-Policy on the SPA document.** `helmet()` is applied to the Express API
  (`express.server.ts:40`), but the web app is served by `self-host/serve-web.ts`, which sets
  only `Content-Type` (`:49-54`), and the dev server likewise. There is therefore no
  `script-src` backstop behind any of the above — every URL-scheme decision in the client is
  load-bearing on its own. Worth a ticket independent of this feature.
- **`bun audit`: 69 advisories, 24 high** — `postcss` (arbitrary `.map` file read via
  `sourceMappingURL`), `nanoid`, `ws` (via `jsdom`), `ip-address` (via `mongodb`, SSRF-adjacent).
  Almost all reach the tree through build/test tooling. This run changed no dependency; the
  numbers are the baseline's.

## Required fixes before sign-off

1. **SEC-01** — disclose the destination host on the join affordance (`title` + accessible
   name), and decide whether unknown hosts should get the one-click treatment at all.
2. **SEC-03** — narrow the allowlist to `https:` only.
3. **Test gap 1** — extend the scheme-gate specs beyond `javascript:` so the allowlist cannot
   be silently weakened.

Recommended in the same pass, not strictly blocking:

4. **SEC-02** — add `ph-no-capture` (or `element_attribute_ignorelist: ["href"]`) and confirm
   the session-replay setting; this is a data-handling decision as much as a code change.
5. **SEC-04** — render `href` from the parsed URL the gate already produced.
6. **Test gap 2** — adapter-level test for the interaction opt-out.
