import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import {
  EMPTY_GUIDED_USAGE,
  normalizeGuidedUsage,
} from "@/lib/guided-agent-runtime";
import { job, savedRun } from "@/lib/project-agent-activity.fixtures";
import { GuidedRuntimePanel } from "./ChatPage";

describe("GuidedRuntimePanel", () => {
  it("separates Lyra's own usage from saved worker usage and names the unknown", () => {
    const unknown = renderToStaticMarkup(
      <GuidedRuntimePanel
        activeWorkers={[]}
        runState={savedRun([job({ task_id: "arch", status: "running" })])}
        runStateStale={false}
        defaultModelLabel="gpt-test"
        onStopWorker={() => undefined}
        paused={false}
        usage={EMPTY_GUIDED_USAGE}
        coordinatorState={{ connection: "open", eventsConnected: true, working: false }}
      />,
    );
    expect(unknown).toContain("Not reported yet");
    expect(unknown).toContain("Not reported · 0 of 1");

    const reported = renderToStaticMarkup(
      <GuidedRuntimePanel
        activeWorkers={[]}
        runState={savedRun([
          job({ task_id: "arch", status: "done" }),
          job({
            task_id: "dev",
            status: "running",
            usage: {
              input_tokens: 1200,
              output_tokens: 300,
              cache_read_tokens: 9000,
              cache_write_tokens: 0,
              reasoning_tokens: 40,
              api_calls: 3,
              cost_usd: 0.0125,
              cost_status: "estimated",
              model: "claude-opus-4-6",
              recorded_at: 100,
            },
          }),
        ])}
        runStateStale={false}
        defaultModelLabel="gpt-test"
        onStopWorker={() => undefined}
        paused={false}
        usage={normalizeGuidedUsage({ input: 100, output: 50, calls: 1 }, 5_000)}
        coordinatorState={{ connection: "open", eventsConnected: true, working: false }}
      />,
    );
    expect(reported).toContain("Lyra only");
    expect(reported).toContain("10.5K · ~$0.013 · 1 of 2 reported");
    expect(reported).toContain("Updated");
    expect(reported).not.toContain("Not reported yet");
  });

  it("keeps Agent Activity status-only while work is running", () => {
    const html = renderToStaticMarkup(
      <GuidedRuntimePanel
        activeWorkers={[]}
        runState={savedRun([
          job({
            task_id: "review-1",
            label: "Reliability review",
            status: "running",
          }),
        ])}
        runStateStale={false}
        defaultModelLabel="gpt-test"
        onStopWorker={() => undefined}
        paused={false}
        usage={EMPTY_GUIDED_USAGE}
        coordinatorState={{ connection: "open", eventsConnected: true, working: false }}
      />,
    );

    expect(html).toContain("Agent activity");
    expect(html).toContain("Lyra ready");
    expect(html).toContain("Reliability review");
    expect(html).not.toContain("Lyra is handling your message");
    expect(html).not.toContain("Stop &amp; retry");
    expect(html).not.toContain("Review with Lyra");
  });
});
