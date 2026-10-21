import { describe, expect, it } from "vitest";
import {
  insertCmdbApplicationSchema,
  insertConfigurationDocumentSchema,
  insertServerSchema,
} from "@shared/schema";

describe("CMDB register schemas", () => {
  it("accepts application records with owned system-dropdown categories and supported criticality", () => {
    const result = insertCmdbApplicationSchema.safeParse({
      name: "Payroll Platform",
      category: "finance",
      vendor: "Example Vendor",
      businessOwner: null,
      technicalOwner: null,
      hostingType: "saas",
      criticalityRating: "P1",
      status: "active",
    });
    expect(result.success).toBe(true);
  });

  it("rejects unsupported application hosting and criticality values", () => {
    const result = insertCmdbApplicationSchema.safeParse({
      name: "Payroll Platform",
      category: "finance",
      hostingType: "unknown",
      criticalityRating: "P5",
      status: "active",
    });
    expect(result.success).toBe(false);
  });

  it("accepts infrastructure records and rejects unsupported environment or status values", () => {
    expect(insertServerSchema.safeParse({
      hostname: "srv-prod-01",
      ipAddress: "10.0.0.10",
      osPlatform: "ubuntu_server",
      environment: "production",
      cpuRamSpecs: "8 vCPU / 32 GB RAM",
      location: "Riyadh DC",
      status: "online",
    }).success).toBe(true);
    expect(insertServerSchema.safeParse({
      hostname: "srv-prod-01",
      osPlatform: "ubuntu_server",
      environment: "test",
      status: "unknown",
    }).success).toBe(false);
  });

  it("requires a document version and valid document metadata", () => {
    expect(insertConfigurationDocumentSchema.safeParse({
      applicationId: "application-id",
      serverId: null,
      documentType: "runbook",
      version: 1,
      originalName: "operations.docx",
      fileName: "generated.docx",
      fileType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      fileSize: 1024,
      filePath: "server/uploads/generated.docx",
      uploadedBy: null,
    }).success).toBe(true);
    expect(insertConfigurationDocumentSchema.safeParse({
      documentType: "",
      version: 0,
      originalName: "",
      fileName: "",
      filePath: "x",
    }).success).toBe(false);
  });
});
