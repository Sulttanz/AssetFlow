// @vitest-environment node
import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  insertPurchaseInvoicePaymentSchema,
  insertPurchaseInvoiceSchema,
  insertPurchaseReturnSchema,
  insertVendorQuotationSchema,
} from "@shared/schema";
import { assertAdditiveMigration } from "./startup-migrations";

const vendorId = "11111111-1111-4111-8111-111111111111";
const orderId = "22222222-2222-4222-8222-222222222222";
const lineId = "33333333-3333-4333-8333-333333333333";
const receiptId = "44444444-4444-4444-8444-444444444444";
const consumableId = "55555555-5555-4555-8555-555555555555";
const warehouseId = "66666666-6666-4666-8666-666666666666";

describe("P2P input validation", () => {
  it("accepts quotation line items and rejects invalid currency or date ordering", () => {
    const valid = {
      vendorId, quoteNumber: "Q-001", issueDate: "2026-01-01", validUntil: "2026-02-01",
      currency: "USD", subtotal: "10.00", taxAmount: "1.00", totalAmount: "11.00",
      status: "submitted", items: [{ description: "Laptop", itemType: "asset", quantity: 1, unitPrice: 10 }],
    };
    expect(insertVendorQuotationSchema.safeParse(valid).success).toBe(true);
    expect(insertVendorQuotationSchema.safeParse({ ...valid, currency: "US" }).success).toBe(false);
    expect(insertVendorQuotationSchema.safeParse({ ...valid, validUntil: "2025-12-31" }).success).toBe(false);
  });

  it("requires three-way receipt references and a valid invoice due date", () => {
    const valid = {
      vendorId, purchaseOrderId: orderId, invoiceNumber: "INV-1",
      issueDate: "2026-01-01", dueDate: "2026-02-01", currency: "USD",
      subtotal: "10.00", taxAmount: "1.00", grandTotal: "11.00",
      paymentMethod: "bank_transfer", paymentStatus: "pending", status: "pending",
      items: [{ purchaseOrderItemId: lineId, receiptId, quantity: 1, unitPrice: 10 }],
    };
    expect(insertPurchaseInvoiceSchema.safeParse(valid).success).toBe(true);
    expect(insertPurchaseInvoiceSchema.safeParse({ ...valid, dueDate: "2025-12-31" }).success).toBe(false);
    expect(insertPurchaseInvoiceSchema.safeParse({ ...valid, items: [{ ...valid.items[0], receiptId: "" }] }).success).toBe(false);
  });

  it("accepts partial payments and requires exactly one inventory target per return line", () => {
    expect(insertPurchaseInvoicePaymentSchema.safeParse({
      invoiceId: lineId, paymentDate: "2026-02-01", amount: 4.5, paymentMethod: "cash",
    }).success).toBe(true);
    const base = {
      vendorId, purchaseOrderId: orderId, returnDate: "2026-02-01", reasonCode: "defective",
      items: [{ purchaseOrderItemId: lineId, consumableId, warehouseLocationId: warehouseId, quantity: 1, reasonCode: "defective" }],
    };
    expect(insertPurchaseReturnSchema.safeParse(base).success).toBe(true);
    expect(insertPurchaseReturnSchema.safeParse({ ...base, items: [{ ...base.items[0], assetId: lineId }] }).success).toBe(false);
  });

  it("keeps the on-prem P2P migration additive and creates the expected workflow tables", async () => {
    const migration = await readFile(path.resolve("migrations/onprem/20261201_procure_to_pay.sql"), "utf8");
    expect(() => assertAdditiveMigration(migration, "20261201_procure_to_pay.sql")).not.toThrow();
    for (const table of ["vendor_quotations", "purchase_invoices", "purchase_invoice_payments", "purchase_returns", "purchase_return_items"]) {
      expect(migration).toMatch(new RegExp(`CREATE TABLE IF NOT EXISTS ${table}`));
    }
  });
});
