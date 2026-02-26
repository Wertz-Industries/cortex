import { describe, expect, it } from "vitest";
import {
  TruthStatusSchema,
  ConfidenceSchema,
  TruthLabelSchema,
  SkeletonModeSchema,
  BudgetConfigSchema,
  SkeletonConfigSchema,
  LoopStateSchema,
  AutonomyTierSchema,
  ObjectiveSchema,
  TaskStateSchema,
  ArtifactSchema,
  TaskSchema,
  ScanFindingSchema,
  ScanSchema,
  ProposedTaskSchema,
  PlanPrioritySchema,
  PlanSchema,
  PhaseNameSchema,
  ProviderNameSchema,
  RunSchema,
  RecommendationSchema,
  EvaluationSchema,
  DecisionLogEntrySchema,
  ExperimentLogEntrySchema,
  CycleSchema,
  PhaseTimingSchema,
  BudgetStateSchema,
  EngineStateSchema,
} from "./schemas.js";

const UUID = "550e8400-e29b-41d4-a716-446655440000";
const ISO_NOW = new Date().toISOString();

describe("schemas", () => {
  // ── TruthStatus + Confidence ─────────────────────────────────────

  describe("TruthStatusSchema", () => {
    for (const v of [
      "verified",
      "hypothesis",
      "speculative",
      "implemented",
      "failed",
      "archived",
    ]) {
      it(`accepts "${v}"`, () => expect(TruthStatusSchema.parse(v)).toBe(v));
    }
    it("rejects invalid value", () =>
      expect(TruthStatusSchema.safeParse("wrong").success).toBe(false));
  });

  describe("ConfidenceSchema", () => {
    for (const v of ["low", "medium", "high"]) {
      it(`accepts "${v}"`, () => expect(ConfidenceSchema.parse(v)).toBe(v));
    }
    it("rejects invalid value", () =>
      expect(ConfidenceSchema.safeParse("extreme").success).toBe(false));
  });

  describe("TruthLabelSchema", () => {
    it("applies defaults", () => {
      const result = TruthLabelSchema.parse({});
      expect(result.truthStatus).toBe("speculative");
      expect(result.confidence).toBe("low");
    });

    it("accepts explicit values", () => {
      const result = TruthLabelSchema.parse({ truthStatus: "verified", confidence: "high" });
      expect(result.truthStatus).toBe("verified");
      expect(result.confidence).toBe("high");
    });
  });

  // ── KernelMode ───────────────────────────────────────────────────

  describe("SkeletonModeSchema", () => {
    for (const v of ["simulation", "selective", "live"]) {
      it(`accepts "${v}"`, () => expect(SkeletonModeSchema.parse(v)).toBe(v));
    }
    it("rejects invalid", () => expect(SkeletonModeSchema.safeParse("turbo").success).toBe(false));
  });

  // ── BudgetConfig ─────────────────────────────────────────────────

  describe("BudgetConfigSchema", () => {
    it("applies all defaults", () => {
      const result = BudgetConfigSchema.parse({});
      expect(result.perCallUsd).toBe(0.5);
      expect(result.perTaskUsd).toBe(5);
      expect(result.perCycleUsd).toBe(20);
      expect(result.dailyUsd).toBe(10);
      expect(result.weeklyUsd).toBe(50);
      expect(result.perProviderDailyUsd).toEqual({ openai: 5, gemini: 0, claude: 0 });
    });

    it("accepts custom values", () => {
      const result = BudgetConfigSchema.parse({ perCallUsd: 1.0, dailyUsd: 25 });
      expect(result.perCallUsd).toBe(1.0);
      expect(result.dailyUsd).toBe(25);
    });

    it("rejects negative numbers", () => {
      expect(BudgetConfigSchema.safeParse({ perCallUsd: -1 }).success).toBe(false);
    });
  });

  // ── SkeletonConfig ─────────────────────────────────────────────────

  describe("SkeletonConfigSchema", () => {
    it("applies all defaults from empty object", () => {
      const result = SkeletonConfigSchema.parse({});
      expect(result.mode).toBe("simulation");
      expect(result.cycleCooldownMinutes).toBe(15);
      expect(result.budgets.perCallUsd).toBe(0.5);
      expect(result.selectiveProviders).toEqual({ gemini: false, openai: false, claude: false });
    });

    it("accepts mode enum values", () => {
      expect(SkeletonConfigSchema.parse({ mode: "live" }).mode).toBe("live");
      expect(SkeletonConfigSchema.parse({ mode: "selective" }).mode).toBe("selective");
    });

    it("rejects invalid mode", () => {
      expect(SkeletonConfigSchema.safeParse({ mode: "turbo" }).success).toBe(false);
    });

    it("accepts optional API keys", () => {
      const result = SkeletonConfigSchema.parse({ geminiApiKey: "abc", openaiApiKey: "def" });
      expect(result.geminiApiKey).toBe("abc");
      expect(result.openaiApiKey).toBe("def");
    });

    it("rejects cycleCooldownMinutes < 1", () => {
      expect(SkeletonConfigSchema.safeParse({ cycleCooldownMinutes: 0 }).success).toBe(false);
    });
  });

  // ── LoopState ────────────────────────────────────────────────────

  describe("LoopStateSchema", () => {
    const states = [
      "idle",
      "scanning",
      "planning",
      "building",
      "ship_checking",
      "evaluating",
      "paused",
      "error",
      "awaiting_approval",
      "budget_exceeded",
    ];
    for (const s of states) {
      it(`accepts "${s}"`, () => expect(LoopStateSchema.parse(s)).toBe(s));
    }
    it("rejects unknown state", () =>
      expect(LoopStateSchema.safeParse("running").success).toBe(false));
  });

  // ── AutonomyTier ─────────────────────────────────────────────────

  describe("AutonomyTierSchema", () => {
    for (const t of ["0", "1", "2"]) {
      it(`accepts "${t}"`, () => expect(AutonomyTierSchema.parse(t)).toBe(t));
    }
    it("rejects numeric 0", () => expect(AutonomyTierSchema.safeParse(0).success).toBe(false));
    it("rejects '3'", () => expect(AutonomyTierSchema.safeParse("3").success).toBe(false));
  });

  // ── Objective ────────────────────────────────────────────────────

  describe("ObjectiveSchema", () => {
    const minimal = {
      id: UUID,
      title: "Test objective",
      description: "Desc",
      weight: 0.5,
      status: "active",
      acceptanceCriteria: ["criterion 1"],
      createdAt: ISO_NOW,
      updatedAt: ISO_NOW,
    };

    it("parses valid minimal object", () => {
      const result = ObjectiveSchema.parse(minimal);
      expect(result.title).toBe("Test objective");
      expect(result.tags).toEqual([]); // default
      expect(result.truthStatus).toBe("speculative"); // default
      expect(result.confidence).toBe("low"); // default
    });

    it("accepts weight = 0", () => {
      expect(ObjectiveSchema.parse({ ...minimal, weight: 0 }).weight).toBe(0);
    });

    it("accepts weight = 1", () => {
      expect(ObjectiveSchema.parse({ ...minimal, weight: 1 }).weight).toBe(1);
    });

    it("rejects weight > 1", () => {
      expect(ObjectiveSchema.safeParse({ ...minimal, weight: 1.5 }).success).toBe(false);
    });

    it("rejects weight < 0", () => {
      expect(ObjectiveSchema.safeParse({ ...minimal, weight: -0.1 }).success).toBe(false);
    });

    it("rejects missing required fields", () => {
      expect(ObjectiveSchema.safeParse({ id: UUID }).success).toBe(false);
    });

    it("rejects empty title", () => {
      expect(ObjectiveSchema.safeParse({ ...minimal, title: "" }).success).toBe(false);
    });

    it("rejects title > 200 chars", () => {
      expect(ObjectiveSchema.safeParse({ ...minimal, title: "x".repeat(201) }).success).toBe(false);
    });

    it("rejects invalid status", () => {
      expect(ObjectiveSchema.safeParse({ ...minimal, status: "deleted" }).success).toBe(false);
    });

    it("accepts optional completedAt", () => {
      const result = ObjectiveSchema.parse({ ...minimal, completedAt: ISO_NOW });
      expect(result.completedAt).toBe(ISO_NOW);
    });
  });

  // ── Task ─────────────────────────────────────────────────────────

  describe("TaskSchema", () => {
    const minimal = {
      id: UUID,
      objectiveId: UUID,
      cycleId: UUID,
      title: "Build thing",
      description: "Build the thing",
      state: "queued",
      autonomyTier: "0",
      createdAt: ISO_NOW,
      updatedAt: ISO_NOW,
    };

    it("parses with defaults", () => {
      const result = TaskSchema.parse(minimal);
      expect(result.budgetCapUsd).toBe(5);
      expect(result.actualCostUsd).toBe(0);
      expect(result.artifacts).toEqual([]);
      expect(result.retryCount).toBe(0);
      expect(result.modelAssignment).toEqual({});
    });

    it("validates all task states", () => {
      const states = [
        "queued",
        "scanning",
        "planning",
        "building",
        "reviewing",
        "awaiting_approval",
        "approved",
        "rejected",
        "completed",
        "failed",
        "cancelled",
      ];
      for (const s of states) {
        expect(TaskStateSchema.parse(s)).toBe(s);
      }
    });

    it("rejects invalid state", () => {
      expect(TaskSchema.safeParse({ ...minimal, state: "running" }).success).toBe(false);
    });

    it("accepts artifacts array", () => {
      const result = TaskSchema.parse({
        ...minimal,
        artifacts: [{ type: "branch", label: "main", value: "feat/thing" }],
      });
      expect(result.artifacts).toHaveLength(1);
    });
  });

  // ── Artifact ─────────────────────────────────────────────────────

  describe("ArtifactSchema", () => {
    for (const type of ["branch", "pr", "file", "url", "log"]) {
      it(`accepts type "${type}"`, () => {
        expect(ArtifactSchema.parse({ type, label: "l", value: "v" }).type).toBe(type);
      });
    }
    it("rejects invalid type", () => {
      expect(ArtifactSchema.safeParse({ type: "image", label: "l", value: "v" }).success).toBe(
        false,
      );
    });
  });

  // ── ScanFinding + Scan ───────────────────────────────────────────

  describe("ScanFindingSchema", () => {
    it("parses valid finding", () => {
      const result = ScanFindingSchema.parse({
        topic: "AI trends",
        summary: "Growing demand",
        relevance: 0.85,
      });
      expect(result.sources).toEqual([]);
      expect(result.truthStatus).toBe("speculative");
    });

    it("rejects relevance > 1", () => {
      expect(
        ScanFindingSchema.safeParse({ topic: "t", summary: "s", relevance: 1.5 }).success,
      ).toBe(false);
    });
  });

  describe("ScanSchema", () => {
    it("parses valid scan", () => {
      const result = ScanSchema.parse({
        id: UUID,
        cycleId: UUID,
        objectiveIds: [UUID],
        model: "gemini-pro",
        prompt: "scan prompt",
        response: "scan response",
        findings: [],
        costUsd: 0,
        inputTokens: 100,
        outputTokens: 50,
        latencyMs: 500,
        createdAt: ISO_NOW,
      });
      expect(result.findings).toEqual([]);
    });
  });

  // ── Plan ─────────────────────────────────────────────────────────

  describe("PlanSchema", () => {
    it("parses valid plan with strategy", () => {
      const result = PlanSchema.parse({
        id: UUID,
        cycleId: UUID,
        scanId: UUID,
        model: "gpt-4o",
        prompt: "plan prompt",
        response: "plan response",
        strategy: {
          summary: "Focus on SMB",
          priorities: [
            {
              objectiveId: UUID,
              rationale: "Fastest path",
              proposedTasks: [
                {
                  title: "Build template",
                  description: "Landing page",
                  estimatedComplexity: "medium",
                  suggestedTier: "0",
                },
              ],
            },
          ],
        },
        costUsd: 0.05,
        inputTokens: 200,
        outputTokens: 300,
        latencyMs: 2000,
        createdAt: ISO_NOW,
      });
      expect(result.strategy.priorities).toHaveLength(1);
      expect(result.strategy.priorities[0].proposedTasks).toHaveLength(1);
    });
  });

  // ── Run ──────────────────────────────────────────────────────────

  describe("RunSchema", () => {
    it("parses valid run", () => {
      const result = RunSchema.parse({
        id: UUID,
        cycleId: UUID,
        phase: "scan",
        model: "gemini-pro",
        provider: "gemini",
        prompt: "p",
        success: true,
        costUsd: 0,
        inputTokens: 10,
        outputTokens: 20,
        latencyMs: 100,
        createdAt: ISO_NOW,
      });
      expect(result.taskId).toBeUndefined();
      expect(result.response).toBeUndefined();
    });

    it("validates phase enum", () => {
      for (const p of ["scan", "plan", "build", "ship_check", "eval"]) {
        expect(PhaseNameSchema.parse(p)).toBe(p);
      }
    });

    it("validates provider enum", () => {
      for (const p of ["gemini", "openai", "claude", "mock"]) {
        expect(ProviderNameSchema.parse(p)).toBe(p);
      }
    });
  });

  // ── Evaluation ───────────────────────────────────────────────────

  describe("EvaluationSchema", () => {
    it("parses valid evaluation", () => {
      const result = EvaluationSchema.parse({
        id: UUID,
        cycleId: UUID,
        model: "gpt-4o",
        period: { start: ISO_NOW, end: ISO_NOW },
        metrics: {
          tasksCompleted: 3,
          tasksFailed: 0,
          totalCostUsd: 0.15,
          avgTaskLatencyMs: 5000,
          objectiveProgress: { [UUID]: 0.5 },
        },
        insights: ["Good progress"],
        recommendations: [
          {
            action: "Scale up",
            rationale: "More throughput needed",
            priority: "high",
          },
        ],
        costUsd: 0.05,
        createdAt: ISO_NOW,
      });
      expect(result.recommendations).toHaveLength(1);
      expect(result.recommendations[0].truthStatus).toBe("speculative"); // default
    });
  });

  // ── DecisionLogEntry ─────────────────────────────────────────────

  describe("DecisionLogEntrySchema", () => {
    it("parses valid entry", () => {
      const result = DecisionLogEntrySchema.parse({
        id: UUID,
        timestamp: ISO_NOW,
        phase: "plan",
        decision: "Chose strategy A",
        reason: "Higher ROI",
      });
      expect(result.truthStatus).toBe("speculative");
      expect(result.taskId).toBeUndefined();
      expect(result.tier).toBeUndefined();
    });

    it("accepts optional fields", () => {
      const result = DecisionLogEntrySchema.parse({
        id: UUID,
        timestamp: ISO_NOW,
        phase: "build",
        taskId: UUID,
        decision: "Use React",
        reason: "Team expertise",
        modelUsed: "gpt-4o",
        tier: "0",
        costImpactUsd: 0.02,
      });
      expect(result.modelUsed).toBe("gpt-4o");
      expect(result.tier).toBe("0");
    });
  });

  // ── ExperimentLogEntry ───────────────────────────────────────────

  describe("ExperimentLogEntrySchema", () => {
    it("parses with defaults", () => {
      const result = ExperimentLogEntrySchema.parse({
        id: UUID,
        timestamp: ISO_NOW,
        hypothesis: "X improves Y",
        method: "A/B test",
        result: "pending",
      });
      expect(result.metrics).toEqual({});
      expect(result.notes).toBe("");
      expect(result.taskIds).toEqual([]);
      expect(result.costUsd).toBe(0);
    });

    it("validates result enum", () => {
      for (const r of ["pending", "success", "failure", "inconclusive"]) {
        expect(
          ExperimentLogEntrySchema.parse({
            id: UUID,
            timestamp: ISO_NOW,
            hypothesis: "h",
            method: "m",
            result: r,
          }).result,
        ).toBe(r);
      }
    });

    it("rejects invalid result", () => {
      expect(
        ExperimentLogEntrySchema.safeParse({
          id: UUID,
          timestamp: ISO_NOW,
          hypothesis: "h",
          method: "m",
          result: "partial",
        }).success,
      ).toBe(false);
    });
  });

  // ── Cycle ────────────────────────────────────────────────────────

  describe("CycleSchema", () => {
    it("parses valid cycle", () => {
      const result = CycleSchema.parse({
        id: UUID,
        number: 1,
        state: "running",
        mode: "simulation",
        phases: {
          scan: {},
          plan: {},
          build: {},
          ship_check: {},
          eval: {},
        },
        startedAt: ISO_NOW,
      });
      expect(result.totalCostUsd).toBe(0); // default
      expect(result.tasksCreated).toBe(0);
      expect(result.completedAt).toBeUndefined();
    });

    it("rejects totalCostUsd < 0", () => {
      expect(
        CycleSchema.safeParse({
          id: UUID,
          number: 1,
          state: "running",
          mode: "simulation",
          phases: { scan: {}, plan: {}, build: {}, ship_check: {}, eval: {} },
          startedAt: ISO_NOW,
          totalCostUsd: -1,
        }).success,
      ).toBe(false);
    });

    it("phase timing is optional", () => {
      const result = PhaseTimingSchema.parse({});
      expect(result.startedAt).toBeUndefined();
      expect(result.completedAt).toBeUndefined();
    });

    it("accepts phase timing values", () => {
      const result = PhaseTimingSchema.parse({ startedAt: ISO_NOW, completedAt: ISO_NOW });
      expect(result.startedAt).toBe(ISO_NOW);
    });

    it("validates cycle state enum", () => {
      for (const s of ["running", "completed", "failed", "paused"]) {
        expect(
          CycleSchema.safeParse({
            id: UUID,
            number: 1,
            state: s,
            mode: "simulation",
            phases: { scan: {}, plan: {}, build: {}, ship_check: {}, eval: {} },
            startedAt: ISO_NOW,
          }).success,
        ).toBe(true);
      }
    });
  });

  // ── BudgetState ──────────────────────────────────────────────────

  describe("BudgetStateSchema", () => {
    it("parses with defaults", () => {
      const result = BudgetStateSchema.parse({
        weekStart: ISO_NOW,
        lastResetDate: "2026-02-25",
      });
      expect(result.dailySpend).toEqual({});
      expect(result.weeklySpend).toBe(0);
      expect(result.providerDailySpend).toEqual({});
    });
  });

  // ── EngineState ──────────────────────────────────────────────────

  describe("EngineStateSchema", () => {
    it("applies defaults from empty object", () => {
      const result = EngineStateSchema.parse({});
      expect(result.loopState).toBe("idle");
      expect(result.totalCyclesCompleted).toBe(0);
      expect(result.currentCycleId).toBeUndefined();
      expect(result.error).toBeUndefined();
    });

    it("accepts all optional fields", () => {
      const result = EngineStateSchema.parse({
        loopState: "scanning",
        currentCycleId: UUID,
        currentPhase: "scan",
        currentTaskId: UUID,
        lastCycleCompletedAt: ISO_NOW,
        nextCycleScheduledAt: ISO_NOW,
        totalCyclesCompleted: 5,
        error: "something broke",
      });
      expect(result.loopState).toBe("scanning");
      expect(result.totalCyclesCompleted).toBe(5);
    });
  });
});
