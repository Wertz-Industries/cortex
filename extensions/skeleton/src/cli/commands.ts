import type { Command } from "commander";
import type { SkeletonStore } from "../data/store.js";
import type { Orchestrator } from "../engine/orchestrator.js";
import { GuiAdapter } from "../gui/gui-adapter.js";

export function registerSkeletonCli(opts: {
  program: Command;
  store: SkeletonStore;
  orchestrator: Orchestrator;
}): void {
  const { program, store, orchestrator } = opts;

  const skel = program.command("skeleton").description("Autonomous Studio Skeleton");

  skel
    .command("status")
    .description("Show skeleton engine state, mode, and last cycle info")
    .action(async () => {
      const [state, config, objectives, cycles] = await Promise.all([
        store.loadEngineState(),
        store.loadConfig(),
        store.loadObjectives(),
        store.loadCycles(),
      ]);

      const lastCycle = cycles.length > 0 ? cycles[cycles.length - 1] : null;

      console.log(
        JSON.stringify(
          {
            state: state.loopState,
            mode: config.mode,
            phase: state.currentPhase ?? null,
            totalCyclesCompleted: state.totalCyclesCompleted,
            lastCycleCompletedAt: state.lastCycleCompletedAt ?? null,
            nextCycleScheduledAt: state.nextCycleScheduledAt ?? null,
            objectives: objectives.length,
            activeObjectives: objectives.filter((o) => o.status === "active").length,
            lastCycle: lastCycle
              ? {
                  id: lastCycle.id,
                  number: lastCycle.number,
                  state: lastCycle.state,
                  totalCostUsd: lastCycle.totalCostUsd,
                }
              : null,
            budgets: config.budgets,
          },
          null,
          2,
        ),
      );
    });

  skel
    .command("objectives")
    .description("List all objectives")
    .action(async () => {
      const objectives = await store.loadObjectives();
      if (objectives.length === 0) {
        console.log("No objectives configured.");
        return;
      }
      for (const obj of objectives) {
        const status = obj.status.toUpperCase().padEnd(10);
        const weight = (obj.weight * 100).toFixed(0).padStart(3) + "%";
        const truth = obj.truthStatus.padEnd(12);
        console.log(`[${status}] ${weight} | ${truth} | ${obj.title}`);
      }
    });

  skel
    .command("config")
    .description("Show current skeleton configuration")
    .action(async () => {
      const config = await store.loadConfig();
      console.log(JSON.stringify(config, null, 2));
    });

  skel
    .command("mode")
    .argument("<mode>", "simulation | selective | live")
    .description("Set the skeleton operating mode")
    .action(async (mode: string) => {
      if (!["simulation", "selective", "live"].includes(mode)) {
        console.error(`Invalid mode: ${mode}. Must be simulation, selective, or live.`);
        process.exitCode = 1;
        return;
      }
      const config = await store.loadConfig();
      config.mode = mode as "simulation" | "selective" | "live";
      await store.saveConfig(config);
      console.log(`Skeleton mode set to: ${mode}`);
    });

  skel
    .command("cycles")
    .description("List cycle history")
    .action(async () => {
      const cycles = await store.loadCycles();
      if (cycles.length === 0) {
        console.log("No cycles yet.");
        return;
      }
      for (const cycle of cycles) {
        const state = cycle.state.toUpperCase().padEnd(10);
        const cost = `$${cycle.totalCostUsd.toFixed(4)}`.padStart(10);
        const mode = cycle.mode.padEnd(10);
        console.log(
          `#${String(cycle.number).padStart(3)} [${state}] ${mode} ${cost} | ${cycle.startedAt}`,
        );
      }
    });

  skel
    .command("cost")
    .description("Show cost summary by provider and phase")
    .action(async () => {
      const runs = await store.listRuns();
      const byProvider: Record<string, number> = {};
      const byPhase: Record<string, number> = {};
      let total = 0;

      for (const run of runs) {
        byProvider[run.provider] = (byProvider[run.provider] ?? 0) + run.costUsd;
        byPhase[run.phase] = (byPhase[run.phase] ?? 0) + run.costUsd;
        total += run.costUsd;
      }

      console.log(JSON.stringify({ total, byProvider, byPhase, runCount: runs.length }, null, 2));
    });

  skel
    .command("trigger")
    .option("--preset <name>", "Run a named preset (e.g., smb-scout)")
    .description("Manually trigger a cycle")
    .action(async (options: { preset?: string }) => {
      // CLI runs one-shot: start engine, trigger, stop
      await orchestrator.start();
      try {
        const result = await orchestrator.trigger(options.preset);
        if ("error" in result) {
          console.error(`Trigger failed: ${result.error}`);
          process.exitCode = 1;
          return;
        }
        console.log(`Cycle completed: ${result.cycleId}`);

        // Show cycle summary
        const cycles = await store.loadCycles();
        const cycle = cycles.find((c) => c.id === result.cycleId);
        if (cycle) {
          console.log(
            JSON.stringify(
              {
                number: cycle.number,
                state: cycle.state,
                mode: cycle.mode,
                totalCostUsd: cycle.totalCostUsd,
                tasksCreated: cycle.tasksCreated,
                tasksCompleted: cycle.tasksCompleted,
                phases: cycle.phases,
              },
              null,
              2,
            ),
          );
        }
      } finally {
        await orchestrator.stop();
      }
    });

  skel
    .command("keys")
    .description("Set API keys for live model providers")
    .option("--gemini <key>", "Gemini API key")
    .option("--openai <key>", "OpenAI API key")
    .option("--claude <key>", "Claude/Anthropic API key")
    .action(async (options: { gemini?: string; openai?: string; claude?: string }) => {
      const config = await store.loadConfig();
      let updated = false;
      if (options.gemini) {
        config.geminiApiKey = options.gemini;
        updated = true;
        console.log("Gemini API key set.");
      }
      if (options.openai) {
        config.openaiApiKey = options.openai;
        updated = true;
        console.log("OpenAI API key set.");
      }
      if (options.claude) {
        config.claudeApiKey = options.claude;
        updated = true;
        console.log("Claude API key set.");
      }
      if (updated) {
        await store.saveConfig(config);
      } else {
        console.log("Provide --gemini <key>, --openai <key>, or --claude <key>");
        console.log(`Gemini: ${config.geminiApiKey ? "configured" : "not set"}`);
        console.log(`OpenAI: ${config.openaiApiKey ? "configured" : "not set"}`);
        console.log(`Claude: ${config.claudeApiKey ? "configured" : "not set"}`);
      }
    });

  skel
    .command("pause")
    .description("Pause the orchestration loop")
    .action(async () => {
      await orchestrator.pause();
      console.log("Skeleton paused.");
    });

  skel
    .command("resume")
    .description("Resume the orchestration loop")
    .action(async () => {
      await orchestrator.resume();
      console.log("Skeleton resumed.");
    });

  // ── GUI Automation ──────────────────────────────────────────

  const guiCmd = skel.command("gui").description("GUI automation commands (PyAutoGUI)");

  guiCmd
    .command("screenshot")
    .option("--output <path>", "Save PNG to file path")
    .description("Capture a screenshot")
    .action(async (options: { output?: string }) => {
      const gui = new GuiAdapter();
      try {
        await gui.start();
        const result = await gui.screenshot();
        if (options.output) {
          const fs = await import("node:fs");
          fs.writeFileSync(options.output, Buffer.from(result.image, "base64"));
          console.log(`Screenshot saved: ${options.output} (${result.width}x${result.height})`);
        } else {
          console.log(
            `Screenshot: ${result.width}x${result.height}, ${result.image.length} chars base64`,
          );
        }
      } finally {
        gui.stop();
      }
    });

  guiCmd
    .command("click")
    .argument("<x>", "X coordinate")
    .argument("<y>", "Y coordinate")
    .description("Click at screen coordinates")
    .action(async (x: string, y: string) => {
      const gui = new GuiAdapter();
      try {
        await gui.start();
        await gui.click(Number(x), Number(y));
        console.log(`Clicked at (${x}, ${y})`);
      } finally {
        gui.stop();
      }
    });

  guiCmd
    .command("type")
    .argument("<text>", "Text to type")
    .description("Type text at current cursor position")
    .action(async (text: string) => {
      const gui = new GuiAdapter();
      try {
        await gui.start();
        await gui.type(text);
        console.log(`Typed: ${text}`);
      } finally {
        gui.stop();
      }
    });

  guiCmd
    .command("screensize")
    .description("Get screen dimensions")
    .action(async () => {
      const gui = new GuiAdapter();
      try {
        await gui.start();
        const size = await gui.screenSize();
        console.log(`${size.width}x${size.height}`);
      } finally {
        gui.stop();
      }
    });

  guiCmd
    .command("mousepos")
    .description("Get current mouse position")
    .action(async () => {
      const gui = new GuiAdapter();
      try {
        await gui.start();
        const pos = await gui.mousePosition();
        console.log(`(${pos.x}, ${pos.y})`);
      } finally {
        gui.stop();
      }
    });
}
