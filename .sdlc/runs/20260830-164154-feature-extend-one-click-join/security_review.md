# Security Review — `20260830-164154-feature-extend-one-click-join`

- **Reviewer:** security-reviewer (brownfield, `feature-extend`, delta scope)
- **Anchor:** `2d81253a` (branch `CMP-103/opus-plus-flash-v37-t2`, nothing committed)
- **Scope:** exactly the six files under `packages/web/src/grid/components/` named in
  `provenance.json`. Everything else in the repo was read for context only and is out of scope
  for gating.

---

## 1. Verdict

**pass with notes.**

No blocker and no major finding. The URL scheme guard is sound, correctly layered, and — this is
the part worth stating plainly — **genuinely load-bearing**: I proved empirically that the
upstream `ConferenceSchema` (`z.url()`, zod 4.5.4) *accepts* `javascript:`, `data:`, `vbscript:`
and `file:`, and that the Google ingest normalizer applies no scheme filter of its own. Without
`isJoinableUrl`, raw provider-controlled schemes would reach `window.open`. The feature adds a
defense the codebase did not previously have.

I found four notes: one real (bounded) parse/use divergence, two test-honesty gaps, and one
design-transparency observation. None of them permits a navigation to an unvalidated URL. I also
found a **pre-existing** unguarded consumer of the same provider-sourced field elsewhere in the
web package, which is advisory and does not gate this run.

---

## 2. What I verified (executed) vs. reasoned about

### Executed

| # | Command | Result |
|---|---|---|
| E-1 | `git status --porcelain` (start and end) | Exactly the six in-scope source files, unchanged in count. No stray probe artifacts landed in the repo. |
| E-2 | `git diff 2d81253a -- packages/web/src/grid/components/` | Full delta for the three modified files, read in full. |
| E-3 | Read all of `EventJoinIcon.tsx` (78 lines), `event-join-url.util.ts` (35), `event-join-url.util.test.ts` (74) | Complete, not sampled. |
| E-4 | `bun /tmp/.../probe.mjs` — 42 adversarial URLs through the exact guard body, comparing `new URL(x)` vs `new URL(x, BASE)` | **No scheme bypass found.** Two allowed inputs diverge between validated and navigated target — see F-1. Full table in §4.1. |
| E-5 | `bun test src/grid/components/event-join-url.util.test.ts src/grid/components/EventCard.test.tsx` (from `packages/web`) | **50 pass, 0 fail, 112 expect() calls.** (React `act(...)` warnings are pre-existing noise, not failures.) |
| E-6 | `npx biome check` on all six files | `Checked 6 files in 35ms. No fixes applied.` Clean. |
| E-7 | `grep -rn "url" <the five non-test in-scope files>` | Every occurrence enumerated. `url` reaches only `isJoinableUrl(...)` and `window.open(...)`. It is never rendered, never an attribute, never in an accessible name. |
| E-8 | `grep -rn "data-\|dangerouslySetInnerHTML\|title=" TimedEventCard.tsx AllDayEventCard.tsx` | Only `data-edge-focus` (pre-existing). No conference data in any DOM attribute. |
| E-9 | `bun` probe: `z.url().safeParse(...)` against zod 4.5.4 as resolved in this repo | `ACCEPT` for `javascript:alert(1)`, `data:text/html,x`, `vbscript:x`, `file:///etc/passwd`, `https:foo`; `reject` only for `//host/x`. **The schema is not a scheme defense.** |
| E-10 | Read `packages/core/src/types/event-attendance.contracts.ts:31-34` and `packages/sync/src/providers/google/google-event.normalizer.ts:159-175` | `ConferenceSchema.safeParse` *does* run at ingest, so `label` is trimmed and capped at 256 chars. `url` is only `z.url()` — no scheme constraint. |
| E-11 | `grep -c "PointerCaptureBoundary\|InteractionCoordinator" EventCard.test.tsx` | **0.** The drag-suppression tests render the cards bare. See F-2. |
| E-12 | Read `packages/web/src/interaction/react/PointerCaptureBoundary.tsx` (full) and `packages/web/src/interaction/dom/draft-event.clone.ts` (full) | R-1 mechanism confirmed by source; drag clone is `cloneNode(true)` + `aria-hidden` + `pointer-events:none`. See §5. |
| E-13 | `grep` for `INTERACTION_MOVE_THRESHOLD_PX` | `= 25` px for motion on an existing event. Bounds R-1's data-integrity blast radius. |
| E-14 | `grep -rniE "(api[_-]?key\|secret\|password\|token\|bearer)[ \t]*[:=][ \t]*['\"][a-zA-Z0-9]"` on the six files | No match (exit 1). The only URL fixture is the obviously synthetic `https://meet.google.com/abc-defg-hij`. |
| E-15 | `git status --porcelain -- package.json packages/web/package.json bun.lock` | Empty. **Zero dependency manifest changes in this run.** |
| E-16 | `npm audit --omit=dev` → `ENOLOCK`; fell back to `bun audit --prod` | 69 advisories (24 high) across `qs`, `dompurify`, `postcss`, `ws`, `nanoid`, `axios`, `nodemailer`, `cookie`, `body-parser`, `follow-redirects`, `form-data`, `ip-address`, `@xmldom/xmldom`. **Zero involve `@phosphor-icons/react`.** All pre-existing. |
| E-17 | `grep -rn "conference" packages/web/src` outside the in-scope dir | Found two pre-existing unguarded consumers — see N-1. |
| E-18 | `grep -n "env" .gitignore` | `*.env*` is ignored. (Checklist item; no config changed in this run.) |

