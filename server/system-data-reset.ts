import { getTableName, isNotNull, is, sql } from "drizzle-orm";
import { PgTable } from "drizzle-orm/pg-core";
import * as schema from "@shared/schema";
import {
  RESET_BUSINESS_TABLES, RESET_PROTECTED_TABLES, systemDataResetAudit,
  type SystemDataResetActor,
} from "@shared/system-data-reset";
import { db } from "./db";
import { DEFAULT_ASSIGNMENT_GROUPS, seedDefaultAssignmentGroupsInTransaction } from "./default-catalogs";

export function assertSystemDataResetCoverage() {
  const declared = Object.values(schema).filter(value => is(value, PgTable)).map(table => getTableName(table));
  const business = new Set<string>(RESET_BUSINESS_TABLES);
  const protectedTables = new Set<string>(RESET_PROTECTED_TABLES);
  const unclassified = declared.filter(name => !business.has(name) && !protectedTables.has(name));
  const overlapping = RESET_BUSINESS_TABLES.filter(name => protectedTables.has(name));
  const obsolete = [...RESET_BUSINESS_TABLES, ...RESET_PROTECTED_TABLES].filter(name => !declared.includes(name));
  if (unclassified.length || overlapping.length || obsolete.length) {
    throw new Error(`System reset table policy needs review: ${[...unclassified, ...overlapping, ...obsolete].join(", ")}`);
  }
}

export async function clearDatabaseBusinessData(actor: SystemDataResetActor): Promise<void> {
  assertSystemDataResetCoverage();
  await db.transaction(async tx => {
    await tx.execute(sql`SET LOCAL lock_timeout = '10s'`);
    await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext('system-clear-data'))`);
    // All related business tables are named in ONE statement. PostgreSQL
    // handles cycles and RESTRICT relationships without disabling constraints.
    // No CASCADE: unexpected dependencies must fail safely, not erase settings.
    const systemGuideTables = new Set([
      "kb_articles", "kb_article_versions", "kb_article_attachments", "kb_article_control_mappings",
    ]);
    const deleteByFkAction = new Set(["employees", "projects", "consumables", "vendors"]);
    const tables = sql.join(
      RESET_BUSINESS_TABLES.filter(name => !systemGuideTables.has(name) && !deleteByFkAction.has(name)).map(name => sql.identifier(name)),
      sql`, `,
    );
    await tx.execute(sql`TRUNCATE TABLE ${tables} CONTINUE IDENTITY RESTRICT`);
    // Catalog rows are protected, but their references to records being reset
    // must be detached before deleting the referenced employee/project/stock.
    await tx.update(schema.catalogItems).set({ consumableId: null })
      .where(isNotNull(schema.catalogItems.consumableId));
    await tx.update(schema.serviceCatalogItems).set({ projectId: null })
      .where(isNotNull(schema.serviceCatalogItems.projectId));
    await tx.update(schema.incidentCatalogItems).set({ projectId: null })
      .where(isNotNull(schema.incidentCatalogItems.projectId));
    const retainedGroups = sql.join(
      DEFAULT_ASSIGNMENT_GROUPS.map(name => sql`${name.trim().toLowerCase()}`),
      sql`, `,
    );
    await tx.execute(sql`
      UPDATE catalog_items
      SET fulfillment_team = NULL
      WHERE fulfillment_team IS NOT NULL
        AND lower(btrim(fulfillment_team)) NOT IN (${retainedGroups})
    `);
    await tx.execute(sql`
      UPDATE incident_catalog_items
      SET default_assignment_group = NULL
      WHERE default_assignment_group IS NOT NULL
        AND lower(btrim(default_assignment_group)) NOT IN (${retainedGroups})
    `);
    // Preserve every account and role mapping while detaching employee links.
    await tx.update(schema.users).set({ employeeId: null });
    await tx.delete(schema.employees);
    await tx.delete(schema.projects);
    await tx.delete(schema.consumables);
    await tx.delete(schema.vendors);
    // Preserve repository-owned system guides and their governed history while
    // removing custom Knowledge Base content as part of the business reset.
    await tx.execute(sql`
      DELETE FROM kb_article_versions
      WHERE article_id IN (SELECT id FROM kb_articles WHERE is_system_guide = false)
    `);
    await tx.execute(sql`
      DELETE FROM kb_article_attachments
      WHERE article_id IN (SELECT id FROM kb_articles WHERE is_system_guide = false)
    `);
    await tx.execute(sql`
      DELETE FROM kb_article_control_mappings
      WHERE article_id IN (SELECT id FROM kb_articles WHERE is_system_guide = false)
    `);
    await tx.execute(sql`DELETE FROM kb_articles WHERE is_system_guide = false`);
    // Keep standard support teams available without touching catalog rows.
    await seedDefaultAssignmentGroupsInTransaction(tx);

    // If this audit write fails, PostgreSQL rolls the entire reset back.
    await tx.insert(schema.auditLogs).values(systemDataResetAudit(actor));
  });
}
