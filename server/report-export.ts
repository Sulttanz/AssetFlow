import ExcelJS from "exceljs";
import { z } from "zod";
import { formatExportValue } from "@shared/date-format";

export const reportExportSchema = z.object({
  data: z.array(z.record(z.string(), z.unknown())).max(100000),
  columns: z.array(z.object({
    header: z.string().max(500),
    key: z.string().min(1).max(200).refine(
      key => !["__proto__", "constructor", "prototype"].includes(key),
      "Invalid report column key",
    ),
    width: z.number().min(1).max(100).optional(),
  })).min(1).max(200),
  filename: z.string().trim().min(1).max(120).regex(/^[a-zA-Z0-9][a-zA-Z0-9 _.-]*$/),
}).strict();

export function buildReportWorkbook(input: z.infer<typeof reportExportSchema>): ExcelJS.Workbook {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet("Report");
  worksheet.columns = input.columns.map(column => ({
    header: column.header,
    key: column.key,
    width: column.width ?? 15,
  }));
  worksheet.getRow(1).font = { color: { argb: "FFFFFFFF" }, bold: true };
  worksheet.getRow(1).fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FF4A5568" },
  };
  for (const item of input.data) {
    worksheet.addRow(Object.fromEntries(input.columns.map(column => [
      column.key,
      formatExportValue(item[column.key]),
    ])));
  }
  worksheet.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: 1, column: input.columns.length },
  };
  return workbook;
}
