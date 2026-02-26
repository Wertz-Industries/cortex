import { useEffect, useState, useCallback } from "react";
import { useSkeletonStore } from "../hooks/useSkeletonStore.js";
import type { BudgetStatus, CostSummary } from "../types.js";

const MODES = [
	{
		id: "simulation",
		label: "Simulation",
		desc: "All mocked. Zero external calls.",
		color: "border-emerald-500/30 bg-emerald-500/5",
	},
	{
		id: "selective",
		label: "Selective",
		desc: "Choose which providers are live.",
		color: "border-amber-500/30 bg-amber-500/5",
	},
	{
		id: "live",
		label: "Live",
		desc: "All providers active with budget caps.",
		color: "border-red-500/30 bg-red-500/5",
	},
];

const BUDGET_FIELDS = [
	{ key: "perCallUsd", label: "Per Call" },
	{ key: "perTaskUsd", label: "Per Task" },
	{ key: "perCycleUsd", label: "Per Cycle" },
	{ key: "dailyUsd", label: "Daily", hasSpend: true },
	{ key: "weeklyUsd", label: "Weekly", hasSpend: true },
] as const;

export function SettingsView() {
	const state = useSkeletonStore((s) => s.state);
	const fetchState = useSkeletonStore((s) => s.fetchState);
	const [budgetStatus, setBudgetStatus] = useState<BudgetStatus | null>(null);
	const [costSummary, setCostSummary] = useState<CostSummary | null>(null);
	const [switching, setSwitching] = useState(false);
	const [message, setMessage] = useState<string | null>(null);

	// API keys — keyed by provider
	const [keyDrafts, setKeyDrafts] = useState<Record<string, string>>({
		gemini: "", openai: "", claude: "", grok: "",
	});
	const [savingKeys, setSavingKeys] = useState(false);

	// Budget editing
	const [editingBudget, setEditingBudget] = useState<string | null>(null);
	const [budgetDraft, setBudgetDraft] = useState("");

	const currentMode = state?.config.mode ?? "simulation";
	const budgets = state?.config.budgets;

	useEffect(() => {
		void window.skeletonApi.getBudgetStatus().then(setBudgetStatus);
		void window.skeletonApi.getCostSummary().then(setCostSummary);
	}, []);

	const flash = useCallback((msg: string) => {
		setMessage(msg);
		setTimeout(() => setMessage(null), 3000);
	}, []);

	const handleModeSwitch = async (mode: string) => {
		if (mode === currentMode) {return;}
		setSwitching(true);
		try {
			const result = await window.skeletonApi.setMode(mode);
			flash(result.ok ? `Switched to ${mode} mode` : `Failed: ${result.output}`);
		} catch {
			flash("Failed to switch mode");
		}
		setSwitching(false);
	};

	const keyStatus = (state?.config as Record<string, unknown>)?.keyStatus as Record<string, boolean> | undefined;

	const setKeyDraft = (provider: string, value: string) => {
		setKeyDrafts((prev) => ({ ...prev, [provider]: value }));
	};

	const handleSaveKeys = async () => {
		const keysToSave: Record<string, string> = {};
		for (const [k, v] of Object.entries(keyDrafts)) {
			if (v.trim()) {keysToSave[k] = v.trim();}
		}
		if (Object.keys(keysToSave).length === 0) {return;}
		setSavingKeys(true);
		try {
			const result = await window.skeletonApi.setKeys(keysToSave);
			if (result.ok) {
				flash("API keys saved");
				setKeyDrafts({ gemini: "", openai: "", claude: "", grok: "" });
				void fetchState();
			} else {
				flash(`Failed: ${result.output}`);
			}
		} catch {
			flash("Failed to save keys");
		}
		setSavingKeys(false);
	};

	const handleBudgetSave = async (field: string) => {
		const val = parseFloat(budgetDraft);
		if (isNaN(val) || val < 0) {
			flash("Invalid amount");
			setEditingBudget(null);
			return;
		}
		try {
			await window.skeletonApi.updateConfig({ budgets: { [field]: val } });
			flash(`Budget updated`);
			void fetchState();
		} catch {
			flash("Failed to update budget");
		}
		setEditingBudget(null);
	};

	return (
		<div className="space-y-6 max-w-3xl mx-auto">
			{/* Mode selector */}
			<Section title="Operating Mode">
				<div className="grid grid-cols-3 gap-3">
					{MODES.map((mode) => {
						const isActive = currentMode === mode.id;
						return (
							<button
								key={mode.id}
								onClick={() => handleModeSwitch(mode.id)}
								disabled={switching}
								className={`p-4 rounded-lg border-2 text-left transition-all ${
									isActive
										? mode.color
										: "border-white/5 hover:border-white/10 bg-surface-2/30"
								} disabled:opacity-50`}
							>
								<div className="flex items-center gap-2 mb-1">
									{isActive && (
										<div className="w-2 h-2 rounded-full bg-current" />
									)}
									<span className={`text-sm font-medium ${isActive ? "text-gray-200" : "text-gray-400"}`}>
										{mode.label}
									</span>
								</div>
								<p className="text-xs text-gray-500">{mode.desc}</p>
							</button>
						);
					})}
				</div>
				{message && (
					<div className="mt-3 text-xs text-gray-400">{message}</div>
				)}
			</Section>

			{/* API Keys */}
			<Section title="API Keys">
				<div className="space-y-3">
					{([
						{ id: "gemini", label: "Gemini", placeholder: "AIzaSy...", role: "Research (SCAN)" },
						{ id: "openai", label: "OpenAI", placeholder: "sk-...", role: "Planning (PLAN/EVAL)" },
						{ id: "claude", label: "Claude", placeholder: "sk-ant-...", role: "Building / Reviewing" },
						{ id: "grok", label: "Grok", placeholder: "xai-...", role: "Future" },
					] as const).map((provider) => (
						<KeyInput
							key={provider.id}
							label={provider.label}
							value={keyDrafts[provider.id]}
							onChange={(v) => setKeyDraft(provider.id, v)}
							placeholder={provider.placeholder}
							configured={keyStatus?.[provider.id] ?? false}
							role={provider.role}
						/>
					))}
					<button
						onClick={handleSaveKeys}
						disabled={savingKeys || !Object.values(keyDrafts).some((v) => v.trim())}
						className="px-4 py-2 rounded-lg bg-accent/20 text-accent text-sm font-medium
							hover:bg-accent/30 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
					>
						{savingKeys ? "Saving..." : "Save Keys"}
					</button>
					<p className="text-xs text-gray-600">
						Keys are stored locally. Enter a new value to update.
					</p>
				</div>
			</Section>

			{/* Budget caps */}
			{budgets && (
				<Section title="Budget Caps">
					<div className="grid grid-cols-2 gap-3">
						{BUDGET_FIELDS.map((f) => (
							<BudgetRow
								key={f.key}
								label={f.label}
								cap={(budgets as Record<string, number>)[f.key]}
								spent={f.hasSpend ? (f.key === "dailyUsd" ? budgetStatus?.dailySpend : budgetStatus?.weeklySpend) : undefined}
								editing={editingBudget === f.key}
								draft={editingBudget === f.key ? budgetDraft : ""}
								onEdit={() => {
									setEditingBudget(f.key);
									setBudgetDraft(String((budgets as Record<string, number>)[f.key]));
								}}
								onDraftChange={setBudgetDraft}
								onSave={() => handleBudgetSave(f.key)}
								onCancel={() => setEditingBudget(null)}
							/>
						))}
					</div>
				</Section>
			)}

			{/* Cost breakdown */}
			{costSummary && costSummary.runCount > 0 && (
				<Section title="Cost Breakdown">
					<div className="space-y-3">
						<div className="flex items-center justify-between">
							<span className="text-sm text-gray-400">Total spend</span>
							<span className="text-sm font-mono text-gray-200">
								${costSummary.total.toFixed(4)}
							</span>
						</div>
						<div className="flex items-center justify-between">
							<span className="text-sm text-gray-400">Total API calls</span>
							<span className="text-sm font-mono text-gray-200">
								{costSummary.runCount}
							</span>
						</div>

						{Object.keys(costSummary.byProvider).length > 0 && (
							<div>
								<div className="text-xs text-gray-500 uppercase tracking-wider mb-2 mt-3">
									By Provider
								</div>
								{Object.entries(costSummary.byProvider).map(([provider, cost]) => (
									<div key={provider} className="flex items-center justify-between py-1">
										<span className="text-sm text-gray-400">{provider}</span>
										<span className="text-sm font-mono text-gray-300">${cost.toFixed(4)}</span>
									</div>
								))}
							</div>
						)}

						{Object.keys(costSummary.byPhase).length > 0 && (
							<div>
								<div className="text-xs text-gray-500 uppercase tracking-wider mb-2 mt-3">
									By Phase
								</div>
								{Object.entries(costSummary.byPhase).map(([phase, cost]) => (
									<div key={phase} className="flex items-center justify-between py-1">
										<span className="text-sm text-gray-400">{phase}</span>
										<span className="text-sm font-mono text-gray-300">${cost.toFixed(4)}</span>
									</div>
								))}
							</div>
						)}
					</div>
				</Section>
			)}

			{/* Engine info */}
			{state?.engine && (
				<Section title="Engine Status">
					<div className="space-y-2 text-sm">
						<InfoRow label="Loop State" value={state.engine.loopState} />
						<InfoRow label="Total Cycles" value={String(state.engine.totalCyclesCompleted)} />
						{state.engine.lastCycleCompletedAt && (
							<InfoRow
								label="Last Cycle"
								value={new Date(state.engine.lastCycleCompletedAt).toLocaleString()}
							/>
						)}
						{state.engine.nextCycleScheduledAt && (
							<InfoRow
								label="Next Cycle"
								value={new Date(state.engine.nextCycleScheduledAt).toLocaleString()}
							/>
						)}
						{state.engine.error && (
							<InfoRow label="Error" value={state.engine.error} warn />
						)}
						<InfoRow label="Cooldown" value={`${state.config.cycleCooldownMinutes ?? 15} min`} />
					</div>
				</Section>
			)}
		</div>
	);
}

