import crypto from "node:crypto";
import type { Cycle, Evaluation, Recommendation, Task } from "../data/schemas.js";
import type { SkeletonStore } from "../data/store.js";
import type { CostTracker } from "../models/cost-tracker.js";
import type { ModelRouter } from "../models/router.js";

/**
 * EVAL phase — ChatGPT (or mock) performs retrospective.
 * Measures value, updates strategy recommendations, scores the cycle.
 */
export async function runEval(opts: {
  store: SkeletonStore;
  router: ModelRouter;
  costTracker: CostTracker;
  cycle: Cycle;
  tasks: Task[];
}): Promise<Evaluation> {
  const { store, router, costTracker, cycle, tasks } = opts;
  const { adapter, provider } = router.getAdapter("planning");

  const completed = tasks.filter((t) => t.state === "completed");
  const failed = tasks.filter((t) => t.state === "failed");
  const awaiting = tasks.filter((t) => t.state === "awaiting_approval");

  const taskSummary = tasks
    .map(
      (t) =>
        `- [${t.state}] "${t.title}" (cost: $${t.actualCostUsd.toFixed(4)}, tier: ${t.autonomyTier})`,
    )
    .join("\n");

  const systemPrompt = `You are an evaluator for an autonomous tech company. You review completed work cycles and provide actionable recommendations.

Return your evaluation as JSON:
{
  "metrics": {
    "tasksCompleted": number,
    "tasksFailed": number,
    "totalCostUsd": number,
    "avgTaskLatencyMs": number,
    "objectiveProgress": { "objectiveId": progress_0_to_1 }
  },
  "insights": ["string"],
  "recommendations": [
    {
      "action": "string",
      "rationale": "string",
      "priority": "low" | "medium" | "high",
      "truthStatus": "hypothesis",
      "confidence": "low" | "medium" | "high"
    }
  ]
}

Be honest about failures. Don't inflate progress. Recommendations should be specific and actionable.`;

  const userPrompt = `Evaluate this work cycle:

## Cycle #${cycle.number} (mode: ${cycle.mode})
- Total cost: $${cycle.totalCostUsd.toFixed(4)}
- Tasks completed: ${completed.length}
- Tasks failed: ${failed.length}
- Tasks awaiting approval: ${awaiting.length}

## Task Details
${taskSummary || "No tasks were created this cycle."}

## Questions to Answer
1. Did this cycle produce measurable value?
2. Was the cost justified by the output?
3. What should change in the next cycle?
4. Should any objectives be reprioritized?`;

  const result = await adapter.generate({
    systemPrompt,
    userPrompt,
    jsonMode: true,
  });

  costTracker.record({
    timestamp: new Date().toISOString(),
    phase: "eval",
    provider,
    model: adapter.model,
    inputTokens: result.inputTokens,
    outputTokens: result.outputTokens,
    costUsd: result.costUsd,
    latencyMs: result.latencyMs,
  });

  // Parse evaluation
  let metrics = {
    tasksCompleted: completed.length,
    tasksFailed: failed.length,
    totalCostUsd: cycle.totalCostUsd + result.costUsd,
    avgTaskLatencyMs: 0,
    objectiveProgress: {} as Record<string, number>,
  };
  let insights: string[] = [];
  let recommendations: Recommendation[] = [];

  try {
    const parsed = JSON.parse(result.text);
    if (parsed.metrics) {
      metrics = {
        ...metrics,
        ...parsed.metrics,
        // Always use real numbers for these
        tasksCompleted: completed.length,
        tasksFailed: failed.length,
        totalCostUsd: cycle.totalCostUsd + result.costUsd,
      };
    }
    if (Array.isArray(parsed.insights)) {
      insights = parsed.insights.map(String);
    }
    if (Array.isArray(parsed.recommendations)) {
      recommendations = parsed.recommendations.map((r: Record<string, unknown>) => ({
        action: String(r.action ?? ""),
        rationale: String(r.rationale ?? ""),
        priority: ["low", "medium", "high"].includes(String(r.priority))
          ? String(r.priority)
          : "medium",
        truthStatus: "hypothesis" as const,
        confidence: ["low", "medium", "high"].includes(String(r.confidence))
          ? (String(r.confidence) as "low" | "medium" | "high")
          : "low",
      }));
    }
  } catch {
    insights = [`Evaluation parse error: ${result.text.slice(0, 200)}`];
  }

  const evaluation: Evaluation = {
    id: crypto.randomUUID(),
    cycleId: cycle.id,
    model: adapter.model,
    period: {
      start: cycle.startedAt,
      end: new Date().toISOString(),
    },
    metrics,
    insights,
    recommendations,
    truthStatus: "hypothesis",
    confidence: "medium",
    costUsd: result.costUsd,
    createdAt: new Date().toISOString(),
  };

  await store.saveEvaluation(evaluation);
  return evaluation;
}
