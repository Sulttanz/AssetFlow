import { describe, expect, it } from "vitest";
import { buildReportWorkbook, reportExportSchema } from "./report-export";
import ExcelJS from "exceljs";

describe("spreadsheet report generation", () => {
  it("preserves report columns, values, widths, and header styling", () => {
    const input = reportExportSchema.parse({
      filename: "asset-report",
      columns: [
        { header: "Asset", key: "name", width: 25 },
        { header: "Value", key: "value" },
        { header: "Date", key: "date" },
      ],
      data: [{ name: "Laptop", value: 1200, date: "2026-10-21" }],
    });
    const sheet = buildReportWorkbook(input).getWorksheet("Report")!;
    expect(sheet.getRow(1).values).toEqual([, "Asset", "Value", "Date"]);
    expect(sheet.getRow(2).values).toEqual([, "Laptop", 1200, "21-10-2026"]);
    expect(sheet.getColumn(1).width).toBe(25);
    expect(sheet.getRow(1).font.bold).toBe(true);
    expect(sheet.autoFilter).toEqual({ from: { row: 1, column: 1 }, to: { row: 1, column: 3 } });
  });

  it("rejects invalid and oversized export definitions", () => {
    expect(reportExportSchema.safeParse({ filename: "../report", columns: [], data: [] }).success).toBe(false);
    expect(reportExportSchema.safeParse({
      filename: "report",
      columns: [{ header: "Name", key: "name", width: 101 }],
      data: [],
    }).success).toBe(false);
  });

  it("serializes a valid XLSX workbook without changing report values", async () => {
    const buffer = await buildReportWorkbook({
      filename: "report",
      columns: [{ header: "Name", key: "name" }],
      data: [{ name: "Finance & Operations" }],
    }).xlsx.writeBuffer();
    const reopened = new ExcelJS.Workbook();
    await reopened.xlsx.load(buffer);
    expect(reopened.getWorksheet("Report")!.getCell("A2").value).toBe("Finance & Operations");
  });
});
