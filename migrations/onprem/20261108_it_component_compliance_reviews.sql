CREATE TABLE IF NOT EXISTS it_component_compliance_reviews (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  component_type text NOT NULL,
  component_id varchar NOT NULL,
  baseline_standard text,
  compliance_status text NOT NULL DEFAULT 'pending_review'
    CHECK (compliance_status IN ('compliant', 'non_compliant', 'pending_review')),
  last_reviewed_at date,
  review_frequency text NOT NULL DEFAULT 'quarterly'
    CHECK (review_frequency IN ('monthly', 'quarterly', 'annual')),
  findings text,
  remediation_notes text,
  reviewed_by_id varchar REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS it_component_compliance_reviews_component_unique
  ON it_component_compliance_reviews (component_type, component_id);
CREATE INDEX IF NOT EXISTS it_component_compliance_reviews_status_idx
  ON it_component_compliance_reviews (compliance_status, last_reviewed_at);
