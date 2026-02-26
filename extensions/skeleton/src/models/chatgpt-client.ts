import OpenAI from "openai";
import type { ModelAdapter, ModelCallResult } from "./adapter.js";

/**
 * ChatGPT model adapter — planning and evaluation engine.
 * Uses OpenAI SDK with gpt-4o. JSON mode for structured outputs.
 *
 * Pricing (gpt-4o as of Feb 2026):
 *   Input: $2.50 / 1M tokens
 *   Output: $10.00 / 1M tokens
 */
const COST_PER_INPUT_TOKEN = 2.5 / 1_000_000;
const COST_PER_OUTPUT_TOKEN = 10.0 / 1_000_000;

export class ChatGPTClient implements ModelAdapter {
  readonly provider = "openai";
  readonly model: string;
  private client: OpenAI;

  constructor(apiKey: string, model = "gpt-4o") {
    this.client = new OpenAI({ apiKey });
    this.model = model;
  }

  async generate(opts: {
    systemPrompt?: string;
    userPrompt: string;
    jsonMode?: boolean;
  }): Promise<ModelCallResult> {
    const start = Date.now();

    const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [];
    if (opts.systemPrompt) {
      messages.push({ role: "system", content: opts.systemPrompt });
    }
    messages.push({ role: "user", content: opts.userPrompt });

    const completion = await this.client.chat.completions.create({
      model: this.model,
      messages,
      response_format: opts.jsonMode ? { type: "json_object" } : undefined,
      temperature: 0.7,
    });

    const choice = completion.choices[0];
    const text = choice?.message?.content ?? "";
    const usage = completion.usage;
    const inputTokens = usage?.prompt_tokens ?? 0;
    const outputTokens = usage?.completion_tokens ?? 0;
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
