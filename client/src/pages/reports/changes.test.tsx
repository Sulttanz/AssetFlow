import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { exportToExcel, exportToPDF, formatDate } from "@/lib/report-utils";
import ChangesReport from "./changes";

const { printMock, authState } = vi.hoisted(() => ({
  printMock: vi.fn(),
  authState: { userId: "viewer-1" as string | null },
}));

vi.mock("react-to-print", () => ({
  useReactToPrint: () => printMock,
}));

vi.mock("@/hooks/use-auth", () => ({
  useAuth: () => ({ user: authState.userId ? { id: authState.userId } : null }),
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
  scheduledStart: `2026-10-${String((index % 5) + 1).padStart(2, "0")}T00:00:00.000Z`,
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
    .map(labelNode => labelNode.closest<HTMLElement>('[data-slot="card"]'))
    .find((candidate): candidate is HTMLElement => candidate !== null);
  if (!card) throw new Error(`Could not find summary card for ${label}`);
  return within(card).getByText(/^\d+$/).textContent;
}

describe("change report page", () => {
  let queryClient: QueryClient;
  let requests: string[];
  let reportRows: Array<Omit<typeof history[number], "scheduledStart"> & { scheduledStart?: string | null }>;
  let reportSummary: typeof globalSummary;
  let failExportPage: number | null;
  let exportPageTwoGate: Promise<void> | null;
  let onExportPageTwoRequest: (() => void) | null;

  beforeEach(() => {
    queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    authState.userId = "viewer-1";
    window.localStorage.clear();
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
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      requests.push(url);
      const params = new URL(url, "http://report.test").searchParams;
      const status = params.get("status");
      const type = params.get("type");
      const risk = params.get("risk");
      const scheduledStartFrom = params.get("scheduledStartFrom");
      const scheduledStartTo = params.get("scheduledStartTo");
      const search = params.get("search")?.toLowerCase();
      const page = Number(params.get("page") || 1);
      const pageSize = Number(params.get("pageSize") || 50);
      if (pageSize === 100 && page === 2) {
        onExportPageTwoRequest?.();
        if (exportPageTwoGate) {
          const signal = init?.signal;
          const gate = exportPageTwoGate;
          await new Promise<void>((resolve, reject) => {
            const onAbort = () => {
              signal?.removeEventListener("abort", onAbort);
              reject(new DOMException("The operation was aborted.", "AbortError"));
            };
            if (signal?.aborted) {
              onAbort();
              return;
            }
            signal?.addEventListener("abort", onAbort, { once: true });
            gate.then(() => {
              signal?.removeEventListener("abort", onAbort);
              resolve();
            });
          });
        }
      }
      if (pageSize === 100 && page === failExportPage) {
        return {
          ok: false,
          status: 500,
          statusText: "Internal Server Error",
          text: async () => "Batch 2 could not be loaded",
        };
      }
      const matching = reportRows.filter(change =>
        (!status || status === "all" || change.status === status)
        && (!type || type === "all" || change.type === type)
        && (!risk || risk === "all" || change.risk === risk)
        && (!scheduledStartFrom || (!!change.scheduledStart && change.scheduledStart.slice(0, 10) >= scheduledStartFrom))
        && (!scheduledStartTo || (!!change.scheduledStart && change.scheduledStart.slice(0, 10) <= scheduledStartTo))
        && (!search || change.changeNumber.toLowerCase().includes(search) || change.title.toLowerCase().includes(search)),
      );
      if (params.get("exportSnapshot") === "true") {
        const changeIds = [...matching]
          .sort((left, right) => right.changeNumber.localeCompare(left.changeNumber))
          .map(change => change.id);
        return {
          ok: true,
          json: async () => ({ changeIds }),
        };
      }
      const exportChangeIds = params.get("exportChangeIds");
      const cursorPaging = params.get("cursorPaging") === "true";
      let pageChanges = matching;
      if (exportChangeIds) {
        pageChanges = exportChangeIds.split(",")
          .map(id => reportRows.find(change => change.id === id))
          .filter((change): change is (typeof reportRows)[number] => !!change);
      } else if (cursorPaging) {
        pageChanges = matching.sort((left, right) =>
          right.changeNumber.localeCompare(left.changeNumber),
        );
        const cursorChangeNumber = params.get("cursorChangeNumber");
        if (cursorChangeNumber) {
          pageChanges = pageChanges.filter(change => change.changeNumber.localeCompare(cursorChangeNumber) < 0);
        }
      } else {
        const offset = (page - 1) * pageSize;
        pageChanges = matching.slice(offset, offset + pageSize);
      }
      return {
        ok: true,
        json: async () => ({
          changes: pageChanges.slice(0, pageSize).map(({ approvals, removedApprovals, ...change }) => {
            const activeApprovals = approvals.filter(approval => !approval.removedAt);
            return {
              ...change,
              scheduledStart: change.scheduledStart ?? null,
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

  it("offers supported page sizes, updates ranges, and resets to page one when the size changes", async () => {
    const user = userEvent.setup();
    render(<QueryClientProvider client={queryClient}><ChangesReport /></QueryClientProvider>);

    expect(await screen.findByText("Mixed CAB decisions")).toBeTruthy();
    expect(screen.getByText("Page 1 of 2")).toBeTruthy();
    const pageSizeSelect = screen.getByRole("combobox", { name: "Rows per page" });
    await user.click(pageSizeSelect);
    for (const size of ["25", "50", "100"]) {
      expect(screen.getByRole("option", { name: size })).toBeTruthy();
    }
    await user.click(screen.getByRole("option", { name: "25" }));

    expect(await screen.findByText("Page 1 of 3")).toBeTruthy();
    expect(screen.getByText((_, element) =>
      element?.tagName === "P" && element.textContent?.includes("Showing 1–25 of 51 matching changes") === true,
    )).toBeTruthy();
    expect(requests.some(url => {
      const params = new URL(url, "http://report.test").searchParams;
      return params.get("page") === "1" && params.get("pageSize") === "25";
    })).toBe(true);
    expect(summaryValue("Total")).toBe("51");

    await user.click(screen.getByRole("button", { name: "Next" }));
    expect(await screen.findByText("Report change 26")).toBeTruthy();
    expect(screen.getByText((_, element) =>
      element?.tagName === "P" && element.textContent?.includes("Showing 26–50 of 51 matching changes") === true,
    )).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Next" }));
    expect(await screen.findByText("Report change 51")).toBeTruthy();
    expect(screen.getByText("Page 3 of 3")).toBeTruthy();

    await user.click(pageSizeSelect);
    await user.click(screen.getByRole("option", { name: "100" }));
    expect(await screen.findByText("Mixed CAB decisions")).toBeTruthy();
    expect(screen.getByText("Page 1 of 1")).toBeTruthy();
    expect(screen.getByText((_, element) =>
      element?.tagName === "P" && element.textContent?.includes("Showing 1–51 of 51 matching changes") === true,
    )).toBeTruthy();
    expect(summaryValue("Total")).toBe("51");
    expect(requests.some(url => {
      const params = new URL(url, "http://report.test").searchParams;
      return params.get("page") === "1" && params.get("pageSize") === "100";
    })).toBe(true);
  });

  it("restores the saved page size for the same viewer after returning to the report", async () => {
    const user = userEvent.setup();
    const { unmount } = render(<QueryClientProvider client={queryClient}><ChangesReport /></QueryClientProvider>);

    expect(await screen.findByText("Mixed CAB decisions")).toBeTruthy();
    await user.click(screen.getByRole("combobox", { name: "Rows per page" }));
    await user.click(screen.getByRole("option", { name: "25" }));
    expect(await screen.findByText("Page 1 of 3")).toBeTruthy();
    expect(window.localStorage.getItem("change-report-page-size:viewer-1")).toBe("25");

    unmount();
    queryClient.clear();
    queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(<QueryClientProvider client={queryClient}><ChangesReport /></QueryClientProvider>);

    expect(await screen.findByText("Page 1 of 3")).toBeTruthy();
    expect(requests.some(url => new URL(url, "http://report.test").searchParams.get("pageSize") === "25")).toBe(true);
  });

  it.each(["10", "invalid"])("uses the default page size for an unsupported saved value: %s", async (savedValue) => {
    window.localStorage.setItem("change-report-page-size:viewer-1", savedValue);
    render(<QueryClientProvider client={queryClient}><ChangesReport /></QueryClientProvider>);

    expect(await screen.findByText("Mixed CAB decisions")).toBeTruthy();
    expect(screen.getByText("Page 1 of 2")).toBeTruthy();
    expect(requests.some(url => new URL(url, "http://report.test").searchParams.get("pageSize") === "50")).toBe(true);
  });

  it("keeps saved page sizes separate for different viewers", async () => {
    window.localStorage.setItem("change-report-page-size:viewer-1", "25");
    window.localStorage.setItem("change-report-page-size:viewer-2", "100");
    const { rerender } = render(<QueryClientProvider client={queryClient}><ChangesReport /></QueryClientProvider>);

    expect(await screen.findByText("Page 1 of 3")).toBeTruthy();
    authState.userId = "viewer-2";
    rerender(<QueryClientProvider client={queryClient}><ChangesReport /></QueryClientProvider>);

    expect(await screen.findByText("Page 1 of 1")).toBeTruthy();
    expect(requests.some(url => new URL(url, "http://report.test").searchParams.get("pageSize") === "100")).toBe(true);
  });

  it("filters scheduled start dates inclusively before pagination and can clear an empty result", async () => {
    const user = userEvent.setup();
    reportRows = [
      { ...history[0], id: "before", changeNumber: "DATE-0", title: "Before range", scheduledStart: "2026-10-01T23:59:59.999Z" },
      { ...history[1], id: "from-boundary", changeNumber: "DATE-1", title: "Start boundary", scheduledStart: "2026-10-02T00:00:00.000Z" },
      { ...history[2], id: "through-boundary", changeNumber: "DATE-2", title: "End boundary", scheduledStart: "2026-10-03T23:59:59.999Z" },
      { ...history[3], id: "after", changeNumber: "DATE-3", title: "After range", scheduledStart: "2026-10-04T00:00:00.000Z" },
    ];
    render(<QueryClientProvider client={queryClient}><ChangesReport /></QueryClientProvider>);

    expect(await screen.findByText("Before range")).toBeTruthy();
    await user.type(screen.getByLabelText("Scheduled start from"), "02-10-2026");
    await user.type(screen.getByLabelText("Scheduled start through"), "03-10-2026");

    expect(await screen.findByText("Start boundary")).toBeTruthy();
    expect(screen.queryByText("Before range")).toBeNull();
    expect(screen.queryByText("After range")).toBeNull();
    expect(screen.getByText("Page 1 of 1")).toBeTruthy();
    expect(screen.getByText((_, element) =>
      element?.tagName === "P" && element.textContent?.includes("Showing 1–2 of 2 matching changes") === true,
    )).toBeTruthy();
    expect(requests.some(url => {
      const params = new URL(url, "http://report.test").searchParams;
      return params.get("scheduledStartFrom") === "2026-10-02"
        && params.get("scheduledStartTo") === "2026-10-03";
    })).toBe(true);

    await user.clear(screen.getByLabelText("Scheduled start through"));
    await user.clear(screen.getByLabelText("Scheduled start from"));
    await user.type(screen.getByLabelText("Scheduled start from"), "05-10-2026");
    await waitFor(() => expect(screen.getByText("No changes match your filters.")).toBeTruthy());
    await user.click(screen.getByRole("button", { name: "Clear filters" }));
    expect(await screen.findByText("Before range")).toBeTruthy();
    expect((screen.getByLabelText("Scheduled start from") as HTMLInputElement).value).toBe("");
    expect((screen.getByLabelText("Scheduled start through") as HTMLInputElement).value).toBe("");
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
      scheduledStart: "2026-10-02T12:00:00.000Z",
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
    await user.type(screen.getByLabelText("Scheduled start from"), "01-10-2026");
    await user.type(screen.getByLabelText("Scheduled start through"), "03-10-2026");
    expect(await screen.findByText("Export batch 1")).toBeTruthy();
    await waitFor(() => {
      expect(requests.some(url => {
        const params = new URL(url, "http://report.test").searchParams;
        return params.get("search") === "Export batch"
          && params.get("status") === "completed"
          && params.get("type") === "emergency"
          && params.get("risk") === "high"
          && params.get("scheduledStartFrom") === "2026-10-01"
          && params.get("scheduledStartTo") === "2026-10-03";
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
      } else {
        expect(screen.getByRole("status").textContent).toContain(`${exportType} report is ready.`);
      }
    });
    const exportRequests = requests.filter(url =>
      new URL(url, "http://report.test").searchParams.has("exportChangeIds"),
    );
    expect(exportRequests.map(url =>
      new URL(url, "http://report.test").searchParams.get("page"),
    )).toEqual(["1", "2", "3"]);
    for (const url of exportRequests) {
      const params = new URL(url, "http://report.test").searchParams;
      expect(params.get("cursorPaging")).toBe("true");
      expect(params.has("search")).toBe(false);
      expect(params.has("status")).toBe(false);
      expect(params.has("type")).toBe(false);
      expect(params.has("risk")).toBe(false);
      expect(params.has("scheduledStartFrom")).toBe(false);
      expect(params.has("scheduledStartTo")).toBe(false);
    }
    const snapshotRequest = requests.find(url =>
      new URL(url, "http://report.test").searchParams.get("exportSnapshot") === "true",
    );
    expect(snapshotRequest).toBeTruthy();
    const snapshotParams = new URL(snapshotRequest!, "http://report.test").searchParams;
    expect(snapshotParams.get("search")).toBe("Export batch");
    expect(snapshotParams.get("status")).toBe("completed");
    expect(snapshotParams.get("type")).toBe("emergency");
    expect(snapshotParams.get("risk")).toBe("high");
    expect(snapshotParams.get("scheduledStartFrom")).toBe("2026-10-01");
    expect(snapshotParams.get("scheduledStartTo")).toBe("2026-10-03");

    if (exportType === "Excel") expect(vi.mocked(exportToExcel).mock.calls[0][0]).toHaveLength(251);
    if (exportType === "Excel") {
      expect(vi.mocked(exportToExcel).mock.calls[0][3]).toEqual([
        { label: "Search change #, title...", value: "Export batch" },
        { label: "Status", value: "Completed" },
        { label: "Type", value: "Emergency" },
        { label: "Risk", value: "High" },
        { label: "Scheduled start from", value: "01-10-2026" },
        { label: "Scheduled start through", value: "03-10-2026" },
      ]);
    }
    if (exportType === "PDF") {
      expect(vi.mocked(exportToPDF).mock.calls[0][0]).toHaveLength(251);
      expect(vi.mocked(exportToPDF).mock.calls[0][5]).toEqual([
        { label: "Search change #, title...", value: "Export batch" },
        { label: "Status", value: "Completed" },
        { label: "Type", value: "Emergency" },
        { label: "Risk", value: "High" },
        { label: "Scheduled start from", value: "01-10-2026" },
        { label: "Scheduled start through", value: "03-10-2026" },
      ]);
    }
    if (exportType === "Print") {
      expect(screen.getByText("Applied filters")).toBeTruthy();
      expect(screen.getByText("Search change #, title...: Export batch")).toBeTruthy();
      expect(screen.getByText("Scheduled start through: 03-10-2026")).toBeTruthy();
    }
  });

  it.each(["Excel", "PDF", "Print"])("uses the chosen fields and order for %s", async (exportType) => {
    const user = userEvent.setup();
    render(<QueryClientProvider client={queryClient}><ChangesReport /></QueryClientProvider>);
    expect(await screen.findByText("Mixed CAB decisions")).toBeTruthy();

    await user.click(screen.getByRole("button", { name: /Choose export fields/ }));
    await user.click(screen.getByRole("button", { name: "PDF defaults" }));
    await user.click(screen.getByRole("button", { name: "Move Title down" }));
    await user.click(screen.getByRole("checkbox", { name: "Approvals" }));

    const expectedKeys = [
      "changeNumber", "type", "title", "status", "risk", "requestedBy",
      "affectedServices", "affectedAssets", "createdAt", "approvals",
    ];
    const expectedLabels = [
      "Change #", "Type", "Title", "Status", "Risk", "Requested By",
      "Affected Services", "Affected Assets", "Created", "Approvals",
    ];
    await user.click(screen.getByRole("button", { name: exportType }));

    if (exportType === "Excel") {
      await waitFor(() => expect(exportToExcel).toHaveBeenCalledOnce());
      expect(vi.mocked(exportToExcel).mock.calls[0][3]).toEqual([]);
      expect(vi.mocked(exportToExcel).mock.calls[0][1].map(column => column.key)).toEqual(expectedKeys);
      expect(vi.mocked(exportToExcel).mock.calls[0][1].map(column => column.header)).toEqual(expectedLabels);
    } else if (exportType === "PDF") {
      await waitFor(() => expect(exportToPDF).toHaveBeenCalledOnce());
      expect(vi.mocked(exportToPDF).mock.calls[0][5]).toEqual([]);
      expect(vi.mocked(exportToPDF).mock.calls[0][1]).toEqual(expectedLabels);
      expect(vi.mocked(exportToPDF).mock.calls[0][0][0]).toEqual([
        "CHG-9", "normal", "Report change 9", "requested", "low", "N/A",
        "None", "None", formatDate(history[8].createdAt), "None",
      ]);
    } else {
      await waitFor(() => expect(printMock).toHaveBeenCalledOnce());
      expect(screen.queryByText("Applied filters")).toBeNull();
      const table = screen.getByRole("table");
      expect(within(table).getAllByRole("columnheader").map(header => header.textContent)).toEqual(expectedLabels);
      expect(within(table).getAllByRole("cell").slice(0, expectedLabels.length).map(cell => cell.textContent)).toEqual([
        "CHG-9", "normal", "Report change 9", "requested", "low", "N/A",
        "None", "None", formatDate(history[8].createdAt), "None",
      ]);
    }
  });

  it("keeps export membership stable when matching and non-matching filters change between batches", async () => {
    const user = userEvent.setup();
    const initialRows = Array.from({ length: 250 }, (_, index) => ({
      id: `moving-change-${index + 1}`,
      changeNumber: `MOV-${String(index + 1).padStart(3, "0")}`,
      title: `Include change ${index + 1}`,
      type: "normal",
      status: "completed",
      priority: "medium",
      risk: "low",
      createdAt: new Date(Date.UTC(2026, 9, 1) - index * 60_000).toISOString(),
      approvals: [],
      removedApprovals: [],
    }));
    const initiallyNonMatching = {
      ...initialRows[0],
      id: "moving-change-outside",
      changeNumber: "MOV-OUTSIDE",
      title: "Outside search",
      type: "emergency",
      status: "draft",
      risk: "high",
    };
    reportRows = [...initialRows, initiallyNonMatching];

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
    expect(await screen.findByText("Include change 1")).toBeTruthy();
    const searchInput = screen.getByPlaceholderText("Search change #, title...");
    await user.type(searchInput, "Include change");
    await user.click(screen.getAllByRole("combobox")[0]);
    await user.click(screen.getByRole("option", { name: "Completed" }));
    await user.click(screen.getAllByRole("combobox")[1]);
    await user.click(screen.getByRole("option", { name: "Normal" }));
    await user.click(screen.getAllByRole("combobox")[2]);
    await user.click(screen.getByRole("option", { name: "Low" }));
    await waitFor(() => {
      expect(screen.getByText((_, element) =>
        element?.tagName === "P" && element.textContent?.includes("250 matching changes") === true,
      )).toBeTruthy();
    });
    await user.click(screen.getByRole("button", { name: "Excel" }));
    await pageTwoRequest;

    reportRows = reportRows.map(change => {
      if (change.id === initialRows[0].id) return { ...change, status: "draft" };
      if (change.id === initiallyNonMatching.id) {
        return { ...change, title: "Include change now matching", type: "normal", status: "completed", risk: "low" };
      }
      return change;
    });
    releasePageTwo();

    await waitFor(() => expect(exportToExcel).toHaveBeenCalledOnce());
    const exportedNumbers = vi.mocked(exportToExcel).mock.calls[0][0].map(change => change.changeNumber);
    expect(exportedNumbers).toHaveLength(initialRows.length);
    expect(new Set(exportedNumbers).size).toBe(initialRows.length);
    expect(new Set(exportedNumbers)).toEqual(new Set(initialRows.map(change => change.changeNumber)));
    expect(exportedNumbers).not.toContain(initiallyNonMatching.changeNumber);
    expect(vi.mocked(exportToExcel).mock.calls[0][0].find(change =>
      change.changeNumber === initialRows[0].changeNumber,
    )?.status).toBe("draft");
  }, 10_000);

  it("continues exporting without gaps when the last loaded change is deleted", async () => {
    const user = userEvent.setup();
    const initialRows = Array.from({ length: 201 }, (_, index) => ({
      id: `cursor-delete-change-${index + 1}`,
      changeNumber: `CUR-${String(index + 1).padStart(3, "0")}`,
      title: `Cursor delete change ${index + 1}`,
      type: "normal",
      status: "completed",
      priority: "medium",
      risk: "low",
      createdAt: new Date(Date.UTC(2026, 9, 1) - index * 60_000).toISOString(),
      approvals: [],
      removedApprovals: [],
    }));
    reportRows = [...initialRows];
    let deletedCursorNumber: string | undefined;
    onExportPageTwoRequest = () => {
      deletedCursorNumber = reportRows.find(change => change.changeNumber === "CUR-102")?.changeNumber;
      reportRows = reportRows.filter(change => change.changeNumber !== "CUR-102");
    };

    render(<QueryClientProvider client={queryClient}><ChangesReport /></QueryClientProvider>);
    expect(await screen.findByText("Cursor delete change 1")).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Excel" }));

    await waitFor(() => expect(exportToExcel).toHaveBeenCalledOnce());
    expect(deletedCursorNumber).toBe("CUR-102");
    const exportedNumbers = vi.mocked(exportToExcel).mock.calls[0][0].map(change => change.changeNumber);
    expect(new Set(exportedNumbers).size).toBe(exportedNumbers.length);

    const remainingNumbers = reportRows.map(change => change.changeNumber);
    expect(exportedNumbers).toEqual(expect.arrayContaining(remainingNumbers));
    for (const changeNumber of remainingNumbers) {
      expect(exportedNumbers.filter(number => number === changeNumber)).toHaveLength(1);
    }
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
    expect(await screen.findByText("Excel report is ready.")).toBeTruthy();

    let releaseNextPage!: () => void;
    exportPageTwoGate = new Promise<void>((resolve) => {
      releaseNextPage = resolve;
    });
    let nextPageRequested!: () => void;
    const nextPageRequest = new Promise<void>((resolve) => {
      nextPageRequested = resolve;
    });
    onExportPageTwoRequest = nextPageRequested;
    await user.click(screen.getByRole("button", { name: "PDF" }));
    await nextPageRequest;
    expect(screen.getByRole("status").textContent).toContain("PDF report: loaded 100 of 251 matching changes");
    expect(screen.queryByText("Excel report is ready.")).toBeNull();

    releaseNextPage();
    await waitFor(() => expect(exportToPDF).toHaveBeenCalled());
    expect(await screen.findByText("PDF report is ready.")).toBeTruthy();
  });

  it.each(["Excel", "PDF", "Print"])("cancels a loading %s export and allows a later export", async (exportType) => {
    const user = userEvent.setup();
    reportRows = Array.from({ length: 251 }, (_, index) => ({
      id: `cancel-change-${index + 1}`,
      changeNumber: `CANCEL-${index + 1}`,
      title: `Cancel change ${index + 1}`,
      type: "normal",
      status: "completed",
      priority: "medium",
      risk: "low",
      createdAt: "2026-10-01T00:00:00.000Z",
      approvals: [],
      removedApprovals: [],
    }));

    let pageTwoRequested!: () => void;
    const pageTwoRequest = new Promise<void>((resolve) => {
      pageTwoRequested = resolve;
    });
    exportPageTwoGate = new Promise<void>(() => {});
    onExportPageTwoRequest = pageTwoRequested;

    render(<QueryClientProvider client={queryClient}><ChangesReport /></QueryClientProvider>);
    expect(await screen.findByText("Cancel change 1")).toBeTruthy();
    await user.click(screen.getByRole("button", { name: exportType }));
    await pageTwoRequest;

    expect(screen.getByRole("button", { name: "Cancel export" })).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Cancel export" }));

    expect(screen.queryByRole("status")).toBeNull();
    expect(screen.queryByRole("alert")).toBeNull();
    expect(screen.queryByRole("button", { name: "Cancel export" })).toBeNull();
    expect(exportToExcel).not.toHaveBeenCalled();
    expect(exportToPDF).not.toHaveBeenCalled();
    expect(printMock).not.toHaveBeenCalled();
    expect(requests.filter(url =>
      new URL(url, "http://report.test").searchParams.has("exportChangeIds"),
    ).map(url => new URL(url, "http://report.test").searchParams.get("page"))).toEqual(["1", "2"]);

    exportPageTwoGate = null;
    await user.click(screen.getByRole("button", { name: exportType }));
    await waitFor(() => {
      if (exportType === "Excel") expect(exportToExcel).toHaveBeenCalledOnce();
      if (exportType === "PDF") expect(exportToPDF).toHaveBeenCalledOnce();
      if (exportType === "Print") expect(printMock).toHaveBeenCalledOnce();
    });
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
    const searchInput = screen.getByPlaceholderText("Search change #, title...");
    await user.type(searchInput, "Retry change");
    expect(await screen.findByText("Retry change 1")).toBeTruthy();
    await waitFor(() => {
      expect(requests.some(url =>
        new URL(url, "http://report.test").searchParams.get("search") === "Retry change",
      )).toBe(true);
    });
    requests = [];

    await user.click(screen.getByRole("button", { name: exportType }));
    const errorNotice = await screen.findByRole("alert");
    expect(errorNotice.textContent).toContain(`${exportType} report failed: 500: Batch 2 could not be loaded`);
    expect(within(errorNotice).getByRole("button", { name: `Retry ${exportType}` })).toBeTruthy();
    expect(exportToExcel).not.toHaveBeenCalled();
    expect(exportToPDF).not.toHaveBeenCalled();
    expect(printMock).not.toHaveBeenCalled();
    expect(requests.filter(url =>
      new URL(url, "http://report.test").searchParams.has("exportChangeIds"),
    )).toHaveLength(2);
    for (const url of requests) {
      const params = new URL(url, "http://report.test").searchParams;
      if (params.get("exportSnapshot") === "true") {
        expect(params.get("search")).toBe("Retry change");
      }
      if (params.has("exportChangeIds")) {
        expect(params.get("pageSize")).toBe("100");
        expect(params.has("search")).toBe(false);
      }
    }

    failExportPage = null;
    await user.click(within(errorNotice).getByRole("button", { name: `Retry ${exportType}` }));
    await waitFor(() => {
      if (exportType === "Excel") expect(exportToExcel).toHaveBeenCalled();
      if (exportType === "PDF") expect(exportToPDF).toHaveBeenCalled();
      if (exportType === "Print") expect(printMock).toHaveBeenCalled();
    });
    expect(screen.queryByRole("alert")).toBeNull();
    const retryRequests = requests.filter(url =>
      new URL(url, "http://report.test").searchParams.has("exportChangeIds"),
    );
    expect(retryRequests.map(url =>
      new URL(url, "http://report.test").searchParams.get("page"),
    )).toEqual(["1", "2", "1", "2", "3"]);
    for (const url of retryRequests.slice(2)) {
      expect(new URL(url, "http://report.test").searchParams.has("search")).toBe(false);
    }
  });
});
