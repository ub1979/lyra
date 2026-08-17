import { describe, expect, it } from "vitest";
import {
  attachmentAccept,
  attachmentCapabilityNotice,
  attachmentVerdict,
  screenAttachments,
  visionRefused,
  visionUnknown,
} from "./chatAttachmentPolicy";
import { CHAT_ATTACHMENT_ACCEPT } from "./chatAttachments";

function file(name: string, type = ""): File {
  return new File(["x"], name, { type });
}

const VISION = { model: "claude-opus-4-6", supportsVision: true };
const NO_VISION = { model: "glm-5.2:cloud", supportsVision: false };
const UNKNOWN = { model: "glm-5.2:cloud" };

describe("images", () => {
  it("are refused when the model has no vision input", () => {
    const verdict = attachmentVerdict(file("shot.png", "image/png"), NO_VISION);
    expect(verdict.allowed).toBe(false);
    if (!verdict.allowed) {
      expect(verdict.reason).toContain("does not accept images");
      expect(verdict.reason).toContain("glm-5.2:cloud");
    }
  });

  it("are allowed on a vision model", () => {
    expect(
      attachmentVerdict(file("shot.png", "image/png"), VISION).allowed,
    ).toBe(true);
  });

  it("are allowed when support is unknown, rather than blocked on a guess", () => {
    // models.dev has no entry for custom/local providers; blocking here would
    // make a locally served vision model unusable.
    expect(
      attachmentVerdict(file("shot.png", "image/png"), UNKNOWN).allowed,
    ).toBe(true);
    expect(visionUnknown(UNKNOWN)).toBe(true);
    expect(visionRefused(UNKNOWN)).toBe(false);
  });
});

describe("media", () => {
  it("refuses audio by mime type and by extension", () => {
    expect(attachmentVerdict(file("note.mp3", "audio/mpeg"), VISION).allowed).toBe(
      false,
    );
    expect(attachmentVerdict(file("note.flac"), VISION).allowed).toBe(false);
  });

  it("refuses video even on a vision model", () => {
    const verdict = attachmentVerdict(file("clip.mp4", "video/mp4"), VISION);
    expect(verdict.allowed).toBe(false);
    if (!verdict.allowed) expect(verdict.reason).toContain("video cannot be sent");
  });
});

describe("files nothing can open", () => {
  it("refuses binaries, installers and fonts", () => {
    for (const name of [
      "setup.exe",
      "lib.dylib",
      "disk.iso",
      "app.apk",
      "Inter.woff2",
      "mock.psd",
    ]) {
      expect(attachmentVerdict(file(name), VISION).allowed).toBe(false);
    }
  });

  it("allows what the agent's file tools can actually read", () => {
    for (const name of [
      "spec.pdf",
      "notes.md",
      "data.csv",
      "report.docx",
      "bundle.zip",
      "Dockerfile",
      "script.py",
    ]) {
      expect(attachmentVerdict(file(name), VISION).allowed).toBe(true);
    }
  });

  it("does not refuse a dotfile for its leading dot", () => {
    expect(attachmentVerdict(file(".env.example"), VISION).allowed).toBe(true);
  });
});

describe("screenAttachments", () => {
  it("keeps the allowed files and reports each refusal", () => {
    const picked = [
      file("spec.pdf", "application/pdf"),
      file("shot.png", "image/png"),
      file("clip.mov", "video/quicktime"),
    ];
    const screened = screenAttachments(picked, NO_VISION);
    expect(screened.accepted.map((f) => f.name)).toEqual(["spec.pdf"]);
    expect(screened.refusals).toHaveLength(2);
  });

  it("passes everything through for a capable model", () => {
    const picked = [file("spec.pdf"), file("shot.png", "image/png")];
    expect(screenAttachments(picked, VISION).refusals).toEqual([]);
  });
});

describe("attachmentAccept", () => {
  it("stops offering images in the picker when the model refuses them", () => {
    const accept = attachmentAccept(NO_VISION, CHAT_ATTACHMENT_ACCEPT);
    expect(accept).not.toContain("image/*");
    expect(accept).not.toContain(".pdf,image");
    expect(accept).toContain(".pdf");
  });

  it("leaves the list alone otherwise", () => {
    expect(attachmentAccept(VISION, CHAT_ATTACHMENT_ACCEPT)).toBe(
      CHAT_ATTACHMENT_ACCEPT,
    );
    expect(attachmentAccept(UNKNOWN, CHAT_ATTACHMENT_ACCEPT)).toBe(
      CHAT_ATTACHMENT_ACCEPT,
    );
  });
});

describe("attachmentCapabilityNotice", () => {
  it("names the model that cannot take images", () => {
    expect(attachmentCapabilityNotice(NO_VISION)).toContain("glm-5.2:cloud");
  });

  it("says so when support is unknown", () => {
    expect(attachmentCapabilityNotice(UNKNOWN)).toContain("unknown");
  });

  it("stays quiet on a vision model", () => {
    expect(attachmentCapabilityNotice(VISION)).toBeNull();
  });
});
