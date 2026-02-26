import crypto from "node:crypto";
import type { Cycle, Objective, Plan, PlanPriority, Scan } from "../data/schemas.js";
import type { SkeletonStore } from "../data/store.js";
import type { CostTracker } from "../models/cost-tracker.js";
import type { ModelRouter } from "../models/router.js";

/**
 * PLAN phase — ChatGPT creates strategy and proposes tasks.
 * Takes scan findings + objectives, outputs prioritized action plan.
 */
export async function runPlan(opts: {
  store: SkeletonStore;
  router: ModelRouter;
  costTracker: CostTracker;
  cycle: Cycle;
  scan: Scan;
  objectives: Objective[];
}): Promise<Plan> {
  const { store, router, costTracker, cycle, scan, objectives } = opts;
  const { adapter, provider } = router.getAdapter("planning");

  const findingsSummary = scan.findings
    .map(
      (f, i) =>
        `${i + 1}. [${f.truthStatus}/${f.confidence}] "${f.topic}" (relevance: ${f.relevance})\n   ${f.summary}`,
    )
    .join("\n\n");

  const objectivesSummary = objectives
    .map(
      (o) =>
        `- "${o.title}" (weight: ${o.weight})\n  Criteria: ${o.acceptanceCriteria.join("; ") || "none specified"}`,
    )
    .join("\n");

  const systemPrompt = `You are a strategic planner for an autonomous tech company. You receive research findings and business objectives, then create a concrete action plan.

Return your plan as JSON:
{
  "summary": "string (1-2 sentence strategy)",
  "priorities": [
    {
      "objectiveId": "uuid of the objective",
      "rationale": "why this objective should be prioritized now",
      "proposedTasks": [
        {
          "title": "concrete task title",
          "description": "specific description with acceptance criteria",
          "estimatedComplexity": "trivial" | "small" | "medium" | "large",
          "suggestedTier": "0" | "1" | "2"
        }
      ]
    }
  ]
}

Rules:
- Tier 0 = fully autonomous (safe: research, tests, code in branches, PRs)
- Tier 1 = budget-constrained (staging, experiments)
- Tier 2 = requires human approval (production, customer-facing, spending)
- Be specific — vague tasks are useless
- Prioritize by speed-to-value × objective weight
- Max 5 tasks per objective, max 10 tasks total`;

  const userPrompt = `Create an action plan based on these research findings and objectives.

## Objectives
${objectivesSummary}

## Research Findings
${findingsSummary}

Propose concrete, buildable tasks ranked by impact. Each task should be achievable in a single work session.`;

  const result = await adapter.generate({
    systemPrompt,
    userPrompt,
    jsonMode: true,
  });

  costTracker.record({
    timestamp: new Date().toISOString(),
    phase: "plan",
    provider,
    model: adapter.model,
    inputTokens: result.inputTokens,
    outputTokens: result.outputTokens,
    costUsd: result.costUsd,
    latencyMs: result.latencyMs,
  });

  // Parse strategy
  let summary = "Plan parsing failed";
  let priorities: PlanPriority[] = [];
  try {
    const parsed = JSON.parse(result.text);
    summary = String(parsed.summary ?? "No summary");
    if (Array.isArray(parsed.priorities)) {
      priorities = parsed.priorities.map((p: Record<string, unknown>) => ({
        objectiveId: String(p.objectiveId ?? objectives[0]?.id ?? "unknown"),
        rationale: String(p.rationale ?? ""),
        proposedTasks: Array.isArray(p.proposedTasks)
          ? p.proposedTasks.map((t: Record<string, unknown>) => ({
              title: String(t.title ?? "Untitled"),
              description: String(t.description ?? ""),
              estimatedComplexity: ["trivial", "small", "medium", "large"].includes(
                String(t.estimatedComplexity),
              )
                ? String(t.estimatedComplexity)
                : "medium",
              suggestedTier: ["0", "1", "2"].includes(String(t.suggestedTier))
                ? String(t.suggestedTier)
                : "0",
            }))
          : [],
      }));
    }
  } catch {
    summary = `Plan parse error: ${result.text.slice(0, 200)}`;
  }

  const plan: Plan = {
    id: crypto.randomUUID(),
    cycleId: cycle.id,
    scanId: scan.id,
    model: adapter.model,
    prompt: userPrompt,
    response: result.text,
    strategy: { summary, priorities },
    truthStatus: "hypothesis",
    confidence: "medium",
    costUsd: result.costUsd,
    inputTokens: result.inputTokens,
    outputTokens: result.outputTokens,
    latencyMs: result.latencyMs,
    createdAt: new Date().toISOString(),
  };

  await store.savePlan(plan);
  return plan;
}
