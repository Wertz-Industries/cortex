# Cortex Rebrand: Hardcoded Paths & Service Names Audit

**Date:** 2026-02-24
**Purpose:** Document all hardcoded "openclaw" references that need to change for the Cortex rebrand.
**Status:** Research only -- no source files modified.

---

## 1. Config Directory: `~/.openclaw` --> `~/.cortex`

### Primary definition (single source of truth)

| File                  | Line | Current Value                                                     |
| --------------------- | ---- | ----------------------------------------------------------------- |
| `src/config/paths.ts` | 22   | `const NEW_STATE_DIRNAME = ".openclaw"`                           |
| `src/config/paths.ts` | 23   | `const CONFIG_FILENAME = "openclaw.json"`                         |
| `src/config/paths.ts` | 226  | `suffix = uid != null ? "openclaw-${uid}" : "openclaw"` (tmp dir) |

### Other source references

| File                               | Line   | Context                                                              |
| ---------------------------------- | ------ | -------------------------------------------------------------------- |
| `src/infra/exec-approvals.ts`      | 93-94  | `~/.openclaw/exec-approvals.sock`, `~/.openclaw/exec-approvals.json` |
| `src/infra/dotenv.ts`              | 12     | Comment: `~/.openclaw/.env`                                          |
| `src/infra/install-package-dir.ts` | 65     | `.openclaw-install-backups`                                          |
| `src/infra/tmp-openclaw-dir.ts`    | 5      | `POSIX_OPENCLAW_TMP_DIR = "/tmp/openclaw"`                           |
| `src/infra/tmp-openclaw-dir.ts`    | 65     | `"openclaw"` / `"openclaw-${uid}"` fallback suffix                   |
| `src/test-utils/temp-home.ts`      | 21, 26 | Creates `.openclaw` in temp dirs                                     |
| `src/config/schema.help.ts`        | 715    | `~/.openclaw/memory/{agentId}.sqlite`                                |
| `src/config/schema.help.ts`        | 860    | `~/.openclaw/extensions/<id>`                                        |

### UI / i18n strings

| File                           | Line | String                                     |
| ------------------------------ | ---- | ------------------------------------------ |
| `ui/src/i18n/locales/en.ts`    | 51   | `"Edit ~/.openclaw/openclaw.json safely."` |
| `ui/src/i18n/locales/zh-CN.ts` | 51   | Same in Chinese (simplified)               |
| `ui/src/i18n/locales/zh-TW.ts` | 51   | Same in Chinese (traditional)              |
| `ui/src/i18n/locales/pt-BR.ts` | 51   | Same in Portuguese                         |

### Shell scripts & deployment

| File                             | Lines        | Context                                                                  |
| -------------------------------- | ------------ | ------------------------------------------------------------------------ |
| `setup-podman.sh`                | 160          | `OPENCLAW_CONFIG="$OPENCLAW_HOME/.openclaw"`                             |
| `docker-setup.sh`                | 67-68        | `OPENCLAW_CONFIG_DIR`, `OPENCLAW_WORKSPACE_DIR` default to `~/.openclaw` |
| `docker-setup.sh`                | 131-132      | Docker mount `/home/node/.openclaw`                                      |
| `docker-compose.yml`             | 12-13, 41-42 | Volume mounts to `/home/node/.openclaw`                                  |
| `render.yaml`                    | 13           | `value: /data/.openclaw`                                                 |
| `scripts/e2e/onboard-docker.sh`  | 303+         | Multiple refs to `~/.openclaw/openclaw.json`                             |
| `scripts/restart-mac.sh`         | 230          | Reads `~/.openclaw/openclaw.json`                                        |
| `scripts/run-openclaw-podman.sh` | 150          | `CONFIG_JSON="$CONFIG_DIR/openclaw.json"`                                |

### Docs references

| File                                    | Context                                                            |
| --------------------------------------- | ------------------------------------------------------------------ |
| `docs/tools/plugin.md`                  | `~/.openclaw/mpm/catalog.json`, `~/.openclaw/plugins/catalog.json` |
| `docs/tools/browser.md`                 | `/tmp/openclaw/uploads/`, `/tmp/openclaw` traces                   |
| `docs/platforms/mac/bundled-gateway.md` | `/tmp/openclaw/openclaw-gateway.log`                               |
| `docs/platforms/mac/health.md`          | `/tmp/openclaw/openclaw-*.log`                                     |
| `docs/platforms/mac/release.md`         | `/tmp/openclaw-notary.p8`                                          |
| `docs/install/uninstall.md`             | `~/.openclaw` removal instructions                                 |

