import { useEffect, useRef } from "react";

/**
 * Hook that adds standard modal behaviors when `open` is true:
 * - Escape key calls `onClose`
 * - Page scroll is locked
 * - Focus is restored to the previously focused element on close
 *
 * The effect deliberately depends on `open` alone. Every caller passes
 * `onClose` as an inline arrow, so its identity changes on each render of the
 * host page; while it was in the dependency array the effect tore down and set
 * itself up again after *every* render. Each teardown ran the focus restore,
 * which pulled focus out of the open dialog — and because `focus()` scrolls
 * the element into view, that also jumped the dialog's scroll position while
 * the user was clicking through it. The live handler lives in a ref instead.
 *
 * Returns a ref to attach to the modal container (for optional future focus
 * trapping).
 */
export function useModalBehavior<T extends HTMLElement = HTMLDivElement>({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const containerRef = useRef<T>(null);
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!open) return;

    const prevActive = document.activeElement as HTMLElement | null;

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onCloseRef.current();
      }
    };

    document.addEventListener("keydown", onKey);
    // Lock <html> as well as <body>. The mobile breakpoint in index.css gives
    // html/body/#root `height:auto; overflow-y:auto`, which makes <html> the
    // scrolling element there — locking only <body> left the page scrollable
    // behind the overlay. That scrolling hides and shows the browser chrome,
    // which changes 100dvh, which resizes any dialog sized in dvh units
    // mid-interaction and pushes its lower content below the fold.
    const root = document.documentElement;
    const prevBodyOverflow = document.body.style.overflow;
    const prevRootOverflow = root.style.overflow;
    document.body.style.overflow = "hidden";
    root.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevBodyOverflow;
      root.style.overflow = prevRootOverflow;
      prevActive?.focus?.();
    };
  }, [open]);

  return containerRef;
}
