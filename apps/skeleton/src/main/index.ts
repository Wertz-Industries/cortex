import { app, BrowserWindow, ipcMain, shell } from "electron";
import path from "node:path";
import { SkeletonStateReader } from "./state-reader.js";
import { GuiController } from "./gui-controller.js";

// __dirname provided by esbuild banner for ESM compatibility
declare const __dirname: string;

let mainWindow: BrowserWindow | null = null;
let stateReader: SkeletonStateReader | null = null;
let guiController: GuiController | null = null;

function createWindow() {
	mainWindow = new BrowserWindow({
		width: 1200,
		height: 800,
		minWidth: 900,
		minHeight: 600,
		title: "Skeleton — Autonomous Studio",
		titleBarStyle: "hiddenInset",
		backgroundColor: "#0a0a0f",
		webPreferences: {
			preload: path.join(__dirname, "../preload/index.js"),
			contextIsolation: true,
			nodeIntegration: false,
			sandbox: false,
		},
	});

	// Dev or production
	if (process.env.ELECTRON_RENDERER_URL) {
		void mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL);
	} else {
		void mainWindow.loadFile(path.join(__dirname, "../renderer/index.html"));
	}

	mainWindow.on("closed", () => {
		mainWindow = null;
	});

	// Open external links in browser
	mainWindow.webContents.setWindowOpenHandler(({ url }) => {
		void shell.openExternal(url);
		return { action: "deny" };
	});
}

function setupIpc() {
	const stateDir = path.join(
		process.env.HOME ?? process.env.USERPROFILE ?? "",
		".cortex",
	);
	stateReader = new SkeletonStateReader(stateDir);

	ipcMain.handle("skeleton:getState", async () => {
		return stateReader!.getFullState();
	});

	ipcMain.handle("skeleton:getObjectives", async () => {
		return stateReader!.getObjectives();
	});

	ipcMain.handle("skeleton:getTasks", async () => {
		return stateReader!.getTasks();
	});

	ipcMain.handle("skeleton:getCycles", async () => {
		return stateReader!.getCycles();
	});

	ipcMain.handle("skeleton:getScans", async () => {
		return stateReader!.getScans();
	});

	ipcMain.handle("skeleton:getPlans", async () => {
		return stateReader!.getPlans();
	});

	ipcMain.handle("skeleton:getEvals", async () => {
		return stateReader!.getEvals();
	});

	ipcMain.handle("skeleton:getCostSummary", async () => {
		return stateReader!.getCostSummary();
	});

	ipcMain.handle("skeleton:getDecisions", async () => {
		return stateReader!.getDecisions();
	});

	ipcMain.handle("skeleton:getExperiments", async () => {
		return stateReader!.getExperiments();
	});

	ipcMain.handle("skeleton:getBudgetStatus", async () => {
		return stateReader!.getBudgetStatus();
	});

	// Control commands — spawn CLI
	ipcMain.handle("skeleton:trigger", async (_event, preset?: string) => {
		return stateReader!.runCommand("trigger", preset ? ["--preset", preset] : []);
	});

	ipcMain.handle("skeleton:pause", async () => {
		return stateReader!.runCommand("pause");
	});

	ipcMain.handle("skeleton:resume", async () => {
		return stateReader!.runCommand("resume");
	});

	ipcMain.handle("skeleton:setMode", async (_event, mode: string) => {
		return stateReader!.runCommand("mode", [mode]);
	});

	ipcMain.handle("skeleton:setKeys", async (_event, keys: { gemini?: string; openai?: string; claude?: string; grok?: string }) => {
		// CLI handles gemini/openai/claude; grok goes directly to config
		const args: string[] = [];
		if (keys.gemini) {args.push("--gemini", keys.gemini);}
		if (keys.openai) {args.push("--openai", keys.openai);}
		if (keys.claude) {args.push("--claude", keys.claude);}
		if (args.length > 0) {
			const result = await stateReader!.runCommand("keys", args);
			if (!result.ok) {return result;}
		}
		// Handle grok key directly via config write
		if (keys.grok) {
			await stateReader!.updateConfig({ grokApiKey: keys.grok });
		}
		if (args.length === 0 && !keys.grok) {return { ok: false, output: "No keys provided" };}
		return { ok: true, output: "Keys saved" };
	});

	ipcMain.handle("skeleton:updateConfig", async (_event, updates: Record<string, unknown>) => {
		return stateReader!.updateConfig(updates);
	});

	ipcMain.handle("skeleton:createObjective", async (_event, data: { title: string; description: string; weight?: number; acceptanceCriteria?: string[]; tags?: string[] }) => {
		return stateReader!.createObjective(data);
	});

	ipcMain.handle("skeleton:updateObjective", async (_event, id: string, updates: Record<string, unknown>) => {
		return stateReader!.updateObjective(id, updates);
	});

	ipcMain.handle("skeleton:deleteObjective", async (_event, id: string) => {
		return stateReader!.deleteObjective(id);
	});

	// ── GUI Automation ──────────────────────────────────────────
	guiController = new GuiController();

	ipcMain.handle("gui:screenshot", async (_event, opts?: { region?: { x: number; y: number; width: number; height: number } }) => {
		return guiController!.screenshot(opts?.region);
	});

	ipcMain.handle("gui:click", async (_event, x: number, y: number, button?: string) => {
		return guiController!.click(x, y, button);
	});

	ipcMain.handle("gui:type", async (_event, text: string) => {
		return guiController!.type(text);
	});

	ipcMain.handle("gui:hotkey", async (_event, keys: string[]) => {
		return guiController!.hotkey(keys);
	});

	ipcMain.handle("gui:moveTo", async (_event, x: number, y: number) => {
		return guiController!.moveTo(x, y);
	});

	ipcMain.handle("gui:scroll", async (_event, amount: number, x?: number, y?: number) => {
		return guiController!.scroll(amount, x, y);
	});

	ipcMain.handle("gui:screenSize", async () => {
		return guiController!.screenSize();
	});

	ipcMain.handle("gui:mousePos", async () => {
		return guiController!.mousePos();
	});
}

void app.whenReady().then(() => {
	setupIpc();
	createWindow();

	// Poll state every 2 seconds and push to renderer
	setInterval(async () => {
		if (mainWindow && stateReader) {
			try {
				const state = await stateReader.getFullState();
				mainWindow.webContents.send("skeleton:stateUpdate", state);
			} catch {
				// Ignore read errors
			}
		}
	}, 2000);
});

app.on("window-all-closed", () => {
	guiController?.stop();
	app.quit();
});

app.on("activate", () => {
	if (mainWindow === null) {createWindow();}
});
