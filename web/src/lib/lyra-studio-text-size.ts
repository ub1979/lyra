export const LYRA_STUDIO_TEXT_SIZE_KEY = "lyra-studio-text-size";
export const LYRA_STUDIO_TEXT_SIZE_EVENT = "lyra-studio-text-size-change";

export type LyraStudioTextSize = "normal" | "large" | "xlarge";

export function normalizeLyraStudioTextSize(
  value: string | null | undefined,
): LyraStudioTextSize {
  return value === "large" || value === "xlarge" ? value : "normal";
}

export function readLyraStudioTextSize(): LyraStudioTextSize {
  try {
    return normalizeLyraStudioTextSize(
      localStorage.getItem(LYRA_STUDIO_TEXT_SIZE_KEY),
    );
  } catch {
    return "normal";
  }
}

export function writeLyraStudioTextSize(size: LyraStudioTextSize): void {
  try {
    localStorage.setItem(LYRA_STUDIO_TEXT_SIZE_KEY, size);
  } catch {
    // Keep the live visual change when storage is unavailable.
  }
  window.dispatchEvent(
    new CustomEvent<LyraStudioTextSize>(LYRA_STUDIO_TEXT_SIZE_EVENT, {
      detail: size,
    }),
  );
}

export function listenForLyraStudioTextSize(
  listener: (size: LyraStudioTextSize) => void,
): () => void {
  const onSize = (event: Event) => {
    listener(
      normalizeLyraStudioTextSize(
        (event as CustomEvent<LyraStudioTextSize>).detail,
      ),
    );
  };
  const onStorage = (event: StorageEvent) => {
    if (event.key === LYRA_STUDIO_TEXT_SIZE_KEY) {
      listener(normalizeLyraStudioTextSize(event.newValue));
    }
  };

  window.addEventListener(LYRA_STUDIO_TEXT_SIZE_EVENT, onSize);
  window.addEventListener("storage", onStorage);
  return () => {
    window.removeEventListener(LYRA_STUDIO_TEXT_SIZE_EVENT, onSize);
    window.removeEventListener("storage", onStorage);
  };
}