function KeyInput({
	label,
	value,
	onChange,
	placeholder,
	configured,
	role,
}: {
	label: string;
	value: string;
	onChange: (v: string) => void;
	placeholder: string;
	configured: boolean;
	role: string;
}) {
	const [visible, setVisible] = useState(false);
	return (
		<div>
			<div className="flex items-center gap-2 mb-1">
				<label className="text-xs text-gray-500">{label}</label>
				<span className="text-[10px] text-gray-600">{role}</span>
				<div className="flex-1" />
				{configured ? (
					<span className="text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400">
						configured
					</span>
				) : (
					<span className="text-[10px] px-1.5 py-0.5 rounded-full bg-gray-500/10 text-gray-500">
						not set
					</span>
				)}
			</div>
			<div className="flex gap-2">
				<input
					type={visible ? "text" : "password"}
					value={value}
					onChange={(e) => onChange(e.target.value)}
					placeholder={configured ? "Enter new key to update" : placeholder}
					className="flex-1 bg-surface-2/80 border border-white/10 rounded-lg px-3 py-2 text-sm
						text-gray-200 font-mono placeholder:text-gray-600
						focus:outline-none focus:border-accent/50 transition-colors"
				/>
				<button
					onClick={() => setVisible(!visible)}
					className="px-3 py-2 rounded-lg bg-surface-2/80 border border-white/10
						text-xs text-gray-400 hover:text-gray-200 transition-colors"
				>
					{visible ? "Hide" : "Show"}
				</button>
			</div>
		</div>
	);
}

