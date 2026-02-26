import Anthropic from "@anthropic-ai/sdk";
import type { ModelAdapter, ModelCallResult } from "./adapter.js";

/**
 * Claude API adapter — building and reviewing engine.
 * Uses @anthropic-ai/sdk with claude-sonnet-4-20250514.
 *
 * Pricing (Sonnet 4 as of Feb 2026):
 *   Input:  $3.00 / 1M tokens
 *   Output: $15.00 / 1M tokens
 */
const COST_PER_INPUT_TOKEN = 3.0 / 1_000_000;
const COST_PER_OUTPUT_TOKEN = 15.0 / 1_000_000;

export class ClaudeClient implements ModelAdapter {
  readonly provider = "claude";
  readonly model: string;
  private client: Anthropic;

  constructor(apiKey: string, model = "claude-sonnet-4-20250514") {
    this.client = new Anthropic({ apiKey });
    this.model = model;
  }

  async generate(opts: {
    systemPrompt?: string;
    userPrompt: string;
    jsonMode?: boolean;
  }): Promise<ModelCallResult> {
    const start = Date.now();

    const message = await this.client.messages.create({
      model: this.model,
      max_tokens: 4096,
      system: opts.systemPrompt ?? "",
      messages: [{ role: "user", content: opts.userPrompt }],
    });

    const text = message.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("\n");

    const inputTokens = message.usage.input_tokens;
    const outputTokens = message.usage.output_tokens;
    const costUsd = inputTokens * COST_PER_INPUT_TOKEN + outputTokens * COST_PER_OUTPUT_TOKEN;

    return {
      text,
      inputTokens,
      outputTokens,
      latencyMs: Date.now() - start,
      costUsd,
    };
  }
}
