import {
	LayoutDashboard,
	Brain,
	Crosshair,
	ScrollText,
	Settings,
} from "lucide-react";
import type { ViewName } from "../types.js";

type Props = {
	active: ViewName;
	onChange: (view: ViewName) => void;
};

const NAV_ITEMS: Array<{ id: ViewName; label: string; icon: typeof LayoutDashboard }> = [
	{ id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
	{ id: "intelligence", label: "Intelligence", icon: Brain },
	{ id: "control", label: "Control", icon: Crosshair },
	{ id: "logs", label: "Logs", icon: ScrollText },
	{ id: "settings", label: "Settings", icon: Settings },
];

export function Sidebar({ active, onChange }: Props) {
	return (
		<nav className="w-48 flex-shrink-0 bg-surface-1 border-r border-white/5 flex flex-col pt-2 pb-4">
			<div className="space-y-0.5 px-2">
				{NAV_ITEMS.map(({ id, label, icon: Icon }) => {
					const isActive = active === id;
					return (
						<button
							key={id}
							onClick={() => onChange(id)}
							className={`no-drag w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
								isActive
									? "bg-accent/15 text-accent-bright"
									: "text-gray-400 hover:text-gray-200 hover:bg-white/5"
							}`}
						>
							<Icon size={16} strokeWidth={isActive ? 2 : 1.5} />
							{label}
						</button>
					);
				})}
			</div>

			<div className="flex-1" />

			<div className="px-4">
				<div className="text-[10px] text-gray-600 font-mono">
					SKELETON v2026.2
				</div>
			</div>
		</nav>
	);
}
