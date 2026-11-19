import { afterEach, describe, expect, it, vi } from "vitest";

const { pdfDocument, createPdf, autoTable } = vi.hoisted(() => {
  const document = {
    internal: { pageSize: { getWidth: vi.fn(() => 600) } },
    setFontSize: vi.fn(),
    setFont: vi.fn(),
    text: vi.fn(),
    splitTextToSize: vi.fn((text: string) => [text]),
    save: vi.fn(),
  };
  return {
    pdfDocument: document,
    createPdf: vi.fn(function () { return document; }),
    autoTable: vi.fn(),
  };
});

vi.mock("jspdf", () => ({ default: createPdf }));
vi.mock("jspdf-autotable", () => ({ default: autoTable }));
const reportUtils = import("./report-utils");

describe("change report file generation", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    createPdf.mockClear();
    autoTable.mockClear();
    pdfDocument.setFontSize.mockClear();
    pdfDocument.setFont.mockClear();
    pdfDocument.text.mockClear();
    pdfDocument.splitTextToSize.mockClear();
    pdfDocument.save.mockClear();
  });

  it("sends the expected Excel filename, columns, and change values without a browser download", async () => {
    const { exportToExcel } = await reportUtils;
    const columns = [
      { header: "Change #", key: "changeNumber", width: 14 },
      { header: "Title", key: "title", width: 30 },
      { header: "Status", key: "status", width: 14 },
    ];
    const changes = [{
      changeNumber: "CHG-2026-042",
      title: "Database failover",
      status: "In Progress",
    }];
    const filters = [{ label: "Status", value: "In Progress" }];
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      blob: async () => new Blob(["workbook"]),
    });
    vi.stubGlobal("fetch", fetchMock);

    const originalCreateObjectURL = Object.getOwnPropertyDescriptor(window.URL, "createObjectURL");
    const originalRevokeObjectURL = Object.getOwnPropertyDescriptor(window.URL, "revokeObjectURL");
    const createObjectURL = vi.fn(() => "blob:change-report");
    const revokeObjectURL = vi.fn();
    Object.defineProperty(window.URL, "createObjectURL", { configurable: true, value: createObjectURL });
    Object.defineProperty(window.URL, "revokeObjectURL", { configurable: true, value: revokeObjectURL });
    let downloadedFilename: string | undefined;
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (this: HTMLAnchorElement) {
      downloadedFilename = this.download;
    });

    try {
      await exportToExcel(changes, columns, "changes-report", filters);

      expect(fetchMock).toHaveBeenCalledOnce();
      expect(fetchMock.mock.calls[0][0]).toBe("/api/report-exports/xlsx");
      const request = fetchMock.mock.calls[0][1] as RequestInit;
      expect(request.method).toBe("POST");
      expect(request.credentials).toBe("include");
      expect(JSON.parse(request.body as string)).toEqual({
        data: [{
          changeNumber: "CHG-2026-042",
          title: "Database failover",
          status: "In Progress",
        }],
        columns,
        filename: "changes-report",
        filters,
      });
      expect(createObjectURL).toHaveBeenCalledOnce();
      expect(downloadedFilename).toBe("changes-report.xlsx");
      expect(revokeObjectURL).toHaveBeenCalledWith("blob:change-report");
    } finally {
      clickSpy.mockRestore();
      if (originalCreateObjectURL) {
        Object.defineProperty(window.URL, "createObjectURL", originalCreateObjectURL);
      } else {
        Reflect.deleteProperty(window.URL, "createObjectURL");
      }
      if (originalRevokeObjectURL) {
        Object.defineProperty(window.URL, "revokeObjectURL", originalRevokeObjectURL);
      } else {
        Reflect.deleteProperty(window.URL, "revokeObjectURL");
      }
    }
  });

  it("creates a PDF with the expected filename, headings, filters, and change values", async () => {
    const { exportToPDF } = await reportUtils;

    exportToPDF(
      [["CHG-2026-042", "Database failover", "In Progress"]],
      ["Change #", "Title", "Status"],
      "Change Management Report",
      "changes-report",
      "landscape",
      [{ label: "Status", value: "In Progress" }],
    );

    expect(createPdf).toHaveBeenCalledWith({ orientation: "landscape" });
    expect(pdfDocument.text).toHaveBeenCalledWith("Change Management Report", 14, 15);
    expect(pdfDocument.text).toHaveBeenCalledWith("Applied filters", 14, 30);
    expect(pdfDocument.text).toHaveBeenCalledWith(["Status: In Progress"], 14, 36);
    expect(autoTable).toHaveBeenCalledWith(pdfDocument, expect.objectContaining({
      head: [["Change #", "Title", "Status"]],
      body: [["CHG-2026-042", "Database failover", "In Progress"]],
      startY: 47,
    }));
    expect(pdfDocument.save).toHaveBeenCalledWith("changes-report.pdf");
  });
});
