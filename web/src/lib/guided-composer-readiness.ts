/**
 * Watches the embedded terminal until the TUI composer is ready for input.
 *
 * The guided chat's Send button stays disabled until the composer appears.
 * The old check polled for a fixed 15 seconds after the socket opened and
 * then stopped silently: a slow boot, a long resumed transcript, or a
 * keep-alive reattach whose screen was not repainted in time left the button
 * disabled for good with no explanation.
 *
 * This watcher polls until the deadline and then keeps listening: every PTY
 * output frame calls {@link ComposerReadinessWatcher.notify}, so the composer
 * becomes usable whenever it finally appears. The deadline only tells the
 * user something is slow; it never ends the watch.
 */

/** How long to poll before telling the user startup is slow. */
export const COMPOSER_READY_SLOW_MS = 15_000;
/** Poll interval before the deadline. */
export const COMPOSER_READY_POLL_MS = 250;

export interface ComposerReadinessScheduler {
  schedule: (run: () => void, delayMs: number) => number;
  cancel: (handle: number) => void;
  now: () => number;
}

export interface ComposerReadinessOptions {
  /** True when the composer prompt is visible and accepting input. */
  isReady: () => boolean;
  /** Called once, the first time the composer is ready. */
  onReady: () => void;
  /** Called once if the composer is still not ready at the deadline. */
  onSlow: () => void;
  scheduler: ComposerReadinessScheduler;
  slowAfterMs?: number;
  pollMs?: number;
  /** Delay before the first check (lets the first paint land). */
  initialDelayMs?: number;
}

export class ComposerReadinessWatcher {
  private readonly options: ComposerReadinessOptions;
  private readonly deadline: number;
  private timer: number | null = null;
  private notifyPending = false;
  private done = false;
  private slowReported = false;

  constructor(options: ComposerReadinessOptions) {
    this.options = options;
    this.deadline =
      options.scheduler.now() + (options.slowAfterMs ?? COMPOSER_READY_SLOW_MS);
    this.poll(options.initialDelayMs ?? 100);
  }

  /** PTY output arrived; re-check soon (coalesced to one pending check). */
  notify(): void {
    if (this.done || this.notifyPending) return;
    this.notifyPending = true;
    this.options.scheduler.schedule(() => {
      this.notifyPending = false;
      this.check();
    }, 0);
  }

  /** Stop watching; no callback fires afterwards. */
  dispose(): void {
    this.done = true;
    this.clearTimer();
  }

  private poll(delayMs: number): void {
    this.clearTimer();
    this.timer = this.options.scheduler.schedule(() => {
      this.timer = null;
      if (this.check()) return;
      if (this.options.scheduler.now() < this.deadline) {
        this.poll(this.options.pollMs ?? COMPOSER_READY_POLL_MS);
      } else {
        this.reportSlow();
      }
    }, delayMs);
  }

  private check(): boolean {
    if (this.done) return true;
    if (!this.options.isReady()) return false;
    this.done = true;
    this.clearTimer();
    this.options.onReady();
    return true;
  }

  private reportSlow(): void {
    if (this.slowReported || this.done) return;
    this.slowReported = true;
    this.options.onSlow();
  }

  private clearTimer(): void {
    if (this.timer === null) return;
    this.options.scheduler.cancel(this.timer);
    this.timer = null;
  }
}
