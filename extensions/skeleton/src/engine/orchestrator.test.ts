import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import type { SkeletonConfig, EngineState, Cycle, Objective, PhaseName } from "../data/schemas.js";
import type { SkeletonStore } from "../data/store.js";
import { Orchestrator, type PhaseResult, type OrchestratorOptions } from "./orchestrator.js";

// ── Mock Store ──────────────────────────────────────────────────────

function createMockStore(): SkeletonStore {
  let engineState: EngineState = { loopState: "idle", totalCyclesCompleted: 0 };
  let config: SkeletonConfig = {
    mode: "simulation",
    cycleCooldownMinutes: 60,
    budgets: {
      perCallUsd: 0.5,
      perTaskUsd: 5,
      perCycleUsd: 20,
      dailyUsd: 10,
      weeklyUsd: 50,
      perProviderDailyUsd: {},
    },
    selectiveProviders: { gemini: false, openai: false, claude: false },
  };
  let cycles: Cycle[] = [];
  const objectives: Objective[] = [
    {
      id: "550e8400-e29b-41d4-a716-446655440000",
      title: "Test Objective",
      description: "For testing",
      weight: 1,
      status: "active",
      tags: [],
      acceptanceCriteria: ["pass tests"],
      truthStatus: "hypothesis",
      confidence: "medium",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  ];

  return {
    loadEngineState: vi.fn(async () => ({ ...engineState })),
    saveEngineState: vi.fn(async (s: EngineState) => {
      engineState = { ...s };
    }),
    loadConfig: vi.fn(async () => ({ ...config })),
    saveConfig: vi.fn(async (c: SkeletonConfig) => {
      config = { ...c };
    }),
    loadCycles: vi.fn(async () => [...cycles]),
    saveCycles: vi.fn(async (c: Cycle[]) => {
      cycles = [...c];
    }),
    loadObjectives: vi.fn(async () => [...objectives]),
    loadTasks: vi.fn(async () => []),
    saveTasks: vi.fn(async () => {}),
    saveScan: vi.fn(async () => {}),
    savePlan: vi.fn(async () => {}),
    saveRun: vi.fn(async () => {}),
    saveEvaluation: vi.fn(async () => {}),
    appendDecision: vi.fn(async () => {}),
    defaultConfig: vi.fn(() => config),
  } as unknown as SkeletonStore;
}

function createOrchestratorOpts(overrides: Partial<OrchestratorOptions> = {}): OrchestratorOptions {
  return {
    store: createMockStore(),
    broadcast: vi.fn(),
    logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
    ...overrides,
  };
}

describe("Orchestrator", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ── Lifecycle ────────────────────────────────────────────────────

  describe("start/stop", () => {
    it("starts and loads state + config", async () => {
      const store = createMockStore();
      const orch = new Orchestrator(createOrchestratorOpts({ store }));
      await orch.start();
      expect(store.loadEngineState).toHaveBeenCalled();
      expect(store.loadConfig).toHaveBeenCalled();
      await orch.stop();
    });

    it("stop saves engine state", async () => {
      const store = createMockStore();
      const orch = new Orchestrator(createOrchestratorOpts({ store }));
      await orch.start();
      await orch.stop();
      expect(store.saveEngineState).toHaveBeenCalled();
    });

    it("resets non-idle state to idle on start", async () => {
      const store = createMockStore();
      (store.loadEngineState as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        loopState: "scanning",
        totalCyclesCompleted: 0,
      });
      const orch = new Orchestrator(createOrchestratorOpts({ store }));
      await orch.start();
      const state = await orch.getState();
      expect(state.state).toBe("idle");
      await orch.stop();
    });
  });

  // ── getState ─────────────────────────────────────────────────────

  describe("getState", () => {
    it("returns current state", async () => {
      const orch = new Orchestrator(createOrchestratorOpts());
      await orch.start();
      const state = await orch.getState();
      expect(state.state).toBe("idle");
      expect(state.mode).toBe("simulation");
      expect(state.totalCyclesCompleted).toBe(0);
      expect(state.phase).toBeNull();
      await orch.stop();
    });
  });

  // ── Full simulated cycle ─────────────────────────────────────────

  describe("trigger cycle", () => {
    it("runs a full cycle through all phases", async () => {
      const phasesExecuted: PhaseName[] = [];
      const opts = createOrchestratorOpts({
        executePhase: async (phase: PhaseName): Promise<PhaseResult> => {
          phasesExecuted.push(phase);
          return { success: true, costUsd: 0.01 };
        },
      });
      const orch = new Orchestrator(opts);
      await orch.start();

      const result = await orch.trigger();
      expect(result).toHaveProperty("cycleId");
      expect(phasesExecuted).toEqual(["scan", "plan", "build", "ship_check", "eval"]);

      const state = await orch.getState();
      expect(state.state).toBe("idle");
      expect(state.totalCyclesCompleted).toBe(1);
      await orch.stop();
    });

    it("accumulates cost across phases", async () => {
      const store = createMockStore();
      const orch = new Orchestrator(
        createOrchestratorOpts({
          store,
          executePhase: async () => ({ success: true, costUsd: 0.02 }),
        }),
      );
      await orch.start();
      await orch.trigger();

      // 5 phases * $0.02 = $0.10
      const savedCycles = (store.saveCycles as ReturnType<typeof vi.fn>).mock.calls;
      const lastCall = savedCycles[savedCycles.length - 1][0] as Cycle[];
      const cycle = lastCall[lastCall.length - 1];
      expect(cycle.totalCostUsd).toBeCloseTo(0.1);
      await orch.stop();
    });

    it("broadcasts state changes during cycle", async () => {
      const broadcast = vi.fn();
      const orch = new Orchestrator(
        createOrchestratorOpts({
          broadcast,
          executePhase: async () => ({ success: true, costUsd: 0 }),
        }),
      );
      await orch.start();
      await orch.trigger();

      const stateChanges = broadcast.mock.calls.filter(
        ([event]: [string]) => event === "skeleton.state_changed",
      );
      expect(stateChanges.length).toBeGreaterThan(0);

      const phaseCompletes = broadcast.mock.calls.filter(
        ([event]: [string]) => event === "skeleton.phase_complete",
      );
      expect(phaseCompletes).toHaveLength(5);
      await orch.stop();
    });

    it("rejects trigger when not idle or paused", async () => {
      const opts = createOrchestratorOpts({
        executePhase: async (phase) => {
          if (phase === "scan") {
            // Delay so we can try to trigger again
            await new Promise((r) => setTimeout(r, 100));
          }
          return { success: true, costUsd: 0 };
        },
      });
      const orch = new Orchestrator(opts);
      await orch.start();

      // Start a cycle, and try to trigger while running
      const p1 = orch.trigger();
      // Give it a tick to move past idle
      await new Promise((r) => setTimeout(r, 20));
      const p2 = await orch.trigger();
      expect(p2).toHaveProperty("error");

      await p1;
      await orch.stop();
    });
  });

  // ── Pause / Resume ───────────────────────────────────────────────

  describe("pause/resume", () => {
    it("pause transitions to paused state", async () => {
      const orch = new Orchestrator(createOrchestratorOpts());
      await orch.start();
      await orch.pause();
      const state = await orch.getState();
      expect(state.state).toBe("paused");
      await orch.stop();
    });

    it("resume transitions from paused to idle", async () => {
      const orch = new Orchestrator(createOrchestratorOpts());
      await orch.start();
      await orch.pause();
      await orch.resume();
      const state = await orch.getState();
      expect(state.state).toBe("idle");
      await orch.stop();
    });

    it("pause is idempotent", async () => {
      const orch = new Orchestrator(createOrchestratorOpts());
      await orch.start();
      await orch.pause();
      await orch.pause();
      const state = await orch.getState();
      expect(state.state).toBe("paused");
      await orch.stop();
    });

    it("resume is no-op when not paused", async () => {
      const orch = new Orchestrator(createOrchestratorOpts());
      await orch.start();
      await orch.resume(); // not paused, should be no-op
      const state = await orch.getState();
      expect(state.state).toBe("idle");
      await orch.stop();
    });

    it("trigger works from paused state", async () => {
      const orch = new Orchestrator(
        createOrchestratorOpts({
          executePhase: async () => ({ success: true, costUsd: 0 }),
        }),
      );
      await orch.start();
      await orch.pause();
      const result = await orch.trigger();
      expect(result).toHaveProperty("cycleId");
      await orch.stop();
    });
  });

  // ── Error handling ───────────────────────────────────────────────

  describe("error handling", () => {
    it("phase failure → error state → recoverable", async () => {
      let callCount = 0;
      const orch = new Orchestrator(
        createOrchestratorOpts({
          executePhase: async (phase) => {
            callCount++;
            if (phase === "plan") return { success: false, costUsd: 0, error: "Plan failed" };
            return { success: true, costUsd: 0 };
          },
        }),
      );
      await orch.start();
      await orch.trigger();

      // After failed cycle, should be back to idle (cycle finalizes to idle)
      const state = await orch.getState();
      expect(state.state).toBe("idle");

      // Should be able to trigger again
      callCount = 0;
      const result = await orch.trigger();
      expect(result).toHaveProperty("cycleId");
      await orch.stop();
    });

    it("phase exception → error state → cycle completes as failed", async () => {
      const orch = new Orchestrator(
        createOrchestratorOpts({
          executePhase: async (phase) => {
            if (phase === "build") throw new Error("Build exploded");
            return { success: true, costUsd: 0 };
          },
        }),
      );
      await orch.start();
      const result = await orch.trigger();
      expect(result).toHaveProperty("cycleId");

      const state = await orch.getState();
      expect(state.state).toBe("idle");
      await orch.stop();
    });

    it("failed cycle increments 0 completed cycles", async () => {
      const orch = new Orchestrator(
        createOrchestratorOpts({
          executePhase: async (phase) => {
            if (phase === "scan") return { success: false, costUsd: 0, error: "fail" };
            return { success: true, costUsd: 0 };
          },
        }),
      );
      await orch.start();
      await orch.trigger();
      const state = await orch.getState();
      expect(state.totalCyclesCompleted).toBe(0);
      await orch.stop();
    });
  });

  // ── Preset handlers ──────────────────────────────────────────────

  describe("presets", () => {
    it("runs preset handler before cycle", async () => {
      const presetRan = vi.fn();
      const orch = new Orchestrator(
        createOrchestratorOpts({
          executePhase: async () => ({ success: true, costUsd: 0 }),
        }),
      );
      orch.registerPreset("test-preset", async () => {
        presetRan();
      });
      await orch.start();
      await orch.trigger("test-preset");

      expect(presetRan).toHaveBeenCalledOnce();
      await orch.stop();
    });

    it("unknown preset logs warning but continues", async () => {
      const logger = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };
      const orch = new Orchestrator(
        createOrchestratorOpts({
          logger,
          executePhase: async () => ({ success: true, costUsd: 0 }),
        }),
      );
      await orch.start();
      await orch.trigger("nonexistent");

      expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining("nonexistent"));
      await orch.stop();
    });
  });

  // ── setPhaseExecutor ─────────────────────────────────────────────

  describe("setPhaseExecutor", () => {
    it("overrides the phase executor", async () => {
      const phasesExecuted: PhaseName[] = [];
      const orch = new Orchestrator(createOrchestratorOpts());
      orch.setPhaseExecutor(async (phase) => {
        phasesExecuted.push(phase);
        return { success: true, costUsd: 0 };
      });
      await orch.start();
      await orch.trigger();
      expect(phasesExecuted).toEqual(["scan", "plan", "build", "ship_check", "eval"]);
      await orch.stop();
    });
  });
});
