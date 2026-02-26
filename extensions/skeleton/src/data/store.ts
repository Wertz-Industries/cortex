import fs from "node:fs";
import path from "node:path";
import { readJsonFileWithFallback, writeJsonFileAtomically } from "openclaw/plugin-sdk";
import type {
  BudgetState,
  Cycle,
  DecisionLogEntry,
  EngineState,
  Evaluation,
  ExperimentLogEntry,
  SkeletonConfig,
  Objective,
  Plan,
  Run,
  Scan,
  Task,
} from "./schemas.js";
import { BudgetStateSchema, EngineStateSchema, SkeletonConfigSchema } from "./schemas.js";

/**
 * SkeletonStore — JSON file persistence layer for the skeleton extension.
 *
 * Root: plugin stateDir (typically ~/.cortex/plugins/skeleton/)
 * Single-file collections: objectives.json, tasks.json, config.json, state.json, budget.json
 * Per-record directories: scans/, plans/, runs/, evaluations/
 * Append-only logs: decisions.jsonl, experiments.jsonl
 */
export class SkeletonStore {
  constructor(private readonly stateDir: string) {}

  /** Returns default config synchronously (for construction before async is available). */
  defaultConfig(): SkeletonConfig {
    return SkeletonConfigSchema.parse({});
  }

  private resolve(...segments: string[]): string {
    return path.join(this.stateDir, ...segments);
  }

  // ── Config ────────────────────────────────────────────────────────

  async loadConfig(): Promise<SkeletonConfig> {
    const { value } = await readJsonFileWithFallback(this.resolve("config.json"), {});
    return SkeletonConfigSchema.parse(value);
  }

  async saveConfig(config: SkeletonConfig): Promise<void> {
    await writeJsonFileAtomically(this.resolve("config.json"), config);
  }

  // ── Engine State ──────────────────────────────────────────────────

  async loadEngineState(): Promise<EngineState> {
    const { value } = await readJsonFileWithFallback(this.resolve("state.json"), {});
    return EngineStateSchema.parse(value);
  }

  async saveEngineState(state: EngineState): Promise<void> {
    await writeJsonFileAtomically(this.resolve("state.json"), state);
  }

  // ── Budget State ──────────────────────────────────────────────────

  async loadBudgetState(): Promise<BudgetState> {
    const now = new Date();
    const { value } = await readJsonFileWithFallback(this.resolve("budget.json"), {});
    return BudgetStateSchema.parse({
      weekStart: now.toISOString(),
      lastResetDate: now.toISOString().slice(0, 10),
      ...value,
    });
  }

  async saveBudgetState(state: BudgetState): Promise<void> {
    await writeJsonFileAtomically(this.resolve("budget.json"), state);
  }

  // ── Objectives ────────────────────────────────────────────────────

  async loadObjectives(): Promise<Objective[]> {
    const { value } = await readJsonFileWithFallback<Objective[]>(
      this.resolve("objectives.json"),
      [],
    );
    return value;
  }

  async saveObjectives(objectives: Objective[]): Promise<void> {
    await writeJsonFileAtomically(this.resolve("objectives.json"), objectives);
  }

  // ── Tasks ─────────────────────────────────────────────────────────

  async loadTasks(): Promise<Task[]> {
    const { value } = await readJsonFileWithFallback<Task[]>(this.resolve("tasks.json"), []);
    return value;
  }

  async saveTasks(tasks: Task[]): Promise<void> {
    await writeJsonFileAtomically(this.resolve("tasks.json"), tasks);
  }

  // ── Cycles ────────────────────────────────────────────────────────

  async loadCycles(): Promise<Cycle[]> {
    const { value } = await readJsonFileWithFallback<Cycle[]>(this.resolve("cycles.json"), []);
    return value;
  }

  async saveCycles(cycles: Cycle[]): Promise<void> {
    await writeJsonFileAtomically(this.resolve("cycles.json"), cycles);
  }

