import type { Cycle } from "../types.js";

type Props = { cycles: Cycle[] };

const PHASE_LABELS = ["scan", "plan", "build", "ship_check", "eval"];

export function CycleHistory({ cycles }: Props) {
	const recent = cycles.slice(-5).toReversed();

	return (
		<div className="bg-surface-1 rounded-xl border border-white/5 p-5">
			<h2 className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-4">
				Cycle History
			</h2>
			{recent.length === 0 ? (
				<div className="text-gray-500 text-sm">No cycles yet</div>
			) : (
				<div className="space-y-3">
					{recent.map((cycle) => (
						<div
							key={cycle.id}
							className="p-3 rounded-lg bg-surface-2/50 border border-white/5"
						>
							<div className="flex items-center justify-between mb-2">
								<div className="flex items-center gap-2">
									<span className="text-sm font-medium text-gray-300">
										Cycle #{cycle.number}
									</span>
									<span
										className={`text-xs px-2 py-0.5 rounded-full ${
											cycle.state === "completed"
												? "bg-emerald-500/10 text-emerald-400"
												: cycle.state === "failed"
													? "bg-red-500/10 text-red-400"
													: "bg-blue-500/10 text-blue-400"
										}`}
									>
										{cycle.state}
									</span>
								</div>
								<span className="text-xs text-gray-600 font-mono">
									${cycle.totalCostUsd.toFixed(4)}
								</span>
							</div>

							{/* Phase timeline */}
							<div className="flex gap-1">
								{PHASE_LABELS.map((phase) => {
									const timing = cycle.phases[phase];
									const completed = !!timing?.completedAt;
									const started = !!timing?.startedAt;
									return (
										<div
											key={phase}
											className={`flex-1 h-1.5 rounded-full ${
												completed
													? "bg-emerald-500/60"
													: started
														? "bg-amber-500/60"
														: "bg-gray-700/40"
											}`}
											title={phase}
										/>
									);
								})}
							</div>
							<div className="flex justify-between mt-1">
								{PHASE_LABELS.map((p) => (
									<span key={p} className="text-[10px] text-gray-600 flex-1 text-center">
										{p === "ship_check" ? "ship" : p}
									</span>
								))}
							</div>

							<div className="flex items-center gap-3 mt-2 text-xs text-gray-600">
								<span>
									{cycle.tasksCreated} created / {cycle.tasksCompleted} completed
								</span>
								<span className="text-gray-700">|</span>
								<span>{cycle.mode}</span>
								{cycle.startedAt && (
									<>
										<span className="text-gray-700">|</span>
										<span>
											{new Date(cycle.startedAt).toLocaleTimeString()}
										</span>
									</>
								)}
							</div>
						</div>
					))}
				</div>
			)}
		</div>
	);
}
