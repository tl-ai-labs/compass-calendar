# Security Review — Gate 3 — CMP-103 one-click join

**Run:** `20260822-062945-feature-extend-one-click-join`
**Intent:** `feature-extend` (brownfield — scoped to files touched by this run)
**Reviewed at:** `git HEAD 4189de13`, working tree (nothing committed yet)
**Scope source:** `.sdlc/runs/20260822-062945-feature-extend-one-click-join/provenance.json`

## Tooling note (read before trusting any negative result below)

`Glob` and `Grep` were **not present** in this reviewer's tool surface for this run — only `Read`,
`Bash`, `Write`. Every enumeration and every "no occurrences" claim in this document was produced by
`Bash` (`grep -rn`, `ls`, `git diff`) and the exact command is cited inline. Two checks could **not**
be executed and are reported as unverified rather than as passes: `npm audit --omit=dev` (F-6) and
the empirical behaviour of `zod`'s `z.url()` (F-7). Nothing is reported as safe on the strength of a
search that did not run.

Scope confirmed against `git status --porcelain` — exactly six paths, matching provenance, with no
`package.json`, no lockfile, and no backend/sync/core changes:

```
 M .gitignore
 M packages/web/src/grid/components/AllDayEventCard.tsx
 M packages/web/src/grid/components/EventCard.test.tsx
 M packages/web/src/grid/components/TimedEventCard.tsx
 M packages/web/src/grid/interaction/event.registry.test.ts
 M packages/web/src/grid/interaction/event.registry.ts
?? packages/web/src/grid/components/EventJoinIcon.tsx
```

---

## Summary

The delta is defensively built and the two threats the design set out to stop are genuinely stopped:
the protocol allowlist held against every scripting-scheme payload I threw at it (37 payloads, 0
bypasses), and the meeting URL provably never enters the DOM. `noopener,noreferrer` is correct and is
pinned by a test that cannot pass if either flag is dropped. PostHog suppression is real, not
cargo-culted — I traced `ph-no-capture` through the installed `posthog-js` bundle to the
`explicitNoCapture` early-return that discards the whole autocapture event. The interaction-ignore
attribute is not a spoofable surface, because no grid card renders event-controlled HTML.

Three things keep this from a clean pass. First, ADR-1's choice of `<button>` over `<a href>` removed
the browser's pre-navigation destination disclosure, so a link from an attacker-controlled calendar
invite is now one click away with the user having no way to see where it goes — a consequence ADR-1
did not enumerate. Second, the accessible name interpolates unvalidated provider-supplied text behind
a heuristic ("contains `/`") that tests for URL *shape* rather than for *secret*, so the PII-2
guarantee is label-shape-dependent rather than structural. Third, on the `isBusy` question the run
did not merely omit the guard — it wrote a regression test that **fails if anyone adds it**, turning
an implicit assumption into a codified one that a future engineer must argue their way past. None of
the three is exploitable-today at high severity, so this is a **PASS-WITH-CONDITIONS**, but all three
are cheap to fix now and expensive to fix after the test has ossified.

---

## Findings

| Severity | Category | Location | Issue | Recommendation |
|---|---|---|---|---|
| Medium | Phishing / navigation UX | `EventJoinIcon.tsx:75-119` | Button, no `href` ⇒ no hover status-bar preview, no "copy link address". A conference URL from an attacker-controlled invite navigates on one click with zero destination disclosure. Sibling surface `EventDetailsSection.tsx:48` uses an anchor and does disclose. | Surface the **host only** (not the path/token) in the accessible name and a `title`: `Join Google Meet (meet.google.com)`. PII-safe — the host is not the capability token. |
| Medium | Privacy invariant / masking | `TimedEventCard.tsx:136-143`, `AllDayEventCard.tsx:85-92`, and `EventCard.test.tsx:1026-1062` | No `!event.isBusy` guard, **and** a test actively pins the guard's absence. If any future `GridEvent` producer attaches a `conference` to a masked event, a live capability token renders on a card whose entire purpose is to withhold details. | Add `!event.isBusy` to both `showJoinIcon` chains; invert the test to pin the guard's presence; update requirements §6. See the dedicated opinion below. |
| Low | PII in a11y tree / UI spoofing | `EventJoinIcon.tsx:72`, `EventJoinIcon.tsx:77` | The `!label.includes("/")` filter is a URL-shape test, not a token test. A bare Meet code (`abc-defg-hij`) has no slash, passes, and lands in `aria-label` — that string *is* the join credential. Separately, `conferenceSolution.name` is settable by a third-party Google conferencing add-on, so up to 256 chars of attacker text can reach the accessible name. | Constrain rather than filter: allowlist the label to a short charset/length, or drop the label entirely and use the parsed host from F-1's fix. Broaden the T-20 assertion beyond the full-URL string. |
| Informational | Attribute semantics | `event.registry.ts:112-118` | Selector `[data-calendar-event-interaction-ignore]` is presence-based, so `="false"` also disables interaction. Component writes `"true"`, implying the value is meaningful. | Comment that the value is ignored, or match on `[attr="true"]`. |
| Informational | Dependency risk (pre-existing) | repo-wide | `npm audit --omit=dev` **could not run** (`ENOLOCK`; Bun workspace, no `package-lock.json`). `bun audit --prod` reports 69 vulns / 24 high. Zero introduced by this run — no manifest or lockfile touched. | Out of scope per brownfield rules. Track separately. |
| Informational | Unverified premise | `EventJoinIcon.tsx:16-20`, `event-attendance.contracts.ts:31-34` | ADR-3 rests on "`z.url()` does not categorically exclude `javascript:`". `zod` is **not installed** in this tree, so I could not execute this. Premise unverified — but the mitigation is present and correct regardless, and the unverified direction is the conservative one. | No action. Do not record ADR-3's premise as verified. |

