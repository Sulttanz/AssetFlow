import { afterEach, describe, expect, it, vi } from "vitest";
import { exportRisks } from "./risk-exports";
import type { RiskRecord } from "./risk-types";

const pdf = vi.hoisted(() => ({ table: vi.fn(), save: vi.fn() }));
vi.mock("jspdf", () => ({ default: class {
  setFontSize() {} text() {} addPage() {} save = pdf.save;
} }));
vi.mock("jspdf-autotable", () => ({ default: pdf.table }));
afterEach(() => vi.restoreAllMocks());
const row = {
  id: "risk-1", riskNumber: "IT-RSK-001", title: "=HYPERLINK(\"unsafe\")", category: "Cybersecurity & Vulnerability",
  owner: { id: "owner-1", firstName: "IT", lastName: "Owner" }, status: "mitigating",
  likelihood: 5, impact: 4, residualLikelihood: 2, residualImpact: 3, targetLikelihood: 1, targetImpact: 2,
  treatmentStrategy: "Mitigate", nextReviewDate: "2027-02-03", existingControls: "Managed EDR",
  mitigation: "Patch endpoints", acceptanceExpiresAt: null,
  mitigationActions: [
    { title: "Overdue patch", status: "In Progress", ownerUserId: "owner-1", dueDate: "2020-01-01", evidenceNotes: "Pending evidence" },
    { title: "Completed patch", status: "Completed", dueDate: "2020-01-01" },
  ],
} as unknown as RiskRecord;
describe("Internal IT risk report exports", () => {
  it("exports the passed filtered dataset, selected matrix and overdue actions with safe CSV cells", async () => {
    let captured: Blob | undefined;
    Object.defineProperty(URL, "createObjectURL", { configurable: true, value: vi.fn((blob: Blob) => { captured = blob; return "blob:qa-export"; }) });
    Object.defineProperty(URL, "revokeObjectURL", { configurable: true, value: vi.fn() });
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
    await exportRisks([row], "Residual", "csv");
    const text = await new Promise<string>(resolve => {
      const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.readAsText(captured!);
    });
    expect(text).toContain("IT-RSK-001");
    expect(text).toContain(`"'=HYPERLINK(""unsafe"")"`);
    expect(text).toContain("03-02-2027");
    expect(text).toContain("Residual matrix");
    expect(text).toContain("Overdue patch");
    expect(text).not.toContain("Completed patch");
  });
  it("writes risk, matrix and overdue action tables into the executive PDF", async () => {
    await exportRisks([row], "Target", "pdf");
    expect(pdf.table).toHaveBeenCalledTimes(3);
    expect(pdf.table.mock.calls[0][1].body[0]).toContain("IT-RSK-001");
    expect(pdf.table.mock.calls[1][1].body[3]).toEqual(["2", "1", "0", "0", "0", "0"]);
    expect(pdf.table.mock.calls[2][1].body[0][1]).toBe("Overdue patch");
    expect(pdf.save).toHaveBeenCalledWith(expect.stringMatching(/^Executive-IT-Risk-Report-\d{4}-\d{2}-\d{2}\.pdf$/));
  });
});
