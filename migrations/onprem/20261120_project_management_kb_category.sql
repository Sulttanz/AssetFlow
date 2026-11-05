INSERT INTO dropdown_options (category, value, label, display_order, is_active)
VALUES ('kb_category', 'Project Management & Governance', 'Project Management & Governance', 8, true)
ON CONFLICT DO NOTHING;
