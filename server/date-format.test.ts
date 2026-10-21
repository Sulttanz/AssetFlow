// @vitest-environment node
import { describe, expect, it } from "vitest";
import { execFileSync } from "node:child_process";
import {
  formatDateDisplay, formatDateTime, formatDateTimeMinute, toDateInputValue, toDateTimeInputValue,
  parseDateValue, toSpreadsheetDateInput, formatExportValue,
} from "../shared/date-format";

describe("global day-month-year dates", () => {
  it.each([
    ["2026-01-09", "09-01-2026"], ["2026-12-03", "03-12-2026"],
    ["29-02-2024", "29-02-2024"], ["08/07/2026", "08-07-2026"],
  ])("renders %s without swapping day and month", (value, expected) => {
    expect(formatDateDisplay(value)).toBe(expected);
  });

  it.each(["2026-02-29", "31-04-2026", "12/31/2026", "2026-13-01", "bad", "2026-02-30T10:00:00Z"])("rejects invalid or ambiguous dates: %s", value => {
    expect(parseDateValue(value)).toBeUndefined();
    expect(toDateInputValue(value)).toBe("");
    expect(formatDateDisplay(value)).toBe("—");
  });

  it("preserves calendar dates and picker values in western, eastern, and DST timezones", () => {
    for (const TZ of ["UTC", "America/Los_Angeles", "Pacific/Kiritimati", "Asia/Riyadh"]) {
      const result = execFileSync(process.execPath, ["--import", "tsx", "--input-type=module", "-e", `
        import { formatDateDisplay, toDateInputValue, toDateTimeInputValue, parseDateValue, toSpreadsheetDateInput } from "./shared/date-format.ts";
        console.log(JSON.stringify({
          display: formatDateDisplay("2026-03-08"),
          input: toDateInputValue("08-03-2026"),
          pickerDay: parseDateValue("2026-03-08").getDate(),
          localInput: toDateInputValue(new Date(2026, 0, 2, 0, 15)),
          datetime: toDateTimeInputValue("2026-03-08T01:30:00"),
          excel: toSpreadsheetDateInput(new Date("2024-01-01T00:00:00Z")),
        }));
      `], { cwd: process.cwd(), env: { ...process.env, TZ }, encoding: "utf8" });
      expect(JSON.parse(result), TZ).toEqual({
        display: "08-03-2026", input: "2026-03-08", pickerDay: 8,
        localInput: "2026-01-02", datetime: "2026-03-08T01:30", excel: "2024-01-01",
      });
    }
  }, 15000);

  it("preserves timestamp times and ISO input contracts", () => {
    const date = new Date(2026, 10, 5, 14, 9, 7);
    expect(formatDateTime(date)).toBe("05-11-2026 14:09:07");
    expect(formatDateTimeMinute(date)).toBe("05-11-2026 14:09");
    expect(toDateTimeInputValue(date)).toBe("2026-11-05T14:09");
    expect(formatDateDisplay(new Date("invalid"))).toBe("—");
    expect(toDateInputValue(null)).toBe("");
  });

  it("roundtrips DMY spreadsheets and Excel date cells without locale guessing", () => {
    expect(toSpreadsheetDateInput(45292)).toBe("2024-01-01");
    expect(toSpreadsheetDateInput("29-02-2024")).toBe("2024-02-29");
    expect(toSpreadsheetDateInput("2024-02-29")).toBe("2024-02-29");
    expect(toSpreadsheetDateInput("31-02-2024")).toBe("");
    expect(formatExportValue("2024-02-29")).toBe("29-02-2024");
    expect(formatExportValue(45292)).toBe(45292);
    expect(formatExportValue("Asset 2024-02-29")).toBe("Asset 2024-02-29");
  });
});
