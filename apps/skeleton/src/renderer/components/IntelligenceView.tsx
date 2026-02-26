import { useEffect, useState } from "react";
import type { Scan, Plan, Evaluation } from "../types.js";

type Tab = "scans" | "plans" | "evals";

const TRUTH_COLORS: Record<string, string> = {
	verified: "text-emerald-400",
	hypothesis: "text-blue-400",
	speculative: "text-yellow-400",
	implemented: "text-green-400",
	failed: "text-red-400",
	archived: "text-gray-500",
};

export function IntelligenceView() {
	const [tab, setTab] = useState<Tab>("scans");
	const [scans, setScans] = useState<Scan[]>([]);
	const [plans, setPlans] = useState<Plan[]>([]);
	const [evals, setEvals] = useState<Evaluation[]>([]);
	const [loading, setLoading] = useState(true);

	useEffect(() => {
		void Promise.all([
			window.skeletonApi.getScans(),
			window.skeletonApi.getPlans(),
			window.skeletonApi.getEvals(),
		]).then(([s, p, e]) => {
			setScans(s);
			setPlans(p);
			setEvals(e);
			setLoading(false);
		});
	}, []);

	if (loading) {
		return <div className="text-gray-500 text-sm p-6">Loading intelligence data...</div>;
	}

	return (
		<div className="space-y-6 max-w-5xl mx-auto">
			{/* Tab bar */}
			<div className="flex gap-1 bg-surface-1 rounded-lg p-1 w-fit">
				{(["scans", "plans", "evals"] as Tab[]).map((t) => (
					<button
						key={t}
						onClick={() => setTab(t)}
						className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
							tab === t
								? "bg-accent/20 text-accent-bright"
								: "text-gray-400 hover:text-gray-200"
						}`}
					>
						{t === "evals" ? "Evaluations" : t.charAt(0).toUpperCase() + t.slice(1)}
					</button>
				))}
			</div>

			{tab === "scans" && <ScansPanel scans={scans} />}
			{tab === "plans" && <PlansPanel plans={plans} />}
			{tab === "evals" && <EvalsPanel evals={evals} />}
		</div>
	);
}

function ScansPanel({ scans }: { scans: Scan[] }) {
	if (scans.length === 0) {
		return <Empty label="No scan data yet. Trigger a cycle to generate intelligence." />;
	}

	return (
		<div className="space-y-4">
			{scans.map((scan) => (
				<div key={scan.id} className="bg-surface-1 rounded-xl border border-white/5 p-5">
					<div className="flex items-center justify-between mb-4">
						<div className="text-sm font-medium text-gray-300">
							Scan — Cycle {scan.cycleId.slice(0, 8)}
						</div>
						<div className="flex items-center gap-3 text-xs text-gray-500">
							<span>${scan.costUsd.toFixed(4)}</span>
							<span>{formatDate(scan.createdAt)}</span>
						</div>
					</div>
					<div className="space-y-3">
						{scan.findings.map((finding, i) => (
							<div
								key={i}
								className="p-3 rounded-lg bg-surface-2/50 border border-white/5"
							>
								<div className="flex items-center justify-between mb-1">
									<span className="text-sm font-medium text-gray-200">
										{finding.topic}
									</span>
									<div className="flex items-center gap-2">
										<span className={`text-xs ${TRUTH_COLORS[finding.truthStatus] ?? "text-gray-500"}`}>
											{finding.truthStatus}
										</span>
										<span className="text-xs text-gray-600">
											{finding.confidence}
										</span>
										<RelevanceBar value={finding.relevance} />
									</div>
								</div>
								<p className="text-xs text-gray-400 leading-relaxed">
									{finding.summary}
								</p>
							</div>
						))}
					</div>
				</div>
			))}
		</div>
	);
}

function PlansPanel({ plans }: { plans: Plan[] }) {
	if (plans.length === 0) {
		return <Empty label="No plans yet." />;
	}

	return (
		<div className="space-y-4">
			{plans.map((plan) => (
				<div key={plan.id} className="bg-surface-1 rounded-xl border border-white/5 p-5">
					<div className="flex items-center justify-between mb-3">
						<div className="text-sm font-medium text-gray-300">
							Plan — Cycle {plan.cycleId.slice(0, 8)}
						</div>
						<div className="flex items-center gap-3 text-xs text-gray-500">
							<span>${plan.costUsd.toFixed(4)}</span>
							<span>{formatDate(plan.createdAt)}</span>
						</div>
					</div>
					<p className="text-sm text-gray-400 mb-4">{plan.strategy.summary}</p>
					{plan.strategy.priorities.map((pri, i) => (
						<div key={i} className="mb-3">
							<div className="text-xs text-gray-500 mb-1.5">
								Objective: {pri.objectiveId.slice(0, 8)}
							</div>
							<div className="space-y-1.5">
								{pri.proposedTasks.map((task, j) => (
									<div
										key={j}
										className="flex items-center gap-2 p-2 rounded bg-surface-2/50 border border-white/5"
									>
										<span className="text-xs text-gray-500 font-mono">
											T{task.suggestedTier}
										</span>
										<span className="text-sm text-gray-300">{task.title}</span>
									</div>
								))}
							</div>
						</div>
					))}
				</div>
			))}
		</div>
	);
}

function EvalsPanel({ evals }: { evals: Evaluation[] }) {
	if (evals.length === 0) {
		return <Empty label="No evaluations yet." />;
	}

	return (
		<div className="space-y-4">
			{evals.map((ev) => (
				<div key={ev.id} className="bg-surface-1 rounded-xl border border-white/5 p-5">
					<div className="flex items-center justify-between mb-4">
						<div className="text-sm font-medium text-gray-300">
							Evaluation — Cycle {ev.cycleId.slice(0, 8)}
						</div>
						<div className="flex items-center gap-3 text-xs text-gray-500">
							<span>${ev.costUsd.toFixed(4)}</span>
							<span>{formatDate(ev.createdAt)}</span>
						</div>
					</div>

					{ev.insights.length > 0 && (
						<div className="mb-4">
							<div className="text-xs text-gray-500 uppercase tracking-wider mb-2">
								Insights
							</div>
							<ul className="space-y-1.5">
								{ev.insights.map((insight, i) => (
									<li key={i} className="text-sm text-gray-400 flex items-start gap-2">
										<span className="text-accent-bright mt-0.5">•</span>
										{insight}
									</li>
								))}
							</ul>
						</div>
					)}

					{ev.recommendations.length > 0 && (
						<div>
							<div className="text-xs text-gray-500 uppercase tracking-wider mb-2">
								Recommendations
							</div>
							<div className="space-y-2">
								{ev.recommendations.map((rec, i) => (
									<div
										key={i}
										className="flex items-center gap-3 p-2.5 rounded-lg bg-surface-2/50 border border-white/5"
									>
										<span className={`text-xs px-2 py-0.5 rounded-full ${
											rec.priority === "high"
												? "bg-red-500/10 text-red-400"
												: rec.priority === "medium"
													? "bg-yellow-500/10 text-yellow-400"
													: "bg-gray-500/10 text-gray-400"
										}`}>
											{rec.priority}
										</span>
										<span className="text-sm text-gray-300 flex-1">{rec.action}</span>
										<span className={`text-xs ${TRUTH_COLORS[rec.truthStatus] ?? "text-gray-500"}`}>
											{rec.truthStatus}
										</span>
									</div>
								))}
							</div>
						</div>
					)}
				</div>
			))}
		</div>
	);
}

function RelevanceBar({ value }: { value: number }) {
	const pct = Math.round(value * 100);
	return (
		<div className="flex items-center gap-1.5">
			<div className="w-12 h-1.5 rounded-full bg-gray-700/50 overflow-hidden">
				<div
					className="h-full rounded-full bg-accent"
					style={{ width: `${pct}%` }}
				/>
			</div>
			<span className="text-[10px] text-gray-600 font-mono">{pct}%</span>
		</div>
	);
}

function Empty({ label }: { label: string }) {
	return (
		<div className="bg-surface-1 rounded-xl border border-white/5 p-8 text-center">
			<div className="text-gray-500 text-sm">{label}</div>
		</div>
	);
}

function formatDate(iso: string): string {
	try {
		return new Date(iso).toLocaleString();
	} catch {
		return "";
	}
}
