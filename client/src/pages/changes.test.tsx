import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, within, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClientProvider } from "@tanstack/react-query";
import { format } from "date-fns";
import Changes from "./changes";
import { queryClient } from "@/lib/queryClient";

const auth = vi.hoisted(() => ({ userId: "alice" as string | null, isAdmin: false }));
vi.mock("@/hooks/use-auth", () => ({
  useAuth: () => ({ user: auth.userId ? { id: auth.userId } : null }),
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
};

function approval(id: string, decision: string | null, approverId = id, comments: string | null = null) {
  return {
    id, changeId: "change-1", approverId: approverId as string | null, originalApproverId: approverId, approverLabel: `${id} Reviewer`, decision, comments,
    createdAt: assignedAt, decidedAt: decision === "approved" || decision === "rejected" ? decidedAt : null,
    approver: { id: approverId, username: approverId, firstName: id, lastName: "Reviewer" } as { id: string; username: string; firstName: string; lastName: string } | undefined,
  };
}

function change(approvals: ReturnType<typeof approval>[], removedApproverIds: string[] = [], removedApprovals: ReturnType<typeof approval>[] = [], stages: StageTimelineFixture[] = []) {
  return {
    id: "change-1", changeNumber: "CHG-1", title: "CAB review fixture",
    type: "normal", status: "submitted", priority: "medium", risk: "low",
    cabRequired: true, approvals, removedApproverIds, removedApprovals, stages, createdAt: assignedAt, updatedAt: assignedAt,
  };
}

async function openApprovals(approvals: ReturnType<typeof approval>[], removedApproverIds: string[] = [], removedApprovals: ReturnType<typeof approval>[] = [], stages: StageTimelineFixture[] = []) {
  queryClient.setQueryData(["/api/changes", 1, "", "all", "all"], { changes: [change(approvals, removedApproverIds, removedApprovals, stages)], total: 1 });
  queryClient.setQueryData(["/api/users"], ["alice", "bob", "carol", "dave"].map(id => ({
    id, username: id, firstName: id, lastName: null,
  })));
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
    return { ok: true, json: async () => [] };
  }));
});

afterEach(() => {
  cleanup();
  queryClient.clear();
  vi.unstubAllGlobals();
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
      { id: "active-account", username: "active", firstName: "Alex", lastName: "Active" },
      { id: "deleted-account", username: "deleted", firstName: "Casey", lastName: "Deleted" },
      { id: "removed-account", username: "former", firstName: "Morgan", lastName: "Former" },
      { id: "available-account", username: "available", firstName: "Available", lastName: "User" },
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
    expect(within(removal).getByText(new RegExp(format(new Date(decidedAt), "MMM d, yyyy h:mm a")))).toBeTruthy();
    expect(within(panel).queryByRole("button")).toBeNull();
    expect(screen.getByRole("tab", { name: "Approvals (1)" })).toBeTruthy();
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
    expect(within(approvalEvent).getByText(new RegExp(format(new Date(approved.decidedAt), "MMM d, yyyy h:mm a")))).toBeTruthy();

    const rejectionEvent = within(panel).getByText("CAB rejected: Former Reviewer").parentElement!;
    expect(within(rejectionEvent).getByText("Needs rollback")).toBeTruthy();
    expect(within(rejectionEvent).getByText(new RegExp(format(new Date(rejected.decidedAt), "MMM d, yyyy h:mm a")))).toBeTruthy();
    expect(within(panel).queryByRole("button")).toBeNull();
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
    expect(within(history).getByText(`Assigned ${format(new Date(assignedAt), "MMM d, yyyy h:mm a")}`)).toBeTruthy();
    expect(within(history).getByText(`Removed ${format(new Date(decidedAt), "MMM d, yyyy h:mm a")} by Morgan Manager`)).toBeTruthy();
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
      ["Pending", "Pending", "No comment yet.", `Assigned ${format(new Date(assignedAt), "MMM d, yyyy h:mm a")}`],
      ["Legacy", "Pending", "No comment yet.", `Assigned ${format(new Date(assignedAt), "MMM d, yyyy h:mm a")}`],
      ["Approved", "Approved", "Looks safe", `Decided ${format(new Date(decidedAt), "MMM d, yyyy h:mm a")}`],
      ["Rejected", "Rejected", "Needs rollback", `Decided ${format(new Date(decidedAt), "MMM d, yyyy h:mm a")}`],
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