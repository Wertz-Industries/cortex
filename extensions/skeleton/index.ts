import type { OpenClawPluginApi } from "openclaw/plugin-sdk";
import { BudgetGuard } from "./src/autonomy/budget-guard.js";
import { registerSkeletonCli } from "./src/cli/commands.js";
import { SkeletonStore } from "./src/data/store.js";
import { Orchestrator } from "./src/engine/orchestrator.js";
import { registerSkeletonGatewayMethods } from "./src/gateway/methods.js";
import { GuiAdapter } from "./src/gui/gui-adapter.js";
import { ChatGPTClient } from "./src/models/chatgpt-client.js";
import { ClaudeCliAdapter } from "./src/models/claude-adapter.js";
import { ClaudeClient } from "./src/models/claude-client.js";
import { CostTracker } from "./src/models/cost-tracker.js";
import { GeminiClient } from "./src/models/gemini-client.js";
import { ModelRouter } from "./src/models/router.js";
import { ensureSmbScoutObjective } from "./src/presets/smb-scout.js";

const skeletonConfigSchema = {
  parse(value: unknown) {
    return value && typeof value === "object" ? value : {};
  },
};

const skeletonPlugin = {
  id: "skeleton",
  name: "Autonomous Studio Skeleton",
  description:
    "Orchestration engine for the autonomous business loop: SCAN → PLAN → BUILD → SHIP_CHECK → EVAL",
  configSchema: skeletonConfigSchema,

  register(api: OpenClawPluginApi) {
    const stateDir = api.runtime.state.resolveStateDir();
    const store = new SkeletonStore(stateDir);

    const broadcast = (event: string, _payload: Record<string, unknown>) => {
      try {
        api.logger.info(`[skeleton] Event: ${event}`);
      } catch {
        // Ignore broadcast failures
      }
    };

    const logger = {
      info: (msg: string) => api.logger.info(msg),
      warn: (msg: string) => api.logger.warn(msg),
      error: (msg: string) => api.logger.error(msg),
    };

    // ── Model Infrastructure ────────────────────────────────────
    // Config is loaded lazily during start(). Defaults are fine for construction.
    const costTracker = new CostTracker();
    const defaultConfig = store.defaultConfig();
    const router = new ModelRouter(defaultConfig);
    const budgetGuard = new BudgetGuard(defaultConfig.budgets, costTracker);

    const orchestrator = new Orchestrator({
      store,
      broadcast,
      logger,
      modelInfra: { router, costTracker, budgetGuard },
    });

    // ── Presets ─────────────────────────────────────────────────
    orchestrator.registerPreset("smb-scout", async (s) => {
      await ensureSmbScoutObjective(s);
    });

    // ── GUI Automation ──────────────────────────────────────────
    const gui = new GuiAdapter();

    // ── Background Service ──────────────────────────────────────
    api.registerService({
      id: "skeleton",
      start: async () => {
        // Update router/guard with persisted config before starting
        const config = await store.loadConfig();
        router.updateConfig(config);
        budgetGuard.updateBudgets(config.budgets);

        // Register real model adapters when API keys are available
        if (config.geminiApiKey) {
          router.registerAdapter("gemini", new GeminiClient(config.geminiApiKey));
          logger.info("[skeleton] Gemini adapter registered (live)");
        }
        if (config.openaiApiKey) {
          router.registerAdapter("openai", new ChatGPTClient(config.openaiApiKey));
          logger.info("[skeleton] ChatGPT adapter registered (live)");
        }
        // Claude: API adapter for reviewing, CLI adapter for building
        if (config.claudeApiKey) {
          router.registerAdapter("claude", new ClaudeClient(config.claudeApiKey));
          logger.info("[skeleton] Claude API adapter registered (live)");
        }
        router.registerBuildWorker("claude", new ClaudeCliAdapter());

        // Start GUI server (non-blocking — continues if unavailable)
        try {
          await gui.start();
          logger.info("[skeleton] GUI automation server started");
        } catch (err) {
          logger.warn(`[skeleton] GUI automation unavailable: ${err}`);
        }

        await orchestrator.start();
      },
      stop: async () => {
        await orchestrator.stop();
        gui.stop();
      },
    });

    // ── Gateway Methods ─────────────────────────────────────────
    registerSkeletonGatewayMethods(api, store, orchestrator, gui);

    // ── CLI ─────────────────────────────────────────────────────
    api.registerCli(({ program }) => registerSkeletonCli({ program, store, orchestrator }), {
      commands: ["skeleton"],
    });

    api.logger.info("[skeleton] Plugin registered");
  },
};

export default skeletonPlugin;
