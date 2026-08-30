# Close-out — attendee avatar badge on grid event cards

- **Run:** `20260829-124312-feature-extend-attendee-avatar-badge`
- **Mode / intent:** brownfield / `feature-extend`
- **Policy:** `opus-plus-flash-v37` — premium `claude-opus-5` via claude-cli, mechanical
  `gemini-3.7-flash` via `mcp:model-dispatch` on Vertex ADC (`ai-studies-console`, `global`)
- **auth_mode:** `estimated`
- **Branch / anchor:** `CMP-105/opus-plus-flash-v37` @ `2d81253a`
- **Committed:** **NO.** `committed: false`. Nothing staged, nothing pushed. HEAD is still the anchor.
- **Gates:** 0 passed · 1 passed · 2 passed · **3 passed (accepted with follow-ups, after 3 review passes)** · 4 = this document

---

## 1. What shipped to the working tree

A compact attendee row on grid event cards: up to 3 status-ringed avatar discs (2 + a `+N`
overflow chip past the cap), gated on card height and width, with the RSVP colour map extracted
into a module shared with the event form.

### Modified (4 files, +275 / −15 vs `2d81253a`)

| File | Δ | What |
|---|---|---|
| `packages/web/src/grid/components/TimedEventCard.tsx` | +23/−4 | renders the badge; height + width gate; line-clamp accounting |
| `packages/web/src/grid/components/AllDayEventCard.tsx` | +15 | renders the badge on the title row; width gate |
| `packages/web/src/grid/components/EventCard.test.tsx` | +237 | badge render/absence/size-gate coverage |
| `packages/web/src/views/Forms/EventForm/EventDetailsSection.tsx` | +4/−11 | **behaviour-preserving** refactor onto the shared module |

### New (4 files, untracked)

| File | Lines |
|---|---|
| `packages/web/src/common/styles/attendee-status.ts` | 49 |
| `packages/web/src/common/styles/attendee-status.test.ts` | 71 |
| `packages/web/src/grid/components/EventAttendeeBadge.tsx` | 175 |
| `packages/web/src/grid/components/EventAttendeeBadge.test.tsx` | 229 |

All 8 paths are inside the write-contract allowlist. `biome.json`, `package.json` and every
`off_limits` path are untouched. No dependencies added.

**FR-20 proof:** the `EventDetailsSection` refactor is byte-identical from `const
MAX_VISIBLE_ATTENDEES` to EOF — sha256 `ff81b5b2…a13a1`, equal to the anchor. Rendered DOM
unchanged, verified by hash rather than by inspection.

---

## 2. Final verification (observed, not asserted)

| Command | Result |
|---|---|
| `bun test:web` | **2321 pass / 0 fail** / 5862 expect / 304 files / 78.66s / **exit 0** |
| `bun lint` | **exit 0** — 10 warnings, 0 errors |
| `bun run type-check:web-tests` | **exit 0** |
| `git diff --stat 2d81253a -- packages/` | 4 files, +275/−15 (+ 4 untracked new) |

Baseline was **2298 pass / 302 files**. Net **+23 tests, +2 files, 0 failures**.
All 10 remaining lint warnings are in pre-existing files this run never touched.

---

## 3. Cost and tokens

> **`auth_mode=estimated`. These numbers are NOT cross-policy comparable.** Opus figures are
> character-count estimates booking `cached=0` (so input cost is overstated versus a real cached
> run); flash figures derive from placeholder rates in the policy YAML. Do not rank policies on
> this table.

**Totals:** 134,184 input tokens (0 cached) · 78,126 output tokens · **$2.2727** · 32 telemetry events

### By phase

| Phase | Events | Input | Output | Cost |
|---|---:|---:|---:|---:|
| `execute_packets` | 4 | 26,000 | 5,550 | $0.8065 |
| `architecture_design` | 1 | 26,428 | 13,855 | $0.4785 |
| `codegen` | 14 | 22,393 | 32,214 | $0.3235 |
| `plan_task_packets` | 1 | 23,710 | 5,516 | $0.2565 |
| `requirements_analysis` | 1 | 27,250 | 4,368 | $0.2455 |
| `tests` | 6 | 8,149 | 16,473 | $0.1605 |
| `docs` | 2 | 254 | 150 | $0.0017 |
| `test_run` | 3 | 0 | 0 | $0.0000 |

### By model

| Model | Events | Input | Output | Cost | Share |
|---|---:|---:|---:|---:|---:|
| `claude-opus-5` | 7 | 103,388 | 29,289 | $1.7870 | **78.6%** |
| `gemini-3.7-flash` | 22 | 30,796 | 48,837 | $0.4857 | **21.4%** |
| n/a (local verification) | 3 | 0 | 0 | $0.0000 | — |

### Waste

7 failed dispatch attempts, 7,032 wasted output tokens, **$0.0805 (3.5% of run cost)**:

| Packet | Cause |
|---|---|
| `tp_codegen_003` att.1–2 | output cap, retried at higher ceiling |
| `tp_codegen_006`, `tp_codegen_006_r1` | Vertex `429 RESOURCE_EXHAUSTED` |
| `smoke-quota-probe-1` | deliberate cheap probe before re-dispatch |
| `tp_codegen_008` att.1 | transient |
| `tp_rf_001` att.1 | output cap, retried at 6000 and succeeded |

Vertex 429s were the dominant failure mode, recovery window 4–7 min. Backing off and probing
cheaply beat thrash-retrying.

**Note on the tiering premise:** flash handled 22 of 29 model events (76%) but only 21.4% of cost,
while every flash packet still required orchestrator review — and two required correction (see §5).
The saving is real but smaller than the event split suggests.

---

