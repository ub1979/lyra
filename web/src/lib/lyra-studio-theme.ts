export const LYRA_STUDIO_THEME_KEY = "lyra-studio-color-mode";
export const LYRA_STUDIO_THEME_EVENT = "lyra-studio-theme-change";

export type LyraStudioTheme = "light" | "dark";

export function normalizeLyraStudioTheme(
  value: string | null | undefined,
): LyraStudioTheme {
  return value === "dark" ? "dark" : "light";
}

export function readLyraStudioTheme(): LyraStudioTheme {
  try {
    return normalizeLyraStudioTheme(localStorage.getItem(LYRA_STUDIO_THEME_KEY));
  } catch {
    return "light";
  }
}

export function writeLyraStudioTheme(theme: LyraStudioTheme): void {
  try {
    localStorage.setItem(LYRA_STUDIO_THEME_KEY, theme);
  } catch {
    // The visual change should still work when storage is unavailable.
  }
  window.dispatchEvent(
    new CustomEvent<LyraStudioTheme>(LYRA_STUDIO_THEME_EVENT, {
      detail: theme,
    }),
  );
}

export function listenForLyraStudioTheme(
  listener: (theme: LyraStudioTheme) => void,
): () => void {
  const onTheme = (event: Event) => {
    const theme = (event as CustomEvent<LyraStudioTheme>).detail;
    listener(normalizeLyraStudioTheme(theme));
  };
  const onStorage = (event: StorageEvent) => {
    if (event.key === LYRA_STUDIO_THEME_KEY) {
      listener(normalizeLyraStudioTheme(event.newValue));
    }
  };

  window.addEventListener(LYRA_STUDIO_THEME_EVENT, onTheme);
  window.addEventListener("storage", onStorage);
  return () => {
    window.removeEventListener(LYRA_STUDIO_THEME_EVENT, onTheme);
    window.removeEventListener("storage", onStorage);
  };
}
