-- PostgreSQL UNIQUE permits multiple NULLs, but not multiple empty strings.
-- Relax first so existing blank emails can be normalized without dropping data.
ALTER TABLE employees ALTER COLUMN email DROP NOT NULL;
UPDATE employees SET email = NULL WHERE email IS NOT NULL AND email ~ '^[[:space:]]*$';
