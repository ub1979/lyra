/**
 * What may be attached to a chat message, given the model in use.
 *
 * Uploading something the model cannot accept is worse than an error: the file
 * lands on disk, the turn runs, and the answer is written as if the attachment
 * had been read. So the composer refuses at pick time and says why.
 *
 * Three separate reasons a file is refused:
 *
 * 1. Images when the selected model has no vision input. `supports_vision`
 *    comes from `/api/model/info`, which resolves models.dev first and then the
 *    user's own `model.supports_vision` override — the same lookup the agent's
 *    image routing uses, so the dashboard agrees with what a turn would do.
 * 2. Audio and video, always: nothing in the chat path sends media to a model.
 *    (Transcription is a separate tool, not an attachment.)
 * 3. Files nothing downstream can open — executables, libraries, disk images,
 *    fonts, binary design formats. The agent has file tools, not a debugger.
 *
 * Unknown vision support is deliberately *not* a refusal. models.dev has no
 * entry for custom or local providers, so a definite `false` blocks and a
 * missing value warns — otherwise a locally served vision model could never
 * receive an image.
 */

export interface ChatModelCapabilities {
  /** true / false from the model info endpoint; null or undefined when unknown. */
  supportsVision?: boolean | null;
  /** Model slug, for messages. */
  model?: string;
}

export type AttachmentVerdict =
  | { allowed: true }
  | { allowed: false; reason: string };

const AUDIO_EXTENSIONS = [
  ".mp3",
  ".wav",
  ".m4a",
  ".flac",
  ".ogg",
  ".oga",
  ".aac",
  ".wma",
  ".aiff",
];

const VIDEO_EXTENSIONS = [
  ".mp4",
  ".mov",
  ".avi",
  ".mkv",
  ".webm",
  ".wmv",
  ".m4v",
  ".mpg",
  ".mpeg",
];

/** Nothing downstream can read these — they are bytes for a machine, not text. */
const UNREADABLE_EXTENSIONS = [
  ".exe",
  ".dll",
  ".so",
  ".dylib",
  ".bin",
  ".o",
  ".a",
  ".obj",
  ".class",
  ".jar",
  ".msi",
  ".apk",
  ".app",
  ".dmg",
  ".iso",
  ".img",
  ".deb",
  ".rpm",
  ".pkg",
  ".ttf",
  ".otf",
  ".woff",
  ".woff2",
  ".psd",
  ".ai",
  ".sketch",
  ".fig",
];

function extensionOf(name: string): string {
  const dot = name.lastIndexOf(".");
  return dot > 0 ? name.slice(dot).toLowerCase() : "";
}

function isAudio(file: File): boolean {
  return (
    file.type.startsWith("audio/") ||
    AUDIO_EXTENSIONS.includes(extensionOf(file.name))
  );
}

function isVideo(file: File): boolean {
  return (
    file.type.startsWith("video/") ||
    VIDEO_EXTENSIONS.includes(extensionOf(file.name))
  );
}

function isUnreadable(file: File): boolean {
  return UNREADABLE_EXTENSIONS.includes(extensionOf(file.name));
}

/** True when the model definitely cannot accept an image. */
export function visionRefused(caps: ChatModelCapabilities): boolean {
  return caps.supportsVision === false;
}

/** True when nothing tells us either way (custom or local providers). */
export function visionUnknown(caps: ChatModelCapabilities): boolean {
  return caps.supportsVision === null || caps.supportsVision === undefined;
}

export function attachmentVerdict(
  file: File,
  caps: ChatModelCapabilities,
): AttachmentVerdict {
  if (isAudio(file)) {
    return {
      allowed: false,
      reason: `${file.name}: audio cannot be sent in chat — no model input accepts it.`,
    };
  }
  if (isVideo(file)) {
    return {
      allowed: false,
      reason: `${file.name}: video cannot be sent in chat — no model input accepts it.`,
    };
  }
  if (isUnreadable(file)) {
    return {
      allowed: false,
      reason: `${file.name}: nothing can open a ${extensionOf(file.name)} file — send the source or a text export instead.`,
    };
  }
  if (file.type.startsWith("image/") && visionRefused(caps)) {
    const model = caps.model ? ` (${caps.model})` : "";
    return {
      allowed: false,
      reason: `${file.name}: the selected model${model} does not accept images. Switch to a vision model, or describe the image in text.`,
    };
  }
  return { allowed: true };
}

/** Split a picked set into what may be attached and the refusal messages. */
export function screenAttachments(
  files: readonly File[],
  caps: ChatModelCapabilities,
): { accepted: File[]; refusals: string[] } {
  const accepted: File[] = [];
  const refusals: string[] = [];
  for (const file of files) {
    const verdict = attachmentVerdict(file, caps);
    if (verdict.allowed) accepted.push(file);
    else refusals.push(verdict.reason);
  }
  return { accepted, refusals };
}

/**
 * `accept` for the file input. Images drop out entirely when the model has no
 * vision input, so the picker itself stops offering them.
 */
export function attachmentAccept(
  caps: ChatModelCapabilities,
  baseAccept: string,
): string {
  if (!visionRefused(caps)) return baseAccept;
  return baseAccept
    .split(",")
    .map((token) => token.trim())
    .filter(
      (token) =>
        token &&
        !token.startsWith("image/") &&
        ![".png", ".jpg", ".jpeg", ".gif", ".webp", ".bmp"].includes(
          token.toLowerCase(),
        ),
    )
    .join(",");
}

/** One line for the composer hint, or null when there is nothing to say. */
export function attachmentCapabilityNotice(
  caps: ChatModelCapabilities,
): string | null {
  if (visionRefused(caps)) {
    return `${caps.model || "The selected model"} does not accept images — files only.`;
  }
  if (visionUnknown(caps)) {
    return "Image support for this model is unknown; set model.supports_vision in config if it accepts images.";
  }
  return null;
}
