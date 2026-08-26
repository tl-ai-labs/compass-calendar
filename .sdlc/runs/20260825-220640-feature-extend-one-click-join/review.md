# Senior code review — CMP-103 one-click join icon on grid event cards

- **Run:** `20260825-220640-feature-extend-one-click-join`
- **Reviewed at:** branch `CMP-102/opus-plus-sonnet`, working tree vs `2d81253a`
- **Scope:** the 7 files this run touched (per `provenance.json`). Pre-existing smells in
  untouched files are out of scope and are called out as advisory only where the new code
  makes them newly relevant.
- **Reviewer independently ran:** `bun packages/scripts/src/testing/test-parallel.ts web --
  packages/web/src/grid/components/EventCard.test.tsx` → **38 pass / 0 fail / 92 expects**
  (20 pre-existing + 18 new; confirms the "+18" claim). Full-suite numbers taken from the
  run record, not re-observed.

---

## Verdict

**REQUEST CHANGES.**

The central mechanism is right, and the D-7 correction (V-1) was the correct call: I traced
it myself and the recognition-based opt-out does close the plain-click path in both views,
without breaking click-to-open, quick-release-as-click, cross-row drag, or resize. That part
is good work and I would not re-litigate it.

Three things stop this from being an approve:

1. **R-1 (High).** The change puts the first focusable descendant inside a `role="button"`
   card. That is `nested-interactive` — an axe rule with **`impact: serious`** and the
   **`wcag2a`** tag, which is inside the exact tag set this repo's own a11y gate scans
   (`e2e/utils/axe-assertion.ts:11-17`, `e2e/accessibility/app-a11y.spec.ts:20-27` scans the
   whole week view). The gate is green today only because no e2e fixture seeds a
   `conference`. This needs an explicit decision recorded, not silence.
2. **R-5 (Medium).** The load-bearing half of the fix — the two adapter bails — has **zero**
   test coverage. `change_plan.verification.md` §2 says in as many words that a green
   card-level suite is not evidence for this path; the shipped tests repeat that exact
   pattern. Someone tidying up "why is this `||` here?" deletes both bails and all 18 new
   tests still pass while plain-click join is dead in Week and Day.
3. **R-2 (Medium).** Dragging from the join icon now starts a native HTML5 link drag
   (`a[href]` is `draggable` by default and nothing preventDefaults the pointerdown any
   more). One-attribute fix.

R-1, R-2, R-5 are the required changes. R-3, R-4 and the Lows are recommended but I would
not hold the branch for them.

---

## Findings

