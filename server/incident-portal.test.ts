// @vitest-environment node
import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { insertIncidentCatalogItemSchema, insertIncidentSchema, users } from "@shared/schema";
import { assertAdditiveMigration } from "./startup-migrations";

const id = "f7a56ce2-cae9-4f6b-9c82-8aa4c32e1c4f";

describe("incident portal catalog and account linkage", () => {
  it("validates catalog defaults and nullable global/project scope", () => {
    const global = insertIncidentCatalogItemSchema.parse({
      name: "Network outage",
      category: "Network",
      projectId: null,
      defaultImpact: "high",
      defaultUrgency: "high",
      defaultPriority: "P1",
      isActive: true,
    });
    expect(global.projectId).toBeNull();
    expect(() => insertIncidentCatalogItemSchema.parse({
      ...global,
      defaultPriority: "critical",
    })).toThrow();
    expect(insertIncidentCatalogItemSchema.parse({
      ...global,
      projectId: id,
      defaultPriority: "P2",
    }).projectId).toBe(id);
  });

  it("allows a selected incident catalog item and affected asset to be optional", () => {
    const base = {
      title: "Cannot connect",
      description: "VPN fails after sign-in",
      requesterId: id,
      creatorId: id,
    };
    expect(insertIncidentSchema.safeParse(base).success).toBe(true);
    expect(insertIncidentSchema.safeParse({ ...base, incidentCatalogItemId: id, assetId: id }).success).toBe(true);
  });

  it("defines the employee relation on user accounts and ships an additive migration", async () => {
    expect(users.employeeId).toBeDefined();
    const migration = await readFile("migrations/onprem/20261208_incident_portal_catalog_employee_link.sql", "utf8");
    expect(() => assertAdditiveMigration(migration, "incident portal")).not.toThrow();
    expect(migration).toContain("ADD COLUMN IF NOT EXISTS employee_id");
    expect(migration).toContain("CREATE TABLE IF NOT EXISTS incident_catalog_items");
    expect(migration).toContain("incident_catalog_item_id");
  });
});
