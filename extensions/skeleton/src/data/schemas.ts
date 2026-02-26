import { z } from "zod";

// ── Truth Labels (every knowledge entry carries these) ──────────────────

export const TruthStatusSchema = z.enum([
  "verified",
  "hypothesis",
  "speculative",
  "implemented",
  "failed",
  "archived",
]);
export type TruthStatus = z.infer<typeof TruthStatusSchema>;

export const ConfidenceSchema = z.enum(["low", "medium", "high"]);
export type Confidence = z.infer<typeof ConfidenceSchema>;

/** Mixin for any schema that stores knowledge or decisions */
export const TruthLabelSchema = z.object({
  truthStatus: TruthStatusSchema.default("speculative"),
  confidence: ConfidenceSchema.default("low"),
});

// ── Operating Mode ──────────────────────────────────────────────────────

export const SkeletonModeSchema = z.enum(["simulation", "selective", "live"]);
export type KernelMode = z.infer<typeof SkeletonModeSchema>;

// ── Budget Config ───────────────────────────────────────────────────────

export const BudgetConfigSchema = z.object({
  perCallUsd: z.number().min(0).default(0.5),
  perTaskUsd: z.number().min(0).default(5),
  perCycleUsd: z.number().min(0).default(20),
  dailyUsd: z.number().min(0).default(10),
  weeklyUsd: z.number().min(0).default(50),
  perProviderDailyUsd: z
    .record(z.string(), z.number().min(0))
    .default({ openai: 5, gemini: 0, claude: 0 }),
});
export type BudgetConfig = z.infer<typeof BudgetConfigSchema>;

// ── Kernel Config ───────────────────────────────────────────────────────

export const SkeletonConfigSchema = z.object({
  mode: SkeletonModeSchema.default("simulation"),
  cycleCooldownMinutes: z.number().int().min(1).default(15),
  budgets: BudgetConfigSchema.default({
    perCallUsd: 0.5,
    perTaskUsd: 5,
    perCycleUsd: 20,
    dailyUsd: 10,
    weeklyUsd: 50,
    perProviderDailyUsd: { openai: 5, gemini: 0, claude: 0 },
  }),
  selectiveProviders: z
    .record(z.string(), z.boolean())
    .default({ gemini: false, openai: false, claude: false }),
  geminiApiKey: z.string().optional(),
  openaiApiKey: z.string().optional(),
  claudeApiKey: z.string().optional(),
});
export type SkeletonConfig = z.infer<typeof SkeletonConfigSchema>;

// ── Loop State ──────────────────────────────────────────────────────────

export const LoopStateSchema = z.enum([
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
]);
export type LoopState = z.infer<typeof LoopStateSchema>;

// ── Autonomy Tier ───────────────────────────────────────────────────────

export const AutonomyTierSchema = z.enum(["0", "1", "2"]);
export type AutonomyTier = z.infer<typeof AutonomyTierSchema>;

// ── Objective ───────────────────────────────────────────────────────────

export const ObjectiveSchema = z.object({
  id: z.string().uuid(),
  title: z.string().min(1).max(200),
  description: z.string().max(2000),
  weight: z.number().min(0).max(1),
  status: z.enum(["active", "paused", "completed", "abandoned"]),
  tags: z.array(z.string()).default([]),
  acceptanceCriteria: z.array(z.string()),
  ...TruthLabelSchema.shape,
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  completedAt: z.string().datetime().optional(),
});
export type Objective = z.infer<typeof ObjectiveSchema>;

// ── Task ────────────────────────────────────────────────────────────────

export const TaskStateSchema = z.enum([
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
]);
export type TaskState = z.infer<typeof TaskStateSchema>;

export const ArtifactSchema = z.object({
  type: z.enum(["branch", "pr", "file", "url", "log"]),
  label: z.string(),
  value: z.string(),
});
export type Artifact = z.infer<typeof ArtifactSchema>;

