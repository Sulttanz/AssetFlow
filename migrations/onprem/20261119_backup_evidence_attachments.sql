CREATE TABLE IF NOT EXISTS backup_evidence_attachments (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  job_run_id varchar REFERENCES backup_job_runs(id) ON DELETE RESTRICT,
  restore_test_id varchar REFERENCES backup_restore_tests(id) ON DELETE RESTRICT,
  version integer NOT NULL DEFAULT 1 CHECK (version >= 1),
  original_name text NOT NULL,
  file_name text NOT NULL,
  file_type text NOT NULL,
  file_size integer NOT NULL CHECK (file_size > 0),
  file_path text NOT NULL,
  uploaded_by varchar REFERENCES users(id) ON DELETE SET NULL,
  uploaded_at timestamp NOT NULL DEFAULT now(),
  CONSTRAINT backup_evidence_attachments_one_parent_check
    CHECK (num_nonnulls(job_run_id, restore_test_id) = 1)
);

CREATE UNIQUE INDEX IF NOT EXISTS backup_evidence_job_run_name_version_uq
  ON backup_evidence_attachments(job_run_id, lower(btrim(original_name)), version);
CREATE UNIQUE INDEX IF NOT EXISTS backup_evidence_restore_test_name_version_uq
  ON backup_evidence_attachments(restore_test_id, lower(btrim(original_name)), version);
CREATE INDEX IF NOT EXISTS backup_evidence_job_run_uploaded_idx
  ON backup_evidence_attachments(job_run_id, uploaded_at);
CREATE INDEX IF NOT EXISTS backup_evidence_restore_test_uploaded_idx
  ON backup_evidence_attachments(restore_test_id, uploaded_at);
