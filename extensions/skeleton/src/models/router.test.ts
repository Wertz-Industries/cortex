import { describe, expect, it, beforeEach } from "vitest";
import type { SkeletonConfig } from "../data/schemas.js";
import type { ModelAdapter, BuildWorkerAdapter, ModelRole } from "./adapter.js";
import { MockModelAdapter, MockBuildWorker } from "./mock-client.js";
import { ModelRouter } from "./router.js";

function makeConfig(overrides: Partial<SkeletonConfig> = {}): SkeletonConfig {
  return {
    mode: "simulation",
    cycleCooldownMinutes: 15,
    budgets: {
      perCallUsd: 0.5,
      perTaskUsd: 5,
      perCycleUsd: 20,
      dailyUsd: 10,
      weeklyUsd: 50,
      perProviderDailyUsd: { openai: 5, gemini: 0, claude: 0 },
    },
    selectiveProviders: { gemini: false, openai: false, claude: false },
    ...overrides,
  };
}

function fakeLiveAdapter(provider: string): ModelAdapter {
  return {
    provider,
    model: `${provider}-live-v1`,
    async generate() {
      return { text: "live", inputTokens: 10, outputTokens: 10, latencyMs: 50, costUsd: 0.01 };
    },
  };
}

function fakeBuildWorker(provider: string): BuildWorkerAdapter {
  return {
    provider,
    async execute() {
      return { output: "built", success: true, artifacts: [], latencyMs: 100, costUsd: 0 };
    },
    async check() {
      return { approved: true, issues: [], summary: "ok", latencyMs: 10, costUsd: 0 };
    },
  };
}

