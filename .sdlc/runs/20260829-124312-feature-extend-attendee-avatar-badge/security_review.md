# Security Review — pass1

- **Run:** `20260829-124312-feature-extend-attendee-avatar-badge`
- **Mode:** brownfield (scoped to the 8 files this run touched, per `provenance.json`)
- **Intent:** feature-extend
- **Anchor:** `2d81253a` (working tree only; nothing committed)
- **Reviewed:** 2026-08-29

## Summary

The change moves attendee identity (display names, RSVP status) from a click-to-open form
panel onto the always-visible calendar grid, which is the whole of its risk. The
implementation handles that transition well: attendee email is never written to the DOM,
the monogram is derived through a `^[\p{L}\p{N}]$` single-code-point whitelist that
structurally cannot emit an `@`, the render cap slices before it maps, and busy-projection
events are double-gated out of the badge entirely. No XSS, no injection, no secrets, no new
dependencies. The findings below are all MEDIUM-or-lower and cluster on one theme: the
per-avatar `title` attribute keeps each attendee's full `displayName` resident in the DOM
of an always-rendered surface, while the badge's own `pointer-events-none` root guarantees
that tooltip can never actually render — so the retained PII buys the user nothing. Fixing
that is a one-line deletion with no UX cost and is the only thing I'd want changed before
sign-off. Posture: **sound design, one cheap hardening step outstanding.**

## Findings

