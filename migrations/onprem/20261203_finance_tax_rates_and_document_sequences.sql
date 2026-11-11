CREATE TABLE IF NOT EXISTS finance_tax_rates (
  id serial PRIMARY KEY,
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  classification text NOT NULL DEFAULT 'standard',
  rate numeric(7,4) NOT NULL,
  tax_mode text NOT NULL DEFAULT 'exclusive',
  is_active boolean NOT NULL DEFAULT true,
  is_default boolean NOT NULL DEFAULT false,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now(),
  CONSTRAINT finance_tax_rates_classification_check CHECK (classification IN ('standard','reduced','zero_rated','exempt','custom')),
  CONSTRAINT finance_tax_rates_rate_check CHECK (rate >= 0 AND rate <= 100),
  CONSTRAINT finance_tax_rates_mode_check CHECK (tax_mode IN ('exclusive','inclusive')),
  CONSTRAINT finance_tax_rates_default_active_check CHECK (NOT is_default OR is_active)
);
CREATE UNIQUE INDEX IF NOT EXISTS finance_tax_rates_single_default_idx ON finance_tax_rates(is_default) WHERE is_default = true;
CREATE INDEX IF NOT EXISTS finance_tax_rates_active_sort_idx ON finance_tax_rates(is_active, sort_order, name);

INSERT INTO finance_tax_rates (code, name, classification, rate, tax_mode, is_active, is_default, sort_order)
VALUES
  ('STANDARD_VAT', 'Standard VAT 15%', 'standard', 15.0000, 'exclusive', true, true, 10),
  ('REDUCED_VAT', 'Reduced VAT 5%', 'reduced', 5.0000, 'exclusive', true, false, 20),
  ('ZERO_RATED', 'Zero-rated', 'zero_rated', 0.0000, 'exclusive', true, false, 30),
  ('EXEMPT', 'Exempt', 'exempt', 0.0000, 'exclusive', true, false, 40)
ON CONFLICT (code) DO NOTHING;

CREATE TABLE IF NOT EXISTS finance_document_sequences (
  id serial PRIMARY KEY,
  document_type text NOT NULL UNIQUE,
  numbering_mode text NOT NULL DEFAULT 'auto',
  prefix text NOT NULL,
  next_number integer NOT NULL DEFAULT 1,
  padding integer NOT NULL DEFAULT 4,
  reset_yearly boolean NOT NULL DEFAULT true,
  sequence_year integer NOT NULL DEFAULT EXTRACT(YEAR FROM CURRENT_DATE)::integer,
  updated_by varchar REFERENCES users(id) ON DELETE SET NULL,
  updated_at timestamp NOT NULL DEFAULT now(),
  CONSTRAINT finance_document_sequences_type_check CHECK (document_type IN ('quotation','purchase_order','invoice')),
  CONSTRAINT finance_document_sequences_mode_check CHECK (numbering_mode IN ('auto','manual')),
  CONSTRAINT finance_document_sequences_next_check CHECK (next_number >= 1),
  CONSTRAINT finance_document_sequences_padding_check CHECK (padding BETWEEN 1 AND 12)
);
CREATE INDEX IF NOT EXISTS finance_document_sequences_type_idx ON finance_document_sequences(document_type);

INSERT INTO finance_document_sequences (document_type, numbering_mode, prefix, next_number, padding, reset_yearly)
VALUES
  ('quotation', 'auto', 'QT-{YYYY}-', 1, 4, true),
  ('purchase_order', 'auto', 'PO-{YYYY}-', 1, 4, true),
  ('invoice', 'auto', 'INV-{YYYY}-', 1, 4, true)
ON CONFLICT (document_type) DO NOTHING;
