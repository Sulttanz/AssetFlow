// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getTableColumns, SQL } from "drizzle-orm";
import { PgDialect } from "drizzle-orm/pg-core";
import {
  assets, purchaseOrders, tickets, changes, dropdownOptions,
  insertAssetSchema, insertPurchaseOrderSchema, insertTicketSchema,
  insertChangeSchema, insertDropdownOptionSchema, TICKET_SLA_HOURS,
} from "@shared/schema";
import { MemStorage } from "./storage";

// Importing storage must never open a database connection. SLA lookup uses its
// documented constant fallback when no database is available.
vi.mock("./db", () => ({ db: {} }));

const now = new Date("2026-11-15T12:00:00.000Z");
const cases = [
  {
    name: "assets", table: assets, input: { name: "Laptop", type: "laptop" },
    create: (s: MemStorage, input: unknown) => s.createAsset(insertAssetSchema.parse(input)),
  },
  {
    name: "purchase orders", table: purchaseOrders,
    input: { poNumber: "PO-1", orderDate: "2026-11-15", totalAmount: "0.00" },
    create: (s: MemStorage, input: unknown) => s.createPurchaseOrder(insertPurchaseOrderSchema.parse(input)),
  },
  {
    name: "tickets", table: tickets,
    input: { title: "Help", description: "Cannot connect", requesterId: "requester-1" },
    create: (s: MemStorage, input: unknown) => s.createTicket(insertTicketSchema.parse(input)),
  },
  {
    name: "changes", table: changes, input: { title: "Upgrade" },
    create: (s: MemStorage, input: unknown) => s.createChange(insertChangeSchema.parse(input)),
  },
  {
    name: "dropdown options", table: dropdownOptions,
    input: { category: "assetType", value: "laptop", label: "Laptop" },
    create: (s: MemStorage, input: unknown) => s.createDropdownOption(insertDropdownOptionSchema.parse(input)),
  },
];

describe.each(cases)("$name insert/schema parity", ({ table, input, create, name }) => {
  const columns = getTableColumns(table);
  // Application-derived values are not SQL defaults; test their contracts below.
  const derived = name === "tickets"
    ? new Set(["ticketNumber", "slaResponseDueAt", "slaResolutionDueAt"])
    : name === "changes" ? new Set(["changeNumber"]) : new Set<string>();
  let storage: MemStorage;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(now);
    storage = new MemStorage();
  });
  afterEach(() => vi.useRealTimers());

  it.each(["omitted", "undefined"] as const)("materializes every schema column with %s optional input", async mode => {
    const optionalInput = mode === "undefined"
      ? Object.fromEntries(Object.keys(columns).filter(key => !(key in input)).map(key => [key, undefined]))
      : {};
    const record = await create(storage, { ...optionalInput, ...input });
    for (const [key, column] of Object.entries(columns)) {
      const value = record[key as keyof typeof record];
      expect(value, `${name}.${key} must not be missing`).not.toBeUndefined();
      if (key in input) {
        expect(value, key).toEqual(input[key as keyof typeof input]);
      } else if (!derived.has(key)) {
        if (column.default instanceof SQL) {
          const expression = new PgDialect().sqlToQuery(column.default).sql;
          if (expression === "gen_random_uuid()") {
            expect(value, key).toMatch(/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i);
          } else {
            expect(expression, `unhandled SQL default for ${key}`).toBe("now()");
            expect(value, key).toEqual(now);
          }
        } else {
          expect(value, key).toEqual(column.hasDefault ? column.default : null);
        }
      }
    }
  });

  it("preserves explicit nulls in nullable insert columns, including defaulted columns", async () => {
    const nulls = Object.fromEntries(Object.entries(columns)
      .filter(([key, column]) => !column.notNull && !derived.has(key))
      .map(([key]) => [key, null]));
    // Parsers omit server-managed columns (timestamps, ticket lifecycle fields).
    const record = await create(storage, { ...input, ...nulls });
    const managed = name === "tickets"
      ? ["createdAt", "updatedAt", "resolvedAt", "firstRespondedAt"]
      : name === "changes" || name === "dropdown options" ? ["createdAt", "updatedAt"] : [];
    for (const key of Object.keys(nulls).filter(key => !managed.includes(key))) {
      expect(record[key as keyof typeof record], key).toBeNull();
    }
  });

  it("creates independent records with fresh identifiers", async () => {
    const first = await create(storage, input);
    const second = await create(storage, input);
    expect(second.id).not.toBe(first.id);
  });
});

