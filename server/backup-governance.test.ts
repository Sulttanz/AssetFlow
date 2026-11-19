import { describe, expect, it } from "vitest";
import { __backupGovernanceTestUtils } from "./backup-governance";

describe("backup schedule due-date advancement", () => {
  const advance = __backupGovernanceTestUtils.advanceDueDate;

  it("advances fixed intervals from the logged completion time", () => {
    const start = new Date("2026-03-15T08:30:00.000Z");
    expect(advance(start, "hourly")?.toISOString()).toBe("2026-03-15T09:30:00.000Z");
    expect(advance(start, "daily")?.toISOString()).toBe("2026-03-16T08:30:00.000Z");
    expect(advance(start, "weekly")?.toISOString()).toBe("2026-03-22T08:30:00.000Z");
    expect(advance(start, "monthly")?.toISOString()).toBe("2026-04-15T08:30:00.000Z");
  });

  it("clamps month-end dates and leaves custom schedules for manual review", () => {
    expect(advance(new Date("2026-01-31T10:00:00.000Z"), "monthly")?.toISOString())
      .toBe("2026-02-28T10:00:00.000Z");
    expect(advance(new Date("2026-03-15T10:00:00.000Z"), "custom")).toBeNull();
  });
});

describe("backup evidence file validation", () => {
  const validate = __backupGovernanceTestUtils.validateEvidenceFile;

  it("accepts approved files only when their contents match their declared type", () => {
    expect(() => validate({
      originalname: "backup.pdf", mimetype: "application/pdf", size: 9,
      buffer: Buffer.from("%PDF-1.7"),
    })).not.toThrow();
    expect(() => validate({
      originalname: "backup.pdf", mimetype: "application/pdf", size: 9,
      buffer: Buffer.from("not a PDF"),
    })).toThrow(/contents do not match/);
    expect(() => validate({
      originalname: "restore-notes.docx",
      mimetype: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      size: 4, buffer: Buffer.from([0x50, 0x4b, 0x03, 0x04]),
    })).not.toThrow();
    expect(() => validate({
      originalname: "backup.exe", mimetype: "application/octet-stream", size: 8,
      buffer: Buffer.from("anything"),
    })).toThrow(/approved evidence file type/);
  });

  it("rejects mismatched MIME types and files over the server size limit", () => {
    expect(() => validate({
      originalname: "backup.png", mimetype: "text/plain", size: 8,
      buffer: Buffer.from("not image"),
    })).toThrow(/approved evidence file type/);
    expect(() => validate({
      originalname: "backup.txt", mimetype: "text/plain",
      size: __backupGovernanceTestUtils.evidenceUploadLimit + 1,
      buffer: Buffer.from("evidence"),
    })).toThrow(/between 1 byte and 10 MB/);
  });
});
