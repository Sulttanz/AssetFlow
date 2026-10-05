import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import ChangesReport from "./changes";

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

  beforeEach(() => {
    queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    requests = [];
    HTMLElement.prototype.hasPointerCapture = () => false;
    HTMLElement.prototype.setPointerCapture = () => {};
    HTMLElement.prototype.releasePointerCapture = () => {};
    HTMLElement.prototype.scrollIntoView = () => {};
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      requests.push(url);
      const params = new URL(url, "http://report.test").searchParams;
      const status = params.get("status");
      const matching = history.filter(change => !status || status === "all" || change.status === status);
      const page = Number(params.get("page") || 1);
      const pageSize = Number(params.get("pageSize") || 50);
      const offset = (page - 1) * pageSize;
      return {
        ok: true,
        json: async () => ({
          changes: matching.slice(offset, offset + pageSize),
          total: matching.length,
          page,
          pageSize,
          summary: globalSummary,
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
});
