/**
 * GUI Automation Adapter — TypeScript interface to the PyAutoGUI server.
 *
 * Spawns a Python subprocess running gui-server.py and communicates
 * via JSON over stdin/stdout. Provides typed methods for all GUI actions.
 */

import { spawn, execSync, type ChildProcess } from "node:child_process";
import path from "node:path";
import readline from "node:readline";

export type ScreenshotResult = {
  image: string; // base64 PNG
  width: number;
  height: number;
};

export type LocateResult = {
  found: boolean;
  x?: number;
  y?: number;
  region?: [number, number, number, number];
};

export type GuiCommandResult = {
  ok: boolean;
  error?: string;
  [key: string]: unknown;
};

export class GuiAdapter {
  private process: ChildProcess | null = null;
  private rl: readline.Interface | null = null;
  private ready = false;
  private pending: Array<{
    resolve: (value: GuiCommandResult) => void;
    reject: (error: Error) => void;
  }> = [];
  private pythonBin: string;
  private serverScript: string;

  constructor(opts?: { pythonBin?: string }) {
    this.pythonBin = opts?.pythonBin ?? GuiAdapter.findPython();
    this.serverScript = path.join(path.dirname(new URL(import.meta.url).pathname), "gui-server.py");
  }

  /** Find a Python binary that has pyautogui installed. */
  private static findPython(): string {
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
        return bin;
      } catch {
        continue;
      }
    }
    return "python3"; // fallback
  }

  /** Start the Python GUI server process. */
  async start(): Promise<void> {
    if (this.process) return;

    return new Promise((resolve, reject) => {
      this.process = spawn(this.pythonBin, [this.serverScript], {
        stdio: ["pipe", "pipe", "pipe"],
        env: { ...process.env },
      });

      this.rl = readline.createInterface({
        input: this.process.stdout!,
      });

      let started = false;

      this.rl.on("line", (line) => {
        let data: GuiCommandResult;
        try {
          data = JSON.parse(line);
        } catch {
          return; // skip non-JSON output
        }

        if (!started && (data as any).ready) {
          started = true;
          this.ready = true;
          resolve();
          return;
        }

        const pending = this.pending.shift();
        if (pending) {
          pending.resolve(data);
        }
      });

      this.process.stderr!.on("data", (chunk) => {
        const msg = chunk.toString();
        // Log stderr but don't fail — PyAutoGUI can be noisy
        if (msg.includes("Error") || msg.includes("Traceback")) {
          console.error("[gui-adapter]", msg);
        }
      });

      this.process.on("exit", (code) => {
        this.ready = false;
        this.process = null;
        // Reject all pending
        for (const p of this.pending) {
          p.reject(new Error(`GUI server exited with code ${code}`));
        }
        this.pending = [];
        if (!started) {
          reject(new Error(`GUI server failed to start (exit code ${code})`));
        }
      });

      // Timeout
      setTimeout(() => {
        if (!started) {
          this.stop();
          reject(new Error("GUI server startup timed out"));
        }
      }, 10_000);
    });
  }

  /** Stop the Python process. */
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

  /** Send a command and wait for the response. */
  private send(action: string, params: Record<string, unknown> = {}): Promise<GuiCommandResult> {
    if (!this.process || !this.ready) {
      return Promise.reject(new Error("GUI server not running"));
    }

    return new Promise((resolve, reject) => {
      this.pending.push({ resolve, reject });
      const msg = JSON.stringify({ action, params }) + "\n";
      this.process!.stdin!.write(msg);
    });
  }

  // ─── Public API ───────────────────────────────────────

  async ping(): Promise<boolean> {
    const r = await this.send("ping");
    return r.ok;
  }

  async screenshot(region?: {
    x: number;
    y: number;
    width: number;
    height: number;
  }): Promise<ScreenshotResult> {
    const params: Record<string, unknown> = {};
    if (region) {
      params.region = [region.x, region.y, region.width, region.height];
    }
    const r = await this.send("screenshot", params);
    return {
      image: r.image as string,
      width: r.width as number,
      height: r.height as number,
    };
  }

  async click(
    x: number,
    y: number,
    opts?: { button?: "left" | "right" | "middle"; clicks?: number },
  ): Promise<void> {
    await this.send("click", { x, y, ...opts });
  }

  async doubleClick(x: number, y: number): Promise<void> {
    await this.send("doubleclick", { x, y });
  }

  async rightClick(x: number, y: number): Promise<void> {
    await this.send("rightclick", { x, y });
  }

  async moveTo(x: number, y: number, duration = 0.2): Promise<void> {
    await this.send("moveto", { x, y, duration });
  }

  async type(text: string, interval = 0.02): Promise<void> {
    await this.send("type", { text, interval });
  }

  async hotkey(...keys: string[]): Promise<void> {
    await this.send("hotkey", { keys });
  }

  async keyDown(key: string): Promise<void> {
    await this.send("keydown", { key });
  }

  async keyUp(key: string): Promise<void> {
    await this.send("keyup", { key });
  }

  async scroll(amount: number, x?: number, y?: number): Promise<void> {
    await this.send("scroll", { amount, x, y });
  }

  async locate(imagePath: string, confidence = 0.8): Promise<LocateResult> {
    const r = await this.send("locate", { imagePath, confidence });
    return {
      found: r.found as boolean,
      x: r.x as number | undefined,
      y: r.y as number | undefined,
      region: r.region as [number, number, number, number] | undefined,
    };
  }

  async mousePosition(): Promise<{ x: number; y: number }> {
    const r = await this.send("mousepos");
    return { x: r.x as number, y: r.y as number };
  }

  async screenSize(): Promise<{ width: number; height: number }> {
    const r = await this.send("screensize");
    return { width: r.width as number, height: r.height as number };
  }

  async drag(
    fromX: number,
    fromY: number,
    toX: number,
    toY: number,
    opts?: { duration?: number; button?: string },
  ): Promise<void> {
    await this.send("drag", { fromX, fromY, toX, toY, ...opts });
  }

  async sleep(seconds: number): Promise<void> {
    await this.send("sleep", { seconds });
  }
}
