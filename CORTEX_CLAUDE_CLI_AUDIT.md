# Cortex: Claude-CLI Backend Audit

> Research-only document. No source files were modified.
> Generated: 2026-02-24

---

## 1. Where the claude-cli provider is defined

### Core definition: `src/agents/cli-backends.ts`

This is the canonical file. It contains:

- **`DEFAULT_CLAUDE_BACKEND`** (lines 36-62): The hardcoded default `CliBackendConfig` object for `claude-cli`.
- **`CLAUDE_MODEL_ALIASES`** (lines 15-33): Maps friendly names like `"opus"`, `"opus-4.6"`, `"sonnet"` to the CLI-expected short aliases.
- **`resolveCliBackendConfig()`** (line 163): Entry point that resolves a provider string to a backend config. When `normalized === "claude-cli"`, it merges `DEFAULT_CLAUDE_BACKEND` with any user-supplied overrides from `cfg.agents.defaults.cliBackends`.
- **`resolveCliBackendIds()`** (line 149): Returns the set of known CLI backend IDs. Always includes `"claude-cli"` and `"codex-cli"` plus any user-configured extras.

### Auth profile constant: `src/agents/auth-profiles/constants.ts`

```typescript
export const CLAUDE_CLI_PROFILE_ID = "anthropic:claude-cli";
```

### Provider ID normalization: `src/agents/model-selection.ts`

- **`normalizeProviderId()`** (line 62): Normalizes provider strings (lowercases, maps aliases). `"claude-cli"` passes through as `"claude-cli"`.
- **`isCliProvider()`** (line 87): Returns `true` for `"claude-cli"`, `"codex-cli"`, or anything in `cfg.agents.defaults.cliBackends`.

### Global defaults: `src/agents/defaults.ts`

```typescript
export const DEFAULT_PROVIDER = "anthropic";
export const DEFAULT_MODEL = "claude-opus-4-6";
export const DEFAULT_CONTEXT_TOKENS = 200_000;
```

These are the **API-mode** defaults (used by the Pi embedded runner). The CLI backend has its own default model: `"opus"` (set in `runClaudeCliAgent()`).

---

## 2. What the default backend config looks like

From `src/agents/cli-backends.ts`:

```typescript
const DEFAULT_CLAUDE_BACKEND: CliBackendConfig = {
  command: "claude",
  args: ["-p", "--output-format", "json", "--dangerously-skip-permissions"],
  resumeArgs: [
    "-p",
    "--output-format",
    "json",
    "--dangerously-skip-permissions",
    "--resume",
    "{sessionId}",
  ],
  output: "json",
  input: "arg",
  modelArg: "--model",
  modelAliases: CLAUDE_MODEL_ALIASES,
  sessionArg: "--session-id",
  sessionMode: "always",
  sessionIdFields: ["session_id", "sessionId", "conversation_id", "conversationId"],
  systemPromptArg: "--append-system-prompt",
  systemPromptMode: "append",
  systemPromptWhen: "first",
  clearEnv: ["ANTHROPIC_API_KEY", "ANTHROPIC_API_KEY_OLD"],
  reliability: {
    watchdog: {
      fresh: { noOutputTimeoutRatio: 0.8, minMs: 180_000, maxMs: 600_000 },
      resume: { noOutputTimeoutRatio: 0.3, minMs: 60_000, maxMs: 180_000 },
    },
  },
  serialize: true,
};
```

Key observations:

- **Binary**: `claude` (the Anthropic Claude CLI, expected on PATH)
- **Permissions**: `--dangerously-skip-permissions` (full auto-approve)
- **Session management**: always passes `--session-id`; resumes via `--resume {sessionId}`
- **System prompt**: appended on first message only (`--append-system-prompt`)
- **API key isolation**: clears `ANTHROPIC_API_KEY` from env (relies on OAuth/CLI credentials instead)
- **Serialization**: `serialize: true` -- runs are queued, not concurrent

### runClaudeCliAgent() wrapper (src/agents/cli-runner.ts, line 361)

