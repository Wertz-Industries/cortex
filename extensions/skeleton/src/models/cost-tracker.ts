import type { ProviderName } from "../data/schemas.js";

export type CostRecord = {
  timestamp: string;
  phase: string;
  taskId?: string;
  provider: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
  latencyMs: number;
};

/**
 * In-memory cost tracker for the current session.
 * Tracks spend at multiple levels for budget enforcement.
 */
export class CostTracker {
  private records: CostRecord[] = [];

  record(entry: CostRecord): void {
    this.records.push(entry);
  }

  /** Total cost since a given timestamp. */
  costSince(since: Date): number {
    const sinceMs = since.getTime();
    return this.records
      .filter((r) => new Date(r.timestamp).getTime() >= sinceMs)
      .reduce((sum, r) => sum + r.costUsd, 0);
  }

  /** Cost for a specific task. */
  costForTask(taskId: string): number {
    return this.records.filter((r) => r.taskId === taskId).reduce((sum, r) => sum + r.costUsd, 0);
  }

  /** Cost for a specific phase in the current records. */
  costForPhase(phase: string): number {
    return this.records.filter((r) => r.phase === phase).reduce((sum, r) => sum + r.costUsd, 0);
  }

  /** Cost for a specific provider since a given timestamp. */
  costForProvider(provider: string, since: Date): number {
    const sinceMs = since.getTime();
    return this.records
      .filter((r) => r.provider === provider && new Date(r.timestamp).getTime() >= sinceMs)
      .reduce((sum, r) => sum + r.costUsd, 0);
  }

  /** Daily cost (today). */
  dailyCost(): number {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    return this.costSince(todayStart);
  }

  /** Weekly cost (last 7 days rolling). */
  weeklyCost(): number {
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    return this.costSince(weekAgo);
  }

  /** Provider daily cost (today). */
  providerDailyCost(provider: string): number {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    return this.costForProvider(provider, todayStart);
  }

  /** Get all records (for persistence). */
  getRecords(): CostRecord[] {
    return [...this.records];
  }

  /** Load records from persistence. */
  loadRecords(records: CostRecord[]): void {
    this.records = [...records];
  }

  /** Total across all records. */
  total(): number {
    return this.records.reduce((sum, r) => sum + r.costUsd, 0);
  }
}
