# Final Report — CMP-103 one-click join

**Run:** `20260822-062945-feature-extend-one-click-join`
**Mode:** brownfield · **Intent:** `feature-extend` · **Policy:** `opus-only-v5` (single tier, claude-opus-5 via claude-cli) · **Auth mode:** `estimated`
**Branch:** `CMP-103/opus-only-v5` · **Base:** `4189de13` · **Nothing committed — the delta is working-tree only**
**Status at report time:** awaiting Gate 4 approval
**Status at close-out (2026-08-22T18:06Z):** **Gate 4 APPROVED** — plain, unconditional. R-1 performed (see §7). Run closed as `complete`. Still uncommitted by design.

---

## 1. What shipped

A one-click join affordance on calendar grid cards. When an event carries a conference link, the card renders a small video-camera button in its bottom-right corner; activating it opens the meeting in a new tab via `window.open(url, "_blank", "noopener,noreferrer")` and does **not** open the Compass event-detail form.

Three properties are load-bearing and each is pinned by a test:

- **The meeting URL never enters the DOM.** Activation goes through `window.open` rather than an `href`, keeping a bearer capability token out of both the accessibility tree and PostHog autocapture (`ph-no-capture`).
- **The protocol is re-validated at render time.** `isSafeConferenceUrl` admits only `http:`/`https:`, defending against a `javascript:`/`data:` URL arriving from a stale IndexedDB row, a hand-seeded demo event, or a future contract relaxation.
- **The grid declines ownership of the button's gestures** via `EVENT_INTERACTION_IGNORE_ATTRIBUTE`, honored in `resolveFromTarget`.

## 2. Files changed

7 paths, all inside the write-contract allowlist. **771 insertions, 3 deletions.**

| File | Change |
|---|---|
| `packages/web/src/grid/components/EventJoinIcon.tsx` | **NEW.** The shared join control, plus the exported `isSafeConferenceUrl` render-time protocol guard. |
| `packages/web/src/grid/components/TimedEventCard.tsx` | +31 — renders the join control. |
| `packages/web/src/grid/components/AllDayEventCard.tsx` | +33 −2 — same, with the padding line it replaces. |
| `packages/web/src/grid/interaction/event.registry.ts` | +36 — exports `EVENT_INTERACTION_IGNORE_ATTRIBUTE`; `resolveFromTarget` honors it. |
| `packages/web/src/grid/interaction/event.registry.test.ts` | +72 −~19 — four ignore-attribute unit tests. |
| `packages/web/src/grid/components/EventCard.test.tsx` | +601 — append-only; all 575 original lines preserved in order. |
| `.gitignore` | +1 — ignores `.sdlc/` (AC-10). |

## 3. Verification — actual results

Re-run after the final code change (Gate 3 conditions D5 + D6):

| Command | Result |
|---|---|
| `bun test:web` | **2326 pass, 0 fail, exit 0** — baseline 2324 plus exactly the 2 tests added for D5/D6 |
| `bun type-check` | **exit 0** |
| `bun lint` | **exit 0**, 10 warnings — all pre-existing, none in the delta |

Two caveats recorded rather than smoothed over:

- **Lint went red before it went green.** The D5/D6 edits produced 3 Biome formatter errors. They were fixed with `bunx biome format --write` scoped to exactly the three affected files. The repo's own `lint:fix` script (`biome check --write .`) was deliberately **not** used, because it would have auto-fixed the 10 pre-existing FIXABLE warnings in files outside the allowlist — an off-scope write disguised as housekeeping.
- **`expect()` call-count variance.** Two consecutive runs of an unchanged tree reported 5824 then 5822 `expect()` calls, with identical 2326 pass / 0 fail. The +5 over the 5819 baseline is exactly the 5 assertions added, so 5824 is the accounted-for figure. The 2-assertion wobble indicates mild non-determinism elsewhere in the suite, not in this delta. Flagged, not chased.

**Mutation check (recorded earlier in the run):** temporarily disabling the ignore check (`if (false && ignored ...)`) failed exactly 3 tests — the 2 registry ignore tests and the end-to-end pointerdown test — while the unrelated-ancestor test correctly still passed. The regression tests genuinely bind the fix.

## 4. The one blocker found, and how it was closed

**B-1 — double-open on join click.** `PointerCaptureBoundary` binds `onPointerDownCapture` on an *ancestor* of every card and calls `preventDefault()` + `stopPropagation()` in the **capture** phase, so the join button's own `onPointerDown`/`onMouseDown`/`onClick` never executed. `pointerup` then yielded a synthetic `{type:'click'}` and the event form opened, while the native click still ran `window.open`. Net effect: a join click opened **both** a new tab and the event form — i.e. the headline feature was broken in exactly the way the design claimed it was safe.

