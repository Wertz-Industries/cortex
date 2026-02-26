/**
 * Abstract interfaces for model integration.
 * Concrete implementations: MockModelAdapter, GeminiClient, ChatGPTClient, ClaudeCliAdapter
 */

/** Result of any model call (research, planning, or evaluation). */
export type ModelCallResult = {
  text: string;
  inputTokens: number;
  outputTokens: number;
  latencyMs: number;
  costUsd: number;
};

/** Role-based model selection. */
export type ModelRole = "research" | "planning" | "building" | "reviewing";

/**
 * Adapter for text-generation models (Gemini, ChatGPT, mock).
 * Used for SCAN, PLAN, and EVAL phases.
 */
export interface ModelAdapter {
  readonly provider: string;
  readonly model: string;

  /** Generate a completion. System prompt is optional. */
  generate(opts: {
    systemPrompt?: string;
    userPrompt: string;
    jsonMode?: boolean;
  }): Promise<ModelCallResult>;
}

/** Input for a build task. */
export type BuildTask = {
  instruction: string;
  workingDir: string;
  maxTurns?: number;
  context?: string;
};

/** Result from a build execution. */
export type BuildResult = {
  output: string;
  success: boolean;
  error?: string;
  artifacts: Array<{ type: string; label: string; value: string }>;
  latencyMs: number;
  costUsd: number;
};

/** Result from a ship check / code review. */
export type ShipCheckResult = {
  approved: boolean;
  issues: string[];
  summary: string;
  latencyMs: number;
  costUsd: number;
};

/**
 * Adapter for build workers (Claude Code).
 * Behind an interface so it can be swapped for API, MCP, or other builders.
 */
export interface BuildWorkerAdapter {
  readonly provider: string;

  /** Execute a build task (code generation, file creation, etc). */
  execute(task: BuildTask): Promise<BuildResult>;

  /** Review build output for quality, security, correctness. */
  check(task: BuildTask, result: BuildResult): Promise<ShipCheckResult>;
}
