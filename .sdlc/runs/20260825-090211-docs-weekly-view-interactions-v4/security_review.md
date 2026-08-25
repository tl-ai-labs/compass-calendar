# Security Review — docs run `20260825-090211-docs-weekly-view-interactions-v4`

Scope: **changed files only** (intent matrix, `docs` row). The only changed file is `README.md`.
Reviewer: `security-reviewer` subagent. Persisted by the orchestrator — see "Process note" below.
Branch: `CMP-102/opus-plus-sonnet`. Policy: `opus-plus-sonnet`. Auth: `estimated`.

## Verdict: **GO**

Ship the `README.md` change as written. No blocking finding was introduced by this run.
No required fixes before sign-off.

## Findings

| Severity | Category | Location | Issue | Recommendation |
|---|---|---|---|---|
| Medium | Repo hygiene — **pre-existing, out of scope** | `.sdlc/pre-check-status.json` | Tracked **and committed at HEAD**. Contains the developer's absolute home path twice (`<home>/...`). `package.json` declares `"license": "MIT"` and a `LICENSE` file exists, so this is a public repo. Discloses OS username and local layout. | Untrack; add to `.gitignore`. Already in history — removing from HEAD does not scrub prior commits. |
| Medium | Repo hygiene — **pre-existing, out of scope** | `.sdlc/CLAUDE-SDLC.md` | Tracked and committed. Names the internal GCP project id `<gcp-project>` (L34, L43, L52) and documents internal tooling posture (which API keys are/aren't set, auth-mode fallbacks, per-model routing). No credential values. | Move SDLC process docs out of the published repo, or scrub the project id and auth narrative. |
| Low | Repo hygiene — **pre-existing, out of scope** | `.sdlc/ledger.json` L593, `.sdlc/ledger.md` L216 | Tracked. Records `oauth2.googleapis.com` TLS handshake failures and per-run cost/token telemetry. Operationally revealing, not sensitive. | Optional; same remedy. |
| Low | Docs accuracy / informed consent | `README.md`, "Your **event color** syncs two ways…" | The sync is genuinely bidirectional, but the write path has an undocumented destructive side effect on Google-side data: setting a Compass slot color first issues a preconditioned patch of `eventLabelId: ""`, clearing any custom Google event label the user applied. See `packages/sync/src/providers/google/google-event-writer.adapter.ts:187-198`. | Non-blocking. A future sentence could say "choosing a Compass color replaces any custom label color on the Google event." **Do not amend under this run's write contract.** |
| Info | Docs completeness | `README.md`, "When you have more than one calendar, a **stripe**…" | Says the stripe shows "which one it belongs to" (singular). In the cross-account duplicate case one card stands in for two real events on two connected accounts and the stripe is a two-stop gradient. Omission is safe (§3); incomplete. | Optional future addition. Not a gate item. |

## Passing checks

**1. Disclosure — no findings.** The added lines were grepped for URLs, `localhost`/`127.0.0.1`,
`.internal`, `CMP-` ticket IDs, Jira refs, key/secret/token/password assignments, and email
addresses: zero matches. No employee names, no roadmap, no endpoints, no security-control detail.
Internal design-rationale markers present in the source (the `A5`/`A9` acceptance tags in
`calendar-accent.util.ts`) did **not** leak into the prose.

**2. Two-way Google color sync — accurate, does not understate egress.** Both directions traced:
- Google → Compass: `google-event.normalizer.ts:98` (`googleColorIdToSlot(item.colorId)`), `:101-102`.
- Compass → Google: `google-event-writer.adapter.ts:306` spreads `googleColorIdFields(content.color)`
  into the create/patch body.
- Mapping is exactly 11 slots (`GOOGLE_COLOR_ID_TO_SLOT`, ids 1-11), matching "eleven named options".

"Syncs two ways" correctly signals the color is written out to Google rather than being a
Compass-local setting. The datum crossing the boundary is a single integer `colorId` on an event
already in the user's own Google Calendar; no new data category crosses, and `colorId` is a
property of the user's copy, not something propagated to other attendees. No sentence implies a
privacy property that is untrue, and none is phrased as guidance a user would base a privacy
decision on.

**3. Cross-account phrasing — omitting the gradient is safe.**
`packages/web/src/events/queries/merge-cross-account-duplicates.ts`: the merge is a pure
client-side view-model collapse of two copies sharing an `icalUid` with identical start/end across
two accounts. It runs *after* the visible-calendar filter, so hiding one account's calendar
unmerges automatically. Nothing is written, deleted or shared; the second copy remains untouched on
its own account. The merge is not silent to assistive tech either —
`calendarAccentAccessibleSuffix` appends `", also on <accountEmail>"`. A user cannot make a wrong
privacy decision from the omission.

**4. Scoping and lint attribution.** `provenance.json` lists exactly one non-`.sdlc` file touched:
`README.md`. No source, dependency, endpoint or config changes — so authz / PII / JWT / audit-log /
rate-limit checks are not applicable, and `npm audit` is out of scope (no dependency delta).
Independently confirmed the run's lint attribution: Biome does not lint `README.md`; `bun lint`
exit 1 comes entirely from `.sdlc/*.json` plumbing.

## Corrections to two premises in the review brief (verified, not relayed)

1. `.sdlc/runs/**` and `.sdlc/local/*` are **not** tracked in git — `git status --porcelain -uall`
   shows them as `??`. Only 8 `.sdlc` files are tracked (confirmed via `git ls-files .sdlc`).
   `.gitignore` L38-39 cover only `.sdlc/**/_gemini_worker_save/` and `.sdlc/local/debug.log`, so
   `runs/**` is untracked-*but-not-ignored*: a `git add -A` would sweep it in. **That** is the
   exposure, not present tracking.
2. `.sdlc/local/debug.log` — which holds the richest environment detail (forwarded env-var name
   list, plugin venv paths, `project=<gcp-project>`, `location=global`) — **is** gitignored,
   correctly.

## Noted for follow-up (pre-existing, out of scope, DO NOT FIX HERE)

- Untrack and ignore `.sdlc/pre-check-status.json`; reconsider publishing `.sdlc/CLAUDE-SDLC.md`.
- Add a blanket `.sdlc/` ignore rule (or explicit `.sdlc/runs/` + `.sdlc/local/`) so an untracked
  run directory cannot be swept in by `git add -A`.
- Both touch `.gitignore`, which is `off_limits` under the active contract. File as a follow-up
  ticket. Note Gate 0 **deliberately declined** the blanket `.sdlc/` rule, because `c3c59a36`
  tracks the project-level `.sdlc/` layer on main by design — so this follow-up needs a decision,
  not a reflex `.gitignore` append. Two prior CMP-102 runs appended to `.gitignore` unasked; this
  run did not.

## Process note — write-contract carve-out gap (PROC-05)

The `security-reviewer` subagent **declined to write this file**, reasoning from
`.sdlc/local/write-contract.json` that `.sdlc/**` appears in `off_limits` while `allowlist` is
`["README.md"]` alone. It returned the report inline instead.

The refusal was a false positive at the subagent-prompt level, not a hook block: the PreToolUse
hook implements the run-record carve-out, and writes to `.sdlc/runs/<run-id>/` from the
orchestrator (`requirements.md`, `packets.json`, this file) and from the `senior-reviewer`
(`review.json`) all succeeded in this same run. The contract JSON does not encode the carve-out
that the hook enforces, so any subagent that reads the JSON literally will reach the wrong
conclusion. Worth fixing in the contract schema (an explicit `run_record_path` entry in
`allowlist`) so subagents and the hook agree.
