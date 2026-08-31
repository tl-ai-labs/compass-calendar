# Senior Code Review — `20260830-164154-feature-extend-one-click-join`

- **Reviewer:** senior-code-reviewer (brownfield, `feature-extend`)
- **Scope:** exactly the six files in `packages/web/src/grid/components/` named in
  `provenance.json`. Nothing else in the repo was reviewed for smells.
- **Anchor:** `2d81253a` · branch `CMP-105/opus-plus-flash-v37`
- **Date:** 2026-08-30

---

## 1. Verdict

### `request changes`

One blocker (R-1) and two majors (R-2, R-3).

The suite is green and `type-check` is clean, and I re-ran both myself — but the green suite is
**not** evidence that the feature works. The central behavioural claim of this change (FR-5 /
AC-4 / AC-5: "activating the join control does not select or drag the card") is proven only by
unit tests that render `TimedEventCard` / `AllDayEventCard` **standalone**, outside the
`PointerCaptureBoundary` that wraps every card in the real Week and Day views, and that fire
`mouseDown`/`click` but never `pointerDown`. I traced the production pointer path through source
and it goes the other way: the boundary's **capture-phase** `onPointerDownCapture` runs before
the button's bubble-phase handlers, resolves the card as the drag target via a bare `closest()`
walk that has no opt-out for nested interactive controls, starts an interaction session, and
calls `preventDefault()` + `stopPropagation()` on the pointerdown. That is R-1, and it is not
fixable inside the frozen write-contract allowlist — it needs an orchestrator escalation, not
just a refinement packet.

Everything else is real but ordinary: the run leaves `bun lint` failing where it was previously
clean, and it introduces three `as any` casts that the parameter type does not require.

Two things I want to say plainly, because they are to the implementation's credit: the
`right-1` selector-collision invariant (ADR-4) is **correctly and verifiably** implemented, and
the repeat icon's own behaviour is **bit-for-bit unchanged** in all four icon states. Both were
specifically called out for scrutiny; both hold. See §2.

---

## 2. What I verified

Split honestly into *executed* and *reasoned*.

### 2.1 Commands I actually ran

| # | Command | Result |
|---|---|---|
| V-1 | `git status --porcelain -- packages/web/src/grid/components/` | 3 modified (`AllDayEventCard.tsx`, `EventCard.test.tsx`, `TimedEventCard.tsx`), 3 untracked (`EventJoinIcon.tsx`, `event-join-url.util.ts`, `event-join-url.util.test.ts`). Matches `provenance.json` exactly — six files, no more. |
| V-2 | `git diff -- packages/web/src/grid/components/` | Read in full. Card deltas match change_plan §6/§7 line for line. |
| V-3 | `bun test src/grid/components/EventCard.test.tsx src/grid/components/event-join-url.util.test.ts` (from `packages/web`) | **49 pass / 0 fail**, 109 `expect()` calls, 3.22s. 33 in `EventCard.test.tsx` (20 pre-existing + 13 new) + 16 in the new util test = the reported **+29 / +1 file** delta. Confirmed. |
| V-4 | `bun run type-check` (all three tsc passes) | **exit 0**. Confirmed. |
| V-5 | `npx biome check <the six files>` | **exit 1 — 5 errors, 5 warnings.** |
| V-6 | `git stash push -u -- packages/web/src/grid/components/` → `npx biome check packages/web/src/grid/components/` → `git stash pop` | **Baseline exit 0**, 13 files, zero diagnostics. So every one of the 10 diagnostics in V-5 was introduced by this run. Working tree restored and re-verified against `git status`. |
| V-7 | `npx biome check --reporter=summary packages/web/src/grid/components/` | 4× `assist/source/organizeImports` (errors), 1× formatter (error), 3× `lint/suspicious/noExplicitAny`, 1× `lint/nursery/useSortedClasses`, 1× `lint/a11y/noStaticElementInteractions`. |
| V-8 | `bun packages/scripts/src/testing/check-semantic-colors.ts` | exit 0 — the first half of `bun lint` passes; it is `biome check .` that fails. |
| V-9 | Tailwind 4.1.14 CLI compile of a probe containing `right-4.5 pr-7 bottom-0.5 rounded-xs h-2.5 w-2.5 focus-visible:outline-1 focus-visible:outline-offset-0 focus-visible:outline-(--event-focus-color) pr-3.5`, run from inside `packages/web` so it resolves the real `tailwindcss` | **All classes emit real CSS.** Grep of the output found `.right-4\.5` (line 293), `.bottom-0\.5` (311), `.pr-3\.5` (1207), `.pr-7` (1213), `.focus-visible\:outline-offset-0` (2075), `.focus-visible\:outline-\(--event-focus-color\)` (2085, emitting `outline-color: var(--event-focus-color)`). The probe files were deleted; `git status` confirms the tree is back to the six files. |
| V-10 | Read `packages/web/node_modules/@phosphor-icons/react/dist/lib/IconBase.es.js` | `className` arrives in the rest-prop bag `...x` and is spread **verbatim** onto the `<svg>`, after the `IconContext` spread `...w`. No merge, no append, no prefix. |

