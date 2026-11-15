import { respondWithApiError } from "./api-error-handler";
import type { Express } from "express";
import { asc, eq, isNull, sql } from "drizzle-orm";
import { db } from "./db";
import { requireAuth } from "./auth";
import { isFeatureEnabled } from "./module-access";
import {
  assignments,
  departments,
  employeeAccessRights,
  employeeOffboardingClearances,
  employees,
  incidents,
  locations,
  projectTasks,
  serviceRequests,
  users,
} from "@shared/schema";

/**
 * A sanitized, read-only people report for authenticated employees.
 * Employee operations and access-governance APIs remain separately permission-gated.
 */
export function registerPersonnelReportRoute(app: Express) {
  app.get("/api/reports/personnel", requireAuth, async (_req, res) => {
    try {
      const [directory, accessStats, employeeActivity, clearanceActivity] =
        await Promise.all([
          db
            .select({
              id: employees.id,
              employeeId: employees.employeeId,
              firstName: employees.firstName,
              lastName: employees.lastName,
              department: sql<string | null>`coalesce(${departments.name}, ${employees.department})`,
              position: employees.position,
              location: locations.name,
              status: employees.status,
              startDate: employees.startDate,
            })
            .from(employees)
            .leftJoin(departments, eq(employees.departmentId, departments.id))
            .leftJoin(locations, eq(employees.locationId, locations.id))
            .where(eq(employees.status, "active"))
            .orderBy(asc(employees.lastName), asc(employees.firstName)),
          db
            .select({
              active: sql<number>`count(*) filter (where ${employeeAccessRights.status} = 'active')`,
              expiring: sql<number>`count(*) filter (
                where ${employeeAccessRights.status} = 'active'
                  and ${employeeAccessRights.expiresAt} >= current_date
                  and ${employeeAccessRights.expiresAt} <= current_date + interval '30 days'
              )`,
              expired: sql<number>`count(*) filter (
                where ${employeeAccessRights.status} = 'expired'
                  or (${employeeAccessRights.status} = 'active' and ${employeeAccessRights.expiresAt} < current_date)
              )`,
            })
            .from(employeeAccessRights),
          db
            .select({
              recentStarts: sql<number>`count(*) filter (
                where ${employees.startDate} >= current_date - interval '30 days'
              )`,
              recentOffboardings: sql<number>`count(*) filter (
                where ${employees.offboardedDate} >= current_date - interval '30 days'
              )`,
            })
            .from(employees),
          db
            .select({
              recentSignoffs: sql<number>`count(*) filter (
                where ${employeeOffboardingClearances.signedAt} >= now() - interval '30 days'
              )`,
            })
            .from(employeeOffboardingClearances),
        ]);

      const [assetsEnabled, projectsEnabled, itsmEnabled] = await Promise.all([
        isFeatureEnabled("asset_management"),
        isFeatureEnabled("project_management"),
        isFeatureEnabled("itsm"),
      ]);
      const [assetAssignments, projectWork, incidentWork, requestWork] = await Promise.all([
        assetsEnabled
          ? db.select({ employeeId: assignments.employeeId, total: sql<number>`count(*)` })
              .from(assignments)
              .where(isNull(assignments.returnedDate))
              .groupBy(assignments.employeeId)
          : [],
        projectsEnabled
          ? db.select({ employeeId: employees.id, total: sql<number>`count(*)` })
              .from(projectTasks)
              .innerJoin(users, eq(projectTasks.assigneeId, users.id))
              .innerJoin(employees, sql`lower(${users.email}) = lower(${employees.email})`)
              .where(sql`${projectTasks.status} <> 'Done'`)
              .groupBy(employees.id)
          : [],
        itsmEnabled
          ? db.select({ employeeId: employees.id, total: sql<number>`count(*)` })
              .from(incidents)
              .innerJoin(users, sql`${users.id} = coalesce(${incidents.assigneeId}, ${incidents.assignedToId})`)
              .innerJoin(employees, sql`lower(${users.email}) = lower(${employees.email})`)
              .where(sql`lower(${incidents.status}) not in ('closed', 'resolved')`)
              .groupBy(employees.id)
          : [],
        itsmEnabled
          ? db.select({ employeeId: employees.id, total: sql<number>`count(*)` })
              .from(serviceRequests)
              .innerJoin(users, sql`${users.id} = coalesce(${serviceRequests.assignedToId}, ${serviceRequests.assigneeId})`)
              .innerJoin(employees, sql`lower(${users.email}) = lower(${employees.email})`)
              .where(sql`lower(${serviceRequests.fulfillmentStatus}) not in ('closed', 'completed', 'cancelled', 'fulfilled')`)
              .groupBy(employees.id)
          : [],
      ]);
      const allocationByEmployee = new Map<string, { assets: number; projectTasks: number; tickets: number }>();
      const addAllocations = (rows: Array<{ employeeId: string | null; total: number | string }>, field: "assets" | "projectTasks" | "tickets") => {
        for (const row of rows) {
          if (!row.employeeId) continue;
          const current = allocationByEmployee.get(row.employeeId) ?? { assets: 0, projectTasks: 0, tickets: 0 };
          current[field] += Number(row.total ?? 0);
          allocationByEmployee.set(row.employeeId, current);
        }
      };
      addAllocations(assetAssignments, "assets");
      addAllocations(projectWork, "projectTasks");
      addAllocations(incidentWork, "tickets");
      addAllocations(requestWork, "tickets");

      res.json({
        directory: directory.map((employee) => ({
          ...employee,
          name: `${employee.firstName} ${employee.lastName}`.trim(),
          allocation: allocationByEmployee.get(employee.id) ?? { assets: 0, projectTasks: 0, tickets: 0 },
        })),
        summary: {
          activeEmployees: directory.length,
          recentStarts: Number(employeeActivity[0]?.recentStarts ?? 0),
          recentOffboardings: Number(employeeActivity[0]?.recentOffboardings ?? 0),
          activeAccessGrants: Number(accessStats[0]?.active ?? 0),
          expiringAccessGrants: Number(accessStats[0]?.expiring ?? 0),
          expiredAccessGrants: Number(accessStats[0]?.expired ?? 0),
          recentOffboardingSignoffs: Number(clearanceActivity[0]?.recentSignoffs ?? 0),
        },
        allocationModules: {
          assetManagement: assetsEnabled,
          projectManagement: projectsEnabled,
          itsm: itsmEnabled,
        },
      });
    } catch (error) {
      console.error("Failed to load personnel report", error);
      respondWithApiError(res, error, "Failed to load personnel report");
    }
  });
}