  // ── Per-Record Storage (scans, plans, runs, evaluations) ─────────

  private async saveRecord(dir: string, id: string, data: unknown): Promise<void> {
    await writeJsonFileAtomically(this.resolve(dir, `${id}.json`), data);
  }

  private async loadRecord<T>(dir: string, id: string): Promise<T | null> {
    const { value, exists } = await readJsonFileWithFallback<T | null>(
      this.resolve(dir, `${id}.json`),
      null,
    );
    return exists ? value : null;
  }

  private async listRecords<T>(dir: string): Promise<T[]> {
    const dirPath = this.resolve(dir);
    try {
      const files = await fs.promises.readdir(dirPath);
      const records: T[] = [];
      for (const file of files) {
        if (!file.endsWith(".json")) continue;
        const { value, exists } = await readJsonFileWithFallback<T | null>(
          path.join(dirPath, file),
          null,
        );
        if (exists && value != null) records.push(value);
      }
      return records;
    } catch {
      return [];
    }
  }

  // Scans
  async saveScan(scan: Scan): Promise<void> {
    await this.saveRecord("scans", scan.id, scan);
  }
  async loadScan(id: string): Promise<Scan | null> {
    return this.loadRecord<Scan>("scans", id);
  }
  async listScans(): Promise<Scan[]> {
    return this.listRecords<Scan>("scans");
  }

  // Plans
  async savePlan(plan: Plan): Promise<void> {
    await this.saveRecord("plans", plan.id, plan);
  }
  async loadPlan(id: string): Promise<Plan | null> {
    return this.loadRecord<Plan>("plans", id);
  }
  async listPlans(): Promise<Plan[]> {
    return this.listRecords<Plan>("plans");
  }

  // Runs
  async saveRun(run: Run): Promise<void> {
    await this.saveRecord("runs", run.id, run);
  }
  async loadRun(id: string): Promise<Run | null> {
    return this.loadRecord<Run>("runs", id);
  }
  async listRuns(): Promise<Run[]> {
    return this.listRecords<Run>("runs");
  }

  // Evaluations
  async saveEvaluation(evaluation: Evaluation): Promise<void> {
    await this.saveRecord("evaluations", evaluation.id, evaluation);
  }
  async loadEvaluation(id: string): Promise<Evaluation | null> {
    return this.loadRecord<Evaluation>("evaluations", id);
  }
  async listEvaluations(): Promise<Evaluation[]> {
    return this.listRecords<Evaluation>("evaluations");
  }

  // ── Append-Only Logs ──────────────────────────────────────────────

  private async appendLog(file: string, entry: unknown): Promise<void> {
    const filePath = this.resolve(file);
    const dir = path.dirname(filePath);
    await fs.promises.mkdir(dir, { recursive: true, mode: 0o700 });
    await fs.promises.appendFile(filePath, `${JSON.stringify(entry)}\n`, "utf-8");
  }

  private async readLog<T>(file: string): Promise<T[]> {
    const filePath = this.resolve(file);
    try {
      const raw = await fs.promises.readFile(filePath, "utf-8");
      return raw
        .trim()
        .split("\n")
        .filter(Boolean)
        .map((line) => JSON.parse(line) as T);
    } catch {
      return [];
    }
  }

  async appendDecision(entry: DecisionLogEntry): Promise<void> {
    await this.appendLog("decisions.jsonl", entry);
  }

  async loadDecisions(): Promise<DecisionLogEntry[]> {
    return this.readLog<DecisionLogEntry>("decisions.jsonl");
  }

  async appendExperiment(entry: ExperimentLogEntry): Promise<void> {
    await this.appendLog("experiments.jsonl", entry);
  }

  async loadExperiments(): Promise<ExperimentLogEntry[]> {
    return this.readLog<ExperimentLogEntry>("experiments.jsonl");
  }
}