| ID | Sev | File:line | What | Why it matters | Fix |
|---|---|---|---|---|---|
| R-1 | **High** | `packages/web/src/grid/components/EventJoinIcon.tsx:72` inside `TimedEventCard.tsx:283` / `AllDayEventCard.tsx:152` (`role="button"` + `tabIndex={0}`) | A focusable `<a href>` is now a descendant of an element with `role="button"`. I verified in the installed `axe-core@4.12.1` that `nestedInteractiveMatches` matches any node whose role has `childrenPresentational: true`, and that `ariaRoles.button` has `childrenPresentational: true`; the check is `no-focusable-content`, which fails on any focusable descendant. Rule metadata: `impact: 'serious'`, `tags: ['cat.keyboard','wcag2a','wcag412',…]`. | `wcag2a` is in `WCAG_22_AA_TAGS` (`e2e/utils/axe-assertion.ts:11-17`) and `app-a11y.spec.ts:20-27` runs an unscoped page scan of the week view. Any conference-bearing event on that page turns the a11y e2e suite red. It is green purely by fixture accident — no e2e seed contains `conference` (grepped `e2e/`, zero hits). Separately, ARIA presentational-children is why the rule exists: AT exposure of the link is not guaranteed, and `getByRole("link", …)` in RTL does **not** model that pruning, so AC-6's test is not evidence that a screen-reader user can reach it. | Pick one and record it: **(a)** move the card root off `role="button"` (e.g. `gridcell` inside a `grid`, the standard calendar pattern) — correct but a bigger refactor and outside this run's allowlist; **(b)** make the link non-focusable (`tabIndex={-1}`) and provide the keyboard join through the event form/context menu — clears the rule, but directly contradicts FR-4b/AC-5, so the AC set must be amended; **(c)** accept the deviation consciously: a comment in `EventJoinIcon.tsx` stating the tension, a follow-up ticket for (a), and a decision on whether to seed a conference in the e2e fixture (which will require an explicit `nested-interactive` exclusion in `expectNoAxeViolations`, with a reason, since the helper deliberately has no blanket allowlist). What I will not accept is shipping it undocumented — the repo has an a11y gate precisely so this class of thing is a decision, not an accident. |
| R-2 | Medium | `EventJoinIcon.tsx:72-89` | `<a href>` is `draggable` by default per HTML. Because the adapters now decline ownership, `PointerCaptureBoundary` no longer `preventDefault()`s the pointerdown, so mousedown-and-move on the icon starts a **native link drag** (URL drag image) instead of doing nothing. Previously that pixel area started an event drag. ~90% confident; the only thing that could suppress it is a UA quirk, and `select-none` does not. | A visible papercut on a brand-new affordance, and a URL-shaped drag ghost floating over the calendar is confusing. It also makes the affordance feel broken to anyone who mouses down and twitches. | Add `draggable={false}` to the anchor. No downside — the link has no legitimate drag use. |
| R-3 | Medium | `week-interaction.adapter.ts:511,550`; `day-interaction.adapter.ts:462,501` | The opt-out is consulted only in the two *drag*-target functions. `getInteractionTarget` (`week:484-506`, `day:435-457`) tries `getAllDayResizeTarget` and `getTimedResizeTarget` **first**, and neither consults it. Today this is safe — the anchor is a sibling of both resize handles, never a descendant, so `getResizeHandleEdge` is `null` for it — but the guarantee lives in card markup, not in the adapter. | Fragile by construction, and the same two-condition bail is now duplicated 4× across 2 files (DRY). If a future affordance is ever placed inside a handle wrapper, the resize path silently reclaims it and the opt-out stops working, with no test to notice. | Move the bail up one level: in each adapter, first line of `getInteractionTarget` → `if (isInteractiveAffordanceTarget(event)) { return null; }`, and revert the four `getResizeHandleEdge(event) \|\| …` lines to their original single-condition form. Net −2 lines, covers all four target kinds, and reads as one intent ("this element opts out of interaction") instead of four. Behaviour is otherwise identical: `getInteractionTarget` is called only from `handlePointerDown` and from the engine's `getTarget`, and I confirmed `interaction.engine.ts:135` calls `getTarget` **only** on pointerdown, never mid-gesture. |
| R-4 | Medium | `dom.ts:53` vs `EventJoinIcon.tsx:78` | The writer emits `data-calendar-event-interactive="true"`; the reader matches on attribute **presence**, `closest('[data-calendar-event-interactive]')`. The sibling convention two lines up is value-matched: `EVENT_CONTENT_SELECTOR = [${EVENT_CONTENT_ATTRIBUTE}='true']` (`dom.ts:21`). | Latent trap exactly as suspected. A future author writing `{...{[EVENT_INTERACTIVE_ATTRIBUTE]: String(isEnabled)}}` gets `="false"` and still opts out — the inverse of the intent, silently, with a passing suite. The `"true"` value is asserted in the tests, which makes it look load-bearing when it is not. | In `dom.ts` add `export const EVENT_INTERACTIVE_SELECTOR = \`[${EVENT_INTERACTIVE_ATTRIBUTE}='true']\`;` and use it in `isInteractiveAffordanceTarget`. Better still, also export the writer side so the two cannot drift: `export const interactiveAffordanceAttributes = { [EVENT_INTERACTIVE_ATTRIBUTE]: "true" } as const;` and spread that in `EventJoinIcon` instead of an inline object literal. |
| R-5 | Medium | `EventCard.test.tsx:576-582` (comment), and the *absence* of any adapter test | 18 new tests, all card-level, none exercising `isInteractiveAffordanceTarget` or either adapter bail. The comment at :576-582 is **accurate** and I credit it — but it documents the gap rather than closing it. The only thing anchoring the adapter half is a string literal in `toHaveAttribute("data-calendar-event-interactive","true")`. | Delete both adapter bails and every one of the 18 tests still passes, while plain-click join is dead in both shipping views — the precise failure mode `change_plan.verification.md` §2 identified and warned about ("A passing suite here is not evidence"). Regression risk is high because the bails look like incidental noise at the call site. | Two small tests, in files that already have the whole harness: **(1)** `packages/web/src/views/Week/interaction/adapter/week-interaction.timed-drag.test.ts` — its `createHarness` already builds `source` (registered in `weekEventRegistry`) with a `child` span inside it, and `makePointerEvent` already lets you override `target`. Add: `child.setAttribute("data-calendar-event-interactive","true")` then assert `adapter.handlePointerDown(makePointerEvent("pointerdown",{button:0,target:child}))` equals `{reason:"no-week-interaction-target",shouldOwn:false}`, with a negative control (same event, attribute absent) asserting `shouldOwn: true`. The negative control is what makes it a real test. **(2)** the same pair in `packages/web/src/views/Day/interaction/adapter/day-interaction.adapter.test.ts`, which has equivalent registry/harness scaffolding. Optionally a 3-line unit test for `isInteractiveAffordanceTarget` covering the descendant case (`closest`, not `===`) — cheap, and it pins the contract that the *icon inside the link* also opts out. |
| R-6 | Low | `EventJoinIcon.tsx:75` + `TimedEventCard.tsx:356-365` | On the timed card the link (`bottom-0.5`, `h-3`, `LAYER_5`) spans 2–14px from the bottom; the `endDate` resize strip (`bottom:-0.25px`, `height:4.5px`, `LAYER_4`) spans −0.25–4.25px. So a **12×~2.25px** sliver of the bottom-right resize strip is now shadowed by the link, and a pointerdown there resolves to neither resize nor drag. On the all-day card the overlap is ~0.25px (handle at `right:-0.25px` width 4.5 → −0.25–4.25; link at 4–16) — immaterial. | AC-10 substantively holds, but "resize handles remain functional" is now "…except a 12×2.25px corner". Worth knowing, not worth redesigning. | Accept, or nudge the timed placement to `bottom-1` (4px) so the link clears the strip entirely. I would accept. |
| R-7 | Low | `EventJoinIcon.tsx` render (no gate) vs `TimedEventCard.tsx:117-121`, `AllDayEventCard.tsx:77-78` | The join icon has **no** size gate. The repeat icon has `position.width >= 40` (timed) / `>= 60` (all-day). On a narrow deck/overlap timed card (~30px) the 12px link at `right-1` occupies ~40% of the width and the whole bottom-right; on a `COMPACT_EVENT_MAX_HEIGHT` (≤15px) card the 14px-tall link nearly fills the card height. | Inconsistent with the established indicator convention (NFR-2 argues divergence must be forced by structure, and here it is not), and on the narrowest cards the link swallows the only bottom-right pixels a user would grab to drag. | Decide explicitly: either gate on `position.width >= REPEAT_ICON_MIN_WIDTH` for symmetry with the repeat icon, or add a one-line comment saying a functional affordance is deliberately never hidden by size (unlike a decoration). Either is defensible; the silence is not. |
| R-8 | Low | `EventJoinIcon.tsx:75` (`c-focus-ring`) | `c-focus-ring` is `rounded focus-visible:ring-1 focus-visible:ring-accent focus-visible:ring-offset-1 focus-visible:ring-offset-surface-panel` (`index.css:260-262`). The offset color is the **panel** color, painted as a 1px halo directly on top of the colored event fill; and both cards are `overflow-hidden`, so the ring's bottom edge (at `bottom-0.5` − 2px offset = exactly 0) sits flush with / hairline-clipped by the card's rounded bottom edge. ~70% confident this reads as a mis-coloured notch rather than a clean ring. | Keyboard focus indicator quality on the one new keyboard target. Not a functional break. | Verify visually. If it reads badly, use `focus-visible:ring-offset-0` on the anchor (keep the ring) or move to `bottom-1`. |
| R-9 | Low | `EventCard.test.tsx:737-787` | The AC-5 tests assert only that `onEventKeyDown` was not called. AC-5's second half — "and is **not** `preventDefault`ed by the card root" — is unasserted. That half is the one that would actually block the anchor from activating. | A future change that makes the card root `preventDefault()` in the capture phase (or that adds a document-level Enter handler) would break keyboard join with both tests still green. | `fireEvent.keyDown` returns `false` when default was prevented. Add `expect(fireEvent.keyDown(link, { key: "Enter" })).toBe(true);` (replacing the bare call) in both tests. One-line change, closes the stated AC. |
| R-10 | Low | `EventJoinIcon.tsx:83-87` | `Space` on the focused link is swallowed: propagation is stopped (correctly, so the card root does not open the form) but anchors do not activate on Space, so the key does nothing at all. | The link lives inside something announced as a button, where Space is the expected activation key. Silent no-op is the worst of the three options. | `if (e.key === " ") { e.preventDefault(); e.stopPropagation(); e.currentTarget.click(); return; }` before the Enter branch. `.click()` inside a keydown is a user gesture, so `target="_blank"` will not be popup-blocked. |
| R-11 | Nit | `EventJoinIcon.tsx:18` | `joinableConference` is a value-returning function named like a predicate; the repo convention for value-returning helpers is `get*` (`getResizeHandleEdge`, `getLineClamp`, `getInteractiveIconClassName`). | Callers reading `if (joinableConference(...))` will assume a boolean. | Rename to `getJoinableConference`. |
| R-12 | Nit | `EventJoinIcon.tsx:66` vs `TimedEventCard.tsx:252` / `AllDayEventCard.tsx:130` | The `"Untitled event"` fallback is duplicated, and only the link `trim()`s. A whitespace-only title gives the card the label `"Timed event:    , 9 - 10 AM"` and the link `"Join Untitled event"`. | Cosmetic inconsistency in two accessible names for the same object. | Either drop the `.trim()` to match the cards, or lift a shared `eventDisplayTitle(event)` helper. Low value; fine to leave. |
| R-13 | Nit | `EventJoinIcon.tsx:75` | `flex h-3 w-3 items-center justify-center` around a `size={12}` icon: the box is exactly the icon size, so the flex centering is a no-op. | Reads as if it is doing something. | Keep `h-3 w-3` (it makes the hit box explicit and is what the padding math is written against), drop `flex items-center justify-center` — or leave it and stop reading it as meaningful. Genuinely does not matter. |
| R-14 | Advisory (out of scope) | `components/Sidebar/UpNextCard/UpNextCard.tsx:87-95`, `EventDetailsSection.tsx` | Both render `conference.url` straight into `href` with **no** protocol guard. The new `joinableConference` guard exists only on the grid cards. `change_plan.verification.md` proved empirically that `ConferenceSchema` accepts `javascript:`, `data:` and `vbscript:`. | Pre-existing, in files this run did not touch, so not a finding against this change — but the new code makes the asymmetry obvious and someone will assume the guard is global. | Follow-up ticket: hoist `getJoinableConference` (or just the protocol check) to a shared util and apply it at all three `href` sinks. Not this run. |