The `npm audit` checklist item could **not** be run as written: this is a Bun workspace with
`bun.lock` and no `package-lock.json`, and `npm audit` hard-fails with `ENOLOCK`. I did not run
`npm i --package-lock-only`, because that would have written a lockfile into a frozen repo. I
substituted `bun audit --prod` and report that instead — flagging the substitution rather than
implying the checklist item passed.

The adversarial probe was written to `/tmp/claude-1000/probe-onejoin/` (outside the repo). `rm`
is denied to me in this session, so those two throwaway `.mjs` files still exist there. They are
outside the repository and E-1 confirms `git status` is unaffected.

### Reasoned about (not executed)

- **Real-browser behaviour of `window.open` with a features string.** I could not drive a
  browser. The claims in §4.2 about `noopener`/`noreferrer` semantics and about top-level
  `javascript:`/`data:` navigation being blocked in a fresh browsing context are from spec and
  established browser behaviour, not from observation in this environment.
- **R-1's end-to-end effect in the running app** (§5). The *mechanism* is confirmed from source;
  the precise observable outcome (form only, vs. form + meeting tab) is reasoned, and I say so.
- **F-3's claim that jsdom does not synthesise Enter/Space→click activation.** The test env is
  jsdom `^26.1.0` (`packages/web/package.json:54`). jsdom does not implement keyboard activation
  behaviour for buttons. I did not prove this by mutating the source, because the files are
  frozen.
- **Absence of the URL from the rendered DOM** is established by exhaustive source reading of a
  78-line component plus E-7/E-8, not by snapshotting rendered HTML.

---

## 3. Findings

| ID | Sev | Location | What | Why it matters | Remediation | Allowlist |
|---|---|---|---|---|---|---|
| F-1 | minor | `event-join-url.util.ts:16` | **Parse/use divergence for scheme-only-relative URLs.** `new URL(x)` is called with *no base*; `window.open(x)` resolves against the document base. For `"https:foo"` the guard validates `https://foo/` but the browser navigates to `https://<app-origin>/foo`. Same for `"https:/foo"`. Both are `ALLOW`ed, and `z.url()` accepts them at ingest (E-9), so a malicious invite can deliver one. | The util's entire security property is "the thing I validated is the thing I open", and for this input class it does not hold. Impact today is *bounded*: the divergent target is always **same-origin** and always still `http(s)`, so it is not a scheme escalation and not an external open-redirect. But the invariant is broken, and a future change to how the URL is consumed could widen it. | Require an authority, not just a scheme. Cheapest fix that preserves the deliberate no-normalisation decision (change_plan §5.5): add `if (!/^https?:\/\//i.test(url)) return false;` before the `new URL` parse. Alternative: parse with the same base the browser will use — `new URL(url, window.location.href)` — so validation and navigation cannot diverge. | **INSIDE** |
| F-2 | minor | `EventCard.test.tsx` (the two `"opens the ... without selecting the card"` tests) | The cards are rendered **bare** — `grep` for `PointerCaptureBoundary`/`InteractionCoordinator` in the test file returns **0** (E-11). So `expect(onEventMouseDown).not.toHaveBeenCalled()` proves only that the button's *bubble-phase* `stopPropagation` works in a tree that has no capture-phase ancestor. | Not a runtime vulnerability, but a **test-honesty** problem: the suite reads as proving "clicking Join does not select the card", which is exactly the property R-1 says is false in the running app. Both tests pass today and would keep passing through any future regression in `grid/interaction/dom.ts`. The green suite must not be read as evidence that R-1 is absent. | Add a comment in the test file naming the omission and pointing at R-1; ideally render the card inside the Week/Day coordinator so the capture-phase listener participates. Test-only change. | **INSIDE** (test file) |
| F-3 | minor | `EventCard.test.tsx` (Enter and Space tests), asserting `expect(openMock).toHaveBeenCalledTimes(1)` | The `toHaveBeenCalledTimes(1)` assertion is **weak evidence against double-open**. `fireEvent.keyDown` dispatches a bare `keydown`; jsdom does not synthesise the browser's native Enter/Space→`click` activation for a `<button>`. The count would still be 1 if `e.preventDefault()` at `EventJoinIcon.tsx:53` were deleted. | The real protection against Enter/Space opening two tabs is the `preventDefault()`, and nothing in the suite pins it. Combined with R-4 (double-click already opens two tabs, accepted), this is the un-pinned half of the same behaviour. Low impact — worst case is a duplicate tab, not an unvalidated navigation. | Assert the event was actually cancelled, e.g. capture the return of `fireEvent.keyDown(...)` (false when `preventDefault` was called) or assert on `defaultPrevented`, rather than relying on the call count. | **INSIDE** (test file) |
| F-4 | info | `EventJoinIcon.tsx:57-75` (design consequence of ADR-1) | **No destination transparency.** A `<button>` + `window.open` gives the user no status-bar link preview, no context-menu "Copy link address", and no `title`. The only pre-click signal is the accessible name, which is built from the provider-controlled `conference.label`. A malicious invite can set `label: "Google Meet"` while `url` points at any `http(s)` host, and neither a sighted nor a screen-reader user has any way to see the mismatch before clicking. | Real but modest phishing surface, and materially bounded: `label` is trimmed and capped at 256 chars at ingest (E-10); `noreferrer` stops the destination learning the app origin; `noopener` stops reverse tabnabbing; the destination is confined to `http(s)`. The sibling `UpNextCard` uses a real `<a href>` and *does* give a status-bar preview, so this feature is a small regression in transparency relative to the app's own precedent. | Optional and cheap: `title={new URL(url).host}` on the button, so hover reveals the destination host. Note the deliberate tension with the capability-leak rule — expose the **host only**, never the full URL, which is the bearer secret. Worth a follow-up ticket rather than a fix in this run. | **INSIDE** |
| F-5 | info | `event-join-url.util.ts` (file location) | The guard lives under `grid/components/`, a leaf UI directory. It is the only scheme validation for provider-sourced URLs in the whole web package, but its location makes it effectively un-importable by the non-grid consumers that need it (N-1). | Purely structural, but it is the reason the codebase now has one guarded and two unguarded consumers of the same untrusted field. | Hoist to a shared location (e.g. `packages/web/src/common/utils/url/`) and re-point the two grid imports. Cross-cutting; belongs in the same follow-up as N-1. | **INSIDE** to move, **OUTSIDE** to re-point the other consumers |

