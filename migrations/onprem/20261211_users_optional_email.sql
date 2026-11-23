-- User accounts may authenticate by username without a contact email.
ALTER TABLE users ALTER COLUMN email DROP NOT NULL;

UPDATE users
SET email = NULL
WHERE email IS NOT NULL AND btrim(email) = '';
