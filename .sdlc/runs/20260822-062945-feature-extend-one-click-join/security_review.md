# Security Review — pass2 (HITL Gate 3)

- **Run:** `20260822-062945-feature-extend-one-click-join`
- **Ticket:** CMP-103 — "One-click join"
- **Mode:** brownfield, intent `feature-extend`
- **Baseline:** git HEAD `4189de1389d8a4644ae20d9c5a907f1d161b5496`, nothing committed
- **Reviewer note:** this pass was performed without reading `security_review_prior_unlogged.md`.

## Tooling caveat (read first)

`Glob` and `Grep` were **not present** on this build — the tool surface was `Read`, `Bash`,
`Write` only. All enumeration was therefore done with `Bash` (`grep -rn`, `ls`, `git grep`,
`git diff`). Every negative finding below cites the exact command that produced it. One
checklist item (`npm audit --omit=dev`) **could not be executed** and is reported as
UNVERIFIED, not as a pass — see DEP-01.

---

## Scope confirmation

`git status --porcelain` and `provenance.json` agree exactly. Seven paths, six modified +
one new (plus untracked `.hook-logs/`, which is **not** in `provenance.json` and is therefore
out of the delta; see CFG-02).

| Path | State | provenance packet(s) |
|---|---|---|
| `packages/web/src/grid/components/EventJoinIcon.tsx` | new, untracked | P1, P1-debug-1/2, P5-B1-wire, P7 |
| `packages/web/src/grid/components/TimedEventCard.tsx` | modified | P2a |
| `packages/web/src/grid/components/AllDayEventCard.tsx` | modified | P2b |
| `packages/web/src/grid/components/EventCard.test.tsx` | modified (+569, additions only) | P3, P6 |
| `packages/web/src/grid/interaction/event.registry.ts` | modified | P5-B1-fix |
| `packages/web/src/grid/interaction/event.registry.test.ts` | modified | P6-B1-regression |
| `.gitignore` | modified (+1 line) | P4 |

No `package.json` and no `bun.lock` change (`git status --porcelain | grep -E "package.json|bun.lock"`
→ no output).

---

## Summary

The delta is, on the whole, **carefully built and defensively reasoned**, and the B-1 fix is
sound: the new `EVENT_INTERACTION_IGNORE_ATTRIBUTE` is matched only against the *pointer's own
ancestor path* (`target.closest(...)`) and only when the marker sits *inside* the resolved card
(`element.contains(ignored)`), so it cannot be used to disable a card the pointer never entered,
and it is honored at the one factory (`createEventRegistry`) that both the Week and Day adapters
funnel through — verified, not assumed. `resolveFromTarget` feeds interaction targeting only, never
an authorization decision. The render-time scheme guard `isSafeConferenceUrl` was fuzzed with **66
payloads** against the real exported function and produced **zero scheme-injection bypasses**: every
`javascript:` / `data:` / `vbscript:` / `blob:` / `file:` / protocol-relative / control-character /
unicode / percent-encoding variant was rejected, and the validator is strictly *stricter* than
`window.open`'s own resolution, so there is no validator/consumer parse divergence. The
`ph-no-capture` claim was verified against the **installed** posthog-js 1.409.0 bundle rather than
taken on faith, across all three capture paths (autocapture, dead-clicks, session replay).

Two things temper that. First, this delta's own reasoning treats the Zod contract as the primary
guard and the render-time check as belt-and-braces; empirically it is the **other way round** —
`ConferenceSchema`'s `z.url()` accepts `javascript:`, `data:` and `vbscript:` unchanged, which
makes `isSafeConferenceUrl` the only real guard in the codebase and makes three *pre-existing*
sinks (two `<a href>`, one `window.open`) live one-click vectors. Those are out of delta scope
and non-gating, but they are High and should become a ticket today. Second, the delta-specific
risk is not injection but **destination opacity**: ADR-1's button-plus-`window.open` deliberately
keeps the URL out of the DOM, and the necessary consequence is that the user gets no hover
preview, no status bar, and no host in the accessible name — while the URL and its label are both
attacker-influenceable through an ordinary calendar invite. The delta turns a first-party-looking
glyph into a one-click navigation to content the user cannot vet, replicated on every card in the
grid rather than the single Up-Next banner. That is the one finding I want conditioned before
sign-off, and it is cheap to fix.

