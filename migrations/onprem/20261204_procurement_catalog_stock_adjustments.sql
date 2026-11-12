ALTER TABLE vendor_quotation_items
  ADD COLUMN IF NOT EXISTS consumable_id varchar REFERENCES consumables(id) ON DELETE SET NULL;

ALTER TABLE consumable_stock_movements
  ADD COLUMN IF NOT EXISTS reason_code text;

CREATE INDEX IF NOT EXISTS vendor_quotation_items_consumable_idx
  ON vendor_quotation_items(consumable_id);
