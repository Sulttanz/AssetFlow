import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ProjectBaselinesResponse, ProjectRecord } from "@/types/project-management";
import { projectApi } from "@/lib/project-management-api";
import { ProjectBaselinePanel } from "./project-baseline-panel";

vi.mock("@/lib/project-management-api", () => ({ projectApi: vi.fn() }));

const baselineData: ProjectBaselinesResponse = {
  baselines: [{
    id: "baseline-1",
    projectId: "project-1",
    versionNumber: "v1.0",
    baselineBudget: "1000.00",
    baselineStartDate: "2026-01-01",
    baselineTargetEndDate: "2026-06-30",
    approvedBy: "manager-1",
    approvedByName: "Project Manager",
    revisionNote: "Initial planning approval",
    createdAt: "2026-01-02T12:00:00.000Z",
  }],
  activeBaseline: {
    id: "baseline-1",
    projectId: "project-1",
    versionNumber: "v1.0",
    baselineBudget: "1000.00",
    baselineStartDate: "2026-01-01",
    baselineTargetEndDate: "2026-06-30",
    approvedBy: "manager-1",
    approvedByName: "Project Manager",
    revisionNote: "Initial planning approval",
    createdAt: "2026-01-02T12:00:00.000Z",
  },
  variance: {
    baselineBudget: 1000,
    currentBudget: 1200,
    actualSpend: 850,
    budgetVariance: 150,
    budgetChange: 200,
    baselineStartDate: "2026-01-01",
    baselineTargetEndDate: "2026-06-30",
    forecastEndDate: "2026-06-20",
    scheduleVarianceDays: 10,
  },
};

const project = {
  id: "project-1",
  title: "Infrastructure Refresh",
  budget: "1200.00",
  actualSpend: "850.00",
  startDate: "2026-01-01",
  targetEndDate: "2026-06-20",
} as ProjectRecord;

function renderPanel() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={queryClient}>
    <ProjectBaselinePanel project={project} canManage />
  </QueryClientProvider>);
}

describe("ProjectBaselinePanel", () => {
  beforeEach(() => {
    vi.mocked(projectApi).mockResolvedValue(baselineData);
  });

  it("shows the active approved baseline and budget/schedule variance", async () => {
    renderPanel();
    expect(await screen.findByText("v1.0 · Active")).toBeTruthy();
    expect(screen.getByText("Actual budget variance")).toBeTruthy();
    expect(screen.getByText(/10 days ahead/)).toBeTruthy();
    expect(screen.getByText(/Approval note: Initial planning approval/)).toBeTruthy();
  });

  it("requires explicit approval before locking a revised version", async () => {
    renderPanel();
    fireEvent.click(await screen.findByRole("button", { name: "Lock revised baseline" }));
    expect(await screen.findByRole("heading", { name: "Lock a revised project baseline" })).toBeTruthy();
    expect(screen.getByText(/append-only approved snapshot/)).toBeTruthy();
    expect((screen.getByRole("button", { name: "Approve & lock" }) as HTMLButtonElement).disabled).toBe(true);
  });
});
