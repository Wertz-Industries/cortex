import type { Task } from "../data/schemas.js";
import type { SkeletonStore } from "../data/store.js";

/**
 * Approval queue for Tier 2 tasks.
 * Tasks requiring human approval are queued here.
 * Approved tasks move to "building", rejected tasks move to "failed".
 */
export class ApprovalQueue {
  constructor(private store: SkeletonStore) {}

  /** Get all tasks awaiting approval. */
  async pending(): Promise<Task[]> {
    const tasks = await this.store.loadTasks();
    return tasks.filter((t) => t.state === "awaiting_approval");
  }

  /** Approve a task — moves it to "building" state. */
  async approve(taskId: string): Promise<Task | null> {
    const tasks = await this.store.loadTasks();
    const task = tasks.find((t) => t.id === taskId);
    if (!task || task.state !== "awaiting_approval") return null;

    task.state = "building";
    task.updatedAt = new Date().toISOString();
    await this.store.saveTasks(tasks);
    return task;
  }

  /** Reject a task — moves it to "failed" state with reason. */
  async reject(taskId: string, reason?: string): Promise<Task | null> {
    const tasks = await this.store.loadTasks();
    const task = tasks.find((t) => t.id === taskId);
    if (!task || task.state !== "awaiting_approval") return null;

    task.state = "failed";
    task.error = reason ?? "Rejected by human operator";
    task.updatedAt = new Date().toISOString();
    await this.store.saveTasks(tasks);
    return task;
  }
}