---

## 2. Bundle IDs: `ai.openclaw.*` --> `ai.wertz.cortex.*`

### Primary definitions

| File                                          | Line | Current Value                                | Proposed                        |
| --------------------------------------------- | ---- | -------------------------------------------- | ------------------------------- |
| `src/daemon/constants.ts`                     | 2    | `ai.openclaw.gateway`                        | `ai.wertz.cortex.gateway`       |
| `src/daemon/constants.ts`                     | 7    | `ai.openclaw.node`                           | `ai.wertz.cortex.node`          |
| `src/daemon/constants.ts`                     | 38   | `ai.openclaw.${normalized}` (profile labels) | `ai.wertz.cortex.${normalized}` |
| `apps/macos/Sources/OpenClaw/Constants.swift` | 5    | `ai.openclaw.mac`                            | `ai.wertz.cortex.mac`           |
| `apps/macos/Sources/OpenClaw/Constants.swift` | 6    | `ai.openclaw.gateway`                        | `ai.wertz.cortex.gateway`       |

### macOS Logger subsystem

| File                                                              | Current                                 |
| ----------------------------------------------------------------- | --------------------------------------- |
| `apps/macos/Sources/OpenClaw/WebChatSwiftUI.swift`                | `Logger(subsystem: "ai.openclaw", ...)` |
| `apps/macos/Sources/OpenClaw/DeepLinks.swift`                     | `Logger(subsystem: "ai.openclaw", ...)` |
| `apps/macos/Sources/OpenClaw/VoiceWakeGlobalSettingsSync.swift`   | `Logger(subsystem: "ai.openclaw", ...)` |
| `apps/macos/Sources/OpenClaw/MicLevelMonitor.swift`               | `Logger(subsystem: "ai.openclaw", ...)` |
| `apps/macos/Sources/OpenClaw/CronJobsStore.swift`                 | `Logger(subsystem: "ai.openclaw", ...)` |
| `apps/macos/Sources/OpenClaw/RuntimeLocator.swift`                | `Logger(subsystem: "ai.openclaw", ...)` |
| `apps/macos/Sources/OpenClaw/CanvasManager.swift`                 | `Logger(subsystem: "ai.openclaw", ...)` |
| `apps/macos/Sources/OpenClaw/DevicePairingApprovalPrompter.swift` | `Logger(subsystem: "ai.openclaw", ...)` |
| `apps/macos/Sources/OpenClaw/SessionMenuPreviewView.swift`        | `Logger(subsystem: "ai.openclaw", ...)` |
| `apps/macos/Sources/OpenClaw/VoicePushToTalk.swift`               | `Logger(subsystem: "ai.openclaw", ...)` |

### macOS dispatch queues

| File                                                  | Current                                   |
| ----------------------------------------------------- | ----------------------------------------- |
| `apps/macos/Sources/OpenClaw/ConfigFileWatcher.swift` | `queueLabel: "ai.openclaw.configwatcher"` |
| `apps/macos/Sources/OpenClaw/CanvasFileWatcher.swift` | `queueLabel: "ai.openclaw.canvaswatcher"` |

### Scripts & packaging

| File                                  | Current                                                |
| ------------------------------------- | ------------------------------------------------------ |
| `scripts/package-mac-app.sh`          | `BUNDLE_ID=ai.openclaw.mac.debug`                      |
| `scripts/package-mac-dist.sh`         | `BUNDLE_ID=ai.openclaw.mac`                            |
| `scripts/clawlog.sh`                  | `SUBSYSTEM="ai.openclaw"`                              |
| `scripts/restart-mac.sh`              | `ai.openclaw.mac.plist`, `ai.openclaw.mac`             |
| `scripts/ios-configure-signing.sh`    | `ai.openclaw.ios.test.local`, `ai.openclaw.ios.test.*` |
| `scripts/dev/ios-pull-gateway-log.sh` | `ai.openclaw.ios.dev.*`                                |

### Mobile apps

