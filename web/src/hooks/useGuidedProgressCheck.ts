import { useEffect, useRef } from "react";

export const GUIDED_PROGRESS_INTERVAL_MS = 5 * 60_000;
export const GUIDED_PROGRESS_REQUEST =
  "Update me on the current project. Briefly explain what the agents are doing, what now works, what remains, and any recorded blocker. Check existing project status only; do not start, retry, change, or approve work.";

export interface GuidedProgressCheckOptions {
  workspace: string;
  enabled: boolean;
  active: boolean;
  canSend: () => boolean;
  submit: () => boolean;
}

/** One optional status turn through the normal composer, never a mid-turn steer. */
export function useGuidedProgressCheck(options: GuidedProgressCheckOptions): void {
  const current = useRef(options);
  const activity = useRef({ workspace: "", active: false });
  useEffect(() => { current.current = options; });
  const { workspace, enabled, active } = options;
  useEffect(() => {
    if (!enabled || !workspace) return;
    const starting = activity.current.workspace === workspace && !activity.current.active && active;
    activity.current = { workspace, active };
    if (!active) return;
    const key = `idrak-it.guided-progress-check.v1:${workspace}`;
    let cancelled = false;
    let pending = false;
    let nextAt = Date.now() + GUIDED_PROGRESS_INTERVAL_MS;
    const read = () => {
      try {
        const saved = Number(window.localStorage.getItem(key));
        if (saved > 0 && saved <= Date.now() + GUIDED_PROGRESS_INTERVAL_MS) nextAt = saved;
      } catch { /* Private browsing still supports an in-memory timer. */ }
      return nextAt;
    };
    const save = (value: number) => {
      nextAt = value;
      try { window.localStorage.setItem(key, String(value)); } catch { /* Best effort. */ }
    };
    // Starting/resuming work gets a full interval, even after a long idle chat.
    save(starting ? nextAt : read());
    const check = () => {
      const latest = current.current;
      if (cancelled || latest.workspace !== workspace || !latest.enabled || !latest.active ||
          document.visibilityState === "hidden" || !latest.canSend() || Date.now() < read()) return;
      // Read and submit under a cross-tab lock. Missed intervals produce one
      // update, never a backlog. The callback also checks current busy refs.
      if (latest.submit()) save(Date.now() + GUIDED_PROGRESS_INTERVAL_MS);
    };
    const tick = () => {
      if (pending) return;
      if (navigator.locks) {
        pending = true;
        void navigator.locks.request(key, { ifAvailable: true }, lock => {
          if (lock) check();
        }).catch(() => { /* A failed lock must not trigger a duplicate turn. */ })
          .finally(() => { pending = false; });
      } else check();
    };
    const timer = window.setInterval(tick, 5_000);
    return () => { cancelled = true; window.clearInterval(timer); };
  }, [workspace, enabled, active]);
}
