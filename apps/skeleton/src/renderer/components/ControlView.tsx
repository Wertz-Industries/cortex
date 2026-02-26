import { useCallback, useEffect, useRef, useState } from "react";
import {
	Camera,
	MousePointer,
	Type,
	Monitor,
	Play,
	Pause,
} from "lucide-react";

type MouseCoords = { x: number; y: number };
type ScreenDims = { width: number; height: number };

export function ControlView() {
	const [screenshot, setScreenshot] = useState<string | null>(null);
	const [screenSize, setScreenSize] = useState<ScreenDims | null>(null);
	const [mousePos, setMousePos] = useState<MouseCoords | null>(null);
	const [loading, setLoading] = useState(false);
	const [autoRefresh, setAutoRefresh] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [typeText, setTypeText] = useState("");
	const [hotkeyText, setHotkeyText] = useState("");
	const [lastAction, setLastAction] = useState<string | null>(null);
	const imgRef = useRef<HTMLImageElement>(null);
	const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

	const capture = useCallback(async () => {
		setLoading(true);
		setError(null);
		try {
			const result = await window.skeletonApi.guiScreenshot();
			if (result.ok && result.image) {
				setScreenshot(result.image);
				if (result.width && result.height) {
					setScreenSize({ width: result.width, height: result.height });
				}
			} else {
				setError(result.error ?? "Screenshot failed");
			}
		} catch (err) {
			setError(err instanceof Error ? err.message : "Failed to capture");
		}
		setLoading(false);
	}, []);

	const fetchMousePos = async () => {
		try {
			const r = await window.skeletonApi.guiMousePos();
			if (r.ok && r.x != null && r.y != null) {
				setMousePos({ x: r.x, y: r.y });
			}
		} catch {
			// ignore
		}
	};

	// Auto-refresh loop
	useEffect(() => {
		if (autoRefresh) {
			void capture();
			intervalRef.current = setInterval(() => {
				void capture();
				void fetchMousePos();
			}, 2000);
		} else {
			if (intervalRef.current) {
				clearInterval(intervalRef.current);
				intervalRef.current = null;
			}
		}
		return () => {
			if (intervalRef.current) {clearInterval(intervalRef.current);}
		};
	}, [autoRefresh, capture]);

	// Initial capture
	useEffect(() => {
		void capture();
		void fetchMousePos();
		void window.skeletonApi.guiScreenSize().then((r) => {
			if (r.ok && r.width && r.height) {
				setScreenSize({ width: r.width, height: r.height });
			}
		});
	}, [capture]);

	const handleImageClick = async (e: React.MouseEvent<HTMLImageElement>) => {
		if (!imgRef.current || !screenSize) {return;}

		const rect = imgRef.current.getBoundingClientRect();
		const scaleX = screenSize.width / rect.width;
		const scaleY = screenSize.height / rect.height;
		const x = Math.round((e.clientX - rect.left) * scaleX);
		const y = Math.round((e.clientY - rect.top) * scaleY);

		setLastAction(`Click at (${x}, ${y})`);
		await window.skeletonApi.guiClick(x, y);

		// Refresh after click
		setTimeout(capture, 300);
	};

	const handleType = async () => {
		if (!typeText) {return;}
		setLastAction(`Typed: ${typeText}`);
		await window.skeletonApi.guiType(typeText);
		setTypeText("");
		setTimeout(capture, 300);
	};

	const handleHotkey = async () => {
		if (!hotkeyText) {return;}
		const keys = hotkeyText.split("+").map((k) => k.trim().toLowerCase());
		setLastAction(`Hotkey: ${keys.join("+")}`);
		await window.skeletonApi.guiHotkey(keys);
		setHotkeyText("");
		setTimeout(capture, 300);
	};

	const handleScroll = async (amount: number) => {
		setLastAction(`Scroll ${amount > 0 ? "up" : "down"}`);
		await window.skeletonApi.guiScroll(amount);
		setTimeout(capture, 300);
	};

	return (
		<div className="space-y-4 max-w-6xl mx-auto">
			{/* Toolbar */}
			<div className="flex items-center gap-3 flex-wrap">
				<button
					onClick={capture}
					disabled={loading}
					className="no-drag flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-accent hover:bg-accent-bright text-white text-sm font-medium transition-colors disabled:opacity-50"
				>
					<Camera size={14} />
					{loading ? "Capturing..." : "Capture"}
				</button>

				<button
					onClick={() => setAutoRefresh(!autoRefresh)}
					className={`no-drag flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
						autoRefresh
							? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
							: "bg-surface-2 text-gray-400 hover:text-gray-200 border border-white/10"
					}`}
				>
					{autoRefresh ? <Pause size={14} /> : <Play size={14} />}
					{autoRefresh ? "Live" : "Auto"}
				</button>

				<div className="h-5 w-px bg-white/10" />

				{/* Type input */}
				<div className="flex items-center gap-1">
					<Type size={14} className="text-gray-500" />
					<input
						type="text"
						value={typeText}
						onChange={(e) => setTypeText(e.target.value)}
						onKeyDown={(e) => e.key === "Enter" && handleType()}
						placeholder="Type text..."
						className="no-drag w-32 px-2 py-1 rounded bg-surface-2 border border-white/10 text-sm text-gray-300 placeholder-gray-600 focus:outline-none focus:border-accent/50"
					/>
					<button
						onClick={handleType}
						disabled={!typeText}
						className="no-drag px-2 py-1 rounded bg-surface-2 hover:bg-surface-3 text-gray-400 text-xs border border-white/10 disabled:opacity-30"
					>
						Send
					</button>
				</div>

				<div className="h-5 w-px bg-white/10" />

				{/* Hotkey input */}
				<div className="flex items-center gap-1">
					<input
						type="text"
						value={hotkeyText}
						onChange={(e) => setHotkeyText(e.target.value)}
						onKeyDown={(e) => e.key === "Enter" && handleHotkey()}
						placeholder="cmd+c"
						className="no-drag w-24 px-2 py-1 rounded bg-surface-2 border border-white/10 text-sm text-gray-300 placeholder-gray-600 focus:outline-none focus:border-accent/50"
					/>
					<button
						onClick={handleHotkey}
						disabled={!hotkeyText}
						className="no-drag px-2 py-1 rounded bg-surface-2 hover:bg-surface-3 text-gray-400 text-xs border border-white/10 disabled:opacity-30"
					>
						Key
					</button>
				</div>

				<div className="h-5 w-px bg-white/10" />

				{/* Scroll */}
				<div className="flex items-center gap-1">
					<button
						onClick={() => handleScroll(3)}
						className="no-drag px-2 py-1 rounded bg-surface-2 hover:bg-surface-3 text-gray-400 text-xs border border-white/10"
					>
						Scroll Up
					</button>
					<button
						onClick={() => handleScroll(-3)}
						className="no-drag px-2 py-1 rounded bg-surface-2 hover:bg-surface-3 text-gray-400 text-xs border border-white/10"
					>
						Scroll Down
					</button>
				</div>

				<div className="flex-1" />

				{/* Status */}
				<div className="flex items-center gap-3 text-xs text-gray-500">
					{mousePos && (
						<span className="flex items-center gap-1">
							<MousePointer size={12} />
							({mousePos.x}, {mousePos.y})
						</span>
					)}
					{screenSize && (
						<span className="flex items-center gap-1">
							<Monitor size={12} />
							{screenSize.width}x{screenSize.height}
						</span>
					)}
				</div>
			</div>

			{/* Last action feedback */}
			{lastAction && (
				<div className="text-xs text-gray-500 animate-fade-in">
					{lastAction}
				</div>
			)}

			{/* Error */}
			{error && (
				<div className="text-sm text-red-400 bg-red-500/10 rounded-lg p-3 border border-red-500/20">
					{error}
				</div>
			)}

			{/* Screenshot viewer */}
			{screenshot ? (
				<div className="bg-surface-1 rounded-xl border border-white/5 overflow-hidden">
					<img
						ref={imgRef}
						src={`data:image/png;base64,${screenshot}`}
						alt="Screen capture"
						onClick={handleImageClick}
						className="w-full cursor-crosshair"
						draggable={false}
					/>
				</div>
			) : !loading && !error ? (
				<div className="bg-surface-1 rounded-xl border border-white/5 p-16 text-center">
					<Camera size={48} className="mx-auto text-gray-700 mb-4" />
					<div className="text-gray-500 text-sm">
						Click Capture to take a screenshot
					</div>
					<div className="text-gray-600 text-xs mt-1">
						Click on the image to interact with your desktop
					</div>
				</div>
			) : null}
		</div>
	);
}