---

### F-1 (Medium) — one-click navigation with no destination disclosure

`EventJoinIcon.tsx:75-119` renders a `<button>` whose `onClick` calls
`window.open(url, "_blank", "noopener,noreferrer")`. There is no `href` anywhere on the element.

The reachability chain is real, not hypothetical. `mapConference`
(`packages/sync/src/providers/google/google-event.normalizer.ts:159-175`) resolves the URL as:

```
item.hangoutLink ?? item.conferenceData?.entryPoints?.find(e => e.entryPointType === "video")?.uri
```

`hangoutLink` is Google-minted, but the `entryPoints[].uri` fallback is **caller-supplied** for any
event created with a custom `conferenceSolution` (a Calendar conferencing add-on). An attacker who
invites the victim to such an event controls that URI. `https://meet.google.com.evil.example/x` is a
valid `https:` URL, so it passes `ConferenceSchema` and passes `isSafeConferenceUrl`. It is not a
guard bypass — the guard is behaving as specified — but the delta then renders it as a camera glyph
with the accessible name `Join <attacker-chosen solution name>` and navigates on click.

What changed relative to the alternatives ADR-1 considered: with an `<a href>`, the browser shows the
destination in the status bar on hover and offers "Copy link address", so a suspicious host is
visible before the click. With a `<button>`, it is not. ADR-1's consequences section lists only the
loss of middle-click and "open in new tab"; the loss of **pre-navigation destination disclosure** is
not listed, and it is the security-relevant half. `noopener,noreferrer` correctly protects the
*calendar tab* after navigation; it does nothing for the user who did not want to navigate at all.

**Fix (cheap, and it also mitigates F-2).** Keep the button. Parse the already-validated URL once and
expose the **host**, which is not the capability token:

```
const host = new URL(url).host;           // "meet.google.com" — safe to display
aria-label = providerLabel ? `Join ${providerLabel} (${host})` : `Join video call (${host})`;
title      = host;
```

This satisfies PII-2 literally — PII-2 forbids the *URL* in a DOM attribute; a bare host is neither
the URL nor a credential — and it restores the disclosure the anchor would have given, while putting
the attacker-chosen label next to the real host where the mismatch is visible.

### F-2 (Low) — the label filter tests for URL shape, not for secrecy

`EventJoinIcon.tsx:72`:

```
const providerLabel = label && !label.includes("/") ? label : null;
```

Two gaps, both concrete:

1. **A token without a slash still passes.** A Google Meet code is `abc-defg-hij`. It contains no
   slash, so it survives the filter and is written into `aria-label="Join abc-defg-hij"` — and
   `https://meet.google.com/abc-defg-hij` is trivially reconstructed. The capability token is then in
   a DOM attribute, which is exactly what PII-2 prohibits. The T-20 test at
   `EventCard.test.tsx:1023` (`expect(container.innerHTML).not.toContain(CONFERENCE.url)`) would not
   catch this: it asserts the absence of the *full URL string*, and the fixture's label is
   `"Google Meet"`, so the assertion passes for a reason unrelated to what it is protecting.
2. **The label is attacker-influenceable.** `mapConference` takes
   `item.conferenceData?.conferenceSolution?.name`, which a conferencing add-on sets freely, bounded
   only by `ConferenceSchema`'s `max(256)`. So up to 256 characters of attacker-chosen text reach the
   accessible name of a control announced to screen-reader users as an action.

Impact is bounded and I want to be precise about it: React escapes attribute values, so this is
**not** HTML or script injection — the ceiling is a11y-tree text spoofing plus the token-leak case in
(1). That is why this is Low and not Medium.

**Fix.** Prefer positive constraint over negative filtering. Either drop the provider label entirely
in favour of F-1's parsed host (strictly better: it cannot be spoofed and cannot carry a token), or
keep it behind an allowlist — e.g. `/^[\p{L}\p{N} .&-]{1,40}$/u` — so a code-shaped or long string is
rejected regardless of whether it happens to contain a slash. Then widen the T-20 assertion to also
assert the absence of the *path segment* (`abc-defg-hij`), not only the whole URL.