### 2.2 Things I read and reasoned about (not executed)

- **The production pointer path** (R-1). Traced statically, not run in a browser:
  `WeekView.tsx:179` → `WeekInteractionCoordinator.tsx:193` → `PointerCaptureBoundary.tsx:107`
  (`onPointerDownCapture`) → `week-interaction.adapter.ts:157` `handlePointerDown` →
  `:483` `getInteractionTarget` → `:548` `getTimedDragTarget` → `:610` `resolveTimedEventTarget`
  → `event.registry.ts:77` `resolveFromTarget` (a bare `target.closest("[data-week-interaction-event-id][data-week-interaction-event-type]")`)
  → `interaction.engine.ts:126` `handlePointerDown` (session becomes `pending`) →
  `PointerCaptureBoundary.tsx:78` `consumeOwnedPointerEvent` → `preventDefault()` +
  `stopPropagation()`. Then on release: `interaction.engine.ts:203` returns `{ type: "click" }`
  → `week-interaction.adapter.ts:207` → `onClickTimedEvent(...)` / `onClickAllDayEvent(...)`.
  I am confident in this trace but it deserves a 60-second browser check — which is exactly the
  manual verification step change_plan §11 R-2 specified and which does not appear to have been
  performed.
- **Focus-ring clipping.** Button is 10px tall at `bottom-0.5` (2px) inside an `overflow-hidden`
  card; `outline-1` at `outline-offset-0` extends 1px, landing 1px inside the card edge. Not
  clipped. Arithmetic only.
- **Drag-clone interaction** (change_plan R-3). `dom.ts:101-130`: the time-label insertion
  searches inside `EVENT_CONTENT_SELECTOR`, and the join button is mounted **outside** that
  wrapper as the card root's last child. The clone carries an inert copy of the button but the
  label logic is unaffected. The plan's claim holds.
- **`Conference` assignability.** `packages/core/src/types/event-attendance.contracts.ts:31-35`
  gives `Conference = { url: string; label: string | null }`;
  `web.event.types.ts:88` makes `GridEvent["conference"]` = `Conference | null | undefined`.
  Basis for R-3.

### 2.3 The three things specifically flagged for scrutiny that came back **clean**

- **The `right-1` invariant (ADR-4) holds, and T-9 genuinely proves it.** V-10 establishes that
  phosphor forwards `className` verbatim, so the join `<svg>`'s class attribute is exactly
  `"pointer-events-none"` — no `right-*` at all. All positioning lives on the `<button>`, which
  is not an `svg` and so cannot match `svg[class*="right-1"]` regardless. The button's own class
  string contains no `right-1` substring (`right-4.5`, and `outline-1` is not `right-1`). The
  four pre-existing repeat assertions still pass (V-3). This was done right.
- **`right-4.5` and `pr-7` are real CSS, not silently-dropped strings** (V-9). The specific
  failure mode I was asked to look for — a test asserting on a class string that Tailwind never
  emits — does not occur here.
- **The repeat icon is bit-for-bit unchanged in all four icon states.** The timed card's
  `showRepeatIcon` predicate is identical modulo the constant rename (values still 15 / 40); the
  all-day card's is identical (value still 60). The only touched repeat-adjacent behaviour is the
  all-day title padding, which went from `"pr-3.5": showRepeatIcon` to
  `"pr-3.5": showRepeatIcon && !showJoinIcon` — and for any event without a joinable conference
  `showJoinIcon` is `false`, so the emitted class is identical. Neither / repeat-only /
  join-only / both all resolve exactly as change_plan §8's table says.

---

## 3. Findings

