INSERT INTO dropdown_options (category, value, label, display_order, is_active)
VALUES ('kb_category', 'Employee Support', 'Employee Support', 6, true)
ON CONFLICT DO NOTHING;
