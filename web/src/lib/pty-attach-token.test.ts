import { describe, expect, it } from "vitest";

import { ptyAttachToken, type PtyAttachTokenWindow } from "./pty-attach-token";

function fakeWindow(seed: number): PtyAttachTokenWindow {
  const values = new Map<string, string>();
  let next = seed;
  return {
    crypto: {
      getRandomValues(bytes) {
        new Uint8Array(
          bytes.buffer as ArrayBuffer,
          bytes.byteOffset,
          bytes.byteLength,
        ).fill(next);
        next += 1;
        return bytes;
      },
    },
    sessionStorage: {
      getItem: (key) => values.get(key) ?? null,
      setItem: (key, value) => void values.set(key, value),
    },
  };
}

describe("ptyAttachToken", () => {
  it("persists across reconnects in one tab but isolates different tabs", () => {
    const firstTab = fakeWindow(1);
    const secondTab = fakeWindow(2);

    const first = ptyAttachToken(firstTab);
    expect(ptyAttachToken(firstTab)).toBe(first);
    expect(ptyAttachToken(secondTab)).not.toBe(first);
  });

  it("rotates only the current tab token for an explicit fresh chat", () => {
    const tab = fakeWindow(3);
    const original = ptyAttachToken(tab);
    const rotated = ptyAttachToken(tab, true);

    expect(rotated).not.toBe(original);
    expect(ptyAttachToken(tab)).toBe(rotated);
  });
});
