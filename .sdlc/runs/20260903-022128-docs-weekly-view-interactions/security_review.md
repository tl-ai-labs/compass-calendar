# Security Review — pass_with_notes

Run: `20260903-022128-docs-weekly-view-interactions`
Intent: `docs` (brownfield, changed-files-only scope)
Reviewed at: 2026-09-03
Base commit: `2d81253ab8a4c8e69b27e28d12c6ae9cc61d1bfe`

## Scope of this review

**This is NOT a full-codebase audit. Do not cite it as one.**

This review covered exactly two documentation files, the complete write-set of this run as
independently confirmed against `git status --porcelain` and
`.sdlc/runs/20260903-022128-docs-weekly-view-interactions/provenance.json` (both agree):

1. `docs/frontend/weekly-view-interactions.md` — NEW, 160 lines, untracked
2. `README.md` — exactly one added line (+1/-0)

No source file, dependency manifest, lockfile, CI workflow, or build config was modified by this
run; this was verified, not assumed (see Passing check 6). Application source under `packages/**`
was **read only** as ground truth to verify factual claims made by the documentation. No
authentication, authorization, PII-handling, audit-log, secrets-management, HTTP-header, or
dependency-vulnerability posture of this repository was assessed. The standard checklist sections
for those areas are **not evaluated and must not be inferred as passing** from this document.

Per the intent matrix, a `docs` intent scopes security review to documentation content: secret
leakage in examples, sensitive-behavior disclosure, and accuracy of any claim about a destructive
operation. That is what is assessed below.

## Summary

The change is clean from a security standpoint. The new document contains no secrets, tokens, keys,
credentials, internal hostnames, private endpoints, customer identifiers, or non-public
infrastructure detail — it contains no URLs of any kind. The 11 hex values are UI palette constants
that match the canonical source exactly and are not sensitive. The behavior it documents is
client-side interaction state in a public open-source repository and discloses nothing that
materially assists an attacker. The README change adds a single repo-relative link with no external
host and no tracking parameters. One real issue was found, and it is an accuracy-as-safety problem
rather than a vulnerability: the doc states without qualification that deletions are undoable via
Cmd/Ctrl+Z, in the section about *recurring* events, which is precisely the case where that is
sometimes false. The application code itself is correctly guarded and does not mislead end users;
the risk is to a future contributor who trusts the doc's blanket safety net while building a new
delete affordance. Verdict is **pass_with_notes** — Finding 1 should be corrected before merge, but
nothing here blocks on security grounds.

## Findings

| # | Severity | Category | Location | Issue | Recommendation |
|---|---|---|---|---|---|
| 1 | Medium | Accuracy-as-safety (destructive op) | `docs/frontend/weekly-view-interactions.md` line 85 | Doc asserts, unqualified, that `useDeleteEvent.ts` hardcodes `scope: "this"` "because deletions are undoable via Cmd/Ctrl+Z". Deletes are undoable only when **both** conditions in `packages/web/src/events/mutations/event.mutation-history.ts` hold: `isUndoableRecurrence(existing)` (i.e. `event.recurrence.kind !== "series"`) **and** `isThisScope(scope)` (`"this"` or undefined). Deleting a **series base record**, or deleting at scope `"all"` / `"thisAndFollowing"`, records **no** undo entry — the series is destroyed with no client-computable inverse. The product is careful here (`deleted-toast.util.tsx`: "recurring deletes aren't undoable, so hinting Cmd+Z there would undo an unrelated earlier change" — the Cmd+Z keycap is deliberately withheld), so the doc is *more* confident than the code it describes. Risk is amplified by the doc's closing section instructing contributors to add new grid mutations. | Qualify the claim: state that undo covers single events and individual occurrences deleted at scope `"this"` only, and that series-base and `"all"`/`"thisAndFollowing"` deletes are irreversible client-side. Cite `isUndoableRecurrence` and `isThisScope` as the actual gate. |
| 2 | Low | Accuracy | `docs/frontend/weekly-view-interactions.md` line 85 | "`useDeleteEvent.ts` hardcodes `scope: "this"`" is true of the free function `deleteEventAndDiscardDraft` (literal `scope: "this"`) but **not** of the `useDeleteEvent` hook in the same file, whose signature is `(scope: RecurrenceScope = "this")` — a caller-supplied value with a default. This compounds Finding 1: the caller-supplied path is exactly the one that can pass a non-undoable scope. | Distinguish the two exports, or say "defaults to `scope: "this"`" rather than "hardcodes". |
| 3 | Info | Accuracy | `docs/frontend/weekly-view-interactions.md` lines 76–77 | The timed-card bullet correctly gives `REPEAT_ICON_MIN_WIDTH = 40` (`TimedEventCard.tsx:58`); the following all-day bullet says all-day cards "Apply the width gate only", which reads as the same constant. `AllDayEventCard.tsx:32` defines its own `REPEAT_ICON_MIN_WIDTH = 60`. Cosmetic; no safety impact. | State the all-day threshold as 60 explicitly. |