| File                                                | Current                                     |
| --------------------------------------------------- | ------------------------------------------- |
| `package.json` (android:run)                        | `ai.openclaw.android/.MainActivity`         |
| `package.json` (ios:run)                            | `ai.openclaw.ios`                           |
| `apps/ios/ShareExtension/ShareViewController.swift` | `Logger(subsystem: "ai.openclaw.ios", ...)` |

### LaunchAgent plist path

| File                     | Current                                        |
| ------------------------ | ---------------------------------------------- |
| `scripts/restart-mac.sh` | `~/Library/LaunchAgents/ai.openclaw.mac.plist` |
| `src/daemon/inspect.ts`  | `label.startsWith("ai.openclaw.")`             |

---

## 3. Environment Variables: `OPENCLAW_*` --> `CORTEX_*`

### Critical env vars (used in production logic)

| Variable                            | Files                                                                                                   |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------- |
| `OPENCLAW_HOME`                     | `src/infra/home-dir.ts`, `test/helpers/temp-home.ts`                                                    |
| `OPENCLAW_STATE_DIR`                | `src/config/paths.ts`, `src/infra/state-migrations.ts`, `test/test-env.ts`, `test/helpers/temp-home.ts` |
| `OPENCLAW_CONFIG_PATH`              | `src/config/paths.ts` (via resolveConfigPath)                                                           |
| `OPENCLAW_CONFIG_DIR`               | `docker-setup.sh`, `docker-compose.yml`                                                                 |
| `OPENCLAW_WORKSPACE_DIR`            | `docker-setup.sh`, `docker-compose.yml`                                                                 |
| `OPENCLAW_GATEWAY_TOKEN`            | `src/pairing/setup-code.ts`, `src/config/io.ts`, `setup-podman.sh`, `docker-setup.sh`                   |
| `OPENCLAW_GATEWAY_PASSWORD`         | `src/pairing/setup-code.ts`, `src/config/io.ts`                                                         |
| `OPENCLAW_GATEWAY_PORT`             | `src/pairing/setup-code.ts`                                                                             |
| `OPENCLAW_PROFILE`                  | `src/infra/restart.ts`                                                                                  |
| `OPENCLAW_LAUNCHD_LABEL`            | `src/infra/restart.ts`                                                                                  |
| `OPENCLAW_SYSTEMD_UNIT`             | `src/infra/restart.ts`                                                                                  |
| `OPENCLAW_DIAGNOSTICS`              | `src/infra/diagnostic-flags.ts`                                                                         |
| `OPENCLAW_LOAD_SHELL_ENV`           | `src/infra/shell-env.ts`                                                                                |
| `OPENCLAW_DEFER_SHELL_ENV_FALLBACK` | `src/infra/shell-env.ts`                                                                                |
| `OPENCLAW_SHELL_ENV_TIMEOUT_MS`     | `src/infra/shell-env.ts`                                                                                |
| `OPENCLAW_DISABLE_BONJOUR`          | `src/infra/bonjour.ts`                                                                                  |
| `OPENCLAW_MDNS_HOSTNAME`            | `src/infra/bonjour.ts`                                                                                  |
| `OPENCLAW_WIDE_AREA_DOMAIN`         | `src/infra/widearea-dns.ts`                                                                             |
| `OPENCLAW_ALLOW_MULTI_GATEWAY`      | `src/infra/gateway-lock.ts`                                                                             |
| `OPENCLAW_ALLOW_PROJECT_LOCAL_BIN`  | `src/infra/path-env.ts`                                                                                 |
| `OPENCLAW_PATH_BOOTSTRAPPED`        | `src/infra/path-env.ts`                                                                                 |
| `OPENCLAW_AUTO_UPDATE`              | `src/infra/update-startup.ts`                                                                           |
| `OPENCLAW_UPDATE_IN_PROGRESS`       | `src/infra/update-runner.ts`                                                                            |
| `OPENCLAW_NO_RESPAWN`               | `src/infra/process-respawn.ts`                                                                          |
| `OPENCLAW_AGENT_DIR`                | `src/infra/state-migrations.ts`                                                                         |
| `OPENCLAW_SESSION_CACHE_TTL_MS`     | `src/config/sessions/store.ts`                                                                          |
| `OPENCLAW_WATCH_MODE`               | `src/config/io.ts`                                                                                      |
| `OPENCLAW_APNS_TEAM_ID`             | `src/infra/push-apns.ts`                                                                                |
| `OPENCLAW_APNS_KEY_ID`              | `src/infra/push-apns.ts`                                                                                |
| `OPENCLAW_APNS_PRIVATE_KEY_P8`      | `src/infra/push-apns.ts`                                                                                |
| `OPENCLAW_APNS_PRIVATE_KEY`         | `src/infra/push-apns.ts`                                                                                |
| `OPENCLAW_APNS_PRIVATE_KEY_PATH`    | `src/infra/push-apns.ts`                                                                                |
| `OPENCLAW_IMAGE`                    | `docker-setup.sh`, `docker-compose.yml`                                                                 |
| `OPENCLAW_CONTROL_UI_BASE_PATH`     | `ui/vite.config.ts`                                                                                     |