**Nothing found** for: hardcoded secrets (E-14), credentials in test fixtures (E-14), new
dependencies (E-15), DOM/attribute leakage of the URL (E-7, E-8), logging or telemetry of the URL
(§4.4), or any path to rendering the control with a non-`http(s)` URL (§4.3).

---

## 4. Threat-model questions, answered

### 4.1 Is `isJoinableUrl` bypassable?

**No bypass found.** I ran 42 adversarial inputs through the exact guard body (E-4). Selected
results — `ALLOW`/`block` is the guard's verdict, `abs` is what the guard validated, `rel` is what
`window.open` would resolve against an app base of `https://app.compasscalendar.com/calendar`:

| Input | Guard | Validated (`abs`) | Navigated (`rel`) |
|---|---|---|---|
| `" javascript:alert(1)"` (leading space) | block | `javascript:` | — |
| `"\njavascript:..."`, `"\tjavascript:..."`, `"\rjavascript:..."` | block | `javascript:` | — |
| `" javascript:..."`, `"javascript:..."`, `"\fjavascript:..."` | block | `javascript:` | — |
| `" javascript:..."`, `"​javascript:..."`, `"﻿javascript:..."`, `"　javascript:..."` | block | THROW | (would be same-origin path) |
| `"ja\tvascript:alert(1)"`, `"java\nscript:..."`, `"javascript\t:..."` | block | `javascript:` | — |
| `"JaVaScRiPt:..."`, `"JAVASCRIPT:..."` | block | `javascript:` | — |
| `" \t\n javascript:alert(1) "` | block | `javascript:` | — |
| `"javascript://%0aalert(1)"` | block | `javascript:` | — |
| `"data:"`, `"blob:"`, `"filesystem:"`, `"view-source:"`, `"intent:"`, `"ws:"` | block | (each own scheme) | — |
| `"https://exam‮ple.com/"` (RTL override in host) | block | THROW | — |
| `"http://x/#javascript:alert(1)"` | ALLOW | `http://x/#javascript:alert(1)` | same — fragment is inert |
| `"https://evil.com@good.com/"` | ALLOW | `https://evil.com@good.com/` | same → **good.com** |
| `"https://good.com\\@evil.com/"` | ALLOW | `https://good.com/@evil.com/` | same → **good.com** |
| `"https://аpple.com/"` (Cyrillic а) | ALLOW | `https://xn--pple-43d.com/` | same |
| `"https:foo"` | **ALLOW** | `https://foo/` | **`https://app.compasscalendar.com/foo`** — **DIVERGES** |
| `"https:/foo"` | **ALLOW** | `https://foo/` | **`https://app.compasscalendar.com/foo`** — **DIVERGES** |
| `"https:////evil.com/"`, `"http:\\\\evil.com\\"` | ALLOW | `https://evil.com/` / `http://evil.com/` | same |

Point by point against the brief:

