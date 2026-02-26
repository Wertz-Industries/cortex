import { useState } from "react";
import { useSkeletonStore } from "../hooks/useSkeletonStore.js";

export function Controls() {
	const { state, trigger, pause, resume } = useSkeletonStore();
	const [running, setRunning] = useState(false);
	const [message, setMessage] = useState<string | null>(null);

	const loopState = state?.summary.state ?? "unknown";
	const isPaused = loopState === "paused";
	const isRunning = [
		"scanning",
		"planning",
		"building",
		"ship_checking",
		"evaluating",
	].includes(loopState);

	const handleTrigger = async (preset?: string) => {
		setRunning(true);
		setMessage(null);
		try {
			await trigger(preset);
			setMessage("Cycle triggered");
		} catch (err) {
			setMessage(err instanceof Error ? err.message : "Failed");
		}
		setRunning(false);
		setTimeout(() => setMessage(null), 3000);
	};

	const handlePauseResume = async () => {
		try {
			if (isPaused) {
				await resume();
				setMessage("Resumed");
			} else {
				await pause();
				setMessage("Paused");
			}
		} catch {
			setMessage("Failed");
		}
		setTimeout(() => setMessage(null), 3000);
	};

	return (
		<div className="flex items-center gap-3">
			<button
				onClick={() => handleTrigger("smb-scout")}
				disabled={running || isRunning}
				className="no-drag px-4 py-2 rounded-lg bg-accent hover:bg-accent-bright text-white text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
			>
				{running ? "Running..." : "Trigger Cycle"}
			</button>

			<button
				onClick={handlePauseResume}
				disabled={isRunning}
				className="no-drag px-4 py-2 rounded-lg bg-surface-2 hover:bg-surface-3 text-gray-300 text-sm font-medium border border-white/10 transition-colors disabled:opacity-50"
			>
				{isPaused ? "Resume" : "Pause"}
			</button>

			<div className="flex-1" />

			{message && (
				<span className="text-xs text-gray-400 animate-fade-in">
					{message}
				</span>
			)}

			<div className="text-xs text-gray-600">
				{state?.summary.mode?.toUpperCase()}
			</div>
		</div>
	);
}