### F-3 (Informational) — presence-based ignore selector

`event.registry.ts:112-118` matches `[data-calendar-event-interaction-ignore]` on presence, so
`data-calendar-event-interaction-ignore="false"` disables interaction just as `"true"` does, while
`EventJoinIcon.tsx:76` writes the literal `"true"` and thereby implies the value is read. No impact
today (one writer, one value). Worth one line of comment, or `[attr="true"]`, before a second call
site exists.

---

## Threat-surface assessment (items 1–6 as briefed)

### 1. Reverse tabnabbing (NFR-4) — **CONFIRMED CORRECT AND CORRECTLY PINNED**

`EventJoinIcon.tsx:84` passes the literal `"noopener,noreferrer"`. Both tokens are required, and with
no `rel` attribute available (ADR-1 chose a button) this string is the only protection — as the
design itself flags.

The pinning test is `EventCard.test.tsx:661-683`, and it is genuinely load-bearing:

```
expect(open.mock.calls[0]?.[0]).toBe(CONFERENCE.url);
expect(open.mock.calls[0]?.[1]).toBe("_blank");
expect(open.mock.calls[0]?.[2]).toContain("noopener");
expect(open.mock.calls[0]?.[2]).toContain("noreferrer");
```

The two flags are asserted **independently**, not as one substring match against the literal
`"noopener,noreferrer"`. Dropping either token individually fails exactly one assertion; reordering
them or changing the separator still passes, which is the correct sensitivity. This test cannot pass
with `noopener` or `noreferrer` removed. NFR-4 is satisfied and defended.

Worth recording for future maintainers: the assertion is against the mock's third argument, so it
also survives a refactor that moves the `window.open` call behind a helper, as long as the helper is
still reached from this button.

### 2. URL injection — **NO BYPASS FOUND (37 payloads)**

I executed `isSafeConferenceUrl`'s exact body against every payload named in the brief plus others.
Full results:

**Blocked (23):** `javascript:alert(1)`; space-padded `"  javascript:alert(1)  "`; leading
TAB/LF/CR; TAB, LF, and CR *inside* the scheme (`java\tscript:`); `JavaScript:`; `JaVaScRiPt:`; NUL
prefix; vertical-tab prefix; SOH prefix; NBSP prefix (throws); `data:` plain and base64; `blob:`;
`vbscript:`; `filesystem:`; `file:`; `about:`; `chrome://`; `view-source:`; `intent://`;
`javascript://evil.com/%0aalert(1)`; protocol-relative `//evil.com/phish`; root-relative
`/relative/path`; scheme-less `meet.google.com/abc-defg-hij`; empty string.

Two mechanisms account for all of it, and both are worth understanding rather than trusting:

- **WHATWG normalisation works *for* the guard, not against it.** `new URL()` strips leading and
  trailing C0-control-and-space, and strips TAB/LF/CR from *anywhere* in the input, before scheme
  detection. So `"java\tscript:alert(1)"` and `"\t\n\rjavascript:alert(1)"` both normalise to
  protocol `javascript:` and are rejected. The classic filter-evasion trick that defeats regex-based
  scheme checks is neutralised by parsing rather than pattern-matching. The design comment at
  `EventJoinIcon.tsx:22-24` is accurate.
- **Relative forms fail closed.** `//evil.com`, `/path`, and `meet.google.com/abc` all *throw* in
  `new URL(x)` with no base, so `isSafeConferenceUrl` returns `false`. This matters more than it
  looks: `window.open("//evil.com")` **would** resolve against the Compass origin and navigate to
  `https://evil.com`. The guard's base-less parse is what closes that, and it closes it by accident
  of construction — a future refactor that "helpfully" adds `new URL(url, window.location.href)`
  would silently reopen it. Worth a comment.

**Reaches `window.open` (11), and none is a guard defeat:** embedded credentials
`https://user:pass@evil.com/`; userinfo host-confusion `https://meet.google.com@evil.com/x`; IDN
homograph `https://ɱeet.google.com/x` (→ `xn--eet-2vb.google.com`); punycode
`https://xn--et-fmc.google.com/x`; special-scheme shorthand `https:evil.com`; `http://localhost:8080`;
`http://169.254.169.254/latest/meta-data/`; `https://evil.com/#javascript:alert(1)`; TAB inside the
http scheme `ht\ttps://evil.com`; backslash host-confusion `https://evil.com\@good.com/`.

Every one of these is an ordinary `http(s)` navigation to an attacker-chosen host in a new tab with
`noopener,noreferrer`. **None is dangerous in the XSS sense** — no script executes in the Compass
origin, `window.opener` is null, and no referrer leaks. The `#javascript:...` fragment is inert; it
is a fragment on an https document, not a scheme. The metadata-IP case is a red herring for a browser
navigation (no credentials attached, response not readable by Compass).

They are dangerous only in the **phishing** sense — which is F-1, and which is a property of the
feature ("open the meeting link"), not of the guard. The guard's job is to exclude non-http(s)
schemes and it does so completely.

