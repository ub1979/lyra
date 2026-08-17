import { authedFetch } from "@/lib/api";

/**
 * Attachments for the guided chat composer.
 *
 * The browser holds bytes the agent cannot see: it runs on this machine, not in
 * the page. So an attachment has to be uploaded first, and the two kinds go to
 * different places for different reasons.
 *
 * - Images become vision content on the model turn. They already have a route:
 *   `/api/chat/image-upload` writes to `HERMES_HOME/images` and the TUI's
 *   `/image <path>` command attaches them (see chatImagePaste.ts).
 * - Everything else is a file the agent should *read*. `/api/chat/file-upload`
 *   writes it to `HERMES_HOME/uploads` and returns the absolute path, which goes
 *   into the prompt so the agent's file tools can open it.
 */

/** Server cap is 50 MB; fail here rather than after a doomed upload. */
export const MAX_ATTACHMENT_BYTES = 50 * 1024 * 1024;

/** What the picker offers. Images are handled by the vision path. */
export const CHAT_ATTACHMENT_ACCEPT = [
  "image/*",
  ".pdf",
  ".txt",
  ".md",
  ".csv",
  ".tsv",
  ".json",
  ".yaml",
  ".yml",
  ".xml",
  ".html",
  ".docx",
  ".xlsx",
  ".pptx",
  ".zip",
  ".log",
  ".sql",
  ".py",
  ".ts",
  ".tsx",
  ".js",
  ".jsx",
  ".sh",
].join(",");

export interface ChatFileUploadResult {
  /** Absolute path on the agent's disk. */
  path: string;
  /** Basename written on the server. */
  name: string;
  bytes: number;
  mime_type: string;
}

export function isImageAttachment(file: File): boolean {
  return file.type.startsWith("image/");
}

/** Split a picked set into the vision path and the read-from-disk path. */
export function splitChatAttachments(files: readonly File[]): {
  documents: File[];
  images: File[];
} {
  const documents: File[] = [];
  const images: File[] = [];
  for (const file of files) {
    (isImageAttachment(file) ? images : documents).push(file);
  }
  return { documents, images };
}

/** Reason this file cannot be attached, or null when it is fine. */
export function attachmentRejection(file: File): string | null {
  if (file.size === 0) return `${file.name} is empty`;
  if (file.size > MAX_ATTACHMENT_BYTES) {
    const mb = Math.round(MAX_ATTACHMENT_BYTES / (1024 * 1024));
    return `${file.name} is larger than ${mb} MB`;
  }
  return null;
}

/** De-duplicate by identity (name + size + mtime), preserving order. */
export function mergeAttachments(
  current: readonly File[],
  incoming: readonly File[],
): File[] {
  const key = (file: File) =>
    `${file.name}\u0000${file.size}\u0000${file.lastModified}`;
  const seen = new Set(current.map(key));
  const merged = [...current];
  for (const file of incoming) {
    const id = key(file);
    if (seen.has(id)) continue;
    seen.add(id);
    merged.push(file);
  }
  return merged;
}

export function formatAttachmentSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * The block appended to the prompt for uploaded documents.
 *
 * Absolute paths, because the agent opens them with its own file tools — a bare
 * filename would send it hunting through the workspace for something that is not
 * there.
 */
export function attachmentPromptBlock(
  uploads: readonly ChatFileUploadResult[],
): string {
  if (!uploads.length) return "";
  const lines = uploads.map(
    (upload) => `- ${upload.path} (${upload.name}, ${formatAttachmentSize(upload.bytes)})`,
  );
  return [
    "",
    uploads.length === 1
      ? "Attached file (read it from disk before answering):"
      : "Attached files (read them from disk before answering):",
    ...lines,
  ].join("\n");
}

/** What the user's own chat bubble shows for the attachments. */
export function attachmentSummaryLine(files: readonly File[]): string {
  if (!files.length) return "";
  const names = files.map((file) => file.name).join(", ");
  return `📎 ${names}`;
}

/** Upload one non-image attachment and return its path on the agent's disk. */
export async function uploadChatFile(
  file: File,
  profile = "",
): Promise<ChatFileUploadResult> {
  const rejection = attachmentRejection(file);
  if (rejection) throw new Error(rejection);

  const body = new FormData();
  body.append("file", file, file.name);
  const qs = profile ? `?profile=${encodeURIComponent(profile)}` : "";
  // No Content-Type header: the browser sets the multipart boundary.
  const res = await authedFetch(`/api/chat/file-upload${qs}`, {
    body,
    method: "POST",
  });
  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    throw new Error(text || `HTTP ${res.status}`);
  }
  const uploaded = (await res.json()) as ChatFileUploadResult;
  if (!uploaded?.path) throw new Error("file upload did not return a path");
  return uploaded;
}
