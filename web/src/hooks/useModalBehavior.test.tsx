// @vitest-environment jsdom
import { act, useEffect, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useModalBehavior } from "./useModalBehavior";

let host: HTMLDivElement;
let root: Root;
let rerender: () => void;

/**
 * Mirrors how every dashboard page calls the hook: `onClose` is an inline
 * arrow, so it is a brand new function on every render of the host page.
 */
function Dialog({ onClose }: { onClose: () => void }) {
  const [, setTick] = useState(0);
  useEffect(() => {
    rerender = () => setTick((n) => n + 1);
  });
  const ref = useModalBehavior<HTMLDivElement>({
    open: true,
    onClose: () => onClose(),
  });
  return (
    <div ref={ref}>
      <button id="inside" type="button">
        inside
      </button>
    </div>
  );
}

beforeEach(() => {
  (globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean })
    .IS_REACT_ACT_ENVIRONMENT = true;
  document.body.innerHTML = "";
  document.body.style.overflow = "";
  document.documentElement.style.overflow = "";
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
});

afterEach(() => {
  act(() => root.unmount());
});

function mount(onClose: () => void) {
  act(() => {
    root.render(<Dialog onClose={onClose} />);
  });
}

describe("useModalBehavior", () => {
  it("does not steal focus back when the host page re-renders", () => {
    const outside = document.createElement("button");
    outside.id = "outside";
    document.body.appendChild(outside);
    outside.focus();

    mount(() => {});

    const inside = document.getElementById("inside") as HTMLButtonElement;
    inside.focus();
    expect(document.activeElement?.id).toBe("inside");

    // A render of the host page — a PTY message, an activity tick, or the
    // click that toggled a checkbox. The focus restore must not run here:
    // it pulls focus out of the dialog and scrolls the restored element
    // into view, which is what jumped the specialists list.
    act(() => rerender());

    expect(document.activeElement?.id).toBe("inside");
  });

  it("keeps the scroll lock in place across re-renders", () => {
    mount(() => {});
    act(() => rerender());

    expect(document.body.style.overflow).toBe("hidden");
    expect(document.documentElement.style.overflow).toBe("hidden");
  });

  it("restores page scroll when the dialog unmounts", () => {
    document.body.style.overflow = "auto";
    document.documentElement.style.overflow = "auto";

    mount(() => {});
    act(() => root.unmount());
    root = createRoot(host);

    expect(document.body.style.overflow).toBe("auto");
    expect(document.documentElement.style.overflow).toBe("auto");
  });

  it("closes on Escape using the latest handler", () => {
    const onClose = vi.fn();
    mount(onClose);
    act(() => rerender());

    act(() => {
      document.dispatchEvent(
        new KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
      );
    });

    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