No critical or high-severity findings.

## Passing checks

1. **No secret or credential leakage.** Pattern scan for `api_key`/`api-key`/`secret`/`token`/
   `password`/`passwd`/`bearer`/`authorization`/`private_key`/`client_secret` over both changed
   files returned only false positives on prose: "semantic **tokens**", "`--color-*` theme
   **tokens**", "Palette Resolution and **Token** Architecture". No credential material present.
2. **No internal infrastructure disclosure.** The new doc contains **zero URLs** (`https?://` scan:
   no matches). No email addresses, no IP addresses, no base64/JWT-shaped blobs, no internal
   hostnames, no private endpoints, no customer identifiers. All path-like strings are
   repo-relative source paths already public on GitHub.
3. **The 11 hex values are confirmed non-sensitive UI palette constants.** Every hex in the doc
   matches `packages/web/src/common/styles/theme.util.ts` exactly, and the doc's set is a strict
   *subset* of the source's (the source additionally holds `#454442`, `#82A0B2`; the doc invents
   nothing). These are the Google Calendar legacy palette slots. As flagged in the brief: confirmed
   not secrets.
4. **Sensitive-behavior disclosure: no real risk.** The documented internals — session-scoped
   `declinedEditInstanceIds`, optimistic mutation projection, non-modal post-commit toasts, delete
   not prompting for scope — are ordinary client-side frontend behaviour in a public repo. Verified
   `declinedEditInstanceIds` is an in-memory `Set` in a Zustand store
   (`recurrence-scope-opportunity.store.ts:40,48`), not a persisted artifact and not a security
   control; it gates a UI prompt, nothing more. Nothing described is an authorization boundary, and
   an attacker gains nothing from it that reading the public source would not already give. Not
   inflated into a finding.
5. **Documented behavioral claims verified against source.** `resolveRecurrenceScopeDecision`
   returns `{ kind: "apply", scope: THIS_EVENT }` unconditionally for `action === "delete"` —
   confirmed verbatim (`recurrence-scope-decision.ts:89-91`). The calendar-move block string
   "Repeating events can't move to another calendar." confirmed (`useUpdateEvent.ts:83`).
   `DRAFT_DURATION_MIN = 30` and `REPEAT_ICON_MIN_DURATION_MINUTES = 15` confirmed. Aside from
   Findings 1–3 the document is accurate.
6. **Supply chain unchanged.** `git status --porcelain` filtered on `package.json`, lockfiles,
   `.github/**`, `tsconfig*`, `vite*`, and `*.yml`/`*.yaml` returns **NONE**. The only untracked
   path outside `.sdlc/` bookkeeping is the new doc itself. No dependency was added, removed, or
   bumped, so no new package-registry trust was assumed by this run.
7. **README link is safe.** The single added line is
   `[docs/frontend/weekly-view-interactions.md](./docs/frontend/weekly-view-interactions.md)` — a
   repo-relative path. No external URL, no third-party host, no `utm_*` or other tracking
   parameter, no typosquat surface (pre-existing README lines do carry `utm_*` params on the Notion
   handbook link; that is untouched by this run and out of scope).
8. **All relative links resolve.** `docs/frontend/week-drag-interaction.md` and
   `docs/acceptance/recurring-events.md` both exist; the README target exists. No broken or
   dangling references that could later be filled by an attacker-controlled path.
9. **Licensing / attribution unproblematic.** The doc quotes short code excerpts and source
   comments verbatim from this same repository, under the same ownership and license as the doc. No
   third-party code, no external snippet, no attribution obligation triggered.

## Required fixes before sign-off

- **Finding 1 (Medium)** — qualify the "deletions are undoable via Cmd/Ctrl+Z" claim so it names the
  `isUndoableRecurrence` / `isThisScope` gate. This is contributor-facing guidance about an
  irreversible operation, and it is currently broader than the code supports. Recommended fix
  before merge.

Findings 2 and 3 are non-blocking; fold them into the same edit if Finding 1 is addressed.

## Checklist sections not evaluated (out of scope for a `docs` intent)

PII encryption-at-rest and role-based masking; authn/authz guard coverage and `reports_to` checks;
JWT secret sourcing; password hashing cost factors; audit-log append-only enforcement and reader
roles; `.env`/`.env.example` handling; Helmet, rate limiting, and global error filters;
`npm audit --omit=dev`. None of these surfaces were touched by this run — no runtime code changed —
and none were assessed. Absence of findings in these categories in this document reflects the review
scope, **not** evidence that the underlying controls exist.
