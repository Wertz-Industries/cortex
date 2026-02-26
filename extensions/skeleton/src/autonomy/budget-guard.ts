import type { BudgetConfig } from "../data/schemas.js";
import type { CostTracker } from "../models/cost-tracker.js";

export type BudgetCheckResult =
  | { allowed: true }
  | { allowed: false; reason: string; level: BudgetLevel };

export type BudgetLevel =
  | "per_call"
  | "per_task"
  | "per_cycle"
  | "daily"
  | "weekly"
  | "per_provider_daily";

/**
 * Multi-level budget enforcement.
 * All checks run BEFORE a model call. If any cap is exceeded, the call is blocked.
 */
export class BudgetGuard {
  constructor(
    private budgets: BudgetConfig,
    private costTracker: CostTracker,
  ) {}

  updateBudgets(budgets: BudgetConfig): void {
    this.budgets = budgets;
  }

  /**
   * Check if a model call with estimated cost is allowed.
   * Returns { allowed: true } or { allowed: false, reason, level }.
   */
  check(opts: {
    estimatedCostUsd: number;
    taskId?: string;
    cycleSpendUsd: number;
    provider: string;
  }): BudgetCheckResult {
    // 1. Per-call cap
    if (opts.estimatedCostUsd > this.budgets.perCallUsd) {
      return {
        allowed: false,
        reason: `Estimated call cost $${opts.estimatedCostUsd.toFixed(4)} exceeds per-call cap $${this.budgets.perCallUsd}`,
        level: "per_call",
      };
    }

    // 2. Per-task cap
    if (opts.taskId) {
      const taskSpend = this.costTracker.costForTask(opts.taskId) + opts.estimatedCostUsd;
      if (taskSpend > this.budgets.perTaskUsd) {
        return {
          allowed: false,
          reason: `Task spend $${taskSpend.toFixed(4)} would exceed per-task cap $${this.budgets.perTaskUsd}`,
          level: "per_task",
        };
      }
    }

    // 3. Per-cycle cap
    const cycleSpend = opts.cycleSpendUsd + opts.estimatedCostUsd;
    if (cycleSpend > this.budgets.perCycleUsd) {
      return {
        allowed: false,
        reason: `Cycle spend $${cycleSpend.toFixed(4)} would exceed per-cycle cap $${this.budgets.perCycleUsd}`,
        level: "per_cycle",
      };
    }

    // 4. Daily cap
    const dailySpend = this.costTracker.dailyCost() + opts.estimatedCostUsd;
    if (dailySpend > this.budgets.dailyUsd) {
      return {
        allowed: false,
        reason: `Daily spend $${dailySpend.toFixed(4)} would exceed daily cap $${this.budgets.dailyUsd}`,
        level: "daily",
      };
    }

    // 5. Weekly cap
    const weeklySpend = this.costTracker.weeklyCost() + opts.estimatedCostUsd;
    if (weeklySpend > this.budgets.weeklyUsd) {
      return {
        allowed: false,
        reason: `Weekly spend $${weeklySpend.toFixed(4)} would exceed weekly cap $${this.budgets.weeklyUsd}`,
        level: "weekly",
      };
    }

    // 6. Per-provider daily cap
    const providerCap = this.budgets.perProviderDailyUsd[opts.provider];
    if (providerCap !== undefined && providerCap > 0) {
      const providerDailySpend =
        this.costTracker.providerDailyCost(opts.provider) + opts.estimatedCostUsd;
      if (providerDailySpend > providerCap) {
        return {
          allowed: false,
          reason: `Provider ${opts.provider} daily spend $${providerDailySpend.toFixed(4)} would exceed cap $${providerCap}`,
          level: "per_provider_daily",
        };
      }
    }

    return { allowed: true };
  }
}
