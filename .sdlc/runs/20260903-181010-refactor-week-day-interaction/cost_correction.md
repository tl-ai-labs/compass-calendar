# Cost correction — 2026-09-04

## What changed

The run's recorded total was **$25.03** (`claude-opus-5` $21.9 + `gemini-3.7-flash` $3.13).
It is corrected to **$7.62** (`claude-opus-5` $4.48 *recomputed-estimated* + `gemini-3.7-flash` $3.13 *vendor-metered*).

The original figures are preserved in-place: `telemetry.jsonl` keeps every original
`input_tokens` / `output_tokens` / `cost_usd` under a `superseded_20260904` key on each
affected line, and the ledger row keeps `cost_usd_original_synthesized: 25.03`.

## Why the original was wrong

`auth_mode` was `estimated`. Under estimated mode the orchestrator does **not** dispatch its
own direct-tier (Opus) packets through the MCP server — it runs them in its own conversation
and writes a synthesized `TelemetryEvent` afterwards, using the pipeline's `chars/3.8`
heuristic (`skills/pipeline/SKILL.md` Phase 5; `mcp/model-dispatch/src/pricing.ts`).

Only the **5 Flash test packets** were real dispatches (`orchestrator.log` has `dispatch.end`
lines with an Antigravity sidecar and vendor tokens only for those). Their $3.13 is a real bill.

The **7 direct-tier Opus packets** had no persisted prompt, and the spec never defines what
string counts as "the input". The orchestrator's synthesized `input_tokens` were **10–23×**
the artifacts each packet actually read or wrote:

| packet | recorded input_tokens | recorded $ | artifacts it read + wrote |
|---|---:|---:|---|
| `tp_s1_s10_batch` | 1,840,000 | 10.05 | change_plan + packets + ~26 source files |
| `tp_s11_s14_batch` | 1,120,000 | 6.13 | change_plan + packets + Week/Day adapters |
| `tp_senior_review_and_fixes` | 620,000 | 3.45 | subagent itself **reported 194,437** |
| `tp_req_001` | 501,500 | 2.66 | intent_brief + discovery + baseline (44 KB) |

1.84 M input tokens is ~7 MB of text in one call — 9× the model's context limit. The number
is an artifact of the estimator measuring the whole accumulating in-session context ÷ 3.8,
uncapped, with `cached` booked at 0. `tp_plan_001` (which *did* use the architect subagent's
reported 142,725) and `tp_security_review` (which used the reviewer's reported 88,711) were
close to right; the run mixed two bases.

## How the corrected figure was derived — "as if doing the run"

Same method the pipeline uses: `tokens = ceil(chars / 3.8)`, rates from the policy `pricing`
block (`input $5/M`, `output $25/M`), `input_tokens_cached = 0` (estimated-mode rule).

- **Subagent phases** (`tp_plan_001`, `tp_senior_review_and_fixes`, `tp_security_review`):
  use the subagent's own `subagent_tokens_reported` as the total; `output_tokens` from the
  produced artifact's byte count; `input_tokens = reported − output_tokens`.
- **Non-subagent direct packets** (`tp_req_001`, `tp_plan_packets_001`, the two codegen
  batches): no reported tokens exist, so `input` is reconstructed from the byte size of the
  artifacts the phase's prompt is defined to contain (brief / discovery / baseline /
  requirements / change_plan / packets / pre-refactor source), and `output` from the byte
  size of the deliverable (requirements.md / packets.json / the post-state of the files each
  batch produced).

| packet | in-tok | out-tok | recomputed $ |
|---|---:|---:|---:|
| `tp_req_001` | 11,600 | 5,069 | 0.185 |
| `tp_plan_001` | 126,201 | 16,524 | 1.044 |
| `tp_plan_packets_001` | 21,593 | 8,463 | 0.320 |
| `tp_s1_s10_batch` | 40,776 | 16,316 | 0.612 |
| `tp_s11_s14_batch` | 38,144 | 16,421 | 0.601 |
| `tp_t3_mismatched_throw_test` | 0 | 0 | 0 (skipped) |
| `tp_senior_review_and_fixes` | 182,702 | 11,735 | 1.207 |
| `tp_security_review` | 85,137 | 3,574 | 0.515 |
| **Opus subtotal (estimated-recomputed)** | | | **4.483** |
| Flash ×5 (vendor-metered, unchanged) | | | 3.132 |
| **RUN TOTAL** | | | **7.615** |

## Confidence and residual caveats

- The **output side is exact** (measured from committed artifacts). The **input side of the 4
  non-subagent packets is a reconstruction** from the spec's per-phase reads, not the actual
  prompt strings, which were never saved. A leaner reading (single pass, surgical codegen
  output) gives ≈ $7.0; a generous one (full post-tree re-emitted as output) ≈ $8.1. Point
  estimate **$7.62**, band **$7–8**.
- Still an upper bound: `cached = 0` per estimated mode, so a vendor run that cached
  `change_plan` / source across the codegen batches would bill less.
- The recomputed total lands on the `CMP-104/opus-only-v5` sibling ($6.15), which ran the
  identical refactor through the identical estimator — the expected result, and the reason
  the original $25.03 was flagged as an outlier.
- Cost still is **not a valid cross-policy axis** for this arm (mixed estimated + vendor
  bases). The correction removes a fabricated 3× inflation; it does not make the number
  vendor-authoritative.