### Type safety, error handling, DRY — no findings

- `joinableConference(conference: Conference | null | undefined, isSaved: boolean): Conference | null`
  narrows properly, so `Props.conference` is non-nullable and both call sites get the narrowing
  from the `{joinConference && …}` guard. No `any`, no assertions.
- `isInteractiveAffordanceTarget(event: Pick<PointerEvent, "target">)` mirrors
  `getResizeHandleEdge`'s signature exactly, including the `instanceof Element` guard for
  non-Element targets. Correct and consistent.
- The `try/catch` around `new URL` returns `null` rather than swallowing silently into a
  render — the failure mode is "no link", which is the safe default. No leaked stack traces.
- The JSX computed-attribute spread is forced by TS (data-attributes from a `const` cannot be
  written literally) and matches the existing `EVENT_RESIZE_HANDLE_ATTRIBUTE` idiom in both
  cards. Not a smell.
- Env-fixture check: N/A. This is a web-package React change with no validating config module
  in scope.

---

## AC coverage

| AC | Status | Evidence |
|---|---|---|
| AC-1 — join link on both cards | **Covered** | `EventCard.test.tsx:584` (timed), `:609` (all-day). |
| AC-2 — no conference → nothing new, no layout shift | **Covered** | `:654`, `:667` (no link). No-shift is covered indirectly but adequately: `:852` proves the repeat-only all-day card still gets exactly `pr-3.5`, and the timed card adds no padding in any branch. |
| AC-3 — `href` / `target=_blank` / `rel=noopener noreferrer` | **Covered** | `:584`, `:609`. |
| AC-4 — mousedown does not call `onEventMouseDown` | **Partially covered** | `:679`, `:709` cover the React-prop path (which is real and load-bearing for read-only cards — see the trace). The **pointer-capture** path, which was the actual bug, is not covered anywhere. See R-5. |
| AC-5 — Enter does not open the form and is not preventDefaulted | **Partially covered** | `:737`, `:763` cover "does not call `onEventKeyDown`". The "not preventDefaulted" half is unasserted — see R-9. |
| AC-6 — `getByRole("link", { name })` identifies the event | **Covered, with a caveat** | `:584`, `:609`, `:634` (`"Join Planning block via Google Meet"`). Caveat per R-1: RTL's role query does not model ARIA presentational-children, so this passing does not prove AT exposure. |
| AC-7 — recurring + conference shows both, no overlap | **Covered** | `:789` (timed: repeat svg still `right-1`, link `right-4`), `:810` (all-day: same + `pr-7`). Geometry independently verified below. |
| AC-8 — no link on draft / placeholder | **Covered** | `:868` (timed draft), `:886` (timed placeholder), `:904` (all-day placeholder). |
| AC-9 — `VideoCameraIcon` + `getInteractiveIconClassName`, no new dep | **Covered by review** | `EventJoinIcon.tsx:1,92`. `@phosphor-icons/react` was already a dependency (`UpNextCard.tsx`). `provenance.json` lists 7 touched files; `package.json` is not among them. OQ-1's default resolution (direct import, no `components/Icons/VideoCamera.tsx` wrapper) matches both existing precedents — agreed. |
| AC-10 — resize handles still functional | **Not covered for the new case** | The two shipped `onScalerMouseDown` assertions still pass (part of my 38/0 run) but their events carry no conference, exactly as `change_plan.verification.md` §4 warned. R-6 documents the one real (tiny) loss. If you take R-5, add a conference to one resize test's event and assert `onScalerMouseDown` still fires. |
| AC-11 — no new failures; focused probe ≥ 30 | **Covered, independently re-observed** | I re-ran `EventCard.test.tsx`: 38 pass / 0 fail / 92 expects. `act(...)` warnings from both card bases are unchanged pre-existing noise. Full-suite 2316/0/302 taken from the run record. |
| NFR-5 — untrusted URL at a DOM sink | **Covered, and better than required** | `joinableConference` re-parses and allows only `http:`/`https:`; tested at `:922`, `:937`. Note `new URL()` also rejects protocol-relative and scheme-less values by throwing — the `catch` handles it. Good. |

