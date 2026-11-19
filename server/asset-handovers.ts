import { respondWithApiError } from "./api-error-handler";
import type { Express, Request } from "express";
import { and, asc, desc, eq, ilike, isNull, notExists, or, sql } from "drizzle-orm";
import {
  assetHandovers,
  assignments,
  assets,
  auditLogs,
  dropdownOptions,
  employeeOffboardingClearances,
  employees,
  insertAssetHandoverSchema,
  users,
} from "@shared/schema";
import { parseDateValue } from "@shared/date-format";
import { db } from "./db";
import { requireAnyPermission, requireAuth, requirePermission } from "./auth";
import { z } from "zod";

const handoverTypeSchema = z.enum(["Issue / Assignment", "Return / Offboarding", "Replacement / Swap"]);
const dateString = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

function errorStatus(error: unknown): number | undefined {
  return (error as { status?: number } | null)?.status;
}

function employeeName(employee: { firstName: string; lastName: string }) {
  return `${employee.firstName} ${employee.lastName}`.trim();
}

function auditEntry(req: Request, actorId: string, action: string, id: string, number: string, data: unknown) {
  return {
    userId: actorId,
    action,
    tableName: "asset_handovers",
    recordId: id,
    recordName: number,
    newValues: JSON.stringify(data),
    ipAddress: req.ip || null,
    userAgent: req.get("user-agent") || null,
  };
}

