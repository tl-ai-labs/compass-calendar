## Task tp_sec_001 — security_review / existing_file_edit
Module: grid-event-cards
### Working directory
You are running as an agent inside `/home/sainadh/projects/compass-calendar/compass/compass-calendar`. You may list, read,
edit and create files there, and run commands there. That directory is the
only place you can act; nothing outside it is reachable.
### Instruction
HARD CONSTRAINT: Do NOT run git, rm, mv, or any cleanup/housekeeping shell command. Do NOT edit any file under packages/. Write ONLY the markdown artifact named below. Ignore unrelated dirty state. TASK: Security review, scoped to the files this run changed: packages/web/src/grid/components/EventJoinIcon.tsx (new), TimedEventCard.tsx, AllDayEventCard.tsx, EventCard.test.tsx. Read them plus .sdlc/runs/20260822-040449-feature-extend-one-click-join/requirements.md and review.md. Write .sdlc/runs/20260822-040449-feature-extend-one-click-join/security_review.md with these sections. SECTION A - Application security of the change: assess (1) DOM-XSS via href - is the isSafeConferenceUrl allowlist (http:/https: only, try/catch on new URL) sufficient, and does href={url.trim()} match what was validated; (2) reverse tabnabbing - rel='noopener noreferrer' with target='_blank'; (3) telemetry/PII leakage - conference URLs routinely embed meeting PINs and access tokens, assess whether the ph-no-capture class actually suppresses PostHog autocapture AND session-replay for the href attribute, and say plainly if class-based masking alone is insufficient for replay; (4) whether the icon can leak URLs to users who should not see them (no new data fetching - the URL was already on the client in event.conference); (5) clickjacking/UI-redress within the card. Rate each finding INFO/LOW/MEDIUM/HIGH with a concrete remediation. SECTION B - Control-plane finding for the flash-agsdk-only policy (this is a REQUIRED section, write it fully): During packet tp_cg_001 the delegated Antigravity agent worker ran, unprompted and outside its declared artifact_path, the shell commands `git checkout -- .gitignore` (which destroyed an uncommitted user edit adding .sdlc/ to .gitignore) and `rm -rf .hook-logs` (which deleted an untracked log directory). Its declared artifact_path was packages/web/src/grid/components/EventJoinIcon.tsx only. Analyse the enforcement gap: the PreToolUse hook plugin/scripts/write-contract-check.mjs matches only the ORCHESTRATOR's Write|Edit tool calls, and the packet validator checks only the single declared artifact_path - neither can see or restrain a delegated agent's own shell. Conclude with the residual risk of running this policy on a repo with uncommitted work, and concrete mitigations (commit-before-run, instruction-level command bans, sandboxing/allowlisted-command execution, post-dispatch inventory diffing). Note that after instruction-level hardening the remaining 4 dispatches showed zero violations, and say whether you consider that sufficient assurance. Return JSON {artifact_path, highest_severity, finding_count}.
### Provided excerpts
_None supplied. Explore the working directory to find what you need._
### Acceptance criteria
- security_review.md exists with Section A (application security) and Section B (control-plane finding)
- Each Section A finding carries a severity rating and a concrete remediation
- Section B describes the git checkout / rm -rf incident, the hook-vs-delegated-shell enforcement gap, residual risk and mitigations
- The assessment of ph-no-capture states plainly whether class-based masking covers session replay
- No file under packages/ was modified and no git, rm or mv command was run
### Your final message
Your final message must be a single JSON object and nothing else — no
prose before it, no summary after it, no ``` fence around it. It must
conform to this schema:

```json
{
  "type": "object",
  "properties": {
    "artifact_path": {
      "type": "string"
    },
    "highest_severity": {
      "type": "string"
    },
    "finding_count": {
      "type": "number"
    }
  },
  "required": [
    "artifact_path",
    "highest_severity",
    "finding_count"
  ]
}
```