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

  it("includes active filters on a separate sheet and omits that sheet when unfiltered", () => {
    const input = reportExportSchema.parse({
      filename: "change-report",
      columns: [{ header: "Change #", key: "changeNumber" }],
      data: [{ changeNumber: "CHG-1" }],
      filters: [
        { label: "Status", value: "Completed" },
        { label: "Scheduled start from", value: "01-10-2026" },
      ],
    });
    const workbook = buildReportWorkbook(input);
    const filtersSheet = workbook.getWorksheet("Applied filters")!;
    expect(filtersSheet.getRow(1).values).toEqual([, "Filter", "Applied value"]);
    expect(filtersSheet.getRow(2).values).toEqual([, "Status", "Completed"]);
    expect(filtersSheet.getRow(3).values).toEqual([, "Scheduled start from", "01-10-2026"]);
    expect(workbook.getWorksheet("Report")!.getRow(1).values).toEqual([, "Change #"]);

    const unfiltered = buildReportWorkbook(reportExportSchema.parse({
      filename: "change-report",
      columns: [{ header: "Change #", key: "changeNumber" }],
      data: [],
    }));
    expect(unfiltered.getWorksheet("Applied filters")).toBeUndefined();
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
