/**
 * Explicit reset policy: adding a database table requires choosing whether its
 * data is business content or protected configuration. Never infer this by FK
 * cascade, since that could erase accounts or authorization settings.
 */
export const RESET_BUSINESS_TABLES = [
  "employee_access_rights", "employee_offboarding_clearances", "employees",
  "project_tasks", "project_risks", "project_changes", "project_documents", "project_baselines",
  "project_milestones", "project_managers", "project_team_members", "project_assets",
  "service_contracts", "projects", "assets", "software_license_allocations", "assignments", "asset_handovers",
  "assignment_groups", "assignment_group_members",
  "vendors", "vendor_certifications", "consumables", "consumable_stock_movements", "consumable_dispatch_log",
  "vendor_quotations", "vendor_quotation_items", "purchase_orders", "purchase_order_items", "purchase_order_item_receipts",
  "purchase_invoices", "purchase_invoice_items", "purchase_invoice_payments", "purchase_returns", "purchase_return_items", "budgets",
  "maintenance_schedules", "maintenance_records", "audit_logs", "system_notifications", "data_migration_batches",
  "cmdb_applications", "servers", "application_server_links", "network_zones", "network_devices",
  "network_device_links", "firewall_rules", "firewall_rule_reviews", "backup_schedules",
  "backup_job_runs", "backup_restore_tests", "it_component_compliance_reviews",
  "contracts", "vendor_contracts", "vendor_contract_assets", "vendor_contract_purchase_orders",
  "vendor_contract_servers", "asset_bookings", "asset_disposal_records", "asset_audit_sessions",
  "asset_audit_items", "asset_relationships", "asset_requests", "asset_attachments",
  "configuration_documents", "tickets", "ticket_comments", "ticket_attachments",
  "kb_articles", "kb_article_versions", "kb_article_attachments", "kb_article_control_mappings",
  "kb_ticket_links", "problems", "problem_incidents", "catalog_items", "service_catalog_items",
  "changes", "incidents", "incident_activities", "service_requests", "service_request_activities",
  "service_requests_approvals", "risk_register", "change_risk_links", "change_ci_links", "change_asset_links",
  "change_approvals", "change_environment_stages", "change_pirs",
] as const;

export const RESET_PROTECTED_TABLES = [
  "users", "roles", "permissions", "user_roles", "role_permissions",
  "sessions", "cab_stream_leases", "system_settings", "settings", "module_settings",
  "dropdown_options", "locations", "departments", "warehouse_locations", "sla_policies",
  "change_blackouts",
] as const;

export interface SystemDataResetActor {
  userId: string;
  username: string;
  ipAddress?: string | null;
  userAgent?: string | null;
}

export function systemDataResetAudit(actor: SystemDataResetActor) {
  return {
    userId: actor.userId,
    action: "CLEAR_SYSTEM_DATA",
    tableName: "system",
    recordId: "clear-data",
    recordName: "Clear All System Data",
    ipAddress: actor.ipAddress ?? null,
    userAgent: actor.userAgent ?? null,
    newValues: JSON.stringify({
      clearedBy: actor.username,
      clearedTables: RESET_BUSINESS_TABLES,
      preservedTables: RESET_PROTECTED_TABLES,
      preservedSystemGuideRecords: true,
      reason: "Administrator confirmed the business-data reset using their current password.",
    }),
  };
}
