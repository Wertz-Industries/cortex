import { GoogleGenerativeAI } from "@google/generative-ai";
import type { ModelAdapter, ModelCallResult } from "./adapter.js";

/**
 * Gemini model adapter — free tier research engine.
 * Uses @google/generative-ai SDK with gemini-2.0-flash.
 */
export class GeminiClient implements ModelAdapter {
  readonly provider = "gemini";
  readonly model: string;
  private client: GoogleGenerativeAI;

  constructor(apiKey: string, model = "gemini-2.0-flash") {
    this.client = new GoogleGenerativeAI(apiKey);
    this.model = model;
  }

  async generate(opts: {
    systemPrompt?: string;
    userPrompt: string;
    jsonMode?: boolean;
  }): Promise<ModelCallResult> {
    const start = Date.now();

    const generativeModel = this.client.getGenerativeModel({
      model: this.model,
      systemInstruction: opts.systemPrompt,
      generationConfig: opts.jsonMode ? { responseMimeType: "application/json" } : undefined,
    });

    const result = await generativeModel.generateContent(opts.userPrompt);
    const response = result.response;
    const text = response.text();

    const usage = response.usageMetadata;
    const inputTokens = usage?.promptTokenCount ?? 0;
    const outputTokens = usage?.candidatesTokenCount ?? 0;

    // Gemini free tier = $0.00 for flash
    const costUsd = 0;

    return {
      text,
      inputTokens,
      outputTokens,
      latencyMs: Date.now() - start,
      costUsd,
    };
  }
}
