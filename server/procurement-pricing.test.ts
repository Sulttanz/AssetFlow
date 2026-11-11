// @vitest-environment node
import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { calculateDocumentTotals, previewDocumentTotals, ProcurementPricingError } from "@shared/procurement-pricing";
import { canTransitionPurchaseOrder } from "@shared/purchase-order-lifecycle";
import { formatDocumentNumberPreview } from "@shared/finance-document-numbering";
import { financeDocumentSequenceInputSchema, financeTaxRateInputSchema } from "@shared/schema";
import { assertAdditiveMigration } from "./startup-migrations";

describe("procurement pricing and lifecycle controls", () => {
  it("applies line percentage discounts before exclusive VAT", () => {
    const totals = calculateDocumentTotals([{ quantity: 2, unitPrice: 100, discountType: "percentage", discountValue: 10, taxRate: 15 }]);
    expect(totals).toMatchObject({ subtotal: 180, taxAmount: 27, grandTotal: 207 });
    expect(totals.lines[0].discountAmount).toBe(20);
  });

  it("applies fixed line discounts and a proportional document discount", () => {
    const totals = calculateDocumentTotals([
      { quantity: 1, unitPrice: 160, discountType: "fixed", discountValue: 10, taxRate: 15 },
      { quantity: 1, unitPrice: 50, taxRate: 15 },
    ], "percentage", 10);
    expect(totals).toMatchObject({ subtotal: 180, documentDiscountAmount: 20, taxAmount: 27, grandTotal: 207 });
  });

  it("keeps inclusive VAT inside the bill and supports mixed line tax treatment", () => {
    const totals = calculateDocumentTotals([
      { quantity: 1, unitPrice: 115, taxRate: 15, taxInclusive: true },
      { quantity: 1, unitPrice: 100, taxRate: 15, taxInclusive: false },
    ]);
    expect(totals.taxAmount).toBe(30);
    expect(totals.grandTotal).toBe(230);
    expect(totals.lines[0]).toMatchObject({ taxAmount: 15, totalAmount: 115 });
  });

  it("allocates every document-discount cent without rounding drift", () => {
    const totals = calculateDocumentTotals(Array.from({ length: 3 }, () => ({ quantity: 1, unitPrice: 1 })), "fixed", 0.01);
    expect(totals).toMatchObject({ subtotal: 2.99, documentDiscountAmount: 0.01, grandTotal: 2.99 });
    expect(totals.lines.reduce((sum, line) => Math.round(sum * 100) / 100 + line.totalAmount, 0)).toBeCloseTo(2.99, 2);
  });

  it("rejects invalid API pricing while keeping unfinished form previews safe", () => {
    expect(() => calculateDocumentTotals([{ quantity: 1, unitPrice: 100, discountType: "percentage", discountValue: 101 }])).toThrow(ProcurementPricingError);
    expect(() => calculateDocumentTotals([{ quantity: 0, unitPrice: 100 }])).toThrow(ProcurementPricingError);
    expect(() => calculateDocumentTotals([{ quantity: 1, unitPrice: NaN }])).toThrow(ProcurementPricingError);
    expect(previewDocumentTotals([{ quantity: 0, unitPrice: 100 }]).validationError).toBeTruthy();
  });

  it("permits only linear manual PO transitions and invoice-driven receiving", () => {
    expect(canTransitionPurchaseOrder("pending", "approved")).toBe(true);
    expect(canTransitionPurchaseOrder("approved", "ordered")).toBe(true);
    expect(canTransitionPurchaseOrder("pending", "ordered")).toBe(false);
    expect(canTransitionPurchaseOrder("ordered", "received")).toBe(false);
    expect(canTransitionPurchaseOrder("ordered", "received", "invoice_receipt")).toBe(true);
    expect(canTransitionPurchaseOrder("pending", "received", "invoice_receipt")).toBe(false);
    expect(canTransitionPurchaseOrder("ordered", "cancelled")).toBe(true);
    expect(canTransitionPurchaseOrder("received", "cancelled")).toBe(false);
    expect(canTransitionPurchaseOrder("cancelled", "pending")).toBe(false);
  });

  it("formats year-aware sequence previews and validates numbering/tax settings", () => {
    const date = new Date(2026, 4, 10);
    expect(formatDocumentNumberPreview({
      prefix: "QT-{YYYY}-", nextNumber: 9, padding: 4, resetYearly: true, sequenceYear: 2026,
    }, date)).toBe("QT-2026-0009");
    expect(formatDocumentNumberPreview({
      prefix: "PO-{YYYY}-", nextNumber: 83, padding: 4, resetYearly: true, sequenceYear: 2025,
    }, date)).toBe("PO-2026-0001");
    expect(financeDocumentSequenceInputSchema.safeParse({
      numberingMode: "auto", prefix: "INV-{YYYY}-", nextNumber: 1, padding: 4, resetYearly: true,
    }).success).toBe(true);
    expect(financeDocumentSequenceInputSchema.safeParse({
      numberingMode: "manual", prefix: "", nextNumber: 0, padding: 14, resetYearly: false,
    }).success).toBe(false);
    expect(financeTaxRateInputSchema.safeParse({
      code: "VAT-5", name: "Reduced VAT", classification: "reduced", rate: 5,
      taxMode: "exclusive", isActive: true, isDefault: false, sortOrder: 20,
    }).success).toBe(true);
    expect(financeTaxRateInputSchema.safeParse({
      code: "BAD RATE", name: "Invalid", classification: "standard", rate: 101,
      taxMode: "exclusive", isActive: true, isDefault: false, sortOrder: 0,
    }).success).toBe(false);
  });

  it("keeps the tax, discount, and staged-match migration additive", async () => {
    const migration = await readFile("migrations/onprem/20261202_financial_tax_and_discounts.sql", "utf8");
    expect(() => assertAdditiveMigration(migration, "20261202_financial_tax_and_discounts.sql")).not.toThrow();
    expect(migration).toContain("CREATE TABLE IF NOT EXISTS finance_tax_settings");
    expect(migration).toContain("CREATE TABLE IF NOT EXISTS purchase_invoice_match_lines");
    expect(migration).toContain("ADD COLUMN IF NOT EXISTS document_discount_value");
  });

  it("keeps multi-rate VAT and document-sequence schema migration additive", async () => {
    const migration = await readFile("migrations/onprem/20261203_finance_tax_rates_and_document_sequences.sql", "utf8");
    expect(() => assertAdditiveMigration(migration, "20261203_finance_tax_rates_and_document_sequences.sql")).not.toThrow();
    for (const table of ["finance_tax_rates", "finance_document_sequences"]) {
      expect(migration).toContain(`CREATE TABLE IF NOT EXISTS ${table}`);
    }
    expect(migration).toContain("'REDUCED_VAT'");
    expect(migration).toContain("'ZERO_RATED'");
    expect(migration).toContain("finance_tax_rates_single_default_idx");
  });
});
