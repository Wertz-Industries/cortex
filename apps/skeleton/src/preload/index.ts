import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("skeletonApi", {
	// State queries
	getState: () => ipcRenderer.invoke("skeleton:getState"),
	getObjectives: () => ipcRenderer.invoke("skeleton:getObjectives"),
	getTasks: () => ipcRenderer.invoke("skeleton:getTasks"),
	getCycles: () => ipcRenderer.invoke("skeleton:getCycles"),
	getScans: () => ipcRenderer.invoke("skeleton:getScans"),
	getPlans: () => ipcRenderer.invoke("skeleton:getPlans"),
	getEvals: () => ipcRenderer.invoke("skeleton:getEvals"),
	getCostSummary: () => ipcRenderer.invoke("skeleton:getCostSummary"),
	getDecisions: () => ipcRenderer.invoke("skeleton:getDecisions"),
	getExperiments: () => ipcRenderer.invoke("skeleton:getExperiments"),
	getBudgetStatus: () => ipcRenderer.invoke("skeleton:getBudgetStatus"),

	// Control commands
	trigger: (preset?: string) => ipcRenderer.invoke("skeleton:trigger", preset),
	pause: () => ipcRenderer.invoke("skeleton:pause"),
	resume: () => ipcRenderer.invoke("skeleton:resume"),
	setMode: (mode: string) => ipcRenderer.invoke("skeleton:setMode", mode),
	setKeys: (keys: { gemini?: string; openai?: string; claude?: string; grok?: string }) =>
		ipcRenderer.invoke("skeleton:setKeys", keys),
	updateConfig: (updates: Record<string, unknown>) =>
		ipcRenderer.invoke("skeleton:updateConfig", updates),
	createObjective: (data: { title: string; description: string; weight?: number; acceptanceCriteria?: string[]; tags?: string[] }) =>
		ipcRenderer.invoke("skeleton:createObjective", data),
	updateObjective: (id: string, updates: Record<string, unknown>) =>
		ipcRenderer.invoke("skeleton:updateObjective", id, updates),
	deleteObjective: (id: string) =>
		ipcRenderer.invoke("skeleton:deleteObjective", id),

	// GUI automation
	guiScreenshot: (opts?: { region?: { x: number; y: number; width: number; height: number } }) =>
		ipcRenderer.invoke("gui:screenshot", opts),
	guiClick: (x: number, y: number, button?: string) =>
		ipcRenderer.invoke("gui:click", x, y, button),
	guiType: (text: string) => ipcRenderer.invoke("gui:type", text),
	guiHotkey: (keys: string[]) => ipcRenderer.invoke("gui:hotkey", keys),
	guiMoveTo: (x: number, y: number) => ipcRenderer.invoke("gui:moveTo", x, y),
	guiScroll: (amount: number, x?: number, y?: number) =>
		ipcRenderer.invoke("gui:scroll", amount, x, y),
	guiScreenSize: () => ipcRenderer.invoke("gui:screenSize"),
	guiMousePos: () => ipcRenderer.invoke("gui:mousePos"),

	// State push from main process
	onStateUpdate: (callback: (state: unknown) => void) => {
		const handler = (_event: unknown, state: unknown) => callback(state);
		ipcRenderer.on("skeleton:stateUpdate", handler);
		return () => ipcRenderer.removeListener("skeleton:stateUpdate", handler);
	},
});
