CREATE TABLE IF NOT EXISTS vendor_quotations (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id varchar NOT NULL REFERENCES vendors(id) ON DELETE RESTRICT,
  quote_number text NOT NULL UNIQUE,
  issue_date date NOT NULL,
  valid_until date,
  currency text NOT NULL DEFAULT 'USD',
  subtotal numeric(14,2) NOT NULL DEFAULT 0,
  tax_amount numeric(14,2) NOT NULL DEFAULT 0,
  total_amount numeric(14,2) NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'draft',
  notes text,
  created_by varchar REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now(),
  CONSTRAINT vendor_quotations_status_check CHECK (status IN ('draft','submitted','accepted','converted','rejected','expired')),
  CONSTRAINT vendor_quotations_amounts_check CHECK (subtotal >= 0 AND tax_amount >= 0 AND total_amount >= 0)
);
CREATE INDEX IF NOT EXISTS vendor_quotations_vendor_status_idx ON vendor_quotations(vendor_id, status);

ALTER TABLE purchase_orders
  ADD COLUMN IF NOT EXISTS quotation_id varchar REFERENCES vendor_quotations(id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS vendor_quotation_items (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  quotation_id varchar NOT NULL REFERENCES vendor_quotations(id) ON DELETE CASCADE,
  description text NOT NULL,
  item_type text NOT NULL DEFAULT 'asset',
  quantity integer NOT NULL,
  unit_price numeric(12,2) NOT NULL,
  total_price numeric(14,2) NOT NULL,
  asset_type text,
  consumable_category text,
  model_part_number text,
  warehouse_location_id varchar REFERENCES warehouse_locations(id) ON DELETE SET NULL,
  CONSTRAINT vendor_quotation_items_type_check CHECK (item_type IN ('asset','consumable')),
  CONSTRAINT vendor_quotation_items_amount_check CHECK (quantity > 0 AND unit_price >= 0 AND total_price >= 0)
);
CREATE INDEX IF NOT EXISTS vendor_quotation_items_quote_idx ON vendor_quotation_items(quotation_id);

CREATE TABLE IF NOT EXISTS purchase_invoices (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id varchar NOT NULL REFERENCES vendors(id) ON DELETE RESTRICT,
  purchase_order_id varchar NOT NULL REFERENCES purchase_orders(id) ON DELETE RESTRICT,
  invoice_number text NOT NULL,
  issue_date date NOT NULL,
  due_date date NOT NULL,
  currency text NOT NULL DEFAULT 'USD',
  subtotal numeric(14,2) NOT NULL,
  tax_amount numeric(14,2) NOT NULL DEFAULT 0,
  grand_total numeric(14,2) NOT NULL,
  payment_method text NOT NULL,
  payment_terms text,
  payment_status text NOT NULL DEFAULT 'pending',
  status text NOT NULL DEFAULT 'pending',
  received_at timestamp,
  approved_at timestamp,
  notes text,
  created_by varchar REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now(),
  CONSTRAINT purchase_invoices_vendor_number_unique UNIQUE(vendor_id, invoice_number),
  CONSTRAINT purchase_invoices_method_check CHECK (payment_method IN ('cash','bank_transfer','credit_terms')),
  CONSTRAINT purchase_invoices_payment_status_check CHECK (payment_status IN ('pending','paid','partially_paid')),
  CONSTRAINT purchase_invoices_status_check CHECK (status IN ('pending','approved','received','void')),
  CONSTRAINT purchase_invoices_amounts_check CHECK (subtotal >= 0 AND tax_amount >= 0 AND grand_total >= 0),
  CONSTRAINT purchase_invoices_dates_check CHECK (due_date >= issue_date)
);
CREATE INDEX IF NOT EXISTS purchase_invoices_vendor_status_idx ON purchase_invoices(vendor_id, payment_status, due_date);
CREATE INDEX IF NOT EXISTS purchase_invoices_po_idx ON purchase_invoices(purchase_order_id);

CREATE TABLE IF NOT EXISTS purchase_invoice_items (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id varchar NOT NULL REFERENCES purchase_invoices(id) ON DELETE CASCADE,
  purchase_order_item_id varchar NOT NULL REFERENCES purchase_order_items(id) ON DELETE RESTRICT,
  receipt_id varchar NOT NULL REFERENCES purchase_order_item_receipts(id) ON DELETE RESTRICT,
  description text NOT NULL,
  quantity integer NOT NULL,
  unit_price numeric(12,2) NOT NULL,
  total_price numeric(14,2) NOT NULL,
  CONSTRAINT purchase_invoice_items_amount_check CHECK (quantity > 0 AND unit_price >= 0 AND total_price >= 0)
);
CREATE INDEX IF NOT EXISTS purchase_invoice_items_invoice_idx ON purchase_invoice_items(invoice_id);

CREATE TABLE IF NOT EXISTS purchase_invoice_payments (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id varchar NOT NULL REFERENCES purchase_invoices(id) ON DELETE RESTRICT,
  payment_date date NOT NULL,
  amount numeric(14,2) NOT NULL,
  payment_method text NOT NULL,
  reference_number text,
  notes text,
  recorded_by varchar REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamp NOT NULL DEFAULT now(),
  CONSTRAINT purchase_invoice_payments_amount_check CHECK (amount > 0),
  CONSTRAINT purchase_invoice_payments_method_check CHECK (payment_method IN ('cash','bank_transfer','credit_terms'))
);
CREATE INDEX IF NOT EXISTS purchase_invoice_payments_invoice_idx ON purchase_invoice_payments(invoice_id, payment_date);

CREATE TABLE IF NOT EXISTS purchase_returns (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  return_number text NOT NULL UNIQUE,
  debit_note_number text NOT NULL UNIQUE,
  vendor_id varchar NOT NULL REFERENCES vendors(id) ON DELETE RESTRICT,
  purchase_order_id varchar NOT NULL REFERENCES purchase_orders(id) ON DELETE RESTRICT,
  purchase_invoice_id varchar REFERENCES purchase_invoices(id) ON DELETE SET NULL,
  return_date date NOT NULL DEFAULT CURRENT_DATE,
  reason_code text NOT NULL,
  status text NOT NULL DEFAULT 'draft',
  currency text NOT NULL DEFAULT 'USD',
  total_credit numeric(14,2) NOT NULL DEFAULT 0,
  notes text,
  processed_at timestamp,
  created_by varchar REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamp NOT NULL DEFAULT now(),
  CONSTRAINT purchase_returns_reason_check CHECK (reason_code IN ('defective','wrong_item','excess','other')),
  CONSTRAINT purchase_returns_status_check CHECK (status IN ('draft','approved','rejected')),
  CONSTRAINT purchase_returns_credit_check CHECK (total_credit >= 0)
);
CREATE INDEX IF NOT EXISTS purchase_returns_vendor_date_idx ON purchase_returns(vendor_id, return_date);

CREATE TABLE IF NOT EXISTS purchase_return_items (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  return_id varchar NOT NULL REFERENCES purchase_returns(id) ON DELETE CASCADE,
  purchase_order_item_id varchar NOT NULL REFERENCES purchase_order_items(id) ON DELETE RESTRICT,
  consumable_id varchar REFERENCES consumables(id) ON DELETE RESTRICT,
  asset_id varchar REFERENCES assets(id) ON DELETE RESTRICT,
  warehouse_location_id varchar REFERENCES warehouse_locations(id) ON DELETE SET NULL,
  quantity integer NOT NULL,
  unit_price numeric(12,2) NOT NULL,
  total_credit numeric(14,2) NOT NULL,
  reason_code text NOT NULL,
  CONSTRAINT purchase_return_items_quantity_check CHECK (quantity > 0 AND unit_price >= 0 AND total_credit >= 0),
  CONSTRAINT purchase_return_items_target_check CHECK (
    (consumable_id IS NOT NULL AND asset_id IS NULL) OR
    (consumable_id IS NULL AND asset_id IS NOT NULL)
  )
);
CREATE INDEX IF NOT EXISTS purchase_return_items_return_idx ON purchase_return_items(return_id);
