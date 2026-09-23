import { describe, expect, it, vi } from "vitest";

import {
  COMPOSER_READY_SLOW_MS,
  ComposerReadinessWatcher,
  type ComposerReadinessScheduler,
} from "./guided-composer-readiness";

/** Deterministic clock + timer queue. */
function fakeScheduler() {
  let now = 0;
  let nextId = 1;
  const timers = new Map<number, { at: number; run: () => void }>();
  const scheduler: ComposerReadinessScheduler = {
    now: () => now,
    schedule: (run, delayMs) => {
      const id = nextId++;
      timers.set(id, { at: now + delayMs, run });
      return id;
    },
    cancel: (id) => void timers.delete(id),
  };
  const advance = (ms: number) => {
    const end = now + ms;
    for (;;) {
      const due = [...timers.entries()]
        .filter(([, t]) => t.at <= end)
        .sort((a, b) => a[1].at - b[1].at)[0];
      if (!due) break;
      timers.delete(due[0]);
      now = due[1].at;
      due[1].run();
    }
    now = end;
  };
  return { scheduler, advance, pending: () => timers.size };
}

function watch(isReady: () => boolean) {
  const clock = fakeScheduler();
  const onReady = vi.fn();
  const onSlow = vi.fn();
  const watcher = new ComposerReadinessWatcher({
    isReady,
    onReady,
    onSlow,
    scheduler: clock.scheduler,
  });
  return { ...clock, watcher, onReady, onSlow };
}

describe("ComposerReadinessWatcher", () => {
  it("fires onReady once when the composer appears during polling", () => {
    let ready = false;
    const w = watch(() => ready);
    w.advance(1_000);
    expect(w.onReady).not.toHaveBeenCalled();
    ready = true;
    w.advance(1_000);
    w.watcher.notify();
    w.advance(1_000);
    expect(w.onReady).toHaveBeenCalledTimes(1);
    expect(w.onSlow).not.toHaveBeenCalled();
    expect(w.pending()).toBe(0);
  });

  it("reports slow startup once at the deadline", () => {
    const w = watch(() => false);
    w.advance(COMPOSER_READY_SLOW_MS + 5_000);
    expect(w.onSlow).toHaveBeenCalledTimes(1);
    expect(w.onReady).not.toHaveBeenCalled();
    // Polling stops after the deadline; only PTY output re-checks.
    expect(w.pending()).toBe(0);
  });

  it("still becomes ready after the deadline when PTY output shows the composer", () => {
    // The old check gave up here, leaving Send disabled for good.
    let ready = false;
    const w = watch(() => ready);
    w.advance(COMPOSER_READY_SLOW_MS + 1_000);
    expect(w.onSlow).toHaveBeenCalledTimes(1);
    ready = true;
    w.watcher.notify();
    w.advance(0);
    expect(w.onReady).toHaveBeenCalledTimes(1);
  });

  it("coalesces bursts of PTY output into one check", () => {
    const isReady = vi.fn(() => false);
    const w = watch(isReady);
    w.advance(COMPOSER_READY_SLOW_MS + 1_000);
    isReady.mockClear();
    for (let i = 0; i < 50; i += 1) w.watcher.notify();
    w.advance(0);
    expect(isReady).toHaveBeenCalledTimes(1);
  });

  it("never calls back after dispose", () => {
    let ready = false;
    const w = watch(() => ready);
    w.watcher.dispose();
    ready = true;
    w.watcher.notify();
    w.advance(COMPOSER_READY_SLOW_MS * 2);
    expect(w.onReady).not.toHaveBeenCalled();
    expect(w.onSlow).not.toHaveBeenCalled();
    expect(w.pending()).toBe(0);
  });
});