describe("explicit insert values and normalization", () => {
  it("retains asset zeroes and custom defaults while normalizing empty optional fields", async () => {
    const asset = await new MemStorage().createAsset({
      name: "License", type: "software", status: "retired", condition: "fair",
      depreciationMethod: "none", depreciationRate: "0.00", usedSeats: 0,
      autoRenewal: false, licenseQuantity: 0, purchasePrice: "0.00",
      assetTag: "", departmentId: "", purchaseDate: "",
    });
    expect(asset).toMatchObject({
      status: "retired", condition: "fair", depreciationMethod: "none",
      depreciationRate: "0.00", usedSeats: 0, autoRenewal: false,
      licenseQuantity: 0, purchasePrice: "0.00",
      assetTag: null, departmentId: null, purchaseDate: null,
    });
  });

  it("retains purchase order financial overrides and normalizes empty optional dates and links", async () => {
    const po = await new MemStorage().createPurchaseOrder({
      poNumber: "PO-2", orderDate: "2026-11-15", totalAmount: "0.00",
      currency: "EUR", status: "approved", taxMode: "inclusive",
      documentDiscountType: "percentage", documentDiscountValue: "10.00",
      expectedDelivery: "", actualDelivery: "", departmentId: "", notes: "",
      assetsCreated: false,
    });
    expect(po).toMatchObject({
      currency: "EUR", status: "approved", taxMode: "inclusive",
      documentDiscountType: "percentage", documentDiscountValue: "10.00",
      expectedDelivery: null, actualDelivery: null, departmentId: null,
      notes: null, assetsCreated: false, totalAmount: "0.00",
    });
  });

  it("retains inactive dropdowns and zero display order", async () => {
    const option = await new MemStorage().createDropdownOption({
      category: "status", value: "retired", label: "Retired",
      isActive: false, displayOrder: 0,
    });
    expect(option).toMatchObject({ isActive: false, displayOrder: 0 });
  });

  it("retains supplied change lifecycle values instead of replacing them with defaults", async () => {
    const started = new Date("2026-11-14T10:00:00Z");
    const ended = new Date("2026-11-14T11:00:00Z");
    const change = await new MemStorage().createChange({
      title: "Emergency repair", type: "emergency", status: "completed",
      priority: "high", risk: "high", cabRequired: true, cabReviewVersion: 3,
      actualStart: started, actualEnd: ended,
    });
    expect(change).toMatchObject({
      type: "emergency", status: "completed", priority: "high", risk: "high",
      cabRequired: true, cabReviewVersion: 3, actualStart: started, actualEnd: ended,
    });
  });

  it("derives ticket priority and SLA deadlines without a database", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(now);
    try {
      const storage = new MemStorage();
      const ticket = await storage.createTicket({
        title: "Outage", description: "Offline", requesterId: "requester-1",
        type: "service_request", impact: "high", urgency: "high",
        priority: "low", resolutionCode: "workaround",
      });
      expect(ticket).toMatchObject({
        type: "service_request", ticketNumber: "SR-000001",
        priority: "critical", resolutionCode: "workaround",
      });
      expect(ticket.slaResponseDueAt).toEqual(new Date(now.getTime() + TICKET_SLA_HOURS.critical.response * 3600000));
      expect(ticket.slaResolutionDueAt).toEqual(new Date(now.getTime() + TICKET_SLA_HOURS.critical.resolution * 3600000));
      expect(await storage.getTicket(ticket.id)).toMatchObject(ticket);
    } finally {
      vi.useRealTimers();
    }
  });
});
