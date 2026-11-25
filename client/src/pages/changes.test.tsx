import { formatDateTime as appFormatDateTime } from "@/lib/date-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, within, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClientProvider } from "@tanstack/react-query";
import Changes from "./changes";
import { queryClient } from "@/lib/queryClient";

const auth = vi.hoisted(() => ({ userId: "alice" as string | null, isAdmin: false }));
vi.mock("@/hooks/use-auth", () => ({
  useAuth: () => ({ user: auth.userId ? { id: auth.userId, permissions: auth.isAdmin ? ["system_admin"] : [] } : null }),
  useHasPermission: (permission: string) => permission === "system_admin" && auth.isAdmin,
}));

const assignedAt = "2026-06-01T10:15:00.000Z";
const decidedAt = "2026-06-02T14:30:00.000Z";
type StageTimelineFixture = {
  id: string;
  environment: string;
  status: string;
  startedAt: string | null;
  completedAt: string | null;
  attempts?: { status: "completed" | "failed"; startedAt: string | null; completedAt: string | null }[];
  assignedToId?: string | null;
  assignedTo?: { id: string; username: string; firstName: string | null; lastName: string | null };
};
type UserSummaryFixture = {
  id: string;
  username: string;
  firstName: string | null;
  lastName: string | null;
  isActive?: boolean | null;
};

function approval(id: string, decision: string | null, approverId = id, comments: string | null = null) {
  return {
    id, changeId: "change-1", approverId: approverId as string | null, originalApproverId: approverId, approverLabel: `${id} Reviewer`, decision, comments,
    createdAt: assignedAt, decidedAt: decision === "approved" || decision === "rejected" ? decidedAt : null,
    approver: { id: approverId, username: approverId, firstName: id, lastName: "Reviewer", isActive: true } as { id: string; username: string; firstName: string; lastName: string; isActive?: boolean | null } | undefined,
  };
}

function change(approvals: ReturnType<typeof approval>[], removedApproverIds: string[] = [], removedApprovals: ReturnType<typeof approval>[] = [], stages: StageTimelineFixture[] = [], cabReviewVersion = 1) {
  return {
    id: "change-1", changeNumber: "CHG-1", title: "CAB review fixture",
    type: "normal", status: "submitted", priority: "medium", risk: "low",
    cabRequired: true, cabReviewVersion, approvals, removedApproverIds, removedApprovals, stages, createdAt: assignedAt, updatedAt: assignedAt,
  };
}

