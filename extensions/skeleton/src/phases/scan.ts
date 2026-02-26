import crypto from "node:crypto";
import type { Cycle, Objective, Scan, ScanFinding } from "../data/schemas.js";
import type { SkeletonStore } from "../data/store.js";
import type { CostTracker } from "../models/cost-tracker.js";
import type { ModelRouter } from "../models/router.js";

/**
 * SCAN phase — Gemini researches active objectives.
 * Produces structured findings with truthStatus labels.
 */
export async function runScan(opts: {
  store: SkeletonStore;
  router: ModelRouter;
  costTracker: CostTracker;
  cycle: Cycle;
  objectives: Objective[];
}): Promise<Scan> {
  const { store, router, costTracker, cycle, objectives } = opts;
  const { adapter, provider } = router.getAdapter("research");

  const objectivesSummary = objectives
    .map(
      (o, i) =>
        `${i + 1}. "${o.title}" (weight: ${o.weight}, status: ${o.truthStatus}/${o.confidence})\n   ${o.description}`,
    )
    .join("\n\n");

  const systemPrompt = `You are a research analyst for an autonomous tech company. Your role is to scan for opportunities, threats, and market signals relevant to the given business objectives.

Return your findings as JSON with this structure:
{
  "findings": [
    {
      "topic": "string",
      "summary": "string (2-3 sentences)",
      "relevance": number (0-1),
      "sources": ["string"],
      "truthStatus": "speculative" | "hypothesis",
      "confidence": "low" | "medium" | "high"
    }
  ]
}

Be specific and actionable. Avoid generic advice. Every finding must have a concrete basis.`;

  const userPrompt = `Research the following business objectives and provide findings:

${objectivesSummary}

For each objective, investigate:
- Current market trends and opportunities
- Competitor activity and gaps
- Technical feasibility considerations
- Risks, blockers, or timing factors

Return 2-5 findings, ranked by relevance.`;

  const result = await adapter.generate({
    systemPrompt,
    userPrompt,
    jsonMode: true,
  });

  // Track cost
  costTracker.record({
    timestamp: new Date().toISOString(),
    phase: "scan",
    provider,
    model: adapter.model,
    inputTokens: result.inputTokens,
    outputTokens: result.outputTokens,
    costUsd: result.costUsd,
    latencyMs: result.latencyMs,
  });

  // Parse findings
  let findings: ScanFinding[] = [];
  try {
    const parsed = JSON.parse(result.text);
    if (Array.isArray(parsed.findings)) {
      findings = parsed.findings.map((f: Record<string, unknown>) => ({
        topic: String(f.topic ?? "Unknown"),
        summary: String(f.summary ?? ""),
        relevance: typeof f.relevance === "number" ? f.relevance : 0.5,
        sources: Array.isArray(f.sources) ? f.sources.map(String) : [],
        truthStatus: f.truthStatus === "hypothesis" ? "hypothesis" : "speculative",
        confidence: f.confidence === "high" ? "high" : f.confidence === "medium" ? "medium" : "low",
      }));
    }
  } catch {
    findings = [
      {
        topic: "Parse Error",
        summary: `Failed to parse scan response: ${result.text.slice(0, 200)}`,
        relevance: 0,
        sources: [],
        truthStatus: "speculative",
        confidence: "low",
      },
    ];
  }

  const scan: Scan = {
    id: crypto.randomUUID(),
    cycleId: cycle.id,
    objectiveIds: objectives.map((o) => o.id),
    model: adapter.model,
    prompt: userPrompt,
    response: result.text,
    findings,
    costUsd: result.costUsd,
    inputTokens: result.inputTokens,
    outputTokens: result.outputTokens,
    latencyMs: result.latencyMs,
    createdAt: new Date().toISOString(),
  };

  await store.saveScan(scan);
  return scan;
}
