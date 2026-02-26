/**
 * GUI Controller for Electron main process.
 * Spawns the PyAutoGUI server and provides typed methods.
 * Lazy-starts on first use, auto-detects Python binary.
 */

import { spawn, execSync, type ChildProcess } from "node:child_process";
import path from "node:path";
import readline from "node:readline";

declare const __dirname: string;

type GuiResult = { ok: boolean; error?: string; [key: string]: unknown };

export class GuiController {
	private process: ChildProcess | null = null;
	private rl: readline.Interface | null = null;
	private ready = false;
	private pending: Array<{
		resolve: (value: GuiResult) => void;
		reject: (error: Error) => void;
	}> = [];
	private pythonBin: string | null = null;
	private serverScript: string;

	constructor() {
		// The gui-server.py lives in the skeleton extension source
		this.serverScript = path.join(
			process.env.HOME ?? "",
			"cortex/extensions/skeleton/src/gui/gui-server.py",
		);
	}

	private findPython(): string {
		if (this.pythonBin) {return this.pythonBin;}

		const candidates = [
			process.env.PYTHON_BIN,
			"/opt/anaconda3/bin/python3",
			"/opt/homebrew/bin/python3",
			"/usr/local/bin/python3",
			"python3",
		].filter(Boolean) as string[];

		for (const bin of candidates) {
			try {
				execSync(`${bin} -c "import pyautogui"`, {
					stdio: "ignore",
					timeout: 5000,
				});
				this.pythonBin = bin;
				return bin;
			} catch {
				continue;
			}
		}
		this.pythonBin = "python3";
		return "python3";
	}

	private async ensureStarted(): Promise<void> {
		if (this.process && this.ready) {return;}

		const python = this.findPython();

		return new Promise((resolve, reject) => {
			this.process = spawn(python, [this.serverScript], {
				stdio: ["pipe", "pipe", "pipe"],
				env: { ...process.env },
			});

			this.rl = readline.createInterface({
				input: this.process.stdout!,
			});

			let started = false;

			this.rl.on("line", (line) => {
				let data: GuiResult;
				try {
					data = JSON.parse(line);
				} catch {
					return;
				}

				if (!started && (data as unknown as { ready?: boolean }).ready) {
					started = true;
					this.ready = true;
					resolve();
					return;
				}

				const p = this.pending.shift();
				if (p) {p.resolve(data);}
			});

			this.process.stderr!.on("data", () => {
				// suppress stderr noise
			});

			this.process.on("exit", () => {
				this.ready = false;
				this.process = null;
				for (const p of this.pending) {
					p.reject(new Error("GUI server exited"));
				}
				this.pending = [];
				if (!started) {reject(new Error("GUI server failed to start"));}
			});

			setTimeout(() => {
				if (!started) {
					this.stop();
					reject(new Error("GUI server startup timed out"));
				}
			}, 10_000);
		});
	}

	private async send(action: string, params: Record<string, unknown> = {}): Promise<GuiResult> {
		await this.ensureStarted();
		return new Promise((resolve, reject) => {
			this.pending.push({ resolve, reject });
			this.process!.stdin!.write(JSON.stringify({ action, params }) + "\n");
		});
	}

	stop(): void {
		if (this.process) {
			this.process.kill();
			this.process = null;
		}
		if (this.rl) {
			this.rl.close();
			this.rl = null;
		}
		this.ready = false;
	}

	// ── Public API ───────────────────────────────────────────

	async screenshot(region?: { x: number; y: number; width: number; height: number }) {
		const params: Record<string, unknown> = {};
		if (region) {params.region = [region.x, region.y, region.width, region.height];}
		return this.send("screenshot", params);
	}

	async click(x: number, y: number, button = "left") {
		return this.send("click", { x, y, button });
	}

	async type(text: string) {
		return this.send("type", { text });
	}

	async hotkey(keys: string[]) {
		return this.send("hotkey", { keys });
	}

	async moveTo(x: number, y: number) {
		return this.send("moveto", { x, y });
	}

	async scroll(amount: number, x?: number, y?: number) {
		return this.send("scroll", { amount, x, y });
	}

	async screenSize() {
		return this.send("screensize");
	}

	async mousePos() {
		return this.send("mousepos");
	}
}