---

## Traced verification

I read `PointerCaptureBoundary.tsx`, both adapters' `handlePointerDown` / `getInteractionTarget`
/ target resolvers, `interaction.pointer.ts`, `interaction.engine.ts`, `event.registry.ts`,
`event.targeting.ts`, both card wrappers in Week and Day, and the grid's draft-creation
handlers. Conclusions:

**1. The opt-out works end to end, and the diagnosis in V-1 was right.**

Plain left click on the join link, Week view:

- `WeekInteractionCoordinator.tsx:193` wraps the grid in `PointerCaptureBoundary`;
  `:107` binds `onPointerDownCapture` → `handlePointerDownCapture` (`:69-80`) →
  `adapter.handlePointerDown(event.nativeEvent)`.
- `week-interaction.adapter.ts:158` — `isEligibleWeekPointerDown` passes (primary, button 0,
  no modifiers). No link/interactive exclusion exists there, confirming the V-1 analysis.
- `:165` `getInteractionTarget` → `getAllDayResizeTarget` (`:527`) and `getTimedResizeTarget`
  (`:566`) both bail because `getResizeHandleEdge` is `null` — the anchor is a **sibling** of
  the two handle divs, not a descendant, so `closest('[data-calendar-event-resize-handle]')`
  misses. Then `getTimedDragTarget` (`:550`) and `getAllDayDragTarget` (`:511`) both bail on
  `isInteractiveAffordanceTarget`. `getInteractionTarget` returns `null`.
