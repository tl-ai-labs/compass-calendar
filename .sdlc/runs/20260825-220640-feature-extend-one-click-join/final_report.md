# Final Report — CMP-103 · One-click join icon on grid event cards

| | |
|---|---|
| **Run** | `20260825-220640-feature-extend-one-click-join` |
| **Mode / intent** | brownfield · `feature-extend` |
| **Policy** | `opus-plus-sonnet` (v1) — direct `claude-opus-5`, mechanical `claude-sonnet-5`, both via claude-cli |
| **auth_mode** | `estimated` |
| **Branch** | `CMP-103/opus-plus-sonnet` @ `2d81253a` |
| **Commits** | **0** — nothing committed, staged, stashed, or checked out |
| **A/B arm** | 4 of 4, independent re-implementation (no prior arm read, merged or cherry-picked) |

---

## 1. Outcome

Delivered. An event carrying a conference URL now renders a one-click join link on both the
timed and all-day grid cards, in the Week and Day views, without selecting, opening or dragging
the event underneath, and reachable by keyboard.

**9 files changed** (1 new, 8 edited). The run began with a frozen 4-file allowlist and widened
twice, each time at a gate, each time for a reason discovered by verification rather than assumed
at planning time:

| Stage | Files | Why |
|---|---|---|
| Gate 0 (inherited) | 4 | the two cards, a new shared component, the card test file |
| Gate 2 (option A) | 7 | finding V-1 — the affordance cannot defend itself against the pointer-capture layer; the interaction layer needed a recognition-based opt-out |
| Gate 3 | 9 | finding R-5 — no adapter-level test pinned that opt-out |

### Files

| File | Kind |
|---|---|
| `packages/web/src/grid/components/EventJoinIcon.tsx` | new |
| `packages/web/src/grid/components/TimedEventCard.tsx` | edit |
| `packages/web/src/grid/components/AllDayEventCard.tsx` | edit |
| `packages/web/src/grid/components/EventCard.test.tsx` | edit |
| `packages/web/src/grid/interaction/dom.ts` | edit |
| `packages/web/src/views/Week/interaction/adapter/week-interaction.adapter.ts` | edit |
| `packages/web/src/views/Day/interaction/adapter/day-interaction.adapter.ts` | edit |
| `packages/web/src/views/Week/interaction/adapter/week-interaction.timed-drag.test.ts` | edit |
| `packages/web/src/views/Day/interaction/adapter/day-interaction.adapter.test.ts` | edit |

---

## 2. Verification — all observed, none relayed

| Check | Result |
|---|---|
| `bun test:web` (final) | **2331 pass / 0 fail / 302 files** |
| `bun test:web` (pre-change baseline) | 2298 pass / 0 fail / 302 files |
| Delta | **+33 tests**, 0 regressions |
| Focused probe (EventCard + AllDayGridRow + calendarCardIdentity) | 30 → **57 pass / 0 fail** |
| Adapter probe (week timed-drag + day adapter) | 28 → **34 pass / 0 fail** |
| `bunx biome check` (9 files) | clean |
| `check-semantic-colors.ts` | clean |
| `tsconfig.app.json --noEmit` | exit 0 |
| `tsconfig.test.json --noEmit` | exit 0 |
| `bun.lock` | untouched (verified after `bunx` printed "Saved lockfile" — that was its own temp install) |
| `git status` | exactly the 9 expected source paths, nothing else |

**Mutation-tested, per the Gate 3 bar.** The adapter tests were proven to fail under
bail-deletion rather than assumed to:

- Week: removed `isInteractiveAffordanceTarget` from `getInteractionTarget` → **2 fail / 15 pass**
  (`declines to own…inside a card`, `…nested inside an interactive affordance`); the negative
  control kept passing. Bail restored, re-verified present at `week-interaction.adapter.ts:491`.
- Day: same procedure → **2 fail / 15 pass**. Restored, re-verified at
  `day-interaction.adapter.ts:442`.

Pre-existing React `act(...)` warnings from `TimedEventCardBase` / `AllDayEventCardBase` are
unchanged noise, confirmed present before the change.

---

## 3. What this run found that the brief did not contain

Three findings drove the design; none came from the intent brief, and none from the prior arms.

### V-1 — the approved design could not have worked (found before writing any code)

The architect correctly sensed a second interaction layer but described it as a *native*
ancestor `pointerdown` listener, and proposed target-phase native listeners on the anchor.
Verification against source refuted the mechanism: there is no native `pointerdown` listener in
the grid. The layer is `PointerCaptureBoundary.tsx:107` — a React **capture-phase**
`onPointerDownCapture` on a wrapper around both grids (`WeekInteractionCoordinator.tsx:193`,
`DayInteractionCoordinator.tsx:117`) — which resolves the card from any descendant via
`closest()` and then calls `preventDefault()` + `stopPropagation()` (`:193-201`).