- **Leading/trailing whitespace, control characters, embedded newlines, tabs in the scheme,
  mixed case** — all correctly blocked. This is because `new URL` applies exactly the same C0/space
  stripping and tab/newline removal the browser's own navigation would, so the guard sees the
  *effective* scheme, not the literal one. This is the single most important reason the guard is
  correct, and it is a property of using `new URL` rather than a regex. Non-ASCII "whitespace"
  (` `, `​`, `﻿`, `　`) is *not* stripped and instead makes the parse throw —
  blocked, fail-closed.
- **Unicode/IDN homograph** — `https://аpple.com/` (Cyrillic) is allowed and punycoded to
  `xn--pple-43d.com`. This is not a guard defect; the scheme is legitimately `https`. Mitigation is
  the browser's own mixed-script punycode display, and in this app the URL is never displayed at
  all, so there is no in-app spoofing surface. See F-4 for the display-side observation.
- **RTL override in the host** — the parse throws, blocked.
- **Nested/double schemes** (`http://` wrapping `javascript:`) — `"http://javascript:alert(1)"`
  throws (invalid port); `"http://x/#javascript:alert(1)"` is allowed but the `javascript:` text is
  an inert fragment, never executed.
- **Userinfo-in-host** — `https://evil.com@good.com` is allowed and navigates to `good.com`. Parse
  and navigation agree, so there is no divergence. Its usual danger is *display* spoofing, and this
  feature displays no URL. Not a finding here; it becomes one only if F-4's `title` suggestion is
  adopted naively (which is why F-4 says host-only, from the parsed URL — never the raw string).
- **Parse/use divergence** — **yes, one class exists**, and it is F-1. `new URL(x)` with no base and
  `window.open(x)` with the document base disagree for scheme-only-relative inputs. Bounded to
  same-origin `http(s)`; no scheme escalation is reachable through it, because with a base the
  scheme can only come from the input or from the base (which is `https`).

### 4.2 Reverse tabnabbing / referrer leakage

`window.open(url, "_blank", "noopener,noreferrer")` at `EventJoinIcon.tsx:34` is **correct and
exact**. Both tokens are recognised HTML window-feature names. `noopener` nulls `window.opener` in
the new context, closing reverse tabnabbing; `noreferrer` suppresses the `Referer` header *and*
implies `noopener`, so the two are belt-and-braces. The return value is not used (it is `null`
under `noopener`), which is correct.

**If the feature string were dropped**, the opened page would receive a live `window.opener` handle
and could navigate this tab to a phishing clone — the classic reverse-tabnabbing attack — and the
destination would additionally learn the app origin and path via `Referer`. This is the main risk
ADR-1 took on by choosing `window.open` over an `<a rel="noopener noreferrer">`, and it *is*
pinned: both card tests assert all three arguments verbatim, so a typo or deletion is a test
failure rather than a silent regression. I agree with the senior review here.

One behavioural note, not a finding: passing a non-empty features string makes some browsers treat
the call as a popup request. In practice Chrome and Firefox still open a tab when the string
contains only `noopener`/`noreferrer` with no geometry. The call is inside a user-gesture handler,
so popup blocking does not apply.

### 4.3 Fail-closed depth

**Confirmed — there is no path to a rendered control with a non-`http(s)` URL.** Four independent
gates:

1. `TimedEventCard.tsx:122-128` — `getJoinableConferenceUrl` → `joinUrl`, and `showJoinIcon`
   requires `joinUrl !== null`.
2. `AllDayEventCard.tsx:80-82` — same shape.
3. Both render sites additionally guard `{showJoinIcon && joinUrl && <EventJoinIcon ... />}`
   (`TimedEventCard.tsx:372`, `AllDayEventCard.tsx:210`), which is redundant with (1)/(2) but gives
   TypeScript the `string` narrowing for the required `url: string` prop.
4. `EventJoinIcon.tsx:28` re-checks at component top and returns `null`; `EventJoinIcon.tsx:33`
   re-checks a third time inside `openConference` before `window.open`.

On the **React re-render with changed props** question specifically: `EventJoinIcon` has **no
hooks at all**, so the early `return null` at line 28 is legal and unconditional in effect — there
is no hook-order hazard that would force the guard to be relaxed later. `openConference` is a plain
function re-created each render, closing over that render's `url`; React dispatches the click to the
handler from the most recent committed render. Even in a hypothetical stale-closure scenario, the
captured `url` was itself guard-validated at its own render, and line 33 re-validates at call time.
Every reachable value of `url` at the `window.open` call site has passed `isJoinableUrl`
immediately beforehand.

The one caveat is F-1: `isJoinableUrl` returning `true` does not guarantee the *navigated* target
equals the *validated* target for scheme-only-relative inputs. Depth is correct; the predicate is
very slightly imprecise.

### 4.4 PII / capability leakage

`conference.url` is a bearer capability. I traced it mechanically (E-7 enumerates **every**
occurrence of `url` in the five non-test in-scope files):

- **Logs / `console`** — no `console.*` call in any in-scope file receives it. No logging added.
- **Telemetry / analytics** — the app uses PostHog (`@web/auth/posthog/track`). No `track()` call
  exists in any in-scope file, and none is added by this diff.
