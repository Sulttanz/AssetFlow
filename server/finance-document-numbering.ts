import { and, eq, sql } from "drizzle-orm";
import {
  financeDocumentSequences, purchaseInvoices, purchaseOrders, vendorQuotations,
} from "@shared/schema";

export type FinancialDocumentType = "quotation" | "purchase_order" | "invoice";

/**
 * Serialize sequence allocation by locking the document-type row. Manual
 * numbers still take the same lock so application-level duplicate validation
 * is race-safe across the server's create and conversion endpoints.
 */
export async function reserveFinancialDocumentNumber(
  tx: any,
  documentType: FinancialDocumentType,
  manualNumber?: unknown,
  now = new Date(),
  vendorId?: string,
): Promise<string> {
  const [sequence] = await tx.select().from(financeDocumentSequences)
    .where(eq(financeDocumentSequences.documentType, documentType))
    .for("update");
  if (!sequence) {
    throw Object.assign(new Error(`Document numbering is not configured for ${documentType}`), { status: 503 });
  }

  if (sequence.numberingMode === "manual") {
    if (typeof manualNumber !== "string" || !manualNumber.trim()) {
      throw Object.assign(new Error(`Enter a ${documentType.replace("_", " ")} number; numbering is configured for manual entry`), { status: 400 });
    }
    const value = manualNumber.trim();
    if (value.length > 100) throw Object.assign(new Error("Document numbers cannot exceed 100 characters"), { status: 400 });
    await assertFinancialDocumentNumberAvailable(tx, documentType, value, vendorId);
    return value;
  }

  const year = now.getFullYear();
  let nextNumber = sequence.resetYearly && sequence.sequenceYear !== year ? 1 : sequence.nextNumber;
  let number = "";
  let available = false;
  for (let attempts = 0; attempts < 1000; attempts += 1) {
    if (nextNumber >= 2147483647) break;
    number = `${sequence.prefix.replaceAll("{YYYY}", String(year))}${String(nextNumber).padStart(sequence.padding, "0")}`;
    try {
      await assertFinancialDocumentNumberAvailable(tx, documentType, number, vendorId);
      available = true;
      break;
    } catch (error) {
      if ((error as any)?.status !== 409) throw error;
      nextNumber += 1;
    }
  }
  if (!available) throw Object.assign(new Error(`Could not allocate a unique ${documentType.replace("_", " ")} number`), { status: 409 });
  await tx.update(financeDocumentSequences).set({
    nextNumber: nextNumber + 1,
    sequenceYear: year,
  }).where(eq(financeDocumentSequences.id, sequence.id));
  return number;
}

export async function assertFinancialDocumentNumberAvailable(
  tx: any,
  documentType: FinancialDocumentType,
  number: string,
  vendorId?: string,
): Promise<void> {
  const duplicate = documentType === "quotation"
    ? await tx.select({ id: vendorQuotations.id }).from(vendorQuotations)
      .where(sql`lower(btrim(${vendorQuotations.quoteNumber})) = lower(btrim(${number}))`).limit(1)
    : documentType === "purchase_order"
      ? await tx.select({ id: purchaseOrders.id }).from(purchaseOrders)
        .where(sql`lower(btrim(${purchaseOrders.poNumber})) = lower(btrim(${number}))`).limit(1)
      : await tx.select({ id: purchaseInvoices.id }).from(purchaseInvoices)
        .where(and(
          eq(purchaseInvoices.vendorId, vendorId!),
          sql`lower(btrim(${purchaseInvoices.invoiceNumber})) = lower(btrim(${number}))`,
        )).limit(1);
  if (duplicate.length) {
    const scope = documentType === "invoice" ? "for this vendor" : "";
    throw Object.assign(new Error(`Document number "${number}" is already in use ${scope}`.trim()), { status: 409 });
  }
}
