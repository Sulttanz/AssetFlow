INSERT INTO dropdown_options (category, value, label, display_order, is_active)
VALUES ('kb_category', 'My Assets & ITAM / CMDB', 'My Assets & ITAM / CMDB', 7, true)
ON CONFLICT DO NOTHING;