### Test-only env vars

| Variable                              | Files                            |
| ------------------------------------- | -------------------------------- |
| `OPENCLAW_TEST_PROFILE`               | test config                      |
| `OPENCLAW_TEST_SERIAL_GATEWAY`        | test config                      |
| `OPENCLAW_TEST_TAILSCALE_BINARY`      | `src/infra/tailscale.ts`         |
| `OPENCLAW_TEST_FAST`                  | `src/memory/manager-sync-ops.ts` |
| `OPENCLAW_TEST_MEMORY_UNSAFE_REINDEX` | `src/memory/manager-sync-ops.ts` |
| `OPENCLAW_DEBUG_MEMORY_EMBEDDINGS`    | `src/memory/embeddings-debug.ts` |

### Podman-specific env vars

| Variable                  | Files                 |
| ------------------------- | --------------------- |
| `OPENCLAW_PODMAN_QUADLET` | `setup-podman.sh`     |
| `OPENCLAW_PODMAN_USER`    | `setup-podman.sh`     |
| `OPENCLAW_REPO_PATH`      | `setup-podman.sh`     |
| `OPENCLAW_PODMAN_ENV`     | `openclaw.podman.env` |

### Global window variables (Control UI)

| Variable                                   | Files                                           |
| ------------------------------------------ | ----------------------------------------------- |
| `window.__OPENCLAW_CONTROL_UI_BASE_PATH__` | `ui/src/ui/app-settings.ts`, `ui/src/ui/app.ts` |

---

## 4. Service Names & Identifiers

### systemd service names

| Current                                | Proposed                             | Files                                                  |
| -------------------------------------- | ------------------------------------ | ------------------------------------------------------ |
| `openclaw-gateway`                     | `cortex-gateway`                     | `src/daemon/constants.ts:3`, docs/platforms/\*.md      |
| `openclaw-gateway[-<profile>].service` | `cortex-gateway[-<profile>].service` | `docs/platforms/linux.md`, `docs/install/uninstall.md` |
| `openclaw-node`                        | `cortex-node`                        | `src/daemon/constants.ts:8`                            |

### Docker service names

| Current                                 | Proposed                       | Files                                             |
| --------------------------------------- | ------------------------------ | ------------------------------------------------- |
| `openclaw-gateway` (compose service)    | `cortex-gateway`               | `docker-compose.yml:2`, `docker-setup.sh:125,280` |
| `openclaw-cli` (compose service)        | `cortex-cli`                   | `docker-compose.yml:30`                           |
| `openclaw:local` (image)                | `cortex:local`                 | `docker-setup.sh:7`, `setup-podman.sh:207,212`    |
| `openclaw-sandbox-browser` (network)    | `cortex-sandbox-browser`       | `src/config/types.sandbox.ts:61`                  |
| `openclaw-sandbox:bookworm-slim`        | `cortex-sandbox:bookworm-slim` | `Dockerfile.sandbox-common:1`                     |
| `openclaw-sandbox-browser` (entrypoint) | `cortex-sandbox-browser`       | `Dockerfile.sandbox-browser:23-24,32`             |

### Fly.io app name

| Current                  | Files                                |
| ------------------------ | ------------------------------------ |
| `app = "openclaw"`       | `fly.toml:4`                         |
| `app = "my-openclaw"`    | `fly.private.toml:12`                |
| `openclaw_data` (volume) | `fly.toml:33`, `fly.private.toml:38` |

