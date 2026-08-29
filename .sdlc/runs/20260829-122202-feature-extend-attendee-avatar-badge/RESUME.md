# Resume note — paused mid Phase 5 (execute_packets), all packets complete

**Paused:** 2026-08-29, by user request. Supersedes the earlier Gate-2 pause note.

## Where the run is

- `state.json`: `{"status":"paused","phase":"execute_packets","checkpoint":"execute_packets_complete", ...}`
- **Gate 2 was approved and applied** this session (`gate.resolved gate=gate-2 response=approved`
  is in `orchestrator.log`). Phases 1–4 complete; Phase 5 complete.
- **All 9 packets in `packets.json` are written and green.** Nothing is pending.
- Next step on resume: **Phase 6 `senior_code_review`**, then Phase 7 `test_run` (full
  `bun test:web`), then Phase 8 `security_review` → Gate 3.
- Write contract at `.sdlc/local/write-contract.json` is deliberately left **`active: true`**
  (run_id matches, strict) so a fresh session's session-hydrate detects the resume checkpoint.
- `provenance.json` is **finalized**: 9 files touched, every `sha_after` set, no dangling
  `--before` records. `git_head_before == git_head_after == 2d81253a` — nothing committed.

## Packets completed, and what each wrote

| Packet | Task type | File | New/Edit |
|---|---|---|---|
| tp_pkt_001 | `frontend_util` | `packages/web/src/common/styles/attendee-status.styles.ts` | new |
| tp_pkt_002 | `unit_test_pure_module` | `packages/web/src/common/styles/attendee-status.styles.test.ts` | new |
| tp_pkt_003 | `react_component` | `packages/web/src/views/Forms/EventForm/EventDetailsSection.tsx` | edit |
| tp_pkt_004 | `frontend_config` | `packages/web/src/grid/components/attendee-badge.constants.ts` | new |
| tp_pkt_005 | `react_component` | `packages/web/src/grid/components/EventAttendeeBadge.tsx` | new |
| tp_pkt_006 | `component_unit_test` | `packages/web/src/grid/components/EventAttendeeBadge.test.tsx` | new |
| tp_pkt_007 | `react_component` | `packages/web/src/grid/components/TimedEventCard.tsx` | edit |
| tp_pkt_008 | `react_component` | `packages/web/src/grid/components/AllDayEventCard.tsx` | edit |
| tp_pkt_009 | `integration_test_append` | `packages/web/src/grid/components/EventCard.test.tsx` | edit |

5 new + 4 edited = the 9 files the approved plan called for. All within the allowlist; no
off-limits path was written.

### Verification already done

- `attendee-status.styles.test.ts`: 6 pass / 0 fail (zod v4 `.options` works; no fallback needed).
- `EventCard.test.tsx` + `EventAttendeeBadge.test.tsx`: **40 pass / 0 fail**, 99 expect() calls.
  `EventCard.test.tsx` went 20 → 28 `it()` blocks (exactly +8, zero existing lines removed).
- Card diffs verified against pre-run snapshots and are exactly the plan's reviewer gate:
  TimedEventCard = 2 imports + 1 const + 1 useMemo body + 1 JSX line; AllDayEventCard = 2 imports
  + 1 gated const + 1 JSX expression, row `cn(...)` byte-identical, `{" "}` preserved.
- **Not yet run:** full `bun test:web` (Phase 7), `bun lint` (AC-7), the emitted-CSS `ring-*`
  grep the Gate-2 approval asked to be reported at Gate 3, and the AC-6 grep.

## Two things the next orchestrator must know

1. **tp_pkt_009 is COMPLETE, do not re-dispatch it.** Telemetry records it `success=false`,
   `cost_usd=0`, `output_tokens=0` with `error: claude-cli timeout after 300s`. That is a
   transport artifact: the worker finished writing the file before the CLI timed out. The write
   is complete and green. Re-running it would append a duplicate set of 8 `it()` blocks. The $0
   is a real undercount of run cost — do not treat the telemetry total as exact.

2. **Mechanical-tier workers write to disk directly.** They bypass both the orchestrator's
   `write-provenance.mjs` calls and the `Write|Edit` PreToolUse write-contract hook (the hook only
   matches the orchestrator's own tool calls). Behavior is inconsistent — tp_pkt_005 returned
   content without writing, every other packet wrote. This session compensated by: recording
   `--before` *ahead* of each dispatch, snapshotting all 4 edit targets to scratch, diffing disk
   against the snapshot rather than trusting the returned `file_content` blob, and backfilling
   provenance for the two files written before the pattern was noticed. **That backfill mattered:**
   running `--before` after a worker write would have recorded the *generated* content as
   `sha_before` and made `/mmo:revert` restore the new file instead of deleting it. Both are
   correctly recorded `existed_before: false, sha_before: null`.

   Corollary worth heeding: packet 7's returned `file_content` blob contained reconstructed
   middle-of-file content that did **not** match the real file. The on-disk write was surgical and
   correct. Trust the disk diff, never the returned blob.

## Routing note (materially affects cost)

The policy's mechanical rule matches `phase: codegen` only against an explicit `task_type`
allowlist. The first-draft packet types (`shared_style_module`, `constants_module`,
`card_integration`, and `phase: refactor`) matched nothing and would have hit `- default: opus`,
silently running 6 of 9 packets on the premium tier. They were retyped to the policy's real
vocabulary (`frontend_util`, `frontend_config`, `react_component`) — which they genuinely are —
and all 9 then routed to `sonnet` (rule_index 7/8). `packets.json` on disk reflects the corrected
types. Keep them if you re-plan.

## Run cost so far

**$3.3952** total (estimated tier for opus, vendor-reported for sonnet), across 12 telemetry
events:

- Phases 1–4 (opus, estimated): requirements $0.1815 + architecture $0.6940 + packet planning
  $0.3025 = **$1.1780**
- Phase 5 (sonnet, vendor-reported): $0.1433 + $0.1966 + $0.2611 + $0.1285 + $0.1157 + $0.6504 +
  $0.3878 + $0.3338 + $0.0000 = **$2.2172**

Caveat: per-packet sonnet costs here run $0.11–$0.65 on small files, driven by very large
`input_cached` counts (up to 504k on tp_pkt_006). The mechanical tier is not behaving as the
cheap tier on this workload. Plus the tp_pkt_009 $0 undercount above. Hard cap is $50; not close.

## How to resume

- **Same session:** SendMessage a new orchestrator with this checkpoint; it starts at Phase 6
  `senior_code_review` and must not re-dispatch any packet.
- **Fresh session:** run `/mmo:brownfield` — session-hydrate reports the open resume checkpoint;
  choose `resume`. Gate 2 is already resolved; do not re-ask it.

Nothing is committed. `/mmo:revert 20260829-122202-feature-extend-attendee-avatar-badge` will
delete the 5 new files and restore the 4 edited ones from git.
