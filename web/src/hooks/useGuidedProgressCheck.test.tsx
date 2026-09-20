// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { GUIDED_PROGRESS_INTERVAL_MS as interval, useGuidedProgressCheck, type GuidedProgressCheckOptions } from "./useGuidedProgressCheck";

describe("five-minute project check-ins", () => {
  afterEach(() => { vi.useRealTimers(); localStorage.clear(); });

  it("waits five minutes, defers busy/input states, resets for paused work, and cancels on unmount", async () => {
    vi.useFakeTimers();
    const root = createRoot(document.createElement("div"));
    let available = true;
    const submit = vi.fn(() => true);
    let options: GuidedProgressCheckOptions = { workspace: "/one", enabled: true, active: true, canSend: () => available, submit };
    function Harness() { useGuidedProgressCheck(options); return null; }
    try {
      await act(async () => root.render(<Harness />));
      await act(async () => vi.advanceTimersByTime(interval - 5_000));
      expect(submit).not.toHaveBeenCalled();
      available = false;
      await act(async () => vi.advanceTimersByTime(interval * 2));
      expect(submit).not.toHaveBeenCalled();
      available = true;
      await act(async () => vi.advanceTimersByTime(5_000));
      expect(submit).toHaveBeenCalledTimes(1);
      await act(async () => vi.advanceTimersByTime(interval));
      expect(submit).toHaveBeenCalledTimes(2);
      options = { ...options, active: false };
      await act(async () => root.render(<Harness />));
      await act(async () => vi.advanceTimersByTime(interval * 2));
      expect(submit).toHaveBeenCalledTimes(2);
      options = { ...options, active: true };
      await act(async () => root.render(<Harness />));
      await act(async () => vi.advanceTimersByTime(interval - 5_000));
      expect(submit).toHaveBeenCalledTimes(2);
      await act(async () => vi.advanceTimersByTime(5_000));
      expect(submit).toHaveBeenCalledTimes(3);
    } finally { await act(async () => root.unmount()); }
    await act(async () => vi.advanceTimersByTime(interval * 2));
    expect(submit).toHaveBeenCalledTimes(3);
  });

  it("deduplicates two consumers, survives reconnect, and isolates another project", async () => {
    vi.useFakeTimers();
    const roots = [createRoot(document.createElement("div")), createRoot(document.createElement("div"))];
    const submit = vi.fn(() => true);
    function Harness({ workspace = "/one" }) {
      useGuidedProgressCheck({ workspace, enabled: true, active: true, canSend: () => true, submit });
      return null;
    }
    try {
      await act(async () => { roots.forEach(root => root.render(<Harness />)); });
      await act(async () => vi.advanceTimersByTime(interval));
      expect(submit).toHaveBeenCalledTimes(1);
      await act(async () => roots[1].render(<Harness workspace="/two" />));
      await act(async () => vi.advanceTimersByTime(interval));
      expect(submit).toHaveBeenCalledTimes(3);
      await act(async () => roots[1].render(<Harness workspace="/one" />));
      await act(async () => vi.advanceTimersByTime(5_000));
      expect(submit).toHaveBeenCalledTimes(3);
    } finally { await act(async () => roots.forEach(root => root.unmount())); }
  });
});