- **Error reporters** — `getPosthogClient()?.captureException` is called in exactly two places
  (`index.tsx:11`, `common/utils/event/event.util.ts:263`), both on the app-boot and
  event-mutation paths. Neither is reachable from the join button: `window.open` does not throw on
  failure, and the join path performs no mutation. The URL is never packaged into an exception.
- **DOM as text or attribute** — no. The button carries `type`, `aria-label`, `className`, `style`
  (z-index) and four handlers; the icon carries `aria-hidden`, `className`, `color`, `size`,
  `weight`. E-8 confirms no `data-*`, no `title`, no `dangerouslySetInnerHTML` anywhere in the two
  cards beyond the pre-existing `data-edge-focus`. Nothing copyable, nothing a `MutationObserver`
  or a "copy element" would surface.
- **`aria-label`** — carries `conference.label` only, never the URL. Not read aloud, not scrapable.
- **Drag-clone nodes** — `createDraftEventClone` (`interaction/dom/draft-event.clone.ts`) is
  `source.cloneNode(true)` plus attribute stripping, `aria-hidden="true"` and
  `pointer-events: none`. Since the URL exists only in a JS closure and never in the DOM,
  `cloneNode` cannot carry it. The clone does reproduce the button element and its `aria-label`,
  but the clone is `aria-hidden` and pointer-inert, and `cloneNode` does not copy React listeners,
  so it is a dead glyph. This matches R-3 and I agree it is harmless.
- **Mutation / persistence payloads** — none. The component performs no write of any kind.
- **Cross-origin** — `noreferrer` additionally prevents the meeting host from learning the app
  origin.

**FR-7 (read-only contract) verified mechanically:** E-15 shows no dependency manifest changed, and
E-1 shows the working tree contains exactly the six declared files. Nothing outside
`packages/web/src/grid/components/` was written by this run.

### 4.5 Accessible-name injection

`aria-label={`Join ${label}`}` — **no injection is possible.** React sets `aria-label` through
`setAttribute`, not through markup, so there is no way to "break out" of the accessible name into
sibling attributes or into HTML. A screen reader announces the string literally.

**Spoofing is possible but bounded**, and it is the honest residual: `conference.label` is
provider-sourced, so a malicious invite fully controls what the button calls itself. It can claim
to be "Google Meet" while the URL points elsewhere, or embed bidi/zero-width characters to make the
announced name misleading. Bounds:

- `ConferenceSchema` (`event-attendance.contracts.ts:33`) applies `.trim().min(1).max(256)`, and
  E-10 confirms `ConferenceSchema.safeParse` **actually runs** at Google ingest
  (`google-event.normalizer.ts:169`). So the name cannot be unboundedly long or whitespace-padded.
  There is no bidi/control-character stripping, but 256 chars is a small blast radius.
- The label is *not* rendered as visible text — sighted users see only a generic camera glyph, so
  the label-based spoof reaches screen-reader users specifically.
- The destination is confined to `http(s)` regardless of what the label claims.

This is the same trust level the app already extends to `event.title` and `location`, so it is not a
new class of exposure. It is the transparency half of F-4.

### 4.6 Dependency risk

`VideoCameraIcon` from `@phosphor-icons/react` (`packages/web/package.json:11`, `^2.1.7`) is
**pre-existing** — the same package is already imported by `UpNextCard.tsx`. E-15 confirms **no
manifest and no lockfile changed in this run**, so this change adds zero supply-chain surface and I
raise no new-dependency finding.

For the record on the checklist item: `npm audit --omit=dev` cannot run here (`ENOLOCK`; Bun
workspace, no `package-lock.json`). `bun audit --prod` reports **69 advisories, 24 high**, across
`qs`, `dompurify`, `postcss`, `ws`, `nanoid`, `axios`, `nodemailer`, `cookie`, `body-parser`,
`follow-redirects`, `form-data`, `ip-address`, `@xmldom/xmldom`. **Zero** involve
`@phosphor-icons/react`. All are pre-existing and mostly build/test tooling reached transitively.
Not attributable to this run — see N-2.

One caveat worth stating: `^2.1.7` is a caret range, so the icon package floats on minor/patch. That
is a repo-wide convention, not something this change introduced.

### 4.7 Test-surface honesty

Mixed — mostly honest, with two gaps.

**Genuinely non-vacuous:**

- `event-join-url.util.test.ts` — 12 cases covering `javascript:`, `data:`, `vbscript:`, `file:`,
  protocol-relative, bare host, empty, `null`, `undefined`, plus uppercase `HTTPS://`. My 42-case
  probe found no scheme these miss.
- `"returns the original string for a valid https conference"` (`:63-67`) — a real identity
  assertion (`toBe(rawUrl)`) that pins the deliberate no-normalisation decision. If someone
  "helpfully" switched to `new URL(url).href`, this fails.
- `"refuses to render a join control for a non-http conference url"` — I checked this specifically
  for vacuity, since a negative query that can never match is the classic trap. It is **not**
  vacuous: the `javascript:` case uses `label: "Sketchy"` → accessible name `"Join Sketchy"`, and
  the `data:` case uses `label: null` → `"Join meeting"`. Both match the `/^Join/` query, so if the
  button *did* render, the assertion would fail. Good test.
