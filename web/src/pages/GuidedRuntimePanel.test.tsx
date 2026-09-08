import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { EMPTY_GUIDED_USAGE } from "@/lib/guided-agent-runtime";
import { job, savedRun } from "@/lib/project-agent-activity.fixtures";
import { GuidedRuntimePanel } from "./ChatPage";

describe("GuidedRuntimePanel", () => {
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
      />,
    );

    expect(html).toContain("Agent activity");
    expect(html).toContain("Lyra available");
    expect(html).toContain("Reliability review");
    expect(html).not.toContain("Lyra is handling your message");
    expect(html).not.toContain("Stop &amp; retry");
    expect(html).not.toContain("Review with Lyra");
  });
});
