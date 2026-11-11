export const PURCHASE_ORDER_NEXT_STATUS: Record<string, "approved" | "ordered" | null> = {
  pending: "approved",
  approved: "ordered",
  ordered: null,
  received: null,
  cancelled: null,
};

export function canTransitionPurchaseOrder(
  current: string,
  next: string,
  source: "manual" | "invoice_receipt" = "manual",
): boolean {
  if (!(current in PURCHASE_ORDER_NEXT_STATUS) || !(next in PURCHASE_ORDER_NEXT_STATUS)) return false;
  if (current === next) return true;
  if (source === "invoice_receipt") return current === "ordered" && next === "received";
  if (next === "cancelled") return ["pending", "approved", "ordered"].includes(current);
  return PURCHASE_ORDER_NEXT_STATUS[current] === next;
}