**Parse-differential check (the failure mode that would actually break this).** I specifically looked
for a string where the guard sees `https:` but `window.open` navigates somewhere else. There is none
in this design: the guard's base-less `new URL(url)` only succeeds for *absolute* URLs, and
`window.open` parses absolute URLs identically (the document base is unused). Note that the raw
string, not the normalised `href`, is handed to `window.open` — for `ht\ttps://evil.com` and
`https:evil.com` both parsers agree, so this is currently harmless, but passing the normalised
`new URL(url).href` would remove the differential as a category rather than case by case. Optional
hardening, not a finding.

### 3. Capability-token exposure — **URL IS CLEAN; LABEL PATH IS NOT (see F-2)**

The URL never enters the DOM. Verified by reading the component: `EventJoinIcon.tsx:75-119` sets
exactly `data-calendar-event-interaction-ignore`, `aria-label`, `className`, `type`, and four
handlers. No `href`, no `data-*` copy, no `title`, no `value`. The child `VideoCameraIcon` receives
only `color`/`size`/`weight`/`aria-hidden`. `url` appears in exactly one place — the `window.open`
argument at line 84. Pinned by `EventCard.test.tsx:1008-1024`.

Also verified the surrounding cards do not leak it by another route:
`grep -n "location" TimedEventCard.tsx AllDayEventCard.tsx` returns **no matches** — neither card
renders `event.location`, which is the field Google most often populates with a duplicate of the
meeting URL. Had the cards rendered location, the "URL never in the DOM" claim would have been true
of the component and false of the card.

Not logged: `grep -nE "console\.|posthog|capture\(|fetch\(|axios|navigator\.sendBeacon"` across all
four non-test changed files returns **no matches**. PII-1 holds.

The a11y-tree claim is where it is weaker. `aria-label` is a DOM attribute and it carries
`conference.label`. Today that is safe because `mapConference` sources it from
`conferenceSolution.name` (a product name), but the `!label.includes("/")` filter does not *enforce*
that — see F-2 for the bare-Meet-code and add-on-supplied-text cases.

### 4. Analytics leakage — **CONFIRMED SUPPRESSED (traced through the installed bundle)**

Autocapture is on: `packages/web/src/auth/posthog/posthog.bootstrap.ts` calls `posthog.init` with
`api_host`, `ui_host`, `capture_exceptions`, `before_send`, `opt_in_site_apps`, `person_profiles` —
and **no `autocapture` key**, so posthog-js's default `true` applies. ADR-4's premise is correct.

I did not take `ph-no-capture` on faith. In `node_modules/posthog-js/dist/module.js`:

- The autocapture props builder walks the element chain and sets a flag on any element carrying the
  class: ``N(ys(t),"ph-no-capture")&&(w=!0)``, then short-circuits:
  ``if(w) return {props:{}, explicitNoCapture:w}``.
- The caller discards the event outright: ``var a=o.props; if(o.explicitNoCapture) return !1;`` —
  it returns before `this.instance.capture(i,a)`. **The entire `$autocapture` event is dropped**, not
  merely masked. Attributes, `$el_text`, and the elements chain never leave the browser.
- Independently, `ph-no-capture` is in the default css-selector ignore list
  (``Is=[".ph-no-rageclick",".ph-no-capture"]``) consulted by the DOM-event gate, so the rage/dead-click
  path is suppressed too — which is the second benefit ADR-4 claims, and it checks out.

So a join click emits **no network call**: no autocapture event, and no explicit `capture()` anywhere
in the changed files (grep above). PII-1 satisfied.

One caveat the design does not mention, offered as informational only: session replay is a separate
subsystem and `session_recording` / `disable_session_recording` are not configured here. Since the URL
is not in the DOM this is not a URL-leak vector; the `aria-label` provider text could appear in a
replay, which is low sensitivity today and becomes F-2's concern if a token ever reaches the label.

### 5. Interaction-ignore attribute — **NOT SPOOFABLE**

The question is whether event-controlled content (title, location, a synced description) could inject
an element carrying `data-calendar-event-interaction-ignore` into a card subtree and thereby disable
grid interaction for that card. It cannot, for three independent reasons:

1. **No raw-HTML sink inside a card.**
   `grep -rn "dangerouslySetInnerHTML\|innerHTML" packages/web/src --include=*.ts --include=*.tsx`
   (excluding tests) returns exactly **one** hit: `packages/web/src/index.tsx:20`, a static
   boot-failure message outside the React tree. No grid card renders HTML. Event-controlled strings
   reach the DOM as React children — text nodes, escaped — so they cannot become attributes at all.
2. **The one sanitised-HTML surface is out of reach and would strip it anyway.**
   `DescriptionEditor.tsx:23-27` runs `DOMPurify.sanitize` with `ALLOWED_ATTR: ["href"]`. A
   `data-calendar-event-interaction-ignore` attribute is stripped. And the editor lives in the event
   form, not inside a registered card element, so `element.contains(ignored)` would be false even if
   it survived.
