import type { Task } from "../types.js";

type Props = { tasks: Task[] };

const STATE_COLORS: Record<string, string> = {
	completed: "text-emerald-400 bg-emerald-500/10",
	building: "text-amber-400 bg-amber-500/10",
	reviewing: "text-cyan-400 bg-cyan-500/10",
	failed: "text-red-400 bg-red-500/10",
	awaiting_approval: "text-yellow-400 bg-yellow-500/10",
};

export function TasksList({ tasks }: Props) {
	const recent = tasks.slice(-10).toReversed();

	return (
		<div className="bg-surface-1 rounded-xl border border-white/5 p-5">
			<h2 className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-4">
				Tasks ({tasks.length})
			</h2>
			{recent.length === 0 ? (
				<div className="text-gray-500 text-sm">No tasks yet</div>
			) : (
				<div className="space-y-2">
					{recent.map((task) => (
						<div
							key={task.id}
							className="flex items-center gap-3 p-3 rounded-lg bg-surface-2/50 border border-white/5"
						>
							<span
								className={`text-xs px-2 py-0.5 rounded-full ${STATE_COLORS[task.state] ?? "text-gray-400 bg-gray-500/10"}`}
							>
								{task.state}
							</span>
							<div className="flex-1 min-w-0">
								<div className="text-sm text-gray-300 truncate">
									{task.title}
								</div>
							</div>
							<div className="text-xs text-gray-600 font-mono">
								T{task.autonomyTier}
							</div>
							{task.actualCostUsd > 0 && (
								<div className="text-xs text-gray-500 font-mono">
									${task.actualCostUsd.toFixed(4)}
								</div>
							)}
						</div>
					))}
				</div>
			)}
		</div>
	);
}
