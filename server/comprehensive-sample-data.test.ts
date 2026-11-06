// @vitest-environment node
import { afterAll, describe, expect, it } from "vitest";
import { and, eq, like, sql } from "drizzle-orm";
import {
  assets,
  employees,
  incidents,
  projects,
  serviceContracts,
  serviceRequests,
  users,
} from "@shared/schema";
import { db, pool } from "./db";
import { hashPassword } from "./auth";
import {
  assertSafeSeedTarget,
  COMPREHENSIVE_SAMPLE_PREFIX,
  seedComprehensiveData,
} from "../scripts/seed-comprehensive-data";

const databaseUrl = process.env.DATABASE_URL;
const options = databaseUrl ? new URL(databaseUrl).searchParams.get("options") ?? "" : "";
const disposableDb = Boolean(
  databaseUrl &&
  ["127.0.0.1", "localhost"].includes(new URL(databaseUrl).hostname) &&
  /search_path=test_full_[a-z0-9_]+/.test(options),
);
const integrationEnabled = process.env.RUN_DATABASE_INTEGRATION_TESTS === "1" &&
  process.env.VITEST_NATIVE_PG === "1" &&
  process.env.RUN_COMPREHENSIVE_SEED_TESTS === "1" &&
  disposableDb;

async function rowCount(query: any): Promise<number> {
  const [row] = await query;
  return Number(row?.count ?? 0);
}

describe("comprehensive sample-data seeding safety", () => {
  it("refuses production, unconfirmed, and unapproved remote targets", () => {
    expect(() => assertSafeSeedTarget({
      NODE_ENV: "production", DATABASE_URL: "postgresql://localhost/demo",
      SAMPLE_DATA_CONFIRM: "YES", SAMPLE_DATA_PASSWORD: "long-enough-password",
    })).toThrow(/disabled in production/);

    expect(() => assertSafeSeedTarget({
      NODE_ENV: "development", DATABASE_URL: "postgresql://localhost/demo",
      SAMPLE_DATA_PASSWORD: "long-enough-password",
    })).toThrow(/SAMPLE_DATA_CONFIRM/);

    expect(() => assertSafeSeedTarget({
      NODE_ENV: "development", DATABASE_URL: "postgresql://db.example.test/demo",
      SAMPLE_DATA_CONFIRM: "YES", SAMPLE_DATA_PASSWORD: "long-enough-password",
    })).toThrow(/Remote database target refused/);
  });
});

describe.runIf(integrationEnabled)("comprehensive sample-data seed integration", () => {
  afterAll(async () => {
    await pool.end();
  });

  it("creates a complete, linked dataset and is idempotent", async () => {
    const passwordHash = await hashPassword("Disposable-Seed-Test-Password-31!");
    const first = await seedComprehensiveData(db, passwordHash);
    const second = await seedComprehensiveData(db, passwordHash);

    expect(second).toEqual(first);
    expect(first).toEqual({
      users: 8, employees: 8, vendors: 3, projects: 5,
      slaPolicies: 4, serviceContracts: 4, incidents: 18,
      serviceRequests: 18, assets: 12,
      clientReferences: [
        { id: `${COMPREHENSIVE_SAMPLE_PREFIX}-CLIENT-01`, name: "Meridian Financial Group" },
        { id: `${COMPREHENSIVE_SAMPLE_PREFIX}-CLIENT-02`, name: "Northstar Health Partners" },
        { id: `${COMPREHENSIVE_SAMPLE_PREFIX}-CLIENT-03`, name: "Cedar Peak Logistics" },
        { id: `${COMPREHENSIVE_SAMPLE_PREFIX}-CLIENT-04`, name: "Bluehaven Retail Group" },
      ],
    });

    const prefix = COMPREHENSIVE_SAMPLE_PREFIX;
    expect(await rowCount(db.select({ count: sql<number>`count(*)::int` }).from(users).where(like(users.username, `${prefix.toLowerCase()}%`)))).toBe(8);
    expect(await rowCount(db.select({ count: sql<number>`count(*)::int` }).from(employees).where(like(employees.employeeId, `${prefix}-%`)))).toBe(8);
    expect(await rowCount(db.select({ count: sql<number>`count(*)::int` }).from(projects).where(like(projects.title, `${prefix}%`)))).toBe(5);
    expect(await rowCount(db.select({ count: sql<number>`count(*)::int` }).from(incidents).where(like(incidents.incidentNumber, `${prefix}-INC-%`)))).toBe(18);
    expect(await rowCount(db.select({ count: sql<number>`count(*)::int` }).from(serviceRequests).where(like(serviceRequests.requestNumber, `${prefix}-SR-%`)))).toBe(18);
    expect(await rowCount(db.select({ count: sql<number>`count(*)::int` }).from(assets).where(like(assets.assetTag, `${prefix}-AST-%`)))).toBe(12);
    expect(await rowCount(db.select({ count: sql<number>`count(*)::int` }).from(serviceContracts).where(like(serviceContracts.contractNumber, `${prefix}-CNT-%`)))).toBe(4);

    const activeAndNear = await db.select().from(serviceContracts).where(like(serviceContracts.contractNumber, `${prefix}-CNT-%`));
    expect(activeAndNear.filter(contract => contract.status === "active")).toHaveLength(2);
    expect(activeAndNear.filter(contract => contract.status === "near_expiration")).toHaveLength(1);
    expect(activeAndNear.filter(contract => contract.status === "expired")).toHaveLength(1);
    expect(await rowCount(db.select({ count: sql<number>`count(*)::int` }).from(incidents).where(and(
      like(incidents.incidentNumber, `${prefix}-INC-%`),
      eq(incidents.isWarrantyExpired, true),
    )))).toBeGreaterThanOrEqual(1);
  });
});