3. **The scoping check is correct.** `event.registry.ts:112-118` uses
   `ignored && element.contains(ignored)`, so a marker on an ancestor *above* the card does not
   disable the card — which is the abuse case worth worrying about, since one stray wrapper could
   otherwise silently disable a whole column. All three branches are pinned by the new registry tests
   (`event.registry.test.ts`: self-marked child, deeper descendant, ancestor-outside-card).

Residual risk if injection ever did become possible: the blast radius is **denial of interaction on a
single card** — the user cannot drag it or click to open it. No privilege escalation, no data
exposure, no cross-card effect. Low even in the counterfactual.

The only nit is F-3 (presence-based matching).

### 6. The `isBusy` masking question — **OPINION: ADD THE GUARD**

**Recommendation: add `!event.isBusy` to both `showJoinIcon` chains, and invert the test that
currently pins its absence.** The contractual argument is *factually* correct today and still
*insufficient* as an engineering decision. Reasoning, in the order I weighed it:

**The invariant is stronger than "by contract" — I want to give the requirements author full credit.**
It is not documentation; it is structural. In `event.view-model.ts:60-94`, both fields are derived
from the same discriminant inside the same object literal:

```
const isBusy  = event.content.kind === "busy";
const details = event.content.kind === "details" ? event.content : undefined;
...
isBusy,
conference: details?.conference,
```

`isBusy === true` forces `details === undefined` forces `conference === undefined`. I traced every
other `GridEvent` producer in the web package: `gridEventDraftToGridEvent`
(`grid-event-draft.adapter.ts:273-297`) never sets `conference` at all; the multi-day all-day path
(`event.view-model.ts:147-168`) routes through the same `eventToGridEvent`; the demo seed
(`demo-data-seed.ts:39-53`) always emits `kind: "details"`. **There is no path today that produces a
busy event carrying a conference.** Requirements §6 is not hand-waving.

**And yet the guard should still be added, for four reasons.**

1. **The delta's own threat model demands it.** `EventJoinIcon.tsx:16-20` justifies
   `isSafeConferenceUrl` against precisely three scenarios: *"a cached IndexedDB row written by an
   older schema, a hand-seeded demo event, a future contract relaxation."* All three apply verbatim
   to `isBusy`. A stale Dexie row **is**, definitionally, a row for which the current
   `isBusy`/`conference` co-derivation never ran. You cannot invoke stale-cache risk to justify one
   render-time guard and then invoke the contract to dismiss a structurally identical one in the same
   `&&` chain, five lines away. The inconsistency is the finding; whichever way it is resolved, it
   should be resolved the same way in both directions.
2. **The type system does not carry the invariant.** `GridEventSchema`
   (`web.event.types.ts:70`, `:88`) declares `isBusy: z.boolean().optional()` and
   `conference: ConferenceSchema.nullable().optional()` as **independent** optional fields. Nothing —
   not TypeScript, not zod, not a runtime assertion — prevents a future producer from setting both.
   The invariant lives entirely in one function's local reasoning and is unenforced everywhere else.
   That is exactly the shape of assumption that survives until it doesn't.
3. **The failure mode is the worst one this component can produce, and it is asymmetric.** `isBusy`
   exists *specifically* to render an event whose details the viewer is not entitled to see — title
   forced to `BUSY_EVENT_TITLE` (`event.view-model.ts:64`), forced read-only regardless of calendar
   capability (`isEventReadOnly`, `useCalendarLookup.ts:155-157`). Rendering a **working capability
   token** on that card is strictly worse than leaking the title, because a meeting URL usually grants
   join rights to a meeting the viewer was never invited to. Set against that: the cost of the guard
   is one boolean appended to a chain that is already four terms long. The expected-value calculation
   is not close.
