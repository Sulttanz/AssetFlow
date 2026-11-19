import type { Express, RequestHandler } from "express";
import { randomUUID } from "node:crypto";
import { ensureDropdownIntegrity } from "./dropdown-integrity";
import { dropdownIdentity, normalizeLookupKey } from "@shared/dropdown-utils";
import { getStandardRoleKey, STANDARD_ROLE_DEFINITIONS } from "@shared/role-catalog";
import { formatExportValue, toDateInputValue, toSpreadsheetDateInput } from "@shared/date-format";
import { createServer, type Server } from "http";
import { storage, computeTicketSlaDates } from "./storage";
import { setupAuth, requireAuth, requirePermission, requireAnyPermission, hashPassword, cabStreamHasAccess, cabStreamHasActiveAccount, invalidateUserSessions, withUserSessionLock } from "./auth";
import { registerSystemClearDataRoute } from "./system-clear-data-route";
import multer from "multer";
import rateLimit from "express-rate-limit";
import ExcelJS from "exceljs";
import type { PoolClient } from "pg";
import { calculateDepreciation, generateDepreciationSchedule } from "./depreciation";
import { 
  insertAssetSchema, insertEmployeeSchema, insertAssignmentSchema, departments,
  insertLocationSchema, insertDepartmentSchema, insertVendorSchema,
  insertPurchaseOrderSchema, insertPurchaseOrderItemSchema, insertBudgetSchema, insertMaintenanceScheduleSchema, 
  insertMaintenanceRecordSchema, maintenanceRecordSubmissionSchema, insertUserSchema, insertRoleSchema,
  insertPermissionSchema, insertUserRoleSchema, insertSystemSettingSchema, insertDropdownOptionSchema,
  insertContractSchema, insertAssetBookingSchema, insertAssetDisposalRecordSchema, insertAssetAuditSessionSchema, insertAssetAuditItemSchema, insertAssetRelationshipSchema, insertAssetRequestSchema,
  insertServiceContractSchema, updateServiceContractSchema, serviceContracts, systemNotifications,
  insertTicketSchema, insertTicketCommentSchema, insertTicketAttachmentSchema,
  assetAttachments, ticketAttachments, risks, changes, changeBlackouts, changeApprovals, users, employees, employeeAccessRights, employeeOffboardingClearances, auditLogs, assets, assignments, contracts, softwareLicenseAllocations, dropdownOptions,
  incidents, incidentActivities, incidentCatalogItems, insertIncidentCatalogItemSchema, serviceRequestActivities,
  projects, projectManagers, projectTeamMembers, projectTasks, insertProjectSchema, slaPolicies, serviceRequests, insertIncidentSchema, updateIncidentSchema, insertServiceRequestSchema, catalogItems, roles, userRoles, vendors,
  assignmentGroups, assignmentGroupMembers, insertAssignmentGroupSchema, insertGroupMemberSchema,
  warehouseLocations, consumables, consumableStockMovements, consumableDispatchLog, purchaseOrderItemReceipts, purchaseOrders,
  vendorQuotations, vendorQuotationItems, purchaseInvoices, purchaseInvoiceItems, purchaseInvoiceMatchLines, purchaseInvoicePayments,
  purchaseReturns, purchaseReturnItems,
  financeTaxSettings, financeTaxSettingsInputSchema, financeTaxRates, financeTaxRateInputSchema,
  financeDocumentSequences, financeDocumentSequenceInputSchema,
  insertVendorQuotationSchema, insertPurchaseInvoiceSchema, insertPurchaseInvoicePaymentSchema, insertPurchaseReturnSchema,
  insertWarehouseLocationSchema, insertConsumableSchema, insertCatalogItemSchema, purchaseOrderItems,
  cmdbApplications, servers, applicationServerLinks, changeCiLinks, changeAssetLinks, assetRelationships,
  configurationDocuments, insertCmdbApplicationSchema, insertServerSchema,
  employeeOffboardingSubmissionSchema
} from "@shared/schema";
import { MODULE_REGISTRY, isValidModuleKey, getModuleDefinition } from "@shared/modules";
import { isFeatureEnabled, sendFeatureNotEnabled } from "./module-access";
import { APP_VERSION } from "@shared/version";
import { calculateDocumentTotals, ProcurementPricingError } from "@shared/procurement-pricing";
import { canTransitionPurchaseOrder } from "@shared/purchase-order-lifecycle";
import { db, pool } from "./db";
import { eq, and, inArray, isNull, isNotNull, sql, or, ilike, desc, asc, gte, lt, lte } from "drizzle-orm";
import {
  ACCESS_DROPDOWN_CATEGORIES,
  ACCESS_TYPES,
  classifyAccessAsset,
  type AccessType,
} from "@shared/access-governance";
import { getPersonaRoleKeys, isPersonaApiAllowed } from "@shared/personas";
import { isDemoViewer } from "@shared/demo-viewer";
import { allocateSoftwareSeat, releaseSoftwareSeat, updateAssetWithLicenseChecks, AssetLicenseError } from "./asset-licensing";
import { z } from "zod";
import { publishCabChange, publishItsmEnabled, subscribeToCabEvents, subscribeToItsmAccessEvents } from "./cab-events";
import { compareAppVersions } from "./startup-migrations";
import { buildReportWorkbook, reportExportSchema } from "./report-export";
import { registerKnowledgeRoutes } from "./knowledge-governance";
import { catalogMutationError, catalogRequestHandler, isStructuredCatalogItem, loadCatalogViewer, registerServiceCatalogRoutes, syncLegacyCatalogItem } from "./service-catalog";
import { isGovernedVendorContract, normalizeVendorContacts, registerVendorContractRoutes } from "./vendor-contracts";
import { vendorContracts, vendorContractAssets, type InsertVendor } from "@shared/schema";
import { serviceApprovalRoles } from "@shared/service-catalog";
import { registerAssetHandoverRoutes } from "./asset-handovers";
import { registerNetworkTopologyRoutes } from "./network-topology";
import { registerBackupGovernanceRoutes } from "./backup-governance";
import { registerItComponentsComplianceRoutes } from "./it-components-compliance-report";
import { registerDataMigrationRoutes } from "./data-migration-center";
import { registerProjectManagementRoutes } from "./project-management";
import { IncidentTransitionError, transitionIncident } from "./incident-lifecycle";
import { registerPersonnelReportRoute } from "./personnel-report";
import { resolveIncidentContractContext } from "./incident-contract-resolution";
import { registerEnterpriseReportingRoutes } from "./enterprise-reporting";
import { receivePurchaseOrderInventory } from "./procurement-inventory";
import { reserveFinancialDocumentNumber } from "./finance-document-numbering";
import { respondWithApiError } from "./api-error-handler";

// Column order is part of the import format; both template and export use it.
const assetSpreadsheetColumns = [
  { header: 'Name*', key: 'name', width: 25 },
  { header: 'Asset ID', key: 'assetTag', width: 15 },
  { header: 'Type*', key: 'type', width: 15 },
  { header: 'Serial Number', key: 'serialNumber', width: 20 },
  { header: 'Model', key: 'model', width: 20 },
  { header: 'Status', key: 'status', width: 15 },
  { header: 'Specifications', key: 'specifications', width: 30 },
  { header: 'Location Name', key: 'locationName', width: 20 },
  { header: 'Department Name', key: 'departmentName', width: 20 },
  { header: 'Information Classification', key: 'informationClassification', width: 25 },
  { header: 'Criticality', key: 'dataSensitivityLevel', width: 15 },
  { header: 'Data Types', key: 'dataTypes', width: 25 },
  { header: 'Asset Owner', key: 'assetOwner', width: 20 },
  { header: 'Asset Custodian', key: 'assetCustodian', width: 20 },
  { header: 'Vendor Name', key: 'vendor', width: 20 },
  { header: 'Invoice Number', key: 'invoiceNumber', width: 20 },
  { header: 'Purchase Price', key: 'purchasePrice', width: 15 },
  { header: 'Purchase Date', key: 'purchaseDate', width: 15 },
  { header: 'Warranty Expiry', key: 'warrantyExpiry', width: 15 },
  { header: 'Maintenance Costs', key: 'maintenanceCosts', width: 15 },
  { header: 'Compliance Status', key: 'complianceStatus', width: 20 },
  { header: 'Security Controls', key: 'securityControlsImplemented', width: 25 },
  { header: 'Risk Assessment Score', key: 'riskAssessmentScore', width: 20 },
  { header: 'Lifecycle Status', key: 'lifecycleStatus', width: 20 },
  { header: 'Planned Disposal Date', key: 'plannedDisposalDate', width: 20 },
  { header: 'Backup Required', key: 'backupStatus', width: 15 },
  { header: 'Access Control Method', key: 'accessControlMethod', width: 25 },
  { header: 'Physical Security Level', key: 'physicalSecurityLevel', width: 25 },
  { header: 'Last Audit Date', key: 'lastAuditDate', width: 15 },
  { header: 'Next Audit Date', key: 'nextAuditDate', width: 15 },
];

// Middleware factory to gate a route behind a module being enabled
export function checkModuleEnabled(moduleKey: string) {
  return async (req: any, res: any, next: any) => {
    try {
      if (!getModuleDefinition(moduleKey)) {
        return res.status(404).json({ error: "Unknown Feature", code: "UNKNOWN_FEATURE", moduleKey });
      }
      const enabled = await isFeatureEnabled(moduleKey);
      if (!enabled) {
        return sendFeatureNotEnabled(res, moduleKey);
      }
      next();
    } catch (error) {
      respondWithApiError(res, error, "Failed to verify module status");
    }
  };
}

export const requireModule = checkModuleEnabled;

const MODULE_API_PREFIXES: Array<[string, string]> = [
  ...[
    "/applications",
    "/servers",
    "/network-topology",
    "/backup-schedules",
    "/cmdb",
  ].map((prefix) => [prefix, "cmdb"] as [string, string]),
  ...[
    "/assets",
    "/my/assets",
    "/dashboard/stats",
    "/assignments",
    "/maintenance",
    "/maintenance-schedules",
    "/maintenance-records",
    "/asset-bookings",
    "/asset-disposal",
    "/asset-requests",
    "/asset-audits",
    "/asset-handovers",
    "/network-topology",
    "/backup-schedules",
    "/employees",
    "/departments",
    "/locations",
    "/vendors",
    "/purchase-orders",
    "/quotations",
    "/vendor-quotations",
    "/purchase-invoices",
    "/purchase-returns",
    "/budgets",
    "/contracts",
    "/reports",
    "/import/assets",
  ].map((prefix) => [prefix, "asset_management"] as [string, string]),
  ...[
    "/incidents",
    "/service-requests",
    "/tickets",
    "/changes",
    "/problems",
    "/catalog",
    "/service-catalog",
    "/reports/tickets",
    "/reports/problems",
    "/reports/changes",
  ].map((prefix) => [prefix, "itsm"] as [string, string]),
  ["/kpis", "itsm"],
  ["/projects", "project_management"],
  ["/risks", "risk_management"],
  ["/risk-users", "risk_management"],
];

export function moduleForApiPath(path: string): string | undefined {
  const normalizedPath = path.split("?", 1)[0];
  if (["/kb", "/kb-articles", "/reports/kb-articles", "/reports/personnel"].some(prefix =>
    normalizedPath === prefix || normalizedPath.startsWith(`${prefix}/`)
  )) return undefined;
  return [...MODULE_API_PREFIXES].sort((a, b) => b[0].length - a[0].length).find(([prefix]) =>
    path === prefix || path.startsWith(`${prefix}/`)
  )?.[1];
}

export function isServiceContractApiRequest(
  method: string,
  path: string,
  query: Record<string, unknown> = {},
  body: Record<string, unknown> = {},
): boolean {
  const upperMethod = method.toUpperCase();
  if (/^\/contracts\/\d+$/.test(path) && ["GET", "PUT", "PATCH", "DELETE"].includes(upperMethod)) return true;
  if (path !== "/contracts") return false;
  if (upperMethod === "POST") return body !== null && typeof body === "object" && "contractName" in body;
  if (upperMethod !== "GET") return false;
  return query.kind === "service" ||
    query.projectId !== undefined ||
    query.nearExpiration !== undefined ||
    query.status !== undefined;
}

export function moduleForApiRequest(
  method: string,
  path: string,
  query: Record<string, unknown> = {},
  body: Record<string, unknown> = {},
): string | undefined {
  return isServiceContractApiRequest(method, path, query, body)
    ? "asset_management"
    : moduleForApiPath(path);
}

function requireContractPermission(method: string) {
  return (req: any, res: any, next: any) => {
    const path = req.params?.id ? `/contracts/${req.params.id}` : "/contracts";
    const serviceContractRequest = isServiceContractApiRequest(
      method,
      path,
      req.query as Record<string, unknown>,
      req.body as Record<string, unknown>,
    );
    if (serviceContractRequest) {
      const permissionGuard = method.toUpperCase() === "GET"
        ? requireAnyPermission("asset_view", "asset_update", "system_admin")
        : requireAnyPermission("asset_update", "system_admin");
      return permissionGuard(req, res, next);
    }
    if (method.toUpperCase() === "GET") {
      return requireAnyPermission("finance_view", "purchase_order_create", "purchase_order_update", "budget_create", "budget_update", "system_admin")(req, res, next);
    }
    return requirePermission("system_admin")(req, res, next);
  };
}

export function getServiceContractStatus(
  contract: { status: string; startDate: string; endDate: string; renewalNoticeDays: number },
  today = new Date(),
): "active" | "near_expiration" | "expired" | "renewed" {
  if (contract.status === "renewed") return "renewed";
  const todayValue = toDateInputValue(today);
  if (contract.endDate <= todayValue) return "expired";
  if (contract.startDate <= todayValue) {
    const noticeDate = new Date(`${todayValue}T00:00:00.000Z`);
    noticeDate.setUTCDate(noticeDate.getUTCDate() + contract.renewalNoticeDays);
    if (contract.endDate <= noticeDate.toISOString().slice(0, 10)) return "near_expiration";
  }
  return "active";
}

const serviceContractListQuerySchema = z.object({
  kind: z.literal("service").optional(),
  projectId: z.string().trim().min(1).optional(),
  status: z.enum(["active", "near_expiration", "expired", "renewed"]).optional(),
  nearExpiration: z.enum(["true", "false"]).optional(),
}).strict();

function isDatabaseConstraintError(error: unknown, code: string): boolean {
  if (typeof error !== "object" || error === null) return false;
  const databaseError = error as { code?: unknown; cause?: { code?: unknown } };
  return databaseError.code === code || databaseError.cause?.code === code;
}

// Audit logging helper function
async function logAudit(
  userId: string | undefined,
  action: 'CREATE' | 'UPDATE' | 'DELETE' | 'VIEW' | 'BULK_UPDATE',
  tableName: string,
  recordId: string,
  recordName: string,
  oldValues?: any,
  newValues?: any,
  req?: any
) {
  try {
    await storage.createAuditLog({
      userId: userId || null,
      action,
      tableName,
      recordId,
      recordName,
      oldValues: oldValues ? JSON.stringify(oldValues) : null,
      newValues: newValues ? JSON.stringify(newValues) : null,
      ipAddress: req?.ip || null,
      userAgent: req?.get('user-agent') || null
    });
  } catch (error) {
    console.error('Failed to create audit log:', error);
    // Don't throw - audit logging should not break the main operation
  }
}

async function listServiceContracts(req: any, res: any) {
  const parsed = serviceContractListQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    return res.status(400).json({ message: "Invalid service contract filters", errors: parsed.error.issues });
  }
  try {
    const rows = await db.select()
      .from(serviceContracts)
      .where(parsed.data.projectId ? eq(serviceContracts.projectId, parsed.data.projectId) : undefined)
      .orderBy(asc(serviceContracts.endDate), asc(serviceContracts.id));
    const today = new Date();
    let result = rows.map(row => ({ ...row, status: getServiceContractStatus(row, today) }));
    if (parsed.data.status) result = result.filter(row => row.status === parsed.data.status);
    if (parsed.data.nearExpiration === "true") result = result.filter(row => row.status === "near_expiration");
    if (parsed.data.nearExpiration === "false") result = result.filter(row => row.status !== "near_expiration");
    return res.json(result);
  } catch (error) {
    console.error("Failed to fetch service contracts:", error);
    return respondWithApiError(res, error, "Failed to fetch service contracts");
  }
}

async function getServiceContractById(id: number, res: any) {
  if (!Number.isSafeInteger(id) || id <= 0) return res.status(400).json({ message: "Invalid service contract ID" });
  try {
    const [contract] = await db.select().from(serviceContracts).where(eq(serviceContracts.id, id)).limit(1);
    if (!contract) return res.status(404).json({ message: "Service contract not found" });
    return res.json({ ...contract, status: getServiceContractStatus(contract) });
  } catch (error) {
    console.error("Failed to fetch service contract:", error);
    return respondWithApiError(res, error, "Failed to fetch service contract");
  }
}

async function createServiceContract(req: any, res: any) {
  const parsed = insertServiceContractSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: "Invalid service contract data", errors: parsed.error.issues });
  try {
    const [contract] = await db.insert(serviceContracts).values(parsed.data).returning();
    await logAudit(req.user?.id, "CREATE", "service_contracts", String(contract.id), contract.contractName, null, contract, req);
    return res.status(201).json({ ...contract, status: getServiceContractStatus(contract) });
  } catch (error) {
    if (isDatabaseConstraintError(error, "23505")) return res.status(409).json({ message: "A service contract with this number already exists" });
    if (isDatabaseConstraintError(error, "23503")) return res.status(400).json({ message: "The selected project or SLA policy does not exist" });
    console.error("Failed to create service contract:", error);
    return respondWithApiError(res, error, "Failed to create service contract");
  }
}

async function updateServiceContract(id: number, req: any, res: any) {
  if (!Number.isSafeInteger(id) || id <= 0) return res.status(400).json({ message: "Invalid service contract ID" });
  const parsed = updateServiceContractSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: "Invalid service contract data", errors: parsed.error.issues });
  if (Object.keys(parsed.data).length === 0) return res.status(400).json({ message: "At least one service contract field is required" });
  try {
    const [existing] = await db.select().from(serviceContracts).where(eq(serviceContracts.id, id)).limit(1);
    if (!existing) return res.status(404).json({ message: "Service contract not found" });
    const startDate = parsed.data.startDate ?? existing.startDate;
    const endDate = parsed.data.endDate ?? existing.endDate;
    if (endDate < startDate) return res.status(400).json({ message: "End date must be on or after start date" });
    const [updated] = await db.update(serviceContracts)
      .set(parsed.data)
      .where(eq(serviceContracts.id, id))
      .returning();
    await logAudit(req.user?.id, "UPDATE", "service_contracts", String(id), updated.contractName, existing, updated, req);
    return res.json({ ...updated, status: getServiceContractStatus(updated) });
  } catch (error) {
    if (isDatabaseConstraintError(error, "23505")) return res.status(409).json({ message: "A service contract with this number already exists" });
    if (isDatabaseConstraintError(error, "23503")) return res.status(400).json({ message: "The selected project or SLA policy does not exist" });
    console.error("Failed to update service contract:", error);
    return respondWithApiError(res, error, "Failed to update service contract");
  }
}

async function deleteServiceContract(id: number, req: any, res: any) {
  if (!Number.isSafeInteger(id) || id <= 0) return res.status(400).json({ message: "Invalid service contract ID" });
  try {
    const [contract] = await db.select().from(serviceContracts).where(eq(serviceContracts.id, id)).limit(1);
    if (!contract) return res.status(404).json({ message: "Service contract not found" });
    await db.delete(serviceContracts).where(eq(serviceContracts.id, id));
    await logAudit(req.user?.id, "DELETE", "service_contracts", String(id), contract.contractName, contract, null, req);
    return res.status(204).send();
  } catch (error) {
    console.error("Failed to delete service contract:", error);
    return respondWithApiError(res, error, "Failed to delete service contract");
  }
}

async function logEmployeeAccessMutation(
  executor: any,
  input: {
    actorId?: string | null;
    actorIp?: string | null;
    userAgent?: string | null;
    action: "GRANT" | "MODIFY" | "REVOKE" | "EXPIRE" | "EXTEND";
    recordId: string;
    recordName: string;
    reason: string;
    oldValues?: unknown;
    newValues: unknown;
  },
) {
  await executor.insert(auditLogs).values({
    userId: input.actorId ?? null,
    action: input.action,
    tableName: "employee_access_rights",
    recordId: input.recordId,
    recordName: input.recordName,
    oldValues: input.oldValues == null ? null : JSON.stringify(input.oldValues),
    newValues: JSON.stringify({ ...(input.newValues as object), reason: input.reason }),
    timestamp: new Date(),
    ipAddress: input.actorIp ?? "system",
    userAgent: input.userAgent ?? "automated-access-expiry",
  });
}

async function expireDueEmployeeAccessRights() {
  try {
    const today = toDateInputValue(new Date());
    return await db.transaction(async tx => {
      const expiredRows = await tx.update(employeeAccessRights).set({
        status: "expired",
        updatedAt: new Date(),
      }).where(and(
        eq(employeeAccessRights.status, "active"),
        sql`${employeeAccessRights.expiresAt} IS NOT NULL AND ${employeeAccessRights.expiresAt} <= ${today}::date`,
      )).returning();
      for (const row of expiredRows) {
        await logEmployeeAccessMutation(tx, {
          action: "EXPIRE",
          recordId: row.id,
          recordName: `${row.applicationName} access expired`,
          reason: `Access automatically expired on ${row.expiresAt ?? "its end date"}.`,
          oldValues: { status: "active", expiresAt: row.expiresAt },
          newValues: { status: "expired", expiresAt: row.expiresAt, employeeId: row.employeeId },
        });
      }
      return expiredRows.length;
    });
  } catch (error) {
    console.error("Failed to expire employee access rights:", error);
    return 0;
  }
}

let employeeAccessExpiryInterval: NodeJS.Timeout | undefined;

function getAccessExpiryState(status: string, expiresAt: string | null) {
  if (status === "revoked") return "revoked" as const;
  if (status === "expired") return "expired" as const;
  if (!expiresAt) return "active" as const;
  const today = toDateInputValue(new Date());
  if (expiresAt <= today) return "expired" as const;
  const horizon = new Date();
  horizon.setDate(horizon.getDate() + 30);
  return expiresAt <= toDateInputValue(horizon) ? "expiring" as const : "active" as const;
}

// Idempotently ensures ITSM permissions exist and are granted to the System Administrator role.
// This runs on every startup so it works for deployments that already have their permission
// set seeded (the one-time /api/system/seed-data route only seeds when no users exist yet).
async function ensureItsmPermissions() {
  try {
    const ITSM_PERMISSIONS: Array<{ name: string; description: string; resource: string; action: string }> = [
      { name: "ticket_view_all", description: "View all tickets (full queue)", resource: "tickets", action: "view" },
      { name: "ticket_manage", description: "Assign, update status, edit, and delete any ticket", resource: "tickets", action: "manage" },
      { name: "risk_manage", description: "Create and manage ITSM risk records", resource: "risks", action: "manage" },
    ];

    const existingPermissions = await storage.getPermissions();
    const existingByName = new Map(existingPermissions.map(p => [p.name, p]));

    const createdOrExisting: string[] = [];
    for (const perm of ITSM_PERMISSIONS) {
      let permission = existingByName.get(perm.name);
      if (!permission) {
        permission = await storage.createPermission(perm);
        console.log(`✅ Created missing permission: ${perm.name}`);
      }
      createdOrExisting.push(permission.id);
    }

    const rolesWithDetails = await storage.getRolesWithDetails();
    const adminRole = rolesWithDetails.find(r => getStandardRoleKey(r.name) === "system_admin");
    if (adminRole) {
      const grantedPermissionIds = new Set((adminRole.permissions || []).map(p => p.id));
      for (const permissionId of createdOrExisting) {
        if (!grantedPermissionIds.has(permissionId)) {
          await storage.assignRolePermission(adminRole.id, permissionId);
          console.log(`✅ Granted ITSM permission to System Administrator role`);
        }
      }
    }
  } catch (error) {
    console.error("Failed to ensure ITSM permissions:", error);
  }
}

const PERSONA_PERMISSION_DEFINITIONS = [
  { name: "asset_view", description: "View the asset inventory", resource: "assets", action: "view" },
  { name: "my_assets_view", description: "View assets assigned to the signed-in employee", resource: "assets", action: "view_own" },
  { name: "access_governance_view", description: "View access governance records without changing them", resource: "access_governance", action: "view" },
  { name: "audit_view", description: "View system audit records", resource: "audit_logs", action: "view" },
  { name: "cmdb_view", description: "View application and server configuration records", resource: "cmdb", action: "view" },
  { name: "finance_view", description: "View financial management records", resource: "finance", action: "view" },
  { name: "offboarding_approve", description: "Review and complete employee offboarding clearance", resource: "employees", action: "approve_offboarding" },
  { name: "change_view_all", description: "View all change requests and CAB impact summaries", resource: "changes", action: "view" },
  { name: "change_approve", description: "Approve or reject assigned change requests", resource: "changes", action: "approve" },
  { name: "change_manage", description: "Manage change requests and CAB assignments", resource: "changes", action: "manage" },
  { name: "project_view", description: "View project plans, members, milestones, and linked assets", resource: "projects", action: "view" },
  { name: "project_manage", description: "Create and update project plans, assignments, milestones, and linked assets", resource: "projects", action: "manage" },
] as const;

const PERSONA_ROLE_PERMISSIONS = {
  end_user: ["my_assets_view"],
  it_agent: [
    "asset_view", "asset_create", "asset_update", "asset_delete",
    "assignment_create", "assignment_update", "assignment_return",
    "maintenance_create", "maintenance_update", "maintenance_delete",
    "ticket_view_all", "ticket_manage", "user_view",
  ],
  cab_member: [
    "change_view_all", "change_approve", "cmdb_view", "finance_view", "offboarding_approve",
  ],
  it_manager: [
    "asset_view", "asset_create", "asset_update", "asset_delete",
    "assignment_create", "assignment_update", "assignment_return",
    "maintenance_create", "maintenance_update", "maintenance_delete",
    "ticket_view_all", "ticket_manage", "user_view", "employee_update", "offboarding_approve",
    "change_view_all", "change_approve", "change_manage", "cmdb_view", "finance_view",
    "purchase_order_create", "purchase_order_update", "purchase_order_delete",
    "budget_create", "budget_update", "budget_delete",
    "project_view", "project_manage",
  ],
  auditor: ["asset_view", "access_governance_view", "audit_view"],
} as const;

async function ensurePersonaRoles() {
  try {
    const existingPermissions = await storage.getPermissions();
    const permissionByName = new Map(existingPermissions.map(permission => [permission.name, permission]));
    for (const definition of PERSONA_PERMISSION_DEFINITIONS) {
      if (permissionByName.has(definition.name)) continue;
      const created = await storage.createPermission(definition);
      permissionByName.set(created.name, created);
    }

    const rolesWithDetails = await storage.getRolesWithDetails();
    const standardRoleKeys = new Set(rolesWithDetails
      .map(role => getStandardRoleKey(role.name))
      .filter((key): key is NonNullable<typeof key> => key !== null));
    for (const definition of STANDARD_ROLE_DEFINITIONS) {
      if (standardRoleKeys.has(definition.key)) continue;
      await storage.createRole({
        name: definition.key,
        description: definition.description,
        isSystemRole: true,
      });
      standardRoleKeys.add(definition.key);
    }

    const allRoles = await storage.getRolesWithDetails();
    for (const role of allRoles) {
      const standardRoleKey = getStandardRoleKey(role.name);
      const personaKey = getPersonaRoleKeys([role.name])[0];
      const isAdmin = standardRoleKey === "system_admin";
      const desiredNames = new Set<string>();

      if (isAdmin) {
        permissionByName.forEach(permission => desiredNames.add(permission.name));
      } else if (personaKey) {
        PERSONA_ROLE_PERMISSIONS[personaKey].forEach(name => desiredNames.add(name));
      } else {
        const existingPermissionNames = new Set((role.permissions || []).map(permission => permission.name));
        if (["asset_create", "asset_update", "asset_delete", "compliance_view", "assignment_create", "assignment_update", "maintenance_create", "maintenance_update"].some(name => existingPermissionNames.has(name))) {
          // Preserve existing asset roles while adding the explicit read permission.
          desiredNames.add("asset_view");
        }
        if (["purchase_order_create", "purchase_order_update", "budget_create", "budget_update"].some(name => existingPermissionNames.has(name))) {
          desiredNames.add("finance_view");
        }
      }

      const granted = new Set((role.permissions || []).map(permission => permission.name));
      await Promise.all(Array.from(desiredNames).map(async permissionName => {
        const permission = permissionByName.get(permissionName);
        if (permission && !granted.has(permissionName)) {
          await storage.assignRolePermission(role.id, permission.id);
        }
      }));
    }
  } catch (error) {
    console.error("Failed to ensure persona roles and permissions:", error);
  }
}

export async function registerRoutes(app: Express): Promise<Server> {
  if (!employeeAccessExpiryInterval) {
    void expireDueEmployeeAccessRights();
    employeeAccessExpiryInterval = setInterval(() => void expireDueEmployeeAccessRights(), 5 * 60 * 1000);
    employeeAccessExpiryInterval.unref?.();
  }
  // Setup authentication system
  setupAuth(app);
  registerPersonnelReportRoute(app);
  registerEnterpriseReportingRoutes(app);

  await ensureItsmPermissions();
  await ensurePersonaRoles();

  // Format only the data supplied by an authenticated viewer; this endpoint
  // does not query records or broaden the viewer's report access.
  app.post("/api/report-exports/xlsx", requireAuth, rateLimit({
    windowMs: 60 * 1000,
    max: 10,
    standardHeaders: true,
    legacyHeaders: false,
    message: { message: "Too many spreadsheet exports. Please try again in a minute." },
  }), async (req, res) => {
    try {
      const input = reportExportSchema.parse(req.body);
      const workbook = buildReportWorkbook(input);
      const buffer = await workbook.xlsx.writeBuffer();
      res.attachment(`${input.filename}.xlsx`);
      res.type("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      res.send(Buffer.from(buffer));
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid spreadsheet export data", errors: error.issues });
      }
      respondWithApiError(res, error, "Failed to generate Excel report");
    }
  });

  // Apply persona and module enforcement centrally so API endpoints remain
  // scoped even when an individual handler only has authentication middleware.
  app.use("/api", (req, res, next) => {
    const apiPath = req.originalUrl.split("?")[0].replace(/^\/api(?=\/|$)/, "");
    const moduleKey = moduleForApiRequest(
      req.method,
      apiPath,
      req.query as Record<string, unknown>,
      req.body as Record<string, unknown>,
    );
    const personaGuardedPaths = [
      "/access-governance", "/applications", "/servers", "/audit-logs", "/my/assets", "/my/asset-handovers", "/dashboard/executive",
      "/cmdb", "/consumables", "/data-migrations", "/import",
    ];
    const requiresPersonaCheck = moduleKey !== undefined ||
      personaGuardedPaths.some(prefix => apiPath === prefix || apiPath.startsWith(`${prefix}/`));
    if (!requiresPersonaCheck) return next();
    return requireAuth(req, res, () => {
      void (async () => {
        try {
          if (moduleKey && !await isFeatureEnabled(moduleKey)) return sendFeatureNotEnabled(res, moduleKey);
          const userId = (req.user as any)?.id;
          const [userRoles, userPermissions] = await Promise.all([
            storage.getUserRoles(userId),
            storage.getUserPermissions(userId),
          ]);
          const roleNames = userRoles.map(role => role.name);
          if (!isPersonaApiAllowed(roleNames, userPermissions, apiPath, req.method)) {
            return res.status(403).json({ error: "This persona is not allowed to access this API" });
          }
          return next();
        } catch (error) {
          console.error("Failed to verify API persona access:", error);
          return respondWithApiError(res, error, "Failed to verify API access");
        }
      })();
    });
  });

  registerProjectManagementRoutes(app, requireAuth, requireModule);

  const createCabEventStreamHandler = (eventType: "cab" | "access") =>
    async (req: any, res: any) => {
      let unsubscribe: Awaited<ReturnType<typeof subscribeToCabEvents>>;
      try {
        unsubscribe = eventType === "access"
          ? await subscribeToItsmAccessEvents(res, req.user!.id, req.sessionID)
          : await subscribeToCabEvents(res, req.user!.id, req.sessionID);
      } catch (error) {
        console.error("Failed to reserve CAB alert connection:", error);
        return res.status(503).json({ message: "CAB alert connections are temporarily unavailable" });
      }
      if (!unsubscribe) {
        res.setHeader("Retry-After", "5");
        return res.status(429).json({ message: "Too many CAB alert connections for this account" });
      }
      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache, no-transform");
      res.setHeader("Connection", "keep-alive");
      res.flushHeaders();
      let timer: ReturnType<typeof setTimeout> | undefined;
      let closed = false;
      const cleanup = () => {
        closed = true;
        if (timer) clearTimeout(timer);
        unsubscribe();
      };
      res.on("close", cleanup);
      const userId = req.user!.id;
      const heartbeat = async () => {
        try {
          let hasAccess = eventType === "access"
            ? await cabStreamHasActiveAccount(req, userId)
            : await cabStreamHasAccess(req, userId);
          if (hasAccess && eventType === "cab") {
            const [userRoles, userPermissions] = await Promise.all([
              storage.getUserRoles(userId),
              storage.getUserPermissions(userId),
            ]);
            hasAccess = isPersonaApiAllowed(
              userRoles.map(role => role.name),
              userPermissions,
              "/changes/events",
              "GET",
            );
          }
          if (!hasAccess) {
            if (!closed) res.end();
            return;
          }
          if (closed) return;
          if (!await unsubscribe.renewLease()) {
            if (!closed) res.end();
            return;
          }
          if (closed) return;
          unsubscribe.sendHeartbeat();
          timer = setTimeout(heartbeat, 25_000);
        } catch (error) {
          console.error("Failed to verify CAB stream access:", error);
          if (!closed) res.end();
        }
      };
      timer = setTimeout(heartbeat, 25_000);
    };

  const cabEventsHandler = createCabEventStreamHandler("cab");
  const cabAccessEventsHandler = createCabEventStreamHandler("access");

  // --------------------
  // USER MANAGEMENT ROUTES
  // --------------------

  // Users CRUD routes
  app.get("/api/users", requireAuth, requirePermission('user_view'), async (req, res) => {
    try {
      const users = await storage.getUsersWithDetails();
      // Remove passwords from response for security
      const usersWithoutPasswords = users.map(({ password, ...user }) => user);
      res.json(usersWithoutPasswords);
    } catch (error) {
      respondWithApiError(res, error, "Failed to fetch users");
    }
  });

  app.get("/api/users/employee-options", requireAuth, requireAnyPermission("user_view", "user_create", "user_update", "system_admin"), async (_req, res) => {
    try {
      const rows = await db.select({
        id: employees.id,
        employeeId: employees.employeeId,
        firstName: employees.firstName,
        lastName: employees.lastName,
        email: employees.email,
      }).from(employees).where(eq(employees.status, "active")).orderBy(asc(employees.lastName), asc(employees.firstName));
      res.json(rows);
    } catch (error) {
      respondWithApiError(res, error, "Failed to load employee linking options");
    }
  });

  app.get("/api/users/:id", requireAuth, requirePermission('user_view'), async (req, res) => {
    try {
      const user = await storage.getUser(req.params.id);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      // Remove password from response for security
      const { password, ...userWithoutPassword } = user;
      res.json(userWithoutPassword);
    } catch (error) {
      respondWithApiError(res, error, "Failed to fetch user");
    }
  });

  app.post("/api/users", requireAuth, requirePermission('user_create'), async (req, res) => {
    try {
      const validatedData = insertUserSchema.parse(req.body);
      if (validatedData.employeeId) {
        const [linkedEmployee] = await db.select({ id: employees.id, status: employees.status })
          .from(employees).where(eq(employees.id, validatedData.employeeId)).limit(1);
        if (!linkedEmployee || linkedEmployee.status !== "active") {
          return res.status(400).json({ message: "Choose an active employee for this user, or leave the account unlinked." });
        }
      }
      
      // Hash password before storing
      const hashedPassword = await hashPassword(validatedData.password);
      const user = await storage.createUser({
        ...validatedData,
        password: hashedPassword
      });
      
      // Log audit
      await logAudit(req.user?.id, 'CREATE', 'users', user.id, user.username, null, { username: user.username, email: user.email }, req);
      
      // Remove password from response for security
      const { password, ...userWithoutPassword } = user;
      res.status(201).json(userWithoutPassword);
    } catch (error) {
      console.error("Error creating user:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid user data", errors: error.issues });
      }
      respondWithApiError(res, error, "Failed to create user");
    }
  });

  app.put("/api/users/:id", requireAuth, requirePermission('user_update'), async (req, res) => {
    try {
      const validatedData = insertUserSchema.partial().parse(req.body);
      if (validatedData.employeeId) {
        const [linkedEmployee] = await db.select({ id: employees.id, status: employees.status })
          .from(employees).where(eq(employees.id, validatedData.employeeId)).limit(1);
        if (!linkedEmployee || linkedEmployee.status !== "active") {
          return res.status(400).json({ message: "Choose an active employee for this user, or unlink the account." });
        }
      }
      
      // Get old user for audit log
      const oldUser = await storage.getUser(req.params.id);

      // Revoke persisted sessions before deactivating so a failure cannot leave
      // old sessions available to be restored by a later reactivation.
      // Hash password if it's being updated
      let updateData = validatedData;
      if (validatedData.password) {
        const hashedPassword = await hashPassword(validatedData.password);
        updateData = {
          ...validatedData,
          password: hashedPassword
        };
      }

      const user = oldUser?.isActive && validatedData.isActive === false
        ? await withUserSessionLock(req.params.id, async () => {
            try {
              await invalidateUserSessions(req.params.id);
            } catch (error) {
              const errorType = error instanceof Error && /^[A-Za-z][A-Za-z0-9]{0,63}$/.test(error.name)
                ? error.name
                : "UnknownError";
              const errorCode = typeof error === "object"
                && error !== null
                && "code" in error
                && typeof error.code === "string"
                && /^[A-Z0-9]{5}$/.test(error.code)
                ? error.code
                : undefined;
              console.error("Account deactivation session revocation failed", {
                operation: "deactivate_account",
                actorUserId: req.user?.id,
                targetUserId: req.params.id,
                errorType,
                ...(errorCode ? { errorCode } : {}),
              });
              throw error;
            }
            return storage.updateUser(req.params.id, updateData);
          })
        : await storage.updateUser(req.params.id, updateData);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      
      // Log audit
      if (oldUser) {
        await logAudit(req.user?.id, 'UPDATE', 'users', user.id, user.username, 
          { username: oldUser.username, email: oldUser.email }, 
          { username: user.username, email: user.email }, req);
      }
      
      // Remove password from response for security
      const { password, ...userWithoutPassword } = user;
      res.json(userWithoutPassword);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid user data", errors: error.issues });
      }
      respondWithApiError(res, error, "Failed to update user");
    }
  });

  app.delete("/api/users/:id", requireAuth, requirePermission('user_delete'), async (req, res) => {
    try {
      // Get user for audit log before deletion
      const user = await storage.getUser(req.params.id);
      
      const deleted = await storage.deleteUser(req.params.id);
      if (!deleted) {
        return res.status(404).json({ message: "User not found" });
      }
      
      // Log audit
      if (user) {
        await logAudit(req.user?.id, 'DELETE', 'users', req.params.id, user.username, 
          { username: user.username, email: user.email }, null, req);
      }
      
      res.status(204).send();
    } catch (error) {
      respondWithApiError(res, error, "Failed to delete user");
    }
  });

  // Roles CRUD routes
  app.get("/api/roles", requireAuth, requirePermission('role_view'), async (req, res) => {
    try {
      const roles = await storage.getRolesWithDetails();
      res.json(roles);
    } catch (error) {
      respondWithApiError(res, error, "Failed to fetch roles");
    }
  });

  app.get("/api/roles/:id", requireAuth, requirePermission('role_view'), async (req, res) => {
    try {
      const role = await storage.getRole(req.params.id);
      if (!role) {
        return res.status(404).json({ message: "Role not found" });
      }
      res.json(role);
    } catch (error) {
      respondWithApiError(res, error, "Failed to fetch role");
    }
  });

  app.post("/api/roles", requireAuth, requirePermission('role_create'), async (req, res) => {
    try {
      const validatedData = insertRoleSchema.parse(req.body);
      if (validatedData.isSystemRole || getStandardRoleKey(validatedData.name)) {
        return res.status(409).json({ message: "Standard roles are provisioned by the system and cannot be recreated." });
      }
      const role = await storage.createRole({
        ...validatedData,
        name: validatedData.name.trim(),
        isSystemRole: false,
      });
      
      // Log audit
      await logAudit(req.user?.id, 'CREATE', 'roles', role.id, role.name, null, { name: role.name, description: role.description }, req);
      
      res.status(201).json(role);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid role data", errors: error.issues });
      }
      respondWithApiError(res, error, "Failed to create role");
    }
  });

  app.put("/api/roles/:id", requireAuth, requirePermission('role_update'), async (req, res) => {
    try {
      const validatedData = insertRoleSchema.partial().parse(req.body);
      
      // Get old role for audit log
      const oldRole = await storage.getRole(req.params.id);
      if (!oldRole) return res.status(404).json({ message: "Role not found" });
      const requestedStandardKey = validatedData.name ? getStandardRoleKey(validatedData.name) : null;
      if (oldRole.isSystemRole && validatedData.name && requestedStandardKey !== getStandardRoleKey(oldRole.name)) {
        return res.status(400).json({ message: "Standard role keys cannot be changed." });
      }
      if (!oldRole.isSystemRole && (validatedData.isSystemRole === true || requestedStandardKey)) {
        return res.status(409).json({ message: "This role name is reserved for a standard system role." });
      }
      const roleUpdate = oldRole.isSystemRole
        ? { ...validatedData, name: oldRole.name, isSystemRole: true }
        : { ...validatedData, name: validatedData.name?.trim(), isSystemRole: false };
      
      const role = await storage.updateRole(req.params.id, roleUpdate);
      if (!role) {
        return res.status(404).json({ message: "Role not found" });
      }
      
      // Log audit
      await logAudit(req.user?.id, 'UPDATE', 'roles', role.id, role.name, oldRole, role, req);
      
      res.json(role);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid role data", errors: error.issues });
      }
      respondWithApiError(res, error, "Failed to update role");
    }
  });

  app.delete("/api/roles/:id", requireAuth, requirePermission('role_delete'), async (req, res) => {
    try {
      // Get role for audit log before deleting
      const role = await storage.getRole(req.params.id);
      if (role?.isSystemRole) {
        return res.status(409).json({ message: "Standard system roles cannot be deleted." });
      }
      
      const deleted = await storage.deleteRole(req.params.id);
      if (!deleted) {
        return res.status(404).json({ message: "Role not found" });
      }
      
      // Log audit
      if (role) {
        await logAudit(req.user?.id, 'DELETE', 'roles', role.id, role.name, role, null, req);
      }
      
      res.status(204).send();
    } catch (error) {
      respondWithApiError(res, error, "Failed to delete role");
    }
  });

  // Permissions routes (read-only for now)
  app.get("/api/permissions", requireAuth, requirePermission('permission_view'), async (req, res) => {
    try {
      const permissions = await storage.getPermissions();
      res.json(permissions);
    } catch (error) {
      respondWithApiError(res, error, "Failed to fetch permissions");
    }
  });

  // Contracts routes
  app.get("/api/contracts", requireAuth, requireContractPermission("GET"), async (req, res) => {
    if (isServiceContractApiRequest("GET", "/contracts", req.query as Record<string, unknown>)) {
      return listServiceContracts(req, res);
    }
    try {
      const contracts = await storage.getContracts();
      // Auto-expire contracts whose endDate has passed but are still marked active/pending
      const today = new Date().toISOString().split("T")[0];
      const expiredIds = contracts
        .filter(c => c.endDate && c.endDate < today && ["active", "pending"].includes(c.status ?? ""))
        .map(c => c.id);
      await Promise.all(expiredIds.map(id => storage.updateContract(id, { status: "expired" } as any)));
      if (expiredIds.length > 0) {
        const updated = await storage.getContracts();
        const managed = await db.select({ id: vendorContracts.id }).from(vendorContracts);
        const managedIds = new Set(managed.map(row => row.id));
        return res.json(updated.map(row => ({ ...row, vendorContractManaged: managedIds.has(row.id) })));
      }
      const managed = await db.select({ id: vendorContracts.id }).from(vendorContracts);
      const managedIds = new Set(managed.map(row => row.id));
      res.json(contracts.map(row => ({ ...row, vendorContractManaged: managedIds.has(row.id) })));
    } catch (error) {
      respondWithApiError(res, error, "Failed to fetch contracts");
    }
  });

  app.post("/api/contracts", requireAuth, requireContractPermission("POST"), async (req, res) => {
    if (isServiceContractApiRequest("POST", "/contracts", {}, req.body as Record<string, unknown>)) {
      return createServiceContract(req, res);
    }
    try {
      const validatedData = insertContractSchema.parse(req.body);
      const contract = await storage.createContract(validatedData);
      await logAudit(req.user?.id, 'CREATE', 'contracts', contract.id, contract.name, null, contract, req);
      res.status(201).json(contract);
    } catch (error) {
      if (error instanceof z.ZodError) return res.status(400).json({ message: "Invalid contract data", errors: error.issues });
      respondWithApiError(res, error, "Failed to create contract");
    }
  });

  app.get("/api/contracts/:id", requireAuth, requireContractPermission("GET"), async (req, res) => {
    if (/^\d+$/.test(req.params.id)) return getServiceContractById(Number(req.params.id), res);
    try {
      const contract = await storage.getContract(req.params.id);
      if (!contract) return res.status(404).json({ message: "Contract not found" });
      res.json(contract);
    } catch (error) {
      respondWithApiError(res, error, "Failed to fetch contract");
    }
  });

  app.put("/api/contracts/:id", requireAuth, requireContractPermission("PUT"), async (req, res) => {
    if (/^\d+$/.test(req.params.id)) return updateServiceContract(Number(req.params.id), req, res);
    try {
      if (await isGovernedVendorContract(req.params.id)) return res.status(409).json({ message: "Manage this SLA contract in Vendors → Contracts & SLAs to keep its financial record and links consistent" });
      const validatedData = insertContractSchema.partial().parse(req.body);
      const oldContract = await storage.getContract(req.params.id);
      const contract = await storage.updateContract(req.params.id, validatedData);
      if (!contract) return res.status(404).json({ message: "Contract not found" });
      await logAudit(req.user?.id, 'UPDATE', 'contracts', contract.id, contract.name, oldContract, contract, req);
      res.json(contract);
    } catch (error) {
      if (error instanceof z.ZodError) return res.status(400).json({ message: "Invalid contract data", errors: error.issues });
      respondWithApiError(res, error, "Failed to update contract");
    }
  });

  app.delete("/api/contracts/:id", requireAuth, requireContractPermission("DELETE"), async (req, res) => {
    if (/^\d+$/.test(req.params.id)) return deleteServiceContract(Number(req.params.id), req, res);
    try {
      if (await isGovernedVendorContract(req.params.id)) return res.status(409).json({ message: "SLA contract history is retained. Terminate the contract in Vendors → Contracts & SLAs instead." });
      const contract = await storage.getContract(req.params.id);
      const deleted = await storage.deleteContract(req.params.id);
      if (!deleted) return res.status(404).json({ message: "Contract not found" });
      if (contract) await logAudit(req.user?.id, 'DELETE', 'contracts', contract.id, contract.name, contract, null, req);
      res.status(204).send();
    } catch (error) {
      respondWithApiError(res, error, "Failed to delete contract");
    }
  });

  // Asset Bookings routes
  app.get("/api/asset-bookings", requireAuth, requireModule('asset_management'), async (req, res) => {
    try {
      const bookings = await storage.getAssetBookings();
      res.json(bookings);
    } catch (error) {
      respondWithApiError(res, error, "Failed to fetch bookings");
    }
  });

  app.post("/api/asset-bookings", requireAuth, requireModule('asset_management'), async (req, res) => {
    try {
      const validatedData = insertAssetBookingSchema.parse(req.body);
      const booking = await storage.createAssetBooking(validatedData);
      await logAudit(req.user?.id, 'CREATE', 'asset_bookings', booking.id, `Booking for ${booking.assetId}`, null, booking, req);
      res.status(201).json(booking);
    } catch (error) {
      if (error instanceof z.ZodError) return res.status(400).json({ message: "Invalid booking data", errors: error.issues });
      respondWithApiError(res, error, "Failed to create booking");
    }
  });

  app.get("/api/asset-bookings/:id", requireAuth, async (req, res) => {
    try {
      const booking = await storage.getAssetBooking(req.params.id);
      if (!booking) return res.status(404).json({ message: "Booking not found" });
      res.json(booking);
    } catch (error) {
      respondWithApiError(res, error, "Failed to fetch booking");
    }
  });

  app.put("/api/asset-bookings/:id", requireAuth, async (req, res) => {
    try {
      const validatedData = insertAssetBookingSchema.partial().parse(req.body);
      const oldBooking = await storage.getAssetBooking(req.params.id);
      const booking = await storage.updateAssetBooking(req.params.id, validatedData);
      if (!booking) return res.status(404).json({ message: "Booking not found" });
      await logAudit(req.user?.id, 'UPDATE', 'asset_bookings', booking.id, `Booking for ${booking.assetId}`, oldBooking, booking, req);
      res.json(booking);
    } catch (error) {
      if (error instanceof z.ZodError) return res.status(400).json({ message: "Invalid booking data", errors: error.issues });
      respondWithApiError(res, error, "Failed to update booking");
    }
  });

  app.delete("/api/asset-bookings/:id", requireAuth, async (req, res) => {
    try {
      const booking = await storage.getAssetBooking(req.params.id);
      const deleted = await storage.deleteAssetBooking(req.params.id);
      if (!deleted) return res.status(404).json({ message: "Booking not found" });
      if (booking) await logAudit(req.user?.id, 'DELETE', 'asset_bookings', booking.id, `Booking for ${booking.assetId}`, booking, null, req);
      res.status(204).send();
    } catch (error) {
      respondWithApiError(res, error, "Failed to delete booking");
    }
  });

  // Asset Disposal routes
  app.get("/api/asset-disposal", requireAuth, requireModule('asset_management'), async (req, res) => {
    try {
      const records = await storage.getAssetDisposalRecords();
      res.json(records);
    } catch (error) {
      respondWithApiError(res, error, "Failed to fetch disposal records");
    }
  });

  app.post("/api/asset-disposal", requireAuth, requireModule('asset_management'), async (req, res) => {
    try {
      const validatedData = insertAssetDisposalRecordSchema.parse({
        ...req.body,
        approvedBy: req.body.approvedBy || null,
        disposedBy: req.user?.id
      });
      const record = await storage.createAssetDisposalRecord(validatedData);
      await logAudit(req.user?.id, 'CREATE', 'asset_disposal_records', record.id, `Disposal for ${record.assetId}`, null, record, req);
      res.status(201).json(record);
    } catch (error) {
      if (error instanceof z.ZodError) return res.status(400).json({ message: "Invalid disposal data", errors: error.issues });
      respondWithApiError(res, error, "Failed to create disposal record");
    }
  });

  app.put("/api/asset-disposal/:id", requireAuth, async (req, res) => {
    try {
      const validatedData = insertAssetDisposalRecordSchema.partial().parse(req.body);
      const oldRecord = await storage.getAssetDisposalRecords().then(recs => recs.find(r => r.id === req.params.id));
      const record = await storage.updateAssetDisposalRecord(req.params.id, validatedData);
      if (!record) return res.status(404).json({ message: "Disposal record not found" });
      await logAudit(req.user?.id, 'UPDATE', 'asset_disposal_records', record.id, `Disposal for ${record.assetId}`, oldRecord, record, req);
      res.json(record);
    } catch (error) {
      if (error instanceof z.ZodError) return res.status(400).json({ message: "Invalid disposal data", errors: error.issues });
      respondWithApiError(res, error, "Failed to update disposal record");
    }
  });

  // Asset Audit routes
  app.get("/api/asset-audits", requireAuth, async (req, res) => {
    try {
      const sessions = await storage.getAssetAuditSessions();
      res.json(sessions);
    } catch (error) {
      respondWithApiError(res, error, "Failed to fetch audit sessions");
    }
  });

  app.post("/api/asset-audits", requireAuth, async (req, res) => {
    try {
      const validatedData = insertAssetAuditSessionSchema.parse({
        ...req.body,
        conductedBy: req.user?.id
      });
      const session = await storage.createAssetAuditSession(validatedData);
      await logAudit(req.user?.id, 'CREATE', 'asset_audit_sessions', session.id, session.name, null, session, req);
      res.status(201).json(session);
    } catch (error) {
      if (error instanceof z.ZodError) return res.status(400).json({ message: "Invalid audit session data", errors: error.issues });
      respondWithApiError(res, error, "Failed to create audit session");
    }
  });

  app.get("/api/asset-audits/:id", requireAuth, async (req, res) => {
    try {
      const session = await storage.getAssetAuditSession(req.params.id);
      if (!session) return res.status(404).json({ message: "Audit session not found" });
      res.json(session);
    } catch (error) {
      respondWithApiError(res, error, "Failed to fetch audit session");
    }
  });

  app.put("/api/asset-audits/:id", requireAuth, async (req, res) => {
    try {
      const validatedData = insertAssetAuditSessionSchema.partial().parse(req.body);
      const oldSession = await storage.getAssetAuditSession(req.params.id);
      const session = await storage.updateAssetAuditSession(req.params.id, validatedData);
      if (!session) return res.status(404).json({ message: "Audit session not found" });
      await logAudit(req.user?.id, 'UPDATE', 'asset_audit_sessions', session.id, session.name, oldSession, session, req);
      res.json(session);
    } catch (error) {
      if (error instanceof z.ZodError) return res.status(400).json({ message: "Invalid audit session data", errors: error.issues });
      respondWithApiError(res, error, "Failed to update audit session");
    }
  });

  app.get("/api/asset-audits/:id/items", requireAuth, async (req, res) => {
    try {
      const items = await storage.getAuditItems(req.params.id);
      res.json(items);
    } catch (error) {
      respondWithApiError(res, error, "Failed to fetch audit items");
    }
  });

  app.post("/api/asset-audits/:id/items", requireAuth, async (req, res) => {
    try {
      const validatedData = insertAssetAuditItemSchema.parse({
        ...req.body,
        sessionId: req.params.id
      });
      const item = await storage.upsertAuditItem(validatedData);
      // Recalculate session counts
      const allItems = await storage.getAuditItems(req.params.id);
      await storage.updateAssetAuditSession(req.params.id, {
        totalAssets: allItems.length,
        verifiedCount: allItems.filter((i: any) => i.status === 'verified').length,
        missingCount: allItems.filter((i: any) => i.status === 'missing').length,
      });
      res.status(201).json(item);
    } catch (error) {
      if (error instanceof z.ZodError) return res.status(400).json({ message: "Invalid audit item data", errors: error.issues });
      respondWithApiError(res, error, "Failed to upsert audit item");
    }
  });

  app.put("/api/asset-audits/:sessionId/items/:itemId", requireAuth, async (req, res) => {
    try {
      const validatedData = insertAssetAuditItemSchema.partial().parse({
        ...req.body,
        sessionId: req.params.sessionId,
        verifiedBy: req.user?.id,
        verifiedAt: new Date()
      });
      // Pass id separately — it is omitted from insertAssetAuditItemSchema so must bypass schema
      const item = await storage.upsertAuditItem({ ...validatedData, id: req.params.itemId, sessionId: req.params.sessionId } as any);
      // Recalculate session counts
      const allItems = await storage.getAuditItems(req.params.sessionId);
      await storage.updateAssetAuditSession(req.params.sessionId, {
        totalAssets: allItems.length,
        verifiedCount: allItems.filter((i: any) => i.status === 'verified').length,
        missingCount: allItems.filter((i: any) => i.status === 'missing').length,
      });
      res.json(item);
    } catch (error) {
      if (error instanceof z.ZodError) return res.status(400).json({ message: "Invalid audit item data", errors: error.issues });
      respondWithApiError(res, error, "Failed to update audit item");
    }
  });

  // Asset Relationships routes
  app.get("/api/assets/:id/relationships", requireAuth, async (req, res) => {
    try {
      const relationships = await storage.getAssetRelationships(req.params.id);
      res.json(relationships);
    } catch (error) {
      respondWithApiError(res, error, "Failed to fetch asset relationships");
    }
  });

  app.post("/api/asset-relationships", requireAuth, async (req, res) => {
    try {
      const validatedData = insertAssetRelationshipSchema.parse(req.body);
      const relationship = await storage.createAssetRelationship(validatedData);
      res.status(201).json(relationship);
    } catch (error) {
      if (error instanceof z.ZodError) return res.status(400).json({ message: "Invalid relationship data", errors: error.issues });
      respondWithApiError(res, error, "Failed to create relationship");
    }
  });

  app.delete("/api/asset-relationships/:id", requireAuth, async (req, res) => {
    try {
      const deleted = await storage.deleteAssetRelationship(req.params.id);
      if (!deleted) return res.status(404).json({ message: "Relationship not found" });
      res.status(204).send();
    } catch (error) {
      respondWithApiError(res, error, "Failed to delete relationship");
    }
  });

  // Asset Requests routes
  app.get("/api/asset-requests", requireAuth, requireModule('asset_management'), async (req, res) => {
    try {
      const requests = await storage.getAssetRequests();
      res.json(requests);
    } catch (error) {
      respondWithApiError(res, error, "Failed to fetch asset requests");
    }
  });

  app.post("/api/asset-requests", requireAuth, requireModule('asset_management'), async (req, res) => {
    try {
      const validatedData = insertAssetRequestSchema.parse(req.body);
      const request = await storage.createAssetRequest(validatedData);
      await logAudit(req.user?.id, 'CREATE', 'asset_requests', request.id, `Request for ${request.assetType}`, null, request, req);
      res.status(201).json(request);
    } catch (error) {
      if (error instanceof z.ZodError) return res.status(400).json({ message: "Invalid request data", errors: error.issues });
      respondWithApiError(res, error, "Failed to create asset request");
    }
  });

  // --------------------
  // ITSM TICKETING ROUTES
  // --------------------

  const getProjectsAssignedToUser = async (userId: string) => {
    if (!await isFeatureEnabled("project_management")) return [];
    return db.select({ id: projects.id, name: projects.name }).from(projects)
      .leftJoin(projectManagers, eq(projectManagers.projectId, projects.id))
      .leftJoin(projectTeamMembers, eq(projectTeamMembers.projectId, projects.id))
      .leftJoin(projectTasks, and(eq(projectTasks.projectId, projects.id), eq(projectTasks.assigneeId, userId)))
      .where(and(
        eq(projects.isActive, true),
        or(
          eq(projectManagers.userId, userId),
          eq(projectTeamMembers.userId, userId),
          eq(projectTasks.assigneeId, userId),
        ),
      ))
      .groupBy(projects.id, projects.name)
      .orderBy(asc(projects.name));
  };

  const requireIncidentCatalogManager: RequestHandler = async (req, res, next) => {
    try {
      const [permissions, roleRows] = await Promise.all([
        storage.getUserPermissions(req.user!.id), storage.getUserRoles(req.user!.id),
      ]);
      if (permissions.includes("system_admin") || roleRows.some(role => ["system_admin", "it_manager"].includes(getStandardRoleKey(role.name) ?? ""))) {
        next();
        return;
      }
      res.status(403).json({ message: "Only administrators and IT managers can manage the incident catalog." });
    } catch (error) {
      respondWithApiError(res, error, "Failed to authorize incident catalog management");
    }
  };

  app.get("/api/incident-catalog", requireAuth, requireModule("itsm"), requireIncidentCatalogManager, async (req: any, res) => {
    try {
      const includeInactive = req.query.includeInactive === "true";
      const [rows, projectRows] = await Promise.all([
        db.select().from(incidentCatalogItems)
          .where(includeInactive ? undefined : eq(incidentCatalogItems.isActive, true))
          .orderBy(asc(incidentCatalogItems.name)),
        isFeatureEnabled("project_management")
          .then(enabled => enabled ? db.select({ id: projects.id, name: projects.name }).from(projects) : []),
      ]);
      const projectNames = new Map(projectRows.map(project => [project.id, project.name]));
      res.json(rows.map(row => ({ ...row, scope: row.projectId ? "project" : "global", projectName: row.projectId ? projectNames.get(row.projectId) ?? null : null })));
    } catch (error) {
      respondWithApiError(res, error, "Failed to fetch incident catalog");
    }
  });

  const validateIncidentCatalogProject = async (projectId: string | null | undefined, res: any) => {
    if (!projectId) return true;
    if (!await isFeatureEnabled("project_management")) {
      sendFeatureNotEnabled(res, "project_management");
      return false;
    }
    const [project] = await db.select({ id: projects.id }).from(projects).where(eq(projects.id, projectId)).limit(1);
    if (!project) {
      res.status(400).json({ message: "The selected project does not exist." });
      return false;
    }
    return true;
  };

  app.post("/api/incident-catalog", requireAuth, requireModule("itsm"), requireIncidentCatalogManager, async (req: any, res) => {
    try {
      const input = insertIncidentCatalogItemSchema.parse(req.body);
      if (!await validateIncidentCatalogProject(input.projectId, res)) return;
      const [item] = await db.insert(incidentCatalogItems).values({
        ...input,
        projectId: input.projectId ?? null,
        defaultAssignmentGroup: input.defaultAssignmentGroup || null,
        createdBy: req.user.id,
      }).returning();
      await logAudit(req.user.id, "CREATE", "incident_catalog_items", item.id, item.name, null, item, req);
      res.status(201).json(item);
    } catch (error: any) {
      if (error instanceof z.ZodError) return res.status(400).json({ message: "Invalid incident catalog item", errors: error.issues });
      if (error?.code === "23505") return res.status(409).json({ message: "An incident catalog item with this name already exists in that scope." });
      respondWithApiError(res, error, "Failed to create incident catalog item");
    }
  });

  app.put("/api/incident-catalog/:id", requireAuth, requireModule("itsm"), requireIncidentCatalogManager, async (req: any, res) => {
    try {
      const input = insertIncidentCatalogItemSchema.partial().parse(req.body);
      if (input.projectId !== undefined && !await validateIncidentCatalogProject(input.projectId, res)) return;
      const [existing] = await db.select().from(incidentCatalogItems).where(eq(incidentCatalogItems.id, req.params.id)).limit(1);
      if (!existing) return res.status(404).json({ message: "Incident catalog item not found." });
      const [item] = await db.update(incidentCatalogItems).set({
        ...input,
        ...(input.defaultAssignmentGroup !== undefined ? { defaultAssignmentGroup: input.defaultAssignmentGroup || null } : {}),
        updatedAt: new Date(),
      }).where(eq(incidentCatalogItems.id, existing.id)).returning();
      await logAudit(req.user.id, "UPDATE", "incident_catalog_items", item.id, item.name, existing, item, req);
      res.json(item);
    } catch (error: any) {
      if (error instanceof z.ZodError) return res.status(400).json({ message: "Invalid incident catalog item", errors: error.issues });
      if (error?.code === "23505") return res.status(409).json({ message: "An incident catalog item with this name already exists in that scope." });
      respondWithApiError(res, error, "Failed to update incident catalog item");
    }
  });

  app.delete("/api/incident-catalog/:id", requireAuth, requireModule("itsm"), requireIncidentCatalogManager, async (req: any, res) => {
    try {
      const [existing] = await db.select().from(incidentCatalogItems).where(eq(incidentCatalogItems.id, req.params.id)).limit(1);
      if (!existing) return res.status(404).json({ message: "Incident catalog item not found." });
      // Deactivate rather than erase a template referenced by historical incidents.
      const [item] = await db.update(incidentCatalogItems)
        .set({ isActive: false, updatedAt: new Date() })
        .where(eq(incidentCatalogItems.id, existing.id)).returning();
      await logAudit(req.user.id, "UPDATE", "incident_catalog_items", item.id, item.name, existing, item, req);
      res.json({ success: true, item });
    } catch (error) {
      respondWithApiError(res, error, "Failed to deactivate incident catalog item");
    }
  });

  app.get("/api/portal/incidents/options", requireAuth, requireModule("itsm"), async (req: any, res) => {
    try {
      const userId = req.user.id as string;
      const assignedProjects = await getProjectsAssignedToUser(userId);
      const requestedProjectId = typeof req.query.projectId === "string" ? req.query.projectId : "";
      if (requestedProjectId && !assignedProjects.some(project => project.id === requestedProjectId)) {
        return res.status(403).json({ message: "Select a project assigned to your account." });
      }
      const allowedProjectId = assignedProjects.some(project => project.id === requestedProjectId)
        ? requestedProjectId
        : (!requestedProjectId && assignedProjects.length === 1 ? assignedProjects[0].id : "");
      const catalogScope = allowedProjectId
        ? or(isNull(incidentCatalogItems.projectId), eq(incidentCatalogItems.projectId, allowedProjectId))
        : isNull(incidentCatalogItems.projectId);
      const catalog = await db.select({
        id: incidentCatalogItems.id,
        name: incidentCatalogItems.name,
        description: incidentCatalogItems.description,
        category: incidentCatalogItems.category,
        icon: incidentCatalogItems.icon,
        projectId: incidentCatalogItems.projectId,
        defaultImpact: incidentCatalogItems.defaultImpact,
        defaultUrgency: incidentCatalogItems.defaultUrgency,
        defaultPriority: incidentCatalogItems.defaultPriority,
        defaultAssignmentGroup: incidentCatalogItems.defaultAssignmentGroup,
      }).from(incidentCatalogItems).where(and(eq(incidentCatalogItems.isActive, true), catalogScope)).orderBy(asc(incidentCatalogItems.name));
      let assignedAssets: { id: string; name: string; assetTag: string | null; serialNumber: string | null }[] = [];
      if (req.user.employeeId && await isFeatureEnabled("asset_management")) {
        assignedAssets = await db.select({
          id: assets.id,
          name: assets.name,
          assetTag: assets.assetTag,
          serialNumber: assets.serialNumber,
        }).from(assets)
          .innerJoin(assignments, eq(assignments.assetId, assets.id))
          .where(and(eq(assignments.employeeId, req.user.employeeId), isNull(assignments.returnedDate)))
          .orderBy(asc(assets.name));
      }
      res.json({
        projects: assignedProjects,
        selectedProjectId: assignedProjects.length === 1 ? assignedProjects[0].id : allowedProjectId,
        catalog,
        assignedAssets,
        linkedEmployee: Boolean(req.user.employeeId),
      });
    } catch (error) {
      respondWithApiError(res, error, "Failed to load incident intake options");
    }
  });

  app.get("/api/incidents", requireAuth, requireModule("itsm"), async (req: any, res) => {
    try {
      const rows = await storage.getIncidents();
      const canViewAll = await canViewAllItsmRecords(req.user.id);
      const visibleRows = canViewAll ? rows : rows.filter(row => row.creatorId === req.user.id || row.requesterId === req.user.id);
      const [projectRows, userRows, employeeRows] = await Promise.all([
        isFeatureEnabled("project_management").then(enabled => enabled ? db.select({ id: projects.id, name: projects.name }).from(projects) : []),
        db.select({ id: users.id, username: users.username, firstName: users.firstName, lastName: users.lastName, email: users.email }).from(users),
        isFeatureEnabled("asset_management").then(enabled => enabled ? db.select({ email: employees.email, phone: employees.phone, mobile: employees.mobile }).from(employees) : []),
      ]);
      const projectNames = new Map(projectRows.map(project => [project.id, project.name]));
      const userDetails = new Map(userRows.map(user => [user.id, {
        name: [user.firstName, user.lastName].filter(Boolean).join(" ") || user.username,
        email: user.email,
      }]));
      const employeeContacts = new Map(employeeRows.filter((employee): employee is typeof employee & { email: string } => Boolean(employee.email)).map(employee => [employee.email.toLowerCase(), {
        phone: employee.phone,
        mobile: employee.mobile,
      }]));
      res.json(visibleRows.map(row => ({
        ...row,
        projectName: row.projectId ? projectNames.get(row.projectId) ?? null : null,
        creatorName: row.creatorId ? userDetails.get(row.creatorId)?.name ?? null : null,
        creatorEmail: row.creatorId ? userDetails.get(row.creatorId)?.email ?? null : null,
        creatorPhone: row.creatorId ? employeeContacts.get(userDetails.get(row.creatorId)?.email.toLowerCase() ?? "")?.phone ?? null : null,
        creatorMobile: row.creatorId ? employeeContacts.get(userDetails.get(row.creatorId)?.email.toLowerCase() ?? "")?.mobile ?? null : null,
        requesterName: row.requesterId ? userDetails.get(row.requesterId)?.name ?? null : null,
        requesterEmail: row.requesterId ? userDetails.get(row.requesterId)?.email ?? null : null,
        requesterPhone: row.requesterId ? employeeContacts.get(userDetails.get(row.requesterId)?.email.toLowerCase() ?? "")?.phone ?? null : null,
        requesterMobile: row.requesterId ? employeeContacts.get(userDetails.get(row.requesterId)?.email.toLowerCase() ?? "")?.mobile ?? null : null,
        assigneeName: (row.assigneeId || row.assignedToId) ? userDetails.get(row.assigneeId || row.assignedToId!)?.name ?? null : null,
      })));
    } catch (error) {
      respondWithApiError(res, error, "Failed to fetch incidents");
    }
  });

  app.get("/api/incidents/options", requireAuth, requireModule("itsm"), async (req: any, res) => {
    try {
      const canManageTickets = await canManageAllTickets(req.user.id);
      const canViewAll = await canViewAllItsmRecords(req.user.id);
      const [projectRows, userRows, policyRows, incidentRows, requestRows, requesterRows, managedAssignmentGroups, incidentCatalogRows] = await Promise.all([
        canManageTickets
          ? isFeatureEnabled("project_management").then(enabled => enabled ? db.select({ id: projects.id, name: projects.name }).from(projects).where(eq(projects.isActive, true)).orderBy(asc(projects.name)) : [])
          : getProjectsAssignedToUser(req.user.id),
        db.select({ id: users.id, username: users.username, firstName: users.firstName, lastName: users.lastName, roleName: roles.name })
          .from(users).innerJoin(userRoles, eq(userRoles.userId, users.id)).innerJoin(roles, eq(userRoles.roleId, roles.id)).where(eq(users.isActive, true)),
        db.select({ id: slaPolicies.id, name: slaPolicies.name, priority: slaPolicies.priority, ticketType: slaPolicies.ticketType }).from(slaPolicies).where(eq(slaPolicies.isActive, true)),
        storage.getIncidents(),
        storage.getServiceRequests(),
        db.select({ id: users.id, username: users.username, firstName: users.firstName, lastName: users.lastName, email: users.email }).from(users).where(eq(users.isActive, true)),
        canManageTickets
          ? db.select({ id: assignmentGroups.id, name: assignmentGroups.name }).from(assignmentGroups)
            .where(eq(assignmentGroups.active, true)).orderBy(asc(assignmentGroups.name))
          : Promise.resolve([]),
        canManageTickets
          ? db.select().from(incidentCatalogItems).where(eq(incidentCatalogItems.isActive, true)).orderBy(asc(incidentCatalogItems.name))
          : Promise.resolve([]),
      ]);
      const staffRoleKeys = new Set(["it_agent", "it_manager", "system_admin"]);
      const eligibleUsers = new Map<string, { id: string; name: string }>();
      for (const user of userRows) {
        if (staffRoleKeys.has(getStandardRoleKey(user.roleName) ?? "")) {
          eligibleUsers.set(user.id, { id: user.id, name: [user.firstName, user.lastName].filter(Boolean).join(" ") || user.username });
        }
      }
      res.json({
        projects: projectRows,
        users: canManageTickets ? Array.from(eligibleUsers.values()) : [],
        requesterUsers: canViewAll
          ? requesterRows.map(person => ({ id: person.id, name: [person.firstName, person.lastName].filter(Boolean).join(" ") || person.username, email: person.email }))
          : [],
        incidentCatalog: incidentCatalogRows,
        assignmentGroups: canManageTickets
          ? Array.from(new Set([...managedAssignmentGroups.map(group => group.name), ...incidentRows, ...requestRows].map(row => typeof row === "string" ? row.trim() : row.assignmentGroup?.trim()).filter((group): group is string => Boolean(group))))
          : [],
        managedAssignmentGroups: canManageTickets ? managedAssignmentGroups : [],
        slaPolicies: policyRows.filter(policy => !policy.ticketType || policy.ticketType === "incident"),
      });
    } catch (error) {
      respondWithApiError(res, error, "Failed to load incident options");
    }
  });

  app.post("/api/incidents/projects", requireAuth, requireModule("itsm"), requireModule("project_management"), requirePermission("ticket_manage"), async (req, res) => {
    try {
      const projectData = insertProjectSchema.pick({ name: true, description: true }).parse(req.body);
      const [project] = await db.insert(projects).values({
        ...projectData,
        title: projectData.name,
        createdBy: req.user?.id ?? null,
      }).returning({ id: projects.id, name: projects.name });
      res.status(201).json(project);
    } catch (error) {
      if (error instanceof z.ZodError) return res.status(400).json({ message: "Invalid project", errors: error.issues });
      res.status(409).json({ message: "A project with this name may already exist" });
    }
  });

  app.get("/api/incidents/:id", requireAuth, requireModule("itsm"), async (req: any, res) => {
    try {
      const incident = (await storage.getIncidents()).find(row => row.id === req.params.id);
      if (!incident) return res.status(404).json({ message: "Incident not found" });
      if (incident.requesterId !== req.user.id && incident.creatorId !== req.user.id && !(await canViewAllItsmRecords(req.user.id))) {
        return res.status(403).json({ message: "Insufficient permissions" });
      }
      res.json(incident);
    } catch (error) {
      respondWithApiError(res, error, "Failed to fetch incident");
    }
  });

  app.get("/api/incidents/:id/activity", requireAuth, requireModule("itsm"), async (req: any, res) => {
    try {
      const incident = (await storage.getIncidents()).find(row => row.id === req.params.id);
      if (!incident) return res.status(404).json({ message: "Incident not found" });
      if (incident.requesterId !== req.user.id && incident.creatorId !== req.user.id && !(await canViewAllItsmRecords(req.user.id))) {
        return res.status(403).json({ message: "Insufficient permissions" });
      }
      const rows = await db.select({
        id: incidentActivities.id, action: incidentActivities.action, details: incidentActivities.details,
        createdAt: incidentActivities.createdAt, actorId: incidentActivities.actorId,
        actorName: users.username,
      }).from(incidentActivities).leftJoin(users, eq(users.id, incidentActivities.actorId))
        .where(eq(incidentActivities.incidentId, incident.id));
      res.json(rows);
    } catch (error) {
      respondWithApiError(res, error, "Failed to fetch incident activity");
    }
  });

  app.post("/api/incidents/:id/comments", requireAuth, requireModule("itsm"), async (req: any, res) => {
    try {
      const [incident] = await db.select().from(incidents).where(eq(incidents.id, req.params.id)).limit(1);
      if (!incident) return res.status(404).json({ message: "Incident not found" });
      const canViewAll = await canViewAllItsmRecords(req.user.id);
      if (incident.requesterId !== req.user.id && incident.creatorId !== req.user.id && !canViewAll) {
        return res.status(403).json({ message: "You cannot comment on this incident." });
      }
      const input = z.object({ message: z.string().trim().min(1).max(4000) }).parse(req.body);
      const [activity] = await db.insert(incidentActivities).values({
        incidentId: incident.id,
        actorId: req.user.id,
        action: "Comment",
        details: input.message,
      }).returning();
      res.status(201).json(activity);
    } catch (error) {
      if (error instanceof z.ZodError) return res.status(400).json({ message: "Enter a comment of up to 4,000 characters.", errors: error.issues });
      respondWithApiError(res, error, "Failed to add incident comment");
    }
  });

  app.post("/api/incidents", requireAuth, requireModule("itsm"), async (req: any, res) => {
    try {
      const intakePermissions = await storage.getUserPermissions(req.user.id);
      const canManageIntake = intakePermissions.some(permission => ["system_admin", "ticket_manage"].includes(permission));
      const requesterId = canManageIntake ? req.body.requesterId || req.user.id : req.user.id;
      if (!(await storage.getUser(requesterId))) return res.status(400).json({ message: "Requested-for user not found" });
      let projectId = typeof req.body.projectId === "string" && req.body.projectId ? req.body.projectId : null;
      if (!canManageIntake) {
        const assignedProjects = await getProjectsAssignedToUser(req.user.id);
        if (assignedProjects.length === 0 && !req.user.employeeId) {
          return res.status(403).json({ message: "No project is assigned to your account. Contact your project manager before reporting a project incident." });
        }
        if (!projectId && assignedProjects.length === 1) projectId = assignedProjects[0].id;
        if ((assignedProjects.length > 0 && !projectId) || (projectId && !assignedProjects.some(project => project.id === projectId))) {
          return res.status(403).json({ message: "Select a project assigned to your account." });
        }
      }
      const catalogId = typeof req.body.incidentCatalogItemId === "string" ? req.body.incidentCatalogItemId : null;
      let selectedIncidentCatalog: typeof incidentCatalogItems.$inferSelect | undefined;
      if (catalogId) {
        [selectedIncidentCatalog] = await db.select().from(incidentCatalogItems)
          .where(and(eq(incidentCatalogItems.id, catalogId), eq(incidentCatalogItems.isActive, true))).limit(1);
        if (!selectedIncidentCatalog) return res.status(400).json({ message: "Choose an active incident type." });
        if (selectedIncidentCatalog.projectId && selectedIncidentCatalog.projectId !== projectId) {
          return res.status(403).json({ message: "That incident type is not available for the selected project." });
        }
      } else if (!canManageIntake) {
        return res.status(400).json({ message: "Choose an incident type from the catalog." });
      }

      let assetId = typeof req.body.assetId === "string" && req.body.assetId ? req.body.assetId : null;
      if (!canManageIntake && assetId) {
        if (!req.user.employeeId || !await isFeatureEnabled("asset_management")) {
          return res.status(403).json({ message: "This account is not linked to an employee with assigned assets." });
        }
        const [assignedAsset] = await db.select({ id: assets.id }).from(assets)
          .innerJoin(assignments, eq(assignments.assetId, assets.id))
          .where(and(
            eq(assets.id, assetId),
            eq(assignments.employeeId, req.user.employeeId),
            isNull(assignments.returnedDate),
          )).limit(1);
        if (!assignedAsset) return res.status(400).json({ message: "Select equipment currently assigned to your employee record." });
      }
      const parsed = insertIncidentSchema.parse({
        title: req.body.title,
        description: req.body.description,
        projectId,
        incidentCatalogItemId: selectedIncidentCatalog?.id ?? null,
        category: selectedIncidentCatalog?.category ?? req.body.category,
        priority: canManageIntake ? req.body.priority ?? selectedIncidentCatalog?.defaultPriority : selectedIncidentCatalog?.defaultPriority,
        urgency: canManageIntake ? req.body.urgency ?? selectedIncidentCatalog?.defaultUrgency : selectedIncidentCatalog?.defaultUrgency,
        impact: canManageIntake ? req.body.impact ?? selectedIncidentCatalog?.defaultImpact : selectedIncidentCatalog?.defaultImpact,
        assignmentGroup: canManageIntake ? req.body.assignmentGroup ?? selectedIncidentCatalog?.defaultAssignmentGroup : selectedIncidentCatalog?.defaultAssignmentGroup,
        assigneeId: canManageIntake ? req.body.assigneeId ?? null : null,
        assignedToId: canManageIntake ? req.body.assigneeId ?? null : null,
        slaPolicyId: canManageIntake ? req.body.slaPolicyId ?? null : null,
        assetId,
        creatorId: req.user.id,
        requesterId,
        contractId: null,
        isWarrantyExpired: false,
      });
      if (parsed.assigneeId) {
        if (!await canManageAllTickets(req.user.id)) return res.status(403).json({ message: "Only IT staff may assign an engineer during incident intake." });
        if (!await isAllowedIncidentAssignee(parsed.assigneeId, parsed.assignmentGroup ?? null)) {
          return res.status(400).json({ message: "The selected engineer must be active and eligible for the selected assignment group." });
        }
      }
      if (!["P1", "P2", "P3", "P4"].includes(parsed.priority ?? "")) {
        return res.status(400).json({ message: "priority must be P1, P2, P3, or P4" });
      }
      if (parsed.projectId && !await isFeatureEnabled("project_management")) return sendFeatureNotEnabled(res, "project_management");
      if (parsed.projectId && !(await db.select({ id: projects.id }).from(projects).where(eq(projects.id, parsed.projectId))).length) {
        return res.status(400).json({ message: "Project not found" });
      }
      const contractContext = await resolveIncidentContractContext(parsed.projectId);
      const contractId = contractContext.contractId;
      const isWarrantyExpired = contractContext.isWarrantyExpired;
      let slaPolicyId = contractContext.applyContractSla
        ? contractContext.slaPolicyId
        : parsed.slaPolicyId ?? null;
      if (!slaPolicyId) {
        const priorityMap: Record<string, string> = { P1: "critical", P2: "high", P3: "medium", P4: "low" };
        const policies = await db.select().from(slaPolicies).where(and(
          eq(slaPolicies.priority, priorityMap[parsed.priority ?? "P3"] ?? "medium"),
          eq(slaPolicies.isActive, true),
        ));
        const baselinePolicy = (parsed.category
          ? policies.find(policy => policy.ticketType === "incident" && policy.category === parsed.category)
          : undefined) ??
          policies.find(policy => policy.ticketType === "incident" && !policy.category) ??
          policies.find(policy => !policy.ticketType && !policy.category);
        slaPolicyId = baselinePolicy?.id ?? null;
      }
      if (slaPolicyId && !(await db.select({ id: slaPolicies.id }).from(slaPolicies).where(and(eq(slaPolicies.id, slaPolicyId), eq(slaPolicies.isActive, true)))).length) {
        return res.status(400).json({ message: "Active SLA policy not found" });
      }
      const incident = await storage.createIncident({
        ...parsed,
        contractId,
        isWarrantyExpired,
        slaPolicyId,
        ...(contractContext.applyContractSla ? { responseDueAt: undefined, resolveDueAt: undefined } : {}),
        status: "New",
      });
      await db.insert(incidentActivities).values({ incidentId: incident.id, actorId: req.user.id, action: "Incident created", details: incident.title });
      await logAudit(req.user.id, "CREATE", "incidents", incident.id, incident.title, null, incident, req);
      res.status(201).json(incident);
    } catch (error) {
      if (error instanceof z.ZodError) return res.status(400).json({ message: "Invalid incident data", errors: error.issues });
      respondWithApiError(res, error, "Failed to create incident");
    }
  });

  app.patch("/api/incidents/:id/assignment", requireAuth, requireModule("itsm"), requireAnyPermission("ticket_manage", "system_admin"), async (req: any, res) => {
    try {
      const schema = z.object({ assignmentGroup: z.string().trim().max(120).nullable().optional(), assigneeId: z.string().uuid().nullable().optional() });
      const assignment = schema.parse(req.body);
      const currentIncident = (await storage.getIncidents()).find(row => row.id === req.params.id);
      if (!currentIncident) return res.status(404).json({ message: "Incident not found" });
      const nextGroup = assignment.assignmentGroup !== undefined ? assignment.assignmentGroup : currentIncident.assignmentGroup;
      const nextAssignee = assignment.assigneeId !== undefined ? assignment.assigneeId : currentIncident.assigneeId ?? currentIncident.assignedToId;
      if (nextAssignee && !await isAllowedIncidentAssignee(nextAssignee, nextGroup ?? null)) {
        return res.status(400).json({ message: "The selected engineer must be active and belong to the selected assignment group." });
      }
      const updated = await db.transaction(async tx => {
        const [incident] = await tx.select().from(incidents).where(eq(incidents.id, req.params.id)).for("update");
        if (!incident) throw new IncidentTransitionError(404, "Incident not found");
        const [result] = await tx.update(incidents).set({
          ...(assignment.assignmentGroup !== undefined ? { assignmentGroup: assignment.assignmentGroup || null } : {}),
          ...(assignment.assigneeId !== undefined ? { assigneeId: assignment.assigneeId, assignedToId: assignment.assigneeId } : {}),
          updatedAt: new Date(),
        }).where(eq(incidents.id, incident.id)).returning();
        const assignedGroup = assignment.assignmentGroup !== undefined ? assignment.assignmentGroup : incident.assignmentGroup;
        const assignedUser = assignment.assigneeId !== undefined ? assignment.assigneeId : incident.assigneeId ?? incident.assignedToId;
        await tx.insert(incidentActivities).values({ incidentId: incident.id, actorId: req.user.id, action: "Assignment updated", details: `Group: ${assignedGroup || "Unassigned"}; assignee: ${assignedUser || "Unassigned"}` });
        return result;
      });
      await logAudit(req.user.id, "UPDATE", "incidents", currentIncident.id, currentIncident.title,
        { assignmentGroup: currentIncident.assignmentGroup, assigneeId: currentIncident.assigneeId ?? currentIncident.assignedToId },
        { assignmentGroup: updated.assignmentGroup, assigneeId: updated.assigneeId ?? updated.assignedToId }, req);
      res.json(updated);
    } catch (error) {
      if (error instanceof z.ZodError) return res.status(400).json({ message: "Invalid assignment data", errors: error.issues });
      if (error instanceof IncidentTransitionError) return res.status(error.statusCode).json({ message: error.message });
      respondWithApiError(res, error, "Failed to update incident assignment");
    }
  });

  app.patch("/api/incidents/:id/status", requireAuth, requireModule("itsm"), requireAnyPermission("ticket_manage", "system_admin"), async (req: any, res) => {
    try {
      const { status, category, resolutionCode, resolutionNotes } = z.object({
        status: z.enum(["New", "In Progress", "Pending", "Resolved", "Closed"]),
        category: z.string().trim().max(120).nullable().optional(),
        resolutionCode: z.string().trim().max(120).nullable().optional(),
        resolutionNotes: z.string().trim().max(4000).nullable().optional(),
      }).parse(req.body);
      const [before] = await db.select({
        id: incidents.id,
        title: incidents.title,
        status: incidents.status,
      }).from(incidents).where(eq(incidents.id, req.params.id));
      if (!before) return res.status(404).json({ message: "Incident not found" });
      const updated = await transitionIncident({
        incidentId: req.params.id,
        actorId: req.user.id,
        status,
        category,
        resolutionCode,
        resolutionNotes,
      });
      await logAudit(req.user.id, "UPDATE", "incidents", updated.id, updated.title,
        { status: before.status }, { status: updated.status }, req);
      res.json(updated);
    } catch (error) {
      if (error instanceof z.ZodError) return res.status(400).json({ message: "Invalid status transition", errors: error.issues });
      if (error instanceof IncidentTransitionError) return res.status(error.statusCode).json({ message: error.message });
      respondWithApiError(res, error, "Failed to update incident status");
    }
  });

  const updateIncidentHandler: RequestHandler = async (req, res) => {
    try {
      const parsed = updateIncidentSchema.parse(req.body);
      if (parsed.assigneeId !== undefined && parsed.assignedToId !== undefined && parsed.assigneeId !== parsed.assignedToId) {
        res.status(400).json({ message: "assigneeId and assignedToId must refer to the same user." });
        return;
      }
      const assigneeId = parsed.assigneeId !== undefined ? parsed.assigneeId : parsed.assignedToId;
      if (assigneeId && !(await storage.getUser(assigneeId))) {
        res.status(400).json({ message: "Assignee not found" });
        return;
      }
      if (assigneeId !== undefined) {
        parsed.assigneeId = assigneeId;
        parsed.assignedToId = assigneeId;
      }
      if (parsed.projectId && !await isFeatureEnabled("project_management")) return sendFeatureNotEnabled(res, "project_management");
      if (parsed.projectId && !(await db.select({ id: projects.id }).from(projects).where(eq(projects.id, parsed.projectId))).length) {
        res.status(400).json({ message: "Project not found" });
        return;
      }
      if (parsed.assetId && !await isFeatureEnabled("asset_management")) return sendFeatureNotEnabled(res, "asset_management");
      if (parsed.assetId && !(await db.select({ id: assets.id }).from(assets).where(eq(assets.id, parsed.assetId))).length) {
        res.status(400).json({ message: "Asset not found" });
        return;
      }
      if (parsed.slaPolicyId && !(await db.select({ id: slaPolicies.id }).from(slaPolicies).where(and(eq(slaPolicies.id, parsed.slaPolicyId), eq(slaPolicies.isActive, true)))).length) {
        res.status(400).json({ message: "SLA policy not found" });
        return;
      }
      if (parsed.status) {
        const { status, ...rest } = parsed;
        const [before] = await db.select({ id: incidents.id, title: incidents.title, status: incidents.status })
          .from(incidents).where(eq(incidents.id, req.params.id));
        if (!before) {
          res.status(404).json({ message: "Incident not found" });
          return;
        }
        const incident = await transitionIncident({
          incidentId: req.params.id,
          actorId: (req as any).user.id,
          status,
          category: parsed.category,
          resolutionCode: parsed.resolutionCode,
          resolutionNotes: parsed.resolutionNotes,
          updates: rest as Partial<typeof incidents.$inferSelect>,
        });
        await logAudit((req as any).user.id, "UPDATE", "incidents", incident.id, incident.title,
          { status: before.status }, { status: incident.status }, req);
        res.json(incident);
        return;
      }
      const incident = await db.transaction(async tx => {
        const [current] = await tx.select().from(incidents).where(eq(incidents.id, req.params.id)).for("update");
        if (!current) return undefined;
        const next = { ...current, ...parsed };
        let timerUpdates: { responseDueAt?: Date; resolveDueAt?: Date } = {};
        if (next.slaPolicyId !== current.slaPolicyId || next.priority !== current.priority) {
          const [policy] = next.slaPolicyId
            ? await tx.select().from(slaPolicies).where(and(eq(slaPolicies.id, next.slaPolicyId), eq(slaPolicies.isActive, true))).limit(1)
            : [];
          const openedAt = current.createdAt ?? new Date();
          if (policy) {
            timerUpdates = {
              responseDueAt: new Date(openedAt.getTime() + policy.responseHours * 3600000),
              resolveDueAt: new Date(openedAt.getTime() + policy.resolutionHours * 3600000),
            };
          } else {
            const priorities: Record<string, string> = { P1: "critical", P2: "high", P3: "medium", P4: "low" };
            const targets = await computeTicketSlaDates(priorities[next.priority], openedAt, "incident", next.category);
            timerUpdates = { responseDueAt: targets.slaResponseDueAt, resolveDueAt: targets.slaResolutionDueAt };
          }
        }
        if (["Resolved", "Closed"].includes(current.status) &&
            (!next.category?.trim() || !next.resolutionCode?.trim() || !next.resolutionNotes?.trim())) {
          throw new IncidentTransitionError(400, "Resolved or closed incidents must retain their category, resolution code, and resolution notes.");
        }
        const [updated] = await tx.update(incidents).set({ ...parsed, ...timerUpdates, updatedAt: new Date() })
          .where(eq(incidents.id, req.params.id)).returning();
        if (!updated) return undefined;
        await tx.insert(incidentActivities).values({
          incidentId: updated.id,
          actorId: (req as any).user.id,
          action: "Incident details updated",
          details: `Updated fields: ${Object.keys(parsed).join(", ")}`,
        });
        return updated;
      });
      if (!incident) {
        res.status(404).json({ message: "Incident not found" });
        return;
      }
      res.json(incident);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ message: "Invalid incident data", errors: error.issues });
        return;
      }
      if (error instanceof IncidentTransitionError) {
        res.status(error.statusCode).json({ message: error.message });
        return;
      }
      respondWithApiError(res, error, "Failed to update incident");
    }
  };
  app.put("/api/incidents/:id", requireAuth, requireModule("itsm"), requireAnyPermission("ticket_manage", "system_admin"), updateIncidentHandler);
  app.patch("/api/incidents/:id", requireAuth, requireModule("itsm"), requireAnyPermission("ticket_manage", "system_admin"), updateIncidentHandler);

  app.post("/api/incidents/:id/to-change", requireAuth, requireModule("itsm"), requireAnyPermission("ticket_manage", "system_admin"), async (req: any, res) => {
    try {
      const incident = (await storage.getIncidents()).find(row => row.id === req.params.id);
      if (!incident) return res.status(404).json({ message: "Incident not found" });
      if (incident.changeRequestId) return res.status(409).json({ message: "Incident already has a linked change request" });
      const change = await storage.createChange({
        title: `Incident ${incident.incidentNumber}: ${incident.title}`,
        description: incident.description,
        type: "normal",
        status: "draft",
        priority: incident.priority,
        requestedById: req.user.id,
      });
      await storage.updateIncident(incident.id, { changeRequestId: change.id });
      res.status(201).json(change);
    } catch (error) {
      respondWithApiError(res, error, "Failed to create linked change request");
    }
  });

  app.get("/api/service-requests", requireAuth, requireModule("itsm"), async (req: any, res) => {
    try {
      const rows = await storage.getServiceRequests();
      const canViewAll = await canViewAllItsmRecords(req.user.id);
      const catalogViewer = await loadCatalogViewer(req);
      const canReviewCatalog = serviceApprovalRoles(catalogViewer).length > 0;
      const visible = (canViewAll ? rows : rows.filter(row => row.requesterId === req.user.id))
        .filter(row => !row.serviceCatalogItemId || row.fulfillmentStage !== "Pending Approval" ||
          row.requesterId === req.user.id || canReviewCatalog);
      const [projectRows, userRows, catalogRows, employeeRows] = await Promise.all([
        isFeatureEnabled("project_management").then(enabled => enabled ? db.select({ id: projects.id, name: projects.name }).from(projects) : []),
        db.select({ id: users.id, username: users.username, firstName: users.firstName, lastName: users.lastName, email: users.email }).from(users),
        db.select({ id: catalogItems.id, name: catalogItems.name, consumableId: catalogItems.consumableId }).from(catalogItems),
        isFeatureEnabled("asset_management").then(enabled => enabled ? db.select({ email: employees.email, phone: employees.phone, mobile: employees.mobile }).from(employees) : []),
      ]);
      const projectNames = new Map(projectRows.map(row => [row.id, row.name]));
      const userDetails = new Map(userRows.map(user => [user.id, {
        name: [user.firstName, user.lastName].filter(Boolean).join(" ") || user.username,
        email: user.email,
      }]));
      const employeeContacts = new Map(employeeRows.filter((employee): employee is typeof employee & { email: string } => Boolean(employee.email)).map(employee => [employee.email.toLowerCase(), {
        phone: employee.phone,
        mobile: employee.mobile,
      }]));
      const catalogNames = new Map(catalogRows.map(row => [row.id, row.name]));
      const catalogConsumables = new Map(catalogRows.map(row => [row.id, row.consumableId]));
      res.json(visible.map(row => ({
        ...row,
        fulfillmentStage: row.fulfillmentStage ?? ({ Submitted: "Submitted", Approved: "Approved", Fulfilling: "In Procurement", Completed: "Completed", Rejected: "Rejected" } as Record<string, string>)[row.fulfillmentStatus] ?? "Submitted",
        projectName: row.projectId ? projectNames.get(row.projectId) ?? null : null,
        catalogItemName: row.catalogItemId ? catalogNames.get(row.catalogItemId) ?? null : null,
        consumableId: row.catalogItemId ? catalogConsumables.get(row.catalogItemId) ?? null : null,
        requesterName: userDetails.get(row.requesterId)?.name ?? null,
        requesterEmail: userDetails.get(row.requesterId)?.email ?? null,
        requesterPhone: employeeContacts.get(userDetails.get(row.requesterId)?.email.toLowerCase() ?? "")?.phone ?? null,
        requesterMobile: employeeContacts.get(userDetails.get(row.requesterId)?.email.toLowerCase() ?? "")?.mobile ?? null,
        assigneeName: (row.assigneeId || row.assignedToId) ? userDetails.get(row.assigneeId || row.assignedToId!)?.name ?? null : null,
      })));
    } catch (error) {
      respondWithApiError(res, error, "Failed to fetch service requests");
    }
  });

  app.get("/api/service-requests/:id", requireAuth, requireModule("itsm"), async (req: any, res) => {
    try {
      const request = (await storage.getServiceRequests()).find(row => row.id === req.params.id);
      if (!request) return res.status(404).json({ message: "Service request not found" });
      if (request.requesterId !== req.user.id && !(await canViewAllItsmRecords(req.user.id))) {
        return res.status(403).json({ message: "Insufficient permissions" });
      }
      res.json(request);
    } catch (error) {
      respondWithApiError(res, error, "Failed to fetch service request");
    }
  });

  app.get("/api/service-requests/:id/consumable-options", requireAuth, requireModule("itsm"), requireModule("asset_management"), requirePermission("ticket_manage"), async (req: any, res) => {
    try {
      const request = (await storage.getServiceRequests()).find(row => row.id === req.params.id);
      if (!request) return res.status(404).json({ message: "Service request not found" });
      if (!request.catalogItemId) return res.json({ stock: [], requestedQuantity: request.requestedQuantity || 1 });
      const [catalogItem] = await db.select().from(catalogItems).where(eq(catalogItems.id, request.catalogItemId));
      if (!catalogItem?.consumableId) return res.json({ stock: [], requestedQuantity: request.requestedQuantity || 1 });
      const [master] = await db.select().from(consumables).where(eq(consumables.id, catalogItem.consumableId));
      if (!master) return res.json({ stock: [], requestedQuantity: request.requestedQuantity || 1 });
      const stock = await db.select({
        id: consumables.id,
        name: consumables.name,
        modelPartNumber: consumables.modelPartNumber,
        quantityInStock: consumables.quantityInStock,
        warehouseLocationId: consumables.warehouseLocationId,
        warehouseName: warehouseLocations.name,
        warehouseCode: warehouseLocations.code,
        storageRoom: warehouseLocations.storageRoom,
      }).from(consumables)
        .innerJoin(warehouseLocations, eq(warehouseLocations.id, consumables.warehouseLocationId))
        .where(and(eq(consumables.category, master.category), eq(warehouseLocations.isActive, true)));
      const matching = stock.filter(item =>
        item.name.toLocaleLowerCase() === master.name.toLocaleLowerCase() &&
        (item.modelPartNumber ?? "").toLocaleLowerCase() === (master.modelPartNumber ?? "").toLocaleLowerCase()
      );
      const [dispatch] = await db.select({
        id: consumableDispatchLog.id,
        quantity: consumableDispatchLog.quantity,
        dispatchedAt: consumableDispatchLog.dispatchedAt,
        requesterId: consumableDispatchLog.requesterId,
        agentId: consumableDispatchLog.agentId,
        warehouseName: warehouseLocations.name,
        consumableName: consumables.name,
      }).from(consumableDispatchLog)
        .innerJoin(warehouseLocations, eq(warehouseLocations.id, consumableDispatchLog.warehouseLocationId))
        .innerJoin(consumables, eq(consumables.id, consumableDispatchLog.consumableId))
        .where(eq(consumableDispatchLog.serviceRequestId, request.id));
      let dispatchDetails: Record<string, unknown> | null = null;
      if (dispatch) {
        const people = await db.select({ id: users.id, firstName: users.firstName, lastName: users.lastName, username: users.username })
          .from(users).where(inArray(users.id, [dispatch.requesterId, dispatch.agentId]));
        const names = new Map(people.map(person => [person.id, [person.firstName, person.lastName].filter(Boolean).join(" ") || person.username]));
        dispatchDetails = {
          ...dispatch,
          requesterName: names.get(dispatch.requesterId) ?? "Former user",
          agentName: names.get(dispatch.agentId) ?? "Former user",
        };
      }
      res.json({ stock: matching, requestedQuantity: request.requestedQuantity || 1, dispatch: dispatchDetails });
    } catch (error) {
      respondWithApiError(res, error, "Failed to fetch fulfillment stock options");
    }
  });

  app.get("/api/service-requests/:id/activity", requireAuth, requireModule("itsm"), async (req: any, res) => {
    try {
      const request = (await storage.getServiceRequests()).find(row => row.id === req.params.id);
      if (!request) return res.status(404).json({ message: "Service request not found" });
      if (request.requesterId !== req.user.id && !(await canViewAllItsmRecords(req.user.id))) {
        return res.status(403).json({ message: "Insufficient permissions" });
      }
      const entries = await db.select({
        id: serviceRequestActivities.id, action: serviceRequestActivities.action,
        details: serviceRequestActivities.details, createdAt: serviceRequestActivities.createdAt,
        actorName: users.username,
      }).from(serviceRequestActivities)
        .leftJoin(users, eq(users.id, serviceRequestActivities.actorId))
        .where(eq(serviceRequestActivities.serviceRequestId, request.id));
      res.json(entries);
    } catch (error) {
      respondWithApiError(res, error, "Failed to fetch service request activity");
    }
  });

  app.post("/api/service-requests", requireAuth, requireModule("itsm"), async (req: any, res) => {
    try {
      if (await isStructuredCatalogItem(req.body.catalogItemId)) {
        return res.status(400).json({ message: "Submit this service through the Service Catalog so its form and approval policy are validated" });
      }
      const canCreateForOthers = await canViewAllItsmRecords(req.user.id);
      const requesterId = canCreateForOthers ? req.body.requesterId || req.user.id : req.user.id;
      if (!(await storage.getUser(requesterId))) return res.status(400).json({ message: "Requested-for user not found" });
      const parsed = insertServiceRequestSchema.parse({ ...req.body, serviceCatalogItemId: null, customFieldValues: {}, catalogSchemaSnapshot: [], creatorId: req.user.id, requesterId, fulfillmentStatus: "Submitted", fulfillmentStage: "Submitted" });
      if (!Number.isFinite(parsed.cost ?? 0) || (parsed.cost ?? 0) < 0) return res.status(400).json({ message: "cost must be a non-negative number" });
      if (parsed.projectId && !await isFeatureEnabled("project_management")) return sendFeatureNotEnabled(res, "project_management");
      if (parsed.projectId && !(await db.select({ id: projects.id }).from(projects).where(eq(projects.id, parsed.projectId))).length) {
        return res.status(400).json({ message: "Project not found" });
      }
      const request = await storage.createServiceRequest(parsed);
      await db.insert(serviceRequestActivities).values({ serviceRequestId: request.id, actorId: req.user.id, action: "Request submitted", details: request.title });
      res.status(201).json(request);
    } catch (error) {
      if (error instanceof z.ZodError) return res.status(400).json({ message: "Invalid service request data", errors: error.issues });
      respondWithApiError(res, error, "Failed to create service request");
    }
  });

  app.patch("/api/service-requests/:id/close", requireAuth, requireModule("itsm"), requirePermission("ticket_manage"), async (req: any, res) => {
    try {
      const { closureNote } = z.object({ closureNote: z.string().trim().min(1).max(4000) }).parse(req.body);
      const existing = (await storage.getServiceRequests()).find(row => row.id === req.params.id);
      if (!existing) return res.status(404).json({ message: "Service request not found" });
      if (["Completed", "Cancelled", "Rejected"].includes(existing.fulfillmentStage ?? existing.fulfillmentStatus)) {
        return res.status(409).json({ message: "This request is already closed" });
      }
      const updated = await storage.updateServiceRequest(existing.id, { fulfillmentStage: "Cancelled", fulfillmentStatus: "Cancelled", closureNote });
      if (!updated) return res.status(404).json({ message: "Service request not found" });
      await db.insert(serviceRequestActivities).values({ serviceRequestId: existing.id, actorId: req.user.id, action: "Request closed", details: closureNote });
      await logAudit(req.user.id, "UPDATE", "service_requests", existing.id, existing.title,
        { fulfillmentStatus: existing.fulfillmentStatus, fulfillmentStage: existing.fulfillmentStage },
        { fulfillmentStatus: updated.fulfillmentStatus, fulfillmentStage: updated.fulfillmentStage }, req);
      res.json(updated);
    } catch (error) {
      if (error instanceof z.ZodError) return res.status(400).json({ message: "A closure note is required", errors: error.issues });
      respondWithApiError(res, error, "Failed to close service request");
    }
  });

  app.patch("/api/service-requests/:id/approval", requireAuth, requireModule("itsm"), requirePermission("ticket_manage"), async (req: any, res) => {
    try {
      const { decision } = z.object({ decision: z.enum(["approved", "rejected"]) }).parse(req.body);
      const existing = (await storage.getServiceRequests()).find(row => row.id === req.params.id);
      if (!existing) return res.status(404).json({ message: "Service request not found" });
      if (existing.serviceCatalogItemId) return res.status(409).json({ message: "Use Pending Approvals in the Service Catalog to record a role-authorized decision and audit note" });
      if (existing.approvalStatus !== "pending") return res.status(409).json({ message: "This request has already been reviewed" });
      const stage = decision === "approved" ? "Approved" : "Rejected";
      const updated = await storage.updateServiceRequest(existing.id, { approvalStatus: decision, fulfillmentStage: stage });
      if (!updated) return res.status(404).json({ message: "Service request not found" });
      await db.insert(serviceRequestActivities).values({ serviceRequestId: existing.id, actorId: req.user.id, action: decision === "approved" ? "Request approved" : "Request rejected" });
      await logAudit(req.user.id, "UPDATE", "service_requests", existing.id, existing.title,
        { approvalStatus: existing.approvalStatus, fulfillmentStage: existing.fulfillmentStage },
        { approvalStatus: updated.approvalStatus, fulfillmentStage: updated.fulfillmentStage }, req);
      res.json(updated);
    } catch (error) {
      if (error instanceof z.ZodError) return res.status(400).json({ message: "Invalid approval decision", errors: error.issues });
      respondWithApiError(res, error, "Failed to review service request");
    }
  });

  app.patch("/api/service-requests/:id/assignment", requireAuth, requireModule("itsm"), requirePermission("ticket_manage"), async (req: any, res) => {
    try {
      const assignment = z.object({
        assignmentGroup: z.string().trim().max(120).nullable().optional(),
        assigneeId: z.string().uuid().nullable().optional(),
      }).parse(req.body);
      const existing = (await storage.getServiceRequests()).find(row => row.id === req.params.id);
      if (!existing) return res.status(404).json({ message: "Service request not found" });
      if (assignment.assigneeId && !(await storage.getUser(assignment.assigneeId))) return res.status(400).json({ message: "Assignee not found" });
      const updated = await storage.updateServiceRequest(existing.id, {
        ...(assignment.assignmentGroup !== undefined ? { assignmentGroup: assignment.assignmentGroup || null } : {}),
        ...(assignment.assigneeId !== undefined ? { assigneeId: assignment.assigneeId, assignedToId: assignment.assigneeId } : {}),
      });
      if (!updated) return res.status(404).json({ message: "Service request not found" });
      const assignedGroup = assignment.assignmentGroup !== undefined ? assignment.assignmentGroup : existing.assignmentGroup;
      const assignedUser = assignment.assigneeId !== undefined ? assignment.assigneeId : existing.assigneeId ?? existing.assignedToId;
      await db.insert(serviceRequestActivities).values({ serviceRequestId: existing.id, actorId: req.user.id, action: "Assignment updated", details: `Group: ${assignedGroup || "Unassigned"}; assigned to: ${assignedUser || "Unassigned"}` });
      await logAudit(req.user.id, "UPDATE", "service_requests", existing.id, existing.title,
        { assignmentGroup: existing.assignmentGroup, assigneeId: existing.assigneeId ?? existing.assignedToId },
        { assignmentGroup: updated.assignmentGroup, assigneeId: updated.assigneeId ?? updated.assignedToId }, req);
      res.json(updated);
    } catch (error) {
      if (error instanceof z.ZodError) return res.status(400).json({ message: "Invalid assignment data", errors: error.issues });
      respondWithApiError(res, error, "Failed to update assignment");
    }
  });

  app.patch("/api/service-requests/:id/stage", requireAuth, requireModule("itsm"), requirePermission("ticket_manage"), async (req: any, res) => {
    try {
      const { stage, fulfilledAssetId } = z.object({
        stage: z.enum(["Submitted", "Pending Approval", "Approved", "In Procurement", "Ready for Delivery", "Completed", "Rejected"]),
        fulfilledAssetId: z.string().uuid().nullable().optional(),
      }).parse(req.body);
      const existing = (await storage.getServiceRequests()).find(row => row.id === req.params.id);
      if (!existing) return res.status(404).json({ message: "Service request not found" });
      const catalogGuard = catalogMutationError(existing, { fulfillmentStage: stage, fulfilledAssetId });
      if (catalogGuard) return res.status(409).json({ message: catalogGuard });
      if (["In Procurement", "Ready for Delivery", "Completed"].includes(stage) && existing.approvalStatus !== "approved") {
        return res.status(409).json({ message: "The request must be approved before fulfillment can proceed" });
      }
      if (stage === "Completed" && existing.catalogItemId) {
        const [catalogItem] = await db.select({ consumableId: catalogItems.consumableId }).from(catalogItems).where(eq(catalogItems.id, existing.catalogItemId));
        if (catalogItem?.consumableId) return res.status(409).json({ message: "Use Fulfill / Deliver to deduct stock before completing this request" });
      }
      if (stage === "Completed" && existing.fulfillmentStage !== "Ready for Delivery") {
        return res.status(409).json({ message: "Move the request to Ready for Delivery before completing it" });
      }
      if (stage === "Completed" && fulfilledAssetId) {
        if (!await isFeatureEnabled("asset_management")) return sendFeatureNotEnabled(res, "asset_management");
        const [asset] = await db.select({ id: assets.id, status: assets.status }).from(assets).where(eq(assets.id, fulfilledAssetId));
        if (!asset || asset.status !== "In Store") return res.status(409).json({ message: "The selected asset is no longer in store" });
      }
      const updated = await storage.updateServiceRequest(existing.id, {
        fulfillmentStage: stage,
        ...(stage === "Completed" ? { fulfilledAssetId: fulfilledAssetId ?? null } : {}),
      });
      if (!updated) return res.status(404).json({ message: "Service request not found" });
      await db.insert(serviceRequestActivities).values({ serviceRequestId: existing.id, actorId: req.user.id, action: "Fulfillment stage changed", details: `${existing.fulfillmentStage ?? existing.fulfillmentStatus} → ${stage}` });
      await logAudit(req.user.id, "UPDATE", "service_requests", existing.id, existing.title,
        { fulfillmentStage: existing.fulfillmentStage ?? existing.fulfillmentStatus },
        { fulfillmentStage: updated.fulfillmentStage ?? updated.fulfillmentStatus }, req);
      res.json(updated);
    } catch (error) {
      if (error instanceof z.ZodError) return res.status(400).json({ message: "Invalid fulfillment stage", errors: error.issues });
      if (error instanceof Error && error.message.includes("no longer in store")) return res.status(409).json({ message: error.message });
      respondWithApiError(res, error, "Failed to update fulfillment stage");
    }
  });

  app.post("/api/service-requests/:id/fulfill-consumable", requireAuth, requireModule("itsm"), requireModule("asset_management"), requirePermission("ticket_manage"), async (req: any, res) => {
    try {
      const { warehouseLocationId } = z.object({ warehouseLocationId: z.string().uuid() }).parse(req.body);
      const result = await db.transaction(async tx => {
        const [request] = await tx.select().from(serviceRequests).where(eq(serviceRequests.id, req.params.id)).for("update");
        if (!request) throw Object.assign(new Error("Service request not found"), { status: 404 });
        const [location] = await tx.select({ id: warehouseLocations.id }).from(warehouseLocations)
          .where(and(eq(warehouseLocations.id, warehouseLocationId), eq(warehouseLocations.isActive, true))).for("update");
        if (!location) throw Object.assign(new Error("This warehouse is disabled or no longer available"), { status: 409 });
        if (request.fulfillmentStage !== "Ready for Delivery" || request.approvalStatus !== "approved") {
          throw Object.assign(new Error("The request must be approved and ready for delivery"), { status: 409 });
        }
        if (!request.catalogItemId) throw Object.assign(new Error("This request is not linked to a consumable catalog item"), { status: 400 });
        const [catalogItem] = await tx.select().from(catalogItems).where(eq(catalogItems.id, request.catalogItemId));
        if (!catalogItem?.consumableId) throw Object.assign(new Error("This catalog item is not linked to a consumable"), { status: 400 });
        const [priorDispatch] = await tx.select({ id: consumableDispatchLog.id }).from(consumableDispatchLog)
          .where(eq(consumableDispatchLog.serviceRequestId, request.id));
        if (priorDispatch) throw Object.assign(new Error("Stock was already dispatched for this request"), { status: 409 });
        const [catalogStock] = await tx.select().from(consumables).where(eq(consumables.id, catalogItem.consumableId));
        if (!catalogStock) throw Object.assign(new Error("The catalog stock item no longer exists"), { status: 404 });
        const locationStock = await tx.select().from(consumables)
          .where(eq(consumables.warehouseLocationId, warehouseLocationId)).for("update");
        const stock = locationStock.find(row =>
          row.id === catalogStock.id ||
          (row.name.toLocaleLowerCase() === catalogStock.name.toLocaleLowerCase() &&
            (row.modelPartNumber ?? "").toLocaleLowerCase() === (catalogStock.modelPartNumber ?? "").toLocaleLowerCase())
        );
        if (!stock) throw Object.assign(new Error("No matching stock item exists at that location"), { status: 404 });
        const quantity = request.requestedQuantity || 1;
        if (stock.quantityInStock < quantity) throw Object.assign(new Error(`Insufficient stock: ${stock.quantityInStock} available, ${quantity} requested`), { status: 409 });
        const now = new Date();
        const [updatedStock] = await tx.update(consumables).set({
          quantityInStock: stock.quantityInStock - quantity,
          updatedAt: now,
        }).where(eq(consumables.id, stock.id)).returning();
        const [dispatch] = await tx.insert(consumableDispatchLog).values({
          consumableId: stock.id,
          warehouseLocationId,
          serviceRequestId: request.id,
          serviceRequestNumber: request.requestNumber,
          requesterId: request.requesterId,
          agentId: req.user.id,
          quantity,
          dispatchedAt: now,
        }).returning();
        await tx.insert(consumableStockMovements).values({
          consumableId: stock.id,
          movementType: "issue",
          quantity,
          fromWarehouseLocationId: warehouseLocationId,
          recipientUserId: request.requesterId,
          actorId: req.user.id,
          serviceRequestId: request.id,
          notes: `Fulfilled ${request.requestNumber}`,
          createdAt: now,
        });
        const [updatedRequest] = await tx.update(serviceRequests).set({
          fulfillmentStage: "Completed",
          fulfillmentStatus: "Completed",
          completedAt: now,
        }).where(eq(serviceRequests.id, request.id)).returning();
        await tx.insert(serviceRequestActivities).values({
          serviceRequestId: request.id,
          actorId: req.user.id,
          action: "Consumable delivered",
          details: `${quantity} × ${stock.name} dispatched from stock at ${warehouseLocationId}`,
          createdAt: now,
        });
        return { request: updatedRequest, stock: updatedStock, dispatch };
      });
      res.json(result);
    } catch (error) {
      if (error instanceof z.ZodError) return res.status(400).json({ message: "Select a source warehouse", errors: error.issues });
      const status = (error as any)?.status;
      if (status) return res.status(status).json({ message: (error as Error).message });
      respondWithApiError(res, error, "Failed to fulfill consumable request");
    }
  });

  app.put("/api/service-requests/:id", requireAuth, requireModule("itsm"), requirePermission("ticket_manage"), async (req, res) => {
    try {
      const parsed = insertServiceRequestSchema.partial().omit({ requesterId: true, creatorId: true, completedAt: true, serviceCatalogItemId: true, customFieldValues: true, catalogSchemaSnapshot: true }).parse(req.body);
      if (parsed.projectId && !await isFeatureEnabled("project_management")) return sendFeatureNotEnabled(res, "project_management");
      if (parsed.projectId && !(await db.select({ id: projects.id }).from(projects).where(eq(projects.id, parsed.projectId))).length) {
        return res.status(400).json({ message: "Project not found" });
      }
      if (parsed.cost !== undefined && (!Number.isFinite(parsed.cost) || parsed.cost < 0)) return res.status(400).json({ message: "cost must be a non-negative number" });
      if (parsed.fulfillmentStatus && !["Submitted", "Approved", "Fulfilling", "Completed", "Rejected"].includes(parsed.fulfillmentStatus)) {
        return res.status(400).json({ message: "Invalid fulfillment status" });
      }
      if (parsed.fulfillmentStage && !["Submitted", "Pending Approval", "Approved", "In Procurement", "Ready for Delivery", "Completed", "Rejected"].includes(parsed.fulfillmentStage)) {
        return res.status(400).json({ message: "Invalid fulfillment stage" });
      }
      if (parsed.approvalStatus && !["pending", "approved", "rejected"].includes(parsed.approvalStatus)) {
        return res.status(400).json({ message: "Invalid approval status" });
      }
      const existing = (await storage.getServiceRequests()).find(row => row.id === req.params.id);
      if (!existing) return res.status(404).json({ message: "Service request not found" });
      const catalogGuard = catalogMutationError(existing, parsed);
      if (catalogGuard) return res.status(409).json({ message: catalogGuard });
      if ((parsed.fulfillmentStatus === "Completed" || parsed.fulfillmentStage === "Completed") && existing.catalogItemId) {
        const [catalogItem] = await db.select({ consumableId: catalogItems.consumableId }).from(catalogItems).where(eq(catalogItems.id, existing.catalogItemId));
        if (catalogItem?.consumableId) return res.status(409).json({ message: "Use Fulfill / Deliver to deduct stock before completing this request" });
      }
      const nextApproval = parsed.approvalStatus ?? existing.approvalStatus;
      const nextStatus = parsed.fulfillmentStatus ?? existing.fulfillmentStatus;
      if (nextStatus === "Completed" && nextApproval !== "approved") {
        return res.status(409).json({ message: "A request must be approved before completion" });
      }
      const nextStage = parsed.fulfillmentStage ?? (nextStatus === "Completed" ? "Completed" : undefined);
      if (nextStage === "Completed" && existing.fulfillmentStage !== "Ready for Delivery") {
        return res.status(409).json({ message: "Move the request to Ready for Delivery before completing it" });
      }
      if (parsed.approvalStatus === "rejected") {
        parsed.fulfillmentStatus = "Rejected";
        parsed.fulfillmentStage = "Rejected";
      }
      const updated = await storage.updateServiceRequest(req.params.id, parsed);
      if (!updated) return res.status(404).json({ message: "Service request not found" });
      if (parsed.fulfillmentStage && parsed.fulfillmentStage !== existing.fulfillmentStage) {
        await db.insert(serviceRequestActivities).values({ serviceRequestId: updated.id, actorId: (req as any).user.id, action: "Fulfillment stage changed", details: `${existing.fulfillmentStage ?? existing.fulfillmentStatus} → ${parsed.fulfillmentStage}` });
      }
      if (parsed.approvalStatus && parsed.approvalStatus !== existing.approvalStatus) {
        await db.insert(serviceRequestActivities).values({ serviceRequestId: updated.id, actorId: (req as any).user.id, action: "Approval status changed", details: `${existing.approvalStatus} → ${parsed.approvalStatus}` });
      }
      res.json(updated);
    } catch (error) {
      if (error instanceof z.ZodError) return res.status(400).json({ message: "Invalid service request data", errors: error.issues });
      respondWithApiError(res, error, "Failed to update service request");
    }
  });

  async function canManageAllTickets(userId: string): Promise<boolean> {
    const perms = await storage.getUserPermissions(userId);
    return perms.includes("system_admin") || perms.includes("ticket_manage") || perms.includes("ticket_view_all");
  }

  async function canViewAllItsmRecords(userId: string): Promise<boolean> {
    const [perms, roles] = await Promise.all([storage.getUserPermissions(userId), storage.getUserRoles(userId)]);
    return perms.some(permission => ["system_admin", "ticket_manage", "ticket_view_all", "change_view_all", "change_approve"].includes(permission)) ||
      roles.some(role => ["system_admin", "it_manager", "it_agent"].includes(getStandardRoleKey(role.name) ?? ""));
  }

  async function canReadChangeRecord(userId: string, changeId: string): Promise<boolean> {
    const change = await storage.getChange(changeId);
    return Boolean(change && (
      change.requestedById === userId || await canViewAllItsmRecords(userId)
    ));
  }

  async function canManageTicket(userId: string): Promise<boolean> {
    const perms = await storage.getUserPermissions(userId);
    return perms.includes("ticket_manage");
  }

  async function canManageAssignmentGroups(userId: string): Promise<boolean> {
    const [perms, assignedRoles] = await Promise.all([
      storage.getUserPermissions(userId),
      storage.getUserRoles(userId),
    ]);
    return perms.includes("system_admin") || assignedRoles.some(role =>
      ["system_admin", "it_manager"].includes(getStandardRoleKey(role.name) ?? ""),
    );
  }

  async function canAccessAssignmentMembers(userId: string): Promise<boolean> {
    return (await canManageAssignmentGroups(userId)) || canManageAllTickets(userId);
  }

  function assignmentGroupsForbidden(res: any) {
    return res.status(403).json({ message: "Assignment group administration is restricted to administrators and managers." });
  }

  const eligibleAssignmentRoles = new Set([
    "it staff", "it support staff", "it agent", "manager", "it manager", "admin", "administrator",
    "system administrator", "system_administrator", "helpdesk agent", "help desk agent",
    "it_agent", "it_manager", "system_admin",
  ]);

  async function isAllowedIncidentAssignee(userId: string, groupName: string | null): Promise<boolean> {
    const [roleRows, permissions] = await Promise.all([
      db.select({ roleName: roles.name, isActive: users.isActive })
      .from(users)
      .innerJoin(userRoles, eq(userRoles.userId, users.id))
      .innerJoin(roles, eq(userRoles.roleId, roles.id))
      .where(eq(users.id, userId)),
      storage.getUserPermissions(userId),
    ]);
    const activeUser = roleRows.some(row => row.isActive === true);
    const hasEligibleRole = roleRows.some(row => row.isActive === true && eligibleAssignmentRoles.has(row.roleName.trim().toLowerCase()));
    if (!activeUser || (!hasEligibleRole && !permissions.includes("system_admin"))) return false;
    if (!groupName?.trim()) return true;
    const [group] = await db.select({ id: assignmentGroups.id }).from(assignmentGroups)
      .where(and(
        eq(assignmentGroups.active, true),
        sql`lower(btrim(${assignmentGroups.name})) = lower(btrim(${groupName}))`,
      )).limit(1);
    if (!group) return true; // Keep older, unmanaged assignment-group labels readable.
    const [membership] = await db.select({ id: assignmentGroupMembers.id })
      .from(assignmentGroupMembers)
      .where(and(eq(assignmentGroupMembers.groupId, group.id), eq(assignmentGroupMembers.userId, userId)))
      .limit(1);
    return Boolean(membership);
  }

  app.get("/api/assignment-groups", requireAuth, requireModule("itsm"), async (req: any, res) => {
    try {
      if (!await canManageAssignmentGroups(req.user.id)) return assignmentGroupsForbidden(res);
      const includeInactive = req.query.includeInactive === "true";
      const groupRows = includeInactive
        ? await db.select().from(assignmentGroups).orderBy(asc(assignmentGroups.name))
        : await db.select().from(assignmentGroups).where(eq(assignmentGroups.active, true)).orderBy(asc(assignmentGroups.name));
      if (!groupRows.length) return res.json([]);
      const memberRows = await db.select({
        groupId: assignmentGroupMembers.groupId,
        id: users.id,
        username: users.username,
        firstName: users.firstName,
        lastName: users.lastName,
        email: users.email,
        isActive: users.isActive,
      }).from(assignmentGroupMembers)
        .innerJoin(users, eq(assignmentGroupMembers.userId, users.id))
        .where(inArray(assignmentGroupMembers.groupId, groupRows.map(group => group.id)))
        .orderBy(asc(users.firstName), asc(users.lastName));
      const membersByGroup = new Map<number, typeof memberRows>();
      for (const member of memberRows) {
        const members = membersByGroup.get(member.groupId) ?? [];
        members.push(member);
        membersByGroup.set(member.groupId, members);
      }
      res.json(groupRows.map(group => ({
        ...group,
        members: membersByGroup.get(group.id) ?? [],
      })));
    } catch (error) {
      respondWithApiError(res, error, "Failed to load assignment groups");
    }
  });

  app.get("/api/assignment-groups/eligible-users", requireAuth, requireModule("itsm"), async (req: any, res) => {
    try {
      if (!await canManageAssignmentGroups(req.user.id)) return assignmentGroupsForbidden(res);
      const rows = await db.select({
        id: users.id,
        username: users.username,
        firstName: users.firstName,
        lastName: users.lastName,
        email: users.email,
        roleName: roles.name,
      }).from(users)
        .innerJoin(userRoles, eq(userRoles.userId, users.id))
        .innerJoin(roles, eq(userRoles.roleId, roles.id))
        .where(eq(users.isActive, true))
        .orderBy(asc(users.firstName), asc(users.lastName));
      const eligible = new Map<string, { id: string; name: string; email: string }>();
      for (const row of rows) {
        if (!eligibleAssignmentRoles.has(row.roleName.trim().toLowerCase())) continue;
        eligible.set(row.id, {
          id: row.id,
          name: [row.firstName, row.lastName].filter(Boolean).join(" ") || row.username,
          email: row.email,
        });
      }
      for (const row of rows) {
        if (eligible.has(row.id)) continue;
        if ((await storage.getUserPermissions(row.id)).includes("system_admin")) {
          eligible.set(row.id, {
            id: row.id,
            name: [row.firstName, row.lastName].filter(Boolean).join(" ") || row.username,
            email: row.email,
          });
        }
      }
      res.json(Array.from(eligible.values()));
    } catch (error) {
      respondWithApiError(res, error, "Failed to load eligible assignment group members");
    }
  });

  app.post("/api/assignment-groups", requireAuth, requireModule("itsm"), async (req: any, res) => {
    try {
      if (!await canManageAssignmentGroups(req.user.id)) return assignmentGroupsForbidden(res);
      const group = insertAssignmentGroupSchema.parse(req.body);
      const [created] = await db.insert(assignmentGroups).values({
        name: group.name,
        description: group.description ?? null,
        active: group.active ?? true,
      }).returning();
      await logAudit(req.user.id, "CREATE", "assignment_groups", String(created.id), created.name, null, created, req);
      res.status(201).json({ ...created, members: [] });
    } catch (error) {
      if (error instanceof z.ZodError) return res.status(400).json({ message: "Invalid assignment group", errors: error.issues });
      if ((error as any)?.code === "23505") return res.status(409).json({ message: "An assignment group with this name already exists." });
      respondWithApiError(res, error, "Failed to create assignment group");
    }
  });

  app.put("/api/assignment-groups/:id", requireAuth, requireModule("itsm"), async (req: any, res) => {
    try {
      if (!await canManageAssignmentGroups(req.user.id)) return assignmentGroupsForbidden(res);
      const id = Number(req.params.id);
      if (!Number.isSafeInteger(id) || id < 1) return res.status(400).json({ message: "Invalid assignment group ID" });
      const input = z.object({
        name: z.string().trim().min(1).max(120).optional(),
        description: z.string().trim().max(2000).nullable().optional(),
        active: z.boolean().optional(),
      }).strict().refine(value => Object.keys(value).length > 0, { message: "Provide at least one field to update." }).parse(req.body);
      const [updated] = await db.update(assignmentGroups).set(input).where(eq(assignmentGroups.id, id)).returning();
      if (!updated) return res.status(404).json({ message: "Assignment group not found" });
      await logAudit(req.user.id, "UPDATE", "assignment_groups", String(id), updated.name, null, updated, req);
      res.json(updated);
    } catch (error) {
      if (error instanceof z.ZodError) return res.status(400).json({ message: "Invalid assignment group update", errors: error.issues });
      if ((error as any)?.code === "23505") return res.status(409).json({ message: "An assignment group with this name already exists." });
      respondWithApiError(res, error, "Failed to update assignment group");
    }
  });

  app.get("/api/assignment-groups/:id/members", requireAuth, requireModule("itsm"), async (req: any, res) => {
    try {
      if (!await canAccessAssignmentMembers(req.user.id)) return res.status(403).json({ message: "You do not have permission to view assignment group members." });
      const id = Number(req.params.id);
      if (!Number.isSafeInteger(id) || id < 1) return res.status(400).json({ message: "Invalid assignment group ID" });
      const [group] = await db.select({ id: assignmentGroups.id, active: assignmentGroups.active })
        .from(assignmentGroups).where(eq(assignmentGroups.id, id));
      if (!group || !group.active) return res.status(404).json({ message: "Active assignment group not found" });
      const rows = await db.select({
        id: users.id,
        username: users.username,
        firstName: users.firstName,
        lastName: users.lastName,
        email: users.email,
        isActive: users.isActive,
        roleName: roles.name,
      }).from(assignmentGroupMembers)
        .innerJoin(users, eq(assignmentGroupMembers.userId, users.id))
        .innerJoin(userRoles, eq(userRoles.userId, users.id))
        .innerJoin(roles, eq(userRoles.roleId, roles.id))
        .where(eq(assignmentGroupMembers.groupId, id))
        .orderBy(asc(users.firstName), asc(users.lastName));
      const members = new Map<string, { id: string; username: string; name: string; email: string; isActive: boolean | null }>();
      for (const row of rows) {
        const isEligible = eligibleAssignmentRoles.has(row.roleName.trim().toLowerCase()) ||
          (row.isActive === true && (await storage.getUserPermissions(row.id)).includes("system_admin"));
        if (row.isActive && isEligible) {
          members.set(row.id, {
            id: row.id,
            username: row.username,
            name: [row.firstName, row.lastName].filter(Boolean).join(" ") || row.username,
            email: row.email,
            isActive: row.isActive,
          });
        }
      }
      res.json(Array.from(members.values()));
    } catch (error) {
      respondWithApiError(res, error, "Failed to load assignment group members");
    }
  });

  app.post("/api/assignment-groups/:id/members", requireAuth, requireModule("itsm"), async (req: any, res) => {
    try {
      if (!await canManageAssignmentGroups(req.user.id)) return assignmentGroupsForbidden(res);
      const groupId = Number(req.params.id);
      const { userId } = insertGroupMemberSchema.pick({ userId: true }).parse(req.body);
      if (!Number.isSafeInteger(groupId) || groupId < 1) return res.status(400).json({ message: "Invalid assignment group ID" });
      const [group] = await db.select().from(assignmentGroups).where(and(eq(assignmentGroups.id, groupId), eq(assignmentGroups.active, true)));
      if (!group) return res.status(404).json({ message: "Active assignment group not found" });
      const eligibleRows = await db.select({ id: users.id, roleName: roles.name })
        .from(users)
        .innerJoin(userRoles, eq(userRoles.userId, users.id))
        .innerJoin(roles, eq(userRoles.roleId, roles.id))
        .where(and(eq(users.id, userId), eq(users.isActive, true)));
      const hasEligibleRole = eligibleRows.some(row => eligibleAssignmentRoles.has(row.roleName.trim().toLowerCase()));
      const hasSystemAdminPermission = eligibleRows.length > 0 &&
        (await storage.getUserPermissions(userId)).includes("system_admin");
      if (!hasEligibleRole && !hasSystemAdminPermission) {
        return res.status(400).json({ message: "Choose an active IT staff member, manager, or administrator." });
      }
      const [created] = await db.insert(assignmentGroupMembers)
        .values({ groupId, userId })
        .onConflictDoNothing()
        .returning();
      if (!created) return res.status(409).json({ message: "This user is already a member of the assignment group." });
      await logAudit(req.user.id, "CREATE", "assignment_group_members", String(created.id), `${group.name}: ${userId}`, null, created, req);
      res.status(201).json(created);
    } catch (error) {
      if (error instanceof z.ZodError) return res.status(400).json({ message: "Invalid group member", errors: error.issues });
      respondWithApiError(res, error, "Failed to add assignment group member");
    }
  });

  app.delete("/api/assignment-groups/:id/members/:userId", requireAuth, requireModule("itsm"), async (req: any, res) => {
    try {
      if (!await canManageAssignmentGroups(req.user.id)) return assignmentGroupsForbidden(res);
      const groupId = Number(req.params.id);
      if (!Number.isSafeInteger(groupId) || groupId < 1) return res.status(400).json({ message: "Invalid assignment group ID" });
      const [removed] = await db.delete(assignmentGroupMembers)
        .where(and(eq(assignmentGroupMembers.groupId, groupId), eq(assignmentGroupMembers.userId, req.params.userId)))
        .returning();
      if (!removed) return res.status(404).json({ message: "Assignment group member not found" });
      await logAudit(req.user.id, "DELETE", "assignment_group_members", String(removed.id), `${groupId}: ${req.params.userId}`, removed, null, req);
      res.status(204).end();
    } catch (error) {
      respondWithApiError(res, error, "Failed to remove assignment group member");
    }
  });

  // Keep legacy ticket data readable for history/reporting, but direct new
  // workflow writes to the dedicated incident and service-request endpoints.
  app.use("/api/tickets", (req, res, next) => {
    if (["POST", "PUT", "PATCH", "DELETE"].includes(req.method)) {
      return res.status(410).json({ message: "Legacy ticket writes are retired; use /api/incidents or /api/service-requests" });
    }
    next();
  });

  app.get("/api/tickets", requireAuth, requireModule('itsm'), async (req, res) => {
    try {
      const user = req.user as any;
      if (!(await canManageAllTickets(user.id))) {
        return res.status(403).json({ message: "Insufficient permissions" });
      }
      res.json(await storage.getTickets());
    } catch (error) {
      respondWithApiError(res, error, "Failed to fetch tickets");
    }
  });

  app.get("/api/tickets/my-assigned", requireAuth, requireModule('itsm'), async (req, res) => {
    try {
      const user = req.user as any;
      const all = await storage.getTickets();
      res.json(all.filter(ticket => ticket.assignedToId === user.id));
    } catch (error) {
      respondWithApiError(res, error, "Failed to fetch assigned tickets");
    }
  });

  app.get("/api/tickets/my-requests", requireAuth, requireModule('itsm'), async (req, res) => {
    try {
      const user = req.user as any;
      const all = await storage.getTickets();
      res.json(all.filter(ticket => ticket.requesterId === user.id));
    } catch (error) {
      respondWithApiError(res, error, "Failed to fetch your requests");
    }
  });

  app.post("/api/tickets/my-requests", requireAuth, requireModule('itsm'), async (req, res) => {
    try {
      const user = req.user as any;
      const {
        assignedToId: _assignedToId,
        requesterId: _requesterId,
        status: _status,
        priority: _priority,
        dueDate: _dueDate,
        resolutionCode: _resolutionCode,
        ...employeeFields
      } = req.body;
      const validatedData = insertTicketSchema.parse({ ...employeeFields, requesterId: user.id });
      const ticket = await storage.createTicket(validatedData);
      await logAudit(user.id, 'CREATE', 'tickets', ticket.id, ticket.title, null, ticket, req);
      res.status(201).json(ticket);
    } catch (error) {
      if (error instanceof z.ZodError) return res.status(400).json({ message: "Invalid ticket data", errors: error.issues });
      respondWithApiError(res, error, "Failed to create ticket");
    }
  });

  app.get("/api/tickets/:id", requireAuth, requireModule('itsm'), async (req, res) => {
    try {
      const user = req.user as any;
      const ticket = await storage.getTicket(req.params.id);
      if (!ticket) return res.status(404).json({ message: "Ticket not found" });
      const isOwner = ticket.requesterId === user.id || ticket.assignedToId === user.id;
      if (!isOwner && !(await canManageAllTickets(user.id))) {
        return res.status(403).json({ message: "Insufficient permissions" });
      }
      res.json(ticket);
    } catch (error) {
      respondWithApiError(res, error, "Failed to fetch ticket");
    }
  });

  app.post("/api/tickets", requireAuth, requireModule('itsm'), requirePermission('ticket_manage'), async (req, res) => {
    try {
      const user = req.user as any;
      const validatedData = insertTicketSchema.parse({ ...req.body, requesterId: user.id });
      const ticket = await storage.createTicket(validatedData);
      await logAudit(user.id, 'CREATE', 'tickets', ticket.id, ticket.title, null, ticket, req);
      res.status(201).json(ticket);
    } catch (error) {
      if (error instanceof z.ZodError) return res.status(400).json({ message: "Invalid ticket data", errors: error.issues });
      respondWithApiError(res, error, "Failed to create ticket");
    }
  });

  app.put("/api/tickets/:id", requireAuth, requireModule('itsm'), async (req, res) => {
    try {
      const user = req.user as any;
      const existing = await storage.getTicket(req.params.id);
      if (!existing) return res.status(404).json({ message: "Ticket not found" });

      const isManager = await canManageTicket(user.id);
      const isOwner = existing.requesterId === user.id;
      const isAssignedWorker = existing.assignedToId === user.id;
      if (!isManager && !isOwner && !isAssignedWorker) {
        return res.status(403).json({ message: "Insufficient permissions" });
      }

      let updatePayload = req.body;
      if (isAssignedWorker && !isManager) {
        const { status, resolutionCode } = req.body;
        updatePayload = { status, resolutionCode };
        if (status && !["open", "in_progress", "resolved", "closed"].includes(status)) {
          return res.status(400).json({ message: "Assigned users cannot set this ticket status" });
        }
      } else if (!isManager) {
        // Requesters without ticket_manage may only edit their own request content.
        // Priority and all workflow/assignment fields remain service-desk controlled.
        const { title, description, category } = req.body;
        updatePayload = { title, description, category };
      }

      const validatedData = insertTicketSchema.partial().parse(updatePayload);

      const willBeResolved = validatedData.status === "resolved" || validatedData.status === "closed";
      const wasResolved = existing.status === "resolved" || existing.status === "closed";
      if (willBeResolved && !wasResolved && !(validatedData.resolutionCode || existing.resolutionCode)) {
        return res.status(400).json({ message: "A resolution code is required to resolve this ticket" });
      }

      const ticket = await storage.updateTicket(req.params.id, validatedData);
      if (!ticket) return res.status(404).json({ message: "Ticket not found" });
      await logAudit(user.id, 'UPDATE', 'tickets', ticket.id, ticket.title, existing, ticket, req);
      res.json(ticket);
    } catch (error) {
      if (error instanceof z.ZodError) return res.status(400).json({ message: "Invalid ticket data", errors: error.issues });
      respondWithApiError(res, error, "Failed to update ticket");
    }
  });

  app.post("/api/tickets/:id/close-request", requireAuth, requireModule('itsm'), async (req, res) => {
    try {
      const user = req.user as any;
      const existing = await storage.getTicket(req.params.id);
      if (!existing) return res.status(404).json({ message: "Ticket not found" });
      if (existing.requesterId !== user.id) {
        return res.status(403).json({ message: "Only the requester can confirm closure" });
      }
      if (existing.status !== "resolved") {
        return res.status(400).json({ message: "Only a resolved ticket can be closed by the requester" });
      }
      const ticket = await storage.updateTicket(existing.id, { status: "closed" });
      if (!ticket) return res.status(404).json({ message: "Ticket not found" });
      await logAudit(user.id, 'UPDATE', 'tickets', ticket.id, ticket.title, existing, ticket, req);
      res.json(ticket);
    } catch (error) {
      respondWithApiError(res, error, "Failed to close ticket");
    }
  });

  app.post("/api/tickets/:id/cancel-request", requireAuth, requireModule('itsm'), async (req, res) => {
    try {
      const user = req.user as any;
      const existing = await storage.getTicket(req.params.id);
      if (!existing) return res.status(404).json({ message: "Ticket not found" });
      if (existing.requesterId !== user.id) {
        return res.status(403).json({ message: "Only the requester can cancel this ticket" });
      }
      if (!["open", "in_progress", "resolved"].includes(existing.status)) {
        return res.status(400).json({ message: "Only an active request can be cancelled" });
      }
      const { reason } = z.object({ reason: z.string().trim().max(2000).optional() }).parse(req.body ?? {});
      const ticket = await storage.cancelTicketForRequester(existing.id, {
        ticketId: existing.id,
        authorId: user.id,
        message: reason ? `Request cancelled by requester: ${reason}` : "Request cancelled by requester.",
        isInternal: false,
      });
      if (!ticket) return res.status(409).json({ message: "The request status changed. Refresh and try again." });
      await logAudit(user.id, 'UPDATE', 'tickets', ticket.id, ticket.title, existing, ticket, req);
      res.json(ticket);
    } catch (error) {
      if (error instanceof z.ZodError) return res.status(400).json({ message: "Cancellation reason cannot exceed 2000 characters", errors: error.issues });
      respondWithApiError(res, error, "Failed to cancel request");
    }
  });

  app.post("/api/tickets/:id/reopen-request", requireAuth, requireModule('itsm'), async (req, res) => {
    try {
      const user = req.user as any;
      const existing = await storage.getTicket(req.params.id);
      if (!existing) return res.status(404).json({ message: "Ticket not found" });
      if (existing.requesterId !== user.id) {
        return res.status(403).json({ message: "Only the requester can reopen this ticket" });
      }
      if (!["resolved", "closed"].includes(existing.status)) {
        return res.status(400).json({ message: "Only a resolved or closed ticket can be reopened" });
      }
      const { reason } = z.object({ reason: z.string().trim().min(5).max(2000) }).parse(req.body);
      const ticket = await storage.updateTicket(existing.id, { status: "open" });
      if (!ticket) return res.status(404).json({ message: "Ticket not found" });
      await storage.createTicketComment({
        ticketId: existing.id,
        authorId: user.id,
        message: `Reopened by requester: ${reason}`,
        isInternal: false,
      });
      await logAudit(user.id, 'UPDATE', 'tickets', ticket.id, ticket.title, existing, ticket, req);
      res.json(ticket);
    } catch (error) {
      if (error instanceof z.ZodError) return res.status(400).json({ message: "A reopen reason of at least 5 characters is required", errors: error.issues });
      respondWithApiError(res, error, "Failed to reopen ticket");
    }
  });

  app.delete("/api/tickets/:id", requireAuth, requireModule('itsm'), requirePermission('ticket_manage'), async (req, res) => {
    try {
      const user = req.user as any;
      const existing = await storage.getTicket(req.params.id);
      if (!existing) return res.status(404).json({ message: "Ticket not found" });
      const deleted = await storage.deleteTicket(req.params.id);
      if (deleted) await logAudit(user.id, 'DELETE', 'tickets', existing.id, existing.title, existing, null, req);
      res.json({ success: deleted });
    } catch (error) {
      respondWithApiError(res, error, "Failed to delete ticket");
    }
  });

  app.get("/api/tickets/:id/comments", requireAuth, requireModule('itsm'), async (req, res) => {
    try {
      const user = req.user as any;
      const ticket = await storage.getTicket(req.params.id);
      if (!ticket) return res.status(404).json({ message: "Ticket not found" });
      const isOwner = ticket.requesterId === user.id || ticket.assignedToId === user.id;
      if (!isOwner && !(await canManageAllTickets(user.id))) {
        return res.status(403).json({ message: "Insufficient permissions" });
      }
      const canViewInternal = await canManageAllTickets(user.id) || ticket.assignedToId === user.id;
      const comments = await storage.getTicketComments(req.params.id);
      res.json(canViewInternal ? comments : comments.filter(comment => !comment.isInternal));
    } catch (error) {
      respondWithApiError(res, error, "Failed to fetch comments");
    }
  });

  app.post("/api/tickets/:id/comments", requireAuth, requireModule('itsm'), async (req, res) => {
    try {
      const user = req.user as any;
      const ticket = await storage.getTicket(req.params.id);
      if (!ticket) return res.status(404).json({ message: "Ticket not found" });
      const isOwner = ticket.requesterId === user.id || ticket.assignedToId === user.id;
      if (!isOwner && !(await canManageAllTickets(user.id))) {
        return res.status(403).json({ message: "Insufficient permissions" });
      }
      const canPostInternal = await canManageTicket(user.id) || ticket.assignedToId === user.id;
      // Assigned technicians and managers may write internal notes; requesters cannot.
      const isInternal = canPostInternal && req.body.isInternal === true;
      const validatedData = insertTicketCommentSchema.parse({ ticketId: req.params.id, authorId: user.id, message: req.body.message, isInternal });
      const comment = await storage.createTicketComment(validatedData);
      await logAudit(user.id, 'CREATE', 'ticket_comments', comment.id, `Comment on ${ticket.ticketNumber}`, null, comment, req);
      res.status(201).json(comment);
    } catch (error) {
      if (error instanceof z.ZodError) return res.status(400).json({ message: "Invalid comment data", errors: error.issues });
      respondWithApiError(res, error, "Failed to create comment");
    }
  });

  app.get("/api/reports/tickets", requireAuth, requireModule('itsm'), requirePermission('ticket_view_all'), async (req, res) => {
    try {
      const tickets = await storage.getTickets();
      res.json(tickets);
    } catch (error) {
      respondWithApiError(res, error, "Failed to fetch ticket report data");
    }
  });

  app.get("/api/asset-requests/:id", requireAuth, async (req, res) => {
    try {
      const request = await storage.getAssetRequest(req.params.id);
      if (!request) return res.status(404).json({ message: "Request not found" });
      res.json(request);
    } catch (error) {
      respondWithApiError(res, error, "Failed to fetch request");
    }
  });

  app.put("/api/asset-requests/:id", requireAuth, async (req, res) => {
    try {
      const validatedData = insertAssetRequestSchema.partial().parse(req.body);
      const oldRequest = await storage.getAssetRequest(req.params.id);
      const request = await storage.updateAssetRequest(req.params.id, validatedData);
      if (!request) return res.status(404).json({ message: "Request not found" });
      await logAudit(req.user?.id, 'UPDATE', 'asset_requests', request.id, `Request for ${request.assetType}`, oldRequest, request, req);
      res.json(request);
    } catch (error) {
      if (error instanceof z.ZodError) return res.status(400).json({ message: "Invalid request data", errors: error.issues });
      respondWithApiError(res, error, "Failed to update request");
    }
  });

  app.post("/api/asset-requests/:id/approve", requireAuth, requirePermission('system_admin'), async (req, res) => {
    try {
      const request = await storage.updateAssetRequest(req.params.id, {
        status: 'approved',
        reviewedBy: req.user?.id,
        reviewedAt: new Date()
      });
      if (!request) return res.status(404).json({ message: "Request not found" });
      res.json(request);
    } catch (error) {
      respondWithApiError(res, error, "Failed to approve request");
    }
  });

  app.post("/api/asset-requests/:id/reject", requireAuth, requirePermission('system_admin'), async (req, res) => {
    try {
      const { reason } = req.body;
      const request = await storage.updateAssetRequest(req.params.id, {
        status: 'rejected',
        reviewedBy: req.user?.id,
        reviewedAt: new Date(),
        reviewNotes: reason
      });
      if (!request) return res.status(404).json({ message: "Request not found" });
      res.json(request);
    } catch (error) {
      respondWithApiError(res, error, "Failed to reject request");
    }
  });

  app.post("/api/asset-requests/:id/fulfill", requireAuth, requirePermission('system_admin'), async (req, res) => {
    try {
      const { assetId } = req.body;
      const request = await storage.updateAssetRequest(req.params.id, {
        status: 'fulfilled',
        assignedAssetId: assetId
      });
      if (!request) return res.status(404).json({ message: "Request not found" });
      res.json(request);
    } catch (error) {
      respondWithApiError(res, error, "Failed to fulfill request");
    }
  });

  // Verify current user's password (used for admin override flows)
  app.post("/api/auth/verify-password", requireAuth, async (req, res) => {
    try {
      const { password } = req.body;
      if (!password) return res.status(400).json({ message: "Password is required" });
      const { comparePasswords } = await import("./auth");
      const user = await storage.getUser((req.user as any).id);
      if (!user) return res.status(404).json({ message: "User not found" });
      const valid = await comparePasswords(password, user.password);
      if (!valid) return res.status(401).json({ message: "Incorrect password" });
      res.json({ success: true });
    } catch (error) {
      respondWithApiError(res, error, "Failed to verify password");
    }
  });

  // 2FA Auth Routes
  app.post("/api/auth/2fa/setup", requireAuth, async (req, res) => {
    try {
      const speakeasy = await import("speakeasy");
      const QRCode = await import("qrcode");
      
      const secret = speakeasy.default.generateSecret({
        name: `ITAM:${req.user?.username}`,
      });

      const qrCodeUrl = await QRCode.default.toDataURL(secret.otpauth_url!);
      
      res.json({ secret: secret.base32, qrCodeUrl });
    } catch (error) {
      respondWithApiError(res, error, "Failed to setup 2FA");
    }
  });

  app.post("/api/auth/2fa/enable", requireAuth, async (req, res) => {
    try {
      const { secret, token } = req.body;
      const speakeasy = await import("speakeasy");
      
      const verified = speakeasy.default.totp.verify({
        secret,
        encoding: 'base32',
        token,
      });

      if (!verified) {
        return res.status(400).json({ message: "Invalid verification token" });
      }

      await storage.updateUser2FA(req.user!.id, secret, true);
      res.json({ message: "2FA enabled successfully" });
    } catch (error) {
      respondWithApiError(res, error, "Failed to enable 2FA");
    }
  });

  app.post("/api/auth/2fa/disable", requireAuth, async (req, res) => {
    try {
      await storage.updateUser2FA(req.user!.id, null, false);
      res.json({ message: "2FA disabled successfully" });
    } catch (error) {
      respondWithApiError(res, error, "Failed to disable 2FA");
    }
  });

  app.post("/api/auth/2fa/verify", async (req, res) => {
    try {
      const { userId, token } = req.body;
      const user = await storage.getUserById(userId);
      
      if (!user || !user.twoFactorEnabled || !user.twoFactorSecret) {
        return res.status(400).json({ message: "2FA not enabled for this user" });
      }

      const speakeasy = await import("speakeasy");
      const verified = speakeasy.default.totp.verify({
        secret: user.twoFactorSecret,
        encoding: 'base32',
        token,
      });

      if (!verified) {
        return res.status(400).json({ message: "Invalid verification token" });
      }

      res.json({ message: "2FA verified successfully" });
    } catch (error) {
      respondWithApiError(res, error, "Failed to verify 2FA");
    }
  });

  // User-Role assignment routes
  app.post("/api/users/:userId/roles", requireAuth, requirePermission('user_role_assign'), async (req, res) => {
    try {
      const validatedData = insertUserRoleSchema.parse({
        ...req.body,
        userId: req.params.userId
      });
      
      const userRole = await storage.assignUserRole(
        validatedData.userId, 
        validatedData.roleId, 
        req.user?.id
      );
      res.status(201).json(userRole);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid role assignment data", errors: error.issues });
      }
      respondWithApiError(res, error, "Failed to assign role to user");
    }
  });

  app.delete("/api/users/:userId/roles/:roleId", requireAuth, requirePermission('user_role_assign'), async (req, res) => {
    try {
      const removed = await storage.removeUserRole(req.params.userId, req.params.roleId);
      if (!removed) {
        return res.status(404).json({ message: "User role assignment not found" });
      }
      res.status(204).send();
    } catch (error) {
      respondWithApiError(res, error, "Failed to remove role from user");
    }
  });

  // Get user's roles and permissions
  app.get("/api/users/:id/roles", requireAuth, requirePermission('user_view'), async (req, res) => {
    try {
      const roles = await storage.getUserRoles(req.params.id);
      res.json(roles);
    } catch (error) {
      respondWithApiError(res, error, "Failed to fetch user roles");
    }
  });

  app.get("/api/users/:id/permissions", requireAuth, requirePermission('user_view'), async (req, res) => {
    try {
      const permissions = await storage.getUserPermissions(req.params.id);
      res.json(permissions);
    } catch (error) {
      respondWithApiError(res, error, "Failed to fetch user permissions");
    }
  });

  // System settings routes - for Asset ID configuration and data management
  app.get("/api/system-settings", requireAuth, requirePermission('system_admin'), async (req, res) => {
    try {
      const allSettings = await storage.getSystemSettings();
      
      // Convert to the format expected by frontend
      const settings = {
        assetIdPrefix: allSettings.find(s => s.key === 'asset_id_prefix')?.value || "AST",
        assetIdStartingNumber: parseInt(allSettings.find(s => s.key === 'asset_id_starting_number')?.value || "1000"),
        dateFormat: "DD-MM-YYYY"
      };
      
      res.json(settings);
    } catch (error) {
      respondWithApiError(res, error, "Failed to fetch system settings");
    }
  });

  app.put("/api/system-settings", requireAuth, requirePermission('system_admin'), async (req, res) => {
    try {
      const validatedData = z.object({
        assetIdPrefix: z.string().min(1).max(10),
        assetIdStartingNumber: z.number().int().min(1),
        dateFormat: z.literal("DD-MM-YYYY")
      }).parse(req.body);
      
      const userId = (req.user as any)?.id;
      
      // Update each setting in storage
      await storage.updateSystemSetting('asset_id_prefix', validatedData.assetIdPrefix, userId);
      await storage.updateSystemSetting('asset_id_starting_number', validatedData.assetIdStartingNumber.toString(), userId);
      await storage.updateSystemSetting('date_format', validatedData.dateFormat, userId);
      
      res.json(validatedData);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid system settings", errors: error.issues });
      }
      respondWithApiError(res, error, "Failed to update system settings");
    }
  });

  app.get("/api/system/version", async (_req, res) => {
    try {
      const modules = await storage.getModuleSettings();
      const buildTimestamp = process.env.BUILD_TIMESTAMP ?? new Date().toISOString();
      res.json({
        version: APP_VERSION,
        buildTimestamp,
        activeModules: modules.filter((module) => module.enabled).map((module) => module.moduleKey),
      });
    } catch (error) {
      respondWithApiError(res, error, "Failed to fetch system version");
    }
  });

  app.get("/api/system/update-check", requireAuth, requirePermission("system_admin"), async (_req, res) => {
    const latestVersion = process.env.UPDATE_AVAILABLE_VERSION?.trim() || null;
    try {
      const updateAvailable = latestVersion
        ? compareAppVersions(latestVersion, APP_VERSION) > 0
        : false;
      res.json({
        currentVersion: APP_VERSION,
        latestVersion,
        updateAvailable,
        checkedAt: new Date().toISOString(),
        sourceConfigured: latestVersion !== null,
      });
    } catch (error) {
      respondWithApiError(res, error, "Configured update version is invalid");
    }
  });

  // System status route - check if system is initialized
  app.get("/api/system/status", async (req, res) => {
    try {
      const users = await storage.getUsers();
      const isInitialized = users.length > 0;
      
      res.json({
        initialized: isInitialized,
        userCount: users.length,
        needsSetup: !isInitialized
      });
    } catch (error) {
      console.error("Error checking system status:", error);
      respondWithApiError(res, error, "Failed to check system status");
    }
  });

  // One-time bootstrap for an empty installation. Credentials are supplied by
  // the operator and a PostgreSQL advisory lock prevents parallel first-user
  // requests from creating multiple bootstrap administrators.
  app.post("/api/system/seed-data", rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 5,
    standardHeaders: true,
    legacyHeaders: false,
    message: { message: "Too many initialization attempts. Please try again later." },
  }), async (req, res) => {
    const bootstrapSchema = z.object({
      username: z.string().trim().min(3).max(64).regex(/^[a-zA-Z0-9._-]+$/, "Use letters, numbers, dots, underscores, or hyphens for the username."),
      email: z.string().trim().email().max(254),
      firstName: z.string().trim().min(1).max(100),
      lastName: z.string().trim().min(1).max(100),
      password: z.string().min(12, "Use a password of at least 12 characters.")
        .max(256)
        .regex(/[a-z]/, "Include a lowercase letter.")
        .regex(/[A-Z]/, "Include an uppercase letter.")
        .regex(/[0-9]/, "Include a number.")
        .regex(/[^A-Za-z0-9]/, "Include a symbol."),
    });
    const parsedBootstrap = bootstrapSchema.safeParse(req.body);
    if (!parsedBootstrap.success) {
      return res.status(400).json({
        message: parsedBootstrap.error.issues[0]?.message ?? "Enter valid administrator details.",
      });
    }

    let bootstrapClient: PoolClient | undefined;
    let bootstrapLockAcquired = false;
    try {
      bootstrapClient = await pool.connect();
      await bootstrapClient.query("SELECT pg_advisory_lock($1)", [73421091]);
      bootstrapLockAcquired = true;

      // Re-check after acquiring the lock; the endpoint disables itself once
      // any account has been created.
      const existingUsers = await storage.getUsers();
      if (existingUsers.length > 0) {
        return res.status(409).json({ message: "System is already initialized." });
      }
      const bootstrapAdmin = parsedBootstrap.data;

      // Define all permissions used in the system
      const permissions = [
        // User Management Permissions
        { name: 'user_view', description: 'View users and user details', resource: 'users', action: 'view' },
        { name: 'user_create', description: 'Create new users', resource: 'users', action: 'create' },
        { name: 'user_update', description: 'Update existing users', resource: 'users', action: 'update' },
        { name: 'user_delete', description: 'Delete users', resource: 'users', action: 'delete' },
        { name: 'role_view', description: 'View roles and role details', resource: 'roles', action: 'view' },
        { name: 'role_create', description: 'Create new roles', resource: 'roles', action: 'create' },
        { name: 'role_update', description: 'Update existing roles', resource: 'roles', action: 'update' },
        { name: 'role_delete', description: 'Delete roles', resource: 'roles', action: 'delete' },
        { name: 'permission_view', description: 'View permissions', resource: 'permissions', action: 'view' },
        { name: 'user_role_assign', description: 'Assign roles to users', resource: 'users', action: 'manage' },
        { name: 'system_admin', description: 'System administration access', resource: 'system', action: 'manage' },
        
        // Asset Management Permissions
        { name: 'asset_create', description: 'Create new assets', resource: 'assets', action: 'create' },
        { name: 'asset_view', description: 'View the asset inventory', resource: 'assets', action: 'view' },
        { name: 'my_assets_view', description: 'View assets assigned to the signed-in employee', resource: 'assets', action: 'view_own' },
        { name: 'asset_update', description: 'Update existing assets', resource: 'assets', action: 'update' },
        { name: 'asset_delete', description: 'Delete assets', resource: 'assets', action: 'delete' },
        { name: 'compliance_view', description: 'View compliance information', resource: 'assets', action: 'view' },
        
        // Employee Management Permissions
        { name: 'employee_create', description: 'Create new employees', resource: 'employees', action: 'create' },
        { name: 'employee_update', description: 'Update existing employees', resource: 'employees', action: 'update' },
        { name: 'employee_delete', description: 'Delete employees', resource: 'employees', action: 'delete' },
        
        // Assignment Management Permissions
        { name: 'assignment_create', description: 'Create asset assignments', resource: 'assignments', action: 'create' },
        { name: 'assignment_update', description: 'Update asset assignments', resource: 'assignments', action: 'update' },
        { name: 'assignment_delete', description: 'Delete asset assignments', resource: 'assignments', action: 'delete' },
        { name: 'assignment_return', description: 'Process asset returns', resource: 'assignments', action: 'manage' },
        
        // Location Management Permissions
        { name: 'location_create', description: 'Create new locations', resource: 'locations', action: 'create' },
        { name: 'location_update', description: 'Update existing locations', resource: 'locations', action: 'update' },
        { name: 'location_delete', description: 'Delete locations', resource: 'locations', action: 'delete' },
        
        // Department Management Permissions
        { name: 'department_create', description: 'Create new departments', resource: 'departments', action: 'create' },
        { name: 'department_update', description: 'Update existing departments', resource: 'departments', action: 'update' },
        { name: 'department_delete', description: 'Delete departments', resource: 'departments', action: 'delete' },
        
        // Vendor Management Permissions
        { name: 'vendor_create', description: 'Create new vendors', resource: 'vendors', action: 'create' },
        { name: 'vendor_update', description: 'Update existing vendors', resource: 'vendors', action: 'update' },
        { name: 'vendor_delete', description: 'Delete vendors', resource: 'vendors', action: 'delete' },
        
        // Purchase Order Permissions
        { name: 'purchase_order_create', description: 'Create purchase orders', resource: 'purchase_orders', action: 'create' },
        { name: 'purchase_order_update', description: 'Update existing purchase orders', resource: 'purchase_orders', action: 'update' },
        { name: 'purchase_order_delete', description: 'Delete purchase orders', resource: 'purchase_orders', action: 'delete' },
        
        // Budget Management Permissions
        { name: 'budget_create', description: 'Create new budgets', resource: 'budgets', action: 'create' },
        { name: 'budget_update', description: 'Update existing budgets', resource: 'budgets', action: 'update' },
        { name: 'budget_delete', description: 'Delete budgets', resource: 'budgets', action: 'delete' },
        
        // Maintenance Management Permissions
        { name: 'maintenance_create', description: 'Create maintenance schedules and records', resource: 'maintenance', action: 'create' },
        { name: 'maintenance_update', description: 'Update maintenance schedules and records', resource: 'maintenance', action: 'update' },
        { name: 'maintenance_delete', description: 'Delete maintenance schedules and records', resource: 'maintenance', action: 'delete' },
        { name: 'access_governance_view', description: 'View access governance records without changing them', resource: 'access_governance', action: 'view' },
        { name: 'audit_view', description: 'View system audit records', resource: 'audit_logs', action: 'view' },
        { name: 'cmdb_view', description: 'View application and server configuration records', resource: 'cmdb', action: 'view' },
        { name: 'finance_view', description: 'View financial management records', resource: 'finance', action: 'view' },
        { name: 'offboarding_approve', description: 'Review and complete employee offboarding clearance', resource: 'employees', action: 'approve_offboarding' },
        { name: 'change_view_all', description: 'View all change requests and CAB impact summaries', resource: 'changes', action: 'view' },
        { name: 'change_approve', description: 'Approve or reject assigned change requests', resource: 'changes', action: 'approve' },
        { name: 'change_manage', description: 'Manage change requests and CAB assignments', resource: 'changes', action: 'manage' },
      ];

      // Create all permissions
      const createdPermissions = new Map();
      const permissionList = Array.from(permissions);
      const existingPermissionMap = new Map((await storage.getPermissions()).map(permission => [permission.name, permission]));
      for (const permissionData of permissionList) {
        const permission = existingPermissionMap.get(permissionData.name) ?? await storage.createPermission(permissionData);
        createdPermissions.set(permissionData.name, permission);
      }

      // Define default roles
      const roles = [
        {
          name: 'system_admin',
          description: 'Full system access with all permissions',
          isSystemRole: true,
          permissions: Array.from(createdPermissions.values()).map(p => p.id), // All permissions
        },
        {
          name: 'it_manager',
          description: 'IT operations management with most permissions except user management',
          isSystemRole: true,
          permissions: [
            'asset_view', 'asset_create', 'asset_update', 'asset_delete', 'compliance_view',
            'employee_create', 'employee_update', 'employee_delete',
            'assignment_create', 'assignment_update', 'assignment_delete', 'assignment_return',
            'location_create', 'location_update', 'location_delete',
            'department_create', 'department_update', 'department_delete',
            'vendor_create', 'vendor_update', 'vendor_delete',
            'purchase_order_create', 'purchase_order_update', 'purchase_order_delete',
            'budget_create', 'budget_update', 'budget_delete',
            'maintenance_create', 'maintenance_update', 'maintenance_delete'
          ].map(name => createdPermissions.get(name).id),
        },
        {
          name: 'asset_manager',
          description: 'Asset and assignment management',
          isSystemRole: true,
          permissions: [
            'asset_view', 'asset_create', 'asset_update', 'compliance_view',
            'employee_create', 'employee_update',
            'assignment_create', 'assignment_update', 'assignment_return',
            'location_create', 'location_update',
            'department_create', 'department_update',
            'maintenance_create', 'maintenance_update'
          ].map(name => createdPermissions.get(name).id),
        },
        {
          name: 'read_only_user',
          description: 'View-only access to system data',
          isSystemRole: true,
          permissions: [
            'compliance_view'
          ].map(name => createdPermissions.get(name).id),
        },
      ];

      // Create roles and assign permissions
      const createdRoles = new Map();
      const currentRoles = await storage.getRolesWithDetails();
      for (const roleData of roles) {
        const { permissions: permissionIds, ...roleInfo } = roleData;
        const existingRole = currentRoles.find(existing => existing.name === roleInfo.name);
        const role = existingRole ??
          await storage.createRole(roleInfo);
        createdRoles.set(roleData.name, role);

        // Assign permissions to role
        const currentPermissionIds = new Set((existingRole?.permissions ?? []).map(permission => permission.id));
        for (const permissionId of permissionIds) {
          if (!currentPermissionIds.has(permissionId)) {
            await storage.assignRolePermission(role.id, permissionId);
          }
        }
      }

      // Create the administrator account chosen during first-run setup.
      const adminPasswordHash = await hashPassword(bootstrapAdmin.password);
      const adminUser = await storage.createUser({
        username: bootstrapAdmin.username,
        email: bootstrapAdmin.email,
        password: adminPasswordHash,
        firstName: bootstrapAdmin.firstName,
        lastName: bootstrapAdmin.lastName,
        isActive: true,
      });

      // Assign System Administrator role to admin user
      const adminRole = createdRoles.get('system_admin');
      await storage.assignUserRole(adminUser.id, adminRole.id);

      // The persona roles were provisioned before the initial seed data existed.
      // Re-run the idempotent grant routine now that base permissions and roles exist.
      await ensurePersonaRoles();

      // Create default system settings
      await storage.createSystemSetting({
        key: 'asset_id_prefix',
        value: 'AST',
        description: 'Default prefix for asset IDs',
        category: 'asset_management',
      });

      await storage.createSystemSetting({
        key: 'asset_id_starting_number',
        value: '1000',
        description: 'Starting number for asset ID sequences',
        category: 'asset_management',
      });

      await storage.createSystemSetting({
        key: 'date_format',
        value: 'DD-MM-YYYY',
        description: 'Default date format used throughout the application',
        category: 'system',
      });

      // Log successful seed data creation
      console.log(`Seed data created successfully at ${new Date().toISOString()}`);
      console.log(`- ${permissions.length} permissions created`);
      console.log(`- ${roles.length} roles created`);
      console.log("- 1 operator-configured administrator account created");
      console.log(`- 3 system settings created`);

      res.json({
        message: "Seed data created successfully",
        summary: {
          permissions: permissions.length,
          roles: roles.length,
          users: 1,
          systemSettings: 3,
          adminCredentials: {
            username: adminUser.username,
            email: adminUser.email,
          }
        },
        createdAt: new Date().toISOString()
      });
    } catch (error) {
      console.error("Error creating seed data:", error);
      respondWithApiError(res, error, "Failed to initialize system");
    } finally {
      if (bootstrapClient) {
        if (bootstrapLockAcquired) {
          await bootstrapClient.query("SELECT pg_advisory_unlock($1)", [73421091]).catch(() => {});
        }
        bootstrapClient.release();
      }
    }
  });

  // Data management routes - for clearing system data
  registerSystemClearDataRoute(
    app, requireAuth, requirePermission("system_admin"), storage,
    async (supplied, stored) => (await import("./auth")).comparePasswords(supplied, stored),
  );

  // --------------------
  // EXISTING ROUTES
  // --------------------

  // Assets routes - all require authentication
  app.get("/api/my/assets", requireAuth, async (req: any, res) => {
    try {
      const hasAssetViewPermission = req.user?.permissions?.includes("my_assets_view") ||
        req.user?.permissions?.includes("system_admin");
      if (!hasAssetViewPermission && !req.user?.employeeId) {
        return res.status(403).json({ message: "Link this account to an employee profile to view assigned assets." });
      }
      if (req.user?.employeeId) {
        const [employee] = await db.select({ id: employees.id })
          .from(employees)
          .where(eq(employees.id, req.user.employeeId))
          .limit(1);
        if (!employee) return res.json([]);
        const assignedAssets = await db.select({
          assignmentId: assignments.id,
          assignedDate: assignments.assignedDate,
          assetId: assets.id,
          assetTag: assets.assetTag,
          name: assets.name,
          type: assets.type,
          model: assets.model,
          serialNumber: assets.serialNumber,
          status: assets.status,
        })
          .from(assignments)
          .innerJoin(assets, eq(assets.id, assignments.assetId))
          .where(and(eq(assignments.employeeId, employee.id), isNull(assignments.returnedDate)))
          .orderBy(desc(assignments.assignedDate), asc(assets.name));
        return res.json(assignedAssets);
      }
      const userEmail = req.user?.email;
      if (!userEmail) return res.json([]);
      const [employee] = await db.select({ id: employees.id })
        .from(employees)
        .where(sql`lower(${employees.email}) = lower(${userEmail})`)
        .limit(1);
      if (!employee) return res.json([]);

      const assignedAssets = await db.select({
        assignmentId: assignments.id,
        assignedDate: assignments.assignedDate,
        assetId: assets.id,
        assetTag: assets.assetTag,
        name: assets.name,
        type: assets.type,
        model: assets.model,
        serialNumber: assets.serialNumber,
        status: assets.status,
      })
        .from(assignments)
        .innerJoin(assets, eq(assets.id, assignments.assetId))
        .where(and(eq(assignments.employeeId, employee.id), isNull(assignments.returnedDate)))
        .orderBy(desc(assignments.assignedDate), asc(assets.name));
      res.json(assignedAssets);
    } catch (error) {
      console.error("Failed to load assigned assets for current user:", error);
      respondWithApiError(res, error, "Failed to load your assigned assets");
    }
  });

  app.get("/api/assets", requireAuth, requireModule('asset_management'), requireAnyPermission("asset_view", "asset_update", "asset_create", "assignment_create", "assignment_update", "maintenance_create", "maintenance_update", "compliance_view", "system_admin"), async (req, res) => {
    try {
      const assets = await storage.getAssetsWithAssignments();
      const linked = assets.length ? await db.select({
        id: contracts.id, name: contracts.name, assetId: contracts.assetId, endDate: contracts.endDate,
      }).from(contracts).where(inArray(contracts.assetId, assets.map(asset => asset.id))) : [];
      const slaLinks = assets.length ? await db.select({
        id: contracts.id, name: contracts.name, assetId: vendorContractAssets.assetId, endDate: contracts.endDate,
      }).from(vendorContractAssets).innerJoin(contracts, eq(contracts.id, vendorContractAssets.contractId))
        .where(and(inArray(vendorContractAssets.assetId, assets.map(asset => asset.id)), sql`${contracts.status} <> 'terminated'`)) : [];
      res.json(assets.map(asset => ({ ...asset, linkedContracts: Array.from(new Map(
        [...linked, ...slaLinks].filter(contract => contract.assetId === asset.id).map(contract => [contract.id, contract]),
      ).values()) })));
    } catch (error) {
      respondWithApiError(res, error, "Failed to fetch assets");
    }
  });

  app.get("/api/assets/:id", requireAuth, requireAnyPermission("asset_view", "asset_update", "asset_create", "assignment_create", "assignment_update", "maintenance_create", "maintenance_update", "compliance_view", "system_admin"), async (req, res) => {
    try {
      const asset = await storage.getAsset(req.params.id);
      if (!asset) {
        return res.status(404).json({ message: "Asset not found" });
      }
      const linkedContracts = await db.select({
        id: contracts.id, name: contracts.name, endDate: contracts.endDate,
      }).from(contracts).where(eq(contracts.assetId, asset.id));
      const slaLinks = await db.select({ id: contracts.id, name: contracts.name, endDate: contracts.endDate })
        .from(vendorContractAssets).innerJoin(contracts, eq(contracts.id, vendorContractAssets.contractId))
        .where(and(eq(vendorContractAssets.assetId, asset.id), sql`${contracts.status} <> 'terminated'`));
      res.json({ ...asset, linkedContracts: Array.from(new Map([...linkedContracts, ...slaLinks].map(contract => [contract.id, contract])).values()) });
    } catch (error) {
      respondWithApiError(res, error, "Failed to fetch asset");
    }
  });

  app.post("/api/assets", requireAuth, requireModule('asset_management'), requirePermission('asset_create'), async (req, res) => {
    try {
      const validatedData = insertAssetSchema.parse(req.body);
      
      // Check asset ID generation mode and validate/generate accordingly
      const assetIdModeSetting = await storage.getSetting('asset_id_generation_mode');
      const assetIdMode = assetIdModeSetting?.value || 'manual';
      
      if (assetIdMode === 'manual') {
        // Manual mode: Require Asset ID
        if (!validatedData.assetTag || validatedData.assetTag.trim() === '') {
          return res.status(400).json({ 
            message: "Asset ID is required when manual mode is enabled",
            errors: [{ path: ['assetTag'], message: 'Asset ID is required in manual mode' }]
          });
        }
      } else {
        // Auto mode: ALWAYS generate Asset ID server-side using atomic counter (ignore any client-provided value)
        const nextNumber = await storage.getNextAssetIdNumber();
        validatedData.assetTag = `ASSET-${nextNumber.toString().padStart(4, '0')}`;
      }
      
      const asset = await storage.createAsset(validatedData);
      
      // Log audit - use validatedData to ensure all submitted fields are captured
      const recordName = validatedData.serialNumber || validatedData.assetTag || validatedData.name || asset.id;
      await logAudit(req.user?.id, 'CREATE', 'assets', asset.id, recordName, null, { name: validatedData.name, serialNumber: validatedData.serialNumber, assetTag: validatedData.assetTag, type: validatedData.type, status: validatedData.status || 'available' }, req);
      
      res.status(201).json(asset);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid asset data", errors: error.issues });
      }
      if (error?.code === "23505") {
        return res.status(409).json({ message: "Asset ID already in use. Please choose a different Asset ID." });
      }
      console.error("Asset creation error:", error);
      respondWithApiError(res, error, "Failed to create asset");
    }
  });

  app.put("/api/assets/:id", requireAuth, requirePermission('asset_update'), async (req, res) => {
    try {
      const validatedData = insertAssetSchema.partial().parse(req.body);
      
      // Check asset ID generation mode and validate accordingly
      if (validatedData.assetTag !== undefined) {
        const assetIdModeSetting = await storage.getSetting('asset_id_generation_mode');
        const assetIdMode = assetIdModeSetting?.value || 'manual';
        
        if (assetIdMode === 'manual') {
          // Manual mode: Require Asset ID if being updated
          if (!validatedData.assetTag || validatedData.assetTag.trim() === '') {
            return res.status(400).json({ 
              message: "Asset ID is required when manual mode is enabled",
              errors: [{ path: ['assetTag'], message: 'Asset ID is required in manual mode' }]
            });
          }
        } else {
          // Auto mode: Ignore any client-provided assetTag updates (server owns IDs)
          delete validatedData.assetTag;
        }
      }
      
      // Get old asset for audit log
      const oldAsset = await storage.getAsset(req.params.id);
      
      const asset = await updateAssetWithLicenseChecks(req.params.id, validatedData);
      if (!asset) {
        return res.status(404).json({ message: "Asset not found" });
      }
      
      // Log audit
      await logAudit(req.user?.id, 'UPDATE', 'assets', asset.id, asset.serialNumber || asset.assetTag || asset.name || asset.id, oldAsset, asset, req);
      
      res.json(asset);
    } catch (error: any) {
      if (error instanceof AssetLicenseError) return res.status(error.status).json({ message: error.message });
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid asset data", errors: error.issues });
      }
      if (error?.code === "23505") {
        return res.status(409).json({ message: "Asset ID already in use. Please choose a different Asset ID." });
      }
      console.error("Asset update error:", error);
      respondWithApiError(res, error, "Failed to update asset");
    }
  });

  app.delete("/api/assets/:id", requireAuth, requirePermission('asset_delete'), async (req, res) => {
    try {
      // Get asset for audit log before deleting
      const asset = await storage.getAsset(req.params.id);
      
      const deleted = await storage.deleteAsset(req.params.id);
      if (!deleted) {
        return res.status(404).json({ message: "Asset not found" });
      }
      
      // Log audit
      if (asset) {
        await logAudit(req.user?.id, 'DELETE', 'assets', asset.id, asset.serialNumber || asset.assetTag || asset.name || asset.id, asset, null, req);
      }
      
      res.status(204).send();
    } catch (error: any) {
      // PostgreSQL FK violation: code 23503 = foreign_key_violation
      if (error?.code === "23503") {
        return res.status(409).json({
          message: "Cannot delete this asset because it has linked records (disposal, audit, or maintenance history). Remove those records first or archive the asset instead.",
        });
      }
      console.error("Asset deletion error:", error);
      respondWithApiError(res, error, "Failed to delete asset");
    }
  });

  app.get("/api/assets/:id/license-allocations", requireAuth, requireModule("asset_management"), async (req, res) => {
    try {
      if (!(await storage.getAsset(req.params.id))) return res.status(404).json({ message: "Asset not found" });
      const allocations = await db.select({
        id: softwareLicenseAllocations.id, employeeId: softwareLicenseAllocations.employeeId,
        allocatedAt: softwareLicenseAllocations.allocatedAt, employee: {
          firstName: employees.firstName, lastName: employees.lastName, email: employees.email,
        },
      }).from(softwareLicenseAllocations).innerJoin(employees, eq(employees.id, softwareLicenseAllocations.employeeId))
        .where(and(eq(softwareLicenseAllocations.assetId, req.params.id), isNull(softwareLicenseAllocations.releasedAt)));
      res.json(allocations);
    } catch (error) { respondWithApiError(res, error, "Failed to fetch seat allocations"); }
  });

  app.post("/api/assets/:id/license-allocations", requireAuth, requireModule("asset_management"), requirePermission("asset_update"), async (req, res) => {
    try {
      const { employeeId } = z.object({ employeeId: z.string().min(1) }).parse(req.body);
      const result = await allocateSoftwareSeat(req.params.id, employeeId);
      await logAudit(req.user?.id, "CREATE", "software_license_allocations", result.allocation.id, `Seat for ${employeeId}`, null, result, req);
      res.status(201).json(result);
    } catch (error) {
      if (error instanceof AssetLicenseError) return res.status(error.status).json({ message: error.message });
      if (error instanceof z.ZodError) return res.status(400).json({ message: "Employee is required" });
      respondWithApiError(res, error, "Failed to allocate seat");
    }
  });

  app.post("/api/assets/:id/license-allocations/:allocationId/release", requireAuth, requireModule("asset_management"), requirePermission("asset_update"), async (req, res) => {
    try {
      const result = await releaseSoftwareSeat(req.params.id, req.params.allocationId);
      await logAudit(req.user?.id, "UPDATE", "software_license_allocations", result.allocation.id, "Software seat released", null, result, req);
      res.json(result);
    } catch (error) {
      if (error instanceof AssetLicenseError) return res.status(error.status).json({ message: error.message });
      respondWithApiError(res, error, "Failed to release seat");
    }
  });

  // Bulk update assets
  app.post("/api/assets/bulk-update", requireAuth, requirePermission('asset_update'), async (req, res) => {
    try {
      const { assetIds, updates } = req.body;
      if (!Array.isArray(assetIds) || assetIds.length === 0) {
        return res.status(400).json({ message: "assetIds must be a non-empty array" });
      }
      const allowed = ['status', 'departmentId', 'locationId', 'assignedTo'];
      const safeUpdates: Record<string, any> = {};
      for (const key of allowed) {
        if (updates[key] !== undefined) safeUpdates[key] = updates[key] || null;
      }
      if (Object.keys(safeUpdates).length === 0) {
        return res.status(400).json({ message: "No valid fields to update" });
      }
      let updated = 0;
      for (const id of assetIds) {
        try {
          await storage.updateAsset(id, safeUpdates);
          updated++;
        } catch (_) {}
      }
      await logAudit(req.user?.id, 'BULK_UPDATE', 'assets', 'bulk', `${updated} assets`, null, safeUpdates, req);
      res.json({ updated, message: `${updated} asset(s) updated successfully` });
    } catch (error) {
      console.error("Bulk update error:", error);
      respondWithApiError(res, error, "Failed to bulk update assets");
    }
  });

  // Asset Attachments
  const supportedAttachmentExtensions = new Set(["pdf", "docx", "xlsx", "png", "jpg", "jpeg", "conf", "ini", "txt", "log"]);
  const diskUpload = multer({
    storage: multer.diskStorage({
      destination: (_req, _file, cb) => cb(null, 'server/uploads/'),
      filename: (_req, file, cb) => {
        const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
        const baseName = file.originalname.replace(/\\/g, "/").split("/").pop() ?? "";
        const extension = baseName.match(/\.[a-zA-Z0-9]{1,10}$/)?.[0].toLowerCase() ?? "";
        cb(null, `${unique}${extension}`);
      },
    }),
    fileFilter: (_req, file, cb) => {
      const extension = file.originalname.split(".").pop()?.toLowerCase() ?? "";
      if (!supportedAttachmentExtensions.has(extension)) {
        return cb(new Error("Supported attachments: PDF, DOCX, XLSX, PNG, JPG, CONF, INI, TXT, and LOG"));
      }
      cb(null, true);
    },
    limits: { fileSize: 20 * 1024 * 1024 }, // 20MB
  });

  const hasActiveDropdownValue = async (category: string, value: string) => {
    const normalizedCategory = normalizeLookupKey(category);
    const normalizedValue = normalizeLookupKey(value);
    const [option] = await db.select({ id: dropdownOptions.id }).from(dropdownOptions).where(and(
      sql`lower(btrim(${dropdownOptions.category})) = ${normalizedCategory}`,
      sql`lower(btrim(${dropdownOptions.value})) = ${normalizedValue}`,
      eq(dropdownOptions.isActive, true),
    )).limit(1);
    return Boolean(option);
  };

  const cmdbPageFilters = z.object({
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.enum(["20", "50"]).default("20").transform(Number),
    search: z.string().trim().max(120).optional(),
  });
  const applicationIdListSchema = z.array(z.string().uuid()).max(200);
  const syncServerApplications = async (executor: any, serverId: string, requestedIds: string[]) => {
    const applicationIds = requestedIds.filter((id, index) => requestedIds.indexOf(id) === index);
    if (applicationIds.length !== requestedIds.length) {
      throw Object.assign(new Error("Choose each hosted application only once"), { status: 400 });
    }
    if (applicationIds.length) {
      const valid = await executor.select({ id: cmdbApplications.id }).from(cmdbApplications)
        .where(inArray(cmdbApplications.id, applicationIds));
      if (valid.length !== applicationIds.length) {
        throw Object.assign(new Error("One or more selected applications do not exist"), { status: 400 });
      }
    }
    await executor.delete(applicationServerLinks).where(eq(applicationServerLinks.serverId, serverId));
    if (applicationIds.length) {
      await executor.insert(applicationServerLinks).values(applicationIds.map(applicationId => ({ applicationId, serverId })));
    }
  };

  app.get("/api/cmdb/application-options", requireAuth, requireModule("cmdb"), requirePermission("asset_update"), async (_req, res) => {
    try {
      const rows = await db.select({
        id: cmdbApplications.id,
        name: cmdbApplications.name,
        status: cmdbApplications.status,
      }).from(cmdbApplications).orderBy(asc(cmdbApplications.name));
      res.json(rows);
    } catch (error) {
      respondWithApiError(res, error, "Failed to load application options");
    }
  });

  app.get("/api/applications", requireAuth, requireModule("cmdb"), requireAnyPermission("asset_update", "cmdb_view", "system_admin"), async (req, res) => {
    try {
      const employeeDirectoryEnabled = await isFeatureEnabled("asset_management");
      const parsed = cmdbPageFilters.extend({
        category: z.string().trim().max(120).optional(),
        hostingType: z.enum(["all", "saas", "on_prem", "hybrid"]).default("all"),
        status: z.enum(["all", "active", "inactive", "retired"]).default("all"),
      }).safeParse(req.query);
      if (!parsed.success) return res.status(400).json({ message: "Invalid application filters", errors: parsed.error.issues });
      const { page, pageSize, search, category, hostingType, status } = parsed.data;
      const conditions = [];
      if (category) conditions.push(eq(cmdbApplications.category, category));
      if (hostingType !== "all") conditions.push(eq(cmdbApplications.hostingType, hostingType));
      if (status !== "all") conditions.push(eq(cmdbApplications.status, status));
      if (search) {
        const term = `%${search}%`;
        conditions.push(or(
          ilike(cmdbApplications.name, term),
          ilike(cmdbApplications.category, term),
          ilike(cmdbApplications.vendor, term),
          sql`EXISTS (SELECT 1 FROM employees e WHERE e.id = ${cmdbApplications.businessOwner} AND concat_ws(' ', e.first_name, e.last_name) ILIKE ${term})`,
          sql`EXISTS (SELECT 1 FROM employees e WHERE e.id = ${cmdbApplications.technicalOwner} AND concat_ws(' ', e.first_name, e.last_name) ILIKE ${term})`,
        )!);
      }
      const where = conditions.length ? and(...conditions)! : sql`true`;
      const [data, [{ total }]] = await Promise.all([
        db.select({
          id: cmdbApplications.id,
          name: cmdbApplications.name,
          category: cmdbApplications.category,
          vendor: cmdbApplications.vendor,
          businessOwner: cmdbApplications.businessOwner,
          businessOwnerName: employeeDirectoryEnabled ? sql<string | null>`(SELECT concat_ws(' ', first_name, last_name) FROM employees WHERE id = ${cmdbApplications.businessOwner})` : sql<string | null>`NULL`,
          technicalOwner: cmdbApplications.technicalOwner,
          technicalOwnerName: employeeDirectoryEnabled ? sql<string | null>`(SELECT concat_ws(' ', first_name, last_name) FROM employees WHERE id = ${cmdbApplications.technicalOwner})` : sql<string | null>`NULL`,
          hostingType: cmdbApplications.hostingType,
          criticalityRating: cmdbApplications.criticalityRating,
          status: cmdbApplications.status,
          createdAt: cmdbApplications.createdAt,
          updatedAt: cmdbApplications.updatedAt,
        }).from(cmdbApplications).where(where)
          .orderBy(desc(cmdbApplications.updatedAt), desc(cmdbApplications.name))
          .limit(pageSize).offset((page - 1) * pageSize),
        db.select({ total: sql<number>`count(*)::int` }).from(cmdbApplications).where(where),
      ]);
      res.json({ data, total, page, pageSize });
    } catch (error) {
      respondWithApiError(res, error, "Failed to load applications");
    }
  });

  app.post("/api/applications", requireAuth, requireModule("cmdb"), requirePermission("asset_create"), async (req, res) => {
    try {
      const input = insertCmdbApplicationSchema.parse(req.body);
      if (!(await hasActiveDropdownValue("application_category", input.category))) {
        return res.status(400).json({ message: "Select an active application category from System Dropdowns" });
      }
      const [row] = await db.insert(cmdbApplications).values(input).returning();
      await logAudit(req.user?.id, "CREATE", "cmdb_applications", row.id, row.name, null, row, req);
      res.status(201).json(row);
    } catch (error: any) {
      if (error instanceof z.ZodError) return res.status(400).json({ message: "Invalid application data", errors: error.issues });
      if (error?.code === "23505") return res.status(409).json({ message: "An application with this name already exists" });
      respondWithApiError(res, error, "Failed to create application");
    }
  });

  app.put("/api/applications/:id", requireAuth, requireModule("cmdb"), requirePermission("asset_update"), async (req, res) => {
    try {
      const input = insertCmdbApplicationSchema.partial().parse(req.body);
      if (input.category && !(await hasActiveDropdownValue("application_category", input.category))) {
        return res.status(400).json({ message: "Select an active application category from System Dropdowns" });
      }
      const [previous] = await db.select().from(cmdbApplications).where(eq(cmdbApplications.id, req.params.id));
      if (!previous) return res.status(404).json({ message: "Application not found" });
      const [row] = await db.update(cmdbApplications).set({ ...input, updatedAt: new Date() })
        .where(eq(cmdbApplications.id, req.params.id)).returning();
      await logAudit(req.user?.id, "UPDATE", "cmdb_applications", row.id, row.name, previous, row, req);
      res.json(row);
    } catch (error: any) {
      if (error instanceof z.ZodError) return res.status(400).json({ message: "Invalid application data", errors: error.issues });
      if (error?.code === "23505") return res.status(409).json({ message: "An application with this name already exists" });
      respondWithApiError(res, error, "Failed to update application");
    }
  });

  app.get("/api/applications/:id/servers", requireAuth, requireModule("cmdb"), requireAnyPermission("asset_update", "cmdb_view", "system_admin"), async (req, res) => {
    try {
      const [application] = await db.select({ id: cmdbApplications.id }).from(cmdbApplications).where(eq(cmdbApplications.id, req.params.id));
      if (!application) return res.status(404).json({ message: "Application not found" });
      const hostedServers = await db.select({
        id: servers.id,
        hostname: servers.hostname,
        ipAddress: servers.ipAddress,
        environment: servers.environment,
        status: servers.status,
        osPlatform: servers.osPlatform,
        location: servers.location,
      }).from(applicationServerLinks).innerJoin(servers, eq(servers.id, applicationServerLinks.serverId))
        .where(eq(applicationServerLinks.applicationId, application.id))
        .orderBy(asc(servers.hostname));
      res.json(hostedServers);
    } catch (error) {
      respondWithApiError(res, error, "Failed to load hosted infrastructure");
    }
  });

  app.get("/api/servers", requireAuth, requireModule("cmdb"), requireAnyPermission("asset_update", "cmdb_view", "system_admin"), async (req, res) => {
    try {
      const parsed = cmdbPageFilters.extend({
        osPlatform: z.string().trim().max(120).optional(),
        environment: z.enum(["all", "production", "staging", "development"]).default("all"),
        status: z.enum(["all", "online", "maintenance", "offline"]).default("all"),
      }).safeParse(req.query);
      if (!parsed.success) return res.status(400).json({ message: "Invalid server filters", errors: parsed.error.issues });
      const { page, pageSize, search, osPlatform, environment, status } = parsed.data;
      const conditions = [];
      if (osPlatform) conditions.push(eq(servers.osPlatform, osPlatform));
      if (environment !== "all") conditions.push(eq(servers.environment, environment));
      if (status !== "all") conditions.push(eq(servers.status, status));
      if (search) {
        const term = `%${search}%`;
        conditions.push(or(
          ilike(servers.hostname, term),
          ilike(servers.ipAddress, term),
          ilike(servers.osPlatform, term),
          ilike(servers.environment, term),
          ilike(servers.cpuRamSpecs, term),
          ilike(servers.location, term),
        )!);
      }
      const where = conditions.length ? and(...conditions)! : sql`true`;
      const [data, [{ total }]] = await Promise.all([
        db.select().from(servers).where(where)
          .orderBy(desc(servers.updatedAt), desc(servers.hostname))
          .limit(pageSize).offset((page - 1) * pageSize),
        db.select({ total: sql<number>`count(*)::int` }).from(servers).where(where),
      ]);
      res.json({ data, total, page, pageSize });
    } catch (error) {
      respondWithApiError(res, error, "Failed to load servers");
    }
  });

  app.post("/api/servers", requireAuth, requireModule("cmdb"), requirePermission("asset_create"), async (req, res) => {
    try {
      const input = insertServerSchema.parse(req.body);
      const applicationIds = applicationIdListSchema.default([]).parse(req.body.applicationIds ?? []);
      if (!(await hasActiveDropdownValue("os_platform", input.osPlatform))) {
        return res.status(400).json({ message: "Select an active OS platform from System Dropdowns" });
      }
      const row = await db.transaction(async tx => {
        const [created] = await tx.insert(servers).values(input).returning();
        await syncServerApplications(tx, created.id, applicationIds);
        return created;
      });
      await logAudit(req.user?.id, "CREATE", "servers", row.id, row.hostname, null, row, req);
      res.status(201).json(row);
    } catch (error: any) {
      if (error instanceof z.ZodError) return res.status(400).json({ message: "Invalid server data", errors: error.issues });
      if (error?.code === "23505") return res.status(409).json({ message: "A server with this hostname already exists" });
      respondWithApiError(res, error, "Failed to create server");
    }
  });

  app.put("/api/servers/:id", requireAuth, requireModule("cmdb"), requirePermission("asset_update"), async (req, res) => {
    try {
      const input = insertServerSchema.partial().parse(req.body);
      const hasApplicationIds = Object.prototype.hasOwnProperty.call(req.body ?? {}, "applicationIds");
      const applicationIds = hasApplicationIds
        ? applicationIdListSchema.parse(req.body.applicationIds)
        : undefined;
      if (input.osPlatform && !(await hasActiveDropdownValue("os_platform", input.osPlatform))) {
        return res.status(400).json({ message: "Select an active OS platform from System Dropdowns" });
      }
      const [previous] = await db.select().from(servers).where(eq(servers.id, req.params.id));
      if (!previous) return res.status(404).json({ message: "Server not found" });
      const row = await db.transaction(async tx => {
        const [updated] = await tx.update(servers).set({ ...input, updatedAt: new Date() })
          .where(eq(servers.id, req.params.id)).returning();
        if (applicationIds) await syncServerApplications(tx, updated.id, applicationIds);
        return updated;
      });
      await logAudit(req.user?.id, "UPDATE", "servers", row.id, row.hostname, previous, row, req);
      res.json(row);
    } catch (error: any) {
      if (error instanceof z.ZodError) return res.status(400).json({ message: "Invalid server data", errors: error.issues });
      if (error?.code === "23505") return res.status(409).json({ message: "A server with this hostname already exists" });
      respondWithApiError(res, error, "Failed to update server");
    }
  });

  app.get("/api/servers/:id/applications", requireAuth, requireModule("cmdb"), requireAnyPermission("asset_update", "cmdb_view", "system_admin"), async (req, res) => {
    try {
      const [server] = await db.select({ id: servers.id }).from(servers).where(eq(servers.id, req.params.id));
      if (!server) return res.status(404).json({ message: "Server not found" });
      const hostedApplications = await db.select({
        id: cmdbApplications.id,
        name: cmdbApplications.name,
        category: cmdbApplications.category,
        status: cmdbApplications.status,
      }).from(applicationServerLinks).innerJoin(cmdbApplications, eq(cmdbApplications.id, applicationServerLinks.applicationId))
        .where(eq(applicationServerLinks.serverId, server.id))
        .orderBy(asc(cmdbApplications.name));
      res.json(hostedApplications);
    } catch (error) {
      respondWithApiError(res, error, "Failed to load hosted applications");
    }
  });

  app.get("/api/service-requests/:id/attachments", requireAuth, requireModule("itsm"), async (req: any, res) => {
    try {
      const request = (await storage.getServiceRequests()).find(row => row.id === req.params.id);
      if (!request) return res.status(404).json({ message: "Service request not found" });
      if (request.requesterId !== req.user.id && !(await canViewAllItsmRecords(req.user.id))) {
        return res.status(403).json({ message: "Insufficient permissions" });
      }
      const rows = await db.select().from(ticketAttachments).where(eq(ticketAttachments.serviceRequestId, request.id));
      res.json(rows.map(({ filePath: _filePath, ...row }) => row));
    } catch (error) {
      respondWithApiError(res, error, "Failed to fetch service request attachments");
    }
  });

  app.post("/api/service-requests/:id/attachments", requireAuth, requireModule("itsm"), async (req: any, res, next) => {
    try {
      const request = (await storage.getServiceRequests()).find(row => row.id === req.params.id);
      if (!request) return res.status(404).json({ message: "Service request not found" });
      if (request.requesterId !== req.user.id && !(await canManageAllTickets(req.user.id))) {
        return res.status(403).json({ message: "Insufficient permissions" });
      }
      next();
    } catch (error) {
      respondWithApiError(res, error, "Failed to authorize service request attachment upload");
    }
  }, diskUpload.single("file"), async (req: any, res) => {
    try {
      if (!req.file) return res.status(400).json({ message: "No file uploaded" });
      const request = (await storage.getServiceRequests()).find(row => row.id === req.params.id);
      if (!request) return res.status(404).json({ message: "Service request not found" });
      const values = insertTicketAttachmentSchema.parse({
        ticketId: null,
        incidentId: null,
        serviceRequestId: request.id,
        fileName: req.file.filename,
        originalName: req.file.originalname,
        fileType: req.file.mimetype,
        fileSize: req.file.size,
        filePath: req.file.path,
        description: null,
        uploadedBy: req.user.id,
      });
      const [row] = await db.insert(ticketAttachments).values(values).returning();
      await db.insert(serviceRequestActivities).values({
        serviceRequestId: request.id,
        actorId: req.user.id,
        action: "Attachment uploaded",
        details: req.file.originalname,
      });
      const { filePath: _filePath, ...safeRow } = row;
      res.status(201).json(safeRow);
    } catch (error) {
      if (req.file?.path) {
        const fs = await import("fs");
        try { fs.unlinkSync(req.file.path); } catch {}
      }
      if (error instanceof z.ZodError) return res.status(400).json({ message: "Invalid attachment data", errors: error.issues });
      respondWithApiError(res, error, "Failed to upload service request attachment");
    }
  });

  app.get("/api/service-requests/:id/attachments/:attachId", requireAuth, requireModule("itsm"), async (req: any, res) => {
    try {
      const request = (await storage.getServiceRequests()).find(row => row.id === req.params.id);
      if (!request) return res.status(404).json({ message: "Service request not found" });
      if (request.requesterId !== req.user.id && !(await canViewAllItsmRecords(req.user.id))) {
        return res.status(403).json({ message: "Insufficient permissions" });
      }
      const [attachment] = await db.select().from(ticketAttachments).where(and(
        eq(ticketAttachments.id, req.params.attachId),
        eq(ticketAttachments.serviceRequestId, request.id),
      ));
      if (!attachment) return res.status(404).json({ message: "Attachment not found" });
      res.download(attachment.filePath, attachment.originalName);
    } catch (error) {
      respondWithApiError(res, error, "Failed to download service request attachment");
    }
  });

  app.get("/api/incidents/:id/attachments", requireAuth, requireModule("itsm"), async (req: any, res) => {
    try {
      const [incident] = await db.select().from(incidents).where(eq(incidents.id, req.params.id)).limit(1);
      if (!incident) return res.status(404).json({ message: "Incident not found" });
      if (incident.requesterId !== req.user.id && incident.creatorId !== req.user.id && !(await canViewAllItsmRecords(req.user.id))) {
        return res.status(403).json({ message: "Insufficient permissions" });
      }
      const rows = await db.select().from(ticketAttachments).where(eq(ticketAttachments.incidentId, incident.id));
      res.json(rows.map(({ filePath: _filePath, ...row }) => row));
    } catch (error) {
      respondWithApiError(res, error, "Failed to fetch incident attachments");
    }
  });

  app.post("/api/incidents/:id/attachments", requireAuth, requireModule("itsm"), async (req: any, res, next) => {
    try {
      const [incident] = await db.select().from(incidents).where(eq(incidents.id, req.params.id)).limit(1);
      if (!incident) return res.status(404).json({ message: "Incident not found" });
      if (incident.requesterId !== req.user.id && incident.creatorId !== req.user.id && !(await canManageAllTickets(req.user.id))) {
        return res.status(403).json({ message: "Insufficient permissions" });
      }
      next();
    } catch (error) {
      respondWithApiError(res, error, "Failed to authorize incident attachment upload");
    }
  }, diskUpload.single("file"), async (req: any, res) => {
    try {
      if (!req.file) return res.status(400).json({ message: "No file uploaded" });
      const [incident] = await db.select().from(incidents).where(eq(incidents.id, req.params.id)).limit(1);
      if (!incident) return res.status(404).json({ message: "Incident not found" });
      const values = insertTicketAttachmentSchema.parse({
        ticketId: null,
        incidentId: incident.id,
        serviceRequestId: null,
        fileName: req.file.filename,
        originalName: req.file.originalname,
        fileType: req.file.mimetype,
        fileSize: req.file.size,
        filePath: req.file.path,
        description: null,
        uploadedBy: req.user.id,
      });
      const [row] = await db.insert(ticketAttachments).values(values).returning();
      await db.insert(incidentActivities).values({
        incidentId: incident.id,
        actorId: req.user.id,
        action: "Attachment uploaded",
        details: req.file.originalname,
      });
      const { filePath: _filePath, ...safeRow } = row;
      res.status(201).json(safeRow);
    } catch (error) {
      if (req.file?.path) {
        const fs = await import("fs");
        try { fs.unlinkSync(req.file.path); } catch {}
      }
      if (error instanceof z.ZodError) return res.status(400).json({ message: "Invalid attachment data", errors: error.issues });
      respondWithApiError(res, error, "Failed to upload incident attachment");
    }
  });

  app.get("/api/incidents/:id/attachments/:attachId", requireAuth, requireModule("itsm"), async (req: any, res) => {
    try {
      const [incident] = await db.select().from(incidents).where(eq(incidents.id, req.params.id)).limit(1);
      if (!incident) return res.status(404).json({ message: "Incident not found" });
      if (incident.requesterId !== req.user.id && incident.creatorId !== req.user.id && !(await canViewAllItsmRecords(req.user.id))) {
        return res.status(403).json({ message: "Insufficient permissions" });
      }
      const [attachment] = await db.select().from(ticketAttachments).where(and(
        eq(ticketAttachments.id, req.params.attachId),
        eq(ticketAttachments.incidentId, incident.id),
      )).limit(1);
      if (!attachment) return res.status(404).json({ message: "Attachment not found" });
      res.download(attachment.filePath, attachment.originalName);
    } catch (error) {
      respondWithApiError(res, error, "Failed to download incident attachment");
    }
  });

  app.get("/api/assets/:id/attachments", requireAuth, async (req, res) => {
    try {
      const rows = await db.select().from(assetAttachments).where(eq(assetAttachments.assetId, req.params.id));
      res.json(rows);
    } catch (error) {
      console.error("Fetch attachments error:", error);
      respondWithApiError(res, error, "Failed to fetch attachments");
    }
  });

  app.post("/api/assets/:id/attachments", requireAuth, requireModule('asset_management'), requirePermission('asset_update'), async (req, res, next) => {
    try {
      if (!(await storage.getAsset(req.params.id))) {
        return res.status(404).json({ message: "Asset not found" });
      }
      next();
    } catch (error) {
      respondWithApiError(res, error, "Failed to verify asset");
    }
  }, diskUpload.single('file'), async (req, res) => {
    try {
      if (!req.file) return res.status(400).json({ message: "No file uploaded" });
      const { description } = req.body;
      const [row] = await db.insert(assetAttachments).values({
        assetId: req.params.id,
        fileName: req.file.filename,
        originalName: req.file.originalname,
        fileType: req.file.mimetype,
        fileSize: req.file.size,
        filePath: req.file.path,
        description: description || null,
        uploadedBy: req.user?.id || null,
      }).returning();
      res.json(row);
    } catch (error) {
      console.error("Upload attachment error:", error);
      respondWithApiError(res, error, "Failed to upload attachment");
    }
  });

  app.delete("/api/assets/:id/attachments/:attachId", requireAuth, requireModule('asset_management'), requirePermission('asset_update'), async (req, res) => {
    try {
      const [deleted] = await db.delete(assetAttachments)
        .where(and(eq(assetAttachments.id, req.params.attachId), eq(assetAttachments.assetId, req.params.id)))
        .returning();
      if (deleted?.filePath) {
        const fs = await import('fs');
        try { fs.unlinkSync(deleted.filePath); } catch (_) {}
      }
      res.status(204).send();
    } catch (error) {
      console.error("Delete attachment error:", error);
      respondWithApiError(res, error, "Failed to delete attachment");
    }
  });

  const configurationDocumentParentExists = async (parentType: "application" | "server", id: string, executor: any = db) => {
    const [parent] = parentType === "application"
      ? await executor.select({ id: cmdbApplications.id }).from(cmdbApplications).where(eq(cmdbApplications.id, id)).limit(1)
      : await executor.select({ id: servers.id }).from(servers).where(eq(servers.id, id)).limit(1);
    return Boolean(parent);
  };

  const listConfigurationDocuments = async (parentType: "application" | "server", id: string, res: any) => {
    if (!(await configurationDocumentParentExists(parentType, id))) {
      return res.status(404).json({ message: `${parentType === "application" ? "Application" : "Server"} not found` });
    }
    const parentFilter = parentType === "application"
      ? eq(configurationDocuments.applicationId, id)
      : eq(configurationDocuments.serverId, id);
    const rows = await db.select({
      id: configurationDocuments.id,
      applicationId: configurationDocuments.applicationId,
      serverId: configurationDocuments.serverId,
      documentType: configurationDocuments.documentType,
      version: configurationDocuments.version,
      originalName: configurationDocuments.originalName,
      fileType: configurationDocuments.fileType,
      fileSize: configurationDocuments.fileSize,
      uploadedBy: configurationDocuments.uploadedBy,
      uploadedByName: sql<string | null>`(SELECT concat_ws(' ', first_name, last_name) FROM users WHERE id = ${configurationDocuments.uploadedBy})`,
      uploadedAt: configurationDocuments.uploadedAt,
    }).from(configurationDocuments).where(parentFilter)
      .orderBy(desc(configurationDocuments.uploadedAt), desc(configurationDocuments.version));
    return res.json(rows);
  };

  const uploadConfigurationDocument = async (parentType: "application" | "server", id: string, req: any, res: any) => {
    if (!req.file) return res.status(400).json({ message: "Choose a file to upload" });
    try {
      const documentType = String(req.body.documentType ?? "").trim();
      if (!documentType || !(await hasActiveDropdownValue("configuration_document_type", documentType))) {
        const fs = await import("fs");
        try { fs.unlinkSync(req.file.path); } catch {}
        return res.status(400).json({ message: "Select an active document type from System Dropdowns" });
      }
      if (!(await configurationDocumentParentExists(parentType, id))) {
        const fs = await import("fs");
        try { fs.unlinkSync(req.file.path); } catch {}
        return res.status(404).json({ message: `${parentType === "application" ? "Application" : "Server"} not found` });
      }
      const row = await db.transaction(async tx => {
        if (parentType === "application") {
          await tx.select({ id: cmdbApplications.id }).from(cmdbApplications)
            .where(eq(cmdbApplications.id, id)).for("update");
        } else {
          await tx.select({ id: servers.id }).from(servers)
            .where(eq(servers.id, id)).for("update");
        }
        const parentFilter = parentType === "application"
          ? eq(configurationDocuments.applicationId, id)
          : eq(configurationDocuments.serverId, id);
        const [latest] = await tx.select({ version: configurationDocuments.version })
          .from(configurationDocuments).where(and(
            parentFilter,
            sql`lower(btrim(${configurationDocuments.originalName})) = ${normalizeLookupKey(req.file.originalname)}`,
            eq(configurationDocuments.documentType, documentType),
          )).orderBy(desc(configurationDocuments.version)).limit(1);
        const [created] = await tx.insert(configurationDocuments).values({
          applicationId: parentType === "application" ? id : null,
          serverId: parentType === "server" ? id : null,
          documentType,
          version: (latest?.version ?? 0) + 1,
          originalName: req.file.originalname,
          fileName: req.file.filename,
          fileType: req.file.mimetype,
          fileSize: req.file.size,
          filePath: req.file.path,
          uploadedBy: req.user?.id ?? null,
        }).returning();
        return created;
      });
      await logAudit(
        req.user?.id,
        "CREATE",
        "configuration_documents",
        row.id,
        `${parentType}:${id} ${row.originalName} v${row.version}`,
        null,
        { ...row, filePath: undefined },
        req,
      );
      const { filePath: _filePath, fileName: _fileName, ...safeRow } = row;
      return res.status(201).json(safeRow);
    } catch (error: any) {
      const fs = await import("fs");
      try { fs.unlinkSync(req.file.path); } catch {}
      if (error instanceof z.ZodError) return res.status(400).json({ message: "Invalid document metadata", errors: error.issues });
      if (error?.code === "23505") return res.status(409).json({ message: "A newer version was uploaded at the same time. Please retry." });
      return respondWithApiError(res, error, "Failed to upload configuration document");
    }
  };

  const downloadConfigurationDocument = async (
    parentType: "application" | "server",
    id: string,
    documentId: string,
    res: any,
  ) => {
    const parentFilter = parentType === "application"
      ? eq(configurationDocuments.applicationId, id)
      : eq(configurationDocuments.serverId, id);
    const [document] = await db.select().from(configurationDocuments).where(and(
      parentFilter,
      eq(configurationDocuments.id, documentId),
    )).limit(1);
    if (!document) return res.status(404).json({ message: "Configuration document not found" });
    return res.download(document.filePath, document.originalName);
  };

  app.get("/api/applications/:id/documents", requireAuth, requireModule("cmdb"), requirePermission("asset_update"), async (req, res) => {
    try { await listConfigurationDocuments("application", req.params.id, res); }
    catch (error) { respondWithApiError(res, error, "Failed to load application documents"); }
  });
  app.post("/api/applications/:id/documents", requireAuth, requireModule("cmdb"), requirePermission("asset_update"), diskUpload.single("file"), async (req: any, res) => {
    await uploadConfigurationDocument("application", req.params.id, req, res);
  });
  app.get("/api/applications/:id/documents/:documentId", requireAuth, requireModule("cmdb"), requirePermission("asset_update"), async (req, res) => {
    try { await downloadConfigurationDocument("application", req.params.id, req.params.documentId, res); }
    catch (error) { respondWithApiError(res, error, "Failed to download application document"); }
  });
  app.get("/api/servers/:id/documents", requireAuth, requireModule("cmdb"), requirePermission("asset_update"), async (req, res) => {
    try { await listConfigurationDocuments("server", req.params.id, res); }
    catch (error) { respondWithApiError(res, error, "Failed to load server documents"); }
  });
  app.post("/api/servers/:id/documents", requireAuth, requireModule("cmdb"), requirePermission("asset_update"), diskUpload.single("file"), async (req: any, res) => {
    await uploadConfigurationDocument("server", req.params.id, req, res);
  });
  app.get("/api/servers/:id/documents/:documentId", requireAuth, requireModule("cmdb"), requirePermission("asset_update"), async (req, res) => {
    try { await downloadConfigurationDocument("server", req.params.id, req.params.documentId, res); }
    catch (error) { respondWithApiError(res, error, "Failed to download server document"); }
  });

  // Ticket Attachments
  app.get("/api/tickets/:id/attachments", requireAuth, requireModule('itsm'), async (req, res) => {
    try {
      const user = req.user as any;
      const ticket = await storage.getTicket(req.params.id);
      if (!ticket) return res.status(404).json({ message: "Ticket not found" });
      const isOwner = ticket.requesterId === user.id || ticket.assignedToId === user.id;
      if (!isOwner && !(await canManageAllTickets(user.id))) {
        return res.status(403).json({ message: "Insufficient permissions" });
      }
      const rows = await db.select().from(ticketAttachments).where(eq(ticketAttachments.ticketId, req.params.id));
      res.json(rows);
    } catch (error) {
      console.error("Fetch ticket attachments error:", error);
      respondWithApiError(res, error, "Failed to fetch attachments");
    }
  });

  app.post("/api/tickets/:id/attachments", requireAuth, requireModule('itsm'), async (req, res, next) => {
    try {
      const user = req.user as any;
      const ticket = await storage.getTicket(req.params.id);
      if (!ticket) return res.status(404).json({ message: "Ticket not found" });
      if (ticket.requesterId !== user.id && ticket.assignedToId !== user.id && !(await canManageAllTickets(user.id))) {
        return res.status(403).json({ message: "Insufficient permissions" });
      }
      next();
    } catch (error) {
      respondWithApiError(res, error, "Failed to authorize upload");
    }
  }, diskUpload.single('file'), async (req, res) => {
    try {
      const user = req.user as any;
      const ticket = await storage.getTicket(req.params.id);
      if (!ticket) return res.status(404).json({ message: "Ticket not found" });
      const isOwner = ticket.requesterId === user.id || ticket.assignedToId === user.id;
      if (!isOwner && !(await canManageAllTickets(user.id))) {
        return res.status(403).json({ message: "Insufficient permissions" });
      }
      if (!req.file) return res.status(400).json({ message: "No file uploaded" });
      const validatedData = insertTicketAttachmentSchema.parse({
        ticketId: req.params.id,
        fileName: req.file.filename,
        originalName: req.file.originalname,
        fileType: req.file.mimetype,
        fileSize: req.file.size,
        filePath: req.file.path,
        description: req.body.description || null,
        uploadedBy: user.id,
      });
      const [row] = await db.insert(ticketAttachments).values(validatedData).returning();
      await logAudit(user.id, 'CREATE', 'ticket_attachments', row.id, req.file.originalname, null, row, req);
      res.status(201).json(row);
    } catch (error) {
      if (error instanceof z.ZodError) return res.status(400).json({ message: "Invalid attachment data", errors: error.issues });
      console.error("Upload ticket attachment error:", error);
      respondWithApiError(res, error, "Failed to upload attachment");
    }
  });

  app.delete("/api/tickets/:id/attachments/:attachId", requireAuth, requireModule('itsm'), async (req, res) => {
    try {
      const user = req.user as any;
      const ticket = await storage.getTicket(req.params.id);
      if (!ticket) return res.status(404).json({ message: "Ticket not found" });
      const isManager = await canManageTicket(user.id);
      if (!isManager) {
        return res.status(403).json({ message: "Only IT staff or administrators can delete attachments" });
      }
      const [deleted] = await db.delete(ticketAttachments)
        .where(and(eq(ticketAttachments.id, req.params.attachId), eq(ticketAttachments.ticketId, req.params.id)))
        .returning();
      if (deleted?.filePath) {
        const fs = await import('fs');
        try { fs.unlinkSync(deleted.filePath); } catch (_) {}
      }
      if (deleted) await logAudit(user.id, 'DELETE', 'ticket_attachments', deleted.id, deleted.originalName, deleted, null, req);
      res.status(204).send();
    } catch (error) {
      console.error("Delete ticket attachment error:", error);
      respondWithApiError(res, error, "Failed to delete attachment");
    }
  });

  app.get("/api/uploads/:filename", requireAuth, async (req, res) => {
    try {
      const path = await import('path');
      const fs = await import('fs');
      // Sanitize: strip any directory components to prevent path traversal
      const filename = path.basename(req.params.filename);
      if (!filename || filename !== req.params.filename || filename.startsWith('.')) {
        return res.status(400).json({ message: "Invalid filename" });
      }
      const [ticketFile] = await db.select().from(ticketAttachments).where(eq(ticketAttachments.fileName, filename)).limit(1);
      const [assetFile] = ticketFile
        ? [undefined]
        : await db.select().from(assetAttachments).where(eq(assetAttachments.fileName, filename)).limit(1);
      if (ticketFile) {
        const user = req.user as any;
        if (!ticketFile.ticketId) return res.status(404).json({ message: "Legacy ticket attachment not found" });
        const ticket = await storage.getTicket(ticketFile.ticketId);
        if (!ticket || (ticket.requesterId !== user.id && ticket.assignedToId !== user.id && !(await canManageAllTickets(user.id)))) {
          return res.status(404).json({ message: "File not found" });
        }
      } else if (!assetFile) {
        return res.status(404).json({ message: "File not found" });
      }
      const uploadsDir = path.join(process.cwd(), 'server/uploads');
      const filePath = path.join(uploadsDir, filename);
      // Double-check resolved path is still inside the uploads directory
      if (!filePath.startsWith(uploadsDir + path.sep) && filePath !== uploadsDir) {
        return res.status(403).json({ message: "Access denied" });
      }
      if (!fs.existsSync(filePath)) {
        return res.status(404).json({ message: "File not found" });
      }
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.download(filePath, ticketFile?.originalName || assetFile?.originalName || filename);
    } catch (error) {
      res.status(404).json({ message: "File not found" });
    }
  });

  const getEmployeeOffboardingReview = async (executor: any, employee: any) => {
    const [hardwareAssets, softwareSeats, accessRights, linkedAccounts] = await Promise.all([
      executor.select({
        assignmentId: assignments.id,
        assetId: assets.id,
        assetName: assets.name,
        assetTag: assets.assetTag,
        assignedDate: assignments.assignedDate,
      }).from(assignments).innerJoin(assets, eq(assets.id, assignments.assetId))
        .where(and(eq(assignments.employeeId, employee.id), isNull(assignments.returnedDate))),
      executor.select({
        allocationId: softwareLicenseAllocations.id,
        assetId: assets.id,
        assetName: assets.name,
        assetTag: assets.assetTag,
        allocatedAt: softwareLicenseAllocations.allocatedAt,
      }).from(softwareLicenseAllocations).innerJoin(assets, eq(assets.id, softwareLicenseAllocations.assetId))
        .where(and(eq(softwareLicenseAllocations.employeeId, employee.id), isNull(softwareLicenseAllocations.releasedAt))),
      executor.select().from(employeeAccessRights).where(and(
        eq(employeeAccessRights.employeeId, employee.id),
        eq(employeeAccessRights.status, "active"),
      )),
      employee.email ? executor.select({ id: users.id, username: users.username, email: users.email, isActive: users.isActive })
        .from(users).where(sql`lower(${users.email}) = ${employee.email.trim().toLowerCase()}`) : Promise.resolve([]),
    ]);
    const activeAccounts = linkedAccounts.filter((account: any) => account.isActive === true);
    return {
      employeeId: employee.id,
      status: employee.status ?? "active",
      hardwareAssets,
      softwareSeats,
      accessRights,
      linkedAccounts,
      blockers: {
        hardwareAssets: hardwareAssets.length,
        softwareSeats: softwareSeats.length,
        accessRights: accessRights.length,
        activeAccounts: activeAccounts.length,
      },
      canOffboard: hardwareAssets.length + softwareSeats.length + accessRights.length + activeAccounts.length === 0,
    };
  };

  const validatePrivilegeLevel = async (executor: any, privilegeLevel: string) => {
    const normalized = privilegeLevel.trim().toLocaleLowerCase();
    const [option] = await executor.select({ id: dropdownOptions.id }).from(dropdownOptions).where(and(
      sql`lower(btrim(${dropdownOptions.category})) = 'access_privilege_level'`,
      sql`lower(btrim(${dropdownOptions.value})) = ${normalized}`,
      eq(dropdownOptions.isActive, true),
    )).limit(1);
    if (!option) throw Object.assign(new Error("Select an active privilege level from System Dropdowns"), { status: 400 });
  };

  const getAccessSystemCatalog = async (executor: any) => {
    const [assetRows, systemOptions, applicationRows, serverRows] = await Promise.all([
      executor.select({
        id: assets.id,
        name: assets.name,
        assetTag: assets.assetTag,
        type: assets.type,
        category: assets.category,
        status: assets.status,
        lifecycleStatus: assets.lifecycleStatus,
      }).from(assets),
      executor.select({
        id: dropdownOptions.id,
        category: dropdownOptions.category,
        value: dropdownOptions.value,
        label: dropdownOptions.label,
      }).from(dropdownOptions).where(eq(dropdownOptions.isActive, true)),
      executor.select({
        id: cmdbApplications.id,
        name: cmdbApplications.name,
        vendor: cmdbApplications.vendor,
        status: cmdbApplications.status,
      }).from(cmdbApplications),
      executor.select({
        id: servers.id,
        hostname: servers.hostname,
        status: servers.status,
      }).from(servers),
    ]);
    const catalog: Array<{
      key: string;
      id: string;
      name: string;
      label: string;
      accessType: AccessType;
      source: "application" | "server" | "asset" | "dropdown";
    }> = [];
    const seen = new Set<string>();
    const normalized = (value: unknown) => normalizeLookupKey(String(value ?? ""));
    const add = (item: Omit<(typeof catalog)[number], "key">) => {
      const duplicateKey = `${item.accessType}:${normalized(item.name)}`;
      if (!item.name.trim() || seen.has(duplicateKey)) return;
      seen.add(duplicateKey);
      catalog.push({ ...item, key: `${item.source}:${item.id}` });
    };

    for (const option of systemOptions) {
      const accessType = ACCESS_DROPDOWN_CATEGORIES[normalized(option.category)];
      if (!accessType) continue;
      const optionLabel = String(option.label ?? option.value ?? "").trim();
      if (!optionLabel) continue;
      add({
        id: option.id,
        name: optionLabel,
        label: optionLabel,
        accessType,
        source: "dropdown",
      });
    }

    for (const application of applicationRows) {
      if (normalized(application.status) !== "active") continue;
      const name = String(application.name ?? "").trim();
      add({
        id: application.id,
        name,
        label: application.vendor ? `${name} · ${application.vendor}` : name,
        accessType: "application",
        source: "application",
      });
    }

    for (const server of serverRows) {
      if (normalized(server.status) === "offline") continue;
      const hostname = String(server.hostname ?? "").trim();
      add({
        id: server.id,
        name: hostname,
        label: hostname,
        accessType: "server_remote_access",
        source: "server",
      });
    }

    for (const asset of assetRows) {
      const accessType = classifyAccessAsset(String(asset.type ?? ""), String(asset.category ?? ""));
      const inactiveStatuses = new Set(["inactive", "disabled", "retired", "disposed", "decommissioned"]);
      if (!accessType || inactiveStatuses.has(normalized(asset.status)) ||
        inactiveStatuses.has(normalized(asset.lifecycleStatus))) continue;
      const name = String(asset.name ?? "").trim();
      const label = asset.assetTag ? `${name} · ${asset.assetTag}` : name;
      add({ id: asset.id, name, label, accessType, source: "asset" });
    }

    return catalog.sort((left, right) =>
      left.accessType.localeCompare(right.accessType) || left.label.localeCompare(right.label),
    );
  };

  const resolveAccessSystem = async (
    executor: any,
    selection: { catalogSource: "application" | "server" | "asset" | "dropdown"; catalogItemId: string; accessType: AccessType },
  ) => {
    const item = (await getAccessSystemCatalog(executor)).find(candidate =>
      candidate.source === selection.catalogSource &&
      candidate.id === selection.catalogItemId &&
      candidate.accessType === selection.accessType,
    );
    if (!item) throw Object.assign(new Error("Select an active system from the access catalog"), { status: 400 });
    return item;
  };

  const accessRightBodySchema = z.object({
    catalogSource: z.enum(["application", "server", "asset", "dropdown"]).optional(),
    catalogItemId: z.string().trim().min(1).max(200).optional(),
    accessType: z.enum(ACCESS_TYPES).optional(),
    privilegeLevel: z.string().trim().min(1).max(100).optional(),
    accountUsername: z.string().trim().max(200).nullable().optional(),
    businessJustification: z.string().trim().min(5).max(4000),
    grantDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    expiresAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  });
  const createAccessRightBodySchema = accessRightBodySchema.extend({
    catalogSource: z.enum(["application", "server", "asset", "dropdown"]),
    catalogItemId: z.string().trim().min(1).max(200),
    accessType: z.enum(ACCESS_TYPES),
    privilegeLevel: z.string().trim().min(1).max(100),
  });

  // Employees routes
  app.get("/api/employees", requireAuth, requireModule('asset_management'), async (req, res) => {
    try {
      const employees = await storage.getEmployeesWithDetails();
      res.json(employees);
    } catch (error) {
      respondWithApiError(res, error, "Failed to fetch employees");
    }
  });

  app.get("/api/employees/:id", requireAuth, async (req, res) => {
    try {
      const employee = await storage.getEmployee(req.params.id);
      if (!employee) {
        return res.status(404).json({ message: "Employee not found" });
      }
      res.json(employee);
    } catch (error) {
      respondWithApiError(res, error, "Failed to fetch employee");
    }
  });

  app.get("/api/employees/:id/offboarding-review", requireAuth, requireModule("asset_management"), requireAnyPermission("employee_update", "offboarding_approve", "system_admin"), async (req, res) => {
    try {
      const employee = await storage.getEmployee(req.params.id);
      if (!employee) return res.status(404).json({ message: "Employee not found" });
      res.json(await getEmployeeOffboardingReview(db, employee));
    } catch (error) {
      respondWithApiError(res, error, "Failed to load offboarding review");
    }
  });

  app.post("/api/employees/:id/offboard", requireAuth, requireModule("asset_management"), requireAnyPermission("employee_update", "offboarding_approve", "system_admin"), async (req, res) => {
    try {
      const input = employeeOffboardingSubmissionSchema.parse(req.body);
      const result = await db.transaction(async tx => {
        const [employee] = await tx.select().from(employees).where(eq(employees.id, req.params.id)).for("update");
        if (!employee) throw Object.assign(new Error("Employee not found"), { status: 404 });
        if (employee.status === "disabled") throw Object.assign(new Error("Employee is already offboarded"), { status: 409 });
        const review = await getEmployeeOffboardingReview(tx, employee);
        const submittedClearances = new Map(input.clearances.map(clearance => [clearance.clearanceType, clearance]));
        const blockerClearances: Array<[boolean, "physical_asset_return" | "credential_vpn_revocation" | "license_reallocation"]> = [
          [review.blockers.hardwareAssets > 0, "physical_asset_return"],
          [review.blockers.accessRights + review.blockers.activeAccounts > 0, "credential_vpn_revocation"],
          [review.blockers.softwareSeats > 0, "license_reallocation"],
        ];
        if (blockerClearances.some(([hasBlocker, type]) => hasBlocker && submittedClearances.get(type)?.status !== "waived")) {
          throw Object.assign(new Error("Resolve the outstanding resources or document a waiver for each affected clearance"), { status: 409, review });
        }
        const signedAt = new Date();
        await tx.insert(employeeOffboardingClearances).values(input.clearances.map(clearance => ({
          employeeId: employee.id,
          offboardingDate: input.offboardedDate,
          clearanceType: clearance.clearanceType,
          status: clearance.status,
          note: clearance.note?.trim() || (clearance.status === "verified" ? "Clearance verified." : null),
          signedBy: req.user?.id ?? null,
          signedAt,
        })));
        for (const clearance of input.clearances) {
          const note = clearance.note?.trim() || "Clearance verified.";
          await tx.insert(auditLogs).values({
            userId: req.user?.id ?? null,
            action: clearance.status === "waived" ? "WAIVE" : "VERIFY",
            tableName: "employee_offboarding_clearances",
            recordId: employee.id,
            recordName: `${employee.firstName} ${employee.lastName} · ${clearance.clearanceType}`,
            oldValues: null,
            newValues: JSON.stringify({
              clearanceType: clearance.clearanceType,
              status: clearance.status,
              note,
              offboardingDate: input.offboardedDate,
              signedAt,
              reason: note,
            }),
            timestamp: signedAt,
            ipAddress: req.ip || null,
            userAgent: req.get("user-agent") || null,
          });
        }
        const [updated] = await tx.update(employees).set({
          status: "disabled",
          offboardedDate: input.offboardedDate,
          offboardedReason: input.offboardedReason,
        }).where(eq(employees.id, employee.id)).returning();
        return { previous: employee, employee: updated };
      });
      await logAudit(req.user?.id, "UPDATE", "employees", result.employee.id, `${result.employee.firstName} ${result.employee.lastName} offboarded`, result.previous, result.employee, req);
      res.json(result.employee);
    } catch (error: any) {
      if (error instanceof z.ZodError) return res.status(400).json({ message: "Complete each clearance and enter a note for every waiver", errors: error.issues });
      if (error?.review) return res.status(409).json({ message: error.message, review: error.review });
      if (error?.status) return res.status(error.status).json({ message: error.message });
      respondWithApiError(res, error, "Failed to offboard employee");
    }
  });

  app.post("/api/employees/:id/reactivate", requireAuth, requireModule("asset_management"), requirePermission("employee_update"), async (req, res) => {
    try {
      const { reason } = z.object({ reason: z.string().trim().min(3).max(1000) }).parse(req.body);
      const result = await db.transaction(async tx => {
        const [employee] = await tx.select().from(employees).where(eq(employees.id, req.params.id)).for("update");
        if (!employee) throw Object.assign(new Error("Employee not found"), { status: 404 });
        if (employee.status !== "disabled") throw Object.assign(new Error("Employee is already active"), { status: 409 });
        const [updated] = await tx.update(employees).set({
          status: "active",
          offboardedDate: null,
          offboardedReason: null,
        }).where(eq(employees.id, employee.id)).returning();
        return { previous: employee, employee: updated };
      });
      await logAudit(
        req.user?.id,
        "UPDATE",
        "employees",
        result.employee.id,
        `${result.employee.firstName} ${result.employee.lastName} reactivated`,
        result.previous,
        { ...result.employee, reactivationReason: reason },
        req,
      );
      res.json(result.employee);
    } catch (error: any) {
      if (error instanceof z.ZodError) return res.status(400).json({ message: "Enter a reactivation reason", errors: error.issues });
      if (error?.status) return res.status(error.status).json({ message: error.message });
      respondWithApiError(res, error, "Failed to reactivate employee");
    }
  });

  app.get("/api/access-governance/catalog", requireAuth, requireModule("asset_management"), requireAnyPermission("employee_update", "access_governance_view", "system_admin"), async (_req, res) => {
    try {
      res.json(await getAccessSystemCatalog(db));
    } catch (error) {
      console.error("Failed to load access system catalog:", error);
      respondWithApiError(res, error, "Failed to load access system catalog");
    }
  });

  app.get("/api/access-governance", requireAuth, requireModule("asset_management"), requireAnyPermission("employee_update", "access_governance_view", "system_admin"), async (req, res) => {
    try {
      await expireDueEmployeeAccessRights();
      const parsed = z.object({
        page: z.coerce.number().int().min(1).default(1),
        pageSize: z.enum(["20", "50"]).default("20").transform(Number),
        employeeId: z.string().trim().min(1).optional(),
        accessType: z.enum(ACCESS_TYPES).optional(),
        status: z.enum(["all", "active", "expiring", "expired", "expiry_review", "revoked"]).default("all"),
        search: z.string().trim().max(120).optional(),
        catalogSource: z.enum(["application", "server", "asset", "dropdown", "legacy"]).optional(),
        catalogItemId: z.string().trim().min(1).optional(),
      }).safeParse(req.query);
      if (!parsed.success) return res.status(400).json({ message: "Invalid access governance filters", errors: parsed.error.issues });
      const filters = parsed.data;
      if (Boolean(filters.catalogSource) !== Boolean(filters.catalogItemId)) {
        return res.status(400).json({ message: "Select both catalog source and system ID" });
      }

      const commonConditions: any[] = [];
      if (filters.employeeId) commonConditions.push(eq(employeeAccessRights.employeeId, filters.employeeId));
      if (filters.accessType) commonConditions.push(eq(employeeAccessRights.accessType, filters.accessType));
      if (filters.catalogSource) {
        commonConditions.push(and(
          eq(employeeAccessRights.catalogSource, filters.catalogSource),
          eq(employeeAccessRights.catalogItemId, filters.catalogItemId!),
        ));
      }
      if (filters.search) {
        const search = `%${filters.search.replace(/[%_]/g, "\\$&")}%`;
        commonConditions.push(or(
          ilike(employeeAccessRights.applicationName, search),
          ilike(employeeAccessRights.accountUsername, search),
          ilike(employees.firstName, search),
          ilike(employees.lastName, search),
          ilike(employees.employeeId, search),
          ilike(employees.email, search),
        ));
      }
      const today = toDateInputValue(new Date());
      const throughDate = new Date();
      throughDate.setDate(throughDate.getDate() + 30);
      const through = toDateInputValue(throughDate);
      const conditions = [...commonConditions];
      if (filters.status === "revoked" || filters.status === "expired") {
        conditions.push(eq(employeeAccessRights.status, filters.status));
      } else if (filters.status === "active") {
        conditions.push(eq(employeeAccessRights.status, "active"));
      } else if (filters.status === "expiring") {
        conditions.push(and(
          eq(employeeAccessRights.status, "active"),
          sql`${employeeAccessRights.expiresAt} IS NOT NULL AND ${employeeAccessRights.expiresAt} > ${today}::date AND ${employeeAccessRights.expiresAt} <= ${through}::date`,
        ));
      } else if (filters.status === "expiry_review") {
        conditions.push(or(
          eq(employeeAccessRights.status, "expired"),
          and(
            eq(employeeAccessRights.status, "active"),
            sql`${employeeAccessRights.expiresAt} IS NOT NULL AND ${employeeAccessRights.expiresAt} <= ${through}::date`,
          ),
        ));
      }
      const where = conditions.length ? and(...conditions) : undefined;
      const summaryWhere = commonConditions.length ? and(...commonConditions) : undefined;
      const [expirySummary = { expiring: 0, expired: 0 }] = await db.select({
        expiring: sql<number>`count(*) FILTER (WHERE ${employeeAccessRights.status} = 'active' AND ${employeeAccessRights.expiresAt} > ${today}::date AND ${employeeAccessRights.expiresAt} <= ${through}::date)::int`,
        expired: sql<number>`count(*) FILTER (WHERE ${employeeAccessRights.status} = 'expired' OR (${employeeAccessRights.status} = 'active' AND ${employeeAccessRights.expiresAt} IS NOT NULL AND ${employeeAccessRights.expiresAt} <= ${today}::date))::int`,
      }).from(employeeAccessRights).innerJoin(employees, eq(employees.id, employeeAccessRights.employeeId)).where(summaryWhere);
      const [{ total = 0 } = {}] = await db.select({
        total: sql<number>`count(*)::int`,
      }).from(employeeAccessRights).innerJoin(employees, eq(employees.id, employeeAccessRights.employeeId)).where(where);
      const records = await db.select({
        id: employeeAccessRights.id,
        employeeId: employeeAccessRights.employeeId,
        applicationName: employeeAccessRights.applicationName,
        accessType: employeeAccessRights.accessType,
        catalogSource: employeeAccessRights.catalogSource,
        catalogItemId: employeeAccessRights.catalogItemId,
        privilegeLevel: employeeAccessRights.privilegeLevel,
        accountUsername: employeeAccessRights.accountUsername,
        businessJustification: employeeAccessRights.businessJustification,
        grantDate: employeeAccessRights.grantDate,
        expiresAt: employeeAccessRights.expiresAt,
        status: employeeAccessRights.status,
        revocationReason: employeeAccessRights.revocationReason,
        revokedAt: employeeAccessRights.revokedAt,
        employee: {
          id: employees.id,
          employeeId: employees.employeeId,
          firstName: employees.firstName,
          lastName: employees.lastName,
          email: employees.email,
          department: employees.department,
          status: employees.status,
        },
      }).from(employeeAccessRights).innerJoin(employees, eq(employees.id, employeeAccessRights.employeeId))
        .where(where)
        .orderBy(desc(employeeAccessRights.grantDate), desc(employeeAccessRights.createdAt))
        .limit(filters.pageSize)
        .offset((filters.page - 1) * filters.pageSize);

      res.json({
        records: records.map(record => ({
          ...record,
          expiryState: getAccessExpiryState(record.status, record.expiresAt),
        })),
        total,
        page: filters.page,
        pageSize: filters.pageSize,
        expirySummary,
      });
    } catch (error) {
      respondWithApiError(res, error, "Failed to load access governance records");
    }
  });

  app.get("/api/employees/:id/access-rights", requireAuth, requireModule("asset_management"), requirePermission("employee_update"), async (req, res) => {
    try {
      await expireDueEmployeeAccessRights();
      if (!(await storage.getEmployee(req.params.id))) return res.status(404).json({ message: "Employee not found" });
      const rows = await db.select().from(employeeAccessRights).where(eq(employeeAccessRights.employeeId, req.params.id));
      res.json(rows.map(row => ({ ...row, expiryState: getAccessExpiryState(row.status, row.expiresAt) })));
    } catch (error) {
      respondWithApiError(res, error, "Failed to fetch employee access rights");
    }
  });

  app.post("/api/employees/:id/access-rights", requireAuth, requireModule("asset_management"), requirePermission("employee_update"), async (req, res) => {
    try {
      const input = createAccessRightBodySchema.parse(req.body);
      const effectiveGrantDate = input.grantDate ?? toDateInputValue(new Date());
      if (input.expiresAt && input.expiresAt < effectiveGrantDate) {
        return res.status(400).json({ message: "Expiry date cannot be earlier than the grant date" });
      }
      const row = await db.transaction(async tx => {
        const [employee] = await tx.select({ id: employees.id, status: employees.status }).from(employees)
          .where(eq(employees.id, req.params.id)).for("update");
        if (!employee) throw Object.assign(new Error("Employee not found"), { status: 404 });
        if (employee.status !== "active") throw Object.assign(new Error("Access cannot be granted to a disabled employee"), { status: 409 });
        const catalogItem = await resolveAccessSystem(tx, input);
        await validatePrivilegeLevel(tx, input.privilegeLevel);
        const [created] = await tx.insert(employeeAccessRights).values({
          employeeId: employee.id,
          applicationName: catalogItem.name,
          accessType: catalogItem.accessType,
          catalogSource: catalogItem.source,
          catalogItemId: catalogItem.id,
          privilegeLevel: input.privilegeLevel,
          accountUsername: input.accountUsername || null,
          businessJustification: input.businessJustification,
          grantDate: input.grantDate,
          expiresAt: input.expiresAt ?? null,
          status: "active",
        }).returning();
        await logEmployeeAccessMutation(tx, {
          actorId: req.user?.id,
          actorIp: req.ip,
          userAgent: req.get("user-agent"),
          action: "GRANT",
          recordId: created.id,
          recordName: `${created.applicationName} access granted`,
          reason: input.businessJustification,
          newValues: created,
        });
        return created;
      });
      res.status(201).json(row);
    } catch (error: any) {
      if (error instanceof z.ZodError) return res.status(400).json({ message: "Invalid access entitlement", errors: error.issues });
      if (error?.status) return res.status(error.status).json({ message: error.message });
      respondWithApiError(res, error, "Failed to grant employee access");
    }
  });

  app.put("/api/employees/:id/access-rights/:rightId", requireAuth, requireModule("asset_management"), requirePermission("employee_update"), async (req, res) => {
    try {
      const input = accessRightBodySchema.parse(req.body);
      const result = await db.transaction(async tx => {
        const [employee] = await tx.select({ id: employees.id, status: employees.status }).from(employees)
          .where(eq(employees.id, req.params.id)).for("update");
        if (!employee) throw Object.assign(new Error("Employee not found"), { status: 404 });
        if (employee.status !== "active") throw Object.assign(new Error("Access details for a disabled employee cannot be edited; revoke the entitlement instead"), { status: 409 });
        const [current] = await tx.select().from(employeeAccessRights).where(and(
          eq(employeeAccessRights.id, req.params.rightId),
          eq(employeeAccessRights.employeeId, employee.id),
        )).for("update");
        if (!current) throw Object.assign(new Error("Access entitlement not found"), { status: 404 });
        if (current.status !== "active") throw Object.assign(new Error("Revoked entitlements are historical records and cannot be edited"), { status: 409 });
        if (
          current.businessJustification === "Legacy access record - justification pending review" &&
          input.businessJustification === current.businessJustification
        ) {
          throw Object.assign(new Error("Replace the legacy placeholder with a current business justification"), { status: 400 });
        }
        const changes: Record<string, unknown> = { updatedAt: new Date() };
        if (input.privilegeLevel !== undefined) {
          await validatePrivilegeLevel(tx, input.privilegeLevel);
          changes.privilegeLevel = input.privilegeLevel;
        }
        if (input.accountUsername !== undefined) changes.accountUsername = input.accountUsername || null;
        if (input.grantDate !== undefined) changes.grantDate = input.grantDate;
        if (input.expiresAt !== undefined) changes.expiresAt = input.expiresAt;
        changes.businessJustification = input.businessJustification;
        const nextGrantDate = input.grantDate ?? current.grantDate;
        const nextExpiresAt = input.expiresAt !== undefined ? input.expiresAt : current.expiresAt;
        if (nextExpiresAt && nextGrantDate && nextExpiresAt < nextGrantDate) {
          throw Object.assign(new Error("Expiry date cannot be earlier than the grant date"), { status: 400 });
        }
        const hasCatalogSelection = input.catalogSource !== undefined || input.catalogItemId !== undefined || input.accessType !== undefined;
        if (hasCatalogSelection) {
          if (!input.catalogSource || !input.catalogItemId || !input.accessType) {
            throw Object.assign(new Error("Select a complete catalog system and access type"), { status: 400 });
          }
          const catalogItem = await resolveAccessSystem(tx, {
            catalogSource: input.catalogSource,
            catalogItemId: input.catalogItemId,
            accessType: input.accessType,
          });
          changes.applicationName = catalogItem.name;
          changes.accessType = catalogItem.accessType;
          changes.catalogSource = catalogItem.source;
          changes.catalogItemId = catalogItem.id;
        }
        if (Object.keys(changes).length === 1) throw Object.assign(new Error("No access entitlement changes were provided"), { status: 400 });
        const [updated] = await tx.update(employeeAccessRights).set(changes)
          .where(eq(employeeAccessRights.id, current.id)).returning();
        await logEmployeeAccessMutation(tx, {
          actorId: req.user?.id,
          actorIp: req.ip,
          userAgent: req.get("user-agent"),
          action: "MODIFY",
          recordId: updated.id,
          recordName: `${updated.applicationName} access modified`,
          reason: input.businessJustification,
          oldValues: current,
          newValues: updated,
        });
        return { current, updated };
      });
      res.json(result.updated);
    } catch (error: any) {
      if (error instanceof z.ZodError) return res.status(400).json({ message: "Invalid access entitlement", errors: error.issues });
      if (error?.status) return res.status(error.status).json({ message: error.message });
      respondWithApiError(res, error, "Failed to update employee access");
    }
  });

  app.post("/api/employees/:id/access-rights/:rightId/extend", requireAuth, requireModule("asset_management"), requirePermission("employee_update"), async (req, res) => {
    try {
      const input = z.object({
        days: z.coerce.number().int().min(30).max(365).default(90),
        businessJustification: z.string().trim().min(5).max(4000),
      }).parse(req.body);
      const result = await db.transaction(async tx => {
        const [employee] = await tx.select({ id: employees.id, status: employees.status })
          .from(employees).where(eq(employees.id, req.params.id)).for("update");
        if (!employee) throw Object.assign(new Error("Employee not found"), { status: 404 });
        if (employee.status !== "active") {
          throw Object.assign(new Error("Access cannot be extended for a disabled employee"), { status: 409 });
        }
        const [current] = await tx.select().from(employeeAccessRights).where(and(
          eq(employeeAccessRights.id, req.params.rightId),
          eq(employeeAccessRights.employeeId, employee.id),
          inArray(employeeAccessRights.status, ["active", "expired"]),
        )).for("update");
        if (!current) throw Object.assign(new Error("Access entitlement is not available to extend"), { status: 404 });
        if (input.businessJustification === "Legacy access record - justification pending review") {
          throw Object.assign(new Error("Enter a current business justification before extending access"), { status: 400 });
        }
        const today = toDateInputValue(new Date());
        const baseDate = current.expiresAt && current.expiresAt > today ? current.expiresAt : today;
        const nextDate = new Date(`${baseDate}T12:00:00`);
        nextDate.setDate(nextDate.getDate() + input.days);
        const expiresAt = toDateInputValue(nextDate);
        const [updated] = await tx.update(employeeAccessRights).set({
          status: "active",
          expiresAt,
          businessJustification: input.businessJustification,
          updatedAt: new Date(),
        }).where(eq(employeeAccessRights.id, current.id)).returning();
        await logEmployeeAccessMutation(tx, {
          actorId: req.user?.id,
          actorIp: req.ip,
          userAgent: req.get("user-agent"),
          action: "EXTEND",
          recordId: updated.id,
          recordName: `${updated.applicationName} access extended`,
          reason: `Periodic access review: extended by ${input.days} days. ${input.businessJustification}`,
          oldValues: current,
          newValues: updated,
        });
        return updated;
      });
      res.json({ ...result, expiryState: getAccessExpiryState(result.status, result.expiresAt) });
    } catch (error: any) {
      if (error instanceof z.ZodError) return res.status(400).json({ message: "Provide a valid extension period and business justification", errors: error.issues });
      if (error?.status) return res.status(error.status).json({ message: error.message });
      respondWithApiError(res, error, "Failed to extend employee access");
    }
  });

  app.post("/api/employees/:id/access-rights/:rightId/revoke", requireAuth, requireModule("asset_management"), requirePermission("employee_update"), async (req, res) => {
    try {
      const { reason } = z.object({ reason: z.string().trim().min(3).max(2000) }).parse(req.body);
      const result = await db.transaction(async tx => {
        const [employee] = await tx.select({ id: employees.id }).from(employees).where(eq(employees.id, req.params.id)).for("update");
        if (!employee) throw Object.assign(new Error("Employee not found"), { status: 404 });
        const [current] = await tx.select().from(employeeAccessRights).where(and(
          eq(employeeAccessRights.id, req.params.rightId),
          eq(employeeAccessRights.employeeId, employee.id),
          inArray(employeeAccessRights.status, ["active", "expired"]),
        )).for("update");
        if (!current) throw Object.assign(new Error("Access entitlement is not available to revoke"), { status: 404 });
        const [revoked] = await tx.update(employeeAccessRights).set({
          status: "revoked", revokedAt: new Date(), revocationReason: reason, updatedAt: new Date(),
        }).where(eq(employeeAccessRights.id, current.id)).returning();
        await logEmployeeAccessMutation(tx, {
          actorId: req.user?.id,
          actorIp: req.ip,
          userAgent: req.get("user-agent"),
          action: "REVOKE",
          recordId: revoked.id,
          recordName: `${revoked.applicationName} access revoked`,
          reason,
          oldValues: current,
          newValues: revoked,
        });
        return { current, revoked };
      });
      res.json(result.revoked);
    } catch (error: any) {
      if (error instanceof z.ZodError) return res.status(400).json({ message: "A revocation reason is required", errors: error.issues });
      if (error?.status) return res.status(error.status).json({ message: error.message });
      respondWithApiError(res, error, "Failed to revoke employee access");
    }
  });

  app.post("/api/employees", requireAuth, requireModule('asset_management'), requirePermission('employee_create'), async (req, res) => {
    try {
      const validatedData = insertEmployeeSchema.omit({ status: true, offboardedDate: true, offboardedReason: true }).parse(req.body);
      const employee = await storage.createEmployee({ ...validatedData, email: validatedData.email ?? null, status: "active" });
      
      // Log audit
      await logAudit(req.user?.id, 'CREATE', 'employees', employee.id.toString(), `${employee.firstName} ${employee.lastName}`, null, { firstName: employee.firstName, lastName: employee.lastName, email: employee.email }, req);
      
      res.status(201).json(employee);
    } catch (error) {
      console.error("Failed to create employee:", error);
      return respondWithApiError(res, error, "Create employee");
    }
  });

  app.put("/api/employees/:id", requireAuth, requirePermission('employee_update'), async (req, res) => {
    try {
      if ("status" in req.body || "offboardedDate" in req.body || "offboardedReason" in req.body) {
        return res.status(400).json({ message: "Employee lifecycle fields can only be changed through the offboarding workflow" });
      }
      const validatedData = insertEmployeeSchema.partial().omit({ status: true, offboardedDate: true, offboardedReason: true }).parse(req.body);
      
      // Get old employee for audit log
      const oldEmployee = await storage.getEmployee(req.params.id);
      
      const employee = await storage.updateEmployee(req.params.id, validatedData);
      if (!employee) {
        return res.status(404).json({ message: "Employee not found" });
      }
      
      // Log audit
      await logAudit(req.user?.id, 'UPDATE', 'employees', employee.id.toString(), `${employee.firstName} ${employee.lastName}`, oldEmployee, employee, req);
      
      res.json(employee);
    } catch (error) {
      return respondWithApiError(res, error, "Update employee");
    }
  });

  app.delete("/api/employees/:id", requireAuth, requirePermission('employee_delete'), async (req, res) => {
    const employee = await storage.getEmployee(req.params.id);
    if (!employee) return res.status(404).json({ message: "Employee not found" });
    res.status(409).json({ message: "Employee records cannot be deleted. Use the offboarding workflow to preserve employment and access history." });
  });

  // Assignments routes
  app.get("/api/assignments", requireAuth, requireModule('asset_management'), async (req, res) => {
    try {
      const assignments = await storage.getAssignmentsWithDetails();
      res.json(assignments);
    } catch (error) {
      respondWithApiError(res, error, "Failed to fetch assignments");
    }
  });

  app.get("/api/assignments/:id", requireAuth, async (req, res) => {
    try {
      const assignment = await storage.getAssignment(req.params.id);
      if (!assignment) {
        return res.status(404).json({ message: "Assignment not found" });
      }
      res.json(assignment);
    } catch (error) {
      respondWithApiError(res, error, "Failed to fetch assignment");
    }
  });

  app.post("/api/assignments", requireAuth, requireModule('asset_management'), requirePermission('assignment_create'), async (req, res) => {
    try {
      const validatedData = insertAssignmentSchema.parse(req.body);
      const assignment = await db.transaction(async tx => {
        const [asset] = await tx.select({ id: assets.id }).from(assets).where(eq(assets.id, validatedData.assetId)).for("update");
        if (!asset) throw Object.assign(new Error("Asset not found"), { status: 404 });
        if (validatedData.employeeId) {
          const [employee] = await tx.select({ id: employees.id, status: employees.status }).from(employees)
            .where(eq(employees.id, validatedData.employeeId)).for("update");
          if (!employee) throw Object.assign(new Error("Employee not found"), { status: 400 });
          if (employee.status !== "active") throw Object.assign(new Error("Assets cannot be assigned to a disabled employee"), { status: 409 });
        }
        const [created] = await tx.insert(assignments).values(validatedData).returning();
        await tx.update(assets).set({ status: "assigned" }).where(eq(assets.id, validatedData.assetId));
        return created;
      });
      
      // Log audit
      await logAudit(req.user?.id, 'CREATE', 'assignments', assignment.id.toString(), `Assignment #${assignment.id}`, null, { assetId: assignment.assetId, employeeId: assignment.employeeId, assignedDate: assignment.assignedDate }, req);
      
      res.status(201).json(assignment);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid assignment data", errors: error.issues });
      }
      if ((error as any)?.status) return res.status((error as any).status).json({ message: (error as Error).message });
      respondWithApiError(res, error, "Failed to create assignment");
    }
  });

  app.put("/api/assignments/:id", requireAuth, requirePermission('assignment_update'), async (req, res) => {
    try {
      const validatedData = insertAssignmentSchema.partial().parse(req.body);
      const result = await db.transaction(async tx => {
        const [oldAssignment] = await tx.select().from(assignments).where(eq(assignments.id, req.params.id)).for("update");
        if (!oldAssignment) throw Object.assign(new Error("Assignment not found"), { status: 404 });
        if (validatedData.employeeId && validatedData.employeeId !== oldAssignment.employeeId) {
          const [employee] = await tx.select({ id: employees.id, status: employees.status }).from(employees)
            .where(eq(employees.id, validatedData.employeeId)).for("update");
          if (!employee) throw Object.assign(new Error("Employee not found"), { status: 400 });
          if (employee.status !== "active") throw Object.assign(new Error("Assets cannot be assigned to a disabled employee"), { status: 409 });
        }
        const [assignment] = await tx.update(assignments).set(validatedData)
          .where(eq(assignments.id, req.params.id)).returning();
        return { oldAssignment, assignment };
      });
      const { oldAssignment, assignment } = result;
      
      // Log audit
      await logAudit(req.user?.id, 'UPDATE', 'assignments', assignment.id.toString(), `Assignment #${assignment.id}`, oldAssignment, assignment, req);
      
      res.json(assignment);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid assignment data", errors: error.issues });
      }
      if ((error as any)?.status) return res.status((error as any).status).json({ message: (error as Error).message });
      respondWithApiError(res, error, "Failed to update assignment");
    }
  });

  app.delete("/api/assignments/:id", requireAuth, requirePermission('assignment_delete'), async (req, res) => {
    try {
      // Get assignment for audit log before deleting
      const assignment = await storage.getAssignment(req.params.id);
      
      const deleted = await storage.deleteAssignment(req.params.id);
      if (!deleted) {
        return res.status(404).json({ message: "Assignment not found" });
      }
      
      // Update asset status back to "available" when assignment is deleted
      if (assignment) {
        await storage.updateAsset(assignment.assetId, { status: "available" });
      }
      
      // Log audit
      if (assignment) {
        await logAudit(req.user?.id, 'DELETE', 'assignments', assignment.id.toString(), `Assignment #${assignment.id}`, assignment, null, req);
      }
      
      res.status(204).send();
    } catch (error) {
      respondWithApiError(res, error, "Failed to delete assignment");
    }
  });

  // Return asset (end assignment)
  app.post("/api/assignments/:id/return", requireAuth, requirePermission('assignment_return'), async (req, res) => {
    try {
      const assignment = await storage.getAssignment(req.params.id);
      if (!assignment) {
        return res.status(404).json({ message: "Assignment not found" });
      }

      const updatedAssignment = await storage.updateAssignment(req.params.id, {
        returnedDate: new Date().toISOString().split('T')[0]
      });

      // Update asset status back to available
      await storage.updateAsset(assignment.assetId, { status: "available" });

      await logAudit(req.user?.id, "UPDATE", "assignments", assignment.id, `Assignment #${assignment.id} returned`, assignment, updatedAssignment, req);
      res.json(updatedAssignment);
    } catch (error) {
      respondWithApiError(res, error, "Failed to return asset");
    }
  });

  // Dashboard stats
  app.get("/api/dashboard/stats", requireAuth, async (req, res) => {
    try {
      const assets = await storage.getAssets();
      const employees = await storage.getEmployees();
      const locations = await storage.getLocations();
      const departments = await storage.getDepartments();
      const totalAssets = assets.length;
      const assignedAssets = assets.filter(a => a.status === "assigned").length;
      const availableAssets = assets.filter(a => a.status === "available").length;
      const maintenanceAssets = assets.filter(a => a.status === "maintenance").length;
      const retiredAssets = assets.filter(a => a.status === "retired").length;

      res.json({
        totalAssets,
        assignedAssets,
        availableAssets,
        maintenanceAssets,
        retiredAssets,
        totalEmployees: employees.length,
        totalLocations: locations.length,
        totalDepartments: departments.length
      });
    } catch (error) {
      respondWithApiError(res, error, "Failed to fetch dashboard stats");
    }
  });

  app.get("/api/dashboard/executive", requireAuth, async (req, res) => {
    try {
      const [userRoles, userPermissions] = await Promise.all([
        storage.getUserRoles(req.user!.id),
        storage.getUserPermissions(req.user!.id),
      ]);
      const isAdmin = userPermissions.includes("system_admin") ||
        userRoles.some(role => getStandardRoleKey(role.name) === "system_admin");
      const personaRoles = getPersonaRoleKeys(userRoles.map(role => role.name));
      if (!isAdmin && !isDemoViewer(userRoles.map(role => role.name)) && !personaRoles.some(role => role === "it_manager" || role === "cab_member")) {
        return res.status(403).json({ message: "Executive analytics are available to IT Managers, CAB Members, and administrators" });
      }

      const now = new Date();
      const today = toDateInputValue(now);
      const accessThroughDate = new Date(now);
      accessThroughDate.setDate(accessThroughDate.getDate() + 30);
      const accessThrough = toDateInputValue(accessThroughDate);
      const contractThrough = new Date(now);
      contractThrough.setDate(contractThrough.getDate() + 30);
      const contractThroughDate = toDateInputValue(contractThrough);
      const slaRiskThrough = new Date(now.getTime() + 4 * 60 * 60 * 1000);
      const [assetEnabled, cmdbEnabled, itsmEnabled] = await Promise.all([
        isFeatureEnabled("asset_management"), isFeatureEnabled("cmdb"), isFeatureEnabled("itsm"),
      ]);

      const [
        identityCounts,
        serverCounts,
        activeApplications,
        configurationFileCount,
        incidentPriorityCounts,
        resolutionSla,
        pendingApprovalCount,
        slaRiskCount,
        financialCounts,
        accessExpiryCounts,
        criticalityCounts,
        pendingOffboardingCount,
        pendingOffboardings,
        pendingApprovals,
        expiredAccessItems,
      ] = await Promise.all([
        assetEnabled ? db.select({
          activeEmployees: sql<number>`count(*) FILTER (WHERE ${employees.status} = 'active')::int`,
        }).from(employees) : [],
        cmdbEnabled ? db.select({
          total: sql<number>`count(*)::int`,
          online: sql<number>`count(*) FILTER (WHERE lower(${servers.status}) = 'online')::int`,
          maintenance: sql<number>`count(*) FILTER (WHERE lower(${servers.status}) = 'maintenance')::int`,
          offline: sql<number>`count(*) FILTER (WHERE lower(${servers.status}) = 'offline')::int`,
        }).from(servers) : [],
        cmdbEnabled ? db.select({ total: sql<number>`count(*)::int` }).from(cmdbApplications)
          .where(sql`lower(${cmdbApplications.status}) = 'active'`) : [],
        cmdbEnabled ? db.select({ total: sql<number>`count(*)::int` }).from(configurationDocuments).where(sql`
          lower(${configurationDocuments.documentType}) LIKE '%config%'
          OR lower(${configurationDocuments.originalName}) ~ '\\.(conf|ini|txt)$'
        `) : [],
        itsmEnabled ? db.select({
          P1: sql<number>`count(*) FILTER (WHERE ${incidents.priority} = 'P1' AND lower(${incidents.status}) NOT IN ('resolved', 'closed', 'cancelled'))::int`,
          P2: sql<number>`count(*) FILTER (WHERE ${incidents.priority} = 'P2' AND lower(${incidents.status}) NOT IN ('resolved', 'closed', 'cancelled'))::int`,
          P3: sql<number>`count(*) FILTER (WHERE ${incidents.priority} = 'P3' AND lower(${incidents.status}) NOT IN ('resolved', 'closed', 'cancelled'))::int`,
          P4: sql<number>`count(*) FILTER (WHERE ${incidents.priority} = 'P4' AND lower(${incidents.status}) NOT IN ('resolved', 'closed', 'cancelled'))::int`,
        }).from(incidents) : [],
        itsmEnabled ? db.select({
          withinSla: sql<number>`count(*) FILTER (WHERE ${incidents.resolvedAt} <= ${incidents.resolveDueAt})::int`,
          breached: sql<number>`count(*) FILTER (WHERE ${incidents.resolvedAt} > ${incidents.resolveDueAt})::int`,
        }).from(incidents).where(and(
          sql`${incidents.resolvedAt} IS NOT NULL`,
          sql`${incidents.resolveDueAt} IS NOT NULL`,
        )) : [],
        itsmEnabled ? db.select({ total: sql<number>`count(*)::int` }).from(changeApprovals).where(and(
          isNull(changeApprovals.removedAt),
          or(isNull(changeApprovals.decision), eq(changeApprovals.decision, "pending")),
        )) : [],
        itsmEnabled ? db.select({ total: sql<number>`count(*)::int` }).from(incidents).where(and(
          sql`lower(${incidents.status}) NOT IN ('resolved', 'closed', 'cancelled')`,
          sql`${incidents.resolveDueAt} IS NOT NULL AND ${incidents.resolveDueAt} <= ${slaRiskThrough}`,
        )) : [],
        assetEnabled ? db.select({
          hardwareAssetValuation: sql<number>`COALESCE(SUM(CASE WHEN lower(${assets.type}) <> 'software' THEN COALESCE(${assets.currentBookValue}, ${assets.currentValue}, ${assets.purchasePrice}, 0) ELSE 0 END), 0)::float8`,
          usedSeats: sql<number>`COALESCE(SUM(CASE WHEN lower(${assets.type}) = 'software' THEN COALESCE(${assets.usedSeats}, 0) ELSE 0 END), 0)::float8`,
          totalSeats: sql<number>`COALESCE(SUM(CASE WHEN lower(${assets.type}) = 'software' THEN COALESCE(${assets.licenseQuantity}, 0) ELSE 0 END), 0)::float8`,
        }).from(assets) : [],
        assetEnabled ? db.select({
          valid: sql<number>`count(*) FILTER (WHERE ${employeeAccessRights.status} = 'active' AND (${employeeAccessRights.expiresAt} IS NULL OR ${employeeAccessRights.expiresAt} > ${accessThrough}::date))::int`,
          expiring: sql<number>`count(*) FILTER (WHERE ${employeeAccessRights.status} = 'active' AND ${employeeAccessRights.expiresAt} > ${today}::date AND ${employeeAccessRights.expiresAt} <= ${accessThrough}::date)::int`,
          expired: sql<number>`count(*) FILTER (WHERE ${employeeAccessRights.status} = 'expired' OR (${employeeAccessRights.status} = 'active' AND ${employeeAccessRights.expiresAt} IS NOT NULL AND ${employeeAccessRights.expiresAt} <= ${today}::date))::int`,
        }).from(employeeAccessRights) : [],
        cmdbEnabled ? db.select({
          P1: sql<number>`count(*) FILTER (WHERE upper(${cmdbApplications.criticalityRating}) = 'P1')::int`,
          P2: sql<number>`count(*) FILTER (WHERE upper(${cmdbApplications.criticalityRating}) = 'P2')::int`,
          P3: sql<number>`count(*) FILTER (WHERE upper(${cmdbApplications.criticalityRating}) = 'P3')::int`,
          P4: sql<number>`count(*) FILTER (WHERE upper(${cmdbApplications.criticalityRating}) = 'P4')::int`,
        }).from(cmdbApplications).where(sql`lower(${cmdbApplications.status}) = 'active'`) : [],
        assetEnabled ? db.select({ total: sql<number>`count(*)::int` }).from(employees).where(and(
          eq(employees.status, "disabled"),
          sql`(SELECT count(DISTINCT c.clearance_type)
               FROM employee_offboarding_clearances c
               WHERE c.employee_id = ${employees.id}
                 AND c.offboarding_date = ${employees.offboardedDate}) < 3`,
        )) : [],
        assetEnabled ? db.select({
          id: employees.id,
          title: sql<string>`${employees.firstName} || ' ' || ${employees.lastName}`,
          createdAt: employees.offboardedDate,
        }).from(employees).where(and(
          eq(employees.status, "disabled"),
          sql`(SELECT count(DISTINCT c.clearance_type)
               FROM employee_offboarding_clearances c
               WHERE c.employee_id = ${employees.id}
                 AND c.offboarding_date = ${employees.offboardedDate}) < 3`,
        )).limit(8) : [],
        itsmEnabled ? db.selectDistinct({
          id: changes.id,
          title: changes.title,
          changeNumber: changes.changeNumber,
          priority: changes.priority,
          createdAt: changes.createdAt,
        }).from(changeApprovals).innerJoin(changes, eq(changeApprovals.changeId, changes.id)).where(and(
          isNull(changeApprovals.removedAt),
          or(isNull(changeApprovals.decision), eq(changeApprovals.decision, "pending")),
        )).orderBy(desc(changes.createdAt)).limit(8) : [],
        assetEnabled ? db.select({
          id: employeeAccessRights.id,
          systemName: employeeAccessRights.applicationName,
          expiresAt: employeeAccessRights.expiresAt,
          employeeName: sql<string>`${employees.firstName} || ' ' || ${employees.lastName}`,
        }).from(employeeAccessRights).innerJoin(employees, eq(employeeAccessRights.employeeId, employees.id)).where(or(
          eq(employeeAccessRights.status, "expired"),
          and(
            eq(employeeAccessRights.status, "active"),
            sql`${employeeAccessRights.expiresAt} IS NOT NULL AND ${employeeAccessRights.expiresAt} <= ${today}::date`,
          ),
        )).orderBy(asc(employeeAccessRights.expiresAt)).limit(8) : [],
      ]);

      const [contractCount] = assetEnabled ? await db.select({ total: sql<number>`count(*)::int` })
        .from(contracts).where(and(
          eq(contracts.status, "active"),
          sql`${contracts.endDate} IS NOT NULL AND ${contracts.endDate} >= ${today}::date AND ${contracts.endDate} <= ${contractThroughDate}::date`,
        )) : [];

      const incidentsByPriority = incidentPriorityCounts[0] ?? { P1: 0, P2: 0, P3: 0, P4: 0 };
      const seats = financialCounts[0] ?? { hardwareAssetValuation: 0, usedSeats: 0, totalSeats: 0 };
      const attentionQueue = [
        ...pendingOffboardings.map(item => ({
          id: item.id, type: "offboarding", title: `Pending offboarding: ${item.title}`,
          description: "Required clearance records are incomplete.", href: "/employees",
          priority: "high", createdAt: item.createdAt,
        })),
        ...pendingApprovals.map(item => ({
          id: item.id, type: "change_approval", title: `CAB approval: ${item.changeNumber}`,
          description: item.title, href: "/changes", priority: item.priority ?? "medium", createdAt: item.createdAt,
        })),
        ...expiredAccessItems.map(item => ({
          id: item.id, type: "expired_access", title: `Expired access: ${item.systemName}`,
          description: `${item.employeeName} · expiry ${item.expiresAt ?? "expired"}`,
          href: "/access-governance", priority: "critical", createdAt: item.expiresAt,
        })),
      ].sort((a, b) => {
        const priorityOrder: Record<string, number> = { critical: 0, high: 1, P1: 0, P2: 1, medium: 2, P3: 3, low: 4, P4: 4 };
        return (priorityOrder[a.priority] ?? 3) - (priorityOrder[b.priority] ?? 3);
      }).slice(0, 12);

      res.json({
        identity: {
          activeEmployees: identityCounts[0]?.activeEmployees ?? 0,
          pendingOffboardingClearances: pendingOffboardingCount[0]?.total ?? 0,
          expiringAccessGrants: accessExpiryCounts[0]?.expiring ?? 0,
          expiredAccessGrants: accessExpiryCounts[0]?.expired ?? 0,
        },
        infrastructure: {
          totalServers: serverCounts[0]?.total ?? 0,
          serversOnline: serverCounts[0]?.online ?? 0,
          serversMaintenance: serverCounts[0]?.maintenance ?? 0,
          serversOffline: serverCounts[0]?.offline ?? 0,
          activeApplications: activeApplications[0]?.total ?? 0,
          configurationFiles: configurationFileCount[0]?.total ?? 0,
        },
        serviceDesk: {
          openIncidentsByPriority: incidentsByPriority,
          pendingCabApprovals: pendingApprovalCount[0]?.total ?? 0,
          slaBreachRiskCount: slaRiskCount[0]?.total ?? 0,
          resolutionSla: resolutionSla[0] ?? { withinSla: 0, breached: 0 },
        },
        itam: {
          hardwareAssetValuation: seats.hardwareAssetValuation,
          softwareSeatUtilization: seats.totalSeats > 0 ? Math.min(100, Math.round((seats.usedSeats / seats.totalSeats) * 100)) : 0,
          contractsExpiring30Days: contractCount?.total ?? 0,
        },
        accessExpiry: accessExpiryCounts[0] ?? { valid: 0, expiring: 0, expired: 0 },
        applicationCriticality: criticalityCounts[0] ?? { P1: 0, P2: 0, P3: 0, P4: 0 },
        attentionQueue,
      });
    } catch (error) {
      console.error("Failed to build executive dashboard aggregates:", error);
      respondWithApiError(res, error, "Failed to fetch executive dashboard data");
    }
  });

  // Alerts endpoint
  app.get("/api/alerts", requireAuth, async (req, res) => {
    try {
      const today = new Date();
      const in90Days = new Date(today); in90Days.setDate(today.getDate() + 90);
      const in30Days = new Date(today); in30Days.setDate(today.getDate() + 30);
      const currentUserId = (req.user as any).id;
      const [assetEnabled, itsmEnabled] = await Promise.all([
        isFeatureEnabled("asset_management"), isFeatureEnabled("itsm"),
      ]);
      const currentUserPermissions = assetEnabled || itsmEnabled
        ? await storage.getUserPermissions(currentUserId)
        : [];
      const canManageChanges = currentUserPermissions.some(permission =>
        ["system_admin", "change_manage"].includes(permission),
      );

      const [assets, maintenanceSchedules, budgets, tickets, pendingCabChanges, disabledCabChanges] = await Promise.all([
        assetEnabled ? storage.getAssets() : [],
        assetEnabled ? storage.getMaintenanceSchedules() : [],
        assetEnabled ? storage.getBudgets() : [],
        itsmEnabled ? storage.getTickets() : [],
        itsmEnabled ? storage.getPendingCabAlertChanges(currentUserId) : [],
        canManageChanges ? storage.getDisabledCabAlertChanges() : [],
      ]);
      const renewalNotifications = assetEnabled
        ? await db.select().from(systemNotifications).where(and(
          eq(systemNotifications.userId, currentUserId),
          eq(systemNotifications.type, "service_contract"),
          eq(systemNotifications.isRead, false),
        )).orderBy(desc(systemNotifications.createdAt)).limit(25)
        : [];

      const alerts: any[] = [];

      // Warranty expiring alerts
      for (const asset of assets) {
        const expiry = asset.warrantyExpiry;
        if (!expiry || asset.status === 'retired') continue;
        const expiryDate = new Date(expiry);
        if (expiryDate <= in90Days && expiryDate >= today) {
          const daysLeft = Math.ceil((expiryDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
          alerts.push({
            type: 'warranty',
            severity: daysLeft <= 30 ? 'high' : 'medium',
            title: `Warranty Expiring: ${asset.name}`,
            message: `Warranty expires in ${daysLeft} day${daysLeft !== 1 ? 's' : ''} (${expiry})`,
            assetId: asset.id,
            link: '/assets',
          });
        } else if (expiryDate < today) {
          alerts.push({
            type: 'warranty',
            severity: 'high',
            title: `Warranty Expired: ${asset.name}`,
            message: `Warranty expired on ${expiry}`,
            assetId: asset.id,
            link: '/assets',
          });
        }
      }

      // Overdue maintenance alerts
      for (const schedule of maintenanceSchedules) {
        if (schedule.isActive === 'false') continue;
        const nextDue = new Date(schedule.nextDue);
        if (nextDue < today) {
          const daysOverdue = Math.ceil((today.getTime() - nextDue.getTime()) / (1000 * 60 * 60 * 24));
          alerts.push({
            type: 'maintenance',
            severity: daysOverdue > 7 ? 'high' : 'medium',
            title: `Maintenance Overdue`,
            message: `${schedule.maintenanceType} maintenance overdue by ${daysOverdue} day${daysOverdue !== 1 ? 's' : ''}`,
            scheduleId: schedule.id,
            link: '/maintenance',
          });
        } else if (nextDue <= in30Days) {
          const daysLeft = Math.ceil((nextDue.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
          alerts.push({
            type: 'maintenance',
            severity: 'low',
            title: `Maintenance Due Soon`,
            message: `${schedule.maintenanceType} maintenance due in ${daysLeft} day${daysLeft !== 1 ? 's' : ''}`,
            scheduleId: schedule.id,
            link: '/maintenance',
          });
        }
      }

      // Budget over 80% alerts
      for (const budget of budgets) {
        const spent = parseFloat(budget.spentAmount || '0');
        const total = parseFloat(budget.budgetAmount || '0');
        if (total > 0) {
          const pct = (spent / total) * 100;
          if (pct >= 100) {
            alerts.push({
              type: 'budget',
              severity: 'high',
              title: `Budget Exceeded: ${budget.name}`,
              message: `Budget is ${pct.toFixed(0)}% spent ($${spent.toLocaleString()} of $${total.toLocaleString()})`,
              budgetId: budget.id,
              link: '/budgets',
            });
          } else if (pct >= 80) {
            alerts.push({
              type: 'budget',
              severity: 'medium',
              title: `Budget Alert: ${budget.name}`,
              message: `Budget is ${pct.toFixed(0)}% spent ($${spent.toLocaleString()} of $${total.toLocaleString()})`,
              budgetId: budget.id,
              link: '/budgets',
            });
          }
        }
      }

      // Software license seat alerts
      for (const asset of assets) {
        if (asset.type !== 'software') continue;
        const total = asset.licenseQuantity || 0;
        const used = asset.usedSeats || 0;
        if (total > 0 && used >= total) {
          alerts.push({
            type: 'license',
            severity: 'high',
            title: `License Seats Full: ${asset.name}`,
            message: `All ${total} license seats are in use`,
            assetId: asset.id,
            link: '/assets',
          });
        } else if (total > 0 && used >= total * 0.9) {
          alerts.push({
            type: 'license',
            severity: 'medium',
            title: `License Seats Low: ${asset.name}`,
            message: `${used} of ${total} license seats in use (${Math.ceil((used/total)*100)}%)`,
            assetId: asset.id,
            link: '/assets',
          });
        }
      }

      // Ticket SLA alerts (breached / at risk)
      for (const ticket of tickets) {
        const isOpen = ticket.status !== "resolved" && ticket.status !== "closed" && ticket.status !== "cancelled";
        if (!isOpen || !ticket.slaResolutionDueAt) continue;
        const dueAt = new Date(ticket.slaResolutionDueAt);
        if (dueAt < today) {
          const hoursOver = Math.ceil((today.getTime() - dueAt.getTime()) / (1000 * 60 * 60));
          alerts.push({
            type: 'ticket',
            severity: 'high',
            title: `SLA Breached: ${ticket.ticketNumber}`,
            message: `${ticket.title} is ${hoursOver}h past its resolution SLA`,
            ticketId: ticket.id,
            link: '/tickets',
          });
        } else {
          const hoursLeft = (dueAt.getTime() - today.getTime()) / (1000 * 60 * 60);
          if (hoursLeft <= 2) {
            alerts.push({
              type: 'ticket',
              severity: 'medium',
              title: `SLA At Risk: ${ticket.ticketNumber}`,
              message: `${ticket.title} is due within ${Math.ceil(hoursLeft)}h`,
              ticketId: ticket.id,
              link: '/tickets',
            });
          }
        }
      }

      // Pending CAB votes assigned to the signed-in user
      for (const change of pendingCabChanges) {
        alerts.push({
          type: "cab",
          severity: change.type === "emergency" ? "high" : "medium",
          title: `CAB Vote Pending: ${change.changeNumber}`,
          message: `${change.title} is waiting for your CAB decision`,
          changeId: change.id,
          link: `/changes?approval=${encodeURIComponent(change.id)}`,
        });
      }

      // A disabled account cannot cast its pending vote. Derive these manager
      // alerts from current assignments and account state so a vote or removal
      // clears the alert without maintaining a separate notification record.
      const disabledApproversByChange = new Map<string, {
        change: typeof disabledCabChanges[number];
        approverLabels: Set<string>;
      }>();
      for (const row of disabledCabChanges) {
        let blockedChange = disabledApproversByChange.get(row.id);
        if (!blockedChange) {
          blockedChange = { change: row, approverLabels: new Set() };
          disabledApproversByChange.set(row.id, blockedChange);
        }
        blockedChange.approverLabels.add(row.approverLabel);
      }
      disabledApproversByChange.forEach(({ change, approverLabels }) => {
        const approvers = Array.from(approverLabels);
        alerts.push({
          type: "cab",
          severity: "high",
          title: `Blocked CAB: ${change.changeNumber}`,
          message: `${change.changeNumber} — ${change.title} is blocked by a pending assignment for disabled CAB approver${approvers.length === 1 ? "" : "s"} ${approvers.join(", ")}. Remove the assignment and add an active approver.`,
          changeId: change.id,
          link: `/changes?approval=${encodeURIComponent(change.id)}`,
        });
      });

      for (const notification of renewalNotifications) {
        alerts.push({
          type: "service_contract",
          severity: notification.severity,
          title: notification.title,
          message: notification.message,
          contractId: notification.relatedId ? Number(notification.relatedId) : undefined,
          notificationId: notification.id,
          link: notification.link ?? "/service-contracts",
        });
      }

      res.json(alerts);
    } catch (error) {
      console.error('Alerts error:', error);
      respondWithApiError(res, error, "Failed to fetch alerts");
    }
  });

  // Locations routes
  app.get("/api/locations", requireAuth, async (req, res) => {
    try {
      const locations = await storage.getLocationsWithDetails();
      res.json(locations);
    } catch (error) {
      respondWithApiError(res, error, "Failed to fetch locations");
    }
  });

  app.post("/api/locations", requireAuth, requirePermission('location_create'), async (req, res) => {
    try {
      const validatedData = insertLocationSchema.parse(req.body);
      const location = await storage.createLocation(validatedData);
      
      // Log audit
      await logAudit(req.user?.id, 'CREATE', 'locations', location.id.toString(), location.name, null, { name: location.name, address: location.address, city: location.city }, req);
      
      res.status(201).json(location);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid location data", errors: error.issues });
      }
      respondWithApiError(res, error, "Failed to create location");
    }
  });

  app.put("/api/locations/:id", requireAuth, requirePermission('location_update'), async (req, res) => {
    try {
      const validatedData = insertLocationSchema.partial().parse(req.body);
      
      // Get old location for audit log
      const oldLocation = await storage.getLocation(req.params.id);
      
      const location = await storage.updateLocation(req.params.id, validatedData);
      if (!location) {
        return res.status(404).json({ message: "Location not found" });
      }
      
      // Log audit
      await logAudit(req.user?.id, 'UPDATE', 'locations', location.id.toString(), location.name, oldLocation, location, req);
      
      res.json(location);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid location data", errors: error.issues });
      }
      respondWithApiError(res, error, "Failed to update location");
    }
  });

  app.delete("/api/locations/:id", requireAuth, requirePermission('location_delete'), async (req, res) => {
    try {
      // Get location for audit log before deleting
      const location = await storage.getLocation(req.params.id);
      
      const deleted = await storage.deleteLocation(req.params.id);
      if (!deleted) {
        return res.status(404).json({ message: "Location not found" });
      }
      
      // Log audit
      if (location) {
        await logAudit(req.user?.id, 'DELETE', 'locations', location.id.toString(), location.name, location, null, req);
      }
      
      res.status(204).send();
    } catch (error) {
      respondWithApiError(res, error, "Failed to delete location");
    }
  });

  // Departments routes
  app.get("/api/departments", requireAuth, async (req, res) => {
    try {
      const departments = await storage.getDepartmentsWithDetails();
      res.json(departments);
    } catch (error) {
      respondWithApiError(res, error, "Failed to fetch departments");
    }
  });

  app.post("/api/departments", requireAuth, requirePermission('department_create'), async (req, res) => {
    try {
      const validatedData = insertDepartmentSchema.parse(req.body);
      const department = await storage.createDepartment(validatedData);
      
      // Log audit
      await logAudit(req.user?.id, 'CREATE', 'departments', department.id, department.name, null, { name: department.name, description: department.description }, req);
      
      res.status(201).json(department);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid department data", errors: error.issues });
      }
      respondWithApiError(res, error, "Failed to create department");
    }
  });

  app.put("/api/departments/:id", requireAuth, requirePermission('department_update'), async (req, res) => {
    try {
      const validatedData = insertDepartmentSchema.partial().parse(req.body);
      
      // Get old department for audit log
      const oldDepartment = await storage.getDepartment(req.params.id);
      
      const department = await storage.updateDepartment(req.params.id, validatedData);
      if (!department) {
        return res.status(404).json({ message: "Department not found" });
      }
      
      // Log audit
      await logAudit(req.user?.id, 'UPDATE', 'departments', department.id, department.name, oldDepartment, department, req);
      
      res.json(department);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid department data", errors: error.issues });
      }
      respondWithApiError(res, error, "Failed to update department");
    }
  });

  app.delete("/api/departments/:id", requireAuth, requirePermission('department_delete'), async (req, res) => {
    try {
      // Get department for audit log before deleting
      const department = await storage.getDepartment(req.params.id);
      
      const deleted = await storage.deleteDepartment(req.params.id);
      if (!deleted) {
        return res.status(404).json({ message: "Department not found" });
      }
      
      // Log audit
      if (department) {
        await logAudit(req.user?.id, 'DELETE', 'departments', department.id, department.name, department, null, req);
      }
      
      res.status(204).send();
    } catch (error) {
      respondWithApiError(res, error, "Failed to delete department");
    }
  });

  // Vendors routes
  app.get("/api/vendors", requireAuth, async (req, res) => {
    try {
      const vendors = await storage.getVendorsWithDetails();
      res.json(vendors);
    } catch (error) {
      respondWithApiError(res, error, "Failed to fetch vendors");
    }
  });

  app.post("/api/vendors", requireAuth, requirePermission('vendor_create'), async (req, res) => {
    try {
      const validatedData = normalizeVendorContacts(insertVendorSchema.parse(req.body)) as InsertVendor;
      const vendor = await storage.createVendor(validatedData);
      
      // Log audit
      await logAudit(req.user?.id, 'CREATE', 'vendors', vendor.id.toString(), vendor.name, null, { name: vendor.name, contactPerson: vendor.contactPerson, email: vendor.email }, req);
      
      res.status(201).json(vendor);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid vendor data", errors: error.issues });
      }
      if (((error as any)?.code ?? (error as any)?.cause?.code) === "23505") return res.status(409).json({ message: "Vendor name or code already exists" });
      respondWithApiError(res, error, "Failed to create vendor");
    }
  });

  app.get("/api/vendors/:id", requireAuth, async (req, res) => {
    try {
      const vendor = await storage.getVendor(req.params.id);
      if (!vendor) {
        return res.status(404).json({ message: "Vendor not found" });
      }
      res.json(vendor);
    } catch (error) {
      respondWithApiError(res, error, "Failed to fetch vendor");
    }
  });

  app.put("/api/vendors/:id", requireAuth, requirePermission('vendor_update'), async (req, res) => {
    try {
      const validatedData = normalizeVendorContacts(insertVendorSchema.partial().parse(req.body));
      
      // Get old vendor for audit log
      const oldVendor = await storage.getVendor(req.params.id);
      
      const vendor = await storage.updateVendor(req.params.id, validatedData);
      if (!vendor) {
        return res.status(404).json({ message: "Vendor not found" });
      }
      
      // Log audit
      await logAudit(req.user?.id, 'UPDATE', 'vendors', vendor.id.toString(), vendor.name, oldVendor, vendor, req);
      
      res.json(vendor);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid vendor data", errors: error.issues });
      }
      if (((error as any)?.code ?? (error as any)?.cause?.code) === "23505") return res.status(409).json({ message: "Vendor name or code already exists" });
      respondWithApiError(res, error, "Failed to update vendor");
    }
  });

  app.delete("/api/vendors/:id", requireAuth, requirePermission('vendor_delete'), async (req, res) => {
    try {
      if ((await db.select({ id: vendorContracts.id }).from(vendorContracts).where(eq(vendorContracts.vendorId, req.params.id))).length)
        return res.status(409).json({ message: "This vendor has SLA contract history. Mark it Inactive instead of deleting it." });
      // Get vendor for audit log before deleting
      const vendor = await storage.getVendor(req.params.id);
      
      const deleted = await storage.deleteVendor(req.params.id);
      if (!deleted) {
        return res.status(404).json({ message: "Vendor not found" });
      }
      
      // Log audit
      if (vendor) {
        await logAudit(req.user?.id, 'DELETE', 'vendors', vendor.id.toString(), vendor.name, vendor, null, req);
      }
      
      res.status(204).send();
    } catch (error) {
      if (((error as any)?.code ?? (error as any)?.cause?.code) === "23503") return res.status(409).json({ message: "Vendor is referenced by historical records; mark it Inactive instead." });
      respondWithApiError(res, error, "Failed to delete vendor");
    }
  });

  // Purchase Orders routes
  app.get("/api/warehouse-locations", requireAuth, requireModule("asset_management"), async (_req, res) => {
    try {
      res.json(await db.select().from(warehouseLocations).orderBy(warehouseLocations.name));
    } catch (error) {
      respondWithApiError(res, error, "Failed to fetch warehouse locations");
    }
  });

  app.post("/api/warehouse-locations", requireAuth, requireModule("asset_management"), requirePermission("asset_create"), async (req, res) => {
    try {
      const input = insertWarehouseLocationSchema.parse(req.body);
      const [created] = await db.insert(warehouseLocations).values(input).returning();
      res.status(201).json(created);
    } catch (error) {
      if (error instanceof z.ZodError) return res.status(400).json({ message: "Invalid warehouse location", errors: error.issues });
      if ((error as any)?.code === "23505") return res.status(409).json({ message: "Warehouse code is already in use" });
      respondWithApiError(res, error, "Failed to create warehouse location");
    }
  });

  const updateWarehouseLocation = async (req: any, res: any) => {
    try {
      const input = insertWarehouseLocationSchema.partial().parse(req.body);
      const [previous] = await db.select().from(warehouseLocations).where(eq(warehouseLocations.id, req.params.id));
      if (!previous) return res.status(404).json({ message: "Warehouse location not found" });
      const [updated] = await db.update(warehouseLocations).set(input).where(eq(warehouseLocations.id, req.params.id)).returning();
      if (!updated) return res.status(404).json({ message: "Warehouse location not found" });
      await logAudit(req.user?.id, "UPDATE", "warehouse_locations", updated.id, updated.name, previous, updated, req);
      res.json(updated);
    } catch (error) {
      if (error instanceof z.ZodError) return res.status(400).json({ message: "Invalid warehouse location", errors: error.issues });
      if ((error as any)?.code === "23505") return res.status(409).json({ message: "Warehouse code is already in use" });
      respondWithApiError(res, error, "Failed to update warehouse location");
    }
  };

  app.patch("/api/warehouse-locations/:id", requireAuth, requireModule("asset_management"), requirePermission("asset_update"), async (req, res) => {
    await updateWarehouseLocation(req, res);
  });
  app.put("/api/warehouse-locations/:id", requireAuth, requireModule("asset_management"), requirePermission("asset_update"), updateWarehouseLocation);
  app.put("/api/warehouses/:id", requireAuth, requireModule("asset_management"), requirePermission("asset_update"), updateWarehouseLocation);

  app.get("/api/consumables/options", requireAuth, requireModule("asset_management"), async (_req, res) => {
    try {
      const [locations, vendorRows, userRows] = await Promise.all([
        db.select().from(warehouseLocations).where(eq(warehouseLocations.isActive, true)).orderBy(warehouseLocations.name),
        db.select({ id: vendors.id, name: vendors.name }).from(vendors),
        db.select({ id: users.id, firstName: users.firstName, lastName: users.lastName, username: users.username, email: users.email }).from(users).where(eq(users.isActive, true)),
      ]);
      res.json({
        locations,
        vendors: vendorRows,
        users: userRows.map(user => ({ id: user.id, name: [user.firstName, user.lastName].filter(Boolean).join(" ") || user.username, email: user.email })),
      });
    } catch (error) {
      respondWithApiError(res, error, "Failed to fetch consumables options");
    }
  });

  app.get("/api/consumables", requireAuth, requireModule("asset_management"), async (_req, res) => {
    try {
      const rows = await db.select({
        id: consumables.id,
        name: consumables.name,
        category: consumables.category,
        modelPartNumber: consumables.modelPartNumber,
        quantityInStock: consumables.quantityInStock,
        minReorderLevel: consumables.minReorderLevel,
        warehouseLocationId: consumables.warehouseLocationId,
        storageRoom: consumables.storageRoom,
        unitCost: consumables.unitCost,
        vendorId: consumables.vendorId,
        createdAt: consumables.createdAt,
        updatedAt: consumables.updatedAt,
        warehouseName: warehouseLocations.name,
        warehouseCode: warehouseLocations.code,
        warehouseIsActive: warehouseLocations.isActive,
        vendorName: vendors.name,
      }).from(consumables)
        .leftJoin(warehouseLocations, eq(warehouseLocations.id, consumables.warehouseLocationId))
        .leftJoin(vendors, eq(vendors.id, consumables.vendorId))
        .orderBy(consumables.name, warehouseLocations.name);
      res.json(rows);
    } catch (error) {
      respondWithApiError(res, error, "Failed to fetch consumables");
    }
  });

  app.post("/api/consumables", requireAuth, requireModule("asset_management"), requirePermission("asset_create"), async (req, res) => {
    try {
      const input = insertConsumableSchema.parse(req.body);
      const created = await db.transaction(async tx => {
        const [location] = await tx.select({ id: warehouseLocations.id }).from(warehouseLocations)
          .where(and(eq(warehouseLocations.id, input.warehouseLocationId), eq(warehouseLocations.isActive, true))).for("update");
        if (!location) throw Object.assign(new Error("Select an active warehouse location"), { status: 400 });
        const [item] = await tx.insert(consumables).values({ ...input, storageRoom: input.storageRoom || null }).returning();
        await tx.insert(consumableStockMovements).values({
          consumableId: item.id,
          movementType: "adjustment",
          quantity: item.quantityInStock,
          toWarehouseLocationId: item.warehouseLocationId,
          actorId: req.user!.id,
          notes: "Opening stock",
        });
        return item;
      });
      res.status(201).json(created);
    } catch (error) {
      if (error instanceof z.ZodError) return res.status(400).json({ message: "Invalid consumable", errors: error.issues });
      if ((error as any)?.status) return res.status((error as any).status).json({ message: (error as any).message });
      respondWithApiError(res, error, "Failed to create consumable");
    }
  });

  app.patch("/api/consumables/:id", requireAuth, requireModule("asset_management"), requirePermission("asset_update"), async (req, res) => {
    try {
      const input = insertConsumableSchema.partial().omit({ quantityInStock: true }).parse(req.body);
      const updated = await db.transaction(async tx => {
        const [current] = await tx.select({ id: consumables.id, warehouseLocationId: consumables.warehouseLocationId })
          .from(consumables).where(eq(consumables.id, req.params.id)).for("update");
        if (!current) return null;
        if (input.warehouseLocationId && input.warehouseLocationId !== current.warehouseLocationId) {
          const [activeLocation] = await tx.select({ id: warehouseLocations.id }).from(warehouseLocations)
            .where(and(eq(warehouseLocations.id, input.warehouseLocationId), eq(warehouseLocations.isActive, true))).for("update");
          if (!activeLocation) throw Object.assign(new Error("New inventory cannot be assigned to a disabled warehouse"), { status: 400 });
        }
        const [item] = await tx.update(consumables).set({ ...input, updatedAt: new Date() })
          .where(eq(consumables.id, req.params.id)).returning();
        return item;
      });
      if (!updated) return res.status(404).json({ message: "Consumable not found" });
      res.json(updated);
    } catch (error) {
      if (error instanceof z.ZodError) return res.status(400).json({ message: "Invalid consumable", errors: error.issues });
      if ((error as any)?.status) return res.status((error as any).status).json({ message: (error as any).message });
      respondWithApiError(res, error, "Failed to update consumable");
    }
  });

  app.post("/api/consumables/:id/stock-movement", requireAuth, requireModule("asset_management"), requirePermission("asset_update"), async (req, res) => {
    const movementSchema = z.discriminatedUnion("movementType", [
      z.object({ movementType: z.literal("issue"), quantity: z.number().int().positive(), recipientUserId: z.string().uuid(), notes: z.string().trim().max(2000).optional() }),
      z.object({ movementType: z.literal("transfer"), quantity: z.number().int().positive(), toWarehouseLocationId: z.string().uuid(), notes: z.string().trim().max(2000).optional() }),
      z.object({
        movementType: z.literal("adjustment"),
        direction: z.enum(["increase", "decrease"]),
        quantity: z.number().int().positive(),
        reasonCode: z.enum(["cycle_count", "damage", "correction", "found_stock", "other"]),
        notes: z.string().trim().max(2000).optional(),
      }).superRefine((input, context) => {
        if (input.reasonCode === "other" && !input.notes?.trim()) {
          context.addIssue({ code: z.ZodIssueCode.custom, path: ["notes"], message: "Add an audit note when the reason is Other" });
        }
      }),
    ]);
    try {
      const input = movementSchema.parse(req.body);
      const result = await db.transaction(async tx => {
        const [source] = await tx.select().from(consumables).where(eq(consumables.id, req.params.id)).for("update");
        if (!source) throw Object.assign(new Error("Consumable not found"), { status: 404 });
        const [sourceLocation] = await tx.select({ id: warehouseLocations.id }).from(warehouseLocations)
          .where(and(eq(warehouseLocations.id, source.warehouseLocationId), eq(warehouseLocations.isActive, true))).for("update");
        if (!sourceLocation) throw Object.assign(new Error("Stock movements are blocked for a disabled warehouse"), { status: 409 });
        if (input.movementType === "issue") {
          if (source.quantityInStock < input.quantity) throw Object.assign(new Error("Not enough stock is available"), { status: 409 });
          const [recipient] = await tx.select({ id: users.id }).from(users).where(and(eq(users.id, input.recipientUserId), eq(users.isActive, true)));
          if (!recipient) throw Object.assign(new Error("Select an active employee"), { status: 400 });
          const [updated] = await tx.update(consumables).set({
            quantityInStock: source.quantityInStock - input.quantity,
            updatedAt: new Date(),
          }).where(eq(consumables.id, source.id)).returning();
          const [movement] = await tx.insert(consumableStockMovements).values({
            consumableId: source.id, movementType: "issue", quantity: input.quantity,
            fromWarehouseLocationId: source.warehouseLocationId, recipientUserId: input.recipientUserId,
            actorId: req.user!.id, notes: input.notes || null,
          }).returning();
          return { consumable: updated, movement };
        }

        if (input.movementType === "adjustment") {
          if (input.direction === "decrease" && source.quantityInStock < input.quantity) {
            throw Object.assign(new Error("Stock adjustment cannot reduce inventory below zero"), { status: 409 });
          }
          const adjustedQuantity = source.quantityInStock + (input.direction === "increase" ? input.quantity : -input.quantity);
          const [updated] = await tx.update(consumables).set({
            quantityInStock: adjustedQuantity,
            updatedAt: new Date(),
          }).where(eq(consumables.id, source.id)).returning();
          const [movement] = await tx.insert(consumableStockMovements).values({
            consumableId: source.id,
            movementType: input.direction === "increase" ? "adjustment_in" : "adjustment_out",
            reasonCode: input.reasonCode,
            quantity: input.quantity,
            fromWarehouseLocationId: input.direction === "decrease" ? source.warehouseLocationId : null,
            toWarehouseLocationId: input.direction === "increase" ? source.warehouseLocationId : null,
            actorId: req.user!.id,
            notes: input.notes?.trim() || null,
          }).returning();
          return { consumable: updated, movement };
        }

        if (source.quantityInStock < input.quantity) throw Object.assign(new Error("Not enough stock is available"), { status: 409 });
        const [destination] = await tx.select({ id: warehouseLocations.id }).from(warehouseLocations)
          .where(and(eq(warehouseLocations.id, input.toWarehouseLocationId), eq(warehouseLocations.isActive, true))).for("update");
        if (!destination) throw Object.assign(new Error("Select an active destination location"), { status: 400 });
        if (source.warehouseLocationId === input.toWarehouseLocationId) throw Object.assign(new Error("Choose a different destination location"), { status: 400 });
        const [updatedSource] = await tx.update(consumables).set({
          quantityInStock: source.quantityInStock - input.quantity,
          updatedAt: new Date(),
        }).where(eq(consumables.id, source.id)).returning();
        const destinationRows = await tx.select().from(consumables).where(eq(consumables.warehouseLocationId, input.toWarehouseLocationId)).for("update");
        let destinationItem = destinationRows.find(row =>
          row.name.toLocaleLowerCase() === source.name.toLocaleLowerCase() &&
          (row.modelPartNumber ?? "").toLocaleLowerCase() === (source.modelPartNumber ?? "").toLocaleLowerCase()
        );
        if (destinationItem) {
          [destinationItem] = await tx.update(consumables).set({
            quantityInStock: destinationItem.quantityInStock + input.quantity,
            updatedAt: new Date(),
          }).where(eq(consumables.id, destinationItem.id)).returning();
        } else {
          [destinationItem] = await tx.insert(consumables).values({
            name: source.name, category: source.category, modelPartNumber: source.modelPartNumber,
            quantityInStock: input.quantity, minReorderLevel: source.minReorderLevel,
            warehouseLocationId: input.toWarehouseLocationId, storageRoom: null,
            unitCost: source.unitCost, vendorId: source.vendorId,
          }).returning();
        }
        const [movement] = await tx.insert(consumableStockMovements).values({
          consumableId: source.id, movementType: "transfer", quantity: input.quantity,
          fromWarehouseLocationId: source.warehouseLocationId, toWarehouseLocationId: input.toWarehouseLocationId,
          actorId: req.user!.id, notes: input.notes || null,
        }).returning();
        return { consumable: updatedSource, destination: destinationItem, movement };
      });
      await logAudit(req.user?.id, "UPDATE", "consumables", result.consumable.id, result.consumable.name, null, result, req);
      res.status(201).json(result);
    } catch (error) {
      if (error instanceof z.ZodError) return res.status(400).json({ message: "Invalid stock movement", errors: error.issues });
      const status = (error as any)?.status;
      if (status) return res.status(status).json({ message: (error as Error).message });
      respondWithApiError(res, error, "Failed to save stock movement");
    }
  });

  app.post("/api/consumables/:id/draft-purchase-order", requireAuth, requireModule("asset_management"), requirePermission("purchase_order_create"), async (req, res) => {
    try {
      const [item] = await db.select().from(consumables).where(eq(consumables.id, req.params.id));
      if (!item) return res.status(404).json({ message: "Consumable not found" });
      const [location] = await db.select({ name: warehouseLocations.name }).from(warehouseLocations)
        .where(and(eq(warehouseLocations.id, item.warehouseLocationId), eq(warehouseLocations.isActive, true)));
      if (!location) return res.status(400).json({ message: "Select an active warehouse before creating a draft purchase order" });
      const vendorName = item.vendorId ? (await storage.getVendor(item.vendorId))?.name ?? null : null;
      const shortage = Math.max(item.minReorderLevel * 2 - item.quantityInStock, 1);
      const po = await db.transaction(async tx => {
        const poNumber = await reserveFinancialDocumentNumber(tx, "purchase_order", req.body?.poNumber);
        const [order] = await tx.insert(purchaseOrders).values({
          poNumber,
          vendorId: item.vendorId,
          vendor: vendorName,
          reference: `Low stock reorder: ${item.name}`,
          orderDate: new Date().toISOString().slice(0, 10),
          expectedDelivery: null,
          actualDelivery: null,
          totalAmount: (Number(item.unitCost) * shortage).toFixed(2),
          status: "pending",
          departmentId: null,
          notes: `Draft reorder for ${location.name}; current stock ${item.quantityInStock}, minimum ${item.minReorderLevel}.`,
          assetsCreated: false,
        }).returning();
        await tx.insert(purchaseOrderItems).values({
          purchaseOrderId: order.id,
          description: item.name,
          assetType: "other",
          itemType: "consumable",
          consumableId: item.id,
          consumableCategory: item.category,
          modelPartNumber: item.modelPartNumber,
          warehouseLocationId: item.warehouseLocationId,
          serialNumber: null,
          quantity: shortage,
          unitPrice: item.unitCost,
          discountType: "fixed",
          discountValue: "0.00",
          discountAmount: "0.00",
          taxRate: "0.0000",
          taxInclusive: false,
          totalPrice: (Number(item.unitCost) * shortage).toFixed(2),
          assetId: null,
        });
        return order;
      });
      res.status(201).json(po);
    } catch (error) {
      const status = (error as any)?.status;
      if (status) return res.status(status).json({ message: (error as Error).message });
      const code = (error as any)?.code ?? (error as any)?.cause?.code;
      if (code === "23505") return res.status(409).json({ message: "Purchase-order number already exists" });
      console.error("Reorder draft creation failed:", error);
      respondWithApiError(res, error, "Failed to create draft purchase order");
    }
  });

  app.get("/api/purchase-orders", requireAuth, requireAnyPermission("finance_view", "purchase_order_create", "purchase_order_update", "budget_create", "budget_update", "system_admin"), async (req, res) => {
    try {
      const purchaseOrders = await storage.getPurchaseOrdersWithDetails();
      res.json(purchaseOrders);
    } catch (error) {
      respondWithApiError(res, error, "Failed to fetch purchase orders");
    }
  });

  app.post("/api/purchase-orders", requireAuth, requirePermission('purchase_order_create'), async (req, res) => {
    try {
      // Extract items from request body as they're not part of the purchase order schema
      const { items, ...purchaseOrderData } = req.body;
      const lineSchema = z.object({
        description: z.string().trim().min(1),
        assetType: z.string().nullable().optional(),
        itemType: z.enum(["asset", "consumable"]).default("asset"),
        consumableId: z.union([z.string().uuid(), z.literal("")]).nullable().optional(),
        consumableCategory: z.string().trim().max(100).nullable().optional(),
        modelPartNumber: z.string().trim().max(160).nullable().optional(),
        warehouseLocationId: z.union([z.string().uuid(), z.literal("")]).nullable().optional(),
        serialNumber: z.string().nullable().optional(),
        quantity: z.coerce.number().int().min(1).max(100000),
        unitPrice: z.coerce.number().min(0),
        discountType: z.enum(["fixed", "percentage"]).default("fixed"),
        discountValue: z.coerce.number().min(0).default(0),
        taxRate: z.coerce.number().min(0).max(100).optional(),
        taxInclusive: z.boolean().optional(),
        assetId: z.union([z.string().uuid(), z.literal("")]).nullable().optional(),
      });
      const itemInputs = z.array(lineSchema).min(1).max(500).parse(items ?? []);
      if (itemInputs.some(item => item.itemType === "consumable" && !item.warehouseLocationId)) {
        return res.status(400).json({ message: "Consumable PO lines require a warehouse location" });
      }
      const requestedWarehouseIds = Array.from(new Set(itemInputs.filter(item => item.itemType === "consumable").map(item => item.warehouseLocationId!).filter(Boolean)));
      if (requestedWarehouseIds.length) {
        const activeWarehouses = await db.select({ id: warehouseLocations.id }).from(warehouseLocations)
          .where(and(inArray(warehouseLocations.id, requestedWarehouseIds), eq(warehouseLocations.isActive, true)));
        if (activeWarehouses.length !== requestedWarehouseIds.length) return res.status(400).json({ message: "Consumable PO lines must use active warehouses" });
      }
      const financeDefaults = await getDefaultFinancialProfile();
      const validatedData = insertPurchaseOrderSchema.extend({
        poNumber: z.string().trim().min(1).max(100).optional(),
        currency: z.string().regex(/^[A-Z]{3}$/).default("USD"),
        taxMode: z.enum(["exclusive", "inclusive"]).default("exclusive"),
        taxRate: z.coerce.number().min(0).max(100).default(0),
        documentDiscountType: z.enum(["fixed", "percentage"]).default("fixed"),
        documentDiscountValue: z.coerce.number().min(0).default(0),
      }).parse({
        currency: financeDefaults.currencyCode,
        taxRate: financeDefaults.defaultTaxRate,
        taxMode: financeDefaults.defaultTaxMode,
        ...purchaseOrderData,
      });
      if (validatedData.status && validatedData.status !== "pending") {
        return res.status(409).json({ message: "New purchase orders must start in Pending review" });
      }
      const totals = calculateDocumentTotals(itemInputs.map(item => ({
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        discountType: item.discountType,
        discountValue: item.discountValue,
        taxRate: item.taxRate ?? validatedData.taxRate,
        taxInclusive: item.taxInclusive ?? validatedData.taxMode === "inclusive",
      })), validatedData.documentDiscountType, validatedData.documentDiscountValue);
      if (Math.abs(totals.grandTotal - Number(validatedData.totalAmount)) > 0.01) {
        return res.status(400).json({ message: "Purchase order total must match line discounts and tax settings" });
      }
      let sourceQuoteNumber: string | undefined;
      const purchaseOrder = await db.transaction(async tx => {
        const poNumber = await reserveFinancialDocumentNumber(tx, "purchase_order", validatedData.poNumber);
        if (validatedData.quotationId) {
          const [quotation] = await tx.select().from(vendorQuotations).where(eq(vendorQuotations.id, validatedData.quotationId)).for("update");
          if (!quotation || quotation.status !== "accepted") throw Object.assign(new Error("Only an accepted, unconverted quotation can be imported"), { status: 409 });
          if (quotation.vendorId !== validatedData.vendorId || quotation.currency !== validatedData.currency) throw Object.assign(new Error("The PO supplier and currency must match the imported quotation"), { status: 400 });
          const [existingOrder] = await tx.select({ id: purchaseOrders.id }).from(purchaseOrders).where(eq(purchaseOrders.quotationId, quotation.id));
          if (existingOrder) throw Object.assign(new Error("This quotation has already been converted to a purchase order"), { status: 409 });
          const quoteItems = await tx.select().from(vendorQuotationItems).where(eq(vendorQuotationItems.quotationId, quotation.id));
          const moneyEquals = (left: unknown, right: unknown) => Math.round(Number(left ?? 0) * 100) === Math.round(Number(right ?? 0) * 100);
          const sameItems = quoteItems.length === itemInputs.length && quoteItems.every((quoteItem, index) => {
            const poItem = itemInputs[index];
            return quoteItem.description === poItem.description &&
              quoteItem.itemType === poItem.itemType &&
              quoteItem.quantity === poItem.quantity &&
              moneyEquals(quoteItem.unitPrice, poItem.unitPrice) &&
              (quoteItem.consumableId ?? null) === (poItem.consumableId || null) &&
              (quoteItem.consumableCategory ?? null) === (poItem.consumableCategory || null) &&
              (quoteItem.modelPartNumber ?? null) === (poItem.modelPartNumber || null) &&
              (quoteItem.warehouseLocationId ?? null) === (poItem.warehouseLocationId || null) &&
              quoteItem.discountType === poItem.discountType &&
              moneyEquals(quoteItem.discountValue, poItem.discountValue) &&
              moneyEquals(quoteItem.taxRate ?? quotation.taxRate, poItem.taxRate ?? validatedData.taxRate) &&
              Boolean(quoteItem.taxInclusive ?? quotation.taxMode === "inclusive") === Boolean(poItem.taxInclusive ?? validatedData.taxMode === "inclusive");
          });
          if (!sameItems) throw Object.assign(new Error("Purchase-order lines must match the accepted quotation; create a revised quotation for changes"), { status: 409 });
          sourceQuoteNumber = quotation.quoteNumber;
        }
        const [order] = await tx.insert(purchaseOrders).values({
          ...validatedData,
          reference: sourceQuoteNumber ? `Quotation ${sourceQuoteNumber}` : validatedData.reference,
          poNumber,
          status: "pending",
          expectedDelivery: validatedData.expectedDelivery || null,
          actualDelivery: null,
          departmentId: validatedData.departmentId || null,
          subtotal: totals.subtotal.toFixed(2),
          taxRate: Number(validatedData.taxRate).toFixed(4),
          documentDiscountValue: Number(validatedData.documentDiscountValue).toFixed(2),
          documentDiscountAmount: totals.documentDiscountAmount.toFixed(2),
          taxAmount: totals.taxAmount.toFixed(2),
          totalAmount: totals.grandTotal.toFixed(2),
          assetsCreated: false,
        }).returning();
        await tx.insert(purchaseOrderItems).values(itemInputs.map((item, index) => ({
            purchaseOrderId: order.id,
            description: item.description,
            assetType: item.assetType || "other",
            itemType: item.itemType,
            consumableId: item.consumableId || null,
            consumableCategory: item.consumableCategory || null,
            modelPartNumber: item.modelPartNumber || null,
            warehouseLocationId: item.warehouseLocationId || null,
            serialNumber: item.serialNumber || null,
            quantity: item.quantity,
            unitPrice: item.unitPrice.toString(),
            discountType: item.discountType,
            discountValue: item.discountValue.toFixed(2),
            discountAmount: totals.lines[index].discountAmount.toFixed(2),
            taxRate: Number(item.taxRate ?? validatedData.taxRate).toFixed(4),
            taxInclusive: item.taxInclusive ?? validatedData.taxMode === "inclusive",
            totalPrice: totals.lines[index].totalAmount.toFixed(2),
            assetId: item.assetId || null,
          })));
        if (validatedData.quotationId) {
          await tx.update(vendorQuotations).set({ status: "converted", updatedAt: new Date() }).where(eq(vendorQuotations.id, validatedData.quotationId));
        }
        return order;
      });
      
      // Log audit
      await logAudit(req.user?.id, 'CREATE', 'purchase_orders', purchaseOrder.id, `PO #${purchaseOrder.poNumber}`, null, { poNumber: purchaseOrder.poNumber, totalAmount: purchaseOrder.totalAmount, status: purchaseOrder.status }, req);

      // Sync budget spent amount for the linked department
      if (purchaseOrder.departmentId) {
        const currentYear = new Date().getFullYear();
        const deptBudgets = await storage.getBudgetsByDepartment(purchaseOrder.departmentId);
        const budget = deptBudgets.find(b => b.fiscalYear === currentYear);
        if (budget) {
          const allPOs = await storage.getPurchaseOrdersWithDetails();
          const deptPOTotal = allPOs
            .filter(p => p.departmentId === purchaseOrder.departmentId && p.status !== 'cancelled')
            .reduce((sum, p) => sum + parseFloat(p.totalAmount || '0'), 0);
          await storage.updateBudget(budget.id, { spentAmount: deptPOTotal.toFixed(2) });
        }
      }

      res.status(201).json(purchaseOrder);
    } catch (error) {
      if (error instanceof ProcurementPricingError) return res.status(400).json({ message: error.message });
      if ((error as any)?.status) return res.status((error as any).status).json({ message: (error as Error).message });
      console.error("Purchase order creation error:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid purchase order data", errors: error.issues });
      }
      respondWithApiError(res, error, "Failed to create purchase order");
    }
  });

  app.put("/api/purchase-orders/:id", requireAuth, requirePermission('purchase_order_update'), async (req, res) => {
    try {
      const { items, ...purchaseOrderData } = req.body;
      const itemInputs = items === undefined ? undefined : z.array(z.object({
        description: z.string().trim().min(1),
        assetType: z.string().nullable().optional(),
        itemType: z.enum(["asset", "consumable"]).default("asset"),
        consumableId: z.union([z.string().uuid(), z.literal("")]).nullable().optional(),
        consumableCategory: z.string().trim().max(100).nullable().optional(),
        modelPartNumber: z.string().trim().max(160).nullable().optional(),
        warehouseLocationId: z.union([z.string().uuid(), z.literal("")]).nullable().optional(),
        serialNumber: z.string().nullable().optional(),
        quantity: z.coerce.number().int().min(1).max(100000),
        unitPrice: z.coerce.number().min(0),
        discountType: z.enum(["fixed", "percentage"]).default("fixed"),
        discountValue: z.coerce.number().min(0).default(0),
        taxRate: z.coerce.number().min(0).max(100).optional(),
        taxInclusive: z.boolean().optional(),
        assetId: z.union([z.string().uuid(), z.literal("")]).nullable().optional(),
      })).parse(items);
      if (itemInputs?.some(item => item.itemType === "consumable" && !item.warehouseLocationId)) {
        return res.status(400).json({ message: "Consumable PO lines require a warehouse location" });
      }
      const requestedWarehouseIds = Array.from(new Set((itemInputs ?? []).filter(item => item.itemType === "consumable").map(item => item.warehouseLocationId!).filter(Boolean)));
      if (requestedWarehouseIds.length) {
        const activeWarehouses = await db.select({ id: warehouseLocations.id }).from(warehouseLocations)
          .where(and(inArray(warehouseLocations.id, requestedWarehouseIds), eq(warehouseLocations.isActive, true)));
        if (activeWarehouses.length !== requestedWarehouseIds.length) return res.status(400).json({ message: "Consumable PO lines must use active warehouses" });
      }
      let validatedData = insertPurchaseOrderSchema.partial().extend({
        currency: z.string().regex(/^[A-Z]{3}$/).optional(),
        taxMode: z.enum(["exclusive", "inclusive"]).optional(),
        taxRate: z.coerce.number().min(0).max(100).optional(),
        documentDiscountType: z.enum(["fixed", "percentage"]).optional(),
        documentDiscountValue: z.coerce.number().min(0).optional(),
      }).parse(purchaseOrderData);
      
      const oldPO = await storage.getPurchaseOrder(req.params.id);
      if (!oldPO) return res.status(404).json({ message: "Purchase order not found" });
      if (oldPO.status !== "pending" && Object.keys(purchaseOrderData).some(key => key !== "status")) {
        return res.status(409).json({ message: "Approved, ordered, received, and cancelled purchase-order details are locked; only permitted lifecycle actions are allowed" });
      }
      if (validatedData.quotationId !== undefined && validatedData.quotationId !== oldPO.quotationId) {
        return res.status(409).json({ message: "Import quotations when creating the purchase order; the source quotation cannot be replaced afterward" });
      }
      if (itemInputs === undefined && ["totalAmount", "taxRate", "taxMode", "documentDiscountType", "documentDiscountValue", "taxAmount", "subtotal"].some(key => key in purchaseOrderData)) {
        return res.status(400).json({ message: "Include PO lines when editing pricing so totals can be recalculated safely" });
      }
      const requestedStatus = validatedData.status;
      if (requestedStatus && requestedStatus !== oldPO.status) {
        if (requestedStatus === "received") {
          return res.status(409).json({ message: "Received status is set automatically when a matched purchase invoice is processed" });
        }
        if (!canTransitionPurchaseOrder(oldPO.status, requestedStatus)) {
          return res.status(409).json({ message: `Purchase order cannot transition from ${oldPO.status} to ${requestedStatus}` });
        }
      }
      if (oldPO?.assetsCreated && itemInputs !== undefined) {
        return res.status(409).json({ message: "Received PO items cannot be changed after inventory processing" });
      }
      if (itemInputs !== undefined && oldPO.status !== "pending") {
        return res.status(409).json({ message: "PO lines and pricing can only be edited while the purchase order is Pending" });
      }
      let updatedTotals: ReturnType<typeof calculateDocumentTotals> | undefined;
      if (itemInputs) {
        updatedTotals = calculateDocumentTotals(itemInputs.map(item => ({
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          discountType: item.discountType,
          discountValue: item.discountValue,
          taxRate: item.taxRate ?? Number(validatedData.taxRate ?? oldPO.taxRate),
          taxInclusive: item.taxInclusive ?? (validatedData.taxMode ?? oldPO.taxMode) === "inclusive",
        })), validatedData.documentDiscountType ?? (oldPO.documentDiscountType === "percentage" ? "percentage" : "fixed"), Number(validatedData.documentDiscountValue ?? oldPO.documentDiscountValue));
        if (validatedData.totalAmount !== undefined && Math.abs(updatedTotals.grandTotal - Number(validatedData.totalAmount)) > 0.01) {
          return res.status(400).json({ message: "Purchase order total must match line discounts and tax settings" });
        }
        validatedData = {
          ...validatedData,
          subtotal: updatedTotals.subtotal.toFixed(2),
          taxAmount: updatedTotals.taxAmount.toFixed(2),
          totalAmount: updatedTotals.grandTotal.toFixed(2),
          documentDiscountAmount: updatedTotals.documentDiscountAmount.toFixed(2),
          taxRate: Number(validatedData.taxRate ?? oldPO.taxRate),
          documentDiscountValue: Number(validatedData.documentDiscountValue ?? oldPO.documentDiscountValue),
        } as typeof validatedData;
      }
      
      const { taxRate: updatedTaxRate, documentDiscountValue: updatedDiscountValue, ...otherUpdates } = validatedData;
      const updatePayload = {
        ...otherUpdates,
        ...(updatedTaxRate !== undefined ? { taxRate: updatedTaxRate.toFixed(4) } : {}),
        ...(updatedDiscountValue !== undefined ? { documentDiscountValue: updatedDiscountValue.toFixed(2) } : {}),
        ...(otherUpdates.expectedDelivery === "" ? { expectedDelivery: null } : {}),
      };
      const purchaseOrder = await db.transaction(async tx => {
        const [lockedOrder] = await tx.select().from(purchaseOrders).where(eq(purchaseOrders.id, req.params.id)).for("update");
        if (!lockedOrder || lockedOrder.status !== oldPO.status) throw Object.assign(new Error("The purchase order changed during editing; refresh and retry"), { status: 409 });
        if (requestedStatus === "cancelled") {
          const [invoice] = await tx.select({ id: purchaseInvoices.id }).from(purchaseInvoices).where(and(eq(purchaseInvoices.purchaseOrderId, lockedOrder.id), sql`${purchaseInvoices.status} <> 'void'`));
          if (invoice) throw Object.assign(new Error("Void any open supplier invoices before cancelling this purchase order"), { status: 409 });
        }
        const [updated] = await tx.update(purchaseOrders).set(updatePayload).where(eq(purchaseOrders.id, req.params.id)).returning();
        if (itemInputs) {
          await tx.delete(purchaseOrderItems).where(eq(purchaseOrderItems.purchaseOrderId, updated.id));
          await tx.insert(purchaseOrderItems).values(itemInputs.map((item, index) => ({
            purchaseOrderId: updated.id,
            description: item.description,
            assetType: item.assetType || "other",
            itemType: item.itemType,
            consumableId: item.consumableId || null,
            consumableCategory: item.consumableCategory || null,
            modelPartNumber: item.modelPartNumber || null,
            warehouseLocationId: item.warehouseLocationId || null,
            serialNumber: item.serialNumber || null,
            quantity: item.quantity,
            unitPrice: item.unitPrice.toString(),
            discountType: item.discountType,
            discountValue: item.discountValue.toFixed(2),
            discountAmount: updatedTotals!.lines[index].discountAmount.toFixed(2),
            taxRate: Number(item.taxRate ?? validatedData.taxRate ?? oldPO.taxRate).toFixed(4),
            taxInclusive: item.taxInclusive ?? (validatedData.taxMode ?? oldPO.taxMode) === "inclusive",
            totalPrice: updatedTotals!.lines[index].totalAmount.toFixed(2),
            assetId: item.assetId || null,
          })));
        }
        return updated;
      });
      
      // Log audit
      if (oldPO) {
        await logAudit(req.user?.id, 'UPDATE', 'purchase_orders', purchaseOrder.id, `PO #${purchaseOrder.poNumber}`, oldPO, purchaseOrder, req);
      }

      // Sync budget spent amount for affected departments
      const affectedDepts = Array.from(new Set([purchaseOrder.departmentId, oldPO?.departmentId].filter(Boolean)));
      for (const deptId of affectedDepts) {
        if (!deptId) continue;
        const currentYear = new Date().getFullYear();
        const deptBudgets = await storage.getBudgetsByDepartment(deptId);
        const budget = deptBudgets.find(b => b.fiscalYear === currentYear);
        if (budget) {
          const allPOs = await storage.getPurchaseOrdersWithDetails();
          const deptPOTotal = allPOs
            .filter(p => p.departmentId === deptId && p.status !== 'cancelled')
            .reduce((sum, p) => sum + parseFloat(p.totalAmount || '0'), 0);
          await storage.updateBudget(budget.id, { spentAmount: deptPOTotal.toFixed(2) });
        }
      }

      res.json(purchaseOrder);
    } catch (error) {
      if (error instanceof ProcurementPricingError) return res.status(400).json({ message: error.message });
      if ((error as any)?.status) return res.status((error as any).status).json({ message: (error as Error).message });
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid purchase order data", errors: error.issues });
      }
      respondWithApiError(res, error, "Failed to update purchase order");
    }
  });

  app.delete("/api/purchase-orders/:id", requireAuth, requirePermission('purchase_order_delete'), async (req, res) => {
    try {
      const purchaseOrder = await storage.getPurchaseOrder(req.params.id);
      if (!purchaseOrder) {
        return res.status(404).json({ message: "Purchase order not found" });
      }

      if (purchaseOrder.assetsCreated) {
        const permissions = await storage.getUserPermissions(req.user!.id);
        const isSystemAdmin = permissions.includes('system_admin');

        if (!isSystemAdmin) {
          return res.status(403).json({
            message: "This purchase order has created assets and cannot be deleted. Contact a system administrator if you need to remove it.",
          });
        }

        if (req.body?.confirmAdminDelete !== true) {
          return res.status(400).json({
            message: "This purchase order has created assets. Confirm admin deletion to proceed.",
            requiresConfirmation: true,
          });
        }

        // Unlink assets instead of deleting them, to preserve assignment/maintenance/depreciation history
        const linkedAssets = await storage.getAssetsByPurchaseOrderNumber(purchaseOrder.poNumber);
        for (const asset of linkedAssets) {
          await storage.updateAsset(asset.id, { purchaseOrderNumber: null });
        }

        await logAudit(req.user?.id, 'UPDATE', 'assets', purchaseOrder.id, `Unlinked ${linkedAssets.length} asset(s) from deleted PO #${purchaseOrder.poNumber}`, null, { count: linkedAssets.length }, req);
      }

      // Delete items first
      const items = await storage.getPurchaseOrderItems(req.params.id);
      for (const item of items) {
        await storage.deletePurchaseOrderItem(item.id);
      }
      
      // Delete purchase order
      const deleted = await storage.deletePurchaseOrder(req.params.id);
      if (!deleted) {
        return res.status(404).json({ message: "Purchase order not found" });
      }
      
      // Log audit
      await logAudit(req.user?.id, 'DELETE', 'purchase_orders', purchaseOrder.id, `PO #${purchaseOrder.poNumber}`, purchaseOrder, null, req);
      
      res.status(204).send();
    } catch (error) {
      respondWithApiError(res, error, "Failed to delete purchase order");
    }
  });

  // Legacy-only recovery endpoint for older, already-received POs. New receipts
  // are created atomically by matched invoice saves; restrict recovery to admins.
  app.post("/api/purchase-orders/:id/create-assets", requireAuth, requirePermission("system_admin"), async (req, res) => {
    try {
      const po = await storage.getPurchaseOrder(req.params.id);
      if (!po) return res.status(404).json({ message: "Purchase order not found" });
      if (po.status !== 'received') return res.status(400).json({ message: "Purchase order must be received before inventory can be processed" });
      if (po.assetsCreated) return res.status(409).json({ message: "Inventory has already been processed for this purchase order" });

      const items = await storage.getPurchaseOrderItems(req.params.id);
      if (!items.length) return res.status(400).json({ message: "No items found in purchase order" });
      if (items.some(item => item.itemType === "consumable" && !item.warehouseLocationId)) {
        return res.status(400).json({ message: "Every consumable PO line must have a warehouse location" });
      }

      // Look up vendor name if vendorId is present
      let vendorName = po.vendor || '';
      if (po.vendorId) {
        const vendors = await storage.getVendors();
        const vendor = vendors.find(v => v.id === po.vendorId);
        if (vendor) vendorName = vendor.name;
      }

      const unprocessedIds = new Set((await db.select({ id: purchaseOrderItemReceipts.purchaseOrderItemId })
        .from(purchaseOrderItemReceipts).where(eq(purchaseOrderItemReceipts.purchaseOrderId, po.id))).map(row => row.id));
      const assetItems = items.filter(item => item.itemType !== "consumable" && !unprocessedIds.has(item.id));
      const allocatedTags = new Map<string, string[]>();
      for (const item of assetItems) {
        const tags = [];
        for (let unit = 0; unit < (item.quantity || 1); unit++) {
          tags.push(`ASSET-${String(await storage.getNextAssetIdNumber()).padStart(4, "0")}`);
        }
        allocatedTags.set(item.id, tags);
      }

      const received = await db.transaction(async tx => {
        const [lockedPO] = await tx.select().from(purchaseOrders).where(eq(purchaseOrders.id, po.id)).for("update");
        if (!lockedPO) throw Object.assign(new Error("Purchase order not found"), { status: 404 });
        if (lockedPO.status !== "received") throw Object.assign(new Error("Purchase order must be received before inventory can be processed"), { status: 400 });
        if (lockedPO.assetsCreated) throw Object.assign(new Error("Inventory has already been processed for this purchase order"), { status: 409 });

        const createdAssets: any[] = [];
        let stockUnits = 0;
        for (const item of items) {
          const [receipt] = await tx.select({ id: purchaseOrderItemReceipts.id }).from(purchaseOrderItemReceipts)
            .where(eq(purchaseOrderItemReceipts.purchaseOrderItemId, item.id));
          if (receipt) continue;
          const quantity = item.quantity || 1;
          if (item.itemType === "consumable") {
            const locationId = item.warehouseLocationId!;
            const [location] = await tx.select({ id: warehouseLocations.id, storageRoom: warehouseLocations.storageRoom })
              .from(warehouseLocations).where(and(eq(warehouseLocations.id, locationId), eq(warehouseLocations.isActive, true))).for("update");
            if (!location) throw Object.assign(new Error(`Warehouse location for "${item.description}" is unavailable`), { status: 400 });
            let target: any = null;
            if (item.consumableId) {
              [target] = await tx.select().from(consumables).where(and(
                eq(consumables.id, item.consumableId),
                eq(consumables.warehouseLocationId, locationId),
              )).for("update");
            }
            if (!target) {
              const candidates = await tx.select().from(consumables).where(eq(consumables.warehouseLocationId, locationId)).for("update");
              target = candidates.find(candidate =>
                candidate.name.toLocaleLowerCase() === item.description.toLocaleLowerCase() &&
                (candidate.modelPartNumber ?? "").toLocaleLowerCase() === (item.modelPartNumber ?? "").toLocaleLowerCase()
              );
            }
            if (target) {
              await tx.update(consumables).set({
                quantityInStock: target.quantityInStock + quantity,
                unitCost: item.unitPrice,
                vendorId: lockedPO.vendorId,
                updatedAt: new Date(),
              }).where(eq(consumables.id, target.id));
            } else {
              [target] = await tx.insert(consumables).values({
                name: item.description,
                category: item.consumableCategory || "Other",
                modelPartNumber: item.modelPartNumber || null,
                quantityInStock: quantity,
                minReorderLevel: 0,
                warehouseLocationId: locationId,
                storageRoom: location.storageRoom,
                unitCost: item.unitPrice,
                vendorId: lockedPO.vendorId,
              }).returning();
            }
            await tx.insert(consumableStockMovements).values({
              consumableId: target.id,
              movementType: "receipt",
              quantity,
              toWarehouseLocationId: locationId,
              actorId: req.user!.id,
              purchaseOrderId: lockedPO.id,
              notes: `Received on PO ${lockedPO.poNumber}`,
            });
            await tx.update(purchaseOrderItems).set({ consumableId: target.id }).where(eq(purchaseOrderItems.id, item.id));
            stockUnits += quantity;
          } else {
            const tags = allocatedTags.get(item.id) ?? [];
            for (let unit = 0; unit < quantity; unit++) {
              const [asset] = await tx.insert(assets).values({
                name: quantity > 1 ? `${item.description} #${unit + 1}` : item.description,
                assetTag: tags[unit],
                type: item.assetType || "other",
                status: "available",
                vendor: vendorName,
                serialNumber: quantity === 1 ? item.serialNumber : null,
                purchasePrice: item.unitPrice,
                purchaseDate: lockedPO.orderDate,
                purchaseOrderNumber: lockedPO.poNumber,
                departmentId: lockedPO.departmentId,
                primaryVendorId: lockedPO.vendorId,
              }).returning();
              createdAssets.push(asset);
            }
          }
          await tx.insert(purchaseOrderItemReceipts).values({ purchaseOrderId: lockedPO.id, purchaseOrderItemId: item.id });
        }
        await tx.update(purchaseOrders).set({ assetsCreated: true }).where(eq(purchaseOrders.id, lockedPO.id));
        return { createdAssets, stockUnits };
      });

      await logAudit(req.user?.id, 'CREATE', 'assets', po.id, `Inventory from PO #${po.poNumber}`, null, {
        assetsCreated: received.createdAssets.length,
        consumableUnitsReceived: received.stockUnits,
      }, req);
      res.json({ created: received.createdAssets.length, assets: received.createdAssets, consumableUnitsReceived: received.stockUnits });
    } catch (error) {
      const status = (error as any)?.status;
      if (status) return res.status(status).json({ message: (error as Error).message });
      console.error('Create assets from PO error:', error);
      respondWithApiError(res, error, "Failed to create assets from purchase order");
    }
  });

  // Procure-to-Pay: quotations -> purchase orders -> matched invoices/payments -> returns/debit notes.
  async function getDefaultFinancialProfile() {
    const [profile] = await db.select().from(financeTaxSettings).where(eq(financeTaxSettings.id, 1));
    if (!profile) throw Object.assign(new Error("Apply the financial tax-settings migration before creating procurement documents"), { status: 503 });
    return profile;
  }

  app.get("/api/finance/tax-settings", requireAuth, requireModule("asset_management"), requireAnyPermission("finance_view", "system_admin"), async (_req, res) => {
    try {
      const [settings] = await db.select().from(financeTaxSettings).where(eq(financeTaxSettings.id, 1));
      if (settings) return res.json(settings);
      return res.status(503).json({ message: "Financial settings have not been initialized; apply the startup migrations" });
    } catch (error) {
      console.error("Finance tax settings read failed:", error);
      return respondWithApiError(res, error, "Failed to load financial tax settings");
    }
  });

  app.put("/api/finance/tax-settings", requireAuth, requireModule("asset_management"), requirePermission("system_admin"), async (req, res) => {
    try {
      const input = financeTaxSettingsInputSchema.parse(req.body);
      const settings = await db.transaction(async tx => {
        const [saved] = await tx.insert(financeTaxSettings).values({
          ...input,
          id: 1,
          defaultTaxRate: input.defaultTaxRate.toFixed(4),
          updatedBy: req.user!.id,
          updatedAt: new Date(),
        }).onConflictDoUpdate({
          target: financeTaxSettings.id,
          set: {
            regionCode: input.regionCode,
            defaultTaxRate: input.defaultTaxRate.toFixed(4),
            defaultTaxMode: input.defaultTaxMode,
            currencyCode: input.currencyCode,
            updatedBy: req.user!.id,
            updatedAt: new Date(),
          },
        }).returning();
        const [primaryRate] = await tx.select().from(financeTaxRates).where(eq(financeTaxRates.isDefault, true)).for("update");
        if (primaryRate) {
          await tx.update(financeTaxRates).set({
            rate: input.defaultTaxRate.toFixed(4),
            taxMode: input.defaultTaxMode,
            name: `${input.defaultTaxRate}% default tax`,
            classification: "custom",
            updatedAt: new Date(),
          }).where(eq(financeTaxRates.id, primaryRate.id));
        } else {
          await tx.insert(financeTaxRates).values({
            code: "DEFAULT_TAX",
            name: `${input.defaultTaxRate}% default tax`,
            classification: "custom",
            rate: input.defaultTaxRate.toFixed(4),
            taxMode: input.defaultTaxMode,
            isActive: true,
            isDefault: true,
            sortOrder: 0,
          }).onConflictDoUpdate({
            target: financeTaxRates.code,
            set: { name: `${input.defaultTaxRate}% default tax`, rate: input.defaultTaxRate.toFixed(4), taxMode: input.defaultTaxMode, isActive: true, isDefault: true, updatedAt: new Date() },
          });
        }
        return saved;
      });
      await logAudit(req.user?.id, "UPDATE", "finance_tax_settings", String(settings.id), `Tax settings ${settings.regionCode}`, null, settings, req);
      return res.json(settings);
    } catch (error) {
      if (error instanceof z.ZodError) return res.status(400).json({ message: "Invalid financial tax settings", errors: error.issues });
      console.error("Finance tax settings update failed:", error);
      return respondWithApiError(res, error, "Failed to update financial tax settings");
    }
  });

  app.get("/api/finance/tax-rates", requireAuth, requireModule("asset_management"), requireAnyPermission("finance_view", "system_admin"), async (_req, res) => {
    try {
      const rates = await db.select().from(financeTaxRates).orderBy(asc(financeTaxRates.sortOrder), asc(financeTaxRates.name));
      return res.json(rates);
    } catch (error) {
      console.error("Finance tax rates read failed:", error);
      return respondWithApiError(res, error, "Failed to load tax rates");
    }
  });

  app.post("/api/finance/tax-rates", requireAuth, requireModule("asset_management"), requirePermission("system_admin"), async (req, res) => {
    try {
      const input = financeTaxRateInputSchema.parse(req.body);
      if (input.isDefault && !input.isActive) return res.status(400).json({ message: "The primary tax rate must be active" });
      const rate = await db.transaction(async tx => {
        if (input.isDefault) await tx.update(financeTaxRates).set({ isDefault: false, updatedAt: new Date() }).where(eq(financeTaxRates.isDefault, true));
        const [saved] = await tx.insert(financeTaxRates).values({ ...input, rate: input.rate.toFixed(4), updatedAt: new Date() }).returning();
        if (input.isDefault) {
          await tx.update(financeTaxSettings).set({
            defaultTaxRate: input.rate.toFixed(4), defaultTaxMode: input.taxMode, updatedBy: req.user!.id, updatedAt: new Date(),
          }).where(eq(financeTaxSettings.id, 1));
        }
        return saved;
      });
      await logAudit(req.user?.id, "CREATE", "finance_tax_rates", String(rate.id), `Tax rate ${rate.code}`, null, rate, req);
      return res.status(201).json(rate);
    } catch (error) {
      if (error instanceof z.ZodError) return res.status(400).json({ message: "Invalid tax rate", errors: error.issues });
      const code = (error as any)?.code ?? (error as any)?.cause?.code;
      if (code === "23505") return res.status(409).json({ message: "A tax rate with this code already exists" });
      console.error("Finance tax rate create failed:", error);
      return respondWithApiError(res, error, "Failed to create tax rate");
    }
  });

  app.put("/api/finance/tax-rates/:id", requireAuth, requireModule("asset_management"), requirePermission("system_admin"), async (req, res) => {
    try {
      const id = z.coerce.number().int().positive().parse(req.params.id);
      const input = financeTaxRateInputSchema.parse(req.body);
      if (input.isDefault && !input.isActive) return res.status(400).json({ message: "The primary tax rate must be active" });
      const rate = await db.transaction(async tx => {
        const [current] = await tx.select().from(financeTaxRates).where(eq(financeTaxRates.id, id)).for("update");
        if (!current) throw Object.assign(new Error("Tax rate not found"), { status: 404 });
        if (!input.isDefault && current.isDefault) throw Object.assign(new Error("Choose another primary tax rate before removing the current default"), { status: 409 });
        if (input.isDefault) await tx.update(financeTaxRates).set({ isDefault: false, updatedAt: new Date() }).where(and(eq(financeTaxRates.isDefault, true), sql`${financeTaxRates.id} <> ${id}`));
        const [saved] = await tx.update(financeTaxRates).set({ ...input, rate: input.rate.toFixed(4), updatedAt: new Date() })
          .where(eq(financeTaxRates.id, id)).returning();
        if (input.isDefault) {
          await tx.update(financeTaxSettings).set({
            defaultTaxRate: input.rate.toFixed(4), defaultTaxMode: input.taxMode, updatedBy: req.user!.id, updatedAt: new Date(),
          }).where(eq(financeTaxSettings.id, 1));
        }
        return saved;
      });
      await logAudit(req.user?.id, "UPDATE", "finance_tax_rates", String(rate.id), `Tax rate ${rate.code}`, null, rate, req);
      return res.json(rate);
    } catch (error) {
      if (error instanceof z.ZodError) return res.status(400).json({ message: "Invalid tax rate", errors: error.issues });
      const status = (error as any)?.status;
      if (status) return res.status(status).json({ message: (error as Error).message });
      const code = (error as any)?.code ?? (error as any)?.cause?.code;
      if (code === "23505") return res.status(409).json({ message: "A tax rate with this code already exists" });
      console.error("Finance tax rate update failed:", error);
      return respondWithApiError(res, error, "Failed to update tax rate");
    }
  });

  app.get("/api/finance/document-sequences", requireAuth, requireModule("asset_management"), requireAnyPermission("finance_view", "system_admin"), async (_req, res) => {
    try {
      const sequences = await db.select().from(financeDocumentSequences).orderBy(asc(financeDocumentSequences.documentType));
      return res.json(sequences);
    } catch (error) {
      console.error("Financial document sequences read failed:", error);
      return respondWithApiError(res, error, "Failed to load document numbering settings");
    }
  });

  app.put("/api/finance/document-sequences/:documentType", requireAuth, requireModule("asset_management"), requirePermission("system_admin"), async (req, res) => {
    try {
      const documentType = z.enum(["quotation", "purchase_order", "invoice"]).parse(req.params.documentType);
      const input = financeDocumentSequenceInputSchema.parse(req.body);
      const [sequence] = await db.update(financeDocumentSequences).set({
        ...input,
        prefix: input.prefix.trim(),
        updatedBy: req.user!.id,
        updatedAt: new Date(),
      }).where(eq(financeDocumentSequences.documentType, documentType)).returning();
      if (!sequence) return res.status(503).json({ message: "Document numbering has not been initialized; apply the finance sequence migration" });
      await logAudit(req.user?.id, "UPDATE", "finance_document_sequences", String(sequence.id), `Numbering for ${documentType}`, null, sequence, req);
      return res.json(sequence);
    } catch (error) {
      if (error instanceof z.ZodError) return res.status(400).json({ message: "Invalid document numbering settings", errors: error.issues });
      console.error("Financial document sequence update failed:", error);
      return respondWithApiError(res, error, "Failed to update document numbering settings");
    }
  });

  app.get("/api/vendor-quotations", requireAuth, requireAnyPermission("finance_view", "purchase_order_create", "purchase_order_update", "system_admin"), async (_req, res) => {
    try {
      const rows = await db.select().from(vendorQuotations).orderBy(desc(vendorQuotations.createdAt));
      const result = await Promise.all(rows.map(async quotation => ({
        ...quotation,
        items: await db.select().from(vendorQuotationItems).where(eq(vendorQuotationItems.quotationId, quotation.id)),
      })));
      res.json(result);
    } catch (error) {
      console.error("Vendor quotation list failed:", error);
      respondWithApiError(res, error, "Failed to fetch vendor quotations");
    }
  });

  const deleteVendorQuotation = async (req: any, res: any) => {
    try {
      const result = await db.transaction(async tx => {
        const [quotation] = await tx.select().from(vendorQuotations)
          .where(eq(vendorQuotations.id, req.params.id))
          .for("update");
        if (!quotation) throw Object.assign(new Error("Vendor quotation not found"), { status: 404 });

        const [activeOrder] = await tx.select({
          id: purchaseOrders.id,
          poNumber: purchaseOrders.poNumber,
          status: purchaseOrders.status,
        }).from(purchaseOrders).where(and(
          eq(purchaseOrders.quotationId, quotation.id),
          inArray(purchaseOrders.status, ["pending", "approved", "ordered", "received"]),
        )).for("update");
        if (activeOrder) {
          throw Object.assign(new Error(`Quotation is linked to active purchase order ${activeOrder.poNumber}`), { status: 409 });
        }

        await tx.delete(vendorQuotations).where(eq(vendorQuotations.id, quotation.id));
        return quotation;
      });
      await logAudit(req.user?.id, "DELETE", "vendor_quotations", result.id, `Quotation ${result.quoteNumber}`, result, null, req);
      return res.status(204).send();
    } catch (error) {
      if ((error as any)?.status) return res.status((error as any).status).json({ message: (error as Error).message });
      console.error("Vendor quotation delete failed:", error);
      return respondWithApiError(res, error, "Failed to delete vendor quotation");
    }
  };
  app.delete("/api/vendor-quotations/:id", requireAuth, requirePermission("purchase_order_update"), deleteVendorQuotation);
  app.delete("/api/quotations/:id", requireAuth, requirePermission("purchase_order_update"), deleteVendorQuotation);

  app.post("/api/vendor-quotations", requireAuth, requirePermission("purchase_order_create"), async (req, res) => {
    try {
      const financeDefaults = await getDefaultFinancialProfile();
      const parsed = insertVendorQuotationSchema.safeParse({
        currency: financeDefaults.currencyCode,
        taxRate: financeDefaults.defaultTaxRate,
        taxMode: financeDefaults.defaultTaxMode,
        ...req.body,
      });
      if (!parsed.success) return res.status(400).json({ message: "Invalid quotation", errors: parsed.error.issues });
      const { items, ...quotationInput } = parsed.data;
      if (items.some(line => line.consumableId && line.itemType !== "consumable")) {
        return res.status(400).json({ message: "Only consumable quotation lines may reference a stock item" });
      }
      const totals = calculateDocumentTotals(items.map(line => ({
        quantity: line.quantity,
        unitPrice: line.unitPrice,
        discountType: line.discountType,
        discountValue: line.discountValue,
        taxRate: line.taxRate ?? Number(quotationInput.taxRate ?? 0),
        taxInclusive: line.taxInclusive ?? quotationInput.taxMode === "inclusive",
      })), quotationInput.documentDiscountType, quotationInput.documentDiscountValue);
      const normalizedItems = items.map((line, index) => ({
        ...line,
        taxRate: line.taxRate ?? Number(quotationInput.taxRate ?? 0),
        taxInclusive: line.taxInclusive ?? quotationInput.taxMode === "inclusive",
        discountAmount: totals.lines[index].discountAmount,
        totalPrice: totals.lines[index].totalAmount,
      }));
      if (Math.abs(totals.grandTotal - Number(quotationInput.totalAmount)) > 0.01 ||
          Math.abs(totals.taxAmount - Number(quotationInput.taxAmount ?? 0)) > 0.01 ||
          Math.abs(totals.subtotal - Number(quotationInput.subtotal)) > 0.01) {
        return res.status(400).json({ message: "Quotation totals must match line discounts and inclusive/exclusive tax calculations" });
      }
      if (items.some(line => line.itemType === "consumable" && !line.warehouseLocationId)) {
        return res.status(400).json({ message: "Consumable quotation lines require a warehouse location" });
      }
      const saved = await db.transaction(async tx => {
        const quoteNumber = await reserveFinancialDocumentNumber(tx, "quotation", quotationInput.quoteNumber);
        for (const line of items) {
          if (line.itemType === "consumable") {
            const [activeWarehouse] = await tx.select({ id: warehouseLocations.id }).from(warehouseLocations)
              .where(and(eq(warehouseLocations.id, line.warehouseLocationId!), eq(warehouseLocations.isActive, true)));
            if (!activeWarehouse) throw Object.assign(new Error("Select an active receiving warehouse for each consumable line"), { status: 400 });
          }
          if (line.consumableId) {
            const [stock] = await tx.select({
              id: consumables.id,
              warehouseLocationId: consumables.warehouseLocationId,
            }).from(consumables).where(eq(consumables.id, line.consumableId));
            if (!stock || !line.warehouseLocationId || stock.warehouseLocationId !== line.warehouseLocationId) {
              throw Object.assign(new Error("Selected consumable is not in the quotation's receiving warehouse"), { status: 400 });
            }
          }
        }
        const [quotation] = await tx.insert(vendorQuotations).values({
          ...quotationInput,
          quoteNumber,
          status: "submitted",
          documentDiscountValue: Number(quotationInput.documentDiscountValue ?? 0).toFixed(2),
          subtotal: totals.subtotal.toFixed(2),
          taxAmount: totals.taxAmount.toFixed(2),
          totalAmount: totals.grandTotal.toFixed(2),
          documentDiscountAmount: totals.documentDiscountAmount.toFixed(2),
          createdBy: req.user!.id,
        }).returning();
        await tx.insert(vendorQuotationItems).values(normalizedItems.map(line => ({
          quotationId: quotation.id,
          description: line.description,
          itemType: line.itemType,
          consumableId: line.consumableId ?? null,
          quantity: line.quantity,
          unitPrice: line.unitPrice.toFixed(2),
          discountType: line.discountType,
          discountValue: Number(line.discountValue).toFixed(2),
          discountAmount: line.discountAmount.toFixed(2),
          taxRate: Number(line.taxRate).toFixed(4),
          taxInclusive: line.taxInclusive,
          totalPrice: Number(line.totalPrice).toFixed(2),
          assetType: line.assetType ?? null,
          consumableCategory: line.consumableCategory ?? null,
          modelPartNumber: line.modelPartNumber ?? null,
          warehouseLocationId: line.warehouseLocationId ?? null,
        })));
        return quotation;
      });
      await logAudit(req.user?.id, "CREATE", "vendor_quotations", saved.id, `Quotation ${saved.quoteNumber}`, null, saved, req);
      res.status(201).json({ ...saved, items: normalizedItems });
    } catch (error) {
      if (error instanceof ProcurementPricingError) return res.status(400).json({ message: error.message });
      if ((error as any)?.status) return res.status((error as any).status).json({ message: (error as Error).message });
      const code = (error as any)?.code ?? (error as any)?.cause?.code;
      if (code === "23505") return res.status(409).json({ message: "Quotation number already exists" });
      if (code === "23503") return res.status(400).json({ message: "Vendor or warehouse reference is invalid" });
      console.error("Vendor quotation create failed:", error);
      respondWithApiError(res, error, "Failed to create vendor quotation");
    }
  });

  app.put("/api/vendor-quotations/:id/status", requireAuth, requirePermission("purchase_order_update"), async (req, res) => {
    try {
      const status = z.enum(["submitted", "accepted", "rejected", "expired"]).parse(req.body?.status);
      const [quotation] = await db.select().from(vendorQuotations).where(eq(vendorQuotations.id, req.params.id));
      if (!quotation) return res.status(404).json({ message: "Vendor quotation not found" });
      if (quotation.status === "converted") return res.status(409).json({ message: "Converted quotations cannot be changed" });
      const [updated] = await db.update(vendorQuotations).set({ status, updatedAt: new Date() }).where(and(eq(vendorQuotations.id, quotation.id), sql`${vendorQuotations.status} <> 'converted'`)).returning();
      if (!updated) return res.status(409).json({ message: "Converted quotations cannot be changed" });
      await logAudit(req.user?.id, "UPDATE", "vendor_quotations", quotation.id, `Quotation ${quotation.quoteNumber}`, quotation, updated, req);
      res.json(updated);
    } catch (error) {
      if (error instanceof z.ZodError) return res.status(400).json({ message: "Invalid quotation status" });
      respondWithApiError(res, error, "Failed to update quotation");
    }
  });

  app.post("/api/vendor-quotations/:id/convert-to-po", requireAuth, requirePermission("purchase_order_create"), async (req, res) => {
    try {
      const result = await db.transaction(async tx => {
        const [quotation] = await tx.select().from(vendorQuotations).where(eq(vendorQuotations.id, req.params.id)).for("update");
        if (!quotation) throw Object.assign(new Error("Quotation not found"), { status: 404 });
        if (quotation.status !== "accepted") throw Object.assign(new Error("Only accepted quotations can be converted to a purchase order"), { status: 409 });
        const quotationItems = await tx.select().from(vendorQuotationItems).where(eq(vendorQuotationItems.quotationId, quotation.id));
        const poNumber = await reserveFinancialDocumentNumber(tx, "purchase_order", req.body?.poNumber);
        const [po] = await tx.insert(purchaseOrders).values({
          poNumber,
          vendorId: quotation.vendorId,
          vendor: (await tx.select({ name: vendors.name }).from(vendors).where(eq(vendors.id, quotation.vendorId)))[0]?.name ?? null,
          quotationId: quotation.id,
          reference: `Quotation ${quotation.quoteNumber}`,
          orderDate: toDateInputValue(new Date()),
          expectedDelivery: req.body?.expectedDelivery ?? null,
          actualDelivery: null,
          totalAmount: quotation.totalAmount,
          currency: quotation.currency,
          subtotal: quotation.subtotal,
          taxRate: quotation.taxRate,
          taxMode: quotation.taxMode,
          documentDiscountType: quotation.documentDiscountType,
          documentDiscountValue: quotation.documentDiscountValue,
          documentDiscountAmount: quotation.documentDiscountAmount,
          taxAmount: quotation.taxAmount,
          status: "pending",
          departmentId: req.body?.departmentId || null,
          notes: quotation.notes,
          assetsCreated: false,
        }).returning();
        await tx.insert(purchaseOrderItems).values(quotationItems.map(line => ({
          purchaseOrderId: po.id,
          description: line.description,
          assetType: line.assetType ?? "other",
          itemType: line.itemType,
          consumableId: line.consumableId ?? null,
          consumableCategory: line.consumableCategory,
          modelPartNumber: line.modelPartNumber,
          warehouseLocationId: line.warehouseLocationId,
          serialNumber: null,
          quantity: line.quantity,
          unitPrice: line.unitPrice,
          discountType: line.discountType,
          discountValue: line.discountValue,
          discountAmount: line.discountAmount,
          taxRate: line.taxRate,
          taxInclusive: line.taxInclusive,
          totalPrice: line.totalPrice,
          assetId: null,
        })));
        await tx.update(vendorQuotations).set({ status: "converted", updatedAt: new Date() }).where(eq(vendorQuotations.id, quotation.id));
        return { purchaseOrder: po, items: quotationItems };
      });
      await logAudit(req.user?.id, "CREATE", "purchase_orders", result.purchaseOrder.id, `PO ${result.purchaseOrder.poNumber}`, null, { quotationId: req.params.id }, req);
      res.status(201).json(result);
    } catch (error) {
      const status = (error as any)?.status;
      if (status) return res.status(status).json({ message: (error as Error).message });
      if (error instanceof z.ZodError) return res.status(400).json({ message: "Invalid purchase order conversion data", errors: error.issues });
      respondWithApiError(res, error, "Failed to convert quotation");
    }
  });

  app.get("/api/purchase-invoices", requireAuth, requireAnyPermission("finance_view", "purchase_order_create", "purchase_order_update", "system_admin"), async (_req, res) => {
    try {
      const rows = await db.select().from(purchaseInvoices).orderBy(desc(purchaseInvoices.issueDate));
      res.json(await Promise.all(rows.map(async invoice => {
        const [items, matchLines, payments, credits] = await Promise.all([
          db.select().from(purchaseInvoiceItems).where(eq(purchaseInvoiceItems.invoiceId, invoice.id)),
          db.select().from(purchaseInvoiceMatchLines).where(eq(purchaseInvoiceMatchLines.invoiceId, invoice.id)),
          db.select().from(purchaseInvoicePayments).where(eq(purchaseInvoicePayments.invoiceId, invoice.id)).orderBy(desc(purchaseInvoicePayments.paymentDate)),
          db.select({ totalCredit: purchaseReturns.totalCredit }).from(purchaseReturns).where(and(eq(purchaseReturns.purchaseInvoiceId, invoice.id), eq(purchaseReturns.status, "approved"))),
        ]);
        const creditedAmount = credits.reduce((total, credit) => total + Number(credit.totalCredit), 0);
        const paidAmount = payments.reduce((total, payment) => total + Number(payment.amount), 0);
        return { ...invoice, items: items.length ? items : matchLines, payments, creditedAmount, outstandingAmount: Math.max(0, Math.round((Number(invoice.grandTotal) - creditedAmount - paidAmount) * 100) / 100) };
      })));
    } catch (error) {
      console.error("Purchase invoice list failed:", error);
      respondWithApiError(res, error, "Failed to fetch purchase invoices");
    }
  });

  app.get("/api/purchase-orders/:id/receipts", requireAuth, requireAnyPermission("finance_view", "purchase_order_create", "purchase_order_update", "system_admin"), async (req, res) => {
    try {
      const rows = await db.select({
        receiptId: purchaseOrderItemReceipts.id,
        purchaseOrderItemId: purchaseOrderItems.id,
        description: purchaseOrderItems.description,
        itemType: purchaseOrderItems.itemType,
        quantity: purchaseOrderItems.quantity,
        unitPrice: purchaseOrderItems.unitPrice,
        consumableId: purchaseOrderItems.consumableId,
        warehouseLocationId: purchaseOrderItems.warehouseLocationId,
      }).from(purchaseOrderItemReceipts)
        .innerJoin(purchaseOrderItems, eq(purchaseOrderItemReceipts.purchaseOrderItemId, purchaseOrderItems.id))
        .where(eq(purchaseOrderItemReceipts.purchaseOrderId, req.params.id));
      res.json(rows);
    } catch (error) {
      respondWithApiError(res, error, "Failed to fetch received PO lines");
    }
  });

  app.get("/api/purchase-orders/:id/match-lines", requireAuth, requireAnyPermission("finance_view", "purchase_order_create", "purchase_order_update", "system_admin"), async (req, res) => {
    try {
      const [order] = await db.select({ id: purchaseOrders.id, status: purchaseOrders.status }).from(purchaseOrders).where(eq(purchaseOrders.id, req.params.id));
      if (!order) return res.status(404).json({ message: "Purchase order not found" });
      if (order.status !== "ordered" && order.status !== "received") return res.status(409).json({ message: "Supplier invoices can only be matched to an ordered or received purchase order" });
      const rows = await db.select({
        purchaseOrderItemId: purchaseOrderItems.id,
        description: purchaseOrderItems.description,
        itemType: purchaseOrderItems.itemType,
        quantity: purchaseOrderItems.quantity,
        unitPrice: purchaseOrderItems.unitPrice,
        discountType: purchaseOrderItems.discountType,
        discountValue: purchaseOrderItems.discountValue,
        discountAmount: purchaseOrderItems.discountAmount,
        taxRate: purchaseOrderItems.taxRate,
        taxInclusive: purchaseOrderItems.taxInclusive,
        totalPrice: purchaseOrderItems.totalPrice,
      }).from(purchaseOrderItems).where(eq(purchaseOrderItems.purchaseOrderId, order.id));
      res.json(rows);
    } catch (error) {
      respondWithApiError(res, error, "Failed to fetch ordered purchase-order lines");
    }
  });

  app.get("/api/purchase-orders/:id/returnable-assets", requireAuth, requireAnyPermission("finance_view", "purchase_order_update", "system_admin"), async (req, res) => {
    try {
      const [po] = await db.select({ poNumber: purchaseOrders.poNumber }).from(purchaseOrders).where(eq(purchaseOrders.id, req.params.id));
      if (!po) return res.status(404).json({ message: "Purchase order not found" });
      const itemId = typeof req.query.purchaseOrderItemId === "string" ? req.query.purchaseOrderItemId : "";
      const [poItem] = itemId ? await db.select({ description: purchaseOrderItems.description }).from(purchaseOrderItems)
        .where(and(eq(purchaseOrderItems.id, itemId), eq(purchaseOrderItems.purchaseOrderId, req.params.id))) : [];
      if (itemId && !poItem) return res.status(400).json({ message: "Selected line is not on this purchase order" });
      const assetQuery = db.select({
        id: assets.id,
        name: assets.name,
        assetTag: assets.assetTag,
        status: assets.status,
        purchaseOrderNumber: assets.purchaseOrderNumber,
      }).from(assets).where(and(
        eq(assets.purchaseOrderNumber, po.poNumber),
        inArray(assets.status, ["available", "in_stock", "maintenance"]),
        ...(poItem ? [or(eq(assets.name, poItem.description), ilike(assets.name, `${poItem.description} #%`))] : []),
      ));
      const rows = await assetQuery;
      res.json(rows);
    } catch (error) {
      respondWithApiError(res, error, "Failed to fetch returnable assets");
    }
  });

  app.post("/api/purchase-invoices", requireAuth, requirePermission("purchase_order_create"), async (req, res) => {
    try {
      const orderId = z.string().uuid().safeParse(req.body?.purchaseOrderId);
      if (!orderId.success) return res.status(400).json({ message: "Select a valid purchase order" });
      const [po] = await db.select().from(purchaseOrders).where(eq(purchaseOrders.id, orderId.data));
      if (!po) return res.status(404).json({ message: "Purchase order not found" });
      const parsed = insertPurchaseInvoiceSchema.safeParse({
        currency: po.currency,
        taxRate: po.taxRate,
        taxMode: po.taxMode,
        documentDiscountType: po.documentDiscountType,
        documentDiscountValue: po.documentDiscountValue,
        ...req.body,
      });
      if (!parsed.success) return res.status(400).json({ message: "Invalid purchase invoice", errors: parsed.error.issues });
      const { items, ...invoiceInput } = parsed.data;
      if (po.status !== "ordered" && po.status !== "received") return res.status(409).json({ message: "Supplier invoices can only be matched to an ordered or received purchase order" });
      if (po.vendorId !== invoiceInput.vendorId) return res.status(400).json({ message: "Invoice vendor must match the purchase order vendor" });
      if (po.quotationId) {
        const [linkedQuote] = await db.select({ currency: vendorQuotations.currency }).from(vendorQuotations).where(eq(vendorQuotations.id, po.quotationId));
        if (linkedQuote && linkedQuote.currency !== invoiceInput.currency) return res.status(400).json({ message: "Invoice currency must match its accepted quotation" });
      }
      const matchedLines: Array<Omit<typeof purchaseInvoiceMatchLines.$inferInsert, "id" | "invoiceId">> = [];
      const pricingLines: Array<{ quantity: number; unitPrice: number; discountType: "percentage" | "fixed"; discountValue: number; taxRate: number; taxInclusive: boolean }> = [];
      const requestedInvoiceQuantities = new Map<string, number>();
      for (const line of items) {
        const [poItem] = await db.select().from(purchaseOrderItems).where(and(eq(purchaseOrderItems.id, line.purchaseOrderItemId), eq(purchaseOrderItems.purchaseOrderId, po.id)));
        if (!poItem) return res.status(400).json({ message: "Invoice lines must match a line on the selected purchase order" });
        const invoiceUnitPrice = line.unitPrice ?? Number(poItem.unitPrice);
        if (Math.abs(Number(poItem.unitPrice) - invoiceUnitPrice) > 0.01) return res.status(400).json({ message: `Invoice unit price does not match PO line "${poItem.description}"` });
        const previousReceived = await db.select({ quantity: purchaseInvoiceItems.quantity, status: purchaseInvoices.status })
          .from(purchaseInvoiceItems).innerJoin(purchaseInvoices, eq(purchaseInvoiceItems.invoiceId, purchaseInvoices.id))
          .where(eq(purchaseInvoiceItems.purchaseOrderItemId, poItem.id));
        const previousStaged = await db.select({ quantity: purchaseInvoiceMatchLines.quantity, status: purchaseInvoices.status })
          .from(purchaseInvoiceMatchLines).innerJoin(purchaseInvoices, eq(purchaseInvoiceMatchLines.invoiceId, purchaseInvoices.id))
          .where(eq(purchaseInvoiceMatchLines.purchaseOrderItemId, poItem.id));
        const invoiced = [...previousReceived, ...previousStaged].filter(row => row.status !== "void").reduce((sum, row) => sum + row.quantity, 0);
        const requestedQuantity = (requestedInvoiceQuantities.get(poItem.id) ?? 0) + line.quantity;
        if (invoiced + requestedQuantity > poItem.quantity) return res.status(400).json({ message: `Invoice quantity exceeds the ordered quantity for "${poItem.description}"` });
        requestedInvoiceQuantities.set(poItem.id, requestedQuantity);
        const discountType = line.discountType ?? (poItem.discountType === "percentage" ? "percentage" : "fixed");
        const discountValue = line.discountValue ?? Number(poItem.discountValue);
        const taxRate = line.taxRate ?? Number(req.body.taxRate !== undefined ? invoiceInput.taxRate : poItem.taxRate);
        const taxInclusive = line.taxInclusive ?? (req.body.taxMode !== undefined ? invoiceInput.taxMode === "inclusive" : poItem.taxInclusive);
        pricingLines.push({ quantity: line.quantity, unitPrice: invoiceUnitPrice, discountType, discountValue, taxRate, taxInclusive });
        matchedLines.push({
          purchaseOrderItemId: poItem.id,
          description: poItem.description,
          quantity: line.quantity,
          unitPrice: invoiceUnitPrice.toFixed(2),
          discountType,
          discountValue: discountValue.toFixed(2),
          discountAmount: "0.00",
          taxRate: taxRate.toFixed(4),
          taxInclusive,
          totalPrice: "0.00",
        });
      }
      const totals = calculateDocumentTotals(pricingLines, invoiceInput.documentDiscountType, invoiceInput.documentDiscountValue);
      if (Math.abs(totals.subtotal - Number(invoiceInput.subtotal)) > 0.01 ||
          Math.abs(totals.taxAmount - Number(invoiceInput.taxAmount ?? 0)) > 0.01 ||
          Math.abs(totals.grandTotal - Number(invoiceInput.grandTotal)) > 0.01) {
        return res.status(400).json({ message: "Invoice totals must match the ordered line discounts and configured tax calculation" });
      }
      const normalizedLines = matchedLines.map((line, index) => ({
        ...line,
        discountAmount: totals.lines[index].discountAmount.toFixed(2),
        totalPrice: totals.lines[index].totalAmount.toFixed(2),
      }));
      const saved = await db.transaction(async tx => {
        const invoiceNumber = await reserveFinancialDocumentNumber(tx, "invoice", invoiceInput.invoiceNumber, new Date(), invoiceInput.vendorId);
        // Serialize invoice allocations on the PO, then re-check quantities under
        // the lock. Preflight validation alone would allow concurrent overbilling.
        const [lockedOrder] = await tx.select().from(purchaseOrders).where(eq(purchaseOrders.id, po.id)).for("update");
        if (!lockedOrder || !["ordered", "received"].includes(lockedOrder.status)) throw Object.assign(new Error("Only ordered or received purchase orders can be invoiced"), { status: 409 });
        for (const [itemId, requested] of Array.from(requestedInvoiceQuantities.entries())) {
          const [item] = await tx.select().from(purchaseOrderItems).where(eq(purchaseOrderItems.id, itemId));
          const priorReceived = await tx.select({ quantity: purchaseInvoiceItems.quantity }).from(purchaseInvoiceItems)
            .innerJoin(purchaseInvoices, eq(purchaseInvoiceItems.invoiceId, purchaseInvoices.id))
            .where(and(eq(purchaseInvoiceItems.purchaseOrderItemId, itemId), sql`${purchaseInvoices.status} <> 'void'`));
          const priorStaged = await tx.select({ quantity: purchaseInvoiceMatchLines.quantity }).from(purchaseInvoiceMatchLines)
            .innerJoin(purchaseInvoices, eq(purchaseInvoiceMatchLines.invoiceId, purchaseInvoices.id))
            .where(and(eq(purchaseInvoiceMatchLines.purchaseOrderItemId, itemId), sql`${purchaseInvoices.status} <> 'void'`));
          if (!item || [...priorReceived, ...priorStaged].reduce((sum, row) => sum + row.quantity, 0) + requested > item.quantity) {
            throw Object.assign(new Error("Invoice quantity exceeds received quantity"), { status: 409 });
          }
        }
        const [invoice] = await tx.insert(purchaseInvoices).values({
          ...invoiceInput,
          invoiceNumber,
          status: "pending",
          paymentStatus: "pending",
          documentDiscountValue: Number(invoiceInput.documentDiscountValue ?? 0).toFixed(2),
          subtotal: totals.subtotal.toFixed(2),
          taxAmount: totals.taxAmount.toFixed(2),
          grandTotal: totals.grandTotal.toFixed(2),
          documentDiscountAmount: totals.documentDiscountAmount.toFixed(2),
          createdBy: req.user!.id,
        }).returning();
        await tx.insert(purchaseInvoiceMatchLines).values(normalizedLines.map(line => ({ ...line, invoiceId: invoice.id })));
        const orderedLines = await tx.select().from(purchaseOrderItems).where(eq(purchaseOrderItems.purchaseOrderId, lockedOrder.id));
        const matched = await tx.select({
          invoiceId: purchaseInvoiceMatchLines.invoiceId,
          purchaseOrderItemId: purchaseInvoiceMatchLines.purchaseOrderItemId,
          description: purchaseInvoiceMatchLines.description,
          quantity: purchaseInvoiceMatchLines.quantity,
          unitPrice: purchaseInvoiceMatchLines.unitPrice,
          discountType: purchaseInvoiceMatchLines.discountType,
          discountValue: purchaseInvoiceMatchLines.discountValue,
          discountAmount: purchaseInvoiceMatchLines.discountAmount,
          taxRate: purchaseInvoiceMatchLines.taxRate,
          taxInclusive: purchaseInvoiceMatchLines.taxInclusive,
          totalPrice: purchaseInvoiceMatchLines.totalPrice,
        }).from(purchaseInvoiceMatchLines)
          .innerJoin(purchaseInvoices, eq(purchaseInvoiceMatchLines.invoiceId, purchaseInvoices.id))
          .where(and(eq(purchaseInvoices.purchaseOrderId, lockedOrder.id), sql`${purchaseInvoices.status} <> 'void'`));
        const receivedLines = await tx.select({
          purchaseOrderItemId: purchaseInvoiceItems.purchaseOrderItemId,
          quantity: purchaseInvoiceItems.quantity,
        }).from(purchaseInvoiceItems)
          .innerJoin(purchaseInvoices, eq(purchaseInvoiceItems.invoiceId, purchaseInvoices.id))
          .where(and(eq(purchaseInvoices.purchaseOrderId, lockedOrder.id), sql`${purchaseInvoices.status} <> 'void'`));
        const matchedQuantities = new Map<string, number>();
        for (const line of [...matched, ...receivedLines]) {
          matchedQuantities.set(line.purchaseOrderItemId, (matchedQuantities.get(line.purchaseOrderItemId) ?? 0) + line.quantity);
        }
        const fullOrderMatched = orderedLines.length > 0 &&
          orderedLines.every(line => matchedQuantities.get(line.id) === line.quantity);
        let receiptSummary: { createdAssets: any[]; stockUnits: number } | null = null;
        if (fullOrderMatched) {
          if (lockedOrder.status === "ordered") {
            await tx.update(purchaseOrders).set({
              status: "received",
              actualDelivery: toDateInputValue(new Date()),
            }).where(eq(purchaseOrders.id, lockedOrder.id));
            await tx.insert(auditLogs).values({
              userId: req.user!.id,
              action: "UPDATE",
              tableName: "purchase_orders",
              recordId: lockedOrder.id,
              recordName: `PO ${lockedOrder.poNumber}`,
              oldValues: JSON.stringify({ status: lockedOrder.status }),
              newValues: JSON.stringify({ status: "received", invoiceId: invoice.id, reason: "All PO quantities matched by saved supplier invoices" }),
              ipAddress: req.ip,
              userAgent: req.get("user-agent")?.slice(0, 512),
            });
          }
          receiptSummary = await receivePurchaseOrderInventory(lockedOrder.id, req.user!.id, tx);
          const receiptRows = await tx.select({
            id: purchaseOrderItemReceipts.id,
            purchaseOrderItemId: purchaseOrderItemReceipts.purchaseOrderItemId,
          }).from(purchaseOrderItemReceipts).where(eq(purchaseOrderItemReceipts.purchaseOrderId, lockedOrder.id));
          const receiptIds = new Map(receiptRows.map(row => [row.purchaseOrderItemId, row.id]));
          const invoiceIds = Array.from(new Set(matched.map(line => line.invoiceId)));
          for (const line of matched) {
            const receiptId = receiptIds.get(line.purchaseOrderItemId);
            if (!receiptId) throw Object.assign(new Error(`Inventory receipt was not created for "${line.description}"`), { status: 409 });
            await tx.insert(purchaseInvoiceItems).values({
              invoiceId: line.invoiceId,
              purchaseOrderItemId: line.purchaseOrderItemId,
              receiptId,
              description: line.description,
              quantity: line.quantity,
              unitPrice: line.unitPrice,
              discountType: line.discountType,
              discountValue: line.discountValue,
              discountAmount: line.discountAmount,
              taxRate: line.taxRate,
              taxInclusive: line.taxInclusive,
              totalPrice: line.totalPrice,
            });
          }
          if (invoiceIds.length) {
            await tx.delete(purchaseInvoiceMatchLines).where(inArray(purchaseInvoiceMatchLines.invoiceId, invoiceIds));
            await tx.update(purchaseInvoices).set({ receivedAt: new Date(), updatedAt: new Date() })
              .where(inArray(purchaseInvoices.id, invoiceIds));
          }
        }
        const [savedInvoice] = await tx.select().from(purchaseInvoices).where(eq(purchaseInvoices.id, invoice.id));
        return { invoice: savedInvoice ?? invoice, inventoryReceived: Boolean(receiptSummary), receiptSummary };
      });
      await logAudit(req.user?.id, "CREATE", "purchase_invoices", saved.invoice.id, `Invoice ${saved.invoice.invoiceNumber}`, null, saved.invoice, req);
      if (saved.inventoryReceived && saved.receiptSummary) {
        await logAudit(req.user?.id, "CREATE", "assets", po.id, `Inventory from PO ${po.poNumber}`, null, {
          invoiceId: saved.invoice.id,
          createdAssets: saved.receiptSummary.createdAssets.length,
          consumableUnitsReceived: saved.receiptSummary.stockUnits,
        }, req);
      }
      res.status(201).json({
        ...saved.invoice,
        items: normalizedLines,
        payments: [],
        inventoryReceived: saved.inventoryReceived,
        createdAssets: saved.receiptSummary?.createdAssets.length ?? 0,
        consumableUnitsReceived: saved.receiptSummary?.stockUnits ?? 0,
      });
    } catch (error) {
      if (error instanceof ProcurementPricingError) return res.status(400).json({ message: error.message });
      if ((error as any)?.status) return res.status((error as any).status).json({ message: (error as Error).message });
      const code = (error as any)?.code ?? (error as any)?.cause?.code;
      if (code === "23505") return res.status(409).json({ message: "This invoice number already exists for the vendor" });
      if (code === "23503" || code === "23514" || code === "22007" || code === "22008") return res.status(400).json({ message: "Invoice references, amounts, or dates are invalid" });
      console.error("Purchase invoice create failed:", error);
      respondWithApiError(res, error, "Failed to create purchase invoice");
    }
  });

  app.put("/api/purchase-invoices/:id/status", requireAuth, requirePermission("purchase_order_update"), async (req, res) => {
    try {
      const status = z.enum(["pending", "approved", "received", "void"]).parse(req.body?.status);
      const { invoice, updated } = await db.transaction(async tx => {
        const [invoice] = await tx.select().from(purchaseInvoices).where(eq(purchaseInvoices.id, req.params.id)).for("update");
        if (!invoice) throw Object.assign(new Error("Purchase invoice not found"), { status: 404 });
        const conflict = (message: string) => { throw Object.assign(new Error(message), { status: 409 }); };
        if (status === "received") conflict("Inventory receiving is automatic when the saved supplier invoices match every purchase-order quantity.");
        if (invoice.status === "void" && status !== "void") conflict("Voided invoices cannot be reopened");
        if (invoice.status === "received" && status !== "received") conflict("Received invoices cannot be reversed after inventory processing");
        if (invoice.status === "approved" && status === "pending") conflict("Approved invoices cannot return to pending review");
        if (status === "void") {
          const [payment] = await tx.select({ id: purchaseInvoicePayments.id }).from(purchaseInvoicePayments).where(eq(purchaseInvoicePayments.invoiceId, invoice.id));
          const [credit] = await tx.select({ id: purchaseReturns.id }).from(purchaseReturns).where(eq(purchaseReturns.purchaseInvoiceId, invoice.id));
          if (payment || credit) conflict("Invoices with payments or supplier credits cannot be voided");
          const [receivedLine] = await tx.select({ id: purchaseInvoiceItems.id }).from(purchaseInvoiceItems).where(eq(purchaseInvoiceItems.invoiceId, invoice.id));
          if (receivedLine || invoice.receivedAt) conflict("Invoices linked to received inventory cannot be voided; record a supplier return and debit note instead");
        }
        const [updated] = await tx.update(purchaseInvoices).set({
          status,
          approvedAt: status === "approved" || status === "received" ? invoice.approvedAt ?? new Date() : invoice.approvedAt,
          receivedAt: status === "received" ? invoice.receivedAt ?? new Date() : invoice.receivedAt,
          updatedAt: new Date(),
        }).where(eq(purchaseInvoices.id, invoice.id)).returning();
        return { invoice, updated };
      });
      await logAudit(req.user?.id, "UPDATE", "purchase_invoices", invoice.id, `Invoice ${invoice.invoiceNumber}`, invoice, updated, req);
      res.json(updated);
    } catch (error) {
      const status = (error as any)?.status;
      if (status) return res.status(status).json({ message: (error as Error).message });
      if (error instanceof z.ZodError) return res.status(400).json({ message: "Invalid invoice status" });
      console.error("Purchase invoice status update failed:", error);
      respondWithApiError(res, error, "Failed to update invoice status");
    }
  });

  app.post("/api/purchase-invoices/:id/payments", requireAuth, requirePermission("purchase_order_update"), async (req, res) => {
    try {
      const parsed = insertPurchaseInvoicePaymentSchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ message: "Invalid payment", errors: parsed.error.issues });
      const payment = await db.transaction(async tx => {
        const [invoice] = await tx.select().from(purchaseInvoices).where(eq(purchaseInvoices.id, req.params.id)).for("update");
        if (!invoice) throw Object.assign(new Error("Purchase invoice not found"), { status: 404 });
        if (invoice.status === "void" || invoice.status === "pending") throw Object.assign(new Error("Only approved invoices can receive payments"), { status: 409 });
        const existing = await tx.select({ amount: purchaseInvoicePayments.amount }).from(purchaseInvoicePayments).where(eq(purchaseInvoicePayments.invoiceId, invoice.id));
        const paid = existing.reduce((sum, row) => sum + Number(row.amount), 0);
        const credits = await tx.select({ totalCredit: purchaseReturns.totalCredit }).from(purchaseReturns).where(and(eq(purchaseReturns.purchaseInvoiceId, invoice.id), eq(purchaseReturns.status, "approved")));
        const credited = credits.reduce((sum, row) => sum + Number(row.totalCredit), 0);
        const amount = parsed.data.amount;
        if (Math.round((paid + amount + credited) * 100) > Math.round(Number(invoice.grandTotal) * 100)) throw Object.assign(new Error("Payment exceeds the remaining invoice balance after supplier credits"), { status: 400 });
        const [savedPayment] = await tx.insert(purchaseInvoicePayments).values({
          invoiceId: invoice.id,
          paymentDate: parsed.data.paymentDate,
          amount: amount.toFixed(2),
          paymentMethod: parsed.data.paymentMethod,
          referenceNumber: parsed.data.referenceNumber ?? null,
          notes: parsed.data.notes ?? null,
          recordedBy: req.user!.id,
        }).returning();
        const totalPaid = paid + amount;
        await tx.update(purchaseInvoices).set({
          paymentStatus: Math.round((totalPaid + credited) * 100) >= Math.round(Number(invoice.grandTotal) * 100) ? "paid" : "partially_paid",
          updatedAt: new Date(),
        }).where(eq(purchaseInvoices.id, invoice.id));
        return { payment: savedPayment, invoice, totalPaid };
      });
      await logAudit(req.user?.id, "CREATE", "purchase_invoice_payments", payment.payment.id, `Payment for invoice ${payment.invoice.invoiceNumber}`, null, payment.payment, req);
      res.status(201).json(payment);
    } catch (error) {
      const status = (error as any)?.status;
      if (status) return res.status(status).json({ message: (error as Error).message });
      if (error instanceof z.ZodError) return res.status(400).json({ message: "Invalid payment" });
      console.error("Purchase invoice payment failed:", error);
      respondWithApiError(res, error, "Failed to record invoice payment");
    }
  });

  app.get("/api/purchase-returns", requireAuth, requireAnyPermission("finance_view", "purchase_order_create", "purchase_order_update", "system_admin"), async (_req, res) => {
    try {
      const rows = await db.select().from(purchaseReturns).orderBy(desc(purchaseReturns.returnDate));
      res.json(await Promise.all(rows.map(async purchaseReturn => ({
        ...purchaseReturn,
        items: await db.select().from(purchaseReturnItems).where(eq(purchaseReturnItems.returnId, purchaseReturn.id)),
      }))));
    } catch (error) {
      respondWithApiError(res, error, "Failed to fetch purchase returns");
    }
  });

  app.post("/api/purchase-returns", requireAuth, requirePermission("purchase_order_update"), async (req, res) => {
    try {
      const parsed = insertPurchaseReturnSchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ message: "Invalid purchase return", errors: parsed.error.issues });
      const { items, ...returnInput } = parsed.data;
      const [po] = await db.select().from(purchaseOrders).where(eq(purchaseOrders.id, returnInput.purchaseOrderId));
      if (!po) return res.status(404).json({ message: "Purchase order not found" });
      if (po.vendorId !== returnInput.vendorId) return res.status(400).json({ message: "Return vendor must match the purchase order vendor" });
      if (returnInput.purchaseInvoiceId) {
        const [invoice] = await db.select().from(purchaseInvoices).where(eq(purchaseInvoices.id, returnInput.purchaseInvoiceId));
        if (!invoice || invoice.purchaseOrderId !== po.id || invoice.vendorId !== po.vendorId) return res.status(400).json({ message: "Return invoice must belong to the selected purchase order and vendor" });
      }
      const reference = `${Date.now()}-${randomUUID().slice(0, 8)}`;
      const returnNumber = `RET-${reference}`;
      const debitNoteNumber = `DN-${reference}`;
      const result = await db.transaction(async tx => {
        const [linkedInvoice] = returnInput.purchaseInvoiceId ? await tx.select().from(purchaseInvoices)
          .where(eq(purchaseInvoices.id, returnInput.purchaseInvoiceId)).for("update") : [];
        if (returnInput.purchaseInvoiceId && (!linkedInvoice || linkedInvoice.status === "void")) {
          throw Object.assign(new Error("Select a non-void supplier invoice"), { status: 409 });
        }
        const [lockedPo] = await tx.select().from(purchaseOrders).where(eq(purchaseOrders.id, po.id)).for("update");
        if (!lockedPo || lockedPo.status !== "received" || !lockedPo.assetsCreated) {
          throw Object.assign(new Error("Inventory must be received before processing supplier returns"), { status: 409 });
        }
        const [quote] = lockedPo.quotationId ? await tx.select({ currency: vendorQuotations.currency }).from(vendorQuotations).where(eq(vendorQuotations.id, lockedPo.quotationId)) : [];
        const expectedCurrency = linkedInvoice?.currency ?? quote?.currency;
        if (expectedCurrency && returnInput.currency !== expectedCurrency) throw Object.assign(new Error("Supplier credit currency must match the invoice or quotation"), { status: 400 });
        const checkedItems = [];
        const inventoryTargets = new Set<string>();
        const requestedReturnQuantities = new Map<string, number>();
        for (const line of items) {
          const target = line.assetId ? `asset:${line.assetId}` : `stock:${line.consumableId}`;
          if (inventoryTargets.has(target)) throw Object.assign(new Error("Combine duplicate stock targets or submit separate asset returns"), { status: 400 });
          inventoryTargets.add(target);
          const [poItem] = await tx.select().from(purchaseOrderItems).where(and(eq(purchaseOrderItems.id, line.purchaseOrderItemId), eq(purchaseOrderItems.purchaseOrderId, po.id))).for("update");
          if (!poItem) throw Object.assign(new Error("Return item must match a line on the selected purchase order"), { status: 400 });
          const [receipt] = await tx.select({ id: purchaseOrderItemReceipts.id }).from(purchaseOrderItemReceipts).where(eq(purchaseOrderItemReceipts.purchaseOrderItemId, poItem.id));
          if (!receipt) throw Object.assign(new Error("This PO line has not been received into inventory"), { status: 409 });
          const quantity = line.quantity;
          const previousReturns = await tx.select({ quantity: purchaseReturnItems.quantity, status: purchaseReturns.status })
            .from(purchaseReturnItems).innerJoin(purchaseReturns, eq(purchaseReturnItems.returnId, purchaseReturns.id))
            .where(eq(purchaseReturnItems.purchaseOrderItemId, poItem.id));
          const alreadyReturned = previousReturns.filter(row => row.status === "approved").reduce((sum, row) => sum + row.quantity, 0);
          const requestQuantity = (requestedReturnQuantities.get(poItem.id) ?? 0) + quantity;
          if (alreadyReturned + requestQuantity > poItem.quantity) throw Object.assign(new Error(`Return quantity exceeds the received quantity for "${poItem.description}"`), { status: 400 });
          requestedReturnQuantities.set(poItem.id, requestQuantity);
          if (poItem.itemType === "consumable") {
            const consumableId = line.consumableId ?? poItem.consumableId;
            const warehouseId = line.warehouseLocationId ?? poItem.warehouseLocationId;
            if (!consumableId || !warehouseId || warehouseId !== poItem.warehouseLocationId || (poItem.consumableId && consumableId !== poItem.consumableId)) {
              throw Object.assign(new Error(`Select the received consumable stock row for "${poItem.description}"`), { status: 400 });
            }
            const [warehouse] = await tx.select({ id: warehouseLocations.id }).from(warehouseLocations).where(and(eq(warehouseLocations.id, warehouseId), eq(warehouseLocations.isActive, true))).for("update");
            if (!warehouse) throw Object.assign(new Error("Cannot process stock in a disabled warehouse"), { status: 409 });
            const [stock] = await tx.select().from(consumables).where(and(eq(consumables.id, consumableId), eq(consumables.warehouseLocationId, warehouseId))).for("update");
            if (!stock || stock.quantityInStock < quantity ||
                (!poItem.consumableId && (stock.name.toLowerCase() !== poItem.description.toLowerCase() ||
                (stock.modelPartNumber ?? "").toLowerCase() !== (poItem.modelPartNumber ?? "").toLowerCase()))) {
              throw Object.assign(new Error(`Insufficient or mismatched stock for "${poItem.description}"`), { status: 409 });
            }
            checkedItems.push({ poItem, consumable: stock, asset: null, quantity, price: Number(poItem.unitPrice), reasonCode: line.reasonCode });
          } else {
            if (!line.assetId || quantity !== 1) throw Object.assign(new Error(`Select one received asset for "${poItem.description}"`), { status: 400 });
            const [asset] = await tx.select().from(assets).where(and(eq(assets.id, line.assetId), eq(assets.purchaseOrderNumber, po.poNumber))).for("update");
            if (!asset || (asset.name !== poItem.description && !asset.name.startsWith(`${poItem.description} #`)) ||
                asset.status === "assigned" || asset.status === "disposed" || asset.status === "returned_to_vendor") {
              throw Object.assign(new Error("Only an unassigned, active asset from this purchase order can be returned"), { status: 409 });
            }
            checkedItems.push({ poItem, consumable: null, asset, quantity, price: Number(poItem.unitPrice), reasonCode: line.reasonCode });
          }
        }
        const totalCredit = checkedItems.reduce((sum, line) => sum + line.quantity * line.price, 0);
        const [savedReturn] = await tx.insert(purchaseReturns).values({
          ...returnInput,
          returnNumber,
          debitNoteNumber,
          status: "approved",
          totalCredit: totalCredit.toFixed(2),
          processedAt: new Date(),
          createdBy: req.user!.id,
        }).returning();
        for (const line of checkedItems) {
          const credit = (line.quantity * line.price).toFixed(2);
          await tx.insert(purchaseReturnItems).values({
            returnId: savedReturn.id,
            purchaseOrderItemId: line.poItem.id,
            consumableId: line.consumable?.id ?? null,
            assetId: line.asset?.id ?? null,
            warehouseLocationId: line.consumable?.warehouseLocationId ?? null,
            quantity: line.quantity,
            unitPrice: line.price.toFixed(2),
            totalCredit: credit,
            reasonCode: line.reasonCode,
          });
          if (line.consumable) {
            await tx.update(consumables).set({
              quantityInStock: line.consumable.quantityInStock - line.quantity,
              updatedAt: new Date(),
            }).where(eq(consumables.id, line.consumable.id));
            await tx.insert(consumableStockMovements).values({
              consumableId: line.consumable.id,
              movementType: "supplier_return",
              quantity: line.quantity,
              fromWarehouseLocationId: line.consumable.warehouseLocationId,
              actorId: req.user!.id,
              purchaseOrderId: po.id,
              notes: `Supplier return ${returnNumber}; debit note ${debitNoteNumber}; ${line.reasonCode}`,
            });
          } else if (line.asset) {
            await tx.update(assets).set({
              status: "returned_to_vendor",
              currentBookValue: "0.00",
              currentValue: "0.00",
            }).where(eq(assets.id, line.asset.id));
          }
        }
        if (linkedInvoice) {
          const credits = await tx.select({ totalCredit: purchaseReturns.totalCredit }).from(purchaseReturns).where(and(eq(purchaseReturns.purchaseInvoiceId, linkedInvoice.id), eq(purchaseReturns.status, "approved")));
          const payments = await tx.select({ amount: purchaseInvoicePayments.amount }).from(purchaseInvoicePayments).where(eq(purchaseInvoicePayments.invoiceId, linkedInvoice.id));
          const settled = credits.reduce((sum, row) => sum + Number(row.totalCredit), 0) + payments.reduce((sum, row) => sum + Number(row.amount), 0);
          await tx.update(purchaseInvoices).set({
            paymentStatus: Math.round(settled * 100) >= Math.round(Number(linkedInvoice.grandTotal) * 100) ? "paid" : "partially_paid",
            updatedAt: new Date(),
          }).where(eq(purchaseInvoices.id, linkedInvoice.id));
        }
        return savedReturn;
      });
      await logAudit(req.user?.id, "CREATE", "purchase_returns", result.id, `Return ${returnNumber}`, null, result, req);
      res.status(201).json(result);
    } catch (error) {
      const status = (error as any)?.status;
      if (status) return res.status(status).json({ message: (error as Error).message });
      if (error instanceof z.ZodError) return res.status(400).json({ message: "Invalid purchase return" });
      console.error("Purchase return failed:", error);
      respondWithApiError(res, error, "Failed to process purchase return");
    }
  });

  app.get("/api/reports/procurement-finance", requireAuth, requireAnyPermission("finance_view", "purchase_order_create", "purchase_order_update", "system_admin"), async (_req, res) => {
    try {
      const [quotations, invoiceRows, paymentRows, returnRows, poRows, vendorRows] = await Promise.all([
        db.select().from(vendorQuotations),
        db.select().from(purchaseInvoices).where(sql`${purchaseInvoices.status} <> 'void'`),
        db.select().from(purchaseInvoicePayments),
        db.select().from(purchaseReturns).where(eq(purchaseReturns.status, "approved")),
        db.select().from(purchaseOrders),
        db.select({ id: vendors.id, name: vendors.name }).from(vendors),
      ]);
      const vendorName = new Map(vendorRows.map(vendor => [vendor.id, vendor.name]));
      const poById = new Map(poRows.map(po => [po.id, po]));
      const invoicePayments = new Map<string, number>();
      for (const payment of paymentRows) invoicePayments.set(payment.invoiceId, (invoicePayments.get(payment.invoiceId) ?? 0) + Number(payment.amount));
      const approvedCreditsByInvoice = new Map<string, number>();
      for (const row of returnRows) {
        if (row.purchaseInvoiceId) approvedCreditsByInvoice.set(row.purchaseInvoiceId, (approvedCreditsByInvoice.get(row.purchaseInvoiceId) ?? 0) + Number(row.totalCredit));
      }
      const spendByVendor = new Map<string, { vendorId: string; vendorName: string; currency: string; amount: number }>();
      const payableByMethod = new Map<string, { paymentMethod: string; currency: string; pending: number; paid: number; partiallyPaid: number }>();
      for (const invoice of invoiceRows) {
        const currencyCode = invoice.currency || "USD";
        const vendorKey = `${currencyCode}:${invoice.vendorId}`;
        const vendorSummary = spendByVendor.get(vendorKey) ?? {
          vendorId: invoice.vendorId,
          vendorName: vendorName.get(invoice.vendorId) ?? "Unknown vendor",
          currency: currencyCode,
          amount: 0,
        };
        vendorSummary.amount += Number(invoice.grandTotal);
        spendByVendor.set(vendorKey, vendorSummary);
        const methodKey = `${currencyCode}:${invoice.paymentMethod}`;
        const summary = payableByMethod.get(methodKey) ?? { paymentMethod: invoice.paymentMethod, currency: currencyCode, pending: 0, paid: 0, partiallyPaid: 0 };
        const paidAmount = invoicePayments.get(invoice.id) ?? 0;
        const creditAmount = approvedCreditsByInvoice.get(invoice.id) ?? 0;
        if (invoice.paymentStatus === "partially_paid") summary.partiallyPaid += Math.max(Number(invoice.grandTotal) - paidAmount - creditAmount, 0);
        else summary.pending += Math.max(Number(invoice.grandTotal) - paidAmount - creditAmount, 0);
        payableByMethod.set(methodKey, summary);
      }
      const categoryTotals = new Map<string, { category: string; currency: string; amount: number }>();
      const departmentTotals = new Map<string, { departmentId: string; departmentName: string; currency: string; amount: number }>();
      const invoiceLines = await db.select({
        invoiceId: purchaseInvoiceItems.invoiceId,
        totalPrice: purchaseInvoiceItems.totalPrice,
        itemType: purchaseOrderItems.itemType,
        assetType: purchaseOrderItems.assetType,
        consumableCategory: purchaseOrderItems.consumableCategory,
        departmentId: purchaseOrders.departmentId,
      }).from(purchaseInvoiceItems)
        .innerJoin(purchaseInvoices, eq(purchaseInvoiceItems.invoiceId, purchaseInvoices.id))
        .innerJoin(purchaseOrderItems, eq(purchaseInvoiceItems.purchaseOrderItemId, purchaseOrderItems.id))
        .innerJoin(purchaseOrders, eq(purchaseInvoices.purchaseOrderId, purchaseOrders.id))
        .where(sql`${purchaseInvoices.status} <> 'void'`);
      const invoiceCurrency = new Map(invoiceRows.map(invoice => [invoice.id, invoice.currency || "USD"]));
      const departmentNames = await db.select({ id: departments.id, name: departments.name }).from(departments);
      const departmentName = new Map(departmentNames.map(department => [department.id, department.name]));
      for (const line of invoiceLines) {
        const currencyCode = invoiceCurrency.get(line.invoiceId) ?? "USD";
        const category = line.itemType === "consumable" ? (line.consumableCategory || "Consumables") : (line.assetType || "Hardware");
        const categoryKey = `${currencyCode}:${category}`;
        const categorySummary = categoryTotals.get(categoryKey) ?? { category, currency: currencyCode, amount: 0 };
        categorySummary.amount += Number(line.totalPrice);
        categoryTotals.set(categoryKey, categorySummary);
        if (line.departmentId) {
          const departmentKey = `${currencyCode}:${line.departmentId}`;
          const departmentSummary = departmentTotals.get(departmentKey) ?? {
            departmentId: line.departmentId,
            departmentName: departmentName.get(line.departmentId) ?? "Unknown department",
            currency: currencyCode,
            amount: 0,
          };
          departmentSummary.amount += Number(line.totalPrice);
          departmentTotals.set(departmentKey, departmentSummary);
        }
      }
      // Actual cash settlement follows each payment's method, not the invoice's
      // intended method (a terms invoice may be settled by several bank payments).
      for (const payment of paymentRows) {
        const currency = invoiceCurrency.get(payment.invoiceId);
        if (!currency) continue;
        const key = `${currency}:${payment.paymentMethod}`;
        const summary = payableByMethod.get(key) ?? { paymentMethod: payment.paymentMethod, currency, pending: 0, paid: 0, partiallyPaid: 0 };
        summary.paid += Number(payment.amount);
        payableByMethod.set(key, summary);
      }
      const paymentSummary = Array.from(payableByMethod.values());
      const returns = returnRows.map(row => ({ ...row, vendorName: vendorName.get(row.vendorId) ?? "Unknown vendor", purchaseOrderNumber: poById.get(row.purchaseOrderId)?.poNumber ?? "" }));
      const spendByCurrency = new Map<string, number>();
      for (const invoice of invoiceRows) spendByCurrency.set(invoice.currency || "USD", (spendByCurrency.get(invoice.currency || "USD") ?? 0) + Number(invoice.grandTotal));
      const returnsByCurrency = new Map<string, number>();
      for (const row of returns) returnsByCurrency.set(row.currency || "USD", (returnsByCurrency.get(row.currency || "USD") ?? 0) + Number(row.totalCredit));
      const paidByCurrency = new Map<string, number>();
      for (const payment of paymentRows) {
        const invoiceCurrencyCode = invoiceCurrency.get(payment.invoiceId) ?? "USD";
        paidByCurrency.set(invoiceCurrencyCode, (paidByCurrency.get(invoiceCurrencyCode) ?? 0) + Number(payment.amount));
      }
      res.json({
        procurementSpend: {
          totalByCurrency: Array.from(spendByCurrency.entries()).map(([currency, amount]) => ({ currency, amount })),
          byVendor: Array.from(spendByVendor.values()),
          byCategory: Array.from(categoryTotals.values()),
          byDepartment: Array.from(departmentTotals.values()),
        },
        accountsPayable: {
          invoiceCount: invoiceRows.length,
          paidCount: invoiceRows.filter(invoice => invoice.paymentStatus === "paid").length,
          partiallyPaidCount: invoiceRows.filter(invoice => invoice.paymentStatus === "partially_paid").length,
          pendingCount: invoiceRows.filter(invoice => invoice.paymentStatus === "pending").length,
          paidAmountByCurrency: Array.from(paidByCurrency.entries()).map(([currency, amount]) => ({ currency, amount })),
          byPaymentMethod: paymentSummary,
        },
        returns: {
          count: returns.length,
          totalByCurrency: Array.from(returnsByCurrency.entries()).map(([currency, amount]) => ({ currency, amount })),
          records: returns,
        },
        quotations: { count: quotations.length, convertedCount: quotations.filter(quote => quote.status === "converted").length },
      });
    } catch (error) {
      console.error("Procurement finance report failed:", error);
      respondWithApiError(res, error, "Failed to generate procurement finance report");
    }
  });

  // Budgets routes
  app.get("/api/budgets", requireAuth, requireAnyPermission("finance_view", "purchase_order_create", "purchase_order_update", "budget_create", "budget_update", "system_admin"), async (req, res) => {
    try {
      const budgets = await storage.getBudgets();
      res.json(budgets);
    } catch (error) {
      respondWithApiError(res, error, "Failed to fetch budgets");
    }
  });

  app.post("/api/budgets", requireAuth, requirePermission('budget_create'), async (req, res) => {
    try {
      const validatedData = insertBudgetSchema.parse(req.body);
      const budget = await storage.createBudget(validatedData);
      
      // Log audit
      await logAudit(req.user?.id, 'CREATE', 'budgets', budget.id, `${budget.fiscalYear} Budget`, null, { fiscalYear: budget.fiscalYear, budgetAmount: budget.budgetAmount, departmentId: budget.departmentId }, req);
      
      res.status(201).json(budget);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid budget data", errors: error.issues });
      }
      respondWithApiError(res, error, "Failed to create budget");
    }
  });

  app.put("/api/budgets/:id", requireAuth, requirePermission('budget_update'), async (req, res) => {
    try {
      const validatedData = insertBudgetSchema.partial().parse(req.body);
      
      // Get old budget for audit log
      const oldBudget = await storage.getBudget(req.params.id);
      
      const budget = await storage.updateBudget(req.params.id, validatedData);
      if (!budget) {
        return res.status(404).json({ message: "Budget not found" });
      }
      
      // Log audit
      await logAudit(req.user?.id, 'UPDATE', 'budgets', budget.id, `${budget.fiscalYear} Budget`, oldBudget, budget, req);
      
      res.json(budget);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid budget data", errors: error.issues });
      }
      respondWithApiError(res, error, "Failed to update budget");
    }
  });

  app.delete("/api/budgets/:id", requireAuth, requirePermission('budget_delete'), async (req, res) => {
    try {
      // Get budget for audit log before deleting
      const budget = await storage.getBudget(req.params.id);
      
      const deleted = await storage.deleteBudget(req.params.id);
      if (!deleted) {
        return res.status(404).json({ message: "Budget not found" });
      }
      
      // Log audit
      if (budget) {
        await logAudit(req.user?.id, 'DELETE', 'budgets', budget.id, `${budget.fiscalYear} Budget`, budget, null, req);
      }
      
      res.status(204).send();
    } catch (error) {
      respondWithApiError(res, error, "Failed to delete budget");
    }
  });

  // Maintenance Schedules routes
  app.get("/api/maintenance-schedules", requireAuth, async (req, res) => {
    try {
      const schedules = await storage.getMaintenanceSchedulesWithDetails();
      res.json(schedules);
    } catch (error) {
      respondWithApiError(res, error, "Failed to fetch maintenance schedules");
    }
  });

  app.post("/api/maintenance-schedules", requireAuth, requirePermission('maintenance_create'), async (req, res) => {
    try {
      const validatedData = insertMaintenanceScheduleSchema.parse(req.body);
      const schedule = await storage.createMaintenanceSchedule(validatedData);
      
      // Log audit
      await logAudit(req.user?.id, 'CREATE', 'maintenance_schedules', schedule.id, `Maintenance Schedule #${schedule.id}`, null, { assetId: schedule.assetId, maintenanceType: schedule.maintenanceType, frequency: schedule.frequency }, req);
      
      res.status(201).json(schedule);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid maintenance schedule data", errors: error.issues });
      }
      respondWithApiError(res, error, "Failed to create maintenance schedule");
    }
  });

  app.put("/api/maintenance-schedules/:id", requireAuth, requirePermission('maintenance_update'), async (req, res) => {
    try {
      const validatedData = insertMaintenanceScheduleSchema.partial().parse(req.body);
      
      // Get old schedule for audit log
      const oldSchedule = await storage.getMaintenanceSchedule(req.params.id);
      
      const schedule = await storage.updateMaintenanceSchedule(req.params.id, validatedData);
      if (!schedule) {
        return res.status(404).json({ message: "Maintenance schedule not found" });
      }
      
      // Log audit
      await logAudit(req.user?.id, 'UPDATE', 'maintenance_schedules', schedule.id, `Maintenance Schedule #${schedule.id}`, oldSchedule, schedule, req);
      
      res.json(schedule);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid maintenance schedule data", errors: error.issues });
      }
      respondWithApiError(res, error, "Failed to update maintenance schedule");
    }
  });

  app.delete("/api/maintenance-schedules/:id", requireAuth, requirePermission('maintenance_delete'), async (req, res) => {
    try {
      // Get schedule for audit log before deleting
      const schedule = await storage.getMaintenanceSchedule(req.params.id);
      
      const deleted = await storage.deleteMaintenanceSchedule(req.params.id);
      if (!deleted) {
        return res.status(404).json({ message: "Maintenance schedule not found" });
      }
      
      // Log audit
      if (schedule) {
        await logAudit(req.user?.id, 'DELETE', 'maintenance_schedules', schedule.id, `Maintenance Schedule #${schedule.id}`, schedule, null, req);
      }
      
      res.status(204).send();
    } catch (error) {
      respondWithApiError(res, error, "Failed to delete maintenance schedule");
    }
  });

  // Maintenance Records routes
  app.get("/api/maintenance-records", requireAuth, async (req, res) => {
    try {
      const records = await storage.getMaintenanceRecordsWithDetails();
      res.json(records);
    } catch (error) {
      respondWithApiError(res, error, "Failed to fetch maintenance records");
    }
  });

  app.post("/api/maintenance-records", requireAuth, requirePermission('maintenance_create'), async (req, res) => {
    try {
      const { advanceSchedule, ...recordInput } = maintenanceRecordSubmissionSchema.parse(req.body);
      const { record, previousSchedule, schedule } = await storage.createMaintenanceRecordWithScheduleAdvance(recordInput, advanceSchedule);
      
      // Log audit
      await logAudit(req.user?.id, 'CREATE', 'maintenance_records', record.id, `Maintenance Record #${record.id}`, null, record, req);
      if (previousSchedule && schedule &&
          (previousSchedule.nextDue !== schedule.nextDue || previousSchedule.isActive !== schedule.isActive)) {
        await logAudit(req.user?.id, 'UPDATE', 'maintenance_schedules', schedule.id, `Maintenance Schedule #${schedule.id}`, previousSchedule, schedule, req);
      }
      
      res.status(201).json(record);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid maintenance record data", errors: error.issues });
      }
      if (error instanceof Error && error.message === "Maintenance schedule not found.") {
        return res.status(404).json({ message: error.message });
      }
      if (error instanceof Error && error.message === "The selected schedule belongs to a different asset.") {
        return res.status(400).json({ message: error.message });
      }
      if (error instanceof Error && (error.message === "This schedule is already completed." || error.message.startsWith("This schedule has advanced"))) {
        return res.status(409).json({ message: error.message });
      }
      respondWithApiError(res, error, "Failed to create maintenance record");
    }
  });

  app.put("/api/maintenance-records/:id", requireAuth, requirePermission('maintenance_update'), async (req, res) => {
    try {
      const validatedData = insertMaintenanceRecordSchema.partial().parse(req.body);
      
      // Get old record for audit log
      const oldRecord = await storage.getMaintenanceRecord(req.params.id);
      
      const record = await storage.updateMaintenanceRecord(req.params.id, validatedData);
      if (!record) {
        return res.status(404).json({ message: "Maintenance record not found" });
      }
      
      // Log audit
      await logAudit(req.user?.id, 'UPDATE', 'maintenance_records', record.id, `Maintenance Record #${record.id}`, oldRecord, record, req);
      
      res.json(record);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid maintenance record data", errors: error.issues });
      }
      respondWithApiError(res, error, "Failed to update maintenance record");
    }
  });

  app.delete("/api/maintenance-records/:id", requireAuth, requirePermission('maintenance_delete'), async (req, res) => {
    try {
      // Get record for audit log before deleting
      const record = await storage.getMaintenanceRecord(req.params.id);
      
      const deleted = await storage.deleteMaintenanceRecord(req.params.id);
      if (!deleted) {
        return res.status(404).json({ message: "Maintenance record not found" });
      }
      
      // Log audit
      if (record) {
        await logAudit(req.user?.id, 'DELETE', 'maintenance_records', record.id, `Maintenance Record #${record.id}`, record, null, req);
      }
      
      res.status(204).send();
    } catch (error) {
      respondWithApiError(res, error, "Failed to delete maintenance record");
    }
  });

  // ISO 27001 Compliance Routes
  
  // Get assets by security classification
  app.get("/api/compliance/assets/security-classification/:classification", requireAuth, requirePermission('compliance_view'), async (req, res) => {
    try {
      const assets = await storage.getAssets();
      const filtered = assets.filter((asset: any) => 
        asset.informationClassification === req.params.classification
      );
      res.json(filtered);
    } catch (error) {
      respondWithApiError(res, error, "Failed to fetch assets by security classification");
    }
  });

  // Get assets due for compliance audit
  app.get("/api/compliance/assets/audit-due", requireAuth, requirePermission('compliance_view'), async (req, res) => {
    try {
      const assets = await storage.getAssets();
      const today = new Date();
      const filtered = assets.filter((asset: any) => {
        if (!asset.nextAuditDate) return false;
        const auditDate = new Date(asset.nextAuditDate);
        return auditDate <= today;
      });
      res.json(filtered);
    } catch (error) {
      respondWithApiError(res, error, "Failed to fetch assets due for audit");
    }
  });

  // Get assets by compliance status
  app.get("/api/compliance/assets/status/:status", requireAuth, requirePermission('compliance_view'), async (req, res) => {
    try {
      const assets = await storage.getAssets();
      const filtered = assets.filter((asset: any) => 
        asset.complianceStatus === req.params.status
      );
      res.json(filtered);
    } catch (error) {
      respondWithApiError(res, error, "Failed to fetch assets by compliance status");
    }
  });

  // Get vendors by risk level
  app.get("/api/compliance/vendors/risk/:level", requireAuth, requirePermission('compliance_view'), async (req, res) => {
    try {
      const vendors = await storage.getVendors();
      const filtered = vendors.filter((vendor: any) => 
        vendor.riskAssessmentScore === req.params.level
      );
      res.json(filtered);
    } catch (error) {
      respondWithApiError(res, error, "Failed to fetch vendors by risk level");
    }
  });

  // Get compliance dashboard summary
  app.get("/api/compliance/dashboard", requireAuth, requirePermission('compliance_view'), async (req, res) => {
    try {
      const assets = await storage.getAssets();
      const vendors = await storage.getVendors();
      
      // Security classification breakdown
      const securityBreakdown = {
        public: assets.filter((a: any) => a.informationClassification === 'public').length,
        internal: assets.filter((a: any) => a.informationClassification === 'internal').length,
        confidential: assets.filter((a: any) => a.informationClassification === 'confidential').length,
        restricted: assets.filter((a: any) => a.informationClassification === 'restricted').length
      };

      // Compliance status breakdown
      const complianceBreakdown = {
        compliant: assets.filter((a: any) => a.complianceStatus === 'compliant').length,
        'non-compliant': assets.filter((a: any) => a.complianceStatus === 'non-compliant').length,
        'under-review': assets.filter((a: any) => a.complianceStatus === 'under-review').length,
        'not-assessed': assets.filter((a: any) => a.complianceStatus === 'not-assessed').length
      };

      // Vendor risk breakdown
      const vendorRiskBreakdown = {
        low: vendors.filter((v: any) => v.riskAssessmentScore === 'low').length,
        medium: vendors.filter((v: any) => v.riskAssessmentScore === 'medium').length,
        high: vendors.filter((v: any) => v.riskAssessmentScore === 'high').length,
        critical: vendors.filter((v: any) => v.riskAssessmentScore === 'critical').length
      };

      // Assets due for audit
      const today = new Date();
      const assetsDueForAudit = assets.filter((asset: any) => {
        if (!asset.nextAuditDate) return false;
        const auditDate = new Date(asset.nextAuditDate);
        return auditDate <= today;
      }).length;

      res.json({
        securityBreakdown,
        complianceBreakdown,
        vendorRiskBreakdown,
        assetsDueForAudit,
        totalAssets: assets.length,
        totalVendors: vendors.length
      });
    } catch (error) {
      respondWithApiError(res, error, "Failed to fetch compliance dashboard data");
    }
  });

  // Reports API
  app.get("/api/reports/asset-summary", requireAuth, async (req, res) => {
    try {
      const assets = await storage.getAssets();
      const departments = await storage.getDepartments();
      const locations = await storage.getLocations();
      
      // Assets by type
      const byType = assets.reduce((acc: any, asset: any) => {
        acc[asset.assetType] = (acc[asset.assetType] || 0) + 1;
        return acc;
      }, {});
      
      // Assets by status
      const byStatus = assets.reduce((acc: any, asset: any) => {
        acc[asset.status] = (acc[asset.status] || 0) + 1;
        return acc;
      }, {});
      
      // Assets by department
      const byDepartment = assets.reduce((acc: any, asset: any) => {
        const deptId = asset.departmentId || 'unassigned';
        acc[deptId] = (acc[deptId] || 0) + 1;
        return acc;
      }, {});
      
      // Assets by location
      const byLocation = assets.reduce((acc: any, asset: any) => {
        const locId = asset.locationId || 'unassigned';
        acc[locId] = (acc[locId] || 0) + 1;
        return acc;
      }, {});
      
      res.json({
        totalAssets: assets.length,
        byType,
        byStatus,
        byDepartment,
        byLocation,
        departments,
        locations
      });
    } catch (error) {
      respondWithApiError(res, error, "Failed to generate asset summary report");
    }
  });
  
  app.get("/api/reports/asset-lifecycle", requireAuth, async (req, res) => {
    try {
      const assets = await storage.getAssets();
      const today = new Date();
      
      // Calculate asset age and categorize
      const lifecycle = assets.map((asset: any) => {
        const purchaseDate = asset.purchaseDate ? new Date(asset.purchaseDate) : null;
        const warrantyEnd = asset.warrantyEndDate ? new Date(asset.warrantyEndDate) : null;
        
        let ageInMonths = 0;
        let ageCategory = 'unknown';
        
        if (purchaseDate) {
          ageInMonths = Math.floor((today.getTime() - purchaseDate.getTime()) / (1000 * 60 * 60 * 24 * 30));
          
          if (ageInMonths < 12) ageCategory = 'new';
          else if (ageInMonths < 36) ageCategory = 'current';
          else if (ageInMonths < 60) ageCategory = 'aging';
          else ageCategory = 'old';
        }
        
        const warrantyStatus = warrantyEnd ? (warrantyEnd > today ? 'active' : 'expired') : 'none';
        
        return {
          id: asset.id,
          assetTag: asset.assetTag,
          assetType: asset.assetType,
          purchaseDate: asset.purchaseDate,
          ageInMonths,
          ageCategory,
          warrantyStatus,
          warrantyEndDate: asset.warrantyEndDate,
          status: asset.status
        };
      });
      
      // Group by age category
      const byAgeCategory = lifecycle.reduce((acc: any, asset: any) => {
        acc[asset.ageCategory] = (acc[asset.ageCategory] || 0) + 1;
        return acc;
      }, {});
      
      // Group by warranty status
      const byWarrantyStatus = lifecycle.reduce((acc: any, asset: any) => {
        acc[asset.warrantyStatus] = (acc[asset.warrantyStatus] || 0) + 1;
        return acc;
      }, {});
      
      res.json({
        assets: lifecycle,
        byAgeCategory,
        byWarrantyStatus
      });
    } catch (error) {
      respondWithApiError(res, error, "Failed to generate asset lifecycle report");
    }
  });
  
  app.get("/api/reports/hardware-inventory", requireAuth, async (req, res) => {
    try {
      const assets = await storage.getAssets();
      
      const softwareTypes = ['software', 'service', 'saas', 'application'];
      const hardwareAssets = assets.filter((asset: any) => {
        const t = (asset.type || asset.assetType || "").toLowerCase();
        return !softwareTypes.includes(t);
      }).map((asset: any) => ({
        id: asset.id,
        assetTag: asset.assetTag,
        assetType: asset.type || asset.assetType,
        manufacturer: asset.manufacturer || "",
        model: asset.model || "",
        serialNumber: asset.serialNumber || "",
        processor: asset.processor || "",
        ram: asset.ram || "",
        storage: asset.storage || "",
        os: asset.operatingSystem || "",
        purchaseDate: asset.purchaseDate,
        purchaseCost: asset.purchasePrice || asset.purchaseCost,
        status: asset.status
      }));
      
      res.json(hardwareAssets);
    } catch (error) {
      respondWithApiError(res, error, "Failed to generate hardware inventory report");
    }
  });
  
  app.get("/api/reports/asset-assignments", requireAuth, async (req, res) => {
    try {
      const assignments = await storage.getAssignmentsWithDetails();
      const assets = await storage.getAssets();
      const employees = await storage.getEmployees();
      
      // Current assignments (not returned)
      const currentAssignments = assignments.filter((a: any) => !a.returnedDate);
      
      // Create a map of asset ID to current assignment details
      const assetAssignmentMap = new Map();
      currentAssignments.forEach((a: any) => {
        assetAssignmentMap.set(a.assetId, {
          employeeName: a.employee
            ? `${a.employee.firstName} ${a.employee.lastName}`.trim()
            : (a.employeeName || null),
          employeeId: a.employeeId || a.employee?.id,
          assignedDate: a.assignedDate,
          assignmentId: a.id
        });
      });
      
      // Build comprehensive asset utilization list showing ALL assets
      const assetUtilization = assets.map((asset: any) => {
        const currentAssignment = assetAssignmentMap.get(asset.id);
        return {
          id: asset.id,
          assetTag: asset.assetTag || 'N/A',
          name: asset.name || 'N/A',
          type: asset.type || 'N/A',
          serialNumber: asset.serialNumber || 'N/A',
          model: asset.model || 'N/A',
          status: asset.status || 'available',
          assignedTo: currentAssignment?.employeeName || null,
          assignedDate: currentAssignment?.assignedDate || null,
          locationId: asset.locationId || null
        };
      });
      
      // Assignment history for detailed tracking
      const assignmentHistory = assignments.map((a: any) => ({
        id: a.id,
        assetTag: a.asset?.assetTag || a.assetTag || null,
        assetType: a.asset?.type || a.assetType || null,
        employeeName: a.employee
          ? `${a.employee.firstName} ${a.employee.lastName}`.trim()
          : (a.employeeName || null),
        assignedDate: a.assignedDate,
        returnedDate: a.returnedDate,
        status: a.returnedDate ? 'returned' : 'active'
      }));
      
      // Calculate summary statistics
      const totalAssets = assets.length;
      const availableAssets = assets.filter((a: any) => a.status === 'available').length;
      const assignedAssets = assets.filter((a: any) => a.status === 'assigned').length;
      const maintenanceAssets = assets.filter((a: any) => a.status === 'maintenance').length;
      const retiredAssets = assets.filter((a: any) => a.status === 'retired').length;
      
      res.json({
        // Summary statistics
        totalAssets,
        availableAssets,
        assignedAssets,
        maintenanceAssets,
        retiredAssets,
        currentAssignments: currentAssignments.length,
        totalAssignments: assignments.length,
        // Comprehensive asset list with utilization
        assetUtilization,
        // Legacy assignment history
        assignmentHistory
      });
    } catch (error) {
      respondWithApiError(res, error, "Failed to generate asset assignments report");
    }
  });
  
  // Alias for frontend compatibility
  app.get("/api/reports/assignments", requireAuth, async (req, res) => {
    try {
      const assignments = await storage.getAssignmentsWithDetails();
      const assets = await storage.getAssets();
      
      // Current assignments (not returned)
      const currentAssignments = assignments.filter((a: any) => !a.returnedDate);
      
      // Create a map of asset ID to current assignment details
      const assetAssignmentMap = new Map();
      currentAssignments.forEach((a: any) => {
        assetAssignmentMap.set(a.assetId, {
          employeeName: a.employee
            ? `${a.employee.firstName} ${a.employee.lastName}`.trim()
            : (a.employeeName || null),
          employeeId: a.employeeId || a.employee?.id,
          assignedDate: a.assignedDate,
          assignmentId: a.id
        });
      });
      
      // Build comprehensive asset utilization list showing ALL assets
      const assetUtilization = assets.map((asset: any) => {
        const currentAssignment = assetAssignmentMap.get(asset.id);
        return {
          id: asset.id,
          assetTag: asset.assetTag || 'N/A',
          name: asset.name || 'N/A',
          type: asset.type || 'N/A',
          serialNumber: asset.serialNumber || 'N/A',
          model: asset.model || 'N/A',
          status: asset.status || 'available',
          assignedTo: currentAssignment?.employeeName || null,
          assignedDate: currentAssignment?.assignedDate || null,
          locationId: asset.locationId || null
        };
      });
      
      // Assignment history for detailed tracking
      const assignmentHistory = assignments.map((a: any) => ({
        id: a.id,
        assetTag: a.asset?.assetTag || a.assetTag || null,
        assetType: a.asset?.type || a.assetType || null,
        employeeName: a.employee
          ? `${a.employee.firstName} ${a.employee.lastName}`.trim()
          : (a.employeeName || null),
        assignedDate: a.assignedDate,
        returnedDate: a.returnedDate,
        status: a.returnedDate ? 'returned' : 'active'
      }));
      
      // Calculate summary statistics
      const totalAssets = assets.length;
      const availableAssets = assets.filter((a: any) => a.status === 'available').length;
      const assignedAssets = assets.filter((a: any) => a.status === 'assigned').length;
      const maintenanceAssets = assets.filter((a: any) => a.status === 'maintenance').length;
      const retiredAssets = assets.filter((a: any) => a.status === 'retired').length;
      
      res.json({
        // Summary statistics
        totalAssets,
        availableAssets,
        assignedAssets,
        maintenanceAssets,
        retiredAssets,
        currentAssignments: currentAssignments.length,
        totalAssignments: assignments.length,
        // Comprehensive asset list with utilization
        assetUtilization,
        // Legacy assignment history
        assignmentHistory
      });
    } catch (error) {
      respondWithApiError(res, error, "Failed to generate assignments report");
    }
  });
  
  app.get("/api/reports/maintenance-schedule", requireAuth, async (req, res) => {
    try {
      const schedules = await storage.getMaintenanceSchedulesWithDetails();
      const records = await storage.getMaintenanceRecordsWithDetails();
      const today = new Date();
      
      // Upcoming maintenance
      const upcoming = schedules.filter((s: any) => {
        const nextDate = new Date(s.nextMaintenanceDate);
        return nextDate > today;
      }).sort((a: any, b: any) => 
        new Date(a.nextMaintenanceDate).getTime() - new Date(b.nextMaintenanceDate).getTime()
      );
      
      // Overdue maintenance
      const overdue = schedules.filter((s: any) => {
        const nextDate = new Date(s.nextMaintenanceDate);
        return nextDate <= today;
      });
      
      // Maintenance by type
      const byType = records.reduce((acc: any, record: any) => {
        acc[record.maintenanceType] = (acc[record.maintenanceType] || 0) + 1;
        return acc;
      }, {});
      
      res.json({
        upcoming,
        overdue,
        totalScheduled: schedules.length,
        totalCompleted: records.length,
        byType
      });
    } catch (error) {
      respondWithApiError(res, error, "Failed to generate maintenance schedule report");
    }
  });
  
  app.get("/api/reports/purchase-orders", requireAuth, async (req, res) => {
    try {
      const purchaseOrders = await storage.getPurchaseOrdersWithDetails();
      const pos = purchaseOrders as any[];

      const totalValue = pos.reduce((s: number, po: any) => s + parseFloat(po.totalAmount || 0), 0);
      const pendingPOs = pos.filter((po: any) => po.status === "pending" || po.status === "submitted" || po.status === "approved").length;
      const receivedPOs = pos.filter((po: any) => po.status === "received" || po.status === "delivered" || po.status === "completed").length;
      const recentPOs = pos.slice(0, 50).map((po: any) => ({
        id: po.id,
        poNumber: po.poNumber,
        vendorName: po.vendorName,
        orderDate: po.orderDate,
        totalAmount: parseFloat(po.totalAmount || 0),
        status: po.status,
      }));

      res.json({
        totalPOs: pos.length,
        totalValue,
        pendingPOs,
        receivedPOs,
        recentPOs,
      });
    } catch (error) {
      respondWithApiError(res, error, "Failed to generate purchase orders report");
    }
  });
  
  app.get("/api/reports/budget-analysis", requireAuth, async (req, res) => {
    try {
      const budgets = await storage.getBudgets();
      const departments = await storage.getDepartments();
      
      const budgetAnalysis = budgets.map((budget: any) => {
        const budgetAmount = parseFloat(budget.budgetAmount || 0);
        const spentAmount = parseFloat(budget.spentAmount || 0);
        const remaining = budgetAmount - spentAmount;
        const percentUsed = budgetAmount > 0 ? (spentAmount / budgetAmount) * 100 : 0;
        
        const department = departments.find((d: any) => d.id === budget.departmentId);
        
        return {
          id: budget.id,
          fiscalYear: budget.fiscalYear,
          departmentName: department?.name || 'Unknown',
          budgetAmount,
          spentAmount,
          remaining,
          percentUsed: Math.round(percentUsed * 100) / 100,
          status: percentUsed >= 100 ? 'exceeded' : percentUsed >= 90 ? 'critical' : percentUsed >= 75 ? 'warning' : 'good'
        };
      });
      
      const totalBudget = budgetAnalysis.reduce((sum, b) => sum + b.budgetAmount, 0);
      const totalSpent = budgetAnalysis.reduce((sum, b) => sum + b.spentAmount, 0);
      
      res.json({
        totalBudget,
        totalSpent,
        totalRemaining: totalBudget - totalSpent,
        budgets: budgetAnalysis
      });
    } catch (error) {
      respondWithApiError(res, error, "Failed to generate budget analysis report");
    }
  });
  
  app.get("/api/reports/assets-by-department", requireAuth, async (req, res) => {
    try {
      const assets = await storage.getAssets();
      const departments = await storage.getDepartments();
      
      const departmentReport = departments.map((dept: any) => {
        const deptAssets = assets.filter((a: any) => a.departmentId === dept.id);
        const totalValue = deptAssets.reduce((sum: number, a: any) => 
          sum + parseFloat(a.purchaseCost || 0), 0
        );
        
        const byType = deptAssets.reduce((acc: any, asset: any) => {
          acc[asset.assetType] = (acc[asset.assetType] || 0) + 1;
          return acc;
        }, {});
        
        return {
          departmentId: dept.id,
          departmentName: dept.name,
          totalAssets: deptAssets.length,
          totalValue,
          byType
        };
      });
      
      res.json(departmentReport);
    } catch (error) {
      respondWithApiError(res, error, "Failed to generate assets by department report");
    }
  });
  
  app.get("/api/reports/expiring-warranties", requireAuth, async (req, res) => {
    try {
      const assets = await storage.getAssets();
      const today = new Date();
      const threeMonthsFromNow = new Date(today);
      threeMonthsFromNow.setMonth(threeMonthsFromNow.getMonth() + 3);
      
      const expiringWarranties = assets
        .filter((asset: any) => {
          if (!asset.warrantyEndDate) return false;
          const warrantyEnd = new Date(asset.warrantyEndDate);
          return warrantyEnd > today && warrantyEnd <= threeMonthsFromNow;
        })
        .map((asset: any) => ({
          id: asset.id,
          assetTag: asset.assetTag,
          assetType: asset.assetType,
          manufacturer: asset.manufacturer,
          model: asset.model,
          warrantyEndDate: asset.warrantyEndDate,
          daysRemaining: Math.floor((new Date(asset.warrantyEndDate).getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
        }))
        .sort((a: any, b: any) => a.daysRemaining - b.daysRemaining);
      
      const expiredWarranties = assets
        .filter((asset: any) => {
          if (!asset.warrantyEndDate) return false;
          const warrantyEnd = new Date(asset.warrantyEndDate);
          return warrantyEnd <= today;
        })
        .map((asset: any) => ({
          id: asset.id,
          assetTag: asset.assetTag,
          assetType: asset.assetType,
          manufacturer: asset.manufacturer,
          model: asset.model,
          warrantyEndDate: asset.warrantyEndDate
        }));
      
      res.json({
        expiringWarranties,
        expiredWarranties,
        expiringCount: expiringWarranties.length,
        expiredCount: expiredWarranties.length
      });
    } catch (error) {
      respondWithApiError(res, error, "Failed to generate expiring warranties report");
    }
  });
  
  app.get("/api/reports/vendor-analysis", requireAuth, async (req, res) => {
    try {
      const vendors = await storage.getVendors();
      const assets = await storage.getAssets();
      const purchaseOrders = await storage.getPurchaseOrdersWithDetails();
      
      const vendorAnalysis = vendors.map((vendor: any) => {
        const vendorAssets = assets.filter((a: any) => a.vendorId === vendor.id);
        const vendorPOs = purchaseOrders.filter((po: any) => po.vendorId === vendor.id);
        const totalSpending = vendorPOs.reduce((sum: number, po: any) => 
          sum + parseFloat(po.totalAmount || 0), 0
        );
        
        return {
          id: vendor.id,
          vendorName: vendor.vendorName,
          contactPerson: vendor.contactPerson,
          email: vendor.email,
          totalAssets: vendorAssets.length,
          totalPurchaseOrders: vendorPOs.length,
          totalSpending,
          riskLevel: vendor.riskAssessmentScore || 'not-assessed'
        };
      });
      
      res.json(vendorAnalysis.sort((a, b) => b.totalSpending - a.totalSpending));
    } catch (error) {
      respondWithApiError(res, error, "Failed to generate vendor analysis report");
    }
  });

  // ---- SHORT-PATH REPORT ALIASES (matched to frontend queryKeys) ----

  app.get("/api/reports/summary", requireAuth, async (req, res) => {
    try {
      const assets = await storage.getAssets();
      const byType: Record<string, number> = {};
      const byStatus: Record<string, number> = {};
      assets.forEach((a: any) => {
        byType[a.type || a.assetType || "Unknown"] = (byType[a.type || a.assetType || "Unknown"] || 0) + 1;
        byStatus[a.status || "unknown"] = (byStatus[a.status || "unknown"] || 0) + 1;
      });
      res.json({
        totalAssets: assets.length,
        available: byStatus["available"] || byStatus["Available"] || 0,
        assigned: byStatus["assigned"] || byStatus["Assigned"] || 0,
        maintenance: byStatus["maintenance"] || byStatus["Maintenance"] || 0,
        retired: byStatus["retired"] || byStatus["Retired"] || 0,
        byType,
        byStatus,
      });
    } catch (error) {
      respondWithApiError(res, error, "Failed to generate summary report");
    }
  });

  app.get("/api/reports/lifecycle", requireAuth, async (req, res) => {
    try {
      const assets = await storage.getAssets();
      const today = new Date();
      let totalAge = 0;
      let countWithDate = 0;
      const byAgeGroup: Record<string, number> = { "0-1 years": 0, "1-3 years": 0, "3-5 years": 0, "5+ years": 0, "Unknown": 0 };
      const byWarrantyStatus: Record<string, number> = { Active: 0, "Expiring Soon": 0, Expired: 0, "No Warranty": 0 };
      assets.forEach((a: any) => {
        const purchaseDate = a.purchaseDate ? new Date(a.purchaseDate) : null;
        if (purchaseDate) {
          const ageYears = (today.getTime() - purchaseDate.getTime()) / (1000 * 60 * 60 * 24 * 365);
          totalAge += ageYears;
          countWithDate++;
          if (ageYears < 1) byAgeGroup["0-1 years"]++;
          else if (ageYears < 3) byAgeGroup["1-3 years"]++;
          else if (ageYears < 5) byAgeGroup["3-5 years"]++;
          else byAgeGroup["5+ years"]++;
        } else {
          byAgeGroup["Unknown"]++;
        }
        const warrantyEnd = a.warrantyExpiry ? new Date(a.warrantyExpiry) : (a.warrantyEndDate ? new Date(a.warrantyEndDate) : null);
        if (!warrantyEnd) {
          byWarrantyStatus["No Warranty"]++;
        } else if (warrantyEnd < today) {
          byWarrantyStatus["Expired"]++;
        } else {
          const daysLeft = (warrantyEnd.getTime() - today.getTime()) / (1000 * 60 * 60 * 24);
          if (daysLeft <= 90) byWarrantyStatus["Expiring Soon"]++;
          else byWarrantyStatus["Active"]++;
        }
      });
      res.json({
        averageAge: countWithDate > 0 ? totalAge / countWithDate : 0,
        byAgeGroup,
        byWarrantyStatus,
      });
    } catch (error) {
      respondWithApiError(res, error, "Failed to generate lifecycle report");
    }
  });

  app.get("/api/reports/hardware", requireAuth, async (req, res) => {
    try {
      const assets = await storage.getAssets();
      const result = assets.map((a: any) => ({
        id: a.id,
        assetTag: a.assetTag || a.id?.slice(0, 8).toUpperCase(),
        assetType: a.type || a.assetType || "Hardware",
        manufacturer: a.manufacturer || null,
        model: a.model || null,
        serialNumber: a.serialNumber || null,
        processor: a.processor || null,
        ram: a.ram || null,
        storage: a.storageCapacity || a.storage || null,
        status: a.status || "available",
        purchaseDate: a.purchaseDate || null,
        purchaseCost: a.purchasePrice || a.purchaseCost || null,
        os: a.operatingSystem || null,
        name: a.name || null,
      }));
      res.json(result);
    } catch (error) {
      respondWithApiError(res, error, "Failed to generate hardware report");
    }
  });

  const MISSING_DATA_FIELDS: Record<string, { key: string; label: string }[]> = {
    laptop: [
      { key: "manufacturer", label: "Manufacturer" },
      { key: "model", label: "Model" },
      { key: "processor", label: "CPU" },
      { key: "ram", label: "RAM" },
      { key: "storage", label: "Storage" },
      { key: "acquisitionDate", label: "Manufacture/Acquisition Date" },
    ],
    desktop: [
      { key: "manufacturer", label: "Manufacturer" },
      { key: "model", label: "Model" },
      { key: "processor", label: "CPU" },
      { key: "ram", label: "RAM" },
      { key: "storage", label: "Storage" },
      { key: "acquisitionDate", label: "Manufacture/Acquisition Date" },
    ],
    server: [
      { key: "manufacturer", label: "Manufacturer" },
      { key: "model", label: "Model" },
      { key: "processor", label: "CPU" },
      { key: "ram", label: "RAM" },
      { key: "storage", label: "Storage" },
      { key: "acquisitionDate", label: "Manufacture/Acquisition Date" },
    ],
    monitor: [
      { key: "manufacturer", label: "Manufacturer" },
      { key: "model", label: "Model" },
      { key: "acquisitionDate", label: "Manufacture/Acquisition Date" },
    ],
    phone: [
      { key: "manufacturer", label: "Manufacturer" },
      { key: "model", label: "Model" },
      { key: "storage", label: "Storage" },
      { key: "acquisitionDate", label: "Manufacture/Acquisition Date" },
    ],
    printer: [
      { key: "manufacturer", label: "Manufacturer" },
      { key: "model", label: "Model" },
      { key: "acquisitionDate", label: "Manufacture/Acquisition Date" },
    ],
    network: [
      { key: "manufacturer", label: "Manufacturer" },
      { key: "model", label: "Model" },
      { key: "acquisitionDate", label: "Manufacture/Acquisition Date" },
    ],
    software: [
      { key: "manufacturer", label: "Manufacturer" },
      { key: "model", label: "Model/Version" },
    ],
    other: [
      { key: "manufacturer", label: "Manufacturer" },
      { key: "model", label: "Model" },
    ],
  };

  app.get("/api/reports/missing-data", requireAuth, async (req, res) => {
    try {
      const assets = await storage.getAssets();
      const items = assets
        .map((a: any) => {
          const rules = MISSING_DATA_FIELDS[a.type] || MISSING_DATA_FIELDS.other;
          const missingFields = rules
            .filter((f) => {
              const value = a[f.key];
              return value === null || value === undefined || String(value).trim() === "";
            })
            .map((f) => f.label);
          return {
            id: a.id,
            name: a.name,
            assetTag: a.assetTag || null,
            type: a.type || "other",
            status: a.status || "available",
            missingFields,
          };
        })
        .filter((item) => item.missingFields.length > 0);

      const byType: Record<string, number> = {};
      for (const item of items) {
        byType[item.type] = (byType[item.type] || 0) + 1;
      }

      res.json({
        totalAssets: assets.length,
        assetsWithMissingData: items.length,
        byType,
        items,
      });
    } catch (error) {
      respondWithApiError(res, error, "Failed to generate missing data report");
    }
  });

  app.get("/api/reports/maintenance", requireAuth, async (req, res) => {
    try {
      const schedules = await storage.getMaintenanceSchedules();
      const assets = await storage.getAssets();
      const today = new Date();
      const assetMap = new Map(assets.map((a: any) => [a.id, a]));
      const enrich = (s: any) => {
        const asset = assetMap.get(s.assetId) as any;
        const scheduledDate = s.nextDue || s.scheduledDate || s.nextMaintenanceDate;
        const isOverdue = scheduledDate && new Date(scheduledDate) < today;
        return {
          id: s.id,
          assetTag: asset?.assetTag || asset?.name || s.assetId,
          assetName: asset?.name || "Unknown Asset",
          maintenanceType: s.maintenanceType || "preventive",
          scheduledDate,
          description: s.description || null,
          status: isOverdue ? "overdue" : "scheduled",
          priority: s.priority || "medium",
          frequency: s.frequency || null,
          completedDate: null,
        };
      };
      const allSchedules = schedules.map(enrich);
      const upcomingMaintenance = allSchedules.filter((s: any) => {
        if (!s.scheduledDate) return false;
        const d = new Date(s.scheduledDate);
        return d >= today;
      });
      const overdueMaintenance = allSchedules.filter((s: any) => {
        if (!s.scheduledDate) return false;
        const d = new Date(s.scheduledDate);
        return d < today;
      });
      const completedMaintenance: any[] = [];
      res.json({
        totalScheduled: allSchedules.length,
        upcomingMaintenance,
        overdueMaintenance,
        completedMaintenance,
      });
    } catch (error) {
      respondWithApiError(res, error, "Failed to generate maintenance report");
    }
  });

  app.get("/api/reports/budget", requireAuth, async (req, res) => {
    try {
      const budgets = await storage.getBudgets();
      const departments = await storage.getDepartments();
      const deptMap = new Map(departments.map((d: any) => [d.id, d]));
      const budgetDetails = budgets.map((b: any) => {
        const dept = deptMap.get(b.departmentId) as any;
        const budgetAmount = parseFloat(b.budgetAmount || b.totalAmount || 0);
        const spent = parseFloat(b.spentAmount || b.spent || 0);
        const remaining = budgetAmount - spent;
        const utilization = budgetAmount > 0 ? (spent / budgetAmount) * 100 : 0;
        return {
          id: b.id,
          departmentName: dept?.name || "Unknown",
          budgetAmount,
          spent,
          remaining,
          utilization: Math.round(utilization * 10) / 10,
          fiscalYear: b.fiscalYear,
          status: b.status,
        };
      });
      const totalBudget = budgetDetails.reduce((s: number, b: any) => s + b.budgetAmount, 0);
      const totalSpent = budgetDetails.reduce((s: number, b: any) => s + b.spent, 0);
      const averageUtilization = budgetDetails.length > 0 ? budgetDetails.reduce((s: number, b: any) => s + b.utilization, 0) / budgetDetails.length : 0;
      res.json({
        totalBudget,
        totalSpent,
        totalRemaining: totalBudget - totalSpent,
        averageUtilization: Math.round(averageUtilization * 10) / 10,
        budgetDetails,
      });
    } catch (error) {
      respondWithApiError(res, error, "Failed to generate budget report");
    }
  });

  app.get("/api/reports/department", requireAuth, async (req, res) => {
    try {
      const assets = await storage.getAssets();
      const departments = await storage.getDepartments();
      const now = new Date();

      const departmentDetails = departments.map((dept: any) => {
        const deptAssets = assets.filter((a: any) => a.departmentId === dept.id);
        const totalAssets = deptAssets.length;
        const totalValue = deptAssets.reduce((sum: number, a: any) => {
          return sum + (parseFloat(a.purchasePrice) || 0);
        }, 0);
        const avgAssetAge = deptAssets.length > 0
          ? deptAssets.reduce((sum: number, a: any) => {
              if (!a.purchaseDate) return sum;
              const purchased = new Date(a.purchaseDate);
              const ageYears = (now.getTime() - purchased.getTime()) / (1000 * 60 * 60 * 24 * 365.25);
              return sum + ageYears;
            }, 0) / deptAssets.length
          : 0;
        return {
          id: dept.id,
          departmentName: dept.name,
          totalAssets,
          totalValue,
          avgAssetAge,
        };
      });

      const totalAssets = assets.length;
      const totalValue = assets.reduce((sum: number, a: any) => sum + (parseFloat(a.purchasePrice) || 0), 0);
      const totalDepartments = departments.length;
      const avgAssetsPerDept = totalDepartments > 0 ? totalAssets / totalDepartments : 0;

      res.json({ departmentDetails, totalDepartments, totalAssets, totalValue, avgAssetsPerDept });
    } catch (error) {
      respondWithApiError(res, error, "Failed to generate department report");
    }
  });

  app.get("/api/reports/warranties", requireAuth, async (req, res) => {
    try {
      const assets = await storage.getAssets();
      const today = new Date();
      let active = 0, expiring = 0, expired = 0;
      const warrantyAssets = assets.map((a: any) => {
        const warrantyDate = a.warrantyExpiry || a.warrantyEndDate;
        let warrantyStatus = "No Warranty";
        let daysUntilExpiry = null;
        if (warrantyDate) {
          const end = new Date(warrantyDate);
          daysUntilExpiry = Math.floor((end.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
          if (end < today) { warrantyStatus = "Expired"; expired++; }
          else if (daysUntilExpiry <= 90) { warrantyStatus = "Expiring Soon"; expiring++; }
          else { warrantyStatus = "Active"; active++; }
        }
        return {
          id: a.id,
          assetTag: a.assetTag || a.id?.slice(0, 8).toUpperCase(),
          assetType: a.type || a.assetType || "Hardware",
          name: a.name,
          warrantyDate,
          daysUntilExpiry,
          warrantyStatus,
        };
      }).filter((a: any) => a.warrantyDate);
      res.json({
        totalAssets: assets.length,
        active,
        expiring,
        expired,
        assets: warrantyAssets,
      });
    } catch (error) {
      respondWithApiError(res, error, "Failed to generate warranties report");
    }
  });

  app.get("/api/reports/depreciation", requireAuth, async (req, res) => {
    try {
      const assets = await storage.getAssets();
      let totalOriginalValue = 0;
      let totalAccumulatedDepreciation = 0;
      let totalCurrentBookValue = 0;
      let fullyDepreciatedCount = 0;
      let noDataCount = 0;

      const records = assets.map((a: any) => {
        const price = parseFloat(a.purchasePrice || "0");
        const summary = calculateDepreciation({
          purchasePrice: price,
          purchaseDate: a.purchaseDate || null,
          depreciationMethod: a.depreciationMethod || null,
          depreciationRate: parseFloat(a.depreciationRate || "20"),
          usefulLifeYears: a.usefulLifeYears || null,
          residualValue: parseFloat(a.residualValue || "0") || null,
        });

        if (!summary || price <= 0) { noDataCount++; }
        else {
          totalOriginalValue += price;
          totalAccumulatedDepreciation += summary.accumulatedDepreciation;
          totalCurrentBookValue += summary.currentBookValue;
          if (summary.fullyDepreciated) fullyDepreciatedCount++;
        }

        return {
          id: a.id,
          assetTag: a.assetTag || a.id?.slice(0, 8).toUpperCase(),
          name: a.name,
          type: a.type,
          department: a.department || null,
          purchasePrice: price,
          purchaseDate: a.purchaseDate || null,
          depreciationMethod: a.depreciationMethod || "none",
          depreciationRate: parseFloat(a.depreciationRate || "20"),
          usefulLifeYears: a.usefulLifeYears || null,
          residualValue: parseFloat(a.residualValue || "0") || 0,
          ...(summary || {
            yearsOwned: 0,
            annualDepreciation: 0,
            accumulatedDepreciation: 0,
            currentBookValue: price,
            percentDepreciated: 0,
            fullyDepreciated: false,
          }),
          hasDepreciationData: !!summary,
        };
      }).filter((r: any) => r.purchasePrice > 0);

      res.json({
        totalOriginalValue: Math.round(totalOriginalValue * 100) / 100,
        totalAccumulatedDepreciation: Math.round(totalAccumulatedDepreciation * 100) / 100,
        totalCurrentBookValue: Math.round(totalCurrentBookValue * 100) / 100,
        fullyDepreciatedCount,
        noDataCount,
        totalAssets: records.length,
        assets: records,
      });
    } catch (error) {
      console.error("Depreciation report error:", error);
      respondWithApiError(res, error, "Failed to generate depreciation report");
    }
  });

  app.get("/api/assets/:id/depreciation-schedule", requireAuth, async (req, res) => {
    try {
      const asset = await storage.getAsset(req.params.id);
      if (!asset) return res.status(404).json({ message: "Asset not found" });
      const price = parseFloat((asset as any).purchasePrice || "0");
      const schedule = generateDepreciationSchedule({
        purchasePrice: price,
        purchaseDate: (asset as any).purchaseDate || null,
        depreciationMethod: (asset as any).depreciationMethod || null,
        depreciationRate: parseFloat((asset as any).depreciationRate || "20"),
        usefulLifeYears: (asset as any).usefulLifeYears || null,
        residualValue: parseFloat((asset as any).residualValue || "0") || null,
      });
      const summary = calculateDepreciation({
        purchasePrice: price,
        purchaseDate: (asset as any).purchaseDate || null,
        depreciationMethod: (asset as any).depreciationMethod || null,
        depreciationRate: parseFloat((asset as any).depreciationRate || "20"),
        usefulLifeYears: (asset as any).usefulLifeYears || null,
        residualValue: parseFloat((asset as any).residualValue || "0") || null,
      });
      res.json({ schedule, summary, asset: { id: asset.id, name: asset.name, assetTag: (asset as any).assetTag, purchasePrice: price } });
    } catch (error) {
      console.error("Depreciation schedule error:", error);
      respondWithApiError(res, error, "Failed to generate depreciation schedule");
    }
  });

  app.get("/api/reports/released-assets", requireAuth, async (req, res) => {
    try {
      const allAssignments = await storage.getAssignmentsWithDetails();
      const returned = allAssignments.filter((a: any) => a.returnedDate);

      const records = returned.map((a: any) => {
        const assignedDate = a.assignedDate ? new Date(a.assignedDate) : null;
        const returnedDate = a.returnedDate ? new Date(a.returnedDate) : null;
        const durationDays = assignedDate && returnedDate
          ? Math.max(0, Math.floor((returnedDate.getTime() - assignedDate.getTime()) / (1000 * 60 * 60 * 24)))
          : null;
        return {
          id: a.id,
          assetTag: (a.asset as any)?.assetTag || a.asset?.id?.slice(0, 8).toUpperCase() || "N/A",
          assetName: a.asset?.name || "N/A",
          assetType: a.asset?.type || "N/A",
          serialNumber: (a.asset as any)?.serialNumber || "N/A",
          employeeName: a.employee ? `${a.employee.firstName} ${a.employee.lastName}` : "N/A",
          employeeId: a.employee?.id || null,
          department: a.employee?.department || "N/A",
          assignedDate: a.assignedDate || null,
          returnedDate: a.returnedDate || null,
          durationDays,
          notes: a.notes || null,
        };
      }).sort((x: any, y: any) => {
        if (!x.returnedDate) return 1;
        if (!y.returnedDate) return -1;
        return new Date(y.returnedDate).getTime() - new Date(x.returnedDate).getTime();
      });

      const totalReleased = records.length;
      const withDuration = records.filter((r: any) => r.durationDays !== null);
      const avgDuration = withDuration.length > 0
        ? Math.round(withDuration.reduce((sum: number, r: any) => sum + r.durationDays, 0) / withDuration.length)
        : 0;

      const now = new Date();
      const thisMonth = records.filter((r: any) => {
        if (!r.returnedDate) return false;
        const d = new Date(r.returnedDate);
        return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
      }).length;

      const deptCounts: Record<string, number> = {};
      records.forEach((r: any) => { deptCounts[r.department] = (deptCounts[r.department] || 0) + 1; });
      const topDept = Object.entries(deptCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || "N/A";

      res.json({ totalReleased, avgDuration, thisMonth, topDepartment: topDept, records });
    } catch (error) {
      console.error("Released assets report error:", error);
      respondWithApiError(res, error, "Failed to generate released assets report");
    }
  });

  app.get("/api/reports/assignment-history", requireAuth, async (req, res) => {
    try {
      const allAssignments = await storage.getAssignmentsWithDetails();
      const deptsList = await storage.getDepartments();
      const deptMap = new Map(deptsList.map((d: any) => [d.id, d.name]));

      const records = allAssignments.map((a: any) => {
        const employeeName = a.employee
          ? `${a.employee.firstName} ${a.employee.lastName}`.trim()
          : "Unknown";
        const department = a.employee?.departmentId
          ? (deptMap.get(a.employee.departmentId) || null)
          : null;

        let durationDays: number | null = null;
        if (a.assignedDate) {
          const start = new Date(a.assignedDate);
          const end = a.returnedDate ? new Date(a.returnedDate) : new Date();
          durationDays = Math.floor((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
        }

        return {
          id: a.id,
          assetId: a.assetId,
          assetTag: a.asset?.assetTag || null,
          assetName: a.asset?.name || null,
          assetType: a.asset?.type || null,
          serialNumber: a.asset?.serialNumber || null,
          employeeId: a.employeeId,
          employeeName,
          department,
          assignedDate: a.assignedDate,
          returnedDate: a.returnedDate || null,
          durationDays,
          status: a.returnedDate ? "returned" : "active",
          notes: a.notes || null,
        };
      });

      // Sort: active first, then returned (most recent first)
      records.sort((a: any, b: any) => {
        if (a.status === "active" && b.status !== "active") return -1;
        if (a.status !== "active" && b.status === "active") return 1;
        return new Date(b.assignedDate || 0).getTime() - new Date(a.assignedDate || 0).getTime();
      });

      const activeRecords = records.filter((r: any) => r.status === "active");
      const returnedRecords = records.filter((r: any) => r.status === "returned");
      const durations = returnedRecords.map((r: any) => r.durationDays).filter((d: any) => d !== null);
      const avgDuration = durations.length
        ? Math.round(durations.reduce((a: number, b: number) => a + b, 0) / durations.length)
        : null;
      const uniqueAssets = new Set(records.map((r: any) => r.assetId)).size;
      const uniqueEmployees = new Set(records.map((r: any) => r.employeeId)).size;

      res.json({
        summary: {
          totalAssignments: records.length,
          activeAssignments: activeRecords.length,
          returnedAssignments: returnedRecords.length,
          avgDurationDays: avgDuration,
          uniqueAssets,
          uniqueEmployees,
        },
        records,
      });
    } catch (error) {
      console.error("Assignment history report error:", error);
      respondWithApiError(res, error, "Failed to generate assignment history report");
    }
  });

  app.get("/api/reports/vendors", requireAuth, async (req, res) => {
    try {
      const vendorsList = await storage.getVendors();
      const purchaseOrders = await storage.getPurchaseOrdersWithDetails();
      let totalPOs = 0;
      let totalSpending = 0;
      const vendorDetails = vendorsList.map((v: any) => {
        const vPOs = (purchaseOrders as any[]).filter((po: any) => po.vendorId === v.id || po.vendorName === v.name);
        const totalValue = vPOs.reduce((s: number, po: any) => s + parseFloat(po.totalAmount || 0), 0);
        totalPOs += vPOs.length;
        totalSpending += totalValue;
        return {
          id: v.id,
          vendorName: v.name || v.vendorName,
          totalPOs: vPOs.length,
          totalValue,
          avgOrderValue: vPOs.length > 0 ? totalValue / vPOs.length : 0,
        };
      });
      res.json({
        totalVendors: vendorsList.length,
        totalPOs,
        totalSpending,
        avgOrderValue: totalPOs > 0 ? totalSpending / totalPOs : 0,
        vendorDetails,
      });
    } catch (error) {
      respondWithApiError(res, error, "Failed to generate vendor report");
    }
  });

  // Override purchase-orders report with correct field names for frontend
  app.get("/api/reports/purchase-orders-v2", requireAuth, async (req, res) => {
    try {
      const purchaseOrders = await storage.getPurchaseOrdersWithDetails();
      const pos = purchaseOrders as any[];
      const totalValue = pos.reduce((s: number, po: any) => s + parseFloat(po.totalAmount || 0), 0);
      const pendingPOs = pos.filter((po: any) => po.status === "pending" || po.status === "approved").length;
      const receivedPOs = pos.filter((po: any) => po.status === "received" || po.status === "delivered").length;
      const recentPOs = pos.slice(0, 20).map((po: any) => ({
        id: po.id,
        poNumber: po.poNumber,
        vendorName: po.vendorName,
        orderDate: po.orderDate,
        totalAmount: parseFloat(po.totalAmount || 0),
        status: po.status,
      }));
      res.json({
        totalPOs: pos.length,
        totalValue,
        pendingPOs,
        receivedPOs,
        recentPOs,
      });
    } catch (error) {
      respondWithApiError(res, error, "Failed to generate PO report");
    }
  });

  // ---- END SHORT-PATH REPORT ALIASES ----

  // Audit Logs API
  app.get("/api/audit-logs", requireAuth, requireAnyPermission("audit_view", "system_admin"), async (req, res) => {
    try {
      // Set no-cache headers to prevent browser caching
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
      
      const logs = await storage.getAuditLogs();
      
      // Enrich logs with user information
      const enrichedLogs = await Promise.all(logs.map(async (log) => {
        if (log.userId) {
          const user = await storage.getUser(log.userId);
          if (user) {
            // Create full name from first and last name, or fall back to username
            const fullName = user.firstName && user.lastName 
              ? `${user.firstName} ${user.lastName}`
              : user.username;
            
            return {
              ...log,
              username: user.username,
              userFullName: fullName
            };
          }
        }
        return {
          ...log,
          username: null,
          userFullName: null
        };
      }));
      
      res.json(enrichedLogs);
    } catch (error) {
      respondWithApiError(res, error, "Failed to fetch audit logs");
    }
  });

  // --------------------
  // SETTINGS ROUTES
  // --------------------
  
  app.get("/api/settings/:key", requireAuth, async (req, res) => {
    try {
      const setting = await storage.getSetting(req.params.key);
      if (!setting) {
        return res.status(404).json({ message: "Setting not found" });
      }
      res.json(setting);
    } catch (error) {
      respondWithApiError(res, error, "Failed to fetch setting");
    }
  });

  app.put("/api/settings/:key", requireAuth, async (req, res) => {
    try {
      const { value } = req.body;
      if (!value) {
        return res.status(400).json({ message: "Value is required" });
      }
      
      const setting = await storage.updateSetting(req.params.key, value);
      res.json(setting);
    } catch (error) {
      respondWithApiError(res, error, "Failed to update setting");
    }
  });

  // --------------------
  // MODULE SETTINGS ROUTES
  // --------------------

  // Public status of enabled modules — used by the login page to advertise
  // only the capabilities this deployment actually has enabled. No sensitive
  // data (just key/label/enabled), so no auth required.
  app.get("/api/module-status", async (req, res) => {
    try {
      const settingsList = await storage.getModuleSettings();
      const enriched = MODULE_REGISTRY.map((def) => {
        const found = settingsList.find((s) => s.moduleKey === def.key);
        return {
          key: def.key,
          name: def.label,
          core: def.core,
          enabled: found ? found.enabled : def.defaultEnabled,
        };
      });
      res.json(enriched);
    } catch (error) {
      respondWithApiError(res, error, "Failed to fetch module status");
    }
  });

  app.get("/api/module-settings", requireAuth, async (req, res) => {
    try {
      const settingsList = await storage.getModuleSettings();
      const enriched = MODULE_REGISTRY.map((def) => {
        const found = settingsList.find((s) => s.moduleKey === def.key);
        return {
          key: def.key,
          name: def.label,
          description: def.description,
          core: def.core,
          enabled: found ? found.enabled : def.defaultEnabled,
          updatedAt: found?.updatedAt ?? null,
          updatedBy: found?.updatedBy ?? null,
        };
      });
      res.json(enriched);
    } catch (error) {
      respondWithApiError(res, error, "Failed to fetch module settings");
    }
  });

  // This authenticated stream remains available while ITSM is disabled so
  // paused clients can hear when access is restored.
  app.get("/api/module-settings/events", requireAuth, cabAccessEventsHandler);

  app.put("/api/module-settings/:moduleKey", requireAuth, requirePermission('system_admin'), async (req: any, res) => {
    try {
      const { moduleKey } = req.params;
      const { enabled } = req.body;

      if (!isValidModuleKey(moduleKey)) {
        return res.status(404).json({ message: "Unknown module" });
      }
      if (typeof enabled !== "boolean") {
        return res.status(400).json({ message: "enabled must be a boolean" });
      }

      const definition = getModuleDefinition(moduleKey);
      if (definition?.core && !enabled) {
        return res.status(400).json({ message: "Core modules cannot be disabled" });
      }

      const updatedBy = req.user?.id;
      const setting = await storage.updateModuleSetting(moduleKey, enabled, updatedBy);
      if (moduleKey === "itsm" && enabled) {
        await publishItsmEnabled();
      }
      res.json(setting);
    } catch (error) {
      respondWithApiError(res, error, "Failed to update module setting");
    }
  });

  // --------------------
  // IMPORT/EXPORT ROUTES
  // --------------------

  // Configure multer for file uploads
  const upload = multer({ 
    storage: multer.memoryStorage(),
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
    fileFilter: (req, file, cb) => {
      if (file.mimetype === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' || 
          file.mimetype === 'application/vnd.ms-excel') {
        cb(null, true);
      } else {
        cb(new Error('Only Excel files are allowed'));
      }
    }
  });

  // Export the same 30-column Assets sheet accepted by the importer.
  app.get("/api/import/assets-export", requireAuth, requireModule('asset_management'), async (_req, res) => {
    try {
      const [assets, locations, departments] = await Promise.all([
        storage.getAssets(), storage.getLocations(), storage.getDepartments(),
      ]);
      const locationNames = new Map(locations.map(location => [location.id, location.name]));
      const departmentNames = new Map(departments.map(department => [department.id, department.name]));
      const workbook = new ExcelJS.Workbook();
      const sheet = workbook.addWorksheet('Assets');
      sheet.columns = assetSpreadsheetColumns;
      for (const asset of assets) {
        sheet.addRow({
          ...Object.fromEntries(Object.entries(asset).map(([key, value]) => [key, formatExportValue(value)])),
          locationName: asset.locationId ? locationNames.get(asset.locationId) ?? '' : '',
          departmentName: asset.departmentId ? departmentNames.get(asset.departmentId) ?? '' : '',
          dataTypes: asset.dataClassificationHandled,
        });
      }
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', 'attachment; filename=assets-export.xlsx');
      await workbook.xlsx.write(res);
      res.end();
    } catch (error) {
      if (!res.headersSent) respondWithApiError(res, error, "Failed to export assets");
      else res.destroy(error instanceof Error ? error : undefined);
    }
  });

  // Generate Excel template for import
  app.get("/api/import/template", requireAuth, (_req, res) => {
    res.status(410).json({
      message: "The combined legacy template is retired. Download a module-specific template from the Data Migration Center.",
      code: "IMPORT_FLOW_RETIRED",
    });
  });

  app.get("/api/import/template", requireAuth, async (req, res) => {
    try {
      const workbook = new ExcelJS.Workbook();
      
      // Assets Sheet with comprehensive fields
      const assetsSheet = workbook.addWorksheet('Assets');
      assetsSheet.columns = assetSpreadsheetColumns;
      
      // Add example row
      assetsSheet.addRow({
        name: 'Dell Laptop Example',
        assetTag: 'ASSET-0001',
        type: 'laptop',
        serialNumber: 'SN123456',
        model: 'Dell XPS 15',
        status: 'available',
        specifications: 'Intel i7, 16GB RAM, 512GB SSD',
        locationName: 'Main Office',
        departmentName: 'IT',
        informationClassification: 'internal',
        dataSensitivityLevel: 'medium',
        dataTypes: 'Business data',
        assetOwner: 'John Doe',
        assetCustodian: 'IT Admin',
        vendor: 'Dell Inc',
        invoiceNumber: 'INV-2024-001',
        purchasePrice: '1500.00',
        purchaseDate: '2024-01-15',
        warrantyExpiry: '2027-01-15',
        maintenanceCosts: '200.00',
        complianceStatus: 'compliant',
        securityControlsImplemented: 'Encryption, Antivirus',
        riskAssessmentScore: 'low',
        lifecycleStatus: 'production',
        plannedDisposalDate: '2029-01-15',
        backupStatus: 'yes',
        accessControlMethod: 'password',
        physicalSecurityLevel: 'standard',
        lastAuditDate: '2024-01-01',
        nextAuditDate: '2024-07-01',
      });
      
      // Employees Sheet
      const employeesSheet = workbook.addWorksheet('Employees');
      employeesSheet.columns = [
        { header: 'Employee ID', key: 'employeeId', width: 15 },
        { header: 'First Name*', key: 'firstName', width: 20 },
        { header: 'Last Name*', key: 'lastName', width: 20 },
        { header: 'Email*', key: 'email', width: 30 },
        { header: 'Department', key: 'department', width: 20 },
        { header: 'Position*', key: 'position', width: 20 },
        { header: 'Phone', key: 'phone', width: 15 },
        { header: 'Start Date', key: 'startDate', width: 15 },
        { header: 'Salary', key: 'salary', width: 15 },
      ];
      
      employeesSheet.addRow({
        employeeId: 'EMP001',
        firstName: 'John',
        lastName: 'Doe',
        email: 'john.doe@example.com',
        department: 'IT',
        position: 'System Administrator',
        phone: '+1234567890',
        startDate: '2024-01-01',
        salary: '75000',
      });
      
      // Assignments Sheet
      const assignmentsSheet = workbook.addWorksheet('Assignments');
      assignmentsSheet.columns = [
        { header: 'Asset Serial Number*', key: 'assetSerialNumber', width: 25 },
        { header: 'Employee Email*', key: 'employeeEmail', width: 30 },
        { header: 'Assigned Date*', key: 'assignedDate', width: 15 },
        { header: 'Returned Date', key: 'returnedDate', width: 15 },
      ];
      
      assignmentsSheet.addRow({
        assetSerialNumber: 'SN123456',
        employeeEmail: 'john.doe@example.com',
        assignedDate: '2024-01-15',
        returnedDate: '',
      });
      
      // Set headers for download
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', 'attachment; filename=asset-import-template.xlsx');
      
      await workbook.xlsx.write(res);
      res.end();
    } catch (error) {
      console.error('Error generating template:', error);
      respondWithApiError(res, error, "Failed to generate template");
    }
  });

  // Import data from Excel
  // The former direct-write workbook importer bypassed preview validation,
  // module licensing, and row audit summaries. Keep the old URL explicit but
  // prevent it from remaining an alternate mutation path.
  app.post("/api/import/excel", requireAuth, (_req, res) => {
    res.status(410).json({
      message: "Direct spreadsheet imports are retired. Use the validated Data Migration Center preview and commit flow.",
      code: "IMPORT_FLOW_RETIRED",
    });
  });

  app.post("/api/import/excel", requireAuth, upload.single('file'), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No file uploaded" });
      }

      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(req.file.buffer);

      const errors: string[] = [];
      let assetsImported = 0;
      let employeesImported = 0;
      let assignmentsImported = 0;
      const convertDate = (value: unknown): string | undefined => {
        if (value == null || value === "") return undefined;
        const result = toSpreadsheetDateInput(value);
        if (!result) throw new Error("Invalid date. Use DD-MM-YYYY, YYYY-MM-DD, or an Excel date cell.");
        return result;
      };

      // Import Assets
      const assetsSheet = workbook.getWorksheet('Assets');
      if (assetsSheet) {
        // Fetch locations and departments for lookup
        const locations = await storage.getLocations();
        const departments = await storage.getDepartments();
        
        // Create name -> ID maps for quick lookup
        const locationMap = new Map<string, string>();
        locations.forEach(loc => {
          if (loc.name) locationMap.set(loc.name.toLowerCase().trim(), loc.id);
        });
        
        const departmentMap = new Map<string, string>();
        departments.forEach(dept => {
          if (dept.name) departmentMap.set(dept.name.toLowerCase().trim(), dept.id);
        });
        
        const assetRows: any[] = [];
        assetsSheet.eachRow((row, rowNumber) => {
          if (rowNumber === 1) return; // Skip header row
          
          // Read all 30 columns from comprehensive template
          assetRows.push({
            // Basic Information (cols 1-7)
            name: row.getCell(1).value,
            assetTag: row.getCell(2).value,
            type: row.getCell(3).value,
            serialNumber: row.getCell(4).value,
            model: row.getCell(5).value,
            status: row.getCell(6).value,
            specifications: row.getCell(7).value,
            
            // Location & Organization (cols 8-9)
            locationName: row.getCell(8).value,
            departmentName: row.getCell(9).value,
            
            // Security Classification (cols 10-12)
            informationClassification: row.getCell(10).value,
            dataSensitivityLevel: row.getCell(11).value,
            dataClassificationHandled: row.getCell(12).value,
            
            // Ownership & Management (cols 13-14)
            assetOwner: row.getCell(13).value,
            assetCustodian: row.getCell(14).value,
            
            // Financial & Procurement (cols 15-20)
            vendor: row.getCell(15).value,
            invoiceNumber: row.getCell(16).value,
            purchasePrice: row.getCell(17).value,
            purchaseDate: row.getCell(18).value,
            warrantyExpiry: row.getCell(19).value,
            maintenanceCosts: row.getCell(20).value,
            
            // Compliance & Controls (cols 21-23)
            complianceStatus: row.getCell(21).value,
            securityControlsImplemented: row.getCell(22).value,
            riskAssessmentScore: row.getCell(23).value,
            
            // Lifecycle Management (cols 24-25)
            lifecycleStatus: row.getCell(24).value,
            plannedDisposalDate: row.getCell(25).value,
            
            // Access & Backup (cols 26-28)
            backupStatus: row.getCell(26).value,
            accessControlMethod: row.getCell(27).value,
            physicalSecurityLevel: row.getCell(28).value,
            
            // Auditing (cols 29-30)
            lastAuditDate: row.getCell(29).value,
            nextAuditDate: row.getCell(30).value,
          });
        });

        for (const assetData of assetRows) {
          try {
            // Skip empty rows
            if (!assetData.name && !assetData.serialNumber) continue;

            // Lookup location ID by name
            let locationId: string | undefined = undefined;
            if (assetData.locationName) {
              const locName = assetData.locationName.toString().toLowerCase().trim();
              locationId = locationMap.get(locName);
            }
            
            // Lookup department ID by name
            let departmentId: string | undefined = undefined;
            if (assetData.departmentName) {
              const deptName = assetData.departmentName.toString().toLowerCase().trim();
              departmentId = departmentMap.get(deptName);
            }
            
            const nextAuditDate = toSpreadsheetDateInput(assetData.nextAuditDate) || undefined;
            if (assetData.nextAuditDate != null && assetData.nextAuditDate !== '' && !nextAuditDate) {
              throw new Error(`Invalid Next Audit Date for ${assetData.name || assetData.serialNumber}`);
            }
            
            // Helper function to handle optional string fields
            const optionalString = (value: any) => {
              if (!value || value === '') return undefined;
              return value.toString();
            };

            const asset = await storage.createAsset({
              // Basic Information
              name: assetData.name?.toString() || '',
              assetTag: optionalString(assetData.assetTag),
              type: assetData.type?.toString() || '',
              serialNumber: optionalString(assetData.serialNumber),
              model: optionalString(assetData.model),
              status: assetData.status?.toString() || 'available',
              specifications: optionalString(assetData.specifications),
              
              // Location & Organization
              locationId,
              departmentId,
              
              // Security Classification
              informationClassification: optionalString(assetData.informationClassification),
              dataSensitivityLevel: optionalString(assetData.dataSensitivityLevel),
              dataClassificationHandled: optionalString(assetData.dataClassificationHandled),
              
              // Ownership & Management
              assetOwner: optionalString(assetData.assetOwner),
              assetCustodian: optionalString(assetData.assetCustodian),
              
              // Financial & Procurement
              vendor: optionalString(assetData.vendor),
              invoiceNumber: optionalString(assetData.invoiceNumber),
              purchasePrice: optionalString(assetData.purchasePrice),
              purchaseDate: convertDate(assetData.purchaseDate),
              warrantyExpiry: convertDate(assetData.warrantyExpiry),
              maintenanceCosts: optionalString(assetData.maintenanceCosts),
              
              // Compliance & Controls
              complianceStatus: optionalString(assetData.complianceStatus),
              securityControlsImplemented: optionalString(assetData.securityControlsImplemented),
              riskAssessmentScore: optionalString(assetData.riskAssessmentScore),
              
              // Lifecycle Management
              lifecycleStatus: optionalString(assetData.lifecycleStatus),
              plannedDisposalDate: convertDate(assetData.plannedDisposalDate),
              
              // Access & Backup
              backupStatus: optionalString(assetData.backupStatus),
              accessControlMethod: optionalString(assetData.accessControlMethod),
              physicalSecurityLevel: optionalString(assetData.physicalSecurityLevel),
              
              // Auditing
              lastAuditDate: convertDate(assetData.lastAuditDate),
              nextAuditDate,
            });
            
            await logAudit(req.user?.id, 'CREATE', 'assets', asset.id, asset.name, null, asset, req);
            assetsImported++;
          } catch (error) {
            errors.push(`Failed to import asset: ${error instanceof Error ? error.message : 'Unknown error'}`);
          }
        }
      }

      // Import Employees
      const employeesSheet = workbook.getWorksheet('Employees');
      if (employeesSheet) {
        const employeeRows: any[] = [];
        employeesSheet.eachRow((row, rowNumber) => {
          if (rowNumber === 1) return; // Skip header row
          employeeRows.push({
            employeeId: row.getCell(1).value,
            firstName: row.getCell(2).value,
            lastName: row.getCell(3).value,
            email: row.getCell(4).value,
            department: row.getCell(5).value,
            position: row.getCell(6).value,
            phone: row.getCell(7).value,
            startDate: row.getCell(8).value,
            salary: row.getCell(9).value,
          });
        });

        for (const empData of employeeRows) {
          try {
            // Skip empty rows
            if (!empData.firstName && !empData.email) continue;

            const employee = await storage.createEmployee({
              employeeId: empData.employeeId?.toString() || undefined,
              firstName: empData.firstName?.toString() || '',
              lastName: empData.lastName?.toString() || '',
              email: empData.email?.toString() || '',
              department: empData.department?.toString() || undefined,
              position: empData.position?.toString() || '',
              phone: empData.phone?.toString() || undefined,
              startDate: convertDate(empData.startDate),
              salary: empData.salary ? empData.salary.toString() : undefined,
              status: "active",
            });
            
            await logAudit(req.user?.id, 'CREATE', 'employees', employee.id, `${employee.firstName} ${employee.lastName}`, null, employee, req);
            employeesImported++;
          } catch (error) {
            errors.push(`Failed to import employee: ${error instanceof Error ? error.message : 'Unknown error'}`);
          }
        }
      }

      // Import Assignments
      const assignmentsSheet = workbook.getWorksheet('Assignments');
      if (assignmentsSheet) {
        const assignmentRows: any[] = [];
        assignmentsSheet.eachRow((row, rowNumber) => {
          if (rowNumber === 1) return; // Skip header row
          assignmentRows.push({
            assetSerialNumber: row.getCell(1).value,
            employeeEmail: row.getCell(2).value,
            assignedDate: row.getCell(3).value,
            returnedDate: row.getCell(4).value,
          });
        });

        for (const assignData of assignmentRows) {
          try {
            // Skip empty rows
            if (!assignData.assetSerialNumber && !assignData.employeeEmail) continue;

            // Find asset by serial number
            const assets = await storage.getAssets();
            const asset = assets.find(a => a.serialNumber === assignData.assetSerialNumber?.toString());
            if (!asset) {
              errors.push(`Asset with serial number ${assignData.assetSerialNumber} not found`);
              continue;
            }

            // Find employee by email
            const employees = await storage.getEmployees();
            const employee = employees.find(e => e.email === assignData.employeeEmail?.toString());
            if (!employee) {
              errors.push(`Employee with email ${assignData.employeeEmail} not found`);
              continue;
            }

            const assignment = await storage.createAssignment({
              assetId: asset.id,
              employeeId: employee.id,
              assignedDate: convertDate(assignData.assignedDate) ?? toDateInputValue(new Date()),
              returnedDate: convertDate(assignData.returnedDate),
            });
            
            await logAudit(req.user?.id, 'CREATE', 'assignments', assignment.id, `${asset.name} to ${employee.firstName} ${employee.lastName}`, null, assignment, req);
            assignmentsImported++;
          } catch (error) {
            errors.push(`Failed to import assignment: ${error instanceof Error ? error.message : 'Unknown error'}`);
          }
        }
      }

      res.json({
        success: true,
        message: `Import completed successfully`,
        imported: {
          assets: assetsImported,
          employees: employeesImported,
          assignments: assignmentsImported
        },
        errors: errors.length > 0 ? errors : undefined
      });

    } catch (error) {
      console.error("Excel import error:", error);
      respondWithApiError(res, error, "Failed to import Excel file");
    }
  });

  // --------------------
  // DROPDOWN OPTIONS ROUTES
  // --------------------

  app.get("/api/dropdowns/options", async (req, res) => {
    try {
      // Admin view passes ?all=true to see inactive options too
      const options = req.query.all === "true"
        ? await storage.getAllDropdownOptions()
        : await storage.getDropdownOptions();
      res.json(options);
    } catch (error) {
      respondWithApiError(res, error, "Failed to fetch dropdown options");
    }
  });

  app.get("/api/dropdowns/options/:category", async (req, res) => {
    try {
      const options = req.query.all === "true"
        ? await storage.getAllDropdownOptionsByCategory(req.params.category)
        : await storage.getDropdownOptionsByCategory(req.params.category);
      res.json(options);
    } catch (error) {
      respondWithApiError(res, error, "Failed to fetch dropdown options");
    }
  });

  app.post("/api/dropdowns/options", requireAuth, requirePermission('system_admin'), async (req, res) => {
    try {
      const validatedData = insertDropdownOptionSchema.parse(req.body);
      // Duplicate check: same value + category must be unique
      const existing = await storage.getAllDropdownOptions();
      const duplicate = existing.find(o => dropdownIdentity(o.category, o.value) === dropdownIdentity(validatedData.category, validatedData.value));
      if (duplicate) {
        return res.status(409).json({ message: `A "${duplicate.label}" option with value "${duplicate.value}" already exists in this category.` });
      }
      const option = await storage.createDropdownOption(validatedData);
      res.status(201).json(option);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid dropdown option data", errors: error.issues });
      }
      if ((error?.code ?? error?.cause?.code) === "23505") {
        return res.status(409).json({ message: "A dropdown option with this value already exists in this category." });
      }
      respondWithApiError(res, error, "Failed to create dropdown option");
    }
  });

  app.put("/api/dropdowns/options/:id", requireAuth, requirePermission('system_admin'), async (req, res) => {
    try {
      const validatedData = insertDropdownOptionSchema.partial().parse(req.body);
      const existing = await storage.getAllDropdownOptions();
      const current = existing.find(option => option.id === req.params.id);
      if (!current) return res.status(404).json({ message: "Dropdown option not found" });
      const category = validatedData.category ?? current.category;
      const value = validatedData.value ?? current.value;
      if (existing.some(option => option.id !== current.id && dropdownIdentity(option.category, option.value) === dropdownIdentity(category, value))) {
        return res.status(409).json({ message: "A dropdown option with this value already exists in this category, including inactive options." });
      }
      const option = await storage.updateDropdownOption(req.params.id, validatedData);
      if (!option) {
        return res.status(404).json({ message: "Dropdown option not found" });
      }
      res.json(option);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid dropdown option data", errors: error.issues });
      }
      if ((error?.code ?? error?.cause?.code) === "23505") return res.status(409).json({ message: "A dropdown option with this value already exists in this category." });
      respondWithApiError(res, error, "Failed to update dropdown option");
    }
  });

  app.delete("/api/dropdowns/options/:id", requireAuth, requirePermission('system_admin'), async (req, res) => {
    try {
      const success = await storage.deleteDropdownOption(req.params.id);
      if (!success) {
        return res.status(404).json({ message: "Dropdown option not found" });
      }
      res.json({ success: true });
    } catch (error) {
      respondWithApiError(res, error, "Failed to delete dropdown option");
    }
  });

  // Delete duplicate dropdown options — keep oldest per (category, value), remove the rest
  app.post("/api/dropdowns/cleanup-duplicates", requireAuth, requirePermission('system_admin'), async (req, res) => {
    try {
      const { category } = z.object({ category: z.string().trim().min(1).optional() }).parse(req.body ?? {});
      const result = await ensureDropdownIntegrity(category);
      await logAudit(req.user?.id, "DELETE", "dropdown_options", "cleanup", "Archived and removed duplicate lookup options", null, result, req);
      res.json(result);
    } catch (error) {
      if (error instanceof z.ZodError) return res.status(400).json({ message: "Invalid category" });
      respondWithApiError(res, error, "Failed to clean up duplicates");
    }
  });

  // Migrate existing data from assets table to dropdown options
  app.post("/api/dropdowns/migrate-from-assets", requireAuth, requirePermission('system_admin'), async (req, res) => {
    try {
      const allAssets = await storage.getAssets();
      const allMaintenanceSchedules = await storage.getMaintenanceSchedules();
      const allBudgets = await storage.getBudgets();
      const allPurchaseOrders = await storage.getPurchaseOrders();
      
      const migratedData: { [key: string]: Set<string> } = {
        assetType: new Set(),
        status: new Set(),
        assetCondition: new Set(),
        informationClassification: new Set(),
        dataSensitivityLevel: new Set(),
        securityLevel: new Set(),
        riskAssessmentScore: new Set(),
        lifecycleStatus: new Set(),
        accessControlMethod: new Set(),
        physicalSecurityLevel: new Set(),
        complianceStatus: new Set(),
        maintenanceType: new Set(),
        maintenanceFrequency: new Set(),
        maintenancePriority: new Set(),
        budgetCategory: new Set(),
        purchaseOrderStatus: new Set(),
      };

      // Extract unique values from assets
      for (const asset of allAssets) {
        if ((asset as any).type) migratedData.assetType.add((asset as any).type);
        if ((asset as any).status) migratedData.status.add((asset as any).status);
        if ((asset as any).condition) migratedData.assetCondition.add((asset as any).condition);
        if ((asset as any).informationClassification) migratedData.informationClassification.add((asset as any).informationClassification);
        if ((asset as any).dataSensitivityLevel) migratedData.dataSensitivityLevel.add((asset as any).dataSensitivityLevel);
        if ((asset as any).securityLevel) migratedData.securityLevel.add((asset as any).securityLevel);
        if ((asset as any).riskAssessmentScore) migratedData.riskAssessmentScore.add((asset as any).riskAssessmentScore);
        if ((asset as any).lifecycleStatus) migratedData.lifecycleStatus.add((asset as any).lifecycleStatus);
        if ((asset as any).accessControlMethod) migratedData.accessControlMethod.add((asset as any).accessControlMethod);
        if ((asset as any).physicalSecurityLevel) migratedData.physicalSecurityLevel.add((asset as any).physicalSecurityLevel);
        if ((asset as any).complianceStatus) migratedData.complianceStatus.add((asset as any).complianceStatus);
      }

      // Extract from maintenance schedules
      for (const schedule of allMaintenanceSchedules) {
        if ((schedule as any).maintenanceType) migratedData.maintenanceType.add((schedule as any).maintenanceType);
        if ((schedule as any).frequency) migratedData.maintenanceFrequency.add((schedule as any).frequency);
        if ((schedule as any).priority) migratedData.maintenancePriority.add((schedule as any).priority);
      }

      // Extract from budgets
      for (const budget of allBudgets) {
        if ((budget as any).category) migratedData.budgetCategory.add((budget as any).category);
      }

      // Extract from purchase orders
      for (const po of allPurchaseOrders) {
        if ((po as any).status) migratedData.purchaseOrderStatus.add((po as any).status);
      }

      // Get existing dropdown options to avoid duplicates
      const existingOptions = await storage.getAllDropdownOptions();
      const existingKeys = new Set(existingOptions.map(opt => dropdownIdentity(opt.category, opt.value)));

      let created = 0;
      let skipped = 0;

      // Insert migrated data
      for (const [category, values] of Object.entries(migratedData)) {
        let order = 0;
        for (const value of Array.from(values)) {
          if (value && value.trim()) {
            const normalizedValue = normalizeLookupKey(value).replace(/\s+/g, '-');
            const key = dropdownIdentity(category, normalizedValue);
            if (!existingKeys.has(key)) {
              try {
                await storage.createDropdownOption({
                  category: category,
                  value: normalizedValue,
                  label: value,
                  displayOrder: order,
                  isActive: true,
                });
                created++;
                existingKeys.add(key);
              } catch (e: any) {
                if ((e?.code ?? e?.cause?.code) !== "23505") throw e;
                skipped++;
              }
            } else {
              skipped++;
            }
            order++;
          }
        }
      }

      res.json({ success: true, migrated: created, skipped });
    } catch (error) {
      console.error("Migration error:", error);
      respondWithApiError(res, error, "Failed to migrate data from assets");
    }
  });

  // Seed default dropdown options
  app.post("/api/dropdowns/seed", requireAuth, requirePermission('system_admin'), async (req, res) => {
    try {
      const defaultOptions = [
        // Consumable inventory categories
        { category: "consumable_category", value: "Toner", label: "Toner", displayOrder: 0 },
        { category: "consumable_category", value: "Peripherals", label: "Peripherals", displayOrder: 1 },
        { category: "consumable_category", value: "Cables", label: "Cables", displayOrder: 2 },
        { category: "consumable_category", value: "Adapters", label: "Adapters", displayOrder: 3 },
        { category: "consumable_category", value: "Batteries", label: "Batteries", displayOrder: 4 },
        { category: "consumable_category", value: "Paper", label: "Paper", displayOrder: 5 },
        { category: "consumable_category", value: "Other", label: "Other", displayOrder: 6 },
        // Asset Types
        { category: "assetType", value: "laptop", label: "Laptop", displayOrder: 0 },
        { category: "assetType", value: "desktop", label: "Desktop", displayOrder: 1 },
        { category: "assetType", value: "monitor", label: "Monitor", displayOrder: 2 },
        { category: "assetType", value: "phone", label: "Phone", displayOrder: 3 },
        { category: "assetType", value: "software", label: "Software", displayOrder: 4 },
        { category: "assetType", value: "server", label: "Server", displayOrder: 5 },
        { category: "assetType", value: "network-device", label: "Network Device", displayOrder: 6 },
        { category: "assetType", value: "storage", label: "Storage Device", displayOrder: 7 },
        // Status
        { category: "status", value: "available", label: "Available", displayOrder: 0 },
        { category: "status", value: "assigned", label: "Assigned", displayOrder: 1 },
        { category: "status", value: "maintenance", label: "Maintenance", displayOrder: 2 },
        { category: "status", value: "retired", label: "Retired", displayOrder: 3 },
        // Criticality
        { category: "criticality", value: "low", label: "Low", displayOrder: 0 },
        { category: "criticality", value: "medium", label: "Medium", displayOrder: 1 },
        { category: "criticality", value: "high", label: "High", displayOrder: 2 },
        { category: "criticality", value: "critical", label: "Critical", displayOrder: 3 },
        // Compliance Status
        { category: "complianceStatus", value: "compliant", label: "Compliant", displayOrder: 0 },
        { category: "complianceStatus", value: "non-compliant", label: "Non-Compliant", displayOrder: 1 },
        { category: "complianceStatus", value: "under-review", label: "Under Review", displayOrder: 2 },
        { category: "complianceStatus", value: "not-assessed", label: "Not Assessed", displayOrder: 3 },
        // Lifecycle Status
        { category: "lifecycleStatus", value: "planning", label: "Planning", displayOrder: 0 },
        { category: "lifecycleStatus", value: "procurement", label: "Procurement", displayOrder: 1 },
        { category: "lifecycleStatus", value: "deployment", label: "Deployment", displayOrder: 2 },
        { category: "lifecycleStatus", value: "production", label: "Production", displayOrder: 3 },
        { category: "lifecycleStatus", value: "maintenance", label: "Maintenance", displayOrder: 4 },
        { category: "lifecycleStatus", value: "retirement", label: "Retirement", displayOrder: 5 },
        // Information Classification
        { category: "informationClassification", value: "public", label: "Public", displayOrder: 0 },
        { category: "informationClassification", value: "internal", label: "Internal", displayOrder: 1 },
        { category: "informationClassification", value: "confidential", label: "Confidential", displayOrder: 2 },
        { category: "informationClassification", value: "restricted", label: "Restricted", displayOrder: 3 },
        // Data Sensitivity Level
        { category: "dataSensitivityLevel", value: "low", label: "Low", displayOrder: 0 },
        { category: "dataSensitivityLevel", value: "medium", label: "Medium", displayOrder: 1 },
        { category: "dataSensitivityLevel", value: "high", label: "High", displayOrder: 2 },
        { category: "dataSensitivityLevel", value: "critical", label: "Critical", displayOrder: 3 },
        // Security Level
        { category: "securityLevel", value: "basic", label: "Basic", displayOrder: 0 },
        { category: "securityLevel", value: "standard", label: "Standard", displayOrder: 1 },
        { category: "securityLevel", value: "enhanced", label: "Enhanced", displayOrder: 2 },
        { category: "securityLevel", value: "maximum", label: "Maximum", displayOrder: 3 },
        // Risk Assessment Score
        { category: "riskAssessmentScore", value: "low", label: "Low", displayOrder: 0 },
        { category: "riskAssessmentScore", value: "medium", label: "Medium", displayOrder: 1 },
        { category: "riskAssessmentScore", value: "high", label: "High", displayOrder: 2 },
        { category: "riskAssessmentScore", value: "critical", label: "Critical", displayOrder: 3 },
        // Access Control Method
        { category: "accessControlMethod", value: "password", label: "Password", displayOrder: 0 },
        { category: "accessControlMethod", value: "mfa", label: "Multi-Factor Authentication", displayOrder: 1 },
        { category: "accessControlMethod", value: "biometric", label: "Biometric", displayOrder: 2 },
        { category: "accessControlMethod", value: "smartcard", label: "Smart Card", displayOrder: 3 },
        { category: "accessControlMethod", value: "none", label: "None", displayOrder: 4 },
        // Physical Security Level
        { category: "physicalSecurityLevel", value: "basic", label: "Basic", displayOrder: 0 },
        { category: "physicalSecurityLevel", value: "standard", label: "Standard", displayOrder: 1 },
        { category: "physicalSecurityLevel", value: "enhanced", label: "Enhanced", displayOrder: 2 },
        { category: "physicalSecurityLevel", value: "maximum", label: "Maximum", displayOrder: 3 },
        // Asset Condition
        { category: "assetCondition", value: "excellent", label: "Excellent", displayOrder: 0 },
        { category: "assetCondition", value: "good", label: "Good", displayOrder: 1 },
        { category: "assetCondition", value: "fair", label: "Fair", displayOrder: 2 },
        { category: "assetCondition", value: "poor", label: "Poor", displayOrder: 3 },
        // Maintenance Type
        { category: "maintenanceType", value: "preventive", label: "Preventive", displayOrder: 0 },
        { category: "maintenanceType", value: "repair", label: "Repair", displayOrder: 1 },
        { category: "maintenanceType", value: "upgrade", label: "Upgrade", displayOrder: 2 },
        { category: "maintenanceType", value: "inspection", label: "Inspection", displayOrder: 3 },
        // Maintenance Frequency
        { category: "maintenanceFrequency", value: "monthly", label: "Monthly", displayOrder: 0 },
        { category: "maintenanceFrequency", value: "quarterly", label: "Quarterly", displayOrder: 1 },
        { category: "maintenanceFrequency", value: "semi-annual", label: "Semi-Annual", displayOrder: 2 },
        { category: "maintenanceFrequency", value: "annually", label: "Annually", displayOrder: 3 },
        { category: "maintenanceFrequency", value: "one-time", label: "One-Time", displayOrder: 4 },
        // Maintenance Priority
        { category: "maintenancePriority", value: "low", label: "Low", displayOrder: 0 },
        { category: "maintenancePriority", value: "medium", label: "Medium", displayOrder: 1 },
        { category: "maintenancePriority", value: "high", label: "High", displayOrder: 2 },
        // Budget Category
        { category: "budgetCategory", value: "hardware", label: "Hardware", displayOrder: 0 },
        { category: "budgetCategory", value: "software", label: "Software", displayOrder: 1 },
        { category: "budgetCategory", value: "maintenance", label: "Maintenance", displayOrder: 2 },
        { category: "budgetCategory", value: "other", label: "Other", displayOrder: 3 },
        // Purchase Order Status
        { category: "purchaseOrderStatus", value: "pending", label: "Pending", displayOrder: 0 },
        { category: "purchaseOrderStatus", value: "approved", label: "Approved", displayOrder: 1 },
        { category: "purchaseOrderStatus", value: "ordered", label: "Ordered", displayOrder: 2 },
        { category: "purchaseOrderStatus", value: "received", label: "Received", displayOrder: 3 },
        { category: "purchaseOrderStatus", value: "cancelled", label: "Cancelled", displayOrder: 4 },
        // Payment Terms
        { category: "paymentTerms", value: "net-30", label: "Net 30", displayOrder: 0 },
        { category: "paymentTerms", value: "net-60", label: "Net 60", displayOrder: 1 },
        { category: "paymentTerms", value: "net-90", label: "Net 90", displayOrder: 2 },
        { category: "paymentTerms", value: "cod", label: "COD", displayOrder: 3 },
        { category: "paymentTerms", value: "prepaid", label: "Prepaid", displayOrder: 4 },
        // Ticket Category
        { category: "ticketCategory", value: "hardware", label: "Hardware", displayOrder: 0 },
        { category: "ticketCategory", value: "software", label: "Software", displayOrder: 1 },
        { category: "ticketCategory", value: "network", label: "Network", displayOrder: 2 },
        { category: "ticketCategory", value: "access", label: "Access / Account", displayOrder: 3 },
        { category: "ticketCategory", value: "email", label: "Email", displayOrder: 4 },
        { category: "ticketCategory", value: "printer", label: "Printer", displayOrder: 5 },
        { category: "ticketCategory", value: "security", label: "Security", displayOrder: 6 },
        { category: "ticketCategory", value: "other", label: "Other", displayOrder: 7 },
        // Employee application access privileges
        { category: "access_privilege_level", value: "administrator", label: "Administrator", displayOrder: 0 },
        { category: "access_privilege_level", value: "power_user", label: "Power User", displayOrder: 1 },
        { category: "access_privilege_level", value: "data_entry", label: "Data Entry", displayOrder: 2 },
        { category: "access_privilege_level", value: "viewer", label: "Viewer", displayOrder: 3 },
      ];

      let created = 0;
      for (const option of defaultOptions) {
        try {
          await storage.createDropdownOption(option);
          created++;
        } catch (e: any) {
          if ((e?.code ?? e?.cause?.code) !== "23505") throw e;
        }
      }

      res.json({ success: true, created });
    } catch (error) {
      respondWithApiError(res, error, "Failed to seed dropdown options");
    }
  });

  // ── SLA Policies ─────────────────────────────────────────────────────────
  app.get("/api/sla-policies", requireAuth, async (req, res) => {
    try {
      const policies = await storage.getSlaPolicies();
      res.json(policies);
    } catch (error) {
      respondWithApiError(res, error, "Failed to fetch SLA policies");
    }
  });

  app.post("/api/sla-policies", requireAuth, requirePermission("system_admin"), async (req, res) => {
    try {
      const policy = await storage.createSlaPolicy(req.body);
      res.status(201).json(policy);
    } catch (error) {
      respondWithApiError(res, error, "Failed to create SLA policy");
    }
  });

  app.put("/api/sla-policies/:id", requireAuth, requirePermission("system_admin"), async (req, res) => {
    try {
      const policy = await storage.updateSlaPolicy(req.params.id, req.body);
      if (!policy) return res.status(404).json({ message: "SLA policy not found" });
      res.json(policy);
    } catch (error) {
      respondWithApiError(res, error, "Failed to update SLA policy");
    }
  });

  app.delete("/api/sla-policies/:id", requireAuth, requirePermission("system_admin"), async (req, res) => {
    try {
      const deleted = await storage.deleteSlaPolicy(req.params.id);
      if (!deleted) return res.status(404).json({ message: "SLA policy not found" });
      res.json({ success: true });
    } catch (error) {
      respondWithApiError(res, error, "Failed to delete SLA policy");
    }
  });

  // ── Knowledge Base ───────────────────────────────────────────────────────
  registerKnowledgeRoutes(app, requireAuth, diskUpload.single("file"));
  registerNetworkTopologyRoutes(app, requireAuth, requireModule("cmdb"));
  registerItComponentsComplianceRoutes(
    app,
    requireAuth,
    requireModule("asset_management"),
    requireAnyPermission("asset_view", "asset_update", "cmdb_view", "compliance_view", "audit_view", "system_admin"),
    requirePermission("asset_update"),
  );
  registerBackupGovernanceRoutes(app, requireAuth, requireModule("cmdb"));
  registerDataMigrationRoutes(app, requireAuth);
  registerServiceCatalogRoutes(app, requireAuth);
  app.use(["/api/vendor-management", "/api/vendor-contracts"], requireAuth, requireModule("asset_management"));
  registerVendorContractRoutes(app, requireAuth);
  registerAssetHandoverRoutes(app);

  // ── Problem Management ───────────────────────────────────────────────────
  app.get("/api/problems", requireAuth, requireModule("itsm"), async (req, res) => {
    try { res.json(await storage.getProblems()); }
    catch (error) { respondWithApiError(res, error, "Failed to fetch problems"); }
  });

  app.get("/api/problems/:id", requireAuth, requireModule("itsm"), async (req, res) => {
    try {
      const p = await storage.getProblem(req.params.id);
      if (!p) return res.status(404).json({ message: "Problem not found" });
      res.json(p);
    } catch (error) { respondWithApiError(res, error, "Failed to fetch problem"); }
  });

  app.post("/api/problems", requireAuth, requireModule("itsm"), async (req, res) => {
    try {
      const user = req.user as any;
      const problem = await storage.createProblem({ ...req.body, createdById: user.id });
      res.status(201).json(problem);
    } catch (error) { respondWithApiError(res, error, "Failed to create problem"); }
  });

  app.put("/api/problems/:id", requireAuth, requireModule("itsm"), async (req, res) => {
    try {
      const problem = await storage.updateProblem(req.params.id, req.body);
      if (!problem) return res.status(404).json({ message: "Problem not found" });
      res.json(problem);
    } catch (error) { respondWithApiError(res, error, "Failed to update problem"); }
  });

  app.delete("/api/problems/:id", requireAuth, requirePermission("system_admin"), async (req, res) => {
    try {
      const deleted = await storage.deleteProblem(req.params.id);
      if (!deleted) return res.status(404).json({ message: "Problem not found" });
      res.json({ success: true });
    } catch (error) { respondWithApiError(res, error, "Failed to delete problem"); }
  });

  app.post("/api/problems/:id/link-incident", requireAuth, requireModule("itsm"), async (req, res) => {
    try {
      const link = await storage.linkIncidentToProblem(req.params.id, req.body.ticketId);
      res.status(201).json(link);
    } catch (error) { respondWithApiError(res, error, "Failed to link incident"); }
  });

  app.delete("/api/problems/:id/link-incident/:ticketId", requireAuth, requireModule("itsm"), async (req, res) => {
    try {
      await storage.unlinkIncidentFromProblem(req.params.id, req.params.ticketId);
      res.json({ success: true });
    } catch (error) { respondWithApiError(res, error, "Failed to unlink incident"); }
  });

  // ── Service Catalog ──────────────────────────────────────────────────────
  async function canReadEmployeeCatalogItem(user: Express.User, item: { category: string; consumableId?: string | null }) {
    if (!item.consumableId && !/^(hardware|equipment|asset)$/i.test(item.category.trim())) return true;
    return Boolean(user.employeeId) || await canManageAllTickets(user.id);
  }

  app.get("/api/catalog/items", requireAuth, async (req, res) => {
    try {
      const activeOnly = req.query.activeOnly === "true";
      const items = await storage.getCatalogItems(activeOnly);
      const canReadHardware = Boolean(req.user!.employeeId) || await canManageAllTickets(req.user!.id);
      res.json(canReadHardware ? items : items.filter(item => !item.consumableId && !/^(hardware|equipment|asset)$/i.test(item.category.trim())));
    } catch (error) { respondWithApiError(res, error, "Failed to fetch catalog items"); }
  });

  app.get("/api/catalog/items/:id", requireAuth, async (req, res) => {
    try {
      const item = await storage.getCatalogItem(req.params.id);
      if (!item || !await canReadEmployeeCatalogItem(req.user!, item)) return res.status(404).json({ message: "Item not found" });
      res.json(item);
    } catch (error) { respondWithApiError(res, error, "Failed to fetch catalog item"); }
  });

  app.post("/api/catalog/items", requireAuth, requirePermission("system_admin"), async (req, res) => {
    try {
      const input = insertCatalogItemSchema.parse({ ...req.body, consumableId: req.body.consumableId || null });
      const item = await storage.createCatalogItem(input);
      await syncLegacyCatalogItem(item.id);
      res.status(201).json(item);
    } catch (error) {
      if (error instanceof z.ZodError) return res.status(400).json({ message: "Invalid catalog item", errors: error.issues });
      respondWithApiError(res, error, "Failed to create catalog item");
    }
  });

  app.put("/api/catalog/items/:id", requireAuth, requirePermission("system_admin"), async (req, res) => {
    try {
      if (await isStructuredCatalogItem(req.params.id)) return res.status(409).json({ message: "Edit this service in the structured Service Catalog" });
      const input = insertCatalogItemSchema.partial().parse({ ...req.body, ...(req.body.consumableId !== undefined ? { consumableId: req.body.consumableId || null } : {}) });
      const item = await storage.updateCatalogItem(req.params.id, input);
      if (!item) return res.status(404).json({ message: "Item not found" });
      res.json(item);
    } catch (error) {
      if (error instanceof z.ZodError) return res.status(400).json({ message: "Invalid catalog item", errors: error.issues });
      respondWithApiError(res, error, "Failed to update catalog item");
    }
  });

  app.delete("/api/catalog/items/:id", requireAuth, requirePermission("system_admin"), async (req, res) => {
    try {
      if (await isStructuredCatalogItem(req.params.id)) return res.status(409).json({ message: "Set the service to Inactive in the Service Catalog to preserve its request history" });
      const deleted = await storage.deleteCatalogItem(req.params.id);
      if (!deleted) return res.status(404).json({ message: "Item not found" });
      res.json({ success: true });
    } catch (error) { respondWithApiError(res, error, "Failed to delete catalog item"); }
  });

  // Catalog self-service: create ticket from catalog item
  app.post("/api/catalog/items/:id/request", requireAuth, requireModule("itsm"), async (req, res) => {
    try {
      if (await isStructuredCatalogItem(req.params.id)) return catalogRequestHandler(req, res, () => {});
      const user = req.user as any;
      const item = await storage.getCatalogItem(req.params.id);
      if (!item || !item.isActive) return res.status(404).json({ message: "Catalog item not found" });
      if (!await canReadEmployeeCatalogItem(user, item)) return res.status(403).json({ message: "Hardware requests require a linked employee account." });
      const ticket = await storage.createTicket({
        title: `Service Request: ${item.name}`,
        description: req.body.description || `User requested: ${item.name}`,
        type: "service_request",
        category: item.category,
        priority: "medium",
        status: "open",
        requesterId: user.id,
        assignedToId: null,
        assetId: null,
        departmentId: null,
        impact: null,
        urgency: null,
        dueDate: item.slaHours ? new Date(Date.now() + item.slaHours * 3600000).toISOString().split("T")[0] : null,
        tags: null,
        catalogItemId: item.id,
      } as any);
      res.status(201).json(ticket);
    } catch (error) { respondWithApiError(res, error, "Failed to create service request"); }
  });

  // ── Risk Management ──────────────────────────────────────────────────────
  app.get("/api/risk-users", requireAuth, requirePermission("change_manage"), requireModule("risk_management"), async (_req, res) => {
    try {
      res.json(await db.select({ id: users.id, username: users.username, firstName: users.firstName, lastName: users.lastName })
        .from(users).where(eq(users.isActive, true)));
    } catch (error) {
      console.error("Failed to fetch risk owners:", error);
      respondWithApiError(res, error, "Failed to fetch risk owners");
    }
  });

  app.get("/api/risks", requireAuth, requireModule("risk_management"), async (_req, res) => {
    try {
      const rows = await db.select({
        risk: risks,
        linkedOwnerId: users.id,
        linkedOwnerUsername: users.username,
        linkedOwnerFirstName: users.firstName,
        linkedOwnerLastName: users.lastName,
        linkedChangeId: changes.id,
        linkedChangeNumber: changes.changeNumber,
        linkedChangeTitle: changes.title,
      }).from(risks)
        .leftJoin(users, eq(risks.ownerId, users.id))
        .leftJoin(changes, eq(risks.changeId, changes.id));
      const impactSummaries = await getChangeImpactSummaries(rows.flatMap(row => row.linkedChangeId ? [row.linkedChangeId] : []));
      res.json(rows.map(row => ({
        ...row.risk,
        change: row.linkedChangeId ? {
          id: row.linkedChangeId,
          changeNumber: row.linkedChangeNumber,
          title: row.linkedChangeTitle,
          impactSummary: impactSummaries.get(row.linkedChangeId),
        } : null,
        owner: row.linkedOwnerId ? {
          id: row.linkedOwnerId, username: row.linkedOwnerUsername,
          firstName: row.linkedOwnerFirstName, lastName: row.linkedOwnerLastName,
        } : null,
      })));
    } catch (error) {
      console.error("Failed to fetch risks:", error);
      respondWithApiError(res, error, "Failed to fetch risks");
    }
  });

  app.post("/api/risks", requireAuth, requirePermission("change_manage"), requireModule("risk_management"), async (req, res) => {
    try {
      const bodySchema = z.object({
        title: z.string().trim().min(1).max(200),
        changeId: z.string().nullable().optional(),
        description: z.string().max(5000).nullable().optional(),
        category: z.enum(["security", "availability", "data", "schedule", "operational", "compliance", "vendor", "other"]),
        likelihood: z.number().int().min(1).max(5),
        impact: z.number().int().min(1).max(5),
        mitigation: z.string().max(5000).nullable().optional(),
        contingency: z.string().max(5000).nullable().optional(),
        ownerId: z.string().nullable().optional(),
        dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
        residualLikelihood: z.number().int().min(1).max(5).nullable().optional(),
        residualImpact: z.number().int().min(1).max(5).nullable().optional(),
        status: z.enum(["identified", "mitigating", "accepted", "closed"]).optional(),
        acceptanceReason: z.string().max(2000).nullable().optional(),
      });
      const parsed = bodySchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ message: "Invalid risk assessment", errors: parsed.error.flatten() });
      if (parsed.data.status === "accepted" && !parsed.data.acceptanceReason?.trim()) {
        return res.status(400).json({ message: "An acceptance reason is required for accepted risks" });
      }
      const user = req.user as any;
      const [risk] = await db.insert(risks).values({
        ...parsed.data,
        riskScore: parsed.data.impact * parsed.data.likelihood,
        createdById: user.id,
      }).returning();
      await logAudit(user.id, "CREATE", "risks", risk.id, risk.title, null, risk, req);
      res.status(201).json(risk);
    } catch (error) {
      console.error("Failed to create risk:", error);
      respondWithApiError(res, error, "Failed to create risk");
    }
  });

  app.put("/api/risks/:riskId", requireAuth, requirePermission("change_manage"), requireModule("risk_management"), async (req, res) => {
    try {
      const [oldRisk] = await db.select().from(risks).where(eq(risks.id, req.params.riskId));
      if (!oldRisk) return res.status(404).json({ message: "Risk not found" });
      const bodySchema = z.object({
        title: z.string().trim().min(1).max(200).optional(),
        changeId: z.string().nullable().optional(),
        description: z.string().max(5000).nullable().optional(),
        category: z.enum(["security", "availability", "data", "schedule", "operational", "compliance", "vendor", "other"]).optional(),
        likelihood: z.number().int().min(1).max(5).optional(),
        impact: z.number().int().min(1).max(5).optional(),
        mitigation: z.string().max(5000).nullable().optional(),
        contingency: z.string().max(5000).nullable().optional(),
        ownerId: z.string().nullable().optional(),
        dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
        residualLikelihood: z.number().int().min(1).max(5).nullable().optional(),
        residualImpact: z.number().int().min(1).max(5).nullable().optional(),
        status: z.enum(["identified", "mitigating", "accepted", "closed"]).optional(),
        acceptanceReason: z.string().max(2000).nullable().optional(),
      });
      const parsed = bodySchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ message: "Invalid risk assessment", errors: parsed.error.flatten() });
      const nextReason = parsed.data.acceptanceReason !== undefined
        ? parsed.data.acceptanceReason
        : oldRisk.acceptanceReason;
      const nextStatus = parsed.data.status ?? oldRisk.status;
      if (nextStatus === "accepted" && !nextReason?.trim()) {
        return res.status(400).json({ message: "An acceptance reason is required for accepted risks" });
      }
      const nextImpact = parsed.data.impact ?? oldRisk.impact;
      const nextLikelihood = parsed.data.likelihood ?? oldRisk.likelihood;
      const [risk] = await db.update(risks).set({
        ...parsed.data,
        riskScore: nextImpact * nextLikelihood,
        updatedAt: new Date(),
      })
        .where(eq(risks.id, req.params.riskId)).returning();
      await logAudit((req.user as any).id, "UPDATE", "risks", risk.id, risk.title, oldRisk, risk, req);
      res.json(risk);
    } catch (error) {
      console.error("Failed to update risk:", error);
      respondWithApiError(res, error, "Failed to update risk");
    }
  });

  // ── Change Management ────────────────────────────────────────────────────
  app.get("/api/changes/events", requireAuth, requireModule("itsm"), cabEventsHandler);

  const changeTargetSchema = z.object({
    targetApplicationIds: z.array(z.string().uuid()).max(100).optional(),
    targetServerIds: z.array(z.string().uuid()).max(100).optional(),
    targetAssetIds: z.array(z.string().uuid()).max(100).optional(),
  });
  const validateChangeCiTargets = async (executor: any, applicationIds: string[], serverIds: string[]) => {
    const uniqueApplicationIds = applicationIds.filter((id, index) => applicationIds.indexOf(id) === index);
    const uniqueServerIds = serverIds.filter((id, index) => serverIds.indexOf(id) === index);
    if (uniqueApplicationIds.length !== applicationIds.length || uniqueServerIds.length !== serverIds.length) {
      throw Object.assign(new Error("Choose each application and server only once"), { status: 400 });
    }
    if (uniqueApplicationIds.length) {
      const found = await executor.select({ id: cmdbApplications.id }).from(cmdbApplications)
        .where(inArray(cmdbApplications.id, uniqueApplicationIds));
      if (found.length !== uniqueApplicationIds.length) {
        throw Object.assign(new Error("One or more selected applications do not exist"), { status: 400 });
      }
    }
    if (uniqueServerIds.length) {
      const found = await executor.select({ id: servers.id }).from(servers)
        .where(inArray(servers.id, uniqueServerIds));
      if (found.length !== uniqueServerIds.length) {
        throw Object.assign(new Error("One or more selected servers do not exist"), { status: 400 });
      }
    }
  };
  const syncChangeCiLinks = async (executor: any, changeId: string, applicationIds: string[], serverIds: string[]) => {
    const uniqueApplicationIds = applicationIds.filter((id, index) => applicationIds.indexOf(id) === index);
    const uniqueServerIds = serverIds.filter((id, index) => serverIds.indexOf(id) === index);
    await validateChangeCiTargets(executor, applicationIds, serverIds);
    await executor.delete(changeCiLinks).where(eq(changeCiLinks.changeRequestId, changeId));
    const links = [
      ...uniqueApplicationIds.map(applicationId => ({ changeRequestId: changeId, applicationId, serverId: null })),
      ...uniqueServerIds.map(serverId => ({ changeRequestId: changeId, applicationId: null, serverId })),
    ];
    if (links.length) await executor.insert(changeCiLinks).values(links);
  };

  const validateChangeAssetTargets = async (executor: any, assetIds: string[]) => {
    const uniqueAssetIds = assetIds.filter((id, index) => assetIds.indexOf(id) === index);
    if (uniqueAssetIds.length !== assetIds.length) {
      throw Object.assign(new Error("Choose each asset only once"), { status: 400 });
    }
    if (uniqueAssetIds.length) {
      const found = await executor.select({ id: assets.id }).from(assets)
        .where(inArray(assets.id, uniqueAssetIds));
      if (found.length !== uniqueAssetIds.length) {
        throw Object.assign(new Error("One or more selected assets do not exist"), { status: 400 });
      }
    }
  };
  const syncChangeAssetLinks = async (executor: any, changeId: string, assetIds: string[]) => {
    const uniqueAssetIds = assetIds.filter((id, index) => assetIds.indexOf(id) === index);
    await validateChangeAssetTargets(executor, assetIds);
    await executor.delete(changeAssetLinks).where(eq(changeAssetLinks.changeRequestId, changeId));
    if (uniqueAssetIds.length) {
      await executor.insert(changeAssetLinks).values(uniqueAssetIds.map(assetId => ({ changeRequestId: changeId, assetId })));
    }
  };

  const getChangeImpactSummaries = async (changeIds: string[]) => {
    const uniqueChangeIds = Array.from(new Set(changeIds));
    const summaries = new Map(uniqueChangeIds.map(id => [id, { services: [] as string[], assets: [] as string[] }]));
    if (!uniqueChangeIds.length || !await isFeatureEnabled("cmdb")) return summaries;
    const assetManagementEnabled = await isFeatureEnabled("asset_management");
    const [ciRows, assetRows] = await Promise.all([
      db.select({
        changeId: changeCiLinks.changeRequestId,
        serverId: changeCiLinks.serverId,
        applicationName: cmdbApplications.name,
        serverName: servers.hostname,
      }).from(changeCiLinks)
        .leftJoin(cmdbApplications, eq(cmdbApplications.id, changeCiLinks.applicationId))
        .leftJoin(servers, eq(servers.id, changeCiLinks.serverId))
        .where(inArray(changeCiLinks.changeRequestId, uniqueChangeIds)),
      assetManagementEnabled ? db.select({
        changeId: changeAssetLinks.changeRequestId,
        assetId: changeAssetLinks.assetId,
        assetName: assets.name,
        assetTag: assets.assetTag,
      }).from(changeAssetLinks)
        .innerJoin(assets, eq(assets.id, changeAssetLinks.assetId))
        .where(inArray(changeAssetLinks.changeRequestId, uniqueChangeIds)) : Promise.resolve([]),
    ]);
    for (const row of ciRows) {
      const summary = summaries.get(row.changeId);
      if (!summary) continue;
      if (row.applicationName && !summary.services.includes(row.applicationName)) summary.services.push(row.applicationName);
      if (row.serverName && !summary.assets.includes(row.serverName)) summary.assets.push(row.serverName);
    }
    const targetedServerIds = Array.from(new Set(ciRows.flatMap(row => row.serverId ? [row.serverId] : [])));
    if (targetedServerIds.length) {
      const relatedServices = await db.select({
        serverId: applicationServerLinks.serverId,
        applicationName: cmdbApplications.name,
      }).from(applicationServerLinks)
        .innerJoin(cmdbApplications, eq(cmdbApplications.id, applicationServerLinks.applicationId))
        .where(inArray(applicationServerLinks.serverId, targetedServerIds));
      const changesByServer = new Map<string, string[]>();
      for (const row of ciRows) {
        if (!row.serverId) continue;
        const linkedChanges = changesByServer.get(row.serverId) ?? [];
        linkedChanges.push(row.changeId);
        changesByServer.set(row.serverId, linkedChanges);
      }
      for (const row of relatedServices) {
        for (const changeId of changesByServer.get(row.serverId) ?? []) {
          const summary = summaries.get(changeId);
          if (summary && !summary.services.includes(row.applicationName)) summary.services.push(row.applicationName);
        }
      }
    }
    const directlyLinkedAssets = assetRows.length
      ? assetRows.map(row => ({ changeId: row.changeId, assetId: row.assetId }))
      : [];
    const targetedAssetIds = Array.from(new Set(directlyLinkedAssets.map(row => row.assetId)));
    if (targetedAssetIds.length) {
      const relationships = await db.select().from(assetRelationships)
        .where(or(
          inArray(assetRelationships.parentAssetId, targetedAssetIds),
          inArray(assetRelationships.childAssetId, targetedAssetIds),
        ));
      const directlyLinkedIds = new Set(targetedAssetIds);
      const relatedIds = Array.from(new Set<string>(relationships.map(row =>
        directlyLinkedIds.has(row.parentAssetId) ? row.childAssetId : row.parentAssetId,
      ).filter(id => !directlyLinkedIds.has(id))));
      if (relatedIds.length) {
        const relatedAssets = await db.select({ id: assets.id, name: assets.name, assetTag: assets.assetTag })
          .from(assets).where(inArray(assets.id, relatedIds));
        const relatedById = new Map(relatedAssets.map(row => [row.id, row]));
        for (const link of directlyLinkedAssets) {
          for (const relationship of relationships.filter(row =>
            row.parentAssetId === link.assetId || row.childAssetId === link.assetId,
          )) {
            const relatedId = relationship.parentAssetId === link.assetId ? relationship.childAssetId : relationship.parentAssetId;
            const related = relatedById.get(relatedId);
            const summary = summaries.get(link.changeId);
            if (!related || !summary) continue;
            const label = related.assetTag ? `${related.assetTag} — ${related.name}` : related.name;
            if (!summary.assets.includes(label)) summary.assets.push(label);
          }
        }
      }
    }
    for (const row of assetRows) {
      const summary = summaries.get(row.changeId);
      const label = row.assetTag ? `${row.assetTag} — ${row.assetName}` : row.assetName;
      if (summary && !summary.assets.includes(label)) summary.assets.push(label);
    }
    for (const summary of Array.from(summaries.values())) {
      summary.services.sort((a, b) => a.localeCompare(b));
      summary.assets.sort((a, b) => a.localeCompare(b));
    }
    return summaries;
  };

  const getChangeImpactAnalysis = async (changeId: string, executor: any = db) => {
    if (!await isFeatureEnabled("cmdb")) {
      return { selectedApplicationIds: [], selectedServerIds: [], selectedAssetIds: [], applications: [], servers: [], assets: [], affectedOwners: [] };
    }
    const employeeDirectoryEnabled = await isFeatureEnabled("asset_management");
    const applicationFields = {
      id: cmdbApplications.id,
      name: cmdbApplications.name,
      category: cmdbApplications.category,
      criticalityRating: cmdbApplications.criticalityRating,
      businessOwnerId: cmdbApplications.businessOwner,
      businessOwnerName: employeeDirectoryEnabled ? sql<string | null>`(SELECT concat_ws(' ', first_name, last_name) FROM employees WHERE id = ${cmdbApplications.businessOwner})` : sql<string | null>`NULL`,
      technicalOwnerId: cmdbApplications.technicalOwner,
      technicalOwnerName: employeeDirectoryEnabled ? sql<string | null>`(SELECT concat_ws(' ', first_name, last_name) FROM employees WHERE id = ${cmdbApplications.technicalOwner})` : sql<string | null>`NULL`,
    };
    const serverFields = {
      id: servers.id,
      hostname: servers.hostname,
      ipAddress: servers.ipAddress,
      environment: servers.environment,
      status: servers.status,
      osPlatform: servers.osPlatform,
      location: servers.location,
    };
    type ApplicationImpactRow = {
      id: string;
      name: string;
      category: string;
      criticalityRating: string;
      businessOwnerId: string | null;
      businessOwnerName: string | null;
      technicalOwnerId: string | null;
      technicalOwnerName: string | null;
    };
    type ServerImpactRow = {
      id: string;
      hostname: string;
      ipAddress: string | null;
      environment: string;
      status: string;
      osPlatform: string;
      location: string | null;
    };
    const [
      directlySelectedApplications,
      directlySelectedServers,
      serversHostingTargetedApplications,
      applicationsHostedOnTargetServers,
      selectedAssetLinks,
    ] = await Promise.all([
      executor.select(applicationFields).from(changeCiLinks)
        .innerJoin(cmdbApplications, eq(cmdbApplications.id, changeCiLinks.applicationId))
        .where(eq(changeCiLinks.changeRequestId, changeId)),
      executor.select(serverFields).from(changeCiLinks)
        .innerJoin(servers, eq(servers.id, changeCiLinks.serverId))
        .where(eq(changeCiLinks.changeRequestId, changeId)),
      executor.select({
        ...serverFields,
        targetApplicationId: cmdbApplications.id,
        targetApplicationName: cmdbApplications.name,
      }).from(changeCiLinks)
        .innerJoin(applicationServerLinks, eq(applicationServerLinks.applicationId, changeCiLinks.applicationId))
        .innerJoin(servers, eq(servers.id, applicationServerLinks.serverId))
        .innerJoin(cmdbApplications, eq(cmdbApplications.id, changeCiLinks.applicationId))
        .where(eq(changeCiLinks.changeRequestId, changeId)),
      executor.select({
        ...applicationFields,
        targetServerId: servers.id,
        targetServerHostname: servers.hostname,
      }).from(changeCiLinks)
        .innerJoin(applicationServerLinks, eq(applicationServerLinks.serverId, changeCiLinks.serverId))
        .innerJoin(cmdbApplications, eq(cmdbApplications.id, applicationServerLinks.applicationId))
        .innerJoin(servers, eq(servers.id, changeCiLinks.serverId))
        .where(eq(changeCiLinks.changeRequestId, changeId)),
      employeeDirectoryEnabled ? executor.select({
        id: assets.id,
        name: assets.name,
        assetTag: assets.assetTag,
        type: assets.type,
        category: assets.category,
        criticalityRating: assets.criticalityRating,
        lifecycleStatus: assets.lifecycleStatus,
      }).from(changeAssetLinks)
        .innerJoin(assets, eq(assets.id, changeAssetLinks.assetId))
        .where(eq(changeAssetLinks.changeRequestId, changeId)) : Promise.resolve([]),
    ]) as [
      ApplicationImpactRow[],
      ServerImpactRow[],
      (ServerImpactRow & { targetApplicationId: string; targetApplicationName: string })[],
      (ApplicationImpactRow & { targetServerId: string; targetServerHostname: string })[],
      Array<{ id: string; name: string; assetTag: string | null; type: string; category: string | null; criticalityRating: string | null; lifecycleStatus: string | null }>,
    ];

    type ImpactApplication = ApplicationImpactRow & { affectedThrough: string[] };
    type ImpactServer = ServerImpactRow & { affectedThrough: string[] };
    const applications: ImpactApplication[] = [];
    const addApplication = (row: ApplicationImpactRow, via: string) => {
      let current = applications.find(application => application.id === row.id);
      if (!current) {
        current = { ...row, affectedThrough: [] };
        applications.push(current);
      }
      if (!current.affectedThrough.includes(via)) current.affectedThrough.push(via);
    };
    directlySelectedApplications.forEach(row => addApplication(row, "Direct application target"));
    applicationsHostedOnTargetServers.forEach(row => addApplication(row, `Hosted on target server ${row.targetServerHostname}`));

    const serversById: ImpactServer[] = [];
    const addServer = (row: ServerImpactRow, via: string) => {
      let current = serversById.find(server => server.id === row.id);
      if (!current) {
        current = { ...row, affectedThrough: [] };
        serversById.push(current);
      }
      if (!current.affectedThrough.includes(via)) current.affectedThrough.push(via);
    };
    directlySelectedServers.forEach(row => addServer(row, "Direct server target"));
    serversHostingTargetedApplications.forEach(row =>
      addServer(row, `Hosts target application ${row.targetApplicationName}`),
    );

    const owners: Array<{ id: string; name: string; role: "Business Owner" | "Technical Owner"; applications: string[] }> = [];
    for (const application of applications) {
      for (const [id, name, role] of [
        [application.businessOwnerId, application.businessOwnerName, "Business Owner"],
        [application.technicalOwnerId, application.technicalOwnerName, "Technical Owner"],
      ] as const) {
        if (!id || !name) continue;
        let owner = owners.find(item => item.id === id && item.role === role);
        if (!owner) {
          owner = { id, name, role, applications: [] };
          owners.push(owner);
        }
        if (!owner.applications.includes(application.name)) owner.applications.push(application.name);
      }
    }

    type ImpactAsset = {
      id: string;
      name: string;
      assetTag: string | null;
      type: string;
      category: string | null;
      criticalityRating: string | null;
      lifecycleStatus: string | null;
      affectedThrough: string[];
    };
    const assetsById = new Map<string, ImpactAsset>(
      selectedAssetLinks.map(asset => [asset.id, { ...asset, affectedThrough: ["Direct asset target"] }]),
    );
    if (selectedAssetLinks.length) {
      const selectedById = new Map(selectedAssetLinks.map(asset => [asset.id, asset]));
      const relationships = await executor.select().from(assetRelationships)
        .where(or(
          inArray(assetRelationships.parentAssetId, selectedAssetLinks.map(asset => asset.id)),
          inArray(assetRelationships.childAssetId, selectedAssetLinks.map(asset => asset.id)),
        ));
      const relatedLinks: Array<{ selectedId: string; relatedId: string; relationshipType: string }> = relationships.map((relationship: typeof assetRelationships.$inferSelect) => {
        const selectedId = selectedById.has(relationship.parentAssetId) ? relationship.parentAssetId : relationship.childAssetId;
        return {
          selectedId,
          relatedId: selectedId === relationship.parentAssetId ? relationship.childAssetId : relationship.parentAssetId,
          relationshipType: relationship.relationshipType,
        };
      });
      const relatedIds: string[] = Array.from(new Set<string>(relatedLinks.map(link => link.relatedId).filter((id: string) => !selectedById.has(id))));
      if (relatedIds.length) {
        const relatedAssets = await executor.select({
          id: assets.id,
          name: assets.name,
          assetTag: assets.assetTag,
          type: assets.type,
          category: assets.category,
          criticalityRating: assets.criticalityRating,
          lifecycleStatus: assets.lifecycleStatus,
        }).from(assets).where(inArray(assets.id, relatedIds));
        const relatedById = new Map<string, (typeof relatedAssets)[number]>(relatedAssets.map((asset: (typeof relatedAssets)[number]) => [asset.id, asset]));
        for (const link of relatedLinks) {
          const relatedAsset = relatedById.get(link.relatedId);
          const selectedAsset = selectedById.get(link.selectedId);
          if (!relatedAsset || !selectedAsset) continue;
          const item: ImpactAsset = assetsById.get(relatedAsset.id) ?? { ...relatedAsset, affectedThrough: [] };
          const path = `${link.relationshipType} relationship with ${selectedAsset.name}`;
          if (!item.affectedThrough.includes(path)) item.affectedThrough.push(path);
          assetsById.set(item.id, item);
        }
      }
    }

    return {
      selectedApplicationIds: directlySelectedApplications.map(row => row.id),
      selectedServerIds: directlySelectedServers.map(row => row.id),
      selectedAssetIds: selectedAssetLinks.map(row => row.id),
      applications: applications.sort((a, b) => a.name.localeCompare(b.name)),
      servers: serversById.sort((a, b) => a.hostname.localeCompare(b.hostname)),
      assets: Array.from(assetsById.values()).sort((a, b) => a.name.localeCompare(b.name)),
      affectedOwners: owners.sort((a, b) => a.name.localeCompare(b.name) || a.role.localeCompare(b.role)),
    };
  };

  app.get("/api/cmdb/change-options", requireAuth, requireModule("itsm"), requireModule("cmdb"), async (_req, res) => {
    try {
      const assetManagementEnabled = await isFeatureEnabled("asset_management");
      const employeeDirectoryEnabled = assetManagementEnabled;
      const [applicationRows, serverRows, assetRows] = await Promise.all([
        db.select({
          id: cmdbApplications.id,
          name: cmdbApplications.name,
          category: cmdbApplications.category,
          criticalityRating: cmdbApplications.criticalityRating,
          businessOwnerName: employeeDirectoryEnabled ? sql<string | null>`(SELECT concat_ws(' ', first_name, last_name) FROM employees WHERE id = ${cmdbApplications.businessOwner})` : sql<string | null>`NULL`,
          technicalOwnerName: employeeDirectoryEnabled ? sql<string | null>`(SELECT concat_ws(' ', first_name, last_name) FROM employees WHERE id = ${cmdbApplications.technicalOwner})` : sql<string | null>`NULL`,
        }).from(cmdbApplications).where(eq(cmdbApplications.status, "active")).orderBy(asc(cmdbApplications.name)),
        db.select({
          id: servers.id,
          hostname: servers.hostname,
          ipAddress: servers.ipAddress,
          environment: servers.environment,
          status: servers.status,
        }).from(servers).where(sql`${servers.status} <> 'offline'`).orderBy(asc(servers.hostname)),
        assetManagementEnabled ? db.select({
          id: assets.id,
          name: assets.name,
          assetTag: assets.assetTag,
          type: assets.type,
          category: assets.category,
          criticalityRating: assets.criticalityRating,
          lifecycleStatus: assets.lifecycleStatus,
        }).from(assets).orderBy(asc(assets.name)) : Promise.resolve([]),
      ]);
      res.json({ applications: applicationRows, servers: serverRows, assets: assetRows });
    } catch (error) {
      respondWithApiError(res, error, "Failed to load change target catalog");
    }
  });

  const blackoutDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(value => {
    const parsed = new Date(`${value}T00:00:00.000Z`);
    return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
  }, "Enter a valid calendar date");
  const blackoutPayloadSchema = z.object({
    title: z.string().trim().min(1).max(120),
    reason: z.string().trim().max(500).nullable().optional(),
    startDate: blackoutDateSchema,
    endDate: blackoutDateSchema,
  }).strict().refine(value => value.endDate >= value.startDate, {
    message: "End date must be on or after start date",
    path: ["endDate"],
  });

  app.get("/api/changes/calendar", requireAuth, requireModule("itsm"), requirePermission("change_manage"), async (req, res) => {
    try {
      const fromResult = blackoutDateSchema.safeParse(req.query.from);
      const toResult = blackoutDateSchema.safeParse(req.query.to);
      if (!fromResult.success || !toResult.success || fromResult.data > toResult.data) {
        return res.status(400).json({ message: "Provide a valid calendar date range" });
      }
      const from = fromResult.data;
      const to = toResult.data;
      const fromTime = new Date(`${from}T00:00:00.000Z`);
      const toExclusive = new Date(new Date(`${to}T00:00:00.000Z`).getTime() + 86400000);
      if ((toExclusive.getTime() - fromTime.getTime()) / 86400000 > 62) {
        return res.status(400).json({ message: "Calendar range cannot exceed 62 days" });
      }
      const [plannedChanges, blackoutRows] = await Promise.all([
        db.select({
          id: changes.id,
          changeNumber: changes.changeNumber,
          title: changes.title,
          status: changes.status,
          type: changes.type,
          scheduledStart: changes.scheduledStart,
          scheduledEnd: changes.scheduledEnd,
          risk: changes.risk,
        }).from(changes).where(and(
          inArray(changes.status, ["submitted", "approved", "in_progress"]),
          isNotNull(changes.scheduledStart),
          isNotNull(changes.scheduledEnd),
          lt(changes.scheduledStart, toExclusive),
          gte(changes.scheduledEnd, fromTime),
        )).orderBy(asc(changes.scheduledStart), asc(changes.changeNumber)),
        db.select({
          id: changeBlackouts.id,
          title: changeBlackouts.title,
          reason: changeBlackouts.reason,
          startDate: changeBlackouts.startDate,
          endDate: changeBlackouts.endDate,
          createdAt: changeBlackouts.createdAt,
        }).from(changeBlackouts).where(and(
          lte(changeBlackouts.startDate, to),
          gte(changeBlackouts.endDate, from),
        )).orderBy(asc(changeBlackouts.startDate), asc(changeBlackouts.title)),
      ]);
      res.json({ changes: plannedChanges, blackouts: blackoutRows });
    } catch (error) {
      respondWithApiError(res, error, "Failed to load change calendar");
    }
  });

  app.post("/api/change-blackouts", requireAuth, requireModule("itsm"), requirePermission("change_manage"), async (req, res) => {
    const parsed = blackoutPayloadSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.issues[0]?.message ?? "Invalid blackout period" });
    try {
      const [created] = await db.insert(changeBlackouts).values({
        ...parsed.data,
        reason: parsed.data.reason || null,
        createdById: (req.user as any).id,
      }).returning();
      res.status(201).json(created);
    } catch (error) {
      respondWithApiError(res, error, "Failed to create blackout period");
    }
  });

  app.put("/api/change-blackouts/:id", requireAuth, requireModule("itsm"), requirePermission("change_manage"), async (req, res) => {
    const parsed = blackoutPayloadSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.issues[0]?.message ?? "Invalid blackout period" });
    try {
      const [updated] = await db.update(changeBlackouts).set({
        ...parsed.data,
        reason: parsed.data.reason || null,
        updatedAt: new Date(),
      }).where(eq(changeBlackouts.id, req.params.id)).returning();
      if (!updated) return res.status(404).json({ message: "Blackout period not found" });
      res.json(updated);
    } catch (error) {
      respondWithApiError(res, error, "Failed to update blackout period");
    }
  });

  app.delete("/api/change-blackouts/:id", requireAuth, requireModule("itsm"), requirePermission("change_manage"), async (req, res) => {
    try {
      const [deleted] = await db.delete(changeBlackouts).where(eq(changeBlackouts.id, req.params.id)).returning({ id: changeBlackouts.id });
      if (!deleted) return res.status(404).json({ message: "Blackout period not found" });
      res.json({ success: true });
    } catch (error) {
      respondWithApiError(res, error, "Failed to delete blackout period");
    }
  });

  app.get("/api/changes", requireAuth, requireModule("itsm"), async (req, res) => {
    try {
      const userId = (req.user as any).id as string;
      const canViewAll = await canViewAllItsmRecords(userId);
      const page = Number(req.query.page);
      const pageSize = Number(req.query.pageSize);
      const search = req.query.search;
      const type = req.query.type;
      const status = req.query.status;
      if (!Number.isSafeInteger(page) || page < 1 || page > 1000000 ||
          !Number.isSafeInteger(pageSize) || pageSize < 1 || pageSize > 100 ||
          (search !== undefined && (typeof search !== "string" || search.length > 200)) ||
          (type !== undefined && (typeof type !== "string" || !["standard", "normal", "emergency"].includes(type))) ||
          (status !== undefined && (typeof status !== "string" || !["draft", "submitted", "approved", "rejected", "in_progress", "completed", "cancelled", "failed"].includes(status)))) {
        return res.status(400).json({ message: "Invalid change list parameters" });
      }
      const result = await storage.getChangesPage({
        page, pageSize, search: search as string | undefined, type: type as string | undefined, status: status as string | undefined,
        ...(!canViewAll ? { requestedById: userId } : {}),
      });
      const impactSummaries = await getChangeImpactSummaries(result.changes.map(change => change.id));
      res.json({
        ...result,
        changes: result.changes.map(change => ({ ...change, impactSummary: impactSummaries.get(change.id) })),
      });
    }
    catch (error) { respondWithApiError(res, error, "Failed to fetch changes"); }
  });

  app.get("/api/changes/pending-votes", requireAuth, requireModule("itsm"), async (req, res) => {
    try { res.json(await storage.getPendingCabChanges((req.user as any).id)); }
    catch (error) { respondWithApiError(res, error, "Failed to fetch pending CAB votes"); }
  });

  app.get("/api/changes/:id", requireAuth, requireModule("itsm"), async (req, res) => {
    try {
      const ch = await storage.getChange(req.params.id);
      if (!ch) return res.status(404).json({ message: "Change not found or no longer available" });
      const userId = (req.user as any).id;
      const canManageChanges = (await storage.getUserPermissions(userId)).some(permission =>
        ["system_admin", "change_manage"].includes(permission),
      );
      if (ch.requestedById !== userId && !(await canViewAllItsmRecords(userId)) && !canManageChanges) {
        return res.status(403).json({ message: "Insufficient permissions" });
      }
      res.json({ ...ch, impactAnalysis: await getChangeImpactAnalysis(ch.id) });
    } catch (error) { respondWithApiError(res, error, "Failed to fetch change"); }
  });

  app.post("/api/changes", requireAuth, requireModule("itsm"), requirePermission("change_manage"), async (req, res) => {
    try {
      const user = req.user as any;
      const body = { ...req.body };
      delete body.cabReviewVersion;
      const targetIds = changeTargetSchema.parse(body);
      const targetApplicationIds = targetIds.targetApplicationIds ?? [];
      const targetServerIds = targetIds.targetServerIds ?? [];
      const targetAssetIds = targetIds.targetAssetIds ?? [];
      const cmdbEnabled = await isFeatureEnabled("cmdb");
      if (!cmdbEnabled && (targetApplicationIds.length || targetServerIds.length)) return sendFeatureNotEnabled(res, "cmdb");
      const assetManagementEnabled = await isFeatureEnabled("asset_management");
      if (!assetManagementEnabled && targetAssetIds.length) return sendFeatureNotEnabled(res, "asset_management");
      delete body.targetApplicationIds;
      delete body.targetServerIds;
      delete body.targetAssetIds;
      if (body.scheduledStart) body.scheduledStart = new Date(body.scheduledStart);
      if (body.scheduledEnd)   body.scheduledEnd   = new Date(body.scheduledEnd);
      if (body.actualStart)    body.actualStart    = new Date(body.actualStart);
      if (body.actualEnd)      body.actualEnd      = new Date(body.actualEnd);
      // strip empty-string nullable FK fields so DB doesn't complain
      if (!body.assignedToId) body.assignedToId = null;
      if (!body.departmentId) body.departmentId = null;
      if (body.projectId && !await isFeatureEnabled("project_management")) return sendFeatureNotEnabled(res, "project_management");
      if (body.projectId && !(await db.select({ id: projects.id }).from(projects).where(eq(projects.id, body.projectId))).length) {
        return res.status(400).json({ message: "Project not found" });
      }
      if (cmdbEnabled) await validateChangeCiTargets(db, targetApplicationIds, targetServerIds);
      if (assetManagementEnabled) await validateChangeAssetTargets(db, targetAssetIds);
      // New changes always start as draft regardless of caller-supplied status
      body.status = "draft";
      // Compute authoritative cabRequired from type/risk on creation
      const typeTriggersCABOnCreate = ["normal", "emergency"].includes(body.type ?? "");
      const riskTriggersCABOnCreate = ["high", "critical"].includes(body.risk ?? "");
      if (typeTriggersCABOnCreate || riskTriggersCABOnCreate) {
        body.cabRequired = true;
      }
      const change = await storage.createChange({ ...body, requestedById: user.id });
      if (cmdbEnabled || assetManagementEnabled) await db.transaction(async tx => {
        if (cmdbEnabled) await syncChangeCiLinks(tx, change.id, targetApplicationIds, targetServerIds);
        if (assetManagementEnabled) await syncChangeAssetLinks(tx, change.id, targetAssetIds);
      });
      res.status(201).json({ ...change, impactAnalysis: await getChangeImpactAnalysis(change.id) });
    } catch (err) {
      console.error("Failed to create change:", err);
      if (err instanceof z.ZodError) return res.status(400).json({ message: "Invalid change targets", errors: err.issues });
      if ((err as any)?.status) return res.status((err as any).status).json({ message: (err as any).message });
      respondWithApiError(res, err, "Failed to create change");
    }
  });

  app.put("/api/changes/:id", requireAuth, requireModule("itsm"), requirePermission("change_manage"), async (req, res) => {
    try {
      const oldChange = await storage.getChange(req.params.id);
      const body = { ...req.body };
      delete body.cabReviewVersion;
      const targetIds = changeTargetSchema.parse(body);
      const cmdbEnabled = await isFeatureEnabled("cmdb");
      if (!cmdbEnabled && (targetIds.targetApplicationIds?.length || targetIds.targetServerIds?.length)) return sendFeatureNotEnabled(res, "cmdb");
      const assetManagementEnabled = await isFeatureEnabled("asset_management");
      if (!assetManagementEnabled && targetIds.targetAssetIds?.length) return sendFeatureNotEnabled(res, "asset_management");
      if (body.projectId && !await isFeatureEnabled("project_management")) return sendFeatureNotEnabled(res, "project_management");
      if (body.projectId && !(await db.select({ id: projects.id }).from(projects).where(eq(projects.id, body.projectId))).length) {
        return res.status(400).json({ message: "Project not found" });
      }
      delete body.targetApplicationIds;
      delete body.targetServerIds;
      delete body.targetAssetIds;
      const linkUpdateRequested = cmdbEnabled && (targetIds.targetApplicationIds !== undefined || targetIds.targetServerIds !== undefined);
      const currentLinks = linkUpdateRequested
        ? await db.select().from(changeCiLinks).where(eq(changeCiLinks.changeRequestId, req.params.id))
        : [];
      const targetApplicationIds = targetIds.targetApplicationIds ?? currentLinks.flatMap(link => link.applicationId ? [link.applicationId] : []);
      const targetServerIds = targetIds.targetServerIds ?? currentLinks.flatMap(link => link.serverId ? [link.serverId] : []);
      if (linkUpdateRequested) await validateChangeCiTargets(db, targetApplicationIds, targetServerIds);
      const assetLinkUpdateRequested = assetManagementEnabled && targetIds.targetAssetIds !== undefined;
      const currentAssetLinks = assetLinkUpdateRequested
        ? []
        : assetManagementEnabled
          ? await db.select().from(changeAssetLinks).where(eq(changeAssetLinks.changeRequestId, req.params.id))
          : [];
      const targetAssetIds = targetIds.targetAssetIds ?? currentAssetLinks.map(link => link.assetId);
      if (assetLinkUpdateRequested) await validateChangeAssetTargets(db, targetAssetIds);
      if (body.scheduledStart) body.scheduledStart = new Date(body.scheduledStart);
      if (body.scheduledEnd)   body.scheduledEnd   = new Date(body.scheduledEnd);
      if (body.actualStart)    body.actualStart    = new Date(body.actualStart);
      if (body.actualEnd)      body.actualEnd      = new Date(body.actualEnd);
      if (!body.assignedToId)  body.assignedToId   = null;
      if (!body.departmentId)  body.departmentId   = null;

      // The storage transaction locks the change row shared with CAB votes,
      // then derives CAB requirements from the locked resulting type/risk and
      // validates approvals from that same vote state.
      const result = await storage.updateChangeWithCabStatusGuard(req.params.id, body);
      if (result.escalationBlocked) {
        return res.status(409).json({
          message: "A risk or change-type escalation cannot be saved after implementation starts or the change is closed. Create a follow-up change for CAB review.",
          code: "CAB_ESCALATION_AFTER_START",
        });
      }
      if (result.cabPending) {
        await logAudit(
          (req.user as any)?.id,
          "UPDATE",
          "changes",
          req.params.id,
          oldChange?.title ?? req.params.id,
          { status: oldChange?.status },
          { status: body.status, blocked: true, note: "Status transition blocked: pending CAB approvals" },
          req
        );
        return res.status(403).json({
          message: "CAB approval is required. All CAB approvers must approve before this status change is permitted.",
          code: "CAB_PENDING",
        });
      }
      const change = result.change;
      if (!change) return res.status(404).json({ message: "Change not found" });
      if (linkUpdateRequested || assetLinkUpdateRequested) {
        await db.transaction(async tx => {
          if (linkUpdateRequested) await syncChangeCiLinks(tx, change.id, targetApplicationIds, targetServerIds);
          if (assetLinkUpdateRequested) await syncChangeAssetLinks(tx, change.id, targetAssetIds);
        });
      }
      res.json({
        ...change,
        impactAnalysis: await getChangeImpactAnalysis(change.id),
        ...(result.cabReviewReset ? {
          cabReviewReset: true,
          cabReviewMessage: "Risk or change type increased. Prior CAB decisions remain in history but do not count; all active approvers must vote again.",
        } : {}),
      });
    } catch (err) {
      console.error("Failed to update change:", err);
      if (err instanceof z.ZodError) return res.status(400).json({ message: "Invalid change targets", errors: err.issues });
      if ((err as any)?.status) return res.status((err as any).status).json({ message: (err as any).message });
      respondWithApiError(res, err, "Failed to update change");
    }
  });

  app.delete("/api/changes/:id", requireAuth, requirePermission("system_admin"), async (req, res) => {
    try {
      const deleted = await storage.deleteChange(req.params.id);
      if (!deleted) return res.status(404).json({ message: "Change not found" });
      res.json({ success: true });
    } catch (error) { respondWithApiError(res, error, "Failed to delete change"); }
  });

  app.get("/api/changes/:id/approvals", requireAuth, requireModule("itsm"), async (req, res) => {
    try {
      const change = await storage.getChange(req.params.id);
      if (!change) return res.status(404).json({ message: "Change not found" });
      if (change.requestedById !== (req.user as any).id && !(await canViewAllItsmRecords((req.user as any).id))) {
        return res.status(403).json({ message: "Insufficient permissions" });
      }
      res.json(await storage.getChangeApprovals(req.params.id));
    }
    catch (error) { respondWithApiError(res, error, "Failed to fetch approvals"); }
  });

  app.post("/api/changes/:id/approvals", requireAuth, requireModule("itsm"), requirePermission("change_manage"), async (req, res) => {
    try {
      const user = req.user as any;

      // If approverId is specified and differs from the caller, require admin/change_manage permission
      let approverId: string = user.id;
      if (req.body.approverId && req.body.approverId !== user.id) {
        const callerPermissions = await storage.getUserPermissions(user.id);
        const hasPermission = callerPermissions.includes("system_admin") || callerPermissions.includes("change_manage");
        if (!hasPermission) {
          return res.status(403).json({ message: "Only administrators can assign approvers on behalf of others" });
        }
        approverId = req.body.approverId;
      }

      const approval = await storage.createChangeApproval({ changeId: req.params.id, approverId, decision: "pending" });
      await logAudit(user.id, "CREATE", "change_approvals", approval.id,
        `CAB approver ${approverId} on change ${req.params.id}`,
        null, { changeId: approval.changeId, approverId: approval.approverId, decision: approval.decision }, req);
      await publishCabChange();
      res.status(201).json(approval);
    } catch (error: any) {
      if (error?.code === "CAB_CHANGE_ALREADY_APPROVED") {
        return res.status(409).json({
          message: "CAB approvers cannot be added after a change is approved or started. Reopen the change before assigning another approver.",
          code: "CAB_CHANGE_ALREADY_APPROVED",
        });
      }
      if (error?.code === "CAB_APPROVER_REMOVED") {
        return res.status(409).json({
          message: "This CAB member was removed from the change and cannot be re-added.",
          code: "CAB_APPROVER_REMOVED",
        });
      }
      if (error?.code === "CAB_APPROVER_INACTIVE") {
        return res.status(409).json({
          message: "This account is inactive and cannot be assigned as a CAB approver.",
          code: "CAB_APPROVER_INACTIVE",
        });
      }
      if (error?.code === "CAB_APPROVER_DUPLICATE") {
        return res.status(409).json({
          message: "This CAB member is already assigned to the change.",
          code: "CAB_APPROVER_DUPLICATE",
        });
      }
      if (error?.code === "23505") {
        // The unique constraint also covers removed approvals. A concurrent add
        // must not report an inactive historical assignment as an active one.
        const approverId = req.body.approverId || (req.user as any).id;
        let removed = false;
        try {
          const history = await storage.getAllChangeApprovalRecords(req.params.id);
          removed = history.some(a => a.originalApproverId === approverId && a.removedAt);
        } catch (lookupError) {
          console.error("Failed to check approval history after conflict:", lookupError);
          return respondWithApiError(res, lookupError, "Failed to check approval history");
        }
        return res.status(409).json({
          message: removed
            ? "This CAB member was removed from the change and cannot be re-added."
            : "This CAB member is already assigned to the change.",
          code: removed ? "CAB_APPROVER_REMOVED" : "CAB_APPROVER_DUPLICATE",
        });
      }
      console.error("Failed to add approval:", error);
      respondWithApiError(res, error, "Failed to add approval");
    }
  });

  app.delete("/api/changes/:changeId/approvals/:approvalId", requireAuth, requireModule("itsm"), async (req, res) => {
    try {
      const user = req.user as any;
      const callerPermissions = await storage.getUserPermissions(user.id);
      const hasPermission = callerPermissions.includes("system_admin") || callerPermissions.includes("change_manage");
      if (!hasPermission) return res.status(403).json({ message: "Only change managers can remove CAB approvers" });

      const approvals = await storage.getChangeApprovals(req.params.changeId);
      const approval = approvals.find(a => a.id === req.params.approvalId);
      if (!approval) return res.status(404).json({ message: "Approval not found for this change" });
      if (approval.decision !== "pending" && approval.decision !== null) {
        return res.status(409).json({ message: "A CAB vote that has already been cast cannot be removed" });
      }

      const removed = await storage.removeChangeApproval(approval.id, user.id);
      if (!removed) return res.status(409).json({ message: "This CAB approval was already voted on or removed" });
      await logAudit(user.id, "DELETE", "change_approvals", removed.id,
        `CAB approver ${removed.originalApproverId} on change ${removed.changeId}`,
        { changeId: approval.changeId, approverId: approval.originalApproverId, decision: approval.decision, removedAt: approval.removedAt },
        { changeId: removed.changeId, approverId: removed.originalApproverId, decision: removed.decision, removedAt: removed.removedAt, removedById: removed.removedById }, req);
      await publishCabChange();
      res.json({ success: true });
    } catch (error) {
      console.error("Failed to remove approval:", error);
      respondWithApiError(res, error, "Failed to remove approval");
    }
  });

  app.put("/api/changes/:changeId/approvals/:approvalId", requireAuth, requireModule("itsm"), requireAnyPermission("change_approve", "change_manage", "system_admin"), async (req, res) => {
    try {
      const user = req.user as any;
      const VALID_DECISIONS = ["approved", "rejected"] as const;

      // Validate decision enum
      if (!VALID_DECISIONS.includes(req.body.decision)) {
        return res.status(400).json({ message: "Invalid decision — must be 'approved' or 'rejected'" });
      }

      // Load approval and verify it belongs to the URL change
      const allApprovals = await storage.getChangeApprovals(req.params.changeId);
      const existing = allApprovals.find(a => a.id === req.params.approvalId);
      if (!existing) return res.status(404).json({ message: "Approval not found for this change" });
      if (existing.decision !== "pending" && existing.decision !== null) {
        return res.status(409).json({ message: "This CAB vote has already been recorded and cannot be cast again" });
      }

      // Only the approval's owner may cast a vote
      if (existing.approverId !== user.id) {
        return res.status(403).json({ message: "You can only vote on your own CAB approval" });
      }

      const approval = await storage.updateChangeApproval(
        req.params.changeId,
        req.params.approvalId,
        req.body.decision,
        req.body.comments,
        existing.reviewVersion,
      );
      if (!approval) {
        const currentChange = await storage.getChange(req.params.changeId);
        if (currentChange && existing.reviewVersion !== currentChange.cabReviewVersion) {
          return res.status(409).json({
            message: "This vote belongs to an earlier CAB review. Review the current escalation and cast a fresh vote.",
            code: "CAB_REVIEW_SUPERSEDED",
          });
        }
        return res.status(409).json({ message: "This CAB approval was already voted on or removed" });
      }

      await publishCabChange();
      res.json(approval);
    } catch (error) { respondWithApiError(res, error, "Failed to update approval"); }
  });

  // ── Change Post-Implementation Review (PIR) ──────────────────────────────
  app.get("/api/changes/:id/pir", requireAuth, requireModule("itsm"), async (req, res) => {
    try {
      const pir = await storage.getChangePIR(req.params.id);
      if (!pir) return res.status(404).json({ message: "PIR not found" });
      if (!(await canReadChangeRecord((req.user as any).id, req.params.id))) return res.status(403).json({ message: "Insufficient permissions" });
      res.json(pir);
    } catch (error) { respondWithApiError(res, error, "Failed to fetch PIR"); }
  });

  app.post("/api/changes/:id/pir", requireAuth, requireModule("itsm"), requirePermission("change_manage"), async (req, res) => {
    try {
      const user = req.user as any;
      const ch = await storage.getChange(req.params.id);
      if (!ch) return res.status(404).json({ message: "Change not found" });
      if (!["completed", "cancelled"].includes(ch.status)) {
        return res.status(400).json({ message: "PIR can only be created for completed or cancelled changes" });
      }
      const existing = await storage.getChangePIR(req.params.id);
      if (existing) return res.status(409).json({ message: "PIR already exists for this change" });
      const pir = await storage.createChangePIR({ ...req.body, changeId: req.params.id, completedById: user.id });
      res.status(201).json(pir);
    } catch (error) { respondWithApiError(res, error, "Failed to create PIR"); }
  });

  app.put("/api/changes/:id/pir", requireAuth, requireModule("itsm"), requirePermission("change_manage"), async (req, res) => {
    try {
      const pir = await storage.updateChangePIR(req.params.id, req.body);
      if (!pir) return res.status(404).json({ message: "PIR not found" });
      res.json(pir);
    } catch (error) { respondWithApiError(res, error, "Failed to update PIR"); }
  });

  // ── Change Workflow Actions ───────────────────────────────────────────────
  app.post("/api/changes/:id/assign", requireAuth, requireModule("itsm"), requirePermission("change_manage"), async (req, res) => {
    try {
      const { assignedToId, departmentId } = req.body;
      const change = await storage.updateChange(req.params.id, {
        assignedToId: assignedToId || null,
        departmentId: departmentId || null,
        assignedAt: assignedToId ? new Date() : null,
      } as any);
      if (!change) return res.status(404).json({ message: "Change not found" });
      res.json(await storage.getChange(req.params.id));
    } catch (e) { console.error(e); respondWithApiError(res, e, "Failed to assign change"); }
  });

  app.post("/api/changes/:id/submit", requireAuth, requireModule("itsm"), requirePermission("change_manage"), async (req, res) => {
    try {
      const ch = await storage.getChange(req.params.id);
      if (!ch) return res.status(404).json({ message: "Change not found" });
      if (!["draft","rejected"].includes(ch.status)) return res.status(400).json({ message: "Can only submit a draft or rejected change" });
      const result = await storage.updateChangeWithCabStatusGuard(
        req.params.id,
        { status: "submitted", submittedAt: new Date() } as any,
        { allowedCurrentStatuses: ["draft", "rejected"] },
      );
      if (result.statusInvalid) {
        return res.status(400).json({ message: "Can only submit a draft or rejected change" });
      }
      if (!result.change) return res.status(404).json({ message: "Change not found" });
      res.json(await storage.getChange(req.params.id));
    } catch (e) { console.error(e); respondWithApiError(res, e, "Failed to submit change"); }
  });

  app.post("/api/changes/:id/start", requireAuth, requireModule("itsm"), requirePermission("change_manage"), async (req, res) => {
    try {
      const ch = await storage.getChange(req.params.id);
      if (!ch) return res.status(404).json({ message: "Change not found" });
      if (ch.status !== "approved") return res.status(400).json({ message: "Change must be approved before starting" });
      const user = req.user as any;
      const result = await storage.updateChangeWithCabStatusGuard(
        req.params.id,
        {
          status: "in_progress",
          actualStart: new Date(),
          assignedToId: ch.assignedToId || user.id,
          assignedAt: ch.assignedAt || new Date(),
        } as any,
        { allowedCurrentStatuses: ["approved"] },
      );
      if (result.statusInvalid) {
        return res.status(400).json({ message: "Change must be approved before starting" });
      }
      if (result.cabPending) {
        return res.status(400).json(result.cabApproversRequired
          ? {
              message: "No CAB approvers have been added yet. Add at least one CAB approver and obtain their approval before implementation can start.",
              code: "CAB_APPROVERS_REQUIRED",
            }
          : {
              message: "CAB approvals are not all granted yet. All assigned CAB approvers must approve before implementation can start.",
              code: "CAB_PENDING",
            });
      }
      if (!result.change) return res.status(404).json({ message: "Change not found" });

      // Create default environment stages only after the guarded transition succeeds.
      const existing = await storage.getChangeStages(req.params.id);
      if (existing.length === 0) await storage.createDefaultChangeStages(req.params.id);
      res.json(await storage.getChange(req.params.id));
    } catch (e) { console.error(e); respondWithApiError(res, e, "Failed to start change"); }
  });

  app.post("/api/changes/:id/complete", requireAuth, requireModule("itsm"), requirePermission("change_manage"), async (req, res) => {
    try {
      const ch = await storage.getChange(req.params.id);
      if (!ch) return res.status(404).json({ message: "Change not found" });
      if (ch.status !== "in_progress") return res.status(400).json({ message: "Change must be in progress to complete" });
      await storage.updateChange(req.params.id, { status: "completed", actualEnd: new Date() } as any);
      res.json(await storage.getChange(req.params.id));
    } catch (e) { console.error(e); respondWithApiError(res, e, "Failed to complete change"); }
  });

  app.post("/api/changes/:id/cancel", requireAuth, requireModule("itsm"), requirePermission("change_manage"), async (req, res) => {
    try {
      const ch = await storage.getChange(req.params.id);
      if (!ch) return res.status(404).json({ message: "Change not found" });
      if (["completed","cancelled"].includes(ch.status)) return res.status(400).json({ message: "Cannot cancel a completed or already cancelled change" });
      await storage.updateChange(req.params.id, { status: "cancelled" } as any);
      res.json(await storage.getChange(req.params.id));
    } catch (e) { console.error(e); respondWithApiError(res, e, "Failed to cancel change"); }
  });

  // ── Environment Stages ───────────────────────────────────────────────────
  app.get("/api/changes/:id/stages", requireAuth, requireModule("itsm"), async (req, res) => {
    try {
      if (!(await canReadChangeRecord((req.user as any).id, req.params.id))) return res.status(403).json({ message: "Insufficient permissions" });
      res.json(await storage.getChangeStages(req.params.id));
    }
    catch (error) { respondWithApiError(res, error, "Failed to fetch stages"); }
  });

  app.post("/api/changes/:id/stages/init", requireAuth, requireModule("itsm"), requirePermission("change_manage"), async (req, res) => {
    try {
      const existing = await storage.getChangeStages(req.params.id);
      if (existing.length > 0) return res.json(existing);
      const stages = await storage.createDefaultChangeStages(req.params.id);
      res.status(201).json(stages);
    } catch (error) { respondWithApiError(res, error, "Failed to initialize stages"); }
  });

  app.put("/api/changes/:id/stages/:stageId", requireAuth, requireModule("itsm"), requirePermission("change_manage"), async (req, res) => {
    try {
      const change = await storage.getChange(req.params.id);
      if (!change) return res.status(404).json({ message: "Change not found" });
      if (change.status !== "in_progress") {
        return res.status(400).json({ message: "Environment stages can only be updated while the change is in progress" });
      }

      const existingStages = await storage.getChangeStages(req.params.id);
      if (!existingStages.some(stage => stage.id === req.params.stageId)) {
        return res.status(404).json({ message: "Stage not found for this change" });
      }

      const user = req.user as any;
      const { status, notes, evidence, assignedToId, dueDate } = req.body;
      const updates: any = {};
      if (status !== undefined)      updates.status = status;
      if (notes !== undefined)        updates.notes = notes;
      if (evidence !== undefined)     updates.evidence = evidence;
      if (assignedToId !== undefined) updates.assignedToId = assignedToId || null;
      if (dueDate !== undefined)      updates.dueDate = dueDate ? new Date(dueDate) : null;
      if (status === "in_progress" && !req.body.startedAt) updates.startedAt = new Date();
      if (status === "in_progress") updates.completedAt = null;
      if ((status === "completed" || status === "failed") && !req.body.completedAt) updates.completedAt = new Date();
      if (status === "in_progress" || status === "completed" || status === "failed") updates.deployedById = user.id;
      const stage = await storage.updateChangeStage(req.params.stageId, updates);
      if (!stage) return res.status(404).json({ message: "Stage not found" });
      res.json(await storage.getChange(req.params.id));
    } catch (e) { console.error(e); respondWithApiError(res, e, "Failed to update stage"); }
  });

  // ── ITSM Report Endpoints ────────────────────────────────────────────────────
  app.get("/api/reports/problems", requireAuth, requireModule("itsm"), async (req, res) => {
    try { res.json(await storage.getProblems()); }
    catch (error) { respondWithApiError(res, error, "Failed to fetch problem report"); }
  });

  app.get("/api/reports/changes", requireAuth, requireModule("itsm"), async (req, res) => {
    try {
      const page = Math.max(1, Number.parseInt(String(req.query.page ?? "1"), 10) || 1);
      const requestedPageSize = Number.parseInt(String(req.query.pageSize ?? "50"), 10) || 50;
      const pageSize = Math.min(100, Math.max(1, requestedPageSize));
      const search = typeof req.query.search === "string" ? req.query.search.trim() : undefined;
      const type = typeof req.query.type === "string" && req.query.type !== "all" ? req.query.type : undefined;
      const status = typeof req.query.status === "string" && req.query.status !== "all" ? req.query.status : undefined;
      const risk = typeof req.query.risk === "string" && req.query.risk !== "all" ? req.query.risk : undefined;
      const parseDateOnly = (value: unknown): Date | undefined | null => {
        if (value === undefined) return undefined;
        if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
        const date = new Date(`${value}T00:00:00.000Z`);
        return Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value ? null : date;
      };
      const scheduledStartFrom = parseDateOnly(req.query.scheduledStartFrom);
      const scheduledStartTo = parseDateOnly(req.query.scheduledStartTo);
      if (scheduledStartFrom === null || scheduledStartTo === null) {
        return res.status(400).json({ message: "Invalid scheduled start date filter" });
      }
      if (scheduledStartFrom && scheduledStartTo && scheduledStartFrom > scheduledStartTo) {
        return res.status(400).json({ message: "Scheduled start date range is reversed" });
      }
      const scheduledStartToExclusive = scheduledStartTo
        ? new Date(scheduledStartTo.getTime() + 86400000)
        : undefined;
      const cursorPaging = req.query.cursorPaging === "true";
      const cursorChangeNumber = req.query.cursorChangeNumber;
      if (cursorChangeNumber !== undefined && (
        !cursorPaging
        || typeof cursorChangeNumber !== "string"
        || !cursorChangeNumber
      )) {
        return res.status(400).json({ message: "Invalid change report cursor" });
      }
      const startOfMonth = new Date();
      startOfMonth.setDate(1);
      startOfMonth.setHours(0, 0, 0, 0);
      if (req.query.exportSnapshot === "true" && req.query.exportChangeIds !== undefined) {
        return res.status(400).json({ message: "Invalid change report export request" });
      }
      if (req.query.exportSnapshot === "true") {
        const changeIds = await storage.getChangeReportMatchingIds({
          search, searchType: true, type, status, risk, scheduledStartFrom, scheduledStartToExclusive,
        });
        return res.json({ changeIds });
      }
      if (req.query.exportChangeIds !== undefined) {
        if (
          !cursorPaging
          || typeof req.query.exportChangeIds !== "string"
          || !req.query.exportChangeIds
        ) {
          return res.status(400).json({ message: "Invalid change report export batch" });
        }
        const changeIds = req.query.exportChangeIds.split(",");
        if (
          changeIds.length > 100
          || changeIds.some(id => !id || id.length > 128)
          || new Set(changeIds).size !== changeIds.length
        ) {
          return res.status(400).json({ message: "Invalid change report export batch" });
        }
        const [result, summary] = await Promise.all([
          storage.getChangeReportPage({
            page: 1, pageSize: changeIds.length, cursorPaging: true, changeIds,
          }),
          storage.getChangeReportSummary(startOfMonth),
        ]);
        const impactSummaries = await getChangeImpactSummaries(result.changes.map(change => change.id));
        return res.json({
          ...result,
          total: changeIds.length,
          changes: result.changes.map(change => ({ ...change, impactSummary: impactSummaries.get(change.id) })),
          page,
          pageSize: changeIds.length,
          summary,
        });
      }
      const [result, summary] = await Promise.all([
        storage.getChangeReportPage({
          page, pageSize, search, searchType: true, type, status, risk, cursorPaging,
          scheduledStartFrom,
          scheduledStartToExclusive,
          cursorChangeNumber: typeof cursorChangeNumber === "string" ? cursorChangeNumber : undefined,
        }),
        storage.getChangeReportSummary(startOfMonth),
      ]);
      const impactSummaries = await getChangeImpactSummaries(result.changes.map(change => change.id));
      res.json({
        ...result,
        changes: result.changes.map(change => ({ ...change, impactSummary: impactSummaries.get(change.id) })),
        page,
        pageSize,
        summary,
      });
    }
    catch (error) { respondWithApiError(res, error, "Failed to fetch change report"); }
  });

  // ── ITSM Sample Data Seed ────────────────────────────────────────────────────
  app.post("/api/system/seed-itsm", requireAuth, requirePermission("system_admin"), async (req, res) => {
    try {
      const users = await storage.getUsers();
      if (users.length === 0) return res.status(400).json({ message: "No users found — seed base data first" });

      const adminUser = users[0];
      const secondUser = users[1] || adminUser;
      const thirdUser = users[2] || adminUser;

      // ── Service Catalog Items ───────────────────────────────────────────────
      const catalogData = [
        { name: "New Laptop Request", description: "Request a new laptop for a new hire or replacement unit", category: "hardware", icon: "💻", fulfillmentTeam: "IT Hardware", slaHours: 72, approvalRequired: true, isActive: true, displayOrder: 1 },
        { name: "Software License Request", description: "Request a new software license or additional seat for existing software", category: "software", icon: "📦", fulfillmentTeam: "IT Software", slaHours: 48, approvalRequired: true, isActive: true, displayOrder: 2 },
        { name: "VPN Access", description: "Request VPN access for remote work connectivity", category: "access", icon: "🔐", fulfillmentTeam: "IT Security", slaHours: 24, approvalRequired: false, isActive: true, displayOrder: 3 },
        { name: "Password Reset", description: "Reset your account password or unlock your account", category: "access", icon: "🔑", fulfillmentTeam: "IT Helpdesk", slaHours: 4, approvalRequired: false, isActive: true, displayOrder: 4 },
        { name: "New User Onboarding", description: "Set up all accounts, hardware, and access for a new employee", category: "access", icon: "👤", fulfillmentTeam: "IT Helpdesk", slaHours: 48, approvalRequired: true, isActive: true, displayOrder: 5 },
        { name: "Monitor / Peripheral Request", description: "Request an additional or replacement monitor, keyboard, or mouse", category: "hardware", icon: "🖥️", fulfillmentTeam: "IT Hardware", slaHours: 48, approvalRequired: false, isActive: true, displayOrder: 6 },
        { name: "Meeting Room AV Support", description: "Request AV setup or troubleshooting for a meeting room", category: "other", icon: "📽️", fulfillmentTeam: "IT Facilities", slaHours: 8, approvalRequired: false, isActive: true, displayOrder: 7 },
        { name: "Mobile Device Enrollment", description: "Enroll a corporate mobile device in MDM", category: "hardware", icon: "📱", fulfillmentTeam: "IT Security", slaHours: 24, approvalRequired: true, isActive: true, displayOrder: 8 },
      ];
      const createdCatalogItems: any[] = [];
      for (const item of catalogData) {
        createdCatalogItems.push(await storage.createCatalogItem(item));
      }

      // ── KB Articles ─────────────────────────────────────────────────────────
      const kbData = [
        {
          title: "How to Connect to VPN",
          content: "## Connecting to the Corporate VPN\n\n### Prerequisites\n- VPN client installed (GlobalProtect)\n- Active corporate credentials\n\n### Steps\n1. Open GlobalProtect from your system tray\n2. Enter the portal address: `vpn.company.com`\n3. Sign in with your corporate credentials\n4. Select the appropriate gateway\n5. Click Connect\n\n### Troubleshooting\n- If connection fails, try disconnecting and reconnecting\n- Ensure your account is not locked\n- Contact IT if issues persist",
          category: "Network", tags: "vpn,remote,connectivity", status: "published", authorId: adminUser.id,
        },
        {
          title: "Password Reset Procedure",
          content: "## Resetting Your Password\n\n### Self-Service Reset\n1. Go to `https://passwordreset.company.com`\n2. Enter your username\n3. Follow the verification steps (email or phone)\n4. Set a new password meeting the requirements\n\n### Password Requirements\n- Minimum 12 characters\n- At least 1 uppercase, 1 lowercase, 1 number, 1 special character\n- Cannot reuse last 5 passwords\n\n### Helpdesk Reset\nIf self-service fails, raise a ticket via the Service Catalog.",
          category: "Access Management", tags: "password,account,access", status: "published", authorId: adminUser.id,
        },
        {
          title: "Setting Up Multi-Factor Authentication (MFA)",
          content: "## Enable MFA for Your Account\n\n### Supported MFA Methods\n- Microsoft Authenticator (preferred)\n- SMS one-time passcode\n- Hardware token (issued on request)\n\n### Setup Steps\n1. Log in to the self-service portal at `https://account.company.com`\n2. Navigate to **Security → MFA**\n3. Click **Add authentication method**\n4. Follow the on-screen instructions\n\n### Troubleshooting\n- Lost your phone? Contact IT Security to reset MFA\n- Time-sync issues? Ensure your phone clock is automatic",
          category: "Security", tags: "mfa,2fa,security,authentication", status: "published", authorId: adminUser.id,
        },
        {
          title: "Laptop Troubleshooting: Blue Screen of Death (BSOD)",
          content: "## BSOD Troubleshooting Guide\n\n### Immediate Steps\n1. Note the error code displayed (e.g., `KERNEL_SECURITY_CHECK_FAILURE`)\n2. Allow Windows to restart automatically\n3. Check if the issue recurs\n\n### Common Causes & Fixes\n| Cause | Fix |\n|---|---|\n| Driver issue | Roll back recent driver updates |\n| RAM failure | Run Windows Memory Diagnostic |\n| Disk error | Run `chkdsk /f /r` in elevated CMD |\n| Overheating | Clean vents, check thermal paste |\n\n### Escalation\nIf BSODs persist more than 3 times in a week, raise an incident ticket with the stop code and a description.",
          category: "Hardware", tags: "bsod,bluescreen,crash,windows", status: "published", authorId: adminUser.id,
        },
        {
          title: "Wi-Fi Connectivity Issues",
          content: "## Resolving Wi-Fi Issues\n\n### Quick Checks\n1. Is your Wi-Fi adapter enabled? (`Fn + F2` on most laptops)\n2. Are you connecting to the correct SSID (`CORP-WiFi-5G`)\n3. Try forgetting and reconnecting to the network\n\n### Steps\n1. Open **Settings → Network & Internet → Wi-Fi**\n2. Click **Manage known networks**\n3. Remove the corporate SSID\n4. Reconnect and enter credentials\n\n### Still Not Working?\nCheck if colleagues in the same area are affected (possible access point outage) and raise an incident ticket.",
          category: "Network", tags: "wifi,wireless,connectivity,network", status: "published", authorId: adminUser.id,
        },
        {
          title: "Requesting Software via Service Catalog",
          content: "## How to Request Software\n\n1. Navigate to **Service Catalog** in the ITSM portal\n2. Find the **Software License Request** item\n3. Click **Request Service**\n4. Fill in the software name, version, and business justification\n5. Submit — your manager will receive an approval request\n\n### Approval Timeline\nApprovals typically take 1–2 business days. You will be notified by email.",
          category: "Software", tags: "software,license,catalog,request", status: "published", authorId: adminUser.id,
        },
        {
          title: "Email Not Syncing on Mobile Device",
          content: "## Fix Email Sync Issues on Mobile\n\n### Android\n1. Go to **Settings → Accounts → Work Account**\n2. Tap your email account and select **Sync now**\n3. If prompted, re-enter your password\n\n### iOS\n1. Go to **Settings → Mail → Accounts**\n2. Tap your Exchange account\n3. Toggle **Mail** off and back on\n\n### If Still Not Working\n- Check that your account is not locked (try logging in via web browser)\n- Ensure MFA is configured for mobile\n- Raise a service request if you need device re-enrollment",
          category: "Software", tags: "email,mobile,exchange,sync", status: "published", authorId: adminUser.id,
        },
        {
          title: "DRAFT: Printer Setup Guide",
          content: "## Adding a Network Printer\n\n*This article is under review.*\n\n### Steps\n1. Go to **Settings → Printers & Scanners**\n2. Click **Add a printer or scanner**\n3. Select the printer from the list or enter the IP address manually\n\n*Full guide including driver download links to be added.*",
          category: "Hardware", tags: "printer,setup,network", status: "draft", authorId: adminUser.id,
        },
        {
          title: "Data Backup and Recovery Policy",
          content: "## Backup Policy Summary\n\n### What is Backed Up\n- All data stored on corporate OneDrive (continuous sync)\n- File server shares (nightly snapshot, 30-day retention)\n- Email (180-day retention, managed by IT)\n\n### What is NOT Backed Up\n- Local `C:\\` drive data not in OneDrive\n- Personal USB drives\n\n### Recovery Requests\nFor file recovery, raise an incident ticket with:\n- File/folder path\n- Approximate date of last good version\n- Business justification if urgency is high",
          category: "Data Management", tags: "backup,recovery,data,policy", status: "published", authorId: adminUser.id,
        },
        {
          title: "Understanding SLA Priorities",
          content: "## IT Support Priority Levels\n\n| Priority | Response Time | Resolution Time | Examples |\n|---|---|---|---|\n| Critical | 15 min | 4 hours | Complete outage, security breach |\n| High | 1 hour | 8 hours | Major function unavailable |\n| Medium | 4 hours | 24 hours | Minor functionality impacted |\n| Low | 8 hours | 72 hours | Cosmetic issues, requests |\n\n### How Priority is Set\nPriority is determined from **Impact × Urgency** at ticket creation. Agents may adjust after triage.",
          category: "Process", tags: "sla,priority,process,support", status: "published", authorId: adminUser.id,
        },
      ];
      for (const article of kbData) {
        await storage.createKbArticle(article as any);
      }

      // ── Tickets (Incidents + Service Requests) ──────────────────────────────
      const now = new Date();
      const daysAgo = (d: number) => new Date(now.getTime() - d * 86400000);

      const ticketInserts = [
        { title: "Cannot connect to VPN from home", description: "User reports inability to connect to the corporate VPN since yesterday morning. GlobalProtect shows 'gateway unreachable'.", type: "incident", category: "Network", impact: "medium", urgency: "high", requesterId: secondUser.id, assignedToId: adminUser.id, status: "in_progress" },
        { title: "Email client crashing on startup", description: "Outlook crashes immediately after the splash screen on Windows 11. Issue started after a Windows Update last Tuesday.", type: "incident", category: "Software", impact: "medium", urgency: "medium", requesterId: thirdUser.id, assignedToId: adminUser.id, status: "open" },
        { title: "Laptop screen flickering intermittently", description: "Screen flickers every 5–10 minutes, particularly when running on battery. Has been happening for 2 weeks.", type: "incident", category: "Hardware", impact: "low", urgency: "low", requesterId: secondUser.id, status: "open" },
        { title: "Cannot access shared network drive", description: "User cannot map \\\\FILESERVER\\Finance. Getting 'Access Denied' error. Was working before password change.", type: "incident", category: "Access Management", impact: "high", urgency: "high", requesterId: thirdUser.id, assignedToId: secondUser.id, status: "resolved" },
        { title: "Company-wide email service outage", description: "Exchange Online showing 503 errors for all users. Microsoft 365 admin portal shows 'Service Degraded'. All email affected.", type: "incident", category: "Network", impact: "high", urgency: "high", requesterId: adminUser.id, assignedToId: adminUser.id, status: "resolved" },
        { title: "Printer not found on network", description: "Floor 3 shared printer is no longer visible on the network. Affects 12 users.", type: "incident", category: "Hardware", impact: "medium", urgency: "medium", requesterId: secondUser.id, assignedToId: adminUser.id, status: "open" },
        { title: "User account locked after too many failed attempts", description: "Account locked following 5 failed login attempts this morning. User confirms they forgot their new password.", type: "incident", category: "Access Management", impact: "low", urgency: "high", requesterId: thirdUser.id, assignedToId: secondUser.id, status: "resolved" },
        { title: "BSOD: DRIVER_IRQL_NOT_LESS_OR_EQUAL", description: "Laptop crashing with blue screen 2–3 times daily. Stop code: DRIVER_IRQL_NOT_LESS_OR_EQUAL. Appears after docking station connection.", type: "incident", category: "Hardware", impact: "high", urgency: "high", requesterId: secondUser.id, assignedToId: adminUser.id, status: "in_progress" },
        { title: "Request new laptop for onboarding — Sarah Chen", description: "New hire Sarah Chen joining the Finance team on 2026-08-01. Requires standard Finance laptop build.", type: "service_request", category: "Hardware", impact: "low", urgency: "medium", requesterId: adminUser.id, catalogItemId: createdCatalogItems[0]?.id, status: "open" },
        { title: "Adobe Creative Cloud license needed", description: "Marketing team requires 3 additional Adobe CC licenses for new designers joining next month.", type: "service_request", category: "Software", impact: "low", urgency: "medium", requesterId: thirdUser.id, status: "open" },
        { title: "VPN access for remote contractor — James Liu", description: "New contractor James Liu requires VPN access for a 3-month engagement starting 2026-08-05.", type: "service_request", category: "Access Management", impact: "low", urgency: "low", requesterId: adminUser.id, status: "resolved" },
        { title: "Wi-Fi drops every 30 minutes in Building B", description: "Multiple users in Building B report Wi-Fi disconnecting roughly every 30 minutes. Reconnects automatically but interrupts calls.", type: "incident", category: "Network", impact: "medium", urgency: "medium", requesterId: secondUser.id, assignedToId: adminUser.id, status: "in_progress" },
      ];

      const createdTickets: any[] = [];
      for (const t of ticketInserts) {
        const ticket = await storage.createTicket(t as any);
        createdTickets.push(ticket);
      }

      // Mark a few as resolved with timestamps by updating them
      const resolvedIds = [createdTickets[3]?.id, createdTickets[4]?.id, createdTickets[6]?.id, createdTickets[10]?.id].filter(Boolean);
      for (const id of resolvedIds) {
        await storage.updateTicket(id, { status: "resolved" });
      }

      // ── Problems ─────────────────────────────────────────────────────────────
      const problemData = [
        {
          title: "Recurring VPN gateway unreachable errors",
          description: "Multiple users across different locations intermittently report VPN gateway unreachable errors. Issue has been occurring for 3 weeks. Not consistently reproducible.",
          status: "investigating", priority: "high", category: "Network",
          workaround: "Users can switch to the backup gateway (vpn2.company.com) as a temporary workaround.",
          assignedToId: adminUser.id, createdById: adminUser.id,
        },
        {
          title: "Microsoft Exchange Online periodic slowdowns",
          description: "Email delivery delays of 5–15 minutes affect 20–30% of users during peak hours (09:00–10:30 and 14:00–15:30). Correlates with Microsoft 365 service health advisories.",
          status: "known_error", priority: "high", category: "Software",
          workaround: "Users can access Outlook on the Web (OWA) which appears unaffected. No fix available until Microsoft resolves the upstream issue.",
          rootCause: "Microsoft Exchange Online throttling policies triggered by high-volume mail flow patterns from marketing automation tools.",
          assignedToId: adminUser.id, createdById: adminUser.id,
        },
        {
          title: "Docking station driver conflict causing BSODs",
          description: "A subset of users with Lenovo ThinkPad laptops connected to the USB-C docking station experience BSODs. The stop code DRIVER_IRQL_NOT_LESS_OR_EQUAL points to a specific NIC driver conflict.",
          status: "investigating", priority: "critical", category: "Hardware",
          workaround: "Users can connect peripherals directly to the laptop and avoid the docking station until resolved.",
          assignedToId: adminUser.id, createdById: adminUser.id,
        },
        {
          title: "Network drive access lost after password change",
          description: "Users consistently lose access to mapped network drives immediately after a password change. They must manually disconnect and remap drives.",
          status: "resolved", priority: "medium", category: "Access Management",
          rootCause: "Windows credential caching does not automatically update stored SMB credentials when domain password changes.",
          workaround: "Run `net use * /delete` then remap drives after a password change.",
          resolution: "GPO deployed to force credential refresh on password change events. Verified in UAT. Deployed to production 2026-07-10.",
          assignedToId: secondUser.id, createdById: adminUser.id,
        },
      ];

      const createdProblems: any[] = [];
      for (const p of problemData) {
        createdProblems.push(await storage.createProblem(p as any));
      }

      // Link incidents to problems
      const linkMap: Array<[number, number[]]> = [
        [0, [0, 11]],   // VPN problem ← VPN ticket, Wi-Fi ticket
        [1, [1, 4]],    // Exchange problem ← Email crash, Email outage
        [2, [7]],       // BSOD problem ← BSOD ticket
        [3, [3, 6]],    // Network drive problem ← network drive ticket, account locked
      ];
      for (const [pIdx, tIdxs] of linkMap) {
        const problem = createdProblems[pIdx];
        if (!problem) continue;
        for (const tIdx of tIdxs) {
          const ticket = createdTickets[tIdx];
          if (!ticket) continue;
          try { await storage.linkIncidentToProblem(problem.id, ticket.id); } catch (e) { console.error("link error", e); }
        }
      }

      // ── Changes ────────────────────────────────────────────────────────────
      const changeData = [
        {
          title: "VPN Gateway Firmware Upgrade to v8.1.4",
          description: "Upgrade GlobalProtect gateway firmware from v8.0.12 to v8.1.4 to address known stability issues and CVE-2026-1234.",
          type: "normal", status: "approved", priority: "high", risk: "medium",
          impact: "All remote users will lose VPN connectivity for approximately 20 minutes during the maintenance window.",
          implementationPlan: "1. Schedule maintenance window (Saturday 02:00–04:00)\n2. Take configuration backup\n3. Download firmware to staging server\n4. Apply firmware update\n5. Verify gateway health\n6. Send all-clear notification",
          rollbackPlan: "Restore previous firmware from configuration backup. Estimated rollback time: 15 minutes.",
          testPlan: "Test VPN connectivity from 5 geographically distinct locations. Verify MFA still works.",
          scheduledStart: new Date(now.getTime() + 3 * 86400000),
          scheduledEnd: new Date(now.getTime() + 3 * 86400000 + 7200000),
          requestedById: adminUser.id, assignedToId: adminUser.id,
        },
        {
          title: "Deploy Windows 11 24H2 Update via WSUS",
          description: "Phased deployment of Windows 11 24H2 feature update across all managed endpoints. Deployment in 3 waves over 4 weeks.",
          type: "normal", status: "in_progress", priority: "medium", risk: "medium",
          impact: "Endpoints will restart once during deployment. Wave 1 (IT dept, 25 devices) complete. Wave 2 in progress.",
          implementationPlan: "Wave 1: IT Dept (Week 1) ✓\nWave 2: Finance & HR (Week 2–3, in progress)\nWave 3: All remaining (Week 4)",
          rollbackPlan: "Use WSUS to pause deployment and roll back via Windows RE for affected devices.",
          testPlan: "Pilot 5 devices in IT, validate LOB apps, get sign-off from app owners.",
          scheduledStart: daysAgo(7),
          scheduledEnd: new Date(now.getTime() + 21 * 86400000),
          requestedById: adminUser.id, assignedToId: secondUser.id,
        },
        {
          title: "Enable Conditional Access Policy for Legacy Auth Block",
          description: "Configure Azure AD Conditional Access to block legacy authentication protocols (SMTP AUTH, POP3, IMAP). This is required for the security baseline audit.",
          type: "normal", status: "submitted", priority: "high", risk: "high",
          impact: "Any applications using basic authentication will stop working. Legacy email clients may be affected.",
          implementationPlan: "1. Run 30-day sign-in log analysis to identify legacy auth usage\n2. Notify affected teams\n3. Enable policy in Report-Only mode for 2 weeks\n4. Review impact report\n5. Enable enforcement mode",
          rollbackPlan: "Disable the Conditional Access policy in Azure AD portal (immediate effect).",
          testPlan: "Test with a non-critical service account using legacy auth to confirm block behaviour.",
          scheduledStart: new Date(now.getTime() + 14 * 86400000),
          scheduledEnd: new Date(now.getTime() + 45 * 86400000),
          requestedById: adminUser.id, assignedToId: adminUser.id,
        },
        {
          title: "Emergency: Patch CVE-2026-4455 (PrintSpooler RCE)",
          description: "Critical PrintSpooler RCE vulnerability actively exploited in the wild. Microsoft has released an out-of-band patch. Emergency change to deploy patch within 24 hours.",
          type: "emergency", status: "completed", priority: "critical", risk: "low",
          impact: "Print Spooler service will restart on all endpoints. Active print jobs will be cancelled.",
          implementationPlan: "Deploy via WSUS expedited approval. Force update via GPO with 2-hour deadline.",
          rollbackPlan: "Uninstall patch via WSUS if critical business application breakage reported.",
          testPlan: "Verify patch installed, verify printing still works on 3 test machines.",
          scheduledStart: daysAgo(5),
          scheduledEnd: daysAgo(4),
          requestedById: adminUser.id, assignedToId: adminUser.id,
        },
        {
          title: "Migrate File Server to SharePoint Online",
          description: "Migrate 2TB of data from on-premises file server (\\\\FILESERVER\\Shared) to SharePoint Online document libraries. Part of the cloud-first strategy initiative.",
          type: "normal", status: "draft", priority: "medium", risk: "high",
          impact: "Users will need to update bookmarks and mapped drives. Access permissions will be reviewed and re-applied.",
          implementationPlan: "Phase 1: Discovery & assessment\nPhase 2: Pilot migration (Finance team)\nPhase 3: Full migration\nPhase 4: Decommission file server",
          rollbackPlan: "Keep on-premises file server running in parallel for 90 days post-migration.",
          testPlan: "Validate file integrity via checksum, test access for all user groups.",
          requestedById: secondUser.id, assignedToId: adminUser.id,
        },
        {
          title: "Deploy Lenovo Docking Station Driver Update",
          description: "Deploy updated Lenovo Universal Dock driver (v1.1.56.0) via SCCM to resolve BSOD issues on ThinkPad laptops.",
          type: "standard", status: "approved", priority: "critical", risk: "low",
          impact: "Docking station will briefly disconnect and reconnect during driver update. Estimated 2-minute disruption per device.",
          implementationPlan: "1. Package driver update in SCCM\n2. Target ThinkPad collection\n3. Deploy as Available initially for self-service\n4. Force deploy after 48 hours",
          rollbackPlan: "Redeploy previous driver package via SCCM.",
          testPlan: "Test on 3 affected ThinkPads. Verify no BSOD for 24-hour monitoring period.",
          scheduledStart: new Date(now.getTime() + 1 * 86400000),
          scheduledEnd: new Date(now.getTime() + 3 * 86400000),
          requestedById: adminUser.id, assignedToId: adminUser.id,
        },
      ];

      const createdChanges: any[] = [];
      for (const c of changeData) {
        createdChanges.push(await storage.createChange(c as any));
      }

      // Add approvals to relevant changes
      const approvalMap: Array<[number, Array<{ approverId: string; decision?: string; comments?: string }>]> = [
        [0, [{ approverId: adminUser.id, decision: "approved", comments: "Risk assessment reviewed and accepted. Maintenance window confirmed with stakeholders." }, { approverId: secondUser.id, decision: "approved", comments: "IT Security sign-off given." }]],
        [2, [{ approverId: adminUser.id }, { approverId: secondUser.id }]],  // pending
        [5, [{ approverId: adminUser.id, decision: "approved", comments: "Critical fix — fast-tracked. Standard approval waived per emergency change procedure." }]],
      ];
      for (const [cIdx, approvals] of approvalMap) {
        const change = createdChanges[cIdx];
        if (!change) continue;
        for (const a of approvals) {
          await storage.createChangeApproval({
            changeId: change.id,
            approverId: a.approverId,
            decision: a.decision || null,
            comments: a.comments || null,
          } as any);
        }
      }

      res.json({
        message: "ITSM sample data created successfully",
        summary: {
          catalogItems: createdCatalogItems.length,
          kbArticles: kbData.length,
          tickets: createdTickets.length,
          problems: createdProblems.length,
          changes: createdChanges.length,
        },
      });
    } catch (error) {
      console.error("Error seeding ITSM data:", error);
      respondWithApiError(res, error, "Failed to seed ITSM data");
    }
  });

  // ── KPI Dashboard ────────────────────────────────────────────────────────
  app.get("/api/kpis", requireAuth, async (req, res) => {
    try {
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const [tickets, assets, problems, changeSummary] = await Promise.all([
        storage.getTickets(),
        await isFeatureEnabled("asset_management") ? storage.getAssets() : [],
        storage.getProblems(),
        storage.getChangeReportSummary(startOfMonth),
      ]);

      const in30 = new Date(now.getTime() + 30 * 86400000);
      const in60 = new Date(now.getTime() + 60 * 86400000);
      const in90 = new Date(now.getTime() + 90 * 86400000);

      // ── Tickets ─────────────────────────────────────────────────────
      const openTix = tickets.filter(t => t.status === "open" || t.status === "in_progress");
      const overdueTix = tickets.filter(t =>
        t.dueDate && new Date(t.dueDate) < now &&
        !["resolved","closed","cancelled"].includes(t.status)
      );
      const slaBreachedTix = tickets.filter(t =>
        t.slaResolutionDueAt &&
        new Date(t.slaResolutionDueAt as any) < now &&
        !["resolved","closed","cancelled"].includes(t.status)
      );
      const resolvedTix = tickets.filter(t => t.resolvedAt && t.createdAt);
      const avgResolutionHours = resolvedTix.length > 0
        ? resolvedTix.reduce((s, t) => {
            return s + (new Date(t.resolvedAt as any).getTime() - new Date(t.createdAt as any).getTime()) / 3600000;
          }, 0) / resolvedTix.length
        : null;
      const fcrRate = resolvedTix.length > 0
        ? Math.round((resolvedTix.filter(t => (t as any).reopenCount === 0).length / resolvedTix.length) * 100)
        : null;
      const slaEligible = resolvedTix.filter(t => (t as any).slaResolutionDueAt);
      const slaCompliance = slaEligible.length > 0
        ? Math.round((slaEligible.filter(t =>
            new Date(t.resolvedAt as any) <= new Date((t as any).slaResolutionDueAt)
          ).length / slaEligible.length) * 100)
        : null;

      // This week vs last week ticket counts
      const weekAgo = new Date(now.getTime() - 7 * 86400000);
      const twoWeeksAgo = new Date(now.getTime() - 14 * 86400000);
      const ticketsThisWeek = tickets.filter(t => new Date(t.createdAt as any) >= weekAgo).length;
      const ticketsLastWeek = tickets.filter(t => {
        const d = new Date(t.createdAt as any);
        return d >= twoWeeksAgo && d < weekAgo;
      }).length;

      // ── Assets ─────────────────────────────────────────────────────
      const totalA = assets.length;
      const assignedA = assets.filter(a => a.status === "assigned").length;
      const utilization = totalA > 0 ? Math.round((assignedA / totalA) * 100) : 0;
      const expW30 = assets.filter(a => a.warrantyExpiry && new Date(a.warrantyExpiry) >= now && new Date(a.warrantyExpiry) <= in30).length;
      const expW60 = assets.filter(a => a.warrantyExpiry && new Date(a.warrantyExpiry) >= now && new Date(a.warrantyExpiry) <= in60).length;
      const expW90 = assets.filter(a => a.warrantyExpiry && new Date(a.warrantyExpiry) >= now && new Date(a.warrantyExpiry) <= in90).length;

      // ── Problems ─────────────────────────────────────────────────
      const openProb = problems.filter(p => ["open","investigating","known_error"].includes(p.status));
      const avgAgeOpenDays = openProb.length > 0
        ? Math.round(openProb.reduce((s, p) => s + (now.getTime() - new Date(p.createdAt as any).getTime()) / 86400000, 0) / openProb.length)
        : null;
      const repeatProblems = problems.filter(p => ((p as any).linkedTickets?.length ?? 0) > 1).length;
      const resolvedProbThisMonth = problems.filter(p => p.resolvedAt && new Date(p.resolvedAt) >= startOfMonth).length;

      // ── Changes ──────────────────────────────────────────────────
      const closedChanges = changeSummary.completed + changeSummary.failed + changeSummary.cancelled;
      const successRate = closedChanges > 0
        ? Math.round((changeSummary.completed / closedChanges) * 100)
        : null;
      const emergencyPct = changeSummary.total > 0
        ? Math.round((changeSummary.emergency / changeSummary.total) * 100)
        : null;

      res.json({
        tickets: {
          open: openTix.length,
          overdue: overdueTix.length,
          slaBreached: slaBreachedTix.length,
          avgResolutionHours,
          fcrRate,
          slaCompliance,
          totalResolved: resolvedTix.length,
          thisWeek: ticketsThisWeek,
          lastWeek: ticketsLastWeek,
          byPriority: {
            critical: tickets.filter(t => t.priority === "critical").length,
            high: tickets.filter(t => t.priority === "high").length,
            medium: tickets.filter(t => t.priority === "medium").length,
            low: tickets.filter(t => t.priority === "low").length,
          },
        },
        assets: {
          total: totalA,
          utilization,
          inMaintenance: assets.filter(a => a.status === "maintenance").length,
          retired: assets.filter(a => a.status === "retired").length,
          expiringWarranty30: expW30,
          expiringWarranty60: expW60,
          expiringWarranty90: expW90,
          byStatus: {
            assigned: assignedA,
            available: assets.filter(a => a.status === "available").length,
            maintenance: assets.filter(a => a.status === "maintenance").length,
            retired: assets.filter(a => a.status === "retired").length,
          },
        },
        problems: {
          open: openProb.length,
          investigating: problems.filter(p => p.status === "investigating").length,
          knownErrors: problems.filter(p => p.status === "known_error").length,
          avgAgeOpenDays,
          repeatProblems,
          resolvedThisMonth: resolvedProbThisMonth,
          total: problems.length,
        },
        changes: {
          total: changeSummary.total,
          successRate,
          emergencyPct,
          pendingApprovals: changeSummary.pendingApprovals,
          thisMonth: changeSummary.thisMonth,
          failed: changeSummary.failed,
          byStatus: {
            requested: changeSummary.requested,
            approved: changeSummary.approved,
            in_progress: changeSummary.inProgress,
            completed: changeSummary.completed,
            failed: changeSummary.failed,
            cancelled: changeSummary.cancelled,
          },
        },
        generatedAt: new Date().toISOString(),
      });
    } catch (err) {
      console.error("KPI error:", err);
      respondWithApiError(res, err, "Failed to compute KPIs");
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
