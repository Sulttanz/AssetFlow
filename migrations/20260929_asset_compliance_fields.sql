-- Additive, nullable asset-specific fields. Vendor compliance and audit dates
-- are independent and must not be copied into existing asset records.
ALTER TABLE assets ADD COLUMN IF NOT EXISTS compliance_status text;
ALTER TABLE assets ADD COLUMN IF NOT EXISTS next_audit_date date;