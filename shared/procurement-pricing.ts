export type DiscountType = "percentage" | "fixed";
export class ProcurementPricingError extends Error {}

export type PricedLineInput = {
  quantity: number;
  unitPrice: number;
  discountType?: DiscountType;
  discountValue?: number;
  taxRate?: number;
  taxInclusive?: boolean;
};

export type PricedLine = {
  grossAmount: number;
  discountAmount: number;
  taxableAmount: number;
  taxAmount: number;
  totalAmount: number;
};

export type DocumentTotals = {
  subtotal: number;
  documentDiscountAmount: number;
  taxAmount: number;
  grandTotal: number;
  lines: PricedLine[];
};

const money = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;

export function calculateDiscount(amount: number, type: DiscountType = "fixed", value = 0): number {
  if (!Number.isFinite(amount) || amount < 0 || !Number.isFinite(value) || value < 0) {
    throw new ProcurementPricingError("Amounts and discounts must be finite non-negative numbers.");
  }
  if (type === "percentage" && value > 100) throw new ProcurementPricingError("Percentage discounts cannot exceed 100%.");
  return money(Math.min(amount, type === "percentage" ? amount * value / 100 : value));
}

export function calculateDocumentTotals(
  inputs: PricedLineInput[],
  documentDiscountType: DiscountType = "fixed",
  documentDiscountValue = 0,
): DocumentTotals {
  const initial = inputs.map((line) => {
    const quantity = Number(line.quantity);
    const unitPrice = Number(line.unitPrice);
    const taxRate = Number(line.taxRate ?? 0);
    if (!Number.isInteger(quantity) || quantity < 1 || !Number.isFinite(unitPrice) || unitPrice < 0 ||
        !Number.isFinite(taxRate) || taxRate < 0 || taxRate > 100) {
      throw new ProcurementPricingError("Line quantity, price, or tax rate is invalid.");
    }
    const grossAmount = money(quantity * unitPrice);
    const discountAmount = calculateDiscount(grossAmount, line.discountType ?? "fixed", Number(line.discountValue ?? 0));
    return { grossAmount, discountAmount, base: money(grossAmount - discountAmount), taxRate, taxInclusive: Boolean(line.taxInclusive) };
  });
  const undiscountedSubtotal = money(initial.reduce((sum, line) => sum + line.base, 0));
  const documentDiscountAmount = calculateDiscount(
    undiscountedSubtotal,
    documentDiscountType,
    Number(documentDiscountValue ?? 0),
  );
  const subtotalCents = Math.round(undiscountedSubtotal * 100);
  const discountCents = Math.round(documentDiscountAmount * 100);
  const allocations = initial.map(line => {
    const exact = subtotalCents > 0 ? Math.round(line.base * 100) * discountCents / subtotalCents : 0;
    return { cents: Math.floor(exact), remainder: exact - Math.floor(exact) };
  });
  let unallocated = discountCents - allocations.reduce((sum, allocation) => sum + allocation.cents, 0);
  const allocationOrder = allocations.map((allocation, index) => ({ ...allocation, index }))
    .sort((left, right) => right.remainder - left.remainder);
  for (const allocation of allocationOrder) {
    if (unallocated <= 0) break;
    allocations[allocation.index].cents++;
    unallocated--;
  }
  const lines = initial.map((line, index) => {
    const taxableAmount = money(line.base - allocations[index].cents / 100);
    const taxAmount = money(line.taxInclusive
      ? taxableAmount * line.taxRate / (100 + line.taxRate || 100)
      : taxableAmount * line.taxRate / 100);
    return {
      grossAmount: line.grossAmount,
      discountAmount: line.discountAmount,
      taxableAmount,
      taxAmount,
      totalAmount: money(taxableAmount + (line.taxInclusive ? 0 : taxAmount)),
    };
  });
  const subtotal = money(lines.reduce((sum, line) => sum + line.taxableAmount, 0));
  const taxAmount = money(lines.reduce((sum, line) => sum + line.taxAmount, 0));
  const grandTotal = money(lines.reduce((sum, line) => sum + line.totalAmount, 0));
  return { subtotal, documentDiscountAmount, taxAmount, grandTotal, lines };
}

/** Rendering an unfinished form must never throw; APIs use the strict calculator. */
export function previewDocumentTotals(...args: Parameters<typeof calculateDocumentTotals>): DocumentTotals & { validationError?: string } {
  try {
    return calculateDocumentTotals(...args);
  } catch (error) {
    return { subtotal: 0, documentDiscountAmount: 0, taxAmount: 0, grandTotal: 0, lines: [], validationError: error instanceof Error ? error.message : "Invalid pricing" };
  }
}
