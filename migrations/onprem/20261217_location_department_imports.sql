ALTER TABLE locations
  ADD COLUMN IF NOT EXISTS code text,
  ADD COLUMN IF NOT EXISTS notes text;

ALTER TABLE departments
  ADD COLUMN IF NOT EXISTS code text,
  ADD COLUMN IF NOT EXISTS cost_center text;

CREATE UNIQUE INDEX IF NOT EXISTS locations_name_normalized_uidx
  ON locations (lower(btrim(name)));

DO $locations_departments$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint c
    JOIN LATERAL unnest(c.conkey, c.confkey) AS key(child_attnum, parent_attnum) ON true
    JOIN pg_attribute child_column
      ON child_column.attrelid = c.conrelid AND child_column.attnum = key.child_attnum
    JOIN pg_attribute parent_column
      ON parent_column.attrelid = c.confrelid AND parent_column.attnum = key.parent_attnum
    WHERE c.contype = 'f'
      AND c.conrelid = 'departments'::regclass
      AND c.confrelid = 'locations'::regclass
      AND child_column.attname = 'location_id'
      AND parent_column.attname = 'id'
  ) THEN
    ALTER TABLE departments
      ADD CONSTRAINT departments_location_id_fkey
      FOREIGN KEY (location_id) REFERENCES locations(id)
      ON DELETE SET NULL NOT VALID;
  END IF;
END;
$locations_departments$;
