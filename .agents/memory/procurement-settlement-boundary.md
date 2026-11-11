---
name: Procurement settlement boundaries
description: Distinguish physical receipts, invoice confirmation, supplier credits, and cash settlement.
---

Processing an approved, matched supplier invoice triggers PO receiving and inventory creation. Match ordered lines before physical receipts exist, and reuse the PO's existing receiving idempotency boundary rather than adding stock a second time.

**Why:** The user requested the decoupled quotation → PO → invoice → inventory workflow, replacing the earlier requirement to receive stock before creating an invoice.

**How to apply:** Commit invoice receipt confirmation, PO status, stock movements, and physical receipt links atomically. Keep internal approval separate from the explicit receiving action, and preserve existing receipts on retries.

Receipt confirmation currently means full-order delivery. Require every ordered quantity to be matched to approved invoices before creating the PO's inventory; partial invoices may remain approved.

**Why:** A partial supplier bill must not silently add stock for the entire order.

**How to apply:** Treat partial-delivery receiving as a separate capability requiring quantity-aware receipts, rather than weakening the full-order safeguard.

Approved supplier returns create debit-note credits, not cash payments or automatic refunds. Linked credits reduce the invoice's outstanding payable; payment-method reporting follows actual payment entries, not the invoice's intended settlement method.

**Why:** Treating a supplier credit as cash paid inflates settlement reports and permits overpayment. An invoice on credit terms can be settled using multiple bank or cash payments.

**How to apply:** Subtract both recorded payments and approved linked credits before accepting another payment. Preserve excess supplier credit separately rather than inventing a cash refund.