**Verdict: PASS-WITH-CONDITIONS.**

---

## Findings

| ID | Severity | Class | Category | Location | Issue | Recommendation |
|---|---|---|---|---|---|---|
| SEC-01 | **Medium** | (a) exploitable today | Phishing / UI trust | `packages/web/src/grid/components/EventJoinIcon.tsx:60-119` | Join destination is unverifiable before click. `conference.url` is provider-synced from `conferenceData.entryPoints[].uri` (fully settable by whoever created the invite). ADR-1 removes `href`, so there is no hover preview, no status bar, no right-click "copy link address", and the accessible name carries no host. A hostile invite renders a native-looking "Join Google Meet" control that one-click navigates to attacker content. The delta multiplies this from one Up-Next banner to every conference-bearing card. | Put the URL's **host** in the accessible name. The host is not the capability (path/query/fragment is), so this leaks nothing and restores the vetting cue. Diff in "Required fixes". |
| SEC-02 | **Low** | (b) latent | PII / spoofing | `packages/web/src/grid/components/EventJoinIcon.tsx:72,77` | `conference.label` is attacker-controlled (Google `conferenceSolution.name`, up to 256 chars) and is interpolated into the accessible name as `Join ${label}`. The only filter is `!label.includes("/")`. (i) Spoofing: a label of `Google Meet (verified)` or `Compass Security Check` becomes the button's announced name. (ii) The file's claim that this "keeps the medium-sensitivity meeting URL out of the DOM entirely" holds for the URL but **not** for slash-free capability material — `Zoom Meeting 812 3456 7890 Passcode 4f2a` passes the heuristic straight into the DOM and the a11y tree. Not XSS: no HTML sink exists (see PASS-6). | Cap the label (e.g. 40 chars) and prefer an allowlist of known provider names over the slash heuristic; combine with SEC-01's host suffix so the host, not the label, is the trust signal. |
| SEC-03 | **Low** | (b) latent | New attack surface (B-1 fix) | `packages/web/src/grid/interaction/event.registry.ts:114-120` | The selector `` `[${EVENT_INTERACTION_IGNORE_ATTRIBUTE}]` `` matches on attribute **presence**, so `data-calendar-event-interaction-ignore="false"` / `""` / `"0"` suppresses interaction just as `"true"` does. React stringifies non-boolean `data-*` values, so a future caller writing `{...{[ATTR]: someFlag}}` with a falsy flag would silently make that card undraggable and un-openable. The delta's own test only ever sets `"true"`. | Match the value: `` `[${ATTR}="true"]` ``, or `closest` then compare `getAttribute(ATTR) === "true"`. Add a case asserting `"false"` does **not** suppress. |
| CFG-01 | **Info** | (b) latent | Secrets & config | `.gitignore:36` | `+.sdlc/` un-ignores nothing (no `!` lines added), does not shadow env files (`*.env*` at line 4 still wins — `git check-ignore -v .env` → `.gitignore:4:*.env*`), and `.sdlc` was never tracked (`git ls-files .sdlc \| wc -l` → `0`), so no history is orphaned. Net effect worth stating: Gate-3 evidence — including this report — is now deliberately **not** version-controlled and lives only on the developer's disk. | Accept as intended, or carve out an exception (`!.sdlc/runs/*/security_review.md`) if audit trails are meant to be reviewable in PRs. |
| CFG-02 | **Info** | (c) adjacent, not in delta | Secrets & config | `.hook-logs/` (untracked) | Directory is untracked **and** unignored (`git check-ignore -v .hook-logs/` → no match, exit 1), so a `git add -A` sweeps it into a commit. Adjacent to the `.gitignore` packet but not itself in `provenance.json`. Scanned for credential-shaped strings: `grep -rEn "(api[_-]?key\|secret\|token\|password)[ \t]*[=:][ \t]*['\"][a-zA-Z0-9_-]{8,}" .sdlc/` → no matches (same pattern not run against `.hook-logs` content beyond listing). | Add `.hook-logs/` to `.gitignore` in a future packet. |
| DEP-01 | **Info** | unverified | Dependency risk | repo root | `npm audit --omit=dev` **did not execute**: `npm error code ENOLOCK … requires an existing lockfile` (repo is bun-based; only `bun.lock` exists, no `package-lock.json`). Substitute `bun audit --prod` ran but is **not trustworthy as a prod-only signal**: it returns counts identical to `bun audit` (`69 vulnerabilities (24 high, 37 moderate, 8 low)` for both) and its output names `jsdom` and `postcss`, which are `devDependencies` in `packages/web/package.json` (lines 54 and 56, both below the `devDependencies` key at line 39). The `--prod` flag is therefore not being honored across this workspace. | Reported as **UNVERIFIED**, not as a pass. Generate a `package-lock.json` (`npm i --package-lock-only`) in a deps-intent run, or pin a prod-only audit path. **Non-gating for this delta** — see PASS-9. |

