import { describe, expect, it } from "vitest";
import {
  shouldShowUpdateDot,
  versionLabel,
  versionTooltip,
  type LyraVersion,
} from "./lyra-version";

function version(overrides: Partial<LyraVersion> = {}): LyraVersion {
  return {
    channel: "beta",
    display: "beta v0.19.2",
    notes: ["Safer Telegram setup."],
    release_name: "safer remote projects",
    released: "2026-08-27",
    title: "safer remote projects",
    update: { behind: 0, branch: "main", checked: true, update_available: false },
    version: "0.19.2",
    ...overrides,
  };
}

describe("versionLabel", () => {
  it("shows Lyra's own version", () => {
    expect(versionLabel(version())).toBe("beta v0.19.2");
  });

  it("never shows the upstream CLI number in its place", () => {
    // Two products, two numbers; the footer answers "which Lyra?" only.
    expect(versionLabel(null)).toBe("—");
  });
});

describe("versionTooltip", () => {
  it("names the release and says it is current", () => {
    const text = versionTooltip(version());
    expect(text).toContain("beta v0.19.2 — safer remote projects");
    expect(text).toContain("Released 2026-08-27");
    expect(text).toContain("Up to date");
  });

  it("counts the commits when an update is waiting", () => {
    const text = versionTooltip(
      version({
        update: { behind: 3, branch: "main", checked: true, update_available: true },
      }),
    );
    expect(text).toContain("3 commits behind main");
  });

  it("uses the singular for one commit", () => {
    const text = versionTooltip(
      version({
        update: { behind: 1, branch: "main", checked: true, update_available: true },
      }),
    );
    expect(text).toContain("1 commit behind");
    expect(text).not.toContain("1 commits");
  });

  it("admits when it could not check, rather than implying up to date", () => {
    const text = versionTooltip(
      version({
        update: { behind: null, branch: null, checked: false, update_available: false },
      }),
    );
    expect(text).toContain("unknown");
    expect(text).not.toContain("Up to date");
  });

  it("says so when there is no version at all", () => {
    expect(versionTooltip(null)).toBe("Version unavailable");
  });
});

describe("shouldShowUpdateDot", () => {
  it("shows only for a checked, real update", () => {
    expect(
      shouldShowUpdateDot(
        version({ update: { behind: 2, branch: "main", checked: true, update_available: true } }),
      ),
    ).toBe(true);
  });

  it("stays hidden when up to date or unknown", () => {
    expect(shouldShowUpdateDot(version())).toBe(false);
    expect(
      shouldShowUpdateDot(
        version({ update: { behind: null, branch: null, checked: false, update_available: true } }),
      ),
    ).toBe(false);
    expect(shouldShowUpdateDot(null)).toBe(false);
  });
});
