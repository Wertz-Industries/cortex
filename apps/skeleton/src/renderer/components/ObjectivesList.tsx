import { useState } from "react";
import { useSkeletonStore } from "../hooks/useSkeletonStore.js";
import type { Objective } from "../types.js";

type Props = { objectives: Objective[] };

const TRUTH_COLORS: Record<string, string> = {
	verified: "text-emerald-400",
	hypothesis: "text-blue-400",
	speculative: "text-yellow-400",
	implemented: "text-green-400",
	failed: "text-red-400",
	archived: "text-gray-500",
};

export function ObjectivesList({ objectives }: Props) {
	const fetchState = useSkeletonStore((s) => s.fetchState);
	const [showForm, setShowForm] = useState(false);
	const [editingId, setEditingId] = useState<string | null>(null);
	const [title, setTitle] = useState("");
	const [description, setDescription] = useState("");
	const [weight, setWeight] = useState("0.5");
	const [criteria, setCriteria] = useState("");
	const [saving, setSaving] = useState(false);
	const [message, setMessage] = useState<string | null>(null);

	const flash = (msg: string) => {
		setMessage(msg);
		setTimeout(() => setMessage(null), 3000);
	};

	const resetForm = () => {
		setTitle("");
		setDescription("");
		setWeight("0.5");
		setCriteria("");
		setShowForm(false);
		setEditingId(null);
	};

	const startEdit = (obj: Objective) => {
		setEditingId(obj.id);
		setTitle(obj.title);
		setDescription(obj.description);
		setWeight(String(obj.weight));
		setCriteria(obj.acceptanceCriteria.join("\n"));
		setShowForm(true);
	};

	const handleSave = async () => {
		if (!title.trim()) {return;}
		setSaving(true);
		try {
			const criteriaArr = criteria.split("\n").map((s) => s.trim()).filter(Boolean);
			if (editingId) {
				const result = await window.skeletonApi.updateObjective(editingId, {
					title: title.trim(),
					description: description.trim(),
					weight: parseFloat(weight) || 0.5,
					acceptanceCriteria: criteriaArr,
				});
				flash(result.ok ? "Objective updated" : `Error: ${result.error}`);
			} else {
				const result = await window.skeletonApi.createObjective({
					title: title.trim(),
					description: description.trim(),
					weight: parseFloat(weight) || 0.5,
					acceptanceCriteria: criteriaArr,
				});
				flash(result.ok ? "Objective created" : "Failed to create");
			}
			resetForm();
			void fetchState();
		} catch {
			flash("Failed to save objective");
		}
		setSaving(false);
	};

	const handleDelete = async (id: string) => {
		try {
			const result = await window.skeletonApi.deleteObjective(id);
			flash(result.ok ? "Objective deleted" : `Error: ${result.error}`);
			void fetchState();
		} catch {
			flash("Failed to delete");
		}
	};

	const handleToggleStatus = async (obj: Objective) => {
		const newStatus = obj.status === "active" ? "paused" : "active";
		await window.skeletonApi.updateObjective(obj.id, { status: newStatus });
		void fetchState();
	};

	return (
		<Section
			title="Objectives"
			action={
				!showForm ? (
					<button
						onClick={() => { resetForm(); setShowForm(true); }}
						className="text-xs text-accent hover:text-accent/80 transition-colors"
					>
						+ Add
					</button>
				) : null
			}
		>
			{message && (
				<div className="text-xs text-gray-400 mb-3">{message}</div>
			)}

			{/* Create/Edit form */}
			{showForm && (
				<div className="p-3 rounded-lg bg-surface-2/80 border border-accent/20 space-y-3 mb-3">
					<input
						autoFocus
						value={title}
						onChange={(e) => setTitle(e.target.value)}
						placeholder="Objective title"
						className="w-full bg-transparent border border-white/10 rounded-lg px-3 py-2
							text-sm text-gray-200 placeholder:text-gray-600
							focus:outline-none focus:border-accent/50"
					/>
					<textarea
						value={description}
						onChange={(e) => setDescription(e.target.value)}
						placeholder="Description"
						rows={2}
						className="w-full bg-transparent border border-white/10 rounded-lg px-3 py-2
							text-sm text-gray-200 placeholder:text-gray-600
							focus:outline-none focus:border-accent/50 resize-none"
					/>
					<div className="flex gap-3">
						<div className="flex-1">
							<label className="text-xs text-gray-500 mb-1 block">Weight (0-1)</label>
							<input
								type="number"
								step="0.1"
								min="0"
								max="1"
								value={weight}
								onChange={(e) => setWeight(e.target.value)}
								className="w-full bg-transparent border border-white/10 rounded-lg px-3 py-2
									text-sm text-gray-200 font-mono
									focus:outline-none focus:border-accent/50"
							/>
						</div>
					</div>
					<div>
						<label className="text-xs text-gray-500 mb-1 block">Acceptance criteria (one per line)</label>
						<textarea
							value={criteria}
							onChange={(e) => setCriteria(e.target.value)}
							placeholder="Criterion 1&#10;Criterion 2"
							rows={3}
							className="w-full bg-transparent border border-white/10 rounded-lg px-3 py-2
								text-sm text-gray-200 placeholder:text-gray-600
								focus:outline-none focus:border-accent/50 resize-none"
						/>
					</div>
					<div className="flex gap-2">
						<button
							onClick={handleSave}
							disabled={saving || !title.trim()}
							className="px-4 py-1.5 rounded-lg bg-accent/20 text-accent text-sm font-medium
								hover:bg-accent/30 transition-colors disabled:opacity-30"
						>
							{saving ? "Saving..." : editingId ? "Update" : "Create"}
						</button>
						<button
							onClick={resetForm}
							className="px-4 py-1.5 rounded-lg bg-white/5 text-gray-400 text-sm
								hover:bg-white/10 transition-colors"
						>
							Cancel
						</button>
					</div>
				</div>
			)}

			{objectives.length === 0 && !showForm && (
				<div className="text-gray-500 text-sm">No objectives configured</div>
			)}

			{objectives.map((obj) => (
				<div
					key={obj.id}
					className="flex items-start gap-3 p-3 rounded-lg bg-surface-2/50 border border-white/5 group"
				>
					<div
						className={`mt-0.5 text-xs font-mono ${
							obj.status === "active" ? "text-emerald-400" : "text-gray-500"
						}`}
					>
						{(obj.weight * 100).toFixed(0)}%
					</div>
					<div className="flex-1 min-w-0">
						<div className="text-sm font-medium text-gray-200 truncate">
							{obj.title}
						</div>
						<div className="flex items-center gap-2 mt-1">
							<span
								className={`text-xs ${TRUTH_COLORS[obj.truthStatus] ?? "text-gray-500"}`}
							>
								{obj.truthStatus}
							</span>
							<span className="text-xs text-gray-600">
								{obj.confidence} confidence
							</span>
						</div>
					</div>
					<div className="flex items-center gap-2">
						<button
							onClick={() => handleToggleStatus(obj)}
							className={`text-xs px-2 py-0.5 rounded-full cursor-pointer transition-colors ${
								obj.status === "active"
									? "bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20"
									: "bg-gray-500/10 text-gray-500 hover:bg-gray-500/20"
							}`}
						>
							{obj.status}
						</button>
						<div className="opacity-0 group-hover:opacity-100 flex gap-1 transition-opacity">
							<button
								onClick={() => startEdit(obj)}
								className="text-xs text-gray-500 hover:text-gray-200 transition-colors"
								title="Edit"
							>
								Edit
							</button>
							<button
								onClick={() => handleDelete(obj.id)}
								className="text-xs text-gray-500 hover:text-red-400 transition-colors"
								title="Delete"
							>
								Del
							</button>
						</div>
					</div>
				</div>
			))}
		</Section>
	);
}

function Section({
	title,
	action,
	children,
}: {
	title: string;
	action?: React.ReactNode;
	children: React.ReactNode;
}) {
	return (
		<div className="bg-surface-1 rounded-xl border border-white/5 p-5">
			<div className="flex items-center justify-between mb-4">
				<h2 className="text-xs font-medium text-gray-500 uppercase tracking-wider">
					{title}
				</h2>
				{action}
			</div>
			<div className="space-y-2">{children}</div>
		</div>
	);
}