export const TaskSchema = z.object({
  id: z.string().uuid(),
  objectiveId: z.string().uuid(),
  cycleId: z.string().uuid(),
  title: z.string(),
  description: z.string(),
  state: TaskStateSchema,
  autonomyTier: AutonomyTierSchema,
  budgetCapUsd: z.number().min(0).default(5),
  actualCostUsd: z.number().min(0).default(0),
  modelAssignment: z.record(z.string(), z.string()).default({}),
  artifacts: z.array(ArtifactSchema).default([]),
  ...TruthLabelSchema.shape,
  error: z.string().optional(),
  retryCount: z.number().int().min(0).default(0),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  completedAt: z.string().datetime().optional(),
});
export type Task = z.infer<typeof TaskSchema>;

// ── Scan ────────────────────────────────────────────────────────────────

export const ScanFindingSchema = z.object({
  topic: z.string(),
  summary: z.string(),
  relevance: z.number().min(0).max(1),
  sources: z.array(z.string()).default([]),
  ...TruthLabelSchema.shape,
});
export type ScanFinding = z.infer<typeof ScanFindingSchema>;

export const ScanSchema = z.object({
  id: z.string().uuid(),
  cycleId: z.string().uuid(),
  objectiveIds: z.array(z.string().uuid()),
  model: z.string(),
  prompt: z.string(),
  response: z.string(),
  findings: z.array(ScanFindingSchema),
  costUsd: z.number().min(0),
  inputTokens: z.number().int().min(0),
  outputTokens: z.number().int().min(0),
  latencyMs: z.number().int().min(0),
  createdAt: z.string().datetime(),
});
export type Scan = z.infer<typeof ScanSchema>;

// ── Plan ────────────────────────────────────────────────────────────────

export const ProposedTaskSchema = z.object({
  title: z.string(),
  description: z.string(),
  estimatedComplexity: z.enum(["trivial", "small", "medium", "large"]),
  suggestedTier: AutonomyTierSchema,
});
export type ProposedTask = z.infer<typeof ProposedTaskSchema>;

export const PlanPrioritySchema = z.object({
  objectiveId: z.string().uuid(),
  rationale: z.string(),
  proposedTasks: z.array(ProposedTaskSchema),
});
export type PlanPriority = z.infer<typeof PlanPrioritySchema>;

export const PlanSchema = z.object({
  id: z.string().uuid(),
  cycleId: z.string().uuid(),
  scanId: z.string().uuid(),
  model: z.string(),
  prompt: z.string(),
  response: z.string(),
  strategy: z.object({
    summary: z.string(),
    priorities: z.array(PlanPrioritySchema),
  }),
  ...TruthLabelSchema.shape,
  costUsd: z.number().min(0),
  inputTokens: z.number().int().min(0),
  outputTokens: z.number().int().min(0),
  latencyMs: z.number().int().min(0),
  createdAt: z.string().datetime(),
});
export type Plan = z.infer<typeof PlanSchema>;

// ── Run (Execution Record) ──────────────────────────────────────────────

export const PhaseNameSchema = z.enum(["scan", "plan", "build", "ship_check", "eval"]);
export type PhaseName = z.infer<typeof PhaseNameSchema>;

export const ProviderNameSchema = z.enum(["gemini", "openai", "claude", "mock"]);
export type ProviderName = z.infer<typeof ProviderNameSchema>;

export const RunSchema = z.object({
  id: z.string().uuid(),
  taskId: z.string().uuid().optional(),
  cycleId: z.string().uuid(),
  phase: PhaseNameSchema,
  model: z.string(),
  provider: ProviderNameSchema,
  prompt: z.string(),
  response: z.string().optional(),
  success: z.boolean(),
  error: z.string().optional(),
  costUsd: z.number().min(0),
  inputTokens: z.number().int().min(0),
  outputTokens: z.number().int().min(0),
  latencyMs: z.number().int().min(0),
  createdAt: z.string().datetime(),
});
export type Run = z.infer<typeof RunSchema>;

// ── Evaluation ──────────────────────────────────────────────────────────

export const RecommendationSchema = z.object({
  action: z.string(),
  rationale: z.string(),
  priority: z.enum(["low", "medium", "high"]),
  ...TruthLabelSchema.shape,
});
export type Recommendation = z.infer<typeof RecommendationSchema>;

