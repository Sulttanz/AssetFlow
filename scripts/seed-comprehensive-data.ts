import { createHash } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { and, eq, sql } from "drizzle-orm";
import {
  assets,
  assignments,
  departments,
  employees,
  incidents,
  insertAssetSchema,
  insertAssignmentSchema,
  insertEmployeeSchema,
  insertIncidentSchema,
  insertServiceContractSchema,
  insertServiceRequestSchema,
  insertSlaPolicySchema,
  insertUserSchema,
  insertVendorSchema,
  locations,
  permissions,
  projectAssets,
  projectManagers,
  projectTeamMembers,
  projects,
  rolePermissions,
  roles,
  serviceContracts,
  serviceRequests,
  slaPolicies,
  softwareLicenseAllocations,
  userRoles,
  users,
  vendors,
} from "@shared/schema";
import { projectMutationSchema } from "@shared/project-management";
import { hashPassword } from "../server/auth";
import { db } from "../server/db";

const PREFIX = "SAMPLE-COMPREHENSIVE";
const SEED_LOCK_KEY = "sample-comprehensive-data-v1";

export const COMPREHENSIVE_SAMPLE_PREFIX = PREFIX;
type DatabaseLike = typeof db;

function stableId(label: string): string {
  const hex = createHash("sha256").update(`${PREFIX}:${label}`).digest("hex").slice(0, 32);
  const variant = ((parseInt(hex[16], 16) & 0x3) | 0x8).toString(16);
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-${variant}${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}

function isoDate(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function shiftDays(date: Date, days: number): Date {
  const shifted = new Date(date);
  shifted.setDate(shifted.getDate() + days);
  return shifted;
}

function timestampAt(date: Date, hour = 12): Date {
  const value = new Date(date);
  value.setHours(hour, 0, 0, 0);
  return value;
}

async function upsertById(tx: any, table: any, id: string, values: Record<string, unknown>) {
  const [existing] = await tx.select({ id: table.id }).from(table).where(eq(table.id, id)).limit(1);
  if (existing) {
    const [updated] = await tx.update(table).set(values).where(eq(table.id, id)).returning();
    return updated;
  }
  const [created] = await tx.insert(table).values({ id, ...values }).returning();
  return created;
}

async function ensureUserRole(tx: any, userId: string, roleId: string) {
  const [existing] = await tx.select({ id: userRoles.id }).from(userRoles)
    .where(and(eq(userRoles.userId, userId), eq(userRoles.roleId, roleId))).limit(1);
  if (!existing) {
    await tx.insert(userRoles).values({ id: stableId(`user-role:${userId}:${roleId}`), userId, roleId });
  }
}

async function ensureRolePermission(tx: any, roleId: string, permissionId: string) {
  const [existing] = await tx.select({ id: rolePermissions.id }).from(rolePermissions)
    .where(and(eq(rolePermissions.roleId, roleId), eq(rolePermissions.permissionId, permissionId))).limit(1);
  if (!existing) {
    await tx.insert(rolePermissions).values({ id: stableId(`role-permission:${roleId}:${permissionId}`), roleId, permissionId });
  }
}

const people = [
  { key: "admin", firstName: "Alex", lastName: "Morgan", title: "System Administrator", department: "IT", role: "system_admin" },
  { key: "manager", firstName: "Riley", lastName: "Chen", title: "IT Project Manager", department: "IT", role: "it_manager" },
  { key: "support-1", firstName: "Jordan", lastName: "Patel", title: "Support Engineer", department: "IT", role: "it_agent" },
  { key: "support-2", firstName: "Casey", lastName: "Reed", title: "Network Engineer", department: "IT", role: "it_agent" },
  { key: "finance", firstName: "Taylor", lastName: "Brooks", title: "Financial Analyst", department: "Finance", role: "end_user" },
  { key: "hr", firstName: "Avery", lastName: "James", title: "HR Business Partner", department: "HR", role: "end_user" },
  { key: "operations", firstName: "Morgan", lastName: "Diaz", title: "Operations Lead", department: "Operations", role: "end_user" },
  { key: "executive", firstName: "Drew", lastName: "Wilson", title: "Executive Sponsor", department: "Executive", role: "cab_member" },
] as const;

const projectSpecs = [
  { key: "identity-refresh", title: "Identity Platform Refresh", status: "Planning", health: "On Track", budget: 185000 },
  { key: "cloud-migration", title: "Finance Cloud Migration", status: "Active", health: "At Risk", budget: 420000 },
  { key: "network-upgrade", title: "Campus Network Upgrade", status: "On Hold", health: "Delayed", budget: 132000 },
  { key: "endpoint-rollout", title: "Endpoint Protection Rollout", status: "Completed", health: "On Track", budget: 96000 },
  { key: "service-modernization", title: "Service Desk Modernization", status: "Active", health: "On Track", budget: 210000 },
] as const;

const clientNames = [
  "Meridian Financial Group",
  "Northstar Health Partners",
  "Cedar Peak Logistics",
  "Bluehaven Retail Group",
] as const;

const vendorSpecs = [
  { key: "contoso", name: "Sample Contoso Systems", category: "Software Vendor", contact: "Jamie Park" },
  { key: "northwind", name: "Sample Northwind Networks", category: "Hardware Supplier", contact: "Sam Rivera" },
  { key: "cloudline", name: "Sample Cloudline Services", category: "Cloud Provider", contact: "Lee Morgan" },
] as const;

const priorityInfo = [
  { code: "P1", name: "Sample SLA P1 Critical", priority: "critical", responseHours: 0.25, resolutionHours: 4 },
  { code: "P2", name: "Sample SLA P2 High", priority: "high", responseHours: 1, resolutionHours: 8 },
  { code: "P3", name: "Sample SLA P3 Medium", priority: "medium", responseHours: 4, resolutionHours: 24 },
  { code: "P4", name: "Sample SLA P4 Low", priority: "low", responseHours: 8, resolutionHours: 72 },
] as const;

const incidentStatuses = ["New", "In Progress", "Pending", "Resolved", "Closed"] as const;
const requestStatuses = ["Submitted", "Approved", "Fulfilling", "Completed", "Rejected"] as const;

export type ComprehensiveSeedSummary = {
  users: number;
  employees: number;
  vendors: number;
  projects: number;
  slaPolicies: number;
  serviceContracts: number;
  incidents: number;
  serviceRequests: number;
  assets: number;
  clientReferences: Array<{ id: string; name: string }>;
};

/**
 * Upserts only records in the reserved SAMPLE-COMPREHENSIVE namespace.
 * It intentionally never truncates or deletes business data.
 */
export async function seedComprehensiveData(
  database: DatabaseLike,
  passwordHash: string,
  now = new Date(),
): Promise<ComprehensiveSeedSummary> {
  const startDate = isoDate(shiftDays(now, -45));
  const nearDate = isoDate(shiftDays(now, 15));
  const activeDate = isoDate(shiftDays(now, 365));
  const expiredDate = isoDate(shiftDays(now, -20));

  return database.transaction(async (tx: any) => {
    await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${SEED_LOCK_KEY}))`);

    const departmentRows: Record<string, string> = {};
    for (const name of ["IT", "Finance", "HR", "Operations", "Executive"]) {
      const seedName = `${PREFIX} ${name}`;
      const id = stableId(`department:${name}`);
      const [existing] = await tx.select({ id: departments.id }).from(departments).where(eq(departments.name, seedName)).limit(1);
      if (existing) {
        await tx.update(departments).set({ description: `Sample department for ${PREFIX} demo data.` }).where(eq(departments.id, existing.id));
        departmentRows[name] = existing.id;
      } else {
        const [row] = await tx.insert(departments).values({
          id, name: seedName, description: `Sample department for ${PREFIX} demo data.`,
        }).returning();
        departmentRows[name] = row.id;
      }
    }

    const locationSpecs = [
      { key: "hq", name: `${PREFIX} Headquarters`, city: "Riyadh", country: "Saudi Arabia" },
      { key: "dc", name: `${PREFIX} Data Center`, city: "Dammam", country: "Saudi Arabia" },
    ] as const;
    const locationIds: Record<string, string> = {};
    for (const spec of locationSpecs) {
      const id = stableId(`location:${spec.key}`);
      const values = { name: spec.name, city: spec.city, country: spec.country, description: "Seeded demonstration location." };
      const [existing] = await tx.select({ id: locations.id }).from(locations).where(eq(locations.id, id)).limit(1);
      if (existing) {
        await tx.update(locations).set(values).where(eq(locations.id, id));
        locationIds[spec.key] = id;
      } else {
        const [row] = await tx.insert(locations).values({ id, ...values }).returning();
        locationIds[spec.key] = row.id;
      }
    }

    const roleIds = new Map<string, string>();
    for (const roleName of ["system_admin", "it_manager", "it_agent", "end_user", "cab_member", "auditor", "asset_manager", "read_only_user"]) {
      const [existing] = await tx.select({ id: roles.id }).from(roles).where(eq(roles.name, roleName)).limit(1);
      if (existing) {
        roleIds.set(roleName, existing.id);
      } else {
        const id = stableId(`role:${roleName}`);
        const [created] = await tx.insert(roles).values({
          id, name: roleName, description: `${PREFIX} sample ${roleName} role`, isSystemRole: true,
        }).returning();
        roleIds.set(roleName, created.id);
      }
    }

    const [adminPermission] = await tx.select({ id: permissions.id }).from(permissions)
      .where(eq(permissions.name, "system_admin")).limit(1);
    let systemAdminPermissionId: string;
    if (adminPermission) {
      systemAdminPermissionId = adminPermission.id;
    } else {
      const permissionId = stableId("permission:system_admin");
      const [permission] = await tx.insert(permissions).values({
        id: permissionId, name: "system_admin", description: "System administration access",
        resource: "system", action: "manage",
      }).returning();
      systemAdminPermissionId = permission.id;
    }
    await ensureRolePermission(tx, roleIds.get("admin")!, systemAdminPermissionId);

    const userIds = new Map<string, string>();
    const employeeIds = new Map<string, string>();
    for (let index = 0; index < people.length; index++) {
      const person = people[index];
      const userId = stableId(`user:${person.key}`);
      const employeeId = stableId(`employee:${person.key}`);
      const username = `${PREFIX.toLowerCase()}-${person.key}`;
      const email = `${PREFIX.toLowerCase()}-${person.key}@example.test`;
      const user = insertUserSchema.parse({
        id: userId, username, email, password: passwordHash,
        firstName: person.firstName, lastName: person.lastName, isActive: true,
        createdBy: index === 0 ? null : stableId("user:admin"),
      });
      await upsertById(tx, users, userId, user);
      const employee = insertEmployeeSchema.parse({
        id: employeeId, employeeId: `${PREFIX}-${String(index + 1).padStart(3, "0")}`,
        firstName: person.firstName, lastName: person.lastName, email,
        status: "active", position: person.title, department: `${PREFIX} ${person.department}`,
        departmentId: departmentRows[person.department],
        locationId: index === 2 || index === 3 ? locationIds.dc : locationIds.hq,
        startDate: isoDate(shiftDays(now, -500 - index * 31)),
        managerId: person.key === "manager" ? undefined : stableId("employee:manager"),
      });
      await upsertById(tx, employees, employeeId, employee);
      await ensureUserRole(tx, userId, roleIds.get(person.role)!);
      userIds.set(person.key, userId);
      employeeIds.set(person.key, employeeId);
    }

    const vendorIds = new Map<string, string>();
    for (const spec of vendorSpecs) {
      const id = stableId(`vendor:${spec.key}`);
      const vendor = insertVendorSchema.parse({
        name: spec.name, code: `${PREFIX}-${spec.key.toUpperCase()}`,
        category: spec.category, primaryContactName: spec.contact,
        primaryContactEmail: `${spec.key}@vendors.example.test`, status: "active",
        website: `https://${spec.key}.example.test`, country: "Saudi Arabia",
        preferredVendor: spec.key === "cloudline",
      });
      const [existing] = await tx.select({ id: vendors.id }).from(vendors).where(eq(vendors.name, spec.name)).limit(1);
      if (existing) {
        await tx.update(vendors).set(vendor).where(eq(vendors.id, existing.id));
        vendorIds.set(spec.key, existing.id);
      } else {
        const [created] = await tx.insert(vendors).values({ id, ...vendor }).returning();
        vendorIds.set(spec.key, created.id);
      }
    }

    const slaIds = new Map<string, string>();
    for (const item of priorityInfo) {
      const id = stableId(`sla:${item.code}`);
      const policyInput = insertSlaPolicySchema.parse({
        id, name: item.name, ticketType: "incident", category: null, priority: item.priority,
        responseHours: item.responseHours, resolutionHours: item.resolutionHours, isActive: true,
      });
      const [policy] = await tx.insert(slaPolicies).values({ id, ...policyInput }).onConflictDoUpdate({
        target: slaPolicies.id,
        set: { name: item.name, ticketType: "incident", priority: item.priority,
          responseHours: item.responseHours, resolutionHours: item.resolutionHours, isActive: true },
      }).returning();
      slaIds.set(item.code, policy.id);
    }

    const projectIds: string[] = [];
    const projectDates = projectSpecs.map((spec, index) => {
      const projectStart = shiftDays(now, -180 + index * 20);
      const target = spec.status === "Completed" ? shiftDays(now, -25) : shiftDays(now, 120 + index * 20);
      return { start: projectStart, target, actualEnd: spec.status === "Completed" ? shiftDays(now, -30) : null };
    });
    for (let index = 0; index < projectSpecs.length; index++) {
      const spec = projectSpecs[index];
      const id = stableId(`project:${spec.key}`);
      const projectInput = projectMutationSchema.parse({
        title: `${PREFIX} ${spec.title}`,
        description: `Sample project scenario: ${spec.title}.`,
        status: spec.status,
        healthStatus: spec.health,
        startDate: isoDate(projectDates[index].start),
        targetEndDate: isoDate(projectDates[index].target),
        actualEndDate: projectDates[index].actualEnd ? isoDate(projectDates[index].actualEnd!) : null,
        budget: spec.budget,
        actualSpend: Math.round(spec.budget * (index === 1 ? 0.82 : index === 3 ? 1 : 0.34)),
        managerIds: [userIds.get(index === 0 ? "manager" : "executive")!, userIds.get("manager")!].filter((value, i, all) => all.indexOf(value) === i),
        primaryManagerId: userIds.get("manager")!,
        teamMembers: [
          { userId: userIds.get("support-1")!, roleTitle: "Technical Lead" },
          { userId: userIds.get("support-2")!, roleTitle: "Implementation Engineer" },
        ],
        milestones: [],
        assets: [],
      });
      await tx.insert(projects).values({
        id, name: projectInput.title, title: projectInput.title, description: projectInput.description,
        status: projectInput.status, healthStatus: projectInput.healthStatus,
        startDate: timestampAt(new Date(`${projectInput.startDate}T12:00:00`)),
        targetEndDate: timestampAt(new Date(`${projectInput.targetEndDate}T12:00:00`)),
        actualEndDate: projectInput.actualEndDate ? timestampAt(new Date(`${projectInput.actualEndDate}T12:00:00`)) : null,
        budget: projectInput.budget.toFixed(2), actualSpend: projectInput.actualSpend.toFixed(2),
        createdBy: userIds.get("admin")!, isActive: true,
      }).onConflictDoUpdate({
        target: projects.id,
        set: { name: projectInput.title, title: projectInput.title, description: projectInput.description,
          status: projectInput.status, healthStatus: projectInput.healthStatus,
          startDate: timestampAt(new Date(`${projectInput.startDate}T12:00:00`)),
          targetEndDate: timestampAt(new Date(`${projectInput.targetEndDate}T12:00:00`)),
          actualEndDate: projectInput.actualEndDate ? timestampAt(new Date(`${projectInput.actualEndDate}T12:00:00`)) : null,
          budget: projectInput.budget.toFixed(2), actualSpend: projectInput.actualSpend.toFixed(2),
          updatedAt: now },
      });
      projectIds.push(id);

      const managerIds = projectInput.managerIds;
      for (let managerIndex = 0; managerIndex < managerIds.length; managerIndex++) {
        await tx.insert(projectManagers).values({
          projectId: id, userId: managerIds[managerIndex], isPrimary: managerIds[managerIndex] === projectInput.primaryManagerId,
        }).onConflictDoUpdate({
          target: [projectManagers.projectId, projectManagers.userId],
          set: { isPrimary: managerIds[managerIndex] === projectInput.primaryManagerId },
        });
      }
      for (const member of projectInput.teamMembers) {
        await tx.insert(projectTeamMembers).values({
          projectId: id, userId: member.userId, roleTitle: member.roleTitle,
        }).onConflictDoUpdate({
          target: [projectTeamMembers.projectId, projectTeamMembers.userId],
          set: { roleTitle: member.roleTitle },
        });
      }
    }

    const contractSpecs = [
      { key: "active-1", projectIndex: 0, clientIndex: 0, name: `${clientNames[0]} Support`, endDate: activeDate, status: "active" },
      { key: "active-2", projectIndex: 1, clientIndex: 1, name: `${clientNames[1]} Support`, endDate: activeDate, status: "active" },
      { key: "near-expiry", projectIndex: 2, clientIndex: 2, name: `${clientNames[2]} Support`, endDate: nearDate, status: "near_expiration" },
      { key: "expired", projectIndex: 3, clientIndex: 3, name: `${clientNames[3]} Support`, endDate: expiredDate, status: "expired" },
    ] as const;
    const contractIds = new Map<string, number>();
    for (const spec of contractSpecs) {
      const contractNumber = `${PREFIX}-CNT-${spec.key.toUpperCase()}`;
      const contractInput = insertServiceContractSchema.parse({
        contractNumber, contractName: spec.name, projectId: projectIds[spec.projectIndex],
        clientId: `${PREFIX}-CLIENT-${String(spec.clientIndex + 1).padStart(2, "0")}`,
        slaPolicyId: slaIds.get("P3"), startDate, endDate: spec.endDate, renewalNoticeDays: 60,
        status: spec.status, notes: `Sample customer: ${clientNames[spec.clientIndex]}. Customer identifiers are stored in service-contract records.`,
      });
      const [existing] = await tx.select({ id: serviceContracts.id }).from(serviceContracts)
        .where(eq(serviceContracts.contractNumber, contractNumber)).limit(1);
      if (existing) {
        await tx.update(serviceContracts).set(contractInput).where(eq(serviceContracts.id, existing.id));
        contractIds.set(spec.key, existing.id);
      } else {
        const [created] = await tx.insert(serviceContracts).values(contractInput).returning();
        contractIds.set(spec.key, created.id);
      }
    }

    const assetSpecs = [
      { key: "laptop-finance", name: "Finance Laptop 01", type: "laptop", status: "assigned", employee: "finance", department: "Finance", vendor: "northwind", project: 1 },
      { key: "laptop-hr", name: "HR Laptop 01", type: "laptop", status: "assigned", employee: "hr", department: "HR", vendor: "northwind", project: 4 },
      { key: "laptop-ops", name: "Operations Laptop 01", type: "laptop", status: "assigned", employee: "operations", department: "Operations", vendor: "northwind", project: 2 },
      { key: "laptop-agent", name: "Support Laptop 01", type: "laptop", status: "assigned", employee: "support-1", department: "IT", vendor: "northwind", project: 0 },
      { key: "server-core", name: "Core Application Server", type: "server", status: "assigned", employee: "support-2", department: "IT", vendor: "cloudline", project: 1 },
      { key: "switch-dc", name: "Data Center Switch 01", type: "network_switch", status: "maintenance", employee: null, department: "IT", vendor: "northwind", project: 2 },
      { key: "desktop-finance", name: "Finance Desktop 01", type: "desktop", status: "assigned", employee: "finance", department: "Finance", vendor: "northwind", project: 3 },
      { key: "laptop-spare", name: "Spare Laptop 01", type: "laptop", status: "available", employee: null, department: "IT", vendor: "northwind", project: 0 },
      { key: "m365-pool", name: "Microsoft 365 Business Premium Pool", type: "software", status: "available", employee: null, department: "IT", vendor: "contoso", project: 4 },
      { key: "design-pool", name: "Design Suite Subscription Pool", type: "software", status: "available", employee: null, department: "Operations", vendor: "contoso", project: 4 },
      { key: "cloud-pool", name: "Cloud Operations Tooling Pool", type: "software", status: "available", employee: null, department: "IT", vendor: "cloudline", project: 1 },
      { key: "retired-router", name: "Legacy Edge Router", type: "router", status: "retired", employee: null, department: "IT", vendor: "northwind", project: 2 },
    ] as const;
    const assetIds = new Map<string, string>();
    for (const [index, spec] of assetSpecs.entries()) {
      const id = stableId(`asset:${spec.key}`);
      const assetTag = `${PREFIX}-AST-${String(index + 1).padStart(3, "0")}`;
      const assetInput = insertAssetSchema.parse({
        id, name: `${PREFIX} ${spec.name}`, assetTag, type: spec.type, category: spec.type === "software" ? "Software" : "Infrastructure",
        serialNumber: `${PREFIX}-SN-${String(index + 1).padStart(3, "0")}`, model: `Model ${index + 1}`,
        manufacturer: spec.vendor === "contoso" ? "Sample Contoso" : spec.vendor === "cloudline" ? "Sample Cloudline" : "Sample Northwind",
        locationId: spec.key === "server-core" || spec.key === "switch-dc" ? locationIds.dc : locationIds.hq,
        departmentId: departmentRows[spec.department], primaryVendorId: vendorIds.get(spec.vendor)!,
        vendor: vendorSpecs.find(vendor => vendor.key === spec.vendor)!.name,
        purchaseDate: isoDate(shiftDays(now, -300 - index * 5)),
        warrantyStartDate: isoDate(shiftDays(now, -300 - index * 5)),
        warrantyExpiry: isoDate(shiftDays(now, index === 11 ? -10 : 180 + index)),
        purchasePrice: spec.type === "software" ? "1200.00" : "1450.00",
        currentValue: spec.type === "software" ? "1200.00" : "1100.00",
        status: spec.status, condition: spec.status === "retired" ? "poor" : "good",
        assetOwner: spec.employee ? people.find(person => person.key === spec.employee)!.firstName : null,
        assetCustodian: spec.employee ? people.find(person => person.key === spec.employee)!.firstName : null,
        purchaseOrderNumber: `${PREFIX}-PO-${String((index % 3) + 1).padStart(3, "0")}`,
        licenseType: spec.type === "software" ? "Subscription" : null,
        licenseQuantity: spec.type === "software" ? (spec.key === "m365-pool" ? 25 : 10) : null,
        usedSeats: spec.type === "software" ? (spec.key === "m365-pool" ? 3 : 1) : null,
        licenseExpiryDate: spec.type === "software" ? isoDate(shiftDays(now, 240)) : null,
        businessPurpose: `Sample asset associated with ${PREFIX}.`,
      });
      const [existing] = await tx.select({ id: assets.id }).from(assets).where(eq(assets.assetTag, assetTag)).limit(1);
      if (existing) {
        await tx.update(assets).set(assetInput).where(eq(assets.id, existing.id));
        assetIds.set(spec.key, existing.id);
      } else {
        const [created] = await tx.insert(assets).values(assetInput).returning();
        assetIds.set(spec.key, created.id);
      }
      const linkedProjectId = projectIds[spec.project];
      await tx.insert(projectAssets).values({ projectId: linkedProjectId, assetId: assetIds.get(spec.key)!, associationType: "Deployed" })
        .onConflictDoUpdate({ target: [projectAssets.projectId, projectAssets.assetId], set: { associationType: "Deployed" } });

      if (spec.employee) {
        const assignmentId = stableId(`assignment:${spec.key}`);
        const assignmentInput = insertAssignmentSchema.parse({
          assetId: assetIds.get(spec.key)!, employeeId: employeeIds.get(spec.employee)!,
          assignedDate: isoDate(shiftDays(now, -45)), returnedDate: null,
          notes: `Sample assignment ${PREFIX}.`,
        });
        await tx.insert(assignments).values({ id: assignmentId, ...assignmentInput }).onConflictDoUpdate({
          target: assignments.id,
          set: { assetId: assetIds.get(spec.key)!, employeeId: employeeIds.get(spec.employee)!, returnedDate: null },
        });
      }
    }

    const licenseAssignments = [
      { assetKey: "m365-pool", employee: "finance" },
      { assetKey: "m365-pool", employee: "hr" },
      { assetKey: "m365-pool", employee: "operations" },
      { assetKey: "design-pool", employee: "operations" },
      { assetKey: "cloud-pool", employee: "support-2" },
    ];
    for (const [index, license] of licenseAssignments.entries()) {
      const allocationId = stableId(`license-allocation:${license.assetKey}:${license.employee}`);
      await tx.insert(softwareLicenseAllocations).values({
        id: allocationId, assetId: assetIds.get(license.assetKey)!, employeeId: employeeIds.get(license.employee)!,
        allocatedAt: timestampAt(shiftDays(now, -20 - index)),
      }).onConflictDoUpdate({
        target: softwareLicenseAllocations.id,
        set: { assetId: assetIds.get(license.assetKey)!, employeeId: employeeIds.get(license.employee)! },
      });
    }

    for (const [index, priority] of ["P1", "P2", "P3", "P4"].entries()) {
      for (const [statusIndex, status] of incidentStatuses.entries()) {
        if (index * incidentStatuses.length + statusIndex >= 18) break;
        const number = index * incidentStatuses.length + statusIndex + 1;
        const requesterKey = ["finance", "hr", "operations", "executive"][number % 4];
        const projectIndex = number % 6 === 0 ? null : number % projectIds.length;
        const contractKey = projectIndex === 0 ? "active-1" : projectIndex === 1 ? "active-2" : projectIndex === 3 ? "expired" : null;
        const isExpired = contractKey === "expired";
        const contractId = contractKey ? contractIds.get(contractKey)! : null;
        const policyId = slaIds.get(priority)!;
        const createdAt = timestampAt(shiftDays(now, -number * 2), 9 + (number % 8));
        const responseDueAt = new Date(createdAt.getTime() + priorityInfo[index].responseHours * 3_600_000);
        const resolveDueAt = new Date(createdAt.getTime() + priorityInfo[index].resolutionHours * 3_600_000);
        const normalizedStatus = status;
        const terminal = normalizedStatus === "Resolved" || normalizedStatus === "Closed";
        const resolvedAt = terminal ? timestampAt(shiftDays(createdAt, 1)) : null;
        const incidentInput = insertIncidentSchema.parse({
          title: `${PREFIX}: ${["VPN connectivity issue", "Email sync failure", "Laptop performance problem", "Network access request", "Service availability alert"][number % 5]}`,
          description: `Sample ${priority} incident in ${normalizedStatus} state for dashboard and workflow demonstrations.`,
          urgency: priority === "P1" ? "high" : "medium", impact: priority === "P1" ? "high" : "medium",
          priority, status: normalizedStatus, category: ["Network", "Software", "Hardware", "Access"][number % 4],
          creatorId: userIds.get("support-1")!, requesterId: userIds.get(requesterKey)!,
          projectId: projectIndex === null ? null : projectIds[projectIndex],
          contractId: isExpired ? null : contractId,
          slaPolicyId: policyId, isWarrantyExpired: isExpired,
          assignmentGroup: number % 2 ? "Service Desk" : "Infrastructure",
          assigneeId: number % 4 === 0 ? null : userIds.get(number % 2 ? "support-1" : "support-2")!,
          assignedToId: number % 4 === 0 ? null : userIds.get(number % 2 ? "support-1" : "support-2")!,
          responseDueAt, resolveDueAt, firstRespondedAt: statusIndex > 0 ? timestampAt(shiftDays(createdAt, 0), 10) : null,
          resolvedAt, closedAt: normalizedStatus === "Closed" ? timestampAt(shiftDays(createdAt, 2)) : null,
          resolutionCode: terminal ? (number % 2 ? "Solved (Permanent Fix)" : "Workaround Applied") : null,
          resolutionNotes: terminal ? "Sample resolution recorded for reporting." : null,
          createdAt, updatedAt: now,
        });
        const incidentId = stableId(`incident:${number}`);
        const incidentNumber = `${PREFIX}-INC-${String(number).padStart(3, "0")}`;
        await tx.insert(incidents).values({ id: incidentId, incidentNumber, ...incidentInput }).onConflictDoUpdate({
          target: incidents.id,
          set: { ...incidentInput, incidentNumber, updatedAt: now },
        });
      }
    }

    for (let number = 1; number <= 18; number++) {
      const status = requestStatuses[(number - 1) % requestStatuses.length];
      const requesterKey = ["finance", "hr", "operations", "executive"][number % 4];
      const projectId = number % 5 === 0 ? null : projectIds[number % projectIds.length];
      const createdAt = timestampAt(shiftDays(now, -number * 3), 11);
      const completed = status === "Completed";
      const rejected = status === "Rejected";
      const stage = status === "Fulfilling" ? "In Procurement" : status;
      const requestInput = insertServiceRequestSchema.parse({
        title: `${PREFIX}: ${["New laptop", "Software subscription", "VPN access", "Server resource"][number % 4]} request`,
        description: `Sample service request number ${number} for lifecycle and queue reporting.`,
        requesterId: userIds.get(requesterKey)!, creatorId: userIds.get("support-1")!,
        projectId, assignmentGroup: number % 2 ? "Service Desk" : "Workplace Technology",
        assigneeId: userIds.get(number % 2 ? "support-1" : "support-2")!,
        fulfillmentStage: stage, fulfillmentStatus: status,
        approvalStatus: rejected ? "rejected" : number % 6 === 0 ? "pending" : "approved",
        cost: 75 + number * 22, requestedQuantity: number % 3 + 1,
        customFieldValues: {}, catalogSchemaSnapshot: [],
        targetFulfillmentDate: isoDate(shiftDays(createdAt, 7)),
        fulfillmentDueAt: new Date(createdAt.getTime() + 7 * 86_400_000),
        completedAt: completed ? timestampAt(shiftDays(createdAt, 2)) : null,
        closureNote: rejected ? "Sample rejection recorded for reporting." : null,
        category: ["Hardware", "Software", "Access", "Infrastructure"][number % 4],
        createdAt, updatedAt: now,
      });
      const requestId = stableId(`service-request:${number}`);
      const requestNumber = `${PREFIX}-SR-${String(number).padStart(3, "0")}`;
      await tx.insert(serviceRequests).values({ id: requestId, requestNumber, ...requestInput }).onConflictDoUpdate({
        target: serviceRequests.id,
        set: { ...requestInput, requestNumber, updatedAt: now },
      });
    }

    return {
      users: people.length, employees: people.length, vendors: vendorSpecs.length,
      projects: projectSpecs.length, slaPolicies: priorityInfo.length, serviceContracts: contractSpecs.length,
      incidents: 18, serviceRequests: 18, assets: assetSpecs.length,
      clientReferences: clientNames.map((name, index) => ({
        id: `${PREFIX}-CLIENT-${String(index + 1).padStart(2, "0")}`,
        name,
      })),
    };
  });
}

