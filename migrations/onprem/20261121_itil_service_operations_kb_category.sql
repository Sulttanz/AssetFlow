INSERT INTO dropdown_options (category, value, label, display_order, is_active)
VALUES ('kb_category', 'ITIL Service Operation & Change Management', 'ITIL Service Operation & Change Management', 9, true)
ON CONFLICT DO NOTHING;
