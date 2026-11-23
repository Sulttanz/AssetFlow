import { getTableName, inArray, is, sql } from "drizzle-orm";
import { PgTable } from "drizzle-orm/pg-core";
import * as schema from "@shared/schema";
import {
  RESET_BUSINESS_TABLES, RESET_PROTECTED_TABLES, RESET_SELECTIVE_TABLES, systemDataResetAudit,
  type SystemDataResetActor,
} from "@shared/system-data-reset";
import { db } from "./db";
import { seedDefaultCatalogsInTransaction } from "./default-catalogs";

export function assertSystemDataResetCoverage() {
  const declared = Object.values(schema).filter(value => is(value, PgTable)).map(table => getTableName(table));
  const business = new Set<string>(RESET_BUSINESS_TABLES);
  const protectedTables = new Set<string>(RESET_PROTECTED_TABLES);
  const selective = new Set<string>(RESET_SELECTIVE_TABLES);
  const unclassified = declared.filter(name => !business.has(name) && !protectedTables.has(name) && !selective.has(name));
  const overlapping = RESET_BUSINESS_TABLES.filter(name => protectedTables.has(name));
  const duplicates = RESET_SELECTIVE_TABLES.filter(name => business.has(name) || protectedTables.has(name));
  const obsolete = [...RESET_BUSINESS_TABLES, ...RESET_PROTECTED_TABLES, ...RESET_SELECTIVE_TABLES].filter(name => !declared.includes(name));
  if (unclassified.length || overlapping.length || duplicates.length || obsolete.length) {
    throw new Error(`System reset table policy needs review: ${[...unclassified, ...overlapping, ...duplicates, ...obsolete].join(", ")}`);
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
    const tables = sql.join(
      RESET_BUSINESS_TABLES.filter(name => !systemGuideTables.has(name) && name !== "employees").map(name => sql.identifier(name)),
      sql`, `,
    );
    await tx.execute(sql`TRUNCATE TABLE ${tables} CONTINUE IDENTITY RESTRICT`);
    // Employee rows are removed with DELETE so an administrator's optional
    // employee link is detached via ON DELETE SET NULL (TRUNCATE cannot do that).
    await tx.delete(schema.employees);
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
    // Re-create built-in catalogs before commit: no request can observe an empty
    // catalog after reset, and a seed failure rolls the whole reset back.
    await seedDefaultCatalogsInTransaction(tx);

    // Keep all accounts with effective System Administrator access, but remove
    // other logins and their authorization/session rows. Role and permission
    // definitions themselves remain intact.
    const nonAdminUsers = await tx.select({ id: schema.users.id }).from(schema.users).where(sql`
      NOT (
        NOT EXISTS (
          SELECT 1 FROM user_roles demo_ur JOIN roles demo_r ON demo_r.id = demo_ur.role_id
          WHERE demo_ur.user_id = ${schema.users.id}
            AND regexp_replace(lower(trim(demo_r.name)), '[[:space:]-]+', '_', 'g') = 'demo_viewer'
        )
        AND (
          EXISTS (
            SELECT 1 FROM user_roles ur JOIN roles r ON r.id = ur.role_id
            WHERE ur.user_id = ${schema.users.id}
              AND regexp_replace(lower(trim(r.name)), '[[:space:]-]+', '_', 'g')
                IN ('system_admin', 'system_administrator', 'administrator', 'admin')
          )
          OR EXISTS (
            SELECT 1 FROM user_roles ur
            JOIN role_permissions rp ON rp.role_id = ur.role_id
            JOIN permissions p ON p.id = rp.permission_id
            WHERE ur.user_id = ${schema.users.id} AND lower(trim(p.name)) = 'system_admin'
          )
        )
      )
    `);
    const nonAdminIds = nonAdminUsers.map(user => user.id);
    if (nonAdminIds.length) {
      await tx.delete(schema.sessions).where(inArray(
        sql`(${schema.sessions.sess}::jsonb #>> '{passport,user}')`,
        nonAdminIds,
      ));
      await tx.delete(schema.cabStreamLeases).where(inArray(schema.cabStreamLeases.userId, nonAdminIds));
      await tx.delete(schema.userRoles).where(inArray(schema.userRoles.userId, nonAdminIds));
      await tx.delete(schema.users).where(inArray(schema.users.id, nonAdminIds));
    }
    // If this audit write fails, PostgreSQL rolls the entire reset back.
    await tx.insert(schema.auditLogs).values(systemDataResetAudit(actor));
  });
}
