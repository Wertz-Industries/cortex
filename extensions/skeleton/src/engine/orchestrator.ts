import crypto from "node:crypto";
import type { BudgetGuard } from "../autonomy/budget-guard.js";
import type { Cycle, EngineState, SkeletonConfig, LoopState, PhaseName } from "../data/schemas.js";
import type { SkeletonStore } from "../data/store.js";
import type { CostTracker } from "../models/cost-tracker.js";
import type { ModelRouter } from "../models/router.js";
import { Scheduler } from "./scheduler.js";
import { PHASE_ORDER, canTransition, phaseForState, stateForPhase } from "./state-machine.js";

export type KernelEvent = {
  event: string;
  payload: Record<string, unknown>;
};

export type EventBroadcaster = (event: string, payload: Record<string, unknown>) => void;

export type PhaseExecutor = (
  phase: PhaseName,
  cycle: Cycle,
  config: SkeletonConfig,
) => Promise<PhaseResult>;

export type PhaseResult = {
  success: boolean;
  costUsd: number;
  error?: string;
  artifacts?: Array<{ type: string; label: string; value: string }>;
};

export type PresetHandler = (store: SkeletonStore) => Promise<void>;

export interface OrchestratorOptions {
  store: SkeletonStore;
  broadcast: EventBroadcaster;
  logger: {
    info: (msg: string) => void;
    warn: (msg: string) => void;
    error: (msg: string) => void;
  };
  /** Model infrastructure for phase execution. If provided, auto-creates phase executor on start(). */
  modelInfra?: {
    router: ModelRouter;
    costTracker: CostTracker;
    budgetGuard: BudgetGuard;
  };
  /** Injected phase executor — overrides modelInfra if both provided. */
  executePhase?: PhaseExecutor;
}

export class Orchestrator {
  private store: SkeletonStore;
  private broadcast: EventBroadcaster;
  private logger: OrchestratorOptions["logger"];
  private scheduler = new Scheduler();
  private executePhase: PhaseExecutor;
  private running = false;
  private engineState: EngineState | null = null;
  private config: SkeletonConfig | null = null;
  private presetHandlers = new Map<string, PresetHandler>();
  private modelInfra: OrchestratorOptions["modelInfra"];

  constructor(opts: OrchestratorOptions) {
    this.store = opts.store;
    this.broadcast = opts.broadcast;
    this.logger = opts.logger;
    this.modelInfra = opts.modelInfra;
    this.executePhase = opts.executePhase ?? defaultPhaseExecutor;
  }

  /** Register a named preset that runs setup before a cycle. */
  registerPreset(name: string, handler: PresetHandler): void {
    this.presetHandlers.set(name, handler);
  }

  /** Inject or replace the phase executor (called after model infra is ready). */
  setPhaseExecutor(executor: PhaseExecutor): void {
    this.executePhase = executor;
  }

  // ── Lifecycle ─────────────────────────────────────────────────────

  async start(): Promise<void> {
    this.running = true;
    this.engineState = await this.store.loadEngineState();
    this.config = await this.store.loadConfig();

    // Auto-wire phase executor from model infrastructure if provided
    if (this.modelInfra && this.executePhase === defaultPhaseExecutor) {
      const { createPhaseExecutor } = await import("./phase-executor.js");
      this.executePhase = createPhaseExecutor({
        store: this.store,
        ...this.modelInfra,
      });
      this.logger.info("[skeleton] Phase executor wired from model infra");
    }

    this.logger.info(
      `[skeleton] Engine started (mode=${this.config.mode}, state=${this.engineState.loopState})`,
    );

    // If we were in a running state before shutdown, resume idle
    if (this.engineState.loopState !== "idle" && this.engineState.loopState !== "paused") {
      await this.transitionTo("idle");
    }

    this.scheduleNextCycle();
  }

  async stop(): Promise<void> {
    this.running = false;
    this.scheduler.cancel();
    if (this.engineState) {
      await this.store.saveEngineState(this.engineState);
    }
    this.logger.info("[skeleton] Engine stopped");
  }

  // ── Public API (called from gateway methods) ──────────────────────

