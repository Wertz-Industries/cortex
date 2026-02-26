import type {
  BuildResult,
  BuildTask,
  BuildWorkerAdapter,
  ModelAdapter,
  ModelCallResult,
  ShipCheckResult,
} from "./adapter.js";

/**
 * Mock model adapter for simulation mode.
 * Returns templated responses based on prompt structure. Zero cost.
 */
export class MockModelAdapter implements ModelAdapter {
  readonly provider = "mock";
  readonly model: string;

  constructor(model = "mock-sim-v1") {
    this.model = model;
  }

  async generate(opts: {
    systemPrompt?: string;
    userPrompt: string;
    jsonMode?: boolean;
  }): Promise<ModelCallResult> {
    const start = Date.now();

    // Simulate some latency (10-50ms)
    await new Promise((r) => setTimeout(r, 10 + Math.random() * 40));

    const promptLower = opts.userPrompt.toLowerCase();
    let text: string;

    if (opts.jsonMode) {
      text = this.generateJsonResponse(promptLower);
    } else {
      text = this.generateTextResponse(promptLower);
    }

    const inputTokens = Math.ceil((opts.systemPrompt?.length ?? 0 + opts.userPrompt.length) / 4);
    const outputTokens = Math.ceil(text.length / 4);

    return {
      text,
      inputTokens,
      outputTokens,
      latencyMs: Date.now() - start,
      costUsd: 0, // Simulation mode = free
    };
  }

  private generateJsonResponse(promptLower: string): string {
    // Order matters: check plan/eval before scan since plan prompts contain "research"
    if (promptLower.includes("action plan") || promptLower.includes("strateg")) {
      return JSON.stringify({
        summary:
          "Focus on SMB web presence gap as highest-ROI opportunity. Build templated landing page system with AI-generated copy.",
        priorities: [
          {
            objectiveId: "placeholder",
            rationale: "Fastest path to first revenue with lowest build cost",
            proposedTasks: [
              {
                title: "Build landing page template system",
                description:
                  "Create a configurable landing page generator using Tailwind + React that can be customized per client",
                estimatedComplexity: "medium",
                suggestedTier: "0",
              },
              {
                title: "Draft outreach email templates",
                description:
                  "Create 3 personalized outreach email templates targeting local SMBs without web presence",
                estimatedComplexity: "small",
                suggestedTier: "0",
              },
            ],
          },
        ],
      });
    }

    if (promptLower.includes("evaluate this work cycle") || promptLower.includes("retrospective")) {
      return JSON.stringify({
        metrics: {
          tasksCompleted: 2,
          tasksFailed: 0,
          totalCostUsd: 0,
          avgTaskLatencyMs: 5000,
          objectiveProgress: {},
        },
        insights: [
          "Simulation mode produced structured artifacts for all phases",
          "Template quality would need human review before live use",
        ],
        recommendations: [
          {
            action: "Enable Gemini for real research scans",
            rationale: "Free API — no cost risk, but real market data",
            priority: "high",
            truthStatus: "hypothesis",
            confidence: "medium",
          },
        ],
      });
    }

    if (promptLower.includes("scan") || promptLower.includes("research")) {
      return JSON.stringify({
        findings: [
          {
            topic: "SMB Digital Presence Gap",
            summary:
              "Many local SMBs lack modern web presence. Average cost for a basic site is $3-5k, creating opportunity for templated solutions at $500-1k.",
            relevance: 0.85,
            sources: ["simulated-market-data"],
            truthStatus: "speculative",
            confidence: "medium",
          },
          {
            topic: "AI Automation Demand",
            summary:
              "Growing demand for workflow automation among 10-50 employee businesses. Most can't afford enterprise solutions.",
            relevance: 0.72,
            sources: ["simulated-trend-data"],
            truthStatus: "speculative",
            confidence: "low",
          },
        ],
      });
    }

    return JSON.stringify({ message: "Mock response", prompt_length: promptLower.length });
  }

  private generateTextResponse(promptLower: string): string {
    if (promptLower.includes("review") || promptLower.includes("check")) {
      return "SHIP CHECK PASSED (simulation)\n\nAll artifacts reviewed:\n- Landing page template: structure valid, responsive layout\n- Email templates: professional tone, clear CTA\n- No security issues detected\n- No external dependencies or live endpoints";
    }

    return `Mock response for prompt (${promptLower.length} chars). This is a simulation — no real model was called.`;
  }
}

/**
 * Mock build worker for simulation mode.
 * Produces placeholder artifacts without spawning any real processes.
 */
export class MockBuildWorker implements BuildWorkerAdapter {
  readonly provider = "mock";

  async execute(task: BuildTask): Promise<BuildResult> {
    const start = Date.now();
    await new Promise((r) => setTimeout(r, 20 + Math.random() * 80));

    return {
      output: `[SIMULATION] Build task executed:\n${task.instruction}\n\nArtifacts would be created in: ${task.workingDir}`,
      success: true,
      artifacts: [
        {
          type: "log",
          label: "build-output",
          value: "Simulated build completed successfully. No files were created.",
        },
      ],
      latencyMs: Date.now() - start,
      costUsd: 0,
    };
  }

  async check(task: BuildTask, result: BuildResult): Promise<ShipCheckResult> {
    const start = Date.now();
    await new Promise((r) => setTimeout(r, 10 + Math.random() * 30));

    return {
      approved: result.success,
      issues: result.success ? [] : ["Build failed — cannot approve"],
      summary: result.success
        ? "Simulation ship check passed. All artifacts would be reviewed in live mode."
        : "Build failure prevents approval.",
      latencyMs: Date.now() - start,
      costUsd: 0,
    };
  }
}
