import type { Express } from "express";
import { and, desc, eq, gte, inArray, isNotNull, lt, lte, or, sql } from "drizzle-orm";
import { z } from "zod";
import {
  auditLogs, assignmentGroups, assets, incidents, projects, serviceContracts,
  serviceRequests, users, vendorContracts, vendors,
} from "@shared/schema";
import { db } from "./db";
import { requireAuth } from "./auth";
import { isFeatureEnabled } from "./module-access";
import { storage } from "./storage";

export const enterpriseReportFiltersSchema = z.object({
  from: z.string().date().optional(),
  to: z.string().date().optional(),
  assignmentGroupId: z.coerce.number().int().positive().optional(),
  assetCategory: z.string().trim().max(120).optional(),
}).strict().refine(value => !value.from || !value.to || value.from <= value.to, {
  message: "The start date must be on or before the end date.",
  path: ["to"],
});

export const enterpriseAuditFiltersSchema = enterpriseReportFiltersSchema.extend({
  category: z.enum(["all", "itsm", "itam", "other"]).default("all"),
  action: z.enum(["all", "CREATE", "UPDATE", "DELETE", "BULK_UPDATE", "VIEW"]).default("all"),
}).strict();

type DateFilters = { from?: string; to?: string };

function dateConditions(column: any, filters: DateFilters) {
  const conditions = [];
  if (filters.from) conditions.push(gte(column, new Date(`${filters.from}T00:00:00.000Z`)));
  if (filters.to) {
    const nextDay = new Date(`${filters.to}T00:00:00.000Z`);
    nextDay.setUTCDate(nextDay.getUTCDate() + 1);
    conditions.push(lt(column, nextDay));
  }
  return conditions;
}

