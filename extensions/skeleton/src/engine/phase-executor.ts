import type { BudgetGuard } from "../autonomy/budget-guard.js";
import type { Cycle, SkeletonConfig, PhaseName, Task } from "../data/schemas.js";
import type { Scan, Plan } from "../data/schemas.js";
import type { SkeletonStore } from "../data/store.js";
import type { CostTracker } from "../models/cost-tracker.js";
import type { ModelRouter } from "../models/router.js";
import { runBuild } from "../phases/build.js";
import { runEval } from "../phases/eval.js";
import { runPlan } from "../phases/plan.js";
import { runScan } from "../phases/scan.js";
import { runShipCheck } from "../phases/ship-check.js";
import type { PhaseResult } from "./orchestrator.js";

/**
 * Creates a phase executor that runs the real phase implementations
 * through the model router, cost tracker, and budget guard.
 */
export function createPhaseExecutor(deps: {
  store: SkeletonStore;
  router: ModelRouter;
  costTracker: CostTracker;
  budgetGuard: BudgetGuard;
}): (phase: PhaseName, cycle: Cycle, config: SkeletonConfig) => Promise<PhaseResult> {
  const { store, router, costTracker, budgetGuard } = deps;

  // State carried between phases within a cycle
  let lastScan: Scan | null = null;
  let lastPlan: Plan | null = null;
  let lastTasks: Task[] = [];

  return async (phase: PhaseName, cycle: Cycle, _config: SkeletonConfig): Promise<PhaseResult> => {
    // Budget check before each phase (estimate based on typical cost)
    const estimatedCost = estimatePhasesCost(phase);
    const budgetCheck = budgetGuard.check({
      estimatedCostUsd: estimatedCost,
      cycleSpendUsd: cycle.totalCostUsd,
      provider: getPhaseProvider(phase),
    });

    if (!budgetCheck.allowed) {
      return {
        success: false,
        costUsd: 0,
        error: `Budget guard blocked: ${budgetCheck.reason}`,
      };
    }

    const objectives = await store.loadObjectives();
    const activeObjectives = objectives.filter((o) => o.status === "active");

    if (activeObjectives.length === 0 && phase === "scan") {
      return {
        success: false,
        costUsd: 0,
        error: "No active objectives. Create objectives before running a cycle.",
      };
    }

    switch (phase) {
      case "scan": {
        const scan = await runScan({
          store,
          router,
          costTracker,
          cycle,
          objectives: activeObjectives,
        });
        lastScan = scan;
        return {
          success: true,
          costUsd: scan.costUsd,
          artifacts: scan.findings.map((f) => ({
            type: "log",
            label: f.topic,
            value: f.summary,
          })),
        };
      }

      case "plan": {
        if (!lastScan) {
          return { success: false, costUsd: 0, error: "No scan results available for planning" };
        }
        const plan = await runPlan({
          store,
          router,
          costTracker,
          cycle,
          scan: lastScan,
          objectives: activeObjectives,
        });
        lastPlan = plan;
        return {
          success: true,
          costUsd: plan.costUsd,
          artifacts: [
            {
              type: "log",
              label: "strategy",
              value: plan.strategy.summary,
            },
          ],
        };
      }

      case "build": {
        if (!lastPlan) {
          return { success: false, costUsd: 0, error: "No plan available for building" };
        }
        const result = await runBuild({
          store,
          router,
          costTracker,
          cycle,
          plan: lastPlan,
        });
        lastTasks = result.tasks;
        cycle.tasksCreated = result.tasks.length;
        return {
          success: true,
          costUsd: result.totalCostUsd,
          artifacts: result.tasks.map((t) => ({
            type: "log",
            label: t.title,
            value: `[${t.state}] ${t.description.slice(0, 100)}`,
          })),
        };
      }

      case "ship_check": {
        const result = await runShipCheck({
          store,
          router,
          costTracker,
          cycle,
          tasks: lastTasks,
        });
        cycle.tasksCompleted = result.tasks.filter((t) => t.state === "completed").length;
        return {
          success: true,
          costUsd: result.totalCostUsd,
          artifacts: result.runs.map((r) => ({
            type: "log",
            label: `check-${r.taskId?.slice(0, 8)}`,
            value: r.response ?? "no response",
          })),
        };
      }

      case "eval": {
        const evaluation = await runEval({
          store,
          router,
          costTracker,
          cycle,
          tasks: lastTasks,
        });

        // Reset inter-phase state for next cycle
        lastScan = null;
        lastPlan = null;
        lastTasks = [];

        return {
          success: true,
          costUsd: evaluation.costUsd,
          artifacts: evaluation.insights.map((i) => ({
            type: "log",
            label: "insight",
            value: i,
          })),
        };
      }

      default:
        return { success: false, costUsd: 0, error: `Unknown phase: ${phase}` };
    }
  };
}

function estimatePhasesCost(phase: PhaseName): number {
  // Conservative estimates for budget pre-check
  const estimates: Record<PhaseName, number> = {
    scan: 0.01, // Gemini is free, but estimate for ChatGPT fallback
    plan: 0.05, // ChatGPT gpt-4o typical
    build: 0, // Claude Code via Max = free
    ship_check: 0, // Claude Code via Max = free
    eval: 0.05, // ChatGPT gpt-4o typical
  };
  return estimates[phase] ?? 0.1;
}

function getPhaseProvider(phase: PhaseName): string {
  const providers: Record<PhaseName, string> = {
    scan: "gemini",
    plan: "openai",
    build: "claude",
    ship_check: "claude",
    eval: "openai",
  };
  return providers[phase] ?? "unknown";
}