### Threat model, item by item

**1. The meeting URL — origin, validation, DOM reachability, scheme injection.**
Traced end to end: `packages/sync/src/providers/google/google-event.normalizer.ts:159-175`
(`mapConference` reads `item.hangoutLink ?? conferenceData.entryPoints[…].uri`, both
attacker-settable by an invite creator) → `ConferenceSchema.safeParse` →
`packages/core/src/types/event.contracts.ts:30` → `packages/web/src/events/queries/event.view-model.ts:94`
→ card. **The contract does not filter schemes.** Probed with the installed Zod against the real
`ConferenceSchema` (11 cases): `javascript:`, `JaVaScRiPt:`, `data:text/html,…`, `vbscript:`,
`blob:`, `file:///etc/passwd`, `about:blank` and `mailto:` were **all accepted**; only
`//evil.com/x` was rejected. So `isSafeConferenceUrl` is not defence-in-depth — it is the guard.

It holds. Empirical fuzz of the **real exported function** (66 payloads; harness in scratchpad,
run via `bun run` from `packages/web`): 16 accept, 50 reject, **zero scheme bypasses**. Rejected:
plain/mixed-case/space-padded `javascript:`; leading LF/CR/TAB/NUL/VT/FF; TAB/LF/CR *embedded
inside* the scheme token (the WHATWG parser strips them, so the padded form is caught rather than
throwing); HTML-entity, percent-encoded and unicode-homoglyph colon/`j` variants; ZWSP, BOM and
RTL-override prefixes; `data:` (plain and base64); `vbscript:`; `blob:`; `filesystem:`; `file:`;
`about:`; `chrome:`; `view-source:`; `ws:`/`wss:`/`ftp:`/`mailto:`/`tel:`; `intent:`, `ms-msdt:`,
`search-ms:`, `zoommtg:`, `msteams:`; protocol-relative `//`, `/\`, UNC `\\`, root-relative,
bare-relative, empty and whitespace-only. **Parse-divergence check:** each payload was also
resolved with a page base to model what `window.open` would actually navigate to; the validator is
strictly stricter in every case (it parses with *no* base, so anything relative throws), so nothing
passes validation and then resolves differently at the sink. **Accepted-by-design** (all `http`/`https`,
so not scheme injection): embedded credentials `https://user:pass@evil.com/`, userinfo host
confusion `https://meet.google.com@evil.com/`, IDN/punycode homographs, loopback/link-local
(`127.0.0.1`, `[::1]`, `169.254.169.254`), and hex/decimal IP forms. These are host-trust issues,
not scheme issues, and they are exactly what SEC-01 addresses — note that `https://meet.google.com@evil.com/`
is the case where a host suffix in the accessible name earns its keep.

