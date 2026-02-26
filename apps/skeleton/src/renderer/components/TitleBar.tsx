import { useSkeletonStore } from "../hooks/useSkeletonStore.js";

const STATE_COLORS: Record<string, string> = {
	idle: "bg-emerald-500",
	scanning: "bg-blue-500 animate-pulse",
	planning: "bg-violet-500 animate-pulse",
	building: "bg-amber-500 animate-pulse",
	ship_checking: "bg-cyan-500 animate-pulse",
	evaluating: "bg-indigo-500 animate-pulse",
	paused: "bg-yellow-500",
	error: "bg-red-500",
	unknown: "bg-gray-500",
};

export function TitleBar() {
	const state = useSkeletonStore((s) => s.state);
	const loopState = state?.summary.state ?? "unknown";
	const mode = state?.summary.mode ?? "simulation";
	const dotColor = STATE_COLORS[loopState] ?? "bg-gray-500";

	return (
		<div className="drag-region flex items-center justify-between px-4 h-12 bg-surface-1 border-b border-white/5">
			{/* macOS traffic lights spacing */}
			<div className="w-20" />

			<div className="flex items-center gap-3">
				<span className="text-sm font-medium text-gray-300 tracking-wide">
					SKELETON
				</span>
				<span className="text-xs text-gray-500">|</span>
				<div className="flex items-center gap-1.5">
					<div className={`w-2 h-2 rounded-full ${dotColor}`} />
					<span className="text-xs text-gray-400 uppercase">{loopState}</span>
				</div>
				<span className="text-xs text-gray-500">|</span>
				<span className="text-xs text-gray-500 uppercase">{mode}</span>
			</div>

			<div className="w-20" />
		</div>
	);
}
