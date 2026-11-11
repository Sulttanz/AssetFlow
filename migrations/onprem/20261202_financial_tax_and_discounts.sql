ALTER TABLE vendor_quotations
  ADD COLUMN IF NOT EXISTS tax_rate numeric(7,4) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS tax_mode text NOT NULL DEFAULT 'exclusive',
  ADD COLUMN IF NOT EXISTS document_discount_type text NOT NULL DEFAULT 'fixed',
  ADD COLUMN IF NOT EXISTS document_discount_value numeric(14,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS document_discount_amount numeric(14,2) NOT NULL DEFAULT 0;

ALTER TABLE vendor_quotation_items
  ADD COLUMN IF NOT EXISTS discount_type text NOT NULL DEFAULT 'fixed',
  ADD COLUMN IF NOT EXISTS discount_value numeric(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS discount_amount numeric(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS tax_rate numeric(7,4) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS tax_inclusive boolean NOT NULL DEFAULT false;

ALTER TABLE purchase_orders
  ADD COLUMN IF NOT EXISTS currency text NOT NULL DEFAULT 'USD',
  ADD COLUMN IF NOT EXISTS subtotal numeric(14,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS tax_rate numeric(7,4) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS tax_mode text NOT NULL DEFAULT 'exclusive',
  ADD COLUMN IF NOT EXISTS document_discount_type text NOT NULL DEFAULT 'fixed',
  ADD COLUMN IF NOT EXISTS document_discount_value numeric(14,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS document_discount_amount numeric(14,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS tax_amount numeric(14,2) NOT NULL DEFAULT 0;

ALTER TABLE purchase_order_items
  ADD COLUMN IF NOT EXISTS discount_type text NOT NULL DEFAULT 'fixed',
  ADD COLUMN IF NOT EXISTS discount_value numeric(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS discount_amount numeric(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS tax_rate numeric(7,4) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS tax_inclusive boolean NOT NULL DEFAULT false;

ALTER TABLE purchase_invoices
  ADD COLUMN IF NOT EXISTS tax_rate numeric(7,4) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS tax_mode text NOT NULL DEFAULT 'exclusive',
  ADD COLUMN IF NOT EXISTS document_discount_type text NOT NULL DEFAULT 'fixed',
  ADD COLUMN IF NOT EXISTS document_discount_value numeric(14,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS document_discount_amount numeric(14,2) NOT NULL DEFAULT 0;

ALTER TABLE purchase_invoice_items
  ADD COLUMN IF NOT EXISTS discount_type text NOT NULL DEFAULT 'fixed',
  ADD COLUMN IF NOT EXISTS discount_value numeric(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS discount_amount numeric(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS tax_rate numeric(7,4) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS tax_inclusive boolean NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS purchase_invoice_match_lines (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id varchar NOT NULL REFERENCES purchase_invoices(id) ON DELETE CASCADE,
  purchase_order_item_id varchar NOT NULL REFERENCES purchase_order_items(id) ON DELETE RESTRICT,
  description text NOT NULL,
  quantity integer NOT NULL,
  unit_price numeric(12,2) NOT NULL,
  discount_type text NOT NULL DEFAULT 'fixed',
  discount_value numeric(12,2) NOT NULL DEFAULT 0,
  discount_amount numeric(12,2) NOT NULL DEFAULT 0,
  tax_rate numeric(7,4) NOT NULL DEFAULT 0,
  tax_inclusive boolean NOT NULL DEFAULT false,
  total_price numeric(14,2) NOT NULL,
  CONSTRAINT purchase_invoice_match_line_amount_check CHECK (quantity > 0 AND unit_price >= 0 AND total_price >= 0)
);
CREATE UNIQUE INDEX IF NOT EXISTS purchase_invoice_match_line_unique ON purchase_invoice_match_lines(invoice_id, purchase_order_item_id);
CREATE INDEX IF NOT EXISTS purchase_invoice_match_line_po_item_idx ON purchase_invoice_match_lines(purchase_order_item_id);

CREATE TABLE IF NOT EXISTS finance_tax_settings (
  id serial PRIMARY KEY,
  region_code text NOT NULL UNIQUE DEFAULT 'SA',
  default_tax_rate numeric(7,4) NOT NULL DEFAULT 15.0000,
  default_tax_mode text NOT NULL DEFAULT 'exclusive',
  currency_code text NOT NULL DEFAULT 'SAR',
  updated_by varchar REFERENCES users(id) ON DELETE SET NULL,
  updated_at timestamp NOT NULL DEFAULT now(),
  CONSTRAINT finance_tax_settings_rate_check CHECK (default_tax_rate >= 0 AND default_tax_rate <= 100),
  CONSTRAINT finance_tax_settings_mode_check CHECK (default_tax_mode IN ('exclusive','inclusive')),
  CONSTRAINT finance_tax_settings_currency_check CHECK (currency_code ~ '^[A-Z]{3}$')
);

INSERT INTO finance_tax_settings (region_code, default_tax_rate, default_tax_mode, currency_code)
VALUES ('SA', 15.0000, 'exclusive', 'SAR')
ON CONFLICT (region_code) DO NOTHING;
