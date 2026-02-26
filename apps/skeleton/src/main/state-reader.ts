import fs from "node:fs/promises";
import path from "node:path";
import { execFile } from "node:child_process";
import crypto from "node:crypto";

/**
 * Reads and writes skeleton state from JSON files on disk.
 * The skeleton extension persists all state to ~/.cortex/.
 */
export class SkeletonStateReader {
	constructor(private stateDir: string) {}

	async getFullState() {
		const [engineState, config, objectives, cycles, tasks] =
			await Promise.all([
				this.readJson("state.json", {}),
				this.readJson("config.json", {}),
				this.readJson("objectives.json", []),
				this.readJson("cycles.json", []),
				this.readJson("tasks.json", []),
			]);

		const lastCycle =
			Array.isArray(cycles) && cycles.length > 0
				? cycles[cycles.length - 1]
				: null;

		// Add key status (masked) to config so the UI knows which are set
		const keyStatus: Record<string, boolean> = {
			gemini: !!config?.geminiApiKey,
			openai: !!config?.openaiApiKey,
			claude: !!config?.claudeApiKey,
			grok: !!config?.grokApiKey,
		};

		return {
			engine: engineState,
			config: { ...config, keyStatus },
			objectives: Array.isArray(objectives) ? objectives : [],
			cycles: Array.isArray(cycles) ? cycles : [],
			tasks: Array.isArray(tasks) ? tasks : [],
			lastCycle,
			summary: {
				state: engineState?.loopState ?? "unknown",
				mode: config?.mode ?? "simulation",
				phase: engineState?.currentPhase ?? null,
				totalCycles: engineState?.totalCyclesCompleted ?? 0,
				activeObjectives: Array.isArray(objectives)
					? objectives.filter((o: Record<string, unknown>) => o.status === "active").length
					: 0,
				totalTasks: Array.isArray(tasks) ? tasks.length : 0,
				completedTasks: Array.isArray(tasks)
					? tasks.filter((t: Record<string, unknown>) => t.state === "completed").length
					: 0,
				totalCostUsd: lastCycle?.totalCostUsd ?? 0,
			},
		};
	}

	async getObjectives() {
		return this.readJson("objectives.json", []);
	}

	async getTasks() {
		return this.readJson("tasks.json", []);
	}

	async getCycles() {
		return this.readJson("cycles.json", []);
	}

	async getScans() {
		return this.listDir("scans");
	}

	async getPlans() {
		return this.listDir("plans");
	}

	async getEvals() {
		return this.listDir("evaluations");
	}

	async getDecisions(): Promise<unknown[]> {
		return this.readJsonl("decisions.jsonl");
	}

	async getExperiments(): Promise<unknown[]> {
		return this.readJsonl("experiments.jsonl");
	}

	async getBudgetStatus() {
		return this.readJson("budget.json", {
			dailySpend: 0,
			weeklySpend: 0,
			perProviderDaily: {},
		});
	}

	async getCostSummary() {
		const runs = await this.listDir("runs");
		const byProvider: Record<string, number> = {};
		const byPhase: Record<string, number> = {};
		let total = 0;

		for (const run of runs) {
			if (run.provider)
				{byProvider[run.provider] =
					(byProvider[run.provider] ?? 0) + (run.costUsd ?? 0);}
			if (run.phase)
				{byPhase[run.phase] =
					(byPhase[run.phase] ?? 0) + (run.costUsd ?? 0);}
			total += run.costUsd ?? 0;
		}

		return { total, byProvider, byPhase, runCount: runs.length };
	}

	// ── Mutation methods ────────────────────────────────────────

	async updateConfig(updates: Record<string, unknown>): Promise<{ ok: boolean; config: unknown }> {
		const config = await this.readJson("config.json", {});
		// Deep merge budgets if provided
		if (updates.budgets && typeof updates.budgets === "object") {
			config.budgets = { ...config.budgets, ...updates.budgets as Record<string, unknown> };
			delete updates.budgets;
		}
		if (updates.selectiveProviders && typeof updates.selectiveProviders === "object") {
			config.selectiveProviders = { ...config.selectiveProviders, ...updates.selectiveProviders as Record<string, unknown> };
			delete updates.selectiveProviders;
		}
		Object.assign(config, updates);
		await this.writeJson("config.json", config);
		return { ok: true, config };
	}