- `:167-172` → `{reason:"no-week-interaction-target", shouldOwn:false}` → boundary returns at
  `:74-76` **without** calling `consumeOwnedPointerEvent`, so no `preventDefault()`, no
  `stopPropagation()`, and `engine.handlePointerDown` is never reached — no session is created
  and nothing needs unwinding.
- The native pointerdown therefore completes normally, the compatibility `mousedown` fires on
  the anchor, `EventJoinIcon.tsx:88` stops its propagation so `TimedEventCard.tsx:309` never
  runs, and `click` performs default anchor activation into a new tab.

Day view is structurally identical (`DayInteractionCoordinator.tsx:117`;
`day-interaction.adapter.ts:119,126,435-457,462,501`).

**2. Bailing in only the two drag functions is sufficient today — but only by markup luck.**
Both resize resolvers gate on `getResizeHandleEdge` first, which is `null` for the anchor, so
they cannot reclaim it. That is a property of where the anchor sits in the DOM, not of the
adapter. Hence R-3.

**3. Nothing else takes ownership, and nothing else breaks.**

- **Grid draft creation** (`TimedGrid.tsx:140`, `MainGrid.tsx:156`, `AllDayGridRow.tsx:74`,
  `AllDayRow.tsx:143`) is bound on **`onMouseDown`**, not pointerdown — I grepped every
  `onPointerDown` in `packages/web/src` and the only ones are `PointerCaptureBoundary:107`,
  the sidebar resizer, and two capture-phase `document`/`window` listeners in shortcut hooks.
  The anchor's mousedown `stopPropagation` therefore does close that path. If the grid ever
  moves draft creation to a bubble-phase `onPointerDown`, the anchor would **not** stop it —
  worth remembering, not a finding today.