The design's four-handler mitigation (ADR-5) was dead code. No descendant-side fix existed, because the gesture was consumed above the button. `resolveFromTarget` in `event.registry.ts` was the only choke point, and `createEventRegistry` is the single factory behind both the Week and Day views, so one check covers both.

Closing it required reopening Gate 2's Q-B (which had explicitly forbidden widening into `grid/interaction/*`) and taking **amendment-1** to the write contract. That was escalated to a human and approved rather than decided by the pipeline.

A secondary finding: `design.md` §6.4's claim that this path could not be automated was false — `fireEvent.pointerDown` exists and `PointerCaptureBoundary` is mountable, as `PointerCaptureBoundary.test.tsx` already demonstrates. An automated regression test was written accordingly.

## 5. Security review — PASS-WITH-CONDITIONS

Full report: `security_review.md`. Both conditions were applied and verified green.

**Verified by execution, not by reading:**
- `isSafeConferenceUrl` fuzzed with **66 payloads — 50 rejected, zero scheme bypasses.** The validator is strictly stricter than `window.open`'s own resolution, so there is no parse divergence to exploit.
- `ph-no-capture` traced through the **installed** posthog-js 1.409.0 across autocapture, dead-clicks and session-replay `blockClass`. The suppression claim holds; it is not cargo-culted.
- The meeting URL provably never reaches the DOM.
- The new ignore attribute is not a spoofable surface — no grid card renders event-controlled HTML.

**Conditions, both now applied:**

| ID | Sev | Fix applied |
|---|---|---|
| SEC-01 | Medium | **Destination disclosure restored (D5).** ADR-1's `<button>`-over-`<a href>` choice removed the browser's pre-navigation disclosure — no hover status bar, no copy-link-address — while both `url` and `label` are attacker-settable via an ordinary calendar invite. The accessible name and a new `title` now surface the **host only**, via `new URL(url).hostname` (`hostname`, not `host`, so port and any `user:pass@` prefix are dropped). The path/query — the capability token — is never surfaced. |
| SEC-03 | Low | **Ignore attribute matched by value (D6).** `resolveFromTarget` matched by *presence*, so `data-...="false"` also suppressed interaction. Since React stringifies every `data-*` prop, a future caller spreading a falsy flag would have silently made that card inert. Selector now requires `="true"`, with a regression test. |

## 6. Decisions taken to a human

Nine points were escalated rather than auto-resolved. Two required write-contract amendments; one amendment was granted and one was declined in favour of a follow-up ticket.

| Gate | Decision |
|---|---|
| Gate 1 (requirements) | approved — append-to-existing-test-file; match prior converged layout; button + `window.open`; `bun test:web` |
| Gate 2 (design) | approved — import `VideoCameraIcon` directly (accepted FR-2 deviation); ship the four-handler ADR-5 set, gate merge on manual R-1, **do not** widen into `grid/interaction/*`; ship contrast as bound; keep all 21 tests |
| Diff-preview mini-gate (P3) | approved — candidate written verbatim, 449 insertions, 0 deletions |
| Senior-review blocker gate | approved option (a) — reopen Q-B, take **amendment-1**, add regression test, fix the vacuous T-21 |
| Gate 3 (security) | **approve with conditions** — apply D5 + D6 |
| D1 | **decline** the `isBusy` render guard; **spun into its own follow-up ticket** — no type change this run |
| D2 | defer — do not widen into `event.targeting.ts` |
| D3 | accept as a manual-check addition |
| D4 | accept, with R-1 as backstop |
| D7 | separate ticket |

**On D1 specifically:** the senior reviewer and the security reviewer reached *opposite* recommendations. That disagreement was surfaced to the human rather than silently resolved by picking one, and the human's decision is recorded above.

## 7. The R-1 manual pre-merge check — PERFORMED

**Status: performed 2026-08-22, after the report was first written and relayed.** `design.md` §6.4 deliberately excludes `onPointerDown` from the automated suite because jsdom's `fireEvent.mouseDown` does not dispatch `pointerdown`, so this check could only ever be done in a real browser.

**Who and how.** Performed by the human's operator — **not by the pipeline** — in a real headless-Chromium browser session against `bun run dev:web` with the e2e config (`COMPASS_CONFIG_FILE=e2e/compass.playwright.yaml`), driving the app's built-in demo-data-seed migration event **"Morning standup"** (today, 09:00–09:30 UTC, real `conferenceUrl` `https://meet.google.com/abc-defg-hij`).

