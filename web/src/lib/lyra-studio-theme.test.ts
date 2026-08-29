import { describe, expect, it } from "vitest";

import { normalizeLyraStudioTheme } from "./lyra-studio-theme";

describe("normalizeLyraStudioTheme", () => {
  it("keeps dark mode", () => {
    expect(normalizeLyraStudioTheme("dark")).toBe("dark");
  });

  it("uses light mode for missing or invalid values", () => {
    expect(normalizeLyraStudioTheme(null)).toBe("light");
    expect(normalizeLyraStudioTheme("system")).toBe("light");
  });
});
