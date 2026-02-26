import type { SkeletonConfig, StateSummary } from "../types.js";

type Props = {
	summary: StateSummary;
	config: SkeletonConfig;
};

function Card({
	label,
	value,
	sub,
	color = "text-white",
}: {
	label: string;
	value: string | number;
	sub?: string;
	color?: string;
}) {
	return (
		<div className="bg-surface-1 rounded-xl border border-white/5 p-4">
			<div className="text-xs text-gray-500 uppercase tracking-wider mb-1">
				{label}
			</div>
			<div className={`text-2xl font-semibold ${color}`}>{value}</div>
			{sub && <div className="text-xs text-gray-500 mt-0.5">{sub}</div>}
		</div>
	);
}

export function KpiCards({ summary, config }: Props) {
	return (
		<div className="grid grid-cols-2 md:grid-cols-4 gap-4">
			<Card
				label="Cycles"
				value={summary.totalCycles}
				sub={summary.phase ? `Phase: ${summary.phase}` : "Idle"}
			/>
			<Card
				label="Objectives"
				value={summary.activeObjectives}
				sub={`active`}
				color="text-accent-bright"
			/>
			<Card
				label="Tasks"
				value={`${summary.completedTasks}/${summary.totalTasks}`}
				sub="completed"
				color="text-success"
			/>
			<Card
				label="Cost"
				value={`$${summary.totalCostUsd.toFixed(4)}`}
				sub={`daily cap: $${config.budgets?.dailyUsd ?? 10}`}
				color={summary.totalCostUsd > 0 ? "text-warning" : "text-gray-400"}
			/>
		</div>
	);
}