### Render service name

| Current               | Files            |
| --------------------- | ---------------- |
| `name: openclaw`      | `render.yaml:3`  |
| `name: openclaw-data` | `render.yaml:19` |

---

## 5. Bonjour / mDNS / DNS-SD Service Identifiers

| Current                                     | Proposed                   | Files                                                          |
| ------------------------------------------- | -------------------------- | -------------------------------------------------------------- |
| `_openclaw-gw._tcp`                         | `_cortex-gw._tcp`          | `src/infra/bonjour-discovery.ts:32,194,382`                    |
| `type: "openclaw-gw"`                       | `type: "cortex-gw"`        | `src/infra/bonjour.ts:150`                                     |
| `"openclaw"` (machine name fallback)        | `"cortex"`                 | `src/infra/bonjour.ts:100,105`, `src/infra/machine-name.ts:27` |
| `_openclaw-gw._tcp` (widearea DNS)          | `_cortex-gw._tcp`          | `src/infra/widearea-dns.ts:147-149`                            |
| `openclaw-content-hash`                     | `cortex-content-hash`      | `src/infra/widearea-dns.ts:77,159`                             |
| `"openclaw"` / `"openclaw-gw"` (DNS labels) | `"cortex"` / `"cortex-gw"` | `src/infra/widearea-dns.ts:108,109`                            |

---

## 6. Log File Paths

| Current                               | Proposed                         | Files                                   |
| ------------------------------------- | -------------------------------- | --------------------------------------- |
| `/tmp/openclaw/`                      | `/tmp/cortex/`                   | `src/infra/tmp-openclaw-dir.ts`         |
| `/tmp/openclaw/openclaw-gateway.log`  | `/tmp/cortex/cortex-gateway.log` | `docs/platforms/mac/bundled-gateway.md` |
| `/tmp/openclaw-gateway.log`           | `/tmp/cortex-gateway.log`        | `scripts/build-and-run-mac.sh:16`       |
| `/tmp/openclaw-notary.p8`             | `/tmp/cortex-notary.p8`          | `docs/platforms/mac/release.md`         |
| `openclaw-logs-${label}-${stamp}.log` | `cortex-logs-...`                | `ui/src/ui/app-scroll.ts:159`           |

---

## 7. Custom HTTP Headers

| Current                                    | Proposed                               | Files                                                              |
| ------------------------------------------ | -------------------------------------- | ------------------------------------------------------------------ |
| `x-openclaw-message-channel`               | `x-cortex-message-channel`             | `src/gateway/tools-invoke-http.ts:213`                             |
| `x-openclaw-account-id`                    | `x-cortex-account-id`                  | `src/gateway/tools-invoke-http.ts:215`                             |
| `x-openclaw-message-to`                    | `x-cortex-message-to`                  | `src/gateway/tools-invoke-http.ts:216`                             |
| `x-openclaw-thread-id`                     | `x-cortex-thread-id`                   | `src/gateway/tools-invoke-http.ts:217`                             |
| `x-openclaw-token`                         | `x-cortex-token`                       | `src/gateway/hooks.ts:168`                                         |
| `x-openclaw-password`                      | `x-cortex-password`                    | `src/browser/http-auth.ts:51`, `src/browser/client-fetch.ts:36,51` |
| `x-openclaw-relay-token`                   | `x-cortex-relay-token`                 | `src/browser/extension-relay.ts:84`                                |
| `x-openclaw-agent-id` / `x-openclaw-agent` | `x-cortex-agent-id` / `x-cortex-agent` | `src/gateway/http-utils.ts:27-28`                                  |
| `x-openclaw-session-key`                   | `x-cortex-session-key`                 | `src/gateway/http-utils.ts:71`                                     |

---

## 8. Internal Symbols & Keys

### Project name constant

| File                           | Current                                  |
| ------------------------------ | ---------------------------------------- |
| `src/compat/legacy-names.ts:1` | `export const PROJECT_NAME = "openclaw"` |

### localStorage keys

| Key                    | Files                                |
| ---------------------- | ------------------------------------ |
| `openclaw.i18n.locale` | `ui/src/i18n/lib/translate.ts:22,78` |

### Global symbols / state keys