function BudgetRow({
	label,
	cap,
	spent,
	editing,
	draft,
	onEdit,
	onDraftChange,
	onSave,
	onCancel,
}: {
	label: string;
	cap: number;
	spent?: number;
	editing: boolean;
	draft: string;
	onEdit: () => void;
	onDraftChange: (v: string) => void;
	onSave: () => void;
	onCancel: () => void;
}) {
	const pct = spent != null && cap > 0 ? Math.min(100, (spent / cap) * 100) : 0;
	const isHigh = pct > 80;

	return (
		<div className="p-3 rounded-lg bg-surface-2/50 border border-white/5">
			<div className="flex items-center justify-between mb-1">
				<span className="text-xs text-gray-500">{label}</span>
				{editing ? (
					<div className="flex items-center gap-1">
						<span className="text-xs text-gray-500">$</span>
						<input
							autoFocus
							type="number"
							step="0.01"
							min="0"
							value={draft}
							onChange={(e) => onDraftChange(e.target.value)}
							onKeyDown={(e) => {
								if (e.key === "Enter") {onSave();}
								if (e.key === "Escape") {onCancel();}
							}}
							className="w-20 bg-surface-2 border border-accent/50 rounded px-2 py-0.5
								text-xs font-mono text-gray-200 focus:outline-none"
						/>
						<button onClick={onSave} className="text-xs text-accent hover:text-accent/80">Save</button>
						<button onClick={onCancel} className="text-xs text-gray-500 hover:text-gray-300">Cancel</button>
					</div>
				) : (
					<button
						onClick={onEdit}
						className="text-xs font-mono text-gray-300 hover:text-accent transition-colors cursor-pointer"
						title="Click to edit"
					>
						${cap.toFixed(2)}
					</button>
				)}
			</div>
			{spent != null && (
				<>
					<div className="w-full h-1.5 rounded-full bg-gray-700/50 overflow-hidden">
						<div
							className={`h-full rounded-full transition-all ${isHigh ? "bg-danger" : "bg-accent"}`}
							style={{ width: `${pct}%` }}
						/>
					</div>
					<div className="flex justify-between mt-1">
						<span className="text-[10px] text-gray-600">${spent.toFixed(4)} spent</span>
						<span className={`text-[10px] ${isHigh ? "text-red-400" : "text-gray-600"}`}>
							{pct.toFixed(0)}%
						</span>
					</div>
				</>
			)}
		</div>
	);
}

function InfoRow({ label, value, warn }: { label: string; value: string; warn?: boolean }) {
	return (
		<div className="flex items-center justify-between">
			<span className="text-gray-500">{label}</span>
			<span className={`font-mono ${warn ? "text-red-400" : "text-gray-300"}`}>
				{value}
			</span>
		</div>
	);
}

function Section({
	title,
	children,
}: {
	title: string;
	children: React.ReactNode;
}) {
	return (
		<div className="bg-surface-1 rounded-xl border border-white/5 p-5">
			<h2 className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-4">
				{title}
			</h2>
			{children}
		</div>
	);
}
