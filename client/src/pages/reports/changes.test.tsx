import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { exportToExcel, exportToPDF } from "@/lib/report-utils";
import ChangesReport from "./changes";

const { printMock } = vi.hoisted(() => ({ printMock: vi.fn() }));

vi.mock("react-to-print", () => ({
  useReactToPrint: () => printMock,
}));

vi.mock("@/lib/report-utils", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/report-utils")>();
  return {
    ...actual,
    exportToExcel: vi.fn(),
    exportToPDF: vi.fn(),
  };
});

function makeApproval(id: string, decision: string | null, removedAt: string | null = null) {
  return {
    id,
    changeId: "report-change-1",
    decision,
    removedAt,
    comments: null,
    approver: undefined,
  };
}

const globalSummary = {
  total: 51,
  draft: 1,
  submitted: 1,
  approved: 1,
  rejected: 1,
  inProgress: 1,
  completed: 1,
  emergency: 1,
};

const history = Array.from({ length: 51 }, (_, index) => ({
  id: `report-change-${index + 1}`,
  changeNumber: `CHG-${index + 1}`,
  title: index === 0 ? "Mixed CAB decisions" : `Report change ${index + 1}`,
  type: index === 0 || index === 50 ? "emergency" : "normal",
  status: index === 50 ? "completed" : index === 0 ? "draft" : "requested",
  priority: "medium",
  risk: "low",
  createdAt: "2026-10-01T00:00:00.000Z",
  approvals: index === 0
    ? [
      makeApproval("active-approved", "approved"),
      makeApproval("active-pending", "pending"),
      makeApproval("active-null", null),
    ]
    : index === 50 ? [makeApproval("last-page-null", null)] : [],
  removedApprovals: index === 0 ? [makeApproval("removed-pending", "pending", "2026-10-02T00:00:00.000Z")] : [],
}));

function summaryValue(label: string) {
  const card = screen.getAllByText(label)
    .map(labelNode => labelNode.closest<HTMLElement>('[class*="rounded-lg"]'))
    .find((candidate): candidate is HTMLElement => candidate !== null);
  if (!card) throw new Error(`Could not find summary card for ${label}`);
  return within(card).getByText(/^\d+$/).textContent;
}

