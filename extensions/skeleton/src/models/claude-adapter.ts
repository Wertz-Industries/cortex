import { execFile } from "node:child_process";
import type { BuildResult, BuildTask, BuildWorkerAdapter, ShipCheckResult } from "./adapter.js";

/**
 * Claude Code CLI adapter — build worker via `claude --print`.
 * Free via Max subscription. Spawns claude process per task.
 *
 * Implements BuildWorkerAdapter so it can be swapped for
 * direct API, MCP protocol, or any other builder.
 */
export class ClaudeCliAdapter implements BuildWorkerAdapter {
  readonly provider = "claude";

  constructor(
    private claudeBinary = "claude",
    private maxOutputTokens = 16384,
  ) {}

  async execute(task: BuildTask): Promise<BuildResult> {
    const start = Date.now();

    const prompt = task.context
      ? `Context: ${task.context}\n\n${task.instruction}`
      : task.instruction;

    try {
      const output = await this.runClaude(prompt, task.workingDir);

      // Parse artifacts from output (look for file paths, URLs, etc.)
      const artifacts = this.extractArtifacts(output);

      return {
        output,
        success: true,
        artifacts,
        latencyMs: Date.now() - start,
        costUsd: 0, // Free via Max subscription
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return {
        output: "",
        success: false,
        error: msg,
        artifacts: [],
        latencyMs: Date.now() - start,
        costUsd: 0,
      };
    }
  }

  async check(task: BuildTask, result: BuildResult): Promise<ShipCheckResult> {
    const start = Date.now();

    const artifactSummary = result.artifacts
      .map((a) => `- [${a.type}] ${a.label}: ${a.value}`)
      .join("\n");

    const prompt = `You are a code reviewer. Review this build output for quality, security, and correctness.

## Task
${task.instruction}

## Build Output
${result.output.slice(0, 4000)}

## Artifacts
${artifactSummary || "No artifacts"}

Respond with:
1. APPROVED or REJECTED
2. List any issues found
3. Brief summary

Start your response with "APPROVED" or "REJECTED" on the first line.`;

    try {
      const output = await this.runClaude(prompt, task.workingDir);
      const firstLine = output.trim().split("\n")[0]?.toUpperCase() ?? "";
      const approved = firstLine.includes("APPROVED");

      const issues: string[] = [];
      if (!approved) {
        const lines = output.split("\n").slice(1);
        for (const line of lines) {
          const trimmed = line.trim();
          if (trimmed.startsWith("-") || trimmed.startsWith("*")) {
            issues.push(trimmed.slice(1).trim());
          }
        }
        if (issues.length === 0) {
          issues.push("Review rejected without specific issues");
        }
      }

      return {
        approved,
        issues,
        summary: output.slice(0, 500),
        latencyMs: Date.now() - start,
        costUsd: 0,
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return {
        approved: false,
        issues: [`Claude check failed: ${msg}`],
        summary: `Error: ${msg}`,
        latencyMs: Date.now() - start,
        costUsd: 0,
      };
    }
  }

  private runClaude(prompt: string, cwd: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const proc = execFile(
        this.claudeBinary,
        ["--print", "--output-format", "text", "--max-turns", "1", "-p", prompt],
        {
          cwd,
          maxBuffer: 10 * 1024 * 1024, // 10MB
          timeout: 5 * 60 * 1000, // 5 min
          env: { ...process.env },
        },
        (error, stdout, stderr) => {
          if (error) {
            reject(new Error(`claude CLI failed: ${error.message}\n${stderr}`));
            return;
          }
          resolve(stdout);
        },
      );
    });
  }

  private extractArtifacts(output: string): Array<{ type: string; label: string; value: string }> {
    const artifacts: Array<{ type: string; label: string; value: string }> = [];

    // Look for file paths mentioned in output
    const fileMatches = output.match(
      /(?:created|wrote|generated|saved)\s+(?:to\s+)?["`']?([./~][\w/.@-]+)["`']?/gi,
    );
    if (fileMatches) {
      for (const match of fileMatches) {
        const pathMatch = match.match(/["`']?([./~][\w/.@-]+)["`']?$/);
        if (pathMatch?.[1]) {
          artifacts.push({
            type: "file",
            label: pathMatch[1].split("/").pop() ?? "file",
            value: pathMatch[1],
          });
        }
      }
    }

    // Always include a log artifact with truncated output
    artifacts.push({
      type: "log",
      label: "build-output",
      value: output.slice(0, 500),
    });

    return artifacts;
  }
}