- The verbatim three-argument `window.open` assertions — these are the load-bearing pin on
  `noopener,noreferrer` and they work.

**Gaps:** F-2 (drag suppression is tested outside the capture-phase ancestor that defeats it in
production) and F-3 (the Enter/Space `toHaveBeenCalledTimes(1)` cannot detect a missing
`preventDefault` under jsdom). Neither is a false assertion; both are assertions that prove less
than they appear to.

---

## 5. R-1's security consequence

**I agree with the "fails safe" conclusion, but not entirely with the reasoning, and the trace is
worth recording because the conclusion is right for a stronger reason than the one given.**

Mechanism, confirmed from source (E-12): `PointerCaptureBoundary` attaches
`onPointerDownCapture` (`PointerCaptureBoundary.tsx:107`) on an ancestor wrapping the whole grid.
Capture phase runs **ancestor-first**, so it fires before the join button's bubble-phase
`onPointerDown`/`onMouseDown` handlers ever run. If the adapter returns `shouldOwn: true`, line 78
calls `consumeOwnedPointerEvent`, which does `preventDefault()` **and** `stopPropagation()`
(`:199-200`), and line 79 takes pointer capture on the boundary div. The button's
`stopPropagation()` at `EventJoinIcon.tsx:38/42` is therefore dead code in the running app — it
never executes. Root cause is the bare `closest()` target resolution in `grid/interaction/dom.ts`
and the view adapters, with no opt-out for nested interactive controls. All of that is **outside**
the frozen allowlist and I propose no code change there for this run.

The senior review states the outcome is "the control opens the *event form* instead of the
meeting". I could not confirm that specific outcome without a browser, and I think it is only
*probably* right. Per the Pointer Events spec, cancelling `pointerdown` suppresses the compatibility
`mousedown`/`mouseup` but explicitly does **not** suppress `click`. Whether the button's `onClick`
still fires then depends on where the browser targets the synthesised `click` once pointer capture
has been taken by an ancestor — plausibly the boundary div rather than the button. So the real-app
outcome is one of:

- (a) the click is retargeted away from the button → only the event form opens; or
- (b) the click still reaches the button → the event form opens **and** the meeting opens.

**Security-wise it does not matter which, and that is the stronger argument.** In both branches the
*only* value that can ever reach `window.open` is one that passed `isJoinableUrl` at
`EventJoinIcon.tsx:33` microseconds earlier. R-1 can cause an *extra* or *wrong* app-owned action;
it cannot cause a navigation to an unvalidated URL, cannot change which URL is opened, and cannot
strip `noopener,noreferrer`. The security property is orthogonal to R-1 rather than protected by
it — which is a better guarantee than "the wrong thing that opens is our own form".

The one consequence the senior review does not mention: if `shouldOwn` is true, a pointerdown on
the join button arms a **drag of the underlying event**, so a user who presses the button and
moves could accidentally reschedule the meeting — an unintended write, not just a wrong-view. That
is bounded by `INTERACTION_MOVE_THRESHOLD_PX = 25` (E-13), which is far more than the 10×10 button,
so a normal click cannot trip it. I record it as a correctness/data-integrity note on R-1, not as a
security finding.

**Verdict on R-1: correctness bug, not a vulnerability. Fails safe. Correctly triaged as accepted
known-limitation debt.** The only thing I would add to the debt record is F-2 — the test suite
currently asserts the *opposite* of R-1 and passes, so nothing in CI will notice when R-1 is fixed
or when it gets worse.

---

## 6. Residual accepted risks, restated for the record

Carried forward, not re-raised as findings:

