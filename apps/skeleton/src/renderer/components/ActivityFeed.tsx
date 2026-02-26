import type { SkeletonFullState } from "../types.js";

type Props = { state: SkeletonFullState };

type FeedItem = {
	id: string;
	type: "cycle" | "task" | "objective" | "info";
	label: string;
	detail: string;
	timestamp: string;
	color: string;
};

export function ActivityFeed({ state }: Props) {
	const items: FeedItem[] = [];

	// Add cycle events
	for (const cycle of state.cycles.slice(-5)) {
		items.push({
			id: `cycle-${cycle.id}`,
			type: "cycle",
			label: `Cycle #${cycle.number} ${cycle.state}`,
			detail: `${cycle.tasksCreated} tasks, $${cycle.totalCostUsd.toFixed(4)} cost`,
			timestamp: cycle.completedAt ?? cycle.startedAt,
			color:
				cycle.state === "completed"
					? "border-emerald-500/30"
					: "border-red-500/30",
		});
	}

	// Add recent tasks
	for (const task of state.tasks.slice(-5)) {
		items.push({
			id: `task-${task.id}`,
			type: "task",
			label: task.title,
			detail: `[${task.state}] tier ${task.autonomyTier}`,
			timestamp: task.updatedAt,
			color:
				task.state === "completed"
					? "border-emerald-500/30"
					: task.state === "failed"
						? "border-red-500/30"
						: "border-blue-500/30",
		});
	}

	// Sort by timestamp descending
	items.sort(
		(a, b) =>
			new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
	);

	const recent = items.slice(0, 10);

	return (
		<div className="bg-surface-1 rounded-xl border border-white/5 p-5">
			<h2 className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-4">
				Activity Feed
			</h2>
			{recent.length === 0 ? (
				<div className="text-gray-500 text-sm">No activity yet</div>
			) : (
				<div className="space-y-2">
					{recent.map((item) => (
						<div
							key={item.id}
							className={`flex items-start gap-3 p-2.5 rounded-lg border-l-2 ${item.color} bg-surface-2/30`}
						>
							<div className="flex-1 min-w-0">
								<div className="text-sm text-gray-300 truncate">
									{item.label}
								</div>
								<div className="text-xs text-gray-600">{item.detail}</div>
							</div>
							<div className="text-[10px] text-gray-600 whitespace-nowrap">
								{formatTime(item.timestamp)}
							</div>
						</div>
					))}
				</div>
			)}
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
		return d.toLocaleDateString();
	} catch {
		return "";
	}
}