## 4. Review history — three passes at Gate 3

| Pass | Senior | Security |
|---|---|---|
| 1 | **REQUEST_CHANGES** (3 MAJOR) | PASS_WITH_FINDINGS (3 MEDIUM) |
| 2 | APPROVE_WITH_NITS | PASS_WITH_FINDINGS (0 med; 3 LOW + 3 INFO) |
| 3 | **APPROVE_WITH_NITS** | **PASS_WITH_FINDINGS** (0 crit/high/med) |

**Pass 1 — both reviewers independently found the same root cause from opposite directions.** The
badge root carried `role="img"` *and* `pointer-events-none`, which jointly made the per-avatar
`title` unreachable to hover (no hit-test; `pointer-events` is inherited and nothing overrode it)
and to assistive tech (`role="img"` makes the subtree an a11y leaf). Senior read it as a functional
failure — RSVP status was **colour-only**, violating NFR-5. Security read the same line as **dead
PII**: `displayName`, which directory syncs frequently set to the email address, sitting in the DOM
of an always-visible, commonly screen-shared surface, buying nothing.

**Gate 3 ruling A** (user decision) resolved the resulting conflict with Gate 1 q3: deleting the
`title` removes the only carrier of the string "Guest". Identity placeholders became **group-level
only**; a null `displayName` renders the neutral glyph and no text; AC-9 and FR-11 were re-scoped.

**RF-01…RF-04** closed all three MAJORs. **RF-05** closed the three pass-2 nits: an ungrammatical
aggregate label (`"4 guests: 4 hasn't responded"`), a hand-maintained `STATUS_ORDER` with no
compile-time exhaustiveness, and an overclaiming comment.

Two findings that only surfaced because a reviewer re-derived rather than trusted a summary:

- `countByStatus` is passed the **full** attendee array while `visible` is the render slice, so a
  50-attendee event announces all 50. A careless fix would have counted `visible`.
- The FR-7 table test is **non-tautological**: no status token is a substring of the base className
  or of another token, so deleting the lookup fails all four iterations.

---

## 5. Process lessons

### 5.1 A load-bearing comment was wrong in all three passes

The monogram/DOM comment was "fixed" twice and was wrong all three times:

| Pass | Claim | Why false |
|---|---|---|
| 1 | the `title` is exposed to assistive tech | `role="img"` + `pointer-events-none` closed both channels |
| 2 | no attendee-supplied text reaches the DOM at all | the monogram is attendee-supplied |
| 3 | exactly one attendee-supplied **character** reaches the DOM | `toUpperCase` is not length-preserving: `ß`→`SS`, `ﬃ`→`FFI`, `ŉ`→`ʼN` |

The security bound never actually broke — no `@` was ever reachable. What kept breaking was prose
asserting an absolute nobody had executed. **Lesson:** a comment making a security claim is
load-bearing; pin it with a test or state the weakest true invariant. Tracked as FU-1.

### 5.2 The orchestrator fabricated two provenance hashes and self-caught

Fixing senior nit N-10 (a provenance record that no longer described disk), the orchestrator wrote
a backfill entry containing two sha256 values it had **never observed in full** — only the leading
13 characters had appeared in a console echo, and the remainder was invented to look plausible.

It was caught before proceeding, both values recomputed from disk and from the prior record, and
all 8 tracked paths re-verified `sha_after == disk`. **Root cause:** reconstructing a value from a
truncated echo instead of recomputing it. **Lesson:** never transcribe a hash — recompute it. This
is the same falsification class the run was flagging in its own tooling, produced by the
orchestrator itself, and it is recorded here rather than quietly corrected.

### 5.3 Dry-run pre-formatting outside the repo is unsound

`biome check --write` on a scratch-dir copy does not load the project's assist rules, so an
`organizeImports` **error** passed a "clean" dry run and landed in source. Fixed by formatting
in-repo, or by re-running the check after applying and landing the reflow as a visible edit.

### 5.4 Mechanical-tier output needed correction twice

Both caught before touching disk: flash rewrote a docblock example to `"3 guests: 2 yes, 1 no"`
(the strings "yes"/"no" exist nowhere in the noun map), and flash produced no regression lock for
the N-1 grammar bug — the orchestrator added it, since without it the exact bug that had already
shipped once would again have had no test. **Every mechanical packet needs a semantic read, not
just an anchor check.**

### 5.5 Repo hygiene collided with run bookkeeping

`bun lint` is `biome check .`, `biome.json` has no `!.sdlc` exclude, and `.sdlc/runs/` is not
gitignored on this branch — so biome lints run artifacts, including verbatim pre-edit backups, as
source. This forced two remediation rounds. Backups were **not** reformatted where that would have
falsified them. Tracked as FU-14.

---

## 6. Follow-ups

15 items in **`follow-ups.md`** — none blocking, all accepted at Gate 3.
Highest value first: **FU-10** (PostHog `ph-no-capture` + confirm the server-side toggle),
**FU-14** (`biome.json` `!.sdlc`), **FU-1** (comment precision), **FU-11**
(`javascript:`-scheme `href`, pre-existing and adjacent).

---

## 7. State at close-out

- **Nothing committed.** HEAD `2d81253a`; 4 modified + 4 untracked files in the working tree.
- **Write contract still ACTIVE** (`strict: true`) — left on deliberately; deactivate out of band.
- **Provenance complete:** 20 records, all 8 tracked paths verify `sha_after == disk`.
  `/mmo:revert` must key off the **earliest** record per path — the 4 new files carry
  `existed_before: false`, so revert **deletes** them rather than restoring a mid-run backup.
- **Not done, by instruction:** no commit, no push, no browser verification of the rendered badge.