```typescript
export async function runClaudeCliAgent(params) {
  return runCliAgent({
    ...params,
    provider: params.provider ?? "claude-cli",
    model: params.model ?? "opus", // <-- default model for CLI path
    cliSessionId: params.claudeSessionId,
  });
}
```

The default model when going through `runClaudeCliAgent()` is `"opus"`, which maps through `CLAUDE_MODEL_ALIASES` to the CLI's `"opus"` alias.

---

## 3. What files need to change to make claude-cli/opus the hardcoded default

### To make claude-cli the default provider (instead of anthropic API):

| File                                             | What to change                                                                                                                                  | Why                                                                                     |
| ------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| `src/agents/defaults.ts`                         | Change `DEFAULT_PROVIDER` to `"claude-cli"` and `DEFAULT_MODEL` to `"opus"`                                                                     | This is the global fallback when no config is set                                       |
| `src/agents/model-selection.ts`                  | `resolveConfiguredModelRef()` uses `DEFAULT_PROVIDER`/`DEFAULT_MODEL` as final fallback                                                         | No code change needed if defaults.ts is updated                                         |
| `src/commands/agent.ts`                          | Lines 121+: Already dispatches to `runCliAgent` when `isCliProvider()` is true. Would need to ensure the default path hits CLI, not embedded Pi | Check that `providerOverride` resolution defaults to `"claude-cli"`                     |
| `src/auto-reply/reply/agent-runner-execution.ts` | Lines 183+: The `runWithModelFallback` dispatcher already checks `isCliProvider()` and routes accordingly                                       | No code change needed -- will auto-route if provider resolves to CLI                    |
| `src/cron/isolated-agent/run.ts`                 | Lines 414+, 487+: Same pattern -- checks `isCliProvider()` before dispatch                                                                      | No code change needed                                                                   |
| `src/config/types.agent-defaults.ts`             | `cliBackends` field on `AgentDefaultsConfig`                                                                                                    | Only if you want to set config-level defaults; runtime defaults live in cli-backends.ts |

### To harden opus as the only model:

| File                            | What to change                                                                              | Why                                         |
| ------------------------------- | ------------------------------------------------------------------------------------------- | ------------------------------------------- |
| `src/agents/cli-backends.ts`    | Optionally remove or restrict `modelAliases` to opus-only variants                          | Prevents switching to sonnet/haiku via CLI  |
| `src/agents/cli-runner.ts`      | In `runClaudeCliAgent()`, hardcode model to `"opus"` (remove `params.model ??` fallthrough) | Forces opus regardless of config            |
| `src/agents/model-selection.ts` | In `resolveConfiguredModelRef()`, could short-circuit to return claude-cli/opus             | Nuclear option -- overrides all user config |

---

## 4. What the fallback chain looks like

### Model resolution chain (API-mode / embedded Pi):

```
1. Agent-specific model override (per-agent config)
   └─> resolveAgentEffectiveModelPrimary()

2. User config: agents.defaults.model.primary
   └─> resolveAgentModelPrimaryValue()

3. Alias resolution (agents.defaults.models[].alias)
   └─> buildModelAliasIndex() -> resolveModelRefFromString()

4. Global defaults: DEFAULT_PROVIDER / DEFAULT_MODEL
   └─> src/agents/defaults.ts: "anthropic" / "claude-opus-4-6"
```

### Provider dispatch chain:

```
User request arrives
  └─> Is provider override set?
       ├─ YES: isCliProvider(provider)?
       │    ├─ YES (claude-cli, codex-cli, custom): runCliAgent()
       │    └─ NO: runEmbeddedPiAgent() (API mode)
       └─ NO: resolve from config → same isCliProvider check
```

### CLI backend resolution chain:

```
resolveCliBackendConfig(provider, cfg)
  └─> normalize provider ID
  └─> Check user config: cfg.agents.defaults.cliBackends[provider]
  └─> If "claude-cli": merge DEFAULT_CLAUDE_BACKEND + user overrides
  └─> If "codex-cli": merge DEFAULT_CODEX_BACKEND + user overrides
  └─> Otherwise: use user config only (or null if not configured)
```