	async createObjective(data: {
		title: string;
		description: string;
		weight?: number;
		acceptanceCriteria?: string[];
		tags?: string[];
	}): Promise<{ ok: boolean; objective: unknown }> {
		const objectives = await this.readJson("objectives.json", []) as unknown[];
		const now = new Date().toISOString();
		const objective = {
			id: crypto.randomUUID(),
			title: data.title,
			description: data.description,
			weight: data.weight ?? 0.5,
			status: "active",
			tags: data.tags ?? [],
			acceptanceCriteria: data.acceptanceCriteria ?? [],
			truthStatus: "hypothesis",
			confidence: "medium",
			createdAt: now,
			updatedAt: now,
		};
		objectives.push(objective);
		await this.writeJson("objectives.json", objectives);
		return { ok: true, objective };
	}

	async updateObjective(id: string, updates: Record<string, unknown>): Promise<{ ok: boolean; objective?: unknown; error?: string }> {
		const objectives = await this.readJson("objectives.json", []) as Record<string, unknown>[];
		const idx = objectives.findIndex((o: Record<string, unknown>) => o.id === id);
		if (idx === -1) {return { ok: false, error: "Objective not found" };}
		const allowed = ["title", "description", "weight", "status", "tags", "acceptanceCriteria", "truthStatus", "confidence"];
		for (const key of allowed) {
			if (key in updates) {objectives[idx][key] = updates[key];}
		}
		objectives[idx].updatedAt = new Date().toISOString();
		await this.writeJson("objectives.json", objectives);
		return { ok: true, objective: objectives[idx] };
	}

	async deleteObjective(id: string): Promise<{ ok: boolean; error?: string }> {
		const objectives = await this.readJson("objectives.json", []) as Record<string, unknown>[];
		const filtered = objectives.filter((o: Record<string, unknown>) => o.id !== id);
		if (filtered.length === objectives.length) {return { ok: false, error: "Objective not found" };}
		await this.writeJson("objectives.json", filtered);
		return { ok: true };
	}

	async runCommand(
		command: string,
		args: string[] = [],
	): Promise<{ ok: boolean; output: string }> {
		return new Promise((resolve) => {
			// Find the cortex binary
			const cortexBin =
				process.env.CORTEX_BIN ?? "pnpm";
			const fullArgs =
				cortexBin === "pnpm"
					? ["openclaw", "skeleton", command, ...args]
					: ["skeleton", command, ...args];

			// Resolve the cortex repo root (dist/main/ → apps/skeleton/ → cortex/)
			const repoRoot = process.env.CORTEX_ROOT
				?? path.resolve(__dirname, "../../../..");

			execFile(
				cortexBin,
				fullArgs,
				{
					cwd: repoRoot,
					timeout: 60_000,
					env: { ...process.env },
				},
				(error, stdout, stderr) => {
					if (error) {
						resolve({
							ok: false,
							output: stderr || error.message,
						});
						return;
					}
					resolve({ ok: true, output: stdout });
				},
			);
		});
	}

	private async writeJson(filename: string, data: unknown): Promise<void> {
		const filePath = path.join(this.stateDir, filename);
		const tmp = filePath + ".tmp";
		await fs.writeFile(tmp, JSON.stringify(data, null, "\t"), "utf-8");
		await fs.rename(tmp, filePath);
	}

	private async readJson(filename: string, fallback: unknown): Promise<unknown> {
		try {
			const raw = await fs.readFile(
				path.join(this.stateDir, filename),
				"utf-8",
			);
			return JSON.parse(raw);
		} catch {
			return fallback;
		}
	}

	private async readJsonl(filename: string): Promise<unknown[]> {
		try {
			const raw = await fs.readFile(
				path.join(this.stateDir, filename),
				"utf-8",
			);
			return raw
				.split("\n")
				.filter((line) => line.trim())
				.map((line) => {
					try {
						return JSON.parse(line);
					} catch {
						return null;
					}
				})
				.filter(Boolean);
		} catch {
			return [];
		}
	}

	private async listDir(dirname: string): Promise<unknown[]> {
		const dirPath = path.join(this.stateDir, dirname);
		try {
			const files = await fs.readdir(dirPath);
			const results: unknown[] = [];
			for (const file of files) {
				if (!file.endsWith(".json")) {continue;}
				try {
					const raw = await fs.readFile(
						path.join(dirPath, file),
						"utf-8",
					);
					results.push(JSON.parse(raw));
				} catch {
					// Skip corrupt files
				}
			}
			return results;
		} catch {
			return [];
		}
	}
}