| Current                                             | Files                                             |
| --------------------------------------------------- | ------------------------------------------------- |
| `Symbol.for("openclaw.warning-filter")`             | `src/infra/warning-filter.ts:1`                   |
| `Symbol.for("openclaw.fetch.abort-signal-wrapped")` | `src/infra/fetch.ts:9`                            |
| `__openclawDiagnosticEventsState`                   | `src/infra/diagnostic-events.ts:179-188`          |
| `__openclawDiscordThreadBindingsState`              | `src/discord/monitor/thread-bindings.state.ts:30` |
| `__OPENCLAW_REDACTED__`                             | `src/config/redact-snapshot.ts:33`                |
| `__openclaw` (message marker)                       | `ui/src/ui/views/chat.ts:545`                     |
| `___openclaw__/cap` (canvas capability prefix)      | `src/gateway/canvas-capability.ts:3`              |

### macOS UserDefaults keys (Constants.swift)

All keys prefixed with `openclaw.` in `apps/macos/Sources/OpenClaw/Constants.swift`:

- `openclaw.onboardingVersion`, `openclaw.onboardingSeen`
- `openclaw.pauseEnabled`, `openclaw.iconAnimationsEnabled`
- `openclaw.swabbleEnabled`, `openclaw.swabbleTriggers`
- `openclaw.voiceWakeTriggerChime`, `openclaw.voiceWakeSendChime`
- `openclaw.showDockIcon`
- `openclaw.voiceWakeMicID`, `openclaw.voiceWakeMicName`
- `openclaw.voiceWakeLocaleID`, `openclaw.voiceWakeAdditionalLocaleIDs`
- `openclaw.voicePushToTalkEnabled`, `openclaw.talkEnabled`
- `openclaw.iconOverride`, `openclaw.connectionMode`
- `openclaw.remoteTarget`, `openclaw.remoteIdentity`
- `openclaw.remoteProjectRoot`, `openclaw.remoteCliPath`
- `openclaw.canvasEnabled`, `openclaw.cameraEnabled`
- `openclaw.systemRunPolicy`, `openclaw.systemRunAllowlist`, `openclaw.systemRunEnabled`
- `openclaw.locationMode`, `openclaw.locationPreciseEnabled`
- `openclaw.peekabooBridgeEnabled`, `openclaw.deepLinkKey`
- `openclaw.modelCatalogPath`, `openclaw.modelCatalogReload`
- `openclaw.cliInstallPromptedVersion`
- `openclaw.heartbeatsEnabled`, `openclaw.debugPaneEnabled`
- `openclaw.debug.fileLogEnabled`, `openclaw.debug.appLogLevel`

### Voice wake triggers default

| Current                              | Files                                            |
| ------------------------------------ | ------------------------------------------------ |
| `["openclaw"]`                       | `apps/macos/Sources/OpenClaw/Constants.swift:17` |
| `["openclaw", "claude", "computer"]` | `src/infra/voicewake.ts:10`                      |

### iOS deep link scheme

| Current       | Proposed    | Files                                                                 |
| ------------- | ----------- | --------------------------------------------------------------------- |
| `openclaw://` | `cortex://` | `apps/ios/Tests/DeepLinkParserTests.swift` (multiple), iOS app source |

### Slack slash command default

| Current                              | Files                          |
| ------------------------------------ | ------------------------------ |
| `"openclaw"` (default slash command) | `src/config/types.slack.ts:65` |

### OTel attribute prefixes

| Current                   | Files                                            |
| ------------------------- | ------------------------------------------------ |
| `openclaw.log.level`      | `extensions/diagnostics-otel/src/service.ts:310` |
| `openclaw.logger`         | `extensions/diagnostics-otel/src/service.ts:313` |
| `openclaw.logger.parents` | `extensions/diagnostics-otel/src/service.ts:316` |
| `openclaw.log.args`       | `extensions/diagnostics-otel/src/service.ts:332` |

### Daemon inspection markers

| Current                   | Files                                                         |
| ------------------------- | ------------------------------------------------------------- |
| `openclaw_service_marker` | `src/daemon/inspect.ts:74`                                    |
| `openclaw_service_kind`   | `src/daemon/inspect.ts:75`                                    |
| Marker value `"openclaw"` | `src/daemon/inspect.ts:17,25`, `src/daemon/constants.ts:5,10` |

