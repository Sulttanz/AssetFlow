// @vitest-environment node
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import express from "express";
import type { Server } from "node:http";

const store = vi.hoisted(() => ({
  getPermissions: vi.fn(),
  getRolesWithDetails: vi.fn(),
  getModuleSetting: vi.fn(),
  getTickets: vi.fn(),
  getAssets: vi.fn(),
  getProblems: vi.fn(),
  getChangeReportPage: vi.fn(),
  getChangeReportSummary: vi.fn(),
}));

vi.mock("./storage", () => ({ storage: store }));
vi.mock("./db", () => ({ db: {} }));
vi.mock("./auth", () => ({
  setupAuth: (app: express.Express) => app.use((req: express.Request, _res: express.Response, next: express.NextFunction) => {
    req.user = { id: "report-tester" } as express.Request["user"];
    req.isAuthenticated = () => true;
    next();
  }),
  requireAuth: (_req: express.Request, _res: express.Response, next: express.NextFunction) => next(),
  requirePermission: () => (_req: express.Request, _res: express.Response, next: express.NextFunction) => next(),
  hashPassword: vi.fn(),
}));

import { registerRoutes } from "./routes";

type ReportChange = {
  id: string;
  changeNumber: string;
  title: string;
  type: string;
  status: string;
  risk: string;
  priority: string;
  createdAt: Date;
  approvals: ReportApproval[];
};

