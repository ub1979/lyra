export const PTY_ATTACH_TOKEN_KEY = "hermes.pty.token.chat";

export interface PtyAttachTokenWindow {
  crypto: Pick<Crypto, "getRandomValues">;
  sessionStorage: Pick<Storage, "getItem" | "setItem">;
}

/**
 * Return a keep-alive identity scoped to one browser tab.
 *
 * `sessionStorage` survives an ordinary reload but is isolated between tabs.
 * `localStorage` must not be used here: two Lyra tabs would share one token
 * and repeatedly supersede each other's PTY WebSocket.
 */
export function ptyAttachToken(
  browser: PtyAttachTokenWindow,
  rotate = false,
): string {
  let token = "";
  if (!rotate) {
    try {
      token = browser.sessionStorage.getItem(PTY_ATTACH_TOKEN_KEY) ?? "";
    } catch {
      // Private mode / storage blocked: create an in-memory-use token below.
    }
  }
  if (!token) {
    const bytes = browser.crypto.getRandomValues(new Uint8Array(16));
    token = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join(
      "",
    );
    try {
      browser.sessionStorage.setItem(PTY_ATTACH_TOKEN_KEY, token);
    } catch {
      // The current connection can still use the token without persistence.
    }
  }
  return token;
}
