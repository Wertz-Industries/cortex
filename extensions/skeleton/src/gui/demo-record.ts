import { spawn, execSync, type ChildProcess } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
/**
 * GUI Demo — records screen including the Messages part, then attaches and sends.
 */
import { GuiAdapter } from "./gui-adapter.js";

const gui = new GuiAdapter();
const VIDEO_PATH = path.join(process.env.HOME!, "Desktop", "gui-demo.mov");

async function startRecording(): Promise<ChildProcess> {
  try {
    fs.unlinkSync(VIDEO_PATH);
  } catch {}

  console.log("Starting screen recording...");
  const proc = spawn(
    "ffmpeg",
    [
      "-y",
      "-f",
      "avfoundation",
      "-capture_cursor",
      "1",
      "-framerate",
      "30",
      "-i",
      "0:none",
      "-c:v",
      "libx264",
      "-preset",
      "ultrafast",
      "-pix_fmt",
      "yuv420p",
      VIDEO_PATH,
    ],
    { stdio: ["pipe", "pipe", "pipe"] },
  );

  for (let i = 0; i < 20; i++) {
    await new Promise((r) => setTimeout(r, 250));
    if (fs.existsSync(VIDEO_PATH) && fs.statSync(VIDEO_PATH).size > 0) break;
  }
  console.log("Recording confirmed active.");
  await new Promise((r) => setTimeout(r, 500));
  return proc;
}

async function stopRecording(proc: ChildProcess): Promise<void> {
  console.log("Stopping recording...");
  proc.stdin!.write("q");
  await new Promise<void>((resolve) => {
    proc.on("close", () => resolve());
    setTimeout(resolve, 5000);
  });
  const stat = fs.statSync(VIDEO_PATH);
  console.log(`Recording saved: ${VIDEO_PATH} (${(stat.size / 1024 / 1024).toFixed(1)} MB)`);
}

async function activate(appName: string) {
  console.log(`Activating ${appName}...`);
  execSync(`open -a "${appName}"`);
  await gui.sleep(0.5);
  execSync(`osascript -e 'tell application "${appName}" to activate'`);
  await gui.sleep(1);
}

async function closeApp() {
  await gui.hotkey("command", "q");
  await gui.sleep(1);
}

function getMessagesWindowBounds(): { x: number; y: number; w: number; h: number } {
  try {
    const bounds = execSync(
      `osascript -e 'tell application "System Events" to tell process "Messages" to get {position, size} of window 1'`,
    )
      .toString()
      .trim();
    const nums = bounds.match(/\d+/g)!.map(Number);
    return { x: nums[0], y: nums[1], w: nums[2], h: nums[3] };
  } catch {
    return { x: 20, y: 30, w: 1504, h: 790 };
  }
}

function getMessagesInputCoords(): { x: number; y: number } {
  const win = getMessagesWindowBounds();
  return { x: win.x + Math.round(win.w / 2), y: win.y + win.h - 40 };
}

async function main() {
  await gui.start();
  console.log("GUI server ready");

  // ── Start recording (stays on through Messages part) ─
  const recorder = await startRecording();

  // ── Visible demo actions ─────────────────────────────
  await activate("Calculator");
  await gui.type("42069", 0.1);
  await gui.sleep(1);
  await closeApp();

  await activate("TextEdit");
  await gui.sleep(1);
  await closeApp();

  const cx = 1504,
    cy = 846;
  console.log("Drawing cursor square...");
  await gui.moveTo(cx - 200, cy - 200, 0.3);
  await gui.moveTo(cx + 200, cy - 200, 0.3);
  await gui.moveTo(cx + 200, cy + 200, 0.3);
  await gui.moveTo(cx - 200, cy + 200, 0.3);
  await gui.moveTo(cx - 200, cy - 200, 0.3);
  await gui.sleep(0.5);

  // ── Open Messages and navigate to chat (still recording!) ──
  await activate("Messages");
  await gui.sleep(1);

  // Get window position for precise clicking
  const input = getMessagesInputCoords();
  const win = getMessagesWindowBounds();
  console.log(`Messages window: ${win.x},${win.y} ${win.w}x${win.h}`);

  // Click the search field at the top of the sidebar
  const searchX = win.x + 175;
  const searchY = win.y + 70;
  console.log(`Clicking search field at ${searchX},${searchY}...`);
  await gui.click(searchX, searchY);
  await gui.sleep(0.5);
  await gui.hotkey("command", "a");
  await gui.sleep(0.2);
  await gui.type("Wertz Badlands", 0.04);
  await gui.sleep(1.5);

  // Click the first search result in the sidebar (below the search field)
  const resultX = win.x + 175;
  const resultY = win.y + 160;
  console.log(`Clicking search result at ${resultX},${resultY}...`);
  await gui.click(resultX, resultY);
  await gui.sleep(1);

  // Escape to clear search text but keep chat selected
  await gui.hotkey("escape");
  await gui.sleep(0.5);

  // Click message input field at the bottom of the window
  console.log(`Clicking message input at ${input.x},${input.y}...`);
  await gui.click(input.x, input.y);
  await gui.sleep(0.5);

  // Type the message (slower to avoid misspelling)
  console.log("Typing message...");
  await gui.type("Jarvis just automated my whole screen, check this out", 0.04);
  await gui.sleep(1);

  // ── NOW stop recording ───────────────────────────────
  await stopRecording(recorder);
  await gui.sleep(1);

  // ── Attach the video and send ────────────────────────
  console.log("Attaching video...");
  execSync(
    `osascript -e 'set theFile to POSIX file "${VIDEO_PATH}"' -e 'tell application "Finder" to set the clipboard to theFile'`,
  );
  await gui.sleep(0.5);

  // Re-focus Messages and click input before pasting
  execSync(`osascript -e 'tell application "Messages" to activate'`);
  await gui.sleep(0.5);
  await gui.click(input.x, input.y);
  await gui.sleep(0.3);

  await gui.hotkey("command", "v");
  await gui.sleep(3);

  // Send
  console.log("Sending...");
  await gui.hotkey("return");
  await gui.sleep(2);

  console.log("Done!");
  gui.stop();
}

main().catch((err) => {
  console.error(err);
  gui.stop();
  process.exit(1);
});