describe("change report page", () => {
  let queryClient: QueryClient;
  let requests: string[];
  let reportRows: typeof history;
  let reportSummary: typeof globalSummary;
  let failExportPage: number | null;
  let exportPageTwoGate: Promise<void> | null;
  let onExportPageTwoRequest: (() => void) | null;

  beforeEach(() => {
    queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    requests = [];
    reportRows = history;
    reportSummary = globalSummary;
    failExportPage = null;
    exportPageTwoGate = null;
    onExportPageTwoRequest = null;
    vi.mocked(exportToExcel).mockClear();
    vi.mocked(exportToPDF).mockClear();
    printMock.mockClear();
    HTMLElement.prototype.hasPointerCapture = () => false;
    HTMLElement.prototype.setPointerCapture = () => {};
    HTMLElement.prototype.releasePointerCapture = () => {};
    HTMLElement.prototype.scrollIntoView = () => {};
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      requests.push(url);
      const params = new URL(url, "http://report.test").searchParams;
      const status = params.get("status");
      const type = params.get("type");
      const risk = params.get("risk");
      const search = params.get("search")?.toLowerCase();
      const matching = reportRows.filter(change =>
        (!status || status === "all" || change.status === status)
        && (!type || type === "all" || change.type === type)
        && (!risk || risk === "all" || change.risk === risk)
        && (!search || change.changeNumber.toLowerCase().includes(search) || change.title.toLowerCase().includes(search)),
      );
      const page = Number(params.get("page") || 1);
      const pageSize = Number(params.get("pageSize") || 50);
      if (pageSize === 100 && page === 2) {
        onExportPageTwoRequest?.();
        if (exportPageTwoGate) await exportPageTwoGate;
      }
      if (pageSize === 100 && page === failExportPage) {
        return {
          ok: false,
          status: 500,
          statusText: "Internal Server Error",
          text: async () => "Batch 2 could not be loaded",
        };
      }
      const offset = (page - 1) * pageSize;
      return {
        ok: true,
        json: async () => ({
          changes: matching.slice(offset, offset + pageSize).map(({ approvals, removedApprovals, ...change }) => {
            const activeApprovals = approvals.filter(approval => !approval.removedAt);
            return {
              ...change,
              scheduledStart: null,
              scheduledEnd: null,
              requestedByLabel: null,
              assignedToLabel: null,
              activeApprovalCount: activeApprovals.length,
              approvedCount: activeApprovals.filter(approval => approval.decision === "approved").length,
              pendingCount: activeApprovals.filter(approval =>
                !approval.decision || approval.decision === "pending",
              ).length,
            };
          }),
          total: matching.length,
          page,
          pageSize,
          summary: reportSummary,
        }),
      };
    }));
  });

  afterEach(() => {
    cleanup();
    queryClient.clear();
    vi.unstubAllGlobals();
  });

  it("keeps summary cards global across pages and filters and displays null decisions as pending", async () => {
    const user = userEvent.setup();
    render(<QueryClientProvider client={queryClient}><ChangesReport /></QueryClientProvider>);

    expect(await screen.findByText("Mixed CAB decisions")).toBeTruthy();
    expect(summaryValue("Total")).toBe("51");
    expect(summaryValue("Draft")).toBe("1");
    expect(screen.getByText("1✓")).toBeTruthy();
    expect(screen.getByText("2 pending")).toBeTruthy();

    await user.click(screen.getByRole("button", { name: "Next" }));
    expect(await screen.findByText("Report change 51")).toBeTruthy();
    expect(summaryValue("Total")).toBe("51");
    expect(screen.getByText("1 pending")).toBeTruthy();
    expect(requests.some(url => new URL(url, "http://report.test").searchParams.get("page") === "2")).toBe(true);

    await user.click(screen.getAllByRole("combobox")[0]);
    await user.click(screen.getByRole("option", { name: "Completed" }));
    expect(await screen.findByText("Report change 51")).toBeTruthy();
    expect(await screen.findByText((_, element) =>
      element?.tagName === "P" && element.textContent?.includes("1 matching changes") === true,
    )).toBeTruthy();
    expect(summaryValue("Total")).toBe("51");
    expect(summaryValue("Completed")).toBe("1");
    expect(requests.some(url => new URL(url, "http://report.test").searchParams.get("status") === "completed")).toBe(true);
  });

  it("returns to the last valid page when matching changes are removed", async () => {
    const user = userEvent.setup();
    render(<QueryClientProvider client={queryClient}><ChangesReport /></QueryClientProvider>);

    expect(await screen.findByText("Mixed CAB decisions")).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Next" }));
    expect(await screen.findByText("Report change 51")).toBeTruthy();
    expect(screen.getByText("Page 2 of 2")).toBeTruthy();

    reportRows = history.slice(0, 42);
    reportSummary = { ...globalSummary, total: 42, completed: 0, emergency: 0 };
    await queryClient.invalidateQueries({ queryKey: ["/api/reports/changes"] });

    expect(await screen.findByText("Report change 42")).toBeTruthy();
    await waitFor(() => {
      expect(screen.getByText("Page 1 of 1")).toBeTruthy();
      expect(screen.getByText((_, element) =>
        element?.tagName === "P" && element.textContent?.includes("Showing 1–42 of 42 matching changes") === true,
      )).toBeTruthy();
    });
    expect(screen.queryByText("Report change 51")).toBeNull();
    expect(summaryValue("Total")).toBe("42");
    expect(summaryValue("Completed")).toBe("0");
    expect(summaryValue("Emergency")).toBe("0");
    expect(requests.some(url => new URL(url, "http://report.test").searchParams.get("page") === "1")).toBe(true);
  });

  it.each(["Excel", "PDF", "Print"])("loads every matching page with active filters for %s export", async (exportType) => {
    const user = userEvent.setup();
    reportRows = Array.from({ length: 251 }, (_, index) => ({
      id: `export-change-${index + 1}`,
      changeNumber: `EXP-${index + 1}`,
      title: `Export batch ${index + 1}`,
      type: "emergency",
      status: "completed",
      priority: "medium",
      risk: "high",
      createdAt: "2026-10-01T00:00:00.000Z",
      approvals: [],
      removedApprovals: [],
    }));
    render(<QueryClientProvider client={queryClient}><ChangesReport /></QueryClientProvider>);

    const searchInput = screen.getByPlaceholderText("Search change #, title...");
    await user.type(searchInput, "Export batch");
    const activeFilters = ["Completed", "Emergency", "High"];
    for (let index = 0; index < activeFilters.length; index += 1) {
      await user.click(screen.getAllByRole("combobox")[index]);
      await user.click(screen.getByRole("option", { name: activeFilters[index] }));
    }
    expect(await screen.findByText("Export batch 1")).toBeTruthy();
    await waitFor(() => {
      expect(requests.some(url => {
        const params = new URL(url, "http://report.test").searchParams;
        return params.get("search") === "Export batch"
          && params.get("status") === "completed"
          && params.get("type") === "emergency"
          && params.get("risk") === "high";
      })).toBe(true);
    });
    requests = [];

    await user.click(screen.getByRole("button", { name: exportType }));

    await waitFor(() => {
      if (exportType === "Excel") expect(exportToExcel).toHaveBeenCalled();
      if (exportType === "PDF") expect(exportToPDF).toHaveBeenCalled();
      if (exportType === "Print") {
        expect(printMock).toHaveBeenCalled();
        expect(screen.getByText((_, element) =>
          element?.tagName === "P" && element.textContent?.includes("Showing 251 of 251 matching changes") === true,
        )).toBeTruthy();
      }
    });
    const exportRequests = requests.filter(url =>
      new URL(url, "http://report.test").searchParams.get("pageSize") === "100",
    );
    expect(exportRequests.map(url =>
      new URL(url, "http://report.test").searchParams.get("page"),
    )).toEqual(["1", "2", "3"]);
    for (const url of exportRequests) {
      const params = new URL(url, "http://report.test").searchParams;
      expect(params.get("search")).toBe("Export batch");
      expect(params.get("status")).toBe("completed");
      expect(params.get("type")).toBe("emergency");
      expect(params.get("risk")).toBe("high");
    }

    if (exportType === "Excel") expect(vi.mocked(exportToExcel).mock.calls[0][0]).toHaveLength(251);
    if (exportType === "PDF") expect(vi.mocked(exportToPDF).mock.calls[0][0]).toHaveLength(251);
  });

  it("shows batch progress and blocks other export actions until loading finishes", async () => {
    const user = userEvent.setup();
    reportRows = Array.from({ length: 251 }, (_, index) => ({
      id: `progress-change-${index + 1}`,
      changeNumber: `PROG-${index + 1}`,
      title: `Progress change ${index + 1}`,
      type: "normal",
      status: "completed",
      priority: "medium",
      risk: "low",
      createdAt: "2026-10-01T00:00:00.000Z",
      approvals: [],
      removedApprovals: [],
    }));

    let releasePageTwo!: () => void;
    exportPageTwoGate = new Promise<void>((resolve) => {
      releasePageTwo = resolve;
    });
    let pageTwoRequested!: () => void;
    const pageTwoRequest = new Promise<void>((resolve) => {
      pageTwoRequested = resolve;
    });
    onExportPageTwoRequest = pageTwoRequested;

    render(<QueryClientProvider client={queryClient}><ChangesReport /></QueryClientProvider>);
    expect(await screen.findByText("Progress change 1")).toBeTruthy();

    await user.click(screen.getByRole("button", { name: "Excel" }));
    await pageTwoRequest;
    expect(screen.getByText(/Excel report: loaded 100 of 251 matching changes \(batch 1 of 3\)/)).toBeTruthy();
    expect(screen.getByRole("progressbar", { name: "Excel report loading progress" }).getAttribute("value")).toBe("100");
    expect(screen.getByRole("button", { name: "Excel" }).hasAttribute("disabled")).toBe(true);
    expect(screen.getByRole("button", { name: "PDF" }).hasAttribute("disabled")).toBe(true);
    expect(screen.getByRole("button", { name: "Print" }).hasAttribute("disabled")).toBe(true);

    releasePageTwo();
    await waitFor(() => expect(exportToExcel).toHaveBeenCalled());
    expect(screen.queryByRole("status")).toBeNull();
  });

  it.each(["Excel", "PDF", "Print"])("shows a retry after a failed batch for %s export", async (exportType) => {
    const user = userEvent.setup();
    reportRows = Array.from({ length: 251 }, (_, index) => ({
      id: `retry-change-${index + 1}`,
      changeNumber: `RETRY-${index + 1}`,
      title: `Retry change ${index + 1}`,
      type: "normal",
      status: "completed",
      priority: "medium",
      risk: "low",
      createdAt: "2026-10-01T00:00:00.000Z",
      approvals: [],
      removedApprovals: [],
    }));
    failExportPage = 2;

    render(<QueryClientProvider client={queryClient}><ChangesReport /></QueryClientProvider>);
    expect(await screen.findByText("Retry change 1")).toBeTruthy();

    await user.click(screen.getByRole("button", { name: exportType }));
    const errorNotice = await screen.findByRole("alert");
    expect(errorNotice.textContent).toContain(`${exportType} report failed: 500: Batch 2 could not be loaded`);
    expect(within(errorNotice).getByRole("button", { name: `Retry ${exportType}` })).toBeTruthy();

    failExportPage = null;
    await user.click(within(errorNotice).getByRole("button", { name: `Retry ${exportType}` }));
    await waitFor(() => {
      if (exportType === "Excel") expect(exportToExcel).toHaveBeenCalled();
      if (exportType === "PDF") expect(exportToPDF).toHaveBeenCalled();
      if (exportType === "Print") expect(printMock).toHaveBeenCalled();
    });
    expect(screen.queryByRole("alert")).toBeNull();
  });
});