4. **The read-only family is already non-uniform, which undercuts "the contract will hold".**
   `isGridEventContentReadOnly` (`useCalendarLookup.ts:131-134`) bundles `isBusy` **with**
   `isTimedMultiDayDisplay` — and the multi-day path *does* carry `conference` through
   `eventToGridEvent`. So one member of the "read-only content" family already coexists with a
   conference. That is benign (it is the user's own event), but it demonstrates that "read-only
   implies no conference" is not a property of the family, only of one member, and only today.

**The sharpest point, and the reason to decide this now rather than later.** The run did not merely
omit the guard. `EventCard.test.tsx:1026-1062` renders `createEvent({ conference: CONFERENCE, isBusy: true })`
and asserts:

```
expect(screen.queryByRole("button", { name: /join/i })).not.toBeNull();
```

with a comment instructing the reader that a failure means *"someone added that guard — which is a
fine thing to do, but the role matrix must be updated to match."* The comment is conscientious and
the intent was good, but the effect is that the absence of a privacy guard is now **enforced by CI**.
A future engineer who adds `!event.isBusy` — the safe change — gets a red build and a note telling
them they have created a documentation inconsistency. That inverts the default: the secure change now
carries the burden of proof. This is a durable artifact that gets harder to remove the longer it
sits, and it is the strongest argument for acting during this run rather than filing a follow-up.

**Severity: Medium, not High.** I traced every current producer and none can violate the invariant, so
there is no exploitable path today. This is defence-in-depth on a privacy invariant, plus the removal
of a test that pins the wrong default.

**One-line verdict:** *The contractual argument is correct today but unenforced by any type or runtime
check, and the delta already pays for exactly this class of defence elsewhere in the same expression —
add `!event.isBusy` and invert the test that currently pins its absence.*

---

## Passing checks

- **NFR-4 / AC-3 — `noopener,noreferrer`.** Present at `EventJoinIcon.tsx:84`; independently asserted
  per-token at `EventCard.test.tsx:681-682`; cannot pass if either flag is dropped.
- **ADR-3 — protocol allowlist.** 37 payloads executed against the guard's exact body; 0 bypasses.
  All scripting schemes (`javascript:` in eight encodings, `data:`, `blob:`, `vbscript:`,
  `filesystem:`, `view-source:`, `intent:`, `about:`, `chrome:`, `file:`) blocked. Protocol-relative
  and scheme-less inputs fail closed.
- **PII-2 — URL out of the DOM.** No `href`, no `data-*` copy, no `title`, no `value`. `url` is
  referenced exactly once, as the `window.open` argument. Pinned at `EventCard.test.tsx:1008-1024`.
- **Cards do not leak the URL by another route.** Neither card renders `event.location` (verified by
  grep, no matches) — the field most likely to duplicate a meeting URL.
- **PII-1 — no new telemetry, logging, or network call.** No `console.*`, `posthog`, `capture(`,
  `fetch(`, `axios`, or `sendBeacon` in any of the four non-test changed files (grep, no matches).
- **ADR-4 — PostHog suppression is real.** Autocapture confirmed enabled (no `autocapture` key in
  `posthog.init`); `ph-no-capture` traced through the installed bundle to
  `if(o.explicitNoCapture) return !1;`, which drops the whole autocapture event before `capture()`.
  Also present in the default css-selector ignore list, covering the dead-click path.
- **Interaction-ignore attribute is not injectable.** Exactly one `innerHTML` sink in
  `packages/web/src` (`index.tsx:20`, static, outside the React tree); the sole sanitised-HTML surface
  uses DOMPurify with `ALLOWED_ATTR: ["href"]` and sits outside any registered card element.
- **Registry scoping is correct and pinned.** `ignored && element.contains(ignored)` prevents an
  ancestor marker from disabling a card; all three branches covered by new tests in
  `event.registry.test.ts`.
- **No secrets in the changed files.** The checklist grep, extended with `token|bearer`, run across
  all six paths: no matches. The only credential-shaped literal is the test fixture
  `https://meet.google.com/abc-defg-hij` (`EventCard.test.tsx:56-59`) — a placeholder Meet code, also
  used by the pre-existing demo seed, not a live meeting.
- **`.gitignore`.** `.sdlc/` appended, no existing entry removed or reordered. `.sdlc/` was untracked
  before this run (`git status` showed `?? .sdlc/`), so nothing is orphaned from history and no run
  artifact was ever committed. `*.env*` was already ignored.
- **No dependency, manifest, or lockfile change.** Confirmed against `git status --porcelain`;
  NFR-6 holds.
- **Not applicable to this delta (client-side rendering change, no authorization surface):** encryption
  at rest, role-based response masking, audit-log ordering and append-only enforcement, route guards,
  `reports_to` checks, JWT secret loading, password hashing, helmet, rate limiting, global error
  filter. None of the six changed files touches a controller, service, entity, serializer, guard, or
  middleware. Per the brownfield scoping rule these are out of scope rather than passing.

---

## Noted (pre-existing, out of scope — advisory, non-gating)

- **Dependency advisories.** `npm audit --omit=dev` cannot run in this repo (`ENOLOCK` — Bun
  workspace, `bun.lock`, no `package-lock.json`). Substituted `bun audit --prod`: **69 vulnerabilities,
  24 high**, including `nodemailer` (arbitrary file read / SSRF, `GHSA-p6gq-j5cr-w38f`), `ip-address`
  (SSRF via octal octet parsing, `GHSA-mwp4-54f8-5fhr`), `postcss` (arbitrary file read via
  `sourceMappingURL`, `GHSA-6g55-p6wh-862q`), `nanoid`, and `ws`. **None introduced by this run** — no
  manifest or lockfile was touched. Non-gating per the brownfield rule; worth its own `deps` run.
- **No root `.env.example`.** `compass.example.yaml` fills that role and is explicitly un-ignored
  (`!compass.example.yaml`). Pre-existing convention; noted only for checklist completeness.

---

## Refinement TaskPacket specs

Neither finding is Critical or High; both are emitted because they are cheap now and costly later.
**R1 is the one carrying a human decision** and should not be applied until that decision is made.

```json
[
  {
    "id": "R1",
    "phase": "refinement",
    "task_type": "existing_file_edit",
    "module": "grid-components",
    "pass_id": "20260822-062945-feature-extend-one-click-join",
    "intent": "feature-extend",
    "artifact_path": "packages/web/src/grid/components/TimedEventCard.tsx",
    "blocked_on": "HITL decision on security_review.md item 6 (isBusy guard)",
    "instruction": "Add the missing masked-event guard to the join control, in three coordinated edits. (1) TimedEventCard.tsx: add `!event.isBusy &&` to the `showJoinIcon` chain (currently lines 136-143), placed immediately after the `!isPlaceholder` term so the two suppression conditions read together. (2) AllDayEventCard.tsx: same addition to its `showJoinIcon` chain (lines 85-92). (3) EventCard.test.tsx: INVERT the test at lines 1026-1062 titled 'protects busy events by contract rather than by an isBusy guard'. Rename it to 'renders no join control on a privacy-masked busy event'; keep the first half unchanged (a busy event has no conference, and no control renders); change the second half's final assertion from `.not.toBeNull()` to `toBeNull()`, so a busy event that DOES carry a conference renders no control. Replace the existing comment block with one stating that the guard is defence-in-depth against a stale IndexedDB row or a future contract relaxation attaching a conference to a masked event, mirroring the rationale isSafeConferenceUrl already carries at EventJoinIcon.tsx:16-20. Do NOT weaken or delete any other assertion in the file. Add one sentence to a comment near the guard noting that requirements §6's role matrix should be updated from 'no extra guard needed' to 'guarded'.",
    "inputs": [
      { "path": ".sdlc/runs/20260822-062945-feature-extend-one-click-join/security_review.md", "content": "Threat surface item 6 — full reasoning and the four arguments for the guard", "reason": "Binding rationale; the inverted test comment must match it" },
      { "path": "packages/web/src/events/queries/event.view-model.ts", "content": "Lines 60-94 — isBusy and conference co-derived from event.content.kind", "reason": "The invariant being defended; explains why the guard is a no-op today" },
      { "path": "packages/web/src/calendars/useCalendarLookup.ts", "content": "Lines 127-167 — isGridEventContentReadOnly and isEventReadOnly", "reason": "Establishes what isBusy means (masked, forced read-only) and that the read-only family is non-uniform" }
    ],
    "outputSchema": { "type": "object", "properties": { "diff": { "type": "string" } }, "required": ["diff"] },
    "acceptance": [
      "Both showJoinIcon chains include `!event.isBusy`",
      "A GridEvent with isBusy true AND a valid conference renders NO join control on both card types",
      "The previously-passing assertion that such an event DOES render a control is inverted, not deleted",
      "Every other assertion in EventCard.test.tsx is untouched; diff is additions plus the single inverted expectation",
      "No change to isSafeConferenceUrl, to the window.open call, or to the features string",
      "bun test:web green; bun type-check and bun lint clean"
    ]
  },
  {
    "id": "R2",
    "phase": "refinement",
    "task_type": "existing_file_edit",
    "module": "grid-components",
    "pass_id": "20260822-062945-feature-extend-one-click-join",
    "intent": "feature-extend",
    "artifact_path": "packages/web/src/grid/components/EventJoinIcon.tsx",
    "instruction": "Close F-1 (no pre-navigation destination disclosure) and F-2 (label filter tests URL shape, not secrecy) with one change. In EventJoinIcon, derive the host from the already-validated URL: `const host = new URL(url).host;` — safe because the component only renders when isSafeConferenceUrl has already returned true, so the parse cannot throw; add a comment saying exactly that, and that the HOST is deliberately the only URL component surfaced because the path is the capability token. Use it in two places: (a) accessible name becomes `Join <providerLabel> (<host>)` or `Join video call (<host>)`; (b) add `title={host}` so a pointer user gets the hover disclosure that the <button> of ADR-1 removed relative to an <a href>. Replace the `!label.includes('/')` heuristic at line 72 with a positive allowlist — accept the label only if it matches /^[\\p{L}\\p{N} .&-]{1,40}$/u — so a bare meeting code (`abc-defg-hij`, no slash) and a 256-char add-on-supplied string are both rejected, not just URL-shaped strings. Keep the null fallback. Do NOT put the full URL, the pathname, or any query/fragment into any attribute — PII-2 still forbids it; only the host may be displayed. In EventCard.test.tsx, extend the T-20 test at lines 1008-1024 to also assert `expect(container.innerHTML).not.toContain('abc-defg-hij')` (the path segment, not just the whole URL), and add two cases: a label of 'abc-defg-hij' does not appear in the accessible name, and the accessible name does contain 'meet.google.com'. Update the existing 'does not put a URL-shaped conference label in the accessible name' test (line 878) for the new name format.",
    "inputs": [
      { "path": ".sdlc/runs/20260822-062945-feature-extend-one-click-join/security_review.md", "content": "Findings F-1 and F-2, plus threat-surface item 3", "reason": "States why host-only is PII-safe while path is not" },
      { "path": "packages/sync/src/providers/google/google-event.normalizer.ts", "content": "Lines 159-175 — mapConference; url falls back to a caller-supplied entryPoints[].uri, label comes from conferenceSolution.name", "reason": "Establishes that both url and label are attacker-influenceable on an invited event" },
      { "path": "packages/web/src/views/Forms/EventForm/EventDetailsSection.tsx", "content": "Line 48 — the sibling surface renders the same URL as an <a href>, which does disclose the destination on hover", "reason": "Precedent for the disclosure being restored, not invented" }
    ],
    "outputSchema": { "type": "object", "properties": { "diff": { "type": "string" } }, "required": ["diff"] },
    "acceptance": [
      "Accessible name includes the parsed host; title attribute is the host and nothing more",
      "No DOM attribute contains the URL path, query, or fragment — the T-20 assertion is extended to the path segment and passes",
      "A label of 'abc-defg-hij' is rejected and does not reach the accessible name",
      "A 256-character label is rejected; a normal label ('Google Meet', 'Zoom Meeting') is still accepted",
      "new URL(url) inside the component is documented as unreachable-when-throwing because isSafeConferenceUrl already gated the render",
      "window.open still receives the original url and the exact 'noopener,noreferrer' features string; the AC-3 test at lines 661-683 is unchanged and still passes",
      "bun test:web green; bun type-check and bun lint clean"
    ]
  },
  {
    "id": "R3",
    "phase": "refinement",
    "task_type": "existing_file_edit",
    "module": "grid-interaction",
    "pass_id": "20260822-062945-feature-extend-one-click-join",
    "intent": "feature-extend",
    "artifact_path": "packages/web/src/grid/interaction/event.registry.ts",
    "instruction": "Comment-only, no behaviour change. At the ignore-attribute check (lines 112-118), note that the selector matches on attribute PRESENCE, so `data-calendar-event-interaction-ignore=\"false\"` also opts a subtree out — the value is never read, and EventJoinIcon's literal \"true\" is convention only. Separately, in EventJoinIcon.tsx's isSafeConferenceUrl doc comment, add one sentence recording that the base-less `new URL(url)` is load-bearing: relative and protocol-relative inputs ('//evil.com', '/path', 'meet.google.com/abc') THROW here and are rejected, whereas window.open would resolve them against the Compass origin — so a future refactor must not add a base argument to this parse.",
    "inputs": [
      { "path": ".sdlc/runs/20260822-062945-feature-extend-one-click-join/security_review.md", "content": "Finding F-3, and the 'Relative forms fail closed' paragraph under threat-surface item 2", "reason": "Both comments record properties verified empirically in this review" }
    ],
    "outputSchema": { "type": "object", "properties": { "diff": { "type": "string" } }, "required": ["diff"] },
    "acceptance": [
      "Comments only — zero executable-line changes in both files",
      "bun test:web green; bun type-check and bun lint clean"
    ]
  }
]
```

---

## Required fixes before sign-off

1. **HITL decision on the `isBusy` guard (F-1 / item 6).** My recommendation is to add it. Whichever
   way the human decides, **`EventCard.test.tsx:1026-1062` must not be left as-is if the decision is
   "add the guard"** — that test currently fails the secure change, and leaving it would make the fix
   harder every week it sits. Apply **R1** on an "add" decision.
2. **Apply R2** — restore pre-navigation destination disclosure (host in the accessible name and
   `title`) and replace the `!label.includes("/")` heuristic with a positive allowlist. This closes
   the one-click-phishing gap that ADR-1 opened without listing, and makes PII-2 structural rather
   than dependent on the shape of a provider-supplied string.
3. **Apply R3** (comments only) so the two non-obvious properties this review verified empirically —
   presence-based attribute matching, and the base-less `new URL` being what closes protocol-relative
   input — are recorded where the next author will read them.

Nothing here blocks on dependency findings; those are pre-existing and non-gating for this run.

## Gate 3 recommendation

**PASS-WITH-CONDITIONS.**

No Critical or High finding. The two threats the design was built against — reverse tabnabbing and
scheme injection — are genuinely closed, and I verified both by execution rather than by reading:
37 URL payloads with zero bypasses, and the PostHog suppression traced through the installed bundle
to the line that drops the event. The URL provably never reaches the DOM, and the new
interaction-ignore attribute is not a spoofable surface because no grid card renders
event-controlled HTML.

Conditions: resolve item 6 with a human and apply R1 accordingly; apply R2. Both are small,
well-scoped, and confined to files this run already owns.

**Item 6, one line:** *The contractual argument is correct today but unenforced by any type or runtime
check, and the delta already pays for exactly this class of defence five lines away in the same
expression — add `!event.isBusy`, and invert the test that currently pins its absence.*
