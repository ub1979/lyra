import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  clearGuidedProjectSessionId,
  guidedProjectSessionStorageKey,
  readGuidedProjectSessionId,
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
});
