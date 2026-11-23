import { sql } from "drizzle-orm";
import { assignmentGroups, catalogItems, incidentCatalogItems, serviceCatalogItems } from "@shared/schema";
import type { db as database } from "./db";

type Transaction = Parameters<Parameters<typeof database.transaction>[0]>[0];

export const DEFAULT_INCIDENT_CATALOG = [
  { name: "Email / Outlook Issue", category: "Email", description: "Email delivery, Outlook connectivity, or mailbox errors.", defaultPriority: "P3", defaultImpact: "low", defaultUrgency: "medium", defaultAssignmentGroup: "Service Desk" },
  { name: "Application / ERP Error", category: "Application", description: "Business application failures or ERP errors affecting work.", defaultPriority: "P2", defaultImpact: "medium", defaultUrgency: "high", defaultAssignmentGroup: "Application Support" },
  { name: "Network / Wi-Fi / VPN Down", category: "Network", description: "Loss of network connectivity, wireless access, or remote VPN service.", defaultPriority: "P2", defaultImpact: "high", defaultUrgency: "medium", defaultAssignmentGroup: "Network Operations" },
  { name: "Hardware / Workstation Malfunction", category: "Hardware", description: "Computer faults, startup failures, or hardware malfunctions.", defaultPriority: "P3", defaultImpact: "low", defaultUrgency: "medium", defaultAssignmentGroup: "Desktop Support" },
  { name: "Login / Password / Account Lockout", category: "Access", description: "Unable to sign in, forgotten password, or locked enterprise account.", defaultPriority: "P3", defaultImpact: "low", defaultUrgency: "medium", defaultAssignmentGroup: "Service Desk" },
  { name: "Printer / Peripheral Issue", category: "Hardware", description: "Printer errors or problems with attached peripherals.", defaultPriority: "P4", defaultImpact: "low", defaultUrgency: "low", defaultAssignmentGroup: "Desktop Support" },
] as const;

export const DEFAULT_SERVICE_CATALOG = [
  { name: "New User Onboarding", category: "Access", description: "Provision a new colleague's accounts and standard workplace access.", group: "Service Desk", slaHours: 48, approval: true },
  { name: "Software Installation Request", category: "Software", description: "Request approved software installation or a licensed application.", group: "Desktop Support", slaHours: 24, approval: true },
  { name: "Hardware / Laptop Request", category: "Hardware", description: "Request a laptop or standard workplace equipment.", group: "Desktop Support", slaHours: 72, approval: true },
  { name: "VPN / Remote Access Request", category: "Access", description: "Request secure remote connectivity to company systems.", group: "Network Operations", slaHours: 24, approval: true },
  { name: "Email / Distribution List Setup", category: "Access", description: "Create or change an email distribution list or shared mailbox.", group: "Service Desk", slaHours: 24, approval: false },
  { name: "Shared Folder / Permissions Access", category: "Access", description: "Request approved access to a shared folder or team resource.", group: "Infrastructure", slaHours: 24, approval: true },
] as const;

export const DEFAULT_ASSIGNMENT_GROUPS = [
  "Service Desk", "Application Support", "Network Operations", "Desktop Support", "Infrastructure",
] as const;

export async function seedDefaultAssignmentGroupsInTransaction(tx: Transaction) {
  await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext('default-catalog-seed'))`);
  for (const name of DEFAULT_ASSIGNMENT_GROUPS) {
    await tx.insert(assignmentGroups).values({ name, description: "Standard support routing team" }).onConflictDoNothing();
  }
}

// Stable UUIDs survive reset/reseed. Conflict handling never overwrites customer
// templates or their approval/schema customization. All inserts are atomic.
export async function seedDefaultCatalogsInTransaction(tx: Transaction) {
  await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext('default-catalog-seed'))`);
  for (const name of DEFAULT_ASSIGNMENT_GROUPS) {
    await tx.insert(assignmentGroups).values({ name, description: "Standard support routing team" }).onConflictDoNothing();
  }
  for (const [index, item] of Array.from(DEFAULT_SERVICE_CATALOG.entries())) {
    const [existing] = await tx.select({ id: catalogItems.id }).from(catalogItems)
      .where(sql`lower(btrim(${catalogItems.name})) = lower(${item.name})`).limit(1);
    const id = existing?.id ?? `00000000-0000-4000-8000-${String(1001 + index).padStart(12, "0")}`;
    await tx.insert(catalogItems).values({
      id, name: item.name, description: item.description, category: item.category.toLowerCase(),
      fulfillmentTeam: item.group, slaHours: item.slaHours, approvalRequired: item.approval, displayOrder: index,
    }).onConflictDoNothing();
    await tx.insert(serviceCatalogItems).values({
      id, title: item.name, description: item.description, category: item.category,
      slaHours: item.slaHours, requiresApproval: item.approval, approverRole: item.approval ? "Manager" : null,
      defaultPriority: "P3", defaultImpact: "low", defaultUrgency: "medium",
    }).onConflictDoNothing();
  }
  for (const [index, item] of Array.from(DEFAULT_INCIDENT_CATALOG.entries())) {
    await tx.insert(incidentCatalogItems).values({
      ...item, id: `00000000-0000-4000-8000-${String(2001 + index).padStart(12, "0")}`,
      projectId: null,
    }).onConflictDoNothing();
  }
}

export async function ensureDefaultCatalogs() {
  const { db } = await import("./db");
  await db.transaction(seedDefaultCatalogsInTransaction);
}
