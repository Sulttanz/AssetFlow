import { describe, expect, it } from "vitest";
import { matchesKnowledgeBaseTab } from "./knowledge-base-filters";

describe("Knowledge Base tab filters", () => {
  it("includes repository-synced system manuals in User Guides regardless of category", () => {
    for (const category of [
      "Getting Started & Platform Overview",
      "Employee Support",
      "Project Management & Governance",
      "ITIL Service Operation & Change Management",
      "GRC & Compliance",
      "Technical SOP",
    ]) {
      expect(matchesKnowledgeBaseTab("guide", { category, isSystemGuide: true })).toBe(true);
    }
  });

  it("continues to match ordinary articles by their category", () => {
    expect(matchesKnowledgeBaseTab("policy", { category: "Policy" })).toBe(true);
    expect(matchesKnowledgeBaseTab("sop", { category: "Technical SOP" })).toBe(true);
    expect(matchesKnowledgeBaseTab("guide", { category: "User Guide" })).toBe(true);
    expect(matchesKnowledgeBaseTab("kedb", { category: "KEDB Article" })).toBe(true);
  });

  it("does not classify an unrelated custom article as a user guide", () => {
    expect(matchesKnowledgeBaseTab("guide", {
      category: "Project Management & Governance",
      isSystemGuide: false,
    })).toBe(false);
  });
});
