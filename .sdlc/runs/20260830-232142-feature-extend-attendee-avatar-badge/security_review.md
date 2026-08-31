# Security review — grid attendee badge

> Run `20260830-232142-feature-extend-attendee-avatar-badge` · branch `CMP-105/flash-agsdk-only`
> · anchor `2d81253a` · reviewer: gemini-3.7-flash via Antigravity (packet `tp_sec_001`).
> Scope: **changed files only** (feature-extend column of the Intent matrix).

**Verdict: `pass with notes`.** No blockers, no majors. Two minors, both inside the frozen allowlist.

## Scope reviewed

Six files, complete: `attendee-status.ts` (new), `AttendeeBadge.tsx` (new), `TimedEventCard.tsx`,
`AllDayEventCard.tsx`, `EventCard.test.tsx`, `EventDetailsSection.tsx`.

No backend, core, sync or scripts file was touched. `package.json` and `bun.lock` are unchanged —
**no dependency was added or upgraded this run**. The attendee data itself is untouched: `GridEvent`
already carried `organizer` and `attendees` before this run, and nothing new is fetched, synced or
stored.

## PII assessment

Attendee identity data — display names, and **raw email addresses** where `displayName` is null —
is now rendered on the main calendar grid inside DOM `title` tooltips and an `aria-label`. The
underlying data was already in client memory, but this run moves it **from behind a click in the
event edit form onto the persistently visible grid**. A calendar grid is one of the most commonly
screen-shared surfaces there is, so hovering a status dot during a shared session can broadcast an
attendee's email to everyone watching.

The reviewer asks for a Gate ruling on whether the raw-email fallback is acceptable on a
high-visibility surface.

## Findings

### F-1 · minor · PII exposure · `AttendeeBadge.tsx` · **inside allowlist**
`a.displayName ?? a.email` puts a raw email into the hover `title` and into the `aria-label`
whenever the provider supplies no display name.
*Why it matters:* accidental disclosure during screen-sharing or shoulder-surfing, on a surface
that previously required a deliberate click to reach.
*Fix:* do not fall back to the raw address on the grid — use a generic placeholder or a masked/
truncated form.

### F-2 · minor · resource / DoS · `AttendeeBadge.tsx` · **inside allowlist**
`summaryLabel` maps over the **entire** `attendees` array on every render, uncapped, even though
only three dots are drawn.
*Why it matters:* a 500-attendee invite rebuilds a 500-entry string on every drag/resize frame,
across every visible card — main-thread cost during the most latency-sensitive interaction in the app.
*Fix:* cap the iteration at `MAX_BADGE_ATTENDEES` and summarise the remainder
(`"… and 497 others"`), or summarise by status counts.

## Categories assessed clean

- **Injection (XSS / CSS / URL sink)** — attendee strings reach only React text/attribute positions.
  No `dangerouslySetInnerHTML`, no URL sink, no interpolation into a `className` that could escape.
  Provider strings flow into `title` and `aria-label`, both of which React escapes.
- **Dependencies / supply chain** — no manifest changed; nothing added or upgraded.

## Orchestrator note on F-1

The two halves of F-1 do not carry equal weight, and the difference is worth recording:

- The **`title` tooltip** exposure is real. `aria-hidden="true"` on the dot spans suppresses the
  accessibility tree, but it does **not** suppress the native browser tooltip on mouse hover. So the
  email is genuinely reachable by hovering.
- The **`aria-label`** half is, in practice, largely inert — for the same reason senior-review
  finding R-3 flags as an accessibility defect. The badge's `role="group"` sits inside a
  `role="button"` card root, whose descendants are presentational under WAI-ARIA, so most screen
  readers never announce that label at all.

That is an uncomfortable pairing: the accessibility bug (R-3) is what limits the disclosure surface
of the privacy issue (F-1). Fixing R-3 the way the senior reviewer proposes — folding attendee
detail into the card's own `accessibleLabel` — would *widen* F-1 rather than narrow it. The two
findings must be resolved together, not independently.

## Required before sign-off

Per the reviewer: address the raw-email fallback and cap the `summaryLabel` iteration before
release. Neither is a release blocker in the reviewer's judgement, and both are inside the frozen
allowlist, so both are fixable without reopening Gate 0.

**Neither was fixed in this run.**

## Gate 3 ruling (final)

- **F-1 and F-2 — accepted as debt** for this comparison arm, and listed as **must-fix-before-merge**
  in the final report alongside C-1 and C-2.
- **The entanglement above was ruled on directly.** The badge stays `aria-hidden`; attendee detail
  is **not** folded into either card's `accessibleLabel`. That fix would trade an inert-a11y bug for
  a live PII broadcast on a screen-shared surface, and RSVP detail behind a click — in
  `EventDetailsSection` — is the right altitude for it. Senior-review R-3 is therefore recorded as
  **accepted-as-debt with that rationale**, explicitly *superseding* the reviewer's own
  `fix_suggestion`, which proposed the `accessibleLabel` fold now ruled against.
