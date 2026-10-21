CREATE TABLE IF NOT EXISTS service_catalog_items (
  id varchar PRIMARY KEY REFERENCES catalog_items(id) ON DELETE RESTRICT,
  title text NOT NULL,
  category text NOT NULL,
  description text,
  icon text,
  sla_hours integer NOT NULL DEFAULT 24,
  requires_approval boolean NOT NULL DEFAULT false,
  approver_role text,
  custom_fields_schema jsonb NOT NULL DEFAULT '[]'::jsonb,
  status text NOT NULL DEFAULT 'Active',
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now(),
  CONSTRAINT service_catalog_items_valid_status CHECK (status IN ('Active', 'Inactive')),
  CONSTRAINT service_catalog_items_positive_sla CHECK (sla_hours > 0),
  CONSTRAINT service_catalog_items_approver_check CHECK (
    NOT requires_approval OR approver_role IN ('Manager', 'IT Director') AND approver_role IS NOT NULL
  )
);
CREATE INDEX IF NOT EXISTS service_catalog_items_status_category_idx ON service_catalog_items (status, category);
INSERT INTO service_catalog_items (id, title, category, description, icon, sla_hours, requires_approval, approver_role, status)
SELECT id, name,
  CASE lower(category)
    WHEN 'hardware' THEN 'Hardware' WHEN 'software' THEN 'Software' WHEN 'access' THEN 'Access'
    WHEN 'network' THEN 'Infrastructure' WHEN 'facilities' THEN 'Infrastructure' ELSE category END,
  description, icon, CASE WHEN sla_hours > 0 THEN sla_hours ELSE 24 END,
  coalesce(approval_required, false),
  CASE WHEN approval_required THEN 'Manager' ELSE NULL END,
  CASE WHEN is_active THEN 'Active' ELSE 'Inactive' END
FROM catalog_items ON CONFLICT DO NOTHING;

ALTER TABLE service_requests ADD COLUMN IF NOT EXISTS service_catalog_item_id varchar REFERENCES service_catalog_items(id) ON DELETE RESTRICT;
ALTER TABLE service_requests ADD COLUMN IF NOT EXISTS custom_field_values jsonb NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE service_requests ADD COLUMN IF NOT EXISTS catalog_schema_snapshot jsonb NOT NULL DEFAULT '[]'::jsonb;
CREATE TABLE IF NOT EXISTS service_requests_approvals (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id varchar NOT NULL REFERENCES service_requests(id) ON DELETE RESTRICT,
  approver_id varchar REFERENCES users(id) ON DELETE SET NULL,
  approver_role text NOT NULL,
  status text NOT NULL DEFAULT 'Pending',
  comments text,
  decided_at timestamp,
  created_at timestamp NOT NULL DEFAULT now(),
  CONSTRAINT service_requests_approvals_valid_role CHECK (approver_role IN ('Manager', 'IT Director')),
  CONSTRAINT service_requests_approvals_valid_status CHECK (status IN ('Pending', 'Approved', 'Rejected')),
  CONSTRAINT service_requests_approvals_decision_note CHECK (
    status = 'Pending' OR (decided_at IS NOT NULL AND length(trim(comments)) >= 5 AND comments IS NOT NULL)
  )
);
CREATE UNIQUE INDEX IF NOT EXISTS service_requests_approvals_ticket_unique ON service_requests_approvals (ticket_id);
CREATE INDEX IF NOT EXISTS service_requests_approvals_pending_role_idx ON service_requests_approvals (status, approver_role, created_at);
INSERT INTO dropdown_options (category, value, label, display_order, is_active)
VALUES ('service_category', 'Hardware', 'Hardware', 0, true),
       ('service_category', 'Software', 'Software', 1, true),
       ('service_category', 'Access', 'Access', 2, true),
       ('service_category', 'Infrastructure', 'Infrastructure', 3, true)
ON CONFLICT DO NOTHING;
