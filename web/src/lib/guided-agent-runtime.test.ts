import { describe, expect, it } from "vitest";
import {
  formatGuidedTokens,
  guidedUsageTotal,
  markGuidedWorkerStopping,
  normalizeGuidedUsage,
  updateGuidedWorkers,
} from "./guided-agent-runtime";

describe("guided agent runtime", () => {
  it("does not rename a worker when its progress mentions QA or other agents", () => {
    const initial = updateGuidedWorkers([], "subagent.start", {
      subagent_id: "architecture", display_label: "Architecture",
    }, 1000);
    const progress = updateGuidedWorkers(initial, "subagent.progress", {
      subagent_id: "architecture", text: "Checking the QA plan and research-report.md",
    }, 2000);
    const completed = updateGuidedWorkers(progress, "subagent.complete", {
      subagent_id: "architecture", summary: "QA and deployment remain",
    }, 3000);
    expect(completed[0].label).toBe("Architecture");
    expect(completed[0].status).toBe("completed");
    expect(updateGuidedWorkers([], "subagent.start", {
      subagent_id: "unknown", goal: "checking project status for QA",
    }, 1000)[0].label).toBe("Project agent 1");
  });
  it("normalizes parent usage without combining cached and fresh input", () => {
    const usage = normalizeGuidedUsage({
      model: "gpt-5.6-sol",
      input: 1200,
      cache_read: 9000,
      cache_write: 80,
      output: 300,
      reasoning: 40,
      calls: 3,
      cost_status: "estimated",
    }, 5_000);

    expect(usage).toMatchObject({
      model: "gpt-5.6-sol",
      input: 1200,
      cacheRead: 9000,
      cacheWrite: 80,
      output: 300,
      calls: 3,
      costStatus: "estimated",
      reported: true,
      updatedAt: 5_000,
    });
  });

  it("totals tokens the way the backend's canonical usage does", () => {
    // CanonicalUsage.total_tokens = fresh + cache read + cache write + output;
    // reasoning is reported separately and must not be added again.
    const usage = normalizeGuidedUsage({
      input: 100, cache_read: 200, cache_write: 80, output: 50, reasoning: 20,
    }, 5_000);
    expect(guidedUsageTotal(usage)).toBe(
      usage.input + usage.cacheRead + usage.cacheWrite + usage.output,
    );
    expect(guidedUsageTotal(usage)).toBe(430);
  });

  it("treats an empty usage payload as unknown rather than a measured zero", () => {
    expect(normalizeGuidedUsage({}, 5_000).reported).toBe(false);
    expect(normalizeGuidedUsage(undefined, 5_000).reported).toBe(false);
    expect(normalizeGuidedUsage({ input: 0, calls: 0 }, 5_000)).toMatchObject({
      reported: true,
      input: 0,
      updatedAt: 5_000,
    });
  });

  it("updates one live worker from heartbeat through completion", () => {
    const running = updateGuidedWorkers(
      [],
      "subagent.progress",
      {
        subagent_id: "sa-1",
        display_label: "Development",
        model: "claude-opus-4-6",
        input_tokens: 40_000,
        cache_read_tokens: 120_000,
        api_calls: 5,
      },
      1000,
    );
    const completed = updateGuidedWorkers(
      running,
      "subagent.complete",
      {
        subagent_id: "sa-1",
        status: "completed",
        output_tokens: 2500,
        api_calls: 7,
      },
      2000,
    );

    expect(completed[0]).toMatchObject({
      id: "sa-1",
      label: "Development",
      model: "claude-opus-4-6",
      input: 40_000,
      cacheRead: 120_000,
      output: 2500,
      calls: 7,
      status: "completed",
    });
  });

  it("marks active workers as stopping without hiding them", () => {
    const workers = updateGuidedWorkers(
      [],
      "subagent.start",
      { subagent_id: "sa-2", task_index: 1 },
      1000,
    );
    expect(markGuidedWorkerStopping(workers)[0].status).toBe("stopping");
  });

  it("formats compact token counts", () => {
    expect(formatGuidedTokens(950)).toBe("950");
    expect(formatGuidedTokens(12_500)).toBe("12.5K");
    expect(formatGuidedTokens(2_550_000)).toBe("2.55M");
  });
});