  async getState(): Promise<{
    state: LoopState;
    mode: string;
    phase: PhaseName | null;
    currentCycleId: string | null;
    currentTaskId: string | null;
    totalCyclesCompleted: number;
    lastCycleCompletedAt: string | null;
    nextCycleScheduledAt: string | null;
  }> {
    const state = this.engineState ?? (await this.store.loadEngineState());
    const config = this.config ?? (await this.store.loadConfig());
    return {
      state: state.loopState,
      mode: config.mode,
      phase: state.currentPhase ?? null,
      currentCycleId: state.currentCycleId ?? null,
      currentTaskId: state.currentTaskId ?? null,
      totalCyclesCompleted: state.totalCyclesCompleted,
      lastCycleCompletedAt: state.lastCycleCompletedAt ?? null,
      nextCycleScheduledAt:
        this.scheduler.scheduledAt?.toISOString() ?? state.nextCycleScheduledAt ?? null,
    };
  }

  async pause(): Promise<void> {
    if (!this.engineState) return;
    const prev = this.engineState.loopState;
    if (prev === "paused") return;
    this.scheduler.cancel();
    await this.transitionTo("paused");
    this.logger.info(`[skeleton] Paused from ${prev}`);
  }

  async resume(): Promise<void> {
    if (!this.engineState) return;
    if (this.engineState.loopState !== "paused") return;
    await this.transitionTo("idle");
    this.scheduleNextCycle();
    this.logger.info("[skeleton] Resumed");
  }

  async trigger(preset?: string): Promise<{ cycleId: string } | { error: string }> {
    if (!this.engineState) return { error: "Engine not initialized" };
    if (this.engineState.loopState !== "idle" && this.engineState.loopState !== "paused") {
      return { error: `Cannot trigger: engine is ${this.engineState.loopState}` };
    }

    // Cancel any scheduled cycle — we're running now
    this.scheduler.cancel();

    if (this.engineState.loopState === "paused") {
      await this.transitionTo("idle");
    }

    const cycleId = await this.runCycle(preset);
    return { cycleId };
  }

  async reloadConfig(): Promise<void> {
    this.config = await this.store.loadConfig();
  }

  // ── Core Loop ─────────────────────────────────────────────────────

