# Security Review — Phase 8 (Gate 3)

**Run:** `20260820-164209-docs-weekly-view-interactions`
**Intent:** `docs`
**Verdict:** **PASS WITH NOTES**

---

## Scope

**Changed-files-only.** Per the `docs` row of the Intent matrix, this review is scoped to the
files this run wrote. `provenance.json` lists exactly one tracked-file write:

- `README.md` — +6 / -0 / ~0 (one new `## Weekly view interactions` section, 101 words)

The two other provenance entries (`requirements.md`, `packets.json`) are untracked SDLC run
metadata, not application artifacts.

The wider Compass codebase — auth, PII handling, dependency tree — was **not** audited and is
out of scope for this run. No application code was touched, so the full authz/PII/dependency
checklist does not apply and was deliberately skipped.

Two pre-existing, already-committed docs are pulled into scope only because the README now
promotes them to a public audience:

- `docs/frontend/week-drag-interaction.md` (committed in `a7e2b167`)
- `docs/acceptance/recurring-events.md` (committed in `58cc4361`)

Both were read in full.

---

## Findings

| ID | Severity | File | Finding | Recommendation |
|---|---|---|---|---|
| SR-01 | low | `.sdlc/`, `.hook-logs/` (repo root) | Both directories are untracked **and** absent from `.gitignore` (`grep -cE "sdlc\|hook-logs" .gitignore` → `0`). `.sdlc/local/debug.log` contains internal operational metadata: the GCP project identifier `ai-studies-console`, absolute developer home paths, plugin cache paths, per-model token/cost telemetry, and a list of forwarded environment variable **names** (including `ANTHROPIC_API_KEY`, `CLAUDE_CODE_MESSAGING_TOKEN`). **No secret values are present** — verified by scanning `.sdlc/` and `.hook-logs/` for `key/token/secret/password` assignments with ≥16-char values (no matches) and for high-entropy ≥40-char blobs (only a path string). Risk is that a future `git add -A` commits this exhaust into a public repo. | Add `.sdlc/` and `.hook-logs/` to `.gitignore`. Gate 0 already recorded this (`gitignore_sdlc_entry: "no — .gitignore not allowlisted"`), so it must be actioned outside the run's write contract. |
| SR-02 | info | `.sdlc/local/write-contract.json` | The contract's own `off_limits` list includes `.sdlc/**`, yet the harness wrote `requirements.md`, `packets.json`, `provenance.json`, and this file under `.sdlc/runs/`. This is harness self-writes, not agent escape — the allowlist governs the authoring agent, not the orchestrator. Recorded for clarity, not as a violation. | No action. Consider exempting harness-owned paths explicitly in a future contract schema. |

No other findings. The README change itself is clean — see below.

---

## Checks performed and passed

**Write-contract adherence (blocker check — clean)**
- `git status --porcelain` → `M README.md` is the **only** tracked modification. Untracked: `.hook-logs/`, `.sdlc/` (both agent exhaust, see SR-01).
- No file under `packages/**` or `docs/**` was modified, both of which are `off_limits`. `docs/frontend/week-drag-interaction.md` and `docs/acceptance/recurring-events.md` were read only; both remain clean in git.
- Provenance agrees with git: one tracked write, `README.md`.

**Secret / credential leakage in added lines — none**
- Scanned the 6 inserted lines for `api_key|secret|token|password|credential|bearer|authorization` → no match.
- Scanned for key-shaped material (`AKIA`, `ghp_`, `sk-`, `xox*-`, `-----BEGIN`, JWT `eyJ...`, ≥32-char base64) → no match.
- Scanned for IPs, `.internal`, `.local`, `.corp`, `localhost`, `:PORT`, `process.env`, `VITE_`, `NEXT_PUBLIC` → no match.

**Secret leakage in the two newly-promoted docs — none**
- Both scanned for the same credential and network patterns → zero matches in either file.
- `recurring-events.md` references only `bun run dev:web` (a local dev command), the client route `/week`, and "Log in with any account" — no credentials, no hostnames, no endpoints.
- `week-drag-interaction.md` describes frontend drag geometry and cites source paths under `packages/web/src/...`. Those paths are already public in the same repo; naming them adds no exposure.

**Information disclosure from promotion — no material change**
- Both docs were already committed to this public repo (months prior) and already reachable by anyone browsing `docs/`. Linking them from the README changes *discoverability*, not *access*.
- Neither describes security-relevant implementation detail (no auth flow, no token handling, no trust boundary, no rate-limit or validation logic that an attacker could probe). The drag doc is pointer-math and render-cache correctness; the recurring doc is end-user acceptance steps.
- No unreleased or unshipped feature is advertised: the README's pre-existing "Things you can't do in Compass (yet)" list is untouched, and drag/recurring/colors are all shipped behavior.

**Link safety — clean**
- Exactly two links in the added text, both repo-relative: `./docs/frontend/week-drag-interaction.md` and `./docs/acceptance/recurring-events.md`.
- Independently verified both resolve to real, git-tracked files (`git ls-files --error-unmatch` succeeded for both).
- No external URLs, no bare domains, no protocol-relative (`//`), no `javascript:`, `data:`, `vbscript:`, `mailto:`, or `ftp:` URIs anywhere in the added lines. Nothing typosquattable, because nothing leaves the repo.

**Markdown injection / rendering — clean**
- No raw HTML tags, `<script>`, `<iframe>`, `<style>`, `onerror`/`onload` handlers in the added lines.
- No image syntax (`![...]`), so there is no image-beacon / pixel-tracker that would cause a reader's client to phone out to a third party on render.
- Content is limited to headings, list items, bold spans, and two inline links — all inert under GitHub's Markdown renderer, which sanitizes HTML regardless.

**Accuracy as a security property — clean**
- The new section makes **no security or privacy claim of any kind**: no assertion about encryption, access control, data retention, sharing, or who can see an event. There is therefore nothing for it to overstate.
- Spot-checked the one falsifiable factual claim: "Choose from 11 colors or keep the 'Calendar default'." `EVENT_COLOR_SLOT_HEX` in `packages/web/src/common/styles/theme.util.ts` defines exactly 11 slots (lavender, mint, plum, coral, gold, orange, blue, slate, indigo, green, red), and `eventColorLabel` returns the literal string `"Calendar default"` for the `null` case. The claim is accurate.

---

## Residual risk

Effectively zero from the change itself. This run added 101 words of inert, user-facing prose
and two repo-relative links to documents that were already public in the same repository — it
introduces no code path, no network egress, no new data handling, and no security claim that
could later prove false. The single carried-forward item, SR-01, is not a property of the diff
at all but of the SDLC tooling's working directory: agent exhaust sits untracked and
un-ignored at the repo root, and while it holds no secret *values*, it does hold internal
project and environment metadata that a careless `git add -A` would publish. That is a
one-line `.gitignore` fix, and it is outside this run's write allowlist by design, so it must
be handled by an operator rather than blocked on here. Nothing in this change warrants
withholding sign-off.