Capture precedes the target phase, so **nothing bound on the link can run first**. The fix had
to be recognition-based, mirroring how resize handles already escape: a new
`EVENT_INTERACTIVE_ATTRIBUTE` in `dom.ts`, honored by both adapters.

Critically, unit tests would not have caught this — `EventCard.test.tsx` renders the cards with
no boundary above them, so every planned test would have passed green while plain-click join was
dead in both shipping views.

### R-5 — the same trap, one level down (found by senior review)

The first implementation placed the bail in the two *drag*-target functions only. That worked
**by markup luck**: the anchor happens to be a sibling of the resize handles, not a descendant.
Moved to the top of `getInteractionTarget` in both adapters (net −2 lines, covers all four
target kinds), and now pinned by mutation-tested adapter specs.

### SEC-01 — the affordance disclosed no destination (found by security review)

Both the event title and `conference.label` are attacker-controlled — they come from a calendar
invite, which anyone who knows the user's address can create. A bare "Join Standup via Google
Meet" could point anywhere, and this change exists specifically to make that click natural. The
destination host is now surfaced in both the tooltip and the accessible name.

---

## 4. Security

`security_review.md` rates the change **LOW-to-MEDIUM** overall and notes it is better defended
than the code around it. Applied in this run:

| ID | Severity | Resolution |
|---|---|---|
| SEC-01 | Medium (CWE-451) | destination host in `title` and accessible name |
| SEC-02 | Low–Medium (CWE-200) | `ph-no-capture` on the link, keeping meeting URLs out of PostHog autocapture |
| SEC-03 | Low (CWE-319) | scheme allowlist narrowed to **https-only** |
| SEC-04 | Info (CWE-1287) | gate returns the re-serialized `parsed.href`, so the validated value is the navigated value |

The scheme gate was validated by execution, not inspection: `ConferenceSchema.safeParse` accepts
`javascript:`, `data:`, `vbscript:`, `blob:` and `filesystem:` exactly as readily as a real Meet
URL, because `z.url()` does not constrain scheme. The gate is pinned by a corpus test covering
case-mangling (`JaVaScRiPt:`) and leading whitespace, so a future rewrite to a `startsWith`
denylist cannot pass while reopening the hole.

**User-visible consequence of SEC-03 (accepted trade-off, not purely a security win):** an event
whose conference URL is plain `http` — self-hosted or internal conferencing — renders **no join
icon at all** rather than a broken one. Users on such setups lose the affordance entirely and get
no explanation in the UI.

---

## 5. Known deviations, ratified at Gate 3

- **R-1 — a11y, documented not fixed.** The link is a focusable descendant of a `role="button"`
  card. axe's `nested-interactive` rule flags this (impact serious, `wcag2a`, inside this repo's
  scanned tag set), so AT is not guaranteed to expose the link. The e2e a11y gate is green only
  because no fixture seeds a `conference`. Per the Gate 3 decision the fixture was **deliberately
  not seeded** — turning the suite red for something this run cannot fix would leave a red gate
  and no signal. An in-code `KNOWN A11Y DEVIATION` note records the tension and names the real
  fix (a `grid`/`gridcell` restructure).
- **R-10 — Space activates the link.** Deviates from the approved `change_plan`, which kept
  Space native. Anchors do not activate on Space, and the link sits inside something announced as
  a button, so stopping Space without activating would be a silent no-op.
- **SEC-03 — https-only.** See §4.
- **R-6 — accepted.** A ~12×2.25px sliver of the timed card's bottom-right `endDate` resize
  strip is shadowed by the link. AC-10 holds across the rest of the card.
- **R-7 — no size gate,** deliberately, with a comment: the repeat icon hides on narrow cards
  because it is decorative; a functional affordance that vanishes by size is silently unreliable.

---

## 6. Open follow-ups — RECORDED, NOT FILED

**None of these have been filed in any tracker.** They are recorded here and in the ledger row
for the user to file or discard. This project already carries one unfiled follow-up from the
CMP-104 run, so treat this list as pending work with no ticket behind it.

1. **a11y restructure (R-1)** — move the card root off `role="button"` to a `grid`/`gridcell`
   pattern, then seed a conference into the e2e a11y fixture. Until both happen, the a11y gate
   does not cover this affordance.
