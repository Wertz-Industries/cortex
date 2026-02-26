import type { SkeletonConfig } from "../data/schemas.js";
import type { BuildWorkerAdapter, ModelAdapter, ModelRole } from "./adapter.js";
import { MockBuildWorker, MockModelAdapter } from "./mock-client.js";

type ModelAssignment = {
  primary: string; // provider name
  fallback: string | null;
};

/** Fixed role→provider assignment. ChatGPT plans. Gemini researches. Claude builds. */
const ROLE_ASSIGNMENT: Record<ModelRole, ModelAssignment> = {
  research: { primary: "gemini", fallback: "openai" },
  planning: { primary: "openai", fallback: "gemini" },
  building: { primary: "claude", fallback: null },
  reviewing: { primary: "claude", fallback: "openai" },
};

/**
 * Model router — selects the correct adapter based on role, mode, and provider availability.
 *
 * In simulation mode, all roles get the mock adapter.
 * In selective mode, only explicitly enabled providers are live; others get mock.
 * In live mode, all providers use their real adapters (with budget checks elsewhere).
 */
export class ModelRouter {
  private adapters = new Map<string, ModelAdapter>();
  private buildWorkers = new Map<string, BuildWorkerAdapter>();
  private mockAdapter = new MockModelAdapter();
  private mockWorker = new MockBuildWorker();

  constructor(private config: SkeletonConfig) {}

  /** Register a live model adapter (e.g., Gemini, ChatGPT). */
  registerAdapter(provider: string, adapter: ModelAdapter): void {
    this.adapters.set(provider, adapter);
  }

  /** Register a live build worker (e.g., Claude Code). */
  registerBuildWorker(provider: string, worker: BuildWorkerAdapter): void {
    this.buildWorkers.set(provider, worker);
  }

  /** Update config (e.g., after mode change). */
  updateConfig(config: SkeletonConfig): void {
    this.config = config;
  }

  /** Get the model adapter for a given role. */
  getAdapter(role: ModelRole): { adapter: ModelAdapter; provider: string; isMock: boolean } {
    const assignment = ROLE_ASSIGNMENT[role];
    const primary = assignment.primary;

    // Simulation: always mock
    if (this.config.mode === "simulation") {
      return { adapter: this.mockAdapter, provider: "mock", isMock: true };
    }

    // Selective: only use live if provider is explicitly enabled
    if (this.config.mode === "selective") {
      if (this.config.selectiveProviders[primary] && this.adapters.has(primary)) {
        return { adapter: this.adapters.get(primary)!, provider: primary, isMock: false };
      }
      if (
        assignment.fallback &&
        this.config.selectiveProviders[assignment.fallback] &&
        this.adapters.has(assignment.fallback)
      ) {
        return {
          adapter: this.adapters.get(assignment.fallback)!,
          provider: assignment.fallback,
          isMock: false,
        };
      }
      return { adapter: this.mockAdapter, provider: "mock", isMock: true };
    }

    // Live: use real adapter, fall back to secondary, then mock
    if (this.adapters.has(primary)) {
      return { adapter: this.adapters.get(primary)!, provider: primary, isMock: false };
    }
    if (assignment.fallback && this.adapters.has(assignment.fallback)) {
      return {
        adapter: this.adapters.get(assignment.fallback)!,
        provider: assignment.fallback,
        isMock: false,
      };
    }
    return { adapter: this.mockAdapter, provider: "mock", isMock: true };
  }

  /** Get the build worker for execution. */
  getBuildWorker(): { worker: BuildWorkerAdapter; provider: string; isMock: boolean } {
    if (this.config.mode === "simulation") {
      return { worker: this.mockWorker, provider: "mock", isMock: true };
    }

    if (this.config.mode === "selective") {
      if (this.config.selectiveProviders.claude && this.buildWorkers.has("claude")) {
        return { worker: this.buildWorkers.get("claude")!, provider: "claude", isMock: false };
      }
      return { worker: this.mockWorker, provider: "mock", isMock: true };
    }

    // Live
    if (this.buildWorkers.has("claude")) {
      return { worker: this.buildWorkers.get("claude")!, provider: "claude", isMock: false };
    }
    return { worker: this.mockWorker, provider: "mock", isMock: true };
  }

  /** Get the role assignment for debugging/logging. */
  getAssignment(role: ModelRole): ModelAssignment {
    return ROLE_ASSIGNMENT[role];
  }
}
