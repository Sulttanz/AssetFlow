CREATE TABLE IF NOT EXISTS warehouse_locations (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  code text NOT NULL UNIQUE,
  storage_room text,
  description text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp DEFAULT now()
);

CREATE TABLE IF NOT EXISTS consumables (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  category text NOT NULL DEFAULT 'Other',
  model_part_number text,
  quantity_in_stock integer NOT NULL DEFAULT 0,
  min_reorder_level integer NOT NULL DEFAULT 0,
  warehouse_location_id varchar NOT NULL REFERENCES warehouse_locations(id),
  storage_room text,
  unit_cost decimal(12, 2) NOT NULL DEFAULT 0.00,
  vendor_id varchar REFERENCES vendors(id) ON DELETE SET NULL,
  created_at timestamp DEFAULT now(),
  updated_at timestamp DEFAULT now()
);

CREATE TABLE IF NOT EXISTS consumable_stock_movements (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  consumable_id varchar NOT NULL REFERENCES consumables(id),
  movement_type text NOT NULL,
  quantity integer NOT NULL,
  from_warehouse_location_id varchar REFERENCES warehouse_locations(id),
  to_warehouse_location_id varchar REFERENCES warehouse_locations(id),
  recipient_user_id varchar REFERENCES users(id) ON DELETE SET NULL,
  actor_id varchar REFERENCES users(id) ON DELETE SET NULL,
  service_request_id varchar REFERENCES service_requests(id) ON DELETE SET NULL,
  purchase_order_id varchar REFERENCES purchase_orders(id) ON DELETE SET NULL,
  notes text,
  created_at timestamp DEFAULT now()
);

CREATE TABLE IF NOT EXISTS consumable_dispatch_log (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  consumable_id varchar NOT NULL REFERENCES consumables(id),
  warehouse_location_id varchar NOT NULL REFERENCES warehouse_locations(id),
  service_request_id varchar NOT NULL REFERENCES service_requests(id),
  service_request_number text NOT NULL,
  requester_id varchar NOT NULL REFERENCES users(id),
  agent_id varchar NOT NULL REFERENCES users(id),
  quantity integer NOT NULL,
  dispatched_at timestamp NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS purchase_order_item_receipts (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_order_id varchar NOT NULL REFERENCES purchase_orders(id),
  purchase_order_item_id varchar NOT NULL UNIQUE REFERENCES purchase_order_items(id),
  processed_at timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS consumables_location_idx ON consumables (warehouse_location_id);
CREATE INDEX IF NOT EXISTS consumables_category_idx ON consumables (category);
CREATE INDEX IF NOT EXISTS consumable_stock_movements_item_idx ON consumable_stock_movements (consumable_id, created_at);
CREATE INDEX IF NOT EXISTS consumable_dispatch_log_item_idx ON consumable_dispatch_log (consumable_id, dispatched_at);
CREATE UNIQUE INDEX IF NOT EXISTS consumable_dispatch_request_unique ON consumable_dispatch_log (service_request_id);

ALTER TABLE purchase_order_items ADD COLUMN IF NOT EXISTS item_type text NOT NULL DEFAULT 'asset';
ALTER TABLE purchase_order_items ADD COLUMN IF NOT EXISTS consumable_id varchar;
ALTER TABLE purchase_order_items ADD COLUMN IF NOT EXISTS consumable_category text;
ALTER TABLE purchase_order_items ADD COLUMN IF NOT EXISTS model_part_number text;
ALTER TABLE purchase_order_items ADD COLUMN IF NOT EXISTS warehouse_location_id varchar;
ALTER TABLE catalog_items ADD COLUMN IF NOT EXISTS consumable_id varchar;
ALTER TABLE service_requests ADD COLUMN IF NOT EXISTS requested_quantity integer NOT NULL DEFAULT 1;
