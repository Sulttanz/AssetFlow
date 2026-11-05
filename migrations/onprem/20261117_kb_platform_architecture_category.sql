INSERT INTO dropdown_options (category, value, label, display_order, is_active)
VALUES (
  'kb_category',
  'Getting Started & Platform Overview',
  'Getting Started & Platform Overview',
  5,
  true
)
ON CONFLICT DO NOTHING;
