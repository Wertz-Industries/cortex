import crypto from "node:crypto";
import { resolveTier } from "../autonomy/tier-resolver.js";
import type { Cycle, Plan, Task } from "../data/schemas.js";
import type { SkeletonStore } from "../data/store.js";
import type { CostTracker } from "../models/cost-tracker.js";
import type { ModelRouter } from "../models/router.js";

/**
 * BUILD phase — Claude Code (or mock) executes planned tasks.
 * Creates Task records from the plan, then executes each via BuildWorkerAdapter.
 */
export async function runBuild(opts: {
  store: SkeletonStore;
  router: ModelRouter;
  costTracker: CostTracker;
  cycle: Cycle;
  plan: Plan;
}): Promise<{ tasks: Task[]; totalCostUsd: number }> {
  const { store, router, costTracker, cycle, plan } = opts;
  const { worker, provider } = router.getBuildWorker();

  const existingTasks = await store.loadTasks();
  const newTasks: Task[] = [];
  let totalCostUsd = 0;

  for (const priority of plan.strategy.priorities) {
    for (const proposed of priority.proposedTasks) {
      const tier = resolveTier({
        title: proposed.title,
        description: proposed.description,
        suggestedTier: proposed.suggestedTier as "0" | "1" | "2",
      });

      const now = new Date().toISOString();
      const task: Task = {
        id: crypto.randomUUID(),
        objectiveId: priority.objectiveId,
        cycleId: cycle.id,
        title: proposed.title,
        description: proposed.description,
        state: "building",
        autonomyTier: tier,
        budgetCapUsd: 5,
        actualCostUsd: 0,
        modelAssignment: { build: provider },
        artifacts: [],
        truthStatus: "hypothesis",
        confidence: "medium",
        retryCount: 0,
        createdAt: now,
        updatedAt: now,
      };

      // Tier 2 tasks queue for approval instead of executing
      if (tier === "2") {
        task.state = "awaiting_approval";
        newTasks.push(task);
        continue;
      }

      // Execute via build worker
      const result = await worker.execute({
        instruction: `${proposed.title}\n\n${proposed.description}`,
        workingDir: process.cwd(),
        context: `Cycle #${cycle.number}, Objective: ${priority.objectiveId}`,
      });

      task.actualCostUsd = result.costUsd;
      totalCostUsd += result.costUsd;

      if (result.success) {
        task.state = "reviewing";
        task.artifacts = result.artifacts.map((a) => ({
          type: a.type as "branch" | "pr" | "file" | "url" | "log",
          label: a.label,
          value: a.value,
        }));
      } else {
        task.state = "failed";
        task.error = result.error;
      }
      task.updatedAt = new Date().toISOString();

      costTracker.record({
        timestamp: new Date().toISOString(),
        phase: "build",
        taskId: task.id,
        provider,
        model: `${provider}-worker`,
        inputTokens: 0,
        outputTokens: 0,
        costUsd: result.costUsd,
        latencyMs: result.latencyMs,
      });

      newTasks.push(task);
    }
  }

  // Persist all tasks
  const allTasks = [...existingTasks, ...newTasks];
  await store.saveTasks(allTasks);

  return { tasks: newTasks, totalCostUsd };
}