| ID | Severity | File:line | What | Why it matters |
|---|---|---|---|---|
| **R-1** | **blocker** | `EventJoinIcon.tsx:37-66`; mounts at `TimedEventCard.tsx:372-378`, `AllDayEventCard.tsx:210-216` | `stopPropagation()` on the button's **bubble-phase** React handlers cannot stop `PointerCaptureBoundary`'s **capture-phase** `onPointerDownCapture`, which is registered on an ancestor and therefore fires first. `week-interaction.adapter.ts` resolves the pointer target with a bare `closest()` (`event.registry.ts:77-102`) that has **no opt-out for nested interactive controls**, so a pointerdown on the join button resolves to the enclosing card, starts an interaction session, and `consumeOwnedPointerEvent` calls `preventDefault()` + `stopPropagation()` on the pointerdown — suppressing the button's own `mousedown`/`click` (and its focus). On release, `interaction.engine.ts:203` yields `{ type: "click" }` and `week-interaction.adapter.ts:207` calls `onClickTimedEvent` / `onClickAllDayEvent`. | This is the feature's core promise. FR-5, AC-4 and AC-5's pointer clause are violated **in the running app**: clicking the join glyph most likely opens the event form instead of the meeting, and press-and-drag from the glyph drags the event. The whole point of a nested control with `stopPropagation` is defeated by a listener that runs before it. change_plan §11 R-2 cited the resize handles as "strong evidence [stopPropagation] is sufficient" — that reasoning is **factually wrong**: the resize handles are not protected by `stopPropagation` on the pointer path at all, they are explicitly special-cased by attribute inside the adapter (`getResizeHandleEdge`, `dom.ts:22-39`), which is precisely the mechanism the join button lacks. |
| **R-2** | **major** | `EventJoinIcon.tsx:1-2`; `TimedEventCard.tsx:49-51`; `AllDayEventCard.tsx:30-32`; `event-join-url.util.test.ts:1-2`; `EventCard.test.tsx:733-735` | `bun lint` (`biome check .`) now fails. Four `assist/source/organizeImports` **errors** and one formatter **error**. Verified as a regression: the same directory was exit-0 clean before this run (V-6). | NFR-4 explicitly requires Biome formatting, and `bun lint` is a CI gate. Green tests plus a red linter is exactly the mixed-tier failure mode this phase exists to catch. All five are mechanically fixable with known-exact output. |
| **R-3** | **major** | `event-join-url.util.test.ts:60, 65, 70` | Three `as any` casts, all **gratuitous**. The parameter type is `GridEvent["conference"]` = `Conference \| null \| undefined` where `Conference = { url: string; label: string \| null }`, so `null`, `{ url: rawUrl, label: "x" }` and `{ url: "javascript:alert(1)", label: null }` are all directly assignable with no cast. Each triggers `lint/suspicious/noExplicitAny`. | `as any` on a test's *only* type-safety surface silently disables the check that the guard's signature actually accepts what the cards pass it. Removing the casts turns these into genuine contract assertions at zero cost. Also 3 of the 10 lint diagnostics in R-2's regression. |
| R-4 | minor | `EventJoinIcon.tsx:61` | `lint/nursery/useSortedClasses` warning: `focus-visible:outline-1 focus-visible:outline-offset-0 focus-visible:outline-(--event-focus-color)` should be ordered `focus-visible:outline-(--event-focus-color) focus-visible:outline-1 focus-visible:outline-offset-0`. | Repo convention (Biome nursery rule is configured on at `warn`). Purely cosmetic — no CSS behaviour change. |
| R-5 | minor | `EventCard.test.tsx:722` | The new T-7 wrapper `<div onKeyDown={onParentKeyDown}>` omits the `// biome-ignore lint/a11y/noStaticElementInteractions: test wrapper simulates a parent shortcut listener.` comment that **both** pre-existing instances of the identical pattern carry (lines 240-241 and 411-412). | An established local convention was not followed, producing a new warning. The fix is copying one comment line. |
| R-6 | minor | `EventCard.test.tsx:786` | T-9 asserts `container.querySelectorAll('svg[class*="right-1"]')` has length 1 but never asserts that the one match **is** the repeat glyph. change_plan §9.2 says "and it must be the repeat glyph". If the repeat icon silently stopped rendering *and* a join `svg` gained a `right-1` class, the count would still be 1. | The invariant is correct today (V-10), so this is a robustness gap in the proof, not a live bug. Cheap to close. |
| R-7 | minor | `EventCard.test.tsx:716-740` | The `" "` (Space) branch of `handleKeyDown` (`EventJoinIcon.tsx:51`) is completely untested. T-7 covers Enter only. | ADR-1 consequence (4) says the hand-built keyboard path "is a thing that can regress — T-7 exists specifically to hold that line." Half of it is unheld. Space also has the subtler browser semantics (native activation is on `keyup`), so it is the branch more likely to drift. |
| R-8 | nit | `EventCard.test.tsx:792-830` | T-10 issues three bare `render()` calls inside one `it()`. Testing-library's auto-cleanup is per-**test**, so all three cards coexist in the same `document.body` for the duration of the case. It works only because the three titles ("Repeat only" / "Join only" / "Repeat and join") happen to be distinct under `getByText`'s exact-match default. | Not currently broken — I confirmed cleanup is active (T-8's `toHaveLength(0)` would fail against leaked buttons from T-1 otherwise, and it passes). But it is a latent ambiguity trap: a future title edit that creates a substring/exact collision turns this into a confusing `getByText` multiple-match throw. `rerender` (as used by T-2/T-4/T-8/T-11/T-12/T-13) would be safer. |
| R-9 | nit | `EventCard.test.tsx:769` | T-8's `expect(openMock).not.toHaveBeenCalled()` is vacuous — the preceding assertion establishes there is no button, and nothing in the test ever clicks anything, so `window.open` could not have been called by any code path. | Harmless belt-and-braces (and change_plan §9.2 asked for it), but it reads as stronger evidence for AC-6 than it is. The real AC-6 proof is the render-absence assertion plus the 12 guard cases in `event-join-url.util.test.ts`. |
| R-10 | nit | `EventJoinIcon.tsx:28` | `if (!isJoinableUrl(url)) return null;` before any hook is **correct today** — the component uses no hooks, so there is no rules-of-hooks violation, and Biome's `correctness/useHookAtTopLevel` does not fire. It is fragile to a future `useCallback`/`useMemo` added above it. | Flagged for completeness only, per the review brief's question 8. No action needed now; the four handlers defined after the early return are plain functions, not hooks. |

**`rerender` target check (brief question 5b): clean.** I checked all six `rerender` sites —
T-2 (603), T-4 (641), T-8 (742), T-11 (832), T-12 (858), T-13 (878). Every one re-renders the
*same* component type it originally rendered (`TimedEventCard`→`TimedEventCard`,
`AllDayEventCard`→`AllDayEventCard`). The common silent bug is not present.

**Vacuity check (brief question 5c): clean except R-9.** T-5/T-6 are non-vacuous —
`TimedEventCard.tsx:311-318` and `AllDayEventCard.tsx:176-181` both invoke `onEventMouseDown`
unconditionally when the prop is supplied, so absent the button's `stopPropagation` the mock
would fire. T-7 is non-vacuous for the same reason on the keydown path. T-11's second leg
genuinely exercises the 15-minute duration gate (09:00→09:10); T-12's second leg genuinely
exercises the `isPlaceholder` exclusion. Only R-9 is vacuous.

**Also checked and found clean (no finding):** FR-7 / read-only contract — nothing this run
wrote goes near a mutation payload, and `conference` is only ever read. AC-2's "no reserved
space" — the timed card gained no padding rule at all, and the all-day card's padding is
byte-identical for non-conference events. DRY — the duplicated `showJoinIcon` predicate and
JSX mount across the two cards exactly mirror the existing `showRepeatIcon` /
`EventRepeatIcon` duplication and were mandated by change_plan §6/§7; extracting them would be
a larger refactor than this delta warrants. The 10×10 hit target is noted as accepted debt
(R-5 in the plan) and not re-raised here.

---

## 4. Acceptance-criteria matrix

| AC | Status | Evidence |
|---|---|---|
| **AC-1** — timed card renders a join control with a conference link | **met** | `EventCard.test.tsx:588` passes (V-3). `TimedEventCard.tsx:372-378` mounts `EventJoinIcon` behind `showJoinIcon && joinUrl`. |
| **AC-2** — no join control and no reserved space when `conference` is `undefined`/`null` | **met** | `EventCard.test.tsx:603` covers both (V-3). No padding rule was added to the timed card; `getJoinableConferenceUrl(undefined)` returns `null` at `event-join-url.util.ts:32-33`. |
| **AC-3** — AC-1/AC-2 hold for the all-day card | **met** | `EventCard.test.tsx:627` and `:641` pass. All-day padding for a non-conference event is byte-identical to baseline (§2.3). |
| **AC-4** — click calls `window.open(url, "_blank", "noopener,noreferrer")` and does not invoke `onEventMouseDown` | **NOT MET** | The unit assertion passes (`EventCard.test.tsx:663`, `:690`, exact three-argument match confirmed). But the test renders the card standalone and fires `mouseDown`+`click`, never `pointerDown`. In the app the card sits inside `PointerCaptureBoundary`, whose capture-phase handler fires first, starts a card interaction session, and `preventDefault()`s the pointerdown. See **R-1**. The passing test is a false negative. |
| **AC-5** — Enter opens the link and does not invoke `onEventKeyDown` | **partially met** | The keyboard half is genuinely proven: `EventCard.test.tsx:716` asserts `openMock` called once and both `onEventKeyDown` and `onParentKeyDown` not called; `handleKeyDown` correctly `preventDefault()`s so a real browser's native Enter-activation cannot double-open. The keyboard path is **not** affected by R-1 (that is a pointer-only defect). Two gaps: Space is untested (R-7), and R-1 also suppresses the button's focusability via pointer, so a mouse user cannot easily reach the keyboard path. |
| **AC-6** — `javascript:` URL renders no control and never calls `window.open` | **met** | `EventCard.test.tsx:742` (render-absence for `javascript:` and `data:`) plus 12 direct guard cases in `event-join-url.util.test.ts:4-52` covering `javascript:`/`data:`/`vbscript:`/`file:`/protocol-relative/bare-host/empty/null/undefined. Fail-closed is applied at render in **both** cards (`TimedEventCard.tsx:123-128`, `AllDayEventCard.tsx:80-82`) and again at click time (`EventJoinIcon.tsx:28` and `:33`) — brief question 4 confirmed on all three counts. |
| **AC-7** — both glyphs render, positions differ, `svg[class*="right-1"]` still resolves to exactly the repeat icon | **met** | `EventCard.test.tsx:773` passes, and the four pre-existing repeat assertions (lines 279/307/326/342 and the all-day one at 430) all still pass in V-3. Mechanism verified independently at V-10. Proof could be tightened — see R-6. |
| **AC-8** — join control absent below the width gate and below the duration gate | **met** | `EventCard.test.tsx:832` (timed: width 30, then a 10-minute event at full width) and `:858` (all-day: width 50, then placeholder). Gates unchanged at 40 / 60 per binding decision 2. |
| **AC-9** — accessible name `Join Google Meet` / `Join meeting` | **met** | `EventJoinIcon.tsx:30` (`label ? \`Join ${label}\` : "Join meeting"`), pinned by `EventCard.test.tsx:878` for both branches. Note the implementation uses truthiness rather than `??`, so an empty-string label falls back to "Join meeting" — arguably better than `EventDetailsSection`'s `??`, and unreachable anyway since `ConferenceSchema` requires `min(1)` when non-null. |
| **AC-10** — `bun test:web` passes with no new failures | **met** | V-3: 49/49 on the two affected files, +29 tests / +1 file over baseline exactly as reported. I did not re-run the full 2327-test suite; the two changed files are the only ones this run touched and the card components' pre-existing 20 cases all still pass. |
| **AC-11** — `bun type-check` passes | **met** | V-4, exit 0, all three tsc invocations. |
| **AC-12** — `git diff --name-only` lists only `packages/web/src/grid/components/` | **met** | V-1 plus `provenance.json`: exactly the six files, all inside the allowlist. (`.sdlc/**` bookkeeping files are also dirty, but those are orchestrator artifacts, not source, and are outside this review's scope.) |

**Not verifiable here:** AC-4's real-browser behaviour, which is the crux of R-1. change_plan
§11 R-2 already specified the exact manual check ("in the running app, mouse-down on the join
icon and drag — the event must not move and must not become selected"). It must be performed
before this ships, and I expect it to fail.

---

## 5. Refinement TaskPackets

### TP-R1 — escalation, not a mechanical packet (blocker R-1)

> **This one cannot be dispatched to a mechanical worker, and it cannot be fixed inside the
> write-contract allowlist.** Flagged for the orchestrator / user rather than packetised.

The fix must teach the interaction adapters to ignore pointerdowns that originate inside a
nested interactive control. The natural implementation mirrors the existing resize-handle
opt-out: add an `EVENT_INTERACTION_IGNORE_ATTRIBUTE` next to `EVENT_RESIZE_HANDLE_ATTRIBUTE` in
`packages/web/src/grid/interaction/dom.ts`, have `getInteractionTarget` in
`packages/web/src/views/Week/interaction/adapter/week-interaction.adapter.ts:483` (and the Day
equivalent at `day-interaction.adapter.ts:434`) return `null` when
`event.target.closest("[data-calendar-event-interaction-ignore]")` matches, and set that
attribute on the join button. **Only the last of those four files is inside the allowlist**
(`packages/web/src/grid/components/**`); the other three are in `packages/web/src/grid/interaction/**`
and `packages/web/src/views/**`, which Gate 0 froze.

Required decision from the user, one of:
1. **Widen the write-contract** to include `packages/web/src/grid/interaction/dom.ts` and the two
   adapters, and dispatch the fix to a premium tier (it touches shared drag/resize routing that
   the whole grid depends on — not mechanical-tier work).
2. **Descope** the pointer affordance for this run: keep the keyboard path (which works),
   and file the pointer isolation as a follow-up ticket. Materially reduces the feature's value.
3. **Accept and ship** with the defect recorded. Not recommended — the control would appear to
   work and instead open the wrong thing.

Whichever is chosen, a regression test must render a card inside a real `PointerCaptureBoundary`
and fire `pointerDown` (not `mouseDown`), because the current test shape structurally cannot
catch this class of bug.

---

### TP-R2 — `lint_fix` (major R-2)

```yaml
task_type: lint_fix
artifact_path: packages/web/src/grid/components/
```

**Instruction.** Fix five Biome errors so `npx biome check packages/web/src/grid/components/`
exits 0. Do not change any runtime behaviour, class strings, assertions or test titles. Apply
exactly these edits and nothing else:

1. `packages/web/src/grid/components/EventJoinIcon.tsx` — swap the first two import lines so
   the package import precedes the `react` import:
   ```ts
   import { VideoCameraIcon } from "@phosphor-icons/react";
   import { type KeyboardEvent, type MouseEvent, type PointerEvent } from "react";
   ```
   (lines 3-5, `@web/...` and `./event-join-url.util`, stay exactly as they are.)
2. `packages/web/src/grid/components/TimedEventCard.tsx` — reorder the three trailing relative
   imports (currently lines 49-51) to:
   ```ts
   import { EventJoinIcon } from "./EventJoinIcon";
   import { EventRepeatIcon } from "./EventRepeatIcon";
   import { getJoinableConferenceUrl } from "./event-join-url.util";
   ```
3. `packages/web/src/grid/components/AllDayEventCard.tsx` — reorder the three trailing relative
   imports (currently lines 30-32) to the identical three lines listed in edit 2.
4. `packages/web/src/grid/components/event-join-url.util.test.ts` — swap the two import lines to:
   ```ts
   import { getJoinableConferenceUrl, isJoinableUrl } from "./event-join-url.util";
   import { describe, expect, it } from "bun:test";
   ```
5. `packages/web/src/grid/components/EventCard.test.tsx` — reformat the `fireEvent.keyDown` call
   at lines 733-735 to Biome's 80-column output:
   ```ts
       fireEvent.keyDown(
         screen.getByRole("button", { name: "Join Google Meet" }),
         {
           key: "Enter",
         },
       );
   ```

**Acceptance.**
- `npx biome check packages/web/src/grid/components/EventJoinIcon.tsx packages/web/src/grid/components/TimedEventCard.tsx packages/web/src/grid/components/AllDayEventCard.tsx packages/web/src/grid/components/event-join-url.util.test.ts packages/web/src/grid/components/EventCard.test.tsx` reports **zero `assist/source/organizeImports` diagnostics and zero formatter diagnostics**.
- `bun test:web` still reports 2327 pass / 0 fail.
- `bun type-check` still exits 0.
- `git diff --stat` shows changes only to import blocks and the one `fireEvent.keyDown` call.

---

### TP-R3 — `test_refactor` (major R-3)

```yaml
task_type: test_refactor
artifact_path: packages/web/src/grid/components/event-join-url.util.test.ts
```

**Instruction.** Remove all three `as any` casts. The parameter type of
`getJoinableConferenceUrl` is `GridEvent["conference"]`, i.e.
`{ url: string; label: string | null } | null | undefined`, so every value below is already
assignable and no cast is needed. Do not add a type import; do not change any test title or
expected value. Replace exactly:

- line 60: `expect(getJoinableConferenceUrl(null as any)).toBe(null);`
  → `expect(getJoinableConferenceUrl(null)).toBe(null);`
- line 65: `const conference = { url: rawUrl, label: "x" } as any;`
  → `const conference = { url: rawUrl, label: "x" };`
- line 70: `const conference = { url: "javascript:alert(1)", label: null } as any;`
  → `const conference = { url: "javascript:alert(1)", label: null };`

**Acceptance.**
- The string `as any` does not appear anywhere in the file.
- `npx biome check packages/web/src/grid/components/event-join-url.util.test.ts` reports zero `lint/suspicious/noExplicitAny` diagnostics.
- `bun type-check` exits 0 (this is the load-bearing check — it proves the casts were unnecessary; if it fails, the cast removal was wrong and the packet should report back rather than reinstate `any`).
- The file still contains 16 `it(...)` cases and `bun test src/grid/components/event-join-url.util.test.ts` reports 16 pass / 0 fail.

---

### TP-R4 — `lint_fix` + `test_hardening`, bundled minors (R-4, R-5, R-6, R-7)

```yaml
task_type: test_hardening
artifact_path: packages/web/src/grid/components/
```

**Instruction.** Four small independent edits:

1. **(R-4)** `EventJoinIcon.tsx` line 61 — reorder the tail of the `className` string so the
   arbitrary-value outline utility precedes the numeric ones. The full replacement string is:
   ```
   absolute right-4.5 bottom-0.5 flex h-2.5 w-2.5 items-center justify-center rounded-xs focus-visible:outline focus-visible:outline-(--event-focus-color) focus-visible:outline-1 focus-visible:outline-offset-0
   ```
   The set of classes is unchanged — only their order. Do **not** alter `right-4.5`; it is a
   load-bearing invariant (change_plan ADR-4) and `right-1.5`/`right-10`/`right-12`/`right-14`/
   `right-16` are all forbidden substrings.
2. **(R-5)** `EventCard.test.tsx` — insert this exact comment line immediately above the
   `<div onKeyDown={onParentKeyDown}>` at line 722, matching the identical pre-existing comments
   at lines 240 and 411:
   ```tsx
         // biome-ignore lint/a11y/noStaticElementInteractions: test wrapper simulates a parent shortcut listener.
   ```
3. **(R-6)** `EventCard.test.tsx`, inside the test titled `"places the join glyph clear of the
   repeat glyph when an event is both recurring and joinable"` — strengthen the collision proof.
   Replace the single line
   ```ts
       expect(container.querySelectorAll('svg[class*="right-1"]')).toHaveLength(1);
   ```
   with
   ```ts
       const repeatGlyphs = container.querySelectorAll('svg[class*="right-1"]');
       expect(repeatGlyphs).toHaveLength(1);
       expect(repeatGlyphs[0]?.getAttribute("class")).toBe(
         "pointer-events-none absolute right-1 bottom-0.5",
       );
   ```
   Leave the two following `join.className` assertions untouched.
4. **(R-7)** `EventCard.test.tsx` — add one new `it(...)` immediately after the test titled
   `"opens the conference link on Enter without triggering the card's open handler"`, covering
   the Space branch. Copy that test's structure verbatim and change only the title and the key:
   ```tsx
     it("opens the conference link on Space without triggering the card's open handler", () => {
       const openMock = stubWindowOpen();
       const onEventKeyDown = mock();
       const onParentKeyDown = mock();

       render(
         // biome-ignore lint/a11y/noStaticElementInteractions: test wrapper simulates a parent shortcut listener.
         <div onKeyDown={onParentKeyDown}>
           <TimedEventCard
             displayMode="saved"
             event={createEvent({ conference })}
             motionMode="idle"
             onEventKeyDown={onEventKeyDown}
             position={position}
           />
         </div>,
       );

       fireEvent.keyDown(
         screen.getByRole("button", { name: "Join Google Meet" }),
         { key: " " },
       );

       expect(openMock).toHaveBeenCalledTimes(1);
       expect(onEventKeyDown).not.toHaveBeenCalled();
       expect(onParentKeyDown).not.toHaveBeenCalled();
     });
   ```

**Acceptance.**
- `npx biome check packages/web/src/grid/components/` exits 0 with zero diagnostics of any severity (assumes TP-R2 and TP-R3 have already landed).
- `bun test src/grid/components/EventCard.test.tsx` reports **34** pass / 0 fail (33 + the new Space case).
- The new Space test fails if the `e.key !== " "` clause in `EventJoinIcon.tsx:51` is changed to reject Space — i.e. it is a real assertion, not a vacuous one.
- `bun type-check` exits 0.
- `EventJoinIcon.tsx`'s className still contains `right-4.5` and still does not contain the substring `right-1`.

---

### TP-R5 — `test_refactor`, optional (nits R-8, R-9)

```yaml
task_type: test_refactor
artifact_path: packages/web/src/grid/components/EventCard.test.tsx
```

**Instruction.** Low priority; dispatch only if budget allows.

1. **(R-8)** In the test titled `"reserves title room for both bottom-right icons on an all-day
   card"`, convert the second and third bare `render(...)` calls to `rerender(...)` from the
   first render's return value (`const { rerender } = render(...)`), so at most one card is in
   the DOM at a time. Keep the three distinct titles and all three `toHaveClass` assertions
   exactly as they are.
2. **(R-9)** In the test titled `"refuses to render a join control for a non-http conference
   url"`, either delete the vacuous trailing `expect(openMock).not.toHaveBeenCalled();` and the
   now-unused `const openMock = stubWindowOpen();`, **or** make it non-vacuous by keeping the
   stub and leaving a one-line comment explaining that it guards against a future regression
   where a control is rendered. Prefer deletion.

**Acceptance.**
- `bun test src/grid/components/EventCard.test.tsx` still passes with the same case count as before this packet.
- No test title changes.
- If `openMock` is removed, no unused-variable diagnostic is introduced (`npx biome check` on the file stays at zero diagnostics).

---

## 6. Notes for the security reviewer

1. **The URL scheme guard is well built and correctly applied.** `isJoinableUrl`
   (`event-join-url.util.ts:9-21`) is a `url is string` type predicate that short-circuits on
   falsy input, parses with `new URL`, and allowlists exactly `http:` and `https:` — an
   allowlist, not a denylist, which is the right shape for provider-sourced data. Unparseable
   and protocol-relative strings throw and are caught, failing closed. The 12 cases in
   `event-join-url.util.test.ts` pin `javascript:`, `data:`, `vbscript:`, `file:`,
   protocol-relative, bare-host, empty, `null` and `undefined`. I found **no path** by which a
   button can be rendered for a non-http(s) URL: the guard runs at render in both cards
   (`TimedEventCard.tsx:123`, `AllDayEventCard.tsx:80`), again at the top of the component
   (`EventJoinIcon.tsx:28`), and a third time inside `openConference` (`:33`).
2. **`noopener,noreferrer` is present and exact.** `EventJoinIcon.tsx:34` passes
   `"noopener,noreferrer"` as the feature string, and the test asserts the three arguments
   verbatim, so a typo in that string is a test failure rather than a silent
   reverse-tabnabbing/referrer-leak regression. ADR-1 consequence (6) called this out as the
   main risk of choosing `window.open` over an anchor; the assertion mitigates it well.
3. **`getJoinableConferenceUrl` returns the provider's original string, never
   `new URL(url).href`** (`event-join-url.util.ts:32-33`, pinned by the identity assertion at
   `event-join-url.util.test.ts:63-67`). This is correct: normalizing would rewrite provider
   URLs (`https://zoom.us` → `https://zoom.us/`) and could break meeting links whose path or
   query the provider treats as significant. Confirmed as specified in change_plan §5.5.
4. **PII posture is sound and unchanged.** `conference.url` is a bearer capability (anyone with
   it can often join). This change renders it as a `window.open` target only — it is never
   logged, never persisted, never placed in a mutation payload, and never written into an
   attribute a `MutationObserver` or a copied DOM node would expose as text. The URL does not
   appear in the button's accessible name (only `conference.label` does), so it is not read
   aloud by a screen reader and does not leak into `aria-label` scraping. `noreferrer`
   additionally prevents the destination learning the app origin. FR-7 holds mechanically: this
   run wrote nothing outside `packages/web/src/grid/components/`.
5. **Two pre-existing capture-phase listeners intersect the new button; both are benign.**
   `useKeyboardOnlyMode.ts:79-81` blocks all pointer input while keyboard-only mode is active —
   the join button being blocked along with everything else is correct and consistent.
   `useEditSequenceShortcut.ts:190` disarms an armed edit sequence on any `pointerdown`, which
   is the desired behaviour for a click on the join icon too. Neither is a finding.
6. **Security-adjacent consequence of R-1.** The blocker is a correctness bug, not a
   vulnerability — it makes the control open the *event form* instead of the meeting, which
   fails safe rather than open. There is no path by which R-1 causes an unintended navigation.
   Worth stating explicitly so it is not mis-triaged as a security issue.
7. **Residual accepted risks, restated for the record, not re-raised:** the 10×10 hit target is
   below WCAG 2.2 SC 2.5.8's 24×24 (accepted, R-5 in the plan, consistent with the
   `EventRepeatIcon` precedent); double-click can open two tabs (R-4, no debounce); the drag
   ghost carries an inert clone of the button (R-3, confirmed harmless — see §2.2); each
   joinable card adds a tab stop (R-6).
