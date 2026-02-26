"""
GUI Automation Server — JSON-RPC over stdin/stdout.

Wraps PyAutoGUI to provide mouse/keyboard/screen control.
The TypeScript adapter spawns this process and sends JSON commands.

Commands:
  screenshot    — capture screen, return base64 PNG
  click         — click at (x, y) with optional button
  doubleclick   — double-click at (x, y)
  rightclick    — right-click at (x, y)
  moveto        — move cursor to (x, y)
  type          — type text string
  hotkey        — press key combination (e.g., ["cmd", "c"])
  keydown       — hold a key
  keyup         — release a key
  scroll        — scroll at position
  locate        — find image on screen (template matching)
  mousepos      — get current mouse position
  screensize    — get screen dimensions
  drag          — drag from (x1,y1) to (x2,y2)
  alert         — show alert dialog
  confirm       — show confirm dialog
  sleep         — wait N seconds
"""

import sys
import json
import base64
import time
import io
import traceback

import pyautogui

# Safety: add a short pause between actions to prevent runaway
pyautogui.PAUSE = 0.1
# Fail-safe: move mouse to corner to abort
pyautogui.FAILSAFE = True


def handle_command(cmd: dict) -> dict:
    """Dispatch a command and return the result."""
    action = cmd.get("action", "")
    params = cmd.get("params", {})

    if action == "screenshot":
        return do_screenshot(params)
    elif action == "click":
        return do_click(params)
    elif action == "doubleclick":
        return do_doubleclick(params)
    elif action == "rightclick":
        return do_rightclick(params)
    elif action == "moveto":
        return do_moveto(params)
    elif action == "type":
        return do_type(params)
    elif action == "hotkey":
        return do_hotkey(params)
    elif action == "keydown":
        pyautogui.keyDown(params.get("key", ""))
        return {"ok": True}
    elif action == "keyup":
        pyautogui.keyUp(params.get("key", ""))
        return {"ok": True}
    elif action == "scroll":
        return do_scroll(params)
    elif action == "locate":
        return do_locate(params)
    elif action == "mousepos":
        pos = pyautogui.position()
        return {"ok": True, "x": pos.x, "y": pos.y}
    elif action == "screensize":
        size = pyautogui.size()
        return {"ok": True, "width": size.width, "height": size.height}
    elif action == "drag":
        return do_drag(params)
    elif action == "sleep":
        time.sleep(params.get("seconds", 1))
        return {"ok": True}
    elif action == "ping":
        return {"ok": True, "pong": True}
    else:
        return {"ok": False, "error": f"Unknown action: {action}"}


def do_screenshot(params: dict) -> dict:
    region = params.get("region")  # [x, y, w, h] or None
    img = pyautogui.screenshot(region=tuple(region) if region else None)

    buf = io.BytesIO()
    img.save(buf, format="PNG")
    b64 = base64.b64encode(buf.getvalue()).decode("ascii")

    return {
        "ok": True,
        "image": b64,
        "width": img.width,
        "height": img.height,
    }


def do_click(params: dict) -> dict:
    x = params.get("x")
    y = params.get("y")
    button = params.get("button", "left")
    clicks = params.get("clicks", 1)

    if x is not None and y is not None:
        pyautogui.click(x, y, button=button, clicks=clicks)
    else:
        pyautogui.click(button=button, clicks=clicks)
    return {"ok": True}


def do_doubleclick(params: dict) -> dict:
    x = params.get("x")
    y = params.get("y")
    if x is not None and y is not None:
        pyautogui.doubleClick(x, y)
    else:
        pyautogui.doubleClick()
    return {"ok": True}


def do_rightclick(params: dict) -> dict:
    x = params.get("x")
    y = params.get("y")
    if x is not None and y is not None:
        pyautogui.rightClick(x, y)
    else:
        pyautogui.rightClick()
    return {"ok": True}


def do_moveto(params: dict) -> dict:
    x = params["x"]
    y = params["y"]
    duration = params.get("duration", 0.2)
    pyautogui.moveTo(x, y, duration=duration)
    return {"ok": True}


def do_type(params: dict) -> dict:
    text = params.get("text", "")
    interval = params.get("interval", 0.02)
    pyautogui.typewrite(text, interval=interval) if params.get("raw") else pyautogui.write(text, interval=interval)
    return {"ok": True}


def do_hotkey(params: dict) -> dict:
    keys = params.get("keys", [])
    pyautogui.hotkey(*keys)
    return {"ok": True}


def do_scroll(params: dict) -> dict:
    amount = params.get("amount", 3)
    x = params.get("x")
    y = params.get("y")
    if x is not None and y is not None:
        pyautogui.scroll(amount, x, y)
    else:
        pyautogui.scroll(amount)
    return {"ok": True}


def do_locate(params: dict) -> dict:
    """Find an image on screen using template matching."""
    image_path = params.get("imagePath")
    confidence = params.get("confidence", 0.8)
    if not image_path:
        return {"ok": False, "error": "imagePath required"}

    try:
        location = pyautogui.locateOnScreen(image_path, confidence=confidence)
        if location:
            center = pyautogui.center(location)
            return {
                "ok": True,
                "found": True,
                "x": center.x,
                "y": center.y,
                "region": [location.left, location.top, location.width, location.height],
            }
        return {"ok": True, "found": False}
    except Exception as e:
        return {"ok": False, "error": str(e)}


def do_drag(params: dict) -> dict:
    x1, y1 = params["fromX"], params["fromY"]
    x2, y2 = params["toX"], params["toY"]
    duration = params.get("duration", 0.5)
    button = params.get("button", "left")
    pyautogui.moveTo(x1, y1)
    pyautogui.drag(x2 - x1, y2 - y1, duration=duration, button=button)
    return {"ok": True}


def main():
    """Read JSON commands from stdin, write JSON responses to stdout."""
    # Signal ready
    sys.stdout.write(json.dumps({"ready": True}) + "\n")
    sys.stdout.flush()

    for line in sys.stdin:
        line = line.strip()
        if not line:
            continue

        try:
            cmd = json.parse(line) if hasattr(json, 'parse') else json.loads(line)
            result = handle_command(cmd)
        except Exception as e:
            result = {"ok": False, "error": str(e), "traceback": traceback.format_exc()}

        sys.stdout.write(json.dumps(result) + "\n")
        sys.stdout.flush()


if __name__ == "__main__":
    main()
