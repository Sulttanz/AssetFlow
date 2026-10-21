INSERT INTO dropdown_options (category, value, label, display_order, is_active)
VALUES
  ('consumable_category', 'Toner', 'Toner', 0, true),
  ('consumable_category', 'Peripherals', 'Peripherals', 1, true),
  ('consumable_category', 'Cables', 'Cables', 2, true),
  ('consumable_category', 'Adapters', 'Adapters', 3, true),
  ('consumable_category', 'Batteries', 'Batteries', 4, true),
  ('consumable_category', 'Paper', 'Paper', 5, true),
  ('consumable_category', 'Other', 'Other', 6, true)
ON CONFLICT DO NOTHING;