### Model fallback on error (src/agents/model-fallback.ts):

```
runWithModelFallback()
  1. Build candidate list:
     a. Primary model (from config or default)
     b. Fallback models (from agents.defaults.model.fallbacks[])
  2. Try each candidate in order
  3. On FailoverError (rate limit, auth, billing, timeout, etc.):
     └─> Try next candidate
  4. On AbortError: rethrow immediately (user cancellation)
  5. All candidates exhausted: throw summary error
```

### Auth credential chain for claude-cli:

```
src/agents/cli-credentials.ts
  └─> Reads ~/.claude/.credentials.json (OAuth tokens)
  └─> Falls back to macOS Keychain (service: "Claude Code-credentials")
  └─> Auth profile: "anthropic:claude-cli" (CLAUDE_CLI_PROFILE_ID)
  └─> Clears ANTHROPIC_API_KEY from env (prevents API key interference)
```

### Session persistence for CLI runs:

```
src/agents/cli-session.ts
  └─> getCliSessionId(entry, provider): reads from entry.cliSessionIds[normalized]
       └─> Legacy fallback for "claude-cli": entry.claudeCliSessionId
  └─> setCliSessionId(entry, provider, id): writes to both maps
```

---

## 5. Summary of key files

| File                                             | Role                                                                        |
| ------------------------------------------------ | --------------------------------------------------------------------------- |
| `src/agents/defaults.ts`                         | Global DEFAULT_PROVIDER ("anthropic") and DEFAULT_MODEL ("claude-opus-4-6") |
| `src/agents/cli-backends.ts`                     | DEFAULT_CLAUDE_BACKEND config, model aliases, backend resolution            |
| `src/agents/cli-runner.ts`                       | `runCliAgent()` + `runClaudeCliAgent()` -- actual CLI process execution     |
| `src/agents/claude-cli-runner.ts`                | Re-export shim (backwards compat)                                           |
| `src/agents/model-selection.ts`                  | `isCliProvider()`, `normalizeProviderId()`, model ref resolution            |
| `src/agents/model-fallback.ts`                   | `runWithModelFallback()` -- retry/failover across model candidates          |
| `src/agents/failover-error.ts`                   | `FailoverError` class -- triggers fallback attempts                         |
| `src/agents/cli-session.ts`                      | CLI session ID persistence (per-provider)                                   |
| `src/agents/cli-credentials.ts`                  | Claude CLI OAuth credential reading (~/.claude/.credentials.json)           |
| `src/agents/auth-profiles/constants.ts`          | `CLAUDE_CLI_PROFILE_ID = "anthropic:claude-cli"`                            |
| `src/agents/cli-watchdog-defaults.ts`            | Watchdog timeouts (fresh: 180-600s, resume: 60-180s)                        |
| `src/config/types.agent-defaults.ts`             | TypeScript types for `AgentDefaultsConfig.cliBackends`                      |
| `src/config/model-input.ts`                      | `resolveAgentModelPrimaryValue()` -- extracts primary from config           |
| `src/commands/agent.ts`                          | CLI command dispatch: `isCliProvider()` -> `runCliAgent()`                  |
| `src/auto-reply/reply/agent-runner-execution.ts` | Auto-reply dispatch: same `isCliProvider()` pattern                         |
| `src/cron/isolated-agent/run.ts`                 | Cron/heartbeat dispatch: same pattern                                       |

---

## 6. Minimal change to hardcode claude-cli as default

The smallest change to make `claude-cli` the default backend everywhere:

```typescript
// src/agents/defaults.ts
export const DEFAULT_PROVIDER = "claude-cli"; // was "anthropic"
export const DEFAULT_MODEL = "opus"; // was "claude-opus-4-6"
```

This would cause `resolveConfiguredModelRef()` to return `{ provider: "claude-cli", model: "opus" }` when no user config is present, and `isCliProvider("claude-cli")` would return `true`, routing all dispatch points to `runCliAgent()`.

**Risk**: Any code path that assumes `DEFAULT_PROVIDER` is an API provider (not a CLI provider) would need review. The embedded Pi runner path would never be reached by default.
