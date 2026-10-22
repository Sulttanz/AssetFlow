CREATE TABLE IF NOT EXISTS asset_handovers (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  handover_number text NOT NULL UNIQUE,
  type text NOT NULL,
  employee_id varchar NOT NULL REFERENCES employees(id) ON DELETE RESTRICT,
  asset_id varchar NOT NULL REFERENCES assets(id) ON DELETE RESTRICT,
  assignment_id varchar NOT NULL REFERENCES assignments(id) ON DELETE RESTRICT,
  issued_by_user_id varchar REFERENCES users(id) ON DELETE SET NULL,
  handover_date date NOT NULL,
  condition text NOT NULL,
  included_accessories jsonb NOT NULL DEFAULT '[]'::jsonb,
  notes text,
  acknowledged boolean NOT NULL DEFAULT false,
  acknowledged_at timestamp,
  signature_data text,
  created_at timestamp NOT NULL DEFAULT now(),
  CONSTRAINT asset_handovers_type_check CHECK (type IN ('Issue / Assignment', 'Return / Offboarding', 'Replacement / Swap')),
  CONSTRAINT asset_handovers_condition_check CHECK (condition IN ('New', 'Excellent', 'Fair', 'Needs Repair')),
  CONSTRAINT asset_handovers_accessories_array_check CHECK (jsonb_typeof(included_accessories) = 'array'),
  CONSTRAINT asset_handovers_acknowledgement_check CHECK (
    (acknowledged = false AND acknowledged_at IS NULL AND signature_data IS NULL)
    OR (acknowledged = true AND acknowledged_at IS NOT NULL AND signature_data IS NOT NULL)
  )
);
CREATE INDEX IF NOT EXISTS asset_handovers_employee_created_idx ON asset_handovers (employee_id, created_at);
CREATE INDEX IF NOT EXISTS asset_handovers_asset_created_idx ON asset_handovers (asset_id, created_at);
CREATE INDEX IF NOT EXISTS asset_handovers_assignment_idx ON asset_handovers (assignment_id);
INSERT INTO dropdown_options (category, value, label, display_order, is_active)
VALUES ('handover_type', 'Issue / Assignment', 'Issue / Assignment', 0, true),
       ('handover_type', 'Return / Offboarding', 'Return / Offboarding', 1, true),
       ('handover_type', 'Replacement / Swap', 'Replacement / Swap', 2, true),
       ('asset_condition', 'New', 'New', 0, true),
       ('asset_condition', 'Excellent', 'Excellent', 1, true),
       ('asset_condition', 'Fair', 'Fair', 2, true),
       ('asset_condition', 'Needs Repair', 'Needs Repair', 3, true)
ON CONFLICT DO NOTHING;
