import { describe, expect, it } from "vitest";
import { MockModelAdapter, MockBuildWorker } from "./mock-client.js";

describe("MockModelAdapter", () => {
  const adapter = new MockModelAdapter();

  it("has provider=mock and default model", () => {
    expect(adapter.provider).toBe("mock");
    expect(adapter.model).toBe("mock-sim-v1");
  });

  it("accepts custom model name", () => {
    const custom = new MockModelAdapter("custom-v2");
    expect(custom.model).toBe("custom-v2");
  });

  // ── generate() ───────────────────────────────────────────────────

  describe("generate()", () => {
    it("returns valid ModelCallResult structure", async () => {
      const result = await adapter.generate({ userPrompt: "Hello" });
      expect(result).toHaveProperty("text");
      expect(result).toHaveProperty("inputTokens");
      expect(result).toHaveProperty("outputTokens");
      expect(result).toHaveProperty("latencyMs");
      expect(result).toHaveProperty("costUsd");
      expect(typeof result.text).toBe("string");
      expect(result.text.length).toBeGreaterThan(0);
    });

    it("always returns costUsd = 0", async () => {
      const result = await adapter.generate({ userPrompt: "scan research" });
      expect(result.costUsd).toBe(0);
    });

    it("simulates latency (>=10ms)", async () => {
      const result = await adapter.generate({ userPrompt: "test" });
      expect(result.latencyMs).toBeGreaterThanOrEqual(10);
    });

    it("returns token counts", async () => {
      const result = await adapter.generate({ userPrompt: "test prompt", systemPrompt: "system" });
      expect(result.inputTokens).toBeGreaterThan(0);
      expect(result.outputTokens).toBeGreaterThan(0);
    });
  });

  // ── JSON mode responses ──────────────────────────────────────────

  describe("JSON mode", () => {
    it("returns valid JSON for scan/research prompts", async () => {
      const result = await adapter.generate({ userPrompt: "scan the market", jsonMode: true });
      const parsed = JSON.parse(result.text);
      expect(parsed).toHaveProperty("findings");
      expect(Array.isArray(parsed.findings)).toBe(true);
    });

    it("returns valid JSON for plan/strategy prompts", async () => {
      const result = await adapter.generate({
        userPrompt: "create action plan and strategy",
        jsonMode: true,
      });
      const parsed = JSON.parse(result.text);
      expect(parsed).toHaveProperty("summary");
      expect(parsed).toHaveProperty("priorities");
    });

    it("returns valid JSON for eval/retrospective prompts", async () => {
      const result = await adapter.generate({
        userPrompt: "evaluate this work cycle retrospective",
        jsonMode: true,
      });
      const parsed = JSON.parse(result.text);
      expect(parsed).toHaveProperty("metrics");
      expect(parsed).toHaveProperty("recommendations");
    });

    it("returns generic JSON for unknown prompts", async () => {
      const result = await adapter.generate({ userPrompt: "something random", jsonMode: true });
      const parsed = JSON.parse(result.text);
      expect(parsed).toHaveProperty("message");
    });
  });

  // ── Text mode responses ──────────────────────────────────────────

  describe("text mode", () => {
    it("returns ship check text for review prompts", async () => {
      const result = await adapter.generate({ userPrompt: "review the code" });
      expect(result.text).toContain("SHIP CHECK");
    });

    it("returns generic text for unknown prompts", async () => {
      const result = await adapter.generate({ userPrompt: "something else" });
      expect(result.text).toContain("Mock response");
    });
  });

  // ── Determinism ──────────────────────────────────────────────────

  it("same prompt type → same structure", async () => {
    const r1 = await adapter.generate({ userPrompt: "scan research", jsonMode: true });
    const r2 = await adapter.generate({ userPrompt: "scan research", jsonMode: true });
    const p1 = JSON.parse(r1.text);
    const p2 = JSON.parse(r2.text);
    expect(Object.keys(p1)).toEqual(Object.keys(p2));
  });
});

describe("MockBuildWorker", () => {
  const worker = new MockBuildWorker();

  it("has provider=mock", () => {
    expect(worker.provider).toBe("mock");
  });

  // ── execute() ────────────────────────────────────────────────────

  describe("execute()", () => {
    it("returns success with mock artifacts", async () => {
      const result = await worker.execute({
        instruction: "Build a landing page",
        workingDir: "/tmp/test",
      });
      expect(result.success).toBe(true);
      expect(result.output).toContain("SIMULATION");
      expect(result.artifacts).toHaveLength(1);
      expect(result.artifacts[0].type).toBe("log");
      expect(result.costUsd).toBe(0);
    });

    it("includes instruction in output", async () => {
      const result = await worker.execute({
        instruction: "Create React component",
        workingDir: "/tmp/test",
      });
      expect(result.output).toContain("Create React component");
    });

    it("includes workingDir in output", async () => {
      const result = await worker.execute({
        instruction: "Build thing",
        workingDir: "/custom/path",
      });
      expect(result.output).toContain("/custom/path");
    });

    it("simulates latency (>=20ms)", async () => {
      const result = await worker.execute({
        instruction: "test",
        workingDir: "/tmp",
      });
      expect(result.latencyMs).toBeGreaterThanOrEqual(20);
    });
  });

  // ── check() ──────────────────────────────────────────────────────

  describe("check()", () => {
    it("approves successful builds", async () => {
      const buildResult = await worker.execute({
        instruction: "Build",
        workingDir: "/tmp",
      });
      const checkResult = await worker.check(
        { instruction: "Build", workingDir: "/tmp" },
        buildResult,
      );
      expect(checkResult.approved).toBe(true);
      expect(checkResult.issues).toEqual([]);
      expect(checkResult.costUsd).toBe(0);
    });

    it("rejects failed builds", async () => {
      const failedResult = {
        output: "error",
        success: false,
        error: "compile error",
        artifacts: [],
        latencyMs: 50,
        costUsd: 0,
      };
      const checkResult = await worker.check(
        { instruction: "Build", workingDir: "/tmp" },
        failedResult,
      );
      expect(checkResult.approved).toBe(false);
      expect(checkResult.issues.length).toBeGreaterThan(0);
    });

    it("simulates latency (>=10ms)", async () => {
      const buildResult = await worker.execute({
        instruction: "test",
        workingDir: "/tmp",
      });
      const checkResult = await worker.check(
        { instruction: "test", workingDir: "/tmp" },
        buildResult,
      );
      expect(checkResult.latencyMs).toBeGreaterThanOrEqual(10);
    });
  });
});
