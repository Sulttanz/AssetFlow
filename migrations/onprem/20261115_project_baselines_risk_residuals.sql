CREATE TABLE IF NOT EXISTS project_baselines (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id varchar NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  version_number varchar(20) NOT NULL,
  baseline_budget numeric(12, 2) NOT NULL
    CONSTRAINT project_baselines_budget_nonnegative_check CHECK (baseline_budget >= 0),
  baseline_start_date date NOT NULL,
  baseline_target_end_date date NOT NULL,
  approved_by varchar REFERENCES users(id) ON DELETE SET NULL,
  revision_note text,
  created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT project_baselines_target_after_start_check CHECK (baseline_target_end_date >= baseline_start_date)
);
CREATE UNIQUE INDEX IF NOT EXISTS project_baselines_project_version_uq
  ON project_baselines(project_id, version_number);
CREATE INDEX IF NOT EXISTS project_baselines_project_created_idx
  ON project_baselines(project_id, created_at);

ALTER TABLE project_risks
  ADD COLUMN IF NOT EXISTS residual_probability integer
    CONSTRAINT project_risks_residual_probability_check CHECK (residual_probability IS NULL OR residual_probability BETWEEN 1 AND 5);
ALTER TABLE project_risks
  ADD COLUMN IF NOT EXISTS residual_impact integer
    CONSTRAINT project_risks_residual_impact_check CHECK (residual_impact IS NULL OR residual_impact BETWEEN 1 AND 5);
ALTER TABLE project_risks
  ADD COLUMN IF NOT EXISTS contingency_plan text;
ALTER TABLE project_risks
  ADD COLUMN IF NOT EXISTS review_date date;