function numeric(value: unknown): number {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function getReportAccess(permissions: string[]) {
  const admin = permissions.includes("system_admin");
  return {
    itsm: admin || permissions.includes("ticket_view_all"),
    itam: admin || permissions.includes("asset_view") || permissions.includes("asset_update") ||
      permissions.includes("inventory_view") || permissions.includes("finance_view"),
    audit: admin || permissions.includes("audit_view"),
  };
}

export function csvSafeAuditSummary(oldValues: string | null, newValues: string | null) {
  const safeKeys = new Set(["status", "assignmentGroup", "assigneeId", "assignedToId", "fulfillmentStatus", "fulfillmentStage"]);
  const summarize = (value: string | null) => {
    if (!value) return {};
    try {
      const parsed = JSON.parse(value);
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
      return Object.fromEntries(Object.entries(parsed).filter(([key]) => safeKeys.has(key)));
    } catch {
      return {};
    }
  };
  const oldRecord = summarize(oldValues);
  const newRecord = summarize(newValues);
  const keys = new Set([...Object.keys(oldRecord), ...Object.keys(newRecord)]);
  const changes = Array.from(keys).map(key => {
    const before = oldRecord[key];
    const after = newRecord[key];
    return `${key}: ${before == null ? "—" : String(before)} → ${after == null ? "—" : String(after)}`;
  });
  return changes.join("; ") || "Recorded audit event";
}

/**
 * Cross-module reports are assembled only from modules both enabled for the
 * tenant and visible to the current user. Every aggregate is computed in SQL.
 */
export function registerEnterpriseReportingRoutes(app: Express) {
  app.get("/api/enterprise-reporting/operations", requireAuth, async (req: any, res) => {
    const parsed = enterpriseReportFiltersSchema.safeParse(req.query);
    if (!parsed.success) return res.status(400).json({ message: "Invalid report filters", errors: parsed.error.issues });

    try {
      const [permissions, itsmEnabled, itamEnabled] = await Promise.all([
        storage.getUserPermissions(req.user.id),
        isFeatureEnabled("itsm"),
        isFeatureEnabled("asset_management"),
      ]);
      const access = getReportAccess(permissions);
      const canViewItsm = access.itsm && itsmEnabled;
      const canViewItam = access.itam && itamEnabled;
      if (!canViewItsm && !canViewItam) {
        return res.status(403).json({ message: "You do not have access to operational reporting." });
      }

      const filters = parsed.data;
      const selectedGroup = filters.assignmentGroupId
        ? (await db.select({ id: assignmentGroups.id, name: assignmentGroups.name })
          .from(assignmentGroups).where(eq(assignmentGroups.id, filters.assignmentGroupId)))[0]
        : undefined;
      if (filters.assignmentGroupId && !selectedGroup) {
        return res.status(400).json({ message: "Assignment group not found." });
      }

      const response: Record<string, unknown> = {
        capabilities: { itsm: canViewItsm, itam: canViewItam },
        filters: { assignmentGroups: [], assetCategories: [] },
      };

      if (canViewItsm) {
        const incidentConditions: any[] = [
          ...dateConditions(incidents.createdAt, filters),
        ];
        if (selectedGroup) incidentConditions.push(sql`lower(btrim(${incidents.assignmentGroup})) = lower(btrim(${selectedGroup.name}))`);
        const incidentWhere = incidentConditions.length ? and(...incidentConditions) : undefined;
        const openStatuses = ["New", "In Progress", "Pending"];
        const resolvedStatuses = ["Resolved", "Closed"];

        const [priorityRows, slaRows, backlogRows, workloadRows, groups] = await Promise.all([
          db.select({
            priority: incidents.priority,
            resolvedCount: sql<number>`count(*)`,
            meanHours: sql<number>`avg(extract(epoch from (${incidents.resolvedAt} - ${incidents.createdAt})) / 3600.0)`,
          }).from(incidents)
            .where(and(incidentWhere, inArray(incidents.status, resolvedStatuses), isNotNull(incidents.resolvedAt)))
            .groupBy(incidents.priority),
          db.select({
            eligible: sql<number>`count(*) filter (where ${incidents.status} in ('Resolved', 'Closed') and ${incidents.resolveDueAt} is not null and ${incidents.resolvedAt} is not null)`,
            onTime: sql<number>`count(*) filter (where ${incidents.status} in ('Resolved', 'Closed') and ${incidents.resolveDueAt} is not null and ${incidents.resolvedAt} is not null and ${incidents.resolvedAt} <= ${incidents.resolveDueAt})`,
            currentlyOverdue: sql<number>`count(*) filter (where ${incidents.status} not in ('Resolved', 'Closed') and ${incidents.resolveDueAt} < now())`,
          }).from(incidents).where(incidentWhere),
          db.select({
            underOneDay: sql<number>`count(*) filter (where ${incidents.createdAt} >= now() - interval '1 day')`,
            oneToSevenDays: sql<number>`count(*) filter (where ${incidents.createdAt} < now() - interval '1 day' and ${incidents.createdAt} >= now() - interval '7 days')`,
            eightToThirtyDays: sql<number>`count(*) filter (where ${incidents.createdAt} < now() - interval '7 days' and ${incidents.createdAt} >= now() - interval '30 days')`,
            thirtyOneToNinetyDays: sql<number>`count(*) filter (where ${incidents.createdAt} < now() - interval '30 days' and ${incidents.createdAt} >= now() - interval '90 days')`,
            overNinetyDays: sql<number>`count(*) filter (where ${incidents.createdAt} < now() - interval '90 days')`,
            total: sql<number>`count(*)`,
          }).from(incidents).where(and(incidentWhere, inArray(incidents.status, openStatuses))),
          db.select({
            name: sql<string>`coalesce(nullif(btrim(${incidents.assignmentGroup}), ''), 'Unassigned')`,
            openCount: sql<number>`count(*)`,
            overdueCount: sql<number>`count(*) filter (where ${incidents.resolveDueAt} < now())`,
          }).from(incidents)
            .where(and(incidentWhere, inArray(incidents.status, openStatuses)))
            .groupBy(sql`coalesce(nullif(btrim(${incidents.assignmentGroup}), ''), 'Unassigned')`)
            .orderBy(desc(sql`count(*)`)),
          db.select({ id: assignmentGroups.id, name: assignmentGroups.name })
            .from(assignmentGroups).where(eq(assignmentGroups.active, true)).orderBy(assignmentGroups.name),
        ]);
        const sla = slaRows[0] ?? { eligible: 0, onTime: 0, currentlyOverdue: 0 };
        const denominator = numeric(sla.eligible);
        response.itsm = {
          mttrByPriority: ["P1", "P2", "P3", "P4"].map(priority => {
            const row = priorityRows.find(item => item.priority === priority);
            return { priority, resolvedCount: numeric(row?.resolvedCount), meanHours: row?.meanHours == null ? null : numeric(row.meanHours) };
          }),
          sla: {
            eligibleResolvedIncidents: denominator,
            resolvedWithinTarget: numeric(sla.onTime),
            complianceRate: denominator ? numeric(sla.onTime) / denominator * 100 : null,
            currentlyOverdue: numeric(sla.currentlyOverdue),
          },
          backlog: [
            { bucket: "< 1 day", count: numeric(backlogRows[0]?.underOneDay) },
            { bucket: "1–7 days", count: numeric(backlogRows[0]?.oneToSevenDays) },
            { bucket: "8–30 days", count: numeric(backlogRows[0]?.eightToThirtyDays) },
            { bucket: "31–90 days", count: numeric(backlogRows[0]?.thirtyOneToNinetyDays) },
            { bucket: "> 90 days", count: numeric(backlogRows[0]?.overNinetyDays) },
          ],
          openBacklog: numeric(backlogRows[0]?.total),
          assignmentGroups: workloadRows.map(row => ({
            name: row.name,
            openCount: numeric(row.openCount),
            overdueCount: numeric(row.overdueCount),
          })),
        };
        response.filters = {
          ...(response.filters as object),
          assignmentGroups: groups,
        };
      }

      if (canViewItam) {
        const assetConditions = filters.assetCategory
          ? [eq(assets.category, filters.assetCategory)]
          : [];
        const [lifecycleRows, categoryRows, contractRows, expiredRows, vendorExpiryRows, vendorExpiredRows, warrantyRows, expiredWarrantyRows] =
          await Promise.all([
            db.select({
              status: assets.status,
              count: sql<number>`count(*)`,
              valuation: sql<string>`coalesce(sum(coalesce(${assets.currentBookValue}, ${assets.currentValue}, ${assets.purchasePrice}, 0)), 0)`,
            }).from(assets).where(assetConditions.length ? and(...assetConditions) : undefined).groupBy(assets.status),
            db.selectDistinct({ category: assets.category }).from(assets).where(isNotNull(assets.category)).orderBy(assets.category),
            db.select({
              id: serviceContracts.id,
              contractNumber: serviceContracts.contractNumber,
              contractName: serviceContracts.contractName,
              projectName: projects.name,
              endDate: serviceContracts.endDate,
              status: serviceContracts.status,
              daysRemaining: sql<number>`${serviceContracts.endDate}::date - current_date`,
              contractType: sql<string>`'Support contract'`,
            }).from(serviceContracts)
              .leftJoin(projects, eq(serviceContracts.projectId, projects.id))
              .where(and(
                inArray(serviceContracts.status, ["active", "near_expiration"]),
                sql`${serviceContracts.endDate}::date between current_date and current_date + interval '60 days'`,
              ))
              .orderBy(serviceContracts.endDate).limit(500),
            db.select({ count: sql<number>`count(*)` }).from(serviceContracts).where(eq(serviceContracts.status, "expired")),
            db.select({
              id: vendorContracts.id,
              contractNumber: vendorContracts.contractNumber,
              contractName: vendorContracts.title,
              projectName: vendors.name,
              endDate: vendorContracts.endDate,
              status: vendorContracts.status,
              daysRemaining: sql<number>`${vendorContracts.endDate}::date - current_date`,
              contractType: vendorContracts.contractType,
            }).from(vendorContracts)
              .innerJoin(vendors, eq(vendorContracts.vendorId, vendors.id))
              .where(and(
                inArray(vendorContracts.status, ["Active", "Expiring Soon"]),
                sql`${vendorContracts.endDate}::date between current_date and current_date + interval '60 days'`,
              ))
              .orderBy(vendorContracts.endDate).limit(500),
            db.select({ count: sql<number>`count(*)` }).from(vendorContracts).where(eq(vendorContracts.status, "Expired")),
            db.select({
              id: assets.id,
              contractNumber: assets.assetTag,
              contractName: assets.name,
              projectName: assets.siteBuilding,
              endDate: assets.warrantyExpiry,
              status: sql<string>`case when ${assets.warrantyExpiry} < current_date then 'Expired' else 'Active' end`,
              daysRemaining: sql<number>`${assets.warrantyExpiry}::date - current_date`,
              contractType: sql<string>`'Warranty'`,
            }).from(assets).where(and(
              isNotNull(assets.warrantyExpiry),
              sql`${assets.warrantyExpiry}::date between current_date and current_date + interval '60 days'`,
              ...(assetConditions.length ? assetConditions : []),
            )).orderBy(assets.warrantyExpiry).limit(1000),
            db.select({ count: sql<number>`count(*)` }).from(assets).where(and(
              isNotNull(assets.warrantyExpiry),
              sql`${assets.warrantyExpiry}::date < current_date`,
              ...(assetConditions.length ? assetConditions : []),
            )),
          ]);
        const lifecycle = lifecycleRows.map(row => ({
          status: row.status ?? "Unspecified",
          count: numeric(row.count),
          valuation: numeric(row.valuation),
        }));
        const contracts = [...contractRows, ...vendorExpiryRows, ...warrantyRows].map(row => ({
          ...row,
          daysRemaining: numeric(row.daysRemaining),
        })).sort((a, b) => a.daysRemaining - b.daysRemaining);
        response.itam = {
          lifecycle,
          totalAssets: lifecycle.reduce((sum, row) => sum + row.count, 0),
          totalValuation: lifecycle.reduce((sum, row) => sum + row.valuation, 0),
          supportContracts: {
            within30Days: contracts.filter(row => row.daysRemaining <= 30).length,
            within60Days: contracts.filter(row => row.daysRemaining > 30 && row.daysRemaining <= 60).length,
            expiredContracts: numeric(expiredRows[0]?.count) +
              numeric(vendorExpiredRows[0]?.count) + numeric(expiredWarrantyRows[0]?.count),
            contracts,
          },
        };
        response.filters = {
          ...(response.filters as object),
          assetCategories: categoryRows.map(row => row.category).filter((value): value is string => Boolean(value)),
        };
      }

      return res.json(response);
    } catch (error) {
      console.error("Failed to build enterprise operations report", error);
      return res.status(500).json({ message: "Failed to load enterprise operations report." });
    }
  });

  app.get("/api/enterprise-reporting/audit-events", requireAuth, async (req: any, res) => {
    const parsed = enterpriseAuditFiltersSchema.safeParse(req.query);
    if (!parsed.success) return res.status(400).json({ message: "Invalid audit report filters", errors: parsed.error.issues });
    try {
      const permissions = await storage.getUserPermissions(req.user.id);
      if (!getReportAccess(permissions).audit) {
        return res.status(403).json({ message: "Audit reporting permission is required." });
      }
      const { from, to, category, action, assignmentGroupId } = parsed.data;
      const [enabled, itamEnabled] = await Promise.all([
        isFeatureEnabled("itsm"),
        isFeatureEnabled("asset_management"),
      ]);
      let groupRecordIds: string[] | undefined;
      if (assignmentGroupId) {
        const [group] = await db.select({ name: assignmentGroups.name }).from(assignmentGroups)
          .where(eq(assignmentGroups.id, assignmentGroupId));
        if (!group) return res.status(400).json({ message: "Assignment group not found." });
        if (enabled) {
          const [incidentIds, requestIds] = await Promise.all([
            db.select({ id: incidents.id }).from(incidents)
              .where(sql`lower(btrim(${incidents.assignmentGroup})) = lower(btrim(${group.name}))`),
            db.select({ id: serviceRequests.id }).from(serviceRequests)
              .where(sql`lower(btrim(${serviceRequests.assignmentGroup})) = lower(btrim(${group.name}))`),
          ]);
          groupRecordIds = [...incidentIds.map(row => row.id), ...requestIds.map(row => row.id)];
        } else {
          groupRecordIds = [];
        }
      }

      const conditions: any[] = [
        ...dateConditions(auditLogs.timestamp, { from, to }),
      ];
      if (action !== "all") conditions.push(eq(auditLogs.action, action));
      if (category === "itsm") conditions.push(inArray(auditLogs.tableName, ["incidents", "service_requests"]));
      if (category === "itam") conditions.push(inArray(auditLogs.tableName, ["assets", "assignments", "service_contracts"]));
      if (category === "other") conditions.push(sql`${auditLogs.tableName} not in ('incidents','service_requests','assets','assignments','service_contracts')`);
      if (category === "itsm" && !enabled || category === "itam" && !itamEnabled) conditions.push(sql`false`);
      if (category === "all") {
        if (!enabled) conditions.push(sql`${auditLogs.tableName} not in ('incidents','service_requests')`);
        if (!itamEnabled) conditions.push(sql`${auditLogs.tableName} not in ('assets','assignments','service_contracts')`);
      }
      if (assignmentGroupId !== undefined) {
        conditions.push(groupRecordIds?.length
          ? and(inArray(auditLogs.recordId, groupRecordIds), inArray(auditLogs.tableName, ["incidents", "service_requests"]))
          : sql`false`);
      }
      const rows = await db.select({
        id: auditLogs.id,
        timestamp: auditLogs.timestamp,
        action: auditLogs.action,
        tableName: auditLogs.tableName,
        recordId: auditLogs.recordId,
        recordName: auditLogs.recordName,
        oldValues: auditLogs.oldValues,
        newValues: auditLogs.newValues,
        userId: auditLogs.userId,
        username: users.username,
        firstName: users.firstName,
        lastName: users.lastName,
      }).from(auditLogs)
        .leftJoin(users, eq(auditLogs.userId, users.id))
        .where(conditions.length ? and(...conditions) : undefined)
        .orderBy(desc(auditLogs.timestamp)).limit(5000);
      res.setHeader("Cache-Control", "no-store, private");
      return res.json(rows.map(row => ({
        id: row.id,
        timestamp: row.timestamp,
        action: row.action,
        tableName: row.tableName,
        recordId: row.recordId,
        recordName: row.recordName,
        actor: [row.firstName, row.lastName].filter(Boolean).join(" ") || row.username || "System",
        summary: csvSafeAuditSummary(row.oldValues, row.newValues),
      })));
    } catch (error) {
      console.error("Failed to load audit events report", error);
      return res.status(500).json({ message: "Failed to load audit events report." });
    }
  });
}
