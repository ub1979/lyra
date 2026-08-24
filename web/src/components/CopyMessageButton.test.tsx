// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const copyTextToClipboard = vi.fn();
vi.mock("@/lib/clipboard", () => ({
  copyTextToClipboard: (text: string) => copyTextToClipboard(text),
}));

import { COPY_FEEDBACK_MS } from "@/lib/chat-copy";
import { CopyMessageButton } from "./CopyMessageButton";

let host: HTMLDivElement;
let root: Root;

function render(text: string, roleLabel = "Lyra") {
  act(() => {
    root.render(<CopyMessageButton text={text} roleLabel={roleLabel} />);
  });
}

function button(): HTMLButtonElement {
  const found = host.querySelector("button");
  if (!found) throw new Error("copy button did not render");
  return found as HTMLButtonElement;
}

async function click() {
  await act(async () => {
    button().dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });
}

beforeEach(() => {
  vi.useFakeTimers();
  copyTextToClipboard.mockReset();
  copyTextToClipboard.mockResolvedValue(true);
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
});

afterEach(() => {
  act(() => root.unmount());
  host.remove();
  vi.useRealTimers();
});

describe("CopyMessageButton", () => {
  it("puts the message on the clipboard byte for byte", async () => {
    const markdown = "Run this:\n\n```bash\nnpm run build -w web\n```";
    render(markdown);
    await click();
    expect(copyTextToClipboard).toHaveBeenCalledWith(markdown);
  });

  it("confirms the copy, then goes quiet again", async () => {
    render("hello");
    expect(button().getAttribute("aria-label")).toBe("Copy Lyra message");

    await click();
    expect(button().getAttribute("aria-label")).toBe("Copied");

    await act(async () => {
      vi.advanceTimersByTime(COPY_FEEDBACK_MS);
    });
    expect(button().getAttribute("aria-label")).toBe("Copy Lyra message");
  });

  it("says so when the browser refuses, instead of pretending", async () => {
    copyTextToClipboard.mockResolvedValue(false);
    render("hello");
    await click();
    expect(button().getAttribute("aria-label")).toMatch(/manually/);
  });

  it("names whose message it copies", () => {
    render("hi", "your");
    expect(button().getAttribute("aria-label")).toBe("Copy your message");
  });

  it("stays visible while it is showing a result, hover or not", async () => {
    render("hello");
    expect(button().className).toContain("opacity-0");
    await click();
    expect(button().className).toContain("opacity-100");
  });

  it("is reachable on touch, where nothing can be hovered", () => {
    render("hello");
    expect(button().className).toContain("[@media(hover:none)]:opacity-100");
  });

  it("does not update state after the bubble is gone", async () => {
    render("hello");
    await click();
    act(() => root.unmount());
    // The revert timer must not fire into an unmounted tree.
    expect(() => vi.advanceTimersByTime(COPY_FEEDBACK_MS * 2)).not.toThrow();
    root = createRoot(host);
  });
});
