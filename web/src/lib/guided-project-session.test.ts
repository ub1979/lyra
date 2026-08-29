import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  clearGuidedProjectSessionId,
  guidedProjectSessionStorageKey,
  readGuidedProjectSessionId,
  selectGuidedProjectSessionId,
  writeGuidedProjectSessionId,
} from "./guided-project-session";

describe("guided project session persistence", () => {
  beforeEach(() => {
    const values = new Map<string, string>();
    vi.stubGlobal("localStorage", {
      clear: () => values.clear(),
      getItem: (key: string) => values.get(key) ?? null,
      removeItem: (key: string) => values.delete(key),
      setItem: (key: string, value: string) => values.set(key, value),
    });
  });

  it("keeps a separate durable session for each project", () => {
    writeGuidedProjectSessionId("/projects/song", " session-song ");
    writeGuidedProjectSessionId("/projects/video", "session-video");

    expect(readGuidedProjectSessionId("/projects/song")).toBe("session-song");
    expect(readGuidedProjectSessionId("/projects/video")).toBe("session-video");
  });

  it("clears only the requested project session", () => {
    writeGuidedProjectSessionId("/projects/song", "session-song");
    writeGuidedProjectSessionId("/projects/video", "session-video");

    clearGuidedProjectSessionId("/projects/song");

    expect(readGuidedProjectSessionId("/projects/song")).toBe("");
    expect(readGuidedProjectSessionId("/projects/video")).toBe("session-video");
  });

  it("uses a stable fallback key for an empty workspace", () => {
    expect(guidedProjectSessionStorageKey("")).toBe(
      "idrak-it.guided-session.v1:default",
    );
  });

  it("migrates to the substantial matching conversation", () => {
    expect(
      selectGuidedProjectSessionId(
        [
          { cwd: "/projects/song", id: "temporary", message_count: 2 },
          { cwd: "/projects/other", id: "other", message_count: 900 },
          { cwd: "/projects/song", id: "real-chat", message_count: 137 },
        ],
        "/projects/song",
      ),
    ).toBe("real-chat");
  });

  it("never replaces the project chat with a delegated agent session", () => {
    expect(
      selectGuidedProjectSessionId(
        [
          {
            cwd: "/projects/song",
            id: "project-chat",
            message_count: 80,
            source: "desktop",
          },
          {
            cwd: "/projects/song",
            id: "architecture-worker",
            message_count: 200,
            parent_session_id: "project-chat",
            source: "subagent",
          },
        ],
        "/projects/song",
        "architecture-worker",
      ),
    ).toBe("project-chat");
  });

  it("keeps a saved top-level project chat when it is still valid", () => {
    expect(
      selectGuidedProjectSessionId(
        [
          { cwd: "/projects/song", id: "newer", message_count: 90 },
          { cwd: "/projects/song", id: "saved", message_count: 40 },
        ],
        "/projects/song",
        "saved",
      ),
    ).toBe("saved");
  });
});
