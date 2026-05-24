# AI Terminal - Implementation Blueprint

## 1) Product Goal
Build a production-grade Windows desktop AI Terminal that lets users write natural language, converts it to safe PowerShell commands, shows the exact command, requests approval when needed, and executes locally with full audit logs.

## 2) Target Architecture (Production-Oriented)

### 2.1 High-level components
1. `desktop/` (Electron main process)
2. `frontend/` (React renderer)
3. `backend/` (for API adapters/services in dev; optional in packaged desktop mode)
4. `shared/` (types, schemas, risk enums, policy contracts)
5. `storage/` (SQLite schema + migration files)

### 2.2 Runtime flow
1. User enters natural language.
2. Renderer sends prompt to Electron main through secure IPC.
3. Main calls `Orchestrator`.
4. `Orchestrator` asks selected LLM provider for JSON command proposal.
5. `PolicyEngine` validates and classifies risk.
6. Renderer receives proposal (intent, command, risk, explanation).
7. User approves/rejects.
8. On approval, `CommandExecutor` runs command and streams output.
9. `AuditService` writes full event trail to SQLite.

### 2.3 Trust boundaries
1. Renderer is untrusted; no direct shell access.
2. Main process owns execution rights.
3. LLM output is never executed directly; must pass schema + policy checks.

## 3) Repo Layout to Implement

Use this as target structure (incremental adoption allowed):

```txt
ai-terminal-poc/
  desktop/
    main.ts
    preload.ts
    ipc/
      channels.ts
      handlers.ts
  frontend/
    App.jsx
    src/
      components/
        TerminalView.jsx
        CommandPreviewCard.jsx
        ApprovalModal.jsx
      state/
        terminalStore.ts
      services/
        apiClient.ts
  backend/
    server.js
    src/
      orchestrator/
        orchestrator.ts
      llm/
        provider.interface.ts
        openai.provider.ts
        ollama.provider.ts
        providerFactory.ts
      policy/
        policyEngine.ts
        rules.ts
        riskClassifier.ts
      execution/
        powershellExecutor.ts
      audit/
        auditService.ts
      schemas/
        llmResponse.schema.ts
  shared/
    types/
      command.ts
      ipc.ts
      audit.ts
    constants/
      risk.ts
  storage/
    schema.sql
    migrations/
  tests/
    unit/
    integration/
    e2e/
  docs/
    IMPLEMENTATION_BLUEPRINT.md
```

## 4) Core Contracts (Build These First)

### 4.1 LLM response contract
All providers must return strict JSON:

```json
{
  "intent": "List files in Downloads",
  "command": "Get-ChildItem -Path $HOME\\Downloads",
  "riskLevel": "SAFE_READ",
  "needsConfirmation": false,
  "explanation": "Lists files in Downloads folder",
  "confidence": 0.92
}
```

### 4.2 Risk enum
1. `SAFE_READ`
2. `MUTATING`
3. `DESTRUCTIVE`
4. `BLOCKED`

### 4.3 IPC channels
1. `ai:proposeCommand`
2. `ai:approveAndExecute`
3. `ai:cancelCommand`
4. `ai:streamOutput`
5. `ai:getHistory`

## 5) Policy Engine Rules (V1)

### 5.1 Allowlist (initial)
1. `Get-ChildItem`
2. `Get-Location`
3. `Get-Content`
4. `Select-String`
5. `Get-Process`
6. `Get-Service`
7. `Get-Help`
8. `pwd`, `ls`, `cat` aliases mapped to PowerShell-native forms

### 5.2 Needs-confirmation commands
1. `New-Item`
2. `Set-Content`
3. `Copy-Item`
4. `Move-Item`
5. `Rename-Item`

### 5.3 Blocked commands
1. `Remove-Item -Recurse` (V1 block)
2. Disk/partition/system admin commands (`Format-*`, `diskpart`, registry writes)
3. Process kill families (`Stop-Process` without explicit allow)
4. Any command with command chaining (`;`, `&&`, `||`) in V1
5. Any encoded/obfuscated command patterns

