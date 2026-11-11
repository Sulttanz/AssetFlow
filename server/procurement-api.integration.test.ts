// @vitest-environment node
import express from "express";
import type { Server } from "node:http";
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import * as s from "@shared/schema";
import { db, pool } from "./db";
import { hashPassword } from "./auth";
import { registerRoutes } from "./routes";

const url = process.env.DATABASE_URL ? new URL(process.env.DATABASE_URL) : null;
const enabled = process.env.RUN_DATABASE_INTEGRATION_TESTS === "1" &&
  process.env.VITEST_NATIVE_PG === "1" && url &&
  ["localhost", "127.0.0.1"].includes(url.hostname) &&
  /search_path=test_full_[a-z0-9_]+/.test(url.searchParams.get("options") ?? "");

describe.runIf(Boolean(enabled))("Procure-to-Pay HTTP and inventory integrity", () => {
  const actorId = randomUUID(), roleId = randomUUID(), vendorId = randomUUID(), warehouseId = randomUUID();
  const suffix = randomUUID().slice(0, 8);
  let server: Server | undefined, base = "", cookie = "";
  let quoteId = "", orderId = "", invoiceId = "", partialInvoiceId = "", manualQuoteId = "";

  async function request(method: string, path: string, input?: unknown, expected = 200) {
    const response = await fetch(`${base}${path}`, {
      method, headers: { "content-type": "application/json", cookie },
      body: input === undefined ? undefined : JSON.stringify(input),
    });
    const body = await response.json().catch(() => null);
    expect(response.status, `${method} ${path}: ${JSON.stringify(body)}`).toBe(expected);
    return body;
  }

  beforeAll(async () => {
    const app = express();
    app.use(express.json());
    server = await registerRoutes(app);
    await new Promise<void>(resolve => server!.listen(0, "127.0.0.1", resolve));
    base = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
    const password = `temporary-${randomUUID()}`, username = `p2p-${suffix}`;
    await db.insert(s.users).values({ id: actorId, username, password: await hashPassword(password), email: `${username}@example.test`, firstName: "Procurement", lastName: "Verifier" });
    await db.insert(s.permissions).values({ name: "system_admin" }).onConflictDoNothing();
    const [permission] = await db.select().from(s.permissions).where(eq(s.permissions.name, "system_admin"));
    await db.insert(s.roles).values({ id: roleId, name: `P2P Verification ${suffix}` });
    await db.insert(s.rolePermissions).values({ roleId, permissionId: permission.id });
    for (const name of ["purchase_order_create", "purchase_order_update", "finance_view"]) {
      await db.insert(s.permissions).values({ name }).onConflictDoNothing();
      const [grant] = await db.select().from(s.permissions).where(eq(s.permissions.name, name));
      await db.insert(s.rolePermissions).values({ roleId, permissionId: grant.id });
    }
    await db.insert(s.userRoles).values({ userId: actorId, roleId });
    await db.insert(s.vendors).values({ id: vendorId, name: `P2P vendor ${suffix}` });
    await db.insert(s.warehouseLocations).values({ id: warehouseId, name: `P2P warehouse ${suffix}`, code: `P2P-${suffix}`, isActive: true });
    const year = new Date().getFullYear();
    for (const [documentType, prefix] of [
      ["quotation", `QA-${suffix}-QT-{YYYY}-`],
      ["purchase_order", `QA-${suffix}-PO-{YYYY}-`],
      ["invoice", `QA-${suffix}-INV-{YYYY}-`],
    ] as const) {
      await db.update(s.financeDocumentSequences).set({
        numberingMode: "auto", prefix, nextNumber: 1, padding: 4, resetYearly: true, sequenceYear: year,
      }).where(eq(s.financeDocumentSequences.documentType, documentType));
    }
    const login = await fetch(`${base}/api/login`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ username, password }) });
    expect(login.status).toBe(200);
    cookie = login.headers.get("set-cookie")!.split(";")[0];
  }, 60_000);

  afterAll(async () => {
    try {
      if (orderId) {
        const returns = await db.select().from(s.purchaseReturns).where(eq(s.purchaseReturns.purchaseOrderId, orderId));
        for (const row of returns) await db.delete(s.purchaseReturnItems).where(eq(s.purchaseReturnItems.returnId, row.id));
        await db.delete(s.purchaseReturns).where(eq(s.purchaseReturns.purchaseOrderId, orderId));
        for (const id of [invoiceId, partialInvoiceId].filter(Boolean)) {
          await db.delete(s.purchaseInvoicePayments).where(eq(s.purchaseInvoicePayments.invoiceId, id));
          await db.delete(s.purchaseInvoiceMatchLines).where(eq(s.purchaseInvoiceMatchLines.invoiceId, id));
          await db.delete(s.purchaseInvoiceItems).where(eq(s.purchaseInvoiceItems.invoiceId, id));
          await db.delete(s.purchaseInvoices).where(eq(s.purchaseInvoices.id, id));
        }
        await db.delete(s.purchaseOrderItemReceipts).where(eq(s.purchaseOrderItemReceipts.purchaseOrderId, orderId));
        await db.delete(s.purchaseOrderItems).where(eq(s.purchaseOrderItems.purchaseOrderId, orderId));
        await db.delete(s.consumableStockMovements).where(eq(s.consumableStockMovements.purchaseOrderId, orderId));
        await db.delete(s.purchaseOrders).where(eq(s.purchaseOrders.id, orderId));
      }
      if (quoteId) await db.delete(s.vendorQuotations).where(eq(s.vendorQuotations.id, quoteId));
      if (manualQuoteId) await db.delete(s.vendorQuotations).where(eq(s.vendorQuotations.id, manualQuoteId));
      await db.delete(s.assets).where(eq(s.assets.primaryVendorId, vendorId));
      await db.delete(s.consumables).where(eq(s.consumables.warehouseLocationId, warehouseId));
      await db.delete(s.warehouseLocations).where(eq(s.warehouseLocations.id, warehouseId));
      await db.delete(s.vendors).where(eq(s.vendors.id, vendorId));
      await db.delete(s.userRoles).where(eq(s.userRoles.userId, actorId));
      await db.delete(s.rolePermissions).where(eq(s.rolePermissions.roleId, roleId));
      await db.delete(s.roles).where(eq(s.roles.id, roleId));
      await db.delete(s.auditLogs).where(eq(s.auditLogs.userId, actorId));
      await db.delete(s.users).where(eq(s.users.id, actorId));
    } finally {
      if (server?.listening) await new Promise<void>(resolve => server!.close(() => resolve()));
      await pool.end();
    }
  });

  it("matches receipts, prevents duplicate stock and overpayment, and applies debit notes to payable balances", async () => {
    const defaultRates = await request("GET", "/api/finance/tax-rates");
    expect(defaultRates.map((rate: any) => rate.code)).toEqual(expect.arrayContaining(["STANDARD_VAT", "REDUCED_VAT", "ZERO_RATED", "EXEMPT"]));
    const taxRate = await request("POST", "/api/finance/tax-rates", {
      code: `QA_${suffix.toUpperCase()}`, name: `QA reduced ${suffix}`, classification: "reduced", rate: 7.5,
      taxMode: "exclusive", isActive: true, isDefault: false, sortOrder: 99,
    }, 201);
    const activatedDefault = await request("PUT", `/api/finance/tax-rates/${taxRate.id}`, {
      code: taxRate.code, name: taxRate.name, classification: taxRate.classification, rate: 7.5,
      taxMode: "exclusive", isActive: true, isDefault: true, sortOrder: 99,
    });
    expect(activatedDefault.isDefault).toBe(true);
    expect(Number((await request("GET", "/api/finance/tax-settings")).defaultTaxRate)).toBe(7.5);
    await request("PUT", `/api/finance/tax-rates/${taxRate.id}`, {
      code: taxRate.code, name: taxRate.name, classification: taxRate.classification, rate: 7.5,
      taxMode: "exclusive", isActive: false, isDefault: false, sortOrder: 99,
    }, 409);

    await db.update(s.financeDocumentSequences).set({ numberingMode: "manual" })
      .where(eq(s.financeDocumentSequences.documentType, "quotation"));
    const manualQuotation = {
      vendorId, quoteNumber: `MANUAL-${suffix}`, issueDate: "2026-01-01", currency: "SAR",
      taxRate: "0", subtotal: "1.00", taxAmount: "0.00", totalAmount: "1.00",
      items: [{ description: `Manual quote ${suffix}`, quantity: 1, unitPrice: 1, taxRate: 0 }],
    };
    await request("POST", "/api/vendor-quotations", { ...manualQuotation, quoteNumber: "" }, 400);
    const manualQuote = await request("POST", "/api/vendor-quotations", manualQuotation, 201);
    manualQuoteId = manualQuote.id;
    expect(manualQuote.quoteNumber).toBe(`MANUAL-${suffix}`);
    await request("POST", "/api/vendor-quotations", { ...manualQuotation, quoteNumber: `manual-${suffix}` }, 409);
    await db.update(s.financeDocumentSequences).set({ numberingMode: "auto" })
      .where(eq(s.financeDocumentSequences.documentType, "quotation"));

    const quote = await request("POST", "/api/vendor-quotations", {
      vendorId, quoteNumber: `Q-${suffix}`, issueDate: "2026-01-01", currency: "SAR", taxRate: "0", subtotal: "60.00", taxAmount: "0.00", totalAmount: "60.00",
      status: "converted",
      items: [
        { description: `P2P toner ${suffix}`, itemType: "consumable", quantity: 4, unitPrice: 10, warehouseLocationId: warehouseId },
        { description: `P2P laptop ${suffix}`, itemType: "asset", quantity: 1, unitPrice: 20, assetType: "laptop" },
      ],
    }, 201);
    quoteId = quote.id;
    expect(quote.status).toBe("submitted");
    expect(quote.quoteNumber).toMatch(new RegExp(`^QA-${suffix}-QT-\\d{4}-0001$`));
    await request("PUT", `/api/vendor-quotations/${quoteId}/status`, { status: "accepted" });
    const order = await request("POST", "/api/purchase-orders", {
      poNumber: `PO-P2P-${suffix}`, quotationId: quoteId, vendorId, orderDate: "2026-01-01",
      currency: "SAR", taxRate: "0", totalAmount: "60.00", items: quote.items,
    }, 201);
    orderId = order.id;
    expect(order.status).toBe("pending");
    expect(order.poNumber).toMatch(new RegExp(`^QA-${suffix}-PO-\\d{4}-0001$`));
    await request("POST", `/api/vendor-quotations/${quoteId}/convert-to-po`, {}, 409);
    await request("PUT", `/api/purchase-orders/${orderId}`, { status: "received" }, 409);
    await request("PUT", `/api/purchase-orders/${orderId}`, { status: "ordered" }, 409);
    await request("PUT", `/api/purchase-orders/${orderId}`, { status: "approved" });
    await request("PUT", `/api/purchase-orders/${orderId}`, { status: "ordered" });
    await request("POST", `/api/purchase-orders/${orderId}/create-assets`, {}, 400);
    const matchLines = await request("GET", `/api/purchase-orders/${orderId}/match-lines`);
    const invoiceInput = {
      vendorId, purchaseOrderId: orderId, invoiceNumber: `INV-${suffix}`, issueDate: "2026-01-01", dueDate: "2026-02-01",
      currency: "SAR", subtotal: "60.00", taxAmount: "0.00", grandTotal: "60.00", paymentMethod: "credit_terms",
      status: "received", paymentStatus: "paid",
      items: matchLines.map((line: any) => ({ purchaseOrderItemId: line.purchaseOrderItemId, quantity: line.quantity, unitPrice: Number(line.unitPrice) })),
    };
    const partial = await request("POST", "/api/purchase-invoices", {
      ...invoiceInput, invoiceNumber: `PARTIAL-${suffix}`, subtotal: "10.00", grandTotal: "10.00",
      items: [{ purchaseOrderItemId: matchLines.find((line: any) => line.itemType === "consumable").purchaseOrderItemId, quantity: 1, unitPrice: 10 }],
    }, 201);
    partialInvoiceId = partial.id;
    await request("PUT", `/api/purchase-invoices/${partialInvoiceId}/status`, { status: "approved" });
    await request("PUT", `/api/purchase-invoices/${partialInvoiceId}/status`, { status: "received" }, 409);
    expect(await db.select().from(s.purchaseOrderItemReceipts).where(eq(s.purchaseOrderItemReceipts.purchaseOrderId, orderId))).toHaveLength(0);
    await request("PUT", `/api/purchase-invoices/${partialInvoiceId}/status`, { status: "void" });
    const invoice = await request("POST", "/api/purchase-invoices", invoiceInput, 201);
    invoiceId = invoice.id;
    expect(invoice).toMatchObject({ status: "pending", paymentStatus: "pending" });
    expect(invoice.invoiceNumber).toMatch(new RegExp(`^QA-${suffix}-INV-\\d{4}-0002$`));
    expect(await db.select().from(s.purchaseOrderItemReceipts).where(eq(s.purchaseOrderItemReceipts.purchaseOrderId, orderId))).toHaveLength(0);
    await request("POST", "/api/purchase-invoices", { ...invoiceInput, invoiceNumber: `OVER-${suffix}` }, 400);
    await request("PUT", `/api/purchase-invoices/${invoiceId}/status`, { status: "received" }, 409);
    await request("PUT", `/api/purchase-invoices/${invoiceId}/status`, { status: "approved" });
    await db.update(s.warehouseLocations).set({ isActive: false }).where(eq(s.warehouseLocations.id, warehouseId));
    await request("PUT", `/api/purchase-invoices/${invoiceId}/status`, { status: "received" }, 400);
    const [unreceivedOrder] = await db.select().from(s.purchaseOrders).where(eq(s.purchaseOrders.id, orderId));
    const [unreceivedInvoice] = await db.select().from(s.purchaseInvoices).where(eq(s.purchaseInvoices.id, invoiceId));
    expect(unreceivedOrder).toMatchObject({ status: "ordered", assetsCreated: false });
    expect(unreceivedInvoice.status).toBe("approved");
    expect(await db.select().from(s.purchaseOrderItemReceipts).where(eq(s.purchaseOrderItemReceipts.purchaseOrderId, orderId))).toHaveLength(0);
    await db.update(s.warehouseLocations).set({ isActive: true }).where(eq(s.warehouseLocations.id, warehouseId));
    await request("PUT", `/api/purchase-invoices/${invoiceId}/status`, { status: "received" });
    await request("PUT", `/api/purchase-invoices/${invoiceId}/status`, { status: "received" });
    const [receivedOrder] = await db.select().from(s.purchaseOrders).where(eq(s.purchaseOrders.id, orderId));
    expect(receivedOrder).toMatchObject({ status: "received", assetsCreated: true });
    expect(await db.select().from(s.purchaseOrderItemReceipts).where(eq(s.purchaseOrderItemReceipts.purchaseOrderId, orderId))).toHaveLength(2);
    expect(await db.select().from(s.purchaseInvoiceItems).where(eq(s.purchaseInvoiceItems.invoiceId, invoiceId))).toHaveLength(2);
    expect(await db.select().from(s.purchaseInvoiceMatchLines).where(eq(s.purchaseInvoiceMatchLines.invoiceId, invoiceId))).toHaveLength(0);
    expect(await db.select().from(s.assets).where(eq(s.assets.primaryVendorId, vendorId))).toHaveLength(1);
    await request("POST", `/api/purchase-orders/${orderId}/create-assets`, {}, 409);
    await request("POST", `/api/purchase-invoices/${invoiceId}/payments`, { paymentDate: "2026-01-02", amount: 20, paymentMethod: "cash" }, 201);
    const lines = await db.select().from(s.purchaseOrderItems).where(eq(s.purchaseOrderItems.purchaseOrderId, orderId));
    const stockLine = lines.find(line => line.itemType === "consumable")!;
    expect(stockLine.consumableId).toBeTruthy();
    const supplierReturn = await request("POST", "/api/purchase-returns", {
      vendorId, purchaseOrderId: orderId, purchaseInvoiceId: invoiceId, currency: "SAR", returnDate: "2026-01-03", reasonCode: "defective",
      items: [{ purchaseOrderItemId: stockLine.id, consumableId: stockLine.consumableId, warehouseLocationId: warehouseId, quantity: 1, reasonCode: "defective" }],
    }, 201);
    expect(supplierReturn.totalCredit).toBe("10.00");
    expect(supplierReturn.debitNoteNumber).toMatch(/^DN-/);
    const [stock] = await db.select().from(s.consumables).where(eq(s.consumables.id, stockLine.consumableId!));
    expect(stock.quantityInStock).toBe(3);
    await request("POST", `/api/purchase-invoices/${invoiceId}/payments`, { paymentDate: "2026-01-04", amount: 31, paymentMethod: "bank_transfer" }, 400);
    await request("POST", `/api/purchase-invoices/${invoiceId}/payments`, { paymentDate: "2026-01-04", amount: 30, paymentMethod: "bank_transfer" }, 201);
    const invoices = await request("GET", "/api/purchase-invoices");
    expect(invoices.find((row: any) => row.id === invoiceId)).toMatchObject({ paymentStatus: "paid", creditedAmount: 10, outstandingAmount: 0 });
    await request("PUT", `/api/purchase-invoices/${invoiceId}/status`, { status: "void" }, 409);
    const report = await request("GET", "/api/reports/procurement-finance");
    expect(report.procurementSpend.byVendor).toContainEqual({ vendorId, vendorName: `P2P vendor ${suffix}`, currency: "SAR", amount: 60 });
    expect(report.accountsPayable.byPaymentMethod.find((row: any) => row.currency === "SAR" && row.paymentMethod === "cash")?.paid).toBeGreaterThanOrEqual(20);
    expect(report.accountsPayable.byPaymentMethod.find((row: any) => row.currency === "SAR" && row.paymentMethod === "bank_transfer")?.paid).toBeGreaterThanOrEqual(30);
  }, 60_000);
});
