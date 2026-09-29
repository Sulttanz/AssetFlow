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

function approval(id: string, decision: string | null, approverId = id, comments: string | null = null) {
  return {
    id, changeId: "change-1", approverId: approverId as string | null, originalApproverId: approverId, approverLabel: `${id} Reviewer`, decision, comments,
    createdAt: assignedAt, decidedAt: decision === "approved" || decision === "rejected" ? decidedAt : null,
    approver: { id: approverId, username: approverId, firstName: id, lastName: "Reviewer" } as { id: string; username: string; firstName: string; lastName: string } | undefined,
  };
}

function change(approvals: ReturnType<typeof approval>[], removedApproverIds: string[] = [], removedApprovals: ReturnType<typeof approval>[] = []) {
  return {
    id: "change-1", changeNumber: "CHG-1", title: "CAB review fixture",
    type: "normal", status: "submitted", priority: "medium", risk: "low",
    cabRequired: true, approvals, removedApproverIds, removedApprovals, stages: [], createdAt: assignedAt, updatedAt: assignedAt,
  };
}

async function openApprovals(approvals: ReturnType<typeof approval>[], removedApproverIds: string[] = [], removedApprovals: ReturnType<typeof approval>[] = []) {
  queryClient.setQueryData(["/api/changes"], [change(approvals, removedApproverIds, removedApprovals)]);
  queryClient.setQueryData(["/api/users"], ["alice", "bob", "carol", "dave"].map(id => ({
    id, username: id, firstName: id, lastName: null,
  })));
  queryClient.setQueryData(["/api/departments"], []);
  const user = userEvent.setup();
  render(<QueryClientProvider client={queryClient}><Changes /></QueryClientProvider>);
  await user.click(screen.getByText("CAB review fixture"));
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
    if (url === "/api/changes") return { ok: true, json: async () => queryClient.getQueryData(["/api/changes"]) };
    return { ok: true, json: async () => [] };
  }));
});

afterEach(() => {
  cleanup();
  queryClient.clear();
  vi.unstubAllGlobals();
});

describe("change detail CAB approvals", () => {
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