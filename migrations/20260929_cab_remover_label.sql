-- Retain the remover's display name if their account is later deleted.
BEGIN;

ALTER TABLE change_approvals ADD COLUMN IF NOT EXISTS removed_by_label text;

UPDATE change_approvals AS a
SET removed_by_label = COALESCE(
  NULLIF(trim(concat_ws(' ', u.first_name, u.last_name)), ''),
  u.username
)
FROM users AS u
WHERE a.removed_by_id = u.id AND a.removed_at IS NOT NULL AND a.removed_by_label IS NULL;

COMMIT;