- **Click-to-open** runs through `handlePointerUp` → `engine.handlePointerUp` →
  `result.type === "click"` → `onClickTimedEvent` (`week:208-219`). With no session, the engine
  returns `null` and `ownsPointer` is `false`, so nothing fires and nothing is consumed. Not
  broken — correctly suppressed for this one element.
- **Quick-release-as-click, cross-row drag, smart scroll, edge navigation** are all unaffected:
  `interaction.engine.ts:135` is the only `getTarget` call and it happens on pointerdown only.
  There is no mid-gesture re-resolution, so a drag started elsewhere on the card cannot be
  cancelled by passing over a join icon.
- **Read-only cards are why the mousedown stop is not redundant** — this is the strongest
  argument for the belt-and-braces the plan called for, and neither the plan nor the code
  comment says it. `MainGridEvents.tsx:206-208` and `DayCalendarEventCards.tsx:79-83,153-157`
  give read-only/placeholder cards **no** interaction attributes (so the registry never resolves
  them and the pointer layer never owns them) and wire opening straight through
  `onEventMouseDown`. On a read-only conference-bearing card, the adapter bail is irrelevant and
  `EventJoinIcon.tsx:88` is the *only* thing preventing the details panel from opening under the
  new tab. Both mechanisms are load-bearing, on disjoint sets of cards.
