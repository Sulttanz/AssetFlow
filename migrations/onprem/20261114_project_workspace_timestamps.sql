DO $project_workspace$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'project_workspace_updated_at'
      AND tgrelid = 'project_risks'::regclass
  ) THEN
    CREATE TRIGGER project_workspace_updated_at
      BEFORE UPDATE ON project_risks
      FOR EACH ROW EXECUTE FUNCTION project_management_touch_updated_at();
  END IF;
END;
$project_workspace$;

DO $project_workspace$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'project_workspace_updated_at'
      AND tgrelid = 'project_changes'::regclass
  ) THEN
    CREATE TRIGGER project_workspace_updated_at
      BEFORE UPDATE ON project_changes
      FOR EACH ROW EXECUTE FUNCTION project_management_touch_updated_at();
  END IF;
END;
$project_workspace$;