1. **R-1 — ACCEPTED AS A DOCUMENTED KNOWN LIMITATION (final ruling, Gate 3, 2026-08-30).**
   Not fixed in this run; the write-contract allowlist was deliberately **not** widened. Recorded
   here in full because this is the artifact a future reader will find first.

   **(a) The mechanism — the button's `stopPropagation` is dead code.**
   `EventJoinIcon.tsx:38` and `:42` call `e.stopPropagation()` on the button's **bubble-phase**
   `onMouseDown` / `onPointerDown`. `PointerCaptureBoundary` registers
   `onPointerDownCapture` (`PointerCaptureBoundary.tsx:107`) on an ancestor wrapping the whole
   grid. **Capture phase runs ancestor-first**, so the boundary sees the pointerdown before the
   button's handlers exist in the dispatch path; when the adapter returns `shouldOwn: true`,
   `consumeOwnedPointerEvent` calls `preventDefault()` **and** `stopPropagation()`
   (`:199-200`) and takes pointer capture on the boundary div. The button's own
   `stopPropagation()` therefore **never executes** in the running app. Root cause is the bare
   `closest()` target resolution with no opt-out for nested interactive controls. The real fix
   lives in `packages/web/src/grid/interaction/dom.ts` plus the Week and Day interaction
   adapters — **all outside the frozen allowlist `packages/web/src/grid/components/**`**, which
   is why this run could not address it. Mirrors the original 20260821 arm's SR-02, also left
   documented-not-structural.

   **(b) The production symptom is bounded but not fully pinned down.**
   Per the Pointer Events spec, cancelling `pointerdown` suppresses the compatibility
   `mousedown`/`mouseup` but explicitly does **not** suppress `click`. Whether the synthesised
   `click` still reaches the button after an ancestor has taken pointer capture could not be
   settled without a browser. So the real-app outcome is one of: **(i)** the click is retargeted
   away from the button and only the **event form** opens, or **(ii)** the click still reaches
   the button and the **event form opens *and* the meeting opens**. Both were reasoned from
   source and spec, **not observed**. A 60-second manual check in the running app settles it and
   remains outstanding — this is the check `change_plan §11 R-2` specified and which has still
   not been performed.

   **(c) A pointerdown on the join button also arms a drag of the underlying event.**
   Because the boundary resolves the join button's pointerdown to the enclosing card and starts
   an interaction session, pressing the glyph and moving can **reschedule the meeting** — an
   unintended write, not merely a wrong view. This is bounded by
   `INTERACTION_MOVE_THRESHOLD_PX = 25` against a 10×10 button, so an ordinary click cannot trip
   it; a slip or a drag-from-the-glyph can. Recorded as a correctness / data-integrity
   consequence, **not** a security finding. Neither the senior review nor the change plan noted
   this consequence.

   **Security status: unchanged and clear.** R-1 is a correctness bug that fails safe (§5). In
   every branch above, the only value that can reach `window.open` is one that passed
   `isJoinableUrl` microseconds earlier, so R-1 cannot cause a navigation to an unvalidated URL,
   cannot change which URL is opened, and cannot strip `noopener,noreferrer`. The security
   property is **orthogonal** to R-1 rather than protected by it.

   **CI blind spot, now closed for reading if not for behaviour.** The two drag-suppression
   tests previously asserted the *opposite* of (a) and passed. Per the Gate 3 ruling they were
   rewritten (packet `tp_refine_f2`) to document the real behaviour: retitled to
   "…stops mousedown bubbling **in an isolated tree**", with a `SCOPE:` comment naming R-1 and
   an inline annotation on the `onEventMouseDown` assertion. Coverage of the parts that do work —
   keyboard activation, the scheme guard, the verbatim `window.open` three-argument assertion,
   icon visibility — was left intact. CI no longer advertises a false invariant, but note it
   still cannot *detect* R-1; only a test rendering inside a real `PointerCaptureBoundary` and
   firing `pointerDown` could.
2. **R-3** — the drag ghost carries an inert clone of the join button. Confirmed harmless: the URL
   is not in the DOM so the clone cannot carry it, and the clone is `aria-hidden` + pointer-inert
   with no React listeners.
3. **R-4** — no debounce; a double-click can open two tabs. Now also un-pinned on the keyboard path
   (F-3).
4. **R-5** — the 10×10 hit target is below WCAG 2.2 SC 2.5.8's 24×24. Accessibility, not security;
   consistent with the `EventRepeatIcon` precedent.
5. **R-6** — each joinable card adds a tab stop.
6. **Provider trust, by design** — `conference.url` and `conference.label` are attacker-influencable
   by anyone who can get a calendar invite accepted. This feature deliberately makes that data
   one-click actionable. The scheme guard confines the damage to an `http(s)` navigation in a
   `noopener,noreferrer` tab; it does not and cannot prevent a user being taken to an attacker's
   web page they chose to click. F-4 is the transparency half of this.
7. **Host is not allowlisted, only the scheme.** `http://127.0.0.1:8080/...` and
   `http://169.254.169.254/...` are permitted (E-4). This is client-side navigation in a new tab,
   not a server-side fetch, so it is not SSRF; the residue is a one-click GET against a service on
   the user's own machine. Accepted as inherent to "open the meeting URL".

---

## 7. What I did NOT check

- **Any real browser.** No Chrome/Firefox/Safari execution. Everything about `window.open` feature-
  string handling, `javascript:`/`data:` top-level navigation blocking, click retargeting under
  pointer capture, and R-1's observable outcome is spec-and-source reasoning, not observation.
- **The rest of the repo.** This is a delta review. I read `PointerCaptureBoundary.tsx`,
  `draft-event.clone.ts`, `dom.ts`, the zod contracts, `google-event.normalizer.ts`, `UpNextCard`
  and `UpNextBanner` **for context only**; I did not audit them, and anything I noticed there is in
  §Noted below, not in the findings table.
- **`npm audit --omit=dev` as literally specified** — impossible here (`ENOLOCK`). Substituted
  `bun audit --prod`; I did not create a `package-lock.json` to satisfy the letter of the checklist.
- **The full web test suite.** I ran only the two in-scope test files (50 tests). I did not verify
  the run's headline suite total, and I did not check for cross-file test interference from the
  `window.open` stub (the `afterEach` restore at `EventCard.test.tsx` looks correct, but Bun's module
  isolation across files is untested by me).