async function openApprovals(
  approvals: ReturnType<typeof approval>[],
  removedApproverIds: string[] = [],
  removedApprovals: ReturnType<typeof approval>[] = [],
  stages: StageTimelineFixture[] = [],
  users: UserSummaryFixture[] = ["alice", "bob", "carol", "dave"].map(id => ({
    id, username: id, firstName: id, lastName: null, isActive: true,
  })),
  cabReviewVersion = 1,
  changeOverrides: Record<string, unknown> = {},
) {
  queryClient.setQueryData(["/api/changes", 1, "", "all", "all"], { changes: [{ ...change(approvals, removedApproverIds, removedApprovals, stages, cabReviewVersion), ...changeOverrides }], total: 1 });
  queryClient.setQueryData(["/api/users"], users);
  queryClient.setQueryData(["/api/departments"], []);
  const user = userEvent.setup();
  render(<QueryClientProvider client={queryClient}><Changes /></QueryClientProvider>);
  await user.click(await screen.findByText("CAB review fixture"));
  await user.click(screen.getByRole("tab", { name: /Approvals \(/ }));
  return { user, panel: screen.getByRole("tabpanel", { name: /Approvals \(/ }) };
}

beforeEach(() => {
  auth.userId = "alice";
  auth.isAdmin = false;
  HTMLElement.prototype.hasPointerCapture = () => false;
  HTMLElement.prototype.setPointerCapture = () => {};
  HTMLElement.prototype.releasePointerCapture = () => {};
  HTMLElement.prototype.scrollIntoView = () => {};
  // The page explicitly refetches changes on mount; keep that request local to this fixture.
  vi.stubGlobal("fetch", vi.fn(async (url: string, options?: RequestInit) => {
    if (options?.method === "PUT") return { ok: true, json: async () => ({}) };
    if (url.startsWith("/api/changes?")) return { ok: true, json: async () => queryClient.getQueryData(["/api/changes", 1, "", "all", "all"]) };
    if (url === "/api/changes/pending-votes") return { ok: true, json: async () => [] };
    if (url === "/api/changes/change-1") return { ok: true, json: async () => (queryClient.getQueryData<{ changes: ReturnType<typeof change>[] }>(["/api/changes", 1, "", "all", "all"]))?.changes[0] };
    if (url === "/api/users") return { ok: true, json: async () => queryClient.getQueryData(["/api/users"]) ?? [] };
    return { ok: true, json: async () => [] };
  }));
});

afterEach(() => {
  cleanup();
  queryClient.clear();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("change list pages", () => {
  it("navigates between pages and searches and filters the full history", async () => {
    const history = Array.from({ length: 27 }, (_, index) => ({
      ...change([]), id: `change-${index}`, changeNumber: `CHG-${index}`,
      title: index === 26 ? "Older deployment" : `Change ${index}`,
      type: index === 26 ? "emergency" : "normal",
    }));
    const requests: string[] = [];
    vi.stubGlobal("fetch", vi.fn(async (url: string) => {
      if (url === "/api/changes/pending-votes") return { ok: true, json: async () => [] };
      if (url.startsWith("/api/changes?")) {
        requests.push(url);
        const params = new URL(url, "http://example.test").searchParams;
        const filtered = history.filter(c =>
          (!params.get("search") || `${c.title} ${c.changeNumber}`.toLowerCase().includes(params.get("search")!.toLowerCase())) &&
          (!params.get("type") || c.type === params.get("type")) &&
          (!params.get("status") || c.status === params.get("status")));
        const offset = (Number(params.get("page")) - 1) * Number(params.get("pageSize"));
        return { ok: true, json: async () => ({ changes: filtered.slice(offset, offset + 25), total: filtered.length }) };
      }
      return { ok: true, json: async () => [] };
    }));
    const user = userEvent.setup();
    render(<QueryClientProvider client={queryClient}><Changes /></QueryClientProvider>);
    expect(await screen.findByText("Page 1 of 2 · 27 matching changes")).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Next" }));
    expect(await screen.findByText("Older deployment")).toBeTruthy();
    expect(screen.getByText("Page 2 of 2 · 27 matching changes")).toBeTruthy();
    await user.type(screen.getByPlaceholderText("Search changes…"), "Older");
    expect(await screen.findByText("Page 1 of 1 · 1 matching changes")).toBeTruthy();
    expect(screen.getByText("Older deployment")).toBeTruthy();
    expect(requests.some(url => url.includes("page=2"))).toBe(true);
    expect(requests.some(url => url.includes("search=Older"))).toBe(true);
    await user.click(screen.getAllByRole("combobox")[0]);
    await user.click(screen.getByRole("option", { name: "Normal" }));
    expect(await screen.findByText("No changes found.")).toBeTruthy();
    expect(requests.some(url => url.includes("type=normal") && url.includes("search=Older"))).toBe(true);
  });
});

describe("CAB alert change links", () => {
  it.each([
    { viewerId: "alice", canVote: false },
    { viewerId: "bob", canVote: true },
  ])("opens a change outside the current page for $viewerId and only offers its assigned vote", async ({ viewerId, canVote }) => {
    const changeId = "change-outside-page";
    const listRecord = { ...change([]), id: "visible-page-record", title: "Visible page record" };
    const pendingVote = {
      ...approval("bob-pending-vote", "pending", "bob"),
      changeId,
      approverLabel: "Bob Reviewer",
      approver: { id: "bob", username: "bob", firstName: "Bob", lastName: "Reviewer" },
    };
    const removedVote = {
      ...approval("former-vote", "approved", "former-account"),
      changeId,
      approverId: null,
      approver: undefined,
      approverLabel: "Former Reviewer",
      originalApproverId: "former-account",
      removedAt: "2026-06-03T12:15:00.000Z",
      removedById: null,
      removedByLabel: "CAB Manager",
    };
    const detailResponse = {
      ...change([pendingVote], ["former-account"], [removedVote]),
      id: changeId,
      changeNumber: "CHG-OUTSIDE",
      title: "Outside-page CAB change",
    };
    const fetchMock = vi.fn(async (url: string) => {
      if (url.startsWith("/api/changes?")) {
        return { ok: true, json: async () => ({ changes: [listRecord], total: 26 }) };
      }
      if (url === "/api/changes/pending-votes") return { ok: true, json: async () => [] };
      if (url === `/api/changes/${changeId}`) return { ok: true, json: async () => detailResponse };
      if (url === "/api/users") return { ok: true, json: async () => [
        { id: "bob", username: "bob", firstName: "Bob", lastName: "Reviewer" },
      ] };
      if (url === "/api/departments") return { ok: true, json: async () => [] };
      return { ok: true, json: async () => [] };
    });
    auth.userId = viewerId;
    vi.stubGlobal("fetch", fetchMock);
    window.history.replaceState(null, "", `/changes?approval=${changeId}`);

    render(<QueryClientProvider client={queryClient}><Changes /></QueryClientProvider>);

    expect(await screen.findByText("Visible page record")).toBeTruthy();
    expect(await screen.findByText("Outside-page CAB change")).toBeTruthy();
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith(`/api/changes/${changeId}`, { credentials: "include" }));

    const approvalsTab = screen.getByRole("tab", { name: "Approvals (1)" });
    await waitFor(() => expect(approvalsTab.getAttribute("aria-selected")).toBe("true"));
    const panel = screen.getByRole("tabpanel", { name: "Approvals (1)" });
    expect(within(panel).getByText("Bob Reviewer")).toBeTruthy();
    expect(within(panel).getByRole("region", { name: "Removed CAB assignments" })).toBeTruthy();
    expect(within(panel).getByText("Former Reviewer")).toBeTruthy();
    expect(within(panel).getByText(/Removed .* by CAB Manager/)).toBeTruthy();

    if (canVote) {
      expect(within(panel).getByRole("button", { name: "Approve" })).toBeTruthy();
      expect(within(panel).getByRole("button", { name: "Reject" })).toBeTruthy();
    } else {
      expect(within(panel).queryByRole("button", { name: "Approve" })).toBeNull();
      expect(within(panel).queryByRole("button", { name: "Reject" })).toBeNull();
    }
  });

  it.each([
    { status: 404, responseMessage: "Change not found or no longer available" },
    { status: 403, responseMessage: "Forbidden" },
  ])("explains an unavailable CAB alert target after a $status detail response without showing stale approval data", async ({ status, responseMessage }) => {
    const changeId = "unavailable-change";
    queryClient.setQueryData(["/api/changes", changeId], {
      ...change([approval("stale-vote", "pending", "stale-approver")]),
      id: changeId,
      title: "Stale approval details",
    });
    const fetchMock = vi.fn(async (url: string) => {
      if (url.startsWith("/api/changes?")) return { ok: true, json: async () => ({ changes: [], total: 0 }) };
      if (url === "/api/changes/pending-votes") return { ok: true, json: async () => [] };
      if (url === `/api/changes/${changeId}`) {
        return { ok: false, status, text: async () => JSON.stringify({ message: responseMessage }) };
      }
      return { ok: true, json: async () => [] };
    });
    vi.stubGlobal("fetch", fetchMock);
    window.history.replaceState(null, "", `/changes?approval=${changeId}`);

    render(<QueryClientProvider client={queryClient}><Changes /></QueryClientProvider>);

    expect((await screen.findByRole("alert")).textContent).toContain(
      "This CAB alert points to a change that is no longer available. It may have been deleted or you may no longer have access.",
    );
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith(`/api/changes/${changeId}`, expect.objectContaining({
      method: "GET",
      credentials: "include",
    })));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.queryByRole("button", { name: "Approve" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Reject" })).toBeNull();
    expect(screen.queryByText("unavailable-change")).toBeNull();
    expect(screen.queryByText("Stale approval details")).toBeNull();
    expect(screen.queryByText("stale-vote Reviewer")).toBeNull();
  });
});

describe("change detail CAB approvals", () => {
  it("renders CAB history from the independent detail response, not the list snapshot", async () => {
    auth.isAdmin = true;
    const listChange = change([]);
    const active = {
      ...approval("Active", "pending", "active-account"),
      approverLabel: "Alex Active",
      approver: { id: "active-account", username: "active", firstName: "Alex", lastName: "Active" },
    };
    const deletedVote = {
      ...approval("Deleted", "approved", "deleted-account", "Approved before account deletion"),
      approverId: null,
      approver: undefined,
      approverLabel: "Casey Deleted",
      originalApproverId: "deleted-account",
    };
    const removed = {
      ...approval("Former", "pending", "removed-account"),
      approverId: null,
      approver: undefined,
      approverLabel: "Morgan Former",
      originalApproverId: "removed-account",
      removedAt: "2026-06-03T12:15:00.000Z",
      removedById: null,
      removedByLabel: "Taylor Manager",
    };
    const detailResponse = {
      ...change([active, deletedVote], ["removed-account"], [removed]),
      title: "Detail-only CAB history",
    };
    queryClient.setQueryData(["/api/changes", 1, "", "all", "all"], { changes: [listChange], total: 1 });
    const users = [
      { id: "active-account", username: "active", firstName: "Alex", lastName: "Active", isActive: true },
      { id: "deleted-account", username: "deleted", firstName: "Casey", lastName: "Deleted", isActive: true },
      { id: "removed-account", username: "former", firstName: "Morgan", lastName: "Former", isActive: true },
      { id: "available-account", username: "available", firstName: "Available", lastName: "User", isActive: true },
    ];
    const fetchMock = vi.fn(async (url: string) => {
      if (url.startsWith("/api/changes?")) {
        return { ok: true, json: async () => queryClient.getQueryData(["/api/changes", 1, "", "all", "all"]) };
      }
      if (url === "/api/changes/pending-votes") return { ok: true, json: async () => [] };
      if (url === "/api/changes/change-1") return { ok: true, json: async () => detailResponse };
      if (url === "/api/users") return { ok: true, json: async () => users };
      if (url === "/api/departments") return { ok: true, json: async () => [] };
      return { ok: true, json: async () => [] };
    });
    vi.stubGlobal("fetch", fetchMock);

    const user = userEvent.setup();
    render(<QueryClientProvider client={queryClient}><Changes /></QueryClientProvider>);
    await user.click(await screen.findByText("CAB review fixture"));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith("/api/changes/change-1", { credentials: "include" }));
    expect(await screen.findByText("Detail-only CAB history")).toBeTruthy();

    await user.click(screen.getByRole("tab", { name: "Approvals (2)" }));
    const panel = screen.getByRole("tabpanel", { name: "Approvals (2)" });
    expect(within(panel).getByText("Alex Active")).toBeTruthy();
    expect(within(panel).getByText("Casey Deleted (deleted account)")).toBeTruthy();
    expect(within(panel).getByText("Approved before account deletion")).toBeTruthy();
    const removedHistory = within(panel).getByRole("region", { name: "Removed CAB assignments" });
    expect(within(removedHistory).getByText("Morgan Former")).toBeTruthy();
    expect(within(removedHistory).getByText(/Removed .* by Taylor Manager/)).toBeTruthy();

    await user.click(within(panel).getByRole("combobox"));
    expect(screen.queryByRole("option", { name: "Alex Active" })).toBeNull();
    expect(screen.queryByRole("option", { name: "Casey Deleted" })).toBeNull();
    expect(screen.queryByRole("option", { name: "Morgan Former" })).toBeNull();
    expect(screen.getByRole("option", { name: "Available User" })).toBeTruthy();
    await user.keyboard("{Escape}");

    await user.click(screen.getByRole("tab", { name: "Timeline" }));
    const timeline = screen.getByRole("tabpanel", { name: "Timeline" });
    expect(within(timeline).getByText("CAB approved: Casey Deleted")).toBeTruthy();
    expect(within(timeline).getByText("CAB approver removed: Morgan Former by Taylor Manager")).toBeTruthy();
  });

  it("shows deployment stage starts and completions or failures in chronological order as read-only events", async () => {
    const stages = [
      {
        id: "stage-1", environment: "development", status: "completed",
        startedAt: "2026-06-02T10:00:00.000Z", completedAt: "2026-06-02T10:30:00.000Z",
      },
      {
        id: "stage-2", environment: "testing", status: "failed",
        startedAt: "2026-06-02T10:20:00.000Z", completedAt: "2026-06-02T10:45:00.000Z",
      },
      {
        id: "stage-3", environment: "staging", status: "completed",
        startedAt: null, completedAt: "2026-06-02T10:55:00.000Z",
      },
      {
        id: "stage-4", environment: "production", status: "in_progress",
        startedAt: "2026-06-02T11:00:00.000Z", completedAt: null,
      },
    ];
    const { user } = await openApprovals([], [], [], stages);
    await user.click(screen.getByRole("tab", { name: "Timeline" }));

    const panel = screen.getByRole("tabpanel", { name: "Timeline" });
    const labels = within(panel).getAllByText(/^(Development|Testing|Staging|Production) (started|completed|failed)$/).map(el => el.textContent);
    expect(labels).toEqual([
      "Development started",
      "Testing started",
      "Development completed",
      "Testing failed",
      "Staging completed",
      "Production started",
    ]);
    expect(within(panel).queryByRole("button")).toBeNull();
  });

  it("renders deployment-stage history from the independent detail response when the list has none", async () => {
    const listChange = change([]);
    const stages: StageTimelineFixture[] = [
      {
        id: "completed-stage", environment: "development", status: "in_progress",
        startedAt: "2026-06-02T11:00:00.000Z", completedAt: null,
        attempts: [{
          status: "completed",
          startedAt: "2026-06-02T09:00:00.000Z",
          completedAt: "2026-06-02T09:30:00.000Z",
        }],
      },
      {
        id: "failed-stage", environment: "testing", status: "in_progress",
        startedAt: "2026-06-02T12:00:00.000Z", completedAt: null,
        attempts: [{
          status: "failed",
          startedAt: "2026-06-02T10:00:00.000Z",
          completedAt: "2026-06-02T10:30:00.000Z",
        }],
      },
    ];
    const detailResponse = {
      ...change([], [], [], stages),
      title: "Detail-only deployment history",
    };
    queryClient.setQueryData(["/api/changes", 1, "", "all", "all"], { changes: [listChange], total: 1 });
    const fetchMock = vi.fn(async (url: string) => {
      if (url.startsWith("/api/changes?")) {
        return { ok: true, json: async () => queryClient.getQueryData(["/api/changes", 1, "", "all", "all"]) };
      }
      if (url === "/api/changes/pending-votes") return { ok: true, json: async () => [] };
      if (url === "/api/changes/change-1") return { ok: true, json: async () => detailResponse };
      if (url === "/api/users") return { ok: true, json: async () => [] };
      if (url === "/api/departments") return { ok: true, json: async () => [] };
      return { ok: true, json: async () => [] };
    });
    vi.stubGlobal("fetch", fetchMock);

    const user = userEvent.setup();
    render(<QueryClientProvider client={queryClient}><Changes /></QueryClientProvider>);
    await user.click(await screen.findByText("CAB review fixture"));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith("/api/changes/change-1", { credentials: "include" }));
    expect(await screen.findByText("Detail-only deployment history")).toBeTruthy();

    await user.click(screen.getByRole("tab", { name: "Timeline" }));
    const timeline = screen.getByRole("tabpanel", { name: "Timeline" });
    expect(within(timeline).getByText("Development attempt 1 started")).toBeTruthy();
    expect(within(timeline).getByText("Development attempt 1 completed")).toBeTruthy();
    expect(within(timeline).getByText("Development attempt 2 started")).toBeTruthy();
    expect(within(timeline).getByText("Testing attempt 1 started")).toBeTruthy();
    expect(within(timeline).getByText("Testing attempt 1 failed")).toBeTruthy();
    expect(within(timeline).getByText("Testing attempt 2 started")).toBeTruthy();
    for (const stage of stages) {
      const previous = stage.attempts![0];
      expect(timeline.textContent).toContain(appFormatDateTime(previous.startedAt!));
      expect(timeline.textContent).toContain(appFormatDateTime(previous.completedAt!));
      expect(timeline.textContent).toContain(appFormatDateTime(stage.startedAt!));
    }
  });

  it("keeps completed and failed prior attempts separate from the current retry", async () => {
    const stages = [
      {
        id: "stage-1", environment: "development", status: "in_progress",
        startedAt: "2026-06-02T11:00:00.000Z", completedAt: null,
        attempts: [{
          status: "completed" as const,
          startedAt: "2026-06-02T09:00:00.000Z",
          completedAt: "2026-06-02T09:30:00.000Z",
        }],
      },
      {
        id: "stage-2", environment: "testing", status: "in_progress",
        startedAt: "2026-06-02T12:00:00.000Z", completedAt: null,
        attempts: [{
          status: "failed" as const,
          startedAt: "2026-06-02T10:00:00.000Z",
          completedAt: "2026-06-02T10:30:00.000Z",
        }],
      },
    ];
    const { user } = await openApprovals([], [], [], stages);
    await user.click(screen.getByRole("tab", { name: "Timeline" }));

    const panel = screen.getByRole("tabpanel", { name: "Timeline" });
    const labels = within(panel).getAllByText(/^(Development|Testing) attempt \d+ (started|completed|failed)$/).map(el => el.textContent);
    expect(labels).toEqual([
      "Development attempt 1 started",
      "Development attempt 1 completed",
      "Testing attempt 1 started",
      "Testing attempt 1 failed",
      "Development attempt 2 started",
      "Testing attempt 2 started",
    ]);
  });

  it("orders active and removed CAB assignment events with milestones using saved labels, without voting controls", async () => {
    const removed = {
      ...approval("Former", "pending", "carol"),
      approverId: null, approver: undefined,
      removedAt: decidedAt, removedById: null, removedByLabel: "Morgan Manager",
    };
    const active = { ...approval("Current", "pending", "bob"), createdAt: "2026-06-03T09:00:00.000Z" };
    const { user } = await openApprovals([active], ["carol"], [removed]);
    await user.click(screen.getByRole("tab", { name: "Timeline" }));
    const panel = screen.getByRole("tabpanel", { name: "Timeline" });
    const labels = within(panel).getAllByText(/^(Created|CAB approver assigned:|CAB approver removed:)/).map(el => el.textContent);
    expect(labels).toEqual([
      "Created",
      "CAB approver assigned: Former Reviewer",
      "CAB approver removed: Former Reviewer by Morgan Manager",
      "CAB approver assigned: Current Reviewer",
    ]);
    const removal = within(panel).getByText("CAB approver removed: Former Reviewer by Morgan Manager").parentElement!;
    expect(within(removal).getByText(new RegExp(appFormatDateTime(decidedAt)))).toBeTruthy();
    expect(within(panel).queryByRole("button")).toBeNull();
    expect(screen.getByRole("tab", { name: "Approvals (1)" })).toBeTruthy();
  });

  it("shows every CAB review reset in the timeline without adding approval records", async () => {
    const firstEscalation = {
      escalatedAt: "2026-06-02T14:30:00.000Z",
      previousRisk: "low",
      resultingRisk: "high",
      previousType: "standard",
      resultingType: "normal",
      previousReviewVersion: 1,
      reviewVersion: 2,
    };
    const secondEscalation = {
      escalatedAt: "2026-06-03T14:30:00.000Z",
      previousRisk: "high",
      resultingRisk: "critical",
      previousType: "normal",
      resultingType: "emergency",
      previousReviewVersion: 2,
      reviewVersion: 3,
    };
    const { user } = await openApprovals([], [], [], [], undefined, 3, {
      cabEscalationHistory: [firstEscalation, secondEscalation],
    });
    await user.click(screen.getByRole("tab", { name: "Timeline" }));

    const timeline = screen.getByRole("tabpanel", { name: "Timeline" });
    const resetEvents = within(timeline).getAllByText(/^CAB review reset:/);
    expect(resetEvents.map(event => event.textContent)).toEqual([
      "CAB review reset: Review 2",
      "CAB review reset: Review 3",
    ]);
    expect(within(timeline).getByText(/Risk: low → high · Type: standard → normal · Review 1 → 2/)).toBeTruthy();
    expect(within(timeline).getByText(/Risk: high → critical · Type: normal → emergency · Review 2 → 3/)).toBeTruthy();
    expect(within(timeline).getByText(new RegExp(appFormatDateTime(firstEscalation.escalatedAt)))).toBeTruthy();
    expect(within(timeline).getByText(new RegExp(appFormatDateTime(secondEscalation.escalatedAt)))).toBeTruthy();
    expect(screen.getByRole("tab", { name: "Approvals (0)" })).toBeTruthy();
  });

  it("shows CAB approval and rejection decisions in chronological order with saved labels, times, and comments", async () => {
    const approved = {
      ...approval("Current", "approved", "dave", "Reviewed and approved"),
      decidedAt: "2026-06-02T14:30:00.000Z",
    };
    const rejected = {
      ...approval("Former", "rejected", "former", "Needs rollback"),
      approverId: null,
      approver: undefined,
      decidedAt: "2026-06-03T14:30:00.000Z",
      removedAt: "2026-06-04T14:30:00.000Z",
      removedByLabel: "Morgan Manager",
    };
    const pending = {
      ...approval("Pending", "pending", "bob"),
      createdAt: "2026-06-05T09:00:00.000Z",
    };
    const { user } = await openApprovals([approved, pending], ["former"], [rejected]);
    await user.click(screen.getByRole("tab", { name: "Timeline" }));

    const panel = screen.getByRole("tabpanel", { name: "Timeline" });
    const labels = within(panel).getAllByText(/^CAB (approved|rejected):/).map(el => el.textContent);
    expect(labels).toEqual([
      "CAB approved: Current Reviewer",
      "CAB rejected: Former Reviewer",
    ]);

    const approvalEvent = within(panel).getByText("CAB approved: Current Reviewer").parentElement!;
    expect(within(approvalEvent).getByText("Reviewed and approved")).toBeTruthy();
    expect(within(approvalEvent).getByText(new RegExp(appFormatDateTime(approved.decidedAt)))).toBeTruthy();

    const rejectionEvent = within(panel).getByText("CAB rejected: Former Reviewer").parentElement!;
    expect(within(rejectionEvent).getByText("Needs rollback")).toBeTruthy();
    expect(within(rejectionEvent).getByText(new RegExp(appFormatDateTime(rejected.decidedAt)))).toBeTruthy();
    expect(within(panel).queryByRole("button")).toBeNull();
  });

  it("explains that prior CAB decisions do not count after risk or type escalation", async () => {
    const pending = {
      ...approval("Current", "pending", "alice"),
      decisionHistory: [{
        decision: "approved",
        comments: "Approved before escalation",
        decidedAt: decidedAt,
        supersededAt: "2026-06-03T09:00:00.000Z",
        reviewVersion: 1,
        reason: "Risk increased from low to high.",
      }],
    };
    const { panel } = await openApprovals([pending], [], [], [], undefined, 2);

    expect(within(panel).getByText("Fresh CAB review required")).toBeTruthy();
    expect(within(panel).getByText(/Earlier CAB decisions remain in history but do not count/)).toBeTruthy();
    expect(within(panel).getByText("Previous decisions (history only)")).toBeTruthy();
    expect(within(panel).getByLabelText("Superseded CAB decisions").textContent).toContain("Approved in review 1");
    expect(within(panel).getByLabelText("Superseded CAB decisions").textContent).toContain("Approved before escalation");
    expect(within(panel).getByText("Pending")).toBeTruthy();
  });

  it("shows removed assignments as read-only history after both accounts are deleted, without affecting active counts or CAB gates", async () => {
    auth.isAdmin = true;
    const removed = {
      ...approval("Former", "pending", "carol"),
      approverId: null, approver: undefined,
      removedAt: decidedAt, removedById: null, removedByLabel: "Morgan Manager",
    };
    const { user, panel } = await openApprovals([], ["carol"], [removed]);
    const history = within(panel).getByRole("region", { name: "Removed CAB assignments" });
    expect(within(history).getByText("Former Reviewer")).toBeTruthy();
    expect(within(history).getByText(`Assigned ${appFormatDateTime(assignedAt)}`)).toBeTruthy();
    expect(within(history).getByText(`Removed ${appFormatDateTime(decidedAt)} by Morgan Manager`)).toBeTruthy();
    expect(within(history).queryByRole("button")).toBeNull();
    expect(screen.getByRole("tab", { name: "Approvals (0)" })).toBeTruthy();
    expect(within(panel).getByText("No approvers added yet.")).toBeTruthy();
    await user.click(screen.getByRole("tab", { name: "Details" }));
    expect(screen.getByText(/No CAB approvers have been added yet/)).toBeTruthy();
    await user.click(screen.getByRole("tab", { name: "Approvals (0)" }));
    await user.click(within(panel).getByRole("combobox"));
    expect(screen.queryByRole("option", { name: "carol" })).toBeNull();
  });

  it("does not offer removed or active CAB members for assignment", async () => {
    auth.isAdmin = true;
    const { user, panel } = await openApprovals([approval("Bob", "pending", "bob")], ["carol"]);
    await user.click(within(panel).getByRole("combobox"));
    expect(screen.queryByRole("option", { name: "bob" })).toBeNull();
    expect(screen.queryByRole("option", { name: "carol" })).toBeNull();
    expect(screen.getByRole("option", { name: "alice" })).toBeTruthy();
    expect(screen.getByRole("option", { name: "dave" })).toBeTruthy();
  });

  it("offers only explicitly active accounts for CAB assignment", async () => {
    auth.isAdmin = true;
    const users = [
      { id: "alice", username: "alice", firstName: "Alice", lastName: null, isActive: true },
      { id: "active-user", username: "active-user", firstName: "Active", lastName: "Reviewer", isActive: true },
      { id: "inactive-user", username: "inactive-user", firstName: "Inactive", lastName: "Reviewer", isActive: false },
      { id: "null-status-user", username: "null-status-user", firstName: "Null Status", lastName: "Reviewer", isActive: null },
      { id: "missing-status-user", username: "missing-status-user", firstName: "Missing Status", lastName: "Reviewer" },
    ];
    const { user, panel } = await openApprovals([], [], [], [], users);

    await user.click(within(panel).getByRole("combobox"));

    expect(screen.getByRole("option", { name: "Active Reviewer" })).toBeTruthy();
    expect(screen.queryByRole("option", { name: "Inactive Reviewer" })).toBeNull();
    expect(screen.queryByRole("option", { name: "Null Status Reviewer" })).toBeNull();
    expect(screen.queryByRole("option", { name: "Missing Status Reviewer" })).toBeNull();
  });

  it("offers only active change and stage assignees while keeping saved inactive assignments visible", async () => {
    auth.isAdmin = true;
    const users = [
      { id: "alice", username: "alice", firstName: "Alice", lastName: null, isActive: true },
      { id: "active-user", username: "active", firstName: "Active", lastName: "Person", isActive: true },
      { id: "inactive-user", username: "inactive", firstName: "Inactive", lastName: "Person", isActive: false },
      { id: "null-status-user", username: "null-status", firstName: "Null Status", lastName: "Person", isActive: null },
      { id: "missing-status-user", username: "missing-status", firstName: "Missing Status", lastName: "Person" },
    ];
    const inactiveAssignee = { id: "inactive-user", username: "inactive", firstName: "Inactive", lastName: "Person" };
    const stages: StageTimelineFixture[] = [{
      id: "stage-1", environment: "development", status: "pending", startedAt: null, completedAt: null,
      assignedToId: inactiveAssignee.id, assignedTo: inactiveAssignee,
    }];
    const { user } = await openApprovals([], [], [], stages, users, 1, {
      assignedToId: inactiveAssignee.id,
      assignedTo: inactiveAssignee,
    });

    await user.click(screen.getByRole("tab", { name: "Details" }));
    expect(screen.getAllByText("Inactive Person").length).toBeGreaterThan(0);
    await user.click(screen.getByRole("tab", { name: /Environment/ }));
    expect(screen.getAllByText("Inactive Person").length).toBeGreaterThan(0);

    const reassignButtons = screen.getAllByRole("button", { name: "Reassign" });
    await user.click(reassignButtons[reassignButtons.length - 1]);
    const stageDialog = screen.getAllByRole("dialog").at(-1)!;
    await user.click(within(stageDialog).getByRole("combobox"));
    expect(screen.getByRole("option", { name: "Active Person" })).toBeTruthy();
    expect(screen.queryByRole("option", { name: "Inactive Person" })).toBeNull();
    expect(screen.queryByRole("option", { name: "Null Status Person" })).toBeNull();
    expect(screen.queryByRole("option", { name: "Missing Status Person" })).toBeNull();
    await user.keyboard("{Escape}");
    await user.click(within(stageDialog).getByRole("button", { name: "Cancel" }));

    await user.click(screen.getAllByRole("button", { name: "Reassign" })[0]);
    const changeAssignDialog = screen.getAllByRole("dialog").at(-1)!;
    await user.click(within(changeAssignDialog).getAllByRole("combobox")[0]);
    expect(screen.getByRole("option", { name: "Active Person" })).toBeTruthy();
    expect(screen.queryByRole("option", { name: "Inactive Person" })).toBeNull();
    expect(screen.queryByRole("option", { name: "Null Status Person" })).toBeNull();
    expect(screen.queryByRole("option", { name: "Missing Status Person" })).toBeNull();
    await user.keyboard("{Escape}");
    await user.click(within(changeAssignDialog).getByRole("button", { name: "Cancel" }));

    queryClient.setQueryData(["/api/cmdb/change-options"], { applications: [], servers: [], assets: [] });
    await user.click(screen.getByRole("button", { name: "Edit" }));
    const editDialog = screen.getByRole("dialog", { name: "Edit Change" });
    await user.click(within(editDialog).getAllByRole("combobox")[4]);
    expect(screen.getByRole("option", { name: "Active Person" })).toBeTruthy();
    expect(screen.queryByRole("option", { name: "Inactive Person" })).toBeNull();
    expect(screen.queryByRole("option", { name: "Null Status Person" })).toBeNull();
    expect(screen.queryByRole("option", { name: "Missing Status Person" })).toBeNull();
  });

  it("refreshes account eligibility each time the CAB approver picker opens", async () => {
    auth.isAdmin = true;
    const users = [
      { id: "alice", username: "alice", firstName: "Alice", lastName: null, isActive: true },
      { id: "reviewer", username: "reviewer", firstName: "Riley", lastName: "Reviewer", isActive: true },
    ];
    const { user, panel } = await openApprovals([], [], [], [], users);
    let latestUsers = users;
    vi.stubGlobal("fetch", vi.fn(async (url: string) => {
      if (url === "/api/users") return { ok: true, json: async () => latestUsers };
      if (url.startsWith("/api/changes?")) return { ok: true, json: async () => queryClient.getQueryData(["/api/changes", 1, "", "all", "all"]) };
      if (url === "/api/changes/pending-votes") return { ok: true, json: async () => [] };
      if (url === "/api/changes/change-1") return { ok: true, json: async () => queryClient.getQueryData<{ changes: ReturnType<typeof change>[] }>(["/api/changes", 1, "", "all", "all"])?.changes[0] };
      return { ok: true, json: async () => [] };
    }));

    await user.click(within(panel).getByRole("combobox"));
    expect(await screen.findByRole("option", { name: "Riley Reviewer" })).toBeTruthy();
    await user.keyboard("{Escape}");
    latestUsers = users.map(account => account.id === "reviewer" ? { ...account, isActive: false } : account);

    await user.click(within(panel).getByRole("combobox"));

    await waitFor(() => expect(screen.queryByRole("option", { name: "Riley Reviewer" })).toBeNull());
    expect(screen.getByRole("option", { name: "Alice" })).toBeTruthy();
  });

  it("hides cached CAB candidates after a failed refresh and restores them only after retry succeeds", async () => {
    auth.isAdmin = true;
    const cachedUsers = [
      { id: "alice", username: "alice", firstName: "Alice", lastName: null, isActive: true },
      { id: "reviewer", username: "reviewer", firstName: "Riley", lastName: "Reviewer", isActive: true },
    ];
    const freshUsers = [
      cachedUsers[0],
      { id: "fresh-reviewer", username: "fresh", firstName: "Fresh", lastName: "Reviewer", isActive: true },
    ];
    // Freeze background polling, not React Query's notification timeouts.
    vi.useFakeTimers({ toFake: ["setInterval", "clearInterval"] });
    const { user, panel } = await openApprovals([], [], [], [], cachedUsers);
    let userListRequests = 0;
    let rejectInitialUserListRequest!: (error: Error) => void;
    let resolveRetry!: (response: unknown) => void;
    const initialRequest = new Promise((_, reject) => { rejectInitialUserListRequest = reject; });
    const retryRequest = new Promise(resolve => { resolveRetry = resolve; });
    vi.stubGlobal("fetch", vi.fn(async (url: string) => {
      if (url === "/api/users") {
        userListRequests++;
        return userListRequests === 1 ? initialRequest : retryRequest;
      }
      if (url.startsWith("/api/changes?")) return { ok: true, json: async () => queryClient.getQueryData(["/api/changes", 1, "", "all", "all"]) };
      if (url === "/api/changes/pending-votes") return { ok: true, json: async () => [] };
      if (url === "/api/changes/change-1") return { ok: true, json: async () => queryClient.getQueryData<{ changes: ReturnType<typeof change>[] }>(["/api/changes", 1, "", "all", "all"])?.changes[0] };
      return { ok: true, json: async () => [] };
    }));

    await user.click(within(panel).getByRole("combobox"));

    expect(await within(panel).findByText("Refreshing account eligibility…")).toBeTruthy();
    expect(userListRequests).toBe(1);
    expect(screen.queryByRole("option", { name: "Riley Reviewer" })).toBeNull();
    await act(async () => { rejectInitialUserListRequest(new Error("Temporary user-list failure")); });
    expect(await within(panel).findByText("Could not refresh account eligibility. No users are available until a refresh succeeds.")).toBeTruthy();
    expect(userListRequests).toBe(1); // No automatic retry/backoff.
    expect(queryClient.getQueryData<UserSummaryFixture[]>(["/api/users"])?.some(account => account.id === "reviewer" && account.isActive)).toBe(true);
    expect(screen.queryByRole("option", { name: "Riley Reviewer" })).toBeNull();
    const addButton = within(panel).getByText("Add Approver").closest("button") as HTMLButtonElement;
    expect(addButton.disabled).toBe(true);

    fireEvent.click(within(panel).getByText("Retry").closest("button")!);
    expect(await within(panel).findByText("Refreshing account eligibility…")).toBeTruthy();
    expect(userListRequests).toBe(2);
    expect(addButton.disabled).toBe(true);
    expect(screen.queryByRole("option", { name: "Fresh Reviewer" })).toBeNull();
    await act(async () => { resolveRetry({ ok: true, json: async () => freshUsers }); });

    expect(await screen.findByRole("option", { name: "Fresh Reviewer" })).toBeTruthy();
    expect(screen.queryByRole("option", { name: "Riley Reviewer" })).toBeNull();
    fireEvent.click(screen.getByRole("option", { name: "Fresh Reviewer" }));
    expect(addButton.disabled).toBe(false);
    expect(userListRequests).toBe(2);
  });

  it("removes a disabled account from an open picker and disables its selected assignment", async () => {
    auth.isAdmin = true;
    vi.useFakeTimers({ toFake: ["setInterval", "clearInterval"] });
    const users = [
      { id: "alice", username: "alice", firstName: "Alice", lastName: null, isActive: true },
      { id: "reviewer", username: "reviewer", firstName: "Riley", lastName: "Reviewer", isActive: true },
    ];
    const { user, panel } = await openApprovals([], [], [], [], users);
    let latestUsers = users;
    const userRequests: string[] = [];
    vi.stubGlobal("fetch", vi.fn(async (url: string) => {
      if (url === "/api/users") {
        userRequests.push(url);
        return { ok: true, json: async () => latestUsers };
      }
      if (url.startsWith("/api/changes?")) return { ok: true, json: async () => queryClient.getQueryData(["/api/changes", 1, "", "all", "all"]) };
      if (url === "/api/changes/pending-votes") return { ok: true, json: async () => [] };
      if (url === "/api/changes/change-1") return { ok: true, json: async () => queryClient.getQueryData<{ changes: ReturnType<typeof change>[] }>(["/api/changes", 1, "", "all", "all"])?.changes[0] };
      return { ok: true, json: async () => [] };
    }));

    await user.click(within(panel).getByRole("combobox"));
    await user.click(await screen.findByRole("option", { name: "Riley Reviewer" }));
    const addButton = within(panel).getByRole("button", { name: "Add Approver" }) as HTMLButtonElement;
    expect(addButton.disabled).toBe(false);

    await user.click(within(panel).getByRole("combobox"));
    expect(await screen.findByRole("option", { name: "Riley Reviewer" })).toBeTruthy();
    latestUsers = users.map(account => account.id === "reviewer" ? { ...account, isActive: false } : account);
    await act(async () => { await vi.advanceTimersByTimeAsync(15_000); });

    expect(userRequests.length).toBeGreaterThan(0);
    await waitFor(() => {
      expect(queryClient.getQueryData<UserSummaryFixture[]>(["/api/users"])?.find(account => account.id === "reviewer")?.isActive).toBe(false);
      expect(screen.queryByRole("option", { name: "Riley Reviewer" })).toBeNull();
      expect(addButton.disabled).toBe(true);
    });
  });

  it("hides self-assignment for a previously removed member", async () => {
    const { panel } = await openApprovals([], ["alice"]);
    expect(within(panel).queryByRole("button", { name: "Add myself as approver" })).toBeNull();
    expect(within(panel).getByText("No approvers added yet.")).toBeTruthy();
  });

  it("renders approver, badge, comment and decision or assignment timestamp for every state", async () => {
    const { panel } = await openApprovals([
      approval("Pending", "pending", "bob"),
      approval("Legacy", null, "carol"),
      approval("Approved", "approved", "dave", "Looks safe"),
      approval("Rejected", "rejected", "erin", "Needs rollback"),
    ]);
    for (const [name, badge, comment, timestamp] of [
      ["Pending", "Pending", "No comment yet.", `Assigned ${appFormatDateTime(assignedAt)}`],
      ["Legacy", "Pending", "No comment yet.", `Assigned ${appFormatDateTime(assignedAt)}`],
      ["Approved", "Approved", "Looks safe", `Decided ${appFormatDateTime(decidedAt)}`],
      ["Rejected", "Rejected", "Needs rollback", `Decided ${appFormatDateTime(decidedAt)}`],
    ]) {
      const row = within(panel).getByText(`${name} Reviewer`).closest(".rounded-md")!;
      expect(within(row as HTMLElement).getByText(badge)).toBeTruthy();
      expect(within(row as HTMLElement).getByText(comment)).toBeTruthy();
      expect(within(row as HTMLElement).getByText(timestamp)).toBeTruthy();
    }
  });

  it("shows deleted account decisions and explains how to resolve an orphaned pending vote", async () => {
    auth.isAdmin = true;
    const decided = { ...approval("Former", "approved", "former", "Signed off"), approverId: null, approver: undefined };
    const pending = { ...approval("Departed", "pending", "departed"), approverId: null, approver: undefined };
    const { panel } = await openApprovals([decided, pending]);
    expect(within(panel).getByText("Former Reviewer (deleted account)")).toBeTruthy();
    expect(within(panel).getByText("Signed off")).toBeTruthy();
    expect(within(panel).getByText("Departed Reviewer (deleted account)")).toBeTruthy();
    expect(within(panel).getByText(/change manager must remove this pending assignment/)).toBeTruthy();
    expect(within(panel).queryByRole("button", { name: "Approve" })).toBeNull();
  });

  it("warns managers about disabled pending approvers and keeps manager removal available", async () => {
    auth.isAdmin = true;
    auth.userId = "bob";
    const disabled = {
      ...approval("Bob", "pending", "bob"),
      approver: { id: "bob", username: "bob", firstName: "Bob", lastName: "Reviewer", isActive: false },
    };
    const { panel } = await openApprovals([disabled]);

    expect(within(panel).getByText(/This account is disabled, so this pending vote cannot be cast and is blocking CAB approval/)).toBeTruthy();
    expect(within(panel).getByRole("button", { name: "Remove Bob Reviewer as CAB approver" })).toBeTruthy();
    expect(within(panel).queryByRole("button", { name: "Approve" })).toBeNull();
    expect(within(panel).queryByRole("button", { name: "Reject" })).toBeNull();
    expect(within(panel).getByText("Pending")).toBeTruthy();
  });

  it.each([
    ["pending", "Approve", "approved"],
    [null, "Reject", "rejected"],
  ])("allows only the assigned user to cast %s approval decisions", async (decision, action, expectedDecision) => {
    const { user, panel } = await openApprovals([approval("Alice", decision, "alice")]);
    expect(within(panel).getByRole("button", { name: "Approve" })).toBeTruthy();
    expect(within(panel).getByRole("button", { name: "Reject" })).toBeTruthy();
    await user.type(within(panel).getByPlaceholderText("Optional comment for your decision…"), "Reviewed");
    await user.click(within(panel).getByRole("button", { name: action }));
    await waitFor(() => expect(fetch).toHaveBeenCalledWith(
      "/api/changes/change-1/approvals/Alice",
      expect.objectContaining({ method: "PUT", body: JSON.stringify({ decision: expectedDecision, comments: "Reviewed" }) }),
    ));
  });

  it("does not expose voting to another user or a signed-out visitor", async () => {
    auth.userId = "bob";
    let view = await openApprovals([approval("Alice", "pending", "alice")]);
    expect(within(view.panel).queryByRole("button", { name: "Approve" })).toBeNull();
    expect(within(view.panel).queryByRole("button", { name: "Reject" })).toBeNull();
    cleanup();
    queryClient.clear();
    auth.userId = null;
    view = await openApprovals([approval("Alice", null, "alice")]);
    expect(within(view.panel).queryByRole("button", { name: "Approve" })).toBeNull();
    expect(within(view.panel).queryByRole("button", { name: "Reject" })).toBeNull();
  });

  it.each(["approved", "rejected"])("never permits another vote after %s", async decision => {
    const { panel } = await openApprovals([approval("Alice", decision, "alice")]);
    expect(within(panel).queryByRole("button", { name: "Approve" })).toBeNull();
    expect(within(panel).queryByRole("button", { name: "Reject" })).toBeNull();
    expect(within(panel).queryByPlaceholderText("Optional comment for your decision…")).toBeNull();
  });
});