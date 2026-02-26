export type SkeletonApi = {
	getState: () => Promise<SkeletonFullState>;
	getObjectives: () => Promise<Objective[]>;
	getTasks: () => Promise<Task[]>;
	getCycles: () => Promise<Cycle[]>;
	getScans: () => Promise<Scan[]>;
	getPlans: () => Promise<Plan[]>;
	getEvals: () => Promise<Evaluation[]>;
	getCostSummary: () => Promise<CostSummary>;
	getDecisions: () => Promise<Decision[]>;
	getExperiments: () => Promise<Experiment[]>;
	getBudgetStatus: () => Promise<BudgetStatus>;
	trigger: (preset?: string) => Promise<CommandResult>;
	pause: () => Promise<CommandResult>;
	resume: () => Promise<CommandResult>;
	setMode: (mode: string) => Promise<CommandResult>;
	setKeys: (keys: { gemini?: string; openai?: string; claude?: string; grok?: string }) => Promise<CommandResult>;
	updateConfig: (updates: Record<string, unknown>) => Promise<{ ok: boolean; config: unknown }>;
	createObjective: (data: { title: string; description: string; weight?: number; acceptanceCriteria?: string[]; tags?: string[] }) =>
		Promise<{ ok: boolean; objective: Objective }>;
	updateObjective: (id: string, updates: Record<string, unknown>) =>
		Promise<{ ok: boolean; objective?: Objective; error?: string }>;
	deleteObjective: (id: string) => Promise<{ ok: boolean; error?: string }>;

	// GUI automation
	guiScreenshot: (opts?: { region?: { x: number; y: number; width: number; height: number } }) =>
		Promise<{ ok: boolean; image?: string; width?: number; height?: number; error?: string }>;
	guiClick: (x: number, y: number, button?: string) => Promise<{ ok: boolean }>;
	guiType: (text: string) => Promise<{ ok: boolean }>;
	guiHotkey: (keys: string[]) => Promise<{ ok: boolean }>;
	guiMoveTo: (x: number, y: number) => Promise<{ ok: boolean }>;
	guiScroll: (amount: number, x?: number, y?: number) => Promise<{ ok: boolean }>;
	guiScreenSize: () => Promise<{ ok: boolean; width?: number; height?: number }>;
	guiMousePos: () => Promise<{ ok: boolean; x?: number; y?: number }>;

	onStateUpdate: (callback: (state: SkeletonFullState) => void) => () => void;
};

export type CommandResult = { ok: boolean; output: string };

export type SkeletonFullState = {
	engine: EngineState;
	config: SkeletonConfig;
	objectives: Objective[];
	cycles: Cycle[];
	tasks: Task[];
	lastCycle: Cycle | null;
	summary: StateSummary;
};

export type StateSummary = {
	state: string;
	mode: string;
	phase: string | null;
	totalCycles: number;
	activeObjectives: number;
	totalTasks: number;
	completedTasks: number;
	totalCostUsd: number;
};

export type EngineState = {
	loopState: string;
	currentPhase?: string;
	currentCycleId?: string;
	totalCyclesCompleted: number;
	lastCycleCompletedAt?: string;
	nextCycleScheduledAt?: string;
	error?: string;
};

export type SkeletonConfig = {
	mode: string;
	cycleCooldownMinutes: number;
	budgets: BudgetConfig;
	selectiveProviders: Record<string, boolean>;
};

export type BudgetConfig = {
	perCallUsd: number;
	perTaskUsd: number;
	perCycleUsd: number;
	dailyUsd: number;
	weeklyUsd: number;
	perProviderDailyUsd: Record<string, number>;
};

export type Objective = {
	id: string;
	title: string;
	description: string;
	weight: number;
	status: string;
	tags: string[];
	acceptanceCriteria: string[];
	truthStatus: string;
	confidence: string;
	createdAt: string;
	updatedAt: string;
};

export type Task = {
	id: string;
	objectiveId: string;
	cycleId: string;
	title: string;
	description: string;
	state: string;
	autonomyTier: string;
	budgetCapUsd: number;
	actualCostUsd: number;
	artifacts: Array<{ type: string; label: string; value: string }>;
	truthStatus: string;
	confidence: string;
	error?: string;
	createdAt: string;
	updatedAt: string;
	completedAt?: string;
};

export type Cycle = {
	id: string;
	number: number;
	state: string;
	mode: string;
	phases: Record<string, { startedAt?: string; completedAt?: string }>;
	totalCostUsd: number;
	tasksCreated: number;
	tasksCompleted: number;
	startedAt: string;
	completedAt?: string;
};

export type Scan = {
	id: string;
	cycleId: string;
	findings: Array<{
		topic: string;
		summary: string;
		relevance: number;
		truthStatus: string;
		confidence: string;
	}>;
	costUsd: number;
	createdAt: string;
};

export type Plan = {
	id: string;
	cycleId: string;
	strategy: {
		summary: string;
		priorities: Array<{
			objectiveId: string;
			proposedTasks: Array<{ title: string; suggestedTier: string }>;
		}>;
	};
	costUsd: number;
	createdAt: string;
};

export type Evaluation = {
	id: string;
	cycleId: string;
	insights: string[];
	recommendations: Array<{
		action: string;
		priority: string;
		truthStatus: string;
	}>;
	costUsd: number;
	createdAt: string;
};

export type CostSummary = {
	total: number;
	byProvider: Record<string, number>;
	byPhase: Record<string, number>;
	runCount: number;
};

export type Decision = {
	id: string;
	phase: string;
	decision: string;
	reason: string;
	truthStatus: string;
	costImpact?: number;
	timestamp: string;
};

export type Experiment = {
	id: string;
	hypothesis: string;
	method: string;
	result: string;
	truthStatus: string;
	confidence: string;
	cost?: number;
	timestamp: string;
};

export type BudgetStatus = {
	dailySpend: number;
	weeklySpend: number;
	perProviderDaily: Record<string, number>;
};

export type ViewName =
	| "dashboard"
	| "intelligence"
	| "control"
	| "logs"
	| "settings";

declare global {
	interface Window {
		skeletonApi: SkeletonApi;
	}
}
