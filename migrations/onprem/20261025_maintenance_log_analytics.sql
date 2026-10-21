ALTER TABLE maintenance_records
  ADD COLUMN IF NOT EXISTS estimated_cost decimal(10, 2);

ALTER TABLE maintenance_records
  ADD COLUMN IF NOT EXISTS scheduled_date date;