- **`onFocus`/`onBlur` bubbling** — the item `change_plan.verification.md` §4 left unverified.
  Verified: React's `onFocus`/`onBlur` are `focusin`/`focusout`, which bubble, so focusing the
  link fires the deck card's `onFocus` (`GridEvent.tsx:144`, `DayCalendarEventCards.tsx:186`).
  That is identical to what already happens when the card root itself takes focus on mousedown,
  so there is no behaviour change. Moving focus link↔card fires a blur/focus pair in one tick,
  which React batches. Non-issue; closing that open item.
- **Keyboard shortcuts keep working with the link focused.** `event.targeting.ts:51-52`
  resolves `document.activeElement` through `registry.resolveFromTarget`, which uses `closest()`
  — so a focused join link still resolves to its card. Arrow-nudge/edit/delete shortcuts are
  unaffected, and only `Enter`/`Space` are swallowed. Also `focusGridEventTarget` focuses the
  card root, so the app's own event-to-event navigation never lands on the link: the extra tab
  stop affects raw `Tab` only.
- **Middle-click and modifier-click** open the link and are not consumed
  (`interaction.pointer.ts:19-25` rejects them from ownership; the anchor's mousedown stop still
  keeps the card root out of it). Right-click passes through to the context menu as before.
- **Drag ghost**: `createDraftEventClone` sets `pointerEvents:"none"` and `aria-hidden` on the
  clone root, so the cloned anchor cannot be hit or announced. (It strips `tabindex` but an
  `a[href]` is focusable without one — irrelevant for a ghost that only exists mid-drag.)

**4. The all-day four-way padding reservation is exhaustive, mutually exclusive, and the
numbers are right.** Absolute offsets resolve against the card's padding box, so the card's own
`pr-0.75` (3px) does not shift the icons; the inner wrapper's `pr-*` must therefore cover
`icon_right_extent − 3px`.