export function assertSafeSeedTarget(environment: NodeJS.ProcessEnv): void {
  if (environment.NODE_ENV === "production") {
    throw new Error("Comprehensive sample data seeding is disabled in production.");
  }
  if (environment.SAMPLE_DATA_CONFIRM !== "YES") {
    throw new Error("Set SAMPLE_DATA_CONFIRM=YES to confirm this adds sample records to the selected database.");
  }
  if (!environment.DATABASE_URL) throw new Error("DATABASE_URL is required.");
  const hostname = new URL(environment.DATABASE_URL).hostname;
  if (!["localhost", "127.0.0.1", "::1"].includes(hostname) && environment.SAMPLE_DATA_ALLOW_REMOTE !== "YES") {
    throw new Error("Remote database target refused. Set SAMPLE_DATA_ALLOW_REMOTE=YES only after confirming DATABASE_URL is a development database.");
  }
  if (!environment.SAMPLE_DATA_PASSWORD || environment.SAMPLE_DATA_PASSWORD.length < 12) {
    throw new Error("Set SAMPLE_DATA_PASSWORD to a password with at least 12 characters; it will be hashed before storage.");
  }
}

async function main() {
  assertSafeSeedTarget(process.env);
  const summary = await seedComprehensiveData(db, await hashPassword(process.env.SAMPLE_DATA_PASSWORD!));
  console.log(`[${PREFIX}] Sample data upsert complete; existing records outside this namespace were not changed.`);
  console.log(JSON.stringify(summary, null, 2));
  console.log(`Eight sample accounts use the password supplied through SAMPLE_DATA_PASSWORD (value not displayed).`);
  console.log("Note: this schema has no standalone clients table; four named client IDs are stored on service contracts.");
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(error => {
    console.error("Comprehensive sample-data seeding failed. No partial transaction was committed.");
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