| # | Check | Origin | Result |
|---|---|---|---|
| 1 | Click a join icon — exactly one new tab, no event form | B-1 symptom | **PASS** |
| 2 | Press the bottom edge of the join glyph — joins, does not resize | D3 | **INCONCLUSIVE** |
| 3 | Hover the join glyph — host only, never the path/token | D5 | **PASS** |

**1 — B-1 regression check: PASS.** Clicking the join icon opened exactly **one** new tab at the correct URL (`https://meet.google.com/abc-defg-hij`) and did **not** open the event detail form. Total open tabs after the click: **2** (main + the one popup). Confirmed two independent ways — programmatically (the popup event was captured; the form role was checked and found not visible) and visually via screenshot. This is the check the automated suite could not make: the suite asserts the *mechanism* (registry ownership), this asserts the *symptom*. The symptom is gone.

**3 — D5 destination disclosure: PASS.** The join button's `aria-label` and `title` both read exactly `Join Google Meet (meet.google.com)` — host only, no path, no token.

**2 — D3 resize-handle overlap: INCONCLUSIVE — neither pass nor fail.** A click placed 1px above the button's bottom edge missed the button's actual hit target and landed on the card underneath, opening the event form — which is neither a resize nor a join. That is a **precision limit of the automated click**, not new evidence in either direction. It neither confirms nor refutes the overlap.

**D3 therefore stands exactly where Gate 3 left it:** accepted as a manual-check addition, unresolved by code, **not a merge blocker**. It remains the one open manual-check item, carried forward below.

**Net effect on merge:** the two checks that gated merge (B-1 and D5) both **PASS**. Nothing in §7 blocks merge any longer.

## 8. Follow-ups — none block this merge

**D3 — resize-handle overlap, the one open manual-check item.** The timed `endDate` resize handle overlaps the bottom ~2.25px of the 12px join button. The R-1 browser check (§7) attempted this and came back **inconclusive** — the probe click missed the button's hit target entirely — so the overlap is still neither confirmed nor refuted by evidence. Unchanged from the Gate 3 decision: noted, unresolved by code, non-blocking. A human pressing the glyph's bottom edge by hand remains the only way to settle it.

**D1 — make the busy/conference invariant type-enforced rather than emergent.** Evidence gathered this run, preserved so the next engineer need not re-derive it:
- `GridEvent` is declared at `packages/web/src/common/types/web.event.types.ts:47-90`. `isBusy` (line 70) and `conference` (line 88) are **independent optional fields** on a single `z.object(...).extend(...)` — nothing at the type level prevents a producer emitting both.
- Today the invariant holds by convention at every producer: `EventContentSchema`'s busy arm is `z.strictObject({ kind: z.literal("busy") })` with no `conference` member (`packages/core/src/types/event.contracts.ts:38`); `event.view-model.ts:60-61,94` derives `conference` from `details`, undefined when busy; and `grid-event-draft.adapter.ts:294,324` sets `isBusy` but no `conference` at all. **So there is no leak today** — a masked event cannot render a join control.
- Blast radius of a real fix: **96 non-test files** reference `GridEvent`; only **9 non-test sites** read `.conference`. The conference surface is small, but every consumer of a `GridEvent` would need to narrow a new discriminant.
- **A `.refine()` would not satisfy this.** `z.infer` of a refined object is unchanged, so a refine gives *runtime* enforcement while the TypeScript type stays exactly as emergent as it is now. A real fix means restructuring `GridEventSchema` into a discriminated union whose busy arm has no `conference`.

**D2 — `getFocusedGridEventTarget` side effect.** `event.targeting.ts:51` shares `resolveFromTarget`, so it now returns `null` while the join button holds focus, silently no-opping ~10 keyboard-shortcut call sites while `useIsAnyCalendarEventFocused.ts:22` still reports focused. A real side effect introduced by the B-1 fix; a proper fix needs `event.targeting.ts`, outside the allowlist.

**D7 / PRE-01 — pre-existing High, not caused by this delta.** `z.url()` empirically accepts `javascript:`, `data:` and `vbscript:`, and three sinks open `conference.url` unguarded: `EventDetailsSection.tsx:48`, `UpNextCard.tsx:89`, `UpNextBanner.tsx:32` (React 18.3.1 is warn-only for `javascript:` hrefs). **This delta already contains the correct fix pattern to copy** — `isSafeConferenceUrl`. This is the highest-severity item the run surfaced.

