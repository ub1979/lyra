import { describe, expect, it } from "vitest";

import { normalizeLyraStudioTextSize } from "./lyra-studio-text-size";

describe("normalizeLyraStudioTextSize", () => {
  it("keeps supported larger sizes", () => {
    expect(normalizeLyraStudioTextSize("large")).toBe("large");
    expect(normalizeLyraStudioTextSize("xlarge")).toBe("xlarge");
  });

  it("falls back to normal", () => {
    expect(normalizeLyraStudioTextSize(null)).toBe("normal");
    expect(normalizeLyraStudioTextSize("huge")).toBe("normal");
  });
});
