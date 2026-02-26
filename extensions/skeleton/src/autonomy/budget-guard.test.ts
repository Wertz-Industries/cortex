import { describe, expect, it, beforeEach } from "vitest";
import type { BudgetConfig } from "../data/schemas.js";
import { CostTracker, type CostRecord } from "../models/cost-tracker.js";
import { BudgetGuard, type BudgetCheckResult } from "./budget-guard.js";

function defaultBudgets(overrides: Partial<BudgetConfig> = {}): BudgetConfig {
  return {
    perCallUsd: 0.5,
    perTaskUsd: 5,
    perCycleUsd: 20,
    dailyUsd: 10,
    weeklyUsd: 50,
    perProviderDailyUsd: { openai: 5, gemini: 0, claude: 0 },
    ...overrides,
  };
}

function todayRecord(overrides: Partial<CostRecord> = {}): CostRecord {
  return {
    timestamp: new Date().toISOString(),
    phase: "scan",
    provider: "openai",
    model: "gpt-4o",
    inputTokens: 100,
    outputTokens: 50,
    costUsd: 0,
    latencyMs: 200,
    ...overrides,
  };
}

describe("BudgetGuard", () => {
  let tracker: CostTracker;
  let guard: BudgetGuard;

  beforeEach(() => {
    tracker = new CostTracker();
    guard = new BudgetGuard(defaultBudgets(), tracker);
  });

  // ── Per-call cap ─────────────────────────────────────────────────

  describe("per-call cap", () => {
    it("blocks when estimated cost exceeds per-call cap", () => {
      const result = guard.check({
        estimatedCostUsd: 0.6,
        cycleSpendUsd: 0,
        provider: "openai",
      });
      expect(result.allowed).toBe(false);
      if (!result.allowed) {
        expect(result.level).toBe("per_call");
        expect(result.reason).toContain("per-call cap");
      }
    });

    it("allows when exactly at per-call cap", () => {
      const result = guard.check({
        estimatedCostUsd: 0.5,
        cycleSpendUsd: 0,
        provider: "openai",
      });
      expect(result.allowed).toBe(true);
    });

    it("allows when under per-call cap", () => {
      const result = guard.check({
        estimatedCostUsd: 0.1,
        cycleSpendUsd: 0,
        provider: "openai",
      });
      expect(result.allowed).toBe(true);
    });
  });

  // ── Per-task cap ─────────────────────────────────────────────────

  describe("per-task cap", () => {
    it("blocks when task accumulated + estimated > cap", () => {
      tracker.record(todayRecord({ taskId: "task-1", costUsd: 4.8 }));
      const result = guard.check({
        estimatedCostUsd: 0.3,
        taskId: "task-1",
        cycleSpendUsd: 4.8,
        provider: "openai",
      });
      expect(result.allowed).toBe(false);
      if (!result.allowed) expect(result.level).toBe("per_task");
    });

    it("skips task check when no taskId provided", () => {
      // Record large cost on a task, but check without taskId using a provider without a cap
      tracker.record(todayRecord({ taskId: "task-1", costUsd: 4.0, provider: "gemini" }));
      const result = guard.check({
        estimatedCostUsd: 0.01,
        cycleSpendUsd: 0,
        provider: "gemini",
      });
      expect(result.allowed).toBe(true);
    });

    it("allows when task spend is under cap", () => {
      tracker.record(todayRecord({ taskId: "task-1", costUsd: 2.0 }));
      const result = guard.check({
        estimatedCostUsd: 0.1,
        taskId: "task-1",
        cycleSpendUsd: 2.0,
        provider: "openai",
      });
      expect(result.allowed).toBe(true);
    });
  });

  // ── Per-cycle cap ────────────────────────────────────────────────

  describe("per-cycle cap", () => {
    it("blocks when cycle spend + estimated > cap", () => {
      const result = guard.check({
        estimatedCostUsd: 0.1,
        cycleSpendUsd: 19.95,
        provider: "openai",
      });
      expect(result.allowed).toBe(false);
      if (!result.allowed) expect(result.level).toBe("per_cycle");
    });

    it("allows when cycle spend is under cap", () => {
      const result = guard.check({
        estimatedCostUsd: 0.1,
        cycleSpendUsd: 5.0,
        provider: "openai",
      });
      expect(result.allowed).toBe(true);
    });
  });

  // ── Daily cap ────────────────────────────────────────────────────

  describe("daily cap", () => {
    it("blocks when daily total + estimated > cap", () => {
      tracker.record(todayRecord({ costUsd: 9.95 }));
      const result = guard.check({
        estimatedCostUsd: 0.1,
        cycleSpendUsd: 0,
        provider: "openai",
      });
      expect(result.allowed).toBe(false);
      if (!result.allowed) expect(result.level).toBe("daily");
    });

    it("allows when daily total is under cap", () => {
      tracker.record(todayRecord({ costUsd: 5.0, provider: "gemini" }));
      const result = guard.check({
        estimatedCostUsd: 0.1,
        cycleSpendUsd: 0,
        provider: "gemini",
      });
      expect(result.allowed).toBe(true);
    });
  });

  // ── Weekly cap ───────────────────────────────────────────────────

  describe("weekly cap", () => {
    it("blocks when weekly total + estimated > cap", () => {
      tracker.record(todayRecord({ costUsd: 49.95 }));
      const result = guard.check({
        estimatedCostUsd: 0.1,
        cycleSpendUsd: 0,
        provider: "openai",
      });
      // Will likely hit daily first, but let's set daily high
      const bigGuard = new BudgetGuard(defaultBudgets({ dailyUsd: 100, weeklyUsd: 50 }), tracker);
      const r = bigGuard.check({
        estimatedCostUsd: 0.1,
        cycleSpendUsd: 0,
        provider: "openai",
      });
      expect(r.allowed).toBe(false);
      if (!r.allowed) expect(r.level).toBe("weekly");
    });
  });

  // ── Per-provider daily cap ───────────────────────────────────────

  describe("per-provider daily cap", () => {
    it("blocks when provider daily + estimated > provider cap", () => {
      tracker.record(todayRecord({ provider: "openai", costUsd: 4.95 }));
      const result = guard.check({
        estimatedCostUsd: 0.1,
        cycleSpendUsd: 0,
        provider: "openai",
      });
      expect(result.allowed).toBe(false);
      if (!result.allowed) expect(result.level).toBe("per_provider_daily");
    });

    it("does not block providers without a cap", () => {
      // Use a provider with no entry in perProviderDailyUsd and keep under daily/weekly caps
      tracker.record(todayRecord({ provider: "anthropic", costUsd: 3.0 }));
      const result = guard.check({
        estimatedCostUsd: 0.1,
        cycleSpendUsd: 0,
        provider: "anthropic",
      });
      expect(result.allowed).toBe(true);
    });

    it("does not block unknown providers", () => {
      const result = guard.check({
        estimatedCostUsd: 0.1,
        cycleSpendUsd: 0,
        provider: "anthropic",
      });
      expect(result.allowed).toBe(true);
    });
  });

  // ── All caps pass ────────────────────────────────────────────────

  describe("all caps pass", () => {
    it("returns allowed when everything is under budget", () => {
      const result = guard.check({
        estimatedCostUsd: 0.01,
        taskId: "task-1",
        cycleSpendUsd: 1.0,
        provider: "openai",
      });
      expect(result).toEqual({ allowed: true });
    });
  });

  // ── Zero cost request ────────────────────────────────────────────

  describe("zero cost", () => {
    it("zero estimated cost is always allowed", () => {
      tracker.record(todayRecord({ costUsd: 100, provider: "gemini" }));
      const bigGuard = new BudgetGuard(
        defaultBudgets({
          dailyUsd: 1000,
          weeklyUsd: 5000,
          perCycleUsd: 1000,
          perProviderDailyUsd: {},
        }),
        tracker,
      );
      const result = bigGuard.check({
        estimatedCostUsd: 0,
        cycleSpendUsd: 0,
        provider: "gemini",
      });
      expect(result.allowed).toBe(true);
    });
  });

  // ── Combined: multiple caps near limit ───────────────────────────

  describe("combined caps", () => {
    it("first failing cap wins (check order)", () => {
      // per-call trips first when estimated > perCallUsd
      const result = guard.check({
        estimatedCostUsd: 1.0,
        cycleSpendUsd: 19.5,
        provider: "openai",
      });
      expect(result.allowed).toBe(false);
      if (!result.allowed) expect(result.level).toBe("per_call");
    });

    it("per-task trips before per-cycle when both would fail", () => {
      tracker.record(todayRecord({ taskId: "task-1", costUsd: 4.9 }));
      const result = guard.check({
        estimatedCostUsd: 0.2,
        taskId: "task-1",
        cycleSpendUsd: 19.9,
        provider: "openai",
      });
      expect(result.allowed).toBe(false);
      if (!result.allowed) expect(result.level).toBe("per_task");
    });
  });

  // ── updateBudgets ────────────────────────────────────────────────

  describe("updateBudgets", () => {
    it("respects updated budget caps", () => {
      // Initially blocked by per-call cap
      const blocked = guard.check({ estimatedCostUsd: 0.6, cycleSpendUsd: 0, provider: "openai" });
      expect(blocked.allowed).toBe(false);

      // Raise the cap
      guard.updateBudgets(defaultBudgets({ perCallUsd: 1.0 }));
      const allowed = guard.check({ estimatedCostUsd: 0.6, cycleSpendUsd: 0, provider: "openai" });
      expect(allowed.allowed).toBe(true);
    });
  });
});