| repeat | join | class | icons occupy (from card's right edge) | needed | reserved | verdict |
|---|---|---|---|---|---|---|
| off | off | *(none)* | — | 0 | 0 | correct, and NFR-1's zero-shift case |
| on | off | `pr-3.5` (14px) | repeat 10px @ `right-1` → 4–14px | 11px | 14px | unchanged from today |
| off | on | `pr-4` (16px) | join 12px @ `right-1` → 4–16px | 13px | 16px | correct |
| on | on | `pr-7` (28px) | repeat 4–14px, join 12px @ `right-4` → 16–28px | 25px | 28px | correct, **2px clear gap** between the glyphs |

All three `classnames` keys are mutually exclusive by construction and the fourth case falls
through to no class. The consistent +3px over-reservation is inherited from the existing
`pr-3.5` and is right to preserve. Card height is fine too: `EVENT_ALLDAY_HEIGHT = 20`, the link
needs 14px (`bottom-0.5` + `h-3`), so nothing is clipped by `overflow-hidden`.

The verification doc's warning that "the join glyph's `class` must never contain `right-1`" is
satisfied and worth stating explicitly: the positioning classes live on the `<a>`, and the `svg`
carries only `c-icon`, so the five shipped `svg[class*="right-1"]` probes stay unambiguous — as
`:789` and `:810` demonstrate by asserting both in the same test.

**5. Test honesty.** The comment at `EventCard.test.tsx:576-582` is accurate, specific, and
names the exact mechanism it does not cover. I credit it — that is the right instinct and far
better than silence. It is not *sufficient*, because a comment does not fail a build (R-5). The
tests that would pass with the feature broken in the real views are the two AC-4 mousedown tests
(`:679`, `:709`): they prove the React-prop path, which was never the failing one — though, per
the read-only finding above, that path is genuinely load-bearing for a subset of cards, so they
are not worthless. The `toHaveAttribute("data-calendar-event-interactive","true")` assertions in
`:584`/`:609` are the honest half of the contract; they just have no counterpart on the reader
side.

---

## What I would not change

Explicitly blessed, so none of this gets re-opened:

- **The recognition-based mechanism over propagation.** V-1's analysis is correct and I
  re-derived it independently. Capture at an ancestor precedes the target phase; no listener on
  the anchor — React bubble, React capture, or native target-phase — can pre-empt
  `PointerCaptureBoundary`. Mirroring `getResizeHandleEdge` is exactly how this codebase already
  protects inner affordances, and Option A was the right call over the portal or keyboard-only
  alternatives.
- **Keeping the mousedown `stopPropagation` as well.** It looks redundant next to the adapter
  bail and is not: read-only and unregistered cards never reach the pointer layer at all, and
  the grid's own draft-creation handlers are mousedown-bound. Both are needed. (Worth one comment
  line in `EventJoinIcon.tsx` saying so — the current doc comment explains the attribute but
  leaves `onMouseDown` looking like leftover belt-and-braces from the superseded D-7.)
- **`joinableConference` living next to the component.** A gate that must agree with what is
  rendered belongs beside the thing it gates, and the doc comment says why. Co-location beats
  a `*.util.ts` here.
- **The protocol re-parse.** `z.url()` genuinely accepts `javascript:` (proven empirically in
  Phase 2), and defending at the sink rather than trusting the contract is the correct instinct.
  Allowing `http:` as well as `https:` is right — provider links are https in practice and
  blocking http would be a silent failure for self-hosted conferencing.
- **The accessible-name shape** (`Join <title>` / `Join <title> via <label>`). Satisfies FR-6,
  reads well, and OQ-2's default was the sensible one.
- **Direct `@phosphor-icons/react` import instead of a `components/Icons/VideoCamera.tsx`
  wrapper** (OQ-1). Matches both existing precedents; the wrapper is not worth a file.
- **`LAYER_5` for the link.** The card root sets a `z-index`, so `LAYER_5` is scoped inside the
  card's stacking context and cannot escape over grid chrome. Correct choice for sitting above
  the `LAYER_4` resize strips.
- **High-contrast glyph (`theme.getContrastText`) instead of the repeat icon's
  `darken(baseColor, 30)`.** Deliberate and right: one is a decoration, the other is a control
  that must be findable. Same reasoning for `aria-hidden` on the repeat glyph but not on this one.
- **Not gating `Enter` handling on anything more than `Enter`/`Space`.** Letting every other key
  bubble keeps the grid's global shortcuts alive while the link has focus. Correct.
- **The `useMemo`-free `new URL()` per render.** Microseconds, and the cards are memoised. Not
  worth optimising.
- **Not touching the draft adapter, the sync normaliser, or any consumer** (NFR-3). Both cards
  already receive the whole event; no new prop at any call site was the right shape.

---

## Suggested disposition

Required before merge: **R-1** (a recorded decision, not necessarily the full refactor),
**R-2**, **R-5**. Recommended in the same pass because they are each a few lines: **R-3**,
**R-4**, **R-9**. Everything else is optional or a follow-up ticket (**R-14**).