2. **Unguarded `conference.url` sinks elsewhere** — `UpNextCard.tsx`, `EventDetailsSection.tsx`
   and `UpNextBanner.tsx` all render the same third-party field with **no scheme guard**. The new
   `getJoinableConference` makes the asymmetry obvious and is a one-line fix at each site.
3. **No CSP on the SPA document** — `helmet()` covers only the API; the web document sets only
   `Content-Type`. Every client-side scheme decision stands alone with no `script-src` backstop.
4. **PostHog autocapture config** — `mask_all_element_attributes` is `false` and
   `element_attribute_ignorelist` is unset. This run opted out only its own link.
5. **`http`-only conferencing** — if internal/self-hosted meetings matter, SEC-03 needs a
   configurable host/scheme allowlist rather than a hard https rule (see §4).

---

## 7. Defect in this run's own record (report, don't paper over)

**`provenance.json` misrecords `EventJoinIcon.tsx`, and `/mmo:revert` would restore it wrongly.**

The file is new, so its first `--before` entry should read `existed_before: false` with no
backup. It instead reads `existed_before: true` with a backup, and the backup on disk
(timestamped 23:34, containing `getJoinableConference` but not `ph-no-capture`) is the
**post-senior-review intermediate version**, not the pre-run state.

Cause: the file was legitimately written in three rounds (codegen → senior-review refinement →
security remediation). Each `--before` call wrote to the same per-file backup path and stamped
`existed_before` from the moment of that call, so later rounds overwrote the pre-run observation.
`dom.ts` has the same duplication, but it is git-tracked so git can restore it correctly
regardless; `EventJoinIcon.tsx` is untracked, making the backup the only recovery path.

**Manual remedy if this run is reverted:** delete `packages/web/src/grid/components/EventJoinIcon.tsx`
rather than restoring it from `backups/`. The other 8 files are tracked and revert correctly from
`git_head_before` = `2d81253a`.

This looks like a plugin-level gap in `write-provenance.mjs` (multi-round edits break the pre-run
guarantee), not a one-off. Worth a process note.

---

## 8. Cost

**Total $6.36** across 16 telemetry events.

| Phase | USD |
|---|---|
| requirements_analysis | 0.2434 |
| change_plan | 1.1269 |
| plan_task_packets | 0.4447 |
| codegen | 1.9805 |
| tests | 1.1043 |
| senior_code_review | 0.8623 |
| security_review | 0.6003 |

| Tier | USD |
|---|---|
| `claude-opus-5` (direct) | 4.2126 |
| `claude-sonnet-5` (mechanical) | 2.1498 |

Provenance split: 9 estimated (direct tier, in-session), 7 vendor (mechanical tier, via MCP).

**These numbers are not comparable across A/B arms.** Direct-tier events are char-count estimates
booking `cached=0`; mechanical-tier events carry vendor-reported tokens including large cache
hits. Ranking policies on this figure is invalid. Note also that this arm did strictly more work
than the others — 9 files versus 4, plus two mid-run scope widenings driven by defects the other
arms' briefs did not surface — so a raw cost comparison would be misleading even if the units
matched.

---

## 9. Process notes

- **PN-1-recurrence-2 did not recur.** Every file mutation went through the hook-governed
  `Write`/`Edit` tools. A session-level instruction to prefer Bash (`sed`, heredocs) for file
  changes was active throughout and was declined for mutations, since the write-contract hook
  matches only on `Write|Edit` and a heredoc bypasses it silently. Bash was used freely for reads,
  tests, lint and type-checks. **No write was blocked at any point in the run**, so the
  halt-and-surface path was never exercised.
- **The write contract held.** All 9 changed paths were inside the allowlist at the time they
  were written; the contract was widened only by the user, at gates, never by this agent.
- **Gates 1–3 were all relayed verbatim and answered by the user.** No gate was self-answered.
- **The A/B stayed clean.** No prior arm's source, diff or parking directory was read. Where a
  finding overlapped a disclosed prior-arm result (the scheme guard), the overlap is recorded in
  `change_plan.verification.md` §V-2 along with the fact that the architect derived it without
  access to that disclosure — and that it surfaced here in *design* rather than in security
  review, which is itself a reportable difference between arms.

---

## 10. Artifacts

All under `.sdlc/runs/20260825-220640-feature-extend-one-click-join/`:

`intent_brief.md` · `requirements.md` · `change_plan.md` · `change_plan.verification.md` ·
`packets.json` · `review.md` · `security_review.md` · `manifest.json` · `telemetry.jsonl` ·
`provenance.json` · `orchestrator.log` · `final_report.md`