describe("change report and KPI endpoints", () => {
  let server: Server;
  let baseUrl: string;
  let changes: ReportChange[];

  beforeAll(async () => {
    store.getPermissions.mockResolvedValue([]);
    store.getRolesWithDetails.mockResolvedValue([]);
    store.getModuleSetting.mockResolvedValue(undefined);
    const app = express();
    app.use(express.json());
    server = await registerRoutes(app);
    await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("Expected a TCP listener");
    baseUrl = `http://127.0.0.1:${address.port}`;
  });

  afterAll(async () => {
    if (server?.listening) {
      await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
    }
  });

  beforeEach(() => {
    vi.clearAllMocks();
    store.getPermissions.mockResolvedValue([]);
    store.getRolesWithDetails.mockResolvedValue([]);
    store.getModuleSetting.mockResolvedValue(undefined);
    store.getTickets.mockResolvedValue([]);
    store.getAssets.mockResolvedValue([]);
    store.getProblems.mockResolvedValue([]);

    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const priorMonth = new Date(startOfMonth.getTime() - 86400000);
    const statusList = [
      "draft", "submitted", "approved", "rejected", "requested",
      "in_progress", "completed", "failed", "cancelled",
    ];
    changes = statusList.map((status, index) => ({
      id: `change-${index + 1}`,
      changeNumber: `CHG-${index + 1}`,
      title: `Report change ${index + 1}`,
      type: index === 0 || index === 8 ? "emergency" : "normal",
      status,
      risk: index === 0 ? "high" : "low",
      priority: "medium",
      createdAt: index < 4 ? new Date(startOfMonth.getTime() + index * 60000) : priorMonth,
      approvals: [],
    }));

    // Active null decisions display as pending in report rows but are not KPI pending votes.
    changes[0].approvals = [
      { id: "draft-approved", changeId: "change-1", decision: "approved", removedAt: null },
      { id: "draft-pending", changeId: "change-1", decision: "pending", removedAt: null },
      { id: "draft-null", changeId: "change-1", decision: null, removedAt: null },
      { id: "draft-removed-pending", changeId: "change-1", decision: "pending", removedAt: now },
    ];
    changes[1].approvals = [
      { id: "submitted-null", changeId: "change-2", decision: null, removedAt: null },
      { id: "submitted-removed-pending", changeId: "change-2", decision: "pending", removedAt: now },
    ];
    changes[2].approvals = [
      { id: "approved-pending", changeId: "change-3", decision: "pending", removedAt: null },
    ];

    store.getChangeReportSummary.mockImplementation(async (monthStart: Date) => {
      const count = (predicate: (change: ReportChange) => boolean) => changes.filter(predicate).length;
      return {
        total: changes.length,
        draft: count(change => change.status === "draft"),
        submitted: count(change => change.status === "submitted"),
        approved: count(change => change.status === "approved"),
        rejected: count(change => change.status === "rejected"),
        requested: count(change => change.status === "requested"),
        inProgress: count(change => change.status === "in_progress"),
        completed: count(change => change.status === "completed"),
        failed: count(change => change.status === "failed"),
        cancelled: count(change => change.status === "cancelled"),
        emergency: count(change => change.type === "emergency"),
        thisMonth: count(change => change.createdAt >= monthStart),
        pendingApprovals: changes.reduce((total, change) =>
          total + change.approvals.filter(approval =>
            !approval.removedAt && approval.decision === "pending",
          ).length, 0),
      };
    });
    store.getChangeReportPage.mockImplementation(async (options: {
      page: number;
      pageSize: number;
      search?: string;
      type?: string;
      status?: string;
      risk?: string;
      cursorPaging?: boolean;
      cursorChangeNumber?: string;
    }) => {
      const term = options.search?.toLowerCase();
      const matching = changes.filter(change =>
        (!term || `${change.changeNumber} ${change.title} ${change.type}`.toLowerCase().includes(term)) &&
        (!options.type || change.type === options.type) &&
        (!options.status || change.status === options.status) &&
        (!options.risk || change.risk === options.risk));
      const offset = (options.page - 1) * options.pageSize;
      return {
        total: matching.length,
        changes: matching.slice(offset, offset + options.pageSize).map(change => {
          const activeApprovals = change.approvals.filter(approval => !approval.removedAt);
          return {
            id: change.id,
            changeNumber: change.changeNumber,
            title: change.title,
            type: change.type,
            status: change.status,
            risk: change.risk,
            priority: change.priority,
            scheduledStart: null,
            scheduledEnd: null,
            createdAt: change.createdAt,
            requestedByLabel: null,
            assignedToLabel: null,
            activeApprovalCount: activeApprovals.length,
            approvedCount: activeApprovals.filter(approval => approval.decision === "approved").length,
            pendingCount: activeApprovals.filter(approval =>
              !approval.decision || approval.decision === "pending",
            ).length,
          };
        }),
      };
    });
  });

  async function getJson(path: string) {
    const response = await fetch(`${baseUrl}${path}`);
    expect(response.status).toBe(200);
    return response.json();
  }

  it("returns KPI totals, status counts, monthly totals, rates, and active explicit pending votes", async () => {
    const result = await getJson("/api/kpis");

    expect(result.changes).toEqual({
      total: 9,
      successRate: 33,
      emergencyPct: 22,
      pendingApprovals: 2,
      thisMonth: 4,
      failed: 1,
      byStatus: {
        requested: 1,
        approved: 1,
        in_progress: 1,
        completed: 1,
        failed: 1,
        cancelled: 1,
      },
    });
    expect(store.getChangeReportSummary).toHaveBeenCalledOnce();
  });

  it("keeps global report summary cards steady and returns report-only vote counts across filters and pages", async () => {
    const firstPage = await getJson("/api/reports/changes?page=1&pageSize=2");
    const filteredPage = await getJson("/api/reports/changes?page=1&pageSize=1&status=completed");
    const laterPage = await getJson("/api/reports/changes?page=2&pageSize=2&type=normal");
    const cursorPage = await getJson("/api/reports/changes?page=2&pageSize=2&cursorPaging=true&cursorChangeNumber=CHG-2");

    expect(firstPage.total).toBe(9);
    expect(filteredPage.total).toBe(1);
    expect(laterPage.total).toBe(7);
    expect(cursorPage.total).toBe(9);
    expect(filteredPage.summary).toEqual(firstPage.summary);
    expect(laterPage.summary).toEqual(firstPage.summary);
    expect(firstPage.summary).toMatchObject({
      total: 9,
      draft: 1,
      submitted: 1,
      approved: 1,
      rejected: 1,
      requested: 1,
      inProgress: 1,
      completed: 1,
      failed: 1,
      cancelled: 1,
      emergency: 2,
      thisMonth: 4,
      pendingApprovals: 2,
    });
    expect(firstPage.changes[0]).toMatchObject({
      activeApprovalCount: 3,
      approvedCount: 1,
      pendingCount: 2,
    });
    expect(firstPage.changes[0]).not.toHaveProperty("approvals");
    expect(firstPage.changes[1]).toMatchObject({
      activeApprovalCount: 1,
      approvedCount: 0,
      pendingCount: 1,
    });
    expect(store.getChangeReportPage).toHaveBeenNthCalledWith(1, expect.objectContaining({ page: 1, pageSize: 2 }));
    expect(store.getChangeReportPage).toHaveBeenNthCalledWith(2, expect.objectContaining({
      page: 1, pageSize: 1, status: "completed",
    }));
    expect(store.getChangeReportPage).toHaveBeenNthCalledWith(3, expect.objectContaining({
      page: 2, pageSize: 2, type: "normal",
    }));
    expect(store.getChangeReportPage).toHaveBeenNthCalledWith(4, expect.objectContaining({
      page: 2, pageSize: 2, cursorPaging: true, cursorChangeNumber: "CHG-2",
    }));
  });
});