---

## 9. npm / Package Identity

| Current                           | Proposed                       | Files                                                                                                  |
| --------------------------------- | ------------------------------ | ------------------------------------------------------------------------------------------------------ |
| `"openclaw"` (npm package)        | `"cortex"` / `"@wertz/cortex"` | `src/infra/update-check.ts:304`, `src/infra/update-global.ts:13`, `src/infra/update-runner.ts:85`      |
| `"openclaw"` (package name match) | ditto                          | `src/infra/openclaw-root.ts:6`, `src/infra/control-ui-assets.ts:104`                                   |
| `"openclaw"` (binary name)        | `"cortex"`                     | `src/infra/path-env.ts:64,79`, `src/infra/gateway-lock.ts:69,78`                                       |
| `openclaw.mjs` (entry point)      | `cortex.mjs`                   | `cortex.mjs` (root), `Dockerfile:65`, `src/infra/gateway-lock.ts:69`, `src/infra/update-runner.ts:750` |
| `package.json` scripts            | ditto                          | `package.json:101-102` (`"openclaw": "node scripts/run-node.mjs"`)                                     |

---

## 10. External URLs (docs.openclaw.ai)

Approximately 50+ references to `https://docs.openclaw.ai/*` across:

- `ui/src/ui/app-render.ts`, `ui/src/ui/views/overview.ts`
- `src/gateway/gateway-config-prompts.shared.ts`
- `src/daemon/launchd.ts`
- `docker-setup.sh`
- `CHANGELOG.md` (historical -- may keep as-is)
- All docs under `docs/`

**Proposed:** `https://docs.cortex.wertz.dev/*` (or chosen domain)

---

## 11. Files to Rename

| Current                          | Proposed                       |
| -------------------------------- | ------------------------------ |
| `openclaw.mjs` (root)            | `cortex.mjs`                   |
| `openclaw.podman.env`            | `cortex.podman.env`            |
| `src/infra/openclaw-root.ts`     | `src/infra/cortex-root.ts`     |
| `src/infra/tmp-openclaw-dir.ts`  | `src/infra/tmp-cortex-dir.ts`  |
| `src/config/types.openclaw.ts`   | `src/config/types.cortex.ts`   |
| `src/agents/openclaw-tools.ts`   | `src/agents/cortex-tools.ts`   |
| `scripts/run-openclaw-podman.sh` | `scripts/run-cortex-podman.sh` |

---

## 12. Migration Considerations

### State migration (legacy support)

- `src/infra/state-migrations.ts` already handles `.moltbot` --> `.openclaw` migration
- Will need a new migration: `.openclaw` --> `.cortex`
- Legacy env vars (`CLAWDBOT_*`) are still supported as fallbacks in several places
- Need to add `OPENCLAW_*` as legacy fallbacks alongside new `CORTEX_*` vars

### Daemon inspection (multi-brand detection)

- `src/daemon/inspect.ts:25` has `EXTRA_MARKERS = ["openclaw", "clawdbot", "moltbot"]`
- Will need to add `"cortex"` and keep `"openclaw"` as legacy

### macOS UserDefaults migration

- All `openclaw.*` UserDefaults keys in Constants.swift need migration logic
- UserDefaults suite name needs updating

### Breaking changes for users

- Config path change requires migration script
- Env var rename requires documentation + deprecation period
- HTTP header changes will break existing API integrations
- mDNS service type change will break existing LAN discovery
- Deep link scheme change will break existing iOS shortcuts/automations

---

## Summary Statistics

| Category                               | Approximate Count |
| -------------------------------------- | ----------------- |
| Config dir references (`~/.openclaw`)  | ~40               |
| Bundle ID references (`ai.openclaw.*`) | ~50               |
| Environment variables (`OPENCLAW_*`)   | ~35 unique vars   |
| Service names (systemd/docker/fly)     | ~15               |
| Bonjour/mDNS identifiers               | ~15               |
| Log file paths                         | ~8                |
| HTTP headers (`x-openclaw-*`)          | ~10               |
| Internal symbols/keys                  | ~15               |
| macOS UserDefaults keys                | ~30               |
| External URLs (docs.openclaw.ai)       | ~50+              |
| npm package identity                   | ~10               |
| **Total unique locations**             | **~280+**         |
