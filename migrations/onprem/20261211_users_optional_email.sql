-- User accounts may authenticate by username without a contact email.
UPDATE users
SET email = NULL
WHERE email IS NOT NULL AND btrim(email) = '';

ALTER TABLE users ALTER COLUMN email DROP NOT NULL;
