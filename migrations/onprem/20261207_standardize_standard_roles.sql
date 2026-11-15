-- Merge only known built-in role aliases. Permission grants and user assignments
-- are unioned onto the retained role before aliases are removed; custom roles are
-- untouched. The application migration runner checksum-locks this migration.
DO $role_standardization$
DECLARE
  role_definition record;
  keeper_id varchar;
  duplicate_id varchar;
BEGIN
  FOR role_definition IN
    SELECT * FROM (VALUES
      ('system_admin', 'System Administrator', 'Full system access with all permissions.', ARRAY['system_admin','system_administrator','administrator','admin']::text[]),
      ('it_manager', 'IT Manager', 'IT operations management, change governance, CMDB, financials, and offboarding.', ARRAY['it_manager','it_operations_manager','manager']::text[]),
      ('it_agent', 'IT Agent', 'IT operations: incident, request, problem, and IT asset workbenches.', ARRAY['it_agent','it_staff','it_support_staff','helpdesk_agent','help_desk_agent']::text[]),
      ('cab_member', 'CAB Member', 'Change approval, CMDB impact, financial review, and offboarding clearance.', ARRAY['cab_member','cab_approver']::text[]),
      ('auditor', 'Auditor', 'Read-only access governance, audit logs, and asset inventory.', ARRAY['auditor','compliance_auditor']::text[]),
      ('asset_manager', 'Asset Manager', 'Asset and assignment management.', ARRAY['asset_manager']::text[]),
      ('end_user', 'End User', 'Employee self-service: service catalog, personal tickets, and assigned assets.', ARRAY['end_user','employee']::text[]),
      ('read_only_user', 'Read Only User', 'Read-only role template; permissions are assigned explicitly by an administrator.', ARRAY['read_only_user','readonly_user']::text[])
    ) AS standard_roles(role_key, display_name, description, aliases)
  LOOP
    SELECT r.id INTO keeper_id
    FROM roles r
    WHERE lower(regexp_replace(btrim(r.name), '[[:space:]-]+', '_', 'g')) = ANY(role_definition.aliases)
    ORDER BY (r.name = role_definition.role_key) DESC, r.is_system_role DESC NULLS LAST, r.created_at ASC NULLS FIRST, r.id
    LIMIT 1
    FOR UPDATE;

    IF keeper_id IS NULL THEN
      INSERT INTO roles (name, description, is_system_role)
      VALUES (role_definition.role_key, role_definition.description, true)
      RETURNING id INTO keeper_id;
    ELSE
      FOR duplicate_id IN
        SELECT r.id FROM roles r
        WHERE r.id <> keeper_id
          AND lower(regexp_replace(btrim(r.name), '[[:space:]-]+', '_', 'g')) = ANY(role_definition.aliases)
        FOR UPDATE
      LOOP
        INSERT INTO role_permissions (role_id, permission_id)
        SELECT keeper_id, source.permission_id
        FROM role_permissions source
        WHERE source.role_id = duplicate_id
          AND NOT EXISTS (
            SELECT 1 FROM role_permissions current_grant
            WHERE current_grant.role_id = keeper_id
              AND current_grant.permission_id = source.permission_id
          );

        INSERT INTO user_roles (user_id, role_id, assigned_at, assigned_by)
        SELECT source.user_id, keeper_id, source.assigned_at, source.assigned_by
        FROM user_roles source
        WHERE source.role_id = duplicate_id
          AND NOT EXISTS (
            SELECT 1 FROM user_roles current_assignment
            WHERE current_assignment.user_id = source.user_id
              AND current_assignment.role_id = keeper_id
          );

        DELETE FROM user_roles WHERE role_id = duplicate_id;
        DELETE FROM role_permissions WHERE role_id = duplicate_id;
        DELETE FROM roles WHERE id = duplicate_id;
      END LOOP;

      UPDATE roles
      SET name = role_definition.role_key,
          description = COALESCE(NULLIF(btrim(description), ''), role_definition.description),
          is_system_role = true
      WHERE id = keeper_id;
    END IF;
  END LOOP;
END;
$role_standardization$;
