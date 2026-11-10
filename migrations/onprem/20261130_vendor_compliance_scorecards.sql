CREATE TABLE IF NOT EXISTS vendor_certifications (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id varchar NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
  certification_name text NOT NULL,
  certificate_number text,
  issue_date date NOT NULL,
  expiry_date date NOT NULL,
  document_url text,
  notes text,
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now(),
  updated_by varchar REFERENCES users(id) ON DELETE SET NULL,
  CONSTRAINT vendor_certifications_dates_check CHECK (expiry_date >= issue_date),
  CONSTRAINT vendor_certifications_document_url_check CHECK (document_url IS NULL OR document_url ~* '^https?://')
);

CREATE INDEX IF NOT EXISTS vendor_certifications_vendor_expiry_idx
  ON vendor_certifications (vendor_id, expiry_date);
