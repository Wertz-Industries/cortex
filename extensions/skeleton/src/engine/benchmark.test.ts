import { describe, expect, it } from "vitest";
import { ObjectiveSchema, TaskSchema, CycleSchema, SkeletonConfigSchema } from "../data/schemas.js";
import type { LoopState, PhaseName } from "../data/schemas.js";
import { CostTracker } from "../models/cost-tracker.js";
import {
  canTransition,
  stateForPhase,
  nextPhase,
  PHASE_ORDER,
  transition,
} from "./state-machine.js";

const UUID = "550e8400-e29b-41d4-a716-446655440000";
const ISO_NOW = new Date().toISOString();

describe("benchmarks", () => {
  // ── State machine throughput ──────────────────────────────────────

  it("state machine: 10,000 transitions under 100ms", () => {
    const states: LoopState[] = [
      "idle",
      "scanning",
      "planning",
      "building",
      "ship_checking",
      "evaluating",
    ];
    const start = performance.now();
    for (let i = 0; i < 10_000; i++) {
      const from = states[i % states.length];
      const to = states[(i + 1) % states.length];
      canTransition(from, to);
      transition(from, to);
    }
    const elapsed = performance.now() - start;
    expect(elapsed).toBeLessThan(100);
  });

  it("phase mapping: 10,000 lookups under 50ms", () => {
    const phases: PhaseName[] = ["scan", "plan", "build", "ship_check", "eval"];
    const start = performance.now();
    for (let i = 0; i < 10_000; i++) {
      const phase = phases[i % phases.length];
      stateForPhase(phase);
      nextPhase(phase);
    }
    const elapsed = performance.now() - start;
    expect(elapsed).toBeLessThan(50);
  });

  // ── Schema validation speed ──────────────────────────────────────

  it("parse 1000 objectives under 100ms", () => {
    const raw = {
      id: UUID,
      title: "Benchmark Objective",
      description: "Testing performance",
      weight: 0.5,
      status: "active",
      acceptanceCriteria: ["fast"],
      createdAt: ISO_NOW,
      updatedAt: ISO_NOW,
    };

    const start = performance.now();
    for (let i = 0; i < 1000; i++) {
      ObjectiveSchema.parse(raw);
    }
    const elapsed = performance.now() - start;
    expect(elapsed).toBeLessThan(100);
  });

  it("parse 1000 tasks under 100ms", () => {
    const raw = {
      id: UUID,
      objectiveId: UUID,
      cycleId: UUID,
      title: "Bench task",
      description: "Bench",
      state: "queued",
      autonomyTier: "0",
      createdAt: ISO_NOW,
      updatedAt: ISO_NOW,
    };

    const start = performance.now();
    for (let i = 0; i < 1000; i++) {
      TaskSchema.parse(raw);
    }
    const elapsed = performance.now() - start;
    expect(elapsed).toBeLessThan(100);
  });

  it("parse 1000 cycles under 200ms", () => {
    const raw = {
      id: UUID,
      number: 1,
      state: "running",
      mode: "simulation",
      phases: { scan: {}, plan: {}, build: {}, ship_check: {}, eval: {} },
      startedAt: ISO_NOW,
    };

    const start = performance.now();
    for (let i = 0; i < 1000; i++) {
      CycleSchema.parse(raw);
    }
    const elapsed = performance.now() - start;
    expect(elapsed).toBeLessThan(200);
  });

  it("parse 1000 configs under 100ms", () => {
    const start = performance.now();
    for (let i = 0; i < 1000; i++) {
      SkeletonConfigSchema.parse({});
    }
    const elapsed = performance.now() - start;
    expect(elapsed).toBeLessThan(100);
  });

  // ── Cost tracker aggregation ─────────────────────────────────────

  it("cost tracker: 10,000 entries, all queries under 50ms", () => {
    const tracker = new CostTracker();
    const now = Date.now();

    // Fill with 10k records spread over 10 days
    for (let i = 0; i < 10_000; i++) {
      tracker.record({
        timestamp: new Date(now - (i % 10) * 86400_000).toISOString(),
        phase: PHASE_ORDER[i % 5],
        taskId: `task-${i % 20}`,
        provider: ["openai", "gemini", "claude"][i % 3],
        model: "bench-model",
        inputTokens: 100,
        outputTokens: 50,
        costUsd: 0.001,
        latencyMs: 100,
      });
    }

    const start = performance.now();

    // Run all query types
    tracker.total();
    tracker.dailyCost();
    tracker.weeklyCost();
    tracker.costForTask("task-0");
    tracker.costForPhase("scan");
    tracker.providerDailyCost("openai");
    tracker.costSince(new Date(now - 3 * 86400_000));
    tracker.costForProvider("gemini", new Date(now - 7 * 86400_000));
    tracker.getRecords();

    const elapsed = performance.now() - start;
    expect(elapsed).toBeLessThan(50);
  });

  // ── Full simulated cycle timing ──────────────────────────────────

  it("full simulated cycle (mock phases) under 500ms", async () => {
    // Import dynamically to avoid pulling in all deps at top level
    const { Orchestrator } = await import("./orchestrator.js");
    const { vi: _vi } = await import("vitest");

    const store = {
      loadEngineState: async () => ({ loopState: "idle" as const, totalCyclesCompleted: 0 }),
      saveEngineState: async () => {},
      loadConfig: async () => ({
        mode: "simulation" as const,
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
      }),
      saveConfig: async () => {},
      loadCycles: async () => [],
      saveCycles: async () => {},
      loadObjectives: async () => [],
    } as any;

    const orch = new Orchestrator({
      store,
      broadcast: () => {},
      logger: { info: () => {}, warn: () => {}, error: () => {} },
      executePhase: async () => ({ success: true, costUsd: 0.01 }),
    });

    await orch.start();

    const start = performance.now();
    await orch.trigger();
    const elapsed = performance.now() - start;

    expect(elapsed).toBeLessThan(500);
    await orch.stop();
  });
});