**DOM reachability:** the URL never enters the DOM. `EventJoinIcon` has no `href`, no `title`,
no `data-*` copy — `grep -n "title=" …/EventJoinIcon.tsx` → no match. Pinned by the delta's own
test (`EventCard.test.tsx:1023`, `expect(container.innerHTML).not.toContain(CONFERENCE.url)`),
which I executed and watched pass.

**2. New-tab navigation safety.** `window.open(url, "_blank", "noopener,noreferrer")`
(`EventJoinIcon.tsx:84`). Per the HTML standard's window-open steps, `noreferrer` in the features
string implies `noopener` **and** sets referrer policy `no-referrer`, so: reverse tabnabbing is
closed (`window.opener` is null in the new context), and the Compass URL — which contains no
secrets today but is still an internal-app URL — does not leak in the `Referer` header. Because
ADR-1 carries this in a string literal rather than an HTML `rel` attribute, the AC-3 test is
load-bearing; it exists, asserts both tokens (`EventCard.test.tsx:141`), and passes. No finding.

**3. PII / capability-token leakage.** DOM: clean (item 1). `title`: absent. Logging: `grep -n
"console\.\|logger\|track(" ` across all four delta source files → **no matches**; no error path
in the delta stringifies the URL. Analytics: the `ph-no-capture` claim was **verified against the
installed bundle**, not the class name —
`node_modules/posthog-js/lib/src/autocapture.js:164-175` sets `explicitNoCapture` when the class
appears on the element *or any ancestor* and returns `{props:{}}`, and the caller at line 368
`return false`s outright; without it, line 83-99 would serialise **every** attribute as
`attr__<name>`, including `aria-label`. Dead-click autocapture:
`node_modules/posthog-js/dist/dead-clicks-autocapture.js` carries the ignore list
`[".ph-no-deadclick",".ph-no-capture"]` and its own `explicitNoCapture` flag. Session replay:
`node_modules/posthog-js/lib/src/extensions/replay/external/lazy-loaded-session-recorder.js:1782`
sets `blockClass: 'ph-no-capture'`. Autocapture is live (`posthog.bootstrap.ts:24-46` never sets
`autocapture: false`), so ADR-4's reasoning is confirmed on all three paths. Residual leak is the
label, tracked as SEC-02 — note `ph-no-capture` covers it for telemetry, so the label residue is
DOM/a11y-tree only.

**4. `EVENT_INTERACTION_IGNORE_ATTRIBUTE` as attack surface.** Spoofing requires injecting an
element or attribute into a card's DOM. `grep -rn "dangerouslySetInnerHTML\|innerHTML\|
createContextualFragment\|outerHTML" packages/web/src/` returns **one** non-test production hit,
`packages/web/src/index.tsx:20`, which assigns a hardcoded literal boot-failure banner with no
interpolation. No grid card renders event-controlled HTML — cards render event text through JSX
children and attribute values, both of which React escapes. So the attribute cannot be spoofed
without an injection primitive that would already be game over. **Scope of what it can suppress:**
tight and correct. `target.closest()` binds the marker to the pointer's own ancestor path, and
`element.contains(ignored)` binds it to the inside of the resolved card, so a marker outside the
card cannot disable the card (pinned by the new test at `event.registry.test.ts:79-101`) and a
marker inside one card cannot affect another. Worst case even *with* injection is UI denial
(cards unopenable/undraggable), never privilege escalation — `resolveFromTarget` has exactly two
production consumers, `week-interaction.adapter.ts:637` and `day-interaction.adapter.ts:588`, both
pointer targeting, neither an authz decision. The only real defect is the presence-vs-value match,
SEC-03.

