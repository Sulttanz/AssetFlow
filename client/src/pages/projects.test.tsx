import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/hooks/use-auth", () => ({
  useAuth: () => ({ user: { id: "manager-1", permissions: ["project_manage"], roles: [{ id: "it_manager", name: "it_manager" }] } }),
}));
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: vi.fn() }) }));

import ProjectsPage from "./projects";

const project = {
  id: "project-1",
  title: "Atlas Core Migration",
  description: "Move the core platform to managed infrastructure.",
  status: "Active" as const,
  healthStatus: "On Track" as const,
  startDate: "2026-01-01T12:00:00.000Z",
  targetEndDate: "2026-06-30T12:00:00.000Z",
  actualEndDate: null,
  budget: "250000.00",
  createdBy: "manager-1",
  createdAt: "2026-01-01T12:00:00.000Z",
  updatedAt: "2026-01-02T12:00:00.000Z",
  managers: [
    { userId: "manager-1", name: "Ada Lovelace", isPrimary: true },
    { userId: "manager-2", name: "Grace Hopper", isPrimary: false },
  ],
  teamCount: 3,
};

const people = [
  { id: "manager-1", name: "Ada Lovelace", username: "ada" },
  { id: "manager-2", name: "Grace Hopper", username: "grace" },
];

function response(data: unknown): Response {
  return {
    ok: true,
    status: 200,
    json: async () => data,
  } as Response;
}

let currentDetail: ReturnType<typeof makeDetail>;
let fetchMock: ReturnType<typeof vi.fn>;

function makeDetail(completed = false) {
  return {
    ...project,
    teamMembers: [
      { userId: "member-1", name: "Katherine Johnson", roleTitle: "Engineer", assignedAt: "2026-01-01T12:00:00.000Z" },
      { userId: "member-2", name: "Dorothy Vaughan", roleTitle: "Analyst", assignedAt: "2026-01-01T12:00:00.000Z" },
      { userId: "member-3", name: "Mary Jackson", roleTitle: "QA", assignedAt: "2026-01-01T12:00:00.000Z" },
    ],
    milestones: [{
      id: "milestone-1",
      title: "Launch readiness",
      description: "Complete the readiness review.",
      dueDate: "2026-05-15T12:00:00.000Z",
      completionDate: completed ? "2026-05-10T12:00:00.000Z" : null,
      status: completed ? "Completed" as const : "In Progress" as const,
    }],
    assets: [{
      assetId: "asset-1",
      assetTag: "SRV-001",
      name: "Core server",
      serialNumber: "SN-001",
      status: "Assigned",
      associationType: "Deployed" as const,
    }],
  };
}

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <ProjectsPage />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  currentDetail = makeDetail();
  fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    if (url === "/api/projects/options") return response({ users: people, assets: [] });
    if (url === "/api/projects") return response([{ ...project, milestones: undefined }]);
    if (url === "/api/projects/project-1" && !init?.method) return response(currentDetail);
    if (url === "/api/projects/project-1/milestones/milestone-1" && init?.method === "PATCH") {
      const update = JSON.parse(String(init.body)) as { status: "Completed" | "In Progress"; completionDate: string | null };
      currentDetail = {
        ...currentDetail,
        milestones: currentDetail.milestones.map(milestone => ({ ...milestone, ...update })),
      };
      return response(currentDetail);
    }
    throw new Error(`Unexpected request: ${init?.method ?? "GET"} ${url}`);
  });
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("Project Management views", () => {
  it("shows manager avatars and team counts in the portfolio list", async () => {
    renderPage();
    expect((await screen.findAllByText("Atlas Core Migration")).length).toBeGreaterThan(0);
    expect(screen.getAllByRole("img", { name: "Project managers: Ada Lovelace, Grace Hopper" }).length).toBeGreaterThan(0);
    expect(screen.getAllByText("2 managers · 3 team").length).toBeGreaterThan(0);
  });

  it("updates milestone completion from the detail tracker", async () => {
    renderPage();
    const projectButtons = await screen.findAllByRole("button", { name: "Atlas Core Migration" });
    fireEvent.click(projectButtons[0]);

    await screen.findByText("Milestone tracker");
    const completeButtons = screen.getAllByRole("checkbox", { name: "Complete milestone Launch readiness" });
    fireEvent.click(completeButtons[0]);

    await waitFor(() => expect(fetchMock.mock.calls.some(([url, init]) =>
      String(url) === "/api/projects/project-1/milestones/milestone-1" && init?.method === "PATCH",
    )).toBe(true));
    const patchCall = fetchMock.mock.calls.find(([url, init]) =>
      String(url) === "/api/projects/project-1/milestones/milestone-1" && init?.method === "PATCH",
    );
    const patchBody = JSON.parse(String(patchCall?.[1]?.body));
    expect(patchBody.status).toBe("Completed");
    expect(patchBody.completionDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(await screen.findAllByRole("checkbox", { name: "Reopen milestone Launch readiness" })).toHaveLength(2);
  });

  it("shows live validation when a target date precedes the project start", async () => {
    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: /New Project/ }));
    const targetDate = await screen.findByLabelText("Target end date");
    fireEvent.change(targetDate, { target: { value: "01-01-2020" } });
    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toBe("Enter a valid target end date.");
  });
});
