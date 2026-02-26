/**
 * In-process timer scheduler for cycle management.
 * NOT a cron job — manages timers within the Node.js process.
 */
export class Scheduler {
  private timer: ReturnType<typeof setTimeout> | null = null;
  private callback: (() => void) | null = null;
  private _scheduledAt: Date | null = null;

  /** Schedule the next cycle trigger after `delayMs` milliseconds. */
  schedule(delayMs: number, callback: () => void): Date {
    this.cancel();
    this.callback = callback;
    this._scheduledAt = new Date(Date.now() + delayMs);
    this.timer = setTimeout(() => {
      this.timer = null;
      this._scheduledAt = null;
      callback();
    }, delayMs);
    // Don't block Node exit
    this.timer.unref?.();
    return this._scheduledAt;
  }

  /** Cancel any pending scheduled cycle. */
  cancel(): void {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    this._scheduledAt = null;
    this.callback = null;
  }

  /** When the next cycle is scheduled for, or null if idle. */
  get scheduledAt(): Date | null {
    return this._scheduledAt;
  }

  /** Whether a cycle is currently scheduled. */
  get isScheduled(): boolean {
    return this.timer !== null;
  }
}