| Severity | Category | Location | Issue | Recommendation |
|---|---|---|---|---|
| MEDIUM | PII / dead attribute | `packages/web/src/grid/components/EventAttendeeBadge.tsx:129`, `:147` | The badge root is `pointer-events-none` (`:112`). `pointer-events` is an **inherited** CSS property and no descendant overrides it, so no element in the badge subtree can ever receive a hover — the native tooltip that `title` exists to produce is unreachable. The root is also `role="img"` with an `aria-label` (`:109-117`), which makes the subtree presentational, so assistive tech does not announce the `title` either. Net: both `title` attributes are inert for every user, yet `:129` keeps each attendee's full `displayName` in the DOM of a surface that renders without interaction. | Delete the `title` on the avatar (`:129`) and on the overflow chip (`:147`). Pure PII reduction at zero UX cost. If a hover affordance is wanted later it must be designed deliberately (the badge would need to stop being pointer-inert, which FR-12 forbids). |
| MEDIUM | PII exposure | `packages/web/src/grid/components/EventAttendeeBadge.tsx:129` | `title={`${attendee.displayName ?? "Guest"}, ${statusText}`}` interpolates `displayName` verbatim. The no-`@` guarantee is airtight for the *monogram* and for the group `aria-label`, but not here: `AttendeeSchema` types `displayName` as any 1–256 char string, and in practice directory syncs and provider fallbacks frequently set it **to the email address**, while an attacker fully controls it for their own account. The requirements' PII inventory (`requirements.md:155`) explicitly accepts `displayName` in `title` — but that acceptance was priced against a tooltip benefit that the finding above shows does not exist. Test coverage stops at the boundary: `EventAttendeeBadge.test.tsx:60-83` asserts no `@` only when **every** `displayName` is `null`; there is no case for a `displayName` that *is* an email. | Covered by the deletion above. If any `title` is retained, gate it: fall back to `"Guest"` whenever `displayName` fails a no-`@` check, and add the missing test case (`displayName: "victim@corp.com"` → title contains no `@`) so FR-10's "including when a `displayName` itself looks like an email" clause is enforced on the `title`, not just the `aria-label`. |
| MEDIUM | PII / third-party egress | `EventAttendeeBadge.tsx:129` in combination with `packages/web/src/auth/posthog/posthog.bootstrap.ts:24-49` | PostHog is initialised with no `disable_session_recording` and no `maskTextSelector` / `maskAllText`, so whether replay records is a **server-side project toggle outside this repo** that I cannot verify from the codebase. rrweb serialises element attributes and, without a mask selector, text. This run is what first places attendee identity into the always-rendered DOM, so it materially widens the blast radius of that remote toggle. Scoped precisely: **autocapture is not a path here** — autocapture walks the *ancestor* chain of a click target, and the badge is `pointer-events-none` so it can never be one; `capture_console_errors: false` (`:36`) also keeps console output out of ingest. | Deleting the `title`s removes the attribute-side exposure. Additionally consider adding PostHog's `ph-no-capture` class to the badge root so the subtree is masked in replay regardless of the remote setting, and confirm the project's session-replay toggle out of band. |
| LOW | Information disclosure (console) | `packages/web/src/grid/components/EventAttendeeBadge.tsx:123` | `key={attendee.email}`. The comment's claim that a React key is "never written to the DOM" is correct. However, two attendees sharing an email in one event produce React's dev-mode duplicate-key warning, which **prints the key value — an email address — to the browser console**. Impact is local only (`capture_console_errors: false` means PostHog does not ingest it). | Optional. Key on the array index or a non-reversible hash of the email if console hygiene matters; otherwise accept and note. |
| LOW | Resource / hot path | `packages/web/src/grid/components/EventAttendeeBadge.tsx:55-61` (called at `:98`) | The render cap is correctly enforced — `slice(0, avatarCount)` at `:96` happens **before** `.map` at `:118`, so DOM node count is bounded at 3 regardless of attendee count (verified by test at `EventAttendeeBadge.test.tsx:41-58`, incl. a 50-attendee case). But `countAccepted` scans the **full, uncapped** array on every render, outside any memo, for every visible card. `AttendeeSchema` imposes no array length limit and provider events reach hundreds of attendees; the cards re-render on drag/resize. | Wrap the count in `useMemo` keyed on `attendees`, or cap the scan alongside the render cap. Low urgency — it is an integer loop, not an allocation. |
| INFO | XSS / injection — **no issue found** | all 8 changed files | No `dangerouslySetInnerHTML`, `innerHTML`, `eval`, or `new Function` anywhere in the change set. All attendee-derived text reaches the DOM as React children or attribute values, which React escapes. `baseColor` traces cleanly: `bgColor` ← `useEventPalette(event.color, event.colorHex)` ← `colorHex` validated by `HexColorSchema` (`RGBHexSchema`), then `darken()` → `tinycolor(...).toString()`, which normalises to a well-formed colour literal; the result is applied via a React **style object** (per-property CSSOM assignment), so a malformed value is rejected by the CSSOM rather than escaping into a new declaration. No CSS-injection path. | None. |
| INFO | Authorization — **no issue found** | `packages/web/src/events/queries/event.view-model.ts:61,93`; `EventAttendeeBadge.tsx:89`; `TimedEventCard.tsx:134-138`; `AllDayEventCard.tsx:83-85` | Busy-projection events cannot render a badge, guarded twice independently. `EventContentSchema` declares busy content as `z.strictObject({ kind: z.literal("busy") })` — structurally incapable of carrying attendees — and the view model sets `attendees: details?.attendees` where `details` is `undefined` unless `content.kind === "details"`. `undefined` then fails the `attendeeCount > 0` gate in both cards *and* the component's own early return. No degraded or partially-populated state is reachable. | None. |
| INFO | Secrets / deps — **no issue found** | all 8 changed files | No credential-shaped literals in the change set. No dependency manifest change (`package.json` / `bun.lock` untouched by this run); `@phosphor-icons/react`, `classnames` and `tinycolor2` were all already direct dependencies. Test fixtures use only `example.com` addresses and contain no real credentials or tokens. | None. |

## Passing checks

