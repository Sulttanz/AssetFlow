---
name: Procurement settlement boundaries
description: Distinguish physical receipts, invoice confirmation, supplier credits, and cash settlement.
---

Physical inventory receiving and invoice receipt confirmation are separate events. Invoice matching requires a recorded physical receipt; confirming an invoice must reuse that receipt rather than adding inventory again.

**Why:** A three-way match proves that goods arrived, but invoice approval is not a second delivery.

**How to apply:** Keep the existing per-line receiving idempotency boundary when extending invoice workflows.

Approved supplier returns create debit-note credits, not cash payments or automatic refunds. Linked credits reduce the invoice's outstanding payable; payment-method reporting follows actual payment entries, not the invoice's intended settlement method.

**Why:** Treating a supplier credit as cash paid inflates settlement reports and permits overpayment. An invoice on credit terms can be settled using multiple bank or cash payments.

**How to apply:** Subtract both recorded payments and approved linked credits before accepting another payment. Preserve excess supplier credit separately rather than inventing a cash refund.