### 5.4 Path safety
1. Protect system directories by default.
2. Block operations on `C:\Windows`, `C:\Program Files`, `C:\ProgramData` unless explicit future admin mode.

## 6) LLM Provider Plug-in Strategy

### 6.1 Interface
`provider.interface.ts`
1. `translate(input, context): Promise<CommandProposal>`
2. `healthCheck(): Promise<ProviderHealth>`
3. `name(): string`

### 6.2 Providers
1. `OpenAIProvider` using `OPENAI_API_KEY`
2. `OllamaProvider` for local models (`http://localhost:11434`)

### 6.3 Provider selection
1. User setting: `provider=openai|ollama`
2. Fallback: if selected provider fails, retry once on backup provider
3. Log provider + model for observability

## 7) Data Model (SQLite)

### 7.1 Tables
1. `sessions(id, started_at, user_label)`
2. `prompts(id, session_id, text, created_at)`
3. `proposals(id, prompt_id, intent, command, risk_level, confidence, explanation, created_at)`
4. `executions(id, proposal_id, approved, status, exit_code, stdout, stderr, started_at, ended_at)`
5. `settings(id, llm_provider, llm_model, telemetry_opt_in, created_at, updated_at)`

### 7.2 Audit requirements
1. Keep raw prompt and final executed command.
2. Keep approval event with timestamp.
3. Keep execution status and error details.

## 8) API/IPC Behavior Details

### 8.1 `proposeCommand`
Input: user prompt text
Output: proposal JSON + policy decision

### 8.2 `approveAndExecute`
Input: `proposalId`
Output: streaming chunks + final exit status

### 8.3 Failure behavior
1. Invalid LLM JSON -> one auto-retry.
2. Second failure -> return user-safe error.
3. Policy blocked -> never execute; return reasons.

## 9) Testing Plan (End-to-End)

### 9.1 Unit tests
1. `riskClassifier` classifies correctly.
2. `policyEngine` blocks known dangerous patterns.
3. LLM schema parser rejects malformed JSON.

### 9.2 Integration tests
1. Orchestrator + mock LLM + policy engine.
2. Executor returns stdout/stderr and exit code.
3. SQLite audit write/read cycle.

### 9.3 E2E tests (Electron + Playwright)
1. Happy path read command.
2. Mutating command requires confirmation.
3. Blocked command is denied.
4. LLM provider failover works.
5. Output streaming visible in UI.

### 9.4 Prompt benchmark pack
Create `tests/prompts/v1.json` with at least 50 prompts:
1. 30 read-only tasks
2. 15 mutating tasks
3. 5 malicious/injection tasks

Pass criteria:
1. >= 90% expected classification accuracy
2. 0 blocked-command bypasses

## 10) CI/CD Plan

### 10.1 CI jobs (on pull request)
1. Lint
2. Typecheck
3. Unit tests
4. Integration tests
5. Security scan (`npm audit` + dependency scanner)

### 10.2 Release pipeline
1. Build Electron Windows artifact.
2. Run smoke E2E.
3. Optional code-signing stage.
4. Publish installer to release channel.

## 11) Security Requirements (Production Grade)

1. `contextIsolation: true` in Electron.
2. `nodeIntegration: false` in renderer.
3. Strict IPC allowlist.
4. No direct `exec` from renderer.
5. Escape/sanitize all user-supplied paths and arguments.
6. Store API keys in secure env handling; never commit.
7. Telemetry is opt-in and redacted.

## 12) 4 Sprint Execution Plan

### Sprint 1 (Weekend MVP)
1. Terminal input/output UI.
2. `proposeCommand` flow via OpenAI.
3. Policy engine V1.
4. Confirmation modal.
5. Execute + show output.

Definition of done:
1. 20 manual prompts tested.
2. All destructive examples blocked.

### Sprint 2 (Hardening)
1. SQLite audit logging.
2. Better error handling + retries.
3. Session history UI.

### Sprint 3 (Provider Abstraction)
1. Provider interface.
2. OpenAI + Ollama adapters.
3. Provider switch in settings.

