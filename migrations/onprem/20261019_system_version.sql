INSERT INTO settings (key, value, description)
VALUES ('system_version', 'v2.2.0', 'Current application release version')
ON CONFLICT (key) DO NOTHING;
