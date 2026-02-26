import crypto from "node:crypto";
import type { Cycle, Run, Task } from "../data/schemas.js";
import type { SkeletonStore } from "../data/store.js";
import type { CostTracker } from "../models/cost-tracker.js";
import type { ModelRouter } from "../models/router.js";

/**
 * SHIP_CHECK phase — Claude (or mock) reviews build output.
 * V1: Code review, test verification, security audit, package check only.
 * NO production deploys, NO ad spend, NO outbound comms.
 */
export async function runShipCheck(opts: {
  store: SkeletonStore;
  router: ModelRouter;
  costTracker: CostTracker;
  cycle: Cycle;
  tasks: Task[];
}): Promise<{ tasks: Task[]; runs: Run[]; totalCostUsd: number }> {
  const { store, router, costTracker, cycle, tasks } = opts;
  const { worker, provider } = router.getBuildWorker();
  const runs: Run[] = [];
  let totalCostUsd = 0;

  for (const task of tasks) {
    // Only review tasks that were built successfully
    if (task.state !== "reviewing") continue;

    const artifactSummary = task.artifacts
      .map((a) => `- [${a.type}] ${a.label}: ${a.value}`)
      .join("\n");

    const checkResult = await worker.check(
      {
        instruction: task.title,
        workingDir: process.cwd(),
        context: task.description,
      },
      {
        output: artifactSummary || "No artifacts produced",
        success: true,
        artifacts: task.artifacts.map((a) => ({
          type: a.type,
          label: a.label,
          value: a.value,
        })),
        latencyMs: 0,
        costUsd: 0,
      },
    );

    totalCostUsd += checkResult.costUsd;

    const run: Run = {
      id: crypto.randomUUID(),
      taskId: task.id,
      cycleId: cycle.id,
      phase: "ship_check",
      model: `${provider}-checker`,
      provider: provider as "gemini" | "openai" | "claude" | "mock",
      prompt: `Review: ${task.title}`,
      response: checkResult.summary,
      success: checkResult.approved,
      error: checkResult.approved ? undefined : checkResult.issues.join("; "),
      costUsd: checkResult.costUsd,
      inputTokens: 0,
      outputTokens: 0,
      latencyMs: checkResult.latencyMs,
      createdAt: new Date().toISOString(),
    };

    runs.push(run);
    await store.saveRun(run);

    // Update task state
    task.state = checkResult.approved ? "completed" : "failed";
    if (!checkResult.approved) {
      task.error = checkResult.issues.join("; ");
    }
    task.actualCostUsd += checkResult.costUsd;
    task.updatedAt = new Date().toISOString();
    if (task.state === "completed") {
      task.completedAt = new Date().toISOString();
      task.truthStatus = "implemented";
    }

    costTracker.record({
      timestamp: new Date().toISOString(),
      phase: "ship_check",
      taskId: task.id,
      provider,
      model: `${provider}-checker`,
      inputTokens: 0,
      outputTokens: 0,
      costUsd: checkResult.costUsd,
      latencyMs: checkResult.latencyMs,
    });
  }

  // Persist updated tasks
  const allTasks = await store.loadTasks();
  for (const task of tasks) {
    const idx = allTasks.findIndex((t) => t.id === task.id);
    if (idx >= 0) allTasks[idx] = task;
  }
  await store.saveTasks(allTasks);

  return { tasks, runs, totalCostUsd };
}