**SEC-02 — Low, not one of the approved conditions, so not applied.** `conference.label` (256 chars, provider-controlled) is interpolated into the accessible name behind only a `!label.includes("/")` heuristic. That tests for URL *shape*, not for *secret*, so slash-free capability material such as `Zoom Meeting 812 3456 7890 Passcode 4f2a` still reaches the DOM. A positive allowlist of known provider names was recommended.

**CFG-02 — Info.** `.hook-logs/` is untracked **and** unignored, so `git add -A` would sweep it into a commit.

**T-21 note.** The originally-vacuous T-21 (`createEvent({ isBusy: true })` carried no conference, making it byte-identical to T-2 and pinning nothing) was rewritten during the B-1 round.

## 9. Process integrity

**The write-contract PreToolUse hook was never mechanically registered for this run.** This is an accepted, operator-confirmed risk, and it means the *only* enforcement was manual `git status` after every write. That discipline was applied after all 16 writes, with **zero deviations** — `git status` returned exactly the 7 allowlisted paths every time. Amendment-1's two paths were added to the allowlist *before* they were written, not retroactively.

**A prior security review existed on disk but was invisible to the pipeline.** A complete 552-line `security_review.md` was written at 03:44 — after the B-1 fix and after senior review round 2 — carrying a full `PASS-WITH-CONDITIONS` recommendation. But its **telemetry event was never written** and its `gates` entry never updated, so `state.json` recorded Gate 3 as "not reached" and every downstream reader concluded it had not happened. On resume it was preserved as `security_review_prior_unlogged.md` and a fresh, independent review was run with the reviewer explicitly forbidden from reading it.

That re-run earned its cost: the two passes agreed on the verdict but **disagreed on D1**, and the fresh pass additionally surfaced SEC-03, PRE-01 and CFG-02. **Root cause to fix in the pipeline: the artifact write and the telemetry/gate write are not atomic.**

**A related bookkeeping drift:** the pre-crash `state.json` claimed 17 telemetry events when only 16 were on disk. The recorded cost total was nonetheless correct, being the sum of those 16.

**Both reviewer subagents reported `Glob`/`Grep` missing** from their tool surface and fell back to `Bash` for all enumeration, citing each command inline. Checks that could not run — notably `npm audit --omit=dev`, which fails `ENOLOCK` in this bun repo — are reported as **unverified**, never as passes.

## 10. Cost and telemetry

19 telemetry events, `provenance: "estimated"` throughout — token counts are heuristic (≈3.8 chars/token), priced from the `opus-only-v5` policy's `pricing` block ($5/M input, $25/M output). **These are estimates, not vendor-reported figures.**

| Phase | Events | Est. cost |
|---|---|---|
| requirements_analysis | 1 | $0.2035 |
| architecture_design | 1 | $0.8628 |
| plan_task_packets | 1 | $0.2350 |
| codegen | 6 | $0.7450 |
| tests | 2 | $0.4500 |
| debug | 4 | $0.1487 |
| senior_code_review | 2 | $1.5337 |
| security_review | 1 | $0.7535 |
| generate_final_report | 1 | $0.3925 |
| **Total** | **19** | **$5.3247** |

Against a `hard_cost_cap_usd` of 50. Senior code review was the single largest line item at $1.53 across two rounds — and it is the line item that caught B-1, without which the feature would have shipped broken.

## 11. Recovery

Nothing is committed. Provenance for all 7 touched paths is in `provenance.json`, with backups of uncommitted originals in `backups/`. To restore the pre-run state: `/mmo:revert 20260822-062945-feature-extend-one-click-join`.

---

## Gate 4 — RESOLVED: approved

**Recorded 2026-08-22T18:06Z. Response: `approve` — plain and unconditional, no conditions attached.**

The delta is code-complete and green on all three verification commands. The R-1 manual check in §7, outstanding when this report was first relayed, has since been **performed by the human's operator in a real browser**: the B-1 symptom check and the D5 disclosure check both **PASS**, and the D3 bottom-edge probe was **inconclusive** for reasons of click precision, leaving D3 exactly as Gate 3 already decided it — a noted manual-check item, not a merge blocker.

**Nothing blocks merge.** The run is closed as `complete`.

**What is deliberately NOT done:** nothing is committed or pushed. The 7-path delta remains as uncommitted working-tree changes for the human to review and commit. Close-out touched `.sdlc/` bookkeeping and the ledger only.
