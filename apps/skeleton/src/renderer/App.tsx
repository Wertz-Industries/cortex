import { useEffect, useState } from "react";
import { useSkeletonStore } from "./hooks/useSkeletonStore.js";
import { TitleBar } from "./components/TitleBar.js";
import { Sidebar } from "./components/Sidebar.js";
import { Dashboard } from "./components/Dashboard.js";
import { IntelligenceView } from "./components/IntelligenceView.js";
import { ControlView } from "./components/ControlView.js";
import { LogsView } from "./components/LogsView.js";
import { SettingsView } from "./components/SettingsView.js";
import type { ViewName } from "./types.js";

export function App() {
	const { fetchState, setState, loading, error } = useSkeletonStore();
	const [view, setView] = useState<ViewName>("dashboard");

	useEffect(() => {
		void fetchState();

		const unsubscribe = window.skeletonApi.onStateUpdate((state) => {
			setState(state);
		});

		return unsubscribe;
	}, []);

	return (
		<div className="flex flex-col h-screen bg-surface">
			<TitleBar />
			<div className="flex flex-1 overflow-hidden">
				<Sidebar active={view} onChange={setView} />
				<main className="flex-1 overflow-auto p-6">
					{loading ? (
						<div className="flex items-center justify-center h-full">
							<div className="text-gray-500 text-sm">Loading skeleton state...</div>
						</div>
					) : error ? (
						<div className="flex items-center justify-center h-full">
							<div className="text-red-400 text-sm">{error}</div>
						</div>
					) : (
						<ViewRouter view={view} />
					)}
				</main>
			</div>
		</div>
	);
}

function ViewRouter({ view }: { view: ViewName }) {
	switch (view) {
		case "dashboard":
			return <Dashboard />;
		case "intelligence":
			return <IntelligenceView />;
		case "control":
			return <ControlView />;
		case "logs":
			return <LogsView />;
		case "settings":
			return <SettingsView />;
	}
}
