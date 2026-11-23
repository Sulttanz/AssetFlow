import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const navigation = vi.hoisted(() => ({ setLocation: vi.fn() }));
vi.mock("wouter", () => ({
  Link: ({ href, children, ...props }: any) => <a href={href} {...props}>{children}</a>,
  useParams: () => ({ id: "project-1" }),
  useLocation: () => ["/projects/project-1", navigation.setLocation],
}));
vi.mock("@/hooks/use-auth", () => ({
  useAuth: () => ({ user: { id: "manager-1", permissions: ["project_manage", "project_view"], roles: [{ id: "manager", name: "it_manager" }] } }),
}));
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: vi.fn() }) }));

import ProjectWorkspacePage from "./project-workspace";

const project = {
  id: "project-1",
  title: "Atlas platform upgrade",
  description: "Upgrade the core platform.",
  status: "Active" as const,
  healthStatus: "On Track" as const,
  startDate: "2026-01-01T12:00:00.000Z",
  targetEndDate: "2027-01-01T12:00:00.000Z",
  actualEndDate: null,
  budget: "100000.00",
  actualSpend: "25000.00",
  createdBy: "manager-1",
  createdAt: "2026-01-01T12:00:00.000Z",
  updatedAt: "2026-01-01T12:00:00.000Z",
  managers: [{ userId: "manager-1", name: "Ada Lovelace", isPrimary: true }],
  teamMembers: [],
  teamCount: 1,
  milestones: [{ id: "milestone-1", title: "Design approved", description: "Baseline accepted.", dueDate: "2026-04-01T12:00:00.000Z", completionDate: null, status: "Pending" as const }],
  assets: [{ assetId: "asset-1", assetTag: "SRV-001", name: "Core server", serialNumber: "SER-001", status: "Online", associationType: "Deployed" as const }],
};

const task = {
  id: "task-1",
  projectId: "project-1",
  title: "Deploy the new API gateway",
  description: "Run the staged deployment.",
  status: "In Progress" as const,
  priority: "High" as const,
  assigneeId: "manager-1",
  assigneeName: "Ada Lovelace",
  estimatedHours: "8.00",
  loggedHours: "2.00",
  dueDate: "2026-08-01T12:00:00.000Z",
  sortOrder: 0,
  createdAt: "2026-01-01T12:00:00.000Z",
};

const risk = {
  id: "risk-1",
  projectId: "project-1",
  title: "Production outage during cutover",
  description: "The change window may exceed planned duration.",
  category: "Operational" as const,
  probability: 3,
  impact: 5,
  riskScore: 15,
  mitigationStrategy: "Stage the rollout and prepare rollback.",
  status: "Identified" as const,
  ownerId: "manager-1",
  ownerName: "Ada Lovelace",
  createdAt: "2026-01-01T12:00:00.000Z",
  updatedAt: "2026-01-01T12:00:00.000Z",
};

const queueReviews = {
  dueSoonCount: 1,
  overdueCount: 1,
  reviews: [{
    id: "review-risk-1",
    projectId: "project-2",
    projectTitle: "Data center migration",
    title: "Validate failover plan",
    reviewDate: "2026-11-25",
    status: "Identified",
    ownerId: "manager-1",
    ownerName: "Ada Lovelace",
    residualProbability: 2,
    residualImpact: 4,
  }],
};

const rows: Record<string, unknown> = {
  "/api/projects/project-1": project,
  "/api/projects/options": { users: [{ id: "manager-1", name: "Ada Lovelace", username: "ada" }], assets: [] },
  "/api/projects/project-1/tasks": [task],
  "/api/projects/project-1/risks": [risk],
  "/api/projects/project-1/changes": [],
  "/api/projects/project-1/documents": [],
};

function response(data: unknown): Response {
  return { ok: true, status: 200, json: async () => data } as Response;
}

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  return render(<QueryClientProvider client={queryClient}><ProjectWorkspacePage /></QueryClientProvider>);
}

beforeEach(() => {
  vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url.startsWith("/api/projects/risk-reviews/queue")) {
      return response(url.includes("filter=overdue") ? { ...queueReviews, reviews: [] } : queueReviews);
    }
    return response(rows[url] ?? []);
  }));
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("Project command center", () => {
  it("shows EVM, milestone status, team, and linked CMDB assets", async () => {
    renderPage();
    expect(await screen.findByText("Delivery & financial health")).toBeTruthy();
    expect(screen.getByText("Earned Value (EV)")).toBeTruthy();
    expect(screen.getByText("Milestone tracker")).toBeTruthy();
    expect((await screen.findAllByText("Design approved")).length).toBeGreaterThan(0);
    expect(screen.getByText("SRV-001 · Core server")).toBeTruthy();
  });

  it("shows cross-project review counts, filters the queue, and links to the risk register", async () => {
    const user = userEvent.setup();
    renderPage();
    expect(await screen.findByText("Risk review queue")).toBeTruthy();
    expect(await screen.findByText("Data center migration · Owner: Ada Lovelace · Review 25-11-2026")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Open risk register" }).getAttribute("href"))
      .toBe("/projects/project-2?tab=risks");
    const overdue = screen.getByRole("button", { name: "Overdue 1" });
    await user.click(overdue);
    expect(overdue.getAttribute("aria-pressed")).toBe("true");
    expect(await screen.findByText("No overdue risk reviews.")).toBeTruthy();
    expect(vi.mocked(fetch)).toHaveBeenCalledWith(
      "/api/projects/risk-reviews/queue?filter=overdue",
      expect.objectContaining({ credentials: "include" }),
    );
  });

  it("loads the five-column task board", async () => {
    const user = userEvent.setup();
    renderPage();
    await user.click(await screen.findByRole("tab", { name: /Task board/ }));
    expect(await screen.findByText("Deploy the new API gateway")).toBeTruthy();
    expect(screen.getByRole("tab", { name: /Risk register/ })).toBeTruthy();
  });

  it("filters the risk register from the interactive 5x5 matrix", async () => {
    const user = userEvent.setup();
    renderPage();
    await user.click(await screen.findByRole("tab", { name: /Risk register/ }));
    const matrixCell = await screen.findByRole("button", {
      name: "Filter risk score 15, probability 3, impact 5; 1 risks",
    });
    fireEvent.click(matrixCell);
    expect(matrixCell.getAttribute("aria-pressed")).toBe("true");
    expect((await screen.findAllByText("Production outage during cutover")).length).toBeGreaterThan(0);
  });
});
