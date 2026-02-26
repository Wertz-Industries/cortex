import { useSkeletonStore } from "../hooks/useSkeletonStore.js";
import { KpiCards } from "./KpiCards.js";
import { CycleHistory } from "./CycleHistory.js";
import { ObjectivesList } from "./ObjectivesList.js";
import { TasksList } from "./TasksList.js";
import { Controls } from "./Controls.js";
import { ActivityFeed } from "./ActivityFeed.js";

export function Dashboard() {
	const state = useSkeletonStore((s) => s.state);
	if (!state) {return null;}

	return (
		<div className="space-y-6 max-w-7xl mx-auto">
			{/* Controls row */}
			<Controls />

			{/* KPI Cards */}
			<KpiCards summary={state.summary} config={state.config} />

			{/* Two-column layout */}
			<div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
				{/* Left column */}
				<div className="space-y-6">
					<ObjectivesList objectives={state.objectives} />
					<TasksList tasks={state.tasks} />
				</div>

				{/* Right column */}
				<div className="space-y-6">
					<CycleHistory cycles={state.cycles} />
					<ActivityFeed state={state} />
				</div>
			</div>
		</div>
	);
}
