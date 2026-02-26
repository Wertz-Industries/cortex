import { useEffect, useState } from "react";
import type { Decision, Experiment } from "../types.js";

type Tab = "decisions" | "experiments";

const TRUTH_COLORS: Record<string, string> = {
	verified: "text-emerald-400",
	hypothesis: "text-blue-400",
	speculative: "text-yellow-400",
	implemented: "text-green-400",
	failed: "text-red-400",
	archived: "text-gray-500",
};

const PHASE_COLORS: Record<string, string> = {
	scan: "bg-blue-500/10 text-blue-400",
	plan: "bg-violet-500/10 text-violet-400",
	build: "bg-amber-500/10 text-amber-400",
	ship_check: "bg-cyan-500/10 text-cyan-400",
	eval: "bg-indigo-500/10 text-indigo-400",
};

export function LogsView() {
	const [tab, setTab] = useState<Tab>("decisions");
	const [decisions, setDecisions] = useState<Decision[]>([]);
	const [experiments, setExperiments] = useState<Experiment[]>([]);
	const [loading, setLoading] = useState(true);

	useEffect(() => {
		void Promise.all([
			window.skeletonApi.getDecisions(),
			window.skeletonApi.getExperiments(),
		]).then(([d, e]) => {
			setDecisions(d);
			setExperiments(e);
			setLoading(false);
		});
	}, []);

	if (loading) {
		return <div className="text-gray-500 text-sm p-6">Loading logs...</div>;
	}

	return (
		<div className="space-y-6 max-w-5xl mx-auto">
			<div className="flex gap-1 bg-surface-1 rounded-lg p-1 w-fit">
				{(["decisions", "experiments"] as Tab[]).map((t) => (
					<button
						key={t}
						onClick={() => setTab(t)}
						className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
							tab === t
								? "bg-accent/20 text-accent-bright"
								: "text-gray-400 hover:text-gray-200"
						}`}
					>
						{t.charAt(0).toUpperCase() + t.slice(1)}
						<span className="ml-1.5 text-xs text-gray-600">
							({t === "decisions" ? decisions.length : experiments.length})
						</span>
					</button>
				))}
			</div>

			{tab === "decisions" && <DecisionsPanel decisions={decisions} />}
			{tab === "experiments" && <ExperimentsPanel experiments={experiments} />}
		</div>
	);
}

function DecisionsPanel({ decisions }: { decisions: Decision[] }) {
	const sorted = [...decisions].toReversed();

	if (sorted.length === 0) {
		return (
			<div className="bg-surface-1 rounded-xl border border-white/5 p-8 text-center">
				<div className="text-gray-500 text-sm">No decisions logged yet.</div>
			</div>
		);
	}

	return (
		<div className="bg-surface-1 rounded-xl border border-white/5 overflow-hidden">
			<table className="w-full">
				<thead>
					<tr className="border-b border-white/5">
						<th className="text-left text-xs text-gray-500 font-medium uppercase tracking-wider px-4 py-3">
							Phase
						</th>
						<th className="text-left text-xs text-gray-500 font-medium uppercase tracking-wider px-4 py-3">
							Decision
						</th>
						<th className="text-left text-xs text-gray-500 font-medium uppercase tracking-wider px-4 py-3">
							Truth
						</th>
						<th className="text-right text-xs text-gray-500 font-medium uppercase tracking-wider px-4 py-3">
							Time
						</th>
					</tr>
				</thead>
				<tbody>
					{sorted.map((d) => (
						<tr key={d.id} className="border-b border-white/[0.03] hover:bg-white/[0.02]">
							<td className="px-4 py-3">
								<span className={`text-xs px-2 py-0.5 rounded-full ${PHASE_COLORS[d.phase] ?? "bg-gray-500/10 text-gray-400"}`}>
									{d.phase}
								</span>
							</td>
							<td className="px-4 py-3">
								<div className="text-sm text-gray-300">{d.decision}</div>
								<div className="text-xs text-gray-600 mt-0.5">{d.reason}</div>
							</td>
							<td className="px-4 py-3">
								<span className={`text-xs ${TRUTH_COLORS[d.truthStatus] ?? "text-gray-500"}`}>
									{d.truthStatus}
								</span>
							</td>
							<td className="px-4 py-3 text-right">
								<span className="text-xs text-gray-600">{formatTime(d.timestamp)}</span>
							</td>
						</tr>
					))}
				</tbody>
			</table>
		</div>
	);
}

function ExperimentsPanel({ experiments }: { experiments: Experiment[] }) {
	const sorted = [...experiments].toReversed();

	if (sorted.length === 0) {
		return (
			<div className="bg-surface-1 rounded-xl border border-white/5 p-8 text-center">
				<div className="text-gray-500 text-sm">No experiments logged yet.</div>
			</div>
		);
	}

	return (
		<div className="space-y-3">
			{sorted.map((exp) => (
				<div
					key={exp.id}
					className="bg-surface-1 rounded-xl border border-white/5 p-4"
				>
					<div className="flex items-start justify-between mb-2">
						<div className="text-sm font-medium text-gray-200">
							{exp.hypothesis}
						</div>
						<div className="flex items-center gap-2">
							<span className={`text-xs ${TRUTH_COLORS[exp.truthStatus] ?? "text-gray-500"}`}>
								{exp.truthStatus}
							</span>
							<span className="text-xs text-gray-600">{exp.confidence}</span>
						</div>
					</div>
					<div className="grid grid-cols-2 gap-4 text-xs">
						<div>
							<span className="text-gray-500">Method: </span>
							<span className="text-gray-400">{exp.method}</span>
						</div>
						<div>
							<span className="text-gray-500">Result: </span>
							<span className="text-gray-400">{exp.result}</span>
						</div>
					</div>
					<div className="flex items-center gap-3 mt-2 text-xs text-gray-600">
						{exp.cost != null && <span>${exp.cost.toFixed(4)}</span>}
						<span>{formatTime(exp.timestamp)}</span>
					</div>
				</div>
			))}
		</div>
	);
}

function formatTime(iso: string): string {
	try {
		const d = new Date(iso);
		const now = new Date();
		const diffMs = now.getTime() - d.getTime();
		if (diffMs < 60_000) {return "just now";}
		if (diffMs < 3_600_000) {return `${Math.floor(diffMs / 60_000)}m ago`;}
		if (diffMs < 86_400_000) {return `${Math.floor(diffMs / 3_600_000)}h ago`;}
		return d.toLocaleString();
	} catch {
		return "";
	}
}