  private async runCycle(preset?: string): Promise<string> {
    // Run preset setup (e.g., create seed objectives) before cycle starts
    if (preset) {
      const handler = this.presetHandlers.get(preset);
      if (handler) {
        await handler(this.store);
        this.logger.info(`[skeleton] Preset "${preset}" setup complete`);
      } else {
        this.logger.warn(`[skeleton] Unknown preset: ${preset}`);
      }
    }

    const config = this.config ?? (await this.store.loadConfig());
    const cycles = await this.store.loadCycles();
    const cycleNumber = cycles.length + 1;
    const now = new Date().toISOString();

    const cycle: Cycle = {
      id: crypto.randomUUID(),
      number: cycleNumber,
      state: "running",
      mode: config.mode,
      phases: {
        scan: {},
        plan: {},
        build: {},
        ship_check: {},
        eval: {},
      },
      totalCostUsd: 0,
      tasksCreated: 0,
      tasksCompleted: 0,
      startedAt: now,
    };

    this.engineState!.currentCycleId = cycle.id;
    cycles.push(cycle);
    await this.store.saveCycles(cycles);

    this.logger.info(
      `[skeleton] Cycle #${cycleNumber} started (mode=${config.mode}${preset ? `, preset=${preset}` : ""})`,
    );

    let failed = false;

    for (const phase of PHASE_ORDER) {
      if (!this.running) break;

      const loopState = stateForPhase(phase);
      if (!canTransition(this.engineState!.loopState, loopState)) {
        // Try going through idle first (e.g., from error recovery)
        if (canTransition(this.engineState!.loopState, "idle")) {
          await this.transitionTo("idle");
        }
        if (!canTransition("idle", loopState)) {
          this.logger.warn(`[skeleton] Cannot transition to ${loopState}, skipping phase ${phase}`);
          continue;
        }
      }

      await this.transitionTo(loopState);
      cycle.phases[phase === "ship_check" ? "ship_check" : phase].startedAt =
        new Date().toISOString();

      try {
        const result = await this.executePhase(phase, cycle, config);

        cycle.phases[phase === "ship_check" ? "ship_check" : phase].completedAt =
          new Date().toISOString();
        cycle.totalCostUsd += result.costUsd;

        this.broadcast("skeleton.phase_complete", {
          phase,
          cycleId: cycle.id,
          cycleNumber,
          success: result.success,
          costUsd: result.costUsd,
          error: result.error,
        });

        if (!result.success) {
          this.logger.warn(`[skeleton] Phase ${phase} failed: ${result.error}`);
          await this.transitionTo("error");
          this.engineState!.error = result.error;
          failed = true;
          break;
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        this.logger.error(`[skeleton] Phase ${phase} threw: ${msg}`);
        cycle.phases[phase === "ship_check" ? "ship_check" : phase].completedAt =
          new Date().toISOString();
        await this.transitionTo("error");
        this.engineState!.error = msg;
        failed = true;
        break;
      }
    }

    // Finalize cycle
    const finalNow = new Date().toISOString();
    cycle.state = failed ? "failed" : "completed";
    cycle.completedAt = finalNow;

    // Update cycles in store
    const allCycles = await this.store.loadCycles();
    const idx = allCycles.findIndex((c) => c.id === cycle.id);
    if (idx >= 0) allCycles[idx] = cycle;
    await this.store.saveCycles(allCycles);

    // Update engine state
    if (!failed) {
      this.engineState!.totalCyclesCompleted += 1;
      this.engineState!.lastCycleCompletedAt = finalNow;
      this.engineState!.error = undefined;
    }
    this.engineState!.currentCycleId = undefined;
    this.engineState!.currentPhase = undefined;
    this.engineState!.currentTaskId = undefined;

    await this.transitionTo("idle");
    await this.store.saveEngineState(this.engineState!);

    this.logger.info(
      `[skeleton] Cycle #${cycleNumber} ${cycle.state} (cost=$${cycle.totalCostUsd.toFixed(4)})`,
    );

    // Schedule next
    this.scheduleNextCycle();

    return cycle.id;
  }

  // ── State Management ──────────────────────────────────────────────

  private async transitionTo(to: LoopState): Promise<void> {
    const from = this.engineState!.loopState;
    this.engineState!.loopState = to;
    this.engineState!.currentPhase = phaseForState(to) ?? this.engineState!.currentPhase;

    if (
      phaseForState(to) === null &&
      to !== "paused" &&
      to !== "error" &&
      to !== "awaiting_approval" &&
      to !== "budget_exceeded"
    ) {
      this.engineState!.currentPhase = undefined;
    }

    await this.store.saveEngineState(this.engineState!);

    this.broadcast("skeleton.state_changed", {
      from,
      to,
      phase: this.engineState!.currentPhase ?? null,
      cycleId: this.engineState!.currentCycleId ?? null,
    });
  }

  private scheduleNextCycle(): void {
    if (!this.running) return;
    if (!this.config) return;
    if (this.engineState?.loopState === "paused") return;

    const delayMs = this.config.cycleCooldownMinutes * 60 * 1000;
    const nextAt = this.scheduler.schedule(delayMs, () => {
      if (this.running && this.engineState?.loopState === "idle") {
        this.runCycle().catch((err) => {
          this.logger.error(
            `[skeleton] Auto-cycle failed: ${err instanceof Error ? err.message : String(err)}`,
          );
        });
      }
    });

    this.engineState!.nextCycleScheduledAt = nextAt.toISOString();
    this.store.saveEngineState(this.engineState!).catch(() => {});
  }
}

/** Default no-op phase executor for simulation before Phase 4 */
async function defaultPhaseExecutor(
  phase: PhaseName,
  _cycle: Cycle,
  _config: SkeletonConfig,
): Promise<PhaseResult> {
  return {
    success: true,
    costUsd: 0,
    artifacts: [
      {
        type: "log",
        label: `${phase} (stub)`,
        value: `Phase ${phase} executed in stub mode — no real work done`,
      },
    ],
  };
}
