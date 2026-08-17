import { describe, expect, it } from "vitest";
import {
  MAX_ATTACHMENT_BYTES,
  attachmentPromptBlock,
  attachmentRejection,
  attachmentSummaryLine,
  formatAttachmentSize,
  isImageAttachment,
  mergeAttachments,
  splitChatAttachments,
} from "./chatAttachments";

function fakeFile(
  name: string,
  { lastModified = 1, size = 10, type = "" } = {},
): File {
  const file = new File(["x"], name, { lastModified, type });
  // File size is derived from the blob parts; override for the size tests.
  Object.defineProperty(file, "size", { value: size });
  return file;
}

describe("splitChatAttachments", () => {
  it("routes images to the vision path and the rest to disk", () => {
    const png = fakeFile("shot.png", { type: "image/png" });
    const pdf = fakeFile("spec.pdf", { type: "application/pdf" });
    const unknown = fakeFile("data.weird");

    const split = splitChatAttachments([png, pdf, unknown]);
    expect(split.images).toEqual([png]);
    expect(split.documents).toEqual([pdf, unknown]);
  });

  it("treats a typeless file as a document, not an image", () => {
    expect(isImageAttachment(fakeFile("mystery"))).toBe(false);
  });
});

describe("attachmentRejection", () => {
  it("rejects empty files", () => {
    expect(attachmentRejection(fakeFile("empty.txt", { size: 0 }))).toMatch(
      /empty/,
    );
  });

  it("rejects files over the server cap before uploading them", () => {
    expect(
      attachmentRejection(
        fakeFile("huge.zip", { size: MAX_ATTACHMENT_BYTES + 1 }),
      ),
    ).toMatch(/larger than 50 MB/);
  });

  it("accepts a normal file", () => {
    expect(attachmentRejection(fakeFile("notes.md", { size: 2048 }))).toBeNull();
  });
});

describe("mergeAttachments", () => {
  it("ignores a file the user picked twice", () => {
    const a = fakeFile("a.pdf", { size: 5 });
    const again = fakeFile("a.pdf", { size: 5 });
    expect(mergeAttachments([a], [again])).toEqual([a]);
  });

  it("keeps same-named files that differ in size or mtime", () => {
    const first = fakeFile("a.pdf", { lastModified: 1, size: 5 });
    const edited = fakeFile("a.pdf", { lastModified: 2, size: 5 });
    expect(mergeAttachments([first], [edited])).toHaveLength(2);
  });

  it("appends in pick order", () => {
    const a = fakeFile("a.pdf");
    const b = fakeFile("b.pdf");
    expect(mergeAttachments([a], [b]).map((f) => f.name)).toEqual([
      "a.pdf",
      "b.pdf",
    ]);
  });
});

describe("formatAttachmentSize", () => {
  it("scales the unit", () => {
    expect(formatAttachmentSize(512)).toBe("512 B");
    expect(formatAttachmentSize(2048)).toBe("2 KB");
    expect(formatAttachmentSize(5 * 1024 * 1024)).toBe("5.0 MB");
  });
});

describe("attachmentPromptBlock", () => {
  it("is empty when nothing was uploaded", () => {
    expect(attachmentPromptBlock([])).toBe("");
  });

  it("gives the agent absolute paths to read", () => {
    const block = attachmentPromptBlock([
      {
        bytes: 2048,
        mime_type: "application/pdf",
        name: "dashboard_x_spec.pdf",
        path: "/home/u/.hermes/uploads/dashboard_x_spec.pdf",
      },
    ]);
    expect(block).toContain("Attached file (read it from disk");
    expect(block).toContain("/home/u/.hermes/uploads/dashboard_x_spec.pdf");
    expect(block).toContain("2 KB");
  });

  it("switches to plural for more than one", () => {
    const block = attachmentPromptBlock([
      { bytes: 1, mime_type: "text/plain", name: "a", path: "/tmp/a" },
      { bytes: 1, mime_type: "text/plain", name: "b", path: "/tmp/b" },
    ]);
    expect(block).toContain("Attached files (read them from disk");
    expect(block.split("\n").filter((line) => line.startsWith("- "))).toHaveLength(
      2,
    );
  });
});

describe("attachmentSummaryLine", () => {
  it("names the attachments for the user's own bubble", () => {
    expect(
      attachmentSummaryLine([fakeFile("a.pdf"), fakeFile("shot.png")]),
    ).toBe("📎 a.pdf, shot.png");
  });

  it("is empty with no attachments", () => {
    expect(attachmentSummaryLine([])).toBe("");
  });
});