**5. Masked/private (`isBusy`) events — D1.** *This is my independent security opinion. It is
NOT a decision, and I changed no code or test.* **Factually there is no leak today, and it is
structural rather than incidental.** `EventContentSchema`
(`packages/core/src/types/event.contracts.ts:20-39`) is a discriminated union whose busy arm is
`z.strictObject({ kind: z.literal("busy") })` — it has no `conference` member at all — and
`event.view-model.ts:60-61,94` derives `conference` from `details`, which is `undefined` whenever
`content.kind === "busy"`. So a busy event reaches the card with `conference === undefined`,
`isSafeConferenceUrl` returns false, and no control renders. `availability.contracts.ts:71` says
the same for the availability path. **My opinion:** the delta's choice to rely on the contract and
*not* add a redundant `isBusy` guard is defensible and I would not block on it — a defence-in-depth
guard here would be a second source of truth for a rule the type system already enforces, and the
delta does the honest thing by pinning **both halves** in `EventCard.test.tsx:1026-1062`, including
an explicit assertion that a busy event *with* a conference **would** render the control, with a
comment telling the next person to update the role matrix rather than silently diverge. That is
better engineering than a silent guard. The one thing that gives me pause: the protection depends
on a contract in `packages/core` that this team does not control end-to-end (a provider-mapping
change, a cache row rehydrated from IndexedDB under an older schema, or a future relaxation of the
busy arm could all attach a conference), and the blast radius if it ever breaks is a *masked*
event's meeting link becoming one-click reachable — a confidentiality failure on precisely the
events the user asked to hide. If the human decides to add the guard, the cheapest correct form is
one clause in each card's `showJoinIcon` (`!event.isBusy`) plus flipping the second half of the
existing test; if the human decides not to, the existing test already makes the dependency loud,
and I would ask only that the role matrix line in `requirements.md:153` be treated as normative.
Either way, **not a gating finding.**

**6. Dependency risk introduced by this delta.** **None introduced.** No manifest or lockfile
change. `@phosphor-icons/react` is a pre-existing `dependencies` entry
(`packages/web/package.json:11`) imported by 40 files at HEAD, and `VideoCameraIcon` specifically
was already imported at HEAD by `UpNextCard.tsx:1` and `EventDetailsSection.tsx:1`
(`git grep -n "VideoCameraIcon" HEAD -- packages/web/src`). The repo-wide audit posture is
**UNVERIFIED** for the reasons in DEP-01 — I am explicitly not reporting a clean result from a
check that did not execute.

**7. The `.gitignore` change.** Single appended line `.sdlc/`. See CFG-01 (and CFG-02 for the
adjacent unignored `.hook-logs/`).

---

## Passing checks

Each states the command or file:line that produced it.

- **PASS-1 — No scheme-injection bypass in `isSafeConferenceUrl`.** 66-payload fuzz of the real
  exported function; 50 rejected, 16 accepted and all `http`/`https`. Harness run with
  `bun run …/probe-abs.ts` from `packages/web`.
- **PASS-2 — No validator/consumer parse divergence.** Same run resolved every payload against a
  page base; the validator (no-base parse) is strictly stricter at every point.
- **PASS-3 — Meeting URL never enters the DOM.** No `href`/`title`/`data-*` copy in
  `EventJoinIcon.tsx`; pinned by `EventCard.test.tsx:1023` and observed passing.
- **PASS-4 — Reverse tabnabbing and referrer leakage closed.** `noopener,noreferrer` at
  `EventJoinIcon.tsx:84`; both tokens asserted at `EventCard.test.tsx:141`.
- **PASS-5 — `ph-no-capture` genuinely suppresses capture in the installed bundle**, on all three
  paths: `posthog-js/lib/src/autocapture.js:164-175` + `:368`,
  `posthog-js/dist/dead-clicks-autocapture.js` (`[".ph-no-deadclick",".ph-no-capture"]`),
  `…/lazy-loaded-session-recorder.js:1782` (`blockClass`).
- **PASS-6 — No HTML-injection sink in the web app.** `grep -rn "dangerouslySetInnerHTML|innerHTML|
  createContextualFragment|outerHTML" packages/web/src/` → one production hit,
  `index.tsx:20`, a hardcoded literal with no interpolation. All other hits are tests.
- **PASS-7 — Ignore-attribute suppression is correctly scoped.** `target.closest()` +
  `element.contains(ignored)` at `event.registry.ts:114-120`; the out-of-card case is pinned by a
  new test (`event.registry.test.ts:79-101`).