function validIsoDate(value: string) {
  const parsed = parseDateValue(value);
  return parsed && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function isIssueType(type: string) {
  return type === "Issue / Assignment" || type === "Replacement / Swap";
}

export function registerAssetHandoverRoutes(app: Express) {
  app.get(
    "/api/asset-handovers/options",
    requireAuth,
    requireAnyPermission("assignment_create", "assignment_return", "asset_view", "system_admin"),
    async (req, res) => {
      try {
        const parsed = z.object({
          type: handoverTypeSchema.optional(),
          employeeId: z.string().uuid().optional(),
        }).safeParse(req.query);
        if (!parsed.success) return res.status(400).json({ message: "Invalid handover options", errors: parsed.error.issues });
        const type = parsed.data.type ?? "Issue / Assignment";
        const issue = isIssueType(type);

        let employeeRows;
        if (issue) {
          employeeRows = await db.select({
            id: employees.id,
            employeeId: employees.employeeId,
            firstName: employees.firstName,
            lastName: employees.lastName,
            email: employees.email,
            department: employees.department,
            status: employees.status,
          }).from(employees)
            .where(eq(employees.status, "active"))
            .orderBy(asc(employees.lastName), asc(employees.firstName));
        } else {
          employeeRows = await db.selectDistinct({
            id: employees.id,
            employeeId: employees.employeeId,
            firstName: employees.firstName,
            lastName: employees.lastName,
            email: employees.email,
            department: employees.department,
            status: employees.status,
          }).from(assignments)
            .innerJoin(employees, eq(employees.id, assignments.employeeId))
            .where(and(isNull(assignments.returnedDate), parsed.data.employeeId ? eq(employees.id, parsed.data.employeeId) : undefined))
            .orderBy(asc(employees.lastName), asc(employees.firstName));
        }

        let assetRows: Array<{
          id: string;
          name: string;
          assetTag: string | null;
          type: string;
          serialNumber: string | null;
          status: string;
        }>;
        if (issue) {
          assetRows = await db.select({
            id: assets.id,
            name: assets.name,
            assetTag: assets.assetTag,
            type: assets.type,
            serialNumber: assets.serialNumber,
            status: assets.status,
          }).from(assets)
            .where(and(
              sql`lower(btrim(${assets.status})) IN ('available', 'in stock', 'in_stock')`,
              notExists(db.select({ id: assignments.id }).from(assignments).where(and(
                eq(assignments.assetId, assets.id),
                isNull(assignments.returnedDate),
              ))),
              sql`lower(btrim(coalesce(${assets.type}, ''))) NOT IN ('software', 'cloud_service')`,
            ))
            .orderBy(asc(assets.name), asc(assets.assetTag));
        } else if (parsed.data.employeeId) {
          assetRows = await db.select({
            id: assets.id,
            name: assets.name,
            assetTag: assets.assetTag,
            type: assets.type,
            serialNumber: assets.serialNumber,
            status: assets.status,
          }).from(assignments)
            .innerJoin(assets, eq(assets.id, assignments.assetId))
            .where(and(eq(assignments.employeeId, parsed.data.employeeId), isNull(assignments.returnedDate)))
            .orderBy(asc(assets.name), asc(assets.assetTag));
        } else {
          assetRows = [];
        }

        const [types, conditions] = await Promise.all([
          db.select({ value: dropdownOptions.value, label: dropdownOptions.label })
            .from(dropdownOptions)
            .where(and(sql`lower(btrim(${dropdownOptions.category})) = 'handover_type'`, eq(dropdownOptions.isActive, true)))
            .orderBy(asc(dropdownOptions.displayOrder), asc(dropdownOptions.label)),
          db.select({ value: dropdownOptions.value, label: dropdownOptions.label })
            .from(dropdownOptions)
            .where(and(sql`lower(btrim(${dropdownOptions.category})) = 'asset_condition'`, eq(dropdownOptions.isActive, true)))
            .orderBy(asc(dropdownOptions.displayOrder), asc(dropdownOptions.label)),
        ]);
        res.json({ employees: employeeRows, assets: assetRows, types, conditions });
      } catch (error) {
        console.error("Failed to load asset handover options:", error);
        respondWithApiError(res, error, "Failed to load handover options");
      }
    },
  );

  app.get(
    "/api/asset-handovers",
    requireAuth,
    requireAnyPermission("asset_view", "assignment_create", "assignment_return", "employee_view", "system_admin"),
    async (req, res) => {
      try {
        const parsed = z.object({
          search: z.string().trim().max(120).optional(),
          type: handoverTypeSchema.optional(),
        }).safeParse(req.query);
        if (!parsed.success) return res.status(400).json({ message: "Invalid handover filters", errors: parsed.error.issues });
        const conditions = [];
        if (parsed.data.type) conditions.push(eq(assetHandovers.type, parsed.data.type));
        const search = parsed.data.search?.replace(/[%_]/g, "\\$&");
        if (search) {
          const pattern = `%${search}%`;
          conditions.push(or(
            ilike(assetHandovers.handoverNumber, pattern),
            ilike(assets.name, pattern),
            ilike(assets.assetTag, pattern),
            ilike(employees.employeeId, pattern),
            ilike(employees.firstName, pattern),
            ilike(employees.lastName, pattern),
            ilike(employees.email, pattern),
          )!);
        }
        const rows = await db.select({
          id: assetHandovers.id,
          handoverNumber: assetHandovers.handoverNumber,
          type: assetHandovers.type,
          employeeId: assetHandovers.employeeId,
          employeeNumber: employees.employeeId,
          employeeName: sql<string>`concat_ws(' ', ${employees.firstName}, ${employees.lastName})`,
          employeeEmail: employees.email,
          assetId: assetHandovers.assetId,
          assetName: assets.name,
          assetTag: assets.assetTag,
          assetType: assets.type,
          serialNumber: assets.serialNumber,
          assignmentId: assetHandovers.assignmentId,
          handoverDate: assetHandovers.handoverDate,
          condition: assetHandovers.condition,
          includedAccessories: assetHandovers.includedAccessories,
          notes: assetHandovers.notes,
          acknowledged: assetHandovers.acknowledged,
          acknowledgedAt: assetHandovers.acknowledgedAt,
          signatureData: assetHandovers.signatureData,
          createdAt: assetHandovers.createdAt,
          issuedByUserId: assetHandovers.issuedByUserId,
          issuedByName: sql<string | null>`concat_ws(' ', ${users.firstName}, ${users.lastName})`,
          assignmentReturnedDate: assignments.returnedDate,
        }).from(assetHandovers)
          .innerJoin(employees, eq(employees.id, assetHandovers.employeeId))
          .innerJoin(assets, eq(assets.id, assetHandovers.assetId))
          .innerJoin(assignments, eq(assignments.id, assetHandovers.assignmentId))
          .leftJoin(users, eq(users.id, assetHandovers.issuedByUserId))
          .where(conditions.length ? and(...conditions) : undefined)
          .orderBy(desc(assetHandovers.createdAt), desc(assetHandovers.handoverNumber));
        res.json(rows);
      } catch (error) {
        console.error("Failed to list asset handovers:", error);
        respondWithApiError(res, error, "Failed to load asset handovers");
      }
    },
  );

  app.get("/api/asset-handovers/:id", requireAuth, async (req, res) => {
    try {
      const [row] = await db.select({
        id: assetHandovers.id,
        handoverNumber: assetHandovers.handoverNumber,
        type: assetHandovers.type,
        employeeId: assetHandovers.employeeId,
        employeeNumber: employees.employeeId,
        employeeName: sql<string>`concat_ws(' ', ${employees.firstName}, ${employees.lastName})`,
        employeeEmail: employees.email,
        assetId: assetHandovers.assetId,
        assetName: assets.name,
        assetTag: assets.assetTag,
        assetType: assets.type,
        serialNumber: assets.serialNumber,
        handoverDate: assetHandovers.handoverDate,
        condition: assetHandovers.condition,
        includedAccessories: assetHandovers.includedAccessories,
        notes: assetHandovers.notes,
        acknowledged: assetHandovers.acknowledged,
        acknowledgedAt: assetHandovers.acknowledgedAt,
        signatureData: assetHandovers.signatureData,
        issuedByName: sql<string | null>`concat_ws(' ', ${users.firstName}, ${users.lastName})`,
        assignmentReturnedDate: assignments.returnedDate,
      }).from(assetHandovers)
        .innerJoin(assets, eq(assets.id, assetHandovers.assetId))
        .innerJoin(assignments, eq(assignments.id, assetHandovers.assignmentId))
        .leftJoin(users, eq(users.id, assetHandovers.issuedByUserId))
        .where(eq(assetHandovers.id, req.params.id))
        .limit(1);
      if (!row) return res.status(404).json({ message: "Handover receipt not found" });
      const viewerEmail = String((req.user as any)?.email ?? "").trim().toLowerCase();
      const isRecipient = viewerEmail !== "" && viewerEmail === String(row.employeeEmail ?? "").trim().toLowerCase();
      if (!isRecipient) {
        const permissions = await (await import("./storage")).storage.getUserPermissions((req.user as any)?.id);
        if (!["asset_view", "assignment_create", "assignment_return", "employee_view", "system_admin"].some(name => permissions.includes(name))) {
          return res.status(403).json({ message: "You cannot view this handover receipt" });
        }
      }
      res.json(row);
    } catch (error) {
      console.error("Failed to fetch asset handover:", error);
      respondWithApiError(res, error, "Failed to fetch handover receipt");
    }
  });

  app.post("/api/asset-handovers", requireAuth, requireAnyPermission("assignment_create", "assignment_return", "system_admin"), async (req, res) => {
    try {
      const parsed = insertAssetHandoverSchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ message: "Invalid handover data", errors: parsed.error.issues });
      const input = parsed.data;
      if (!validIsoDate(input.handoverDate)) return res.status(400).json({ message: "Enter a valid handover date in DD-MM-YYYY format" });
      const accessories = Array.from(new Set(input.includedAccessories.map(item => item.trim()).filter(Boolean)));
      if (accessories.length !== input.includedAccessories.length) {
        return res.status(400).json({ message: "Included accessories must be unique and non-empty" });
      }

      const actorId = String((req.user as any)?.id ?? "");
      if (!actorId) return res.status(401).json({ message: "Authentication required" });
      const created = await db.transaction(async tx => {
        const [asset] = await tx.select().from(assets).where(eq(assets.id, input.assetId)).for("update");
        if (!asset) throw Object.assign(new Error("Asset not found"), { status: 404 });
        const [employee] = await tx.select().from(employees).where(eq(employees.id, input.employeeId)).for("update");
        if (!employee) throw Object.assign(new Error("Employee not found"), { status: 404 });
        const [conditionOption] = await tx.select({ value: dropdownOptions.value }).from(dropdownOptions).where(and(
          sql`lower(btrim(${dropdownOptions.category})) = 'asset_condition'`,
          sql`lower(btrim(${dropdownOptions.value})) = ${input.condition.toLowerCase()}`,
          eq(dropdownOptions.isActive, true),
        )).limit(1);
        const [typeOption] = await tx.select({ value: dropdownOptions.value }).from(dropdownOptions).where(and(
          sql`lower(btrim(${dropdownOptions.category})) = 'handover_type'`,
          sql`lower(btrim(${dropdownOptions.value})) = ${input.type.toLowerCase()}`,
          eq(dropdownOptions.isActive, true),
        )).limit(1);
        if (!conditionOption || !typeOption) throw Object.assign(new Error("Select an active handover type and asset condition from System Dropdowns"), { status: 400 });
        const isIssue = isIssueType(input.type);
        if (isIssue && employee.status !== "active") throw Object.assign(new Error("Assets cannot be issued to a disabled employee"), { status: 409 });
        const [activeAssignment] = await tx.select().from(assignments)
          .where(and(eq(assignments.assetId, asset.id), isNull(assignments.returnedDate))).limit(1);
        if (isIssue) {
          if (activeAssignment) throw Object.assign(new Error("This asset is already assigned"), { status: 409 });
          const status = String(asset.status ?? "").trim().toLowerCase();
          if (!["available", "in stock", "in_stock"].includes(status)) {
            throw Object.assign(new Error("Only assets in stock can be issued"), { status: 409 });
          }
          if (["software", "cloud_service"].includes(String(asset.type ?? "").trim().toLowerCase())) {
            throw Object.assign(new Error("Only physical assets can be issued through custody handovers"), { status: 400 });
          }
        } else {
          if (!activeAssignment || activeAssignment.employeeId !== employee.id) {
            throw Object.assign(new Error("This asset is not currently assigned to the selected employee"), { status: 409 });
          }
          if (input.handoverDate < activeAssignment.assignedDate) {
            throw Object.assign(new Error("Return date cannot be before the assignment date"), { status: 400 });
          }
        }

        const year = input.handoverDate.slice(0, 4);
        await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${`asset-handover-number:${year}`} )::bigint)`);
        const [lastHandover] = await tx.select({ handoverNumber: assetHandovers.handoverNumber })
          .from(assetHandovers)
          .where(sql`${assetHandovers.handoverNumber} LIKE ${`HO-${year}-%`}`)
          .orderBy(desc(assetHandovers.handoverNumber))
          .limit(1);
        const lastSequence = Number(lastHandover?.handoverNumber?.split("-").at(-1) ?? 0);
        const handoverNumber = `HO-${year}-${String(lastSequence + 1).padStart(4, "0")}`;
        let assignmentId: string;
        if (isIssue) {
          const [assignment] = await tx.insert(assignments).values({
            assetId: asset.id,
            employeeId: employee.id,
            assignedDate: input.handoverDate,
            notes: `Custody receipt ${handoverNumber}${input.notes ? ` — ${input.notes}` : ""}`,
          }).returning({ id: assignments.id });
          assignmentId = assignment.id;
          await tx.update(assets).set({
            status: "assigned",
            assetOwner: employeeName(employee),
            updatedBy: actorId,
            lastUpdatedDate: new Date(),
          }).where(eq(assets.id, asset.id));
        } else {
          assignmentId = activeAssignment!.id;
          await tx.update(assignments).set({
            returnedDate: input.handoverDate,
            notes: activeAssignment!.notes
              ? `${activeAssignment!.notes}\nReturned under custody receipt ${handoverNumber}${input.notes ? ` — ${input.notes}` : ""}`
              : `Returned under custody receipt ${handoverNumber}${input.notes ? ` — ${input.notes}` : ""}`,
          }).where(eq(assignments.id, assignmentId));
          await tx.update(assets).set({
            status: input.condition === "Needs Repair" ? "maintenance" : "available",
            assetOwner: null,
            assetCondition: input.condition,
            updatedBy: actorId,
            lastUpdatedDate: new Date(),
          }).where(eq(assets.id, asset.id));
        }

        const [handover] = await tx.insert(assetHandovers).values({
          handoverNumber,
          type: input.type,
          employeeId: employee.id,
          assetId: asset.id,
          assignmentId,
          issuedByUserId: actorId,
          handoverDate: input.handoverDate,
          condition: input.condition,
          includedAccessories: accessories,
          notes: input.notes?.trim() || null,
        }).returning();
        await tx.insert(auditLogs).values(auditEntry(
          req,
          actorId,
          "CREATE",
          handover.id,
          handoverNumber,
          { type: handover.type, employeeId: employee.id, assetId: asset.id, handoverDate: handover.handoverDate, condition: handover.condition },
        ));

        if (!isIssue && employee.status === "disabled" && employee.offboardedDate) {
          const [remainingAssignment] = await tx.select({ id: assignments.id })
            .from(assignments)
            .where(and(eq(assignments.employeeId, employee.id), isNull(assignments.returnedDate)))
            .limit(1);
          if (!remainingAssignment) {
            const [waivedPhysicalClearance] = await tx.select({ id: employeeOffboardingClearances.id })
              .from(employeeOffboardingClearances)
              .where(and(
                eq(employeeOffboardingClearances.employeeId, employee.id),
                eq(employeeOffboardingClearances.offboardingDate, employee.offboardedDate),
                eq(employeeOffboardingClearances.clearanceType, "physical_asset_return"),
                eq(employeeOffboardingClearances.status, "waived"),
              ))
              .limit(1);
            if (waivedPhysicalClearance) {
              await tx.insert(employeeOffboardingClearances).values({
                employeeId: employee.id,
                offboardingDate: employee.offboardedDate,
                clearanceType: "physical_asset_return",
                status: "verified",
                note: `All assigned hardware was returned in custody receipt ${handoverNumber}.`,
                signedBy: actorId,
              });
            }
          }
        }
        return { id: handover.id, handoverNumber: handover.handoverNumber, type: handover.type, employeeId: handover.employeeId, assetId: handover.assetId, assignmentId: handover.assignmentId };
      });
      res.status(201).json(created);
    } catch (error) {
      if (error instanceof z.ZodError) return res.status(400).json({ message: "Invalid handover data", errors: error.issues });
      if (errorStatus(error)) return res.status(errorStatus(error)!).json({ message: (error as Error).message });
      console.error("Failed to create asset handover:", error);
      respondWithApiError(res, error, "Failed to create asset handover");
    }
  });

  app.get("/api/my/asset-handovers", requireAuth, requirePermission("my_assets_view"), async (req: any, res) => {
    try {
      const employeeId = req.user?.employeeId;
      if (!employeeId) return res.status(403).json({ message: "Link this account to an employee profile to view custody receipts." });
      const rows = await db.select({
        id: assetHandovers.id,
        handoverNumber: assetHandovers.handoverNumber,
        type: assetHandovers.type,
        handoverDate: assetHandovers.handoverDate,
        condition: assetHandovers.condition,
        includedAccessories: assetHandovers.includedAccessories,
        notes: assetHandovers.notes,
        acknowledged: assetHandovers.acknowledged,
        acknowledgedAt: assetHandovers.acknowledgedAt,
        signatureData: assetHandovers.signatureData,
        assetId: assets.id,
        assetTag: assets.assetTag,
        assetName: assets.name,
        assetType: assets.type,
        serialNumber: assets.serialNumber,
        assignmentReturnedDate: assignments.returnedDate,
        issuedByName: sql<string | null>`concat_ws(' ', ${users.firstName}, ${users.lastName})`,
      }).from(assetHandovers)
        .innerJoin(employees, eq(employees.id, assetHandovers.employeeId))
        .innerJoin(assets, eq(assets.id, assetHandovers.assetId))
        .innerJoin(assignments, eq(assignments.id, assetHandovers.assignmentId))
        .leftJoin(users, eq(users.id, assetHandovers.issuedByUserId))
        .where(and(
          eq(assetHandovers.employeeId, employeeId),
          isNull(assignments.returnedDate),
          or(
            eq(assetHandovers.type, "Issue / Assignment"),
            eq(assetHandovers.type, "Replacement / Swap"),
          ),
        ))
        .orderBy(desc(assetHandovers.createdAt));
      res.json(rows);
    } catch (error) {
      console.error("Failed to load current employee custody receipts:", error);
      respondWithApiError(res, error, "Failed to load your custody receipts");
    }
  });

  app.post("/api/my/asset-handovers/:id/acknowledge", requireAuth, requirePermission("my_assets_view"), async (req: any, res) => {
    try {
      const confirmation = z.object({ confirmed: z.literal(true) }).safeParse(req.body);
      if (!confirmation.success) return res.status(400).json({ message: "Confirm that you received this asset before signing" });
      const employeeId = req.user?.employeeId;
      if (!employeeId) return res.status(403).json({ message: "No employee record is linked to this account" });
      const [employee] = await db.select({
        id: employees.id,
        firstName: employees.firstName,
        lastName: employees.lastName,
      }).from(employees)
        .where(eq(employees.id, employeeId))
        .limit(1);
      if (!employee) return res.status(403).json({ message: "No employee record is linked to this account" });
      const result = await db.transaction(async tx => {
        const [handover] = await tx.select().from(assetHandovers)
          .where(and(eq(assetHandovers.id, req.params.id), eq(assetHandovers.employeeId, employee.id)))
          .for("update");
        if (!handover) throw Object.assign(new Error("Handover receipt not found"), { status: 404 });
        if (!isIssueType(handover.type)) throw Object.assign(new Error("Only an issued custody receipt can be acknowledged here"), { status: 400 });
        if (handover.acknowledged) throw Object.assign(new Error("This receipt has already been acknowledged"), { status: 409 });
        const acknowledgedAt = new Date();
        const signatureData = JSON.stringify({
          kind: "electronic_acknowledgment",
          signer: employeeName(employee),
          employeeId: employee.id,
          userId: String(req.user.id),
          statement: "I acknowledge receipt of this assigned asset and the listed accessories.",
          acknowledgedAt: acknowledgedAt.toISOString(),
        });
        const [updated] = await tx.update(assetHandovers).set({
          acknowledged: true,
          acknowledgedAt,
          signatureData,
        }).where(and(eq(assetHandovers.id, handover.id), eq(assetHandovers.acknowledged, false))).returning();
        if (!updated) throw Object.assign(new Error("This receipt has already been acknowledged"), { status: 409 });
        await tx.insert(auditLogs).values(auditEntry(
          req,
          String(req.user.id),
          "ACKNOWLEDGE",
          updated.id,
          updated.handoverNumber,
          { acknowledged: true, acknowledgedAt, signer: employeeName(employee) },
        ));
        return { id: updated.id, acknowledged: updated.acknowledged, acknowledgedAt: updated.acknowledgedAt };
      });
      res.json(result);
    } catch (error) {
      if (errorStatus(error)) return res.status(errorStatus(error)!).json({ message: (error as Error).message });
      console.error("Failed to acknowledge asset handover:", error);
      respondWithApiError(res, error, "Failed to acknowledge handover receipt");
    }
  });
}
