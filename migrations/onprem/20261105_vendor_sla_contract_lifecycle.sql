ALTER TABLE vendors ADD COLUMN IF NOT EXISTS code text;
ALTER TABLE vendors ADD COLUMN IF NOT EXISTS primary_contact_name text;
ALTER TABLE vendors ADD COLUMN IF NOT EXISTS primary_contact_email text;
ALTER TABLE vendors ADD COLUMN IF NOT EXISTS primary_contact_phone text;
ALTER TABLE vendors ADD COLUMN IF NOT EXISTS support_hotline text;
ALTER TABLE contracts ADD COLUMN IF NOT EXISTS currency text NOT NULL DEFAULT 'USD';
CREATE UNIQUE INDEX IF NOT EXISTS vendors_code_normalized_unique ON vendors (lower(btrim(code))) WHERE code IS NOT NULL;
CREATE TABLE IF NOT EXISTS vendor_contracts (
  id varchar PRIMARY KEY REFERENCES contracts(id) ON DELETE RESTRICT,
  vendor_id varchar NOT NULL REFERENCES vendors(id) ON DELETE RESTRICT,
  title text NOT NULL,
  contract_number text NOT NULL,
  contract_type text NOT NULL,
  start_date date NOT NULL,
  end_date date NOT NULL,
  renewal_notice_days integer NOT NULL DEFAULT 30,
  cost numeric(15,2) NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'USD',
  sla_tier text,
  status text NOT NULL DEFAULT 'Active',
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now(),
  CONSTRAINT vendor_contracts_dates_check CHECK (end_date >= start_date),
  CONSTRAINT vendor_contracts_cost_check CHECK (cost >= 0),
  CONSTRAINT vendor_contracts_notice_check CHECK (renewal_notice_days BETWEEN 0 AND 3650),
  CONSTRAINT vendor_contracts_currency_check CHECK (currency ~ '^[A-Z]{3}$'),
  CONSTRAINT vendor_contracts_status_check CHECK (status IN ('Active', 'Expiring Soon', 'Expired', 'Terminated'))
);
CREATE UNIQUE INDEX IF NOT EXISTS vendor_contracts_number_unique ON vendor_contracts (lower(btrim(contract_number)));
CREATE INDEX IF NOT EXISTS vendor_contracts_vendor_idx ON vendor_contracts (vendor_id);
CREATE INDEX IF NOT EXISTS vendor_contracts_end_date_idx ON vendor_contracts (end_date);
CREATE TABLE IF NOT EXISTS vendor_contract_assets (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id varchar NOT NULL REFERENCES vendor_contracts(id) ON DELETE CASCADE,
  asset_id varchar NOT NULL REFERENCES assets(id) ON DELETE RESTRICT
);
CREATE UNIQUE INDEX IF NOT EXISTS vendor_contract_assets_unique ON vendor_contract_assets (contract_id, asset_id);
CREATE TABLE IF NOT EXISTS vendor_contract_purchase_orders (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id varchar NOT NULL REFERENCES vendor_contracts(id) ON DELETE CASCADE,
  purchase_order_id varchar NOT NULL REFERENCES purchase_orders(id) ON DELETE RESTRICT
);
CREATE UNIQUE INDEX IF NOT EXISTS vendor_contract_purchase_orders_unique ON vendor_contract_purchase_orders (contract_id, purchase_order_id);
CREATE TABLE IF NOT EXISTS vendor_contract_servers (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id varchar NOT NULL REFERENCES vendor_contracts(id) ON DELETE CASCADE,
  server_id varchar NOT NULL REFERENCES servers(id) ON DELETE RESTRICT
);
CREATE UNIQUE INDEX IF NOT EXISTS vendor_contract_servers_unique ON vendor_contract_servers (contract_id, server_id);
INSERT INTO dropdown_options (category,value,label,display_order,is_active) VALUES
 ('vendor_category','Hardware Supplier','Hardware Supplier',0,true),
 ('vendor_category','Software Vendor','Software Vendor',1,true),
 ('vendor_category','Telecom/ISP','Telecom/ISP',2,true),
 ('vendor_category','Cloud Provider','Cloud Provider',3,true),
 ('vendor_category','Managed Services','Managed Services',4,true),
 ('contract_type','SLA Support','SLA Support',0,true),
 ('contract_type','Software License','Software License',1,true),
 ('contract_type','Hardware Warranty','Hardware Warranty',2,true),
 ('contract_type','ISP Link','ISP Link',3,true)
ON CONFLICT DO NOTHING;