- **PASS-8 — Single choke point covers both views.** `grep -rn "createEventRegistry"` → only
  `view-event-registry.ts:79`; `resolveFromTarget` production consumers are exactly
  `week-interaction.adapter.ts:637` and `day-interaction.adapter.ts:588`.
- **PASS-9 — No dependency introduced.** `git status --porcelain | grep -E "package.json|bun.lock"`
  → no output; `VideoCameraIcon` already imported at HEAD.
- **PASS-10 — No logging of sensitive values in the delta.** `grep -n "console\.|logger|track("`
  across the four delta source files → no matches.
- **PASS-11 — No secrets in the delta or its artifacts.**
  `grep -rEn "(api[_-]?key|secret|password)[ \t]*=[ \t]*['\"][a-zA-Z0-9]" packages/web/src/grid/`
  → no matches; same pattern (plus `token`) over `.sdlc/` → no matches.
- **PASS-12 — Test fixtures carry no real credentials.** The only fixture URL is
  `https://meet.google.com/abc-defg-hij` (`EventCard.test.tsx:36`), a placeholder; unsafe-URL
  cases are synthetic.
- **PASS-13 — `.gitignore` un-ignores nothing and shadows no env rule.** Full file read; no `!`
  lines added; `git check-ignore -v .env` → `.gitignore:4:*.env*`.
- **PASS-14 — Busy events cannot render the join control.** Structural, via the `busy` arm of
  `EventContentSchema` (`event.contracts.ts:38`) and `event.view-model.ts:60-61,94`.
- **PASS-15 — Delta tests execute green.**
  `bun test src/grid/components/EventCard.test.tsx src/grid/interaction/event.registry.test.ts`
  → `49 pass, 0 fail, 111 expect() calls`.

**Checklist items not applicable to this delta** (client-side rendering change; no controller,
route, entity, serializer, audit table, JWT, password store, helmet, rate limiter or error filter
is touched): PII-at-rest encryption, role-based response masking, audit-log ordering/append-only/
role gating, per-route guards, `reports_to` checks, JWT secret sourcing, password hashing cost,
Helmet, auth rate limiting, global error filter. Recorded as N/A rather than pass.

---

## Required fixes before sign-off

**Condition 1 (gating) — SEC-01: surface the destination host in the accessible name.**
File: `packages/web/src/grid/components/EventJoinIcon.tsx`. This restores the destination-vetting
cue that ADR-1 traded away, without putting the capability (path/query/fragment) into the DOM.

```diff
+// ADR-1 keeps the URL out of the DOM, which also removes the browser's own
+// hover/status-bar preview. The host is not the capability — the path and
+// query are — so announcing it restores the "where am I going?" cue at no
+// leakage cost, and is the difference between "Join Google Meet" pointing at
+// meet.google.com and the same control pointing at evil.com.
+const hostOf = (url: string): string | null => {
+  try {
+    return new URL(url).host || null;
+  } catch {
+    return null;
+  }
+};
+
 export const EventJoinIcon = ({ baseColor, label, offsetForRepeatIcon = false, url }: Props) => {
   const providerLabel = label && !label.includes("/") ? label : null;
+  const host = hostOf(url);
+  const joinName = providerLabel ? `Join ${providerLabel}` : "Join video call";

   return (
     <button
       {...{ [EVENT_INTERACTION_IGNORE_ATTRIBUTE]: "true" }}
-      aria-label={providerLabel ? `Join ${providerLabel}` : "Join video call"}
+      aria-label={host ? `${joinName} at ${host}` : joinName}
```

Add one test asserting the accessible name contains the host for
`https://meet.google.com/abc-defg-hij`, and one asserting that for
`https://meet.google.com@evil.com/` the announced host is `evil.com`, not `meet.google.com`.
*(Route through a packet — I made no edits.)*

**Condition 2 (gating) — SEC-03: match the ignore attribute by value, not presence.**
File: `packages/web/src/grid/interaction/event.registry.ts:114-116`.

