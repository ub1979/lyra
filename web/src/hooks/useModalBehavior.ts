import { useEffect, useRef } from "react";

/**
 * Hook that adds standard modal behaviors when `open` is true:
 * - Escape key calls `onClose`
 * - Body scroll is locked
 * - Focus is restored to the previously focused element on close
 *
 * Returns a ref to attach to the modal container (for optional future focus trapping).
 */
export function useModalBehavior({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    const prevActive = document.activeElement as HTMLElement | null;

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
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
  }, [open, onClose]);

  return containerRef;
}