### Sprint 4 (Release Readiness)
1. Playwright E2E suite.
2. Installer build pipeline.
3. Documentation + onboarding.

## 13) Immediate Task List for This Repo

1. Convert backend to layered modules (`orchestrator`, `policy`, `execution`).
2. Add schema validation (Zod) for LLM responses.
3. Add provider interface and OpenAI provider.
4. Add command preview/approval UI in `frontend/App.jsx`.
5. Add execution streaming endpoint.
6. Add SQLite audit logging.
7. Add test harness (`vitest` + integration + Playwright skeleton).
8. Add `.env.example` with provider config.

## 14) Local Testing Checklist

1. Start backend.
2. Start frontend.
3. Run 10 safe prompts and verify outputs.
4. Run 5 mutating prompts and verify confirmation gate.
5. Run 5 dangerous prompts and verify blocking.
6. Verify audit logs are persisted.
7. Run automated tests and confirm green status.

## 15) Acceptance Criteria for Public Beta

1. Stable local execution for common file/process queries.
2. Clear user visibility before command execution.
3. No critical policy bypass in tests.
4. LLM provider switch works without code changes.
5. Installation and first-run setup documented.

---

This blueprint is intentionally implementation-ready so development can proceed module by module without redesign.

## 16) Implementation Status (Updated: 2026-05-24)

### 16.1 Overall completion
1. Blueprint execution progress: `~89%` of immediate foundation tasks.
2. Sprint 1 (Weekend MVP) progress: `~93%` of core flow.

### 16.2 Completed
1. Backend modularized into layered modules:
   `orchestrator`, `policy`, `execution`, `llm`, `schemas`, `audit`.
2. Two-step command lifecycle implemented:
   `/propose` -> `/execute-approved`.
3. LLM proposal schema validation migrated to `zod`.
4. Policy engine added with allowlist/block patterns and risk classification.
5. Provider runtime now supports environment-based OpenRouter/OpenAI configuration.
6. Frontend updated to proposal-first flow with explicit approval before execution.
7. SQLite-backed audit persistence added (`backend/storage/audit.db`) with schema bootstrap.
8. Environment templates expanded (`backend/.env.example`) and runtime `.env` loading enabled via `dotenv`.
9. Execution streaming endpoint added via SSE (`/execute-approved-stream`) with chunked stdout/stderr events.
10. Natural-language CLI wrapper added (`npm run ai -- "..."`) with proposal visibility, approval prompt, and execution flow.
11. LLM diagnostics added (`translationMode`: `llm | deterministic | mock_fallback | mock_no_client`) and surfaced in CLI output.
12. LLM response parsing/normalization hardened to handle fenced JSON, mixed text, and confidence/type normalization.

### 16.3 Partially completed
1. Provider switching works through `.env` configuration, but is not yet exposed in frontend settings UI.
2. Deterministic rules currently cover a small set of high-frequency prompts (`.md` create/delete, working directory). Broader NL coverage still relies on live LLM output quality.

### 16.4 Pending
1. Automated test harness (`vitest` unit/integration + Playwright E2E).
2. Provider switch UI/settings and optional local provider (`ollama`) runtime integration.
3. CI pipeline and security checks automation.
4. Installer/packaging path for zero-setup end-user CLI/Desktop onboarding.

### 16.5 Immediate next implementation steps
1. Add unit tests for `policyEngine`, schema validator, and LLM payload normalization.
2. Add integration tests for `/propose`, `/execute-approved`, `/execute-approved-stream`, and CLI happy-path flows.
3. Add frontend settings flow for provider/model selection and strict-mode toggle.
4. Add CI checks for lint/test/security scan.

### 16.6 Current Validation Snapshot
1. Real OpenRouter path is verified and visible in CLI output as `Source: openrouter (llm)`.
2. Fallback behavior is diagnosable via `translationMode` and can be forced to fail-fast with `LLM_STRICT_MODE=true`.
3. Operational note: stale Node listeners on port `5000` can mask new code changes; clean restart is required during iterative local testing.
