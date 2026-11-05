INSERT INTO dropdown_options (category, value, label, display_order, is_active)
VALUES ('kb_category', 'GRC & Compliance', 'GRC & Compliance', 10, true)
ON CONFLICT DO NOTHING;
