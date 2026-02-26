import { create } from "zustand";
import type { SkeletonFullState, StateSummary } from "../types.js";

type SkeletonStore = {
	state: SkeletonFullState | null;
	loading: boolean;
	error: string | null;
	lastUpdated: number;

	// Actions
	fetchState: () => Promise<void>;
	setState: (state: SkeletonFullState) => void;
	trigger: (preset?: string) => Promise<string>;
	pause: () => Promise<void>;
	resume: () => Promise<void>;
};

const _defaultSummary: StateSummary = {
	state: "unknown",
	mode: "simulation",
	phase: null,
	totalCycles: 0,
	activeObjectives: 0,
	totalTasks: 0,
	completedTasks: 0,
	totalCostUsd: 0,
};

export const useSkeletonStore = create<SkeletonStore>((set, get) => ({
	state: null,
	loading: true,
	error: null,
	lastUpdated: 0,

	fetchState: async () => {
		try {
			const state = await window.skeletonApi.getState();
			set({ state, loading: false, error: null, lastUpdated: Date.now() });
		} catch (err) {
			set({
				loading: false,
				error: err instanceof Error ? err.message : "Failed to load state",
			});
		}
	},

	setState: (state: SkeletonFullState) => {
		set({ state, lastUpdated: Date.now() });
	},

	trigger: async (preset?: string) => {
		const result = await window.skeletonApi.trigger(preset);
		if (!result.ok) {throw new Error(result.output);}
		// Refresh state after trigger
		setTimeout(() => get().fetchState(), 500);
		return result.output;
	},

	pause: async () => {
		await window.skeletonApi.pause();
		setTimeout(() => get().fetchState(), 500);
	},

	resume: async () => {
		await window.skeletonApi.resume();
		setTimeout(() => get().fetchState(), 500);
	},
}));