```diff
-      const ignored = target.closest<HTMLElement>(
-        `[${EVENT_INTERACTION_IGNORE_ATTRIBUTE}]`,
-      );
+      // Value-matched, not presence-matched: React stringifies data-* values,
+      // so a caller spreading a falsy flag would render `="false"` and a
+      // presence match would silently make the whole card non-interactive.
+      const ignored = target.closest<HTMLElement>(
+        `[${EVENT_INTERACTION_IGNORE_ATTRIBUTE}="true"]`,
+      );
```

Add a case to `event.registry.test.ts` asserting `"false"` does **not** suppress resolution.

**Condition 3 (non-gating, must be acknowledged) — SEC-02:** bound `conference.label` to a
sensible length and prefer an allowlist of provider names over the slash heuristic, or accept the
residual spoofing/meeting-ID exposure explicitly in `requirements.md §5`.

**Condition 4 (non-gating, disposition required) — D1 / item 5:** human to record a decision on
the `isBusy` guard. My reasoned opinion is above; it is an opinion, not a decision, and either
outcome is defensible.

**Condition 5 (non-gating) — DEP-01:** record `npm audit --omit=dev` as UNVERIFIED for this run
and open a deps-intent follow-up to make a prod-only audit runnable.

---

## Noted (pre-existing, out of scope — advisory, does NOT gate this run)

- **PRE-01 — High — `javascript:` in `conference.url` is contract-valid and reaches three
  unguarded sinks.** `ConferenceSchema.url` is `z.url()`
  (`packages/core/src/types/event-attendance.contracts.ts:31-34`), which I confirmed empirically
  accepts `javascript:`, `data:`, `vbscript:`, `blob:`, `file:`, `about:` and `mailto:`. The value
  is stored verbatim by `mapConference`
  (`packages/sync/src/providers/google/google-event.normalizer.ts:159-175`) and then rendered as
  a live link by **`packages/web/src/views/Forms/EventForm/EventDetailsSection.tsx:48`**
  (`<a href={conference.url}>`) and **`packages/web/src/components/Sidebar/UpNextCard/UpNextCard.tsx:89`**
  (same), and passed to `window.open` by
  **`packages/web/src/components/Sidebar/UpNextCard/UpNextBanner.tsx:32`** — which is also bound to
  the global `V` shortcut. React is `18.3.1` (`node_modules/.bun` → `react@18.3.1`), which warns on
  but does **not** block `javascript:` hrefs. Net: a calendar invite from any sender can plant a
  one-click script-execution vector on surfaces that predate this run. **This delta is the fix
  pattern, not the cause** — it is the only place in the repo that validates the scheme.
  Recommended follow-up ticket: lift `isSafeConferenceUrl` into
  `packages/web/src/common/utils/url.util.ts`, apply it at all three sinks, and add
  `.refine()` for `http`/`https` to `ConferenceSchema` so the contract stops being a rubber stamp.
  Deliberately **not** gating CMP-103 per brownfield scoping.
- **PRE-02 — Info — repo-wide dependency posture.** `bun audit` → `69 vulnerabilities (24 high,
  37 moderate, 8 low)`, spanning `nodemailer`, `body-parser`, `ip-address`, `nanoid`, `postcss`,
  `ws`. Mixed prod/dev, and the prod/dev split is not currently separable (DEP-01). Untouched by
  this delta.
- **PRE-03 — Info — `darken(baseColor, 30)`** (`EventJoinIcon.tsx:115`) is reached with a
  provider-influenced `colorHex`. The identical call already exists in `EventRepeatIcon`, so the
  delta adds no new exposure; flagged only so a future hardening pass of `color.utils` knows both
  call sites exist.

---

## Gate 3 recommendation

**PASS-WITH-CONDITIONS.**

Ship once Conditions 1 and 2 are applied via packets (both are small, both are in files already
inside the frozen write contract, and both need one added test each). Conditions 3–5 are
acknowledgements and dispositions, not code blockers. No Critical or High finding originates in
this delta. The single High in this report (PRE-01) is pre-existing, out of delta scope, explicitly
non-gating — and warrants its own ticket today, because this delta happens to have written the
correct guard for it.