describe("ModelRouter", () => {
  // ── Simulation mode ──────────────────────────────────────────────

  describe("simulation mode", () => {
    it("all roles return mock adapter", () => {
      const router = new ModelRouter(makeConfig({ mode: "simulation" }));
      const roles: ModelRole[] = ["research", "planning", "building", "reviewing"];
      for (const role of roles) {
        const { adapter, provider, isMock } = router.getAdapter(role);
        expect(isMock).toBe(true);
        expect(provider).toBe("mock");
        expect(adapter.provider).toBe("mock");
      }
    });

    it("getBuildWorker returns mock", () => {
      const router = new ModelRouter(makeConfig({ mode: "simulation" }));
      const { worker, provider, isMock } = router.getBuildWorker();
      expect(isMock).toBe(true);
      expect(provider).toBe("mock");
    });

    it("returns mock even when live adapters are registered", () => {
      const router = new ModelRouter(makeConfig({ mode: "simulation" }));
      router.registerAdapter("gemini", fakeLiveAdapter("gemini"));
      const { isMock } = router.getAdapter("research");
      expect(isMock).toBe(true);
    });
  });

  // ── Selective mode ───────────────────────────────────────────────

  describe("selective mode", () => {
    it("returns live adapter for enabled providers", () => {
      const router = new ModelRouter(
        makeConfig({
          mode: "selective",
          selectiveProviders: { gemini: true, openai: false, claude: false },
        }),
      );
      router.registerAdapter("gemini", fakeLiveAdapter("gemini"));

      const { adapter, isMock } = router.getAdapter("research"); // primary=gemini
      expect(isMock).toBe(false);
      expect(adapter.provider).toBe("gemini");
    });

    it("falls back to mock for disabled providers", () => {
      const router = new ModelRouter(
        makeConfig({
          mode: "selective",
          selectiveProviders: { gemini: false, openai: false, claude: false },
        }),
      );
      router.registerAdapter("gemini", fakeLiveAdapter("gemini"));

      const { isMock } = router.getAdapter("research");
      expect(isMock).toBe(true);
    });

    it("falls back to secondary if primary is disabled but secondary enabled", () => {
      const router = new ModelRouter(
        makeConfig({
          mode: "selective",
          selectiveProviders: { gemini: false, openai: true, claude: false },
        }),
      );
      router.registerAdapter("openai", fakeLiveAdapter("openai"));

      // research primary=gemini (disabled), fallback=openai (enabled)
      const { adapter, isMock } = router.getAdapter("research");
      expect(isMock).toBe(false);
      expect(adapter.provider).toBe("openai");
    });

    it("returns mock build worker when claude is disabled", () => {
      const router = new ModelRouter(
        makeConfig({
          mode: "selective",
          selectiveProviders: { gemini: true, openai: true, claude: false },
        }),
      );
      router.registerBuildWorker("claude", fakeBuildWorker("claude"));

      const { isMock } = router.getBuildWorker();
      expect(isMock).toBe(true);
    });

    it("returns live build worker when claude is enabled", () => {
      const router = new ModelRouter(
        makeConfig({
          mode: "selective",
          selectiveProviders: { gemini: false, openai: false, claude: true },
        }),
      );
      router.registerBuildWorker("claude", fakeBuildWorker("claude"));

      const { isMock, provider } = router.getBuildWorker();
      expect(isMock).toBe(false);
      expect(provider).toBe("claude");
    });
  });

  // ── Live mode ────────────────────────────────────────────────────

  describe("live mode", () => {
    it("returns live adapters when registered", () => {
      const router = new ModelRouter(makeConfig({ mode: "live" }));
      router.registerAdapter("gemini", fakeLiveAdapter("gemini"));
      router.registerAdapter("openai", fakeLiveAdapter("openai"));
      router.registerAdapter("claude", fakeLiveAdapter("claude"));

      expect(router.getAdapter("research").adapter.provider).toBe("gemini");
      expect(router.getAdapter("planning").adapter.provider).toBe("openai");
      expect(router.getAdapter("building").adapter.provider).toBe("claude");
      expect(router.getAdapter("reviewing").adapter.provider).toBe("claude");
    });

    it("falls back to secondary when primary not registered", () => {
      const router = new ModelRouter(makeConfig({ mode: "live" }));
      router.registerAdapter("openai", fakeLiveAdapter("openai"));
      // research primary=gemini (not registered), fallback=openai

      const { adapter, isMock } = router.getAdapter("research");
      expect(isMock).toBe(false);
      expect(adapter.provider).toBe("openai");
    });

    it("falls back to mock when no adapters registered", () => {
      const router = new ModelRouter(makeConfig({ mode: "live" }));
      const { isMock } = router.getAdapter("research");
      expect(isMock).toBe(true);
    });

    it("returns mock build worker when claude not registered", () => {
      const router = new ModelRouter(makeConfig({ mode: "live" }));
      const { isMock } = router.getBuildWorker();
      expect(isMock).toBe(true);
    });
  });

  // ── Role → provider mapping ──────────────────────────────────────

  describe("role assignments", () => {
    it("research → gemini primary, openai fallback", () => {
      const router = new ModelRouter(makeConfig());
      const a = router.getAssignment("research");
      expect(a.primary).toBe("gemini");
      expect(a.fallback).toBe("openai");
    });

    it("planning → openai primary, gemini fallback", () => {
      const router = new ModelRouter(makeConfig());
      const a = router.getAssignment("planning");
      expect(a.primary).toBe("openai");
      expect(a.fallback).toBe("gemini");
    });

    it("building → claude primary, no fallback", () => {
      const router = new ModelRouter(makeConfig());
      const a = router.getAssignment("building");
      expect(a.primary).toBe("claude");
      expect(a.fallback).toBeNull();
    });

    it("reviewing → claude primary, openai fallback", () => {
      const router = new ModelRouter(makeConfig());
      const a = router.getAssignment("reviewing");
      expect(a.primary).toBe("claude");
      expect(a.fallback).toBe("openai");
    });
  });

  // ── updateConfig ─────────────────────────────────────────────────

  describe("config updates", () => {
    it("router respects config changes between calls", () => {
      const router = new ModelRouter(makeConfig({ mode: "simulation" }));
      router.registerAdapter("gemini", fakeLiveAdapter("gemini"));

      // Simulation → mock
      expect(router.getAdapter("research").isMock).toBe(true);

      // Switch to live
      router.updateConfig(makeConfig({ mode: "live" }));
      expect(router.getAdapter("research").isMock).toBe(false);
      expect(router.getAdapter("research").adapter.provider).toBe("gemini");
    });

    it("switching back to simulation returns mock", () => {
      const router = new ModelRouter(makeConfig({ mode: "live" }));
      router.registerAdapter("gemini", fakeLiveAdapter("gemini"));
      expect(router.getAdapter("research").isMock).toBe(false);

      router.updateConfig(makeConfig({ mode: "simulation" }));
      expect(router.getAdapter("research").isMock).toBe(true);
    });
  });
});