- **The backend, sync, and API layers.** No server-side route, guard, audit-log, JWT, password-
  hashing, Helmet, rate-limiting or error-filter check was performed: **this run changed no
  server-side file**, so those checklist sections have no delta surface. I am explicitly *not*
  asserting the repo passes them — I did not look.
- **Behaviour under the pre-existing capture-phase listeners** in `useKeyboardOnlyMode.ts` and
  `useEditSequenceShortcut.ts`. I read the senior review's assessment that both are benign and did
  not independently re-derive it.
- **CSP.** I did not check whether the app ships a Content-Security-Policy that would independently
  constrain `window.open` targets or `javascript:` execution. If one exists it is additional
  defence; I am not counting on it.

---

## Noted (pre-existing, out of scope — advisory, does not gate this run)

**N-1 (advisory, would be major if in scope) — two unguarded consumers of the same provider-sourced
URL.** `conference.url` reaches two other sinks with **no scheme check at all**:

- `packages/web/src/components/Sidebar/UpNextCard/UpNextCard.tsx:89` — `href={upNext.conference.url}`
- `packages/web/src/components/Sidebar/UpNextCard/UpNextBanner.tsx:32` —
  `window.open(conferenceUrl, "_blank", "noopener,noreferrer")`

I proved (E-9, E-10) that nothing upstream filters the scheme: `z.url()` accepts `javascript:`,
`data:`, `vbscript:` and `file:`, and the Google normalizer's `ConferenceSchema.safeParse` is the
only validation on the path. So both sinks genuinely receive raw provider schemes.

Stating exploitability honestly rather than inflating it: both sinks use `target="_blank"` /
`"_blank"`, and modern browsers refuse to navigate a *fresh* browsing context to `javascript:` or
top-level `data:`, so the obvious XSS is likely blocked today by browser policy. What is **not**
blocked by that rule is custom-scheme handler invocation — `intent:`, `search-ms:`, `ms-msdt:`,
vendor app schemes — which `window.open` can hand to the OS. The mitigation is browser-version-
dependent and one `rel`/`target` refactor away from evaporating, so relying on it is not a
defensible position.

The fix already exists in this run's own code. Recommended follow-up ticket: hoist `isJoinableUrl`
out of `grid/components/` (F-5) and apply it at both sinks. **Outside the frozen allowlist — do not
attempt in this run.**

**N-2 (advisory) — dependency debt.** `bun audit --prod`: 69 advisories, 24 high, across `qs`,
`dompurify`, `postcss`, `ws`, `nanoid`, `axios`, `nodemailer` and others. None involve
`@phosphor-icons/react`; no manifest changed in this run. Entirely pre-existing and not
attributable here. Worth its own remediation ticket. Note `dompurify` arrives partly via
`posthog-js`, i.e. it is a **runtime** dependency, not only build tooling — that subset deserves
prioritising in whatever ticket picks this up.

---

## Passing checks

- URL scheme guard is an **allowlist** (`http:`/`https:`), not a denylist — correct shape for
  untrusted input, and proven non-bypassable across 42 adversarial inputs (E-4).
- The guard is **load-bearing, not decorative** — proven that `z.url()` accepts dangerous schemes
  and that ingest applies no scheme filter (E-9, E-10). This change closes a real gap.
- Guard is applied at four independent layers with no reachable bypass, including under re-render
  (§4.3).
- `noopener,noreferrer` present, exact, and pinned by verbatim test assertions (§4.2).
- `conference.url` never reaches the DOM, logs, telemetry, error reporters, accessible names, drag
  clones, or any persistence payload (§4.4, E-7, E-8).
- No injection possible via `conference.label`; length bounded at 256 at ingest (§4.5).
- No secrets, tokens or real credentials in any changed file, including test fixtures (E-14).
- No new dependencies; no manifest or lockfile change (E-15).
- FR-7 read-only contract holds mechanically (E-1, E-15).
- Lint clean (E-6); in-scope tests green, 50/50 (E-5).
- `*.env*` gitignored (E-18).

## Required fixes before sign-off

**None.** No blocker and no major finding; the run is clear to proceed at Gate 3 on security
grounds.

Recommended follow-up tickets (none blocking):

1. **F-1** — close the parse/use divergence in `isJoinableUrl` (one-line authority check, or parse
   with the document base). Inside the allowlist.
2. **N-1 + F-5** — hoist `isJoinableUrl` to a shared module and apply it at `UpNextCard.tsx:89` and
   `UpNextBanner.tsx:32`. Highest-value item in this review; outside the allowlist.
3. **F-2** — annotate or restructure the drag-suppression tests so the green suite is not misread
   as evidence that R-1 is absent. Should be filed together with the R-1 debt record.
4. **F-3** — assert `defaultPrevented` on the Enter/Space keydown rather than relying on the call
   count.
5. **F-4** — consider a host-only `title` for destination transparency.
6. **N-2** — dependency remediation, prioritising the runtime subset (`dompurify` via `posthog-js`).