export const EvaluationSchema = z.object({
  id: z.string().uuid(),
  cycleId: z.string().uuid(),
  model: z.string(),
  period: z.object({
    start: z.string().datetime(),
    end: z.string().datetime(),
  }),
  metrics: z.object({
    tasksCompleted: z.number().int().min(0),
    tasksFailed: z.number().int().min(0),
    totalCostUsd: z.number().min(0),
    avgTaskLatencyMs: z.number().min(0),
    objectiveProgress: z.record(z.string(), z.number().min(0).max(1)),
  }),
  insights: z.array(z.string()),
  recommendations: z.array(RecommendationSchema),
  ...TruthLabelSchema.shape,
  costUsd: z.number().min(0),
  createdAt: z.string().datetime(),
});
export type Evaluation = z.infer<typeof EvaluationSchema>;

// ── Decision Log Entry ──────────────────────────────────────────────────

export const DecisionLogEntrySchema = z.object({
  id: z.string().uuid(),
  timestamp: z.string().datetime(),
  phase: z.string(),
  taskId: z.string().uuid().optional(),
  decision: z.string(),
  reason: z.string(),
  ...TruthLabelSchema.shape,
  modelUsed: z.string().optional(),
  tier: AutonomyTierSchema.optional(),
  costImpactUsd: z.number().optional(),
});
export type DecisionLogEntry = z.infer<typeof DecisionLogEntrySchema>;

// ── Experiment Log Entry ────────────────────────────────────────────────

export const ExperimentLogEntrySchema = z.object({
  id: z.string().uuid(),
  timestamp: z.string().datetime(),
  hypothesis: z.string(),
  method: z.string(),
  result: z.enum(["pending", "success", "failure", "inconclusive"]),
  ...TruthLabelSchema.shape,
  metrics: z.record(z.string(), z.unknown()).default({}),
  notes: z.string().default(""),
  taskIds: z.array(z.string().uuid()).default([]),
  costUsd: z.number().min(0).default(0),
});
export type ExperimentLogEntry = z.infer<typeof ExperimentLogEntrySchema>;

// ── Cycle ───────────────────────────────────────────────────────────────

export const PhaseTimingSchema = z.object({
  startedAt: z.string().datetime().optional(),
  completedAt: z.string().datetime().optional(),
});

export const CycleSchema = z.object({
  id: z.string().uuid(),
  number: z.number().int().min(1),
  state: z.enum(["running", "completed", "failed", "paused"]),
  mode: SkeletonModeSchema,
  phases: z.object({
    scan: PhaseTimingSchema.default({}),
    plan: PhaseTimingSchema.default({}),
    build: PhaseTimingSchema.default({}),
    ship_check: PhaseTimingSchema.default({}),
    eval: PhaseTimingSchema.default({}),
  }),
  totalCostUsd: z.number().min(0).default(0),
  tasksCreated: z.number().int().min(0).default(0),
  tasksCompleted: z.number().int().min(0).default(0),
  startedAt: z.string().datetime(),
  completedAt: z.string().datetime().optional(),
});
export type Cycle = z.infer<typeof CycleSchema>;

// ── Budget State (tracked at runtime) ───────────────────────────────────

export const BudgetStateSchema = z.object({
  dailySpend: z.record(z.string(), z.number().min(0)).default({}),
  weeklySpend: z.number().min(0).default(0),
  weekStart: z.string().datetime(),
  providerDailySpend: z.record(z.string(), z.number().min(0)).default({}),
  lastResetDate: z.string(),
});
export type BudgetState = z.infer<typeof BudgetStateSchema>;

// ── Engine State (persisted) ────────────────────────────────────────────

export const EngineStateSchema = z.object({
  loopState: LoopStateSchema.default("idle"),
  currentCycleId: z.string().uuid().optional(),
  currentPhase: PhaseNameSchema.optional(),
  currentTaskId: z.string().uuid().optional(),
  lastCycleCompletedAt: z.string().datetime().optional(),
  nextCycleScheduledAt: z.string().datetime().optional(),
  totalCyclesCompleted: z.number().int().min(0).default(0),
  error: z.string().optional(),
});
export type EngineState = z.infer<typeof EngineStateSchema>;