- **Email never reaches the DOM.** Verified by trace, not just by test: `attendee.email` appears exactly once in the badge (`:123`, as a React key) and nowhere in text, `aria-label`, `title`, or any `data-*`.
- **Monogram cannot leak an email local-part.** `MONOGRAM_CHARACTER = /^[\p{L}\p{N}]$/u` (`:42`) tested against a single destructured code point (`:48`, correctly avoiding a `charAt(0)` surrogate split) whitelists one letter or digit; everything else — punctuation, emoji, whitespace, `null` — falls to the `UserIcon` glyph. `@` is structurally unreachable. FR-8 satisfied.
- **`displayName: null` → `"Guest"`, never the email.** `:129`, asserted at `EventAttendeeBadge.test.tsx:85-98`. FR-11 satisfied.
- **Group `aria-label` names nobody.** `"3 guests, 2 accepted"` (`:99-101`), asserted not to contain any attendee name (`EventAttendeeBadge.test.tsx:100-125`). FR-10 satisfied for the accessible label.
- **The two surfaces are not conflated.** The `EventDetailsSection.tsx` diff is a pure extract-to-shared-module refactor; the shared `attendee-status.ts` contains only the status→token map and the label helper — **no name-resolution logic** — so the form's deliberate `displayName ?? attendee.email` (`:63`) had no vehicle to follow the map onto the grid. The grid badge independently uses `?? "Guest"`. This is exactly the regression the requirements (`:159-163`) flagged, and it was avoided.
- **Render cap slices before mapping** (`:96` before `:118`); off-by-one arithmetic asserted for 1/2/3/4/6/50 attendees.
- **Badge is interaction-inert.** No `tabIndex`, no `onMouseDown`, no `stopPropagation`, `pointer-events-none` + `select-none` (`:112`). Cannot add a tab stop or interfere with card drag/resize/select. FR-12 satisfied.
- **Height/width gates keep the badge off cards too small to hold it** (`TimedEventCard.tsx:135-138`, `AllDayEventCard.tsx:84-85`), with the badge's row correctly subtracted from the title clamp budget (`TimedEventCard.tsx:143-151`).
- **Total `Record<AttendeeResponseStatus, string>` typing** (`attendee-status.ts:8`) makes a future enum member a compile error rather than an `undefined` class at runtime; exhaustiveness is also asserted dynamically against `AttendeeResponseStatusSchema.options`.
- **Tests green:** 35 pass / 0 fail across the three test files, run via the project runner (`bun packages/scripts/src/testing/test-parallel.ts web`). Note: a bare `bun test` on these files fails with `PORT is required` and `document is not defined` — that is missing preload/env, not a code defect.
- **Env hygiene:** `.gitignore:4` carries `*.env*`; no `.env*` files exist in the tree. No env files were touched by this run.

## Noted (pre-existing, out of scope)

These are outside the change set or unmodified by it. They do **not** gate this run.

- `packages/web/src/views/Forms/EventForm/EventDetailsSection.tsx:63` — `attendee.displayName ?? attendee.email` renders full email addresses in the form panel. Deliberate and unchanged by this run (confirmed against `git diff 2d81253a`). Correct call for a click-to-open authenticated surface; flagged only to record that it was reviewed and is intentionally *not* mirrored on the grid.
- `packages/web/src/views/Forms/EventForm/EventDetailsSection.tsx:41` — `href={conference.url}` with a provider-sourced URL. `ConferenceSchema.url` is `z.url()`, which accepts a `javascript:` scheme, and React 18 (`packages/web/package.json:27`) only *warns* on `javascript:` hrefs rather than blocking them. Pre-existing and untouched, but it sits adjacent to changed lines — worth a separate ticket to constrain the schema to `http`/`https`.
- **Dependency audit.** `npm audit --omit=dev` is unrunnable here (no `package-lock.json`; this is a bun workspace — `ENOLOCK`). Ran `bun audit --prod` instead: **69 vulnerabilities (24 high, 37 moderate, 8 low)**, all pre-existing transitive dependencies in trees this run does not touch — `nodemailer` (backend), `postcss`/`nanoid` (web build), `ws`/`jsdom` (test), `ip-address` (mongodb), `body-parser` (express). **Zero introduced by this run**, which adds no dependencies. Caveat on the number: `bun audit --prod` still surfaces build- and test-only trees, so it is not a clean production-only figure and should not be compared directly against an `npm audit --omit=dev` baseline.

## Required fixes before sign-off

1. **Remove the two `title` attributes** in `EventAttendeeBadge.tsx` (`:129` avatar, `:147` overflow chip). They cannot render as tooltips behind `pointer-events-none`, are not announced under `role="img"`, and `:129` is the only place per-attendee identity lands in the DOM. One-line change, no UX loss, closes the two MEDIUM PII findings together.

## Advisory (not blocking)

2. Add the missing negative test — `displayName: "victim@corp.com"` produces no `@` in any rendered text or attribute — so FR-10's "even when `displayName` looks like an email" clause is regression-locked on the `title`/DOM path and not only on the group `aria-label`.
3. Consider `ph-no-capture` on the badge root and confirm the PostHog project's session-replay toggle out of band.
4. Memoise `countAccepted` (`:98`) so an uncapped attendee array is not rescanned per card per frame on the drag/resize path.
5. File a follow-up ticket for the pre-existing `z.url()` / `javascript:` href in `EventDetailsSection.tsx:41`.

VERDICT: PASS_WITH_FINDINGS
